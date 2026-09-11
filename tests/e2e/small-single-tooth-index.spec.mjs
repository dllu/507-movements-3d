import { test, expect } from '@playwright/test';
import { visibleForegroundBounds, hasFrameMargin } from '../helpers/rendered-frame.mjs';

test('069 plays its thirty-tooth locking drive and stays framed on mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/movement/069');
  const canvas = page.locator('canvas'); await expect(canvas).toBeVisible();
  await expect(page.getByText('The single tooth advances two of the thirty wheel teeth per turn.', { exact: false })).toBeVisible();
  const pause = page.getByRole('button', { name: 'Pause', exact: true }); await pause.click();
  const stopped = await canvas.screenshot();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await canvas.screenshot()).equals(stopped)).toBe(false);
  await pause.click(); await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await page.screenshot({ path: 'artifacts/review/069-desktop-controls.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  const reset = await canvas.screenshot(); await page.waitForTimeout(250);
  expect(await canvas.screenshot()).toEqual(reset);
  await page.screenshot({ path: 'artifacts/review/069-mobile-controls.png', fullPage: true });
  expect(errors).toEqual([]);
});
