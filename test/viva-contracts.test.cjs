const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateSemanticBundle } = require('../scripts/data/semantic-validation.cjs');

const root = path.join(__dirname, '..');

test('Viva canonical assets preserve the Shotguns contract and omit transaction data', () => {
  const shotguns = JSON.parse(fs.readFileSync(path.join(root, 'assets/Shotguns.json'), 'utf8'));
  assert.equal(shotguns.length, 126);
  assert.equal(shotguns.filter(row => row.completed).length, 109);
  assert.equal(shotguns.filter(row => !row.completed).length, 17);
  assert.ok(shotguns.some(row => row.owner === 'Joe' && row.week === 1 && row.completed
    && row.cause === 'Started player: Rams D/ST (0 points)' && row.media_key === 'Joe/IMG_2573.mov'));
  assert.deepEqual(
    [4, 5].map(week => shotguns.filter(row => row.week === week && row.cause.startsWith('Started player:')).length),
    [8, 9],
  );
  assert.ok(shotguns.some(row => row.owner === 'Taylor' && row.week === 5 && row.completed
    && row.cause.includes('Brian Thomas Jr.') && row.media_key === 'Taylor/2026-10-12-week-5-brian-thomas-jr.mov'));
  assert.ok(shotguns.some(row => row.owner === 'Taylor' && row.week === 5 && row.completed
    && row.cause.includes('Stefon Diggs') && row.media_key === 'Taylor/2026-10-12-week-5-second-shotgun.mov'));
  assert.ok(shotguns.some(row => row.owner === 'Will' && row.week === 5 && !row.completed && row.cause.includes('Oronde Gadsden')));
  assert.ok(shotguns.filter(row => [4, 5].includes(row.week) && row.cause.startsWith('Started player:'))
    .every(row => row.date === (row.week === 4 ? '2026-10-04' : '2026-10-11')));
  assert.equal(new Set(shotguns.map(row => row.id)).size, shotguns.length);
  assert.ok(shotguns.every(row => Object.hasOwn(row, 'media_key')));
  assert.deepEqual(
    shotguns.filter(row => row.date.startsWith('2026-') && [2, 3].includes(row.week) && row.cause.startsWith('Started player:'))
      .map(row => `${row.week}:${row.owner}:${row.cause}`).sort(),
    [
      '2:Erin:Started player: Marvin Harrison Jr. (0 points)',
      '2:Joe:Started player: DJ Moore (-0.1 points)',
      '2:Mino:Started player: Puka Nacua (0 points)',
      '2:Wei:Started player: Lions D/ST (-4 points); completed Oct 1 as carryover',
      '3:Leah:Started player: 49ers D/ST (0 points)',
      '3:Seth:Started player: Eagles D/ST (-2 points)',
    ],
  );
  assert.deepEqual(
    shotguns.filter(row => row.owner === 'Wei' && !row.completed && row.cause.startsWith('Carryover:'))
      .map(row => [row.week, row.date, row.due_date]),
    [[3, '2026-09-24', '2026-10-01'], [4, '2026-10-01', '2026-10-08']],
  );
  assert.equal(fs.existsSync(path.join(root, 'assets/TransactionHistory.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'src/features/transactions')), false);
});
test('Viva navigation and runtime sources have no Transactions destination', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const navigation = fs.readFileSync(path.join(root, 'src/app/feature-navigation.ts'), 'utf8');
  const registry = fs.readFileSync(path.join(root, 'src/app/feature-registry.ts'), 'utf8');
  assert.match(index, /Shotguns/);
  assert.doesNotMatch(index, /Transactions/);
  assert.match(navigation, /shotguns/);
  assert.doesNotMatch(navigation, /transactions/i);
  assert.match(registry, /shotguns-controller/);
  assert.doesNotMatch(registry, /transactions/i);
});

test('semantic validation rejects owners outside the typed Viva owner contract', () => {
  const result = validateSemanticBundle({
    H2H: [{ season: 2025, date: '2025-01-01', teamA: 'Intruder', teamB: 'Joe', scoreA: 90, scoreB: 80, week: 1, round: '', type: 'Regular' }],
    SeasonSummary: [
      { season: 2025, owner: 'Intruder', wins: 1, losses: 0, ties: 0, finish: 1, points_for: 90, points_against: 80, champion: true, saunders: false },
      { season: 2025, owner: 'Joe', wins: 0, losses: 1, ties: 0, finish: 2, points_for: 80, points_against: 90, champion: false, saunders: true },
    ],
    Rivalries: [],
    CurrentSeason: null,
    Shotguns: [],
  }, { root });
  assert.match(result.errors.join('\n'), /OWNER_UNCONFIGURED/);
  assert.match(result.errors.join('\n'), /Intruder/);
});

test('Shotguns validation accepts an active current-season owner without historical results', () => {
  const result = validateSemanticBundle({
    H2H: [], SeasonSummary: [], Rivalries: [],
    CurrentSeason: {
      season: 2026,
      teams: [{ roster_id: 7, owner: 'Will' }],
      games: [],
      playoff_rules: { playoff_slots: 0, bye_slots: 0, saunders_slots: 0, regular_season_max_week: 14 },
      regular_season_max_week: 14,
    },
    Shotguns: [{ id: 'shotgun-will-2026-10-11-week-5-player-4595342', owner: 'Will', week: 5,
      date: '2026-10-11', due_date: null, cause: 'Started player: Oronde Gadsden (0 points)',
      completed: false, media_key: null }],
  }, { root });
  assert.deepEqual(result.errors, []);
});

test('Shotguns validation rejects a configured owner absent from both historical and current seasons', () => {
  const result = validateSemanticBundle({
    H2H: [], SeasonSummary: [], Rivalries: [], CurrentSeason: null,
    Shotguns: [{ id: 'shotgun-will-unmapped-season', owner: 'Will', week: 5,
      date: '2026-10-11', due_date: null, cause: 'Started player: Oronde Gadsden (0 points)',
      completed: false, media_key: null }],
  }, { root });
  assert.match(result.errors.join('\n'), /SHOTGUN_UNKNOWN_OWNER.*Will/);
  assert.doesNotMatch(result.errors.join('\n'), /OWNER_UNCONFIGURED/);
});
