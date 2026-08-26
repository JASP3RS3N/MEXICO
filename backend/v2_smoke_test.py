"""Tests v2 endpoints: suppliers, employees (altas/bajas), alerts on payment, terminal webhook."""
import os

os.environ["PAYMENTS_WEBHOOK_SECRET"] = "test-secret"

import mongomock_motor
import motor.motor_asyncio

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

client = TestClient(server.app)
PASS, FAIL = 0, 0


def check(label, cond):
    global PASS, FAIL
    PASS, FAIL = (PASS + 1, FAIL) if cond else (PASS, FAIL + 1)
    print(f"  {'PASS' if cond else 'FAIL'}  {label}")


def auth(u, p):
    r = client.post("/api/auth/login", json={"username": u, "password": p})
    return {"Authorization": f"Bearer {r.json()['token']}"}


with client:
    owner = auth("dueno", "dueno123")
    cashier = auth("caja", "caja123")

    print("\n== Suppliers ==")
    r = client.post("/api/suppliers", headers=owner, json={"name": "Carnes del Valle", "phone": "555-9"})
    check("owner creates supplier", r.status_code == 200)
    sid = r.json()["id"]
    check("cashier cannot create supplier", client.post("/api/suppliers", headers=cashier, json={"name": "x"}).status_code == 403)
    check("supplier listed", any(s["id"] == sid for s in client.get("/api/suppliers", headers=owner).json()))
    check("update supplier", client.put(f"/api/suppliers/{sid}", headers=owner, json={"phone": "555-0"}).json()["phone"] == "555-0")

    print("\n== Employees (altas/bajas + historial) ==")
    r = client.post("/api/employees", headers=owner, json={"name": "Juan Pérez", "position": "cocina", "wage": 1200})
    check("alta empleado", r.status_code == 200 and r.json()["status"] == "active")
    eid = r.json()["id"]
    check("cashier blocked from employees", client.get("/api/employees", headers=cashier).status_code == 403)
    r = client.post(f"/api/employees/{eid}/terminate", headers=owner, json={"reason": "renuncia"})
    check("baja mantiene registro (inactivo + fecha)", r.json()["status"] == "inactive" and r.json()["termination_date"])
    check("empleado sigue en historial", any(e["id"] == eid for e in client.get("/api/employees", headers=owner).json()))
    check("filtro inactivos", any(e["id"] == eid for e in client.get("/api/employees", headers=owner, params={"status": "inactive"}).json()))
    check("recontratar", client.post(f"/api/employees/{eid}/reactivate", headers=owner).json()["status"] == "active")

    print("\n== Low-stock alert on sale (BOM deduction) ==")
    # Drive a material to its minimum by setting stock low, then sell a product that uses it.
    materials = client.get("/api/materials", headers=owner).json()
    brisket = next(m for m in materials if "Brisket" in m["name"])
    client.put(f"/api/materials/{brisket['id']}", headers=owner, json={"current_stock": brisket["min_stock"] + 0.25, "min_stock": brisket["min_stock"]})
    products = client.get("/api/products", headers=cashier).json()
    prod_brisket = next(p for p in products if "Brisket" in p["name"] and p.get("recipe"))
    order = client.post("/api/orders", headers=cashier, json={"items": [{"product_id": prod_brisket["id"], "qty": 3}]}).json()
    client.post(f"/api/orders/{order['id']}/pay", headers=cashier, json={"method": "efectivo"})
    alerts = client.get("/api/alerts", headers=owner).json()
    check("low-stock alert generated after sale", any(a["material_id"] == brisket["id"] for a in alerts))
    cnt = client.get("/api/alerts/count", headers=owner).json()
    check("alerts count > 0", cnt["unresolved"] >= 1)
    if alerts:
        check("resolve alert", client.post(f"/api/alerts/{alerts[0]['id']}/resolve", headers=owner).status_code == 200)

    print("\n== Cashier cannot see sales ==")
    # Owner creates and pays an order; cashier must not see it.
    op = client.post("/api/orders", headers=cashier, json={"items": [{"product_id": products[0]["id"], "qty": 1}]}).json()
    client.post(f"/api/orders/{op['id']}/pay", headers=cashier, json={"method": "efectivo"})
    cashier_orders = client.get("/api/orders", headers=cashier).json()
    check("cashier list has no paid orders", all(not o["paid"] for o in cashier_orders))
    check("cashier can't fetch a paid order (403)", client.get(f"/api/orders/{op['id']}", headers=cashier).status_code == 403)
    check("owner still sees the paid order", client.get(f"/api/orders/{op['id']}", headers=owner).json()["paid"] is True)

    print("\n== MOQ suggestions + product stock alert ==")
    lowm = materials[1]
    client.put(f"/api/materials/{lowm['id']}", headers=owner, json={"current_stock": 0, "min_stock": 5, "par_stock": 6, "min_order": 20})
    sug = client.get("/api/purchase-orders/suggestions", headers=owner).json()
    msug = next((s for s in sug if s["material_id"] == lowm["id"]), None)
    check("suggestion respects MOQ (>=20)", msug and msug["suggested_qty"] >= 20)

    # product with finished-goods stock
    pr = client.post("/api/products", headers=owner, json={"name": "Cerveza artesanal", "price": 60, "track_stock": True, "current_stock": 1, "min_stock": 2}).json()
    o3 = client.post("/api/orders", headers=cashier, json={"items": [{"product_id": pr["id"], "qty": 1}]}).json()
    client.post(f"/api/orders/{o3['id']}/pay", headers=cashier, json={"method": "efectivo"})
    prod_after = client.get("/api/products", headers=owner).json()
    pr_after = next(p for p in prod_after if p["id"] == pr["id"])
    check("product stock decremented on sale", pr_after["current_stock"] == 0)
    check("product low-stock alert generated", any(a.get("ref_id") == pr["id"] for a in client.get("/api/alerts", headers=owner).json()))

    print("\n== Bank terminal webhook ==")
    order2 = client.post("/api/orders", headers=cashier, json={"items": [{"product_id": products[0]["id"], "qty": 1}]}).json()
    check("wrong secret rejected", client.post("/api/payments/terminal", json={"secret": "bad", "amount": order2["total"], "order_number": order2["order_number"]}).status_code == 401)
    r = client.post("/api/payments/terminal", json={"secret": "test-secret", "amount": order2["total"], "order_number": order2["order_number"], "reference": "TXN-1"})
    check("terminal settles order", r.status_code == 200)
    paid = client.get(f"/api/orders/{order2['id']}", headers=owner).json()
    check("order marked paid by terminal (tarjeta)", paid["paid"] is True and paid["payment_method"] == "tarjeta")
    check("terminal reference stored", paid.get("terminal_reference") == "TXN-1")

    print("\n== Patch: paid order stays in kitchen ==")
    o = client.post("/api/orders", headers=cashier, json={"items": [{"product_id": products[0]["id"], "qty": 1}]}).json()
    # Pay immediately, before the kitchen accepts it.
    client.post(f"/api/orders/{o['id']}/pay", headers=cashier, json={"method": "efectivo"})
    fresh = client.get(f"/api/orders/{o['id']}", headers=owner).json()
    check("paid order keeps fulfillment status (pending)", fresh["paid"] is True and fresh["status"] == "pending")
    check("paid order still visible in kitchen", any(k["order_number"] == o["order_number"] for k in client.get("/api/kitchen", headers=owner).json()))
    check("paid order counted in finance", client.get("/api/finance/pnl", headers=owner).json()["orders"] >= 1)
    check("filter Por cobrar excludes paid", all(x["order_number"] != o["order_number"] for x in client.get("/api/orders", headers=cashier, params={"paid": False}).json()))

    print("\n== Payroll auto-included in expenses/P&L ==")
    pnl_before = client.get("/api/finance/pnl", headers=owner).json()
    client.post("/api/employees", headers=owner, json={"name": "Ana Cocinera", "position": "cocina", "wage": 9000})
    pnl_after = client.get("/api/finance/pnl", headers=owner).json()
    check("P&L exposes payroll field", "payroll" in pnl_after and "payroll_monthly" in pnl_after)
    check("active payroll counted (9000 monthly)", pnl_after["payroll_monthly"] >= 9000)
    check("payroll raises operating expenses", pnl_after["operating_expenses"] > pnl_before["operating_expenses"])
    dash = client.get("/api/finance/dashboard", headers=owner).json()
    check("dashboard month includes payroll", dash["month"].get("payroll", 0) >= 9000)

    print("\n== Theme settings ==")
    r = client.put("/api/settings", headers=owner, json={"theme_bg": "#101020", "theme_sidebar": "#161628", "theme_text": "#e0e0ff"})
    check("owner saves theme colors", r.json().get("theme_bg") == "#101020")

print(f"\n==== RESULT: {PASS} passed, {FAIL} failed ====")
raise SystemExit(1 if FAIL else 0)
