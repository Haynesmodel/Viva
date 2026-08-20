import test from 'node:test';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let buildSearchIndex;
test.before(async () => {
  const outfile = path.join(process.cwd(), 'coverage', 'search-index-test.mjs');
  await esbuild.build({ entryPoints: [path.join(process.cwd(), 'src/search/search-index.ts')], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node20', sourcemap: 'inline', sourcesContent: true, logLevel: 'silent' });
  ({ buildSearchIndex } = await import(`${pathToFileURL(outfile).href}?${Date.now()}`));
});

globalThis.window = { location: { pathname: '/' } };

test('search index emits canonical last-place season documents and owner aliases', () => {
  const data = {
    seasonSummaries: [{ season: 2025, owner: 'Joe' }],
    leagueGames: [{ season: 2025, teamA: 'Joe', teamB: 'Joel', type: 'Saunders', round: 'Saunders Final' }],
    currentSeason: { teams: [{ owner: 'Joe', display_name: 'Joe Team', source_team_name: 'Joe Source' }] },
  };
  const index = buildSearchIndex(data);
  const seasonDoc = index.documents.find(doc => doc.id === 'season-type:2025:Last Place');
  assert.ok(seasonDoc);
  assert.deepEqual(index.ownerAliases.get('Joe'), ['joe', 'joe team', 'joe source']);
  assert.ok(index.documents.some(doc => doc.id === 'feature:owner:Joe'));
});
