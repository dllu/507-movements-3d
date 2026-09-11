import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 } });
const captures = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    document.body.innerHTML = '<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-075-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();
    window.baselinePawl = new MovementEngine(document.querySelector('#stage'), catalog.movements[74], { playing: false });
  });
  for (const [view, phase, direction] of [['initial', .25, null], ['front', .25, [0,0,10]],
    ['drive-start', 0, [0,0,10]], ['drive-end', .5, [0,0,10]], ['return', .75, [0,0,10]],
    ['settling', .99, [0,0,10]], ['oblique', .75, [-4,3,10]], ['rear', .75, [4,3,-10]]]) {
    const state = await page.evaluate(async ({ view, phase, direction }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const e = window.baselinePawl, p = e.model.root.userData.geometry;
      const time = (phase - p.initialCyclePhase) / p.cyclesPerSecond;
      e.model.update(time); e.model.root.updateMatrixWorld(true);
      e.fitCamera(direction ? new Vector3(...direction) : e.model.cameraDirection);
      e.renderer.render(e.scene, e.camera);
      document.querySelector('#title').textContent = `075 · existing model · ${view} · phase ${phase}`;
      return e.model.root.userData.kinematics;
    }, { view, phase, direction });
    const file = `artifacts/review/075-baseline-${view}.png`;
    await page.screenshot({ path: file });
    captures.push({ file, view, phase, direction, state: { stage: state.stage, barAngle: state.barAngle,
      drivenAngle: state.drivenAngle, rodJoint: state.rodJoint, catchClearance: state.catchProfileClearance },
      sha256: createHash('sha256').update(await readFile(file)).digest('hex'), inspected: false });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/075-baseline-captures.json', JSON.stringify({ movement: 75,
    status: 'baseline-render-review', captures, errors }, null, 2) + '\n', { flag: 'wx' });
} finally { await browser.close(); }
