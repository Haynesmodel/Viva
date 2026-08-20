import importlib.util
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "enrich_viva_draft_order.py"
FIXTURES = ROOT / "test" / "fixtures" / "espn"


def load_module():
    spec = importlib.util.spec_from_file_location("enrich_viva_draft_order", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class EnrichVivaDraftOrderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tool = load_module()
        cls.mapping = json.loads((ROOT / "scripts/viva_season_mapping.json").read_text())

    def test_valid_order_normalizes_to_all_owners_and_picks(self):
        raw = json.loads((FIXTURES / "draft-order-2025-sanitized.json").read_text())
        normalized = self.tool.normalize_order(raw, 2025, self.tool.aliases_from_mapping(self.mapping), 12)
        self.assertEqual([entry["draft_pick"] for entry in normalized], list(range(1, 13)))
        self.assertEqual({entry["owner"] for entry in normalized}, {row["owner"] for row in json.loads((ROOT / "assets/SeasonSummary.json").read_text()) if row["season"] == 2025})

    def test_invalid_orders_fail_closed(self):
        aliases = self.tool.aliases_from_mapping(self.mapping)
        for filename, message in [("draft-order-duplicate-pick.json", "complete range"), ("draft-order-unknown-owner.json", "unknown owner")]:
            raw = json.loads((FIXTURES / filename).read_text())
            with self.assertRaisesRegex(ValueError, message):
                self.tool.normalize_order(raw, 2025, aliases, 12)

    def test_team_count_boundaries_and_wrong_season_fail(self):
        aliases = self.tool.aliases_from_mapping(self.mapping)
        owners = list(self.mapping["owners"])
        for season, count in ((2020, 8), (2021, 10)):
            raw = {"season": season, "draft_order": [{"source_team_name": owner, "draft_pick": index} for index, owner in enumerate(owners[:count], start=1)]}
            self.assertEqual(len(self.tool.normalize_order(raw, season, aliases, count)), count)
            raw["draft_order"][0]["draft_pick"] = 0
            with self.assertRaisesRegex(ValueError, "complete range"):
                self.tool.normalize_order(raw, season, aliases, count)
        wrong = json.loads((FIXTURES / "draft-order-2025-sanitized.json").read_text())
        with self.assertRaisesRegex(ValueError, "does not match"):
            self.tool.normalize_order(wrong, 2024, aliases, 12)

    def test_partial_order_is_rejected(self):
        raw = json.loads((FIXTURES / "draft-order-2025-sanitized.json").read_text())
        raw["draft_order"] = raw["draft_order"][:-1]
        with self.assertRaisesRegex(ValueError, "has 11 rows"):
            self.tool.normalize_order(raw, 2025, self.tool.aliases_from_mapping(self.mapping), 12)

    def test_private_fields_are_rejected_recursively(self):
        with self.assertRaisesRegex(ValueError, "private field"):
            self.tool.reject_private({"draft_order": [{"source_team_name": "safe", "metadata": {"cookie": "redacted"}}]})

    def test_staged_summary_changes_only_selected_draft_fields(self):
        raw = json.loads((FIXTURES / "draft-order-2025-sanitized.json").read_text())
        normalized = self.tool.normalize_order(raw, 2025, self.tool.aliases_from_mapping(self.mapping), 12)
        baseline = json.loads((ROOT / "assets/SeasonSummary.json").read_text())
        staged = self.tool.staged_summary(ROOT, 2025, normalized)
        for before, after in zip(baseline, staged):
            if before["season"] != 2025:
                self.assertEqual(before, after)
            else:
                self.assertEqual({key: value for key, value in before.items() if key != "draft_pick"}, {key: value for key, value in after.items() if key != "draft_pick"})

    def test_cli_candidate_validates_and_refuses_assets_output(self):
        fixture = FIXTURES / "draft-order-2025-sanitized.json"
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(["python3", str(SCRIPT), "--input", str(fixture), "--season", "2025", "--mapping", str(ROOT / "scripts/viva_season_mapping.json"), "--output-dir", directory], cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((Path(directory) / "SeasonSummary.json").exists())
            self.assertTrue((Path(directory) / "draft-order-report.json").exists())
        result = subprocess.run(["python3", str(SCRIPT), "--input", str(fixture), "--season", "2025", "--mapping", str(ROOT / "scripts/viva_season_mapping.json"), "--output-dir", str(ROOT / "assets")], cwd=ROOT, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("inside canonical assets", result.stdout + result.stderr)

    def test_promotion_stages_outside_assets_before_validation_failure(self):
        fixture = FIXTURES / "draft-order-2025-sanitized.json"
        canonical = ROOT / "assets" / "SeasonSummary.json"
        before = canonical.read_bytes()
        argv = ["enrich_viva_draft_order.py", "--input", str(fixture), "--season", "2025", "--mapping", str(ROOT / "scripts/viva_season_mapping.json"), "--output-dir", str(ROOT / "assets"), "--promote"]
        with patch("sys.argv", argv), patch.object(self.tool, "validate_staged", side_effect=ValueError("forced validation failure")):
            with self.assertRaisesRegex(ValueError, "forced validation failure"):
                self.tool.main()
        self.assertEqual(canonical.read_bytes(), before)
        self.assertFalse((ROOT / "assets" / "draft-order-report.json").exists())


if __name__ == "__main__":
    unittest.main()
