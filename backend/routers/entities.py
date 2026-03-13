from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Entity
from pydantic import BaseModel
from typing import Optional
import datetime

router = APIRouter()


class EntityCreate(BaseModel):
    company_name: str
    cin: Optional[str] = None
    pan: Optional[str] = None
    incorporation_year: Optional[int] = None
    registered_address: Optional[str] = None
    website: Optional[str] = None
    credit_rating: Optional[str] = None
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    annual_turnover_cr: Optional[float] = None
    employee_count: Optional[int] = None
    loan_type: Optional[str] = None
    loan_amount_cr: float
    loan_tenure_months: Optional[int] = None
    interest_rate_pct: Optional[float] = None
    loan_purpose: Optional[str] = None
    collateral: Optional[str] = None


class EntityUpdate(BaseModel):
    company_name: Optional[str] = None
    cin: Optional[str] = None
    pan: Optional[str] = None
    incorporation_year: Optional[int] = None
    registered_address: Optional[str] = None
    website: Optional[str] = None
    credit_rating: Optional[str] = None
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    annual_turnover_cr: Optional[float] = None
    employee_count: Optional[int] = None
    loan_type: Optional[str] = None
    loan_amount_cr: Optional[float] = None
    loan_tenure_months: Optional[int] = None
    interest_rate_pct: Optional[float] = None
    loan_purpose: Optional[str] = None
    collateral: Optional[str] = None


@router.post("/", status_code=201)
async def create_entity(payload: EntityCreate, db: AsyncSession = Depends(get_db)):
    entity = Entity(**payload.model_dump())
    db.add(entity)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.get("/")
async def list_entities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Entity).order_by(Entity.created_at.desc()))
    return result.scalars().all()


@router.get("/{entity_id}")
async def get_entity(entity_id: str, db: AsyncSession = Depends(get_db)):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    return entity


@router.patch("/{entity_id}")
async def update_entity(entity_id: str, payload: EntityUpdate, db: AsyncSession = Depends(get_db)):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entity, k, v)
    entity.updated_at = datetime.datetime.utcnow()
    await db.commit()
    await db.refresh(entity)
    return entity


@router.delete("/{entity_id}", status_code=204)
async def delete_entity(entity_id: str, db: AsyncSession = Depends(get_db)):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    await db.delete(entity)
    await db.commit()
