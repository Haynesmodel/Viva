# Viva data operations

This runbook keeps Viva's data reproducible and reviewable. Historical data is
fed by manually exported ESPN data; the separate current-season adapter is
guarded and review-PR-only as described below.

## Historical refresh

1. Export the required ESPN data locally. Do not place cookies, bearer tokens,
   session objects, credentials, or private account fields in the export.
2. Run the importer in candidate mode with an explicit season and mapping:

   ```bash
   python3 scripts/import_viva_espn.py --input /path/to/export.json \\
     --season 2025 --mapping scripts/viva_season_mapping.json \\
     --output-dir /tmp/viva-candidate
   ```

3. Inspect the candidate JSON and the importer summary. Verify owner aliases,
   team counts, dates, weeks, matchup orientation, and no duplicate games.
4. Promote only an approved candidate with `--promote`, then run
   `npm run generate:data` and `npm run test:assets`.
5. Review the generated diff and run the full unit/build/browser checks before
   opening a pull request.

The importer is fail-closed. It does not infer a season, follow another
league, call ESPN, or modify canonical assets in candidate mode.

## Current Season and historical Draft Spot

The configured `CurrentSeason.json` snapshot is present for the current
season. A credentialed refresh may update it only through the guarded Tuesday
workflow described below; the workflow opens a review PR and never publishes
directly to `main`.

Draft Spot is generated only from reviewed `draft_pick` fields in
`SeasonSummary.json`. Complete, verified draft order is currently populated for
the approved 2020–2025 seasons. A missing or unverified season must remain
unavailable; never infer its order from standings, finish, screenshots, or a
partial export.

### Historical draft-order enrichment

Historical draft order is a separate, commissioner-reviewed backfill. Prepare
one sanitized local file per season; retain only the season, the team name as
shown by ESPN, and the team's original draft position:

```json
{
  "season": 2025,
  "draft_order": [
    {"source_team_name": "Team name shown by ESPN", "draft_pick": 1}
  ]
}
```

Run candidate mode to an untracked directory and inspect both the candidate
summary and `draft-order-report.json`:

```bash
python3 scripts/enrich_viva_draft_order.py \
  --input /secure/local/viva-draft-2025.json \
  --season 2025 --mapping scripts/viva_season_mapping.json \
  --output-dir /tmp/viva-draft-candidate-2025
```

The command fails closed on private/session fields, wrong seasons, incomplete
or duplicate orders, out-of-range picks, and unknown or ambiguous owner names.
It never contacts ESPN, reads credentials, or writes under `assets/` in
candidate mode. The commissioner must reconcile the report against the
private source manifest and approve the exact owner-to-pick mapping. A season
that cannot be verified completely remains unavailable.

After approval, promote one season explicitly, then regenerate and validate the
derived assets in the normal reviewed data PR:

```bash
python3 scripts/enrich_viva_draft_order.py \
  --input /secure/local/viva-draft-2025.json \
  --season 2025 --mapping scripts/viva_season_mapping.json \
  --output-dir /tmp/viva-draft-promote-2025 --promote
npm run generate:data
npm run test:assets
```

Promotion changes only the selected season's optional `draft_pick` fields in
`SeasonSummary.json`; it never changes H2H, CurrentSeason, Rivalries,
Shotguns, owner presentation, or media. Keep Transactions and Player History
out of this workflow; they remain separately deferred scope. Never commit the
sanitized source files or a private commissioner manifest.

`scripts/import_viva_espn.py` is for a one-time historical import of a
sanitized, normalized local source. It does not call ESPN.

`scripts/refresh_viva_current_season.py` is the separate adapter for ESPN's
current season response. It only writes `CurrentSeason.json`, so an ongoing
season is never forced through finalized historical summary validation. It
requires the target season's team count, owner aliases, and a
`current_season` block in `scripts/viva_season_mapping.json` with the
commissioner-verified league key, regular/max weeks, playoff/bye/Last place
slots, standings tiebreakers, and any commissioner-verified `week_display_dates`
overrides. ESPN's matchup date and scoring-period `startDate` represent the
provider's scoring-period boundary; use a display-date override when that
boundary is not the date the league should show to users. The adapter also
normalizes ESPN's `NONE` playoff-tier sentinel to the empty regular-season
round.

## Tuesday current-season refresh

The `Refresh current season` workflow is scheduled for Tuesday at 10:17 AM
America/Chicago, but the schedule is guarded and runs only when repository
variable `VIVA_ESPN_ENABLED` is exactly the literal string `true`. Manual
dispatch is available while that gate is disabled and is the required proof
path before enabling the schedule.

Run this procedure without disclosing any secret value:

1. Check that the required repository variables
   `VIVA_ESPN_LEAGUE_ID`, `VIVA_ESPN_SEASON`, and `VIVA_MEDIA_BASE_URL` exist.
   For a private league, also check that the `VIVA_ESPN_S2` and
   `VIVA_ESPN_SWID` Actions secrets exist. Never print or copy their values.
2. In **Settings → Actions → General**, confirm workflow permissions provide
   `contents: write` and `pull-requests: write`, and that repository policy
   permits GitHub Actions to create review pull requests. The checked-in
   workflow does not approve or merge anything.
3. Keep the scheduled gate disabled. Use **Actions → Refresh current season →
   Run workflow** with the intended season, then inspect the run and any
   `automation/espn-current-season` pull request.
4. Review the normalized `CurrentSeason.json` and generated dependent assets,
   run the required CI checks, and merge a resulting PR only through normal
   maintainer review. A successful no-change run is also a valid proof result.
5. Only after a correct manual run or reviewed no-change result, set
   `VIVA_ESPN_ENABLED` to exact lowercase `true`. Record the next Tuesday
   10:17 AM America/Chicago expected run and review every resulting PR.
6. To pause future schedules, remove the variable or set it to any value other
   than `true`; manual dispatch remains available for diagnosis.

The workflow fetches and validates server-side, regenerates only
`CurrentSeason.json` plus its dependent generated assets, and opens/updates
`automation/espn-current-season` as a review PR. A no-change manual dispatch
proves the fetch, normalization, generation, and validation path, but does not
exercise review-PR permissions. When a changed run successfully pushes the
review branch and opens or updates its PR, it verifies the configured
`contents: write`/`pull-requests: write` policy; a new PR exercises
`gh pr create`, while an existing open PR exercises `gh pr edit`. It never
commits raw ESPN responses, credentials, or browser session data, and it never
merges its own PR. No administration-scoped preflight credential is used.

## Shotguns and external media

`assets/Shotguns.json` is the source of record for all 98 rows (95 completed
and media-backed, 3 owed). Keep IDs, owner, week, date, cause, due date,
completion, and `media_key` stable. Do not commit video bytes to the Pages
artifact. The reviewed external Viva media origin is supplied through
`VITE_VIVA_MEDIA_BASE_URL`; run:

```bash
npm run check:viva-media
VITE_BASE_PATH=/ npm run build
```

The media audit must report zero video files in `dist/` and every preserved
clip must have exactly one completed Shotguns media key.

## Deployment and rollback

Deploy only a reviewed PR whose generated assets, bundle audit, media audit,
Chromium, WebKit smoke, accessibility, and coverage checks pass. After deploy,
verify the core routes, Shotguns owed/completed states, modal playback, mobile
layout, dark mode, optional-state messaging, and Transactions absence.

For rollback, redeploy the last known-good Viva artifact and restore the prior
manifest/media-origin configuration. Restore source JSON and generated output
as one coherent snapshot, then rerun the asset and build checks. Do not modify
the reference repository or add automation without a new approved scope.

## Apex-domain cutover and rollback

The canonical site URL is `https://taylorsahoefantasy.com/`. GitHub Pages owns
the site and certificate; `www.taylorsahoefantasy.com` is a redirect alias, and
`media.taylorsahoefantasy.com` remains the separate Shotguns media host.

Before public DNS changes, the owner verifies the domain with GitHub and sets
the Pages custom domain to the exact apex hostname and complete GitHub's
verification before merging or deploying the root-base PR. The main push
workflow checks the Pages API and refuses to package/deploy the root-base
artifact while the custom domain is unset, different, or unverified. Then
create only the documented DNS-only GitHub Pages apex records
and the direct `www` CNAME to `Haynesmodel.github.io`; do not proxy them, add a
wildcard, or modify the media record. Enable Enforce HTTPS only after Pages
reports the certificate ready and an apex HTTPS request succeeds. Record the
apex, `www`, root-route, media, and legacy project-URL checks after
propagation.

If activation fails, keep the old
`https://haynesmodel.github.io/Viva/` URL as the availability reference. If the
root-base artifact has already deployed, first revert the root-base PR and
wait for the restored `/Viva/` build to deploy and verify at that URL. Only
then remove the Pages custom-domain setting and the new apex/`www` web
records. Never roll back by changing the media host, data assets, owner
records, or Shotguns keys.

## Deferred scope

Transactions and Player History remain out of scope. Historical ESPN import
and draft enrichment remain manual, candidate-first, and commissioner-reviewed;
they do not infer or fill unverified seasons. Credentialed current-season
refresh is implemented but remains guarded until the manual proof and review
steps above are complete. Do not reintroduce unrelated Sleeper workflows or
new ESPN data surfaces without a separately approved data/security contract.
