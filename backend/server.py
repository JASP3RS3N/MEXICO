from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, Literal, Any
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI(title="IAtipsMX Landing API")
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


SECTORS = {
    "consultorios",
    "restaurantes",
    "construccion",
    "oficios",
    "servicios-generales",
}


class LeadCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str = Field(..., min_length=2, max_length=120)
    negocio: str = Field(..., min_length=2, max_length=140)
    sector: Literal[
        "consultorios",
        "restaurantes",
        "construccion",
        "oficios",
        "servicios-generales",
    ]
    ciudad: str = Field(..., min_length=2, max_length=120)
    telefono: str = Field(..., min_length=7, max_length=40)
    email: Optional[EmailStr] = None
    mensaje: str = Field(..., min_length=10, max_length=1200)
    origen: str = Field(default="landing-contact", max_length=80)


class LeadResponse(BaseModel):
    id: str
    nombre: str
    negocio: str
    sector: str
    ciudad: str
    telefono: str
    email: Optional[str] = None
    mensaje: str
    origen: str
    createdAt: str


class HealthResponse(BaseModel):
    status: str
    service: str
    database: str
    timestamp: str


class LeadListResponse(BaseModel):
    items: list[LeadResponse]
    count: int


@app.on_event("startup")
async def startup_event() -> None:
    await db.leads.create_index("createdAt")
    await db.leads.create_index("sector")
    logger.info("Leads indexes ensured")


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()



def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id", "")),
        "nombre": doc.get("nombre", ""),
        "negocio": doc.get("negocio", ""),
        "sector": doc.get("sector", ""),
        "ciudad": doc.get("ciudad", ""),
        "telefono": doc.get("telefono", ""),
        "email": doc.get("email"),
        "mensaje": doc.get("mensaje", ""),
        "origen": doc.get("origen", "landing-contact"),
        "createdAt": (
            doc.get("createdAt").astimezone(timezone.utc).isoformat()
            if isinstance(doc.get("createdAt"), datetime)
            else str(doc.get("createdAt", ""))
        ),
    }


@api_router.get("/")
async def root() -> dict[str, str]:
    return {"message": "IAtipsMX landing API online"}


@api_router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="iatipsmx-landing",
        database=db_name,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@api_router.post("/leads", response_model=LeadResponse, status_code=201)
async def create_lead(payload: LeadCreate) -> LeadResponse:
    if payload.sector not in SECTORS:
        raise HTTPException(status_code=400, detail="Sector inválido")

    document = payload.model_dump()
    document["createdAt"] = datetime.now(timezone.utc)

    result = await db.leads.insert_one(document)
    created = await db.leads.find_one({"_id": result.inserted_id})

    if not created:
        raise HTTPException(status_code=500, detail="No fue posible guardar el lead")

    logger.info("New lead stored for sector=%s business=%s", payload.sector, payload.negocio)
    return LeadResponse(**serialize_doc(created))


@api_router.get("/leads", response_model=LeadListResponse)
async def list_leads(limit: int = Query(default=20, ge=1, le=100)) -> LeadListResponse:
    docs = await db.leads.find({}).sort("createdAt", -1).limit(limit).to_list(limit)
    items = [LeadResponse(**serialize_doc(doc)) for doc in docs]
    return LeadListResponse(items=items, count=len(items))


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
