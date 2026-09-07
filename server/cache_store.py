"""Helpers for date-based cache files stored under ``YYYY/MM`` directories."""
from __future__ import annotations

import datetime
import re
from pathlib import Path


DATE_FILE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})\.json$")


def cache_path(cache_dir: Path, datestr: str) -> Path:
    """Return the canonical path for a date, validating the date at the same time."""
    day = datetime.date.fromisoformat(datestr)
    return cache_dir / f"{day.year:04d}" / f"{day.month:02d}" / f"{datestr}.json"


def existing_cache_path(cache_dir: Path, datestr: str) -> Path | None:
    """Find an existing date in the canonical layout or the legacy flat layout."""
    canonical = cache_path(cache_dir, datestr)
    if canonical.exists():
        return canonical
    legacy = cache_dir / f"{datestr}.json"
    return legacy if legacy.exists() else None


def iter_cache_files(cache_dir: Path) -> list[Path]:
    """List one cache file per date, supporting both nested and legacy flat files.

    A canonical nested file wins if both layouts contain the same date. This makes
    migration safe even if it is interrupted partway through.
    """
    if not cache_dir.exists():
        return []

    by_date: dict[str, Path] = {}
    for path in cache_dir.rglob("*.json"):
        match = DATE_FILE_RE.fullmatch(path.name)
        if not match:
            continue
        datestr = path.stem
        try:
            canonical = cache_path(cache_dir, datestr)
        except ValueError:
            continue
        current = by_date.get(datestr)
        if current is None or path == canonical:
            by_date[datestr] = path

    return [by_date[datestr] for datestr in sorted(by_date)]


def cached_dates(cache_dir: Path) -> list[datetime.date]:
    return [datetime.date.fromisoformat(path.stem) for path in iter_cache_files(cache_dir)]
