"""
Seed pipeline: processes all materials in sample_data/ and populates the DB.
Idempotent: skips any notebook whose source_ref already exists in the DB.
Called from FastAPI lifespan on startup.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import select

from backend.database import AsyncSessionLocal, Course, NoteBlock, Notebook, TutorialFlow
from backend.llm import (
    article_to_visual_blocks,
    extract_concept_graph,
    slide_to_visual_blocks,
    tutorial_to_solution_flow,
)
from backend.pdf_utils import extract_full_text, extract_pages
from backend.scraper import scrape_article

logger = logging.getLogger(__name__)

SAMPLE_DIR = Path(__file__).parent.parent / "sample_data"
COURSE_TITLE = "Climate & Earth Systems"   # default course name for demo


async def _get_or_create_course(db) -> int:
    result = await db.execute(select(Course).limit(1))
    course = result.scalars().first()
    if not course:
        course = Course(
            title=COURSE_TITLE,
            description="AI-generated visual notes from lecture slides, articles, and tutorials.",
        )
        db.add(course)
        await db.flush()
        logger.info(f"Created course id={course.id}: {COURSE_TITLE}")
    return course.id


async def _notebook_exists(db, source_ref: str) -> bool:
    result = await db.execute(
        select(Notebook).where(Notebook.source_ref == source_ref)
    )
    return result.scalars().first() is not None


async def seed_slides(db, pdf_path: Path, course_id: int, section_order: int) -> int | None:
    source_ref = pdf_path.name
    if await _notebook_exists(db, source_ref):
        logger.info(f"Slides notebook already exists for {source_ref}, skipping.")
        return None

    logger.info(f"Seeding slides: {pdf_path.name}")
    pages = extract_pages(str(pdf_path))

    nb = Notebook(
        course_id=course_id,
        title=pdf_path.stem.replace("_", " ").replace("-", " "),
        source_type="slides",
        source_ref=source_ref,
        section_order=section_order,
    )
    db.add(nb)
    await db.flush()

    for page_num, page_text in pages:
        try:
            block = await slide_to_visual_blocks(page_text, page_num)
        except Exception as e:
            logger.warning(f"LLM failed for page {page_num}: {e}")
            block = {"page_num": page_num, "content_type": "definition", "visual_density_score": 0}

        db.add(NoteBlock(notebook_id=nb.id, page_num=page_num, block_json=json.dumps(block)))

    await db.commit()
    logger.info(f"Slides notebook created: id={nb.id}, pages={len(pages)}")
    return nb.id


async def seed_tutorial(db, pdf_path: Path, course_id: int, section_order: int) -> int | None:
    source_ref = pdf_path.name
    if await _notebook_exists(db, source_ref):
        logger.info(f"Tutorial notebook already exists for {source_ref}, skipping.")
        return None

    logger.info(f"Seeding tutorial: {pdf_path.name}")
    full_text = extract_full_text(str(pdf_path))

    nb = Notebook(
        course_id=course_id,
        title=pdf_path.stem.replace("_", " ").replace("-", " "),
        source_type="tutorial",
        source_ref=source_ref,
        section_order=section_order,
    )
    db.add(nb)
    await db.flush()

    try:
        flow = await tutorial_to_solution_flow(full_text)
    except Exception as e:
        logger.warning(f"LLM failed for tutorial: {e}")
        flow = {"question_summary": "Error generating flow", "steps": [], "mermaid_flow": "", "error_hints": {}}

    db.add(TutorialFlow(notebook_id=nb.id, flow_json=json.dumps(flow)))
    await db.commit()
    logger.info(f"Tutorial notebook created: id={nb.id}")
    return nb.id


async def seed_articles(db, txt_path: Path, course_id: int, start_order: int) -> list[int]:
    notebook_ids = []
    urls = [line.strip().rstrip(".") for line in txt_path.read_text().splitlines() if line.strip()]

    for i, url in enumerate(urls):
        if await _notebook_exists(db, url):
            logger.info(f"Article notebook already exists for {url}, skipping.")
            continue

        logger.info(f"Seeding article: {url}")
        try:
            text = scrape_article(url)
            block = await article_to_visual_blocks(text, url)
        except Exception as e:
            logger.warning(f"Failed to scrape/process {url}: {e}")
            continue

        title = url.rstrip("/").split("/")[-1].replace("-", " ").replace("_", " ").title()
        nb = Notebook(
            course_id=course_id,
            title=title or "Article",
            source_type="article",
            source_ref=url,
            section_order=start_order + i,
        )
        db.add(nb)
        await db.flush()

        db.add(NoteBlock(notebook_id=nb.id, page_num=1, block_json=json.dumps(block)))
        await db.commit()
        notebook_ids.append(nb.id)
        logger.info(f"Article notebook created: id={nb.id}")

    return notebook_ids


async def seed_concept_graphs(notebook_ids: list[int]) -> None:
    """Generate concept maps for the given notebook ids (slides/articles only)."""
    for nb_id in notebook_ids:
        try:
            async with AsyncSessionLocal() as db:
                from backend.database import NoteBlock as NB, Concept, Edge
                import json as _json

                # Only generate for non-tutorial notebooks
                nb = await db.get(Notebook, nb_id)
                if not nb or nb.source_type == "tutorial":
                    continue

                result = await db.execute(select(NB).where(NB.notebook_id == nb_id))
                blocks = result.scalars().all()
                if not blocks:
                    continue

                all_blocks_data = [_json.loads(b.block_json) for b in blocks]
                graph = await extract_concept_graph(all_blocks_data)

                llm_id_to_db: dict[str, int] = {}
                for node in graph.get("nodes", []):
                    concept = Concept(notebook_id=nb_id, label=node["label"], mastery=0.0)
                    db.add(concept)
                    await db.flush()
                    llm_id_to_db[node["id"]] = concept.id

                for edge in graph.get("edges", []):
                    from_llm = edge.get("from") or edge.get("from_")
                    to_llm = edge.get("to")
                    if from_llm not in llm_id_to_db or to_llm not in llm_id_to_db:
                        continue
                    db.add(Edge(
                        notebook_id=nb_id,
                        from_concept_id=llm_id_to_db[from_llm],
                        to_concept_id=llm_id_to_db[to_llm],
                        label=edge.get("label", ""),
                    ))
                await db.commit()
                logger.info(f"Concept graph for notebook {nb_id}: {len(llm_id_to_db)} nodes")
        except Exception as e:
            logger.warning(f"Concept graph failed for notebook {nb_id}: {e}")


async def run_seed() -> None:
    """Main entry point called from FastAPI lifespan."""
    if not SAMPLE_DIR.exists():
        logger.info("No sample_data/ directory found, skipping seed.")
        return

    lecture_ids: list[int] = []
    tutorial_ids: list[int] = []

    async with AsyncSessionLocal() as db:
        course_id = await _get_or_create_course(db)
        section_order = 0

        # Slide PDFs
        for pdf in sorted(SAMPLE_DIR.glob("*.pdf")):
            if "tutorial" in pdf.name.lower():
                continue
            nb_id = await seed_slides(db, pdf, course_id, section_order)
            if nb_id:
                lecture_ids.append(nb_id)
                section_order += 1

        # Article URLs (placed after slides)
        url_file = SAMPLE_DIR / "article_url.txt"
        if url_file.exists():
            ids = await seed_articles(db, url_file, course_id, section_order)
            lecture_ids.extend(ids)
            section_order += len(ids)

        # Tutorial PDFs
        tut_order = 0
        for pdf in sorted(SAMPLE_DIR.glob("*.pdf")):
            if "tutorial" in pdf.name.lower():
                nb_id = await seed_tutorial(db, pdf, course_id, tut_order)
                if nb_id:
                    tutorial_ids.append(nb_id)
                    tut_order += 1

    # Generate concept graphs for lectures/articles only
    await seed_concept_graphs(lecture_ids)

    logger.info(f"Seed complete. Lectures: {lecture_ids}, Tutorials: {tutorial_ids}")
