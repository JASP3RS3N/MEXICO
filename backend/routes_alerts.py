"""Alerts (bajo stock) + bank-terminal payment webhook."""
import os

from fastapi import APIRouter, Depends, HTTPException

from config import ORDER_CANCELLED, db, now_iso, tenant_query
from models import TerminalPayment
from security import get_tenant_id, require_owner
from orders_service import settle_order

router = APIRouter()

PAYMENTS_WEBHOOK_SECRET = os.environ.get("PAYMENTS_WEBHOOK_SECRET", "cambia-este-secreto")


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
@router.get("/alerts")
async def list_alerts(include_resolved: bool = False, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    extra = {} if include_resolved else {"resolved": False}
    return await db.alerts.find(tenant_query(tenant_id, extra), {"_id": 0}).sort("created_at", -1).to_list(500)


@router.get("/alerts/count")
async def alerts_count(user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    return {"unresolved": await db.alerts.count_documents(tenant_query(tenant_id, {"resolved": False}))}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    await db.alerts.update_one(
        tenant_query(tenant_id, {"id": alert_id}), {"$set": {"resolved": True, "resolved_at": now_iso()}}
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Bank terminal webhook — detects card charges and settles the order.
# Public endpoint protected by a shared secret; point Clip / Mercado Pago /
# n8n at it. Cash is confirmed by the cashier in the POS (no webhook needed).
# No auth → tenant is derived from the matched order document.
# ---------------------------------------------------------------------------
@router.post("/payments/terminal")
async def terminal_payment(payload: TerminalPayment):
    if payload.secret != PAYMENTS_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Secreto inválido")

    order = None
    if payload.order_number is not None:
        order = await db.orders.find_one({"order_number": int(payload.order_number), "paid": False})
    if not order:
        # Fall back to the newest unpaid, non-cancelled order matching the amount.
        candidates = await db.orders.find(
            {"paid": False, "status": {"$ne": ORDER_CANCELLED}}, {"_id": 0}
        ).sort("created_at", -1).to_list(200)
        for o in candidates:
            if abs(float(o["total"]) - float(payload.amount)) < 0.5:
                order = o
                break

    if not order:
        raise HTTPException(status_code=404, detail="No se encontró una orden pendiente que coincida con el cobro")

    # Public webhook has no user; derive tenant scope from the order itself.
    tenant_id = order["tenant_id"]
    actor = {"id": "terminal", "name": f"Terminal {payload.reference or ''}".strip()}
    fresh, change = await settle_order(order, payload.method or "tarjeta", float(payload.amount), actor)
    await db.orders.update_one(
        tenant_query(tenant_id, {"id": order["id"]}),
        {"$set": {"terminal_reference": payload.reference or "", "terminal_external_id": payload.external_id or ""}},
    )
    return {"ok": True, "order_number": fresh["order_number"], "total": fresh["total"], "change": change}
