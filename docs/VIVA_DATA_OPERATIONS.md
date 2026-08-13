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

## Current Season and Draft Spot

Current Season is optional and must be correctly seasoned before promotion.
Draft Spot is generated only from reviewed `draft_pick` fields in
`SeasonSummary.json`. The current snapshot has zero draft-pick fields, so the
route remains an accessible unavailable state rather than showing invented
order.

## Shotguns and external media

`assets/Shotguns.json` is the source of record for all 97 rows. Keep IDs,
owner, week, date, cause, due date, completion, and `media_key` stable. Do not
commit video bytes to the Pages artifact. Provision a Viva-owned object store
or CDN, set `VITE_VIVA_MEDIA_BASE_URL` in the deployment environment, and run:

```bash
npm run check:viva-media
VITE_BASE_PATH=/Viva/ npm run build
```

The media audit must report zero video files in `dist/`. Reconcile the current
unreferenced `Erin/IMG_7068.MOV` clip manually before considering media
provisioning complete.

## Deployment and rollback

Deploy only a reviewed PR whose generated assets, bundle audit, media audit,
Chromium, WebKit smoke, accessibility, and coverage checks pass. After deploy,
verify the core routes, Shotguns owed/completed states, modal playback, mobile
layout, dark mode, optional-state messaging, and Transactions absence.

For rollback, redeploy the last known-good Viva artifact and restore the prior
manifest/media-origin configuration. Restore source JSON and generated output
as one coherent snapshot, then rerun the asset and build checks. Do not modify
the reference repository or add automation without a new approved scope.

## Deferred automation

Credentialed ESPN discovery, scheduled refreshes, Transactions, and Player
History remain deferred. They require a separately approved data/security
contract and representative exports; they must not be reintroduced by copying
an unrelated workflow.
