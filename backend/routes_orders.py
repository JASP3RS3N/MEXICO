"""Orders (comandas / tickets): POS creation, kitchen flow, client display, payment."""
from fastapi import APIRouter, Depends, HTTPException, Query

from config import (
    ORDER_CANCELLED,
    ORDER_DELIVERED,
    ORDER_PAID,
    ORDER_PENDING,
    ORDER_PREPARING,
    ORDER_READY,
    ROLE_LABELS,
    clean,
    db,
    gen_id,
    next_sequence,
    now_iso,
    tenant_query,
)
from models import OrderCreate, PaymentRequest, PinTagRequest
from security import get_current_user, get_tenant_id, require_pin_session, require_roles
from orders_service import settle_order

router = APIRouter()

ACTIVE_STATUSES = [ORDER_PENDING, ORDER_PREPARING, ORDER_READY, ORDER_DELIVERED]
KITCHEN_STATUSES = [ORDER_PENDING, ORDER_PREPARING, ORDER_READY]


async def _get_settings(tenant_id: str) -> dict:
    s = await db.settings.find_one(tenant_query(tenant_id, {"id": "settings"}), {"_id": 0})
    return s or {"tax_rate": 0.0, "tax_included": True, "currency": "MXN"}


def _compute_totals(gross: float, settings: dict) -> dict:
    rate = float(settings.get("tax_rate", 0) or 0)
    included = settings.get("tax_included", True)
    if rate <= 0:
        return {"subtotal": round(gross, 2), "tax": 0.0, "total": round(gross, 2)}
    if included:
        tax = gross - gross / (1 + rate)
        return {"subtotal": round(gross - tax, 2), "tax": round(tax, 2), "total": round(gross, 2)}
    tax = gross * rate
    return {"subtotal": round(gross, 2), "tax": round(tax, 2), "total": round(gross + tax, 2)}


def _public_order(order: dict) -> dict:
    """Client-facing view: no money, only what's needed for the status board."""
    return {
        "order_number": order["order_number"],
        "customer_name": order.get("customer_name", ""),
        "status": order["status"],
        "order_type": order.get("order_type", ""),
        "items_count": sum(i["qty"] for i in order.get("items", [])),
        "created_at": order["created_at"],
        "ready_at": order.get("ready_at"),
    }


async def _resolve_tenant_by_slug(slug: str) -> str:
    """Resolve a tenant slug to its id for public (unauthenticated) endpoints."""
    tenant = await db.tenants.find_one({"slug": slug}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    return tenant["id"]


# ---------------------------------------------------------------------------
# Creation (cashier / owner)
# ---------------------------------------------------------------------------
@router.post("/orders")
async def create_order(payload: OrderCreate, user: dict = Depends(require_roles("cashier", "owner")), _pin_check: dict = Depends(require_pin_session)):
    tenant_id = get_tenant_id(user)
    if not payload.items:
        raise HTTPException(status_code=400, detail="La orden necesita al menos un producto")

    items = []
    gross = 0.0
    for it in payload.items:
        product = await db.products.find_one(tenant_query(tenant_id, {"id": it.product_id}), {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {it.product_id} no encontrado")
        if not product.get("active", True):
            raise HTTPException(status_code=400, detail=f"Producto {product['name']} inactivo")
        qty = max(1, int(it.qty))
        line_total = round(float(product["price"]) * qty, 2)
        gross += line_total
        items.append(
            {
                "product_id": product["id"],
                "name": product["name"],
                "qty": qty,
                "price": float(product["price"]),
                "line_total": line_total,
                "notes": it.notes or "",
                "diner_name": (it.diner_name or "").strip(),
                "station": product.get("station", "cocina"),
                # snapshot of unit ingredient cost for accurate COGS later
                "unit_cost": float(product.get("cost", 0) or 0),
                "recipe": product.get("recipe", []),
                "item_status": ORDER_PENDING,
            }
        )

    settings = await _get_settings(tenant_id)
    totals = _compute_totals(gross, settings)
    seq = await next_sequence("order", tenant_id)

    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "order_number": seq,
        "customer_name": (payload.customer_name or "").strip(),
        "table": (payload.table or "").strip(),
        "order_type": payload.order_type or "comer_aqui",
        "notes": payload.notes or "",
        "items": items,
        "subtotal": totals["subtotal"],
        "tax": totals["tax"],
        "total": totals["total"],
        "status": ORDER_PENDING,
        "paid": False,
        "payment_method": None,
        "created_by": user["id"],
        "created_by_name": user.get("name", ""),
        # Sale attribution is filled in at payment time (see settle_order).
        "sold_by_user_id": None,
        "sold_by_name": "",
        "created_at": now_iso(),
        "accepted_at": None,
        "ready_at": None,
        "delivered_at": None,
        "paid_at": None,
    }
    await db.orders.insert_one(doc)
    return clean(doc)


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------
@router.get("/orders")
async def list_orders(
    status: str = Query(None),
    active: bool = Query(False),
    paid: bool = Query(None),
    limit: int = Query(100),
    user: dict = Depends(get_current_user),
):
    tenant_id = get_tenant_id(user)
    query = tenant_query(tenant_id)
    if status:
        query["status"] = status
    elif active:
        query["status"] = {"$in": ACTIVE_STATUSES}
    if paid is not None:
        query["paid"] = paid
    # Cashiers only take orders and charge: they never see completed sales.
    if user["role"] == "cashier":
        query["paid"] = False
        query["status"] = {"$in": [ORDER_PENDING, ORDER_PREPARING, ORDER_READY, ORDER_DELIVERED]}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # Cashiers/prep don't need cost/recipe internals in the payload.
    if user["role"] != "owner":
        for o in orders:
            for i in o.get("items", []):
                i.pop("recipe", None)
                i.pop("unit_cost", None)
    return orders


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    tenant_id = get_tenant_id(user)
    order = await db.orders.find_one(tenant_query(tenant_id, {"id": order_id}), {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if user["role"] == "cashier" and order.get("paid"):
        raise HTTPException(status_code=403, detail="No disponible")
    return order


# ---------------------------------------------------------------------------
# Kitchen (preparación) queue + client display
# ---------------------------------------------------------------------------
@router.get("/kitchen")
async def kitchen_queue(user: dict = Depends(require_roles("prep", "owner", "cashier"))):
    tenant_id = get_tenant_id(user)
    orders = await db.orders.find(
        tenant_query(tenant_id, {"status": {"$in": KITCHEN_STATUSES}}), {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    for o in orders:
        for i in o.get("items", []):
            i.pop("recipe", None)
            i.pop("unit_cost", None)
            i.pop("price", None)
            i.pop("line_total", None)
    return orders


@router.get("/display/theme")
async def display_theme(tenant: str = Query(...)):
    """Public: colors + name for the client display screen (no auth, no prices)."""
    tenant_id = await _resolve_tenant_by_slug(tenant)
    s = await db.settings.find_one(tenant_query(tenant_id, {"id": "settings"}), {"_id": 0}) or {}
    return {
        "restaurant_name": s.get("restaurant_name", "Smokehouse"),
        "display_bg": s.get("display_bg", ""),
        "display_text": s.get("display_text", ""),
        "display_prep": s.get("display_prep", ""),
        "display_ready": s.get("display_ready", ""),
    }


@router.get("/display")
async def client_display(tenant: str = Query(...)):
    """Public status board for customers — no authentication, no prices."""
    tenant_id = await _resolve_tenant_by_slug(tenant)
    orders = await db.orders.find(
        tenant_query(tenant_id, {"status": {"$in": KITCHEN_STATUSES}}), {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return [_public_order(o) for o in orders]


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------
async def _set_status(order_id: str, new_status: str, tenant_id: str, timestamp_field: str = None, extra: dict = None):
    updates = {"status": new_status}
    if timestamp_field:
        updates[timestamp_field] = now_iso()
    if extra:
        updates.update(extra)
    res = await db.orders.update_one(tenant_query(tenant_id, {"id": order_id}), {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return await db.orders.find_one(tenant_query(tenant_id, {"id": order_id}), {"_id": 0})


@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, payload: PinTagRequest, user: dict = Depends(require_roles("prep", "owner"))):
    tenant_id = get_tenant_id(user)
    order = await db.orders.find_one(tenant_query(tenant_id, {"id": order_id}))
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["status"] != ORDER_PENDING:
        raise HTTPException(status_code=400, detail="La orden no está pendiente")

    # Tag who prepares this order. If a PIN is provided, look up that employee
    # (prep or owner) and attribute the order to them. Prep staff must supply a
    # valid PIN; only the owner may accept without one, using their session.
    if payload.pin:
        preparer = await db.users.find_one(
            tenant_query(tenant_id, {"pin": payload.pin, "active": True, "role": {"$in": ["prep", "owner"]}})
        )
        if not preparer:
            raise HTTPException(status_code=400, detail="PIN no reconocido")
        prepared_by_user_id = preparer["id"]
        prepared_by_name = preparer.get("name", "")
    elif user.get("role") == "owner":
        prepared_by_user_id = user["id"]
        prepared_by_name = user.get("name", "")
    else:
        raise HTTPException(status_code=400, detail="PIN requerido para aceptar la comanda")

    return await _set_status(
        order_id,
        ORDER_PREPARING,
        tenant_id,
        "accepted_at",
        extra={"prepared_by_user_id": prepared_by_user_id, "prepared_by_name": prepared_by_name},
    )


@router.post("/orders/{order_id}/ready")
async def ready_order(order_id: str, user: dict = Depends(require_roles("prep", "owner"))):
    tenant_id = get_tenant_id(user)
    order = await db.orders.find_one(tenant_query(tenant_id, {"id": order_id}))
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["status"] not in (ORDER_PREPARING, ORDER_PENDING):
        raise HTTPException(status_code=400, detail="La orden no está en preparación")
    return await _set_status(order_id, ORDER_READY, tenant_id, "ready_at")


@router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: str, user: dict = Depends(require_roles("prep", "cashier", "owner"))):
    tenant_id = get_tenant_id(user)
    return await _set_status(order_id, ORDER_DELIVERED, tenant_id, "delivered_at")


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user: dict = Depends(require_roles("cashier", "owner"))):
    tenant_id = get_tenant_id(user)
    order = await db.orders.find_one(tenant_query(tenant_id, {"id": order_id}))
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.get("paid"):
        raise HTTPException(status_code=400, detail="No puedes cancelar una orden ya cobrada")
    return await _set_status(order_id, ORDER_CANCELLED, tenant_id)


# ---------------------------------------------------------------------------
# Payment (cobro) — deducts inventory per recipe once paid
# ---------------------------------------------------------------------------
@router.post("/orders/{order_id}/pay")
async def pay_order(order_id: str, payload: PaymentRequest, user: dict = Depends(require_roles("cashier", "owner")), _pin_check: dict = Depends(require_pin_session)):
    tenant_id = get_tenant_id(user)
    order = await db.orders.find_one(tenant_query(tenant_id, {"id": order_id}))
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.get("paid"):
        raise HTTPException(status_code=400, detail="La orden ya fue cobrada")
    if order["status"] == ORDER_CANCELLED:
        raise HTTPException(status_code=400, detail="La orden está cancelada")

    fresh, change = await settle_order(order, payload.method, payload.amount_received, user)
    return {"order": fresh, "change": change}
