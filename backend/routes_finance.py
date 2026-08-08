"""Finance: P&L, daily sales dashboard, expenses and settings. Owner only."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from config import ORDER_PAID, clean, db, gen_id, now, now_iso, tenant_query
from models import ExpenseCreate, SettingsUpdate
from security import get_current_user, get_tenant_id, require_owner

router = APIRouter()


def _month_start_iso() -> str:
    n = now()
    return datetime(n.year, n.month, 1, tzinfo=timezone.utc).isoformat()


def _period_days(start: str, end: str) -> int:
    try:
        d = (datetime.fromisoformat(end) - datetime.fromisoformat(start)).days + 1
        return max(1, d)
    except Exception:  # noqa: BLE001
        return 30


async def _active_payroll(tenant_id: str) -> float:
    """Monthly payroll = sum of active employees' wages."""
    emps = await db.employees.find(tenant_query(tenant_id, {"status": "active"}), {"_id": 0}).to_list(5000)
    return round(sum(float(e.get("wage", 0) or 0) for e in emps), 2)


async def _paid_orders(start: str, end: str, tenant_id: str):
    # Paid is independent from fulfillment status; filter on the paid flag + paid_at.
    query = tenant_query(tenant_id, {"paid": True, "paid_at": {"$gte": start, "$lte": end}})
    return await db.orders.find(query, {"_id": 0}).to_list(20000)


async def _prepared_orders(start: str, end: str, tenant_id: str):
    query = tenant_query(tenant_id, {"prepared_by_user_id": {"$ne": None}, "accepted_at": {"$gte": start, "$lte": end}})
    return await db.orders.find(query, {"_id": 0}).to_list(20000)


async def _category_map(tenant_id: str):
    cats = {c["id"]: c["name"] for c in await db.categories.find(tenant_query(tenant_id), {"_id": 0}).to_list(500)}
    prods = await db.products.find(tenant_query(tenant_id), {"_id": 0}).to_list(2000)
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
    tenant_id = get_tenant_id(user)
    start = start or _month_start_iso()
    end = end or now_iso()

    orders = await _paid_orders(start, end, tenant_id)
    agg = _aggregate(orders)

    expenses = await db.expenses.find(
        tenant_query(tenant_id, {"date": {"$gte": start[:10], "$lte": end[:10]}}), {"_id": 0}
    ).to_list(5000)
    manual_opex = round(sum(float(e["amount"]) for e in expenses), 2)
    expenses_by_cat = defaultdict(float)
    for e in expenses:
        expenses_by_cat[e.get("category", "General")] += float(e["amount"])

    # Payroll of active staff is auto-included (prorated by period length).
    payroll_monthly = await _active_payroll(tenant_id)
    payroll = round(payroll_monthly * _period_days(start, end) / 30, 2)
    if payroll:
        expenses_by_cat["Nómina"] += payroll
    opex = round(manual_opex + payroll, 2)

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
    cat_map = await _category_map(tenant_id)
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
        "manual_expenses": manual_opex,
        "payroll": payroll,
        "payroll_monthly": payroll_monthly,
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
# Top sellers (ranking de ventas por empleado atribuido vía PIN)
# ---------------------------------------------------------------------------
@router.get("/finance/top-sellers")
async def top_sellers(start: str = Query(None), end: str = Query(None), user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    start = start or _month_start_iso()
    end = end or now_iso()

    orders = await _paid_orders(start, end, tenant_id)
    by_seller = defaultdict(lambda: {"count": 0, "total": 0.0, "sold_by_name": ""})
    for o in orders:
        uid = o.get("sold_by_user_id")
        if not uid or uid == "terminal":
            continue  # unattributed sales, and terminal webhook charges, are excluded from the ranking
        by_seller[uid]["count"] += 1
        by_seller[uid]["total"] += float(o.get("total", 0))
        by_seller[uid]["sold_by_name"] = o.get("sold_by_name", "") or by_seller[uid]["sold_by_name"]

    ranking = sorted(
        [
            {
                "sold_by_user_id": uid,
                "sold_by_name": v["sold_by_name"],
                "count": v["count"],
                "total": round(v["total"], 2),
            }
            for uid, v in by_seller.items()
        ],
        key=lambda x: -x["total"],
    )
    return {"period": {"start": start, "end": end}, "ranking": ranking}


# ---------------------------------------------------------------------------
# Top preparers (ranking de comandas aceptadas por empleado en cocina)
# ---------------------------------------------------------------------------
@router.get("/finance/top-preparers")
async def top_preparers(start: str = Query(None), end: str = Query(None), user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    start = start or _month_start_iso()
    end = end or now_iso()
    orders = await _prepared_orders(start, end, tenant_id)
    by_prep = {}
    for o in orders:
        uid = o["prepared_by_user_id"]
        if uid == "terminal":
            continue  # terminal webhook charges were not prepared by any employee
        entry = by_prep.setdefault(uid, {"name": o.get("prepared_by_name", ""), "count": 0})
        entry["count"] += 1
    ranking = sorted(
        [{"user_id": k, **v} for k, v in by_prep.items()],
        key=lambda x: -x["count"],
    )
    return {"period": {"start": start, "end": end}, "ranking": ranking}


# ---------------------------------------------------------------------------
# Daily sales (venta del día)
# ---------------------------------------------------------------------------
@router.get("/finance/daily")
async def daily_sales(
    start: str = Query(None),
    end: str = Query(None),
    user: dict = Depends(require_owner),
):
    tenant_id = get_tenant_id(user)
    if not start or not end:
        n = now()
        day_start = datetime(n.year, n.month, n.day, tzinfo=timezone.utc)
        start = day_start.isoformat()
        end = (day_start + timedelta(days=1) - timedelta(seconds=1)).isoformat()

    orders = await _paid_orders(start, end, tenant_id)
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
    tenant_id = get_tenant_id(user)
    n = now()
    day_start = datetime(n.year, n.month, n.day, tzinfo=timezone.utc).isoformat()
    day_end = now_iso()
    month_start = _month_start_iso()

    today = _aggregate(await _paid_orders(day_start, day_end, tenant_id))
    month_orders = await _paid_orders(month_start, day_end, tenant_id)
    month = _aggregate(month_orders)

    month_expenses = await db.expenses.find(
        tenant_query(tenant_id, {"date": {"$gte": month_start[:10], "$lte": day_end[:10]}}), {"_id": 0}
    ).to_list(5000)
    payroll_monthly = await _active_payroll(tenant_id)
    # Month view carries the full monthly payroll of active staff.
    opex = sum(float(e["amount"]) for e in month_expenses) + payroll_monthly
    month_gross_profit = month["net_sales"] - month["cogs"]
    month_net_profit = round(month_gross_profit - opex, 2)

    materials = await db.materials.find(tenant_query(tenant_id, {"active": True}), {"_id": 0}).to_list(2000)
    low_stock = [m for m in materials if float(m.get("current_stock", 0)) <= float(m.get("min_stock", 0))]
    inventory_value = round(
        sum(float(m.get("current_stock", 0)) * float(m.get("cost_per_unit", 0)) for m in materials), 2
    )

    active_orders = await db.orders.count_documents(
        tenant_query(tenant_id, {"status": {"$in": ["pending", "preparing", "ready", "delivered"]}})
    )
    open_pos = await db.purchase_orders.count_documents(
        tenant_query(tenant_id, {"status": {"$in": ["draft", "ordered"]}})
    )

    return {
        "today": today,
        "month": {
            **month,
            "operating_expenses": round(opex, 2),
            "payroll": payroll_monthly,
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
    tenant_id = get_tenant_id(user)
    extra = {}
    if start and end:
        extra = {"date": {"$gte": start[:10], "$lte": end[:10]}}
    docs = await db.expenses.find(tenant_query(tenant_id, extra), {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@router.post("/expenses")
async def create_expense(payload: ExpenseCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
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
    tenant_id = get_tenant_id(user)
    await db.expenses.delete_one(tenant_query(tenant_id, {"id": expense_id}))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    tenant_id = get_tenant_id(user)
    s = await db.settings.find_one(tenant_query(tenant_id, {"id": "settings"}), {"_id": 0})
    return s or {
        "id": "settings",
        "tenant_id": tenant_id,
        "restaurant_name": "Smokehouse",
        "currency": "MXN",
        "tax_rate": 0.16,
        "tax_included": True,
    }


@router.put("/settings")
async def update_settings(payload: SettingsUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    await db.settings.update_one(
        tenant_query(tenant_id, {"id": "settings"}),
        {"$set": updates, "$setOnInsert": {"tenant_id": tenant_id, "id": "settings"}},
        upsert=True,
    )
    return await db.settings.find_one(tenant_query(tenant_id, {"id": "settings"}), {"_id": 0})
