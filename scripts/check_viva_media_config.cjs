const { URL } = require('node:url');

function validateMediaBaseUrl(value) {
  if (!value) return { ok: false, reason: 'VITE_VIVA_MEDIA_BASE_URL is not set' };
  let url;
  try { url = new URL(value); } catch { return { ok: false, reason: 'VITE_VIVA_MEDIA_BASE_URL is not a valid URL' }; }
  if (url.protocol !== 'https:') return { ok: false, reason: 'VITE_VIVA_MEDIA_BASE_URL must use HTTPS' };
  if (url.username || url.password || url.search || url.hash) return { ok: false, reason: 'VITE_VIVA_MEDIA_BASE_URL cannot contain credentials, query, or fragment data' };
  return { ok: true, value: url.toString().replace(/\/$/, '') };
}

function runCli(logger = console, environment = process.env) {
  const result = validateMediaBaseUrl(environment.VITE_VIVA_MEDIA_BASE_URL);
  if (!result.ok) {
    if (environment.REQUIRE_VIVA_MEDIA_CONFIG === '1') {
      logger.error(`Viva media configuration failed: ${result.reason}`);
      return 1;
    }
    logger.warn(`Viva media configuration deferred: ${result.reason}`);
    return 0;
  }
  logger.log(`Viva media origin configured: ${result.value}`);
  return 0;
}

if (require.main === module) process.exit(runCli());

module.exports = { runCli, validateMediaBaseUrl };
