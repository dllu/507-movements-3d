import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../../src/data/movements.json', import.meta.url), 'utf8'));

test('catalog is paginated, searchable, and filterable', async ({ page }) => {
  await page.goto('/#/catalog?page=1');
  await expect(page.getByRole('heading', { name: 'The movement catalog' })).toBeVisible();
  await expect(page.locator('.movement-card')).toHaveCount(12);
  await expect(page.locator('.result-count')).toHaveText('Showing 1–12 of 507');

  await page.getByRole('link', { name: 'Page 43' }).click();
  await expect(page.locator('.movement-card')).toHaveCount(3);
  await expect(page.locator('.result-count')).toHaveText('Showing 505–507 of 507');
  await expect(page.getByRole('link', { name: /Another form of epicyclic train designed/ }).first()).toBeVisible();

  await page.goto('/#/catalog?page=1');
  await page.getByRole('searchbox').fill('worm-wheel');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.result-count')).not.toHaveText(/of 507$/);
  await expect(page.locator('.movement-card').first()).toBeVisible();
  await expect(page.locator('.movement-card').first()).toContainText(/worm/i);

  await page.getByLabel('Filter by family').selectOption('Epicyclic trains');
  await expect(page.locator('.movement-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.movement-card')).toHaveCount(12);
});

test('authored detail view renders and exposes working controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/movement/001');
  const canvas = page.locator('.simulation-canvas');
  await expect(page.getByRole('heading', { name: 'Belt and Pulleys' })).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(page.getByText('Interactive 3D model')).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', /movement 1/i);

  const dimensions = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
  }));
  expect(dimensions.width).toBeGreaterThan(500);
  expect(dimensions.height).toBeGreaterThan(500);
  expect(dimensions.clientWidth).toBeGreaterThan(500);

  const [layoutBox, simulationBox, engravingBox, notesBox] = await Promise.all([
    page.locator('.detail-layout').boundingBox(),
    page.locator('.simulation-panel').boundingBox(),
    page.locator('.source-engraving').boundingBox(),
    page.locator('.movement-notes').boundingBox(),
  ]);
  expect(simulationBox.width).toBeGreaterThan(engravingBox.width * 2);
  expect(engravingBox.x).toBeGreaterThan(simulationBox.x + simulationBox.width - 2);
  expect(Math.abs(notesBox.x - engravingBox.x)).toBeLessThan(2);
  expect(notesBox.y).toBeGreaterThan(engravingBox.y);
  expect(Math.abs(layoutBox.width - simulationBox.width - engravingBox.width)).toBeLessThan(3);

  const play = page.locator('.play-control');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect(play).toContainText('Play');
  await page.getByLabel('Animation speed').selectOption('0.5');
  await page.getByRole('button', { name: 'Reset view' }).click();
  expect(errors).toEqual([]);
});

test('every 3D family reaches a rendered canvas without runtime errors', async ({ page }) => {
  const representatives = new Map();
  for (const movement of catalog.movements) {
    const key = movement.fidelity === 'authored' ? `authored-${movement.id}` : movement.archetype;
    if (!representatives.has(key)) representatives.set(key, movement);
  }
  // Every newly authored movement adds another real browser navigation and
  // WebGL construction to this sweep, so its time budget must grow with the
  // coverage it provides. Assertions and per-model animation time stay fixed.
  // The supersampled framebuffer also renders the interior fragments that
  // MSAA previously shaded only once. Leave headroom for all 507 contexts.
  test.setTimeout(Math.max(120_000, 60_000 + representatives.size * 1000));
  const authoredCount = catalog.movements.filter(({ fidelity }) => fidelity === 'authored').length;
  const proceduralFamilyCount = new Set(catalog.movements.filter(({ fidelity }) => fidelity === 'procedural').map(({ archetype }) => archetype)).size;
  expect(representatives.size).toBe(authoredCount + proceduralFamilyCount);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/#/movement/001');
  for (const movement of representatives.values()) {
    await page.evaluate((number) => { location.hash = `/movement/${number}`; }, movement.number);
    const canvas = page.locator(`canvas[aria-label*="movement ${movement.id}:"]`);
    await expect(canvas, `movement ${movement.id} (${movement.archetype})`).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width, `movement ${movement.id} canvas width`).toBeGreaterThan(300);
    expect(box?.height, `movement ${movement.id} canvas height`).toBeGreaterThan(300);
    await page.waitForTimeout(24);
  }
  expect(errors).toEqual([]);
});

test('mobile catalog and detail layouts remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/catalog?page=1');
  await expect(page.locator('.movement-card')).toHaveCount(12);
  const firstCard = page.locator('.movement-card').first();
  const firstBox = await firstCard.boundingBox();
  const secondBox = await page.locator('.movement-card').nth(1).boundingBox();
  expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height);

  await page.goto('/#/movement/003');
  await expect(page.locator('.simulation-canvas')).toBeVisible();
  const stage = await page.locator('.simulation-stage').boundingBox();
  expect(stage.width).toBeLessThanOrEqual(390);
  expect(stage.height).toBeGreaterThan(400);
  const engraving = await page.locator('.source-engraving').boundingBox();
  const notes = await page.locator('.movement-notes').boundingBox();
  expect(engraving.y).toBeGreaterThan(stage.y + stage.height);
  expect(Math.abs(engraving.y - notes.y)).toBeLessThan(2);
  expect(Math.abs(engraving.width - notes.width)).toBeLessThan(2);
  expect(engraving.width).toBeLessThanOrEqual(195);
  await expect(page.getByText('An interactive reconstruction of the mechanism')).toBeVisible();
});

test('production output works unchanged beneath a static-host subdirectory', async ({ page }) => {
  const failedRequests = [];
  const badResponses = [];
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/portable/#/movement/507');
  await expect(page.getByRole('heading', {
    name: /Another form of epicyclic train designed/i,
  })).toBeVisible();
  await expect(page.locator('.simulation-canvas')).toBeVisible();
  const engraving = page.locator('.source-engraving img');
  await expect(engraving).toBeVisible();
  expect(await engraving.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

  const resources = await page.evaluate(() => performance
    .getEntriesByType('resource')
    .map(({ name }) => new URL(name).pathname));
  expect(resources.some((path) => path.startsWith('/portable/assets/'))).toBe(true);
  expect(resources).toContain('/portable/engravings/mm_507.png');
  expect(resources.every((path) => path.startsWith('/portable/'))).toBe(true);

  await page.goto('/portable/#/catalog?page=43');
  await expect(page.locator('.movement-card')).toHaveCount(3);
  await expect(page.locator('.result-count')).toHaveText('Showing 505–507 of 507');
  expect(failedRequests).toEqual([]);
  expect(badResponses).toEqual([]);
});
