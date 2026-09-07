from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import fetch_training
from server.cache_store import (
    cache_path,
    cached_dates,
    existing_cache_path,
    iter_cache_files,
)


class CacheStoreTests(unittest.TestCase):
    def test_canonical_path_uses_year_and_month(self) -> None:
        root = Path("cache")
        self.assertEqual(
            cache_path(root, "2026-09-07"),
            root / "2026" / "09" / "2026-09-07.json",
        )

    def test_recursive_listing_supports_legacy_files_without_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            legacy = root / "2026-09-06.json"
            legacy.write_text("{}", encoding="utf-8")

            canonical = cache_path(root, "2026-09-07")
            canonical.parent.mkdir(parents=True)
            canonical.write_text("{}", encoding="utf-8")

            duplicate = root / "2026-09-07.json"
            duplicate.write_text("{}", encoding="utf-8")
            (root / "not-a-date.json").write_text("{}", encoding="utf-8")

            self.assertEqual(iter_cache_files(root), [legacy, canonical])
            self.assertEqual(existing_cache_path(root, "2026-09-06"), legacy)
            self.assertEqual(existing_cache_path(root, "2026-09-07"), canonical)
            self.assertEqual(
                [day.isoformat() for day in cached_dates(root)],
                ["2026-09-06", "2026-09-07"],
            )

    def test_fetch_writes_new_data_to_canonical_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with (
                patch.object(fetch_training, "CACHE_DIR", tmp),
                patch.object(fetch_training, "fetch_day", return_value={"res": {"trains": []}}),
            ):
                result = fetch_training.fetch_range(
                    fetch_training.datetime.date(2026, 9, 7),
                    fetch_training.datetime.date(2026, 9, 7),
                    sleep_s=0,
                )

            expected = Path(tmp) / "2026" / "09" / "2026-09-07.json"
            self.assertTrue(result["ok"])
            self.assertTrue(expected.exists())


if __name__ == "__main__":
    unittest.main()
