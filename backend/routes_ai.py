"""AI assistant routes — talks to a local LM Studio (OpenAI-compatible) server.

Owner-only. The endpoint runs an agentic loop: it sends the conversation + tool
definitions to LM Studio, executes any tool calls against the system, and returns
the final answer plus a log of actions taken. The LM Studio base URL is configurable
so it can point at a Tailscale address (e.g. http://100.x.x.x:1234/v1).

Robust to models that emit tool calls as plain text (e.g. Qwen/coder variants)
instead of the structured ``tool_calls`` field — those are parsed and executed too.
"""
import json
import logging
import os
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ai_tools import TOOLS, execute_tool
from config import db, now, now_iso
from security import require_owner

logger = logging.getLogger("smokehouse.ai")
router = APIRouter()

AI_ENABLED = os.environ.get("AI_ENABLED", "true").lower() == "true"
LMSTUDIO_BASE_URL = os.environ.get("LMSTUDIO_BASE_URL", "http://host.docker.internal:1234/v1").rstrip("/")
LMSTUDIO_MODEL = os.environ.get("LMSTUDIO_MODEL", "").strip()
LMSTUDIO_API_KEY = os.environ.get("LMSTUDIO_API_KEY", "lm-studio")
MAX_TOOL_ROUNDS = int(os.environ.get("AI_MAX_TOOL_ROUNDS", "6"))
REQUEST_TIMEOUT = float(os.environ.get("AI_TIMEOUT", "180"))

KNOWN_TOOLS = {t["function"]["name"] for t in TOOLS}
WRITE_TOOLS = {
    "create_purchase_order", "create_order", "update_product_price",
    "create_supplier", "upsert_material", "set_product_bom", "create_product",
    "create_menu_recipe",
}


def _fallback_reply(actions: list) -> str:
    if actions:
        return "Listo. Esto es lo que hice:\n- " + "\n- ".join(actions)
    return (
        "Ya consulté la información, pero el modelo no generó un resumen en texto. "
        "Vuelve a intentarlo, o carga un modelo *instruct* (p. ej. Qwen2.5-7B-Instruct o "
        "Llama-3.1-8B-Instruct), que conversa mucho mejor que los modelos 'coder'."
    )

SYSTEM_PROMPT = (
    "Eres el asistente de negocio de un restaurante smokehouse, exclusivo para el dueño. "
    "Respondes SIEMPRE en español, claro y conciso, con cifras concretas. "
    "Tienes herramientas para consultar finanzas y ventas, revisar inventario y menú, "
    "crear órdenes de compra, levantar pedidos, ajustar precios, dar de alta proveedores e "
    "insumos (materia prima con costos), definir recetas (BOM), crear platillos nuevos en el "
    "menú con su receta, y hacer cortes de caja. "
    "Usa las herramientas para obtener datos reales antes de responder; no inventes números. "
    "Cuando el dueño te pida crear una orden de compra, levantar un pedido o cambiar un precio, "
    "hazlo con la herramienta correspondiente y confirma con un resumen de lo realizado. "
    "Para acciones grandes, costosas o ambiguas, confirma primero con una pregunta breve. "
    "Cuando ya tengas el resultado de una herramienta, responde en prosa al dueño; no vuelvas a "
    "escribir la llamada de la herramienta ni muestres JSON. "
    "Al analizar el menú o las finanzas, ofrece recomendaciones accionables (precios, márgenes, reorden, ahorro)."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


# ---------------------------------------------------------------------------
# Tool-call extraction (native OR text-emitted)
# ---------------------------------------------------------------------------
def _first_json_object(text: str):
    """Return the first balanced {...} substring (tolerates trailing junk/extra braces)."""
    start = text.find("{")
    if start == -1:
        return None
    depth, in_str, esc = 0, False, False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    return None


def _parse_text_tool_calls(content: str):
    """Parse tool calls a model wrote as text (``<tool_call>``, code fences, or raw JSON)."""
    if not content:
        return []
    candidates = re.findall(r"<tool_call>\s*(.*?)\s*</tool_call>", content, re.DOTALL)
    if not candidates:
        candidates = re.findall(r"```(?:json|tool_call)?\s*(.*?)```", content, re.DOTALL)
    if not candidates:
        candidates = [content]

    calls = []
    for c in candidates:
        obj_str = _first_json_object(c)
        if not obj_str:
            continue
        try:
            obj = json.loads(obj_str)
        except json.JSONDecodeError:
            continue
        name = obj.get("name") or obj.get("tool") or obj.get("function")
        if name not in KNOWN_TOOLS:
            continue
        args = obj.get("arguments", obj.get("parameters", {}))
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except json.JSONDecodeError:
                args = {}
        calls.append({"name": name, "arguments": args or {}})
    return calls


def _normalize_calls(msg: dict):
    """Return (calls, is_native). Native uses tool_calls; else parse from content text."""
    native = msg.get("tool_calls") or []
    if native:
        out = []
        for c in native:
            fn = c.get("function", {})
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            out.append({"id": c.get("id", ""), "name": fn.get("name", ""), "arguments": args})
        return out, True
    return _parse_text_tool_calls(msg.get("content") or ""), False


async def _resolve_model(client: httpx.AsyncClient) -> str:
    if LMSTUDIO_MODEL:
        return LMSTUDIO_MODEL
    r = await client.get(f"{LMSTUDIO_BASE_URL}/models", headers={"Authorization": f"Bearer {LMSTUDIO_API_KEY}"})
    r.raise_for_status()
    data = r.json().get("data", [])
    if not data:
        raise HTTPException(status_code=503, detail="LM Studio no tiene ningún modelo cargado.")
    return data[0]["id"]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/ai/status")
async def ai_status(user: dict = Depends(require_owner)):
    if not AI_ENABLED:
        return {"enabled": False, "connected": False, "detail": "IA deshabilitada (AI_ENABLED=false)."}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{LMSTUDIO_BASE_URL}/models", headers={"Authorization": f"Bearer {LMSTUDIO_API_KEY}"})
            r.raise_for_status()
            models = [m["id"] for m in r.json().get("data", [])]
        return {"enabled": True, "connected": True, "base_url": LMSTUDIO_BASE_URL, "models": models, "model": LMSTUDIO_MODEL or (models[0] if models else None), "build": "ai-3-textparse"}
    except Exception as exc:  # noqa: BLE001
        return {"enabled": True, "connected": False, "base_url": LMSTUDIO_BASE_URL, "detail": f"No se pudo conectar a LM Studio: {exc}"}


@router.post("/ai/chat")
async def ai_chat(payload: ChatRequest, user: dict = Depends(require_owner)):
    if not AI_ENABLED:
        raise HTTPException(status_code=503, detail="La IA está deshabilitada.")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in payload.messages:
        if m.role in ("user", "assistant"):
            messages.append({"role": m.role, "content": m.content})

    actions = []
    executed = {}  # signature -> result, so repeated write calls don't run twice
    headers = {"Authorization": f"Bearer {LMSTUDIO_API_KEY}", "Content-Type": "application/json"}
    send_tools = True  # after a text-mode tool round we drop tools to force a prose answer

    async def _complete(client, with_tools):
        b = {"model": model, "messages": messages, "temperature": 0.3}
        if with_tools:
            b["tools"] = TOOLS
            b["tool_choice"] = "auto"
        r = await client.post(f"{LMSTUDIO_BASE_URL}/chat/completions", headers=headers, json=b)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            model = await _resolve_model(client)

            for _ in range(MAX_TOOL_ROUNDS):
                msg = await _complete(client, send_tools)
                calls, is_native = _normalize_calls(msg) if send_tools else ([], False)

                if not calls:
                    # A real answer. If a stubborn model still handed back tool JSON, hide it.
                    content = (msg.get("content") or "").strip()
                    if _parse_text_tool_calls(content):
                        content = _fallback_reply(actions)
                    return {"reply": content or _fallback_reply(actions), "actions": actions}

                messages.append(
                    {"role": "assistant", "content": msg.get("content") or "", **({"tool_calls": msg["tool_calls"]} if is_native else {})}
                )

                for c in calls:
                    sig = c["name"] + "|" + json.dumps(c["arguments"], sort_keys=True, ensure_ascii=False)
                    if c["name"] in WRITE_TOOLS and sig in executed:
                        result, summary = executed[sig], None  # don't repeat side effects
                    else:
                        try:
                            result, summary = await execute_tool(c["name"], c["arguments"], user)
                        except Exception as exc:  # noqa: BLE001
                            logger.exception("Error en herramienta %s", c["name"])
                            result, summary = {"error": str(exc)}, None
                        executed[sig] = result
                        if summary:
                            actions.append(summary)
                    payload_json = json.dumps(result, ensure_ascii=False)
                    if is_native:
                        messages.append({"role": "tool", "tool_call_id": c.get("id", ""), "name": c["name"], "content": payload_json})
                    else:
                        messages.append({
                            "role": "user",
                            "content": (
                                f"[Resultado de la herramienta {c['name']}]:\n{payload_json}\n\n"
                                "Ahora responde al dueño en español con un resumen claro usando estos datos. "
                                "No vuelvas a escribir ninguna llamada de herramienta ni JSON."
                            ),
                        })

                # Native models can keep looping with tools; text-mode models get one clean
                # prose pass without tools to stop them repeating raw JSON.
                send_tools = is_native

            # Out of rounds — force a final answer without tools.
            final = (await _complete(client, with_tools=False)).get("content", "") or ""
            if _parse_text_tool_calls(final) or not final.strip():
                final = _fallback_reply(actions)
            return {"reply": final.strip(), "actions": actions}

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LM Studio respondió con error: {exc.response.status_code}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a LM Studio ({LMSTUDIO_BASE_URL}). Verifica que esté encendido y accesible por Tailscale. Detalle: {exc}")


# ---------------------------------------------------------------------------
# Recipe suggestions from current ingredients (monthly + on-demand)
# ---------------------------------------------------------------------------
RECIPE_SYSTEM = (
    "Eres el chef asesor de un restaurante smokehouse. Propones recetas/platillos "
    "aprovechando la materia prima disponible, en español, prácticos y rentables."
)


async def _plain_completion(messages, temperature=0.6):
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        model = await _resolve_model(client)
        headers = {"Authorization": f"Bearer {LMSTUDIO_API_KEY}", "Content-Type": "application/json"}
        resp = await client.post(
            f"{LMSTUDIO_BASE_URL}/chat/completions",
            headers=headers,
            json={"model": model, "messages": messages, "temperature": temperature},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"].get("content", "") or ""


@router.get("/ai/recipe-suggestions")
async def get_recipe_suggestions(user: dict = Depends(require_owner)):
    doc = await db.ai_suggestions.find_one({"id": "recipe_suggestions"}, {"_id": 0})
    return {"current_month": now().strftime("%Y-%m"), "suggestion": doc}


@router.post("/ai/recipe-suggestions")
async def generate_recipe_suggestions(user: dict = Depends(require_owner)):
    if not AI_ENABLED:
        raise HTTPException(status_code=503, detail="La IA está deshabilitada.")
    materials = await db.materials.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(2000)
    if not materials:
        raise HTTPException(status_code=400, detail="No hay materia prima registrada para sugerir recetas.")

    lines = [
        f"- {m['name']}: {m.get('current_stock', 0)} {m.get('unit', '')} en existencia, "
        f"costo {m.get('cost_per_unit', 0)}/{m.get('unit', 'u')}"
        for m in materials
    ]
    prompt = (
        "Insumos disponibles en el inventario:\n" + "\n".join(lines) +
        "\n\nPropón 5 platillos/recetas que se puedan preparar principalmente con estos insumos "
        "para un smokehouse. Para cada uno incluye: nombre, ingredientes usados (del inventario), "
        "preparación breve, costo estimado por porción y precio de venta sugerido con buen margen. "
        "Responde en español, en lista clara y accionable."
    )
    messages = [{"role": "system", "content": RECIPE_SYSTEM}, {"role": "user", "content": prompt}]
    try:
        content = await _plain_completion(messages)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LM Studio respondió con error: {exc.response.status_code}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a LM Studio ({LMSTUDIO_BASE_URL}). Detalle: {exc}")

    doc = {"id": "recipe_suggestions", "month": now().strftime("%Y-%m"), "content": content.strip(), "created_at": now_iso()}
    await db.ai_suggestions.update_one({"id": "recipe_suggestions"}, {"$set": doc}, upsert=True)
    return {"current_month": doc["month"], "suggestion": {k: v for k, v in doc.items() if k != "_id"}}


# ---------------------------------------------------------------------------
# Sale price suggestions (on-demand, owner)
# ---------------------------------------------------------------------------
PRICE_SYSTEM = (
    "Eres analista de precios de un restaurante smokehouse. Sugieres precios de venta "
    "rentables (food cost objetivo ~25-35%) sin alejarte demasiado del precio actual, en español."
)


@router.post("/ai/price-suggestions")
async def price_suggestions(user: dict = Depends(require_owner)):
    if not AI_ENABLED:
        raise HTTPException(status_code=503, detail="La IA está deshabilitada.")
    products = await db.products.find({"active": True}, {"_id": 0}).to_list(2000)
    if not products:
        raise HTTPException(status_code=400, detail="No hay productos para analizar.")

    lines = [
        f"- {p['name']}: precio actual {p.get('price', 0)}, costo estimado {p.get('cost', 0)}"
        for p in products
    ]
    prompt = (
        "Productos del menú (precio actual y costo estimado):\n" + "\n".join(lines) +
        "\n\nSugiere un precio de venta óptimo para cada producto buscando un food cost sano "
        "(aprox 25-35%) y buen margen, sin alejarte demasiado del precio actual. Para cada uno indica: "
        "nombre, precio actual, precio sugerido y una razón breve (1 línea). Responde en español, en lista."
    )
    messages = [{"role": "system", "content": PRICE_SYSTEM}, {"role": "user", "content": prompt}]
    try:
        content = await _plain_completion(messages, temperature=0.4)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LM Studio respondió con error: {exc.response.status_code}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a LM Studio ({LMSTUDIO_BASE_URL}). Detalle: {exc}")
    return {"content": content.strip()}
