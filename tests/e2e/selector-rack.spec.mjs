import {test, expect} from '@playwright/test';
import {visibleForegroundBounds, hasFrameMargin} from '../helpers/rendered-frame.mjs';

test('084 pauses, finishes and replays the selected rack motion on desktop and mobile', async ({page}) => {
  test.setTimeout(90000); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({reducedMotion: 'reduce'}); await page.goto('/#/movement/084');
  const canvas = page.locator('canvas'), play = page.getByRole('button', {name: 'Play', exact: true}),
    pause = page.getByRole('button', {name: 'Pause', exact: true}), replay = page.getByRole('button', {name: 'Replay', exact: true});
  await expect(canvas).toBeVisible(); await expect(play).toBeVisible();
  const first = await canvas.screenshot(); await page.waitForTimeout(200); expect(await canvas.screenshot()).toEqual(first);
  await play.click(); await page.waitForTimeout(600); await pause.click();
  const stopped = await canvas.screenshot(); expect(stopped.equals(first)).toBe(false);
  await page.waitForTimeout(200); expect(await canvas.screenshot()).toEqual(stopped);
  await play.click(); await expect(replay).toBeVisible({timeout: 30000});
  const final = await canvas.screenshot(); await page.waitForTimeout(200); expect(await canvas.screenshot()).toEqual(final);
  expect(hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  await page.setViewportSize({width: 390, height: 844}); await page.getByRole('button', {name: 'Reset view', exact: true}).click();
  await expect.poll(async () => hasFrameMargin(await visibleForegroundBounds(canvas))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const mobile = await canvas.screenshot(); await replay.click(); await expect(pause).toBeVisible();
  await page.waitForTimeout(300); await pause.click(); expect((await canvas.screenshot()).equals(mobile)).toBe(false);
  await play.click(); await expect(replay).toBeVisible({timeout: 30000}); expect(errors).toEqual([]);
});
