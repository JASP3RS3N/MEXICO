"""Authorized-device control (#10).

Per-tenant registry of the devices allowed to run the app. The plan includes a
fixed number of active devices per tenant (DEVICES_INCLUDED_PER_TENANT);
registering a new device beyond that limit is rejected with 403 until an
existing one is deactivated. Owner-only management: register, list and
deactivate. Deactivation is a soft flag (is_active=false) which frees the slot.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import db, now_iso, tenant_query
from security import get_tenant_id, require_owner

router = APIRouter()

# #10: active devices included in the plan per tenant.
DEVICES_INCLUDED_PER_TENANT = 2


class DeviceRegisterRequest(BaseModel):
    device_id: str
    label: str | None = None  # optional human-readable name (e.g. "Caja principal")


@router.post("/devices/register")
async def register_device(payload: DeviceRegisterRequest, user: dict = Depends(require_owner)):
    """Register a device for the tenant's owner.

    A brand-new device_id consumes one of the included slots; re-registering an
    already-known (deactivated) device re-activates it and also requires a free
    slot. Returns 403 when the active-device limit is reached. Re-registering a
    device that is already active is idempotent.
    """
    tenant_id = get_tenant_id(user)
    device_id = payload.device_id.strip()
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id es obligatorio")

    existing = await db.user_devices.find_one(tenant_query(tenant_id, {"device_id": device_id}))
    active_count = await db.user_devices.count_documents(
        tenant_query(tenant_id, {"is_active": True})
    )

    if not existing:
        if active_count >= DEVICES_INCLUDED_PER_TENANT:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de dispositivos incluidos alcanzado ({DEVICES_INCLUDED_PER_TENANT}). "
                       "Desactiva un dispositivo para registrar otro.",
            )
        await db.user_devices.insert_one({
            "tenant_id": tenant_id,
            "device_id": device_id,
            "user_id": user["id"],
            "label": (payload.label or "").strip() or None,
            "registered_at": now_iso(),
            "is_active": True,
        })
    elif not existing.get("is_active"):
        if active_count >= DEVICES_INCLUDED_PER_TENANT:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de dispositivos incluidos alcanzado ({DEVICES_INCLUDED_PER_TENANT}). "
                       "Desactiva un dispositivo para reactivar este.",
            )
        await db.user_devices.update_one(
            {"_id": existing["_id"]},
            {"$set": {"is_active": True, "user_id": user["id"], "registered_at": now_iso()}},
        )

    doc = await db.user_devices.find_one(tenant_query(tenant_id, {"device_id": device_id}), {"_id": 0})
    return {"device": doc}


@router.get("/devices")
async def list_devices(user: dict = Depends(require_owner)):
    """List the tenant's registered devices with active count and plan limit."""
    tenant_id = get_tenant_id(user)
    docs = (
        await db.user_devices.find(tenant_query(tenant_id), {"_id": 0})
        .sort("registered_at", -1)
        .to_list(500)
    )
    return {
        "devices": docs,
        "active_count": sum(1 for d in docs if d.get("is_active")),
        "limit": DEVICES_INCLUDED_PER_TENANT,
    }


@router.post("/devices/{device_id}/deactivate")
async def deactivate_device(device_id: str, user: dict = Depends(require_owner)):
    """Soft-deactivate a device (is_active=false), freeing its included slot."""
    tenant_id = get_tenant_id(user)
    res = await db.user_devices.update_one(
        tenant_query(tenant_id, {"device_id": device_id}),
        {"$set": {"is_active": False}},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    doc = await db.user_devices.find_one(tenant_query(tenant_id, {"device_id": device_id}), {"_id": 0})
    return {"device": doc}
