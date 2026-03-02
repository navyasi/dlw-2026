"""
Course router: list courses and get a full course with its notebooks grouped
into lectures/articles and tutorials.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import Concept, Course, Edge, NoteBlock, Notebook, get_db

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("/", response_model=list[dict[str, Any]])
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Course).options(selectinload(Course.notebooks)).order_by(Course.id)
    )
    courses = result.scalars().all()
    out = []
    for c in courses:
        lectures = [n for n in c.notebooks if n.source_type in ("slides", "article")]
        tutorials = [n for n in c.notebooks if n.source_type == "tutorial"]
        out.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "lecture_count": len(lectures),
            "tutorial_count": len(tutorials),
        })
    return out


@router.get("/{course_id}", response_model=dict[str, Any])
async def get_course(course_id: int, db: AsyncSession = Depends(get_db)):
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    result = await db.execute(
        select(Notebook)
        .where(Notebook.course_id == course_id)
        .order_by(Notebook.section_order, Notebook.id)
    )
    notebooks = result.scalars().all()

    lectures = []
    tutorials = []
    for nb in notebooks:
        blocks_result = await db.execute(
            select(NoteBlock).where(NoteBlock.notebook_id == nb.id).order_by(NoteBlock.page_num)
        )
        block_count = len(blocks_result.scalars().all())
        entry = {
            "id": nb.id,
            "title": nb.title,
            "source_type": nb.source_type,
            "source_ref": nb.source_ref,
            "section_order": nb.section_order,
            "page_count": block_count,
        }
        if nb.source_type == "tutorial":
            tutorials.append(entry)
        else:
            lectures.append(entry)

    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "lectures": lectures,
        "tutorials": tutorials,
        "lecture_count": len(lectures),
        "tutorial_count": len(tutorials),
    }


@router.get("/{course_id}/concept-map", response_model=dict[str, Any])
async def get_course_concept_map(course_id: int, db: AsyncSession = Depends(get_db)):
    """
    Aggregate concept graph across ALL lecture notebooks in a course.
    Each concept node has a source_notebook label for provenance.
    """
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    nb_result = await db.execute(
        select(Notebook).where(
            Notebook.course_id == course_id,
            Notebook.source_type.in_(["slides", "article"])
        ).order_by(Notebook.section_order, Notebook.id)
    )
    notebooks = nb_result.scalars().all()

    nodes: list[dict] = []
    edges: list[dict] = []

    for nb in notebooks:
        concepts_result = await db.execute(
            select(Concept).where(Concept.notebook_id == nb.id)
        )
        concepts = concepts_result.scalars().all()
        concept_map = {c.id: c for c in concepts}

        for c in concepts:
            nodes.append({
                "id": str(c.id),
                "label": c.label,
                "mastery": c.mastery,
                "notebook_title": nb.title,
            })

        edges_result = await db.execute(
            select(Edge).where(Edge.notebook_id == nb.id)
        )
        for e in edges_result.scalars().all():
            edges.append({
                "from": str(e.from_concept_id),
                "to": str(e.to_concept_id),
                "label": e.label or "",
            })

    return {"course_id": course_id, "nodes": nodes, "edges": edges}


@router.post("/{course_id}/concept-map/generate")
async def generate_course_concept_map(course_id: int, db: AsyncSession = Depends(get_db)):
    """
    (Re)generate concept maps for all lecture notebooks in this course,
    then return the aggregated graph.
    """
    nb_result = await db.execute(
        select(Notebook).where(
            Notebook.course_id == course_id,
            Notebook.source_type.in_(["slides", "article"])
        )
    )
    notebooks = nb_result.scalars().all()

    from backend.routers.concepts import generate_concept_map
    from fastapi import Request

    for nb in notebooks:
        try:
            # Reuse existing per-notebook generation logic
            blocks_result = await db.execute(
                select(NoteBlock).where(NoteBlock.notebook_id == nb.id)
            )
            blocks = blocks_result.scalars().all()
            if not blocks:
                continue

            import json as _json
            from backend.llm import extract_concept_graph
            from backend.database import Concept as C, Edge as E

            all_blocks_data = [_json.loads(b.block_json) for b in blocks]

            # Delete old
            old_c = await db.execute(select(C).where(C.notebook_id == nb.id))
            for c in old_c.scalars().all():
                await db.delete(c)
            old_e = await db.execute(select(E).where(E.notebook_id == nb.id))
            for e in old_e.scalars().all():
                await db.delete(e)
            await db.flush()

            graph = await extract_concept_graph(all_blocks_data)
            llm_map: dict[str, int] = {}
            for node in graph.get("nodes", []):
                concept = C(notebook_id=nb.id, label=node["label"], mastery=0.0)
                db.add(concept)
                await db.flush()
                llm_map[node["id"]] = concept.id

            for edge in graph.get("edges", []):
                f = edge.get("from") or edge.get("from_")
                t = edge.get("to")
                if f in llm_map and t in llm_map:
                    db.add(E(notebook_id=nb.id, from_concept_id=llm_map[f], to_concept_id=llm_map[t], label=edge.get("label", "")))

            await db.commit()
        except Exception as ex:
            import logging
            logging.getLogger(__name__).warning(f"Concept map gen failed for nb {nb.id}: {ex}")

    return {"ok": True}
