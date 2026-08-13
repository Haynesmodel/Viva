import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module():
    spec = importlib.util.spec_from_file_location("import_viva_espn", ROOT / "scripts/import_viva_espn.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ImportVivaEspnTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.importer = load_module()
        cls.aliases = {"joe": "Joe", "erin": "Erin"}

    def test_strict_boolean_parser_accepts_explicit_literals_and_rejects_ambiguous_values(self):
        self.assertIs(self.importer.strict_bool("false", "flag"), False)
        self.assertIs(self.importer.strict_bool("true", "flag"), True)
        self.assertIs(self.importer.strict_bool("0", "flag"), False)
        self.assertIs(self.importer.strict_bool("1", "flag"), True)
        with self.assertRaises(ValueError):
            self.importer.strict_bool("maybe", "flag")

    def test_owner_map_rejects_ambiguous_aliases(self):
        with self.assertRaisesRegex(ValueError, "both 'Joe' and 'Erin'"):
            self.importer.owner_map({"owners": {"Joe": ["same"], "Erin": ["same"]}})

    def test_summary_preserves_boolean_literals_and_optional_draft_pick(self):
        rows = self.importer.normalize_summary([{
            "season": 2026, "owner": "Joe", "champion": "false", "saunders": "0", "bye": "true",
            "wild_card": "false", "saunders_bye": "0", "draft_pick": 3,
        }], self.aliases, 2026)
        self.assertFalse(rows[0]["champion"])
        self.assertTrue(rows[0]["bye"])
        self.assertEqual(rows[0]["draft_pick"], 3)

        without_pick = self.importer.normalize_summary([{"season": 2026, "owner": "Erin"}], self.aliases, 2026)[0]
        self.assertNotIn("draft_pick", without_pick)

    def test_current_season_rejects_unsupported_status(self):
        with self.assertRaisesRegex(ValueError, "unsupported status"):
            self.importer.normalize_current_season({
                "season": 2026,
                "teams": [{"roster_id": 1, "owner": "Joe"}, {"roster_id": 2, "owner": "Erin"}],
                "games": [{"teamA": "Joe", "teamB": "Erin", "date": "2026-01-01", "week": 1, "status": "unknown", "matchup_id": 1, "rosterA": 1, "rosterB": 2}],
                "regular_season_max_week": 14,
                "max_week": 17,
                "playoff_rules": {"playoff_slots": 2, "standings_tiebreakers": ["win_pct"]},
                "update_context": {"cutoff_date": "2026-01-01"},
            }, self.aliases, 2026)

    def test_candidate_output_cannot_target_tracked_assets_without_promotion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            assets = root / "assets"
            with self.assertRaisesRegex(ValueError, "inside canonical assets"):
                self.importer.resolve_output_dir(root, assets, False)

    def test_candidate_requires_configured_season_team_count(self):
        mapping = {"seasons": {"2026": {"teams": 2}}}
        summary = [{"season": 2026, "owner": "Joe"}, {"season": 2026, "owner": "Erin"}]
        self.importer.validate_candidate_team_count(summary, None, mapping, 2026)
        with self.assertRaisesRegex(ValueError, "requires exactly 2"):
            self.importer.validate_candidate_team_count(summary[:1], None, mapping, 2026)
        with self.assertRaisesRegex(ValueError, "not configured"):
            self.importer.validate_candidate_team_count(summary, None, {"seasons": {}}, 2026)

    def test_current_season_roster_must_match_summary_owners(self):
        mapping = {"seasons": {"2026": {"teams": 2}}}
        summary = [{"season": 2026, "owner": "Joe"}, {"season": 2026, "owner": "Erin"}]
        current = {"teams": [{"owner": "Joe"}, {"owner": "Dulberger"}]}
        with self.assertRaisesRegex(ValueError, "do not match SeasonSummary"):
            self.importer.validate_candidate_team_count(summary, current, mapping, 2026)

    def test_promotion_replaces_selected_season_without_truncating_existing_seasons(self):
        existing_games = [{"season": 2024, "id": "old"}, {"season": 2025, "id": "stale"}]
        incoming_games = [{"season": 2025, "id": "new"}]
        merged = self.importer.merge_promoted_season(existing_games, incoming_games, 2025)
        self.assertEqual(merged, [{"season": 2024, "id": "old"}, {"season": 2025, "id": "new"}])


if __name__ == "__main__":
    unittest.main()
