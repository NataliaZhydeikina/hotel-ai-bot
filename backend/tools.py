"""Helpers for resolving hotel search filters and estimating result counts."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


_CATALOG_PATH = Path(__file__).with_name("filters_catalog.json")


def load_filter_catalog() -> list[dict[str, str]]:
    """Load the canonical filter catalog shipped with the application."""
    try:
        with _CATALOG_PATH.open(encoding="utf-8") as catalog_file:
            data = json.load(catalog_file)
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Unable to load filter catalog at {_CATALOG_PATH}") from exc

    filters = data.get("filters")
    if not isinstance(filters, list):
        raise RuntimeError("Filter catalog must contain a 'filters' list")
    return filters


def _words(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", value.casefold()))


def lookup_filter(query: str, catalog: list[dict[str, str]] | None = None) -> dict[str, Any] | None:
    """Find the best catalog match using a small, dependency-free token score."""
    if not query.strip():
        return None

    options = catalog if catalog is not None else load_filter_catalog()
    query_words = _words(query)
    if not query_words:
        return None

    best: dict[str, str] | None = None
    best_score = 0.0
    for item in options:
        canonical_words = _words(f"{item.get('id', '')} {item.get('name', '')}")
        description_words = _words(item.get("description", ""))
        canonical_overlap = len(query_words & canonical_words)
        description_overlap = len(query_words & description_words)
        score = (
            0.7 * canonical_overlap / len(query_words)
            + 0.3 * canonical_overlap / len(canonical_words)
            + 0.15 * description_overlap / len(query_words)
            if canonical_overlap or description_overlap
            else 0.0
        )
        if query.casefold() in item.get("name", "").casefold():
            score = max(score, 1.0)
        if score > best_score:
            best, best_score = item, score

    if best is None or best_score < 0.25:
        return None
    return {**best, "score": round(best_score, 3)}


def estimate_inventory(
    destination: str | None,
    check_in: str | None,
    check_out: str | None,
    guests: int,
    filters: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return an explicitly illustrative estimate; this is not live hotel inventory."""
    if not destination or not check_in or not check_out:
        return {
            "count": None,
            "label": "Add a destination and dates to estimate matching stays.",
            "is_estimate": True,
        }

    must_have_count = sum(1 for item in filters if item.get("priority") == "must")
    count = max(0, 38 - (max(guests - 2, 0) * 3) - (must_have_count * 6))
    return {
        "count": count,
        "label": f"About {count} stays may match in {destination}.",
        "is_estimate": True,
    }
