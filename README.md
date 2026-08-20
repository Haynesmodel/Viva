# Viva

Viva is a static fantasy-league history application deployed at
`https://taylorsahoefantasy.com/`. The `www` hostname is the permanent
redirect alias; `media.taylorsahoefantasy.com` remains the separate host for
Shotguns media.

The application owns its data, branding, media references, and deployment. The
current snapshot adopts the shared platform shape documented in
[`docs/VIVA_DARLING_SNAPSHOT.md`](docs/VIVA_DARLING_SNAPSHOT.md), but does not
merge or replay another repository's history.

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
- `assets/CurrentSeason.json` and draft-pick fields are optional. They remain
  unavailable until a reviewed ESPN export is normalized and promoted.
- `assets/Shotguns.json` contains 98 curated records: 95 completed,
  media-backed records and 3 owed records. Completed records
  contain stable `media_key` values; video bytes remain outside the Pages
  artifact and are resolved through `VITE_VIVA_MEDIA_BASE_URL`.
- `scripts/import_viva_espn.py` accepts local, manually exported ESPN JSON for
  one-time historical imports, validates the season and owner mapping, and
  writes a candidate only. Use `--promote` after review; the importer rejects
  private/session/credential fields and never calls an ESPN API.
- `scripts/refresh_viva_current_season.py` is the separate server-side current
  season adapter. The Tuesday GitHub Actions workflow uses it only after the
  required ESPN configuration is enabled, and opens a review PR rather than
  publishing directly to `main`.
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
