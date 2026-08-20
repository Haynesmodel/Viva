import { expect, test } from './coverage-fixture.js';

test('Shotguns no-media build keeps records and explains unavailable actions', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_EXPECT_NO_MEDIA !== '1', 'Run against a build with VITE_VIVA_MEDIA_BASE_URL unset');
  const videoRequests = [];
  page.on('request', request => {
    if (request.resourceType() === 'media' || /\.(?:mov|mp4|webm)(?:\?|$)/i.test(request.url())) videoRequests.push(request.url());
  });
  await page.goto('/?tab=shotguns');
  const unavailable = page.locator('.shotgun-play[disabled]');
  await expect(unavailable).toHaveCount(95);
  const copy = await unavailable.allTextContents();
  expect(copy.every(text => /^Media unavailable for .+ · \d{4}-\d{2}-\d{2} · .+/.test(text))).toBe(true);
  const labels = await unavailable.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
  expect(labels.every(label => label?.startsWith('Media unavailable for '))).toBe(true);
  expect(videoRequests).toEqual([]);
});
