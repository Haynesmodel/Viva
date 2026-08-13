const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { check, scanVideoFiles } = require('../scripts/check_viva_media.cjs');

function fixtureRoot(rows, keys) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-media-audit-'));
  const mediaRoot = path.join(root, 'assets', 'Shotguns');
  fs.mkdirSync(mediaRoot, { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'Shotguns.json'), JSON.stringify(rows));
  keys.forEach(key => {
    const file = path.join(mediaRoot, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'fixture');
  });
  return root;
}

test('media audit rejects incomplete local-to-record mappings', async () => {
  const root = fixtureRoot([{ completed: true, media_key: 'Joe/one.mov' }], ['Joe/one.mov', 'Joe/two.mov']);
  try {
    const result = await check(root, {
      expectedCount: 2,
      mediaBaseUrl: 'https://media.example.test',
      requireRemote: false,
      probe: async () => {},
    });
    assert.deepEqual(result.errors, [
      'Expected 2 referenced completed Shotguns media keys, found 1',
      'Unreferenced preserved clip has no Shotguns record: Joe/two.mov',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('media audit probes every expected HTTPS object', async () => {
  const root = fixtureRoot([
    { completed: true, media_key: 'Joe/one.mov' },
    { completed: true, media_key: 'Erin/two.mov' },
  ], ['Joe/one.mov', 'Erin/two.mov']);
  const requests = [];
  try {
    const result = await check(root, {
      expectedCount: 2,
      mediaBaseUrl: 'https://media.example.test',
      requireRemote: true,
      probe: async url => requests.push(url),
    });
    assert.deepEqual(result.errors, []);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests, [
      'https://media.example.test/Erin/two.mov',
      'https://media.example.test/Joe/one.mov',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('media audit scans video leaks anywhere in the built dist tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-media-dist-'));
  try {
    fs.mkdirSync(path.join(root, 'dist', 'assets', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'assets', 'leaked.mov'), 'fixture');
    fs.writeFileSync(path.join(root, 'dist', 'assets', 'nested', 'hashed.webm'), 'fixture');
    assert.equal(scanVideoFiles(path.join(root, 'dist')).length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
