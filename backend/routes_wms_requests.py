"""WMS Producción ↔ Almacén — solicitudes de material y tablero de surtido.

Producción levanta solicitudes, almacén las toma y las surte (total o
parcialmente), y cada cambio de estado queda en una bitácora inmutable
(wms_audit_log). El dueño hace de supervisor y puede ver/operar todo.
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from config import (
    ROLE_OWNER,
    WMS_ACTION_CANCELLED,
    WMS_ACTION_CLAIMED,
    WMS_ACTION_CLOSED,
    WMS_ACTION_FULFILLED,
    WMS_ACTION_RELEASED,
    WMS_CANCELLED,
    WMS_IN_PROGRESS,
    WMS_OPEN_STATUSES,
    WMS_PENDING,
    WMS_STATUSES,
    db,
    gen_id,
    now,
    now_iso,
    tenant_query,
)
from models_wms import (
    MaterialFulfillmentCreate,
    MaterialRequestCreate,
    MaterialRequestUpdate,
    RequestCancel,
    RequestRelease,
)
from security import (
    get_tenant_id,
    require_production,
    require_warehouse,
    require_wms,
    user_location_id,
)
from wms_service import (
    board_sort_key,
    create_request,
    decorate_many,
    decorate_request,
    get_wms_config,
    log_audit,
    minutes_between,
    resolve_close_status,
    snapshot_quantity,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _get_location(tenant_id: str, location_id: str) -> dict:
    location = await db.wms_locations.find_one(
        tenant_query(tenant_id, {"id": location_id}), {"_id": 0}
    )
    if not location:
        raise HTTPException(status_code=404, detail="Locación no encontrada")
    return location


async def _get_request(tenant_id: str, request_id: str) -> dict:
    req = await db.wms_requests.find_one(tenant_query(tenant_id, {"id": request_id}), {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return req


def _scope_to_user_location(user: dict, extra: dict, location_id: str = None) -> dict:
    """Restringe la consulta a la locación del usuario.

    Producción y almacén solo ven su planta; el supervisor (dueño), que no
    tiene locación asignada, puede filtrar libremente por cualquiera.
    """
    own = user_location_id(user)
    if own:
        extra["location_id"] = own
    elif location_id:
        extra["location_id"] = location_id
    return extra


async def _assert_can_act(user: dict, req: dict) -> None:
    """Un operador solo actúa sobre solicitudes de su propia locación."""
    own = user_location_id(user)
    if own and req.get("location_id") != own:
        raise HTTPException(
            status_code=403, detail="Esa solicitud pertenece a otra locación"
        )


# ---------------------------------------------------------------------------
# Producción: crear y consultar sus solicitudes
# ---------------------------------------------------------------------------
@router.post("/wms/requests")
async def create_material_request(
    payload: MaterialRequestCreate, user: dict = Depends(require_production)
):
    """Levanta una solicitud de material.

    El stock de SAP es solo referencia: si la parte está baja se guarda la
    bandera de riesgo de quiebre y se avisa en la respuesta, pero la solicitud
    NUNCA se bloquea — quien decide cómo proceder es almacén.
    """
    tenant_id = get_tenant_id(user)

    # La locación del usuario manda; el supervisor sin locación debe indicarla.
    location_id = user_location_id(user) or payload.location_id
    if not location_id:
        raise HTTPException(
            status_code=400,
            detail="Indica la locación/planta de la solicitud (tu usuario no tiene una asignada).",
        )
    location = await _get_location(tenant_id, location_id)

    doc = await create_request(tenant_id, payload, user, location)
    cfg = await get_wms_config(tenant_id)
    return decorate_request(doc, cfg)


@router.get("/wms/requests")
async def list_material_requests(
    status: str = Query(None, description="Filtra por estado exacto"),
    location_id: str = Query(None),
    part_number: str = Query(None),
    mine: bool = Query(False, description="Solo las que yo solicité"),
    start: str = Query(None, description="requested_at >= (ISO)"),
    end: str = Query(None, description="requested_at <= (ISO)"),
    limit: int = Query(500, ge=1, le=2000),
    user: dict = Depends(require_wms),
):
    tenant_id = get_tenant_id(user)
    extra = {}
    if status:
        if status not in WMS_STATUSES:
            raise HTTPException(status_code=400, detail=f"Estado inválido. Usa: {WMS_STATUSES}")
        extra["status"] = status
    if part_number:
        extra["part_number"] = part_number.strip().upper()
    if mine:
        extra["requested_by_user_id"] = user["id"]
    if start or end:
        window = {}
        if start:
            window["$gte"] = start
        if end:
            window["$lte"] = end
        extra["requested_at"] = window
    extra = _scope_to_user_location(user, extra, location_id)

    requests = (
        await db.wms_requests.find(tenant_query(tenant_id, extra), {"_id": 0})
        .sort("requested_at", -1)
        .to_list(limit)
    )
    return await decorate_many(tenant_id, requests)


@router.get("/wms/requests/mine")
async def my_material_requests(
    limit: int = Query(100, ge=1, le=1000), user: dict = Depends(require_wms)
):
    """Historial propio del solicitante — la vista por defecto de Producción."""
    tenant_id = get_tenant_id(user)
    requests = (
        await db.wms_requests.find(
            tenant_query(tenant_id, {"requested_by_user_id": user["id"]}), {"_id": 0}
        )
        .sort("requested_at", -1)
        .to_list(limit)
    )
    return await decorate_many(tenant_id, requests)


# ---------------------------------------------------------------------------
# Almacén: tablero Kanban
# ---------------------------------------------------------------------------
@router.get("/wms/board")
async def warehouse_board(
    location_id: str = Query(None),
    recent_hours: int = Query(12, ge=1, le=168, description="Ventana de la columna 'Surtido'"),
    user: dict = Depends(require_wms),
):
    """Tablero de almacén: Pendiente → En proceso → Surtido.

    Las columnas abiertas traen todo lo vivo; la de surtidas se limita a las
    últimas ``recent_hours`` para que el tablero no crezca sin control. Cada
    solicitud llega ya decorada con su nivel de semáforo y su riesgo de quiebre.
    """
    tenant_id = get_tenant_id(user)
    cfg = await get_wms_config(tenant_id)

    open_extra = _scope_to_user_location(user, {"status": {"$in": WMS_OPEN_STATUSES}}, location_id)
    open_requests = await db.wms_requests.find(
        tenant_query(tenant_id, open_extra), {"_id": 0}
    ).to_list(2000)

    cutoff = (now() - timedelta(hours=recent_hours)).isoformat()
    closed_extra = _scope_to_user_location(
        user, {"status": {"$nin": WMS_OPEN_STATUSES}, "closed_at": {"$gte": cutoff}}, location_id
    )
    closed_requests = (
        await db.wms_requests.find(tenant_query(tenant_id, closed_extra), {"_id": 0})
        .sort("closed_at", -1)
        .to_list(500)
    )

    # Urgentes primero, luego la más vieja: así el tablero se lee de arriba abajo.
    open_requests.sort(key=board_sort_key)
    decorated_open = [decorate_request(r, cfg) for r in open_requests]
    decorated_closed = [decorate_request(r, cfg) for r in closed_requests]

    columns = {
        "pendiente": [r for r in decorated_open if r["status"] == WMS_PENDING],
        "en_proceso": [r for r in decorated_open if r["status"] == WMS_IN_PROGRESS],
        "surtido": decorated_closed,
    }
    return {
        "config": cfg,
        "columns": columns,
        "counts": {
            "pendiente": len(columns["pendiente"]),
            "en_proceso": len(columns["en_proceso"]),
            "surtido": len(columns["surtido"]),
            # Lo que dispara el badge de la pestaña y la alerta sonora.
            "red": sum(1 for r in decorated_open if r["alert_level"] == "red"),
            "yellow": sum(1 for r in decorated_open if r["alert_level"] == "yellow"),
            "stock_risk": sum(1 for r in decorated_open if r["stock_risk"]),
        },
    }


# ---------------------------------------------------------------------------
# Detalle, edición y bitácora
# ---------------------------------------------------------------------------
@router.get("/wms/requests/{request_id}")
async def get_material_request(request_id: str, user: dict = Depends(require_wms)):
    tenant_id = get_tenant_id(user)
    req = await _get_request(tenant_id, request_id)
    await _assert_can_act(user, req)
    cfg = await get_wms_config(tenant_id)
    fulfillments = (
        await db.wms_fulfillments.find(tenant_query(tenant_id, {"request_id": request_id}), {"_id": 0})
        .sort("fulfilled_at", 1)
        .to_list(200)
    )
    # Stock vigente (no el del momento de solicitar) para que almacén decida hoy.
    current_stock = await snapshot_quantity(tenant_id, req["part_number"], req["location_id"])
    return {
        **decorate_request(req, cfg),
        "fulfillments": fulfillments,
        "current_available_stock": current_stock,
    }


@router.get("/wms/requests/{request_id}/audit")
async def request_audit_trail(request_id: str, user: dict = Depends(require_wms)):
    """Bitácora inmutable de la solicitud: quién, cuándo y qué cambió."""
    tenant_id = get_tenant_id(user)
    req = await _get_request(tenant_id, request_id)
    await _assert_can_act(user, req)
    return (
        await db.wms_audit_log.find(tenant_query(tenant_id, {"request_id": request_id}), {"_id": 0})
        .sort("created_at", 1)
        .to_list(500)
    )


@router.put("/wms/requests/{request_id}")
async def update_material_request(
    request_id: str, payload: MaterialRequestUpdate, user: dict = Depends(require_production)
):
    """Corrección del solicitante mientras nadie la haya tomado todavía."""
    tenant_id = get_tenant_id(user)
    req = await _get_request(tenant_id, request_id)
    await _assert_can_act(user, req)

    if req["status"] != WMS_PENDING:
        raise HTTPException(
            status_code=409,
            detail="Solo se puede editar una solicitud que sigue pendiente.",
        )
    if req["requested_by_user_id"] != user["id"] and user["role"] != ROLE_OWNER:
        raise HTTPException(status_code=403, detail="Solo quien la creó puede editarla")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        cfg = await get_wms_config(tenant_id)
        return decorate_request(req, cfg)

    await db.wms_requests.update_one(tenant_query(tenant_id, {"id": request_id}), {"$set": updates})
    fresh = await _get_request(tenant_id, request_id)
    await log_audit(
        tenant_id, fresh, "updated", user,
        from_status=req["status"], to_status=fresh["status"], payload=updates,
    )
    cfg = await get_wms_config(tenant_id)
    return decorate_request(fresh, cfg)


# ---------------------------------------------------------------------------
# Almacén: tomar, liberar y surtir
# ---------------------------------------------------------------------------
@router.post("/wms/requests/{request_id}/claim")
async def claim_material_request(request_id: str, user: dict = Depends(require_warehouse)):
    """Un surtidor toma la solicitud. Queda registrado quién y cuándo.

    El update es condicional al estado pendiente, así dos surtidores que
    piquen el mismo botón a la vez no se pisan: el segundo recibe 409.
    """
    tenant_id = get_tenant_id(user)
    req = await _get_request(tenant_id, request_id)
    await _assert_can_act(user, req)

    result = await db.wms_requests.update_one(
        tenant_query(tenant_id, {"id": request_id, "status": WMS_PENDING}),
        {
            "$set": {
                "status": WMS_IN_PROGRESS,
                "claimed_by_user_id": user["id"],
                "claimed_by_name": user.get("name") or user.get("username", ""),
                "claimed_at": now_iso(),
            }
        },
    )
    if result.modified_count == 0:
        fresh = await _get_request(tenant_id, request_id)
        if fresh["status"] == WMS_IN_PROGRESS:
            raise HTTPException(
                status_code=409,
                detail=f"{fresh.get('claimed_by_name') or 'Otro surtidor'} ya tomó esta solicitud.",
            )
        raise HTTPException(status_code=409, detail="La solicitud ya no está pendiente")

    fresh = await _get_request(tenant_id, request_id)
    await log_audit(
        tenant_id, fresh, WMS_ACTION_CLAIMED, user,
        from_status=WMS_PENDING, to_status=WMS_IN_PROGRESS,
        payload={"waited_minutes": round(minutes_between(fresh["requested_at"], fresh["claimed_at"]), 1)},
    )
    cfg = await get_wms_config(tenant_id)
    return decorate_request(fresh, cfg)


@router.post("/wms/requests/{request_id}/release")
async def release_material_request(
    request_id: str, payload: RequestRelease, user: dict = Depends(require_warehouse)
):
    """Devuelve a la cola una solicitud tomada que no se pudo completar.

    El historial no se pierde: quién la tomó primero queda en la bitácora, y
    los surtidos parciales ya registrados se conservan.
    """
    tenant_id = get_tenant_id(user)
    req = await _get_request(tenant_id, request_id)
    await _assert_can_act(user, req)

    if req["status"] != WMS_IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Solo se puede liberar una solicitud en proceso")

    previous_claimer = req.get("claimed_by_name")
    await db.wms_requests.update_one(
        tenant_query(tenant_id, {"id": request_id}),
        {
            "$set": {
                "status": WMS_PENDING,
                "claimed_by_user_id": None,
                "claimed_by_name": None,
                "claimed_at": None,
            }
        },
    )
    fresh = await _get_request(tenant_id, request_id)
    await log_audit(
        tenant_id, fresh, WMS_ACTION_RELEASED, user,
        from_status=WMS_IN_PROGRESS, to_status=WMS_PENDING,
        payload={"reason": (payload.reason or "").strip(), "released_from": previous_claimer},
    )
    cfg = await get_wms_config(tenant_id)
    return decorate_request(fresh, cfg)


@router.post("/wms/requests/{request_id}/fulfill")
async def fulfill_material_request(
    request_id: str, payload: MaterialFulfillmentCreate, user: dict = Depends(require_warehouse)
):
    """Registra una entrega (total o parcial) y, si se pide, cierra la solicitud.

    Guarda el snapshot del inventario SAP del momento para auditoría, y los
    minutos transcurridos tanto desde que se solicitó (experiencia de
    producción) como desde que se tomó (desempeño del surtidor).
    """
    tenant_id = get_tenant_id(user)
    req = await _get_request(tenant_id, request_id)
    await _assert_can_act(user, req)

    if req["status"] not in WMS_OPEN_STATUSES:
        raise HTTPException(status_code=409, detail="La solicitud ya está cerrada")

    # Surtir sin haber tomado la solicitud la toma implícitamente, para no
    # obligar a dos toques en el piso.
    claimed_at = req.get("claimed_at")
    if req["status"] == WMS_PENDING:
        claimed_at = now_iso()
        await db.wms_requests.update_one(
            tenant_query(tenant_id, {"id": request_id}),
            {
                "$set": {
                    "claimed_by_user_id": user["id"],
                    "claimed_by_name": user.get("name") or user.get("username", ""),
                    "claimed_at": claimed_at,
                }
            },
        )
        req = await _get_request(tenant_id, request_id)

    fulfilled_at = now_iso()
    available = await snapshot_quantity(tenant_id, req["part_number"], req["location_id"])

    fulfillment = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "request_id": request_id,
        "folio": req["folio"],
        "part_number": req["part_number"],
        "location_id": req["location_id"],
        "fulfilled_by_user_id": user["id"],
        "fulfilled_by_name": user.get("name") or user.get("username", ""),
        "quantity_fulfilled": float(payload.quantity_fulfilled),
        "fulfilled_at": fulfilled_at,
        "time_to_fulfill_minutes": round(minutes_between(req["requested_at"], fulfilled_at), 1),
        "time_since_claim_minutes": round(minutes_between(claimed_at, fulfilled_at), 1),
        "available_stock_at_moment": available,
        "notes": (payload.notes or "").strip(),
        "created_at": fulfilled_at,
    }
    await db.wms_fulfillments.insert_one(dict(fulfillment))

    # El acumulado se incrementa con $inc, no leyendo-sumando-guardando: si dos
    # surtidores registran una entrega a la vez, ninguna se pierde. El total que
    # devuelve el update es el que decide si la solicitud ya quedó cubierta.
    updated = await db.wms_requests.find_one_and_update(
        tenant_query(tenant_id, {"id": request_id}),
        {"$inc": {"quantity_fulfilled_total": fulfillment["quantity_fulfilled"]}},
        projection={"_id": 0},
        return_document=True,
    )
    total_fulfilled = round(float(updated.get("quantity_fulfilled_total", 0) or 0), 3)

    # Cubrir lo pedido cierra la solicitud aunque no se haya marcado cerrar.
    should_close = payload.close_request or total_fulfilled >= float(req["quantity_requested"])
    updates = {"quantity_fulfilled_total": total_fulfilled}  # normaliza el redondeo
    if should_close:
        updates["status"] = resolve_close_status(float(req["quantity_requested"]), total_fulfilled)
        updates["closed_at"] = fulfilled_at
    else:
        updates["status"] = WMS_IN_PROGRESS

    await db.wms_requests.update_one(tenant_query(tenant_id, {"id": request_id}), {"$set": updates})
    fresh = await _get_request(tenant_id, request_id)

    await log_audit(
        tenant_id, fresh, WMS_ACTION_FULFILLED, user,
        from_status=req["status"], to_status=fresh["status"],
        payload={
            "quantity_fulfilled": fulfillment["quantity_fulfilled"],
            "quantity_fulfilled_total": total_fulfilled,
            "time_to_fulfill_minutes": fulfillment["time_to_fulfill_minutes"],
            "available_stock_at_moment": available,
        },
    )
    if should_close:
        await log_audit(
            tenant_id, fresh, WMS_ACTION_CLOSED, user,
            from_status=req["status"], to_status=fresh["status"],
            payload={
                "quantity_requested": float(fresh["quantity_requested"]),
                "quantity_fulfilled_total": total_fulfilled,
            },
        )

    cfg = await get_wms_config(tenant_id)
    return {**decorate_request(fresh, cfg), "fulfillment": fulfillment}


@router.post("/wms/requests/{request_id}/cancel")
async def cancel_material_request(
    request_id: str, payload: RequestCancel, user: dict = Depends(require_wms)
):
    """Cancela una solicitud abierta. La cancela quien la creó, o el supervisor."""
    tenant_id = get_tenant_id(user)
    req = await _get_request(tenant_id, request_id)
    await _assert_can_act(user, req)

    if req["status"] not in WMS_OPEN_STATUSES:
        raise HTTPException(status_code=409, detail="La solicitud ya está cerrada")
    if req["requested_by_user_id"] != user["id"] and user["role"] != ROLE_OWNER:
        raise HTTPException(
            status_code=403, detail="Solo quien la creó (o el supervisor) puede cancelarla"
        )

    await db.wms_requests.update_one(
        tenant_query(tenant_id, {"id": request_id}),
        {"$set": {"status": WMS_CANCELLED, "closed_at": now_iso()}},
    )
    fresh = await _get_request(tenant_id, request_id)
    await log_audit(
        tenant_id, fresh, WMS_ACTION_CANCELLED, user,
        from_status=req["status"], to_status=WMS_CANCELLED,
        payload={"reason": (payload.reason or "").strip()},
    )
    cfg = await get_wms_config(tenant_id)
    return decorate_request(fresh, cfg)
