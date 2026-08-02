"""Menu catalog: categories and products (with prices & recipes)."""
from fastapi import APIRouter, Depends, HTTPException

from config import clean, db, gen_id, now_iso, tenant_query
from models import (
    CategoryCreate,
    CategoryUpdate,
    PriceUpdate,
    ProductCreate,
    ProductUpdate,
)
from security import get_current_user, get_tenant_id, require_owner

router = APIRouter()


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    tenant_id = get_tenant_id(user)
    cats = await db.categories.find(tenant_query(tenant_id), {"_id": 0}).sort("sort_order", 1).to_list(200)
    return cats


@router.post("/categories")
async def create_category(payload: CategoryCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "name": payload.name.strip(),
        "sort_order": payload.sort_order,
        "created_at": now_iso(),
    }
    await db.categories.insert_one(doc)
    return clean(doc)


@router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.categories.update_one(tenant_query(tenant_id, {"id": cat_id}), {"$set": updates})
    doc = await db.categories.find_one(tenant_query(tenant_id, {"id": cat_id}), {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return doc


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    await db.categories.delete_one(tenant_query(tenant_id, {"id": cat_id}))
    await db.products.update_many(tenant_query(tenant_id, {"category_id": cat_id}), {"$set": {"category_id": None}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Products (menú)
# ---------------------------------------------------------------------------
async def _product_cost(recipe, tenant_id: str) -> float:
    """Estimate a product's ingredient cost from its recipe (best-effort), tenant-scoped."""
    total = 0.0
    for item in recipe or []:
        mat = await db.materials.find_one(tenant_query(tenant_id, {"id": item["material_id"]}), {"_id": 0})
        if mat:
            total += float(mat.get("cost_per_unit", 0)) * float(item.get("qty", 0))
    return round(total, 2)


@router.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    tenant_id = get_tenant_id(user)
    products = await db.products.find(tenant_query(tenant_id), {"_id": 0}).to_list(1000)
    return products


@router.post("/products")
async def create_product(payload: ProductCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    recipe = [item.model_dump() for item in payload.recipe]
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "name": payload.name.strip(),
        "category_id": payload.category_id,
        "price": round(float(payload.price), 2),
        "description": payload.description or "",
        "station": payload.station or "cocina",
        "active": payload.active,
        "recipe": recipe,
        "cost": await _product_cost(recipe, tenant_id),
        "track_stock": payload.track_stock,
        "current_stock": float(payload.current_stock),
        "min_stock": float(payload.min_stock),
        "created_at": now_iso(),
    }
    await db.products.insert_one(doc)
    return clean(doc)


@router.put("/products/{product_id}")
async def update_product(product_id: str, payload: ProductUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    product = await db.products.find_one(tenant_query(tenant_id, {"id": product_id}))
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    updates = {}
    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "category_id", "description", "station", "active", "track_stock"):
        if field in data and data[field] is not None:
            updates[field] = data[field]
    for field in ("current_stock", "min_stock"):
        if field in data and data[field] is not None:
            updates[field] = float(data[field])
    if "price" in data and data["price"] is not None:
        updates["price"] = round(float(data["price"]), 2)
    if "recipe" in data and data["recipe"] is not None:
        recipe = [r if isinstance(r, dict) else r.model_dump() for r in payload.recipe]
        updates["recipe"] = recipe
        updates["cost"] = await _product_cost(recipe, tenant_id)

    if updates:
        await db.products.update_one(tenant_query(tenant_id, {"id": product_id}), {"$set": updates})
    return await db.products.find_one(tenant_query(tenant_id, {"id": product_id}), {"_id": 0})


@router.patch("/products/{product_id}/price")
async def update_price(product_id: str, payload: PriceUpdate, user: dict = Depends(require_owner)):
    """Quick price edit — the owner is the only one allowed to change prices."""
    tenant_id = get_tenant_id(user)
    res = await db.products.update_one(
        tenant_query(tenant_id, {"id": product_id}), {"$set": {"price": round(float(payload.price), 2)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return await db.products.find_one(tenant_query(tenant_id, {"id": product_id}), {"_id": 0})


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    await db.products.delete_one(tenant_query(tenant_id, {"id": product_id}))
    return {"ok": True}
