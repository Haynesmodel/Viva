import { expect, test } from './coverage-fixture.js';
import { ACCESS_PHRASE, unlockViva } from './access-gate.ts';

test('skip link and primary navigation work from the keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#accessPhrase')).toBeFocused();
  await page.locator('#accessPhrase').fill('wrong');
  await page.keyboard.press('Enter');
  await expect(page.locator('#accessPhrase')).toBeFocused();
  await page.locator('#accessPhrase').fill(ACCESS_PHRASE);
  await page.keyboard.press('Enter');
  await expect(page.locator('#mainContent')).toBeFocused();
  await expect(page.locator('#appStatus')).toBeHidden({ timeout: 15_000 });
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.keyboard.press('Tab');
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveAttribute('href', '#mainContent');
  await page.keyboard.press('Enter');
  await expect(page.locator('#mainContent')).toBeFocused();

  await page.locator('details[data-navigation-group="owners"] > summary').click();
  const history = page.locator('#tabHistoryBtn');
  await history.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/tab=history/);
  await expect(page.locator('#page-history')).toBeVisible();
});

test('theme buttons expose state and respond to Enter', async ({ page }) => {
  await page.goto('/');
  await unlockViva(page);
  await expect(page.locator('#appStatus')).toBeHidden({ timeout: 15_000 });
  const dark = page.locator('[data-theme-preference="dark"]');
  await dark.focus();
  await page.keyboard.press('Enter');
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
});

test('mobile keyboard navigation does not create horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await unlockViva(page);
  await expect(page.locator('#appStatus')).toBeHidden({ timeout: 15_000 });
  await page.locator('details[data-navigation-group="owners"] > summary').click();
  await page.locator('#tabHistoryBtn').click();
  await page.locator('details[data-navigation-group="owners"] > summary').click();
  await page.locator('#tabShotgunsBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/tab=shotguns/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
