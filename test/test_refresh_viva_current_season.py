import http.server
import json
import importlib.util
import subprocess
import sys
import tempfile
import threading
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
        with (ROOT / "test" / "fixtures" / "espn" / "current-season-raw.json").open(encoding="utf-8") as handle:
            return json.load(handle)

    def scoring_period_dates(self):
        return {1: "2026-06-06", 2: "2026-06-13"}

    def test_builds_valid_current_snapshot_from_espn_payload(self):
        result = self.refresher.build_current_season(
            self.payload(), self.mapping(), 2026, "2026-06-08T00:00:00Z", self.scoring_period_dates()
        )
        self.assertEqual(result["source"], "ESPN scheduled refresh")
        self.assertEqual(result["current_week"], 2)
        self.assertEqual(result["teams"][0]["owner"], "Erin")
        self.assertEqual(result["games"][0]["status"], "final")
        self.assertEqual(result["games"][0]["scoreA"], 111.5)
        self.assertEqual(result["games"][1]["status"], "scheduled")
        self.assertIsNone(result["games"][1]["scoreA"])
        self.assertEqual(result["games"][0]["date"], "2026-06-06")

    def test_generated_snapshot_passes_repository_candidate_validation(self):
        result = self.refresher.build_current_season(
            self.payload(), self.mapping(), 2026, "2026-06-08T00:00:00Z", self.scoring_period_dates()
        )
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

    def test_requires_scoring_period_calendar_for_raw_espn_schedule(self):
        with self.assertRaisesRegex(ValueError, "scoring-period calendar date"):
            self.refresher.build_current_season(self.payload(), self.mapping(), 2026)

    def test_rejects_incomplete_private_league_credentials(self):
        with self.assertRaisesRegex(ValueError, "both be set"):
            self.refresher.fetch_league("https://example.test", 2026, "1", "session", None)

    def test_builds_espn_api_url_with_all_required_views(self):
        url = self.refresher.api_url("https://example.test/api", 2026, "league id")
        self.assertIn("seasons/2026/segments/0/leagues/league%20id", url)
        self.assertIn("view=mTeam", url)
        self.assertIn("view=mMatchupScore", url)
        self.assertIn("view=mSettings", url)

    def test_builds_scoring_period_calendar_url(self):
        url = self.refresher.scoring_period_url("https://example.test/calendar", 2026, 1)
        self.assertEqual(
            url,
            "https://example.test/calendar/2026/types/2/weeks/1",
        )

    def test_input_cli_fetches_calendar_dates_for_raw_espn_response(self):
        class CalendarHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                period = self.path.rsplit("/", 1)[-1]
                start_dates = {"1": "2026-06-06T07:00Z", "2": "2026-06-13T07:00Z"}
                body = json.dumps({"startDate": start_dates[period]}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format, *args):
                return

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), CalendarHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                directory_path = Path(directory)
                mapping_path = directory_path / "mapping.json"
                output_path = directory_path / "CurrentSeason.json"
                mapping_path.write_text(json.dumps(self.mapping()), encoding="utf-8")
                result = subprocess.run(
                    [
                        sys.executable,
                        str(ROOT / "scripts" / "refresh_viva_current_season.py"),
                        "--input",
                        str(ROOT / "test" / "fixtures" / "espn" / "current-season-raw.json"),
                        "--season",
                        "2026",
                        "--mapping",
                        str(mapping_path),
                        "--output",
                        str(output_path),
                        "--calendar-base",
                        f"http://127.0.0.1:{server.server_port}",
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                candidate = json.loads(output_path.read_text(encoding="utf-8"))
                self.assertEqual([game["date"] for game in candidate["games"]], ["2026-06-06", "2026-06-13"])
        finally:
            server.shutdown()
            thread.join()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
