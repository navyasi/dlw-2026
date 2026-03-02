"""
OpenAI async wrapper with all 4 prompt builders.
All responses use response_format={"type": "json_object"} for guaranteed JSON.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

# Load .env before the OpenAI client is constructed (stdlib only, no python-dotenv needed)
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

from openai import AsyncOpenAI  # noqa: E402 — must be after env load

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Best model for structured JSON generation
MODEL = "gpt-4o"

# ---------------------------------------------------------------------------
# Shared JSON system context
# ---------------------------------------------------------------------------
_JSON_SYSTEM = (
    "You are a visual-learning tutor that converts educational content into "
    "structured JSON for visual learners. "
    "Output ONLY valid JSON — no markdown fences, no prose outside the JSON object."
)

# ---------------------------------------------------------------------------
# 1. Slide → VisualBlocks
# ---------------------------------------------------------------------------
SLIDE_SYSTEM = _JSON_SYSTEM

SLIDE_USER_TEMPLATE = """\
Slide {page_num} content:
---
{slide_text}
---

Produce a JSON object matching this EXACT schema (omit null fields):
{{
  "page_num": {page_num},
  "content_type": "<process|contrast|definition|mixed>",
  "visual_density_score": <0-100, higher = more diagram-worthy>,
  "concept_box": {{
    "term": "<main concept name>",
    "definition": "<concise definition>",
    "intuition": "<plain-English analogy or intuition>",
    "why_it_matters": "<one sentence on real-world relevance>"
  }},
  "flow_diagram": "<Mermaid flowchart TD string — ONLY if content_type is process>",
  "comparison_table": {{
    "headers": ["<col1>", "<col2>"],
    "rows": [["<val>", "<val>"]]
  }},
  "worked_examples": [
    {{"title": "<example title>", "steps": ["<step>"], "result": "<final answer>"}}
  ],
  "semantic_blocks": [
    {{"tag": "<Definition|Example|Exception|Trap>", "text": "<content>"}}
  ]
}}

Rules:
- Populate flow_diagram with valid Mermaid "graph TD" syntax ONLY if content_type is "process".
- Populate comparison_table ONLY if content_type is "contrast".
- Always populate concept_box and at least 2 semantic_blocks.
- Include 1–2 worked_examples if the slide discusses calculations or procedures.
- visual_density_score: 80+ means you must output a flow diagram or table.
"""


async def slide_to_visual_blocks(slide_text: str, page_num: int) -> dict:
    response = await client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SLIDE_SYSTEM},
            {"role": "user", "content": SLIDE_USER_TEMPLATE.format(
                page_num=page_num, slide_text=slide_text[:6000]
            )},
        ],
        temperature=0.2,
    )
    return json.loads(response.choices[0].message.content)


# ---------------------------------------------------------------------------
# 2. Article → VisualBlocks
# ---------------------------------------------------------------------------
ARTICLE_USER_TEMPLATE = """\
Article URL: {url}
Article text:
---
{article_text}
---

Produce a JSON object matching the SAME VisualBlocks schema as for a slide.
Use page_num = 1.
Focus on the article's main concept, its key process or comparison, and 1–2 concrete examples.
If the article explains a process (how something works), set content_type to "process" and populate flow_diagram.
If the article compares things, set content_type to "contrast" and populate comparison_table.
Always populate concept_box and at least 3 semantic_blocks.
"""


async def article_to_visual_blocks(article_text: str, url: str) -> dict:
    response = await client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SLIDE_SYSTEM},
            {"role": "user", "content": ARTICLE_USER_TEMPLATE.format(
                url=url, article_text=article_text[:8000]
            )},
        ],
        temperature=0.2,
    )
    return json.loads(response.choices[0].message.content)


# ---------------------------------------------------------------------------
# 3. Tutorial → Multi-Question SolutionFlow
# ---------------------------------------------------------------------------
TUTORIAL_SYSTEM = (
    "You are a step-by-step math and logic tutor for visual learners. "
    "Output ONLY valid JSON — no markdown fences, no prose outside the JSON object."
)

TUTORIAL_USER_TEMPLATE = """\
Here is the full tutorial sheet with multiple questions:
---
{tutorial_text}
---

Extract ALL questions from the sheet and produce a JSON object:
{{
  "questions": [
    {{
      "question_num": 1,
      "question_text": "<the full question text, verbatim>",
      "summary": "<one-sentence summary of what is being asked>",
      "steps": [
        {{
          "step_num": 1,
          "description": "<action-oriented, concise step>",
          "formula": "<formula/equation string, or null>"
        }}
      ],
      "full_answer": "<complete worked solution in plain English, 3-6 sentences, include final numeric/descriptive values>",
      "mermaid_flow": "<Mermaid graph TD: S1[label]-->S2[label] etc>",
      "error_hints": {{
        "1": "<most common mistake at step 1>",
        "2": "<most common mistake at step 2>"
      }}
    }}
  ]
}}

Rules:
- Include EVERY numbered question. Do not skip any.
- steps: atomic steps covering the full worked solution.
- full_answer: complete solution readable by a student — include final conclusions.
- mermaid_flow: S1->S2->... nodes connected in order.
- error_hints: one entry per step (string key).
- formula: null if not applicable.
"""


async def tutorial_to_solution_flow(tutorial_text: str) -> dict:
    response = await client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": TUTORIAL_SYSTEM},
            {"role": "user", "content": TUTORIAL_USER_TEMPLATE.format(
                tutorial_text=tutorial_text[:12000]
            )},
        ],
        temperature=0.2,
    )
    return json.loads(response.choices[0].message.content)



# ---------------------------------------------------------------------------
# 4. Concept Graph Extraction
# ---------------------------------------------------------------------------
CONCEPT_SYSTEM = (
    "You extract a concept dependency graph from lecture notes JSON. "
    "Output ONLY valid JSON — no markdown fences, no prose outside the JSON object."
)

CONCEPT_USER_TEMPLATE = """\
Here are all visual note blocks from a course notebook (JSON array):
---
{blocks_json}
---

Produce a JSON object matching this EXACT schema:
{{
  "nodes": [
    {{"id": "c1", "label": "<concept name>", "mastery": 0.0}}
  ],
  "edges": [
    {{"from": "c1", "to": "c2", "label": "<depends on|leads to|part of>"}}
  ]
}}

Rules:
- Extract 5–15 key concept nodes from the content.
- Edges represent meaningful academic relationships (prerequisite, consequence, example-of, etc).
- Set mastery to 0.0 for all nodes.
- Node ids must be unique strings: "c1", "c2", etc.
- Use "from" (not "from_") as the JSON key.
"""


async def extract_concept_graph(all_blocks: list[dict]) -> dict:
    blocks_json = json.dumps(all_blocks, indent=2)[:10000]
    response = await client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": CONCEPT_SYSTEM},
            {"role": "user", "content": CONCEPT_USER_TEMPLATE.format(
                blocks_json=blocks_json
            )},
        ],
        temperature=0.3,
    )
    return json.loads(response.choices[0].message.content)
