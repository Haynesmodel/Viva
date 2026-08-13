#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mediaKey(videoUrl) {
  if (!videoUrl) return null;
  const normalized = String(videoUrl).replace(/^assets\/Shotguns\//i, '');
  if (!/^[A-Za-z0-9._/-]+$/.test(normalized) || normalized.includes('..')) {
    throw new Error(`Unsafe Shotguns media path: ${videoUrl}`);
  }
  return normalized;
}

function migrate(inputPath = path.join(process.cwd(), 'assets', 'Shotguns.json')) {
  const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('Shotguns source must be an array');
  const ids = new Set();
  const output = rows.map((row, index) => {
    const owner = String(row.owner || '').trim();
    const date = String(row.date || '').trim();
    const cause = String(row.cause || '').trim();
    const idBase = [owner, date, row.week ?? 'archive', cause, index].map(slug).filter(Boolean).join('-');
    const id = `shotgun-${idBase}`;
    if (ids.has(id)) throw new Error(`Duplicate Shotguns id: ${id}`);
    ids.add(id);
    return {
      id,
      owner,
      week: row.week === null || row.week === undefined || row.week === '' ? null : Number(row.week),
      date,
      due_date: row.due_date ? String(row.due_date) : null,
      cause,
      completed: Boolean(row.completed),
      media_key: row.completed ? mediaKey(row.video_url) : null,
    };
  });
  fs.writeFileSync(inputPath, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (require.main === module) {
  try {
    const rows = migrate();
    console.log(`Migrated ${rows.length} Shotguns records.`);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { mediaKey, migrate, slug };
