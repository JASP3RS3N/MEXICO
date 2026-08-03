"""Pydantic request/response models for the Smokehouse API."""
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Auth & users
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    name: str
    password: str
    role: str  # owner | cashier | prep
    pin: Optional[str] = None  # optional quick-access PIN


class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    pin: Optional[str] = None


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
    supplier: Optional[str] = ""
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
    supplier: Optional[str] = None
    active: Optional[bool] = None


class StockAdjust(BaseModel):
    qty: float  # positive to add, negative to remove
    reason: Optional[str] = "Ajuste manual"


# ---------------------------------------------------------------------------
# Orders (comandas / tickets)
# ---------------------------------------------------------------------------
class OrderItemInput(BaseModel):
    product_id: str
    qty: int = 1
    notes: Optional[str] = ""


class OrderCreate(BaseModel):
    items: List[OrderItemInput]
    customer_name: Optional[str] = ""
    table: Optional[str] = ""
    order_type: str = "comer_aqui"  # comer_aqui | para_llevar
    notes: Optional[str] = ""


class OrderStatusUpdate(BaseModel):
    status: str


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


class POStatusUpdate(BaseModel):
    status: str  # ordered | received | cancelled


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
class EmployeeCreate(BaseModel):
    name: str
    position: Optional[str] = ""  # puesto: cajera, cocina, mesero…
    phone: Optional[str] = ""
    email: Optional[str] = ""
    hire_date: Optional[str] = None  # ISO date; defaults to today
    wage: Optional[float] = 0.0
    notes: Optional[str] = ""


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    wage: Optional[float] = None
    notes: Optional[str] = None


class EmployeeTerminate(BaseModel):
    termination_date: Optional[str] = None  # defaults to today
    reason: Optional[str] = ""


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
