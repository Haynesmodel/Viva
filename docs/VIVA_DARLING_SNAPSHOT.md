# Viva platform snapshot provenance

Viva's modernization starts from the independent Viva `main` revision
`6ea2a4940f965dce269f151a176eebe7f6984ab7` and imports the current Darling
application tree from `main` revision
`5721a2015a2ff1961b48d647158b114b3e1decac`.

The repositories have unrelated Git roots. The import is therefore a single
documented content snapshot, not a Git merge, rebase, or replay of Darling
commits. Darling remains read-only and receives no changes from this project.

The snapshot provides the Vite, TypeScript, Preact, routing, accessibility,
feature-boundary, data-validation, chart, browser-test, and Pages-delivery
platform. Viva-specific owners, assets, data, Shotguns media behavior, and
deployment configuration are applied in follow-up commits.

The following Darling-only paths are deliberately absent from Viva V1:

- Transactions and Player History feature code, tests, schemas, and generated validators.
- Sleeper update workflows, runtime calls, league IDs, secrets, and automation scripts.
- Darling league data, owner mappings, copy, hero/share assets, and production URLs.

Baseline inventory from the plan: Viva had 486 H2H rows, 66 SeasonSummary
rows, 9 named rivalry groups, 97 Shotguns records, and 95 completed clips.
