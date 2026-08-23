"""Encryption helpers for sensitive fiscal credentials (FiscalConfig.fiscalapi_api_key,
fiscalapi_tenant_key). Symmetric encryption via Fernet.

Isolated utility module only: no FiscalAPI logic, and not yet wired into any
model or endpoint. FISCAL_ENCRYPTION_KEY must come from the environment —
there is no hardcoded default, so a missing key fails loudly at import time
rather than silently storing plaintext.
"""
import os

from cryptography.fernet import Fernet

FISCAL_ENCRYPTION_KEY = os.environ.get("FISCAL_ENCRYPTION_KEY")
if not FISCAL_ENCRYPTION_KEY:
    raise RuntimeError(
        "FISCAL_ENCRYPTION_KEY no está configurada. Genera una con "
        "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"` "
        "y agrégala a las variables de entorno (ver backend/.env.example)."
    )

_fernet = Fernet(FISCAL_ENCRYPTION_KEY.encode())


def encrypt_value(plain: str) -> str:
    """Encrypt a plaintext string with Fernet. None passes through as None
    (so an empty/unset fiscal credential field doesn't need special-casing)."""
    if plain is None:
        return None
    return _fernet.encrypt(plain.encode()).decode()


def decrypt_value(token: str) -> str:
    """Decrypt a value produced by encrypt_value. None passes through as None."""
    if token is None:
        return None
    return _fernet.decrypt(token.encode()).decode()
