// Close-up captures of the Movement 300/301 Debaufre pallet at the rest,
// impulse and drop phases, for reviewing the carved bands and flanges.
// Capturing is not approval; inspect the images.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const option = (name, fallback) => process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = resolve(option('output-dir', '/dev/shm/debaufre-pallet-review'));
const baseUrl = option('base-url', 'http://127.0.0.1:44240');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.goto(new URL('/#/about', baseUrl).href);
  const phases = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { MovementEngine } = await import('/src/simulation/async-engine.js');
    const { loadMovementModel } = await import('/src/simulation/model-loader.js');
    const catalog = await (await fetch('/src/data/movements.json')).json();
    const movement = catalog.movements[299];
    document.body.innerHTML = '<div id="stage" style="width:900px;height:700px"></div>';
    const model = await loadMovementModel(movement);
    const engine = new MovementEngine(document.querySelector('#stage'), movement, { playing: false, model });
    cancelAnimationFrame(engine.animationFrame); engine.animationFrame = 0;
    const g = model.root.userData.geometry;
    window.palletReview = { engine, model, THREE, g };
    const at = (phase) => phase * g.cyclePeriod;
    return {
      frontRest: at(g.firstImpulseStartPhase * 0.6),
      frontImpulseEarly: at(g.firstImpulseStartPhase + (g.firstReleasePhase - g.firstImpulseStartPhase) * 0.3),
      frontImpulseLate: at(g.firstImpulseStartPhase + (g.firstReleasePhase - g.firstImpulseStartPhase) * 0.7),
      frontToRearDrop: at((g.firstReleasePhase + g.firstCatchPhase) / 2),
      rearRest: at((g.firstCatchPhase + g.secondImpulseStartPhase) / 2),
    };
  });
  for (const [name, time] of Object.entries(phases)) {
    for (const [view, direction] of Object.entries({ entry: [-2.2, 1.6, 1.4], above: [-0.6, 3, 0.35] })) {
      await page.evaluate(({ time, direction }) => {
        const { engine, model, THREE, g } = window.palletReview;
        model.update(time); model.root.updateMatrixWorld(true);
        const target = new THREE.Vector3(0, g.palletCenterY, 0);
        engine.camera.fov = 30;
        engine.camera.position.copy(target).add(new THREE.Vector3(...direction).normalize().multiplyScalar(3.4));
        engine.controls.target.copy(target);
        engine.camera.near = 0.02; engine.camera.updateProjectionMatrix(); engine.controls.update();
        engine.renderer.render(engine.scene, engine.camera);
      }, { time, direction });
      await page.screenshot({ path: join(output, `300-pallet-${name}-${view}.png`) });
    }
  }
  console.log(JSON.stringify({ output, phases }));
} finally {
  await browser.close();
}
