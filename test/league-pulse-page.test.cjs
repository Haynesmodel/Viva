const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
let temporaryDirectory;
let pulseMatchupGroups;

test.before(async () => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-pulse-page-'));
  const outfile = path.join(temporaryDirectory, 'page.mjs');
  await esbuild.build({
    entryPoints: [path.join(root, 'src/features/league-pulse/LeaguePulsePage.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: 'inline',
    sourcesContent: true,
    logLevel: 'silent',
  });
  ({ pulseMatchupGroups } = await import(`${pathToFileURL(outfile).href}?${Date.now()}`));
});

test.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

function matchup(type, round) {
  return {
    ownerA: `${type} A`, ownerB: `${type} B`, scoreA: null, scoreB: null,
    status: 'Scheduled', type, round, result: 'Kickoff pending',
    currentHref: '/current', rivalryHref: '/rivalry',
  };
}

test('League Pulse separates Playoff and Last Place postseason matchups', () => {
  const groups = pulseMatchupGroups([
    matchup('Playoff', 'Semi Final'),
    matchup('Last Place', 'Last Place'),
    matchup('Saunders', 'Saunders Final'),
  ], 'postseason');

  assert.deepEqual(groups.map(group => group.title), ['Championship bracket', 'Last Place bracket', 'Saunders bracket']);
  assert.deepEqual(groups.map(group => group.rows.map(row => row.type)), [
    ['Playoff'],
    ['Last Place'],
    ['Saunders'],
  ]);
});

test('League Pulse leaves regular-season matchups in one unlabelled group', () => {
  const rows = [matchup('Regular', '')];
  assert.deepEqual(pulseMatchupGroups(rows, 'regular-season'), [{ title: '', rows }]);
});
