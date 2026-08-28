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

---

# 🏭 WMS Producción ↔ Almacén

Módulo para que **Producción pida material** y **Almacén lo surta**, con
trazabilidad completa, medición de desempeño y alertas visuales de retraso.

> **Regla dura: cero escritura hacia SAP.** La app **solo lee** un archivo plano
> que tu script de SAP deja en una carpeta. No hay ninguna llamada RFC/BAPI de
> escritura, ni ajuste de stock en SAP, en todo el proyecto. Este sistema es de
> control y trazabilidad interna; **no reemplaza ni reconcilia** el inventario
> oficial de SAP.

## 1. Usuarios y roles

| Rol | Qué puede hacer | Cómo entra |
|-----|-----------------|-----------|
| **Producción** | Crear solicitudes, ver el inventario de referencia, seguir sus solicitudes | usuario + contraseña |
| **Almacén** | Ver la cola, tomar/liberar solicitudes, surtir total o parcial | usuario + contraseña |
| **Dueño / Supervisor** | Todo lo anterior + dashboards, umbrales, locaciones y export a Excel | usuario + contraseña |

Los das de alta como dueño en **Usuarios**, eligiendo el rol y la
**locación/planta**. La locación es la que filtra lo que cada quien ve: un
operador solo trabaja con su planta; el supervisor las ve todas.

> Cajera y preparación siguen entrando con PIN, sin cambios.

## 2. Configura la carpeta del export de SAP

Tu script (SAP GUI Scripting o RFC, disparado por el **Task Scheduler de
Windows**) corre **MB52** y guarda el resultado en una carpeta.

1. Crea la carpeta, por ejemplo `C:\sap_export`.
2. En `docker-compose.yml`, apunta el volumen del servicio **backend** a esa carpeta:
   ```yaml
   volumes:
     # izquierda = tu carpeta real · derecha = ruta dentro del contenedor (no la cambies)
     - C:/sap_export:/data/sap_export:ro
   ```
   El `:ro` del final es a propósito: el contenedor **no puede escribir** ahí.
   Si el export vive en una carpeta de red, usa la ruta UNC (`//SERVIDOR/sap`)
   o mapea la unidad en Docker Desktop → *Settings → Resources → File sharing*.
3. Levanta la app: `docker compose up -d --build`.

### Formato del archivo
Se aceptan las **dos presentaciones** en que sale MB52; la app detecta sola cuál
es y lo dice en la bitácora de sincronizaciones.

**a) Bloques multilínea** — la que exporta el ALV de SAP con *Hoja de cálculo →
Texto sin formato*. El encabezado ocupa tres renglones y cada material es un
bloque separado por una línea en blanco:

```
	Material Number		Material Description		Plnt	Name 1
	SLoc	SL	  Unrestricted		Unit	   Transit/Transf.	  In Quality Insp. …
		   Total Value		Crcy	   Total Value …

	001003000I		FLOAT ARM		2300	Gentherm Monterrey S.A.de C.V.
	2301		          400		PC	            0 …
		       398.00		USD	         0.00 …
```

Un mismo material puede traer **varios pares (cantidad, importe)**, uno por
almacén; se suman. El renglón `* Total` del final se descarta.

**b) Fila por registro** — CSV/TSV plano o lista ALV con bordes `|`, donde cada
línea ya trae material, centro, almacén y cantidad.

Columnas que necesita (reconoce los nombres de MB52 en inglés y español):

| Campo | Alias que reconoce |
|-------|--------------------|
| Número de parte | `Material Number`, `Material`, `MATNR`, `Número de parte` |
| Descripción | `Material Description`, `MAKTX`, `Texto breve material` |
| Centro / planta | `Plnt`, `Plant`, `WERKS`, `Centro`, `Planta` |
| Almacén | `SLoc`, `Storage Location`, `LGORT`, `Almacén` |
| Existencia | `Unrestricted`, `LABST`, `Libre utilización` |
| Unidad | `Unit`, `Base Unit of Measure`, `MEINS`, `UMB` |
| En tránsito | `Transit/Transf.`, `Tránsito`, `Traslado` |
| En calidad | `In Quality Insp.`, `Control de calidad` |
| Restringido | `Restricted-Use`, `Uso restringido` |
| Bloqueado | `Blocked`, `Bloqueado` |
| Devoluciones | `Returns`, `Devoluciones` |

Las cinco últimas son opcionales: si tu export no las trae, todo lo demás
funciona igual.

Si tu export usa otros nombres, fíjalos en `docker-compose.yml` sin tocar código:
```yaml
SAP_COL_PART_NUMBER: "Nro material"
SAP_COL_QTY: "Stock disponible"
```

Detalles que ya están resueltos:
- **Solo el stock de libre utilización** (`Unrestricted`) cuenta como
  disponible, que es el criterio correcto para lo que Producción puede pedir.
  Lo que está en tránsito, en control de calidad, restringido, bloqueado o en
  devoluciones **se guarda aparte y se muestra**, pero nunca se suma al
  disponible: cuando una parte sale en cero, Producción ve *"hay 1,800 en
  tránsito"* al elegirla, y Almacén lo ve al momento de surtir. La diferencia
  importa — no es un quiebre de stock, es material por liberarse, y la
  respuesta a Producción es distinta.
- **Se suman los almacenes** de un mismo centro, y el desglose por almacén se
  guarda igual: Producción ve el total y Almacén ve *en qué almacén está* al
  momento de surtir.
- **Codificación**: los exports de SAP sobre Windows vienen en `cp1252`, no en
  UTF-8. Se detecta sola, así que `GEHÄUSE` y `CONNECTOR 90°` se leen bien.
- **Separador decimal**: se decide mirando el archivo completo —cantidades e
  importes— en vez de valor por valor. Así `1,200` se lee como mil doscientos
  en un export en inglés y `1.250,000` como mil doscientos cincuenta en uno en
  español. Si tu archivo resultara ambiguo, fíjalo con
  `SAP_DECIMAL_SEPARATOR: "."` o `","`.
- **Cantidades negativas** (SAP las emite en algunos almacenes) se respetan tal
  cual, no se recortan a cero.
- `SAP_LOCATION_MODE` decide qué es una locación: `plant` (por defecto, un
  centro = una locación) o `plant_sloc` (cada almacén es su propia locación).
  Conviene dejarlo en `plant`: cada persona se asigna a **una** locación, y con
  `plant_sloc` alguien asignado al almacén 2301 no vería el material que está en
  el 2311 del mismo centro.

## 3. El scheduler (la sincronización automática)

Ya viene incluido: **APScheduler corre dentro del backend**, no necesitas cron
ni un contenedor extra.

- Relee la carpeta cada **60 minutos** (`SAP_INVENTORY_SYNC_MINUTES`).
- Si el archivo no cambió desde la última corrida, no lo reprocesa (queda como
  *Sin cambios* en la bitácora).
- También barre cada 5 minutos las solicitudes atrasadas para generar alertas.
- Para apagarlo: `SAP_INVENTORY_ENABLED: "false"`.

**Sincronizar a mano:** como dueño, entra a **Ajustes WMS** (o al dashboard
**Desempeño WMS**) y pulsa *Sincronizar ahora*. Ahí mismo ves la bitácora de
corridas: archivo, filas leídas, partes actualizadas y el error si algo falló.

**¿Se cayó tu script de SAP?** La tarjeta *Ingesta de inventario SAP* del
dashboard se pone en rojo cuando pasan más de 90 minutos (configurable) sin una
sincronización exitosa.

## 4. Cómo se usa

1. **Producción** entra a *Solicitar Material*, escribe o escanea el número de
   parte (la descripción y la unidad se autocompletan del inventario de SAP),
   pone cantidad y prioridad, y envía. Si SAP reporta menos de lo que pide, se
   le avisa — pero **la solicitud nunca se bloquea**.
2. La solicitud aparece en el tablero de **Almacén** en segundos, ordenada por
   **urgentes primero y luego la más vieja**.
3. Almacén **toma** la solicitud (queda registrado quién y cuándo), la **surte**
   total o parcialmente, o la **libera** de vuelta a la cola si no puede
   completarla (sin perder el historial de quién la tenía).
4. Todo cambio de estado se agrega a una **bitácora inmutable**: nunca se
   sobrescribe, solo se agregan renglones.

### El semáforo
| Color | Tiempo sin surtir | Cómo se ve |
|-------|-------------------|------------|
| 🟢 Verde | 0 – 20 min | tarjeta normal |
| 🟡 Amarillo | 20 – 60 min | fondo ámbar |
| 🔴 Rojo | más de 60 min | **fondo rojo intenso, texto blanco y pulso** |

Los tres umbrales se editan en **Ajustes WMS** (no están fijos en el código).
Cuando hay solicitudes en rojo, además:
- suena un tono corto (cada operador puede silenciarlo con la campanita),
- el **título de la pestaña parpadea** y el **favicon muestra el contador**, para
  que se note aunque el navegador esté en segundo plano,
- el menú lateral muestra el número en rojo.

### Exportar a Excel
En **Desempeño WMS**, botón **Excel**. Baja un `.xlsx` con dos hojas:
- **Solicitudes**: folio, parte, descripción, cantidad solicitada y surtida,
  quién pidió, quién surtió, fechas, minutos de respuesta, SLA, status y locación.
- **KPIs por persona**: el resumen de almacén y de producción del mismo periodo.

## 5. Publicarlo como pestaña de Microsoft Teams

La app **no necesita hosting público**: basta con que la PC donde corre sea
alcanzable desde la red o la VPN de la empresa.

1. **Fija la IP o el nombre del servidor.** Digamos `wms.empresa.local` o
   `192.168.1.50`.
2. **Ajusta la URL del backend.** En `docker-compose.yml`, servicio `frontend`:
   ```yaml
   args:
     REACT_APP_BACKEND_URL: http://wms.empresa.local:8001
   ```
   y en el servicio `backend`, permite ese origen:
   ```yaml
   CORS_ORIGINS: "http://wms.empresa.local:3000"
   ```
   Reconstruye: `docker compose up -d --build`.
3. **Pon HTTPS.** Teams **solo embebe páginas por HTTPS**; con `http://` la
   pestaña sale en blanco. Necesitas un proxy inverso con certificado delante
   de la app — Caddy, IIS o Nginx sirven; el certificado puede ser de la CA
   interna de la empresa, siempre que las computadoras ya confíen en ella.
   Ejemplo mínimo con Caddy (`Caddyfile`):
   ```
   wms.empresa.local {
     tls /ruta/cert.pem /ruta/llave.pem
     handle /api/* { reverse_proxy localhost:8001 }
     handle        { reverse_proxy localhost:3000 }
   }
   ```
4. **Agrégala en Teams.** En el canal → **+** → **Sitio web** → pega
   `https://wms.empresa.local` → nómbrala *WMS Almacén* → Guardar.

La cabecera que Teams necesita (`Content-Security-Policy: frame-ancestors`) ya
viene puesta en `frontend/nginx.conf`; si metes tu propio proxy delante,
asegúrate de que no la reescriba ni agregue un `X-Frame-Options: DENY`.

> La app es **responsive**: la misma URL sirve para la tablet del piso, el
> celular y la pestaña de Teams en la computadora.

## 6. Si algo falla

- **"No se encontró ningún archivo"** → revisa que el volumen apunte a la
  carpeta correcta y que el script de SAP siga corriendo en el Task Scheduler.
- **"No se reconocieron las columnas"** → tu export usa otros encabezados: llena
  las variables `SAP_COL_*` con los nombres exactos de tu archivo.
- **Las cantidades salen ×1000 o ÷1000** → fija `SAP_DECIMAL_SEPARATOR` con el
  separador decimal real de tu export (`"."` para `1,200.50`, `","` para
  `1.200,50`).
- **Producción no ve material que sí existe** → probablemente `SAP_LOCATION_MODE`
  está en `plant_sloc` y la persona quedó asignada a un solo almacén del centro.
  Cámbialo a `plant`.
- **Las descripciones salen con `?` o símbolos raros** → el archivo viene en una
  codificación que no se pudo detectar; mándamelo y agrego el caso.
- **"Tu usuario no tiene una locación asignada"** → como dueño, edita al usuario
  en **Usuarios** y asígnale su planta.
