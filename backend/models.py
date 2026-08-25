"""Pydantic request/response models for the Smokehouse API."""
import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Auth & users
# ---------------------------------------------------------------------------
_PIN_RE = re.compile(r"[0-9]{4,6}")


def _normalize_pin(value: Optional[str]) -> Optional[str]:
    """Normalize an optional quick-access PIN. None/empty passes as None; else 4-6 digits."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if not _PIN_RE.fullmatch(value):
        raise ValueError("PIN debe ser numérico, de 4 a 6 dígitos")
    return value


class LoginRequest(BaseModel):
    username: str
    password: str


class PinLoginRequest(BaseModel):
    pin: str


class UserCreate(BaseModel):
    username: str
    name: str
    password: str
    role: str  # owner | cashier | prep
    email: Optional[EmailStr] = None  # PIN is always generated server-side


class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    email: Optional[EmailStr] = None


# ---------------------------------------------------------------------------
# Catalog: categories & products (menú)
# ---------------------------------------------------------------------------
class CategoryCreate(BaseModel):
    name: str
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class RecipeItem(BaseModel):
    material_id: str
    qty: float  # units of the raw material consumed per product sold


class ProductCreate(BaseModel):
    name: str
    category_id: Optional[str] = None
    price: float
    description: Optional[str] = ""
    station: str = "cocina"  # kitchen station where it is prepared
    active: bool = True
    recipe: List[RecipeItem] = Field(default_factory=list)
    # Optional finished-goods stock tracking (for items sold as-is).
    track_stock: bool = False
    current_stock: float = 0.0
    min_stock: float = 0.0
    # CFDI 4.0 (FiscalAPI): mapping to the fiscal catalog item + SAT codes, used
    # when an order containing this product is invoiced. Data model only for now.
    fiscal_item_id: Optional[str] = None
    sat_product_code: Optional[str] = None  # SAT c_ClaveProdServ
    sat_unit_code: Optional[str] = None  # SAT c_ClaveUnidad


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    station: Optional[str] = None
    active: Optional[bool] = None
    recipe: Optional[List[RecipeItem]] = None
    track_stock: Optional[bool] = None
    current_stock: Optional[float] = None
    min_stock: Optional[float] = None


class PriceUpdate(BaseModel):
    price: float


# ---------------------------------------------------------------------------
# Raw materials (materia prima) master data
# ---------------------------------------------------------------------------
class MaterialCreate(BaseModel):
    sku: Optional[str] = None
    name: str
    unit: str = "kg"  # kg, lt, pza, etc.
    category: Optional[str] = "General"
    cost_per_unit: float = 0.0
    current_stock: float = 0.0
    min_stock: float = 0.0
    par_stock: float = 0.0  # target stock level used for reorder suggestions
    min_order: float = 0.0  # minimum order quantity (MOQ) per purchase
    lead_time_days: int = 3  # days a new purchase order takes to arrive from this supplier
    last_price_update: Optional[str] = None  # ISO date of the last cost_per_unit change
    active: bool = True


class MaterialUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    cost_per_unit: Optional[float] = None
    current_stock: Optional[float] = None
    min_stock: Optional[float] = None
    par_stock: Optional[float] = None
    min_order: Optional[float] = None
    lead_time_days: Optional[int] = None
    last_price_update: Optional[str] = None  # ISO date; normally set automatically, not by the client
    active: Optional[bool] = None


class StockAdjust(BaseModel):
    qty: float  # positive to add, negative to remove
    reason: Optional[str] = "Ajuste manual"
    waste_reason_code: Optional[str] = None  # required when qty < 0 (merma); must match WASTE_REASONS


class WasteReason(BaseModel):
    id: str
    code: str
    label: str
    active: bool = True


# Catalog of standard waste/shrink reasons (código, etiqueta). Not tenant-scoped
# today — a fixed list shared by all tenants.
WASTE_REASONS = [
    {"code": "overproduction", "label": "Sobreproducción"},
    {"code": "spoilage", "label": "Descomposición / caducidad"},
    {"code": "kitchen_error", "label": "Error de cocina"},
    {"code": "customer_return", "label": "Devolución de cliente"},
    {"code": "dropped_damaged", "label": "Caída o daño físico"},
    {"code": "other", "label": "Otro"},
]


# ---------------------------------------------------------------------------
# Orders (comandas / tickets)
# ---------------------------------------------------------------------------
class SalesChannel(BaseModel):
    code: str
    label: str
    commission_rate: float


# Catalog of sales channels (código, etiqueta, tasa de comisión por defecto).
# Not tenant-scoped today — a fixed list shared by all tenants.
SALES_CHANNELS = [
    {"code": "counter", "label": "Mostrador", "commission_rate": 0.0},
    {"code": "phone", "label": "Teléfono", "commission_rate": 0.0},
    {"code": "uber_eats", "label": "Uber Eats", "commission_rate": 0.28},
    {"code": "rappi", "label": "Rappi", "commission_rate": 0.27},
    {"code": "didi_food", "label": "DiDi Food", "commission_rate": 0.25},
]


class OrderItemInput(BaseModel):
    product_id: str
    qty: int = 1
    notes: Optional[str] = ""
    diner_name: Optional[str] = ""  # nombre/número de la persona que pidió este platillo, opcional


class OrderCreate(BaseModel):
    items: List[OrderItemInput]
    customer_name: Optional[str] = ""
    table: Optional[str] = ""
    order_type: str = "comer_aqui"  # comer_aqui | para_llevar
    notes: Optional[str] = ""
    sales_channel_code: str = "counter"  # code from SALES_CHANNELS: counter, phone, uber_eats, rappi, didi_food
    # CFDI 4.0 (FiscalAPI): whether/how this order has been invoiced. Data model
    # only for now — not enforced or transitioned by any endpoint yet.
    invoice_status: str = "not_requested"  # not_requested | requested | stamped | cancelled | failed


class OrderStatusUpdate(BaseModel):
    status: str


class PinTagRequest(BaseModel):
    pin: Optional[str] = None  # employee PIN used to tag who accepts a kitchen order; if omitted, the session user is used


class PaymentRequest(BaseModel):
    method: str = "efectivo"  # efectivo | tarjeta | transferencia
    amount_received: Optional[float] = None


# ---------------------------------------------------------------------------
# Purchase orders (órdenes de compra)
# ---------------------------------------------------------------------------
class POItemInput(BaseModel):
    material_id: str
    qty: float
    unit_cost: Optional[float] = None  # defaults to material's cost if omitted


class PurchaseOrderCreate(BaseModel):
    supplier: Optional[str] = ""
    items: List[POItemInput]
    notes: Optional[str] = ""
    expected_date: Optional[str] = None


class POReceiveItem(BaseModel):
    material_id: str
    received_qty: float


class POStatusUpdate(BaseModel):
    status: str  # ordered | received | cancelled
    # Only used when status == "received": the actual quantity received per
    # item, which may differ from the quantity originally ordered.
    received_items: Optional[List[POReceiveItem]] = None


# ---------------------------------------------------------------------------
# Fiscal (facturación CFDI 4.0 vía FiscalAPI) — config only, defined here (ahead
# of SettingsUpdate/TenantUpdate below, both of which embed it).
# ---------------------------------------------------------------------------
class FiscalConfig(BaseModel):
    enabled: bool = False
    fiscalapi_api_key: Optional[str] = None
    fiscalapi_tenant_key: Optional[str] = None
    fiscalapi_environment: str = "test"  # test | production
    issuer_person_id: Optional[str] = None
    generic_recipient_id: Optional[str] = None
    expedition_zip_code: Optional[str] = None
    default_cfdi_use: str = "S01"  # SAT c_UsoCFDI
    tax_regime_code: Optional[str] = None  # SAT c_RegimenFiscal


# ---------------------------------------------------------------------------
# Expenses (gastos operativos) & settings
# ---------------------------------------------------------------------------
class ExpenseCreate(BaseModel):
    category: str = "General"
    description: str
    amount: float
    date: Optional[str] = None  # ISO date; defaults to today


class SettingsUpdate(BaseModel):
    restaurant_name: Optional[str] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None  # e.g. 0.16 for 16% IVA
    tax_included: Optional[bool] = None  # whether prices already include tax
    fiscal_config: Optional[FiscalConfig] = None
    # Theme colors (hex, e.g. "#080c14"); empty/None = default palette.
    theme_bg: Optional[str] = None
    theme_sidebar: Optional[str] = None
    theme_text: Optional[str] = None
    theme_money: Optional[str] = None  # color for monetary/cost figures
    # Client display (/pantalla) colors.
    display_bg: Optional[str] = None
    display_text: Optional[str] = None
    display_prep: Optional[str] = None   # "en preparación" accent
    display_ready: Optional[str] = None  # "listo" accent


# ---------------------------------------------------------------------------
# Suppliers (proveedores)
# ---------------------------------------------------------------------------
def _normalize_rfc(value: Optional[str]) -> Optional[str]:
    """Normalize/validate a Mexican RFC. Optional: None/empty passes as None."""
    if value is None:
        return value
    value = value.upper().strip()
    if not value:
        return None
    if not value.isalnum() or not 12 <= len(value) <= 13:
        raise ValueError("RFC inválido, debe tener 12 o 13 caracteres")
    return value


class SupplierCreate(BaseModel):
    name: str
    contact: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    notes: Optional[str] = ""
    rfc: Optional[str] = None
    razon_social: Optional[str] = None
    regimen_fiscal: Optional[str] = None
    codigo_postal_fiscal: Optional[str] = None
    active: bool = True

    @field_validator("rfc")
    @classmethod
    def _validate_rfc(cls, v):
        return _normalize_rfc(v)


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    rfc: Optional[str] = None
    razon_social: Optional[str] = None
    regimen_fiscal: Optional[str] = None
    codigo_postal_fiscal: Optional[str] = None
    active: Optional[bool] = None

    @field_validator("rfc")
    @classmethod
    def _validate_rfc(cls, v):
        return _normalize_rfc(v)


# ---------------------------------------------------------------------------
# Employees (control de empleados, altas/bajas con historial)
# ---------------------------------------------------------------------------
_INE_PHOTO_PREFIXES = ("data:image/jpeg", "data:image/png", "data:image/webp")
_MAX_INE_PHOTO_CHARS = int(3.5 * 1024 * 1024)  # ~3.5 MB base64 ≈ 2.5 MB real image


def _normalize_ine_photo(value: Optional[str]) -> Optional[str]:
    """Validate an optional INE photo: base64 data URI (JPEG/PNG/WEBP), size-capped."""
    if not value:
        return None
    if not value.startswith(_INE_PHOTO_PREFIXES):
        raise ValueError("Formato de imagen inválido, debe ser JPEG, PNG o WEBP")
    if len(value) > _MAX_INE_PHOTO_CHARS:
        raise ValueError("La imagen es demasiado grande, máximo 2.5MB")
    return value


class EmployeeCreate(BaseModel):
    name: str
    position: Optional[str] = ""  # puesto: cajera, cocina, mesero…
    phone: Optional[str] = ""
    email: Optional[str] = ""
    hire_date: Optional[str] = None  # ISO date; defaults to today
    wage: Optional[float] = 0.0
    notes: Optional[str] = ""
    ine_photo: Optional[str] = None  # base64 data URI (JPEG/PNG/WEBP)

    @field_validator("ine_photo")
    @classmethod
    def _validate_ine_photo(cls, v):
        return _normalize_ine_photo(v)


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    wage: Optional[float] = None
    notes: Optional[str] = None
    ine_photo: Optional[str] = None
    remove_ine_photo: Optional[bool] = False  # control flag: clear the stored photo

    @field_validator("ine_photo")
    @classmethod
    def _validate_ine_photo(cls, v):
        return _normalize_ine_photo(v)


class EmployeeTerminate(BaseModel):
    termination_date: Optional[str] = None  # defaults to today
    reason: Optional[str] = ""


# ---------------------------------------------------------------------------
# Fiscal (facturación CFDI 4.0 vía FiscalAPI), continuación — FiscalConfig
# itself lives earlier (before SettingsUpdate, which embeds it).
# ---------------------------------------------------------------------------
class Invoice(BaseModel):
    id: str
    tenant_id: str
    order_id: str
    fiscalapi_invoice_id: Optional[str] = None
    uuid: Optional[str] = None
    status: str  # stamped | cancelled | failed
    cancellation_reason_code: Optional[str] = None
    recipient_type: str  # generic | specific
    total: float
    created_at: datetime


# ---------------------------------------------------------------------------
# Tenants (multi-tenant)
# ---------------------------------------------------------------------------
class TenantCreate(BaseModel):
    name: str
    slug: str
    owner_name: str
    owner_username: str
    owner_password: str
    plan: str = "control"


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    plan: Optional[str] = None
    active: Optional[bool] = None
    fiscal_config: Optional[FiscalConfig] = None


# ---------------------------------------------------------------------------
# Bank terminal payment webhook
# ---------------------------------------------------------------------------
class TerminalPayment(BaseModel):
    secret: str
    amount: float
    order_number: Optional[int] = None  # match a specific order; else newest unpaid by amount
    reference: Optional[str] = ""       # provider transaction reference
    external_id: Optional[str] = ""
    method: Optional[str] = "tarjeta"
