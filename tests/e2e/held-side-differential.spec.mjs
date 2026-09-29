import { test, expect } from '@playwright/test';
import {settleCanvas} from '../helpers/viewer.mjs';

test('061 enclosed differential plays, pauses and remains visible after orbiting on mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/movement/061');
  await expect(page.locator('canvas')).toBeVisible(); await settleCanvas(page.locator('canvas'));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('differential');
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeVisible(); await pause.click();
  const canvas = page.locator('canvas'), paused = await canvas.screenshot();
  await page.waitForTimeout(150); expect(await canvas.screenshot()).toEqual(paused);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await canvas.screenshot()).equals(paused), { timeout: 10_000 }).toBe(false);
  await pause.click();
  // The section view starts off: the housing is shown whole, as engraved.
  const section = page.getByRole('button', { name: 'Section view', exact: true });
  await expect(section).toHaveAttribute('aria-pressed', 'false');
  const sectionImage = await canvas.screenshot(); await section.click();
  await expect(section).toHaveAttribute('aria-pressed', 'true');
  expect(await canvas.screenshot()).not.toEqual(sectionImage);
  await section.click(); await expect(section).toHaveAttribute('aria-pressed', 'false');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.6, { steps: 8 }); await page.mouse.up();
  expect(await canvas.screenshot()).not.toEqual(paused);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toBeVisible();await settleCanvas(canvas);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
