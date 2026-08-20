# Changelog

## Unreleased

- Imported the Darling platform at commit `5721a2015a2ff1961b48d647158b114b3e1decac` as a documented current-state snapshot. Viva does not merge or replay that repository's history.
- Restored Viva-owned identity, owner configuration, historical assets, banners, image references, and Pages deployment settings.
- Added the typed Viva owner registry, manual ESPN candidate importer, Shotguns schema/migration, external-media audit, and lazy Shotguns route.
- Populated verified historical draft order for the approved 2020–2025 seasons
  and generated the Draft Spot analysis; future or unverified seasons remain
  unavailable rather than inferred.
- Kept the configured Current Season snapshot available while leaving its
  credentialed Tuesday refresh guarded behind the exact `VIVA_ESPN_ENABLED`
  value `true`; refreshes open a review PR and never merge themselves.
- Intentionally omitted Transactions and Player History from Viva V1.
