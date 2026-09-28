import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('../../src/data/movements.json', import.meta.url), 'utf8'));

test('catalog shows the book plates and stays searchable and filterable', async ({ page }) => {
  await page.goto('/#/catalog?page=1');
  await expect(page.getByRole('heading', { name: /Nos\. 1–10/ })).toBeVisible();
  await expect(page.locator('.plate-link')).toHaveCount(10);
  await page.getByRole('link', { name: 'Next plate' }).click();
  await expect(page.getByRole('heading', { name: /Nos\. 11–22/ })).toBeVisible();
  await expect(page.locator('.plate-link')).toHaveCount(12);
  // 12 and 13 share one ruled cell, as in the book.
  await expect(page.locator('.plate-cell:has(a[aria-label^="No. 12:"])')).not.toHaveClass(/rule-right/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: /Nos\. 23–30/ })).toBeVisible();

  await page.goto('/#/catalog?page=57');
  await expect(page.getByRole('link', { name: /No\. 507: Another form of epicyclic train designed/ })).toBeVisible();

  await page.goto('/#/catalog?page=1');
  await page.getByRole('searchbox').fill('worm-wheel');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.locator('.result-count')).not.toHaveText(/of 507$/);
  await expect(page.locator('.movement-card').first()).toBeVisible();
  await expect(page.locator('.movement-card').first()).toContainText(/worm/i);

  await page.getByLabel('Filter by family').selectOption('Epicyclic trains');
  await expect(page.locator('.movement-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.plate-link')).toHaveCount(10);
});

test('every plate fits the window without scrolling', async ({ page }) => {
  for (const [width, height] of [[1440, 1000], [390, 844], [844, 390], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/#/catalog?page=13');
    const plate = await page.locator('.plate').boundingBox();
    expect(plate.y + plate.height).toBeLessThanOrEqual(height + 1);
    expect(plate.x + plate.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height + 1);
  }
});

test('authored detail view renders and exposes working controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/movement/001');
  const canvas = page.locator('.simulation-canvas');
  await expect(page.getByRole('heading', { name: 'Belt and Pulleys' })).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(page.getByText('Interactive 3D model')).toHaveCount(0);
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
  expect(Math.abs(simulationBox.width - engravingBox.width * 2)).toBeLessThan(1);
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
  await expect(page.locator('.plate-link')).toHaveCount(10);
  const plate = await page.locator('.plate').boundingBox();
  expect(plate.width).toBeLessThanOrEqual(390);
  expect(plate.y + plate.height).toBeLessThanOrEqual(844);

  await page.goto('/#/movement/003');
  await expect(page.locator('.simulation-canvas')).toBeVisible();
  const stage = await page.locator('.simulation-stage').boundingBox();
  expect(stage.width).toBeLessThanOrEqual(390);
  expect(Math.abs(stage.height - stage.width)).toBeLessThan(1);
  const engraving = await page.locator('.source-engraving').boundingBox();
  const notes = await page.locator('.movement-notes').boundingBox();
  expect(Math.abs(engraving.y - stage.y - stage.height)).toBeLessThan(1);
  expect(Math.abs(engraving.y - notes.y)).toBeLessThan(2);
  expect(Math.abs(engraving.width - notes.width)).toBeLessThan(2);
  expect(engraving.width).toBeLessThanOrEqual(195);
  await expect(page.getByText('An interactive reconstruction of the mechanism')).toHaveCount(0);
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

  await page.goto('/portable/#/catalog?page=57');
  await expect(page.locator('.plate-link')).toHaveCount(6);
  await expect(page.locator('.plate-cell img').first()).toHaveJSProperty('complete', true);
  expect(failedRequests).toEqual([]);
  expect(badResponses).toEqual([]);
});


test('square panels fit landscape and portrait windows, including rotation', async ({ page }) => {
  await page.goto('/#/movement/010');
  await expect(page.locator('.simulation-canvas')).toBeVisible();
  for (const [width, height] of [[1440, 1000], [390, 844], [844, 390], [820, 1180], [320, 568]]) {
    await page.setViewportSize({ width, height });
    const boxes = await page.evaluate(() => {
      const box = selector => {
        const { x, y, width, height, bottom } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height, bottom };
      };
      return { layout: box('.detail-layout'), stage: box('.simulation-stage'),
        engraving: box('.source-engraving'), notes: box('.movement-notes'),
        toolbar: box('.simulation-toolbar'), scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight };
    });
    for (const panel of [boxes.stage, boxes.engraving, boxes.notes]) {
      expect(Math.abs(panel.width - panel.height)).toBeLessThan(1);
    }
    expect(Math.abs(boxes.stage.width / 2 - boxes.engraving.width)).toBeLessThan(1);
    expect(boxes.layout.width / boxes.layout.height).toBeCloseTo(width > height ? 1.5 : 2 / 3, 2);
    expect(boxes.toolbar.y).toBeGreaterThanOrEqual(boxes.layout.bottom - 1);
    expect(boxes.toolbar.bottom).toBeLessThanOrEqual(height);
    expect(boxes.scrollWidth).toBeLessThanOrEqual(width);
    expect(boxes.scrollHeight).toBeLessThanOrEqual(height);
  }
});

test('long source text and model notes remain accessible in the square panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/movement/015');
  await expect(page.locator('.simulation-canvas')).toBeVisible();
  const notes = page.locator('.movement-notes');
  await expect(notes).toContainText('six supporting rope parts');
  expect(await notes.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await notes.focus();
  await page.keyboard.press('End');
  await expect.poll(() => notes.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.goto('/#/movement/129');
  await expect(page.locator('.simulation-canvas')).toBeVisible();
  const reconstruction = page.locator('.reconstruction-notes');
  await expect(reconstruction).toBeVisible();
  await reconstruction.locator('summary').click();
  await expect(reconstruction).toHaveAttribute('open', '');
  await expect(reconstruction.locator('p')).not.toBeEmpty();
});

test('page geometry is identical across movements at a given window size', async ({ page }) => {
  // Short and long titles, two- and three-digit neighbours, the first movement.
  for (const [width, height] of [[1440, 900], [542, 700], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const layouts = [];
    for (const id of ['001', '011', '300', '371']) {
      await page.goto(`/#/movement/${id}`);
      await expect(page.locator('.detail-layout')).toBeVisible();
      layouts.push(await page.evaluate(() => ['.header-inner', '.detail-heading', '.detail-layout', '.simulation-toolbar', '.detail-sequence']
        .map(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); })
        .join('|')));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    }
    expect(new Set(layouts).size, `${width}x${height}: ${layouts.join(' / ')}`).toBe(1);
  }
});
