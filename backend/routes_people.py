"""Suppliers (proveedores) and Employees (empleados con altas/bajas + historial)."""
from fastapi import APIRouter, Depends, HTTPException

from config import clean, db, gen_id, now_iso
from models import (
    EmployeeCreate,
    EmployeeTerminate,
    EmployeeUpdate,
    SupplierCreate,
    SupplierUpdate,
)
from security import require_owner, require_roles

router = APIRouter()


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------
@router.get("/suppliers")
async def list_suppliers(user: dict = Depends(require_roles("owner", "prep"))):
    return await db.suppliers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@router.post("/suppliers")
async def create_supplier(payload: SupplierCreate, user: dict = Depends(require_owner)):
    doc = {
        "id": gen_id(),
        "name": payload.name.strip(),
        "contact": payload.contact or "",
        "phone": payload.phone or "",
        "email": payload.email or "",
        "notes": payload.notes or "",
        "active": payload.active,
        "created_at": now_iso(),
    }
    await db.suppliers.insert_one(doc)
    return clean(doc)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, payload: SupplierUpdate, user: dict = Depends(require_owner)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    res = await db.suppliers.update_one({"id": supplier_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, user: dict = Depends(require_owner)):
    await db.suppliers.delete_one({"id": supplier_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Employees — "baja" keeps history (never hard-deleted by default)
# ---------------------------------------------------------------------------
@router.get("/employees")
async def list_employees(status: str = None, user: dict = Depends(require_owner)):
    query = {}
    if status in ("active", "inactive"):
        query["status"] = status
    return await db.employees.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/employees")
async def create_employee(payload: EmployeeCreate, user: dict = Depends(require_owner)):
    doc = {
        "id": gen_id(),
        "name": payload.name.strip(),
        "position": payload.position or "",
        "phone": payload.phone or "",
        "email": payload.email or "",
        "wage": float(payload.wage or 0),
        "notes": payload.notes or "",
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
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    res = await db.employees.update_one({"id": employee_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return await db.employees.find_one({"id": employee_id}, {"_id": 0})


@router.post("/employees/{employee_id}/terminate")
async def terminate_employee(employee_id: str, payload: EmployeeTerminate, user: dict = Depends(require_owner)):
    """Baja: marca inactivo y guarda la fecha; conserva el registro histórico."""
    emp = await db.employees.find_one({"id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    await db.employees.update_one(
        {"id": employee_id},
        {"$set": {
            "status": "inactive",
            "termination_date": payload.termination_date or now_iso()[:10],
            "termination_reason": payload.reason or "",
        }},
    )
    return await db.employees.find_one({"id": employee_id}, {"_id": 0})


@router.post("/employees/{employee_id}/reactivate")
async def reactivate_employee(employee_id: str, user: dict = Depends(require_owner)):
    """Recontratación: reactiva conservando el historial previo."""
    emp = await db.employees.find_one({"id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    await db.employees.update_one(
        {"id": employee_id},
        {"$set": {"status": "active", "termination_date": None, "termination_reason": None, "rehire_date": now_iso()[:10]}},
    )
    return await db.employees.find_one({"id": employee_id}, {"_id": 0})
