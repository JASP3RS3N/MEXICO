"""Raw materials (materia prima) master data + purchase orders."""
import math
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from config import (
    PO_CANCELLED,
    PO_DRAFT,
    PO_ORDERED,
    PO_RECEIVED,
    RECEIVING_VARIANCE_TOLERANCE_PCT,
    clean,
    db,
    gen_id,
    next_sequence,
    now,
    now_iso,
    tenant_query,
)
from models import (
    WASTE_REASONS,
    MaterialCreate,
    MaterialUpdate,
    POStatusUpdate,
    PurchaseOrderCreate,
    StockAdjust,
    SupplierOfferingCreate,
    SupplierOfferingUpdate,
)
from security import get_current_user, get_tenant_id, require_owner, require_roles
from alerts import check_stale_supplier_prices, maybe_low_stock_alert, scan_all_low_stock

router = APIRouter()


async def _record_movement(
    material_id: str,
    mtype: str,
    qty: float,
    reference: str,
    user_id: str,
    tenant_id: str,
    waste_reason_code: str = None,
):
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "material_id": material_id,
        "type": mtype,  # purchase | consumption | adjustment
        "qty": qty,
        "reference": reference,
        "user_id": user_id,
        "created_at": now_iso(),
    }
    # Only recorded for waste/shrink adjustments — omitted entirely otherwise,
    # so movements from other callers (purchase receiving, initial stock) are
    # unchanged.
    if waste_reason_code:
        doc["waste_reason_code"] = waste_reason_code
    await db.inventory_movements.insert_one(doc)


# ---------------------------------------------------------------------------
# Materials master data
# ---------------------------------------------------------------------------
@router.get("/materials/waste-reasons")
async def waste_reasons(user: dict = Depends(require_roles("owner", "prep"))):
    """Catalog of standard waste/shrink reasons for stock adjustments."""
    return WASTE_REASONS


@router.get("/materials")
async def list_materials(user: dict = Depends(require_roles("owner", "prep"))):
    tenant_id = get_tenant_id(user)
    materials = await db.materials.find(tenant_query(tenant_id), {"_id": 0}).sort("name", 1).to_list(2000)
    return materials


@router.post("/materials")
async def create_material(payload: MaterialCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "sku": payload.sku or "",
        "name": payload.name.strip(),
        "unit": payload.unit,
        "category": payload.category or "General",
        "cost_per_unit": round(float(payload.cost_per_unit), 4),
        "current_stock": float(payload.current_stock),
        "min_stock": float(payload.min_stock),
        "par_stock": float(payload.par_stock),
        "min_order": float(payload.min_order),
        "lead_time_days": int(payload.lead_time_days),
        # A material's cost is set for the first time at creation, so it's
        # not "stale" yet — stamp today rather than leaving it null.
        "last_price_update": now_iso()[:10],
        "active": payload.active,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.materials.insert_one(doc)
    if doc["current_stock"]:
        await _record_movement(doc["id"], "adjustment", doc["current_stock"], "Inventario inicial", user["id"], tenant_id)
    return clean(doc)


@router.put("/materials/{material_id}")
async def update_material(material_id: str, payload: MaterialUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    material = await db.materials.find_one(tenant_query(tenant_id, {"id": material_id}))
    if not material:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}

    # Track when the price actually changes so stale-price alerts can trust it.
    price_changed = "cost_per_unit" in updates and round(float(updates["cost_per_unit"]), 4) != round(
        float(material.get("cost_per_unit", 0)), 4
    )
    if price_changed:
        updates["last_price_update"] = now_iso()[:10]

    if updates:
        updates["updated_at"] = now_iso()
        await db.materials.update_one(tenant_query(tenant_id, {"id": material_id}), {"$set": updates})

    if price_changed:
        # A price change is the natural moment to re-scan for stale supplier
        # prices tenant-wide — same reactive pattern as the low-stock alerts.
        await check_stale_supplier_prices(tenant_id)

    return await db.materials.find_one(tenant_query(tenant_id, {"id": material_id}), {"_id": 0})


@router.post("/materials/{material_id}/adjust")
async def adjust_stock(material_id: str, payload: StockAdjust, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    material = await db.materials.find_one(tenant_query(tenant_id, {"id": material_id}))
    if not material:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")

    # A negative adjustment here is shrink/waste (this endpoint always records
    # type "adjustment" — sale-driven consumption goes through a separate path
    # in orders_service.py). Require a valid reason code from the catalog.
    if float(payload.qty) < 0:
        valid_codes = {r["code"] for r in WASTE_REASONS}
        if not payload.waste_reason_code or payload.waste_reason_code not in valid_codes:
            raise HTTPException(status_code=400, detail="Selecciona una razón de merma válida para un ajuste negativo")

    new_stock = float(material.get("current_stock", 0)) + float(payload.qty)
    await db.materials.update_one(
        tenant_query(tenant_id, {"id": material_id}), {"$set": {"current_stock": new_stock, "updated_at": now_iso()}}
    )
    await _record_movement(
        material_id,
        "adjustment",
        float(payload.qty),
        payload.reason or "Ajuste",
        user["id"],
        tenant_id,
        waste_reason_code=payload.waste_reason_code,
    )
    # A manual adjustment (merma, corrección, recepción) can push stock at/below
    # minimum just like a sale — same reactive alert check either way.
    await maybe_low_stock_alert(material_id)
    return await db.materials.find_one(tenant_query(tenant_id, {"id": material_id}), {"_id": 0})


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    await db.materials.delete_one(tenant_query(tenant_id, {"id": material_id}))
    return {"ok": True}


@router.get("/materials/low-stock")
async def low_stock(user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    materials = await db.materials.find(tenant_query(tenant_id, {"active": True}), {"_id": 0}).to_list(2000)
    return [m for m in materials if float(m.get("current_stock", 0)) <= float(m.get("min_stock", 0))]


@router.post("/inventory/scan-low-stock")
async def scan_low_stock(user: dict = Depends(require_owner)):
    """On-demand bulk low-stock scan across every active material (same alert
    the reactive per-sale/per-adjustment check would create)."""
    tenant_id = get_tenant_id(user)
    new_alerts = await scan_all_low_stock(tenant_id)
    return {"new_alerts": new_alerts}


@router.get("/inventory/movements")
async def movements(material_id: str = None, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    extra = {"material_id": material_id} if material_id else {}
    docs = await db.inventory_movements.find(tenant_query(tenant_id, extra), {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


# ---------------------------------------------------------------------------
# Supplier offerings (proveedor × insumo): a material can be sourced from
# several suppliers, each with its own cost/MOQ/lead time. Replaces the role
# the old free-text Material.supplier field used to play — not wired into
# alerts.py/ai_tools.py/server.py/PurchaseOrders.js yet, that's a later step.
# ---------------------------------------------------------------------------
async def _offering_with_supplier_name(offering: dict, tenant_id: str) -> dict:
    """Denormalize the supplier's name onto an offering for display, same way
    PO items carry the material's name alongside its id."""
    supplier = await db.suppliers.find_one(tenant_query(tenant_id, {"id": offering["supplier_id"]}), {"_id": 0, "name": 1})
    return {**offering, "supplier_name": supplier["name"] if supplier else ""}


async def _get_active_offerings(material_id: str, tenant_id: str) -> list:
    """Active supplier offerings for a material, cheapest first. Internal
    helper shared by GET /materials/{id}/offerings and the reorder
    suggestions endpoint below — same query, same shape, no duplication."""
    offerings = await db.supplier_offerings.find(
        tenant_query(tenant_id, {"material_id": material_id, "active": True}), {"_id": 0}
    ).sort("cost_per_unit", 1).to_list(500)
    return [await _offering_with_supplier_name(o, tenant_id) for o in offerings]


# Business rule (owner-facing, not just a technical default) — change this
# threshold here if the tradeoff needs adjusting later: when suggesting a
# reorder, we default to the cheapest supplier offering, EXCEPT when another
# offering is at least this many days faster than the cheapest one. In that
# case we recommend the faster offering instead — an urgent reorder (the
# material is already at/below its minimum) shouldn't sit waiting several
# extra days just to save a few pesos.
REORDER_LEAD_TIME_PRIORITY_DAYS = 3


def _pick_best_offering(offerings: list):
    """Recommended supplier offering for a reorder suggestion, or None if the
    material has no active offerings registered yet. See
    REORDER_LEAD_TIME_PRIORITY_DAYS above for the cheapest-vs-fastest rule."""
    if not offerings:
        return None
    cheapest = min(offerings, key=lambda o: o["cost_per_unit"])
    fastest = min(offerings, key=lambda o: o["lead_time_days"])
    if cheapest["lead_time_days"] - fastest["lead_time_days"] >= REORDER_LEAD_TIME_PRIORITY_DAYS:
        return fastest
    return cheapest


@router.post("/supplier-offerings")
async def create_supplier_offering(payload: SupplierOfferingCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    supplier = await db.suppliers.find_one(tenant_query(tenant_id, {"id": payload.supplier_id}))
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    material = await db.materials.find_one(tenant_query(tenant_id, {"id": payload.material_id}))
    if not material:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")

    # One active offering per (supplier, material) pair — otherwise "the
    # cheapest offering for this material" would be ambiguous between two
    # rows from the same supplier.
    existing = await db.supplier_offerings.find_one(
        tenant_query(
            tenant_id,
            {"supplier_id": payload.supplier_id, "material_id": payload.material_id, "active": True},
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una oferta activa de este proveedor para este insumo")

    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "supplier_id": payload.supplier_id,
        "material_id": payload.material_id,
        "cost_per_unit": round(float(payload.cost_per_unit), 4),
        "min_order": float(payload.min_order),
        "lead_time_days": int(payload.lead_time_days),
        # Same pattern as Material.last_price_update: stamped at creation,
        # restamped only when cost_per_unit actually changes (see below).
        "last_price_update": now_iso()[:10],
        "active": payload.active,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.supplier_offerings.insert_one(doc)
    return clean(await _offering_with_supplier_name(doc, tenant_id))


@router.get("/supplier-offerings")
async def list_supplier_offerings(user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    offerings = await db.supplier_offerings.find(tenant_query(tenant_id), {"_id": 0}).sort("cost_per_unit", 1).to_list(5000)
    return [await _offering_with_supplier_name(o, tenant_id) for o in offerings]


@router.put("/supplier-offerings/{offering_id}")
async def update_supplier_offering(offering_id: str, payload: SupplierOfferingUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    offering = await db.supplier_offerings.find_one(tenant_query(tenant_id, {"id": offering_id}))
    if not offering:
        raise HTTPException(status_code=404, detail="Oferta de proveedor no encontrada")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}

    price_changed = "cost_per_unit" in updates and round(float(updates["cost_per_unit"]), 4) != round(
        float(offering.get("cost_per_unit", 0)), 4
    )
    if price_changed:
        updates["last_price_update"] = now_iso()[:10]

    if updates:
        updates["updated_at"] = now_iso()
        await db.supplier_offerings.update_one(tenant_query(tenant_id, {"id": offering_id}), {"$set": updates})

    fresh = await db.supplier_offerings.find_one(tenant_query(tenant_id, {"id": offering_id}), {"_id": 0})
    return await _offering_with_supplier_name(fresh, tenant_id)


@router.delete("/supplier-offerings/{offering_id}")
async def delete_supplier_offering(offering_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    await db.supplier_offerings.delete_one(tenant_query(tenant_id, {"id": offering_id}))
    return {"ok": True}


@router.get("/materials/{material_id}/offerings")
async def material_offerings(material_id: str, user: dict = Depends(require_owner)):
    """Active supplier offerings for a material, cheapest first — the data
    used to suggest which supplier to buy from when generating a purchase
    order (see po_suggestions below)."""
    tenant_id = get_tenant_id(user)
    material = await db.materials.find_one(tenant_query(tenant_id, {"id": material_id}))
    if not material:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")
    return await _get_active_offerings(material_id, tenant_id)


# ---------------------------------------------------------------------------
# Purchase orders (órdenes de compra)
# ---------------------------------------------------------------------------
@router.get("/purchase-orders")
async def list_pos(user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    pos = await db.purchase_orders.find(tenant_query(tenant_id), {"_id": 0}).sort("created_at", -1).to_list(500)
    return pos


@router.get("/purchase-orders/suggestions")
async def po_suggestions(user: dict = Depends(require_owner)):
    """Suggest reorder quantities for materials at/below their minimum stock,
    each with a recommended supplier offering (see _pick_best_offering) plus
    the full list of alternatives so the owner can pick a different one."""
    tenant_id = get_tenant_id(user)
    materials = await db.materials.find(tenant_query(tenant_id, {"active": True}), {"_id": 0}).to_list(2000)
    suggestions = []
    for m in materials:
        current = float(m.get("current_stock", 0))
        minimum = float(m.get("min_stock", 0))
        par = float(m.get("par_stock", 0)) or (minimum * 2)
        if current <= minimum:
            moq = float(m.get("min_order", 0))
            suggested = max(par - current, 0) or (par or minimum or 1)
            # Round up to the nearest multiple of the minimum order quantity.
            if moq > 0:
                suggested = math.ceil(suggested / moq) * moq

            # Recommend a supplier from this material's registered offerings
            # (see REORDER_LEAD_TIME_PRIORITY_DAYS for the cheapest-vs-fastest
            # rule) — never fails or skips the material when none exist yet,
            # just flags it so the owner knows to go configure one.
            offerings = await _get_active_offerings(m["id"], tenant_id)
            best_offering = _pick_best_offering(offerings)

            suggestions.append(
                {
                    "material_id": m["id"],
                    "name": m["name"],
                    "unit": m["unit"],
                    "current_stock": current,
                    "min_stock": minimum,
                    "min_order": moq,
                    "suggested_qty": round(suggested, 2),
                    "unit_cost": float(m.get("cost_per_unit", 0)),
                    "suggested_supplier": best_offering,
                    "no_offerings": best_offering is None,
                    "supplier_offerings": offerings,
                }
            )
    return suggestions


# ---------------------------------------------------------------------------
# Reorder forecast (consumption-based, complements the min/par suggestions above)
# ---------------------------------------------------------------------------
async def _avg_daily_consumption(material_id: str, tenant_id: str, paid_orders: list = None):
    """Average daily consumption of a material over the last 30 days of paid
    sales (or the real span of history available, if shorter), derived from
    each sold item's recipe/BOM. Returns None when the tenant has less than
    7 days of paid-order history — not enough data to trust an average.

    ``paid_orders`` lets a caller pre-fetch the 30-day window once and share
    it across materials instead of re-querying per material.
    """
    if paid_orders is None:
        window_start = (now() - timedelta(days=30)).isoformat()
        paid_orders = await db.orders.find(
            tenant_query(tenant_id, {"paid": True, "paid_at": {"$gte": window_start}}),
            {"_id": 0, "items": 1, "paid_at": 1},
        ).to_list(5000)

    if not paid_orders:
        return None

    # Tenant-wide sales history: distinct calendar days with at least one paid order.
    days_with_sales = {o["paid_at"][:10] for o in paid_orders if o.get("paid_at")}
    if len(days_with_sales) < 7:
        return None

    total_consumed = 0.0
    for o in paid_orders:
        for item in o.get("items", []):
            qty = int(item.get("qty", 0))
            for r in item.get("recipe", []):
                if r.get("material_id") == material_id:
                    total_consumed += float(r.get("qty", 0)) * qty

    span_days = min(len(days_with_sales), 30)
    return round(total_consumed / span_days, 4)


@router.get("/inventory/reorder-forecast")
async def reorder_forecast(user: dict = Depends(require_owner)):
    """Per-material reorder forecast: current stock, average daily consumption
    (last 30 days of paid sales), estimated days of coverage and stockout
    date, and whether a reorder is urgent given the supplier's lead time.
    Complements — does not replace — /purchase-orders/suggestions.
    """
    tenant_id = get_tenant_id(user)
    materials = await db.materials.find(tenant_query(tenant_id, {"active": True}), {"_id": 0}).to_list(2000)

    # Fetch the 30-day paid-orders window once and share it across materials.
    window_start = (now() - timedelta(days=30)).isoformat()
    paid_orders = await db.orders.find(
        tenant_query(tenant_id, {"paid": True, "paid_at": {"$gte": window_start}}),
        {"_id": 0, "items": 1, "paid_at": 1},
    ).to_list(5000)

    today = now().date()
    forecast = []
    for m in materials:
        avg_daily = await _avg_daily_consumption(m["id"], tenant_id, paid_orders=paid_orders)
        current = float(m.get("current_stock", 0))
        lead_time = int(m.get("lead_time_days", 3))

        # Null/zero average consumption means there's nothing solid to project
        # from — report no coverage estimate rather than inventing one (and
        # avoid a divide-by-zero on a genuinely unconsumed material).
        if avg_daily:
            days_of_coverage = round(current / avg_daily, 1)
            estimated_stockout_date = (today + timedelta(days=days_of_coverage)).isoformat()
            needs_reorder_soon = days_of_coverage <= lead_time
        else:
            days_of_coverage = None
            estimated_stockout_date = None
            needs_reorder_soon = False

        forecast.append(
            {
                "material_id": m["id"],
                "name": m["name"],
                "current_stock": current,
                "min_stock": float(m.get("min_stock", 0)),
                "par_stock": float(m.get("par_stock", 0)),
                "lead_time_days": lead_time,
                "consumo_diario_promedio": avg_daily,
                "days_of_coverage": days_of_coverage,
                "estimated_stockout_date": estimated_stockout_date,
                "needs_reorder_soon": needs_reorder_soon,
            }
        )
    return forecast


@router.post("/purchase-orders")
async def create_po(payload: PurchaseOrderCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    if not payload.items:
        raise HTTPException(status_code=400, detail="La orden de compra necesita al menos un artículo")

    items = []
    adjustments = []
    total = 0.0
    for it in payload.items:
        mat = await db.materials.find_one(tenant_query(tenant_id, {"id": it.material_id}), {"_id": 0})
        if not mat:
            raise HTTPException(status_code=404, detail=f"Materia prima {it.material_id} no encontrada")

        # Enforce the minimum order quantity: round up to its nearest multiple
        # instead of rejecting the order, and record what was bumped so the
        # owner can be told what changed and why.
        qty = float(it.qty)
        moq = float(mat.get("min_order", 0))
        if moq > 0 and qty % moq != 0:
            adjusted = math.ceil(qty / moq) * moq
            adjustments.append({"name": mat["name"], "original_qty": qty, "adjusted_qty": adjusted, "min_order": moq})
            qty = adjusted

        unit_cost = float(it.unit_cost if it.unit_cost is not None else mat.get("cost_per_unit", 0))
        subtotal = round(unit_cost * qty, 2)
        total += subtotal
        items.append(
            {
                "material_id": mat["id"],
                "name": mat["name"],
                "unit": mat["unit"],
                "qty": qty,
                "unit_cost": unit_cost,
                "subtotal": subtotal,
            }
        )

    seq = await next_sequence("purchase_order", tenant_id)
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "po_number": f"OC-{seq:04d}",
        "supplier": payload.supplier or "",
        "items": items,
        "total": round(total, 2),
        "status": PO_DRAFT,
        "notes": payload.notes or "",
        "expected_date": payload.expected_date,
        "created_by": user["id"],
        "created_by_name": user.get("name", ""),
        "created_at": now_iso(),
        "received_at": None,
    }
    await db.purchase_orders.insert_one(doc)
    # Surface any MOQ round-ups so the frontend can warn the owner.
    return {**clean(doc), "adjustments": adjustments}


@router.put("/purchase-orders/{po_id}/status")
async def update_po_status(po_id: str, payload: POStatusUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    po = await db.purchase_orders.find_one(tenant_query(tenant_id, {"id": po_id}))
    if not po:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
    if payload.status not in (PO_ORDERED, PO_RECEIVED, PO_CANCELLED):
        raise HTTPException(status_code=400, detail="Estatus inválido")
    # Once received, a PO is a locked historical record: no further status
    # change (including a second "receive") nor item edits are allowed.
    if po["status"] == PO_RECEIVED:
        raise HTTPException(status_code=400, detail="Esta orden de compra ya fue recibida")

    updates = {"status": payload.status}

    # Receiving a PO increases stock and updates the material's last cost.
    if payload.status == PO_RECEIVED:
        # Can only receive an order that was actually placed with the
        # supplier — not a draft, and not a cancelled order.
        if po["status"] == PO_CANCELLED:
            raise HTTPException(status_code=400, detail="Esta orden de compra fue cancelada, no se puede recibir")
        if po["status"] != PO_ORDERED:
            raise HTTPException(status_code=400, detail="La orden de compra debe estar ordenada antes de poder recibirse")

        # Reject the whole receipt if any received item doesn't belong to this
        # PO's original item list — no partial/foreign receiving.
        valid_material_ids = {item["material_id"] for item in po["items"]}
        for ri in payload.received_items or []:
            if ri.material_id not in valid_material_ids:
                mat = await db.materials.find_one(tenant_query(tenant_id, {"id": ri.material_id}), {"_id": 0, "name": 1})
                label = mat["name"] if mat else ri.material_id
                raise HTTPException(status_code=400, detail=f"El insumo {label} no pertenece a esta orden de compra")

        # The actual quantity received per material may differ from what was
        # ordered; fall back to the ordered qty when not provided (back-compat).
        # No MOQ validation on receiving — the supplier may send any amount.
        received_map = {ri.material_id: float(ri.received_qty) for ri in (payload.received_items or [])}

        # Control #5 — validaciones obligatorias server-side al recibir (espejo
        # de las reglas del frontend en PurchaseOrders.js). Se ejecutan ANTES de
        # cualquier mutación de stock para que una recepción rechazada no deje efectos.
        if not (payload.physical_supplier or "").strip():
            raise HTTPException(status_code=422, detail="physical_supplier es requerido al recibir una orden de compra")

        variance_reason = (payload.variance_reason or "").strip()
        exceeds_tolerance = False
        for item in po["items"]:
            ordered_qty = float(item["qty"])
            if ordered_qty <= 0:
                continue
            actual_qty = received_map.get(item["material_id"], ordered_qty)
            variance_pct = abs(actual_qty - ordered_qty) / ordered_qty * 100
            if variance_pct > RECEIVING_VARIANCE_TOLERANCE_PCT:
                exceeds_tolerance = True
                break
        if exceeds_tolerance and not variance_reason:
            raise HTTPException(status_code=422, detail="variance_reason es requerido cuando la cantidad recibida excede el 10% de tolerancia")

        received_items = []
        for item in po["items"]:
            actual_qty = received_map.get(item["material_id"], float(item["qty"]))
            mat = await db.materials.find_one(tenant_query(tenant_id, {"id": item["material_id"]}))
            if mat:
                new_stock = float(mat.get("current_stock", 0)) + actual_qty
                await db.materials.update_one(
                    tenant_query(tenant_id, {"id": item["material_id"]}),
                    {"$set": {
                        "current_stock": new_stock,
                        "cost_per_unit": round(float(item["unit_cost"]), 4),
                        "updated_at": now_iso(),
                    }},
                )
                await _record_movement(
                    item["material_id"], "purchase", actual_qty, po["po_number"], user["id"], tenant_id
                )
            # Flag large over-deliveries (>120% of what was ordered) so the
            # owner can double-check them; doesn't block the receipt.
            ordered_qty = float(item["qty"])
            variance_pct = round((actual_qty - ordered_qty) / ordered_qty * 100, 2) if ordered_qty else 0.0
            requires_review = ordered_qty > 0 and actual_qty > ordered_qty * 1.2
            # Keep ordered vs received traceability on the PO item itself.
            received_items.append({
                **item,
                "received_qty": actual_qty,
                "variance_pct": variance_pct,
                "requires_review": requires_review,
            })
        updates["items"] = received_items
        updates["received_at"] = now_iso()
        updates["received_by"] = user["id"]
        # Control #4 — persist who physically delivered and why quantities
        # deviated (the frontend already enforces both before sending). Free-text
        # on purpose: the delivery may come from a different supplier than the PO's.
        updates["physical_supplier"] = payload.physical_supplier or ""
        updates["variance_reason"] = payload.variance_reason or ""

    await db.purchase_orders.update_one(tenant_query(tenant_id, {"id": po_id}), {"$set": updates})
    return await db.purchase_orders.find_one(tenant_query(tenant_id, {"id": po_id}), {"_id": 0})


@router.delete("/purchase-orders/{po_id}")
async def delete_po(po_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    po = await db.purchase_orders.find_one(tenant_query(tenant_id, {"id": po_id}))
    if po and po.get("status") == PO_RECEIVED:
        raise HTTPException(status_code=400, detail="No puedes eliminar una orden recibida")
    await db.purchase_orders.delete_one(tenant_query(tenant_id, {"id": po_id}))
    return {"ok": True}
