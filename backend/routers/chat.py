"""
Chat router: context-aware Q&A over a notebook's note blocks.
"""
from __future__ import annotations

import json
from typing import Any
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import NoteBlock, Notebook, get_db
from backend.llm import MODEL, client

router = APIRouter(prefix="/chat", tags=["chat"])

CHAT_SYSTEM = (
    "You are a concise visual-learning tutor. Keep ALL answers SHORT — max 4-5 sentences or 4 bullet points. "
    "Prefer bullet points over paragraphs. Use bold for key terms. "
    "If you need to explain a process, use numbered steps. "
    "Never write walls of text. If the question has a yes/no answer, give it first then explain briefly. "
    "You have context from the student's AI study notes — use it to give specific, grounded answers."
)


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    notebook_id: Optional[int] = None
    course_id: Optional[int] = None   # if set, context spans all course notebooks
    messages: list[ChatMessage]    # conversation history


class ChatResponse(BaseModel):
    reply: str


@router.post("/", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: AsyncSession = Depends(get_db)):
    # Build context from note blocks
    context_blocks: list[str] = []

    if payload.notebook_id:
        result = await db.execute(
            select(NoteBlock)
            .where(NoteBlock.notebook_id == payload.notebook_id)
            .order_by(NoteBlock.page_num)
        )
        blocks = result.scalars().all()
        for b in blocks[:10]:  # cap at 10 slides to stay within token budget
            try:
                d = json.loads(b.block_json)
                cb = d.get("concept_box", {})
                if cb:
                    context_blocks.append(
                        f"[Slide {b.page_num}] {cb.get('term', '')}: {cb.get('definition', '')}. "
                        f"Intuition: {cb.get('intuition', '')}."
                    )
                for sb in (d.get("semantic_blocks") or [])[:3]:
                    context_blocks.append(f"  • [{sb.get('tag')}] {sb.get('text', '')}")
            except Exception:
                pass

    elif payload.course_id:
        from backend.database import Notebook as NB
        nb_result = await db.execute(
            select(NB).where(
                NB.course_id == payload.course_id,
                NB.source_type.in_(["slides", "article"])
            ).order_by(NB.section_order, NB.id)
        )
        for nb in nb_result.scalars().all():
            blocks_result = await db.execute(
                select(NoteBlock).where(NoteBlock.notebook_id == nb.id)
                .order_by(NoteBlock.page_num).limit(5)
            )
            for b in blocks_result.scalars().all():
                try:
                    d = json.loads(b.block_json)
                    cb = d.get("concept_box", {})
                    if cb:
                        context_blocks.append(
                            f"[{nb.title} – Slide {b.page_num}] {cb.get('term', '')}: {cb.get('definition', '')}"
                        )
                except Exception:
                    pass

    context_str = "\n".join(context_blocks[:40]) if context_blocks else "No specific context loaded."

    system_msg = f"{CHAT_SYSTEM}\n\n--- COURSE NOTES CONTEXT ---\n{context_str}\n---"

    messages = [{"role": "system", "content": system_msg}]
    for m in payload.messages[-12:]:  # keep last 12 turns
        messages.append({"role": m.role, "content": m.content})

    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,  # type: ignore
        temperature=0.4,
        max_tokens=800,
    )

    return ChatResponse(reply=response.choices[0].message.content or "")
