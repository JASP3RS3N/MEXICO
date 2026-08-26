# 🔥 Smokehouse OS

Sistema de administración para un restaurante **smokehouse**: punto de venta, comandas a
cocina, pantalla de estatus para el cliente, control de **materia prima**, **órdenes de
compra**, **gastos** y un **dashboard financiero P&L** — con **roles de usuario** y
finanzas visibles **solo para el dueño**.

## Roles
- **Dueño** — acceso total; único que ve finanzas, venta del día y P&L; crea usuarios y edita precios.
- **Cajera** — levanta órdenes en el POS y cobra.
- **Preparación** — acepta y avanza las comandas en la pantalla de cocina.
- **Cliente** — pantalla pública (`/pantalla`) con el estatus de su orden.

## Funcionalidad
- 🧾 **POS**: menú por categorías, carrito, envío a cocina y cobro (efectivo/tarjeta/transferencia, cálculo de cambio).
- 👨‍🍳 **Cocina (KDS)**: cola en tiempo real, aceptar → listo → entregar, temporizadores.
- 📺 **Pantalla de cliente**: tablero grande con número de comanda y estatus, sin login.
- 📦 **Inventario / materia prima**: data maestra, stock mínimo/par, costos, valor de inventario, ajustes con bitácora.
- 🧮 **Recetas**: cada producto descuenta materia prima al venderse (costeo automático / COGS).
- 🚚 **Órdenes de compra**: generación manual o **sugerencia de reorden** por bajo stock; al recibir, sube inventario.
- 💰 **Gastos operativos**: renta, nómina, servicios… alimentan el P&L.
- 📊 **Dashboard P&L (solo dueño)**: ingresos, COGS, utilidad bruta/neta, márgenes, ventas por día/categoría/hora, top de productos, métodos de pago.
- 👥 **Usuarios y ajustes**: alta de cuentas, moneda e IVA.
- 🤖 **Asistente IA local (solo dueño)**: copiloto con tu propia IA vía **LM Studio** (privado, sin nube; accesible por **Tailscale**). Consulta finanzas/ventas, analiza el menú, y **ejecuta acciones**: crea órdenes de compra, levanta pedidos y ajusta precios (function-calling). Ver [`CORRER_LOCAL.md`](./CORRER_LOCAL.md#-asistente-ia-local-lm-studio--tailscale).

## Stack
FastAPI · MongoDB (Motor) · JWT + bcrypt · React 19 · Tailwind · Recharts.

## Ejecutar localmente

> **¿Windows y lo quieres fácil?** Usa Docker: un solo comando levanta todo.
> Guía paso a paso en [`CORRER_LOCAL.md`](./CORRER_LOCAL.md).
> `docker compose up --build` → abre http://localhost:3000

### Backend (manual)
```bash
cd backend
pip install -r requirements.txt
# Configura backend/.env (ver .env.example)
uvicorn server:app --reload --port 8001
```
Variables (`backend/.env`): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`, `SEED_DEMO_TENANT`.
`SEED_DEMO_TENANT=true` crea un tenant demo completo (usuarios dueño/caja/cocina + settings + catálogo, todo con su `tenant_id`); por defecto está desactivado.

### Frontend
```bash
cd frontend
yarn install
# REACT_APP_BACKEND_URL apunta al backend (p.ej. http://localhost:8001)
yarn start
```

## Usuarios de demostración (semilla)
| Rol | Usuario | Contraseña |
|-----|---------|-----------|
| Dueño | `dueno` | `dueno123` |
| Cajera | `caja` | `caja123` |
| Preparación | `cocina` | `cocina123` |

> Cambia estas contraseñas en producción desde **Usuarios**.

## Pruebas del backend
```bash
cd backend
pip install mongomock-motor httpx
python smoke_test.py   # 42 verificaciones end-to-end (auth, POS, cocina, cobro, P&L)
```

Más detalle de arquitectura en [`plan.md`](./plan.md).
