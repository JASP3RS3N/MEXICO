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
