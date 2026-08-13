#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);

function normalize() {
  const games = read('assets/H2H.json').map(row => ({ ...row, round: row.round ?? '' }));
  const summaryFields = [
    'season', 'owner', 'wins', 'losses', 'ties', 'finish', 'points_for', 'points_against',
    'playoff_wins', 'playoff_losses', 'saunders_wins', 'saunders_losses', 'champion', 'saunders',
    'bye', 'wild_card', 'saunders_bye', 'bagels_earned', 'draft_pick',
  ];
  const summary = read('assets/SeasonSummary.json').map(row => Object.fromEntries(
    summaryFields
      .filter(field => field !== 'draft_pick' ? field in row || field === 'bagels_earned' : field in row)
      .map(field => [field, field === 'bagels_earned' ? (row[field] ?? null) : row[field]]),
  ));
  write('assets/H2H.json', games);
  write('assets/SeasonSummary.json', summary);
  return { games: games.length, summary: summary.length };
}

if (require.main === module) console.log(`Normalized Viva snapshot: ${JSON.stringify(normalize())}`);

module.exports = { normalize };
