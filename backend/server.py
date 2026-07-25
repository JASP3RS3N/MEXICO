"""Smokehouse — Control financiero, inventario y P&L.

FastAPI entrypoint. Wires the domain routers under /api, configures CORS and
seeds an initial owner + demo catalog on first boot so the app is usable
immediately.
"""
import logging
import os

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from config import (
    CORS_ORIGINS,
    ROLE_CASHIER,
    ROLE_OWNER,
    ROLE_PREP,
    client,
    db,
    gen_id,
    now_iso,
)
from security import hash_password
import routes_auth
import routes_menu
import routes_inventory
import routes_orders
import routes_finance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("smokehouse")

app = FastAPI(title="Smokehouse API", version="1.0.0")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "Smokehouse", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


# Wire domain routers
api_router.include_router(routes_auth.router, tags=["auth"])
api_router.include_router(routes_menu.router, tags=["menu"])
api_router.include_router(routes_inventory.router, tags=["inventory"])
api_router.include_router(routes_orders.router, tags=["orders"])
api_router.include_router(routes_finance.router, tags=["finance"])

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------
async def _ensure_indexes():
    try:
        await db.users.create_index("username", unique=True)
        await db.users.create_index("id", unique=True)
        await db.orders.create_index("status")
        await db.orders.create_index("paid_at")
        await db.materials.create_index("name")
    except Exception as exc:  # noqa: BLE001 - index creation is best-effort
        logger.warning("No se pudieron crear índices: %s", exc)


async def _seed_users():
    if await db.users.count_documents({}) > 0:
        return
    defaults = [
        (ROLE_OWNER, "dueno", "Dueño", "dueno123"),
        (ROLE_CASHIER, "caja", "Cajera", "caja123"),
        (ROLE_PREP, "cocina", "Preparación", "cocina123"),
    ]
    for role, username, name, pwd in defaults:
        await db.users.insert_one(
            {
                "id": gen_id(),
                "username": username,
                "name": name,
                "role": role,
                "pin": None,
                "password_hash": hash_password(pwd),
                "active": True,
                "created_at": now_iso(),
            }
        )
    logger.info("Usuarios semilla creados (dueno/caja/cocina).")


async def _seed_settings():
    if not await db.settings.find_one({"id": "settings"}):
        await db.settings.insert_one(
            {
                "id": "settings",
                "restaurant_name": "El Ahumadero — Smokehouse",
                "currency": "MXN",
                "tax_rate": 0.16,
                "tax_included": True,
            }
        )


async def _seed_catalog():
    if os.environ.get("SEED_DEMO", "true").lower() != "true":
        return
    if await db.products.count_documents({}) > 0:
        return

    # Categories
    cats = {}
    for i, name in enumerate(["BBQ / Carnes", "Combos", "Guarniciones", "Bebidas", "Postres"]):
        cid = gen_id()
        cats[name] = cid
        await db.categories.insert_one({"id": cid, "name": name, "sort_order": i, "created_at": now_iso()})

    # Raw materials (materia prima)
    def mat(name, unit, cost, stock, mn, par, supplier, cat="Insumos"):
        mid = gen_id()
        return mid, {
            "id": mid, "sku": "", "name": name, "unit": unit, "category": cat,
            "cost_per_unit": cost, "current_stock": stock, "min_stock": mn, "par_stock": par,
            "supplier": supplier, "active": True, "created_at": now_iso(), "updated_at": now_iso(),
        }

    materials_def = [
        mat("Brisket de res", "kg", 220, 40, 15, 60, "Carnes del Norte", "Carnes"),
        mat("Costilla de cerdo", "kg", 145, 35, 12, 50, "Carnes del Norte", "Carnes"),
        mat("Pollo entero", "kg", 95, 30, 10, 40, "Avícola SA", "Carnes"),
        mat("Salchicha ahumada", "kg", 130, 20, 8, 30, "Embutidos MX", "Carnes"),
        mat("Pan brioche", "pza", 6, 200, 60, 300, "Panadería La Espiga", "Panadería"),
        mat("Papa", "kg", 22, 50, 15, 60, "Central de Abastos", "Verdura"),
        mat("Frijol charro", "kg", 35, 25, 8, 30, "Central de Abastos", "Abarrotes"),
        mat("Salsa BBQ de la casa", "lt", 55, 18, 6, 24, "Producción interna", "Salsas"),
        mat("Carbón mezquite", "kg", 28, 80, 30, 120, "Leña y Carbón MX", "Combustible"),
        mat("Refresco lata", "pza", 9, 120, 48, 240, "Distribuidora Bebidas", "Bebidas"),
        mat("Agua embotellada", "pza", 5, 100, 48, 240, "Distribuidora Bebidas", "Bebidas"),
        mat("Vaso desechable 16oz", "pza", 1.2, 400, 100, 600, "Desechables MX", "Desechables"),
    ]
    m = {}
    mat_cost = {}
    for mid, doc in materials_def:
        await db.materials.insert_one(doc)
        m[doc["name"]] = mid
        mat_cost[mid] = doc["cost_per_unit"]

    def prod(name, cat, price, station, desc, recipe):
        cost = round(sum(mat_cost.get(r["material_id"], 0) * r["qty"] for r in recipe), 2)
        return {
            "id": gen_id(), "name": name, "category_id": cats[cat], "price": price,
            "description": desc, "station": station, "active": True,
            "recipe": recipe, "cost": cost,
            "created_at": now_iso(),
        }

    products = [
        prod("Brisket 250g", "BBQ / Carnes", 189, "ahumador", "Pecho de res ahumado 12h",
             [{"material_id": m["Brisket de res"], "qty": 0.25}, {"material_id": m["Salsa BBQ de la casa"], "qty": 0.03}]),
        prod("1/2 Costilla BBQ", "BBQ / Carnes", 229, "ahumador", "Costillas de cerdo glaseadas",
             [{"material_id": m["Costilla de cerdo"], "qty": 0.5}, {"material_id": m["Salsa BBQ de la casa"], "qty": 0.05}]),
        prod("Pollo ahumado 1/4", "BBQ / Carnes", 129, "ahumador", "Cuarto de pollo ahumado",
             [{"material_id": m["Pollo entero"], "qty": 0.35}]),
        prod("Sausage Plate", "BBQ / Carnes", 149, "ahumador", "Salchicha ahumada de la casa",
             [{"material_id": m["Salchicha ahumada"], "qty": 0.2}, {"material_id": m["Pan brioche"], "qty": 1}]),
        prod("Combo Familiar", "Combos", 599, "ahumador", "Brisket + costilla + pollo + 2 guarniciones",
             [{"material_id": m["Brisket de res"], "qty": 0.3}, {"material_id": m["Costilla de cerdo"], "qty": 0.4},
              {"material_id": m["Pollo entero"], "qty": 0.4}, {"material_id": m["Salsa BBQ de la casa"], "qty": 0.1}]),
        prod("Papas gajo", "Guarniciones", 65, "cocina", "Papas gajo sazonadas",
             [{"material_id": m["Papa"], "qty": 0.3}]),
        prod("Frijoles charros", "Guarniciones", 55, "cocina", "Frijoles charros ahumados",
             [{"material_id": m["Frijol charro"], "qty": 0.2}]),
        prod("Refresco", "Bebidas", 35, "barra", "Lata 355ml",
             [{"material_id": m["Refresco lata"], "qty": 1}, {"material_id": m["Vaso desechable 16oz"], "qty": 1}]),
        prod("Agua", "Bebidas", 25, "barra", "Botella 600ml",
             [{"material_id": m["Agua embotellada"], "qty": 1}]),
        prod("Pay de nuez", "Postres", 75, "barra", "Rebanada de pay de nuez", []),
    ]
    for p in products:
        await db.products.insert_one(p)
    logger.info("Catálogo demo creado (%d productos, %d materias primas).", len(products), len(materials_def))


@app.on_event("startup")
async def startup():
    await _ensure_indexes()
    await _seed_settings()
    await _seed_users()
    await _seed_catalog()
    logger.info("Smokehouse API lista.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
