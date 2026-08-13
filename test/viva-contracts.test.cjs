const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
