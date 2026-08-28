"""Authentication & authorization helpers (JWT + bcrypt + role guards)."""
from datetime import timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import (
    JWT_ALGORITHM,
    JWT_EXPIRE_HOURS,
    JWT_SECRET,
    ROLE_OWNER,
    ROLE_PRODUCTION,
    ROLE_SUPERADMIN,
    ROLE_WAREHOUSE,
    clean,
    db,
    now,
)

bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------
def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "tenant_id": user.get("tenant_id"),
        "exp": now() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_pin_session_token(user: dict) -> str:
    """Short-lived token for a PIN-initiated session (a device swapping identities)."""
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "tenant_id": user.get("tenant_id"),
        "pin_session": True,
        "exp": now() + timedelta(hours=2),  # a PIN session must not last all day
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = decode_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await db.users.find_one({"id": payload.get("sub")})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")

    # Multi-tenant guard: if the token is scoped to a tenant, the DB user must
    # belong to the same tenant. Superadmins may have tenant_id = None.
    token_tid = payload.get("tenant_id")
    if user.get("role") != ROLE_SUPERADMIN:
        if token_tid is None or user.get("tenant_id") != token_tid:
            raise HTTPException(status_code=401, detail="Tenant inválido")

    return clean(user)


def require_roles(*roles: str):
    """Dependency factory that ensures the current user has one of ``roles``."""

    async def guard(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción",
            )
        return user

    return guard


async def require_pin_session(
    user: dict = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """Ensure cashier/prep act through a PIN-initiated session, not user+password.

    The owner may always operate with their normal session; everyone else must
    present a token carrying the ``pin_session`` claim (issued by /auth/login-pin).
    """
    if user["role"] == ROLE_OWNER:
        return user  # el dueño siempre puede operar con su sesión normal
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")
    if not payload.get("pin_session"):
        raise HTTPException(
            status_code=403,
            detail="Los cajeros y preparadores deben iniciar sesión con su PIN, no con usuario y contraseña.",
        )
    return user


# Owner is the only role allowed to see finances / daily sales.
require_owner = require_roles(ROLE_OWNER)

# Superadmin manages the platform (all tenants).
require_superadmin = require_roles(ROLE_SUPERADMIN)

# ---------------------------------------------------------------------------
# WMS Producción ↔ Almacén
# ---------------------------------------------------------------------------
# Producción levanta solicitudes; almacén las surte; el dueño hace de
# supervisor y ve todo. El dueño se incluye en los tres guards a propósito:
# es el rol admin ya existente y debe poder operar y auditar el módulo.
require_production = require_roles(ROLE_PRODUCTION, ROLE_OWNER)
require_warehouse = require_roles(ROLE_WAREHOUSE, ROLE_OWNER)
require_wms = require_roles(ROLE_PRODUCTION, ROLE_WAREHOUSE, ROLE_OWNER)


def user_location_id(user: dict) -> Optional[str]:
    """Locación/planta a la que está ligado el usuario. None = sin restricción.

    Producción y almacén se limitan a su locación; el dueño (supervisor) no
    tiene locación asignada normalmente y ve todas las plantas.
    """
    return user.get("location_id") or None


def require_location(user: dict) -> str:
    """Igual que user_location_id pero exige que exista. Para acciones que
    obligatoriamente ocurren en una planta (crear una solicitud, por ejemplo)."""
    loc = user_location_id(user)
    if not loc:
        raise HTTPException(
            status_code=400,
            detail="Tu usuario no tiene una locación/planta asignada. Pídele al supervisor que te la asigne.",
        )
    return loc


def get_tenant_id(user: dict) -> str:
    """Extract tenant_id from authenticated user. Raises 400 if missing."""
    tid = user.get("tenant_id")
    if not tid:
        raise HTTPException(status_code=400, detail="Usuario sin tenant asignado")
    return tid


def public_user(user: dict) -> dict:
    """Return a user document without its password hash or PIN."""
    return {k: v for k, v in user.items() if k not in ("password_hash", "pin")}
