import { expect, type Page } from '@playwright/test';

export const ACCESS_PHRASE = 'ShotgunsDueSoon';
export const ACCESS_EASTER_EGG_PHRASE = 'TaylorsAHoe';

export async function unlockViva(page: Page, options: { remember?: boolean } = {}): Promise<void> {
  const gate = page.locator('#accessGate');
  if (await gate.isVisible()) {
    const input = page.locator('#accessPhrase');
    if (options.remember) await page.locator('#accessRemember').check();
    await input.fill(ACCESS_PHRASE);
    await input.press('Enter');
  }
  await expect(gate).toBeHidden();
  await expect(page.locator('#appShell')).toBeVisible();
  await expect(page.locator('#forgetAccessButton')).toBeVisible();
  await expect(page.locator('#mainContent')).toBeFocused();
}
