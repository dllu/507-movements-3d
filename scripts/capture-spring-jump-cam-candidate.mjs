import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async overrideBias => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    const { makeSpringJumpCam } = await import('/src/simulation/spring-jump-cam.js');
    document.body.innerHTML = `<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box">
      <div id="title" style="font:20px system-ui;height:40px">064 · Spring cam candidate</div>
      <div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div>
      <img src="/engravings/mm_064.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>`;
    const engine = new MovementEngine(document.querySelector('#stage'), catalog.movements[63], { playing: false });
    engine.scene.remove(engine.model.root); engine.model = makeSpringJumpCam(); engine.scene.add(engine.model.root);
    for (const light of engine.scene.children.filter(light => light.isDirectionalLight && light.castShadow)) {
      const extent = engine.model.root.userData.shadowCameraHalfExtent;
      Object.assign(light.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent });
      light.shadow.camera.updateProjectionMatrix(); light.shadow.bias = overrideBias ?? engine.model.root.userData.shadowBias;
    }
    engine.updateGroundClearance(); window.candidate = engine;
  }, process.env.SHADOW_BIAS === undefined ? null : Number(process.env.SHADOW_BIAS));
  for (const [view, direction, time] of [['source', [0, 0, 10], 0], ['oblique', [-6, 3, 10], 0],
    ['rear', [6, 3, -10], 0], ['snap', [0, 0, 10], 0.7], ['settled', [0, 0, 10], 5], ['drive', [0, 0, 10], 12]]) {
    await page.evaluate(async ({ view, direction, time }) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js');
      const engine = window.candidate; engine.model.update(time); engine.model.root.updateMatrixWorld(true);
      engine.fitCamera(new Vector3(...direction)); engine.renderer.render(engine.scene, engine.camera);
      document.querySelector('#title').textContent = `064 · ${view} · ${time.toFixed(2)} authored seconds`;
    }, { view, direction, time });
    await page.screenshot({ path: `artifacts/review/${process.env.CAPTURE_PREFIX ?? '064-candidate'}-${view}.png` });
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
