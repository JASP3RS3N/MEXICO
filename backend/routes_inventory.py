"""Raw materials (materia prima) master data + purchase orders."""
from fastapi import APIRouter, Depends, HTTPException

from config import (
    PO_CANCELLED,
    PO_DRAFT,
    PO_ORDERED,
    PO_RECEIVED,
    clean,
    db,
    gen_id,
    next_sequence,
    now_iso,
)
from models import (
    MaterialCreate,
    MaterialUpdate,
    POStatusUpdate,
    PurchaseOrderCreate,
    StockAdjust,
)
from security import get_current_user, require_owner, require_roles

router = APIRouter()


async def _record_movement(material_id: str, mtype: str, qty: float, reference: str, user_id: str):
    await db.inventory_movements.insert_one(
        {
            "id": gen_id(),
            "material_id": material_id,
            "type": mtype,  # purchase | consumption | adjustment
            "qty": qty,
            "reference": reference,
            "user_id": user_id,
            "created_at": now_iso(),
        }
    )


# ---------------------------------------------------------------------------
# Materials master data
# ---------------------------------------------------------------------------
@router.get("/materials")
async def list_materials(user: dict = Depends(require_roles("owner", "prep"))):
    materials = await db.materials.find({}, {"_id": 0}).sort("name", 1).to_list(2000)
    return materials


@router.post("/materials")
async def create_material(payload: MaterialCreate, user: dict = Depends(require_owner)):
    doc = {
        "id": gen_id(),
        "sku": payload.sku or "",
        "name": payload.name.strip(),
        "unit": payload.unit,
        "category": payload.category or "General",
        "cost_per_unit": round(float(payload.cost_per_unit), 4),
        "current_stock": float(payload.current_stock),
        "min_stock": float(payload.min_stock),
        "par_stock": float(payload.par_stock),
        "supplier": payload.supplier or "",
        "active": payload.active,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.materials.insert_one(doc)
    if doc["current_stock"]:
        await _record_movement(doc["id"], "adjustment", doc["current_stock"], "Inventario inicial", user["id"])
    return clean(doc)


@router.put("/materials/{material_id}")
async def update_material(material_id: str, payload: MaterialUpdate, user: dict = Depends(require_owner)):
    material = await db.materials.find_one({"id": material_id})
    if not material:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = now_iso()
        await db.materials.update_one({"id": material_id}, {"$set": updates})
    return await db.materials.find_one({"id": material_id}, {"_id": 0})


@router.post("/materials/{material_id}/adjust")
async def adjust_stock(material_id: str, payload: StockAdjust, user: dict = Depends(require_owner)):
    material = await db.materials.find_one({"id": material_id})
    if not material:
        raise HTTPException(status_code=404, detail="Materia prima no encontrada")
    new_stock = float(material.get("current_stock", 0)) + float(payload.qty)
    await db.materials.update_one(
        {"id": material_id}, {"$set": {"current_stock": new_stock, "updated_at": now_iso()}}
    )
    await _record_movement(material_id, "adjustment", float(payload.qty), payload.reason or "Ajuste", user["id"])
    return await db.materials.find_one({"id": material_id}, {"_id": 0})


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(require_owner)):
    await db.materials.delete_one({"id": material_id})
    return {"ok": True}


@router.get("/materials/low-stock")
async def low_stock(user: dict = Depends(require_owner)):
    materials = await db.materials.find({"active": True}, {"_id": 0}).to_list(2000)
    return [m for m in materials if float(m.get("current_stock", 0)) <= float(m.get("min_stock", 0))]


@router.get("/inventory/movements")
async def movements(material_id: str = None, user: dict = Depends(require_owner)):
    query = {"material_id": material_id} if material_id else {}
    docs = await db.inventory_movements.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


# ---------------------------------------------------------------------------
# Purchase orders (órdenes de compra)
# ---------------------------------------------------------------------------
@router.get("/purchase-orders")
async def list_pos(user: dict = Depends(require_owner)):
    pos = await db.purchase_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return pos


@router.get("/purchase-orders/suggestions")
async def po_suggestions(user: dict = Depends(require_owner)):
    """Suggest reorder quantities for materials at/below their minimum stock."""
    materials = await db.materials.find({"active": True}, {"_id": 0}).to_list(2000)
    suggestions = []
    for m in materials:
        current = float(m.get("current_stock", 0))
        minimum = float(m.get("min_stock", 0))
        par = float(m.get("par_stock", 0)) or (minimum * 2)
        if current <= minimum:
            suggested = max(par - current, 0)
            suggestions.append(
                {
                    "material_id": m["id"],
                    "name": m["name"],
                    "unit": m["unit"],
                    "supplier": m.get("supplier", ""),
                    "current_stock": current,
                    "min_stock": minimum,
                    "suggested_qty": round(suggested, 2) or round(par or minimum or 1, 2),
                    "unit_cost": float(m.get("cost_per_unit", 0)),
                }
            )
    return suggestions


@router.post("/purchase-orders")
async def create_po(payload: PurchaseOrderCreate, user: dict = Depends(require_owner)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="La orden de compra necesita al menos un artículo")

    items = []
    total = 0.0
    for it in payload.items:
        mat = await db.materials.find_one({"id": it.material_id}, {"_id": 0})
        if not mat:
            raise HTTPException(status_code=404, detail=f"Materia prima {it.material_id} no encontrada")
        unit_cost = float(it.unit_cost if it.unit_cost is not None else mat.get("cost_per_unit", 0))
        subtotal = round(unit_cost * float(it.qty), 2)
        total += subtotal
        items.append(
            {
                "material_id": mat["id"],
                "name": mat["name"],
                "unit": mat["unit"],
                "qty": float(it.qty),
                "unit_cost": unit_cost,
                "subtotal": subtotal,
            }
        )

    seq = await next_sequence("purchase_order")
    doc = {
        "id": gen_id(),
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
    return clean(doc)


@router.put("/purchase-orders/{po_id}/status")
async def update_po_status(po_id: str, payload: POStatusUpdate, user: dict = Depends(require_owner)):
    po = await db.purchase_orders.find_one({"id": po_id})
    if not po:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada")
    if payload.status not in (PO_ORDERED, PO_RECEIVED, PO_CANCELLED):
        raise HTTPException(status_code=400, detail="Estatus inválido")
    if po["status"] == PO_RECEIVED:
        raise HTTPException(status_code=400, detail="La orden ya fue recibida")

    updates = {"status": payload.status}

    # Receiving a PO increases stock and updates the material's last cost.
    if payload.status == PO_RECEIVED:
        for item in po["items"]:
            mat = await db.materials.find_one({"id": item["material_id"]})
            if mat:
                new_stock = float(mat.get("current_stock", 0)) + float(item["qty"])
                await db.materials.update_one(
                    {"id": item["material_id"]},
                    {"$set": {
                        "current_stock": new_stock,
                        "cost_per_unit": round(float(item["unit_cost"]), 4),
                        "updated_at": now_iso(),
                    }},
                )
                await _record_movement(
                    item["material_id"], "purchase", float(item["qty"]), po["po_number"], user["id"]
                )
        updates["received_at"] = now_iso()

    await db.purchase_orders.update_one({"id": po_id}, {"$set": updates})
    return await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})


@router.delete("/purchase-orders/{po_id}")
async def delete_po(po_id: str, user: dict = Depends(require_owner)):
    po = await db.purchase_orders.find_one({"id": po_id})
    if po and po.get("status") == PO_RECEIVED:
        raise HTTPException(status_code=400, detail="No puedes eliminar una orden recibida")
    await db.purchase_orders.delete_one({"id": po_id})
    return {"ok": True}
