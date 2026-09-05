"""End-to-end smoke test using an in-memory Mongo (mongomock-motor).

Patches the motor client before importing the app, then drives the real API
through FastAPI's TestClient: seeding, auth, RBAC, POS order, kitchen flow,
payment + inventory deduction, purchase orders and P&L.
Run: python3 smoke_test.py
"""
import mongomock_motor
import motor.motor_asyncio

# Patch motor with the in-memory implementation BEFORE the app imports config.
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

client = TestClient(server.app)
PASS, FAIL = 0, 0


def check(label, condition):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label}")


def auth(username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"login {username} -> {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


def auth_pin(owner_headers, username):
    """Cashier/prep now log in by PIN (see commit 0c81b7e): find the user,
    issue them a PIN (seed users start with pin=None), then swap this
    device's session to that PIN via /auth/login-pin. Returns (headers, pin)
    so callers can also reuse the PIN itself (e.g. PinTagRequest bodies)."""
    users = client.get("/api/users", headers=owner_headers).json()
    target = next(u for u in users if u["username"] == username)
    r = client.post(f"/api/users/{target['id']}/regenerate-pin", headers=owner_headers)
    assert r.status_code == 200, f"regenerate-pin {username} -> {r.status_code} {r.text}"
    pin = r.json()["pin"]
    r = client.post("/api/auth/login-pin", headers=owner_headers, json={"pin": pin})
    assert r.status_code == 200, f"login-pin {username} -> {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}, pin


with client:  # triggers startup (seed)
    print("\n== Auth & RBAC ==")
    owner = auth("dueno", "dueno123")
    cashier, cashier_pin = auth_pin(owner, "caja")
    prep, prep_pin = auth_pin(owner, "cocina")

    check("bad login rejected", client.post("/api/auth/login", json={"username": "dueno", "password": "x"}).status_code == 401)
    check("me returns owner role", client.get("/api/auth/me", headers=owner).json()["user"]["role"] == "owner")
    check("cashier cannot list users (403)", client.get("/api/users", headers=cashier).status_code == 403)
    check("cashier cannot see finances (403)", client.get("/api/finance/pnl", headers=cashier).status_code == 403)
    check("prep cannot see daily sales (403)", client.get("/api/finance/daily", headers=prep).status_code == 403)
    check("owner can see pnl", client.get("/api/finance/pnl", headers=owner).status_code == 200)

    print("\n== Seeded catalog ==")
    products = client.get("/api/products", headers=cashier).json()
    materials = client.get("/api/materials", headers=owner).json()
    check("products seeded", len(products) >= 8)
    check("materials seeded", len(materials) >= 10)
    check("products carry recipe cost", any(p.get("cost", 0) > 0 for p in products))

    print("\n== User management ==")
    r = client.post("/api/users", headers=owner, json={"username": "caja2", "name": "Cajera 2", "password": "pw123", "role": "cashier"})
    check("owner creates user", r.status_code == 200)
    check("duplicate user rejected", client.post("/api/users", headers=owner, json={"username": "caja2", "name": "x", "password": "y", "role": "cashier"}).status_code == 409)
    new_id = r.json()["id"]
    check("owner deletes user", client.delete(f"/api/users/{new_id}", headers=owner).status_code == 200)

    print("\n== Price edit (owner only) ==")
    p0 = products[0]
    check("cashier cannot change price (403)", client.patch(f"/api/products/{p0['id']}/price", headers=cashier, json={"price": 1}).status_code == 403)
    r = client.patch(f"/api/products/{p0['id']}/price", headers=owner, json={"price": 199.5})
    check("owner edits price", r.status_code == 200 and r.json()["price"] == 199.5)

    print("\n== POS order -> kitchen -> pay ==")
    brisket = next(p for p in products if "Brisket" in p["name"])
    refresco = next(p for p in products if p["name"] == "Refresco")
    mat_before = {m["id"]: m["current_stock"] for m in materials}

    r = client.post("/api/orders", headers=cashier, json={
        "customer_name": "Mesa 4",
        "items": [{"product_id": brisket["id"], "qty": 2}, {"product_id": refresco["id"], "qty": 1}],
    })
    check("cashier creates order", r.status_code == 200)
    order = r.json()
    check("order has sequential number", isinstance(order["order_number"], int))
    check("order total computed", order["total"] > 0)
    check("order starts pending", order["status"] == "pending")

    check("prep cannot create order (403)", client.post("/api/orders", headers=prep, json={"items": [{"product_id": brisket["id"], "qty": 1}]}).status_code == 403)

    # kitchen visibility
    kq = client.get("/api/kitchen", headers=prep).json()
    check("order visible in kitchen queue", any(o["order_number"] == order["order_number"] for o in kq))
    check("kitchen hides prices", all("price" not in i for o in kq for i in o["items"]))

    # public display (no auth)
    disp = client.get("/api/display", params={"tenant": "demo"}).json()
    check("public display shows order, no money", any(o["order_number"] == order["order_number"] for o in disp) and all("total" not in o for o in disp))

    # prep flow
    check("prep accepts order", client.post(f"/api/orders/{order['id']}/accept", headers=prep, json={"pin": prep_pin}).status_code == 200)
    check("cannot re-accept order", client.post(f"/api/orders/{order['id']}/accept", headers=prep, json={"pin": prep_pin}).status_code == 400)
    check("prep marks ready", client.post(f"/api/orders/{order['id']}/ready", headers=prep).status_code == 200)

    # payment + inventory deduction
    r = client.post(f"/api/orders/{order['id']}/pay", headers=cashier, json={"method": "efectivo", "amount_received": 1000})
    check("cashier pays order", r.status_code == 200)
    check("change computed", r.json()["change"] == round(1000 - order["total"], 2))
    check("cannot double-pay", client.post(f"/api/orders/{order['id']}/pay", headers=cashier, json={"method": "efectivo"}).status_code == 400)

    # propina (tip): el cambio se calcula sobre total + propina
    r = client.post("/api/orders", headers=cashier, json={"items": [{"product_id": refresco["id"], "qty": 1}]})
    check("cashier creates second order (tip test)", r.status_code == 200)
    tip_order = r.json()
    tip_amount = round(tip_order["total"] * 0.1, 2) or 5.0
    r = client.post(f"/api/orders/{tip_order['id']}/pay", headers=cashier, json={"method": "efectivo", "amount_received": 1000, "tip_amount": tip_amount})
    check("cashier pays order with tip", r.status_code == 200)
    check("change accounts for tip", r.json()["change"] == round(1000 - (tip_order["total"] + tip_amount), 2))
    got = client.get(f"/api/orders/{tip_order['id']}", headers=owner).json()
    check("order stores tip_amount", got.get("tip_amount") == tip_amount)

    mats_after = {m["id"]: m["current_stock"] for m in client.get("/api/materials", headers=owner).json()}
    brisket_mat = next(m["material_id"] for m in brisket["recipe"] if True)
    check("inventory deducted after payment", mats_after[brisket_mat] < mat_before[brisket_mat])

    print("\n== Purchase orders ==")
    low_mat = materials[0]
    r = client.post("/api/purchase-orders", headers=owner, json={
        "supplier": "Proveedor X",
        "items": [{"material_id": low_mat["id"], "qty": 10, "unit_cost": 100}],
    })
    check("owner creates PO", r.status_code == 200)
    po = r.json()
    check("PO numbered", po["po_number"].startswith("OC-"))
    check("PO total", po["total"] == 1000.0)
    stock_before_po = next(m["current_stock"] for m in client.get("/api/materials", headers=owner).json() if m["id"] == low_mat["id"])
    # Control #5 — validaciones server-side al recibir (casos negativos). La PO
    # debe estar "ordered" para que el PUT recibido llegue a las nuevas reglas.
    neg_po = client.post("/api/purchase-orders", headers=owner, json={
        "supplier": "Proveedor X",
        "items": [{"material_id": low_mat["id"], "qty": 10, "unit_cost": 100}],
    }).json()
    check("neg PO marked ordered", client.put(f"/api/purchase-orders/{neg_po['id']}/status", headers=owner, json={"status": "ordered"}).status_code == 200)
    check("receive without physical_supplier rejected (422)", client.put(f"/api/purchase-orders/{neg_po['id']}/status", headers=owner, json={"status": "received"}).status_code == 422)

    neg_po2 = client.post("/api/purchase-orders", headers=owner, json={
        "supplier": "Proveedor X",
        "items": [{"material_id": low_mat["id"], "qty": 10, "unit_cost": 100}],
    }).json()
    check("neg PO2 marked ordered", client.put(f"/api/purchase-orders/{neg_po2['id']}/status", headers=owner, json={"status": "ordered"}).status_code == 200)
    check(">10% variance without reason rejected (422)", client.put(
        f"/api/purchase-orders/{neg_po2['id']}/status", headers=owner,
        json={
            "status": "received",
            "physical_supplier": "Proveedor X",
            "received_items": [{"material_id": low_mat["id"], "received_qty": 5}],
        },
    ).status_code == 422)

    check("PO marked ordered", client.put(f"/api/purchase-orders/{po['id']}/status", headers=owner, json={"status": "ordered"}).status_code == 200)
    check("receiving PO adds stock", client.put(f"/api/purchase-orders/{po['id']}/status", headers=owner, json={"status": "received", "physical_supplier": "Proveedor X"}).status_code == 200)
    stock_after_po = next(m["current_stock"] for m in client.get("/api/materials", headers=owner).json() if m["id"] == low_mat["id"])
    check("stock increased by received qty", stock_after_po == stock_before_po + 10)
    check("cannot re-receive PO", client.put(f"/api/purchase-orders/{po['id']}/status", headers=owner, json={"status": "received"}).status_code == 400)

    print("\n== Finance / P&L ==")
    pnl = client.get("/api/finance/pnl", headers=owner).json()
    check("pnl revenue > 0", pnl["revenue"] > 0)
    check("pnl has cogs", pnl["cogs"] >= 0)
    check("pnl gross_profit = revenue - cogs", pnl["gross_profit"] == round(pnl["revenue"] - pnl["cogs"], 2))
    check("pnl top_products populated", len(pnl["top_products"]) >= 1)

    client.post("/api/expenses", headers=owner, json={"category": "Renta", "description": "Renta local", "amount": 500})
    pnl2 = client.get("/api/finance/pnl", headers=owner).json()
    check("expenses reduce net profit", pnl2["net_profit"] == round(pnl2["gross_profit"] - pnl2["operating_expenses"], 2))

    daily = client.get("/api/finance/daily", headers=owner).json()
    check("daily has payment breakdown", len(daily["by_payment_method"]) >= 1)

    dash = client.get("/api/finance/dashboard", headers=owner).json()
    check("dashboard today block", "today" in dash and "month" in dash)

print(f"\n==== RESULT: {PASS} passed, {FAIL} failed ====")
raise SystemExit(1 if FAIL else 0)
