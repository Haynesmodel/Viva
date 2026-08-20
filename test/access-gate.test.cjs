const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let gate;
let temp;

class FakeElement {
  constructor() {
    this.attrs = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.inert = false;
    this.value = '';
    this.textContent = '';
    this.focusCount = 0;
  }

  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) { this.attrs.delete(name); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  focus() { this.focusCount += 1; }
  dispatch(type) {
    this.listeners.get(type)?.({ preventDefault() { this.defaultPrevented = true; } });
  }
}

function createFixture(storage = {}) {
  const elements = {
    accessGateMain: new FakeElement(),
    accessGate: new FakeElement(),
    accessPhrase: new FakeElement(),
    accessGateStatus: new FakeElement(),
    appShell: new FakeElement(),
    mainContent: new FakeElement(),
  };
  const values = new Map(Object.entries(storage));
  const session = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  return {
    elements,
    session,
    document: { getElementById: id => elements[id] ?? null },
  };
}

test.before(async () => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-access-gate-'));
  const outfile = path.join(temp, 'access-gate.mjs');
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'src/access/access-gate.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'silent',
  });
  gate = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
});

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('phrase classification is exact and case-sensitive', () => {
  assert.equal(gate.evaluateAccessAttempt('ShotgunsDueSoon'), 'grant');
  assert.equal(gate.evaluateAccessAttempt('shotgunsduesoon'), 'reject');
  assert.equal(gate.evaluateAccessAttempt(' ShotgunsDueSoon'), 'reject');
  assert.equal(gate.evaluateAccessAttempt('ShotgunsDueSoon '), 'reject');
  assert.equal(gate.evaluateAccessAttempt(''), 'reject');
  assert.equal(gate.evaluateAccessAttempt('TaylorsAHoe'), 'easter-egg');
  assert.notEqual(gate.evaluateAccessAttempt('TaylorsAHoe'), 'grant');
});

test('session marker accepts only the opaque granted value', () => {
  const fixture = createFixture({ [gate.ACCESS_STORAGE_KEY]: gate.ACCESS_STORAGE_VALUE });
  assert.equal(gate.hasAccessGrant(fixture.session), true);
  fixture.session.setItem(gate.ACCESS_STORAGE_KEY, 'ShotgunsDueSoon');
  assert.equal(gate.hasAccessGrant(fixture.session), false);
  assert.equal(gate.hasAccessGrant(null), false);
});

test('storage exceptions fail closed on startup and do not prevent current-page unlock', () => {
  const fixture = createFixture();
  const denied = {
    getItem() { throw new Error('session storage denied'); },
    setItem() { throw new Error('session storage denied'); },
  };
  let grants = 0;
  const controller = gate.createAccessGate({ document: fixture.document, storage: denied, onGranted: () => { grants += 1; } });
  controller.initialize();
  assert.equal(fixture.elements.appShell.hidden, true);
  fixture.elements.accessPhrase.value = 'ShotgunsDueSoon';
  fixture.elements.accessGate.dispatch('submit');
  assert.equal(grants, 1);
  assert.equal(fixture.elements.appShell.hidden, false);
  assert.equal(fixture.elements.accessGate.hidden, true);
  assert.equal(fixture.elements.mainContent.focusCount, 1);
});

test('grant transition is one-time and keeps the shell locked until exact submission', () => {
  const fixture = createFixture();
  let grants = 0;
  const controller = gate.createAccessGate({ document: fixture.document, storage: fixture.session, onGranted: () => { grants += 1; } });
  controller.initialize();
  assert.equal(fixture.elements.accessPhrase.focusCount, 1);
  fixture.elements.accessPhrase.value = 'ShotgunsDueSoon';
  fixture.elements.accessGate.dispatch('submit');
  fixture.elements.accessGate.dispatch('submit');
  assert.equal(grants, 1);
  assert.equal(fixture.session.getItem(gate.ACCESS_STORAGE_KEY), gate.ACCESS_STORAGE_VALUE);
  assert.equal(fixture.elements.appShell.getAttribute('aria-hidden'), null);
  assert.equal(fixture.elements.appShell.getAttribute('inert'), null);
  assert.equal(fixture.elements.mainContent.focusCount, 1);
});

test('ordinary rejection clears and refocuses input without echoing the value', () => {
  const fixture = createFixture();
  const controller = gate.createAccessGate({ document: fixture.document, storage: fixture.session, onGranted() {} });
  controller.initialize();
  fixture.elements.accessPhrase.value = 'not-the-phrase';
  fixture.elements.accessGate.dispatch('submit');
  assert.equal(fixture.elements.appShell.hidden, true);
  assert.equal(fixture.elements.accessGate.hidden, false);
  assert.equal(fixture.elements.accessPhrase.value, '');
  assert.equal(fixture.elements.accessPhrase.getAttribute('aria-invalid'), 'true');
  assert.match(fixture.elements.accessGateStatus.textContent, /did not work/);
  assert.doesNotMatch(fixture.elements.accessGateStatus.textContent, /not-the-phrase/);
  assert.equal(fixture.elements.accessPhrase.focusCount, 2);
});

test('the Easter egg stays locked and stale timers cannot clear a newer message', () => {
  const fixture = createFixture();
  const timers = [];
  const cleared = [];
  const controller = gate.createAccessGate({
    document: fixture.document,
    storage: fixture.session,
    onGranted() {},
    setTimeout(callback, delay) { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout(timer) { cleared.push(timer); },
  });
  controller.initialize();
  fixture.elements.accessPhrase.value = 'TaylorsAHoe';
  fixture.elements.accessGate.dispatch('submit');
  const first = timers[0];
  assert.equal(fixture.elements.accessGateStatus.textContent, gate.ACCESS_EASTER_EGG_MESSAGE);
  fixture.elements.accessPhrase.value = 'TaylorsAHoe';
  fixture.elements.accessGate.dispatch('submit');
  const second = timers[1];
  assert.deepEqual(cleared, [first]);
  first.callback();
  assert.equal(fixture.elements.accessGateStatus.textContent, gate.ACCESS_EASTER_EGG_MESSAGE);
  second.callback();
  assert.equal(fixture.elements.accessGateStatus.textContent, '');
  assert.equal(fixture.session.getItem(gate.ACCESS_STORAGE_KEY), null);
  assert.equal(fixture.elements.appShell.hidden, true);
});

test('a valid same-tab marker bypasses form submission and bootstraps once', () => {
  const fixture = createFixture({ [gate.ACCESS_STORAGE_KEY]: gate.ACCESS_STORAGE_VALUE });
  let grants = 0;
  const controller = gate.createAccessGate({ document: fixture.document, storage: fixture.session, onGranted: () => { grants += 1; } });
  controller.initialize();
  controller.initialize();
  assert.equal(grants, 1);
  assert.equal(fixture.elements.accessGate.hidden, true);
  assert.equal(fixture.elements.appShell.hidden, false);
  assert.equal(fixture.elements.accessPhrase.focusCount, 0);
});
