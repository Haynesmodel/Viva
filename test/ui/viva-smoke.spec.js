import { test, expect } from './coverage-fixture.js';
import AxeBuilder from '@axe-core/playwright';

const routes = ['pulse', 'owner', 'history', 'current', 'rivalry', 'trophy', 'dynasty', 'draft', 'gauntlet', 'shotguns'];

test('Viva shell exposes the supported route matrix and omits Transactions', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Viva|Year in Review/);
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
  await expect(page.locator('#shotgunsRoot')).toContainText('3 owed');
  await expect(page.locator('#shotgunsRoot')).toContainText('94 completed');
  await expect(page.locator('#shotgunDialog')).toBeHidden();
  expect(videoRequests).toEqual([]);
});

test('Viva shell has no automated accessibility violations', async ({ page }) => {
  await page.goto('/?tab=shotguns');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
