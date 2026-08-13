#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function mediaFiles(root) {
  const result = [];
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.(?:mov|mp4|m4v|webm|avi)$/i.test(entry.name)) result.push(file);
  });
  const source = path.join(root, 'assets', 'Shotguns');
  if (fs.existsSync(source)) visit(source);
  return result;
}

function check(root = process.cwd()) {
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'Shotguns.json'), 'utf8'));
  const completed = rows.filter(row => row.completed);
  const keys = completed.map(row => row.media_key);
  const localKeys = mediaFiles(root).map(file => path.relative(path.join(root, 'assets', 'Shotguns'), file).split(path.sep).join('/')).sort();
  const errors = [];
  if (new Set(keys).size !== keys.length) errors.push('Shotguns media keys must be unique');
  if (localKeys.length !== 95) errors.push(`Expected 95 preserved local Shotguns clips, found ${localKeys.length}`);
  const referenced = new Set(keys);
  localKeys.filter(key => !referenced.has(key)).forEach(key => console.warn(`Unreferenced preserved clip requires owner review: ${key}`));
  keys.filter(key => !localKeys.includes(key)).forEach(key => errors.push(`Shotguns media key is missing from preserved local clips: ${key}`));
  const dist = path.join(root, 'dist');
  const distVideos = dist && fs.existsSync(dist) ? mediaFiles(dist) : [];
  if (distVideos.length) errors.push(`dist contains ${distVideos.length} video files`);
  return { errors, expectedKeys: localKeys.length, referencedKeys: keys.length, localMediaFiles: localKeys.length, distVideos: distVideos.length };
}

if (require.main === module) {
  const result = check();
  result.errors.forEach(error => console.error(error));
  console.log(`Viva media audit: ${result.expectedKeys} expected clips, ${result.referencedKeys} referenced records, ${result.distVideos} dist clips.`);
  process.exitCode = result.errors.length ? 1 : 0;
}

module.exports = { check, mediaFiles };
