"""Tools the AI assistant (LM Studio) can call to read and act on the system.

Each tool is described in OpenAI function-calling format (TOOLS) and executed by
``execute_tool``. Read tools summarize finances/inventory/menu; write tools create
purchase orders, take orders and adjust prices — mirroring the REST handlers so the
data stays consistent. The assistant is owner-only, so tools run with owner rights.
"""
from datetime import datetime, timedelta, timezone

from config import PO_DRAFT, db, gen_id, next_sequence, now, now_iso
from routes_finance import _aggregate, _category_map, _month_start_iso, _paid_orders
from routes_orders import _compute_totals, _get_settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _period_range(period: str):
    n = now()
    if period == "today":
        start = datetime(n.year, n.month, n.day, tzinfo=timezone.utc)
        return start.isoformat(), now_iso()
    if period == "week":
        start = (n - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        return start.isoformat(), now_iso()
    if period == "yesterday":
        y = datetime(n.year, n.month, n.day, tzinfo=timezone.utc) - timedelta(days=1)
        return y.isoformat(), (y + timedelta(days=1) - timedelta(seconds=1)).isoformat()
    return _month_start_iso(), now_iso()


async def _find_product(ref: str):
    if not ref:
        return None
    p = await db.products.find_one({"id": ref}, {"_id": 0})
    if p:
        return p
    prods = await db.products.find({}, {"_id": 0}).to_list(2000)
    ref_l = ref.lower()
    matches = [x for x in prods if ref_l in x["name"].lower()]
    return matches[0] if matches else None


async def _find_material(ref: str):
    if not ref:
        return None
    m = await db.materials.find_one({"id": ref}, {"_id": 0})
    if m:
        return m
    mats = await db.materials.find({}, {"_id": 0}).to_list(2000)
    ref_l = ref.lower()
    matches = [x for x in mats if ref_l in x["name"].lower()]
    return matches[0] if matches else None


def _money(n, cur="MXN"):
    return f"${float(n or 0):,.2f} {cur}"


# ---------------------------------------------------------------------------
# Tool schemas (OpenAI function-calling format)
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_financial_summary",
            "description": "Resumen financiero y P&L (ingresos, costo de ventas, utilidad bruta/neta, márgenes, gastos, ticket promedio) para un periodo. Úsalo para cortes financieros y estado del negocio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["today", "yesterday", "week", "month"], "description": "Periodo a analizar. Default month."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sales_report",
            "description": "Reporte de ventas: número de órdenes, venta total, productos más vendidos, ventas por categoría y por método de pago en el periodo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["today", "yesterday", "week", "month"]}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_low_stock",
            "description": "Lista de materia prima en o por debajo del stock mínimo, con cantidad sugerida de reorden y proveedor. Úsalo antes de crear órdenes de compra.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_menu",
            "description": "Lista de productos del menú con precio, costo estimado y margen. Úsalo para estudio de menú y sugerencias de precios.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_materials",
            "description": "Lista de materia prima con existencia actual, unidad, costo y proveedor.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_purchase_order",
            "description": "Crea una orden de compra (en borrador) para reabastecer materia prima. Usa nombres de insumos existentes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "supplier": {"type": "string", "description": "Nombre del proveedor (opcional)."},
                    "items": {
                        "type": "array",
                        "description": "Insumos a comprar.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "material": {"type": "string", "description": "Nombre o id de la materia prima."},
                                "qty": {"type": "number"},
                                "unit_cost": {"type": "number", "description": "Costo unitario (opcional; usa el del insumo si se omite)."},
                            },
                            "required": ["material", "qty"],
                        },
                    },
                    "notes": {"type": "string"},
                },
                "required": ["items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": "Levanta un pedido (comanda) que se envía a cocina. Usa nombres de productos del menú. Úsalo para pedidos online o telefónicos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product": {"type": "string", "description": "Nombre o id del producto."},
                                "qty": {"type": "integer"},
                                "notes": {"type": "string"},
                            },
                            "required": ["product", "qty"],
                        },
                    },
                    "customer_name": {"type": "string"},
                    "order_type": {"type": "string", "enum": ["comer_aqui", "para_llevar"]},
                },
                "required": ["items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_product_price",
            "description": "Cambia el precio de venta de un producto del menú. Confirma con el dueño antes de usarlo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product": {"type": "string", "description": "Nombre o id del producto."},
                    "new_price": {"type": "number"},
                },
                "required": ["product", "new_price"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_supplier",
            "description": "Da de alta un proveedor.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "phone": {"type": "string"},
                    "email": {"type": "string"},
                    "contact": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "upsert_material",
            "description": "Crea o actualiza una materia prima (insumo): costo, existencia, mínimo, unidad, proveedor. Si ya existe por nombre, la actualiza.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "unit": {"type": "string", "description": "kg, lt, pza, etc."},
                    "cost_per_unit": {"type": "number"},
                    "current_stock": {"type": "number"},
                    "min_stock": {"type": "number"},
                    "par_stock": {"type": "number"},
                    "supplier": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_product_bom",
            "description": "Define la receta / BOM de un producto: qué insumos y cuánto consume cada venta (para descuento de inventario y costeo).",
            "parameters": {
                "type": "object",
                "properties": {
                    "product": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"material": {"type": "string"}, "qty": {"type": "number"}},
                            "required": ["material", "qty"],
                        },
                    },
                },
                "required": ["product", "items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_product",
            "description": "Crea un producto del menú.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "price": {"type": "number"},
                    "category": {"type": "string", "description": "Nombre de la categoría (opcional)."},
                    "station": {"type": "string", "description": "cocina, ahumador, barra…"},
                    "description": {"type": "string"},
                },
                "required": ["name", "price"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cash_cut",
            "description": "Corte financiero del periodo: venta total, desglose por método de pago, EFECTIVO ESPERADO en caja, gastos y utilidad. Úsalo para el corte de caja / del día.",
            "parameters": {
                "type": "object",
                "properties": {"period": {"type": "string", "enum": ["today", "yesterday", "week", "month"]}},
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Executor
# ---------------------------------------------------------------------------
async def execute_tool(name: str, args: dict, user: dict):
    """Run a tool. Returns (result_dict, action_summary_or_None)."""
    settings = await _get_settings()
    cur = settings.get("currency", "MXN")

    if name == "get_financial_summary":
        start, end = _period_range(args.get("period", "month"))
        orders = await _paid_orders(start, end)
        agg = _aggregate(orders)
        expenses = await db.expenses.find({"date": {"$gte": start[:10], "$lte": end[:10]}}, {"_id": 0}).to_list(5000)
        opex = round(sum(float(e["amount"]) for e in expenses), 2)
        gross_profit = round(agg["net_sales"] - agg["cogs"], 2)
        net_profit = round(gross_profit - opex, 2)
        return (
            {
                "period": args.get("period", "month"),
                "ingresos_netos": agg["net_sales"],
                "venta_total_con_iva": agg["gross_sales"],
                "costo_de_ventas": agg["cogs"],
                "utilidad_bruta": gross_profit,
                "margen_bruto_pct": round(gross_profit / agg["net_sales"] * 100, 1) if agg["net_sales"] else 0,
                "gastos_operativos": opex,
                "utilidad_neta": net_profit,
                "ordenes": agg["orders"],
                "ticket_promedio": agg["avg_ticket"],
                "moneda": cur,
            },
            None,
        )

    if name == "get_sales_report":
        start, end = _period_range(args.get("period", "month"))
        orders = await _paid_orders(start, end)
        cat_map = await _category_map()
        by_cat, by_prod, by_method = {}, {}, {}
        for o in orders:
            m = o.get("payment_method", "efectivo") or "efectivo"
            by_method[m] = round(by_method.get(m, 0) + float(o.get("total", 0)), 2)
            for it in o.get("items", []):
                c = cat_map.get(it["product_id"], "Sin categoría")
                by_cat[c] = round(by_cat.get(c, 0) + float(it.get("line_total", 0)), 2)
                p = by_prod.setdefault(it["name"], {"qty": 0, "revenue": 0.0})
                p["qty"] += int(it["qty"])
                p["revenue"] = round(p["revenue"] + float(it.get("line_total", 0)), 2)
        top = sorted([{"producto": k, **v} for k, v in by_prod.items()], key=lambda x: -x["revenue"])[:10]
        return (
            {
                "period": args.get("period", "month"),
                "ordenes": len(orders),
                "venta_total": round(sum(float(o.get("total", 0)) for o in orders), 2),
                "top_productos": top,
                "ventas_por_categoria": by_cat,
                "ventas_por_metodo_pago": by_method,
                "moneda": cur,
            },
            None,
        )

    if name == "list_low_stock":
        materials = await db.materials.find({"active": True}, {"_id": 0}).to_list(2000)
        low = []
        for m in materials:
            current = float(m.get("current_stock", 0))
            minimum = float(m.get("min_stock", 0))
            if current <= minimum:
                par = float(m.get("par_stock", 0)) or minimum * 2
                low.append(
                    {
                        "insumo": m["name"],
                        "existencia": current,
                        "minimo": minimum,
                        "unidad": m["unit"],
                        "sugerido_comprar": round(max(par - current, minimum or 1), 2),
                        "proveedor": m.get("supplier", ""),
                        "costo_unitario": float(m.get("cost_per_unit", 0)),
                    }
                )
        return ({"insumos_bajo_stock": low, "total": len(low)}, None)

    if name == "list_menu":
        prods = await db.products.find({}, {"_id": 0}).to_list(2000)
        cats = {c["id"]: c["name"] for c in await db.categories.find({}, {"_id": 0}).to_list(500)}
        out = []
        for p in prods:
            price = float(p.get("price", 0))
            cost = float(p.get("cost", 0))
            out.append(
                {
                    "producto": p["name"],
                    "categoria": cats.get(p.get("category_id"), "Sin categoría"),
                    "precio": price,
                    "costo_estimado": cost,
                    "margen_pct": round((price - cost) / price * 100, 1) if price else 0,
                    "activo": p.get("active", True),
                }
            )
        return ({"menu": out, "moneda": cur}, None)

    if name == "list_materials":
        mats = await db.materials.find({}, {"_id": 0}).sort("name", 1).to_list(2000)
        out = [
            {
                "insumo": m["name"],
                "existencia": float(m.get("current_stock", 0)),
                "unidad": m["unit"],
                "costo_unitario": float(m.get("cost_per_unit", 0)),
                "minimo": float(m.get("min_stock", 0)),
                "proveedor": m.get("supplier", ""),
            }
            for m in mats
        ]
        return ({"materia_prima": out, "moneda": cur}, None)

    if name == "create_purchase_order":
        items_in = args.get("items", [])
        if not items_in:
            return ({"error": "Sin insumos"}, None)
        items, total, missing = [], 0.0, []
        for it in items_in:
            mat = await _find_material(it.get("material", ""))
            if not mat:
                missing.append(it.get("material"))
                continue
            unit_cost = float(it.get("unit_cost") if it.get("unit_cost") is not None else mat.get("cost_per_unit", 0))
            qty = float(it.get("qty", 0))
            subtotal = round(unit_cost * qty, 2)
            total += subtotal
            items.append({"material_id": mat["id"], "name": mat["name"], "unit": mat["unit"], "qty": qty, "unit_cost": unit_cost, "subtotal": subtotal})
        if not items:
            return ({"error": f"No encontré estos insumos: {missing}"}, None)
        seq = await next_sequence("purchase_order")
        doc = {
            "id": gen_id(),
            "po_number": f"OC-{seq:04d}",
            "supplier": args.get("supplier", "") or "",
            "items": items,
            "total": round(total, 2),
            "status": PO_DRAFT,
            "notes": (args.get("notes", "") or "") + " (creada por Asistente IA)",
            "expected_date": None,
            "created_by": user["id"],
            "created_by_name": user.get("name", "") + " (IA)",
            "created_at": now_iso(),
            "received_at": None,
        }
        await db.purchase_orders.insert_one(doc)
        result = {"po_number": doc["po_number"], "total": doc["total"], "items": len(items)}
        if missing:
            result["no_encontrados"] = missing
        return (result, f"Creó orden de compra {doc['po_number']} por {_money(doc['total'], cur)} ({len(items)} insumos, borrador)")

    if name == "create_order":
        items_in = args.get("items", [])
        items, gross, missing = [], 0.0, []
        for it in items_in:
            product = await _find_product(it.get("product", ""))
            if not product or not product.get("active", True):
                missing.append(it.get("product"))
                continue
            qty = max(1, int(it.get("qty", 1)))
            line_total = round(float(product["price"]) * qty, 2)
            gross += line_total
            items.append(
                {
                    "product_id": product["id"], "name": product["name"], "qty": qty,
                    "price": float(product["price"]), "line_total": line_total, "notes": it.get("notes", "") or "",
                    "station": product.get("station", "cocina"), "unit_cost": float(product.get("cost", 0) or 0),
                    "recipe": product.get("recipe", []), "item_status": "pending",
                }
            )
        if not items:
            return ({"error": f"No encontré estos productos: {missing}"}, None)
        totals = _compute_totals(gross, settings)
        seq = await next_sequence("order")
        doc = {
            "id": gen_id(), "order_number": seq, "customer_name": args.get("customer_name", "") or "",
            "table": "", "order_type": args.get("order_type", "para_llevar"), "notes": "Pedido creado por Asistente IA",
            "items": items, "subtotal": totals["subtotal"], "tax": totals["tax"], "total": totals["total"],
            "status": "pending", "paid": False, "payment_method": None,
            "created_by": user["id"], "created_by_name": user.get("name", "") + " (IA)",
            "created_at": now_iso(), "accepted_at": None, "ready_at": None, "delivered_at": None, "paid_at": None,
        }
        await db.orders.insert_one(doc)
        result = {"order_number": doc["order_number"], "total": doc["total"], "items": len(items)}
        if missing:
            result["no_encontrados"] = missing
        return (result, f"Levantó la comanda #{doc['order_number']} por {_money(doc['total'], cur)} y la envió a cocina")

    if name == "update_product_price":
        product = await _find_product(args.get("product", ""))
        if not product:
            return ({"error": f"No encontré el producto: {args.get('product')}"}, None)
        new_price = round(float(args.get("new_price", 0)), 2)
        old = float(product["price"])
        await db.products.update_one({"id": product["id"]}, {"$set": {"price": new_price}})
        return (
            {"producto": product["name"], "precio_anterior": old, "precio_nuevo": new_price},
            f"Cambió el precio de «{product['name']}» de {_money(old, cur)} a {_money(new_price, cur)}",
        )

    if name == "create_supplier":
        doc = {
            "id": gen_id(), "name": (args.get("name") or "").strip(),
            "contact": args.get("contact", ""), "phone": args.get("phone", ""),
            "email": args.get("email", ""), "notes": args.get("notes", ""),
            "active": True, "created_at": now_iso(),
        }
        if not doc["name"]:
            return ({"error": "Falta el nombre del proveedor"}, None)
        await db.suppliers.insert_one(doc)
        return ({"supplier": doc["name"], "id": doc["id"]}, f"Dio de alta al proveedor «{doc['name']}»")

    if name == "upsert_material":
        mat = await _find_material(args.get("name", ""))
        fields = {}
        for k in ("unit", "supplier"):
            if args.get(k) is not None:
                fields[k] = args[k]
        for k in ("cost_per_unit", "current_stock", "min_stock", "par_stock"):
            if args.get(k) is not None:
                fields[k] = float(args[k])
        if mat:
            fields["updated_at"] = now_iso()
            await db.materials.update_one({"id": mat["id"]}, {"$set": fields})
            return ({"insumo": mat["name"], "actualizado": True, **fields}, f"Actualizó la materia prima «{mat['name']}»")
        doc = {
            "id": gen_id(), "sku": "", "name": (args.get("name") or "").strip(),
            "unit": args.get("unit", "kg") or "kg", "category": "General",
            "cost_per_unit": float(args.get("cost_per_unit", 0) or 0),
            "current_stock": float(args.get("current_stock", 0) or 0),
            "min_stock": float(args.get("min_stock", 0) or 0),
            "par_stock": float(args.get("par_stock", 0) or 0),
            "supplier": args.get("supplier", ""), "active": True,
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        if not doc["name"]:
            return ({"error": "Falta el nombre del insumo"}, None)
        await db.materials.insert_one(doc)
        return ({"insumo": doc["name"], "creado": True}, f"Dio de alta la materia prima «{doc['name']}»")

    if name == "set_product_bom":
        product = await _find_product(args.get("product", ""))
        if not product:
            return ({"error": f"No encontré el producto: {args.get('product')}"}, None)
        recipe, cost, missing = [], 0.0, []
        for it in args.get("items", []):
            mat = await _find_material(it.get("material", ""))
            if not mat:
                missing.append(it.get("material"))
                continue
            qty = float(it.get("qty", 0))
            recipe.append({"material_id": mat["id"], "qty": qty})
            cost += float(mat.get("cost_per_unit", 0)) * qty
        if not recipe:
            return ({"error": f"No encontré estos insumos: {missing}"}, None)
        await db.products.update_one({"id": product["id"]}, {"$set": {"recipe": recipe, "cost": round(cost, 2)}})
        result = {"producto": product["name"], "insumos": len(recipe), "costo_estimado": round(cost, 2)}
        if missing:
            result["no_encontrados"] = missing
        return (result, f"Definió la receta (BOM) de «{product['name']}» con {len(recipe)} insumos")

    if name == "create_product":
        cat_id = None
        if args.get("category"):
            cat = await db.categories.find_one({"name": {"$regex": f"^{args['category']}$", "$options": "i"}}, {"_id": 0})
            cat_id = cat["id"] if cat else None
        doc = {
            "id": gen_id(), "name": (args.get("name") or "").strip(),
            "category_id": cat_id, "price": round(float(args.get("price", 0) or 0), 2),
            "description": args.get("description", ""), "station": args.get("station", "cocina") or "cocina",
            "active": True, "recipe": [], "cost": 0, "created_at": now_iso(),
        }
        if not doc["name"]:
            return ({"error": "Falta el nombre del producto"}, None)
        await db.products.insert_one(doc)
        return ({"producto": doc["name"], "precio": doc["price"]}, f"Creó el producto «{doc['name']}» a {_money(doc['price'], cur)}")

    if name == "get_cash_cut":
        start, end = _period_range(args.get("period", "today"))
        orders = await _paid_orders(start, end)
        by_method = {}
        for o in orders:
            mth = o.get("payment_method", "efectivo") or "efectivo"
            by_method[mth] = round(by_method.get(mth, 0) + float(o.get("total", 0)), 2)
        expenses = await db.expenses.find({"date": {"$gte": start[:10], "$lte": end[:10]}}, {"_id": 0}).to_list(5000)
        opex = round(sum(float(e["amount"]) for e in expenses), 2)
        agg = _aggregate(orders)
        return (
            {
                "period": args.get("period", "today"),
                "venta_total": agg["gross_sales"],
                "ordenes": agg["orders"],
                "por_metodo_pago": by_method,
                "efectivo_esperado_en_caja": by_method.get("efectivo", 0),
                "gastos": opex,
                "utilidad_neta_aprox": round(agg["net_sales"] - agg["cogs"] - opex, 2),
                "moneda": cur,
                "nota": "Efectivo esperado = suma de órdenes pagadas en efectivo. Compáralo con el conteo físico de caja.",
            },
            None,
        )

    return ({"error": f"Herramienta desconocida: {name}"}, None)
