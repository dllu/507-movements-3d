import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async () => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    const { makeDualInputDifferentialCandidate } = await import('/artifacts/review/062-candidate-model.mjs');
    document.body.innerHTML = `<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box">
      <div style="font:20px system-ui;height:40px">062 · Dual-input differential reconstruction under review</div>
      <div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div>
      <img src="/engravings/mm_062.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>`;
    const engine = new MovementEngine(document.querySelector('#stage'), catalog.movements[61], { playing: false });
    engine.scene.remove(engine.model.root); engine.model = makeDualInputDifferentialCandidate(); engine.scene.add(engine.model.root);
    const extent = engine.model.root.userData.shadowCameraHalfExtent;
    for (const light of engine.scene.children.filter(v => v.isDirectionalLight && v.castShadow)) {
      Object.assign(light.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent });
      light.shadow.camera.updateProjectionMatrix(); light.shadow.bias = engine.model.root.userData.shadowBias;
    }
    engine.renderer.localClippingEnabled = true; engine.updateGroundClearance(); window.candidate = engine;
  });
  for (const [view, direction, time, configuration = 'open'] of [['source', [-10, 0, 0], 0], ['oblique', [-8, 3, 6], 0],
    ['rear', [8, 3, -6], 0], ['shift', [-10, 0, 0], 0.95], ['high-speed', [-10, 0, 0], 5.9], ['crossed-source', [-10, 0, 0], 5.9, 'crossed'], ['crossed-oblique', [-8, 3, 6], 5.9, 'crossed'], ['complete', [-10, 0, 0], 0]]) {
    await page.evaluate(async ({ view, direction, time, configuration }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const engine = window.candidate; engine.model.root.userData.setConfiguration(configuration); engine.model.root.userData.setSectionView(view !== 'complete'); engine.model.update(time); engine.model.root.updateMatrixWorld(true);
      engine.fitCamera(new Vector3(...direction)); engine.renderer.render(engine.scene, engine.camera);
    }, { view, direction, time, configuration });
    await page.screenshot({ path: `artifacts/review/${process.env.CAPTURE_PREFIX ?? '062-candidate'}-${view}.png` });
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
