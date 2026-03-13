from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Entity, Analysis, Document
from services.report_generator import generate_word_report
import tempfile

router = APIRouter()


@router.get("/{entity_id}/docx")
async def export_word(entity_id: str, db: AsyncSession = Depends(get_db)):
    entity = await db.get(Entity, entity_id)
    existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
    analysis = existing.scalar_one_or_none()
    docs_r = await db.execute(select(Document).where(Document.entity_id == entity_id))
    docs = docs_r.scalars().all()

    if not entity or not analysis or analysis.analysis_status != "done":
        raise HTTPException(400, "Analysis not complete")

    tmp = tempfile.mktemp(suffix=".docx")
    generate_word_report(entity, analysis, docs, tmp)
    return FileResponse(
        tmp,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"IntelliCredit_Report_{entity.company_name.replace(' ', '_')}.docx",
    )
