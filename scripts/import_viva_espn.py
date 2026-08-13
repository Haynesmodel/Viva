#!/usr/bin/env python3
"""Normalize a reviewed local ESPN export into an untracked Viva candidate.

The script never fetches ESPN and never writes canonical assets unless --promote
is explicitly supplied. Raw input is read locally and is not copied to output.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any


PRIVATE_FIELD = re.compile(r"(?:cookie|session|token|secret|password|authorization|bearer|credential|auth)", re.I)


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def canonical_json(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True) + "\n"


def finite_number(value: Any, label: str) -> float:
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise ValueError(f"{label} must be a finite non-negative number")
    return number


def iso_date(value: Any, label: str) -> str:
    text = str(value or "")
    try:
        return dt.date.fromisoformat(text).isoformat()
    except ValueError as exc:
        raise ValueError(f"{label} must be an ISO date") from exc


def strict_bool(value: Any, label: str, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    text = str(value).strip().casefold()
    if text in {"true", "yes", "y", "1"}:
        return True
    if text in {"false", "no", "n", "0"}:
        return False
    raise ValueError(f"{label} must be a boolean literal, got {value!r}")


def reject_private(value: Any, path: str = "input") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if PRIVATE_FIELD.search(str(key)):
                raise ValueError(f"private field rejected at {path}.{key}")
            reject_private(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_private(child, f"{path}[{index}]")


def owner_map(mapping: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for canonical, aliases in mapping.get("owners", {}).items():
        for alias in [canonical, *aliases]:
            key = str(alias).strip().casefold()
            owner = str(canonical).strip()
            existing = result.get(key)
            if existing is not None and existing != owner:
                raise ValueError(f"ambiguous owner alias {alias!r}: maps to both {existing!r} and {owner!r}")
            result[key] = owner
    return result


def expected_team_count(mapping: dict[str, Any], season: int) -> int:
    configured = mapping.get("seasons", {}).get(str(season))
    if not isinstance(configured, dict) or not isinstance(configured.get("teams"), int) or configured["teams"] < 2:
        raise ValueError(f"season {season} is not configured with a valid team count in mapping.seasons")
    return configured["teams"]


def validate_candidate_team_count(summary: list[dict[str, Any]], current: dict[str, Any] | None, mapping: dict[str, Any], season: int) -> None:
    expected = expected_team_count(mapping, season)
    summary_owners = {str(row["owner"]) for row in summary}
    if len(summary_owners) != expected:
        raise ValueError(f"season {season} summary contains {len(summary_owners)} unique owners; mapping requires exactly {expected}")
    if current is not None:
        current_owners = {str(team["owner"]) for team in current["teams"]}
        if len(current_owners) != expected:
            raise ValueError(f"season {season} CurrentSeason contains {len(current_owners)} unique teams; mapping requires exactly {expected}")
        if current_owners != summary_owners:
            missing = sorted(summary_owners - current_owners)
            unexpected = sorted(current_owners - summary_owners)
            raise ValueError(f"season {season} CurrentSeason owners do not match SeasonSummary; missing={missing}, unexpected={unexpected}")


def resolve_owner(value: Any, aliases: dict[str, str], row: int, season: int) -> str:
    key = str(value or "").strip().casefold()
    if key not in aliases:
        raise ValueError(f"unknown owner alias {value!r} at source row {row}, season {season}")
    return aliases[key]


def game_type(row: dict[str, Any]) -> str:
    raw = str(row.get("type") or row.get("game_type") or row.get("round") or "").lower()
    if "saunders" in raw:
        return "Saunders"
    if any(label in raw for label in ("playoff", "championship", "semi", "wild", "final")):
        return "Playoff"
    return "Regular"


def normalize_games(rows: list[dict[str, Any]], aliases: dict[str, str], season: int) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, row in enumerate(rows):
        row_season = int(row.get("season", season))
        if row_season != season:
            raise ValueError(f"wrong season at source row {index}: expected {season}, got {row_season}")
        team_a = resolve_owner(row.get("teamA", row.get("team_a", row.get("home_owner"))), aliases, index, season)
        team_b = resolve_owner(row.get("teamB", row.get("team_b", row.get("away_owner"))), aliases, index, season)
        if team_a == team_b:
            raise ValueError(f"self-matchup at source row {index}, season {season}")
        date = iso_date(row.get("date"), f"source row {index} date")
        week = int(row.get("week"))
        score_a = finite_number(row.get("scoreA", row.get("score_a")), f"source row {index} scoreA")
        score_b = finite_number(row.get("scoreB", row.get("score_b")), f"source row {index} scoreB")
        round_name = str(row.get("round") or "")
        normalized = {"season": season, "date": date, "teamA": team_a, "teamB": team_b, "scoreA": score_a, "scoreB": score_b, "week": week, "round": round_name, "type": game_type(row)}
        key = "|".join(str(normalized[field]) for field in ("season", "date", "teamA", "teamB", "scoreA", "scoreB", "week", "round", "type"))
        reverse = "|".join(str(normalized[field]) for field in ("season", "date", "teamB", "teamA", "scoreB", "scoreA", "week", "round", "type"))
        if key in seen or reverse in seen:
            raise ValueError(f"duplicate game at source row {index}, season {season}")
        seen.add(key)
        output.append(normalized)
    return output


SUMMARY_FIELDS = ("season", "owner", "wins", "losses", "ties", "finish", "points_for", "points_against", "playoff_wins", "playoff_losses", "saunders_wins", "saunders_losses", "champion", "saunders", "bye", "wild_card", "saunders_bye", "bagels_earned", "draft_pick")


def normalize_summary(rows: list[dict[str, Any]], aliases: dict[str, str], season: int) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, row in enumerate(rows):
        row_season = int(row.get("season", season))
        if row_season != season:
            raise ValueError(f"wrong season at summary row {index}: expected {season}, got {row_season}")
        owner = resolve_owner(row.get("owner"), aliases, index, season)
        if owner in seen:
            raise ValueError(f"duplicate summary owner {owner} at source row {index}, season {season}")
        seen.add(owner)
        normalized: dict[str, Any] = {"season": season, "owner": owner}
        for field in SUMMARY_FIELDS[2:]:
            if field in ("champion", "saunders", "bye", "wild_card", "saunders_bye"):
                normalized[field] = strict_bool(row.get(field), f"summary row {index} {field}")
            elif field == "bagels_earned":
                normalized[field] = None if row.get(field) is None else finite_number(row.get(field), f"summary row {index} {field}")
            elif field == "draft_pick":
                if row.get(field) is not None:
                    normalized[field] = int(row.get(field))
            else:
                normalized[field] = int(row.get(field, 0)) if field in ("wins", "losses", "ties", "finish", "playoff_wins", "playoff_losses", "saunders_wins", "saunders_losses") else finite_number(row.get(field, 0), f"summary row {index} {field}")
        output.append(normalized)
    return output


def normalize_current_season(value: dict[str, Any], aliases: dict[str, str], season: int) -> dict[str, Any]:
    if int(value.get("season", season)) != season:
        raise ValueError(f"current-season candidate has the wrong season; expected {season}")
    teams = []
    for index, row in enumerate(value.get("teams", [])):
        owner = resolve_owner(row.get("owner"), aliases, index, season)
        teams.append({
            "roster_id": int(row["roster_id"]),
            "owner": owner,
            "display_name": str(row.get("display_name") or owner),
            "source_team_name": str(row.get("source_team_name") or row.get("team_name") or row.get("display_name") or owner),
        })
    if len(teams) < 2:
        raise ValueError("current-season candidate requires at least two teams")
    games = []
    for index, row in enumerate(value.get("games", [])):
        team_a = resolve_owner(row.get("teamA", row.get("team_a")), aliases, index, season)
        team_b = resolve_owner(row.get("teamB", row.get("team_b")), aliases, index, season)
        if team_a == team_b:
            raise ValueError(f"current-season self-matchup at source row {index}")
        status = str(row.get("status") or "scheduled")
        if status not in {"scheduled", "live", "final"}:
            raise ValueError(f"current-season row {index} has unsupported status {status!r}")
        games.append({
            "season": season,
            "date": iso_date(row.get("date"), f"current-season row {index} date"),
            "teamA": team_a,
            "teamB": team_b,
            "scoreA": None if row.get("scoreA", row.get("score_a")) is None else finite_number(row.get("scoreA", row.get("score_a")), f"current-season row {index} scoreA"),
            "scoreB": None if row.get("scoreB", row.get("score_b")) is None else finite_number(row.get("scoreB", row.get("score_b")), f"current-season row {index} scoreB"),
            "week": int(row["week"]),
            "round": str(row.get("round") or ""),
            "type": game_type(row),
            "status": status,
            "matchup_id": int(row["matchup_id"]),
            "rosterA": int(row["rosterA"]),
            "rosterB": int(row["rosterB"]),
        })
    playoff_rules = value.get("playoff_rules") or {}
    update_context = value.get("update_context") or {}
    return {
        "source": str(value.get("source") or "manual ESPN export"),
        "league_key": str(value.get("league_key") or value.get("league_id") or "viva"),
        "season": season,
        "generated_at": str(value.get("generated_at") or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")),
        "current_week": None if value.get("current_week") is None else int(value["current_week"]),
        "regular_season_max_week": int(value["regular_season_max_week"]),
        "max_week": int(value["max_week"]),
        "weeks_fetched": sorted({int(week) for week in value.get("weeks_fetched", [])}),
        "playoff_rules": {
            "regular_season_max_week": int(playoff_rules.get("regular_season_max_week", value["regular_season_max_week"])),
            "playoff_slots": int(playoff_rules["playoff_slots"]),
            "bye_slots": int(playoff_rules.get("bye_slots", 0)),
            "standings_tiebreakers": list(playoff_rules["standings_tiebreakers"]),
            "saunders_slots": int(playoff_rules.get("saunders_slots", 0)),
        },
        "update_context": {
            "mode": str(update_context.get("mode") or "manual"),
            "cutoff_date": iso_date(update_context["cutoff_date"], "current-season cutoff_date"),
            "contains_live_scores": strict_bool(update_context.get("contains_live_scores"), "current-season contains_live_scores"),
            "contains_projected_scores": strict_bool(update_context.get("contains_projected_scores"), "current-season contains_projected_scores"),
        },
        "teams": teams,
        "games": games,
    }


def atomic_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        handle.write(canonical_json(value))
        temporary = Path(handle.name)
    temporary.replace(path)


def validate_full_snapshot(games: list[dict[str, Any]], summary: list[dict[str, Any]], current: dict[str, Any] | None = None) -> None:
    """Fail closed on cross-season collisions before any canonical replace."""
    summary_keys = {(int(row["season"]), str(row["owner"])) for row in summary}
    if len(summary_keys) != len(summary):
        raise ValueError("full snapshot contains duplicate owner-season summary rows")

    seen_games: set[tuple[Any, ...]] = set()
    current_owners = {str(team["owner"]) for team in (current or {}).get("teams", [])}
    for index, game in enumerate(games):
        teams = tuple(sorted((str(game["teamA"]), str(game["teamB"]))))
        key = (int(game["season"]), str(game["date"]), int(game["week"]), *teams, str(game["type"]), str(game.get("round") or ""))
        if key in seen_games:
            raise ValueError(f"full snapshot contains duplicate game at row {index}")
        seen_games.add(key)
        season = int(game["season"])
        for owner in teams:
            if (season, owner) not in summary_keys and not (current and season == int(current["season"]) and owner in current_owners):
                raise ValueError(f"full snapshot game owner {owner!r} has no summary row for season {season}")

    seasons = sorted({int(row["season"]) for row in summary})
    for season in seasons:
        rows = [row for row in summary if int(row["season"]) == season]
        if sum(bool(row.get("champion")) for row in rows) != 1:
            raise ValueError(f"full snapshot season {season} must have exactly one champion")
        if sum(bool(row.get("saunders")) for row in rows) != 1:
            raise ValueError(f"full snapshot season {season} must have exactly one Saunders winner")


def merge_promoted_season(existing: list[dict[str, Any]], incoming: list[dict[str, Any]], season: int) -> list[dict[str, Any]]:
    """Replace one season in a canonical collection while preserving every other season."""
    return [row for row in existing if int(row.get("season")) != season] + incoming


def resolve_output_dir(root: Path, output_dir: Path, promote: bool) -> Path:
    resolved = output_dir.expanduser().resolve()
    canonical_assets = (root / "assets").resolve()
    if not promote and (resolved == canonical_assets or canonical_assets in resolved.parents):
        raise ValueError(f"candidate output directory cannot be inside canonical assets without --promote: {resolved}")
    return resolved


def write_candidate(output_dir: Path, games: list[dict[str, Any]], summary: list[dict[str, Any]], current: dict[str, Any] | None) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    atomic_write(output_dir / "H2H.json", games)
    atomic_write(output_dir / "SeasonSummary.json", summary)
    if current is not None:
        atomic_write(output_dir / "CurrentSeason.json", current)


def validate_staged_bundle(root: Path, output_dir: Path, current: dict[str, Any] | None, full_snapshot: bool) -> None:
    candidate_paths = [output_dir / "H2H.json", output_dir / "SeasonSummary.json"]
    if current is not None:
        candidate_paths.append(output_dir / "CurrentSeason.json")
    candidate_command = [
        "node",
        str(root / "scripts" / "validate_candidate.cjs"),
        "--root", str(root),
        "--candidate",
        *sum((["--asset", str(path)] for path in candidate_paths), []),
    ]
    candidate_result = subprocess.run(candidate_command, capture_output=True, text=True, check=False)
    if candidate_result.returncode:
        detail = (candidate_result.stdout + candidate_result.stderr).strip()
        raise ValueError(f"season candidate failed schema/semantic validation: {detail}")
    if not full_snapshot:
        return

    staged_current = output_dir / "CurrentSeason.json" if current is not None else root / "assets" / "CurrentSeason.json"
    paths = [
        output_dir / "H2H.json",
        output_dir / "SeasonSummary.json",
        root / "assets" / "Rivalries.json",
        staged_current,
        root / "assets" / "Shotguns.json",
    ]
    command = [
        "node",
        str(root / "scripts" / "validate_candidate.cjs"),
        "--root", str(root),
        *sum((["--asset", str(path)] for path in paths), []),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        detail = (result.stdout + result.stderr).strip()
        raise ValueError(f"staged candidate failed schema/semantic validation: {detail}")


def promote_candidate(root: Path, output_dir: Path, current: dict[str, Any] | None) -> None:
    atomic_write(root / "assets" / "H2H.json", load_json(output_dir / "H2H.json"))
    atomic_write(root / "assets" / "SeasonSummary.json", load_json(output_dir / "SeasonSummary.json"))
    if current is not None:
        atomic_write(root / "assets" / "CurrentSeason.json", load_json(output_dir / "CurrentSeason.json"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--season", required=True, type=int)
    parser.add_argument("--mapping", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--current-season", type=Path, help="Optional manual CurrentSeason candidate JSON")
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output_dir = resolve_output_dir(root, args.output_dir, args.promote)
    raw = load_json(args.input)
    reject_private(raw)
    mapping = load_json(args.mapping)
    aliases = owner_map(mapping)
    if isinstance(raw, list):
        games = raw
    else:
        games = raw.get("h2h", raw.get("games", []))
    if not args.summary:
        summary = raw.get("season_summary", raw.get("summary", [])) if isinstance(raw, dict) else []
    else:
        summary = load_json(args.summary)
        reject_private(summary)
    if not games or not summary:
        raise ValueError("input must provide non-empty h2h/games and season_summary/summary data")
    normalized_games = normalize_games(games, aliases, args.season)
    normalized_summary = normalize_summary(summary, aliases, args.season)
    current_raw = load_json(args.current_season) if args.current_season else (raw.get("current_season") or raw.get("currentSeason") if isinstance(raw, dict) else None)
    if current_raw is not None:
        reject_private(current_raw, "current-season")
    normalized_current = normalize_current_season(current_raw, aliases, args.season) if current_raw else None
    validate_candidate_team_count(normalized_summary, normalized_current, mapping, args.season)
    existing_games = load_json(root / "assets/H2H.json") if args.promote else []
    existing_summary = load_json(root / "assets/SeasonSummary.json") if args.promote else []
    existing_current = load_json(root / "assets/CurrentSeason.json") if args.promote and (root / "assets/CurrentSeason.json").exists() else None
    if args.promote:
        normalized_games = merge_promoted_season(existing_games, normalized_games, args.season)
        normalized_summary = merge_promoted_season(existing_summary, normalized_summary, args.season)
        if normalized_current is None:
            normalized_current = existing_current
    validate_full_snapshot(normalized_games, normalized_summary, normalized_current)
    stage_dir = output_dir
    temporary_stage = None
    canonical_assets = (root / "assets").resolve()
    if args.promote and (stage_dir == canonical_assets or canonical_assets in stage_dir.parents):
        temporary_stage = tempfile.TemporaryDirectory(prefix=".viva-import-", dir=root)
        stage_dir = Path(temporary_stage.name)
    try:
        write_candidate(stage_dir, normalized_games, normalized_summary, normalized_current)
        validate_staged_bundle(root, stage_dir, normalized_current, args.promote)
        if args.promote:
            promote_candidate(root, stage_dir, normalized_current)
    finally:
        if temporary_stage is not None:
            temporary_stage.cleanup()
    print(f"Wrote candidate {args.output_dir} ({len(normalized_games)} games, {len(normalized_summary)} summary rows{', CurrentSeason' if normalized_current else ''})")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
        print(f"import_viva_espn.py: {error}", flush=True)
        raise SystemExit(1)
