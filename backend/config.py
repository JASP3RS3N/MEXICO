"""Configuration, database connection and shared helpers.

Central place for the Mongo client, environment settings and small utility
helpers used across the API modules. Kept intentionally dependency-light so it
can be imported from every router without circular imports.
"""
import os
import secrets
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.text import MIMEText
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
# Email (SMTP) — optional, used to send access PINs to employees
# ---------------------------------------------------------------------------
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "Smokehouse OS")

# ---------------------------------------------------------------------------
# Domain constants
# ---------------------------------------------------------------------------
ROLE_OWNER = "owner"       # Dueño: acceso total, único que ve finanzas
ROLE_CASHIER = "cashier"   # Cajera: levanta órdenes y cobra
ROLE_PREP = "prep"         # Preparación: acepta y avanza comandas
ROLE_SUPERADMIN = "superadmin"  # Plataforma: administra todos los tenants
ROLES = [ROLE_OWNER, ROLE_CASHIER, ROLE_PREP, ROLE_SUPERADMIN]

ROLE_LABELS = {
    ROLE_OWNER: "Dueño",
    ROLE_CASHIER: "Cajera",
    ROLE_PREP: "Preparación",
    ROLE_SUPERADMIN: "Super Admin",
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


async def next_sequence(name: str, tenant_id: str) -> int:
    """Atomically increment and return a named counter, scoped per tenant.

    Each tenant keeps its own independent sequence via a ``{tenant_id}:{name}`` key.
    """
    doc = await db.counters.find_one_and_update(
        {"_id": f"{tenant_id}:{name}"},
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


def tenant_query(tenant_id: str, extra: dict = None) -> dict:
    """Build a Mongo query always scoped to a tenant."""
    q = {"tenant_id": tenant_id}
    if extra:
        q.update(extra)
    return q


async def generate_unique_pin(tenant_id: str) -> str:
    """Genera un PIN de 6 dígitos único dentro del tenant."""
    for _ in range(20):
        candidate = f"{secrets.randbelow(1000000):06d}"
        exists = await db.users.find_one(tenant_query(tenant_id, {"pin": candidate}))
        if not exists:
            return candidate
    raise RuntimeError("No se pudo generar un PIN único tras 20 intentos")


def send_pin_email(to_email: str, employee_name: str, pin: str, role_label: str) -> bool:
    """Envía el PIN por correo. Regresa True si se mandó, False si falló (nunca lanza excepción)."""
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        return False
    try:
        body = (
            f"Hola {employee_name},\n\n"
            f"Tu PIN de acceso ({role_label}) es: {pin}\n\n"
            f"Úsalo para iniciar sesión en el punto de venta o en cocina.\n"
            f"No compartas este PIN con nadie.\n\n"
            f"— {SMTP_FROM_NAME}"
        )
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = "Tu PIN de acceso"
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to_email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:
        return False
