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

# PIN login throttling (per IP + tenant for the direct PIN endpoint).
PIN_MAX_ATTEMPTS = 5
PIN_LOCKOUT_MINUTES = 15

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
# Ingesta de inventario SAP (SOLO LECTURA, unidireccional vía archivo plano)
# ---------------------------------------------------------------------------
# Un script externo (SAP GUI Scripting / RFC, corrido por el Task Scheduler de
# Windows) deja el export de MB52 en esta carpeta. La app SOLO lee ese archivo:
# no existe ninguna ruta de escritura hacia SAP en todo el proyecto.
SAP_INVENTORY_ENABLED = os.environ.get("SAP_INVENTORY_ENABLED", "true").lower() == "true"
SAP_INVENTORY_EXPORT_PATH = os.environ.get("SAP_INVENTORY_EXPORT_PATH", "/data/sap_export")
SAP_INVENTORY_FILE_GLOB = os.environ.get("SAP_INVENTORY_FILE_GLOB", "*.*")
SAP_INVENTORY_SYNC_MINUTES = int(os.environ.get("SAP_INVENTORY_SYNC_MINUTES", "60"))
# Tenant al que pertenece el export. Vacío = el único tenant existente (o el
# primero creado), que es el caso normal de una instalación en planta.
SAP_INVENTORY_TENANT_SLUG = os.environ.get("SAP_INVENTORY_TENANT_SLUG", "").strip()
# Cómo se arma la locación a partir del export: "plant" (solo centro/WERKS) o
# "plant_sloc" (centro + almacén/LGORT, p. ej. "1000/0001").
SAP_LOCATION_MODE = os.environ.get("SAP_LOCATION_MODE", "plant_sloc").strip().lower()
# Mapeo de columnas del export. Vacío = autodetección por alias (ver
# sap_inventory_ingest.COLUMN_ALIASES), que ya cubre MB52 en inglés y español.
SAP_COL_PART_NUMBER = os.environ.get("SAP_COL_PART_NUMBER", "").strip()
SAP_COL_DESCRIPTION = os.environ.get("SAP_COL_DESCRIPTION", "").strip()
SAP_COL_PLANT = os.environ.get("SAP_COL_PLANT", "").strip()
SAP_COL_STORAGE_LOCATION = os.environ.get("SAP_COL_STORAGE_LOCATION", "").strip()
SAP_COL_QTY = os.environ.get("SAP_COL_QTY", "").strip()
SAP_COL_UOM = os.environ.get("SAP_COL_UOM", "").strip()
# Separador decimal del export: "auto" lo deduce de la columna de cantidad del
# propio archivo; "." o "," lo fijan cuando el export es ambiguo.
SAP_DECIMAL_SEPARATOR = os.environ.get("SAP_DECIMAL_SEPARATOR", "auto").strip()

# ---------------------------------------------------------------------------
# Domain constants
# ---------------------------------------------------------------------------
ROLE_OWNER = "owner"       # Dueño / Supervisor: acceso total, único que ve finanzas
ROLE_CASHIER = "cashier"   # Cajera: levanta órdenes y cobra
ROLE_PREP = "prep"         # Preparación: acepta y avanza comandas
ROLE_PRODUCTION = "production"  # WMS: producción, solicita material al almacén
ROLE_WAREHOUSE = "warehouse"    # WMS: almacén, toma y surte las solicitudes
ROLE_SUPERADMIN = "superadmin"  # Plataforma: administra todos los tenants
ROLES = [
    ROLE_OWNER,
    ROLE_CASHIER,
    ROLE_PREP,
    ROLE_PRODUCTION,
    ROLE_WAREHOUSE,
    ROLE_SUPERADMIN,
]

ROLE_LABELS = {
    ROLE_OWNER: "Dueño",
    ROLE_CASHIER: "Cajera",
    ROLE_PREP: "Preparación",
    ROLE_PRODUCTION: "Producción",
    ROLE_WAREHOUSE: "Almacén",
    ROLE_SUPERADMIN: "Super Admin",
}

# Roles that authenticate with username + password. Cashier/prep are excluded on
# purpose: they swap in by PIN on a device the owner activated (see routes_auth).
# Production/warehouse DO use a password — each person opens the app in their own
# browser (or a Microsoft Teams tab), so there is no shared activated device.
PASSWORD_LOGIN_ROLES = [ROLE_OWNER, ROLE_PRODUCTION, ROLE_WAREHOUSE, ROLE_SUPERADMIN]

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
# WMS Producción ↔ Almacén
# ---------------------------------------------------------------------------
# Material request lifecycle (solicitud de material)
WMS_PENDING = "pendiente"                  # creada por producción, nadie la ha tomado
WMS_IN_PROGRESS = "en_proceso"             # un surtidor de almacén la tomó
WMS_PARTIAL = "surtido_parcial"            # se entregó menos de lo solicitado y se cerró
WMS_COMPLETE = "surtido_completo"          # se entregó todo lo solicitado
WMS_CANCELLED = "cancelado"
WMS_STATUSES = [WMS_PENDING, WMS_IN_PROGRESS, WMS_PARTIAL, WMS_COMPLETE, WMS_CANCELLED]
# Estados que siguen consumiendo tiempo en el tablero (los que se pintan con semáforo).
WMS_OPEN_STATUSES = [WMS_PENDING, WMS_IN_PROGRESS]

WMS_PRIORITY_NORMAL = "normal"
WMS_PRIORITY_URGENT = "urgente"
WMS_PRIORITIES = [WMS_PRIORITY_NORMAL, WMS_PRIORITY_URGENT]

# Acciones registradas en la bitácora inmutable (wms_audit_log).
WMS_ACTION_CREATED = "created"
WMS_ACTION_CLAIMED = "claimed"
WMS_ACTION_RELEASED = "released"
WMS_ACTION_FULFILLED = "fulfilled"
WMS_ACTION_CLOSED = "closed"
WMS_ACTION_CANCELLED = "cancelled"

# Umbrales por defecto del semáforo y del SLA. Configurables por tenant desde
# Ajustes (settings.wms_config); esto es solo el fallback cuando no se han tocado.
WMS_DEFAULT_CONFIG = {
    "green_max_minutes": 20,        # verde: 0–20 min
    "yellow_max_minutes": 60,       # amarillo: 20–60 min; rojo alto contraste: >60
    "sla_minutes": 30,              # meta de surtido para el % dentro de SLA
    "sound_alert_enabled": True,    # tono al haber solicitudes en rojo (toggle en la UI)
    "poll_seconds": 8,              # cada cuánto refresca el tablero de almacén
    "sap_sync_stale_minutes": 90,   # sin sync exitoso en este tiempo = ingesta caída
}


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
