"""
Concept map router: get and (re)generate concept graph for a notebook.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import Concept, Edge, NoteBlock, Notebook, get_db
from backend.llm import extract_concept_graph

router = APIRouter(prefix="/concept-map", tags=["concept-map"])


@router.get("/{notebook_id}")
async def get_concept_map(notebook_id: int, db: AsyncSession = Depends(get_db)):
    nb = await db.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    concepts_result = await db.execute(
        select(Concept).where(Concept.notebook_id == notebook_id)
    )
    concepts = concepts_result.scalars().all()

    edges_result = await db.execute(
        select(Edge).where(Edge.notebook_id == notebook_id)
    )
    edges = edges_result.scalars().all()

    # Build id->DB id mapping for edges
    concept_map = {c.id: c for c in concepts}

    nodes = [
        {"id": str(c.id), "label": c.label, "mastery": c.mastery}
        for c in concepts
    ]
    edge_list = [
        {
            "from": str(e.from_concept_id),
            "to": str(e.to_concept_id),
            "label": e.label or "",
        }
        for e in edges
    ]

    return {"notebook_id": notebook_id, "nodes": nodes, "edges": edge_list}


@router.post("/{notebook_id}/generate")
async def generate_concept_map(notebook_id: int, db: AsyncSession = Depends(get_db)):
    """
    (Re)generate concept map from stored note_blocks.
    Deletes existing concepts/edges first.
    """
    nb = await db.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    # Load all blocks
    result = await db.execute(
        select(NoteBlock).where(NoteBlock.notebook_id == notebook_id)
    )
    blocks = result.scalars().all()
    if not blocks:
        raise HTTPException(status_code=400, detail="No note blocks found for this notebook")

    all_blocks_data = [json.loads(b.block_json) for b in blocks]

    # Delete old concepts and edges
    old_concepts = await db.execute(
        select(Concept).where(Concept.notebook_id == notebook_id)
    )
    for c in old_concepts.scalars().all():
        await db.delete(c)

    old_edges = await db.execute(
        select(Edge).where(Edge.notebook_id == notebook_id)
    )
    for e in old_edges.scalars().all():
        await db.delete(e)

    await db.flush()

    # Generate from LLM
    graph = await extract_concept_graph(all_blocks_data)

    # Insert concepts — track LLM id -> DB id mapping
    llm_id_to_db: dict[str, int] = {}
    for node in graph.get("nodes", []):
        concept = Concept(
            notebook_id=notebook_id,
            label=node["label"],
            mastery=node.get("mastery", 0.0),
        )
        db.add(concept)
        await db.flush()  # get DB-assigned id
        llm_id_to_db[node["id"]] = concept.id

    # Insert edges
    for edge in graph.get("edges", []):
        from_llm = edge.get("from") or edge.get("from_")
        to_llm = edge.get("to")
        if from_llm not in llm_id_to_db or to_llm not in llm_id_to_db:
            continue
        db.add(Edge(
            notebook_id=notebook_id,
            from_concept_id=llm_id_to_db[from_llm],
            to_concept_id=llm_id_to_db[to_llm],
            label=edge.get("label", ""),
        ))

    await db.commit()
    return {"ok": True, "nodes_created": len(llm_id_to_db)}


@router.post("/{notebook_id}/mastery/{concept_id}")
async def update_mastery(
    notebook_id: int,
    concept_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update mastery score for a concept (0.0–1.0)."""
    concept = await db.get(Concept, concept_id)
    if not concept or concept.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Concept not found")
    concept.mastery = max(0.0, min(1.0, float(payload.get("mastery", concept.mastery))))
    await db.commit()
    return {"ok": True, "mastery": concept.mastery}
