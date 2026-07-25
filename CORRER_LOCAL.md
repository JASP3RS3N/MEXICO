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
