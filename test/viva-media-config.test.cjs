const test = require('node:test');
const assert = require('node:assert/strict');
const { runCli, validateMediaBaseUrl } = require('../scripts/check_viva_media_config.cjs');

test('media config accepts only reviewed HTTPS origins', () => {
  assert.deepEqual(validateMediaBaseUrl('https://media.example.test/viva/'), {
    ok: true,
    value: 'https://media.example.test/viva',
  });
  assert.equal(validateMediaBaseUrl('http://media.example.test').ok, false);
  assert.equal(validateMediaBaseUrl('https://user:pass@media.example.test').ok, false);
  assert.equal(validateMediaBaseUrl('https://media.example.test?token=secret').ok, false);
});

test('media config can be deferred locally but is required in CI', () => {
  const messages = [];
  const logger = { warn: message => messages.push(message), error: message => messages.push(message), log: () => {} };
  assert.equal(runCli(logger, {}), 0);
  assert.equal(runCli(logger, { REQUIRE_VIVA_MEDIA_CONFIG: '1' }), 1);
  assert.equal(messages.length, 2);
});
