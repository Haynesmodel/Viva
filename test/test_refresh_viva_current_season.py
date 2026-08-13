import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module():
    spec = importlib.util.spec_from_file_location("refresh_viva_current_season", ROOT / "scripts" / "refresh_viva_current_season.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class RefreshVivaCurrentSeasonTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.refresher = load_module()

    def mapping(self):
        return {
            "owners": {"Joe": ["Joe", "Joe Team"], "Erin": ["Erin", "Erin Team"]},
            "seasons": {"2026": {"teams": 2, "current_season": {
                "league_key": "viva",
                "regular_season_max_week": 14,
                "max_week": 17,
                "playoff_slots": 2,
                "bye_slots": 0,
                "saunders_slots": 0,
                "standings_tiebreakers": ["win_pct", "points_for"],
            }}},
        }

    def payload(self):
        return {
            "members": [{"id": "a", "displayName": "Joe"}, {"id": "b", "displayName": "Erin"}],
            "teams": [
                {"id": 1, "name": "Joe Team", "owners": ["a"]},
                {"id": 2, "name": "Erin Team", "owners": ["b"]},
            ],
            "status": {"currentMatchupPeriod": 2},
            "schedule": [
                {"id": 11, "date": 1780704000000, "matchupPeriodId": 1, "winner": "HOME", "home": {"teamId": 1, "totalPoints": 111.5}, "away": {"teamId": 2, "totalPoints": 99.25}},
                {"id": 12, "date": 1781308800000, "matchupPeriodId": 2, "winner": "UNDECIDED", "home": {"teamId": 2, "totalPoints": 0}, "away": {"teamId": 1, "totalPoints": 0}},
            ],
        }

    def test_builds_valid_current_snapshot_from_espn_payload(self):
        result = self.refresher.build_current_season(self.payload(), self.mapping(), 2026, "2026-06-08T00:00:00Z")
        self.assertEqual(result["source"], "ESPN scheduled refresh")
        self.assertEqual(result["current_week"], 2)
        self.assertEqual(result["teams"][0]["owner"], "Erin")
        self.assertEqual(result["games"][0]["status"], "final")
        self.assertEqual(result["games"][0]["scoreA"], 111.5)
        self.assertEqual(result["games"][1]["status"], "scheduled")
        self.assertIsNone(result["games"][1]["scoreA"])
        self.assertEqual(result["games"][0]["date"], "2026-06-06")

    def test_generated_snapshot_passes_repository_candidate_validation(self):
        result = self.refresher.build_current_season(self.payload(), self.mapping(), 2026, "2026-06-08T00:00:00Z")
        with tempfile.TemporaryDirectory() as directory:
            candidate = Path(directory) / "CurrentSeason.json"
            self.refresher.atomic_write(candidate, result)
            self.refresher.validate_candidate(candidate)

    def test_requires_verified_current_season_rule_configuration(self):
        mapping = self.mapping()
        del mapping["seasons"]["2026"]["current_season"]["bye_slots"]
        with self.assertRaisesRegex(ValueError, "bye_slots"):
            self.refresher.build_current_season(self.payload(), mapping, 2026)

    def test_rejects_unmapped_espn_team(self):
        payload = self.payload()
        payload["teams"][0]["name"] = "Unknown Team"
        payload["teams"][0]["owners"] = []
        with self.assertRaisesRegex(ValueError, "could not be mapped"):
            self.refresher.build_current_season(payload, self.mapping(), 2026)

    def test_rejects_incomplete_private_league_credentials(self):
        with self.assertRaisesRegex(ValueError, "both be set"):
            self.refresher.fetch_league("https://example.test", 2026, "1", "session", None)

    def test_builds_espn_api_url_with_all_required_views(self):
        url = self.refresher.api_url("https://example.test/api", 2026, "league id")
        self.assertIn("seasons/2026/segments/0/leagues/league%20id", url)
        self.assertIn("view=mTeam", url)
        self.assertIn("view=mMatchupScore", url)
        self.assertIn("view=mSettings", url)


if __name__ == "__main__":
    unittest.main()
