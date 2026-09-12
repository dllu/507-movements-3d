import fs from 'node:fs';
import assert from 'node:assert/strict';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {makeSelectorRackCandidate} from './lib/selector-rack-candidate.mjs';
import {makeSelectorRackContact} from './lib/selector-rack-contact.mjs';
import {freezeStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-contact-polygon-parity';
const model = makeSelectorRackCandidate(), u = model.root.userData, contact = makeSelectorRackContact(model);
const transform = (polygons, fn) => polygons.map(polygon => polygon.map(ring => ring.map(fn)));
const area = polygons => polygons.reduce((sum, rings) => sum + rings.reduce((s, ring, i) => {
  let cross = 0; for (let j = 0; j < ring.length - 1; j++) cross += ring[j][0] * ring[j + 1][1] - ring[j][1] * ring[j + 1][0];
  return s + Math.abs(cross) / 2 * (i ? -1 : 1);
}, 0), 0);
const counts = {clear: 0, overlapping: 0, nearBoundary: 0}, disagreements = [], boundaryChecks = [];
let pairs = 0;
for (const y of [-28 / 240, -3 / 240, 20 / 240]) for (let i = 0; i < 97; i++) {
  const q = -2 * Math.PI * i / 97, c = Math.cos(q), s = Math.sin(q);
  const cam = transform(u.profiles.cam, ([x, y]) => [c * x - s * y, s * x + c * y]);
  const forbidden = contact.intervalsAt(q, y).intervals;
  for (let j = 0; j < 13; j++) {
    const x = contact.range[0] + (contact.range[1] - contact.range[0]) * j / 12;
    const overlapArea = area(clip.intersection(cam, transform(u.profiles.frame, p => [p[0] + x, p[1] + y])));
    const distance = Math.min(Infinity, ...forbidden.flatMap(r => [Math.abs(x - r.enter), Math.abs(x - r.leave)]));
    const inside = forbidden.some(r => x > r.enter && x < r.leave); pairs++;
    if (distance < 1e-6 || overlapArea > 0 && overlapArea < 1e-10) {counts.nearBoundary++; continue;}
    const actual = overlapArea > 1e-10; counts[actual ? 'overlapping' : 'clear']++;
    if (inside !== actual) disagreements.push({q, x, y, inside, overlapArea, distance});
  }
  for (const r of forbidden) for (const x of [r.enter, r.leave]) if (x > contact.range[0] && x < contact.range[1]) {
    const overlapArea = area(clip.intersection(cam, transform(u.profiles.frame, p => [p[0] + x, p[1] + y])));
    boundaryChecks.push({q, x, y, overlapArea});
  }
}
assert.equal(disagreements.length, 0); assert(counts.clear > 0 && counts.overlapping > 0);
const maximumBoundaryArea = Math.max(...boundaryChecks.map(r => r.overlapArea)); assert(maximumBoundaryArea < 1e-8);
const sources = freezeStudySources(['scripts/check-selector-rack-contact.mjs', 'scripts/lib/selector-rack-contact.mjs',
  'scripts/lib/selector-rack-candidate.mjs', 'scripts/lib/selector-rack-source.mjs', 'scripts/lib/conforming-plate-mesh.mjs',
  'scripts/lib/study-report-io.mjs', 'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js'], prefix);
fs.writeFileSync(prefix + '.json', JSON.stringify({movement: 84, passed: true, mechanicsPassed: false, productionChanged: false,
  poses: pairs, counts, disagreements, boundaryChecks, maximumBoundaryArea, sources,
  qualification: 'The union of forbidden intervals from actual rounded cap triangles agrees with independent polygon-clipping area on the source-derived outlines at this pose grid. Source outlines and float mesh differ slightly. Near-boundary classifications are separated; interval endpoints have independently bounded sampled intersection area. This is sampled cross-checking, not continuous clearance or a force audit.'}, null, 2) + '\n', {flag: 'wx'});
console.log({poses: pairs, counts, disagreements, boundaryChecks: boundaryChecks.length, maximumBoundaryArea});
