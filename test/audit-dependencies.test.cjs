const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAudit } = require('../scripts/audit_dependencies.cjs');

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
