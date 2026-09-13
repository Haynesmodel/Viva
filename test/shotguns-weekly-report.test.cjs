const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('weekly Shotguns report finds started players at zero or below', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-shotguns-'));
  const input = path.join(directory, 'espn.json');
  fs.writeFileSync(input, JSON.stringify({
    status: { currentMatchupPeriod: 2 },
    teams: [
      { id: 1, name: 'Joe', roster: { entries: [
        { lineupSlotId: 0, playerPoolEntry: { id: 11, player: { fullName: 'Zero Starter', stats: [{ scoringPeriodId: 1, statSourceId: 0, appliedStatTotal: 0 }] } } },
        { lineupSlotId: 20, playerPoolEntry: { id: 12, player: { fullName: 'Bench Player', stats: [{ scoringPeriodId: 1, statSourceId: 0, appliedStatTotal: -5 }] } } },
      ] } },
      { id: 2, name: 'Kylie', roster: { entries: [
        { lineupSlotId: 0, playerPoolEntry: { id: 13, player: { fullName: 'Positive Starter', stats: [{ scoringPeriodId: 1, statSourceId: 0, appliedStatTotal: 5 }] } } },
        { lineupSlotId: 2, playerPoolEntry: { id: 14, player: { fullName: 'Negative Starter', stats: [{ scoringPeriodId: 1, statSourceId: 0, appliedStatTotal: -1 }] } } },
      ] } },
    ],
    schedule: [{ id: 101, matchupPeriodId: 1, date: '2026-09-13', winner: 'HOME', home: { teamId: 1, totalPoints: 100 }, away: { teamId: 2, totalPoints: 90 } }],
  }));
  const output = execFileSync('python3', [
    'scripts/report_shotguns_weekly.py', '--input', input, '--season', '2026', '--week', '1',
  ], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.match(output, /Joe 100/);
  assert.match(output, /Joe: Started player: Zero Starter \(0 points\)/);
  assert.match(output, /Kylie: Started player: Negative Starter \(-1 points\)/);
  assert.doesNotMatch(output, /Bench Player|Positive Starter/);
});
