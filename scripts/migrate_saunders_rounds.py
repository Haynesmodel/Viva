#!/usr/bin/env python3
"""
Normalize Saunders round labels across seasons.

League change:
- Pre-6-team Saunders seasons: "Saunders Round 1" should be treated as "Saunders Semi Final"
- Starting in SIX_TEAM_START season: "Saunders Round 1" is "Saunders Wild Card"
  and what used to be "Saunders Round 2" becomes "Saunders Semi Final"

This is intended to be idempotent.
"""
import argparse, json, sys
from pathlib import Path

def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def save(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def normalize(game, six_team_start: int):
    if game.get("type") != "Saunders":
        return False

    season = int(game.get("season") or 0)
    rnd = game.get("round")
    if rnd is None:
        return False

    changed = False

    # Normalize a few common variants
    rnd_norm = str(rnd).strip()

    if season < six_team_start:
        if rnd_norm == "Saunders Round 1":
            game["round"] = "Saunders Semi Final"
            changed = True
    else:
        if rnd_norm == "Saunders Round 1":
            game["round"] = "Saunders Wild Card"
            changed = True
        elif rnd_norm == "Saunders Round 2":
            game["round"] = "Saunders Semi Final"
            changed = True

    return changed

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="in_path", required=True, help="Input H2H.json")
    p.add_argument("--out", dest="out_path", required=True, help="Output H2H.json")
    p.add_argument("--six-team-start", type=int, default=2025, help="Season when Saunders moved to 6 teams (default 2025)")
    p.add_argument("--in-place", action="store_true", help="Allow overwriting output path")
    args = p.parse_args()

    in_path = Path(args.in_path)
    out_path = Path(args.out_path)

    if (in_path.resolve() == out_path.resolve()) and not args.in_place:
        print("Refusing to overwrite input without --in-place", file=sys.stderr)
        sys.exit(2)

    data = load(in_path)
    if not isinstance(data, list):
        print("H2H.json must be a list", file=sys.stderr)
        sys.exit(1)

    changed = 0
    for g in data:
        try:
            if normalize(g, args.six_team_start):
                changed += 1
        except Exception:
            continue

    save(out_path, data)
    print(f"Normalized Saunders rounds. Updated {changed} games. Wrote: {out_path}")

if __name__ == "__main__":
    main()
