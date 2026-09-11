import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 800 }, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async ({ profilePath, mapPath }) => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    const { makeStarMangleCandidate } = await import('/artifacts/review/054-candidate-model.mjs');
    const data = await fetch(profilePath).then((response) => response.json());
    const contactMap = mapPath ? await fetch(mapPath).then((response) => response.json()) : null;
    document.body.innerHTML = `<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box">
      <div id="title" style="font:20px system-ui;height:40px">054 · Mangle wheel reconstruction under review</div>
      <div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div>
      <img src="/engravings/mm_054.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>`;
    const engine = new MovementEngine(document.querySelector('#stage'), catalog.movements[53], { playing: false });
    engine.scene.remove(engine.model.root); engine.model = makeStarMangleCandidate(data, { contactMap }); engine.scene.add(engine.model.root);
    for (const light of engine.scene.children.filter((v) => v.isDirectionalLight && v.castShadow)) {
      Object.assign(light.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2 });
      light.shadow.camera.updateProjectionMatrix(); light.shadow.bias = -0.00003;
    }
    engine.fitCamera(engine.model.cameraDirection); engine.updateGroundClearance(); window.candidate = engine;
  }, { profilePath: process.env.PROFILE_URL ?? '/artifacts/review/054-candidate-profiles-overtravel.json', mapPath: process.env.MAP_URL ?? null });
  for (const view of ['source', 'oblique', 'crossover']) {
    await page.evaluate(async (view) => {
      const { Vector3 } = await import('/node_modules/three/build/three.module.js'), engine = window.candidate;
      if (view === 'crossover') engine.model.root.userData.updateTravel(engine.model.root.userData.geometry.runTravel + Math.PI / 2);
      engine.fitCamera(view === 'source' ? new Vector3(0, 0, 10) : new Vector3(4, 3, 8));
      engine.renderer.render(engine.scene, engine.camera);
    }, view);
    await page.screenshot({ path: `artifacts/review/${process.env.CAPTURE_PREFIX ?? '054-candidate'}-${view}.png` });
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
