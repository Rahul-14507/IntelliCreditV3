from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Document, Entity
from services.classifier import classify_document
from services.schema_engine import DEFAULT_SCHEMAS, extract_with_schema
from pydantic import BaseModel
import copy

router = APIRouter()


@router.post("/{entity_id}/classify-all")
async def classify_all(entity_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document).where(
            Document.entity_id == entity_id,
            Document.extraction_status == "done"
        )
    )
    docs = result.scalars().all()
    if not docs:
        raise HTTPException(400, "No extracted documents found. Run extraction first.")

    classified = []
    for doc in docs:
        try:
            cls = await classify_document(doc.filename, doc.raw_text or "", doc.raw_tables or [])
            doc.predicted_doc_type = cls["predicted_type"]
            doc.predicted_confidence = cls["confidence"]
            doc.predicted_reasoning = cls["reasoning"]
            doc.predicted_signals = cls["key_signals"]
            doc.classification_status = "classified"
            doc.schema_fields = copy.deepcopy(DEFAULT_SCHEMAS.get(cls["predicted_type"], []))
            classified.append({
                "doc_id": doc.id,
                "filename": doc.filename,
                "predicted": cls["predicted_type"],
                "confidence": cls["confidence"],
                "reasoning": cls["reasoning"],
                "signals": cls["key_signals"],
            })
        except Exception as e:
            doc.classification_status = "error"

    await db.commit()
    return {"classified": len(classified), "results": classified}


class ConfirmPayload(BaseModel):
    confirmed_type: str
    action: str  # "approve" | "reject" | "edit"


@router.patch("/{entity_id}/{doc_id}/confirm")
async def confirm_classification(
    entity_id: str, doc_id: str,
    payload: ConfirmPayload,
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.entity_id != entity_id:
        raise HTTPException(404, "Document not found")

    if payload.action == "reject":
        doc.classification_status = "rejected"
    else:
        doc.confirmed_doc_type = payload.confirmed_type
        doc.classification_status = "confirmed"
        if payload.confirmed_type != doc.predicted_doc_type:
            doc.schema_fields = copy.deepcopy(DEFAULT_SCHEMAS.get(payload.confirmed_type, []))

    await db.commit()
    await db.refresh(doc)
    return doc


class SchemaUpdatePayload(BaseModel):
    schema_fields: list


@router.patch("/{entity_id}/{doc_id}/schema")
async def update_schema(
    entity_id: str, doc_id: str,
    payload: SchemaUpdatePayload,
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.entity_id != entity_id:
        raise HTTPException(404, "Document not found")
    doc.schema_fields = payload.schema_fields
    await db.commit()
    return {"doc_id": doc_id, "schema_fields": doc.schema_fields}


@router.post("/{entity_id}/{doc_id}/reset-schema")
async def reset_schema(entity_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc or doc.entity_id != entity_id:
        raise HTTPException(404, "Document not found")
    doc_type = doc.confirmed_doc_type or doc.predicted_doc_type
    doc.schema_fields = copy.deepcopy(DEFAULT_SCHEMAS.get(doc_type, []))
    await db.commit()
    return {"doc_id": doc_id, "reset_to": doc_type}


@router.post("/{entity_id}/extract-all")
async def extract_all_schemas(entity_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document).where(
            Document.entity_id == entity_id,
            Document.classification_status == "confirmed"
        )
    )
    docs = result.scalars().all()
    if not docs:
        raise HTTPException(400, "No confirmed documents. Complete classification first.")

    results = []
    for doc in docs:
        try:
            doc.schema_status = "extracting"
            await db.commit()

            doc_type = doc.confirmed_doc_type
            schema_fields = doc.schema_fields or DEFAULT_SCHEMAS.get(doc_type, [])

            extracted = await extract_with_schema(
                doc_type=doc_type,
                raw_text=doc.raw_text or "",
                raw_tables=doc.raw_tables or [],
                schema_fields=schema_fields,
            )

            doc.extracted_data = extracted
            doc.extraction_confidence = extracted.get("_confidence", 0.8)
            doc.extraction_notes = extracted.get("_missing_fields", [])
            doc.schema_status = "done"
            results.append({
                "doc_id": doc.id,
                "doc_type": doc_type,
                "confidence": doc.extraction_confidence,
                "fields_extracted": len([k for k, v in extracted.items()
                                         if not k.startswith("_") and v is not None]),
            })
        except Exception as e:
            doc.schema_status = "error"

    entity = await db.get(Entity, entity_id)
    if entity:
        entity.status = "analysis"
    await db.commit()
    return {"extracted": len(results), "results": results}


class ExtractionEditPayload(BaseModel):
    extracted_data: dict


@router.patch("/{entity_id}/{doc_id}/extracted")
async def edit_extracted(
    entity_id: str, doc_id: str,
    payload: ExtractionEditPayload,
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.entity_id != entity_id:
        raise HTTPException(404, "Document not found")
    doc.extracted_data = payload.extracted_data
    await db.commit()
    return {"doc_id": doc_id, "saved": True}


@router.get("/{entity_id}/all-extracted")
async def get_all_extracted(entity_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document).where(
            Document.entity_id == entity_id,
            Document.schema_status == "done"
        )
    )
    docs = result.scalars().all()
    return [
        {
            "doc_id": d.id,
            "filename": d.filename,
            "doc_type": d.confirmed_doc_type,
            "confidence": d.extraction_confidence,
            "schema_fields": d.schema_fields,
            "extracted": d.extracted_data,
            "notes": d.extraction_notes,
        }
        for d in docs
    ]
