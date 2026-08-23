"""FiscalAPI (CFDI 4.0) HTTP client: pure functions that build and send the
stamping/cancellation requests. No FastAPI routes here, and nothing in this
module is called from any router yet — it's an isolated service layer meant
to be wired in later.

Credentials on FiscalConfig (fiscalapi_api_key, fiscalapi_tenant_key) are
expected to already be encrypted (see crypto_utils.py) — they're decrypted
here, right before use, and never logged or returned.

NOTE — placeholders that need confirming against the real FiscalAPI contract:
this module was written from a spec handed over in chat, not from anything
verifiable in this repo (no Postman collection or SDK reference exists in
git history). The header names (X-API-KEY, X-TENANT-KEY, X-TIME-ZONE) and the
DELETE-without-/cancel cancellation endpoint were given explicitly and are
used as specified. Everything else needed to fill out the invoice payload but
NOT given explicitly (FISCAL_TIME_ZONE value, DEFAULT_SERIES, the
payment-form/payment-method code mapping) is a reasonable guess, called out
inline — confirm these against the real FiscalAPI docs before this is wired
to a live endpoint.
"""
from datetime import datetime, timezone

import httpx

from crypto_utils import decrypt_value

# --- Placeholders (not given in the spec — confirm before going live) ------
FISCAL_TIME_ZONE = "America/Mexico_City"  # guess: only sensible default for a MX-only app
DEFAULT_SERIES = "A"  # guess: no series catalog/setting exists yet
DEFAULT_PAYMENT_METHOD_CODE = "PUE"  # guess: SAT c_MetodoPago, "pago en una sola exhibición"

# SAT c_FormaPago, mapped from our own payment_method strings (routes_orders.py /
# orders_service.py). "99" (Por definir) is the fallback for anything unmapped.
_PAYMENT_FORM_CODES = {
    "efectivo": "01",
    "tarjeta": "04",
    "transferencia": "03",
}


def _get_base_url(environment: str) -> str:
    if environment == "test":
        return "https://test.fiscalapi.com/api/v4"
    if environment == "production":
        return "https://live.fiscalapi.com/api/v4"
    raise ValueError(f"Ambiente FiscalAPI inválido: {environment!r} (usa 'test' o 'production')")


def _headers(fiscal_config) -> dict:
    """Auth headers for FiscalAPI. Decrypts the stored (encrypted) credentials
    right before use — the plaintext never lives longer than this call."""
    return {
        "X-API-KEY": decrypt_value(fiscal_config.fiscalapi_api_key),
        "X-TENANT-KEY": decrypt_value(fiscal_config.fiscalapi_tenant_key),
        "X-TIME-ZONE": FISCAL_TIME_ZONE,
        "Content-Type": "application/json",
    }


def _payment_form_code(order: dict) -> str:
    return _PAYMENT_FORM_CODES.get(order.get("payment_method"), "99")


def _build_invoice_items(order: dict) -> list:
    """Line items from the order, by reference only: FiscalAPI already holds
    the product's fiscal data (name, price, taxes) tied to fiscal_item_id from
    when the product was registered there, so we just point at it + quantity —
    nothing else. Callers must ensure every item has a fiscal_item_id first
    (see create_invoice)."""
    return [{"id": it.get("fiscal_item_id"), "quantity": it.get("qty", 1)} for it in order.get("items", [])]


def _build_invoice_payload(fiscal_config, order: dict, recipient_type: str) -> dict:
    now = datetime.now(timezone.utc)
    payload = {
        "versionCode": "4.0",
        "series": DEFAULT_SERIES,
        "date": now.isoformat(),
        "paymentFormCode": _payment_form_code(order),
        "paymentMethodCode": DEFAULT_PAYMENT_METHOD_CODE,
        "currencyCode": "MXN",
        "typeCode": "I",
        "expeditionZipCode": fiscal_config.expedition_zip_code,
        "exchangeRate": 1,
        "exportCode": "01",
        "issuer": {"id": fiscal_config.issuer_person_id},
        "items": _build_invoice_items(order),
    }
    if recipient_type == "generic":
        payload["recipient"] = {"id": fiscal_config.generic_recipient_id}
        payload["globalInformation"] = {
            "periodicityCode": "04",
            "monthCode": f"{now.month:02d}",
            "year": str(now.year),
        }
    else:
        # Specific recipient: no dedicated field/model exists yet for a
        # customer's own fiscal id, so this reads whatever the caller
        # attached to the order under "recipient_id" (not modeled today).
        payload["recipient"] = {"id": order.get("recipient_id")}
    return payload


async def create_invoice(fiscal_config, order: dict, recipient_type: str = "generic") -> dict:
    """Stamp a CFDI 4.0 for the given order (POST {base_url}/invoices).

    Returns the FiscalAPI response JSON as-is, unmodified. Network/connection
    failures (timeouts, DNS, refused connections) are NOT caught — they
    propagate to the caller. Only a response that FiscalAPI actually sent but
    that isn't valid JSON is wrapped as {"error": ...} instead of raising.

    Fails fast, without calling FiscalAPI, if any order item is missing
    fiscal_item_id — items are sent to FiscalAPI by reference only, so a
    missing id would otherwise mean stamping a CFDI with no product on it.
    """
    for it in order.get("items", []):
        if not it.get("fiscal_item_id"):
            return {"error": f"El producto '{it.get('name', '')}' no tiene fiscal_item_id configurado en FiscalAPI"}

    base_url = _get_base_url(fiscal_config.fiscalapi_environment)
    headers = _headers(fiscal_config)
    payload = _build_invoice_payload(fiscal_config, order, recipient_type)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{base_url}/invoices", headers=headers, json=payload)
    try:
        return response.json()
    except ValueError:
        return {"error": f"FiscalAPI regresó una respuesta no-JSON (status {response.status_code}): {response.text[:500]}"}


async def cancel_invoice(fiscal_config, fiscalapi_invoice_id: str, cancellation_reason_code: str = "02") -> dict:
    """Cancel a previously stamped CFDI (DELETE {base_url}/invoices, per the
    official SDK — no /cancel suffix, the invoice id + reason go in the body).

    Same error-handling contract as create_invoice: network failures
    propagate, a non-JSON response comes back as {"error": ...}.
    """
    base_url = _get_base_url(fiscal_config.fiscalapi_environment)
    headers = _headers(fiscal_config)
    body = {"id": fiscalapi_invoice_id, "cancellationReasonCode": cancellation_reason_code}

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.request("DELETE", f"{base_url}/invoices", headers=headers, json=body)
    try:
        return response.json()
    except ValueError:
        return {"error": f"FiscalAPI regresó una respuesta no-JSON (status {response.status_code}): {response.text[:500]}"}
