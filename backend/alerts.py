"""Low-stock alerts. Native (in-app) + optional outbound webhook for n8n/WhatsApp."""
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx

from config import clean, db, gen_id, now, now_iso, tenant_query

logger = logging.getLogger("smokehouse.alerts")

ALERT_WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL", "").strip()
STALE_PRICE_DAYS = 30


async def _fire_webhook(alert: dict):
    """Best-effort POST of the alert to an external automation (e.g. n8n)."""
    if not ALERT_WEBHOOK_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(ALERT_WEBHOOK_URL, json=clean(dict(alert)))
    except Exception as exc:  # noqa: BLE001 - alerts must never break the sale
        logger.warning("No se pudo enviar el webhook de alerta: %s", exc)


async def maybe_low_stock_alert(material_id: str) -> bool:
    """Create an alert when a material is at/below its minimum (deduped per material).

    Returns True if a new alert was created, False otherwise (material not
    found, stock is fine, or an unresolved alert already exists for it).
    """
    # Looked up by its unique id; tenant scope is derived from the material itself.
    mat = await db.materials.find_one({"id": material_id}, {"_id": 0})
    if not mat:
        return False
    tenant_id = mat.get("tenant_id")
    current = float(mat.get("current_stock", 0))
    minimum = float(mat.get("min_stock", 0))
    if current > minimum:
        # Back above minimum → auto-resolve any open alert.
        await db.alerts.update_many(
            tenant_query(tenant_id, {"material_id": material_id, "type": "low_stock", "resolved": False}),
            {"$set": {"resolved": True, "resolved_at": now_iso()}},
        )
        return False
    if await db.alerts.find_one(tenant_query(tenant_id, {"material_id": material_id, "type": "low_stock", "resolved": False})):
        return False  # already alerted, don't spam

    level = "critical" if current <= 0 else "warning"
    alert = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "type": "low_stock",
        "material_id": material_id,
        "name": mat["name"],
        "unit": mat.get("unit", ""),
        "current_stock": current,
        "min_stock": minimum,
        "suggested_qty": round(max((float(mat.get("par_stock", 0)) or minimum * 2) - current, minimum or 1), 2),
        "supplier": mat.get("supplier", ""),
        "level": level,
        "message": f"{mat['name']} está en {current} {mat.get('unit','')} (mínimo {minimum}). Conviene reabastecer.",
        "resolved": False,
        "created_at": now_iso(),
    }
    await db.alerts.insert_one(alert)
    await _fire_webhook(alert)
    logger.info("Alerta de bajo stock: %s", mat["name"])
    return True


async def scan_all_low_stock(tenant_id: str) -> int:
    """Bulk scan of every active material for the tenant, reusing
    maybe_low_stock_alert per material — same alert shape, same dedup — just
    triggered on demand instead of reactively after a single stock change.
    Returns how many NEW alerts were created.
    """
    materials = await db.materials.find(tenant_query(tenant_id, {"active": True}), {"_id": 0}).to_list(2000)
    new_alerts = 0
    for m in materials:
        if await maybe_low_stock_alert(m["id"]):
            new_alerts += 1
    return new_alerts


async def maybe_low_stock_alert_product(product_id: str):
    """Low-stock alert for a finished-goods product (track_stock enabled)."""
    # Looked up by its unique id; tenant scope is derived from the product itself.
    prod = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not prod or not prod.get("track_stock"):
        return
    tenant_id = prod.get("tenant_id")
    current = float(prod.get("current_stock", 0))
    minimum = float(prod.get("min_stock", 0))
    if current > minimum:
        await db.alerts.update_many(
            tenant_query(tenant_id, {"ref_id": product_id, "type": "low_stock_product", "resolved": False}),
            {"$set": {"resolved": True, "resolved_at": now_iso()}},
        )
        return
    if await db.alerts.find_one(tenant_query(tenant_id, {"ref_id": product_id, "type": "low_stock_product", "resolved": False})):
        return
    alert = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "type": "low_stock_product",
        "ref_type": "product",
        "ref_id": product_id,
        "material_id": product_id,  # UI key compatibility
        "name": f"{prod['name']} (producto)",
        "unit": "u",
        "current_stock": current,
        "min_stock": minimum,
        "suggested_qty": 0,
        "supplier": "",
        "level": "critical" if current <= 0 else "warning",
        "message": f"{prod['name']} (producto terminado) en {current} unidades (mínimo {minimum}).",
        "resolved": False,
        "created_at": now_iso(),
    }
    await db.alerts.insert_one(alert)
    await _fire_webhook(alert)
    logger.info("Alerta de bajo stock (producto): %s", prod["name"])


def _parse_price_date(date_str):
    """Parse a stored last_price_update ISO date/datetime. None if missing/invalid."""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def check_stale_supplier_prices(tenant_id: str):
    """Alert when a supplier's materials haven't had cost_per_unit refreshed in
    STALE_PRICE_DAYS+ days. Materials are grouped by supplier (free-text name
    on the material) so the owner gets one alert per supplier — not one per
    material — with the supplier's contact info and the affected materials.
    A material that never had a price update is treated as "more than
    STALE_PRICE_DAYS days" per spec. Deduped: skipped if an unresolved alert
    already exists for that supplier.
    """
    materials = await db.materials.find(tenant_query(tenant_id, {"active": True}), {"_id": 0}).to_list(2000)

    by_supplier = {}
    for m in materials:
        supplier_name = (m.get("supplier") or "").strip()
        if not supplier_name:
            continue  # nothing to contact without a supplier name
        by_supplier.setdefault(supplier_name, []).append(m)

    cutoff = now() - timedelta(days=STALE_PRICE_DAYS)

    for supplier_name, mats in by_supplier.items():
        oldest = None
        never_updated = False
        stale_materials = []
        for m in mats:
            dt = _parse_price_date(m.get("last_price_update"))
            if dt is None:
                never_updated = True
                stale_materials.append(m)
                continue
            if oldest is None or dt < oldest:
                oldest = dt
            if dt <= cutoff:
                stale_materials.append(m)

        is_stale = never_updated or (oldest is not None and oldest <= cutoff)
        if not is_stale or not stale_materials:
            continue

        # Don't spam: skip if an unresolved alert already exists for this supplier.
        if await db.alerts.find_one(
            tenant_query(tenant_id, {"type": "price_update_needed", "supplier": supplier_name, "resolved": False})
        ):
            continue

        # Best-effort match against the suppliers directory (by name) for contact info.
        supplier_doc = await db.suppliers.find_one(tenant_query(tenant_id, {"name": supplier_name}), {"_id": 0})
        supplier_email = (supplier_doc or {}).get("email", "")
        supplier_phone = (supplier_doc or {}).get("phone", "")

        alert = {
            "id": gen_id(),
            "tenant_id": tenant_id,
            "type": "price_update_needed",
            "supplier": supplier_name,
            "supplier_email": supplier_email,
            "supplier_phone": supplier_phone,
            "materials": [{"material_id": m["id"], "name": m["name"]} for m in stale_materials],
            "level": "warning",
            "message": (
                f"Los precios de {supplier_name} no se actualizan hace más de {STALE_PRICE_DAYS} días "
                f"({len(stale_materials)} insumo(s)). Contacta al proveedor para confirmar precios vigentes."
            ),
            "resolved": False,
            "created_at": now_iso(),
        }
        await db.alerts.insert_one(alert)
        await _fire_webhook(alert)
        logger.info("Alerta de precio desactualizado: proveedor %s (%d insumos)", supplier_name, len(stale_materials))
