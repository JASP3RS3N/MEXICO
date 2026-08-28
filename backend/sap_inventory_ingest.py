"""Ingesta del inventario de SAP — SOLO LECTURA, unidireccional vía archivo plano.

Un script externo (SAP GUI Scripting / RFC, disparado por el Task Scheduler de
Windows) corre la transacción **MB52** cada hora y deja el export en una carpeta
compartida. Este módulo detecta el archivo, lo parsea y actualiza la colección
``wms_inventory_snapshots``, dejando la bitácora de cada corrida en
``wms_sap_sync_logs``.

RESTRICCIÓN DURA: aquí no existe —ni debe existir— ninguna ruta de escritura
hacia SAP. El archivo se abre en modo lectura y jamás se mueve, renombra ni
borra (la carpeta se monta como read-only en docker-compose).

Formatos soportados, que es como suele salir MB52:
  * ``.txt`` / ``.csv`` delimitado por tabulador, ``|`` (lista ALV con bordes),
    punto y coma o coma — el delimitador se detecta solo.
  * ``.xlsx`` (openpyxl). Los ``.xls`` viejos de SAP suelen ser en realidad
    HTML/tab-delimitado renombrado, así que también se intentan como texto.

MB52 devuelve **una fila por material × centro × almacén × lote**, de modo que
el stock de libre utilización se **suma** por (parte, locación) en vez de
quedarse con la última fila leída.
"""
import csv
import glob
import io
import logging
import os
import re
import unicodedata
from typing import Optional

from config import (
    SAP_COL_DESCRIPTION,
    SAP_COL_PART_NUMBER,
    SAP_COL_PLANT,
    SAP_COL_QTY,
    SAP_COL_STORAGE_LOCATION,
    SAP_COL_UOM,
    SAP_DECIMAL_SEPARATOR,
    SAP_INVENTORY_EXPORT_PATH,
    SAP_INVENTORY_FILE_GLOB,
    SAP_INVENTORY_TENANT_SLUG,
    SAP_LOCATION_MODE,
    db,
    gen_id,
    now,
    now_iso,
    tenant_query,
)
from wms_service import minutes_between

logger = logging.getLogger("smokehouse.wms.sap")

# Alias de columnas de MB52 en inglés y español. La detección normaliza el
# encabezado (minúsculas, sin acentos ni signos) antes de comparar, así que
# "Libre utilización" y "libre utilizacion" caen en el mismo alias.
COLUMN_ALIASES = {
    "part_number": [
        "material", "matnr", "numero de parte", "num parte", "no parte",
        "part number", "part no", "articulo", "codigo material", "material number",
    ],
    "description": [
        "material description", "maktx", "descripcion", "descripcion material",
        "texto breve material", "texto breve de material", "description",
        "denominacion", "material descr",
    ],
    "plant": ["plant", "werks", "centro", "planta"],
    "storage_location": [
        "storage location", "lgort", "almacen", "sloc", "stge loc", "stge location",
        "storage loc", "ubicacion",
    ],
    "qty": [
        "unrestricted", "labst", "libre utilizacion", "libre utiliz",
        "stock libre utilizacion", "unrestricted stock", "unrestricted use",
        "valuated unrestricted use stock", "cantidad", "stock disponible",
        "disponible", "qty", "cantidad disponible",
    ],
    "uom": [
        "base unit of measure", "meins", "bun", "umb", "unidad medida base",
        "unidad de medida", "unidad", "uom", "unit of measure", "um",
    ],
}

# Mapeo explícito por variables de entorno; si un campo viene vacío se cae a la
# autodetección por alias.
ENV_OVERRIDES = {
    "part_number": SAP_COL_PART_NUMBER,
    "description": SAP_COL_DESCRIPTION,
    "plant": SAP_COL_PLANT,
    "storage_location": SAP_COL_STORAGE_LOCATION,
    "qty": SAP_COL_QTY,
    "uom": SAP_COL_UOM,
}

REQUIRED_FIELDS = ("part_number", "plant", "qty")


# ---------------------------------------------------------------------------
# Normalización
# ---------------------------------------------------------------------------
def normalize_header(value: str) -> str:
    """Encabezado comparable: minúsculas, sin acentos, sin signos, sin dobles espacios."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().replace(".", " ").replace("_", " ").replace("-", " ")
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_decimal_separator(samples: list) -> str:
    """Deduce el separador decimal mirando TODA la columna de cantidad.

    Hacerlo por valor suelto es peligroso: en MB52 las cantidades llevan 3
    decimales, así que un "10,000" aislado es 10 —no diez mil— y equivocarse
    mete un error de 1000×. Mirando el archivo completo el caso se resuelve
    solo en cuanto aparece un valor con los dos separadores o con miles
    repetidos. Si el archivo es genuinamente ambiguo se asume decimal, que es
    la lectura correcta para MB52.

    Se puede forzar con SAP_DECIMAL_SEPARATOR="." o ",".
    """
    if SAP_DECIMAL_SEPARATOR in (".", ","):
        return SAP_DECIMAL_SEPARATOR

    for text in samples:
        last_dot, last_comma = text.rfind("."), text.rfind(",")
        if last_dot >= 0 and last_comma >= 0:
            # Con ambos presentes, el decimal es el que va más a la derecha.
            return "," if last_comma > last_dot else "."

    for text in samples:
        # Un separador repetido solo puede ser el de miles.
        if text.count(".") > 1:
            return ","
        if text.count(",") > 1:
            return "."

    for text in samples:
        # Un separador que no deja exactamente 3 dígitos no puede ser miles.
        for separator in (".", ","):
            position = text.rfind(separator)
            if position >= 0 and len(text) - position - 1 != 3:
                return separator

    return ","  # ambiguo: MB52 imprime 3 decimales, así que decimal


def parse_sap_number(value, decimal_separator: str = ",") -> Optional[float]:
    """Convierte una cantidad de SAP a float. None si no es un número.

    SAP imprime el signo al final ("1.234,567-") y agrupa los miles con el
    separador contrario al decimal.
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text:
        return None

    negative = text.endswith("-")
    text = text.rstrip("-").rstrip("+").strip()
    text = text.replace(" ", "").replace("\u00a0", "")
    if not text:
        return None

    thousands = "." if decimal_separator == "," else ","
    text = text.replace(thousands, "").replace(decimal_separator, ".")

    try:
        result = float(text)
    except ValueError:
        return None
    return -result if negative else result


# ---------------------------------------------------------------------------
# Lectura de archivos
# ---------------------------------------------------------------------------
def find_latest_export(directory: str = None, pattern: str = None) -> Optional[str]:
    """Ruta del export más reciente de la carpeta, o None si no hay ninguno."""
    directory = directory or SAP_INVENTORY_EXPORT_PATH
    pattern = pattern or SAP_INVENTORY_FILE_GLOB
    if not directory or not os.path.isdir(directory):
        return None
    matches = [f for f in glob.glob(os.path.join(directory, pattern)) if os.path.isfile(f)]
    if not matches:
        return None
    return max(matches, key=os.path.getmtime)


def _clean_cell(value) -> str:
    """Limpia una celda del ALV: quita bordes, espacios y comillas sobrantes."""
    text = str(value if value is not None else "").strip()
    return text.strip("|").strip().strip('"').strip()


def _is_decoration(cells: list) -> bool:
    """True para las líneas de adorno del ALV (---, ===, o toda la fila vacía)."""
    joined = "".join(cells).strip()
    if not joined:
        return True
    return set(joined) <= set("-=+| _")


def read_rows_from_text(content: str) -> list:
    """Filas (listas de celdas) de un export de texto, sin adornos ni vacíos.

    Detecta el delimitador entre tabulador, ``|``, punto y coma y coma
    contando cuál aparece más en las primeras líneas con contenido.
    """
    lines = [ln for ln in content.splitlines() if ln.strip()]
    if not lines:
        return []

    sample = "\n".join(lines[:40])
    counts = {d: sample.count(d) for d in ("\t", "|", ";", ",")}
    delimiter = max(counts, key=counts.get)
    if counts[delimiter] == 0:
        delimiter = "\t"

    rows = []
    if delimiter == "|":
        # Lista ALV: cada línea viene rodeada y separada por barras.
        for line in lines:
            cells = [_clean_cell(c) for c in line.split("|")]
            # split deja celdas vacías en los extremos por los bordes.
            while cells and cells[0] == "":
                cells.pop(0)
            while cells and cells[-1] == "":
                cells.pop()
            if cells and not _is_decoration(cells):
                rows.append(cells)
    else:
        for cells in csv.reader(io.StringIO("\n".join(lines)), delimiter=delimiter):
            cells = [_clean_cell(c) for c in cells]
            if cells and not _is_decoration(cells):
                rows.append(cells)
    return rows


def read_rows_from_xlsx(path: str) -> list:
    """Filas de un .xlsx. Requiere openpyxl (está en requirements)."""
    from openpyxl import load_workbook

    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook[workbook.sheetnames[0]]
        rows = []
        for raw in sheet.iter_rows(values_only=True):
            cells = [_clean_cell(c) for c in raw]
            if cells and not _is_decoration(cells):
                rows.append(cells)
        return rows
    finally:
        workbook.close()


def read_rows(path: str) -> list:
    """Filas del export, eligiendo el lector por extensión.

    Un .xls de SAP casi nunca es un XLS binario real (suele ser texto o HTML
    renombrado), por eso solo .xlsx va por openpyxl.
    """
    if path.lower().endswith(".xlsx"):
        return read_rows_from_xlsx(path)
    with open(path, "r", encoding="utf-8-sig", errors="replace") as handle:
        return read_rows_from_text(handle.read())


# ---------------------------------------------------------------------------
# Mapeo de columnas
# ---------------------------------------------------------------------------
def detect_header(rows: list) -> tuple:
    """Encuentra la fila de encabezados y devuelve (índice, {campo: posición}).

    Recorre las primeras filas porque MB52 antepone título, fecha y separadores
    antes del encabezado real. Se queda con la primera fila que resuelva todos
    los campos obligatorios.
    """
    env_map = {field: normalize_header(name) for field, name in ENV_OVERRIDES.items() if name}

    for index, cells in enumerate(rows[:30]):
        normalized = [normalize_header(c) for c in cells]
        mapping = {}
        for field, aliases in COLUMN_ALIASES.items():
            wanted = env_map.get(field)
            if wanted:
                if wanted in normalized:
                    mapping[field] = normalized.index(wanted)
                continue
            # Coincidencia exacta primero; si no, la primera que empiece igual
            # (MB52 corta encabezados largos a lo ancho de la columna).
            for alias in aliases:
                if alias in normalized:
                    mapping[field] = normalized.index(alias)
                    break
            else:
                for alias in aliases:
                    match = next((i for i, h in enumerate(normalized) if h and h.startswith(alias)), None)
                    if match is not None:
                        mapping[field] = match
                        break
        if all(field in mapping for field in REQUIRED_FIELDS):
            return index, mapping
    return -1, {}


def build_location_code(plant: str, storage_location: str) -> str:
    """Código de locación según SAP_LOCATION_MODE: "1000" o "1000/0001"."""
    plant = (plant or "").strip().upper()
    storage_location = (storage_location or "").strip().upper()
    if SAP_LOCATION_MODE == "plant" or not storage_location:
        return plant
    return f"{plant}/{storage_location}"


def parse_export(path: str) -> tuple:
    """Parsea el export y agrega el stock por (parte, locación).

    Devuelve ``(items, stats)``; items es una lista de dicts listos para
    guardarse como snapshot, stats trae los conteos para el SapSyncLog.
    """
    rows = read_rows(path)
    header_index, mapping = detect_header(rows)
    if header_index < 0:
        raise ValueError(
            "No se reconocieron las columnas del export de SAP. Se necesitan al menos "
            "material, centro y stock de libre utilización. Configura SAP_COL_* en el .env "
            "con los nombres exactos de tu archivo."
        )

    data_rows = rows[header_index + 1:]

    def cell(cells: list, field: str) -> str:
        position = mapping.get(field)
        if position is None or position >= len(cells):
            return ""
        return cells[position]

    # El separador decimal se decide una vez para todo el archivo (ver
    # detect_decimal_separator), nunca valor por valor.
    decimal_separator = detect_decimal_separator(
        [cell(cells, "qty").strip() for cells in data_rows if cell(cells, "qty").strip()]
    )

    aggregated = {}
    rows_read = 0
    rows_skipped = 0

    for cells in data_rows:
        rows_read += 1

        def column(field: str, _cells=cells) -> str:
            return cell(_cells, field)

        part_number = column("part_number").strip().upper()
        quantity = parse_sap_number(column("qty"), decimal_separator)
        plant = column("plant").strip().upper()
        if not part_number or plant == "" or quantity is None:
            rows_skipped += 1
            continue

        location_code = build_location_code(plant, column("storage_location"))
        key = (part_number, location_code)
        existing = aggregated.get(key)
        if existing:
            # MB52 trae una fila por lote: se acumula el disponible.
            existing["available_quantity"] += quantity
            existing["description"] = existing["description"] or column("description").strip()
            existing["unit_of_measure"] = existing["unit_of_measure"] or column("uom").strip().upper()
        else:
            aggregated[key] = {
                "part_number": part_number,
                "description": column("description").strip(),
                "plant_code": plant,
                "location_code": location_code,
                "available_quantity": quantity,
                "unit_of_measure": column("uom").strip().upper(),
            }

    items = list(aggregated.values())
    for item in items:
        item["available_quantity"] = round(item["available_quantity"], 3)

    stats = {
        "rows_read": rows_read,
        "rows_skipped": rows_skipped,
        "columns": {field: position for field, position in sorted(mapping.items())},
        "decimal_separator": decimal_separator,
    }
    return items, stats


# ---------------------------------------------------------------------------
# Locaciones y persistencia
# ---------------------------------------------------------------------------
async def resolve_tenant_id() -> Optional[str]:
    """Tenant al que pertenece el export.

    Con SAP_INVENTORY_TENANT_SLUG se fija explícitamente; sin él se usa el único
    tenant existente (el caso normal de una instalación en planta). Si hay
    varios y no se configuró el slug, no se adivina.
    """
    if SAP_INVENTORY_TENANT_SLUG:
        tenant = await db.tenants.find_one({"slug": SAP_INVENTORY_TENANT_SLUG}, {"_id": 0, "id": 1})
        return tenant["id"] if tenant else None
    tenants = await db.tenants.find({}, {"_id": 0, "id": 1}).to_list(2)
    if len(tenants) == 1:
        return tenants[0]["id"]
    return None


async def ensure_location(tenant_id: str, code: str, plant_code: str) -> dict:
    """Devuelve la locación con ese código, creándola si el export trae una nueva.

    Así el supervisor no tiene que dar de alta a mano cada centro/almacén que
    aparezca en MB52; después puede renombrarla desde Ajustes.
    """
    location = await db.wms_locations.find_one(tenant_query(tenant_id, {"code": code}), {"_id": 0})
    if location:
        return location
    location = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "code": code,
        "plant_code": plant_code,
        "name": code,  # editable después desde Ajustes
        "active": True,
        "created_at": now_iso(),
        "source": "sap_import",
    }
    await db.wms_locations.insert_one(dict(location))
    logger.info("Locación creada desde el export de SAP: %s", code)
    return location


async def store_snapshots(tenant_id: str, items: list, sync_id: str, snapshot_timestamp: str) -> int:
    """Upsert del snapshot vigente por (parte, locación). Devuelve cuántos escribió.

    Se mantiene un único documento por combinación —no un histórico— para que
    la lectura del catálogo sea O(1) por locación. El histórico ligero de cada
    corrida queda en wms_sap_sync_logs.
    """
    location_cache = {}
    written = 0
    for item in items:
        code = item["location_code"]
        if code not in location_cache:
            location_cache[code] = await ensure_location(tenant_id, code, item["plant_code"])
        location = location_cache[code]

        await db.wms_inventory_snapshots.update_one(
            tenant_query(tenant_id, {"part_number": item["part_number"], "location_id": location["id"]}),
            {
                "$set": {
                    "description": item["description"],
                    "available_quantity": item["available_quantity"],
                    "unit_of_measure": item["unit_of_measure"],
                    "plant_code": item["plant_code"],
                    "location_code": code,
                    "snapshot_timestamp": snapshot_timestamp,
                    "sync_id": sync_id,
                },
                "$setOnInsert": {
                    "id": gen_id(),
                    "tenant_id": tenant_id,
                    "part_number": item["part_number"],
                    "location_id": location["id"],
                },
            },
            upsert=True,
        )
        written += 1
    return written


async def _last_successful_log(tenant_id: str) -> Optional[dict]:
    logs = (
        await db.wms_sap_sync_logs.find(
            tenant_query(tenant_id, {"status": "success"}), {"_id": 0}
        )
        .sort("started_at", -1)
        .to_list(1)
    )
    return logs[0] if logs else None


# ---------------------------------------------------------------------------
# Corrida de sincronización
# ---------------------------------------------------------------------------
async def run_sync(tenant_id: str = None, trigger: str = "scheduler", force: bool = False) -> dict:
    """Corre una sincronización completa y devuelve el SapSyncLog resultante.

    ``force`` reprocesa el archivo aunque no haya cambiado desde la última
    corrida exitosa (lo usa el botón manual de Ajustes).
    """
    started = now()
    sync_id = gen_id()

    if tenant_id is None:
        tenant_id = await resolve_tenant_id()
    if not tenant_id:
        logger.warning("Ingesta SAP: no se pudo determinar el tenant (define SAP_INVENTORY_TENANT_SLUG).")
        return {
            "id": sync_id,
            "tenant_id": None,
            "status": "error",
            "error": "No se pudo determinar el tenant del export (define SAP_INVENTORY_TENANT_SLUG).",
            "trigger": trigger,
            "started_at": started.isoformat(),
            "finished_at": now_iso(),
            "rows_read": 0,
            "rows_upserted": 0,
            "rows_skipped": 0,
            "source_file": "",
        }

    log = {
        "id": sync_id,
        "tenant_id": tenant_id,
        "started_at": started.isoformat(),
        "finished_at": None,
        "source_file": "",
        "file_mtime": None,
        "rows_read": 0,
        "rows_upserted": 0,
        "rows_skipped": 0,
        "status": "error",
        "error": None,
        "trigger": trigger,
        "duration_ms": 0,
    }

    try:
        path = find_latest_export()
        if not path:
            raise FileNotFoundError(
                f"No se encontró ningún archivo en {SAP_INVENTORY_EXPORT_PATH} "
                f"(patrón {SAP_INVENTORY_FILE_GLOB}). Revisa que el script de SAP esté corriendo."
            )

        stat = os.stat(path)
        log["source_file"] = os.path.basename(path)
        log["file_mtime"] = stat.st_mtime

        previous = await _last_successful_log(tenant_id)
        unchanged = (
            previous
            and not force
            and previous.get("source_file") == log["source_file"]
            and previous.get("file_mtime") == stat.st_mtime
        )
        if unchanged:
            # El script de SAP no ha dejado un archivo nuevo: no reprocesamos,
            # pero sí registramos la corrida para que se vea que la app sí revisó.
            log.update(status="skipped", error=None)
        else:
            items, stats = parse_export(path)
            log["rows_read"] = stats["rows_read"]
            log["rows_skipped"] = stats["rows_skipped"]
            log["columns"] = stats["columns"]
            log["decimal_separator"] = stats["decimal_separator"]
            log["rows_upserted"] = await store_snapshots(
                tenant_id, items, sync_id, snapshot_timestamp=now_iso()
            )
            log["status"] = "success" if log["rows_upserted"] else "partial"
            if not log["rows_upserted"]:
                log["error"] = "El archivo se leyó pero no produjo ninguna fila válida."
    except Exception as exc:  # noqa: BLE001 - la ingesta nunca debe tumbar la app
        log["status"] = "error"
        log["error"] = str(exc)
        logger.warning("Ingesta SAP fallida: %s", exc)

    log["finished_at"] = now_iso()
    log["duration_ms"] = int((now() - started).total_seconds() * 1000)
    await db.wms_sap_sync_logs.insert_one(dict(log))
    if log["status"] in ("success", "partial"):
        logger.info(
            "Ingesta SAP %s: %s filas leídas, %s partes actualizadas (%s).",
            log["status"], log["rows_read"], log["rows_upserted"], log["source_file"],
        )
    return log


async def sync_all_tenants(trigger: str = "scheduler") -> list:
    """Corre la sincronización del tenant configurado. Lo usa el scheduler."""
    tenant_id = await resolve_tenant_id()
    if not tenant_id:
        logger.warning("Ingesta SAP omitida: no hay un tenant determinable.")
        return []
    return [await run_sync(tenant_id, trigger=trigger)]


# ---------------------------------------------------------------------------
# Salud de la ingesta (tarjeta del dashboard de Admin)
# ---------------------------------------------------------------------------
async def sync_health(tenant_id: str, stale_minutes: int) -> dict:
    """Estado de la ingesta: última corrida exitosa y si ya se considera caída."""
    last_success = await _last_successful_log(tenant_id)
    last_any = (
        await db.wms_sap_sync_logs.find(tenant_query(tenant_id), {"_id": 0})
        .sort("started_at", -1)
        .to_list(1)
    )
    last_run = last_any[0] if last_any else None

    minutes_since = minutes_between(last_success["started_at"]) if last_success else None
    parts_tracked = await db.wms_inventory_snapshots.count_documents(tenant_query(tenant_id))

    if last_success is None:
        status = "never"
    elif minutes_since is not None and minutes_since > stale_minutes:
        status = "stale"
    elif last_run and last_run.get("status") == "error":
        status = "degraded"
    else:
        status = "ok"

    return {
        "status": status,
        "export_path": SAP_INVENTORY_EXPORT_PATH,
        "stale_after_minutes": stale_minutes,
        "minutes_since_last_success": round(minutes_since, 1) if minutes_since is not None else None,
        "last_success": last_success,
        "last_run": last_run,
        "parts_tracked": parts_tracked,
    }
