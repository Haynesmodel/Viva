# save as sleeper_turnstile_2025.py and run:  python3 sleeper_turnstile_2025.py
import requests, collections

LEAGUE_ID = "1257071385973362690"
SEASON = "2025"

BASE = "https://api.sleeper.app/v1"

def get(url):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json()

# 0) figure out current NFL week (to avoid looping past the season)
state = get(f"{BASE}/state/nfl")
current_leg = state.get("leg", 18)

# 1) map roster_id -> owner user_id (and also get users for display if wanted)
rosters = get(f"{BASE}/league/{LEAGUE_ID}/rosters")
roster_ids = {r["roster_id"] for r in rosters}

# 2) seed initial team for every drafted player (so draft team counts as a team)
drafts = get(f"{BASE}/league/{LEAGUE_ID}/drafts")
draft_id = drafts[0]["draft_id"]  # most recent
picks = get(f"{BASE}/draft/{draft_id}/picks")

player_teams = collections.defaultdict(set)  # player_id -> set of roster_ids that have owned them
for p in picks:
    pid = p.get("player_id")
    rid = p.get("roster_id")
    if pid and rid in roster_ids:
        player_teams[pid].add(rid)

# 3) traverse weekly transactions and record adds/drops, plus pickup/drop counts
pickups = collections.Counter()  # player_id -> number of times added (waiver or FA)
drops   = collections.Counter()  # player_id -> number of times dropped

for week in range(1, current_leg + 1):
    txs = get(f"{BASE}/league/{LEAGUE_ID}/transactions/{week}")
    for tx in txs:
        # Any add puts the player onto a roster_id (tx['roster_ids'] shows involved rosters; adds/drops are dicts)
        adds = tx.get("adds") or {}
        drops_map = tx.get("drops") or {}

        # record team ownership history
        # For adds: adds is {player_id: roster_id}
        for pid, rid in adds.items():
            if rid in roster_ids:
                player_teams[pid].add(rid)
            pickups[pid] += 1

        # For drops: drops is {player_id: roster_id}
        for pid, rid in drops_map.items():
            if rid in roster_ids:
                player_teams[pid].add(rid)  # the dropping team definitely owned them
            drops[pid] += 1

# 4) compute winners
most_teams = sorted(((pid, len(rids)) for pid, rids in player_teams.items()),
                    key=lambda x: (-x[1], x[0]))[:10]
most_pickups = pickups.most_common(10)
most_drops   = drops.most_common(10)

# 5) resolve player ids to names for a friendly printout
players = get(f"{BASE}/players/nfl")  # one big dict: player_id -> player object (first_name/last_name)
def name(pid):
    p = players.get(str(pid), {})
    return (p.get("full_name")
            or ((p.get("first_name") or "") + " " + (p.get("last_name") or "")).strip()
            or str(pid))

print("\n== Most different teams owned a player in 2025 ==")
for pid, count in most_teams:
    print(f"{name(pid)} — {count} teams")

print("\n== Most pickups (adds) in 2025 ==")
for pid, c in most_pickups:
    print(f"{name(pid)} — {c} pickups")

print("\n== Most drops in 2025 ==")
for pid, c in most_drops:
    print(f"{name(pid)} — {c} drops")
