import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' });
const errors = [], captures = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  const data = await page.evaluate(async () => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-072-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();
    const engine = new MovementEngine(document.querySelector('#stage'), catalog.movements[71], { playing: false });
    window.integratedHammer = engine;
    return { parameters: engine.model.motion.parameters, events: engine.model.motion.events };
  });
  const p = data.parameters, { entry, flankEnd, crest, release, landing } = data.events;
  const sourceTime = p.initialTime;
  const frames = [
    ['source', [0, 0, 10], sourceTime], ['oblique', [-4, 3, 10], sourceTime], ['rear', [4, 3, -10], sourceTime],
    ['pickup', [0, 0, 10], entry.time], ['lifting', [0, 0, 10], (entry.time + release.time) / 2],
    ['flank-end', [0, 0, 10], flankEnd.time], ['crest', [0, 0, 10], crest.time],
    ['release', [0, 0, 10], release.time], ['fall', [0, 0, 10], (release.time + landing.time) / 2],
    ['landing', [0, 0, 10], landing.time], ['dwell', [0, 0, 10], (landing.time + p.period) / 2],
  ];
  for (const [view, direction, absoluteTime] of frames) {
    const time = absoluteTime - p.initialTime;
    const state = await page.evaluate(async ({ view, direction, time }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const e = window.integratedHammer;
      e.model.update(time); e.model.root.updateMatrixWorld(true); e.fitCamera(new Vector3(...direction));
      e.renderer.render(e.scene, e.camera);
      document.querySelector('#title').textContent = `072 · integrated model · ${view} · ${time.toFixed(6)} s`;
      return e.model.motion.atTime(time);
    }, { view, direction, time });
    const file = `artifacts/review/072-integrated-${view}.png`;
    await page.screenshot({ path: file });
    captures.push({ file, view, direction, time, absoluteTime, stage: state.stage, q: state.q,
      sha256: createHash('sha256').update(await readFile(file)).digest('hex'), inspected: false });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/072-integrated-captures.json', JSON.stringify({
    movement: 72, status: 'integrated-registry-model', captures,
  }, null, 2) + '\n', { flag: 'wx' });
} finally {
  await browser.close();
}
