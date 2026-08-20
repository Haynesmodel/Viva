# Accessibility and CSS baseline

## Starting point

The July 16, 2026 production baseline used:

- A 2,998-line `css/style.css` plus separate Easter-egg, search, and table styles.
- Class-only primary tab state with every tab in the normal tab sequence.
- Anchored checkbox disclosures with partial Escape handling.
- A custom Dynasty overlay without initial focus, containment, inertness, scroll lock, or opener restoration.
- Reduced-motion handling limited to search CSS.
- Horizontally scrolling mobile navigation with hidden overflow evidence and Search mixed into the tab row.

The data-layer hotfix was confirmed merged as pull request 28 before this work branched from `origin/main` at `41dbb6c`.

## Implemented baseline

- CSS is split into explicit layers and shared/feature ownership; no monolithic compatibility stylesheet remains.
- Shared and feature files pass 350/500-line budgets.
- WAI-ARIA tab semantics, manual keyboard activation, URL/history synchronization, and horizontal active-tab reveal are automated.
- Filter disclosure semantics and keyboard movement are automated.
- Dynasty and Search focus management are automated.
- Reduced-motion behavior is handled in CSS and JavaScript.
- Axe scans pass for all seven pages in light/dark themes and for representative overlay/expanded states.
- Horizontal tab arrows wrap at both edges, including the seventh Draft Spot tab.
- Draft Spot pick-board keyboard navigation, focus visibility, chart alternatives, mobile reflow, and owner theme state are automated.
- Responsive checks pass at 320×568, 375×667, 390×844, and 768×1024 without document-level horizontal overflow.

The production CSS bundle is emitted as one deterministic file. The verification build measured about 77.7 KB raw and 14.5 KB gzip while adding the new accessibility and responsive behavior.

Visual characterization was checked for:

- 320×568 History with the mobile season filter sheet.
- 390×844 Dynasty with a long structured modal.
- 1440×900 Trophy Case with the desktop hero and primary navigation.

## Post-review addendum — 2026-08-20

The completed front-end review covered every supported Viva route at
320×568, 390×844, 768×1024, and 1440×900 in the local production build and on
the production host, with Playwright and Axe checks for repeatable evidence.
The Shotguns review added a requirement that every playable control expose a
distinct accessible name containing the owner, record date, and cause, while
unavailable media remains present with an explicit disabled explanation.
The review also checked keyboard/focus behavior, reduced motion, both themes,
200% zoom, and document-level overflow. No DevTools trace service was
available in the review session, so no LCP, INP, CLS, or other Core Web Vitals
claim is made.
