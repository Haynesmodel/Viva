# Changelog

## Unreleased

- Imported the Darling application at commit `5721a2015a2ff1961b48d647158b114b3e1decac` as a single current-state content snapshot. Viva does not merge or replay Darling history.
- Restored Viva as the independent product identity, data source, owner configuration, media origin, and GitHub Pages deployment target.
- Removed the imported Transactions/Player History destination and all Sleeper workflow, credentials, league identifiers, and automation paths from Viva V1.
- Restored Draft Spot as a typed, validated, lazily loaded Preact feature with shareable pick/zone/owner URLs, charts, search, themes, keyboard navigation, and an interactive receipts table.
- Added deterministic playoff, bye, seed, and Saunders probabilities to Current Season with movement and selected-owner scenarios.
- Fixed primary-tab arrow wrapping and stabilized built-output Playwright runs at one worker with explicit preview-server diagnostics.
- Added a visible loading state and a user-facing error banner for JSON fetch failures.
- Tightened asset validation for required numeric fields and fixed coverage reporting for browser and script sources.
- Documented easter-egg maintenance order and moved the `H2H.xlsx` reference file out of web-served assets.
- Stopped tracking generated coverage, cache, local metadata, and update scratch files.
- Updated `scripts/transactions.py` report headings to follow the configured `SEASON`.
- Added browser regressions for URL state restoration and CSV export output.
- Removed the obsolete `scripts/ci_smoke.js` after replacing its coverage with `test:data`.
- Refreshed `README.md` and the current architecture notes to match the implemented cleanup work.
- Added a simple project changelog.

## 2025 season

- Added the 2025 season history data and summaries.
- Added Snare and Shemer as new teams.
- Added the `birds-clinch` easter egg.
