# 🖥️ Correr Smokehouse OS en tu PC (Windows + Docker)

Con Docker levantas **todo junto** (base de datos + backend + app) con un solo comando.

## 1. Instala Docker Desktop
- Descarga **Docker Desktop para Windows**: https://www.docker.com/products/docker-desktop/
- Instálalo y **ábrelo** (espera a que diga "Docker Desktop is running", ballenita verde abajo).
- Si te pide activar WSL 2, acepta (el instalador te guía).

## 2. Descarga el proyecto
Opción fácil (sin comandos): en GitHub, en la rama `claude/restaurant-finance-inventory-app-095xth`,
botón verde **Code → Download ZIP**, y descomprime la carpeta.

Opción con Git:
```powershell
git clone https://github.com/JASP3RS3N/MEXICO.git
cd MEXICO
git checkout claude/restaurant-finance-inventory-app-095xth
```

## 3. Levanta la app
Abre **PowerShell** dentro de la carpeta del proyecto (donde está `docker-compose.yml`) y corre:
```powershell
docker compose up --build
```
La primera vez tarda unos minutos (descarga e instala todo). Cuando veas que el frontend
y el backend quedan corriendo, ya está lista.

> Consejo: en PowerShell puedes escribir `cd ` y arrastrar la carpeta para pegar la ruta.

## 4. Ábrela en el navegador
- **App:** http://localhost:3000
- **Pantalla de cliente** (para una TV): http://localhost:3000/pantalla
- API (opcional): http://localhost:8001/api/health

### Usuarios para entrar
| Rol | Usuario | Contraseña |
|-----|---------|-----------|
| Dueño | `dueno` | `dueno123` |
| Cajera | `caja` | `caja123` |
| Preparación | `cocina` | `cocina123` |

Ya viene con un menú de demostración de smokehouse para que la pruebes de inmediato.
Cambia las contraseñas desde **Usuarios** (como dueño).

## Comandos útiles
```powershell
docker compose up --build      # levantar (primera vez o tras cambios)
docker compose up              # levantar (siguientes veces, más rápido)
docker compose down            # apagar todo
docker compose down -v         # apagar y BORRAR los datos (empezar de cero)
```
- Para dejarla corriendo en segundo plano agrega `-d`: `docker compose up -d`.
- Tus datos se guardan aunque apagues (en un volumen de Docker); solo se borran con `down -v`.

## Si algo falla
- Asegúrate de que **Docker Desktop esté abierto** antes de correr el comando.
- Si el puerto 3000 u 8001 está ocupado, ciérralo o dime y te lo cambio.
- Si ves errores en pantalla, cópiamelos y lo reviso.

---

# 🤖 Asistente IA local (LM Studio + Tailscale)

El **Asistente IA** es privado (corre en tu propia IA, sin nube) y **solo lo ve el dueño**.
Puede consultar finanzas y ventas, analizar el menú, **crear órdenes de compra**,
**levantar pedidos** y ajustar precios.

## 1. Prepara LM Studio
1. Instala **LM Studio**: https://lmstudio.ai
2. Descarga un modelo que **soporte herramientas / function calling**. Recomendados:
   `Qwen2.5-7B-Instruct`, `Llama-3.1-8B-Instruct` o `Mistral-Nemo-Instruct` (o mayores si tu GPU aguanta).
3. Carga el modelo y ve a la pestaña **Developer** (o **Local Server**).
4. **Enciende el servidor** (botón *Start*). Puerto por defecto: **1234**.
5. Activa **“Serve on Local Network”** (para que Docker y Tailscale lo puedan alcanzar).

## 2A. Si LM Studio corre en la MISMA PC que la app
No tienes que hacer nada: ya viene configurado con `host.docker.internal:1234`.
Solo levanta la app (`docker compose up --build`), entra como **dueño** y abre **Asistente IA**.

## 2B. Si LM Studio corre en OTRA máquina (por Tailscale)
Ideal si tienes una PC con GPU aparte.
1. Instala **Tailscale** (https://tailscale.com) en **ambas** máquinas e inicia sesión con la **misma cuenta**.
2. En la máquina con LM Studio, saca su **IP de Tailscale** (empieza con `100.x.x.x`) — la ves en la app de Tailscale o con `tailscale ip`.
3. En `docker-compose.yml`, cambia esta línea del servicio **backend**:
   ```yaml
   LMSTUDIO_BASE_URL: "http://100.X.X.X:1234/v1"   # ← pon tu IP de Tailscale
   ```
4. Reinicia: `docker compose up -d --build`

## 3. Úsalo
Entra como **dueño** → menú **Asistente IA**. Arriba verás **🟢 Conectado** si todo está bien.
Ejemplos:
- *"¿Cómo va la venta de hoy? Dame el corte con utilidad."*
- *"Revisa el inventario y crea una orden de compra con lo que esté bajo de stock."*
- *"Analiza mi menú: márgenes bajos y sugerencias de precio."*

> Las órdenes de compra que crea la IA quedan en **borrador** para que las revises antes de recibirlas.
> Cada acción que ejecuta se muestra en el chat (ej. *"Creó orden de compra OC-0006…"*).

### Si dice “Sin conexión”
- Confirma que LM Studio esté con el **servidor encendido** y un **modelo cargado**.
- Que esté activado **“Serve on Local Network”**.
- Si es por Tailscale, que ambas máquinas estén conectadas y la `LMSTUDIO_BASE_URL` tenga la IP correcta.
- Para apagar la IA por completo: en `docker-compose.yml` pon `AI_ENABLED: "false"`.

---

# 💳 Terminal bancaria y 🔔 alertas

## Cobros con terminal (detección automática)
El efectivo lo confirma la **cajera** en el POS (no necesita nada más). Para **detectar cobros con tarjeta**,
la app expone un webhook: tu terminal/procesador (Clip, Mercado Pago) o un flujo de **n8n** le avisa a la app
cuando entra un cobro y la orden se marca pagada sola.

- **URL:** `POST http://localhost:8001/api/payments/terminal`
- **Cuerpo (JSON):** `{"secret":"<tu-secreto>","amount":189.00,"order_number":12,"reference":"TXN-123"}`
- El `secret` es el de `PAYMENTS_WEBHOOK_SECRET` en `docker-compose.yml` (¡cámbialo!).
- Si mandas `order_number`, concilia esa orden; si no, busca la orden sin pagar cuyo total coincida con `amount`.

> Clip y Mercado Pago Point tienen webhooks propios: apúntalos a esta URL (directo o vía n8n para traducir el formato).
> Si usas una terminal de banco sin API, un flujo de n8n o la conciliación manual en **Órdenes** cubren el caso.

## Alertas de bajo stock
Cuando un insumo llega a su mínimo (al venderse por su **receta/BOM**), se genera una **alerta en la app**
(campanita 🔔 en el menú y sección **Alertas**), y la IA también te la reporta. **No requiere n8n.**

- ¿Quieres además **WhatsApp/Telegram/correo**? Pon la URL de tu flujo n8n en `ALERT_WEBHOOK_URL`
  (en `docker-compose.yml`). La app le hará `POST` con los datos de la alerta y n8n la reenvía a donde quieras.

## Otras novedades v2 (ya en la app, sin configurar)
- **Proveedores** y **Empleados** (altas/bajas con historial) en el menú lateral (dueño).
- **Colores** editables en **Ajustes** (fondo, barra lateral, letras).
- La **IA** puede dar de alta proveedores e insumos, definir recetas (BOM), fijar precios/costos y hacer **cortes de caja**.
