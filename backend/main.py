from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from config import settings
from routers import entities, documents, schema_mapping, analysis, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="IntelliCredit v3 API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(entities.router, prefix="/entities", tags=["Stage 1 — Entities"])
app.include_router(documents.router, prefix="/documents", tags=["Stage 2 — Documents"])
app.include_router(schema_mapping.router, prefix="/schema", tags=["Stage 3 — Schema"])
app.include_router(analysis.router, prefix="/analysis", tags=["Stage 4 — Analysis"])
app.include_router(export.router, prefix="/export", tags=["Export"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "3.0.0"}
