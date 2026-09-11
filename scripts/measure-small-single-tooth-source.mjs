import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as THREE from 'three';
import { makeSmallSingleToothCandidate } from './lib/small-single-tooth-candidate.mjs';
import { extrudedPlateContour } from './lib/extruded-plate-contour.mjs';

const layout = JSON.parse(await readFile('artifacts/review/069-source-layout-study.json', 'utf8'));
const radial = JSON.parse(await readFile('artifacts/review/069-source-radial-study.json', 'utf8'));
const model = makeSmallSingleToothCandidate(), p = model.motion.parameters;
model.update(0); model.root.updateMatrixWorld(true);
const anchor = layout.driverFit.center.map((v, i) => (v + layout.outputFit.center[i]) / 2), scale = p.sourceScale;
const contour = mesh => extrudedPlateContour(mesh.geometry).map(point => {
  const q = new THREE.Vector3(...point, p.depth / 2).applyMatrix4(mesh.matrixWorld);
  return [anchor[0] + scale * q.x, anchor[1] - scale * q.y];
});
const driver = contour(model.root.userData.parts.driverPlate), output = contour(model.root.userData.parts.wheelPlate);
const nearest = (q, path) => path.reduce((best, a, i) => {
  const b = path[(i + 1) % path.length], dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / den)) : 0;
  const point = [a[0] + t * dx, a[1] + t * dy], distance = Math.hypot(q[0] - point[0], q[1] - point[1]);
  return distance < best.distance ? { distance, point } : best;
}, { distance: Infinity });

// Independently retain each ink reading, rather than compare only the median
// section that helped author the candidate. Existing marked tips supply rays.
const sourcePath = 'artifacts/reference/brown-069-detail.png', source = await readFile(sourcePath);
const decoded = spawnSync('convert', [sourcePath, '-depth', '8', 'rgb:-'], { maxBuffer: 8 * 1024 * 1024 });
if (decoded.status !== 0 || decoded.stdout.length !== 1150 * 1330 * 3) throw new Error('Failed source pixel decode');
const readings = [], omitted = [];
for (const fraction of [.2, .4, .6, .8, .9]) for (let tooth = 0; tooth < radial.peaks.length; tooth++) {
  const a = radial.peaks[tooth].degrees, b = radial.peaks[(tooth + 1) % radial.peaks.length].degrees + (tooth === 29 ? 360 : 0);
  const angle = (a + (b - a) * fraction) * Math.PI / 180;
  let low = null, high = null;
  for (let radius = 290; radius <= 395; radius += .25) {
    const x = Math.round(radial.center[0] + radius * Math.cos(angle));
    const y = Math.round(radial.center[1] - radius * Math.sin(angle));
    const dark = decoded.stdout[3 * (1150 * y + x)] < 100;
    if (dark && low === null) low = radius;
    if (!dark && low !== null) { high = radius - .25; break; }
  }
  if (low === null || high === null) { omitted.push({ tooth, fraction, low, high }); continue; }
  const radius = (low + high) / 2;
  readings.push({ tooth, fraction, radius, strokeWidth: high - low, wideCrossing: high - low > 24,
    point: [radial.center[0] + radius * Math.cos(angle), radial.center[1] - radius * Math.sin(angle)] });
}
const groups = [
  ['driverCircle', layout.driverFit.points.map(point => ({ point })), driver],
  ['driverTooth', layout.toothOutlineReadings.map(point => ({ point })), driver],
  ['outputTips', radial.peaks.map(({ point }, tooth) => ({ point, tooth })), output],
  ['outputFlanks', readings.filter(r => r.fraction !== .6), output],
  ['outputRoots', readings.filter(r => r.fraction === .6), output],
].map(([name, points, path]) => {
  const rows = points.map(row => ({ ...row, nearest: nearest(row.point, path) }));
  return { name, samples: rows.length, maximumResidual: Math.max(...rows.map(r => r.nearest.distance)),
    rmsResidual: Math.sqrt(rows.reduce((s, r) => s + r.nearest.distance ** 2, 0) / rows.length), rows };
});
const report = { movement: 69, status: 'candidate-source-fit', productionChanged: false,
  method: 'Actual Float32 side-wall boundaries at time zero, projected with one shared orthographic transform. Scale is fixed by the source driver circle; translation is fixed by the midpoint of the two measured centers. No per-part adjustment. Tooth marks and the median section informed the profile, so fit is not independent mechanical proof. Individual flank/root readings retain source irregularity. Tip readings are smoothed inner ink crossings and are biased inward.',
  source: { file: sourcePath, sha256: createHash('sha256').update(source).digest('hex') },
  anchor, scale, assemblyDegrees: p.assemblyAngle * 180 / Math.PI,
  adjustments: { centerDistancePixels: (p.sourceCenterDistance - p.centerDistance) * scale,
    toothShorteningPixels: p.toothShortening * scale, rootDeepeningPixels: p.rootDeepening * scale },
  pixelReadingQualification: 'All bounded first-stroke crossings are included, including long ray intersections with a nearly radial flank. Their midpoints are less certain; wideCrossing flags widths greater than 24 pixels without omitting them.',
  omitted, groups };
const prefix = process.env.OUTPUT_PREFIX ?? 'artifacts/review/069-lock-event';
await writeFile(`${prefix}-source-fit.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const line = (ring, color) => `<polyline points="${[...ring, ring[0]].map(q => q.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
const marks = groups.flatMap(g => g.rows.map(r => `<circle cx="${r.point[0]}" cy="${r.point[1]}" r="3" fill="none" stroke="${g.name.startsWith('driver') ? '#f00050' : '#00a0ff'}" stroke-width="1"/>`)).join('');
await writeFile(`${prefix}-source-overlay.html`, `<!doctype html><meta charset="utf-8"><title>069 actual-mesh source overlay</title><style>body{margin:0}svg{width:1150px;height:1330px}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1150 1330"><image href="data:image/png;base64,${source.toString('base64')}" width="1150" height="1330"/>${line(driver, '#f00050')}${line(output, '#00a0ff')}${marks}</svg>`, { flag: 'wx' });
console.log({ groups: groups.map(({ rows, ...g }) => g), omitted: omitted.length, adjustments: report.adjustments });
