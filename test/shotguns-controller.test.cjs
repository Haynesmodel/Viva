const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let directory;
let createFeatureController;

test.before(async () => {
  const bundles = path.join(process.cwd(), 'coverage', 'test-bundles');
  fs.mkdirSync(bundles, { recursive: true });
  directory = fs.mkdtempSync(path.join(bundles, 'shotguns-controller-'));
  const outfile = path.join(directory, 'shotguns-controller.mjs');
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'src/features/shotguns/shotguns-controller.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: 'inline',
    sourcesContent: true,
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_VIVA_MEDIA_BASE_URL': JSON.stringify('https://media.example.test') },
    plugins: [{
      name: 'shotguns-controller-stubs',
      setup(build) {
        build.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'stub' }));
        build.onResolve({ filter: /^preact$/ }, () => ({ path: 'preact', namespace: 'stub' }));
        build.onResolve({ filter: /ShotgunsPage$/ }, () => ({ path: 'page', namespace: 'stub' }));
        build.onLoad({ filter: /.*/, namespace: 'stub' }, args => {
          if (args.path === 'preact') return {
            contents: `
              export const h = (component, props) => ({ component, props });
              export const render = (value, root) => { globalThis.__shotgunsRenders.push({ value, root }); };
            `,
            loader: 'js',
          };
          if (args.path === 'page') return {
            contents: `
              export const normalizeShotgunRows = rows => rows;
              export function ShotgunsPage() {}
            `,
            loader: 'js',
          };
          return { contents: '', loader: 'css' };
        });
      },
    }],
  });
  ({ createFeatureController } = await import(`${pathToFileURL(outfile).href}?${Date.now()}`));
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));

function element(extra = {}) {
  const listeners = new Map();
  return {
    textContent: '',
    open: false,
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, event = {}) { listeners.get(type)?.(event); },
    querySelector() { return this.closeButton; },
    closeButton: { addEventListener: (type, listener) => { this.closeListener = listener; } },
    ...extra,
  };
}

function fixture({ data = [{ id: 'one', owner: 'Joe', completed: true, date: '2026-09-10', media_key: 'Joe/clip.mov' }], rootAvailable = true } = {}) {
  const root = element();
  const closeButton = { addEventListener(type, listener) { this.listener = listener; } };
  const dialog = element({
    closeButton,
    showModal() { this.open = true; },
    close() { this.open = false; },
  });
  const video = element({
    pauseCalls: 0,
    removeSrcCalls: 0,
    play() { return Promise.reject(new Error('blocked')); },
    pause() { this.pauseCalls += 1; },
    removeAttribute(name) { if (name === 'src') this.removeSrcCalls += 1; },
  });
  const status = element();
  const active = element({ focusCalls: 0, focus() { this.focusCalls += 1; } });
  const calls = { headers: [], themes: [] };
  const context = {
    data: { shotguns: data },
    document: {
      activeElement: active,
      getElementById(id) {
        return { shotgunsRoot: rootAvailable ? root : null, shotgunDialog: dialog, shotgunVideo: video, shotgunMediaStatus: status }[id] || null;
      },
    },
    header: { feature: (...args) => calls.headers.push(args) },
    theme: { league: () => calls.themes.push('league') },
  };
  return { calls, context, root, dialog, video, status, active, closeButton };
}

function activation() {
  return { signal: new AbortController().signal, route: {}, reason: 'route', activationId: 1 };
}

test('Shotguns controller renders unavailable data and rejects missing roots', () => {
  assert.throws(() => createFeatureController().mount(fixture({ rootAvailable: false }).context), /Shotguns feature roots missing/);

  globalThis.__shotgunsRenders = [];
  const state = fixture({ data: null });
  const controller = createFeatureController();
  controller.mount(state.context);
  controller.activate(activation());
  assert.equal(globalThis.__shotgunsRenders.at(-1).value.component, 'p');
});

test('Shotguns controller sorts, filters, plays, closes, and disposes', async () => {
  globalThis.__shotgunsRenders = [];
  const state = fixture({ data: [
    { id: 'old', owner: 'Joe', completed: true, date: '2026-09-01', media_key: 'Joe/old.mov' },
    { id: 'new', owner: 'Shap', completed: true, date: '2026-09-10', media_key: 'Shap/new.mov' },
    { id: 'owed', owner: 'Joe', completed: false, due_date: '2026-09-12', media_key: '' },
  ] });
  const controller = createFeatureController();
  controller.mount(state.context);
  controller.activate(activation());
  let props = globalThis.__shotgunsRenders.at(-1).value.props;
  assert.deepEqual(props.owed.map(row => row.id), ['owed']);
  assert.deepEqual(props.completed.map(row => row.id), ['new', 'old']);
  assert.deepEqual(props.completedOwners, ['Shap', 'Joe']);
  assert.equal(state.calls.headers.length, 1);
  assert.deepEqual(state.calls.themes, ['league']);

  props.onOwnerChange('Joe');
  props = globalThis.__shotgunsRenders.at(-1).value.props;
  assert.equal(props.selectedOwner, 'Joe');
  props.onClearFilter();
  assert.equal(globalThis.__shotgunsRenders.at(-1).value.props.selectedOwner, null);
  props.onOwnerChange('Missing');
  assert.equal(globalThis.__shotgunsRenders.at(-1).value.props.selectedOwner, null);

  props.onPlay(state.context.data.shotguns[1]);
  await Promise.resolve();
  assert.equal(state.dialog.open, true);
  assert.match(state.video.src, /Shap\/new\.mov$/);
  assert.match(state.status.textContent, /could not be played/);
  state.video.dispatch('error');
  assert.match(state.status.textContent, /could not be loaded/);
  state.dialog.dispatch('cancel', { preventDefault() {} });
  assert.equal(state.dialog.open, false);
  assert.equal(state.video.pauseCalls, 1);
  assert.equal(state.video.removeSrcCalls, 1);
  assert.equal(state.active.focusCalls, 1);

  state.dialog.open = true;
  state.dialog.dispatch('click', { target: state.dialog });
  assert.equal(state.dialog.open, false);
  state.closeButton.listener();
  props.onPlay({ ...state.context.data.shotguns[1], media_key: '../bad.mov' });
  assert.equal(state.dialog.open, false);
  controller.deactivate();
  controller.dispose();
  assert.equal(globalThis.__shotgunsRenders.at(-1).value, null);

  const disposedCount = globalThis.__shotgunsRenders.length;
  controller.activate(activation());
  assert.equal(globalThis.__shotgunsRenders.length, disposedCount);
});
