"""
Notebook router: list / load / patch note blocks.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import Notebook, NoteBlock, get_db
from backend.models import NoteBlockOut, NotebookOut

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


@router.get("/", response_model=list[NotebookOut])
async def list_notebooks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notebook).options(selectinload(Notebook.note_blocks)).order_by(Notebook.id)
    )
    notebooks = result.scalars().all()
    out = []
    for nb in notebooks:
        out.append(NotebookOut(
            id=nb.id,
            title=nb.title,
            source_type=nb.source_type,
            source_ref=nb.source_ref,
            course_id=nb.course_id,
            page_count=len(nb.note_blocks),
        ))
    return out


@router.get("/{notebook_id}", response_model=dict[str, Any])
async def get_notebook(notebook_id: int, db: AsyncSession = Depends(get_db)):
    nb = await db.get(Notebook, notebook_id)
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await db.execute(
        select(NoteBlock)
        .where(NoteBlock.notebook_id == notebook_id)
        .order_by(NoteBlock.page_num)
    )
    blocks = result.scalars().all()

    return {
        "id": nb.id,
        "title": nb.title,
        "source_type": nb.source_type,
        "source_ref": nb.source_ref,
        "note_blocks": [
            {
                "id": b.id,
                "page_num": b.page_num,
                "block": json.loads(b.block_json),
            }
            for b in blocks
        ],
    }


@router.patch("/{notebook_id}/blocks/{block_id}")
async def update_block(
    notebook_id: int,
    block_id: int,
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    block = await db.get(NoteBlock, block_id)
    if not block or block.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Block not found")

    block.block_json = json.dumps(payload)
    await db.commit()
    return {"ok": True}
