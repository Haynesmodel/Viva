const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let helpers;
test.before(async () => {
  const outfile = path.join(process.cwd(), 'coverage', 'test-bundles', 'dynasty-page-test.mjs');
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'src/features/dynasty/DynastyPage.tsx')],
    outfile, bundle: true, platform: 'node', format: 'esm', target: 'node20',
    loader: { '.tsx': 'tsx' }, sourcemap: 'inline', sourcesContent: true, logLevel: 'silent',
  });
  helpers = await import(`${pathToFileURL(outfile).href}?${Date.now()}`);
});

const season = { season: 2025, saunders: true, saundersBye: false, champion: false, bye: false, finish: 12 };
const game = type => ({ season: 2025, teamA: 'Joe', teamB: 'Shap', scoreA: 90, scoreB: 95, type, round: `${type} Final` });

test('dynasty last-place outcome accepts raw and normalized source labels', () => {
  assert.equal(helpers.isLastPlaceGame(game('Saunders')), true);
  assert.equal(helpers.isLastPlaceGame(game('Last place')), true);
  assert.equal(helpers.isLastPlaceGame(game('Playoff')), false);
  assert.match(helpers.seasonOutcome('Joe', season, [game('Saunders')], 'saunders'), /Last place Final/);
  assert.match(helpers.seasonOutcome('Joe', season, [game('Last place')], 'saunders'), /Last place Final/);
});
