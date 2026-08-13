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
import shutil
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
            result[str(alias).strip().casefold()] = str(canonical).strip()
    return result


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


SUMMARY_FIELDS = ("season", "owner", "wins", "losses", "ties", "finish", "points_for", "points_against", "playoff_wins", "playoff_losses", "saunders_wins", "saunders_losses", "champion", "saunders", "bye", "wild_card", "saunders_bye", "bagels_earned")


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
                normalized[field] = bool(row.get(field, False))
            elif field == "bagels_earned":
                normalized[field] = None if row.get(field) is None else finite_number(row.get(field), f"summary row {index} {field}")
            else:
                normalized[field] = int(row.get(field, 0)) if field in ("wins", "losses", "ties", "finish", "playoff_wins", "playoff_losses", "saunders_wins", "saunders_losses") else finite_number(row.get(field, 0), f"summary row {index} {field}")
        output.append(normalized)
    return output


def write_candidate(output_dir: Path, games: list[dict[str, Any]], summary: list[dict[str, Any]], promote: bool) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "H2H.json").write_text(canonical_json(games), encoding="utf-8")
    (output_dir / "SeasonSummary.json").write_text(canonical_json(summary), encoding="utf-8")
    if promote:
        root = Path(__file__).resolve().parents[1]
        shutil.copy2(output_dir / "H2H.json", root / "assets/H2H.json")
        shutil.copy2(output_dir / "SeasonSummary.json", root / "assets/SeasonSummary.json")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--season", required=True, type=int)
    parser.add_argument("--mapping", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
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
    write_candidate(args.output_dir, normalized_games, normalized_summary, args.promote)
    print(f"Wrote candidate {args.output_dir} ({len(normalized_games)} games, {len(normalized_summary)} summary rows)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"import_viva_espn.py: {error}", flush=True)
        raise SystemExit(1)
