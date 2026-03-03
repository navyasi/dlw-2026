# dlweek — AI Adaptive Learning Platform

AI-powered adaptive learning engine for a Blackboard "Study Mode" (Microsoft hackathon). The platform combines personalised content generation (visual, auditory, kinesthetic) with a mastery tracking engine (Bayesian Knowledge Tracing), intelligent scheduling, and weekly analytics.

---

## Quick Start

### Prerequisites
- Python 3.13 with venv
- Node 18+ with npm

### 1. Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY
```

### 2. Start the visual learning backend

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

> **First run only:** processes PDFs and the article via the OpenAI API (~1–3 min). Watch console for progress. Subsequent starts are instant (seed is idempotent).

### 3. Start the adaptive learning backend (root)

```bash
source .venv/bin/activate
uvicorn main:app --reload --port 8001
```

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**

### 5. Start the NTULearn clone (frontend)

```bash
cd ntulearn_clone
python3 -m http.server 5500
```

Open **http://localhost:5500**

---

## What happens on first boot (visual backend)

1. SQLite DB (`study_mode.db`) created at repo root
2. `Lecture 4.pdf` → per-page LLM call → notebook with visual note blocks
3. `Tutorial 3.pdf` → single LLM call → solution flow with steps + Mermaid diagram
4. Greenhouse Effect article → scraped → LLM → visual note block
5. Concept graph extracted for each notebook

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
dlweek/
├── main.py                     Adaptive learning API (port 8001)
├── bridge.py                   Integration helpers (mastery ↔ analytics ↔ timetable)
├── insights.py                 Weekly analytics report generator (Sia)
├── kinesthetics.py             Kinesthetic plan generator + grader
├── lecture.py                  Lecture script + TTS audio generator
├── engine_state.py             Shared MasteryEngine singleton
├── adaptive_pomodoro.py        Adaptive Pomodoro session logic
│
├── src/
│   ├── learning_model/         Core AI engine (Yajie — Person 1)
│   │   ├── models.py           Dataclasses: QuizResponse, ConceptMastery, MasteryState, PriorityScore
│   │   ├── bkt.py              Bayesian Knowledge Tracing (4-param)
│   │   ├── knowledge_graph.py  networkx prerequisite graph
│   │   ├── forgetting.py       Ebbinghaus decay + forgetting risk
│   │   └── mastery_engine.py   Main API combining BKT + graph + forgetting + OpenAI
│   └── scheduler/              Timetable engine (Chavi — Person 3)
│       ├── models.py           AvailabilityWindow, StudyBlock, DayPlan, WeekPlan
│       ├── cognitive_load.py   Burnout detection from session events
│       └── timetable.py        Pomodoro-based weekly plan generator
│
├── backend/                    Visual learning backend (port 8000)
│   ├── main.py                 FastAPI app (lifespan, CORS, /health, /ready, /pdf)
│   ├── database.py             SQLAlchemy async schema (6 tables)
│   ├── models.py               Pydantic request/response models
│   ├── llm.py                  OpenAI prompts
│   ├── pdf_utils.py            PyMuPDF per-page extractor
│   ├── scraper.py              BeautifulSoup article scraper
│   ├── seed.py                 Auto-seed pipeline (runs at startup)
│   └── routers/
│       ├── notebook.py         GET /notebooks, GET /notebooks/{id}, PATCH block
│       ├── concepts.py         GET/POST /concept-map/{id}
│       ├── tutorial.py         GET /tutorial/{id}/flow, POST flag/check
│       ├── audio.py            POST /audio/{id}/generate
│       ├── chat.py             POST /chat/
│       ├── course.py           GET /courses/, GET /courses/{id}
│       ├── quiz.py             POST /quiz/{id}/generate, POST /quiz/grade
│       ├── recall.py           POST /recall/grade
│       └── integration.py      POST /weekly-report, /integrated-weekly, /generate-lecture, etc.
│
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
│
├── ntulearn_clone/             NTULearn UI clone (Ishita's static frontend)
│   ├── index.html
│   ├── study.html
│   ├── app.js
│   └── styles.css
├── data/
│   └── sample_curriculum.json  Concept definitions with prerequisite edges
├── sample_data/
│   ├── Lecture 4.pdf
│   ├── Tutorial 3.pdf
│   └── article_url.txt
└── study_mode.db               Auto-created SQLite database
```

---

## API Reference

### Visual learning backend (port 8000)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/ready` | Seed pipeline status (poll on first boot) |
| GET | `/pdf/{filename}` | Serve a PDF for the iframe |
| GET | `/notebooks/` | List all notebooks |
| GET | `/notebooks/{id}` | Get notebook + all note blocks |
| PATCH | `/notebooks/{id}/blocks/{bid}` | Update a note block |
| GET | `/concept-map/{id}` | Get concept nodes + edges |
| POST | `/concept-map/{id}/generate` | (Re)generate concept map |
| GET | `/tutorial/{id}/flow` | Get tutorial solution flow |
| POST | `/tutorial/{id}/flag` | Flag a step as "I'm stuck" |
| POST | `/tutorial/check` | Check a free-text answer |
| POST | `/audio/{id}/generate` | Generate TTS audio for a notebook |
| DELETE | `/audio/{id}/cache` | Clear cached audio |
| POST | `/chat/` | Chat with notebook context |
| GET | `/courses/` | List all courses |
| GET | `/courses/{id}` | Get course details |
| GET | `/courses/{id}/concept-map` | Course-level concept map |
| POST | `/courses/{id}/concept-map/generate` | (Re)generate course concept map |
| POST | `/quiz/{id}/generate` | Generate quiz for a notebook |
| POST | `/quiz/grade` | Grade quiz responses |
| POST | `/quiz/session-events` | Record quiz session events |
| POST | `/recall/grade` | Grade a free-recall response |

### Adaptive learning backend (port 8001)

| Method | Path | Description |
|---|---|---|
| POST | `/weekly-report` | Analytics report from concept mastery data |
| POST | `/integrated-weekly` | Full loop: quiz results → mastery → report + timetable |
| POST | `/generate-kinesthetic` | Generate kinesthetic activity plan from PDF |
| POST | `/grade-kinesthetic` | Grade completed kinesthetic activity |
| POST | `/generate-lecture` | Generate TTS audio lecture from PDF |

---

## Dyslexia Mode

Toggle the **Dyslexia Mode** switch in the top-right navigation bar. It:
- Switches to Arial font with wider letter/word spacing
- Increases line height to 2.0
- Enlarges card padding
- Persists to `localStorage`
