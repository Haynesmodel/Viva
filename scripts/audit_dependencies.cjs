const { execFileSync } = require('node:child_process');

const KNOWN_DEV_ADVISORY = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function onlyKnownAdvisory(name, vulnerabilities, visited = new Set()) {
  if (visited.has(name)) return false;
  const vulnerability = vulnerabilities[name];
  if (!vulnerability?.via?.length) return false;
  const nextVisited = new Set(visited).add(name);
  return vulnerability.via.every(cause => typeof cause === 'string'
    ? onlyKnownAdvisory(cause, vulnerabilities, nextVisited)
    : name === 'braces' && cause.name === 'braces' && cause.url === KNOWN_DEV_ADVISORY);
}

function checkAudit(report) {
  if (report.auditReportVersion !== 2 || !report.vulnerabilities) {
    throw new Error('npm audit did not return a valid vulnerability report');
  }
  const entries = Object.values(report.vulnerabilities);
  if (entries.some(vulnerability => !(vulnerability.severity in severityRank))) {
    throw new Error('npm audit returned an unknown vulnerability severity');
  }
  const relevant = entries
    .filter(vulnerability => severityRank[vulnerability.severity] >= severityRank.moderate);
  const unexpected = relevant.filter(vulnerability => !onlyKnownAdvisory(vulnerability.name, report.vulnerabilities));
  if (unexpected.length) {
    throw new Error(`Unexpected npm audit findings: ${unexpected.map(vulnerability => vulnerability.name).join(', ')}`);
  }
  return relevant.length;
}

if (require.main === module) {
  let output;
  try {
    output = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    if (!error.stdout) throw error;
    output = error.stdout;
  }
  const exceptionCount = checkAudit(JSON.parse(output));
  if (exceptionCount) {
    // The braces advisory has no patched release; only trusted build-time
    // stylelint globs reach it. Keep the production dependency audit strict.
    execFileSync('npm', ['audit', '--omit=dev', '--audit-level=moderate'], { stdio: 'inherit' });
    console.log(`Accepted ${exceptionCount} dev-only findings caused solely by ${KNOWN_DEV_ADVISORY}.`);
  } else {
    console.log('npm audit found no moderate-or-higher vulnerabilities.');
  }
}

module.exports = { checkAudit, onlyKnownAdvisory };
