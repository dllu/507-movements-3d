import fs from 'node:fs';
import assert from 'node:assert/strict';
import {plate, poly, polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {surfaceTriangles, surfacePoints, solidSurface} from '../tests/helpers/solid-surface.mjs';
import {conformingPlateMesh} from './lib/conforming-plate-mesh.mjs';
import {makeSelectorRackCandidate} from './lib/selector-rack-candidate.mjs';
import {freezeStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-conforming-mesh-controls';
const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const model = makeSelectorRackCandidate(), u = model.root.userData;
const shapes = [
  ['plain-rectangle', rect(-2, -1, 2, 1)],
  ['two-aligned-slots', clip.difference(rect(-2, -1, 2, 1), rect(-1.7, .2, -.4, .5), rect(.4, .2, 1.7, .5))],
  ['actual-selector-frame', u.profiles.frame],
];
function topology(geometry) {
  const edges = new Map(); let volume = 0, degenerate = 0;
  for (const t of surfaceTriangles(geometry)) {
    const points = [t.a, t.b, t.c]; volume += t.a.dot(t.b.clone().cross(t.c)) / 6;
    if (t.getArea() < 1e-11) degenerate++;
    const keys = points.map(p => p.toArray().map(n => Math.round(n * 1e8)).join(','));
    for (let i = 0; i < 3; i++) {
      const a = keys[i], b = keys[(i + 1) % 3], k = a < b ? a + '/' + b : b + '/' + a;
      const edge = edges.get(k) ?? {count: 0, sign: 0}; edge.count++; edge.sign += a < b ? 1 : -1; edges.set(k, edge);
    }
  }
  return {volume, degenerate, unmatchedEdges: [...edges.values()].filter(e => e.count !== 2 || e.sign !== 0).length};
}
const controls = shapes.map(([name, shape]) => {
  const original = plate(shape, -.06, .06), repaired = conformingPlateMesh(original.clone());
  const before = topology(original), after = topology(repaired);
  const oldSolid = solidSurface(original), newSolid = solidSurface(repaired);
  let maximumSurfaceDistance = 0, samples = 0;
  for (const [geometry, target] of [[repaired, oldSolid], [original, newSolid]]) for (const point of surfacePoints(geometry)) {
    samples++; maximumSurfaceDistance = Math.max(maximumSurfaceDistance, target.distance(point));
  }
  assert.equal(after.unmatchedEdges, 0); assert.equal(after.degenerate, 0); assert(after.volume > 0);
  assert(Math.abs(after.volume - before.volume) < 1e-8); assert(maximumSurfaceDistance < 1e-7);
  if (name === 'plain-rectangle') assert.equal(repaired.userData.conformity.splitTriangles, 0);
  if (name === 'actual-selector-frame') assert.equal(before.unmatchedEdges, 8);
  return {name, before, after, samples, maximumSurfaceDistance, repair: repaired.userData.conformity};
});
const sources = freezeStudySources(['scripts/check-conforming-plate-mesh.mjs', 'scripts/lib/conforming-plate-mesh.mjs',
  'scripts/lib/selector-rack-candidate.mjs', 'scripts/lib/selector-rack-source.mjs', 'scripts/lib/study-report-io.mjs',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'tests/helpers/solid-surface.mjs'], prefix);
fs.writeFileSync(prefix + '.json', JSON.stringify({passed: true, productionChanged: false, controls, sources,
  qualification: 'The previously nonconforming frame and an aligned-slot fixture become consistently wound closed meshes. A plain plate remains unsplit. Volumes agree, and both sets of actual vertex/edge/face samples remain on the other surface. This validates this geometric repair, not arbitrary meshes or mechanical motion.'}, null, 2) + '\n', {flag: 'wx'});
console.log(controls);
