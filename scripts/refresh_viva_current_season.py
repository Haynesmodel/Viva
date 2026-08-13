#!/usr/bin/env python3
"""Fetch and normalize a Viva ESPN current-season snapshot.

This is deliberately a narrow, server-side tool. It never exposes ESPN
credentials to the static site and writes a candidate by default. Promotion is
explicit so scheduled automation can create a reviewable data pull request.
"""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_API_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl"


def load_importer() -> Any:
    spec = importlib.util.spec_from_file_location("import_viva_espn", ROOT / "scripts" / "import_viva_espn.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load Viva ESPN importer")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


IMPORTER = load_importer()


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def canonical_json(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True) + "\n"


def atomic_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        handle.write(canonical_json(value))
        temporary = Path(handle.name)
    temporary.replace(path)


def as_int(value: Any, label: str) -> int:
    try:
        converted = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} must be an integer") from error
    return converted


def as_optional_number(value: Any, label: str) -> float | None:
    if value is None:
        return None
    return IMPORTER.finite_number(value, label)


def date_from_espn(value: Any, label: str) -> str:
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip().lstrip("-").isdigit()):
        milliseconds = float(value)
        return dt.datetime.fromtimestamp(milliseconds / 1000, tz=dt.timezone.utc).date().isoformat()
    text = str(value or "")
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return dt.datetime.fromisoformat(text).date().isoformat()
    except ValueError:
        return IMPORTER.iso_date(value, label)


def api_url(base_url: str, season: int, league_id: str) -> str:
    base = base_url.rstrip("/")
    query = urllib.parse.urlencode([("view", "mTeam"), ("view", "mMatchupScore"), ("view", "mSettings")])
    return f"{base}/seasons/{season}/segments/0/leagues/{urllib.parse.quote(str(league_id), safe='')}?{query}"


def fetch_league(base_url: str, season: int, league_id: str, espn_s2: str | None, swid: str | None) -> dict[str, Any]:
    if bool(espn_s2) != bool(swid):
        raise ValueError("ESPN_S2 and ESPN_SWID must either both be set for a private league or both be omitted for a public league")
    headers = {"Accept": "application/json", "User-Agent": "Viva current-season refresh"}
    if espn_s2 and swid:
        headers["Cookie"] = f"espn_s2={espn_s2}; SWID={swid}"
    request = urllib.request.Request(api_url(base_url, season, league_id), headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        raise ValueError(f"ESPN request failed with HTTP {error.code}; verify the league ID and private-league secrets") from error
    except urllib.error.URLError as error:
        raise ValueError(f"ESPN request failed: {error.reason}") from error
    if not isinstance(payload, dict):
        raise ValueError("ESPN response must be a JSON object")
    return payload


def season_config(mapping: dict[str, Any], season: int) -> tuple[int, dict[str, Any]]:
    configured = mapping.get("seasons", {}).get(str(season))
    if not isinstance(configured, dict):
        raise ValueError(f"season {season} is not configured in scripts/viva_season_mapping.json")
    teams = configured.get("teams")
    current = configured.get("current_season")
    required = ("league_key", "regular_season_max_week", "max_week", "playoff_slots", "bye_slots", "saunders_slots", "standings_tiebreakers")
    if not isinstance(teams, int) or teams < 2:
        raise ValueError(f"season {season} has no valid team count")
    if not isinstance(current, dict) or any(key not in current for key in required):
        missing = [key for key in required if not isinstance(current, dict) or key not in current]
        raise ValueError(
            f"season {season} requires mapping.seasons.{season}.current_season configuration before refresh: {', '.join(missing)}"
        )
    if not isinstance(current["standings_tiebreakers"], list) or not current["standings_tiebreakers"]:
        raise ValueError(f"season {season} current-season standings_tiebreakers must be a non-empty list")
    return teams, current


def member_names(payload: dict[str, Any]) -> dict[str, list[str]]:
    names: dict[str, list[str]] = {}
    for member in payload.get("members", []):
        if not isinstance(member, dict) or member.get("id") is None:
            continue
        values = [member.get("displayName"), member.get("firstName"), member.get("lastName")]
        names[str(member["id"])] = [str(value).strip() for value in values if str(value or "").strip()]
    return names


def team_owner(team: dict[str, Any], aliases: dict[str, str], members: dict[str, list[str]], label: str) -> tuple[str, str, int]:
    roster_id = as_int(team.get("id"), f"{label}.id")
    candidates: list[str] = []
    for value in (team.get("name"), team.get("abbrev"), team.get("nickname")):
        if str(value or "").strip():
            candidates.append(str(value).strip())
    location = str(team.get("location") or "").strip()
    nickname = str(team.get("nickname") or "").strip()
    if location and nickname:
        candidates.append(f"{location} {nickname}")
    for member_id in team.get("owners", []):
        candidates.extend(members.get(str(member_id), []))
    matches = {aliases[value.casefold()] for value in candidates if value.casefold() in aliases}
    if not matches:
        visible = ", ".join(repr(value) for value in candidates) or "no team/member names"
        raise ValueError(f"{label} could not be mapped to a canonical Viva owner; add one of {visible} as a mapping alias")
    if len(matches) > 1:
        raise ValueError(f"{label} resolves to multiple canonical Viva owners: {sorted(matches)}")
    source_team_name = str(team.get("name") or (f"{location} {nickname}".strip()) or next(iter(matches)))
    return next(iter(matches)), source_team_name, roster_id


def matchup_status(matchup: dict[str, Any], period: int, current_period: int | None) -> str:
    winner = str(matchup.get("winner") or "").upper()
    if winner in {"HOME", "AWAY", "TIE"}:
        return "final"
    raw_status = str(matchup.get("status") or matchup.get("statusType") or "").upper()
    if "IN_PROGRESS" in raw_status or raw_status == "LIVE":
        return "live"
    if current_period is not None and period < current_period:
        return "final"
    return "scheduled"


def matchup_type(matchup: dict[str, Any], period: int, config: dict[str, Any]) -> str:
    if period <= as_int(config["regular_season_max_week"], "regular_season_max_week"):
        return "Regular"
    playoff_tier = str(matchup.get("playoffTierType") or matchup.get("playoff_tier_type") or "").lower()
    return "Saunders" if "consolation" in playoff_tier or "saunders" in playoff_tier else "Playoff"


def fallback_matchup_id(matchup: dict[str, Any], period: int, home_id: int, away_id: int) -> int:
    try:
        return as_int(matchup.get("id"), "matchup.id")
    except ValueError:
        return period * 10_000 + min(home_id, away_id) * 100 + max(home_id, away_id)


def build_current_season(payload: dict[str, Any], mapping: dict[str, Any], season: int, generated_at: str | None = None) -> dict[str, Any]:
    expected_teams, config = season_config(mapping, season)
    aliases = IMPORTER.owner_map(mapping)
    members = member_names(payload)
    teams_by_id: dict[int, tuple[str, str, int]] = {}
    for index, team in enumerate(payload.get("teams", [])):
        if not isinstance(team, dict):
            raise ValueError(f"ESPN teams row {index} is not an object")
        owner, source_team_name, roster_id = team_owner(team, aliases, members, f"ESPN teams row {index}")
        if roster_id in teams_by_id:
            raise ValueError(f"duplicate ESPN team id {roster_id}")
        teams_by_id[roster_id] = (owner, source_team_name, roster_id)
    if len(teams_by_id) != expected_teams:
        raise ValueError(f"ESPN response contains {len(teams_by_id)} teams; mapping requires exactly {expected_teams}")
    owners = [item[0] for item in teams_by_id.values()]
    if len(set(owners)) != expected_teams:
        raise ValueError("ESPN team aliases do not map one-to-one to canonical Viva owners")

    status = payload.get("status") if isinstance(payload.get("status"), dict) else {}
    raw_current = status.get("currentMatchupPeriod", status.get("currentScoringPeriod"))
    current_period = as_int(raw_current, "ESPN status current matchup period") if raw_current not in (None, 0, "0") else None
    games: list[dict[str, Any]] = []
    seen_matchup_ids: set[int] = set()
    for index, matchup in enumerate(payload.get("schedule", [])):
        if not isinstance(matchup, dict):
            raise ValueError(f"ESPN schedule row {index} is not an object")
        home = matchup.get("home") if isinstance(matchup.get("home"), dict) else None
        away = matchup.get("away") if isinstance(matchup.get("away"), dict) else None
        if not home or not away or home.get("teamId") is None or away.get("teamId") is None:
            # ESPN uses one-sided schedule entries for playoff byes. CurrentSeason
            # models played/scheduled matchups only, so there is no game to publish.
            continue
        home_id = as_int(home.get("teamId"), f"ESPN schedule row {index}.home.teamId")
        away_id = as_int(away.get("teamId"), f"ESPN schedule row {index}.away.teamId")
        if home_id not in teams_by_id or away_id not in teams_by_id:
            raise ValueError(f"ESPN schedule row {index} references an unknown team id")
        if home_id == away_id:
            raise ValueError(f"ESPN schedule row {index} has a self-matchup")
        period = as_int(matchup.get("matchupPeriodId"), f"ESPN schedule row {index}.matchupPeriodId")
        state = matchup_status(matchup, period, current_period)
        matchup_id = fallback_matchup_id(matchup, period, home_id, away_id)
        if matchup_id in seen_matchup_ids:
            raise ValueError(f"duplicate ESPN matchup id {matchup_id}")
        seen_matchup_ids.add(matchup_id)
        home_owner, _, _ = teams_by_id[home_id]
        away_owner, _, _ = teams_by_id[away_id]
        games.append({
            "season": season,
            "date": date_from_espn(matchup.get("date"), f"ESPN schedule row {index}.date"),
            "teamA": home_owner,
            "teamB": away_owner,
            "scoreA": as_optional_number(home.get("totalPoints"), f"ESPN schedule row {index}.home.totalPoints") if state != "scheduled" else None,
            "scoreB": as_optional_number(away.get("totalPoints"), f"ESPN schedule row {index}.away.totalPoints") if state != "scheduled" else None,
            "week": period,
            "round": str(matchup.get("playoffTierType") or ""),
            "type": matchup_type(matchup, period, config),
            "status": state,
            "matchup_id": matchup_id,
            "rosterA": home_id,
            "rosterB": away_id,
        })
    if not games:
        raise ValueError("ESPN response contains no two-sided schedule matchups")
    generated = generated_at or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "source": "ESPN scheduled refresh",
        "league_key": str(config["league_key"]),
        "season": season,
        "generated_at": generated,
        "current_week": current_period,
        "regular_season_max_week": as_int(config["regular_season_max_week"], "regular_season_max_week"),
        "max_week": as_int(config["max_week"], "max_week"),
        "weeks_fetched": sorted({game["week"] for game in games}),
        "playoff_rules": {
            "regular_season_max_week": as_int(config["regular_season_max_week"], "regular_season_max_week"),
            "playoff_slots": as_int(config["playoff_slots"], "playoff_slots"),
            "bye_slots": as_int(config["bye_slots"], "bye_slots"),
            "standings_tiebreakers": list(config["standings_tiebreakers"]),
            "saunders_slots": as_int(config["saunders_slots"], "saunders_slots"),
        },
        "update_context": {
            "mode": "scheduled",
            "cutoff_date": dt.datetime.fromisoformat(generated.replace("Z", "+00:00")).date().isoformat(),
            "contains_live_scores": any(game["status"] == "live" for game in games),
            "contains_projected_scores": False,
        },
        "teams": [
            {"roster_id": roster_id, "owner": owner, "display_name": owner, "source_team_name": source_team_name}
            for owner, source_team_name, roster_id in sorted(teams_by_id.values(), key=lambda item: item[0])
        ],
        "games": sorted(games, key=lambda game: (game["week"], game["matchup_id"])),
    }


def validate_candidate(candidate: Path) -> None:
    command = [
        "node", str(ROOT / "scripts" / "validate_candidate.cjs"), "--root", str(ROOT), "--candidate",
        "--asset", str(ROOT / "assets" / "H2H.json"),
        "--asset", str(ROOT / "assets" / "SeasonSummary.json"),
        "--asset", str(candidate),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        detail = (result.stdout + result.stderr).strip()
        raise ValueError(f"current-season candidate failed schema/semantic validation: {detail}")


def main() -> int:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="Sanitized local ESPN response for testing or one-time review")
    source.add_argument("--league-id", help="ESPN league ID (or set VIVA_ESPN_LEAGUE_ID)")
    parser.add_argument("--season", required=True, type=int)
    parser.add_argument("--mapping", type=Path, default=ROOT / "scripts" / "viva_season_mapping.json")
    parser.add_argument("--output", required=True, type=Path, help="Candidate JSON path outside assets unless --promote is set")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--promote", action="store_true", help="Replace assets/CurrentSeason.json after validation")
    args = parser.parse_args()

    output = args.output.expanduser().resolve()
    canonical = (ROOT / "assets" / "CurrentSeason.json").resolve()
    if not args.promote and output == canonical:
        raise ValueError("candidate output cannot be assets/CurrentSeason.json without --promote")
    mapping = load_json(args.mapping)
    if args.input:
        payload = load_json(args.input)
        IMPORTER.reject_private(payload)
    else:
        league_id = args.league_id or os.environ.get("VIVA_ESPN_LEAGUE_ID")
        if not league_id:
            raise ValueError("VIVA_ESPN_LEAGUE_ID is required when --league-id is not supplied")
        payload = fetch_league(args.api_base, args.season, league_id, os.environ.get("ESPN_S2"), os.environ.get("ESPN_SWID"))
    candidate = build_current_season(payload, mapping, args.season)
    atomic_write(output, candidate)
    validate_candidate(output)
    if args.promote:
        atomic_write(canonical, candidate)
    print(f"Wrote validated CurrentSeason candidate {output} ({len(candidate['teams'])} teams, {len(candidate['games'])} matchups)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
        print(f"refresh_viva_current_season.py: {error}", flush=True)
        raise SystemExit(1)
