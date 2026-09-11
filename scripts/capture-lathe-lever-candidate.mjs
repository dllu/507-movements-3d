import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    const { makeLatheLeverCandidate } = await import('/artifacts/review/056-candidate-model.mjs');
    document.body.innerHTML = `<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box">
      <div style="font:20px system-ui;height:40px">056 · Lathe gear engagement reconstruction under review</div>
      <div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div>
      <img src="/engravings/mm_056.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>`;
    const engine = new MovementEngine(document.querySelector('#stage'), catalog.movements[55], { playing: false });
    engine.scene.remove(engine.model.root); engine.model = makeLatheLeverCandidate(); engine.scene.add(engine.model.root);
    for (const light of engine.scene.children.filter(v => v.isDirectionalLight && v.castShadow)) {
      Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
      light.shadow.camera.updateProjectionMatrix(); light.shadow.bias = -0.00003;
    }
    engine.updateGroundClearance(); window.candidate = engine;
  });
  for (const [view, direction, time] of [['source', [0.65, -0.1, 10], 0], ['oblique', [4, 3, 8], 0],
    ['rear', [4, 3, -8], 0], ['withdrawn', [0.65, -0.1, 10], 3.6]]) {
    await page.evaluate(async ({ direction, time }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const engine = window.candidate; engine.model.update(time); engine.model.root.updateMatrixWorld(true);
      engine.fitCamera(new Vector3(...direction)); engine.renderer.render(engine.scene, engine.camera);
    }, { direction, time });
    await page.screenshot({ path: `artifacts/review/${process.env.CAPTURE_PREFIX ?? '056-candidate'}-${view}.png` });
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
