import {expect, test} from '@playwright/test';

for (const id of ['082', '083', '090', '091', '092', '093', '094', '095', '096', '097', '098', '099', '100', '101', '102', '103']) test(`${id} loads MuJoCo on demand beneath a static subdirectory and supports playback and restart`, async ({page}) => {
  const errors = [], failedResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push(response.url()); });
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/portable/#/catalog');
  await expect(page.locator('.movement-card')).toHaveCount(12);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('.wasm')))).toBe(false);
  await page.evaluate(id => { location.hash = '/movement/' + id; }, id);
  const canvas = page.locator('.simulation-canvas'), play = page.locator('.play-control');
  // The complete 099 spiral compiles thousands of convex contact cells;
  // measured production initialization takes about nine seconds in headless Chrome.
  const startupTimeout = id === '099' ? 15000 : 5000;
  await expect(canvas).toBeVisible({timeout: startupTimeout});
  await expect(page.getByRole('button', {name: 'Restart', exact: true})).toBeVisible();
  const note = {'082': /The lower pawl uses an inferred torsion spring/, '083': /The springs are described in Brown/,
    '090': /The guides, rod extensions and depth are reconstructed/, '091': /The cam is fitted as a constant-width profile/,
    '092': /The curved spokes follow the engraving/, '093': /The slot is widened to fit the measured wrist/,
    '094': /The radial plate is held during adjustment/, '095': /The fork holds a freely turning roller/,
    '096': /The cam outline is corrected by up to 11 engraving pixels/,
    '097': /Two Archimedean spiral flanks give uniform travel/,
    '098': /Section view removes the arm’s front cover/,
    '099': /Section view exposes the roller/,
    '100': /The wrist slides without friction in the measured slot/,
    '101': /The hanging lever drives the bar through its slot/,
    '102': /The nut climbs by thread contact/,
    '103': /The rotating screw drives the slide through matching threads/}[id];
  await expect(page.getByText(note)).toBeVisible();
  const wasm = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.endsWith('.wasm')).map(r => new URL(r.name).pathname));
  expect(wasm).toHaveLength(1);
  expect(wasm[0]).toMatch(/^\/portable\/assets\//);
  const initial = await canvas.screenshot();
  await play.click();
  await page.waitForTimeout(1300);
  await play.click();
  const advanced = await canvas.screenshot();
  expect(advanced.equals(initial)).toBe(false);
  await page.waitForTimeout(150);
  expect((await canvas.screenshot()).equals(advanced)).toBe(true);
  await page.getByRole('button', {name: 'Restart', exact: true}).click();
  expect((await canvas.screenshot()).equals(initial)).toBe(true);
  if (id === '098' || id === '099' || id === '102' || id === '103') {
    const section = page.getByRole('button', {name: 'Section view', exact: true});
    const initiallySectioned = id === '098';
    await expect(section).toHaveAttribute('aria-pressed', String(initiallySectioned));
    await section.click();
    await expect(section).toHaveAttribute('aria-pressed', String(!initiallySectioned));
    expect((await canvas.screenshot()).equals(initial)).toBe(false);
    await section.click();
    expect((await canvas.screenshot()).equals(initial)).toBe(true);
  }
  await page.getByLabel('Animation speed').selectOption('0.5');
  await page.setViewportSize({width: 390, height: 844});
  const restart = page.getByRole('button', {name: 'Restart', exact: true});
  await restart.scrollIntoViewIfNeeded();
  const box = await restart.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', {name: 'Reset view', exact: true}).click();
  await page.evaluate(() => { location.hash = '/movement/089'; });
  await expect(page.locator('canvas[aria-label*="movement 89:"]')).toBeVisible();
  await page.evaluate(id => { location.hash = '/movement/' + id; }, id);
  await expect(restart).toBeVisible({timeout: startupTimeout});
  await play.click();
  await page.waitForTimeout(300);
  await play.click();
  expect(errors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('leaving 082 while WASM loads cannot install a stale canvas or overwrite the next movement', async ({page}) => {
  let release, started;
  const held = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { started = resolve; });
  await page.route('**/*.wasm', async route => { started(); await held; await route.continue(); });
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/#/movement/082');
  await expect(page.locator('#simulation-stage')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.play-control')).toBeDisabled();
  await requested;
  await page.evaluate(() => { location.hash = '/movement/089'; });
  await expect(page.locator('canvas[aria-label*="movement 89:"]')).toBeVisible();
  release();
  await page.evaluate(() => { location.hash = '/movement/082'; });
  await expect(page.getByRole('button', {name: 'Restart', exact: true})).toBeVisible();
  await expect(page.locator('.simulation-canvas')).toHaveCount(1);
  await expect(page.locator('.simulation-error')).toHaveCount(0);
});

test('an unavailable physics asset leaves navigation usable and can be retried', async ({page}) => {
  await page.route('**/*.wasm', route => route.fulfill({status: 503, body: 'Unavailable'}));
  await page.goto('/#/movement/082');
  await expect(page.getByRole('alert')).toContainText('The 3D view could not start.');
  await expect(page.locator('#simulation-stage')).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => { location.hash = '/catalog'; });
  await expect(page.locator('.movement-card')).toHaveCount(12);
  await page.unroute('**/*.wasm');
  await page.evaluate(() => { location.hash = '/movement/082'; });
  await expect(page.getByRole('button', {name: 'Restart', exact: true})).toBeVisible();
});

test('the standalone pilot still uses the shared runtime and releases its WASM objects', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/mujoco-082.html');
  await page.waitForFunction(() => window.mujoco082);
  const result = await page.evaluate(() => {
    const {model} = window.mujoco082;
    model.advance(1);
    const advanced = model.physics.data.time;
    window.dispatchEvent(new Event('pagehide'));
    return {advanced, freed: model.physics.data.isDeleted() && model.physics.model.isDeleted()};
  });
  expect(result.advanced).toBeGreaterThan(.99);
  expect(result.freed).toBe(true);
});
