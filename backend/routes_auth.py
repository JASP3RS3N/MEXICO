"""Authentication and user management routes."""
import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from config import (
    PIN_LOCKOUT_MINUTES,
    PIN_MAX_ATTEMPTS,
    ROLE_CASHIER,
    ROLE_LABELS,
    ROLE_OWNER,
    ROLE_PREP,
    ROLE_SUPERADMIN,
    ROLES,
    clean,
    db,
    gen_id,
    generate_unique_pin,
    now,
    now_iso,
    send_pin_email,
    tenant_query,
)
from models import LoginRequest, PinLoginRequest, UserCreate, UserUpdate
from security import (
    create_pin_session_token,
    create_token,
    get_current_user,
    get_tenant_id,
    hash_password,
    public_user,
    require_owner,
    verify_password,
)

# Roles an owner is allowed to assign (never superadmin).
ASSIGNABLE_ROLES = [r for r in ROLES if r != ROLE_SUPERADMIN]

router = APIRouter()


async def _with_tenant_slug(user_public: dict) -> dict:
    """Attach the tenant's slug to a public user dict (null for superadmin)."""
    tenant_id = user_public.get("tenant_id")
    slug = None
    if tenant_id:
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "slug": 1})
        if tenant:
            slug = tenant.get("slug")
    return {**user_public, "tenant_slug": slug}


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
        "user": await _with_tenant_slug(public_user(clean(user))),
        "role_label": ROLE_LABELS.get(user["role"], user["role"]),
    }


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "user": await _with_tenant_slug(public_user(user)),
        "role_label": ROLE_LABELS.get(user["role"], user["role"]),
    }


# In-memory brute-force guard for the direct PIN endpoint:
# (tenant_id, ip) -> {"count": int, "locked_until": datetime | None}.
# Intentionally not persisted — it's a short-lived, best-effort throttle.
_pin_login_attempts: dict = {}


def _pin_locked_in_future(locked_until) -> bool:
    """True if a stored pin_locked_until timestamp is still in the future."""
    if not locked_until:
        return False
    lu = locked_until
    if isinstance(lu, str):
        try:
            lu = datetime.fromisoformat(lu)
        except ValueError:
            return False
    if lu.tzinfo is None:
        lu = lu.replace(tzinfo=timezone.utc)
    return lu > now()


@router.post("/auth/login-pin")
async def login_pin(payload: PinLoginRequest, request: Request, user: dict = Depends(get_current_user)):
    """Device identity swap: a device already logged in normally activates a
    cashier/prep session by PIN, scoped to that device's tenant — no URL needed."""
    tenant_id = get_tenant_id(user)
    ip = request.client.host if request.client else "unknown"
    key = (tenant_id, ip)

    # IP + tenant brute-force lock (a wrong PIN identifies no user, so we throttle here).
    state = _pin_login_attempts.get(key)
    if state and state.get("locked_until") and state["locked_until"] > now():
        raise HTTPException(status_code=423, detail="Demasiados intentos, intenta más tarde")

    target = await db.users.find_one(
        tenant_query(tenant_id, {"pin": payload.pin, "active": True, "role": {"$in": [ROLE_CASHIER, ROLE_PREP]}})
    )
    if not target:
        st = _pin_login_attempts.setdefault(key, {"count": 0, "locked_until": None})
        st["count"] += 1
        if st["count"] >= PIN_MAX_ATTEMPTS:
            st["locked_until"] = now() + timedelta(minutes=PIN_LOCKOUT_MINUTES)
            st["count"] = 0
        # Do not reveal whether the PIN exists in another tenant.
        raise HTTPException(status_code=401, detail="PIN incorrecto")

    if _pin_locked_in_future(target.get("pin_locked_until")):
        raise HTTPException(status_code=423, detail="PIN bloqueado temporalmente, intenta más tarde")

    # Correct PIN: clear the per-user counters and this IP's failed streak.
    await db.users.update_one(
        tenant_query(tenant_id, {"id": target["id"]}),
        {"$set": {"pin_failed_attempts": 0, "pin_locked_until": None}},
    )
    _pin_login_attempts.pop(key, None)

    token = create_pin_session_token(target)
    return {
        "token": token,
        "user": public_user(clean(target)),
        "role_label": ROLE_LABELS.get(target["role"], target["role"]),
    }


# ---------------------------------------------------------------------------
# User management (owner only)
# ---------------------------------------------------------------------------
@router.get("/users")
async def list_users(user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    # Never expose the PIN in the listing; owners fetch it on demand per user.
    users = await db.users.find(tenant_query(tenant_id), {"_id": 0, "pin": 0}).to_list(500)
    return [public_user(u) for u in users]


def _send_pin_email_async(email: str, name: str, pin: str, role: str) -> None:
    """Fire-and-forget PIN email so an SMTP hiccup never blocks the request."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, send_pin_email, email, name, pin, ROLE_LABELS.get(role, role))


@router.post("/users")
async def create_user(payload: UserCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    if payload.role == ROLE_SUPERADMIN:
        raise HTTPException(status_code=403, detail="No puedes crear usuarios superadmin")
    if payload.role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Usa: {ASSIGNABLE_ROLES}")
    username = payload.username.lower().strip()
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=409, detail="El usuario ya existe")

    # PIN is generated server-side for cashier/prep; owners never use a PIN.
    pin = None
    if payload.role in (ROLE_CASHIER, ROLE_PREP):
        pin = await generate_unique_pin(tenant_id)

    doc = {
        "id": gen_id(),
        "username": username,
        "name": payload.name.strip(),
        "role": payload.role,
        "tenant_id": tenant_id,  # inherits the owner's tenant
        "email": payload.email,
        "pin": pin,
        "password_hash": hash_password(payload.password),
        "active": True,
        "created_at": now_iso(),
    }
    if pin is not None:
        doc["pin_failed_attempts"] = 0
        doc["pin_locked_until"] = None
    await db.users.insert_one(doc)

    # Best-effort email; the PIN is always returned below as the fallback.
    if payload.email and pin is not None:
        _send_pin_email_async(payload.email, doc["name"], pin, payload.role)

    # public_user strips the PIN, but the create response returns it once as the fallback copy.
    return {**public_user(clean(doc)), "pin": pin}


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    target = await db.users.find_one(tenant_query(tenant_id, {"id": user_id}))
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Note: tenant_id is never part of `updates`, so it can't be changed here.
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.role is not None:
        if payload.role == ROLE_SUPERADMIN:
            raise HTTPException(status_code=403, detail="No puedes asignar el rol superadmin")
        if payload.role not in ASSIGNABLE_ROLES:
            raise HTTPException(status_code=400, detail=f"Rol inválido. Usa: {ASSIGNABLE_ROLES}")
        updates["role"] = payload.role
    if payload.active is not None:
        updates["active"] = payload.active
    if payload.email is not None:
        updates["email"] = payload.email
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)

    # Guardrail: never lock out the last active owner of this tenant.
    if (updates.get("role") and updates["role"] != "owner") or updates.get("active") is False:
        if target["role"] == "owner":
            active_owners = await db.users.count_documents(
                tenant_query(tenant_id, {"role": "owner", "active": True})
            )
            if active_owners <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="No puedes desactivar o cambiar el rol del último dueño activo",
                )

    if updates:
        await db.users.update_one(tenant_query(tenant_id, {"id": user_id}), {"$set": updates})
    fresh = await db.users.find_one(tenant_query(tenant_id, {"id": user_id}), {"_id": 0, "pin": 0})
    return public_user(fresh)


@router.get("/users/{user_id}/pin")
async def get_user_pin(user_id: str, user: dict = Depends(require_owner)):
    """Owner-only: reveal an employee's current PIN on demand."""
    tenant_id = get_tenant_id(user)
    target = await db.users.find_one(tenant_query(tenant_id, {"id": user_id}), {"_id": 0, "pin": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"pin": target.get("pin")}


@router.post("/users/{user_id}/regenerate-pin")
async def regenerate_user_pin(user_id: str, user: dict = Depends(require_owner)):
    """Owner-only: issue a new PIN for a cashier/prep user (and email it if possible)."""
    tenant_id = get_tenant_id(user)
    target = await db.users.find_one(tenant_query(tenant_id, {"id": user_id}))
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target["role"] == ROLE_OWNER:
        raise HTTPException(status_code=400, detail="Los dueños no usan PIN")

    pin = await generate_unique_pin(tenant_id)
    await db.users.update_one(
        tenant_query(tenant_id, {"id": user_id}),
        {"$set": {"pin": pin, "pin_failed_attempts": 0, "pin_locked_until": None}},
    )

    # Best-effort email; the PIN is always returned below as the fallback.
    if target.get("email"):
        _send_pin_email_async(target["email"], target.get("name", ""), pin, target["role"])

    return {"pin": pin}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    target = await db.users.find_one(tenant_query(tenant_id, {"id": user_id}))
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    if target["role"] == "owner":
        active_owners = await db.users.count_documents(
            tenant_query(tenant_id, {"role": "owner", "active": True})
        )
        if active_owners <= 1:
            raise HTTPException(status_code=400, detail="No puedes eliminar al último dueño")
    await db.users.delete_one(tenant_query(tenant_id, {"id": user_id}))
    return {"ok": True}
