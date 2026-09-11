import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeGravityTumblerCandidate } from './lib/gravity-tumbler-candidate.mjs';
import { makeGravityTumblerPlate, tumblerSource } from './lib/gravity-tumbler-plate.mjs';
import { tumblerSourcePoints as sourcePoints } from './lib/gravity-tumbler-source-points.mjs';
import { surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

const model = makeGravityTumblerCandidate();
const { parts, geometry: p } = model.root.userData;
const prefix = process.env.REVIEW_PREFIX ?? '067-candidate';
model.update(0); model.root.updateMatrixWorld(true);
const { anchor, scale } = tumblerSource;
const pixel = v => [anchor[0] + scale * v.x, anchor[1] - scale * v.y];
const circle = (mesh, radius, center = [0, 0]) => Array.from({ length: 1024 }, (_, i) => {
  const angle = 2 * Math.PI * i / 1024;
  return pixel(new THREE.Vector3(center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle), 0).applyMatrix4(mesh.matrixWorld));
});
const contours = { plate: makeGravityTumblerPlate().contours.shape.map(q => pixel(new THREE.Vector3(q.x, q.y, 0).applyMatrix4(parts.tumblerPlate.matrixWorld))),
  sleeve: circle(parts.weightSleeve, p.sleeveRadius), shaft: circle(parts.frontInputShaft, p.shaftRadius) };
const g = parts.wormWheel.geometry, w = g.userData, stride = w.circumferenceSteps + 1;
contours.wheel = Array.from({ length: w.circumferenceSteps }, (_, i) => {
  let vertex = new THREE.Vector3(), radius = 0;
  for (let j = 0; j <= w.axialSteps; j++) {
    const q = new THREE.Vector3().fromBufferAttribute(g.attributes.position, j * stride + i);
    if (q.x * q.x + q.y * q.y > radius) { radius = q.x * q.x + q.y * q.y; vertex = q; }
  }
  return pixel(vertex.applyMatrix4(parts.wormWheel.matrixWorld));
});
// Orthographic silhouette envelope from actual projected worm triangles.
// Every edge crossing each scan station contributes; no nominal tip cylinder.
const wormFaces = surfaceTriangles(parts.wormThread.geometry).map(face => [face.a, face.b, face.c]
  .map(q => pixel(q.clone().applyMatrix4(parts.wormThread.matrixWorld))));
const xs = wormFaces.flatMap(face => face.map(q => q[0]));
const xmin = xs.reduce((a, b) => Math.min(a, b), Infinity), xmax = xs.reduce((a, b) => Math.max(a, b), -Infinity);
const top = [], bottom = [];
for (let i = 0; i <= 768; i++) {
  const x = xmin + (xmax - xmin) * (i + 1e-7) / (768 + 2e-7); let lo = Infinity, hi = -Infinity;
  for (const face of wormFaces) for (let j = 0; j < 3; j++) {
    const a = face[j], b = face[(j + 1) % 3];
    if ((x - a[0]) * (x - b[0]) > 0 || Math.abs(b[0] - a[0]) < 1e-12) continue;
    const y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  if (Number.isFinite(lo)) { top.push([x, lo]); bottom.push([x, hi]); }
}
contours.worm = [...top, ...bottom.reverse()];
// Only the exposed ends are measured: the thread obscures the middle shaft.
for (const [name, end, inner] of [['wormShaftRight', p.wormShaftLow, -p.wormLength / 2],
  ['wormShaftLeft', p.wormShaftHigh, p.wormLength / 2]]) {
  const endX = p.wormOffset - end, innerX = p.wormOffset - inner;
  contours[name] = [[endX, -p.wormCenterDistance - 0.075], [innerX, -p.wormCenterDistance - 0.075],
    [innerX, -p.wormCenterDistance + 0.075], [endX, -p.wormCenterDistance + 0.075]].map(([x, y]) => pixel(new THREE.Vector3(x, y, 0)));
}
const nearest = (q, path) => path.reduce((best, a, i) => {
  const b = path[(i + 1) % path.length], dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / den)) : 0;
  return Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
}, Infinity);
const groups = Object.entries(sourcePoints).map(([name, points]) => {
  const rows = points.map(point => ({ point, residual: nearest(point, contours[name]) }));
  return { name, maximumResidual: Math.max(...rows.map(r => r.residual)),
    rmsResidual: Math.sqrt(rows.reduce((s, r) => s + r.residual ** 2, 0) / rows.length), rows };
});
const centers = [['shaft', [690, 725], new THREE.Vector3()],
  ['worm', [680, 1044], new THREE.Vector3(p.wormOffset, -p.wormCenterDistance, 0)]]
  .map(([name, sourcePoint, q]) => ({ name, sourcePoint, modelPoint: pixel(q), residual: Math.hypot(...pixel(q).map((v, i) => v - sourcePoint[i])) }));
await writeFile(`artifacts/review/${prefix}-source-outline.json`, JSON.stringify({ movement: 67, anchor, scale, wheelTeeth: p.wheelTeeth,
  source: '../reference/brown-067-detail.png', productionChanged: false,
  method: 'Independent manual visible boundary readings and centers in the Brown enlargement; one common orthographic transform. Scalloped plate, sleeve and shaft dimensions follow these readings. Actual projected wheel silhouette retains every physical tooth; the drawing abbreviates the upper teeth with dashed circles. Worm contour comes from actual projected triangle edges. Regularized tooth count and standard synchronized worm proportions are construction assumptions; their fit must be evaluated separately from the fitted plate contour.',
  groups, centers }, null, 2) + '\n');
const background = (await readFile('artifacts/reference/brown-067-detail.png')).toString('base64');
const colors = { plate: '#008bff', sleeve: '#d000ff', shaft: '#d000ff', wheel: '#00a85b', worm: '#ff2700', wormShaftLeft: '#ff2700', wormShaftRight: '#ff2700' };
const svg = Object.entries(contours).map(([name, path]) => `<polyline points="${[...path, path[0]].map(q => q.join(',')).join(' ')}" fill="none" stroke="${colors[name]}" stroke-width="2"/>`).join('');
const marks = Object.entries(sourcePoints).flatMap(([name, points]) => points.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="none" stroke="${colors[name]}" stroke-width="1.5"/>`)).join('');
await writeFile(`artifacts/review/${prefix}-source-overlay.html`, `<!doctype html><meta charset="utf-8"><title>067 candidate source overlay</title><style>body{margin:0;background:white}svg{width:1300px;height:1150px}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 1150"><image href="data:image/png;base64,${background}" width="1300" height="1150"/>${svg}${marks}</svg>`);
console.log({ groups: groups.map(({ rows, ...group }) => group), centers });
