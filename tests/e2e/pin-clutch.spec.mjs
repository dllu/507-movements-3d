import { expect, test } from '@playwright/test';
import {expectReconstructionNote,settleCanvas} from '../helpers/viewer.mjs';

test('052 plays its rebuilt pin clutch and preserves pause, orbit and mobile controls', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/movement/052');
  const canvas = page.locator('.simulation-canvas'), play = page.locator('.play-control');
  await expect(canvas).toBeVisible();await settleCanvas(canvas);
  await expectReconstructionNote(page,'Two studs take up the hole clearance before driving the right disk.');
  await play.click(); const before = await canvas.screenshot();
  await play.click(); await page.waitForTimeout(1250); await play.click();
  const after = await canvas.screenshot(); expect(after.equals(before)).toBe(false);
  await page.waitForTimeout(150); expect((await canvas.screenshot()).equals(after)).toBe(true);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.62, { steps: 8 });
  await page.mouse.up(); await page.waitForTimeout(400);
  expect((await canvas.screenshot()).equals(after)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 }); await play.scrollIntoViewIfNeeded();
  const mobile = await play.boundingBox();
  expect(mobile.x).toBeGreaterThanOrEqual(0); expect(mobile.x + mobile.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Reset view' }).click();
  await play.click(); await page.waitForTimeout(450); await play.click();
  await expect(canvas).toBeVisible(); expect(errors).toEqual([]);
});
