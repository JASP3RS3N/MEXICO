"""Suppliers (proveedores) and Employees (empleados con altas/bajas + historial)."""
from fastapi import APIRouter, Depends, HTTPException

from config import clean, db, gen_id, now_iso, tenant_query
from models import (
    EmployeeCreate,
    EmployeeTerminate,
    EmployeeUpdate,
    SupplierCreate,
    SupplierUpdate,
)
from security import get_tenant_id, require_owner, require_roles

router = APIRouter()


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------
@router.get("/suppliers")
async def list_suppliers(user: dict = Depends(require_roles("owner", "prep"))):
    tenant_id = get_tenant_id(user)
    return await db.suppliers.find(tenant_query(tenant_id), {"_id": 0}).sort("name", 1).to_list(1000)


@router.post("/suppliers")
async def create_supplier(payload: SupplierCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "name": payload.name.strip(),
        "contact": payload.contact or "",
        "phone": payload.phone or "",
        "email": payload.email or "",
        "notes": payload.notes or "",
        "rfc": payload.rfc or "",
        "razon_social": payload.razon_social or "",
        "regimen_fiscal": payload.regimen_fiscal or "",
        "codigo_postal_fiscal": payload.codigo_postal_fiscal or "",
        "active": payload.active,
        "created_at": now_iso(),
    }
    await db.suppliers.insert_one(doc)
    return clean(doc)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, payload: SupplierUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    res = await db.suppliers.update_one(tenant_query(tenant_id, {"id": supplier_id}), {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return await db.suppliers.find_one(tenant_query(tenant_id, {"id": supplier_id}), {"_id": 0})


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    await db.suppliers.delete_one(tenant_query(tenant_id, {"id": supplier_id}))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Employees — "baja" keeps history (never hard-deleted by default)
# ---------------------------------------------------------------------------
@router.get("/employees")
async def list_employees(status: str = None, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    extra = {"status": status} if status in ("active", "inactive") else {}
    # ine_photo is heavy + sensitive: never travels in the listing (fetch it per-employee).
    return await db.employees.find(
        tenant_query(tenant_id, extra), {"_id": 0, "ine_photo": 0}
    ).sort("created_at", -1).to_list(2000)


@router.post("/employees")
async def create_employee(payload: EmployeeCreate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    doc = {
        "id": gen_id(),
        "tenant_id": tenant_id,
        "name": payload.name.strip(),
        "position": payload.position or "",
        "phone": payload.phone or "",
        "email": payload.email or "",
        "wage": float(payload.wage or 0),
        "notes": payload.notes or "",
        "ine_photo": payload.ine_photo,
        "hire_date": payload.hire_date or now_iso()[:10],
        "termination_date": None,
        "termination_reason": None,
        "status": "active",
        "created_at": now_iso(),
    }
    await db.employees.insert_one(doc)
    return clean(doc)


@router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, payload: EmployeeUpdate, user: dict = Depends(require_owner)):
    tenant_id = get_tenant_id(user)
    data = payload.model_dump(exclude_unset=True)
    remove_photo = data.pop("remove_ine_photo", False)  # control flag, not a stored field
    updates = {k: v for k, v in data.items() if v is not None}
    if remove_photo:
        updates["ine_photo"] = None  # takes priority over any new ine_photo in the same payload
    res = await db.employees.update_one(tenant_query(tenant_id, {"id": employee_id}), {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return await db.employees.find_one(tenant_query(tenant_id, {"id": employee_id}), {"_id": 0})


@router.get("/employees/{employee_id}/ine-photo")
async def get_employee_ine_photo(employee_id: str, user: dict = Depends(require_owner)):
    """Return the employee's INE photo on demand (owner only, tenant-scoped)."""
    tenant_id = get_tenant_id(user)
    emp = await db.employees.find_one(
        tenant_query(tenant_id, {"id": employee_id}), {"_id": 0, "ine_photo": 1}
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return {"ine_photo": emp.get("ine_photo")}


@router.post("/employees/{employee_id}/terminate")
async def terminate_employee(employee_id: str, payload: EmployeeTerminate, user: dict = Depends(require_owner)):
    """Baja: marca inactivo y guarda la fecha; conserva el registro histórico."""
    tenant_id = get_tenant_id(user)
    emp = await db.employees.find_one(tenant_query(tenant_id, {"id": employee_id}))
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    await db.employees.update_one(
        tenant_query(tenant_id, {"id": employee_id}),
        {"$set": {
            "status": "inactive",
            "termination_date": payload.termination_date or now_iso()[:10],
            "termination_reason": payload.reason or "",
        }},
    )
    return await db.employees.find_one(tenant_query(tenant_id, {"id": employee_id}), {"_id": 0})


@router.post("/employees/{employee_id}/reactivate")
async def reactivate_employee(employee_id: str, user: dict = Depends(require_owner)):
    """Recontratación: reactiva conservando el historial previo."""
    tenant_id = get_tenant_id(user)
    emp = await db.employees.find_one(tenant_query(tenant_id, {"id": employee_id}))
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    await db.employees.update_one(
        tenant_query(tenant_id, {"id": employee_id}),
        {"$set": {"status": "active", "termination_date": None, "termination_reason": None, "rehire_date": now_iso()[:10]}},
    )
    return await db.employees.find_one(tenant_query(tenant_id, {"id": employee_id}), {"_id": 0})
