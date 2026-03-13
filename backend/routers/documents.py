from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Document, Entity
from services.document_extractor import extractor
from config import settings
import os, shutil, uuid

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".jpg", ".jpeg", ".png", ".csv", ".txt"}


@router.post("/{entity_id}/upload", status_code=201)
async def upload_documents(
    entity_id: str,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")

    created = []
    entity_dir = os.path.join(settings.upload_dir, entity_id)
    os.makedirs(entity_dir, exist_ok=True)

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"File type {ext} not allowed")

        saved_name = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(entity_dir, saved_name)

        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        size = os.path.getsize(file_path)
        if size > settings.max_file_size_mb * 1024 * 1024:
            os.remove(file_path)
            raise HTTPException(400, f"{file.filename} exceeds {settings.max_file_size_mb}MB limit")

        doc = Document(
            entity_id=entity_id,
            filename=file.filename,
            file_path=file_path,
            file_size=size,
            mime_type=file.content_type,
        )
        db.add(doc)
        created.append(doc)

    entity.status = "documents"
    await db.commit()
    for doc in created:
        await db.refresh(doc)
    return created


@router.get("/{entity_id}/")
async def list_documents(entity_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.entity_id == entity_id))
    return result.scalars().all()


@router.delete("/{entity_id}/{doc_id}", status_code=204)
async def delete_document(entity_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc or doc.entity_id != entity_id:
        raise HTTPException(404, "Document not found")
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    await db.delete(doc)
    await db.commit()


@router.post("/{entity_id}/extract-all")
async def extract_all(
    entity_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Document).where(
            Document.entity_id == entity_id,
            Document.extraction_status == "pending"
        )
    )
    docs = result.scalars().all()
    if not docs:
        return {"message": "No pending documents", "count": 0}

    for doc in docs:
        doc.extraction_status = "extracting"
    await db.commit()

    background_tasks.add_task(_extract_all_background, entity_id, [d.id for d in docs])
    return {"message": "Extraction started", "count": len(docs)}


async def _extract_all_background(entity_id: str, doc_ids: list):
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        for doc_id in doc_ids:
            doc = await db.get(Document, doc_id)
            if not doc:
                continue
            try:
                result = await extractor.extract(doc.file_path)
                doc.raw_text = result["full_text"]
                doc.raw_tables = result["tables"]
                doc.page_count = result["page_count"]
                doc.extraction_status = "done"
            except Exception as e:
                doc.extraction_status = "error"
                doc.extraction_error = str(e)
            await db.commit()


@router.get("/{entity_id}/{doc_id}/status")
async def doc_status(entity_id: str, doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc or doc.entity_id != entity_id:
        raise HTTPException(404, "Document not found")
    return {
        "id": doc.id,
        "filename": doc.filename,
        "extraction_status": doc.extraction_status,
        "char_count": len(doc.raw_text) if doc.raw_text else 0,
        "page_count": doc.page_count,
        "classification_status": doc.classification_status,
        "schema_status": doc.schema_status,
    }
