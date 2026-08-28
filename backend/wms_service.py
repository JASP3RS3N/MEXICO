"""Shared logic for the WMS Producción ↔ Almacén module.

Everything that more than one router needs: folios, la bitácora inmutable, el
cálculo del semáforo/SLA y la lectura del snapshot de inventario SAP. Los
routers se quedan con validación de permisos y forma de la respuesta.

Nota de alcance: este módulo NUNCA escribe hacia SAP. La única relación con SAP
es leer el snapshot que dejó el export (ver sap_inventory_ingest.py).
"""
from datetime import datetime, timezone
from typing import Optional

from config import (
    WMS_ACTION_CREATED,
    WMS_COMPLETE,
    WMS_DEFAULT_CONFIG,
    WMS_OPEN_STATUSES,
    WMS_PARTIAL,
    WMS_PENDING,
    db,
    gen_id,
    next_sequence,
    now,
    now_iso,
    tenant_query,
)


# ---------------------------------------------------------------------------
# Folio
# ---------------------------------------------------------------------------
async def next_folio(tenant_id: str) -> str:
    """Consecutivo legible por tenant: REQ-2026-000123.

    El contador es único por tenant (no se reinicia por año) para que el folio
    nunca se repita aunque el año cambie a mitad de turno.
    """
    seq = await next_sequence("wms_request", tenant_id)
    return f"REQ-{now().year}-{seq:06d}"


# ---------------------------------------------------------------------------
# Tiempos y semáforo
# ---------------------------------------------------------------------------
def parse_iso(value) -> Optional[datetime]:
    """Parse a stored ISO timestamp into an aware datetime. None si es inválido."""
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def minutes_between(start, end=None) -> float:
    """Minutos transcurridos entre dos timestamps ISO. end=None → ahora."""
    start_dt = parse_iso(start)
    if start_dt is None:
        return 0.0
    end_dt = parse_iso(end) if end else now()
    if end_dt is None:
        end_dt = now()
    return max(0.0, (end_dt - start_dt).total_seconds() / 60)


async def get_wms_config(tenant_id: str) -> dict:
    """Umbrales del tenant, con los defaults como respaldo.

    Viven dentro del doc de settings (settings.wms_config), igual que
    fiscal_config — no hay colección aparte ni endpoint de configuración
    paralelo: se editan con el PUT /settings que ya existe.
    """
    doc = await db.settings.find_one(
        tenant_query(tenant_id, {"id": "settings"}), {"_id": 0, "wms_config": 1}
    )
    cfg = dict(WMS_DEFAULT_CONFIG)
    stored = (doc or {}).get("wms_config") or {}
    for key in cfg:
        if stored.get(key) is not None:
            cfg[key] = stored[key]
    return cfg


def alert_level(minutes: float, cfg: dict) -> str:
    """Nivel del semáforo para una solicitud abierta: green | yellow | red.

    Rojo (>yellow_max_minutes) es el que la UI pinta en alto contraste.
    """
    if minutes <= cfg["green_max_minutes"]:
        return "green"
    if minutes <= cfg["yellow_max_minutes"]:
        return "yellow"
    return "red"


# ---------------------------------------------------------------------------
# Inventario SAP (solo lectura)
# ---------------------------------------------------------------------------
async def get_snapshot(tenant_id: str, part_number: str, location_id: str) -> Optional[dict]:
    """Snapshot vigente de una parte en una locación. None si SAP no la reporta."""
    return await db.wms_inventory_snapshots.find_one(
        tenant_query(tenant_id, {"part_number": part_number, "location_id": location_id}),
        {"_id": 0},
    )


async def snapshot_quantity(tenant_id: str, part_number: str, location_id: str) -> Optional[float]:
    """Cantidad disponible según el snapshot vigente. None si no hay dato.

    None y 0 son distintos a propósito: None = SAP no reporta esa parte en esa
    locación (no podemos afirmar que haya quiebre), 0 = SAP reporta cero.
    """
    snap = await get_snapshot(tenant_id, part_number, location_id)
    if not snap:
        return None
    return float(snap.get("available_quantity", 0))


# ---------------------------------------------------------------------------
# Bitácora inmutable (RequestAuditLog)
# ---------------------------------------------------------------------------
async def log_audit(
    tenant_id: str,
    request_doc: dict,
    action: str,
    actor: dict,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    payload: Optional[dict] = None,
) -> dict:
    """Agrega una entrada a la bitácora. Solo se inserta, nunca se actualiza."""
    entry = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "request_id": request_doc["id"],
        "folio": request_doc.get("folio", ""),
        "action": action,
        "from_status": from_status,
        "to_status": to_status,
        "actor_user_id": actor.get("id"),
        "actor_name": actor.get("name") or actor.get("username") or "",
        "actor_role": actor.get("role", ""),
        "payload": payload or {},
        "created_at": now_iso(),
    }
    await db.wms_audit_log.insert_one(dict(entry))
    return entry


# ---------------------------------------------------------------------------
# Construcción / enriquecimiento de solicitudes
# ---------------------------------------------------------------------------
async def build_request(
    tenant_id: str,
    payload,
    user: dict,
    location: dict,
) -> dict:
    """Arma el documento de una solicitud nueva (sin insertarlo).

    Toma la descripción y la unidad del snapshot SAP cuando el cliente no las
    mandó, y guarda el stock disponible del momento para poder marcar el
    "riesgo de quiebre" sin volver a consultar.
    """
    snap = await get_snapshot(tenant_id, payload.part_number, location["id"])
    available = float(snap["available_quantity"]) if snap else None

    return {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "folio": await next_folio(tenant_id),
        "part_number": payload.part_number,
        "description": (payload.description or "").strip() or (snap or {}).get("description", ""),
        "quantity_requested": float(payload.quantity_requested),
        "unit_of_measure": (payload.unit_of_measure or "").strip() or (snap or {}).get("unit_of_measure", ""),
        "location_id": location["id"],
        "plant_code": location.get("code", ""),
        "location_name": location.get("name", ""),
        "requested_by_user_id": user["id"],
        "requested_by_name": user.get("name") or user.get("username", ""),
        "requested_at": now_iso(),
        "priority": payload.priority,
        "status": WMS_PENDING,
        "notes": (payload.notes or "").strip(),
        # Surtido
        "claimed_by_user_id": None,
        "claimed_by_name": None,
        "claimed_at": None,
        "closed_at": None,
        "quantity_fulfilled_total": 0.0,
        # Auditoría del inventario SAP al momento de solicitar
        "available_stock_at_request": available,
        "created_at": now_iso(),
    }


async def create_request(tenant_id: str, payload, user: dict, location: dict) -> dict:
    """Inserta la solicitud y deja su primera entrada en la bitácora."""
    doc = await build_request(tenant_id, payload, user, location)
    # insert_one mutaría el dict agregándole el _id de Mongo; se inserta una
    # copia para poder devolver el documento tal cual, sin campos internos.
    await db.wms_requests.insert_one(dict(doc))
    await log_audit(
        tenant_id,
        doc,
        WMS_ACTION_CREATED,
        user,
        to_status=WMS_PENDING,
        payload={
            "part_number": doc["part_number"],
            "quantity_requested": doc["quantity_requested"],
            "priority": doc["priority"],
        },
    )
    return doc


def decorate_request(req: dict, cfg: dict) -> dict:
    """Agrega los campos derivados que consume la UI (semáforo, SLA, quiebre).

    Se calculan al vuelo en vez de guardarse: el tiempo transcurrido cambia
    cada segundo y guardarlo obligaría a un job que reescriba documentos.
    """
    is_open = req.get("status") in WMS_OPEN_STATUSES
    reference_end = None if is_open else req.get("closed_at")
    elapsed = minutes_between(req.get("requested_at"), reference_end)

    requested = float(req.get("quantity_requested", 0) or 0)
    fulfilled = float(req.get("quantity_fulfilled_total", 0) or 0)
    available = req.get("available_stock_at_request")

    return {
        **req,
        "minutes_elapsed": round(elapsed, 1),
        "alert_level": alert_level(elapsed, cfg) if is_open else None,
        "is_open": is_open,
        "within_sla": None if is_open else elapsed <= cfg["sla_minutes"],
        "quantity_pending": round(max(requested - fulfilled, 0), 3),
        # Riesgo de quiebre: SAP reportaba menos de lo que se pidió. None
        # (SAP no reporta la parte) no cuenta como riesgo, solo como sin dato.
        "stock_risk": available is not None and available < requested,
    }


async def decorate_many(tenant_id: str, requests: list, cfg: Optional[dict] = None) -> list:
    cfg = cfg or await get_wms_config(tenant_id)
    return [decorate_request(r, cfg) for r in requests]


# ---------------------------------------------------------------------------
# Cierre de una solicitud
# ---------------------------------------------------------------------------
def resolve_close_status(quantity_requested: float, quantity_fulfilled_total: float) -> str:
    """Estado final según lo entregado: completo si cubrió (o superó) lo pedido."""
    if quantity_fulfilled_total >= quantity_requested:
        return WMS_COMPLETE
    return WMS_PARTIAL


async def open_requests(tenant_id: str, location_id: Optional[str] = None) -> list:
    """Solicitudes abiertas (pendiente o en proceso), opcionalmente por locación."""
    extra = {"status": {"$in": WMS_OPEN_STATUSES}}
    if location_id:
        extra["location_id"] = location_id
    return await db.wms_requests.find(tenant_query(tenant_id, extra), {"_id": 0}).to_list(2000)


# Orden del tablero de almacén: urgentes primero, luego la más vieja.
def board_sort_key(req: dict):
    return (0 if req.get("priority") == "urgente" else 1, req.get("requested_at") or "")

