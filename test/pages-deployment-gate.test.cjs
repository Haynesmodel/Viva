const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
const packageJob = workflow.slice(workflow.indexOf('  package_pages:'), workflow.indexOf('  deploy_pages:'));

test('Pages packaging requires the configured apex custom domain', () => {
  assert.match(packageJob, /permissions:\n      contents: read\n      pages: read/);
  assert.match(packageJob, /Confirm Pages apex custom domain before packaging/);
  assert.match(packageJob, /EXPECTED_PAGES_DOMAIN: taylorsahoefantasy\.com/);
  assert.match(packageJob, /github\.rest\.repos\.getPages/);
  assert.match(packageJob, /pages\.cname !== expected/);
  assert.match(packageJob, /Root-base Pages deployment is intentionally blocked/);
});

test('Pages deployment remains downstream of the guarded packaging job', () => {
  assert.match(packageJob, /needs: \[quality_build, gate\]/);
  assert.match(workflow.slice(workflow.indexOf('  deploy_pages:')), /needs: package_pages/);
});
