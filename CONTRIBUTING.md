# Contributing to Viva

Use Node 24 and npm 11 as declared by `package.json`. Install dependencies with
`npm ci`, then run `npm run test:unit` and `VITE_BASE_PATH=/ npm run build`.

The canonical production host is `https://taylorsahoefantasy.com/`; `www` is
redirect-only and `media.taylorsahoefantasy.com` is a separate, unchanged
Shotguns media host. Domain activation is owner-controlled: verify the Pages
custom domain before publishing DNS, keep the apex and `www` records
DNS-only, and follow the rollback procedure in
[`docs/VIVA_DATA_OPERATIONS.md`](docs/VIVA_DATA_OPERATIONS.md).

Historical data changes must use the manual ESPN candidate importer or the
candidate-first draft-order enrichment workflow and include generated types,
validators, derived stats, draft output, and manifest updates in the same
change. Verified historical draft order currently covers 2020–2025; do not
infer or promote a missing/unverified season. Do not commit credentials,
cookies, session payloads, raw ESPN responses, or video bytes. Keep Shotguns
media references as stable keys and run `npm run check:viva-media`.

Transactions and Player History remain out of scope for Viva V1. The only
credentialed ESPN operation is the reviewed `Refresh current season` GitHub
Actions workflow. It runs server-side, requires the configured league, season,
and media repository variables plus GitHub secrets for private leagues, and
must open or update `automation/espn-current-season` as a review PR rather
than commit to `main`. Manual dispatch is available for proof while the
schedule is guarded; the Tuesday schedule runs only when
`VIVA_ESPN_ENABLED` is exactly `true`. The workflow does not approve or merge
its own PR. Do not enable it or disclose any secret values from a local
development environment.
