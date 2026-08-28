"""Inventario SAP del WMS — SOLO LECTURA.

Expone el snapshot vigente que dejó la ingesta (sap_inventory_ingest.py) para
que Producción valide disponibilidad antes de solicitar, más el disparo manual
de la sincronización y su bitácora.

No existe ningún endpoint que escriba hacia SAP: lo único que se escribe es la
copia local del snapshot, alimentada por el archivo plano del export.
"""
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query

from config import SAP_INVENTORY_ENABLED, db, tenant_query
from security import get_tenant_id, require_owner, require_wms, user_location_id
from wms_service import get_wms_config

router = APIRouter()
logger = logging.getLogger("smokehouse.wms.inventory")


async def _assert_location_visible(user: dict, tenant_id: str, location_id: str) -> None:
    """Un operador solo consulta el inventario de su propia locación."""
    own = user_location_id(user)
    if own and own != location_id:
        raise HTTPException(status_code=403, detail="Esa locación no te corresponde")
    if not await db.wms_locations.find_one(tenant_query(tenant_id, {"id": location_id})):
        raise HTTPException(status_code=404, detail="Locación no encontrada")


# ---------------------------------------------------------------------------
# Consulta del snapshot vigente
# ---------------------------------------------------------------------------
@router.get("/inventory/by-location/{location_id}")
async def inventory_by_location(
    location_id: str,
    q: str = Query(None, description="Filtra por número de parte o descripción"),
    only_available: bool = Query(False, description="Solo partes con existencia > 0"),
    limit: int = Query(500, ge=1, le=5000),
    user: dict = Depends(require_wms),
):
    """Catálogo de partes con su existencia según el último export de SAP.

    Es referencia, no autoridad: la app no reconcilia ni reemplaza el
    inventario oficial de SAP, solo muestra la foto más reciente que recibió.
    """
    tenant_id = get_tenant_id(user)
    await _assert_location_visible(user, tenant_id, location_id)

    extra = {"location_id": location_id}
    if only_available:
        extra["available_quantity"] = {"$gt": 0}
    if q:
        # Se escapa: lo que el operador teclea es texto a buscar, no una
        # expresión regular (un "*" o un "(" suelto tiraría la consulta).
        needle = re.escape(q.strip())
        if needle:
            # $options "i" para que no tenga que respetar mayúsculas.
            extra["$or"] = [
                {"part_number": {"$regex": needle, "$options": "i"}},
                {"description": {"$regex": needle, "$options": "i"}},
            ]

    items = (
        await db.wms_inventory_snapshots.find(tenant_query(tenant_id, extra), {"_id": 0})
        .sort("part_number", 1)
        .to_list(limit)
    )
    return items


@router.get("/inventory/part/{location_id}/{part_number}")
async def inventory_part(location_id: str, part_number: str, user: dict = Depends(require_wms)):
    """Una parte concreta — lo que consume el autocompletado de Producción."""
    tenant_id = get_tenant_id(user)
    await _assert_location_visible(user, tenant_id, location_id)
    snapshot = await db.wms_inventory_snapshots.find_one(
        tenant_query(tenant_id, {"location_id": location_id, "part_number": part_number.strip().upper()}),
        {"_id": 0},
    )
    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail="El último export de SAP no reporta esa parte en esta locación",
        )
    return snapshot


# ---------------------------------------------------------------------------
# Sincronización (disparo manual) y bitácora
# ---------------------------------------------------------------------------
@router.post("/inventory/sync")
async def sync_inventory(user: dict = Depends(require_owner)):
    """Fuerza la relectura del export de SAP y devuelve el log de la corrida.

    El scheduler ya la corre cada hora; esto es para cuando el supervisor
    acaba de dejar un archivo nuevo y no quiere esperar.
    """
    # Import local: mantiene el arranque de la app independiente de openpyxl,
    # que solo hace falta cuando el export viene en .xlsx.
    from sap_inventory_ingest import run_sync

    tenant_id = get_tenant_id(user)
    log = await run_sync(tenant_id, trigger="manual", force=True)
    if log["status"] == "error":
        # 502: la app está bien, quien falló es la fuente del archivo.
        raise HTTPException(status_code=502, detail=log["error"])
    return log


@router.get("/inventory/sync-logs")
async def inventory_sync_logs(
    limit: int = Query(50, ge=1, le=500), user: dict = Depends(require_owner)
):
    """Historial de corridas de la ingesta SAP."""
    tenant_id = get_tenant_id(user)
    return (
        await db.wms_sap_sync_logs.find(tenant_query(tenant_id), {"_id": 0})
        .sort("started_at", -1)
        .to_list(limit)
    )


@router.get("/inventory/sync-health")
async def inventory_sync_health(user: dict = Depends(require_wms)):
    """Salud de la ingesta: si el script de SAP dejó de correr, se ve aquí.

    Lo consume la tarjeta del dashboard de Admin y el aviso de "inventario
    desactualizado" que ve Producción.
    """
    from sap_inventory_ingest import sync_health

    tenant_id = get_tenant_id(user)
    cfg = await get_wms_config(tenant_id)
    health = await sync_health(tenant_id, cfg["sap_sync_stale_minutes"])
    health["enabled"] = SAP_INVENTORY_ENABLED
    return health
