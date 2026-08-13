#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { configuredOwnerImages } = require('./load_viva_owners.cjs');

function checkOwnerImages(root = process.cwd(), distDir = path.join(root, 'dist')) {
  const errors = [];
  for (const { owner, imageKey } of configuredOwnerImages(root)) {
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
    console.log(`Owner image artifact check passed (${configuredOwnerImages(root).length} images).`);
  }
}

module.exports = { checkOwnerImages, configuredOwnerImages };
