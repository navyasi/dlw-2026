"""
PDF text extraction using PyMuPDF (fitz).
Returns a list of (page_num, text) tuples, 1-indexed.
"""
from __future__ import annotations

import fitz  # PyMuPDF


def extract_pages(pdf_path: str) -> list[tuple[int, str]]:
    """
    Open a PDF and return [(page_num, text), ...] for every page.
    page_num is 1-indexed.
    Skips pages with no extractable text (e.g. pure-image slides).
    """
    doc = fitz.open(pdf_path)
    pages: list[tuple[int, str]] = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text").strip()
        if text:
            pages.append((i, text))
    doc.close()
    return pages


def extract_full_text(pdf_path: str) -> str:
    """
    Return all pages concatenated as a single string.
    Used for tutorial PDFs where we process the whole doc at once.
    """
    doc = fitz.open(pdf_path)
    full = []
    for page in doc:
        text = page.get_text("text").strip()
        if text:
            full.append(text)
    doc.close()
    return "\n\n".join(full)
