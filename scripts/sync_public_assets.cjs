/* Copy generated JSON source assets into Vite's public directory before dev/build. */
const fs = require('node:fs');
const path = require('node:path');
const { configuredOwnerImages } = require('./load_viva_owners.cjs');

function isDeployableAsset(sourceDir, filePath, options = {}) {
  const relPath = path.relative(sourceDir, filePath);
  if (!relPath) return true;

  const name = path.basename(filePath);
  const ext = path.extname(filePath);
  const normalizedRel = relPath.split(path.sep).join('/');

  if (normalizedRel.startsWith('hero/')) {
    return ['.avif', '.webp', '.jpg', '.jpeg'].includes(ext.toLowerCase());
  }
  if (normalizedRel.startsWith('share/')) {
    return normalizedRel === 'share/viva-default-card.png';
  }
  if (normalizedRel.startsWith('trophy/')) {
    return /^(?:trophy|medal|bagel|warning|football|beach-chair|joker|turd)\.svg$/.test(
      normalizedRel.slice('trophy/'.length),
    );
  }

  if (options.ownerImageFiles?.has(normalizedRel)) return true;

  if (ext && ext !== '.json') return false;
  if (/\.(?:mov|mp4|m4v|webm|avi)$/i.test(name)) return false;
  if (name.startsWith('.')) return false;
  if (/\.updated\.json$/.test(name)) return false;
  if (/\.draft\.json$/.test(name)) return false;
  if (/_backup\.json$/.test(name)) return false;

  return true;
}

function syncPublicAssets(root = process.cwd()) {
  const sourceDir = path.join(root, 'assets');
  const publicDir = path.join(root, 'public');
  const targetDir = path.join(publicDir, 'assets');

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source assets directory: ${sourceDir}`);
  }

  fs.mkdirSync(publicDir, { recursive: true });
  fs.rmSync(targetDir, { recursive: true, force: true });
  const ownerImageFiles = new Set(configuredOwnerImages(root).map(({ sourcePath }) => sourcePath));
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    dereference: true,
    filter: (filePath) => isDeployableAsset(sourceDir, filePath, { ownerImageFiles }),
  });

  return targetDir;
}

function runCli(root = process.cwd(), logger = console) {
  try {
    const targetDir = syncPublicAssets(root);
    logger.log(`Synced assets to ${path.relative(root, targetDir)}`);
    return 0;
  } catch (err) {
    logger.error(err.message);
    return 1;
  }
}

if (require.main === module) {
  process.exit(runCli());
}

module.exports = {
  isDeployableAsset,
  runCli,
  syncPublicAssets,
};
