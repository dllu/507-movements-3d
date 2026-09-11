import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Use the actual scene, lighting, camera fitter, and movement factories. Each
// pair shows the same source image used by the app at an authored cycle phase.
const ids = process.argv.slice(2).map(Number);
if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1 || id > 507)) {
  throw new RangeError('Supply one or more movement numbers, from 1 to 507.');
}
const phases = (process.env.REVIEW_PHASES ?? '0').split(',').map(Number);
const view = process.env.REVIEW_VIEW ?? 'source';
const configuration = process.env.REVIEW_CONFIGURATION;
if (!['source', 'full'].includes(view)) throw new RangeError('REVIEW_VIEW must be source or full.');
if (phases.some((phase) => !Number.isFinite(phase) || phase < 0 || phase > 1)) {
  throw new RangeError('REVIEW_PHASES must contain comma-separated cycle fractions from 0 to 1.');
}
await mkdir('artifacts/review', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`${process.env.REVIEW_URL ?? 'http://127.0.0.1:5174'}/#/about`);
  await page.evaluate(async () => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    document.body.innerHTML = `<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box">
      <div id="review-title" style="font:20px system-ui;height:40px"></div>
      <div style="display:flex;gap:16px;height:720px">
        <div id="review-stage" style="width:726px;height:720px;position:relative"></div>
        <img id="review-source" style="width:726px;height:720px;object-fit:contain;background:white" />
      </div></main>`;
    window.review = { MovementEngine, catalog };
  });
  for (const id of ids) {
    for (const phase of phases) {
      await page.evaluate(async ({ id, phase, view, configuration }) => {
        const { MovementEngine, catalog } = window.review;
        window.review.engine?.dispose();
        const movement = catalog.movements[id - 1];
        const source = document.querySelector('#review-source');
        source.src = `/engravings/mm_${movement.number}.png`;
        await source.decode();
        document.querySelector('#review-title').textContent = `${movement.number} · ${movement.title} · authored cycle ${phase}`;
        const engine = new MovementEngine(document.querySelector('#review-stage'), movement, { playing: false });
        window.review.engine = engine;
        if (configuration) {
          if (!engine.setConfiguration(configuration)) throw new Error('This model has no installed configurations');
          document.querySelector('#review-title').textContent += ` · ${configuration}`;
        }
        if (view === 'full') {
          if (!engine.model.root.userData.fullCameraDirection) throw new Error('This model has no complete-view camera');
          engine.model.root.userData.setSectionView?.(false);
          engine.fitCamera(engine.model.root.userData.fullCameraDirection);
          document.querySelector('#review-title').textContent += ' · complete model';
        }
        const time = engine.model.root.userData.animationTiming.authoredCyclePeriod * phase;
        // Incremental integration also supports older stateful factories.
        for (let step = 1; step <= 120 && time > 0; step += 1) {
          engine.model.update(time * step / 120, time / 120);
        }
        engine.updateGroundClearance();
        engine.renderer.render(engine.scene, engine.camera);
      }, { id, phase, view, configuration });
      const basename = process.env.REVIEW_BASENAME ?? String(id).padStart(3, '0');
      await page.screenshot({ path: `artifacts/review/${basename}-${view === 'full' ? 'full-' : ''}phase-${String(phase).replace('.', '_')}.png` });
    }
    process.stdout.write(`Captured ${id}\n`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
