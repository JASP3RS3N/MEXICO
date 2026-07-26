"""AI assistant routes — talks to a local LM Studio (OpenAI-compatible) server.

Owner-only. The endpoint runs an agentic loop: it sends the conversation + tool
definitions to LM Studio, executes any tool calls against the system, and returns
the final answer plus a log of actions taken. The LM Studio base URL is configurable
so it can point at a Tailscale address (e.g. http://100.x.x.x:1234/v1).
"""
import json
import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ai_tools import TOOLS, execute_tool
from security import require_owner

logger = logging.getLogger("smokehouse.ai")
router = APIRouter()

AI_ENABLED = os.environ.get("AI_ENABLED", "true").lower() == "true"
LMSTUDIO_BASE_URL = os.environ.get("LMSTUDIO_BASE_URL", "http://host.docker.internal:1234/v1").rstrip("/")
LMSTUDIO_MODEL = os.environ.get("LMSTUDIO_MODEL", "").strip()
LMSTUDIO_API_KEY = os.environ.get("LMSTUDIO_API_KEY", "lm-studio")
MAX_TOOL_ROUNDS = int(os.environ.get("AI_MAX_TOOL_ROUNDS", "6"))
REQUEST_TIMEOUT = float(os.environ.get("AI_TIMEOUT", "180"))

SYSTEM_PROMPT = (
    "Eres el asistente de negocio de un restaurante smokehouse, exclusivo para el dueño. "
    "Respondes SIEMPRE en español, claro y conciso, con cifras concretas. "
    "Tienes herramientas para consultar finanzas y ventas, revisar inventario y menú, "
    "crear órdenes de compra, levantar pedidos y ajustar precios. "
    "Usa las herramientas para obtener datos reales antes de responder; no inventes números. "
    "Cuando el dueño te pida crear una orden de compra, levantar un pedido o cambiar un precio, "
    "hazlo con la herramienta correspondiente y confirma con un resumen de lo realizado. "
    "Para acciones grandes, costosas o ambiguas, confirma primero con una pregunta breve. "
    "Al analizar el menú o las finanzas, ofrece recomendaciones accionables (precios, márgenes, reorden, ahorro)."
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


async def _resolve_model(client: httpx.AsyncClient) -> str:
    if LMSTUDIO_MODEL:
        return LMSTUDIO_MODEL
    r = await client.get(f"{LMSTUDIO_BASE_URL}/models", headers={"Authorization": f"Bearer {LMSTUDIO_API_KEY}"})
    r.raise_for_status()
    data = r.json().get("data", [])
    if not data:
        raise HTTPException(status_code=503, detail="LM Studio no tiene ningún modelo cargado.")
    return data[0]["id"]


@router.get("/ai/status")
async def ai_status(user: dict = Depends(require_owner)):
    if not AI_ENABLED:
        return {"enabled": False, "connected": False, "detail": "IA deshabilitada (AI_ENABLED=false)."}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{LMSTUDIO_BASE_URL}/models", headers={"Authorization": f"Bearer {LMSTUDIO_API_KEY}"})
            r.raise_for_status()
            models = [m["id"] for m in r.json().get("data", [])]
        return {"enabled": True, "connected": True, "base_url": LMSTUDIO_BASE_URL, "models": models, "model": LMSTUDIO_MODEL or (models[0] if models else None)}
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
    headers = {"Authorization": f"Bearer {LMSTUDIO_API_KEY}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            model = await _resolve_model(client)

            for _ in range(MAX_TOOL_ROUNDS):
                body = {
                    "model": model,
                    "messages": messages,
                    "tools": TOOLS,
                    "tool_choice": "auto",
                    "temperature": 0.3,
                }
                resp = await client.post(f"{LMSTUDIO_BASE_URL}/chat/completions", headers=headers, json=body)
                resp.raise_for_status()
                choice = resp.json()["choices"][0]
                msg = choice["message"]
                tool_calls = msg.get("tool_calls") or []

                if not tool_calls:
                    return {"reply": msg.get("content", "") or "", "actions": actions}

                # Record the assistant's tool-call turn, then execute each call.
                messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": tool_calls})
                for call in tool_calls:
                    fn = call.get("function", {})
                    name = fn.get("name", "")
                    try:
                        args = json.loads(fn.get("arguments") or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    try:
                        result, summary = await execute_tool(name, args, user)
                    except Exception as exc:  # noqa: BLE001
                        logger.exception("Error en herramienta %s", name)
                        result, summary = {"error": str(exc)}, None
                    if summary:
                        actions.append(summary)
                    messages.append(
                        {"role": "tool", "tool_call_id": call.get("id", ""), "name": name, "content": json.dumps(result, ensure_ascii=False)}
                    )

            # Ran out of rounds — ask the model for a final answer without tools.
            body = {"model": model, "messages": messages, "temperature": 0.3}
            resp = await client.post(f"{LMSTUDIO_BASE_URL}/chat/completions", headers=headers, json=body)
            resp.raise_for_status()
            final = resp.json()["choices"][0]["message"].get("content", "")
            return {"reply": final or "Listo.", "actions": actions}

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LM Studio respondió con error: {exc.response.status_code}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a LM Studio ({LMSTUDIO_BASE_URL}). Verifica que esté encendido y accesible por Tailscale. Detalle: {exc}")
