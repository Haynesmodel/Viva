# Viva data operations

This runbook keeps Viva's data reproducible, reviewable, and credential-safe.
Historical data is still fed by reviewed local exports; the current-season
snapshot has a separate server-side ESPN workflow that always publishes
through a human-reviewed pull request.

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
slots, and standings tiebreakers.

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

### Secure activation checklist

Complete these steps before the first manual dispatch:

1. Delete any credential-bearing Actions variables, rotate the associated ESPN
   session cookies, and create only the `VIVA_ESPN_S2` and
   `VIVA_ESPN_SWID` Actions secrets. Never reuse a value that was stored in a
   variable or share a cookie in chat, a ticket, a pull request, or a commit.
2. Confirm the non-secret `VIVA_ESPN_LEAGUE_ID`, `VIVA_ESPN_SEASON`, and
   `VIVA_MEDIA_BASE_URL` variables by name and expected non-sensitive value.
   Keep `VIVA_ESPN_ENABLED` unset or different from the literal `true`.
3. Confirm Actions has read/write workflow permissions and may create pull
   requests. The workflow may create or update its bot review PR, but it never
   approves or merges that PR.
4. Add the commissioner-verified season mapping and rules before dispatching.
   Do not infer team aliases, team count, playoff settings, or tiebreakers
   from historical data.
5. Inspect the open PR and branch state for
   `automation/espn-current-season` before the first run. A successful run may
   update that bot-owned PR; it must not overwrite human-authored work.

Verification is name-only for secrets. Do not request, print, serialize, or
capture secret values in terminal output, workflow logs, screenshots, PR
bodies, or agent messages.

### Refresh recovery

- **Expired or exposed session:** leave the schedule gate disabled, delete the
  affected secret, rotate the ESPN session, recreate only the Actions secret,
  and rerun manually. Treat any old value as unusable.
- **Mapping or rule failure:** do not merge a generated PR. Correct the
  commissioner-reviewed mapping in a focused pull request, then rerun the
  manual workflow.
- **401/403 or workflow permission failure:** keep the gate disabled, correct
  the Actions secret or repository setting, and retry through `workflow_dispatch`.
  Do not substitute a personal access token in the workflow.
- **Incorrect generated snapshot:** close or reject the bot PR, disable the
  schedule, and revert the data PR as one coherent snapshot if it was merged.
  Correct the source mapping before rerunning.
- **Unexpected scheduled behavior:** set `VIVA_ESPN_ENABLED` to a value other
  than `true` immediately. Investigate with a controlled manual dispatch and
  keep every generated change behind normal human review.

## Shotguns and external media

`assets/Shotguns.json` is the source of record for all 98 rows (95 completed
and media-backed, 3 owed). Keep IDs, owner, week, date, cause, due date,
completion, and `media_key` stable. Do not commit video bytes to the Pages
artifact. The reviewed external Viva media origin is supplied through
`VITE_VIVA_MEDIA_BASE_URL`; run:

```bash
npm run check:viva-media
VITE_BASE_PATH=/Viva/ npm run build
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

## Deferred scope

The credentialed current-season refresh and Tuesday schedule are implemented
above, but the schedule remains disabled until the first manually dispatched
2026 snapshot is reviewed, merged, and verified after deployment. Recurring
refreshes continue to open or update a review PR; they never auto-merge or
write directly to `main`.

Transactions and Player History remain deferred. They require a separate
approved data/security contract and representative exports; they must not be
reintroduced by copying this workflow or an unrelated automation.
