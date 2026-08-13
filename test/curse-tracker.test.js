import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCurseTrackerControls,
  buildCurseTrackerModel,
  buildCurseTrackerSummary,
  cardMatchesFilters,
} from '../js/curse-tracker.js';
import { h2hPath, readJson, seasonPath } from './test-helpers.js';

function makeElement() {
  return {
    dataset: {},
    innerHTML: '',
    value: '',
    disabled: false,
    checked: false,
    appendChild() {},
    addEventListener() {},
  };
}

function makeDoc(elements) {
  return {
    getElementById(id) {
      return elements[id] || null;
    },
    createElement() {
      return makeElement();
    },
  };
}

test('curse tracker builds normalized cards from the league data', () => {
  const leagueGames = readJson(h2hPath);
  const seasonSummaries = readJson(seasonPath);
  const model = buildCurseTrackerModel(leagueGames, seasonSummaries);

  assert.equal(model.cards.length, 2);

  const ids = model.cards.map(card => card.id).sort();
  assert.deepEqual(ids, ['chronically-unlucky:Rico', 'season-opener:Rico']);

  for (const card of model.cards) {
    assert.ok(card.id);
    assert.ok(card.detector);
    assert.ok(card.category);
    assert.ok(card.title);
    assert.ok(card.summary);
    assert.ok(card.detail);
    assert.ok(Number.isFinite(card.observed) || card.observed === null);
    assert.ok(Number.isFinite(card.sampleSize) || card.sampleSize === null);
    assert.ok(Array.isArray(card.evidence));
    assert.ok(card.status === 'Active' || card.status === 'Cold' || card.status === 'Broken');
  }

  const unlucky = model.cards.find(card => card.id === 'chronically-unlucky:Rico');
  assert.equal(unlucky.ratingMethod, 'effect-size');
  assert.equal(unlucky.status, 'Active');
  assert.match(unlucky.summary, /Expected Wins/);

  const summary = buildCurseTrackerSummary(model.cards, model.cards, model.completedSeasons, {
    allOwners: model.owners,
    owner: '__ALL__',
  });
  assert.match(summary, /2 curses shown, 2 active, across 6 completed seasons/);
  assert.match(summary, /Most cursed:/);
  assert.match(summary, /Most blessed:/);
});

test('curse tracker dev toggle exposes low-severity statistical candidates', () => {
  const lowCard = {
    owner: 'Joe',
    category: 'Scoring',
    status: 'Cold',
    ratingMethod: 'statistical',
    severity: null,
  };

  assert.equal(cardMatchesFilters(lowCard, {
    owner: '__ALL__',
    category: 'all',
    status: 'all',
    severity: 'all',
    showDevelopmentCandidates: false,
  }, '__ALL__', '__ALL__'), false);

  assert.equal(cardMatchesFilters(lowCard, {
    owner: '__ALL__',
    category: 'all',
    status: 'all',
    severity: 'all',
    showDevelopmentCandidates: true,
  }, '__ALL__', '__ALL__'), true);
});

test('curse tracker owner select preserves selected owner after rerender', () => {
  const controls = makeElement();
  const ownerSelect = makeElement();
  const categorySelect = makeElement();
  const statusSelect = makeElement();
  const severitySelect = makeElement();
  const doc = makeDoc({
    curseControls: controls,
    curseOwnerSelect: ownerSelect,
    curseCategorySelect: categorySelect,
    curseStatusSelect: statusSelect,
    curseSeveritySelect: severitySelect,
  });
  const seasonSummaries = [
    { season: 2025, owner: 'Joe' },
    { season: 2025, owner: 'Plot' },
    { season: 2025, owner: 'Shap' },
  ];

  buildCurseTrackerControls({
    doc,
    seasonSummaries,
    selectedTeam: '__ALL__',
    allTeams: '__ALL__',
  });
  ownerSelect.value = 'Plot';
  buildCurseTrackerControls({
    doc,
    seasonSummaries,
    selectedTeam: '__ALL__',
    allTeams: '__ALL__',
  });

  assert.equal(ownerSelect.value, 'Plot');
  assert.equal(ownerSelect.disabled, false);
});
