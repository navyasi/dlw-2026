"""
Article scraper using requests + BeautifulSoup.
Removes navigation, header, footer boilerplate and returns clean body text.
"""
from __future__ import annotations

import re

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# Tags that rarely contain article body content
NOISE_TAGS = ["script", "style", "nav", "header", "footer", "aside", "form", "noscript"]

# Maximum characters to send to the LLM (roughly ~4 000 tokens)
MAX_CHARS = 12_000


def scrape_article(url: str) -> str:
    """
    Fetch a URL and return cleaned article body text.
    Raises requests.HTTPError on non-200 responses.
    """
    # Strip trailing punctuation that might sneak in from .txt files
    url = url.strip().rstrip(".")

    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove noise tags
    for tag in NOISE_TAGS:
        for el in soup.find_all(tag):
            el.decompose()

    # Prefer <article> or <main> if present
    body = soup.find("article") or soup.find("main") or soup.find("body")
    if body is None:
        body = soup

    # Collect paragraph-level text
    paragraphs = []
    for el in body.find_all(["p", "h1", "h2", "h3", "h4", "li"]):
        text = el.get_text(separator=" ", strip=True)
        if len(text) > 30:   # skip very short snippets
            paragraphs.append(text)

    raw = "\n\n".join(paragraphs)

    # Collapse excessive whitespace
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    raw = re.sub(r" {2,}", " ", raw)

    return raw[:MAX_CHARS]
