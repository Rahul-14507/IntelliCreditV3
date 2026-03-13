from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base
from uuid import uuid4
import datetime


class Entity(Base):
    __tablename__ = "entities"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))

    # Stage 1 — Company Identity
    company_name = Column(String, nullable=False)
    cin = Column(String)
    pan = Column(String)
    incorporation_year = Column(Integer)
    registered_address = Column(Text)
    website = Column(String)
    credit_rating = Column(String)

    # Stage 1 — Business Profile
    sector = Column(String)
    sub_sector = Column(String)
    annual_turnover_cr = Column(Float)
    employee_count = Column(Integer)

    # Stage 1 — Loan Details
    loan_type = Column(String)
    loan_amount_cr = Column(Float, nullable=False)
    loan_tenure_months = Column(Integer)
    interest_rate_pct = Column(Float)
    loan_purpose = Column(Text)
    collateral = Column(Text)
    field_observations = Column(Text)

    # Pipeline status
    status = Column(String, default="onboarding")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    documents = relationship("Document", back_populates="entity", cascade="all, delete-orphan")
    analysis = relationship("Analysis", back_populates="entity", uselist=False, cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    entity_id = Column(String, ForeignKey("entities.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String)

    # Stage 2 — Raw Extraction
    raw_text = Column(Text)
    raw_tables = Column(JSON)
    page_count = Column(Integer)
    extraction_status = Column(String, default="pending")
    extraction_error = Column(Text)

    # Stage 3A — Classification
    predicted_doc_type = Column(String)
    predicted_confidence = Column(Float)
    predicted_reasoning = Column(Text)
    predicted_signals = Column(JSON)
    confirmed_doc_type = Column(String)
    classification_status = Column(String, default="pending")

    # Stage 3B — Schema
    schema_fields = Column(JSON)
    schema_locked = Column(Boolean, default=False)

    # Stage 3C — Extraction
    extracted_data = Column(JSON)
    extraction_confidence = Column(Float)
    extraction_notes = Column(JSON)
    schema_status = Column(String, default="pending")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    entity = relationship("Entity", back_populates="documents")


class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    entity_id = Column(String, ForeignKey("entities.id"), nullable=False, unique=True)

    # Stage 4A — Tavily Research
    news_results = Column(JSON)
    legal_results = Column(JSON)
    macro_results = Column(JSON)
    sentiment = Column(JSON)
    research_status = Column(String, default="pending")

    # Stage 4B — AI Scoring
    scores = Column(JSON)
    grade = Column(String)
    recommendation = Column(String)
    reasoning_chain = Column(JSON)

    # Stage 4C — Outputs
    swot = Column(JSON)
    triangulation = Column(JSON)
    key_risks = Column(JSON)
    mitigants = Column(JSON)
    conditions = Column(JSON)

    # Loan recommendation
    recommended_limit_cr = Column(Float)
    recommended_rate_pct = Column(Float)
    recommended_tenure_months = Column(Integer)

    executive_summary = Column(Text)
    analysis_status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    entity = relationship("Entity", back_populates="analysis")
