# Viva data operations

This runbook keeps Viva's data reproducible and reviewable while the league is
fed by manually exported ESPN data.

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

## Current Season, Draft Spot, and Tuesday refresh

Current Season is optional and must be correctly seasoned before promotion.
Draft Spot is generated only from reviewed `draft_pick` fields in
`SeasonSummary.json`. The current snapshot has zero draft-pick fields, so the
route remains an accessible unavailable state rather than showing invented
order.

`scripts/import_viva_espn.py` is for a one-time historical import of a
sanitized, normalized local source. It does not call ESPN.

`scripts/refresh_viva_current_season.py` is the separate adapter for ESPN's
current season response. It only writes `CurrentSeason.json`, so an ongoing
season is never forced through finalized historical summary validation. It
requires the target season's team count, owner aliases, and a
`current_season` block in `scripts/viva_season_mapping.json` with the
commissioner-verified league key, regular/max weeks, playoff/bye/Saunders
slots, standings tiebreakers, and any commissioner-verified `week_display_dates`
overrides. ESPN's matchup date and scoring-period `startDate` represent the
provider's scoring-period boundary; use a display-date override when that
boundary is not the date the league should show to users. The adapter also
normalizes ESPN's `NONE` playoff-tier sentinel to the empty regular-season
round.

The `Refresh current season` workflow is scheduled for Tuesday at 10:17 AM
America/Chicago. It is disabled until repository variable
`VIVA_ESPN_ENABLED` is exactly `true`. When enabled it needs:

- `VIVA_ESPN_LEAGUE_ID` and `VIVA_ESPN_SEASON` repository variables;
- `VIVA_MEDIA_BASE_URL` (already configured for the production build);
- for a private league only, `VIVA_ESPN_S2` and `VIVA_ESPN_SWID` GitHub Actions
  secrets.

Before enabling the workflow, open the repository's **Settings → Actions →
General** page and set **Workflow permissions** to **Read and write
permissions**, then enable **Allow GitHub Actions to create and approve pull
requests**. The approval capability is required by GitHub's `GITHUB_TOKEN`
policy for this automated review-PR flow; the workflow itself never approves
or merges its PR. The workflow relies on this setup and does not use an
Administration-scoped preflight credential; `gh pr create` is the authoritative
check when the first review PR is opened.

The workflow fetches server-side, validates the candidate, regenerates data,
and opens/updates `automation/espn-current-season` as a review PR. It never
commits raw ESPN responses, credentials, or browser session data, and it never
merges its own PR. Test it first with **Run workflow** before setting
`VIVA_ESPN_ENABLED=true`.

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
the Pages custom domain to the exact apex hostname. Then create only the
documented DNS-only GitHub Pages apex records and the direct `www` CNAME to
`Haynesmodel.github.io`; do not proxy them, add a wildcard, or modify the
media record. Enable Enforce HTTPS only after Pages reports the certificate
ready and an apex HTTPS request succeeds. Record the apex, `www`, root-route,
media, and legacy project-URL checks after propagation.

If activation fails, keep the old
`https://haynesmodel.github.io/Viva/` URL as the availability reference. Before
or after DNS exposure, remove the Pages custom-domain setting and only the new
apex/`www` web records, confirm the old URL, and revert the root-base PR through
the normal review process if application behavior is defective. Never roll
back by changing the media host, data assets, owner records, or Shotguns keys.

## Deferred automation

Credentialed ESPN discovery, scheduled refreshes, Transactions, and Player
History remain deferred. They require a separately approved data/security
contract and representative exports; they must not be reintroduced by copying
an unrelated workflow.
