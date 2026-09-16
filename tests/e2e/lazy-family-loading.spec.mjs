import {test, expect} from '@playwright/test';

for (const {id, family, maximumScriptBytes} of [
  {id: 1, family: 'authored-belts', maximumScriptBytes: 3_000_000},
  {id: 87, family: null, maximumScriptBytes: 5_000_000},
  {id: 123, family: null},
  {id: 75, family: null, maximumScriptBytes: 6_000_000},
  {id: 233, family: 'authored-intermittent-core', maximumScriptBytes: 6_000_000},
  {id: 239, family: 'authored-gears-core', maximumScriptBytes: 6_000_000},
  {id: 255, family: 'authored-pulley-forms'},
  {id: 273, family: 'authored-rhombus-linkages'},
  {id: 495, family: 'authored-entwistle-gearing', maximumScriptBytes: 3_000_000},
]) {
  test(`${id} loads its own model without downloading unrelated authored families`, async ({page}, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto(`/portable/#/movement/${id}`);
    await expect(page.locator('.simulation-canvas')).toBeVisible();
    await expect(page.locator('#simulation-stage')).toHaveAttribute('aria-busy', 'false');
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({
      name: new URL(entry.name).pathname.split('/').at(-1), bytes: entry.decodedBodySize,
    })));
    const authored = resources.filter(entry => /^authored-/.test(entry.name));
    expect(authored.length).toBe(family ? 1 : 0);
    if (family) expect(authored[0].name.startsWith(`${family}-`)).toBe(true);
    expect(resources.some(entry => /\.wasm$/.test(entry.name))).toBe(false);
    if (maximumScriptBytes) {
      const scriptBytes = resources.filter(entry => entry.name.endsWith('.js'))
        .reduce((sum, entry) => sum + entry.bytes, 0);
      expect(scriptBytes).toBeGreaterThan(0);
      expect(scriptBytes).toBeLessThan(maximumScriptBytes);
    }
    expect(errors).toEqual([]);
    await testInfo.attach('loaded-resources', {body: JSON.stringify(resources, null, 2), contentType: 'application/json'});
  });
}

test('rapid navigation cancels a model load without replacing the current view', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let release, intercepted;
  const gate = new Promise(resolve => {release = resolve;});
  const pending = new Promise(resolve => {intercepted = resolve;});
  await page.route('**/authored-pulley-forms-*.js', async route => {
    intercepted();
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/portable/#/movement/255', {waitUntil: 'domcontentloaded'});
    await pending;
    await page.evaluate(() => {location.hash = '#/movement/273';});
  } finally {release();}
  const canvas = page.locator('.simulation-canvas');
  await expect(canvas).toHaveAttribute('aria-label', /movement 273:/);
  await expect(page.locator('#simulation-stage')).toHaveAttribute('aria-busy', 'false');
  await page.waitForTimeout(400);
  await expect(canvas).toHaveAttribute('aria-label', /movement 273:/);
  expect(await canvas.count()).toBe(1);
  expect(errors).toEqual([]);
});
