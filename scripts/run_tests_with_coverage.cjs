/* Select the JavaScript tests executed by c8's Node coverage child. */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function selectTestFiles(root = process.cwd()) {
  const testDir = path.join(root, 'test');
  const excluded = new Set([
    'current-season-odds.test.js',
    'data-freshness.test.cjs',
    'draft-spot-model.test.cjs',
    'league-pulse-model.test.cjs',
    'league-recap-model.test.cjs',
    'owner-hub-model.test.cjs',
    'season-presentation.test.cjs',
    'share-card-spec.test.cjs',
    'theme-system.test.cjs',
    'trophy-model.test.js',
  ]);
  return fs.readdirSync(testDir)
    .filter(file => /\.test\.(js|cjs)$/.test(file))
    .filter(file => file !== 'data.test.js' && !excluded.has(file))
    .map(file => path.join('test', file))
    .sort();
}

function propagateResult(result, processApi = process) {
  if (result.signal) {
    processApi.kill(processApi.pid, result.signal);
    return 1;
  }
  return result.status ?? 1;
}

function run(root = process.cwd()) {
  const result = spawnSync(process.execPath, ['--test', ...selectTestFiles(root)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  return propagateResult(result);
}

if (require.main === module) process.exit(run());

module.exports = { propagateResult, run, selectTestFiles };
