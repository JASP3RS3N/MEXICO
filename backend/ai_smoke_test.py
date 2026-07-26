"""Tests the AI layer without a live LM Studio.

- execute_tool against seeded data (read + write tools).
- /ai/status and /ai/chat degrade gracefully when LM Studio is unreachable.
- owner-only access enforced.
Run: python3 ai_smoke_test.py
"""
import asyncio
import os

os.environ["AI_ENABLED"] = "true"
os.environ["LMSTUDIO_BASE_URL"] = "http://127.0.0.1:9/v1"  # unreachable on purpose

import mongomock_motor
import motor.motor_asyncio

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402
from ai_tools import execute_tool  # noqa: E402
from config import db  # noqa: E402

client = TestClient(server.app)
PASS, FAIL = 0, 0


def check(label, cond):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label}")


def auth(u, p):
    r = client.post("/api/auth/login", json={"username": u, "password": p})
    return {"Authorization": f"Bearer {r.json()['token']}"}


with client:  # startup seeds data
    owner_headers = auth("dueno", "dueno123")
    cashier_headers = auth("caja", "caja123")
    owner = asyncio.get_event_loop().run_until_complete(db.users.find_one({"username": "dueno"}, {"_id": 0}))

    print("\n== Access control ==")
    check("cashier blocked from /ai/status (403)", client.get("/api/ai/status", headers=cashier_headers).status_code == 403)
    check("cashier blocked from /ai/chat (403)", client.post("/api/ai/chat", headers=cashier_headers, json={"messages": []}).status_code == 403)

    print("\n== Graceful degradation (no LM Studio) ==")
    st = client.get("/api/ai/status", headers=owner_headers).json()
    check("status enabled=true", st.get("enabled") is True)
    check("status connected=false (unreachable)", st.get("connected") is False)
    r = client.post("/api/ai/chat", headers=owner_headers, json={"messages": [{"role": "user", "content": "hola"}]})
    check("chat returns 503 when LM Studio down", r.status_code == 503)

    print("\n== Tool executor (read) ==")
    loop = asyncio.get_event_loop()

    def run(name, args):
        return loop.run_until_complete(execute_tool(name, args, owner))

    res, _ = run("get_financial_summary", {"period": "month"})
    check("financial_summary has utilidad_neta", "utilidad_neta" in res)
    res, _ = run("get_sales_report", {"period": "month"})
    check("sales_report has top_productos", "top_productos" in res)
    res, _ = run("list_low_stock", {})
    check("low_stock returns structure", "insumos_bajo_stock" in res)
    res, _ = run("list_menu", {})
    check("menu lists products", len(res["menu"]) >= 8)
    res, _ = run("list_materials", {})
    check("materials listed", len(res["materia_prima"]) >= 10)

    print("\n== Tool executor (write) ==")
    res, summary = run("create_purchase_order", {"supplier": "Proveedor IA", "items": [{"material": "Brisket", "qty": 10, "unit_cost": 200}]})
    check("create_purchase_order returns po_number", res.get("po_number", "").startswith("OC-"))
    check("PO action summary present", bool(summary))
    po = loop.run_until_complete(db.purchase_orders.find_one({"po_number": res["po_number"]}, {"_id": 0}))
    check("PO persisted as draft", po and po["status"] == "draft")

    res, summary = run("create_order", {"items": [{"product": "Brisket", "qty": 2}], "customer_name": "Cliente IA", "order_type": "para_llevar"})
    check("create_order returns order_number", isinstance(res.get("order_number"), int))
    check("order action summary present", bool(summary))
    order = loop.run_until_complete(db.orders.find_one({"order_number": res["order_number"]}, {"_id": 0}))
    check("order persisted, pending, unpaid", order and order["status"] == "pending" and order["paid"] is False)
    check("order visible in kitchen queue", any(o["order_number"] == res["order_number"] for o in client.get("/api/kitchen", headers=owner_headers).json()))

    res, summary = run("update_product_price", {"product": "Refresco", "new_price": 40})
    check("update_price returns new price", res.get("precio_nuevo") == 40)
    prod = loop.run_until_complete(db.products.find_one({"name": "Refresco"}, {"_id": 0}))
    check("price persisted", prod and prod["price"] == 40)

    res, _ = run("create_order", {"items": [{"product": "NoExiste ABC", "qty": 1}]})
    check("unknown product handled gracefully", "error" in res)

print(f"\n==== RESULT: {PASS} passed, {FAIL} failed ====")
raise SystemExit(1 if FAIL else 0)
