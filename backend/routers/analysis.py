from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Entity, Document, Analysis
from services.research_scraper import scraper
from services.ai_analyzer import analyze_entity

router = APIRouter()
class RecalculateRequest(BaseModel):
    observations: str | None = None


@router.post("/{entity_id}/research")
async def run_research(
    entity_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")

    existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
    analysis = existing.scalar_one_or_none()
    
    if not analysis:
        analysis = Analysis(entity_id=entity_id)
        db.add(analysis)
    elif analysis.research_status in ("running", "done"):
        return {"status": "research_exists", "research_status": analysis.research_status}

    analysis.research_status = "running"
    await db.commit()

    background_tasks.add_task(_run_research_background, entity_id)
    return {"status": "research_started", "entity_id": entity_id}


async def _run_research_background(entity_id: str):
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        entity = await db.get(Entity, entity_id)
        existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
        analysis = existing.scalar_one_or_none()
        if not analysis:
            analysis = Analysis(entity_id=entity_id)
            db.add(analysis)

        try:
            research = await scraper.research_entity(
                company_name=entity.company_name,
                cin=entity.cin or "",
                sector=entity.sector or "",
                sub_sector=entity.sub_sector or "",
            )
            analysis.news_results = research["news"]
            analysis.legal_results = research["legal"]
            analysis.macro_results = research["macro"]
            analysis.sentiment = research["sentiment"]
            analysis.research_status = "done"
        except Exception as e:
            analysis.research_status = "error"

        await db.commit()


@router.post("/{entity_id}/analyze")
async def run_analysis(
    entity_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")

    existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
    analysis = existing.scalar_one_or_none()
    
    if not analysis or analysis.research_status != "done":
        raise HTTPException(400, "Run research first (POST /analysis/{id}/research)")

    if analysis.analysis_status in ("running", "done"):
        return {"status": "analysis_exists", "analysis_status": analysis.analysis_status}

    analysis.analysis_status = "running"
    await db.commit()
    background_tasks.add_task(_run_analysis_background, entity_id)
    return {"status": "analysis_started", "entity_id": entity_id}


async def _run_analysis_background(entity_id: str):
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        entity = await db.get(Entity, entity_id)
        existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
        analysis = existing.scalar_one_or_none()

        docs_result = await db.execute(
            select(Document).where(
                Document.entity_id == entity_id,
                Document.schema_status == "done"
            )
        )
        docs = docs_result.scalars().all()
        all_extracted = [
            {"doc_type": d.confirmed_doc_type, "filename": d.filename, "extracted": d.extracted_data}
            for d in docs
        ]

        research = {
            "news": analysis.news_results or [],
            "legal": analysis.legal_results or [],
            "macro": analysis.macro_results or [],
            "sentiment": analysis.sentiment or {},
        }

        try:
            result = await analyze_entity(entity, all_extracted, research)

            # Deterministic grade from score (forces 0-100 logic)
            overall = result["scores"].get("overall", 0)
            if overall >= 80:
                grade = "A"
            elif overall >= 65:
                grade = "B"
            elif overall >= 50:
                grade = "C"
            else:
                grade = "D"

            # Deterministic recommendation from grade
            if grade in ("A", "B"):
                recommendation = "APPROVE" if overall >= 75 else "CONDITIONAL_APPROVE"
            elif grade == "C":
                recommendation = "CONDITIONAL_APPROVE"
            else:
                recommendation = "REJECT"

            # Override whatever GPT-4o returned
            result["grade"] = grade
            result["recommendation"] = recommendation

            analysis.scores = result.get("scores")
            analysis.grade = result.get("grade")
            analysis.recommendation = result.get("recommendation")
            analysis.reasoning_chain = result.get("reasoning_chain")
            analysis.swot = result.get("swot")
            analysis.triangulation = result.get("triangulation")
            analysis.key_risks = result.get("key_risks")
            analysis.mitigants = result.get("mitigants")
            analysis.conditions = result.get("conditions")
            analysis.recommended_limit_cr = result.get("recommended_limit_cr")
            analysis.recommended_rate_pct = result.get("recommended_rate_pct")
            analysis.recommended_tenure_months = result.get("recommended_tenure_months")
            analysis.executive_summary = result.get("executive_summary")
            analysis.analysis_status = "done"

            entity.status = "complete"
        except Exception as e:
            print(f"ERROR: Analysis background task failed for {entity_id}: {e}")
            import traceback
            traceback.print_exc()
            analysis.analysis_status = "error"

        await db.commit()


@router.get("/{entity_id}/")
async def get_analysis(entity_id: str, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
    analysis = existing.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    return analysis


@router.get("/{entity_id}/status")
async def get_analysis_status(entity_id: str, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
    analysis = existing.scalar_one_or_none()
    if not analysis:
        return {"research_status": "not_started", "analysis_status": "not_started"}
    return {
        "research_status": analysis.research_status,
        "analysis_status": analysis.analysis_status,
        "grade": analysis.grade,
        "recommendation": analysis.recommendation,
    }


@router.post("/{entity_id}/recalculate")
async def recalculate(
    entity_id: str, 
    request_data: RecalculateRequest | None = None,
    db: AsyncSession = Depends(get_db)
):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
        
    if request_data and request_data.observations:
        if entity.field_observations:
            entity.field_observations += f"\n{request_data.observations}"
        else:
            entity.field_observations = request_data.observations
        await db.commit()

    existing = await db.execute(select(Analysis).where(Analysis.entity_id == entity_id))
    analysis = existing.scalar_one_or_none()
    if analysis:
        # Instead of deleting, just reset the analysis part so research remains
        analysis.analysis_status = "not_started"
        analysis.scores = None
        analysis.grade = None
        analysis.recommendation = None
        await db.commit()
    return {"status": "cleared", "message": "Ready to re-analyze"}
