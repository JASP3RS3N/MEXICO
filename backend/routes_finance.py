"""Finance: P&L, daily sales dashboard, expenses and settings. Owner only."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from config import ORDER_PAID, clean, db, gen_id, now, now_iso
from models import ExpenseCreate, SettingsUpdate
from security import get_current_user, require_owner

router = APIRouter()


def _month_start_iso() -> str:
    n = now()
    return datetime(n.year, n.month, 1, tzinfo=timezone.utc).isoformat()


async def _paid_orders(start: str, end: str):
    # Paid is independent from fulfillment status; filter on the paid flag + paid_at.
    query = {"paid": True, "paid_at": {"$gte": start, "$lte": end}}
    return await db.orders.find(query, {"_id": 0}).to_list(20000)


async def _category_map():
    cats = {c["id"]: c["name"] for c in await db.categories.find({}, {"_id": 0}).to_list(500)}
    prods = await db.products.find({}, {"_id": 0}).to_list(2000)
    return {p["id"]: cats.get(p.get("category_id"), "Sin categoría") for p in prods}


def _aggregate(orders: list):
    net = sum(float(o.get("subtotal", 0)) for o in orders)
    tax = sum(float(o.get("tax", 0)) for o in orders)
    gross = sum(float(o.get("total", 0)) for o in orders)
    cogs = sum(float(o.get("cogs", 0)) for o in orders)
    count = len(orders)
    return {
        "net_sales": round(net, 2),
        "tax": round(tax, 2),
        "gross_sales": round(gross, 2),
        "cogs": round(cogs, 2),
        "orders": count,
        "avg_ticket": round(gross / count, 2) if count else 0.0,
    }


# ---------------------------------------------------------------------------
# P&L
# ---------------------------------------------------------------------------
@router.get("/finance/pnl")
async def profit_and_loss(
    start: str = Query(None),
    end: str = Query(None),
    user: dict = Depends(require_owner),
):
    start = start or _month_start_iso()
    end = end or now_iso()

    orders = await _paid_orders(start, end)
    agg = _aggregate(orders)

    expenses = await db.expenses.find(
        {"date": {"$gte": start[:10], "$lte": end[:10]}}, {"_id": 0}
    ).to_list(5000)
    opex = round(sum(float(e["amount"]) for e in expenses), 2)
    expenses_by_cat = defaultdict(float)
    for e in expenses:
        expenses_by_cat[e.get("category", "General")] += float(e["amount"])

    gross_profit = round(agg["net_sales"] - agg["cogs"], 2)
    net_profit = round(gross_profit - opex, 2)

    # daily revenue series
    by_day = defaultdict(lambda: {"net": 0.0, "cogs": 0.0, "orders": 0})
    for o in orders:
        day = (o.get("paid_at") or o["created_at"])[:10]
        by_day[day]["net"] += float(o.get("subtotal", 0))
        by_day[day]["cogs"] += float(o.get("cogs", 0))
        by_day[day]["orders"] += 1
    series = [
        {"date": d, "net_sales": round(v["net"], 2), "cogs": round(v["cogs"], 2), "orders": v["orders"]}
        for d, v in sorted(by_day.items())
    ]

    # category & product breakdown
    cat_map = await _category_map()
    by_cat = defaultdict(float)
    by_product = defaultdict(lambda: {"qty": 0, "revenue": 0.0})
    for o in orders:
        for it in o.get("items", []):
            by_cat[cat_map.get(it["product_id"], "Sin categoría")] += float(it.get("line_total", 0))
            by_product[it["name"]]["qty"] += int(it["qty"])
            by_product[it["name"]]["revenue"] += float(it.get("line_total", 0))
    sales_by_category = [
        {"category": k, "revenue": round(v, 2)} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])
    ]
    top_products = sorted(
        [{"name": k, "qty": v["qty"], "revenue": round(v["revenue"], 2)} for k, v in by_product.items()],
        key=lambda x: -x["revenue"],
    )[:10]

    return {
        "period": {"start": start, "end": end},
        "revenue": agg["net_sales"],
        "gross_sales": agg["gross_sales"],
        "tax_collected": agg["tax"],
        "cogs": agg["cogs"],
        "gross_profit": gross_profit,
        "gross_margin": round(gross_profit / agg["net_sales"] * 100, 1) if agg["net_sales"] else 0.0,
        "operating_expenses": opex,
        "expenses_by_category": [{"category": k, "amount": round(v, 2)} for k, v in expenses_by_cat.items()],
        "net_profit": net_profit,
        "net_margin": round(net_profit / agg["net_sales"] * 100, 1) if agg["net_sales"] else 0.0,
        "orders": agg["orders"],
        "avg_ticket": agg["avg_ticket"],
        "series": series,
        "sales_by_category": sales_by_category,
        "top_products": top_products,
    }


# ---------------------------------------------------------------------------
# Daily sales (venta del día)
# ---------------------------------------------------------------------------
@router.get("/finance/daily")
async def daily_sales(
    start: str = Query(None),
    end: str = Query(None),
    user: dict = Depends(require_owner),
):
    if not start or not end:
        n = now()
        day_start = datetime(n.year, n.month, n.day, tzinfo=timezone.utc)
        start = day_start.isoformat()
        end = (day_start + timedelta(days=1) - timedelta(seconds=1)).isoformat()

    orders = await _paid_orders(start, end)
    agg = _aggregate(orders)

    by_method = defaultdict(lambda: {"count": 0, "total": 0.0})
    by_hour = defaultdict(float)
    by_product = defaultdict(lambda: {"qty": 0, "revenue": 0.0})
    for o in orders:
        m = o.get("payment_method", "efectivo") or "efectivo"
        by_method[m]["count"] += 1
        by_method[m]["total"] += float(o.get("total", 0))
        hour = (o.get("paid_at") or o["created_at"])[11:13]
        by_hour[hour] += float(o.get("total", 0))
        for it in o.get("items", []):
            by_product[it["name"]]["qty"] += int(it["qty"])
            by_product[it["name"]]["revenue"] += float(it.get("line_total", 0))

    return {
        "period": {"start": start, "end": end},
        **agg,
        "by_payment_method": [
            {"method": k, "count": v["count"], "total": round(v["total"], 2)} for k, v in by_method.items()
        ],
        "by_hour": [{"hour": f"{h}:00", "total": round(t, 2)} for h, t in sorted(by_hour.items())],
        "top_products": sorted(
            [{"name": k, "qty": v["qty"], "revenue": round(v["revenue"], 2)} for k, v in by_product.items()],
            key=lambda x: -x["qty"],
        )[:10],
    }


# ---------------------------------------------------------------------------
# Owner dashboard summary
# ---------------------------------------------------------------------------
@router.get("/finance/dashboard")
async def dashboard(user: dict = Depends(require_owner)):
    n = now()
    day_start = datetime(n.year, n.month, n.day, tzinfo=timezone.utc).isoformat()
    day_end = now_iso()
    month_start = _month_start_iso()

    today = _aggregate(await _paid_orders(day_start, day_end))
    month_orders = await _paid_orders(month_start, day_end)
    month = _aggregate(month_orders)

    month_expenses = await db.expenses.find(
        {"date": {"$gte": month_start[:10], "$lte": day_end[:10]}}, {"_id": 0}
    ).to_list(5000)
    opex = sum(float(e["amount"]) for e in month_expenses)
    month_gross_profit = month["net_sales"] - month["cogs"]
    month_net_profit = round(month_gross_profit - opex, 2)

    materials = await db.materials.find({"active": True}, {"_id": 0}).to_list(2000)
    low_stock = [m for m in materials if float(m.get("current_stock", 0)) <= float(m.get("min_stock", 0))]
    inventory_value = round(
        sum(float(m.get("current_stock", 0)) * float(m.get("cost_per_unit", 0)) for m in materials), 2
    )

    active_orders = await db.orders.count_documents(
        {"status": {"$in": ["pending", "preparing", "ready", "delivered"]}}
    )
    open_pos = await db.purchase_orders.count_documents({"status": {"$in": ["draft", "ordered"]}})

    return {
        "today": today,
        "month": {
            **month,
            "net_profit": month_net_profit,
            "net_margin": round(month_net_profit / month["net_sales"] * 100, 1) if month["net_sales"] else 0.0,
        },
        "low_stock_count": len(low_stock),
        "inventory_value": inventory_value,
        "active_orders": active_orders,
        "open_purchase_orders": open_pos,
    }


# ---------------------------------------------------------------------------
# Expenses (gastos)
# ---------------------------------------------------------------------------
@router.get("/expenses")
async def list_expenses(start: str = Query(None), end: str = Query(None), user: dict = Depends(require_owner)):
    query = {}
    if start and end:
        query = {"date": {"$gte": start[:10], "$lte": end[:10]}}
    docs = await db.expenses.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@router.post("/expenses")
async def create_expense(payload: ExpenseCreate, user: dict = Depends(require_owner)):
    doc = {
        "id": gen_id(),
        "category": payload.category or "General",
        "description": payload.description,
        "amount": round(float(payload.amount), 2),
        "date": payload.date or now_iso()[:10],
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.expenses.insert_one(doc)
    return clean(doc)


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(require_owner)):
    await db.expenses.delete_one({"id": expense_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    return s or {
        "id": "settings",
        "restaurant_name": "Smokehouse",
        "currency": "MXN",
        "tax_rate": 0.16,
        "tax_included": True,
    }


@router.put("/settings")
async def update_settings(payload: SettingsUpdate, user: dict = Depends(require_owner)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    await db.settings.update_one({"id": "settings"}, {"$set": updates}, upsert=True)
    return await db.settings.find_one({"id": "settings"}, {"_id": 0})
