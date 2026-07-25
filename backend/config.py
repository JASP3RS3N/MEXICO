"""Configuration, database connection and shared helpers.

Central place for the Mongo client, environment settings and small utility
helpers used across the API modules. Kept intentionally dependency-light so it
can be imported from every router without circular imports.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "smokehouse")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------------------------------------------------------------------
# Security / auth settings
# ---------------------------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-prod-smokehouse-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "12"))

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

# ---------------------------------------------------------------------------
# Domain constants
# ---------------------------------------------------------------------------
ROLE_OWNER = "owner"       # Dueño: acceso total, único que ve finanzas
ROLE_CASHIER = "cashier"   # Cajera: levanta órdenes y cobra
ROLE_PREP = "prep"         # Preparación: acepta y avanza comandas
ROLES = [ROLE_OWNER, ROLE_CASHIER, ROLE_PREP]

ROLE_LABELS = {
    ROLE_OWNER: "Dueño",
    ROLE_CASHIER: "Cajera",
    ROLE_PREP: "Preparación",
}

# Order lifecycle (comanda)
ORDER_PENDING = "pending"       # creada por caja, esperando cocina
ORDER_PREPARING = "preparing"   # aceptada por preparación
ORDER_READY = "ready"           # lista para entregar
ORDER_DELIVERED = "delivered"   # entregada al cliente
ORDER_PAID = "paid"             # cobrada
ORDER_CANCELLED = "cancelled"
ORDER_STATUSES = [
    ORDER_PENDING,
    ORDER_PREPARING,
    ORDER_READY,
    ORDER_DELIVERED,
    ORDER_PAID,
    ORDER_CANCELLED,
]

# Purchase order lifecycle (orden de compra)
PO_DRAFT = "draft"
PO_ORDERED = "ordered"
PO_RECEIVED = "received"
PO_CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def gen_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


async def next_sequence(name: str) -> int:
    """Atomically increment and return a named counter (used for order/PO numbers)."""
    doc = await db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return int(doc["seq"])


def clean(doc: dict) -> dict:
    """Strip Mongo's internal _id so documents can be returned directly as JSON."""
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc
