const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let temp;
let navigation;

test.before(async () => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-primary-navigation-'));
  await esbuild.build({
    entryPoints: [path.join(__dirname, '../src/accessibility/primary-navigation.ts')],
    outfile: path.join(temp, 'primary-navigation.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });
  navigation = await import(`${pathToFileURL(path.join(temp, 'primary-navigation.js')).href}?${Date.now()}`);
});

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('navigation metadata maps every stable feature once into the intended taxonomy', async () => {
  const metadataTemp = path.join(temp, 'feature-navigation.js');
  await esbuild.build({
    entryPoints: [path.join(__dirname, '../src/app/feature-navigation.ts')],
    outfile: metadataTemp,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });
  const metadata = await import(`${pathToFileURL(metadataTemp).href}?${Date.now()}`);
  assert.deepEqual(metadata.FEATURE_NAVIGATION_ITEMS.map(item => item.id), [
    'pulse', 'owner', 'history', 'current', 'rivalry', 'trophy', 'dynasty', 'draft', 'gauntlet', 'shotguns',
  ]);
  assert.deepEqual(
    metadata.FEATURE_NAVIGATION_ITEMS.filter(item => item.group === 'owners').map(item => item.id),
    ['owner', 'history', 'trophy', 'dynasty'],
  );
  assert.deepEqual(
    metadata.FEATURE_NAVIGATION_ITEMS.filter(item => item.group === 'tools').map(item => item.id),
    ['draft', 'gauntlet', 'shotguns'],
  );
  assert.equal(metadata.FEATURE_NAVIGATION.pulse.heroMode, 'full');
  assert.equal(metadata.FEATURE_NAVIGATION_ITEMS.filter(item => item.heroMode === 'compact').length, 9);
  assert.equal(metadata.featureDestinationHref('pulse', '/Viva/'), '/Viva/');
  assert.equal(metadata.featureDestinationHref('current', '/Viva/'), '/Viva/?tab=current');
  assert.equal(metadata.featureDestinationHref('owner', '/Viva/'), '/Viva/?tab=owner');
  assert.equal(metadata.featureDestinationHref('shotguns', '/Viva/'), '/Viva/?tab=shotguns');
});

test('SPA interception accepts only unmodified same-origin primary link activation', () => {
  const event = {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };
  const anchor = {
    href: 'https://example.test/Viva/?tab=current',
    hasAttribute: () => false,
    getAttribute: () => null,
  };
  assert.equal(navigation.isEligiblePrimaryNavigationClick(event, anchor, 'https://example.test/Viva/'), true);
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    assert.equal(navigation.isEligiblePrimaryNavigationClick({ ...event, [modifier]: true }, anchor, 'https://example.test/Viva/'), false);
  }
  assert.equal(navigation.isEligiblePrimaryNavigationClick({ ...event, button: 1 }, anchor, 'https://example.test/Viva/'), false);
  assert.equal(
    navigation.isEligiblePrimaryNavigationClick(event, { ...anchor, href: 'https://other.test/' }, 'https://example.test/Viva/'),
    false,
  );
  assert.equal(
    navigation.isEligiblePrimaryNavigationClick(event, { ...anchor, getAttribute: name => name === 'target' ? '_blank' : null }, 'https://example.test/Viva/'),
    false,
  );
  assert.equal(
    navigation.isEligiblePrimaryNavigationClick(event, { ...anchor, hasAttribute: name => name === 'download' }, 'https://example.test/Viva/'),
    false,
  );
});
