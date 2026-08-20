# Viva

Viva is a static fantasy-league history application deployed at
`https://taylorsahoefantasy.com/`. The `www` hostname is the permanent
redirect alias; `media.taylorsahoefantasy.com` remains the separate host for
Shotguns media.

The application owns its data, branding, media references, and deployment. The
current snapshot adopts the shared platform shape documented in
[`docs/VIVA_DARLING_SNAPSHOT.md`](docs/VIVA_DARLING_SNAPSHOT.md), but does not
merge or replay another repository's history.

## An archive built like a data product

Viva is a purpose-built, evidence-first archive for one fantasy league—not a
generic dashboard with a league logo applied afterward. It brings rigorous
historical analysis, a populated current-season command center, and the
gloriously specific accountability of Shotguns into one bespoke league
identity. The repository currently carries 486 head-to-head rows, 66
season-summary rows across six verified seasons, nine named rivalry groups, 98
curated Shotguns records, and verified historical draft order for 2020–2025.

- **Auditable by construction.** Canonical JSON, typed validators, generated
  assets, candidate-first import workflows, and deterministic derived models
  make the path from league record to visible fact inspectable and repeatable.
- **Analysis with context.** Pulse, History, Current Season, Head to Head,
  Trophy, Dynasty, Draft Spot, Historical Matchup, and Shotguns each answer a
  different league question while preserving the underlying record.
- **Accessible as a product requirement.** Semantic controls, keyboard and
  focus coverage, responsive layouts, and Axe-backed route checks are part of
  the delivery contract—not a polish pass after the statistics are done.
- **Distinctly Viva.** Custom owner presentation, banner pages, the Shotguns
  archive, and a separate media host give the site its own visual and
  operational identity. Viva shares useful platform foundations with Darling
  while remaining an independent repository with independent data boundaries.

## Development

```bash
npm ci
npm run test:unit
npm run test:ui:preview:chromium
npm run test:ui:preview:webkit
VITE_BASE_PATH=/ npm run build
```

The build validates JSON schemas, semantic relationships, generated assets,
CSS, TypeScript, route boundaries, bundle budgets, and the Pages artifact.

### Casual browser gate

Viva starts behind a browser-side casual access gate. When browser storage is
available, a successful entry is remembered only in that browser tab's
`sessionStorage`; if storage is denied, it unlocks only the current document.
The gate is a convenience deterrent rather than secure authentication. The
phrase and static bundle are delivered to every visitor, so source code, JSON,
media keys, and direct asset URLs remain public. Restricted access would
require a separately approved protected hosting or edge solution.

## Domain cutover and rollback

The GitHub Pages custom domain and the repository root `CNAME` must both be
`taylorsahoefantasy.com`. The main push workflow queries the Pages API and
refuses to package or deploy the root-base artifact until that exact custom
domain is configured and reported as verified. Before merging this cutover
PR, the owner should verify the domain in GitHub and configure the Pages
custom domain; only then publish DNS-only GitHub Pages records for the apex
and a `www` CNAME pointing directly to `Haynesmodel.github.io`. Do not proxy
these records, add a wildcard, or change `media.taylorsahoefantasy.com`.

After Pages reports the custom domain served and HTTPS is available, verify the
apex routes and the single permanent `www` redirect before enabling Enforce
HTTPS. To roll back after the root-base artifact has deployed, first revert
the root-base PR and wait for the restored `/Viva/` build to deploy and verify
at `https://haynesmodel.github.io/Viva/`. Only then remove the Pages
custom-domain setting and the new apex/`www` web records. Do not alter data,
owner assets, Shotguns records, or the media host.

## Data and media

- `assets/H2H.json`, `assets/SeasonSummary.json`, and `assets/Rivalries.json`
  are the canonical historical data sources.
- `assets/CurrentSeason.json` contains the configured current-season snapshot.
  Verified historical draft order is populated for the approved 2020–2025
  seasons; future or unverified seasons remain intentionally unavailable.
- `assets/Shotguns.json` contains 98 curated records: 95 completed,
  media-backed records and 3 owed records. Completed records
  contain stable `media_key` values; video bytes remain outside the Pages
  artifact and are resolved through `VITE_VIVA_MEDIA_BASE_URL`.
- `scripts/import_viva_espn.py` accepts local, manually exported ESPN JSON for
  one-time historical imports, validates the season and owner mapping, and
  writes a candidate only. Use `--promote` after review; the importer rejects
  private/session/credential fields and never calls an ESPN API.
- `scripts/enrich_viva_draft_order.py` is the separate local-only,
  candidate-first workflow for a complete commissioner-approved draft order.
  Its sanitized input contains only `season`, `source_team_name`, and
  `draft_pick`; unavailable seasons remain absent. Candidate output is
  validated outside `assets/`, and only explicit promotion may update the
  selected `SeasonSummary.json` draft fields. Transactions and Player History
  remain deliberately out of scope.
- `scripts/refresh_viva_current_season.py` is the separate server-side current
  season adapter. A manual workflow dispatch can prove it while the scheduled
  gate is off; the Tuesday GitHub Actions schedule runs only when
  `VIVA_ESPN_ENABLED` is exactly `true`. It opens or updates a review PR rather
  than publishing directly to `main`, and requires `VIVA_ESPN_LEAGUE_ID`,
  `VIVA_ESPN_SEASON`, `VIVA_MEDIA_BASE_URL`, and (for a private league) the
  `VIVA_ESPN_S2` and `VIVA_ESPN_SWID` Actions secrets. Never place credential
  values in the repository, logs, or documentation.
- `scripts/check_viva_media.cjs` audits the 95 preserved local clips and the
  built artifact. Every preserved clip must be referenced by one completed
  Shotguns record.

See [`docs/VIVA_DATA_OPERATIONS.md`](docs/VIVA_DATA_OPERATIONS.md) for the
manual normalization, promotion, media, deployment, and rollback procedure.

## Scope

Viva supports Pulse, My Team, History, Current Season, Head to Head, Trophy,
Dynasty, Draft Spot, Historical Matchup, and Shotguns. Transactions and Player
History are intentionally not registered in V1. No Sleeper workflow, runtime,
credential, or league identifier is part of this application.
