const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const environment = { origin: 'https://example.com', basePath: '/Viva/' };
let temp;
let share;

function candidate(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'matchup:2025-17-a-b',
    kind: 'matchup',
    eyebrow: '2025 Championship',
    title: 'Alpha vs Beta',
    subtitle: 'Alpha wins',
    metrics: [
      { label: 'Alpha', value: '120.50', detail: 'Winner' },
      { label: 'Beta', value: '100.25', detail: 'Final' },
    ],
    canonicalUrl: 'https://example.com/Viva/?tab=current',
    sourceLabel: 'Current Season',
    dataVersion: 'sha256:fixture',
    altText: 'Alpha defeated Beta, 120.50 to 100.25.',
    accent: 'red',
    filename: 'viva-matchup-alpha-beta.png',
    ...overrides,
  };
}

test.before(async () => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-share-spec-'));
  await esbuild.build({
    entryPoints: [
      path.join(root, 'src/share/share-card-spec.ts'),
      path.join(root, 'src/share/share-card-builders.ts'),
      path.join(root, 'src/share/share-card-feature-adapters.ts'),
      path.join(root, 'src/share/share-card-actions.ts'),
      path.join(root, 'src/features/league-pulse/league-recap-model.ts'),
      path.join(root, 'js/share-card-svg.js'),
    ],
    outdir: temp,
    bundle: true,
    splitting: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    entryNames: '[name]',
    define: { 'import.meta.env.BASE_URL': "'/Viva/'" },
    logLevel: 'silent',
  });
  const spec = await import(`${pathToFileURL(path.join(temp, 'share-card-spec.js')).href}?${Date.now()}`);
  const builders = await import(`${pathToFileURL(path.join(temp, 'share-card-builders.js')).href}?${Date.now()}`);
  const adapters = await import(`${pathToFileURL(path.join(temp, 'share-card-feature-adapters.js')).href}?${Date.now()}`);
  const actions = await import(`${pathToFileURL(path.join(temp, 'share-card-actions.js')).href}?${Date.now()}`);
  const recap = await import(`${pathToFileURL(path.join(temp, 'league-recap-model.js')).href}?${Date.now()}`);
  const svg = await import(`${pathToFileURL(path.join(temp, 'share-card-svg.js')).href}?${Date.now()}`);
  share = { ...spec, ...builders, ...adapters, ...actions, ...recap, ...svg };
});

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));

class FakeElement {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.hidden = false;
    this.textContent = '';
    this.value = '';
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  querySelectorAll() { return []; }
  async dispatch(name) { return this.listeners.get(name)?.(); }
}

class FakeDocument {
  createElement() { return new FakeElement(this); }
}

function fakeHost() {
  return new FakeElement(new FakeDocument());
}

function fakeWindow() {
  return { location: { origin: environment.origin, href: `${environment.origin}/Viva/` } };
}

test('valid specs normalize, freeze, and serialize deterministically at 1200x630', () => {
  const result = share.validateShareCardSpec(candidate({ title: '  Alpha   vs   Beta  ' }), environment);
  assert.equal(result.ok, true);
  assert.equal(result.spec.title, 'Alpha vs Beta');
  assert.equal(Object.isFrozen(result.spec), true);
  assert.equal(Object.isFrozen(result.spec.metrics), true);
  const first = share.renderShareCardSvg(result.spec);
  assert.equal(first, share.renderShareCardSvg(result.spec));
  assert.match(first, /width="1200" height="630"/);
  assert.match(first, /<title id="title">Alpha vs Beta<\/title>/);
  assert.match(first, /<desc id="desc">Alpha defeated Beta/);
  assert.match(first, /<text[^>]*class="title">Alpha vs Beta<\/text>/);
  assert.match(first, /<text[^>]*class="metric">120\.50<\/text>/);
  assert.match(first, /<text[^>]*class="soft">Winner<\/text>/);
  assert.doesNotMatch(first, /foreignObject|<script|onload=|xlink:href|<image/i);
});

test('layout-aware text and metric boundaries return stable error codes', () => {
  const exact = candidate({
    id: 'i'.repeat(96),
    eyebrow: 'e'.repeat(48),
    title: `${'t'.repeat(32)} ${'u'.repeat(30)}`,
    subtitle: `${'s'.repeat(74)} ${'u'.repeat(65)}`,
    sourceLabel: 'l'.repeat(48),
    dataVersion: 'd'.repeat(96),
    altText: 'a'.repeat(240),
    metrics: Array.from({ length: 4 }, (_, index) => ({
      label: `${index}`.padEnd(26, 'l'),
      value: `${index}`.padEnd(13, 'v'),
      detail: `${index}`.padEnd(20, 'd'),
    })),
  });
  assert.equal(share.validateShareCardSpec(exact, environment).ok, true);
  assert.equal(share.validateShareCardSpec(candidate({ title: 'x'.repeat(91) }), environment).code, 'INVALID_TEXT');
  assert.equal(share.validateShareCardSpec(candidate({ title: 'word '.repeat(17).trim() }), environment).code, 'INVALID_TEXT');
  assert.equal(share.validateShareCardSpec(candidate({ metrics: [
    { label: 'Alpha', value: 'value '.repeat(8).trim(), detail: 'Final' },
    { label: 'Beta', value: '2', detail: 'detail '.repeat(13).trim() },
  ] }), environment).code, 'INVALID_TEXT');
  assert.equal(share.validateShareCardSpec(candidate({ metrics: [
    { label: 'Alpha', value: 'unbreakable-token-that-overflows-the-cell', detail: 'Final' },
    { label: 'Beta', value: '2', detail: 'Final' },
  ] }), environment).code, 'INVALID_TEXT');
  assert.equal(share.validateShareCardSpec(candidate({ metrics: [
    { label: 'Alpha', value: 'W'.repeat(15), detail: 'Final' },
    { label: 'Beta', value: '2', detail: 'Final' },
    { label: 'Gamma', value: '3', detail: 'Final' },
    { label: 'Delta', value: '4', detail: 'Final' },
  ] }), environment).code, 'INVALID_TEXT');
  for (const value of ['0'.repeat(13), '—'.repeat(10), '+'.repeat(13)]) {
    assert.equal(share.validateShareCardSpec(candidate({ metrics: [
      { label: 'Alpha', value, detail: 'Final' },
      { label: 'Beta', value: '2', detail: 'Final' },
      { label: 'Gamma', value: '3', detail: 'Final' },
      { label: 'Delta', value: '4', detail: 'Final' },
    ] }), environment).code, 'INVALID_TEXT', value);
  }
  assert.equal(share.validateShareCardSpec(candidate({ title: 'bad\ntext' }), environment).code, 'INVALID_TEXT');
  assert.equal(share.validateShareCardSpec(candidate({ metrics: exact.metrics.concat({ label: 'x', value: 'y' }) }), environment).code, 'TOO_MANY_METRICS');
  assert.equal(share.validateShareCardSpec(candidate({ metrics: [{ label: 'x', value: 'y' }] }), environment).code, 'INCOMPLETE_DATA');
  assert.equal(share.validateShareCardSpec(candidate({ kind: 'unknown' }), environment).code, 'UNSUPPORTED_KIND');
  assert.equal(share.validateShareCardSpec(candidate({ accent: 'orange' }), environment).code, 'INVALID_TEXT');
});

test('canonical URLs and filenames fail closed', () => {
  for (const canonicalUrl of [
    'https://attacker.example/Viva/',
    'https://example.com/outside/',
    'javascript:alert(1)',
  ]) assert.equal(share.validateShareCardSpec(candidate({ canonicalUrl }), environment).code, 'INVALID_URL');
  for (const filename of ['../card.png', 'folder/card.png', 'card.svg', 'Bad.png']) {
    assert.equal(share.validateShareCardSpec(candidate({ filename }), environment).code, 'INVALID_TEXT');
  }
  const hashed = share.validateShareCardSpec(candidate({ canonicalUrl: 'https://example.com/Viva/?tab=current#private' }), environment);
  assert.equal(hashed.ok, true);
  assert.equal(hashed.spec.canonicalUrl.includes('#'), false);
});

test('all five XML metacharacters are escaped without creating markup', () => {
  const text = `A & B < C > D "quote" 'single'`;
  const result = share.validateShareCardSpec(candidate({ title: text, altText: text }), environment);
  assert.equal(result.ok, true);
  const svg = share.renderShareCardSvg(result.spec);
  for (const entity of ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;']) assert.ok(svg.includes(entity));
  assert.equal(svg.includes('< C >'), false);
});

test('builders accept zero-value Trophy facts and reject incomplete stories', () => {
  const facts = {
    id: 'owner',
    eyebrow: 'Trophy Case',
    title: 'Owner',
    metrics: [{ label: 'Championships', value: '0' }, { label: 'Saunders', value: '0' }],
    canonicalHref: 'https://example.com/Viva/?tab=trophy',
    sourceLabel: 'Trophy Case',
    dataVersion: 'fixture',
    altText: 'Owner has zero Championships and zero Saunders titles.',
  };
  assert.equal(share.buildShareCard('trophy', facts, environment).ok, true);
  assert.equal(share.buildShareCard('trophy', { ...facts, complete: false }, environment).code, 'INCOMPLETE_DATA');
});

test('Pulse matchup identity and visible context include season and week', () => {
  const win = { location: { origin: environment.origin, href: `${environment.origin}/Viva/` } };
  const matchup = {
    ownerA: 'Alpha', ownerB: 'Beta', scoreA: 120.5, scoreB: 100.25,
    type: 'Regular', round: '', result: 'Alpha wins',
    currentHref: '/Viva/?tab=current&currentSeason=2025&currentWeek=4',
  };
  const weekFour = share.buildPulseMatchupCardResult(matchup, 2025, 4, 'fixture', win);
  const weekFive = share.buildPulseMatchupCardResult({
    ...matchup,
    currentHref: '/Viva/?tab=current&currentSeason=2025&currentWeek=5',
  }, 2025, 5, 'fixture', win);
  assert.equal(weekFour.ok, true);
  assert.equal(weekFive.ok, true);
  assert.notEqual(weekFour.spec.id, weekFive.spec.id);
  assert.notEqual(weekFour.spec.filename, weekFive.spec.filename);
  assert.match(weekFour.spec.eyebrow, /2025 · Week 4/);
  assert.match(weekFour.spec.altText, /^2025 Week 4:/);
  assert.match(share.renderShareCardSvg(weekFour.spec), /class="eye">2025 · Week 4 · Regular<\/text>/);
});

test('every complete canonical League Newspaper edition builds a share-ready card', () => {
  const data = {
    leagueGames: JSON.parse(fs.readFileSync(path.join(root, 'assets/H2H.json'), 'utf8')),
    seasonSummaries: JSON.parse(fs.readFileSync(path.join(root, 'assets/SeasonSummary.json'), 'utf8')),
    currentSeason: null,
    rivalries: [],
    derivedStats: null,
    dataVersion: 'fixture',
  };
  const win = { location: { origin: environment.origin, href: `${environment.origin}/Viva/` } };
  const complete = share.buildLeagueNewspaper(data, '/Viva/').editions
    .filter(edition => edition.state === 'complete');
  assert.ok(complete.length > 0);
  const results = complete.map(edition => [edition.id, share.buildLeagueEditionCardResult(edition, win)]);
  assert.deepEqual(
    results.filter(([, result]) => !result?.ok).map(([id, result]) => [id, result?.code || 'NO_RESULT']),
    [],
  );
  for (const id of ['weekly:2025:9', 'weekly:2020:1']) {
    assert.equal(results.find(([editionId]) => editionId === id)?.[1]?.ok, true, id);
  }
  const season2025 = results.find(([editionId]) => editionId === 'season:2025')?.[1];
  assert.equal(season2025?.ok, true);
  assert.deepEqual(season2025.spec.metrics.slice(0, 2), [
    { label: 'Champion', value: 'Dulberger', detail: '118.58 points' },
    { label: 'Runner-up', value: 'Wei', detail: '75.36 points' },
  ]);
  assert.match(season2025.spec.altText, /Champion: Dulberger, 118\.58 points\. Runner-up: Wei, 75\.36 points/);
  const seasonSvg = share.renderShareCardSvg(season2025.spec);
  const metricCells = [...seasonSvg.matchAll(/<g>.*?<\/g>/g)].map(match => match[0]);
  const championCell = metricCells.find(cell => cell.includes('>Champion<'));
  const runnerUpCell = metricCells.find(cell => cell.includes('>Runner-up<'));
  assert.match(championCell, />Dulberger<.*>118\.58 points</);
  assert.doesNotMatch(championCell, /75\.36/);
  assert.match(runnerUpCell, />Wei<.*>75\.36 points</);
  assert.doesNotMatch(runnerUpCell, /118\.58/);
});

test('Dynasty cards bind to the selected owner and disclose partial coverage', () => {
  const win = { location: { origin: environment.origin, href: `${environment.origin}/Viva/` } };
  const score = {
    owner: 'Shemer',
    requestedStartSeason: 2014,
    requestedEndSeason: 2025,
    requestedSeasonCount: 12,
    scoredStartSeason: 2025,
    scoredEndSeason: 2025,
    scoredSeasonCount: 1,
    score: 10,
    rankInPeriod: 8,
    totalOwners: 12,
    wins: 8,
    losses: 6,
    ties: 0,
    label: 'Contender Stretch',
    components: { hardware: 10 },
  };
  assert.equal(
    share.buildDynastyCardResult(score, '/Viva/?tab=dynasty&dynastyOwner=Shemer', 'fixture', win, 'Joel'),
    null,
  );
  const result = share.buildDynastyCardResult(
    score,
    '/Viva/?tab=dynasty&dynastyOwner=Shemer',
    'fixture',
    win,
    'Shemer',
  );
  assert.equal(result.ok, true);
  assert.equal(result.spec.metrics[0].value, '10');
  assert.match(result.spec.altText, /Shemer: 10 Dynasty score/);
  assert.deepEqual(result.spec.metrics.at(-1), {
    label: 'Coverage',
    value: '1/12 seasons',
    detail: 'Scored 2025',
  });
  assert.match(result.spec.subtitle, /Partial coverage/);
  assert.match(result.spec.altText, /1 of 12 requested seasons; scored range 2025/);
});

test('share-card actions cover unavailable, mounted, retry, and copy fallback states', async () => {
  const win = fakeWindow();
  const valid = share.validateShareCardSpec(candidate(), environment);
  const unavailable = share.validateShareCardSpec(candidate({ title: 'bad\ntext' }), environment);
  assert.equal(valid.ok, true);
  assert.equal(unavailable.ok, false);

  const unavailableHost = fakeHost();
  const unavailableController = share.mountShareCardAction({
    host: unavailableHost,
    result: unavailable,
  });
  assert.equal(unavailableHost.getAttribute('data-share-state'), 'unavailable');
  unavailableController.dispose();
  assert.equal(unavailableHost.children.length, 0);

  const shareHost = fakeHost();
  const shareController = share.mountShareCardAction({
    host: shareHost,
    result: valid,
    label: 'Open card',
  });
  assert.equal(shareHost.children.length, 3);
  const shareButton = shareHost.children[0];
  await shareButton.dispatch('click');
  assert.equal(shareHost.children[2].hidden, false);
  assert.equal(shareHost.children[2].selected, true);
  shareController.dispose();

  const previousNavigator = globalThis.navigator;
  let copied;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async value => { copied = value; } } },
  });
  const copyHost = fakeHost();
  const copyController = share.mountCopyLinkAction(copyHost, 'https://example.com/Viva/?tab=current');
  await copyHost.children[0].dispatch('click');
  assert.equal(copied, 'https://example.com/Viva/?tab=current');
  assert.equal(copyHost.children[1].textContent, 'Link copied.');
  copyController.dispose();

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async () => { throw new Error('blocked'); } } },
  });
  const fallbackHost = fakeHost();
  const fallbackController = share.mountCopyLinkAction(fallbackHost, 'https://example.com/Viva/?tab=current');
  await fallbackHost.children[0].dispatch('click');
  assert.equal(fallbackHost.children[2].hidden, false);
  assert.equal(fallbackHost.children[2].focused, true);
  assert.equal(fallbackHost.children[2].selected, true);
  fallbackController.dispose();

  if (previousNavigator === undefined) delete globalThis.navigator;
  else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator });
  assert.equal(share.absoluteShareHref('/Viva/?tab=current', win), 'https://example.com/Viva/?tab=current');
});

test('share-card feature adapters cover empty, pending, completed, and partial views', () => {
  const win = fakeWindow();
  const pendingHost = fakeHost();
  const completedHost = fakeHost();
  pendingHost.setAttribute('data-share-team-a', 'Alpha');
  pendingHost.setAttribute('data-share-team-b', 'Beta');
  completedHost.setAttribute('data-share-team-a', 'Gamma');
  completedHost.setAttribute('data-share-team-b', 'Delta');
  const root = fakeHost();
  root.querySelectorAll = () => [pendingHost, completedHost];
  const view = {
    season: 2026,
    week: 1,
    matchups: [
      { teamA: 'Alpha', teamB: 'Beta', scoreA: null, scoreB: null, completed: false, date: '2026-09-13', type: 'Regular', round: '' },
      { teamA: 'Gamma', teamB: 'Delta', scoreA: 101.25, scoreB: 101.25, completed: true, date: '2026-09-13', type: 'Regular', round: '' },
    ],
  };
  const currentControllers = share.mountCurrentMatchupCards(root, view, '/Viva/?tab=current', 'fixture', win);
  assert.equal(currentControllers.length, 2);
  assert.equal(pendingHost.children[0].textContent, 'Copy matchup link');
  currentControllers.forEach(controller => controller.dispose());
  assert.deepEqual(share.mountCurrentMatchupCards(null, view, '/Viva/', 'fixture', win), []);

  const noMeetings = share.mountRivalryCard(fakeHost(), {
    teamA: 'Alpha', teamB: 'Beta', scope: 'allTime',
    summary: { overall: { g: 0, w: 0, l: 0, pf: 0, pa: 0, recordText: '0-0' }, lastMeeting: null },
  }, '/Viva/?tab=rivalry', 'fixture', win);
  assert.equal(noMeetings, null);
  assert.equal(share.mountRivalryCard(null, {
    teamA: 'Alpha', teamB: 'Beta', scope: 'allTime',
    summary: { overall: { g: 1, w: 1, l: 0, pf: 100, pa: 90, recordText: '1-0' }, lastMeeting: null },
  }, '/Viva/?tab=rivalry', 'fixture', win), null);
  const rivalryHost = fakeHost();
  const rivalryController = share.mountRivalryCard(rivalryHost, {
    teamA: 'Alpha', teamB: 'Beta', scope: 'currentSeason',
    summary: {
      overall: { g: 3, w: 1, l: 1, pf: 300.5, pa: 298.5, recordText: '1-1-1' },
      lastMeeting: { date: '2026-09-13', winner: 'Tie', pf: 100, pa: 100 },
    },
  }, '/Viva/?tab=rivalry', 'fixture', win);
  assert.equal(rivalryHost.children.length, 3);
  rivalryController.dispose();

  assert.equal(share.mountTrophyCard(null, {}, '/Viva/?tab=trophy', 'fixture', win), null);
  assert.equal(share.mountTrophyCard(fakeHost(), { owner: '' }, '/Viva/?tab=trophy', 'fixture', win), null);
  const trophyHost = fakeHost();
  const trophyController = share.mountTrophyCard(trophyHost, {
    owner: 'Alpha',
    hardwareShelf: [{ label: 'Championships', count: 2 }],
    hero: { title: 'Alpha', identityLabel: 'Veteran', rankContext: 'Rank #1|12 owners', record: '10-2 (83.3%)' },
    identity: { label: 'Owner' },
  }, '/Viva/?tab=trophy', 'fixture', win);
  assert.equal(trophyHost.children.length, 3);
  trophyController.dispose();

  assert.equal(share.mountDynastyCard(null, {}, '/Viva/?tab=dynasty', 'fixture', win), null);
  assert.equal(share.mountDynastyCard(fakeHost(), {}, '/Viva/?tab=dynasty', 'fixture', win), null);
  const dynastyHost = fakeHost();
  const dynastyController = share.mountDynastyCard(dynastyHost, {
    owner: 'Alpha', requestedStartSeason: 2025, requestedEndSeason: 2026,
    requestedSeasonCount: 2, scoredStartSeason: 2025, scoredEndSeason: 2026,
    scoredSeasonCount: 2, score: 12, rankInPeriod: 1, totalOwners: 8,
    wins: 10, losses: 2, ties: 0, label: 'Elite', components: { hardware: 12 },
  }, '/Viva/?tab=dynasty&dynastyOwner=Alpha', 'fixture', win, 'Alpha');
  assert.equal(dynastyHost.children.length, 3);
  dynastyController.dispose();
});
