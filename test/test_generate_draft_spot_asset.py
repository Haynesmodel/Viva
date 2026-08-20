import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "generate_draft_spot_asset.py"
SEASON_SUMMARY = ROOT / "assets" / "SeasonSummary.json"


def load_generator_module():
    spec = importlib.util.spec_from_file_location("generate_draft_spot_asset", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class DraftSpotAssetGeneratorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generator = load_generator_module()
        cls.source_rows = json.loads(SEASON_SUMMARY.read_text())

    def test_build_asset_preserves_truthful_unavailable_state(self):
        asset = self.generator.build_asset(self.source_rows)
        self.assertEqual(asset["season_range"], {"start": None, "end": None})
        self.assertEqual(asset["team_seasons"], 0)
        self.assertEqual(asset["rows"], [])
        self.assertEqual(asset["owner_recommendations"], [])
        self.assertEqual(asset["source_sha256"], self.generator.sha256_json(self.source_rows))

    def test_complete_seeded_season_produces_one_row_per_owner(self):
        seeded = [dict(row) for row in self.source_rows]
        picks = {row["owner"]: index for index, row in enumerate(
            (row for row in seeded if row["season"] == 2025), start=1
        )}
        for row in seeded:
            if row["season"] == 2025:
                row["draft_pick"] = picks[row["owner"]]
        asset = self.generator.build_asset(seeded)
        self.assertEqual(asset["team_seasons"], 12)
        self.assertEqual(len(asset["rows"]), 12)
        self.assertEqual({row["season"] for row in asset["rows"]}, {2025})
        self.assertEqual({row["draft_pick"] for row in asset["rows"]}, set(range(1, 13)))

    def test_cli_output_is_byte_deterministic(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            first = Path(tmpdir) / "DraftSpot.first.json"
            second = Path(tmpdir) / "DraftSpot.second.json"
            base = [
                "python3",
                str(SCRIPT_PATH),
                "--season-summary",
                str(SEASON_SUMMARY),
            ]
            subprocess.run([*base, "--out", str(first)], check=True, cwd=ROOT)
            subprocess.run([*base, "--out", str(second)], check=True, cwd=ROOT)
            self.assertEqual(first.read_bytes(), second.read_bytes())


if __name__ == "__main__":
    unittest.main()
