import fs from 'node:fs/promises';
import { chromium } from 'playwright';

// Compare the interior of 039's opaque carrier with and without objects
// behind it. Shadow reception is disabled in both views so the comparison
// isolates framebuffer occlusion, not legitimate cast shadows.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 800 } });
  await page.goto(`${process.env.REVIEW_URL ?? 'http://127.0.0.1:5174'}/#/about`);
  const report = await page.evaluate(async () => {
    const { MovementEngine } = await import('/src/simulation/engine.js');
    const { default: catalog } = await import('/src/data/movements.json');
    const THREE = await import('/node_modules/.vite/deps/three.js');
    document.body.innerHTML = '<div id="probe" style="width:726px;height:720px"></div>';
    const engine = new MovementEngine(document.querySelector('#probe'), catalog.movements[38], { playing: false });
    const { arm, carrier } = engine.model.root.userData.blocks;
    arm.receiveShadow = false;
    const gl = engine.renderer.getContext();
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const full = new Uint8Array(width * height * 4), isolated = new Uint8Array(full.length);
    const meshes = [];
    engine.model.root.traverse((part) => { if (part.isMesh) meshes.push([part, part.visible]); });
    const results = [];
    for (const phase of [0.25, 0.5, 0.75]) {
      engine.model.update(engine.model.root.userData.geometry.orbitPeriod * phase, 0);
      engine.model.root.updateMatrixWorld(true);
      engine.renderer.render(engine.scene, engine.camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, full);
      for (const [part] of meshes) part.visible = part === arm;
      engine.renderer.render(engine.scene, engine.camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, isolated);
      for (const [part, visible] of meshes) part.visible = visible;
      const pixels = new Set();
      const point = new THREE.Vector3();
      for (let along = 0; along < 400; along += 1) {
        for (let across = 0; across < 100; across += 1) {
          point.set(0.26 + 0.92 * along / 399, -0.15 + 0.3 * across / 99, 0.37)
            .applyMatrix4(carrier.matrixWorld).project(engine.camera);
          const x = Math.floor((point.x + 1) * width / 2), y = Math.floor((point.y + 1) * height / 2);
          pixels.add((y * width + x) * 4);
        }
      }
      let changedPixels = 0, maximumChannelDifference = 0;
      for (const offset of pixels) {
        const difference = Math.max(...[0, 1, 2].map((channel) => Math.abs(full[offset + channel] - isolated[offset + channel])));
        maximumChannelDifference = Math.max(maximumChannelDifference, difference);
        if (difference > 3) changedPixels += 1;
      }
      results.push({ phase, sampledPixels: pixels.size, changedPixels, maximumChannelDifference });
    }
    const result = { antialias: gl.getContextAttributes().antialias,
      pixelRatio: engine.renderer.getPixelRatio(), width, height, results };
    engine.dispose();
    return result;
  });
  console.log(JSON.stringify(report, null, 2));
  await fs.writeFile(process.env.OCCLUSION_REPORT ?? 'artifacts/review/039-opaque-occlusion.json', JSON.stringify(report, null, 2) + '\n');
  if (report.results.some((result) => result.changedPixels > 0)) process.exitCode = 1;
} finally {
  await browser.close();
}
