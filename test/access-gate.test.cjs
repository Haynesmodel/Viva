const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
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

function withGlobalProperty(name, descriptor, callback) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  try {
    Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
    return callback();
  } finally {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  }
}

test.before(async () => {
  const bundles = path.join(process.cwd(), 'coverage', 'test-bundles');
  fs.mkdirSync(bundles, { recursive: true });
  temp = fs.mkdtempSync(path.join(bundles, 'access-gate-'));
  const outfile = path.join(temp, 'access-gate.mjs');
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'src/access/access-gate.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    sourcemap: 'inline',
    sourcesContent: true,
    logLevel: 'silent',
  });
  gate = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
});

test.after(() => {
  if (!process.env.NODE_V8_COVERAGE) fs.rmSync(temp, { recursive: true, force: true });
});

test('phrase classification is exact and case-sensitive', () => {
  assert.equal(gate.ACCESS_EASTER_EGG_DURATION_MS, 3_600);
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
  assert.equal(gate.writeAccessGrant(null), false);
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

test('global document and storage fallbacks preserve marker behavior and fail closed when unavailable', () => {
  const fixture = createFixture();
  withGlobalProperty('document', { value: fixture.document }, () => {
    withGlobalProperty('sessionStorage', { value: fixture.session }, () => {
      assert.equal(gate.hasAccessGrant(), false);
      assert.equal(gate.writeAccessGrant(), true);
      let grants = 0;
      const controller = gate.createAccessGate({ onGranted: () => { grants += 1; } });
      controller.initialize();
      assert.equal(grants, 1);
      controller.destroy();
    });
  });

  withGlobalProperty('sessionStorage', { get() { throw new Error('session storage unavailable'); } }, () => {
    assert.equal(gate.hasAccessGrant(), false);
    assert.equal(gate.writeAccessGrant(), false);
  });
});

test('gate tolerates missing optional DOM nodes while handling rejection and grant', () => {
  const fixture = createFixture();
  delete fixture.elements.accessGateMain;
  delete fixture.elements.accessGateStatus;
  delete fixture.elements.appShell;
  delete fixture.elements.mainContent;
  fixture.elements.accessGate.removeEventListener = undefined;
  let grants = 0;
  const controller = gate.createAccessGate({ document: fixture.document, storage: fixture.session, onGranted: () => { grants += 1; } });
  controller.initialize();

  fixture.elements.accessPhrase.value = 'wrong';
  fixture.elements.accessGate.dispatch('submit');
  assert.equal(fixture.elements.accessPhrase.value, '');
  fixture.elements.accessPhrase.dispatch('input');
  fixture.elements.accessPhrase.value = 'ShotgunsDueSoon';
  fixture.elements.accessGate.dispatch('submit');
  assert.equal(grants, 1);

  controller.destroy();
  controller.destroy();
});

test('submitting without an input fails closed and destroy removes the listener', () => {
  const fixture = createFixture();
  delete fixture.elements.accessPhrase;
  let grants = 0;
  const controller = gate.createAccessGate({ document: fixture.document, storage: fixture.session, onGranted: () => { grants += 1; } });
  controller.destroy();
  controller.initialize();
  fixture.elements.accessGate.dispatch('submit');
  assert.equal(grants, 0);
  assert.match(fixture.elements.accessGateStatus.textContent, /did not work/);
  controller.destroy();
  controller.destroy();
  fixture.elements.accessGate.dispatch('submit');
  assert.equal(grants, 0);
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
  fixture.elements.accessPhrase.dispatch('input');
  assert.equal(fixture.elements.accessPhrase.getAttribute('aria-invalid'), 'false');
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
  assert.equal(first.delay, gate.ACCESS_EASTER_EGG_DURATION_MS);
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

test('a rejection replaces an active Easter-egg timer and keeps its own status', () => {
  const fixture = createFixture();
  const timers = [];
  const controller = gate.createAccessGate({
    document: fixture.document,
    storage: fixture.session,
    onGranted() {},
    setTimeout(callback) { const timer = { callback }; timers.push(timer); return timer; },
    clearTimeout() {},
  });
  controller.initialize();
  fixture.elements.accessPhrase.value = 'TaylorsAHoe';
  fixture.elements.accessGate.dispatch('submit');
  const staleEggTimer = timers[0];
  fixture.elements.accessPhrase.value = 'wrong';
  fixture.elements.accessGate.dispatch('submit');
  staleEggTimer.callback();
  assert.match(fixture.elements.accessGateStatus.textContent, /did not work/);
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
