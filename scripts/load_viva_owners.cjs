const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const esbuild = require('esbuild');

function loadVivaOwners(root = process.cwd()) {
  const ownersPath = path.join(root, 'src', 'viva', 'owners.ts');
  if (!fs.existsSync(ownersPath)) throw new Error(`Missing Viva owner contract: ${ownersPath}`);

  let output;
  try {
    output = esbuild.buildSync({
      entryPoints: [ownersPath],
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'node20',
      write: false,
      logLevel: 'silent',
    }).outputFiles[0].text;
  } catch (error) {
    throw new Error(`Could not compile Viva owner contract: ${error.message}`);
  }

  const compiled = new Module(ownersPath, module);
  compiled.filename = ownersPath;
  compiled.paths = Module._nodeModulePaths(path.dirname(ownersPath));
  compiled._compile(output, ownersPath);
  const owners = compiled.exports.VIVA_OWNERS;
  if (!Array.isArray(owners)) throw new Error('Viva owner contract does not export VIVA_OWNERS');
  if (owners.length === 0) throw new Error('Viva owner contract contains no owners');
  return owners;
}

function ownerImageAssetPath(owner) {
  if (owner.imageKey === null) return null;
  if (typeof owner.imageKey !== 'string' || !owner.imageKey.startsWith('assets/')) {
    throw new Error(`Invalid imageKey for ${owner.canonical}: expected an assets/ path`);
  }

  const relative = owner.imageKey.slice('assets/'.length);
  const normalized = path.posix.normalize(relative);
  if (!relative || normalized !== relative || normalized.startsWith('../') || path.posix.dirname(relative) !== '.') {
    throw new Error(`Invalid imageKey for ${owner.canonical}: ${owner.imageKey}`);
  }
  return relative;
}

function configuredOwnerImages(root = process.cwd()) {
  return loadVivaOwners(root)
    .map(owner => {
      const sourcePath = ownerImageAssetPath(owner);
      return sourcePath === null
        ? null
        : { owner: owner.canonical, imageKey: owner.imageKey, sourcePath };
    })
    .filter(Boolean);
}

module.exports = { configuredOwnerImages, loadVivaOwners, ownerImageAssetPath };
