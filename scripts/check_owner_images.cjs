#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function configuredOwnerImageKeys(root = process.cwd()) {
  const source = fs.readFileSync(path.join(root, 'src', 'viva', 'owners.ts'), 'utf8');
  return [...source.matchAll(/\{ canonical:\s*'([^']+)'[^\n]*imageKey:\s*image\('([^']+)'\)/g)]
    .map(match => ({ owner: match[1], imageKey: `assets/${path.basename(match[2])}.jpeg` }));
}

function checkOwnerImages(root = process.cwd(), distDir = path.join(root, 'dist')) {
  const errors = [];
  for (const { owner, imageKey } of configuredOwnerImageKeys(root)) {
    const filePath = path.join(distDir, imageKey);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      errors.push(`Missing deployed owner image for ${owner}: ${imageKey}`);
    }
  }
  return errors;
}

if (require.main === module) {
  const root = process.cwd();
  const distDir = path.resolve(process.argv[2] || path.join(root, 'dist'));
  const errors = checkOwnerImages(root, distDir);
  if (errors.length) {
    errors.forEach(error => console.error(error));
    process.exitCode = 1;
  } else {
    console.log(`Owner image artifact check passed (${configuredOwnerImageKeys(root).length} images).`);
  }
}

module.exports = { checkOwnerImages, configuredOwnerImageKeys };
