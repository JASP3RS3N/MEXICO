"""Shared order settlement: deduct BOM/inventory, compute COGS, mark paid.

Used by the cashier pay endpoint and the bank-terminal webhook so both paths
behave identically (inventory deduction, COGS, low-stock alerts).
"""
from config import db, gen_id, now_iso, tenant_query
from alerts import maybe_low_stock_alert, maybe_low_stock_alert_product


async def settle_order(order: dict, method: str, amount_received, actor: dict, tip_amount: float = 0.0):
    """Deduct materials per each item's recipe (BOM), record COGS, mark the order paid.

    Returns (updated_order, change). Assumes the order is unpaid and not cancelled.
    Tenant scope is derived from the order itself so both authenticated (pay) and
    unauthenticated (terminal webhook) callers stay isolated.
    """
    tenant_id = order["tenant_id"]
    cogs = 0.0
    for item in order.get("items", []):
        qty = int(item["qty"])
        for r in item.get("recipe", []):
            consumed = float(r.get("qty", 0)) * qty
            if not consumed:
                continue
            mat = await db.materials.find_one(tenant_query(tenant_id, {"id": r["material_id"]}))
            if not mat:
                continue
            new_stock = float(mat.get("current_stock", 0)) - consumed
            await db.materials.update_one(
                tenant_query(tenant_id, {"id": r["material_id"]}),
                {"$set": {"current_stock": new_stock, "updated_at": now_iso()}},
            )
            await db.inventory_movements.insert_one(
                {
                    "id": gen_id(),
                    "tenant_id": tenant_id,
                    "material_id": r["material_id"],
                    "type": "consumption",
                    "qty": -consumed,
                    "reference": f"Orden #{order['order_number']}",
                    "user_id": actor.get("id", "system"),
                    "created_at": now_iso(),
                }
            )
            await maybe_low_stock_alert(r["material_id"])
        cogs += float(item.get("unit_cost", 0) or 0) * qty

        # Finished-goods stock (products sold as-is with track_stock).
        prod = await db.products.find_one(tenant_query(tenant_id, {"id": item["product_id"]}))
        if prod and prod.get("track_stock"):
            await db.products.update_one(
                tenant_query(tenant_id, {"id": item["product_id"]}),
                {"$set": {"current_stock": float(prod.get("current_stock", 0)) - qty}},
            )
            await maybe_low_stock_alert_product(item["product_id"])

    # The tip (propina) is extra money on top of the order total, so it's added to
    # what's due before computing change.
    tip = max(0.0, float(tip_amount or 0))
    total_due = round(float(order["total"]) + tip, 2)
    amount = amount_received if amount_received is not None else total_due
    change = round(max(float(amount) - total_due, 0), 2)

    # NOTE: payment is independent from the kitchen/fulfillment status. We do NOT
    # move the order to a "paid" status, so a paid order keeps flowing through the
    # kitchen (pending → preparing → ready → delivered). Payment is the `paid` flag.
    updates = {
        "paid": True,
        "payment_method": method,
        "tip_amount": tip,
        "amount_received": float(amount),
        "change": change,
        "cogs": round(cogs, 2),
        "paid_at": now_iso(),
        "cashier_id": actor.get("id", "system"),
        "cashier_name": actor.get("name", ""),
        # Sale is attributed to whoever settles it, regardless of who created it.
        "sold_by_user_id": actor.get("id"),
        "sold_by_name": actor.get("name", ""),
    }
    if not order.get("delivered_at"):
        updates["delivered_at"] = now_iso()
    await db.orders.update_one(tenant_query(tenant_id, {"id": order["id"]}), {"$set": updates})
    fresh = await db.orders.find_one(tenant_query(tenant_id, {"id": order["id"]}), {"_id": 0})
    return fresh, change
