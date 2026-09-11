import { test, expect } from '@playwright/test';

test('062 switches installed auxiliary belts, plays both speeds and keeps section and mobile controls usable', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/movement/062');
  const canvas = page.locator('canvas'), configuration = page.getByRole('combobox', { name: 'Auxiliary belt', exact: true });
  await expect(canvas).toBeVisible(); await expect(configuration).toHaveValue('open');
  await expect(configuration.locator('option')).toHaveText(['Open', 'Crossed']);
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await pause.click();
  await page.screenshot({ path: 'artifacts/review/062-desktop-controls.png', fullPage: true });
  const paused = await canvas.screenshot(); await page.waitForTimeout(150);
  expect(await canvas.screenshot()).toEqual(paused);
  const starts = [];
  for (const value of ['crossed', 'open']) {
    await configuration.selectOption(value); await expect(configuration).toHaveValue(value);
    const start = await canvas.screenshot(); starts.push(start);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(async () => (await canvas.screenshot()).equals(start), { timeout: 10_000 }).toBe(false);
    await pause.click();
  }
  expect(starts[0]).not.toEqual(starts[1]);
  const section = page.getByRole('button', { name: 'Section view', exact: true });
  await expect(section).toHaveAttribute('aria-pressed', 'true');
  const sectionImage = await canvas.screenshot(); await section.click();
  await expect(section).toHaveAttribute('aria-pressed', 'false');
  expect(await canvas.screenshot()).not.toEqual(sectionImage);
  await configuration.selectOption('crossed');
  await expect(section).toHaveAttribute('aria-pressed', 'false');
  await section.click(); await expect(section).toHaveAttribute('aria-pressed', 'true');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.6, { steps: 8 }); await page.mouse.up();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toBeVisible(); await expect(configuration).toBeVisible();
  await configuration.selectOption('open'); await expect(configuration).toHaveValue('open');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'artifacts/review/062-mobile-controls.png', fullPage: true });
  expect(errors).toEqual([]);
});
