import { test, expect } from './coverage-fixture.js';
import AxeBuilder from '@axe-core/playwright';

const routes = ['pulse', 'owner', 'history', 'current', 'rivalry', 'trophy', 'dynasty', 'draft', 'gauntlet', 'shotguns'];

test('Viva shell exposes the supported route matrix and omits Transactions', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Viva|Preview|Year in Review/);
  await expect(page.locator('#headerOwnerIdentity')).toBeHidden();
  await expect(page.locator('#tabShotgunsBtn')).toHaveCount(1);
  await expect(page.getByText('Transactions', { exact: true })).toHaveCount(0);

  for (const route of routes) {
    await page.goto(route === 'pulse' ? '/' : `/?tab=${route}`);
    await expect(page.locator(`#page-${route}`)).toHaveAttribute('data-feature-state', /ready|loading|unavailable/);
  }
});

test('Shotguns renders the preserved record states without loading video bytes', async ({ page }) => {
  const videoRequests = [];
  page.on('request', request => {
    if (request.resourceType() === 'media' || /\.(?:mov|mp4|webm)(?:\?|$)/i.test(request.url())) videoRequests.push(request.url());
  });
  await page.goto('/?tab=shotguns');
  await expect(page.locator('.shotgun-metric').nth(0)).toContainText('Owed3');
  await expect(page.locator('.shotgun-metric').nth(1)).toContainText('Completed95');
  await expect(page.locator('#shotgunDialog')).toBeHidden();
  await expect(page.locator('.shotgun-owner-tile')).toHaveCount(12);
  await expect(page.locator('.shotgun-owner-tile .shotgun-record')).toHaveCount(95);
  await expect(page.locator('.shotgun-owed-record')).toHaveCount(3);
  await expect(page.locator('.shotgun-owner-overview-card')).toHaveCount(12);
  await expect(page.locator('#shotgunOwnerFilter option')).toHaveCount(13);
  const labels = await page.locator('.shotgun-play').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
  expect(new Set(labels).size).toBe(95);
  expect(labels.every(label => label?.startsWith('Play '))).toBe(true);
  expect(videoRequests).toEqual([]);
});

test('Shotguns owner filter narrows and restores the completed archive', async ({ page }) => {
  await page.goto('/?tab=shotguns');
  const filter = page.locator('#shotgunOwnerFilter');
  await filter.selectOption({ label: 'Taylor' });
  await expect(filter).toHaveValue('Taylor');
  await expect(page.locator('.shotgun-owner-tile')).toHaveCount(1);
  await expect(page.locator('.shotgun-owner-tile .shotgun-record')).toHaveCount(4);
  await expect(page.locator('#shotgunFilterStatus')).toContainText('Taylor');
  await filter.selectOption('');
  await expect(page.locator('.shotgun-owner-tile')).toHaveCount(12);
  await expect(page.locator('.shotgun-owner-tile .shotgun-record')).toHaveCount(95);
});

for (const width of [320, 390]) {
  test(`Shotguns stays readable without document overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?tab=shotguns');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.locator('.shotgun-owed-record').first()).toContainText('Taylor');
    await expect(page.locator('.shotgun-owner-overview-card').first()).toBeVisible();
  });
}

test('Viva shell has no automated accessibility violations', async ({ page }) => {
  await page.goto('/?tab=shotguns');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
