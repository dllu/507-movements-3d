import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { PNG } from '../node_modules/playwright-core/lib/utilsBundle.js';
import { wormAndWheel } from '../src/simulation/authored-gears.js';
import { surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

const reference = await readFile('artifacts/reference/brown-031-detail.png'), png = PNG.sync.read(reference);
const candidate = JSON.parse(await readFile(process.env.PROBE_PROFILE ?? 'artifacts/review/031-corrected-worm-profile.json', 'utf8'));
const prefix = process.env.PROBE_PREFIX ?? '031-corrected';
const model = wormAndWheel({ ...candidate.parameters, profile: candidate.profile, wheelPhase: candidate.wheelPhase ?? Math.PI / 2,
  shaftOffsetX: candidate.shaftOffsetX ?? 0, shaftRadius: candidate.shaftRadius ?? 0.075, wormAngularSteps: 640 });
const { blocks, geometry: p } = model.root.userData;
const wheel = blocks.wheel.userData.toothMesh, worm = blocks.worm.userData.thread;
model.update(0); model.root.updateMatrixWorld(true);
const center = [384, 562], scale = 270;
const pixel = v => [center[0] + v.x * scale, center[1] - (v.y + 0.5) * scale];
const data = wheel.geometry.userData, stride = data.circumferenceSteps + 1;
const contours = { wheel: [] };
for (let i = 0; i < data.circumferenceSteps; i++) {
  let farthest = null, radius = 0;
  for (let row = 0; row <= data.axialSteps; row++) {
    const v = new THREE.Vector3().fromBufferAttribute(wheel.geometry.attributes.position, row * stride + i);
    if (Math.hypot(v.x, v.y) > radius) { farthest = v; radius = Math.hypot(v.x, v.y); }
  }
  contours.wheel.push(pixel(farthest.applyMatrix4(wheel.matrixWorld)));
}
const triangles = surfaceTriangles(worm.geometry).map(t => [t.a, t.b, t.c].map(v => pixel(v.applyMatrix4(worm.matrixWorld))));
const upper = [], lower = [];
for (let x = center[0] - p.wormLength * scale / 2; x <= center[0] + p.wormLength * scale / 2; x += 0.5) {
  let min = Infinity, max = -Infinity;
  for (const t of triangles) for (let j = 0; j < 3; j++) {
    const a = t[j], b = t[(j + 1) % 3];
    if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0]) || Math.abs(a[0] - b[0]) < 1e-9) continue;
    const y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    min = Math.min(min, y); max = Math.max(max, y);
  }
  if (Number.isFinite(min)) { upper.push([x, min]); lower.push([x, max]); }
}
contours.worm = [...upper, ...lower.reverse()];
const shaftBounds = new THREE.Box3().setFromObject(blocks.wormShaft, true);
contours.shaft = [[shaftBounds.min.x, shaftBounds.min.y], [shaftBounds.max.x, shaftBounds.min.y],
  [shaftBounds.max.x, shaftBounds.max.y], [shaftBounds.min.x, shaftBounds.max.y]].map(([x, y]) => pixel(new THREE.Vector3(x, y, 0)));
contours.hub = Array.from({ length: 256 }, (_, i) => pixel(new THREE.Vector3(0.3 * Math.cos(2 * Math.PI * i / 256), -0.5 + 0.3 * Math.sin(2 * Math.PI * i / 256), 0)));
const nearest = (q, path) => {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / den)) : 0;
    best = Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
  }
  return best;
};
const marked = { wheel: [], worm: [[289,94],[316,94],[363,94],[389,95],[436,96],[462,96],
  [244,236],[267,235],[321,237],[346,237],[397,237],[421,238],[243,128],[489,131]],
  shaft: [[98,144],[200,143],[634,142],[633,188],[516,192],[78,190]],
  hub: [[384,477],[465,559],[386,646],[303,561]] };
// Read radial dark-stroke midpoints only in the unobscured lower/side wheel.
// The upper worm and the broken upper-right outline are deliberately omitted.
for (let degrees = -8; degrees <= 222; degrees += 5) {
  const angle = degrees * Math.PI / 180, runs = [];
  let start = null;
  for (let radius = 300; radius <= 378; radius += 0.5) {
    const x = Math.round(center[0] + radius * Math.cos(angle)), y = Math.round(center[1] + radius * Math.sin(angle));
    const i = 4 * (y * png.width + x), dark = png.data[i] < 95 && png.data[i + 1] < 85 && png.data[i + 2] < 65;
    if (dark && start === null) start = radius;
    if ((!dark || radius === 378) && start !== null) { if (radius - start >= 2) runs.push([start, radius - 0.5]); start = null; }
  }
  if (!runs.length) continue;
  const [a, b] = runs[runs.length - 1], radius = (a + b) / 2;
  marked.wheel.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
}
const groups = Object.entries(marked).map(([name, points]) => {
  const rows = points.map(point => ({ point, residual: nearest(point, contours[name]) }));
  return { name, points: points.length, maximumResidual: Math.max(...rows.map(r => r.residual)),
    rmsResidual: Math.sqrt(rows.reduce((sum, r) => sum + r.residual ** 2, 0) / rows.length), rows };
});
const report = { movement: 31, status: 'isolated-corrected-candidate', reference: '../reference/brown-031-detail.png',
  source: 'https://507movements.com/mm_031.html', registration: { center, scale },
  method: 'Unchanged Brown PDF page 18 (printed 14), rendered at scale-to 6000 and cropped x610/y1320/840x980. The shaft center and overall wheel diameter set one orthographic registration. Compare actual projected generated wheel silhouette, screw triangle silhouette and fixed shaft/hub outlines to scoped dark-stroke radial readings and manual boundary marks. The printed worm is offset/irregular; this is not whole-image or recovered-depth registration.', groups };
await writeFile(`artifacts/review/${prefix}-source-outline.json`, JSON.stringify(report, null, 2) + '\n');
const colors = { wheel: '#00c67a', worm: '#008bff', shaft: '#ff2700', hub: '#d000ff' };
const lines = Object.entries(contours).map(([name, path]) => `<polyline points="${[...path, path[0]].map(q => q.join(',')).join(' ')}" fill="none" stroke="${colors[name]}" stroke-width="1.5"/>`).join('');
const dots = Object.entries(marked).flatMap(([name, points]) => points.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="3" fill="none" stroke="${colors[name]}"/>`)).join('');
await writeFile(`artifacts/review/${prefix}-source-overlay.html`, `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style><svg width="840" height="980" viewBox="0 0 840 980" xmlns="http://www.w3.org/2000/svg"><image width="840" height="980" href="data:image/png;base64,${reference.toString('base64')}"/>${lines}${dots}</svg>`);
console.log(groups.map(({ name, points, maximumResidual, rmsResidual }) => ({ name, points, maximumResidual, rmsResidual })));
