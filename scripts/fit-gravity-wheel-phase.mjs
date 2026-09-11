import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeGravityJumpCandidate } from './lib/gravity-jump-candidate.mjs';

const source = JSON.parse(await readFile('artifacts/review/066-candidate-source-outline.json', 'utf8'));
const points = source.groups.find(g => g.name === 'wheel').rows.map(r => [(r.point[0] - 501) / 218, (807 - r.point[1]) / 218]);
const rows = [];
for (const teeth of [20, 24, 26, 28]) {
  const file = teeth === 20 ? '066-candidate-worm-profile.json' : `066-${teeth}-tooth-worm-profile.json`;
  const { profile } = JSON.parse(await readFile(`artifacts/review/${file}`, 'utf8'));
  const model = makeGravityJumpCandidate({ wormProfile: profile }), mesh = model.root.userData.parts.wormWheel;
  model.root.updateMatrixWorld(true);
  const g = mesh.geometry, w = g.userData, stride = w.circumferenceSteps + 1;
  const path = Array.from({ length: w.circumferenceSteps }, (_, i) => {
    let vertex, radius = 0;
    for (let j = 0; j <= w.axialSteps; j++) {
      const q = new THREE.Vector3().fromBufferAttribute(g.attributes.position, j * stride + i);
      if (q.x * q.x + q.y * q.y > radius) { radius = q.x * q.x + q.y * q.y; vertex = q; }
    }
    vertex.applyMatrix4(mesh.matrixWorld); return [vertex.x, vertex.y];
  });
  let best;
  for (let sample = 0; sample < 401; sample++) {
    const phase = 2 * Math.PI / teeth * (sample / 400 - 0.5), c = Math.cos(phase), s = Math.sin(phase);
    const residuals = points.map(([x, y]) => {
      const q = [x * c + y * s, -x * s + y * c]; let minimum = Infinity;
      for (let i = 0; i < path.length; i++) {
        const a = path[i], b = path[(i + 1) % path.length], dx = b[0] - a[0], dy = b[1] - a[1];
        const den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / den)) : 0;
        const d = (q[0] - a[0] - t * dx) ** 2 + (q[1] - a[1] - t * dy) ** 2; minimum = Math.min(minimum, d);
      }
      return 218 * Math.sqrt(minimum);
    });
    const rmsResidual = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
    if (!best || rmsResidual < best.rmsResidual) best = { phase, rmsResidual, maximumResidual: Math.max(...residuals), residuals };
  }
  rows.push({ teeth, points: points.length, ...best }); console.log(rows.at(-1));
}
await writeFile('artifacts/review/066-wheel-phase-fit.json', JSON.stringify({ movement: 66,
  method: 'One rigid wheel-phase fit across the same 32 independently marked lower tooth-boundary points, at a fixed common source scale and center. Complete actual projected radial envelopes for four regularized tooth counts. Phase is scanned over one pitch in 401 steps; no pointwise deformation. This measures engraving fit, not mechanical acceptance.', rows }, null, 2) + '\n');
