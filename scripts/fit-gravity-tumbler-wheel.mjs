import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { wormWheelGeometry } from '../src/simulation/worm-gear-geometry.js';
import { tumblerSourcePoints } from './lib/gravity-tumbler-source-points.mjs';
import { tumblerSource } from './lib/gravity-tumbler-plate.mjs';

const { anchor, scale } = tumblerSource;
const points = tumblerSourcePoints.wheel.map(([x, y]) => [(x - anchor[0]) / scale, (anchor[1] - y) / scale]);
const rows = [];
for (const teeth of [24, 26, 28]) {
  const { parameters, profile } = JSON.parse(await readFile(`artifacts/review/067-${teeth}-tooth-worm-profile.json`, 'utf8'));
  const g = wormWheelGeometry(parameters, { profile }), w = g.userData, stride = w.circumferenceSteps + 1;
  const path = Array.from({ length: w.circumferenceSteps }, (_, i) => {
    let vertex, radius = 0;
    for (let j = 0; j <= w.axialSteps; j++) {
      const q = new THREE.Vector3().fromBufferAttribute(g.attributes.position, j * stride + i);
      if (q.x * q.x + q.y * q.y > radius) { radius = q.x * q.x + q.y * q.y; vertex = q; }
    }
    return [vertex.y, -vertex.x]; // Wheel's fixed -pi/2 mounting rotation.
  });
  let best;
  for (let sample = 0; sample < 401; sample++) {
    const phase = 2 * Math.PI / teeth * (sample / 400 - 0.5), c = Math.cos(phase), s = Math.sin(phase);
    const residuals = points.map(([x, y]) => {
      const q = [x * c + y * s, -x * s + y * c]; let minimum = Infinity;
      for (let i = 0; i < path.length; i++) {
        const a = path[i], b = path[(i + 1) % path.length], dx = b[0] - a[0], dy = b[1] - a[1];
        const den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / den)) : 0;
        minimum = Math.min(minimum, (q[0] - a[0] - t * dx) ** 2 + (q[1] - a[1] - t * dy) ** 2);
      }
      return scale * Math.sqrt(minimum);
    });
    const rmsResidual = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length);
    if (!best || rmsResidual < best.rmsResidual) best = { phase, rmsResidual, maximumResidual: Math.max(...residuals), residuals };
  }
  rows.push({ teeth, points: points.length, ...best }); console.log(rows.at(-1));
}
await writeFile('artifacts/review/067-wheel-phase-fit.json', JSON.stringify({ movement: 67,
  method: 'One rigid wheel-phase fit across 37 manually read lower tooth-boundary points at a common source scale and shaft center. Actual projected radial envelopes for three regularized tooth counts. Phase is scanned over one pitch in 401 steps; no pointwise deformation. Engraving fit does not establish mechanical acceptance.', rows }, null, 2) + '\n', { flag: 'wx' });
