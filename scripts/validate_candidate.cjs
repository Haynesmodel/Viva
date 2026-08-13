#!/usr/bin/env node
const path = require('node:path');
const { validateAssets } = require('./validate_assets.cjs');
const { createAjv, validateWithSchema } = require('./data/schema-validation.cjs');
const { validateSemanticBundle } = require('./data/semantic-validation.cjs');
const { readJson } = require('./data/canonical-json.cjs');

function parseArgs(argv) {
  const values = { root: process.cwd(), assets: [], mode: 'full' };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--root') values.root = path.resolve(argv[++index]);
    else if (flag === '--asset') values.assets.push(path.resolve(argv[++index]));
    else if (flag === '--candidate') values.mode = 'candidate';
    else throw new Error(`Unknown argument ${flag}`);
  }
  const expected = values.mode === 'candidate' ? 'two or three' : 'exactly five';
  if (values.mode === 'candidate' ? ![2, 3].includes(values.assets.length) : values.assets.length !== 5) {
    throw new Error(`Expected ${expected} --asset paths: H2H, SeasonSummary${values.mode === 'candidate' ? ', optional CurrentSeason' : ', Rivalries, CurrentSeason, Shotguns'}`);
  }
  return values;
}

function readOptional(filePath) {
  return filePath && require('node:fs').existsSync(filePath) ? readJson(filePath) : null;
}

async function validateCandidate(root, assets) {
  const [h2hPath, summaryPath, currentPath] = assets;
  const bundle = {
    H2H: readJson(h2hPath),
    SeasonSummary: readJson(summaryPath),
    Rivalries: [],
    CurrentSeason: readOptional(currentPath),
    Shotguns: [],
  };
  const ajv = createAjv(root);
  const errors = [
    ...validateWithSchema(ajv, 'h2h.schema.json', bundle.H2H, h2hPath),
    ...validateWithSchema(ajv, 'season-summary.schema.json', bundle.SeasonSummary, summaryPath),
  ];
  if (bundle.CurrentSeason !== null) errors.push(...validateWithSchema(ajv, 'current-season.schema.json', bundle.CurrentSeason, currentPath));
  if (!errors.length) errors.push(...validateSemanticBundle(bundle, { root, exceptions: [] }).errors);
  return { errors, warnings: [] };
}

async function main(argv = process.argv.slice(2)) {
  const values = parseArgs(argv);
  const result = values.mode === 'candidate'
    ? await validateCandidate(values.root, values.assets)
    : await validateAssets(values.root, values.assets);
  result.warnings.forEach(warning => console.warn(warning));
  result.errors.forEach(error => console.error(error));
  if (result.errors.length) process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(error.message || error); process.exitCode = 1; });

module.exports = { main, parseArgs, validateCandidate };
