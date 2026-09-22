from __future__ import annotations

import unittest

from scripts.analyze import get_day_sessions as analyze_get_day_sessions
from server.day_detail import get_day_sessions as server_get_day_sessions


class DaySessionsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.sample_trains = [
            {
                "localid": 1,
                "title": "户外跑步",
                "start": 1789921360180,
                "movements": [
                    {
                        "name": "跑步",
                        "sets": [
                            {
                                "metrics": {
                                    "distance": "5.65",
                                    "calories": "395",
                                    "avgHeartRate": "139",
                                }
                            }
                        ],
                    }
                ],
            },
            {
                "localid": 2,
                "title": "户外跑步",
                "start": 1789924125561,
                "movements": [
                    {
                        "name": "跑步",
                        "sets": [
                            {
                                "metrics": {
                                    "distance": "5.80",
                                    "calories": "382",
                                    "avgHeartRate": "134",
                                }
                            }
                        ],
                    }
                ],
            },
            # Duplicate sync of train 1 (same start and distance)
            {
                "localid": 999,
                "title": "户外跑步",
                "start": 1789921360180,
                "movements": [
                    {
                        "name": "跑步",
                        "sets": [
                            {
                                "metrics": {
                                    "distance": "5.65",
                                    "calories": "395",
                                    "avgHeartRate": "139",
                                }
                            }
                        ],
                    }
                ],
            },
        ]

    def test_analyze_allows_multiple_runs_and_deduplicates(self) -> None:
        sessions = analyze_get_day_sessions(self.sample_trains)
        self.assertEqual(len(sessions), 2)
        kinds = [s[0] for s in sessions]
        self.assertEqual(kinds, ["running", "running"])
        starts = [s[1]["start"] for s in sessions]
        self.assertEqual(starts, [1789921360180, 1789924125561])

    def test_server_allows_multiple_runs_and_deduplicates(self) -> None:
        sessions = server_get_day_sessions(self.sample_trains)
        self.assertEqual(len(sessions), 2)
        kinds = [s[0] for s in sessions]
        self.assertEqual(kinds, ["running", "running"])
        starts = [s[1]["start"] for s in sessions]
        self.assertEqual(starts, [1789921360180, 1789924125561])
