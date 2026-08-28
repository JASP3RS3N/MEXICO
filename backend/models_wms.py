"""Pydantic request/response models for the WMS Producción ↔ Almacén module.

Kept in its own module (instead of growing models.py) because the WMS is a
self-contained domain: solicitudes de material, surtidos, locaciones/plantas y
el snapshot de inventario que llega desde SAP en modo solo lectura.
"""
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from config import WMS_PRIORITIES, WMS_PRIORITY_NORMAL


# ---------------------------------------------------------------------------
# Locaciones / plantas
# ---------------------------------------------------------------------------
class LocationCreate(BaseModel):
    code: str  # plant_code SAP (WERKS) o "WERKS/LGORT" según SAP_LOCATION_MODE
    name: str
    active: bool = True

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if not v:
            raise ValueError("El código de locación es obligatorio")
        return v


class LocationUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    active: Optional[bool] = None

    @field_validator("code")
    @classmethod
    def _normalize_code(cls, v):
        if v is None:
            return v
        v = v.strip().upper()
        if not v:
            raise ValueError("El código de locación es obligatorio")
        return v


# ---------------------------------------------------------------------------
# Solicitudes de material (MaterialRequest)
# ---------------------------------------------------------------------------
class MaterialRequestCreate(BaseModel):
    part_number: str
    description: Optional[str] = ""  # se autocompleta del snapshot SAP si viene vacía
    quantity_requested: float
    unit_of_measure: Optional[str] = ""  # se autocompleta del snapshot SAP si viene vacía
    # Locación destino. Si se omite, se usa la del usuario que solicita.
    location_id: Optional[str] = None
    priority: str = WMS_PRIORITY_NORMAL
    notes: Optional[str] = ""

    @field_validator("part_number")
    @classmethod
    def _normalize_part(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if not v:
            raise ValueError("El número de parte es obligatorio")
        return v

    @field_validator("quantity_requested")
    @classmethod
    def _positive_qty(cls, v: float) -> float:
        if v is None or v <= 0:
            raise ValueError("La cantidad solicitada debe ser mayor a cero")
        return float(v)

    @field_validator("priority")
    @classmethod
    def _valid_priority(cls, v: str) -> str:
        v = (v or WMS_PRIORITY_NORMAL).strip().lower()
        if v not in WMS_PRIORITIES:
            raise ValueError(f"Prioridad inválida. Usa: {WMS_PRIORITIES}")
        return v


class MaterialRequestUpdate(BaseModel):
    """Edición limitada por el solicitante mientras la solicitud sigue pendiente."""

    quantity_requested: Optional[float] = None
    priority: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("quantity_requested")
    @classmethod
    def _positive_qty(cls, v):
        if v is None:
            return v
        if v <= 0:
            raise ValueError("La cantidad solicitada debe ser mayor a cero")
        return float(v)

    @field_validator("priority")
    @classmethod
    def _valid_priority(cls, v):
        if v is None:
            return v
        v = v.strip().lower()
        if v not in WMS_PRIORITIES:
            raise ValueError(f"Prioridad inválida. Usa: {WMS_PRIORITIES}")
        return v


class RequestRelease(BaseModel):
    """Liberar de vuelta a la cola una solicitud que se tomó pero no se pudo surtir."""

    reason: Optional[str] = ""


class RequestCancel(BaseModel):
    reason: Optional[str] = ""


# ---------------------------------------------------------------------------
# Surtidos (MaterialFulfillment)
# ---------------------------------------------------------------------------
class MaterialFulfillmentCreate(BaseModel):
    quantity_fulfilled: float
    # True = cerrar la solicitud con lo entregado hasta ahora (surtido parcial).
    # False = registrar la entrega y dejarla abierta para completarla después.
    close_request: bool = True
    notes: Optional[str] = ""

    @field_validator("quantity_fulfilled")
    @classmethod
    def _positive_qty(cls, v: float) -> float:
        if v is None or v <= 0:
            raise ValueError("La cantidad surtida debe ser mayor a cero")
        return float(v)


# ---------------------------------------------------------------------------
# Configuración de umbrales del semáforo (vive en settings.wms_config)
# ---------------------------------------------------------------------------
class WmsConfig(BaseModel):
    green_max_minutes: int = Field(20, ge=1)
    yellow_max_minutes: int = Field(60, ge=2)
    sla_minutes: int = Field(30, ge=1)
    sound_alert_enabled: bool = True
    poll_seconds: int = Field(8, ge=3, le=120)
    sap_sync_stale_minutes: int = Field(90, ge=5)

    @model_validator(mode="after")
    def _thresholds_in_order(self):
        if self.yellow_max_minutes <= self.green_max_minutes:
            raise ValueError("El umbral amarillo debe ser mayor al verde")
        return self
