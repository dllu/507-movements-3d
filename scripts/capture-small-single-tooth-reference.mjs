import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const directory = 'artifacts/reference/';
const source = 'https://507movements.com/mm_069.html';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const save = async (file, fields) => {
  await page.locator('#canv').screenshot({ path: directory + file });
  return { ...fields, file, inspected: false,
    sha256: createHash('sha256').update(await readFile(directory + file)).digest('hex') };
};
try {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '507movements.com' || url.hostname === 'www.507movements.com'
      ? route.continue() : route.abort();
  });
  await page.goto(source, { waitUntil: 'load' });
  await page.waitForFunction(() => window.mm_present && window.ae?.get_model_names().includes('mm_069'));
  await page.locator('#ani').click();
  const live = [];
  for (let index = 0; index < 6; index++) {
    if (index) await page.waitForTimeout(600);
    live.push(await save(`069-official-animation-${index}.png`, { index }));
  }
  await page.locator('#orig').click();
  await page.evaluate(() => {
    // The official library attaches one animation wrapper to each 2D context.
    // A fresh canvas permits a paused instance after the live one is stopped.
    const originalCanvas = document.querySelector('#canv');
    originalCanvas.replaceWith(originalCanvas.cloneNode(false));
    window.referenceAnimation = window.ae.new_ani('mm_069', 15,
      window.ae.get_model('mm_069').get_view_names()[0], false, null, 50);
    document.querySelector('#canv').className = '';
    document.querySelector('#mainimg').className = 'hide';
  });
  const rows = [];
  for (const phase of [0, 0.025, 0.0625, 0.125, 0.1875, 0.2499, 0.25, 0.5, 1]) {
    await page.evaluate(value => window.referenceAnimation.set_cycle(value), phase);
    rows.push(await save(`069-official-phase-${String(phase).replace('.', '_')}.png`, { phase }));
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(directory + '069-official-animation-captures.json', JSON.stringify({ source, rows: live,
    method: 'Six wall-time samples from the live official animation, 600 milliseconds apart.', errors }, null, 2) + '\n', { flag: 'wx' });
  await writeFile(directory + '069-official-phase-captures.json', JSON.stringify({ source, rows,
    method: 'Stopped the live animation with the Original tab and created a paused instance of the same official mm_069 model and view. Its set_cycle API selects phases without changing the official geometry or motion.',
    inspected: false, errors }, null, 2) + '\n', { flag: 'wx' });
  console.log({ liveFrames: live.length, phaseFrames: rows.length, errors });
} finally {
  await browser.close();
}
