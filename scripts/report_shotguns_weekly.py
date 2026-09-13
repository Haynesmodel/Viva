#!/usr/bin/env python3
"""Report and optionally promote weekly Shotgun obligations from ESPN."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("refresh_viva_current_season", ROOT / "scripts" / "refresh_viva_current_season.py")
if spec is None or spec.loader is None:
    raise RuntimeError("could not load current-season refresh helpers")
refresh = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = refresh
spec.loader.exec_module(refresh)

BENCH_SLOTS = {20, 21}


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def slug(value: Any) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", str(value).strip().lower()))


def date_for(matchup: dict[str, Any], current_games: list[dict[str, Any]]) -> str:
    if matchup.get("date") is not None:
        return refresh.date_from_espn(matchup["date"], "ESPN matchup date")
    for game in current_games:
        if matchup.get("id") is not None and str(game.get("matchup_id")) == str(matchup["id"]):
            return game["date"]
    raise ValueError("selected matchup has no date; refresh CurrentSeason.json first or provide an ESPN date")


def player_score(entry: dict[str, Any], week: int) -> float | None:
    pool = entry.get("playerPoolEntry") if isinstance(entry.get("playerPoolEntry"), dict) else {}
    player = pool.get("player") if isinstance(pool.get("player"), dict) else {}
    for value in (entry.get("appliedStatTotal"), pool.get("appliedStatTotal"), player.get("appliedStatTotal")):
        score = number(value)
        if score is not None:
            return score
    stats = player.get("stats") if isinstance(player.get("stats"), list) else []
    for stat in stats:
        if not isinstance(stat, dict) or str(stat.get("scoringPeriodId")) != str(week):
            continue
        if stat.get("statSourceId") not in (None, 0, "0"):
            continue
        for key in ("appliedStatTotal", "statTotal", "totalPoints", "points"):
            score = number(stat.get(key))
            if score is not None:
                return score
    return None


def started_player_rows(team: dict[str, Any], owner: str, week: int, date: str) -> list[dict[str, Any]]:
    roster = next(
        (team[key] for key in ("rosterForMatchupPeriod", "roster", "rosterForCurrentScoringPeriod") if isinstance(team.get(key), dict)),
        {},
    )
    entries = roster.get("entries", []) if isinstance(roster, dict) else []
    rows: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        try:
            slot = int(entry.get("lineupSlotId"))
        except (TypeError, ValueError):
            continue
        if slot in BENCH_SLOTS or slot >= 20:
            continue
        score = player_score(entry, week)
        if score is None or score > 0:
            continue
        pool = entry.get("playerPoolEntry") if isinstance(entry.get("playerPoolEntry"), dict) else {}
        player = pool.get("player") if isinstance(pool.get("player"), dict) else {}
        name = str(player.get("fullName") or player.get("name") or "Unknown player").strip()
        player_id = player.get("id") or pool.get("id") or name
        rows.append({
            "id": f"shotgun-{slug(owner)}-{date}-week-{week}-player-{slug(player_id)}",
            "owner": owner,
            "week": week,
            "date": date,
            "due_date": None,
            "cause": f"Started player: {name} ({score:g} points)",
            "completed": False,
            "media_key": None,
        })
    return rows


def final_matchups(payload: dict[str, Any], week: int, owners: dict[int, str], current_games: list[dict[str, Any]]) -> list[tuple[dict[str, Any], str, str, str]]:
    status = payload.get("status") if isinstance(payload.get("status"), dict) else {}
    raw_period = status.get("currentMatchupPeriod", status.get("currentScoringPeriod"))
    current_period = int(raw_period) if raw_period not in (None, "", 0, "0") else None
    output = []
    for matchup in payload.get("schedule", []):
        if not isinstance(matchup, dict) or int(matchup.get("matchupPeriodId", -1)) != week:
            continue
        home = matchup.get("home") if isinstance(matchup.get("home"), dict) else {}
        away = matchup.get("away") if isinstance(matchup.get("away"), dict) else {}
        if home.get("teamId") not in owners or away.get("teamId") not in owners:
            continue
        if refresh.matchup_status(matchup, week, current_period) != "final":
            continue
        output.append((matchup, owners[home["teamId"]], owners[away["teamId"]], date_for(matchup, current_games)))
    return output


def atomic_write(path: Path, value: Any) -> None:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="sanitized ESPN league JSON")
    source.add_argument("--league-id", help="ESPN league ID (or VIVA_ESPN_LEAGUE_ID)")
    parser.add_argument("--season", required=True, type=int)
    parser.add_argument("--week", type=int, help="finalized week; defaults to ESPN's current period - 1")
    parser.add_argument("--mapping", type=Path, default=ROOT / "scripts" / "viva_season_mapping.json")
    parser.add_argument("--current-season", type=Path, default=ROOT / "assets" / "CurrentSeason.json")
    parser.add_argument("--api-base", default=refresh.DEFAULT_API_BASE)
    parser.add_argument("--promote", action="store_true", help="append new owed rows to assets/Shotguns.json")
    args = parser.parse_args()

    mapping = load_json(args.mapping)
    if args.input:
        payload = load_json(args.input)
        refresh.IMPORTER.reject_private(payload)
    else:
        league_id = args.league_id or os.environ.get("VIVA_ESPN_LEAGUE_ID")
        if not league_id:
            raise ValueError("VIVA_ESPN_LEAGUE_ID is required when --league-id is not supplied")
        payload = refresh.fetch_league(args.api_base, args.season, league_id, os.environ.get("ESPN_S2"), os.environ.get("ESPN_SWID"))

    aliases = refresh.IMPORTER.owner_map(mapping)
    members = refresh.member_names(payload)
    owners: dict[int, str] = {}
    teams: dict[str, dict[str, Any]] = {}
    for index, team in enumerate(payload.get("teams", [])):
        owner, _, roster_id = refresh.team_owner(team, aliases, members, f"ESPN team {index}")
        owners[roster_id] = owner
        teams[owner] = team

    current = load_json(args.current_season) if args.current_season.exists() else {}
    current_games = current.get("games", []) if isinstance(current, dict) else []
    raw_period = payload.get("status", {}).get("currentMatchupPeriod", 1)
    week = int(args.week if args.week is not None else (int(raw_period) - 1 if int(raw_period) > 1 else 1))
    matchups = final_matchups(payload, week, owners, current_games)
    candidates = []
    print(f"Week {week} finalized scores")
    for matchup, home_owner, away_owner, date in matchups:
        home = matchup["home"]
        away = matchup["away"]
        print(f"- {home_owner} {home.get('totalPoints', '—')} – {away.get('totalPoints', '—')} {away_owner} ({date})")
        candidates.extend(started_player_rows(home if any(key in home for key in ("rosterForMatchupPeriod", "roster", "rosterForCurrentScoringPeriod")) else teams[home_owner], home_owner, week, date))
        candidates.extend(started_player_rows(away if any(key in away for key in ("rosterForMatchupPeriod", "roster", "rosterForCurrentScoringPeriod")) else teams[away_owner], away_owner, week, date))

    shotguns_path = ROOT / "assets" / "Shotguns.json"
    existing = load_json(shotguns_path)
    existing_ids = {row.get("id") for row in existing}
    candidates = [row for row in candidates if row["id"] not in existing_ids]
    print("Started players at 0 or below")
    if not candidates:
        print("- None")
    for row in candidates:
        print(f"- {row['owner']}: {row['cause']} [{row['id']}]")
    owed = [row for row in existing if not row.get("completed")]
    print(f"Existing Shotguns owed: {len(owed)}")
    for row in owed:
        print(f"- {row['owner']}: {row['cause']} ({row['date']})")

    if args.promote and candidates:
        atomic_write(shotguns_path, existing + candidates)
        subprocess.run(["npm", "run", "generate:manifest"], cwd=ROOT, check=True)
        print(f"Promoted {len(candidates)} new owed Shotgun record(s).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
        print(f"report_shotguns_weekly.py: {error}", flush=True)
        raise SystemExit(1)
