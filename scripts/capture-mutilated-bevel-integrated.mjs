import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { visibleForegroundBounds, hasFrameMargin } from '../tests/helpers/rendered-frame.mjs';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let page = await browser.newPage({ viewport: { width: 1500, height: 800 } });
const captures = [], errors = [], checks = {}, framing = {};
page.on('pageerror', error => errors.push(error.message));
const capture = async (name, data = {}) => {
  const file = `artifacts/review/074-integrated-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  captures.push({ file, ...data, sha256: createHash('sha256').update(await readFile(file)).digest('hex'), inspected: false });
};
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  const timing = await page.evaluate(async () => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-074-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();
    const engine = new MovementEngine(document.querySelector('#stage'), catalog.movements[73], { playing: false });
    window.integratedBevel = engine;
    return engine.model.root.userData.animationTiming;
  });
  const poses = [['source', [0, 0, 10], .225], ['entry', [0, 0, 10], .4875],
    ['pickup', [0, 0, 10], .48769722362902096], ['entry-contact', [0, 0, 10], .491234567],
    ['index', [0, 0, 10], .738151], ['release', [0, 0, 10], .9875],
    ['release-contact', [0, 0, 10], .994440059129497], ['last-release', [0, 0, 10], .9972157321628785],
    ['dwell', [0, 0, 10], 1.025], ['oblique', [-4, 3, 10], .738151], ['rear', [4, 3, -10], .738151]];
  for (const [view, direction, coordinate] of poses) {
    const state = await page.evaluate(async ({ view, direction, coordinate }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const e = window.integratedBevel, p = e.model.root.userData.geometry;
      e.model.update((coordinate - p.initialCyclePhase) * p.period);
      e.model.root.updateMatrixWorld(true); e.fitCamera(new Vector3(...direction)); e.renderer.render(e.scene, e.camera);
      document.querySelector('#title').textContent = `074 · integrated model · ${view} · input ${(coordinate * 360).toFixed(3)}°`;
      return e.model.root.userData.kinematics;
    }, { view, direction, coordinate });
    await capture(view, { view, direction, coordinate, state });
  }
  // The comparison replaces the app DOM. Open the real UI in a fresh document
  // without dispatching a route change to the detached original app mount.
  await page.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5174/#/movement/074');
  const canvas = page.locator('canvas'); await canvas.waitFor({ state: 'visible' });
  const note = page.getByText('The half-toothed bevel driver alternately advances the two opposed outputs.', { exact: false });
  checks.noteVisible = await note.isVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  const stopped = await canvas.screenshot(); await page.waitForTimeout(250);
  checks.pauseStable = (await canvas.screenshot()).equals(stopped);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(150);
    if (!(await canvas.screenshot()).equals(stopped)) { checks.playChangesFrame = true; break; }
  }
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  framing.desktop = await visibleForegroundBounds(canvas); checks.desktopFramed = hasFrameMargin(framing.desktop);
  await capture('desktop-controls', { view: 'desktop-controls' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.waitForTimeout(250);
  framing.mobile = await visibleForegroundBounds(canvas); checks.mobileFramed = hasFrameMargin(framing.mobile);
  checks.mobileNoHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  await capture('mobile-controls', { view: 'mobile-controls' });
  await note.scrollIntoViewIfNeeded();
  checks.mobileNoteReachable = await note.isVisible();
  await capture('mobile-notes', { view: 'mobile-notes' });
  checks.noPageErrors = errors.length === 0;
  await writeFile('artifacts/review/074-integrated-captures.json', JSON.stringify({ movement: 74,
    status: 'integrated-registry-model', timing, captures, checks, framing, errors }, null, 2) + '\n', { flag: 'wx' });
  console.log({ views: captures.length, checks, framing, timing });
  if (Object.values(checks).some(value => value !== true)) process.exitCode = 1;
} finally { await browser.close(); }
