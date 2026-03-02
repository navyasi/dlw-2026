# Study Mode — Visual Learning MVP

AI-powered web app for visual learners (VARK). Ingests lecture slides, article URLs, and tutorial PDFs → generates coloured note blocks, flow diagrams, concept maps, and step-by-step tutorial guides.

---

## Quick Start

### Prerequisites
- Python 3.11+ with `uv` (`pip install uv` or `brew install uv`)
- Node 18+ with npm

### 1. Environment

Your `.env` already has `OPENAI_API_KEY`. The backend reads it automatically.

### 2. Add your materials

Place files in `sample_data/`:
```
sample_data/
  Lecture 4.pdf       ← lecture slides (already there)
  Tutorial 3.pdf      ← tutorial PDF (already there)
  article_url.txt     ← article URL(s), one per line (already there)
```

### 3. Start the backend

```bash
# From repo root
uv run uvicorn backend.main:app --reload --port 8000
```

> **First run only:** the backend will process all PDFs and the article through the OpenAI API. This takes ~1–3 minutes depending on the number of pages. Watch the console for progress.

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**

---

## What happens on first boot

1. SQLite DB (`study_mode.db`) is created at the repo root
2. `Lecture 4.pdf` → per-page LLM call → notebook with visual note blocks
3. `Tutorial 3.pdf` → single LLM call → solution flow with steps + Mermaid diagram
4. Greenhouse Effect article → scraped → LLM → visual note block
5. Concept graph extracted for each slides/article notebook

On subsequent starts, the seed is **skipped** (idempotent) — startup is instant.

---

## App Screens

| URL | Screen |
|---|---|
| `/` | Dashboard — notebook cards |
| `/notebook/[id]` | Visual Notebook — split-pane, PDF on left, AI notes on right |
| `/concept-map/[id]` | Concept Map — ReactFlow graph with mastery colours |
| `/tutorial/[id]` | Tutorial Practice — step list or flow diagram, click to flag |

---

## Repo Structure

```
dlw-2026/
├── backend/
│   ├── main.py          FastAPI app (CORS, lifespan, /pdf endpoint)
│   ├── database.py      SQLAlchemy async schema (6 tables)
│   ├── models.py        Pydantic request/response models
│   ├── llm.py           OpenAI prompts (4 functions)
│   ├── pdf_utils.py     PyMuPDF per-page extractor
│   ├── scraper.py       BeautifulSoup article scraper
│   ├── seed.py          Auto-seed pipeline (runs at startup)
│   └── routers/
│       ├── notebook.py  GET /notebooks, GET /notebooks/{id}
│       ├── concepts.py  GET/POST /concept-map/{id}
│       └── tutorial.py  GET /tutorial/{id}/flow, POST flag/check
├── frontend/
│   ├── app/
│   │   ├── page.tsx                    Dashboard
│   │   ├── notebook/[id]/page.tsx      Visual Notebook (split-pane)
│   │   ├── concept-map/[id]/page.tsx   Concept Map
│   │   └── tutorial/[id]/page.tsx      Tutorial Practice
│   ├── components/
│   │   ├── TopNav.tsx
│   │   ├── DyslexiaToggle.tsx
│   │   ├── ConceptBox.tsx
│   │   ├── FlowDiagram.tsx     (Mermaid.js, client-side only)
│   │   ├── ComparisonTable.tsx
│   │   ├── WorkedExamples.tsx
│   │   ├── SemanticBlocks.tsx
│   │   ├── TutorialFlow.tsx
│   │   └── ConceptMap.tsx      (ReactFlow, client-side only)
│   └── lib/
│       └── api.ts              Typed API client
├── sample_data/
│   ├── Lecture 4.pdf
│   ├── Tutorial 3.pdf
│   └── article_url.txt
└── study_mode.db               Auto-created SQLite database
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/notebooks/` | List all notebooks |
| GET | `/notebooks/{id}` | Get notebook + all note blocks |
| PATCH | `/notebooks/{id}/blocks/{bid}` | Update a note block |
| GET | `/concept-map/{id}` | Get concept nodes + edges |
| POST | `/concept-map/{id}/generate` | (Re)generate concept map |
| GET | `/tutorial/{id}/flow` | Get tutorial solution flow |
| POST | `/tutorial/{id}/flag` | Flag a step as "I'm stuck" |
| POST | `/tutorial/check` | Check a free-text answer |
| GET | `/pdf/{filename}` | Serve a PDF for the iframe |

---

## Dyslexia Mode

Toggle the **Dyslexia Mode** switch in the top-right navigation bar. It:
- Switches to Arial font with wider letter/word spacing
- Increases line height to 2.0
- Enlarges card padding
- Persists to `localStorage`
