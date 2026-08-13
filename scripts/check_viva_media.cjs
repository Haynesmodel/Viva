#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { validateMediaBaseUrl } = require('./check_viva_media_config.cjs');

function scanVideoFiles(source) {
  const result = [];
  const visit = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.(?:mov|mp4|m4v|webm|avi)$/i.test(entry.name)) result.push(file);
  });
  if (fs.existsSync(source)) visit(source);
  return result;
}

function mediaFiles(root) {
  return scanVideoFiles(path.join(root, 'assets', 'Shotguns'));
}

function mediaUrl(baseUrl, key) {
  return `${baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function probe(url) {
  let response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
  if (response.status === 405 || response.status === 501) {
    response = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(10000) });
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function check(root = process.cwd(), options = {}) {
  const rows = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'Shotguns.json'), 'utf8'));
  const completed = rows.filter(row => row.completed);
  const keys = completed.map(row => row.media_key);
  const localKeys = mediaFiles(root).map(file => path.relative(path.join(root, 'assets', 'Shotguns'), file).split(path.sep).join('/')).sort();
  const errors = [];
  const warnings = [];
  const expectedCount = options.expectedCount ?? 95;
  if (new Set(keys).size !== keys.length) errors.push('Shotguns media keys must be unique');
  if (localKeys.length !== expectedCount) errors.push(`Expected ${expectedCount} preserved local Shotguns clips, found ${localKeys.length}`);
  if (keys.length !== expectedCount) errors.push(`Expected ${expectedCount} referenced completed Shotguns media keys, found ${keys.length}`);
  const referenced = new Set(keys);
  localKeys.filter(key => !referenced.has(key)).forEach(key => errors.push(`Unreferenced preserved clip has no Shotguns record: ${key}`));
  keys.filter(key => !localKeys.includes(key)).forEach(key => errors.push(`Shotguns media key is missing from preserved local clips: ${key}`));
  const mediaConfig = validateMediaBaseUrl(options.mediaBaseUrl || process.env.VITE_VIVA_MEDIA_BASE_URL);
  const requireRemote = options.requireRemote ?? process.env.REQUIRE_VIVA_MEDIA_AUDIT === '1';
  const probeFn = options.probe || probe;
  if (!mediaConfig.ok) {
    const message = `Shotguns CDN reachability audit deferred: ${mediaConfig.reason}`;
    if (requireRemote) errors.push(message);
    else warnings.push(message);
  } else {
    const probeKeys = [...new Set([...localKeys, ...keys])].sort();
    for (const key of probeKeys) {
      try {
        await probeFn(mediaUrl(mediaConfig.value, key));
      } catch (error) {
        errors.push(`Shotguns media URL is unreachable: ${key} (${error.message})`);
      }
    }
  }
  const dist = path.join(root, 'dist');
  const distVideos = dist && fs.existsSync(dist) ? scanVideoFiles(dist) : [];
  if (distVideos.length) errors.push(`dist contains ${distVideos.length} video files`);
  return { errors, warnings, expectedKeys: localKeys.length, referencedKeys: keys.length, localMediaFiles: localKeys.length, distVideos: distVideos.length };
}

if (require.main === module) check().then(result => {
  result.warnings.forEach(warning => console.warn(warning));
  result.errors.forEach(error => console.error(error));
  console.log(`Viva media audit: ${result.expectedKeys} expected clips, ${result.referencedKeys} referenced records, ${result.distVideos} dist clips.`);
  process.exitCode = result.errors.length ? 1 : 0;
}).catch(error => { console.error(error.message || error); process.exitCode = 1; });

module.exports = { check, mediaFiles, mediaUrl, probe, scanVideoFiles };
