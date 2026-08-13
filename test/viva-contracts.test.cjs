const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateSemanticBundle } = require('../scripts/data/semantic-validation.cjs');

const root = path.join(__dirname, '..');

test('Viva canonical assets preserve the Shotguns contract and omit transaction data', () => {
  const shotguns = JSON.parse(fs.readFileSync(path.join(root, 'assets/Shotguns.json'), 'utf8'));
  assert.equal(shotguns.length, 97);
  assert.equal(shotguns.filter(row => row.completed).length, 94);
  assert.equal(shotguns.filter(row => !row.completed).length, 3);
  assert.equal(new Set(shotguns.map(row => row.id)).size, shotguns.length);
  assert.ok(shotguns.every(row => Object.hasOwn(row, 'media_key')));
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
