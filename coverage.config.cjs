const correctedBaseline = thresholds => ({
  thresholds,
  reason: 'Authored-coordinate baseline captured 2026-07-23 after TSX source-map proof; ratchet with behavior-focused tests.',
  owner: '@Haynesmodel',
  expires: '2026-10-22',
});
const vivaBaseline = require('./coverage.viva-baseline.json');
const vivaChangedBaseline = require('./coverage.viva-changed-baseline.json');
const COVERAGE_METRICS = ['lines', 'statements', 'functions', 'branches'];

const explicitOverrides = {
  'js/easter-eggs.js': correctedBaseline({ lines: 28.84, statements: 25, functions: 20, branches: 13.79 }),
  // Explicit thresholds that remain above the stable snapshot floors are kept
  // here; weaker former ratchets are intentionally represented by the
  // reviewed baseline data below until behavior-focused coverage raises them.
  'scripts/data/constants.cjs': correctedBaseline({ lines: 93.87, statements: 93.87, functions: 0, branches: 100 }),
  'src/app/services/league-selectors.ts': correctedBaseline({ lines: 62.5, statements: 61.11, functions: 50, branches: 40 }),
  'src/theme/theme-state.ts': correctedBaseline({ lines: 71.87, statements: 63.15, functions: 54.54, branches: 48.14 }),
  'src/components/tables/ColumnFilterMenu.tsx': correctedBaseline({ lines: 63.63, statements: 55.55, functions: 23.07, branches: 58.33 }),
  'src/components/tables/TableToolbar.tsx': correctedBaseline({ lines: 61.53, statements: 53.84, functions: 40, branches: 50 }),
  'src/tables/rows/rivalry-season-rows.ts': correctedBaseline({ lines: 100, statements: 100, functions: 100, branches: 37.93 }),
  'src/tables/rows/trophy-season-rows.ts': correctedBaseline({ lines: 100, statements: 100, functions: 100, branches: 44.44 }),
};

const vivaOverrides = Object.fromEntries(
  Object.entries(vivaBaseline.files)
    .filter(([file]) => !Object.prototype.hasOwnProperty.call(explicitOverrides, file))
    .map(([file, thresholds]) => [file, {
      thresholds,
      reason: vivaBaseline.description,
      owner: vivaBaseline.owner,
      expires: vivaBaseline.expires,
    }]),
);

function mergeThresholds(generated, explicit) {
  return Object.fromEntries(COVERAGE_METRICS.map(metric => [
    metric,
    Math.max(Number(generated?.[metric]) || 0, Number(explicit?.[metric]) || 0),
  ]));
}

const mergedOverrides = { ...vivaOverrides };
for (const [file, override] of Object.entries(explicitOverrides)) {
  mergedOverrides[file] = {
    ...override,
    thresholds: mergeThresholds(vivaBaseline.files[file], override.thresholds),
  };
}

const changedFileOverrides = Object.fromEntries(
  Object.entries(vivaChangedBaseline.files).map(([file, thresholds]) => [file, {
    thresholds,
    reason: vivaChangedBaseline.description,
    owner: vivaChangedBaseline.owner,
    expires: vivaChangedBaseline.expires,
  }]),
);

module.exports = {
  global: { lines: 75, statements: 75, functions: 65, branches: 60 },
  perFile: { lines: 60, statements: 60, functions: 50, branches: 50 },
  changedFiles: { lines: 80, statements: 80, functions: 75, branches: 70 },
  // Generated floors are applied first; explicit values can ratchet individual
  // metrics upward but can never lower a generated floor.
  overrides: mergedOverrides,
  // Exposed for the coverage-policy regression tests so every collision is
  // checked when an explicit override is added or changed.
  explicitOverrides,
  // These are separate from per-file overrides so a legacy per-file floor can
  // never weaken changed-file enforcement accidentally.
  changedFileOverrides,
};
