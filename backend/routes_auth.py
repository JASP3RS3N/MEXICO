"""Authentication and user management routes."""
from fastapi import APIRouter, Depends, HTTPException

from config import ROLE_LABELS, ROLES, clean, db, gen_id, now_iso
from models import LoginRequest, UserCreate, UserUpdate
from security import (
    create_token,
    get_current_user,
    hash_password,
    public_user,
    require_owner,
    verify_password,
)

router = APIRouter()


@router.post("/auth/login")
async def login(payload: LoginRequest):
    user = await db.users.find_one({"username": payload.username.lower().strip()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    token = create_token(user)
    return {
        "token": token,
        "user": public_user(clean(user)),
        "role_label": ROLE_LABELS.get(user["role"], user["role"]),
    }


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "user": public_user(user),
        "role_label": ROLE_LABELS.get(user["role"], user["role"]),
    }


# ---------------------------------------------------------------------------
# User management (owner only)
# ---------------------------------------------------------------------------
@router.get("/users")
async def list_users(user: dict = Depends(require_owner)):
    users = await db.users.find({}, {"_id": 0}).to_list(500)
    return [public_user(u) for u in users]


@router.post("/users")
async def create_user(payload: UserCreate, user: dict = Depends(require_owner)):
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Usa: {ROLES}")
    username = payload.username.lower().strip()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=409, detail="El usuario ya existe")

    doc = {
        "id": gen_id(),
        "username": username,
        "name": payload.name.strip(),
        "role": payload.role,
        "pin": payload.pin,
        "password_hash": hash_password(payload.password),
        "active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return public_user(clean(doc))


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, user: dict = Depends(require_owner)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.role is not None:
        if payload.role not in ROLES:
            raise HTTPException(status_code=400, detail=f"Rol inválido. Usa: {ROLES}")
        updates["role"] = payload.role
    if payload.active is not None:
        updates["active"] = payload.active
    if payload.pin is not None:
        updates["pin"] = payload.pin
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)

    # Guardrail: never lock out the last active owner.
    if (updates.get("role") and updates["role"] != "owner") or updates.get("active") is False:
        if target["role"] == "owner":
            active_owners = await db.users.count_documents({"role": "owner", "active": True})
            if active_owners <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="No puedes desactivar o cambiar el rol del último dueño activo",
                )

    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
    fresh = await db.users.find_one({"id": user_id}, {"_id": 0})
    return public_user(fresh)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_owner)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    if target["role"] == "owner":
        active_owners = await db.users.count_documents({"role": "owner", "active": True})
        if active_owners <= 1:
            raise HTTPException(status_code=400, detail="No puedes eliminar al último dueño")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}
