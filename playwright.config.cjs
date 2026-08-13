const { defineConfig, devices } = require('@playwright/test');

const usePreview = process.env.PLAYWRIGHT_SERVER === 'preview';
const collectCoverage = process.env.COLLECT_COVERAGE === '1';
const port = Number(process.env.PLAYWRIGHT_PORT || 8000);
const host = `http://127.0.0.1:${port}`;
const basePath = process.env.PLAYWRIGHT_BASE_PATH || '/Viva/';
const strippedBasePath = basePath.replace(/^\/+|\/+$/g, '');
const normalizedBasePath = strippedBasePath ? `/${strippedBasePath}/` : '/';
const baseURL = usePreview ? `${host}${normalizedBasePath}` : host;
const serverURL = usePreview ? `${host}${normalizedBasePath}` : `${host}/index.html`;
const serverCommand = usePreview
  ? `node scripts/serve_static.cjs ${port} 127.0.0.1 dist ${normalizedBasePath}`
  : `npm run dev -- --port ${port}`;
const reporter = process.env.CI
  ? [
    ['dot'],
    ['html', { open: 'never' }],
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || 'test-results/playwright-results.json' }],
  ]
  : 'list';

module.exports = defineConfig({
  testDir: './test/ui',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  reporter,
  workers: process.env.PLAYWRIGHT_WORKERS
    ? Number(process.env.PLAYWRIGHT_WORKERS)
    : (usePreview || process.env.CI || process.env.COLLECT_COVERAGE === '1' ? 1 : undefined),
  projects: [
    {
      name: 'chromium',
      // Axe behavior remains authoritative in the production-preview lane; it
      // does not add application execution paths to the instrumented lane.
      testIgnore: collectCoverage ? [] : undefined,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-smoke',
      testMatch: /viva-smoke\.spec\.js/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: serverCommand,
    url: serverURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
