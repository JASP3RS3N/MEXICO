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
    ROLE_PRODUCTION,
    ROLE_WAREHOUSE,
    ROLE_SUPERADMIN,
    SAP_INVENTORY_ENABLED,
    SAP_INVENTORY_SYNC_MINUTES,
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
import routes_ai
import routes_people
import routes_alerts
import routes_admin
import routes_wms_requests
import routes_wms_inventory
import routes_wms_dashboard

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
api_router.include_router(routes_ai.router, tags=["ai"])
api_router.include_router(routes_people.router, tags=["people"])
api_router.include_router(routes_alerts.router, tags=["alerts"])
# WMS Producción ↔ Almacén (solicitudes, inventario SAP de solo lectura, KPIs).
api_router.include_router(routes_wms_requests.router, tags=["wms"])
api_router.include_router(routes_wms_inventory.router, tags=["wms-inventory"])
api_router.include_router(routes_wms_dashboard.router, tags=["wms-dashboard"])

app.include_router(api_router)

# Platform admin (tenant management) — superadmin only.
app.include_router(routes_admin.router, prefix="/api/admin", tags=["admin"])

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
        # WMS: el tablero filtra por estado/locación y ordena por antigüedad;
        # el snapshot se lee siempre por (tenant, parte, locación).
        await db.wms_requests.create_index([("tenant_id", 1), ("status", 1), ("requested_at", 1)])
        await db.wms_requests.create_index([("tenant_id", 1), ("location_id", 1), ("status", 1)])
        await db.wms_requests.create_index("id", unique=True)
        await db.wms_fulfillments.create_index([("tenant_id", 1), ("fulfilled_at", -1)])
        await db.wms_fulfillments.create_index("request_id")
        await db.wms_audit_log.create_index([("tenant_id", 1), ("request_id", 1), ("created_at", 1)])
        await db.wms_inventory_snapshots.create_index(
            [("tenant_id", 1), ("part_number", 1), ("location_id", 1)], unique=True
        )
        await db.wms_inventory_snapshots.create_index([("tenant_id", 1), ("location_id", 1)])
        await db.wms_locations.create_index([("tenant_id", 1), ("code", 1)], unique=True)
        await db.wms_sap_sync_logs.create_index([("tenant_id", 1), ("started_at", -1)])
    except Exception as exc:  # noqa: BLE001 - index creation is best-effort
        logger.warning("No se pudieron crear índices: %s", exc)


async def _seed_superadmin():
    """Create the platform superadmin if none exists (no tenant)."""
    if await db.users.count_documents({"role": ROLE_SUPERADMIN}) > 0:
        return
    await db.users.insert_one(
        {
            "id": gen_id(),
            "username": "admin",
            "name": "Super Admin",
            "role": ROLE_SUPERADMIN,
            "tenant_id": None,
            "pin": None,
            "password_hash": hash_password(os.environ.get("SUPERADMIN_PASSWORD", "admin123")),
            "active": True,
            "created_at": now_iso(),
        }
    )
    logger.info("Superadmin creado (usuario: admin).")


async def _seed_demo_tenant():
    """Seed a self-contained demo tenant (users + settings + catalog).

    Disabled by default so it never contaminates a real production database;
    enable explicitly with SEED_DEMO_TENANT=true. Idempotent: if the demo
    tenant already exists, nothing is seeded. The demo owner/cashier/prep users
    and the smokehouse catalog all belong to this tenant. Separate from
    _seed_superadmin, which always runs and has no tenant.
    """
    if os.environ.get("SEED_DEMO_TENANT", "false").lower() != "true":
        return
    if await db.tenants.find_one({"slug": "demo"}):
        return

    tenant = {
        "id": gen_id(),
        "name": "Smokehouse Demo",
        "slug": "demo",
        "plan": "control",
        "active": True,
        "created_at": now_iso(),
    }
    await db.tenants.insert_one(tenant)
    tenant_id = tenant["id"]

    await _seed_settings(tenant_id)
    location = await _seed_wms_location(tenant_id)
    await _seed_users(tenant_id, location["id"])
    await _seed_catalog(tenant_id)
    logger.info("Tenant demo creado (slug=demo).")


async def _seed_wms_location(tenant_id: str) -> dict:
    """Locación demo del WMS. La ingesta de SAP creará las reales al importar."""
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "code": "1000/0001",
        "plant_code": "1000",
        "name": "Planta 1000 · Almacén 0001",
        "active": True,
        "created_at": now_iso(),
        "source": "seed",
    }
    await db.wms_locations.insert_one(doc)
    return doc


async def _seed_users(tenant_id: str, location_id: str = None):
    # (rol, usuario, nombre, contraseña, ¿lleva locación WMS?)
    defaults = [
        (ROLE_OWNER, "dueno", "Dueño", "dueno123", False),
        (ROLE_CASHIER, "caja", "Cajera", "caja123", False),
        (ROLE_PREP, "cocina", "Preparación", "cocina123", False),
        (ROLE_PRODUCTION, "produccion", "Producción", "produccion123", True),
        (ROLE_WAREHOUSE, "almacen", "Almacén", "almacen123", True),
    ]
    for role, username, name, pwd, needs_location in defaults:
        await db.users.insert_one(
            {
                "id": gen_id(),
                "username": username,
                "name": name,
                "role": role,
                "tenant_id": tenant_id,
                "pin": None,
                "password_hash": hash_password(pwd),
                "location_id": location_id if needs_location else None,
                "active": True,
                "created_at": now_iso(),
            }
        )
    logger.info("Usuarios semilla creados (dueno/caja/cocina/produccion/almacen).")


async def _seed_settings(tenant_id: str):
    if not await db.settings.find_one({"id": "settings", "tenant_id": tenant_id}):
        await db.settings.insert_one(
            {
                "id": "settings",
                "tenant_id": tenant_id,
                "restaurant_name": "El Ahumadero — Smokehouse",
                "currency": "MXN",
                "tax_rate": 0.16,
                "tax_included": True,
            }
        )


async def _seed_catalog(tenant_id: str):
    if await db.products.count_documents({"tenant_id": tenant_id}) > 0:
        return

    # Categories
    cats = {}
    for i, name in enumerate(["BBQ / Carnes", "Combos", "Guarniciones", "Bebidas", "Postres"]):
        cid = gen_id()
        cats[name] = cid
        await db.categories.insert_one({"id": cid, "tenant_id": tenant_id, "name": name, "sort_order": i, "created_at": now_iso()})

    # Raw materials (materia prima)
    def mat(name, unit, cost, stock, mn, par, supplier, cat="Insumos"):
        mid = gen_id()
        return mid, {
            "id": mid, "tenant_id": tenant_id, "sku": "", "name": name, "unit": unit, "category": cat,
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
            "id": gen_id(), "tenant_id": tenant_id, "name": name, "category_id": cats[cat], "price": price,
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


# ---------------------------------------------------------------------------
# Scheduler del WMS
# ---------------------------------------------------------------------------
# Dos trabajos periódicos: la ingesta del export de SAP (solo lectura) y el
# barrido de solicitudes atrasadas que alimenta la campanita de alertas.
# APScheduler corre dentro del mismo proceso de uvicorn, así que no hace falta
# un cron aparte en el contenedor.
_scheduler = None

# Cada cuánto se revisa si hay solicitudes que ya rebasaron el umbral rojo. El
# tablero de almacén ya lo pinta en vivo; esto es solo para persistir la alerta.
OVERDUE_SCAN_MINUTES = 5


async def _sap_sync_job():
    """Ingesta horaria del export de SAP. Nunca escribe hacia SAP."""
    from sap_inventory_ingest import sync_all_tenants

    try:
        await sync_all_tenants(trigger="scheduler")
    except Exception as exc:  # noqa: BLE001 - un fallo de ingesta no tumba la app
        logger.warning("Job de ingesta SAP falló: %s", exc)


async def _overdue_scan_job():
    """Alertas de solicitudes de material atrasadas, por tenant."""
    from alerts import scan_overdue_requests

    try:
        tenants = await db.tenants.find({"active": True}, {"_id": 0, "id": 1}).to_list(500)
        for tenant in tenants:
            await scan_overdue_requests(tenant["id"])
    except Exception as exc:  # noqa: BLE001 - las alertas nunca deben tumbar la app
        logger.warning("Job de solicitudes atrasadas falló: %s", exc)


def _start_scheduler():
    """Arranca los jobs del WMS. Silencioso si APScheduler no está instalado."""
    global _scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
    except ImportError:
        logger.warning("APScheduler no está instalado: la ingesta SAP solo correrá manualmente.")
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")
    if SAP_INVENTORY_ENABLED:
        _scheduler.add_job(
            _sap_sync_job,
            "interval",
            minutes=SAP_INVENTORY_SYNC_MINUTES,
            id="sap_inventory_sync",
            # Al arrancar no se corre de inmediato: se espera un intervalo para
            # no pelear con el arranque del contenedor.
            max_instances=1,
            coalesce=True,
        )
    _scheduler.add_job(
        _overdue_scan_job,
        "interval",
        minutes=OVERDUE_SCAN_MINUTES,
        id="wms_overdue_scan",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler WMS iniciado (ingesta SAP cada %s min, alertas cada %s min).",
        SAP_INVENTORY_SYNC_MINUTES if SAP_INVENTORY_ENABLED else "—",
        OVERDUE_SCAN_MINUTES,
    )


@app.on_event("startup")
async def startup():
    await _ensure_indexes()
    await _seed_superadmin()
    await _seed_demo_tenant()
    _start_scheduler()
    logger.info("Smokehouse API lista.")


@app.on_event("shutdown")
async def shutdown_db_client():
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
    client.close()
