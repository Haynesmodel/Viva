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

    def test_summary_preserves_boolean_literals_and_optional_draft_pick(self):
        rows = self.importer.normalize_summary([{
            "season": 2026, "owner": "Joe", "champion": "false", "saunders": "0", "bye": "true",
            "wild_card": "false", "saunders_bye": "0", "draft_pick": 3,
        }], self.aliases, 2026)
        self.assertFalse(rows[0]["champion"])
        self.assertTrue(rows[0]["bye"])
        self.assertEqual(rows[0]["draft_pick"], 3)

    def test_promotion_replaces_selected_season_without_truncating_existing_seasons(self):
        existing_games = [{"season": 2024, "id": "old"}, {"season": 2025, "id": "stale"}]
        incoming_games = [{"season": 2025, "id": "new"}]
        merged = self.importer.merge_promoted_season(existing_games, incoming_games, 2025)
        self.assertEqual(merged, [{"season": 2024, "id": "old"}, {"season": 2025, "id": "new"}])


if __name__ == "__main__":
    unittest.main()
