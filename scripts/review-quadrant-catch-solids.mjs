// Screens every pair of moving/fixed meshes of 183 and 184 across one cycle
// with an independent triangle-surface signed distance and records the worst
// penetration per pair in docs/validation/183-current-solids.json.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createAuthoredQuadrantCatchMovement } from '../src/simulation/authored-quadrant-catches.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const hash = (p) => createHash('sha256').update(fs.readFileSync(new URL(p, import.meta.url))).digest('hex');
const poses = 65, report = { movements: [183, 184], poses, sources: {
  factory: hash('../src/simulation/authored-quadrant-catches.js'),
  parts: hash('../src/simulation/quadrant-catch-finite-parts.js'),
  motion: hash('../src/simulation/baked/quadrant-catch-motion.js'),
}, results: {} };
const bodyOf = (o, blocks) => {
  for (let p = o; p; p = p.parent) {
    if (p === blocks.upperHandle) return 'upper';
    if (p === blocks.lowerHandle) return 'lower';
    if (p === blocks.pistonGroup) return 'tappet';
    if (p.userData.role?.endsWith('rod-hanging-from-eye')) return p.userData.role;
  }
  return 'fixed';
};
for (const id of report.movements) {
  const m = createAuthoredQuadrantCatchMovement({ id }), b = m.root.userData.blocks, meshes = [];
  m.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const data = meshes.map((o) => ({ o, body: bodyOf(o, b), field: solidSurface(o.geometry), points: surfacePoints(o.geometry) }));
  const worst = {};
  for (let i = 0; i < poses; i++) {
    const time = 18 * i / (poses - 1);
    m.update(time); m.root.updateMatrixWorld(true);
    for (let a = 0; a < data.length; a++) for (let c = a + 1; c < data.length; c++) {
      const A = data[a], C = data[c];
      if (A.body === C.body) continue;
      let depth = 0;
      for (const [from, to] of [[A, C], [C, A]]) {
        const matrix = to.o.matrixWorld.clone().invert().multiply(from.o.matrixWorld);
        for (const q of from.points) depth = Math.max(depth, -to.field.signedDistance(q.clone().applyMatrix4(matrix), 0.03));
      }
      const key = `${A.o.userData.role}/${C.o.userData.role}`;
      if (depth > 0 && depth > (worst[key]?.depth ?? 0)) worst[key] = { depth, time };
    }
  }
  report.results[id] = { meshes: meshes.length, worstPenetration: Math.max(0, ...Object.values(worst).map((w) => w.depth)), pairs: worst };
}
report.status = Object.values(report.results).every((r) => r.worstPenetration < 0.001) ? 'no-interpenetration-above-0.001' : 'finite-solids-intersect';
fs.writeFileSync('docs/validation/183-current-solids.json', JSON.stringify(report, null, 2) + '\n');
console.log(report.status, Object.fromEntries(Object.entries(report.results).map(([k, v]) => [k, v.worstPenetration])));
