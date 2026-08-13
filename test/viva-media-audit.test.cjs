const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { check } = require('../scripts/check_viva_media.cjs');

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
    const result = await check(root, { expectedCount: 2, mediaBaseUrl: 'https://media.example.test', requireRemote: false });
    assert.match(result.errors.join('\n'), /referenced completed Shotguns media keys/);
    assert.match(result.errors.join('\n'), /Unreferenced preserved clip/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('media audit probes every expected HTTPS object', async () => {
  const root = fixtureRoot([
    { completed: true, media_key: 'Joe/one.mov' },
    { completed: true, media_key: 'Erin/two.mov' },
  ], ['Joe/one.mov', 'Erin/two.mov']);
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url, method: init?.method || 'GET', range: init?.headers?.Range });
    return { ok: true, status: 200 };
  };
  try {
    const result = await check(root, { expectedCount: 2, mediaBaseUrl: 'https://media.example.test', requireRemote: true });
    assert.deepEqual(result.errors, []);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests.map(request => request.method), ['HEAD', 'HEAD']);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
