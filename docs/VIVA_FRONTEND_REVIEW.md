# Viva front-end review

**Audit date:** 2026-08-20
**Reviewed implementation commit:** `0d89cbbef3f5a9e6ea5a1766306dbdf9e9d3b547` (merged through `origin/main` at `38df4812d6a4570c9ed418e541e918a4aa10100e`)
**Environment:** `https://taylorsahoefantasy.com/` plus a local Vite production build served with the repository preview runner. Chrome was used for visual and interaction review; Playwright and `@axe-core/playwright` supplied repeatable route checks.
**Viewports:** 320x568, 390x844, 768x1024, and 1440x900. Light and dark themes were checked where route styling is meaningful.

No DevTools trace service was configured in this Codex session. LCP, INP, CLS, and other Core Web Vitals are therefore intentionally not claimed. The review records behavior, responsive structure, keyboard/focus behavior, accessibility checks, and document-level overflow instead.

## Route and state matrix

| Route | Required states inspected | Result / evidence |
| --- | --- | --- |
| Pulse | Initial season preview; primary navigation; desktop and mobile | Pass. Heading, navigation, preview copy, and responsive newspaper layout remain available. |
| My Team | Owner selection; custom banner; mobile filters | Pass. Owner selection and banner remain visible; filters stack at mobile widths. |
| History | Season filtering; tabular content at mobile | Pass. Season controls remain keyboard reachable and the table stays within the document. |
| Current Season | Populated season; deferred/eligible odds state; table/chart alternatives | Pass. Current-season data renders; odds messaging distinguishes eligible/deferred states. |
| Head to Head | Rival selection; data table/chart alternative | Pass. Rival control and the table/chart presentation remain usable at target widths. |
| Trophy | Desktop and mobile card density | Pass. Cards reflow without document-level horizontal overflow. |
| Dynasty | Period selection; modal keyboard/focus behavior | Pass. Period controls and modal close/focus behavior are reachable from the keyboard. |
| Draft Spot | Populated historic draft data; owner filter; mobile controls | Pass. Verified historical draft data renders and owner controls stack at mobile widths. |
| Historical Matchup | Controls; table/card responsiveness; unsupported-feature leakage | Pass. Controls and responsive results render; Transactions and Player History are absent. |
| Shotguns | Owed, completed, configured/unavailable media copy, dialog keyboard/error behavior | Finding confirmed and remediated in this PR: overview/owed tables were clipped on narrow screens and generic “Play clip” labels were not unique. The archive retains 3 owed records, 95 completed records, 12 owner groups, owner imagery, lazy media, and dialog safeguards. |

## Persistent shell checks

The primary navigation remains discoverable through grouped disclosure controls and does not expose Transactions. Focus-visible treatment is present for links, buttons, form controls, summaries, and skip navigation. Reduced-motion and forced-colors styles remain in the shared shell. The review checked 200% browser zoom and document-level horizontal overflow at 320px and 390px; no shell overflow was observed. Target-size and contrast findings were not introduced by the Shotguns remediation.

## Prioritized findings

### P1 — remediated in this PR

- Shotguns owner summary and owed records relied on horizontally clipped tables at 320px/390px, obscuring essential values and providing no useful scroll cue. They are now semantic owner cards and owed list rows.
- Shotguns completed-owner tiles used an unbounded `auto-fit` grid, which produced too many narrow columns on wide screens. The archive is now capped at three, two, or one column by available width and has a native owner filter.
- Every playable Shotguns action previously had the same accessible name (`Play clip`). Controls now include owner, record date, and cause; unavailable media retains the record and exposes an explicit disabled label.

### P2 — intentionally deferred

- A production DevTools trace for Core Web Vitals is deferred until the trace service is available. No performance score is inferred from this audit.
- Screenshot retention and hosting follow-up is deferred to the pull request evidence workflow; no cookies, credentials, raw ESPN payloads, or media files are committed.

## Review boundaries

This audit and remediation do not change Darling, Sleeper, ESPN credentials, source data, media hosting, deployment settings, router/query state, or the deliberately unsupported Transactions and Player History routes. Follow-up findings outside the contained Shotguns feature should be handled in focused changes after this PR.
