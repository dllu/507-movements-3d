import { chromium } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const prefix = process.env.CAPTURE_PREFIX ?? '069-balanced-candidate';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' });
const errors = [], captures = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  const p = await page.evaluate(async (profileName) => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    const { makeSmallSingleToothCandidate } = await import('/scripts/lib/small-single-tooth-candidate.mjs');
    document.body.innerHTML = `<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box">
      <div id="title" style="font:20px system-ui;height:40px">069 · Single-tooth index candidate</div>
      <div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div>
      <img src="/engravings/mm_069.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>`;
    const engine = new MovementEngine(document.querySelector('#stage'), catalog.movements[68], { playing: false });
    const profile = profileName ? (await import(`/scripts/lib/single-tooth-${profileName}-profile.mjs`)).default : undefined;
    engine.scene.remove(engine.model.root); engine.model = makeSmallSingleToothCandidate({ profile }); engine.scene.add(engine.model.root);
    for (const light of engine.scene.children.filter(light => light.isDirectionalLight && light.castShadow)) {
      const extent = engine.model.root.userData.shadowCameraHalfExtent;
      Object.assign(light.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent });
      light.shadow.camera.updateProjectionMatrix(); light.shadow.bias = engine.model.root.userData.shadowBias;
      light.shadow.normalBias = engine.model.root.userData.shadowNormalBias;
    }
    engine.updateGroundClearance(); window.candidate = engine; return engine.model.root.userData.geometry;
  }, process.env.CANDIDATE_PROFILE);
  const entry = p.entryAngle - p.initialInputPhase, exit = p.exitAngle - p.initialInputPhase;
  const phases = [['source', [0, 0, 10], 0], ['oblique', [-4, 3, 10], 0], ['rear', [4, 3, -10], 0],
    ['entry', [0, 0, 10], entry], ['quarter', [0, 0, 10], entry + (exit - entry) / 4],
    ['middle', [0, 0, 10], entry + (exit - entry) / 2], ['exit', [0, 0, 10], exit],
    ['locked', [0, 0, 10], 5 - p.initialInputPhase]];
  for (const [view, direction, time] of phases) {
    await page.evaluate(async ({ view, direction, time }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const engine = window.candidate; engine.model.update(time); engine.model.root.updateMatrixWorld(true);
      engine.fitCamera(new Vector3(...direction)); engine.renderer.render(engine.scene, engine.camera);
      document.querySelector('#title').textContent = `069 · ${view} · ${time.toFixed(5)} authored seconds`;
    }, { view, direction, time });
    const file = `artifacts/review/${prefix}-${view}.png`; await page.screenshot({ path: file });
    captures.push({ file, view, time, direction, sha256: createHash('sha256').update(await readFile(file)).digest('hex'), inspected: false });
  }
  if (process.env.OVERLAY_PREFIX) {
    await page.setViewportSize({width:1150,height:1330});
    await page.goto(`http://127.0.0.1:5174/artifacts/review/${process.env.OVERLAY_PREFIX}-source-overlay.html`);
    const file=`artifacts/review/${process.env.OVERLAY_PREFIX}-source-overlay.png`;
    await page.screenshot({path:file});
    captures.push({file,view:'source-overlay',sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`artifacts/review/${prefix}-captures.json`, JSON.stringify({ movement: 69, status: 'isolated-candidate', captures }, null, 2) + '\n', { flag: 'wx' });
} finally { await browser.close(); }
