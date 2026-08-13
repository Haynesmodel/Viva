#!/usr/bin/env node
const path = require('node:path');
const { validateAssets } = require('./validate_assets.cjs');

function parseArgs(argv) {
  const values = { root: process.cwd(), assets: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--root') values.root = path.resolve(argv[++index]);
    else if (flag === '--asset') values.assets.push(path.resolve(argv[++index]));
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (values.assets.length !== 5) throw new Error('Expected exactly five --asset paths: H2H, SeasonSummary, Rivalries, CurrentSeason, Shotguns');
  return values;
}

async function main(argv = process.argv.slice(2)) {
  const values = parseArgs(argv);
  const result = await validateAssets(values.root, values.assets);
  result.warnings.forEach(warning => console.warn(warning));
  result.errors.forEach(error => console.error(error));
  if (result.errors.length) process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(error.message || error); process.exitCode = 1; });

module.exports = { main, parseArgs };
