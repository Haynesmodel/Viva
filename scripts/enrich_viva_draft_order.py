#!/usr/bin/env python3
"""Enrich one reviewed, local draft-order export into a safe Viva candidate.

The input is intentionally small and sanitized::

    {"season": 2025, "draft_order": [
      {"source_team_name": "Team shown by ESPN", "draft_pick": 1}
    ]}

This command never contacts ESPN. Candidate mode writes only to ``--output-dir``;
``--promote`` atomically replaces the canonical SeasonSummary asset after the
repository's schema and semantic validation pass.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from contextlib import nullcontext
from pathlib import Path
from typing import Any


PRIVATE_FIELD = re.compile(
    r"(?:cookie|session|token|secret|password|authorization|bearer|credential|auth)",
    re.IGNORECASE,
)


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def reject_private(value: Any, path: str = "input") -> None:
    """Reject credentials before any source value is normalized or reported."""
    if isinstance(value, dict):
        for key, child in value.items():
            if PRIVATE_FIELD.search(str(key)):
                raise ValueError(f"private field rejected at {path}.{key}")
            reject_private(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_private(child, f"{path}[{index}]")


def aliases_from_mapping(mapping: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for canonical, raw_aliases in mapping.get("owners", {}).items():
        aliases = raw_aliases if isinstance(raw_aliases, list) else []
        for alias in [canonical, *aliases]:
            key = str(alias).strip().casefold()
            if not key:
                continue
            previous = result.get(key)
            if previous is not None and previous != canonical:
                raise ValueError(f"ambiguous owner alias {alias!r}: maps to both {previous!r} and {canonical!r}")
            result[key] = str(canonical)
    return result


def team_count(mapping: dict[str, Any], season: int) -> int:
    config = mapping.get("seasons", {}).get(str(season))
    if not isinstance(config, dict) or not isinstance(config.get("teams"), int):
        raise ValueError(f"season {season} is not configured with a team count")
    if config["teams"] < 2:
        raise ValueError(f"season {season} has an invalid team count")
    return config["teams"]


def normalize_order(raw: Any, requested_season: int, aliases: dict[str, str], expected: int) -> list[dict[str, Any]]:
    if not isinstance(raw, dict):
        raise ValueError("input must be a JSON object")
    if "season" not in raw or int(raw["season"]) != requested_season:
        raise ValueError(f"input season does not match requested season {requested_season}")
    source = raw.get("draft_order")
    if not isinstance(source, list) or not source:
        raise ValueError("input draft_order must be a non-empty array")
    if len(source) != expected:
        raise ValueError(f"season {requested_season} draft_order has {len(source)} rows; expected {expected}")

    owners: list[str] = []
    picks: list[int] = []
    for index, entry in enumerate(source):
        if not isinstance(entry, dict):
            raise ValueError(f"draft_order row {index} must be an object")
        source_name = str(entry.get("source_team_name") or "").strip()
        if not source_name:
            raise ValueError(f"draft_order row {index} is missing source_team_name")
        owner = aliases.get(source_name.casefold())
        if owner is None:
            raise ValueError(f"unknown owner alias {source_name!r} in season {requested_season}")
        pick = entry.get("draft_pick")
        if isinstance(pick, bool) or not isinstance(pick, int):
            raise ValueError(f"draft_order row {index} draft_pick must be an integer")
        owners.append(owner)
        picks.append(pick)
    if len(set(owners)) != expected:
        duplicate = next(owner for owner in owners if owners.count(owner) > 1)
        raise ValueError(f"duplicate canonical owner {duplicate!r} in season {requested_season}")
    expected_picks = set(range(1, expected + 1))
    if set(picks) != expected_picks:
        raise ValueError(f"season {requested_season} draft picks must be the complete range 1-{expected}")
    return [{"owner": owner, "draft_pick": pick} for owner, pick in zip(owners, picks)]


def staged_summary(root: Path, season: int, normalized: list[dict[str, Any]]) -> list[dict[str, Any]]:
    baseline = load_json(root / "assets" / "SeasonSummary.json")
    by_owner = {entry["owner"]: entry["draft_pick"] for entry in normalized}
    selected = [row for row in baseline if int(row.get("season")) == season]
    if len(selected) != len(normalized) or {str(row["owner"]) for row in selected} != set(by_owner):
        raise ValueError(f"season {season} draft owners do not exactly match SeasonSummary owners")
    output: list[dict[str, Any]] = []
    for row in baseline:
        copy = dict(row)
        if int(row.get("season")) == season:
            copy["draft_pick"] = by_owner[str(row["owner"])]
        output.append(copy)
    return output


def validate_staged(root: Path, summary_path: Path) -> None:
    """Run the normal full bundle validator against canonical assets plus staged summary."""
    command = [
        "node", str(root / "scripts" / "validate_candidate.cjs"), "--root", str(root),
        "--asset", str(root / "assets" / "H2H.json"), "--asset", str(summary_path),
        "--asset", str(root / "assets" / "Rivalries.json"), "--asset", str(root / "assets" / "CurrentSeason.json"),
        "--asset", str(root / "assets" / "Shotguns.json"),
    ]
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, check=False)
    if result.returncode:
        detail = (result.stdout + result.stderr).strip()
        raise ValueError(f"staged SeasonSummary failed schema/semantic validation: {detail}")


def audit(season: int, normalized: list[dict[str, Any]], promoted: bool) -> dict[str, Any]:
    return {
        "season": season,
        "owner_count": len(normalized),
        "owners": [entry["owner"] for entry in normalized],
        "accepted_pick_range": f"1-{len(normalized)}",
        "promoted": promoted,
        "source": "local sanitized draft-order input",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--season", required=True, type=int)
    parser.add_argument("--mapping", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output_dir = args.output_dir.expanduser().resolve()
    assets = (root / "assets").resolve()
    if not args.promote and (output_dir == assets or assets in output_dir.parents):
        raise ValueError(f"candidate output directory cannot be inside canonical assets without --promote: {output_dir}")

    raw = load_json(args.input)
    reject_private(raw)
    mapping = load_json(args.mapping)
    reject_private(mapping, "mapping")
    expected = team_count(mapping, args.season)
    normalized = normalize_order(raw, args.season, aliases_from_mapping(mapping), expected)
    summary = staged_summary(root, args.season, normalized)
    inside_assets = output_dir == assets or assets in output_dir.parents
    # Promotion must never stage candidate data under assets: validation must
    # complete before the canonical file is even opened for replacement.
    temporary_stage = tempfile.TemporaryDirectory(prefix=".viva-draft-", dir=root) if args.promote else nullcontext()
    with temporary_stage as temporary_path:
        stage_dir = Path(temporary_path) if args.promote else output_dir
        stage_dir.mkdir(parents=True, exist_ok=True)
        summary_path = stage_dir / "SeasonSummary.json"
        write_json(summary_path, summary)
        validate_staged(root, summary_path)
        if args.promote:
            write_json(root / "assets" / "SeasonSummary.json", summary)
            # Keep the requested audit output when it is safe to do so. An
            # assets path is intentionally ignored to avoid writing a report
            # into canonical data directories.
            if not inside_assets:
                output_dir.mkdir(parents=True, exist_ok=True)
                write_json(output_dir / "SeasonSummary.json", summary)
                write_json(output_dir / "draft-order-report.json", audit(args.season, normalized, True))
        else:
            write_json(output_dir / "draft-order-report.json", audit(args.season, normalized, False))
    print(f"Draft order {'promoted' if args.promote else 'candidate validated'}: season {args.season}, {len(normalized)} owners, picks 1-{len(normalized)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError, subprocess.SubprocessError) as error:
        print(f"enrich_viva_draft_order.py: {error}", flush=True)
        raise SystemExit(1)
