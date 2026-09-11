import { expect, test } from '@playwright/test';

test('046 renders its rebuilt chain through playback, pause and a mobile view', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/movement/046');
  const canvas = page.locator('.simulation-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', /movement 46:/);
  await expect(page.getByText(/one reserve wrap left on the barrel/)).toBeVisible();
  const play = page.locator('.play-control');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  const before = await canvas.screenshot();
  await play.click();
  // Exercise the moving ribbon and instanced chain in the production
  // renderer, including the near-full-unwind reversal after the source pose.
  await page.waitForTimeout(1600);
  await play.click();
  const after = await canvas.screenshot();
  expect(after.equals(before)).toBe(false);
  await page.waitForTimeout(150);
  expect((await canvas.screenshot()).equals(after)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(280);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Reset view' }).click();
  expect(errors).toEqual([]);
});
