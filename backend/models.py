"""
Pydantic request/response models for all API endpoints.
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared inner schemas (mirror the JSON stored in note_blocks.block_json)
# ---------------------------------------------------------------------------

class ConceptBoxSchema(BaseModel):
    term: str
    definition: str
    intuition: str
    why_it_matters: str


class ComparisonTableSchema(BaseModel):
    headers: list[str]
    rows: list[list[str]]


class WorkedExampleSchema(BaseModel):
    title: str
    steps: list[str]
    result: str


class SemanticBlockSchema(BaseModel):
    tag: str   # "Definition" | "Example" | "Exception" | "Trap"
    text: str


class VisualBlocksSchema(BaseModel):
    page_num: int
    content_type: str                              # "process" | "contrast" | "definition" | "mixed"
    visual_density_score: int                      # 0–100
    concept_box: Optional[ConceptBoxSchema] = None
    flow_diagram: Optional[str] = None            # Mermaid string
    comparison_table: Optional[ComparisonTableSchema] = None
    worked_examples: Optional[list[WorkedExampleSchema]] = None
    semantic_blocks: Optional[list[SemanticBlockSchema]] = None


# ---------------------------------------------------------------------------
# SolutionFlow schema
# ---------------------------------------------------------------------------

class SolutionStepSchema(BaseModel):
    step_num: int
    description: str
    formula: Optional[str] = None


class SolutionFlowSchema(BaseModel):
    question_summary: str
    steps: list[SolutionStepSchema]
    mermaid_flow: str
    error_hints: dict[str, str]   # step_num (str key) -> hint text


# ---------------------------------------------------------------------------
# ConceptGraph schema
# ---------------------------------------------------------------------------

class ConceptNodeSchema(BaseModel):
    id: str
    label: str
    mastery: float = 0.0


class ConceptEdgeSchema(BaseModel):
    from_: str
    to: str
    label: str

    class Config:
        populate_by_name = True


class ConceptGraphSchema(BaseModel):
    nodes: list[ConceptNodeSchema]
    edges: list[ConceptEdgeSchema]


# ---------------------------------------------------------------------------
# API request / response bodies
# ---------------------------------------------------------------------------

class IngestUrlRequest(BaseModel):
    url: str
    title: Optional[str] = None


class NotebookOut(BaseModel):
    id: int
    title: str
    source_type: str
    source_ref: Optional[str]
    course_id: Optional[int] = None
    page_count: int = 0

    class Config:
        from_attributes = True


class NoteBlockOut(BaseModel):
    id: int
    notebook_id: int
    page_num: int
    block_json: str   # raw JSON string; frontend parses it

    class Config:
        from_attributes = True


class ConceptMapOut(BaseModel):
    notebook_id: int
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


class TutorialFlowOut(BaseModel):
    notebook_id: int
    flow_json: str   # raw SolutionFlow JSON string


class FlagStepRequest(BaseModel):
    step_num: int


class CheckAnswerRequest(BaseModel):
    notebook_id: int
    question_text: str
    user_answer: str   # free-text or step description


class CheckAnswerResponse(BaseModel):
    error_step: Optional[int]
    hint: Optional[str]
    correct: bool
