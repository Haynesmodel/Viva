const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let helpers;
test.before(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'src/features/dynasty/DynastyPage.tsx')],
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20',
    loader: { '.tsx': 'tsx' }, logLevel: 'silent',
  });
  helpers = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
});

const season = { season: 2025, saunders: true, saundersBye: false, champion: false, bye: false, finish: 12 };
const game = type => ({ season: 2025, teamA: 'Joe', teamB: 'Shap', scoreA: 90, scoreB: 95, type, round: `${type} Final` });

test('dynasty last-place outcome accepts raw and normalized source labels', () => {
  assert.equal(helpers.isLastPlaceGame(game('Saunders')), true);
  assert.equal(helpers.isLastPlaceGame(game('Last place')), true);
  assert.match(helpers.seasonOutcome('Joe', season, [game('Saunders')], 'saunders'), /Last place Final/);
  assert.match(helpers.seasonOutcome('Joe', season, [game('Last place')], 'saunders'), /Last place Final/);
});
