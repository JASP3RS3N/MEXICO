"""Pydantic request/response models for the Smokehouse API."""
from typing import List, Optional

from pydantic import BaseModel, Field


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


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    station: Optional[str] = None
    active: Optional[bool] = None
    recipe: Optional[List[RecipeItem]] = None


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
