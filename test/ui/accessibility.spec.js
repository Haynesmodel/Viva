import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './coverage-fixture.js';

const routes = ['pulse', 'owner', 'history', 'current', 'rivalry', 'trophy', 'dynasty', 'draft', 'gauntlet', 'shotguns'];
const buttons = Object.fromEntries(routes.filter(route => route !== 'pulse').map(route => [route, `#tab${route[0].toUpperCase()}${route.slice(1)}Btn`]));

async function analyze(page, route) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${route} accessibility violations`).toEqual([]);
}

async function waitForApp(page) {
  await expect(page.locator('#appStatus')).toBeHidden({ timeout: 15_000 });
}

test('every Viva route is axe-clean', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  for (const route of routes) {
    if (route !== 'pulse') {
      const group = ['owner', 'history', 'trophy', 'dynasty', 'shotguns'].includes(route) ? 'owners' : ['draft', 'gauntlet'].includes(route) ? 'tools' : null;
      if (group) await page.locator(`details[data-navigation-group="${group}"] > summary`).click();
      await page.locator(buttons[route]).click();
    }
    await expect(page.locator(`#page-${route}`)).toBeVisible();
    await expect(page.locator(`#page-${route}`)).toHaveAttribute('data-feature-state', 'ready');
    await analyze(page, route);
  }
});

test('theme controls remain accessible across light, dark, and system modes', async ({ page }) => {
  await page.goto('/?tab=history');
  await waitForApp(page);
  for (const preference of ['light', 'dark', 'system']) {
    const control = page.locator(`[data-theme-preference="${preference}"]`);
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(350);
    await analyze(page, preference);
  }
});

test('Viva remains usable at 320px and 200 percent zoom', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await waitForApp(page);
  await page.locator('details[data-navigation-group="owners"] > summary').click();
  await page.locator('#tabShotgunsBtn').click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await analyze(page, 'shotguns-320px');

  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expect.poll(() => page.evaluate(() => document.querySelector('#mainContent')?.getBoundingClientRect().width || 0)).toBeGreaterThan(0);
  await analyze(page, 'shotguns-200-percent');
});

test('Shotguns announces modal playback failures and restores focus', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new Error('blocked in test'));
  });
  await page.goto('/?tab=shotguns');
  await waitForApp(page);
  const play = page.locator('.shotgun-play').first();
  await expect(play).toBeEnabled();
  await play.click();
  await expect(page.locator('#shotgunDialog')).toBeVisible();
  await expect(page.locator('#shotgunMediaStatus')).toContainText('could not be played');
  await page.locator('[data-shotgun-close]').click();
  await expect(play).toBeFocused();
});
