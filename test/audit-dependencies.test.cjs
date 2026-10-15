const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAudit, runAudit } = require('../scripts/audit_dependencies.cjs');

const braces = { name: 'braces', severity: 'high', via: [{ name: 'braces', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }] };
const micromatch = { name: 'micromatch', severity: 'high', via: ['braces'] };

test('audit accepts only the known braces advisory and its dependents', () => {
  assert.equal(checkAudit({ auditReportVersion: 2, vulnerabilities: { braces, micromatch } }), 2);
  assert.throws(() => checkAudit({ auditReportVersion: 2, vulnerabilities: {
    braces, micromatch,
    sharp: { name: 'sharp', severity: 'high', via: [{ url: 'https://github.com/advisories/another' }] },
  } }), /Unexpected npm audit findings: sharp/);
  assert.throws(() => checkAudit({ auditReportVersion: 2, vulnerabilities: {
    braces: { ...braces, via: [...braces.via, { url: 'https://github.com/advisories/another' }] }, micromatch,
  } }), /Unexpected npm audit findings/);
});

test('audit rejects malformed reports and cycles', () => {
  assert.throws(() => checkAudit({}), /valid vulnerability report/);
  assert.throws(() => checkAudit({ auditReportVersion: 2, vulnerabilities: {
    alpha: { name: 'alpha', severity: 'high', via: ['beta'] },
    beta: { name: 'beta', severity: 'high', via: ['alpha'] },
  } }), /Unexpected npm audit findings/);
});

test('audit command checks production dependencies when only the known dev chain remains', () => {
  const commands = [];
  const report = JSON.stringify({ auditReportVersion: 2, vulnerabilities: { braces, micromatch } });
  const exec = (command, args) => {
    commands.push([command, args]);
    if (commands.length === 1) throw Object.assign(new Error('audit findings'), { stdout: report });
    return '';
  };
  assert.equal(runAudit(exec), 2);
  assert.deepEqual(commands, [
    ['npm', ['audit', '--json']],
    ['npm', ['audit', '--omit=dev', '--audit-level=moderate']],
  ]);
});

test('audit command passes clean reports and fails closed on command errors', () => {
  const clean = JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} });
  assert.equal(runAudit(() => clean), 0);
  assert.throws(() => runAudit(() => { throw new Error('network unavailable'); }), /network unavailable/);
});
