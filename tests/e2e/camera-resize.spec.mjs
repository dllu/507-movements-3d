import { test, expect } from '@playwright/test';
import { visibleForegroundBounds, hasFrameMargin } from '../helpers/rendered-frame.mjs';
import {settleCanvas} from '../helpers/viewer.mjs';

test('064 remains fully framed after mobile resizing and reset stops a recent drag', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/movement/064');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();await settleCanvas(canvas);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  const reset = await canvas.screenshot();
  await page.waitForTimeout(300);
  expect(await canvas.screenshot()).toEqual(reset);
  expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  expect(errors).toEqual([]);
});
