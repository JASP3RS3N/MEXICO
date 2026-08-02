"""Platform administration — tenant management. Superadmin only.

Mounted at /api/admin in server.py. Every endpoint here is restricted to the
platform superadmin and operates across tenants.
"""
from fastapi import APIRouter, Depends, HTTPException

from config import ROLE_OWNER, ROLE_SUPERADMIN, ROLES, clean, db, gen_id, now_iso
from models import TenantCreate, TenantUpdate, UserCreate
from security import hash_password, public_user, require_superadmin

router = APIRouter()


# ---------------------------------------------------------------------------
# Tenants
# ---------------------------------------------------------------------------
@router.post("/tenants")
async def create_tenant(payload: TenantCreate, admin: dict = Depends(require_superadmin)):
    slug = payload.slug.strip().lower()
    if not slug:
        raise HTTPException(status_code=400, detail="El slug es obligatorio")
    if await db.tenants.find_one({"slug": slug}):
        raise HTTPException(status_code=409, detail="El slug ya existe")

    username = payload.owner_username.strip().lower()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=409, detail="El usuario dueño ya existe")

    tenant = {
        "id": gen_id(),
        "name": payload.name.strip(),
        "slug": slug,
        "plan": payload.plan,
        "active": True,
        "created_at": now_iso(),
    }
    await db.tenants.insert_one(tenant)

    owner = {
        "id": gen_id(),
        "username": username,
        "name": payload.owner_name.strip(),
        "role": ROLE_OWNER,
        "tenant_id": tenant["id"],
        "pin": None,
        "password_hash": hash_password(payload.owner_password),
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(owner)

    settings = {
        "id": gen_id(),
        "tenant_id": tenant["id"],
        "restaurant_name": payload.name.strip(),
        "tax_rate": 0.16,
        "tax_included": True,
        "currency": "MXN",
    }
    await db.settings.insert_one(settings)

    return {"tenant": clean(tenant), "owner": public_user(clean(owner))}


@router.get("/tenants")
async def list_tenants(admin: dict = Depends(require_superadmin)):
    return await db.tenants.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, admin: dict = Depends(require_superadmin)):
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    counts = {
        "users": await db.users.count_documents({"tenant_id": tenant_id}),
        "products": await db.products.count_documents({"tenant_id": tenant_id}),
        "orders": await db.orders.count_documents({"tenant_id": tenant_id}),
    }
    return {**tenant, "counts": counts}


@router.patch("/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, payload: TenantUpdate, admin: dict = Depends(require_superadmin)):
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    data = payload.model_dump(exclude_unset=True)
    updates = {}
    if data.get("name") is not None:
        updates["name"] = data["name"].strip()
    if data.get("slug") is not None:
        slug = data["slug"].strip().lower()
        if not slug:
            raise HTTPException(status_code=400, detail="El slug es obligatorio")
        if await db.tenants.find_one({"slug": slug, "id": {"$ne": tenant_id}}):
            raise HTTPException(status_code=409, detail="El slug ya existe")
        updates["slug"] = slug
    if data.get("plan") is not None:
        updates["plan"] = data["plan"]
    if data.get("active") is not None:
        updates["active"] = data["active"]

    if updates:
        await db.tenants.update_one({"id": tenant_id}, {"$set": updates})
    return await db.tenants.find_one({"id": tenant_id}, {"_id": 0})


# ---------------------------------------------------------------------------
# Tenant users
# ---------------------------------------------------------------------------
@router.post("/tenants/{tenant_id}/users")
async def create_tenant_user(tenant_id: str, payload: UserCreate, admin: dict = Depends(require_superadmin)):
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    if payload.role == ROLE_SUPERADMIN:
        raise HTTPException(status_code=400, detail="No se pueden crear usuarios superadmin desde aquí")
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Usa: {[r for r in ROLES if r != ROLE_SUPERADMIN]}")

    username = payload.username.strip().lower()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=409, detail="El usuario ya existe")

    doc = {
        "id": gen_id(),
        "username": username,
        "name": payload.name.strip(),
        "role": payload.role,
        "tenant_id": tenant_id,
        "pin": payload.pin,
        "password_hash": hash_password(payload.password),
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return public_user(clean(doc))
