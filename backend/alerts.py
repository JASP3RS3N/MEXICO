"""Low-stock alerts. Native (in-app) + optional outbound webhook for n8n/WhatsApp."""
import logging
import os

import httpx

from config import clean, db, gen_id, now_iso

logger = logging.getLogger("smokehouse.alerts")

ALERT_WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL", "").strip()


async def _fire_webhook(alert: dict):
    """Best-effort POST of the alert to an external automation (e.g. n8n)."""
    if not ALERT_WEBHOOK_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(ALERT_WEBHOOK_URL, json=clean(dict(alert)))
    except Exception as exc:  # noqa: BLE001 - alerts must never break the sale
        logger.warning("No se pudo enviar el webhook de alerta: %s", exc)


async def maybe_low_stock_alert(material_id: str):
    """Create an alert when a material is at/below its minimum (deduped per material)."""
    mat = await db.materials.find_one({"id": material_id}, {"_id": 0})
    if not mat:
        return
    current = float(mat.get("current_stock", 0))
    minimum = float(mat.get("min_stock", 0))
    if current > minimum:
        # Back above minimum → auto-resolve any open alert.
        await db.alerts.update_many(
            {"material_id": material_id, "type": "low_stock", "resolved": False},
            {"$set": {"resolved": True, "resolved_at": now_iso()}},
        )
        return
    if await db.alerts.find_one({"material_id": material_id, "type": "low_stock", "resolved": False}):
        return  # already alerted, don't spam

    level = "critical" if current <= 0 else "warning"
    alert = {
        "id": gen_id(),
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


async def maybe_low_stock_alert_product(product_id: str):
    """Low-stock alert for a finished-goods product (track_stock enabled)."""
    prod = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not prod or not prod.get("track_stock"):
        return
    current = float(prod.get("current_stock", 0))
    minimum = float(prod.get("min_stock", 0))
    if current > minimum:
        await db.alerts.update_many(
            {"ref_id": product_id, "type": "low_stock_product", "resolved": False},
            {"$set": {"resolved": True, "resolved_at": now_iso()}},
        )
        return
    if await db.alerts.find_one({"ref_id": product_id, "type": "low_stock_product", "resolved": False}):
        return
    alert = {
        "id": gen_id(),
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
