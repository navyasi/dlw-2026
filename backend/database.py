"""
SQLAlchemy async database setup + table definitions.
Uses aiosqlite as the async driver for SQLite.
"""
from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "study_mode.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

class Course(Base):
    """A course groups multiple notebooks (lectures + tutorials) together."""
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    notebooks = relationship("Notebook", back_populates="course")


class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    title = Column(String(255), nullable=False)
    section_order = Column(Integer, default=0)  # ordering within a course
    source_type = Column(String(50), nullable=False)   # "slides" | "article" | "tutorial"
    source_ref = Column(String(512), nullable=True)    # filename or URL
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="notebooks")
    note_blocks = relationship("NoteBlock", back_populates="notebook", cascade="all, delete-orphan")
    concepts = relationship("Concept", back_populates="notebook", cascade="all, delete-orphan")
    edges = relationship("Edge", back_populates="notebook", cascade="all, delete-orphan")
    attempts = relationship("Attempt", back_populates="notebook", cascade="all, delete-orphan")
    tutorial_flow = relationship("TutorialFlow", back_populates="notebook", uselist=False, cascade="all, delete-orphan")
    kinesthetic_plan = relationship("KinestheticPlan", back_populates="notebook", uselist=False, cascade="all, delete-orphan")

class NoteBlock(Base):
    __tablename__ = "note_blocks"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    page_num = Column(Integer, nullable=False)
    block_json = Column(Text, nullable=False)  # JSON string — VisualBlocks schema

    notebook = relationship("Notebook", back_populates="note_blocks")


class Concept(Base):
    __tablename__ = "concepts"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    label = Column(String(255), nullable=False)
    mastery = Column(Float, default=0.0)

    notebook = relationship("Notebook", back_populates="concepts")


class Edge(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    from_concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=False)
    to_concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=False)
    label = Column(String(255), nullable=True)

    notebook = relationship("Notebook", back_populates="edges")


class TutorialFlow(Base):
    """Stores the SolutionFlow JSON for a tutorial notebook."""
    __tablename__ = "tutorial_flows"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False, unique=True)
    flow_json = Column(Text, nullable=False)   # JSON string — SolutionFlow schema

    notebook = relationship("Notebook", back_populates="tutorial_flow")


class KinestheticPlan(Base):
    """Stores the generated Kinesthetic plan (activities + quiz) for a notebook."""
    __tablename__ = "kinesthetic_plans"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False, unique=True)
    plan_json = Column(Text, nullable=False)   # JSON string

    notebook = relationship("Notebook", back_populates="kinesthetic_plan")

class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    question_text = Column(Text, nullable=True)
    user_answer = Column(Text, nullable=True)
    error_step = Column(Integer, nullable=True)
    flagged_step = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    notebook = relationship("Notebook", back_populates="attempts")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
