# Smokehouse OS — Control financiero, inventario y P&L

Aplicación full-stack para administrar un restaurante **smokehouse**: punto de venta,
comandas hacia cocina, pantalla de estatus para el cliente, control de **materia prima**,
**órdenes de compra**, **gastos** y un **dashboard P&L** visible únicamente para el dueño.

## Stack
- **Backend:** FastAPI + MongoDB (Motor), JWT (PyJWT) + bcrypt, Pydantic v2.
- **Frontend:** React 19 + React Router 7 + Tailwind, Recharts, lucide-react, sonner.
- Todas las rutas de API viven bajo `/api`. El frontend usa `REACT_APP_BACKEND_URL`.

## Roles y permisos
| Rol | Acceso |
|-----|--------|
| **Dueño** (`owner`) | Todo. **Único** que ve finanzas, venta del día y P&L. Crea usuarios, edita precios, materia prima, órdenes de compra, gastos y ajustes. |
| **Cajera** (`cashier`) | Levanta órdenes (POS), envía a cocina y **cobra**. Ve el menú y sus órdenes. No ve finanzas. |
| **Preparación** (`prep`) | Ve la cola de cocina, **acepta** y avanza comandas (preparando → lista → entregada). No ve finanzas ni precios. |
| **Cliente** (público) | Pantalla `/pantalla`: tablero con número de comanda y estatus. Sin login, sin precios. |

## Flujo operativo
1. La **cajera** levanta la orden en el **POS** → la comanda se envía automáticamente a **cocina** (estado `pending`).
2. **Preparación** la **acepta** (`preparing`), la marca **lista** (`ready`) y **entregada** (`delivered`).
3. El **cliente** sigue su número en la **pantalla pública**.
4. La cajera **cobra** (efectivo/tarjeta/transferencia). Al pagar se **descuenta la materia prima** según la receta del producto y se registra el **costo de venta (COGS)**.
5. El **dueño** ve todo en el **dashboard P&L**.

## Modelo de datos (MongoDB)
- `users` — id, username, name, role, password_hash (bcrypt), active.
- `settings` — restaurant_name, currency, tax_rate, tax_included.
- `categories` / `products` — menú; `products.recipe` liga a `materials` para costeo e inventario.
- `materials` — materia prima con **data maestra**: sku, unit, category, cost_per_unit, current_stock, min_stock, par_stock, supplier.
- `orders` — comandas: items (snapshot de precio/costo/receta), status, totales, pago, tiempos.
- `purchase_orders` — órdenes de compra; al **recibir** suben stock y actualizan costo.
- `inventory_movements` — bitácora (purchase / consumption / adjustment).
- `expenses` — gastos operativos (alimentan el P&L).
- `counters` — folios secuenciales de órdenes y OC.

## Lógica de P&L
```
Ingresos (neto, sin IVA)         = Σ subtotal de órdenes pagadas
(–) Costo de ventas (COGS)       = Σ costo de receta de lo vendido
= Utilidad bruta                 (+ margen %)
(–) Gastos operativos            = Σ gastos del periodo
= Utilidad neta                  (+ margen neto %)
```
Además: serie de ventas por día, ventas por categoría, top de productos, venta por hora,
métodos de pago y venta del día.

## Endpoints principales (`/api`)
- **Auth/Usuarios:** `POST /auth/login`, `GET /auth/me`, `GET/POST/PUT/DELETE /users` (dueño).
- **Menú:** `GET/POST/PUT/DELETE /categories`, `GET/POST/PUT/DELETE /products`, `PATCH /products/{id}/price`.
- **Inventario:** `GET/POST/PUT/DELETE /materials`, `POST /materials/{id}/adjust`, `GET /materials/low-stock`, `GET /inventory/movements`.
- **Órdenes:** `POST /orders`, `GET /orders`, `GET /kitchen`, `GET /display` (público), `POST /orders/{id}/{accept|ready|deliver|cancel|pay}`.
- **Compras:** `GET/POST /purchase-orders`, `GET /purchase-orders/suggestions`, `PUT /purchase-orders/{id}/status`.
- **Finanzas (solo dueño):** `GET /finance/dashboard`, `GET /finance/pnl`, `GET /finance/daily`, `GET/POST/DELETE /expenses`.
- **Ajustes:** `GET /settings`, `PUT /settings` (dueño).

## Pantallas (frontend)
- `/login`, `/pantalla` (pública) · `/dashboard` (dueño) · `/pos` · `/ordenes` · `/cocina`
- `/menu` · `/inventario` · `/compras` · `/gastos` · `/usuarios` · `/ajustes` (dueño).

## Semilla inicial (primer arranque)
El superadmin de plataforma (`admin`) se crea siempre, sin tenant.
El resto es un **tenant demo** (`slug="demo"`) que solo se siembra con `SEED_DEMO_TENANT=true`
(desactivado por defecto): usuarios `dueno/dueno123`, `caja/caja123`, `cocina/cocina123`,
settings, y el catálogo de smokehouse (brisket, costillas, pollo ahumado, combos,
guarniciones, bebidas) con recetas y materia prima — todo asociado a ese `tenant_id`.

## Pruebas
`backend/smoke_test.py` ejerce el API end-to-end (auth, RBAC, POS, cocina, cobro con
descuento de inventario, órdenes de compra y P&L) usando un Mongo en memoria
(`mongomock-motor`). 42/42 verificaciones en verde.

## Extras sugeridos ya incluidos
- **Recetas por producto** → costeo automático y descuento de inventario al vender.
- **Stock mínimo / par** y **sugerencia de reorden** para generar OC con un clic.
- **Bitácora de movimientos** de inventario y **valor de inventario**.
- **Ticket promedio, venta por hora y métodos de pago** en el dashboard.
- **Pantalla pública** para el cliente en TV.

## Ideas futuras (no implementadas)
Impresión de tickets, corte de caja por turno/cajera, propinas, descuentos/cupones,
multi-sucursal, reportes exportables (PDF/Excel), notificaciones y modo offline.
