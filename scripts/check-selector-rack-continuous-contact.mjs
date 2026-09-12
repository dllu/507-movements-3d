import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSelectorRackFreeCandidate} from './lib/selector-rack-free-candidate.mjs';
import {makeSelectorRackDynamics} from './lib/selector-rack-dynamics.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/084-planar-eighth-ms-pulses.json.gz';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-eighth-ms-continuous-contact';
const data = readStudyReport(input); verifyStudySources(data.sources);
assert.equal(data.failures.length, 0); assert(Math.abs(data.rows.at(-1).time - data.duration) < 1e-8);
const model = makeSelectorRackFreeCandidate(), u = model.root.userData, physics = makeSelectorRackDynamics(model, data.parameters);
const sources = freezeStudySources([input, 'scripts/check-selector-rack-continuous-contact.mjs',
  'scripts/lib/crossed-rack-mesh-prisms.mjs', ...data.sources.map(s => s.file)], prefix);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const box = points => ({low: [0, 1].map(k => Math.min(...points.map(p => p[k]))), high: [0, 1].map(k => Math.max(...points.map(p => p[k])))});
const union = (a, b, pad = 0) => ({low: a.low.map((v, k) => Math.min(v, b.low[k]) - pad), high: a.high.map((v, k) => Math.max(v, b.high[k]) + pad)});
const gap = (a, b) => Math.max(a.low[0] - b.high[0], b.low[0] - a.high[0], a.low[1] - b.high[1], b.low[1] - a.high[1]);
const roundoff = 1e-10, tolerance = 1e-6, validations = {};
const prism = name => {
  const mesh = u.parts[name], matrix = mesh.matrixWorld.elements, result = renderedPrism(mesh.geometry);
  assert.deepEqual(matrix.slice(0, 12), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]); assert.equal(matrix[15], 1);
  // Transform extracted doubles, preserving the original Float32 mesh buffer.
  // Writing transformed positions into another Float32 buffer changes the hull.
  for (const p of result.points) {p[0] += matrix[12]; p[1] += matrix[13];}
  result.low += matrix[14]; result.high += matrix[14];
  validations[name] = {...result.validation, translation: matrix.slice(12, 15)}; return result;
};
const framePrism = prism('slottedRackFrame');
const canonical = cells => cells.map(c => c.points.map(p => p.join(',')).sort().join(';')).sort();
assert.deepEqual(canonical(physics.contact.frame), canonical(framePrism.triangles.map(t => ({points: t.points.map(p => p.map((v, k) => v - u.frameCentroid[k]))}))));
assert.deepEqual(canonical(physics.contact.bodies.find(b => b.name === 'cam').cells), canonical(prism('singleWorkingCam').triangles));
for (const [key, name] of [['pin0', 'suspensionPin0'], ['pin1', 'suspensionPin1'], ['shaft', 'fixedCamAxle']]) {
  const p = prism(name), hull = physics.contact.bodies.find(b => b.name === key).cells[0].points;
  // The contact hull must contain every rendered prism vertex.
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    for (const v of p.points) assert((b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0]) >= -1e-12);
  }
}
function clipZ(points, level, sign) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], insideA = sign * (a[2] - level) >= 0, insideB = sign * (b[2] - level) >= 0;
    if (insideA) out.push(a);
    if (insideA !== insideB) {const f = (level - a[2]) / (b[2] - a[2]); out.push(a.map((v, k) => v + f * (b[k] - v)));}
  }
  return out;
}
for (let i = 0; i < 2; i++) {
  const name = 'rackGuide' + i, mesh = u.parts[name], rectangles = physics.contact.bodies.filter(b => b.name.startsWith('guide' + i + ':')).map(b => b.cells[0].box);
  let clippedTriangles = 0;
  for (const t of surfaceTriangles(mesh.geometry)) {
    const points = clipZ(clipZ([t.a, t.b, t.c].map(p => p.clone().applyMatrix4(mesh.matrixWorld).toArray()), framePrism.low, 1), framePrism.high, -1);
    if (!points.length) continue; clippedTriangles++;
    assert(rectangles.some(r => points.every(p => [0, 1].every(k => p[k] >= r.low[k] - roundoff && p[k] <= r.high[k] + roundoff))), 'Guide slab surface is contained in contact rectangles');
  }
  assert(clippedTriangles > 0); validations[name] = {clippedTriangles, frameZ: [framePrism.low, framePrism.high], passed: true};
}
const frame = physics.contact.frame.map(c => ({...c, radius: Math.max(...c.points.map(p => Math.hypot(...p)))}));
const bodies = physics.contact.bodies.map(b => ({...b, radius: Math.max(...b.cells.flatMap(c => c.points.map(p => Math.hypot(...p)))),
  cells: b.cells.map(c => ({...c, radius: Math.max(...c.points.map(p => Math.hypot(...p)))}))}));
const acceleration = data.parameters.pulses.reduce((sum, p) => sum + Math.abs(p.heightPixels / u.source.scale - data.parameters.neutral)
  * 10 / Math.sqrt(3) * (1 / (p.rise[1] - p.rise[0]) ** 2 + 1 / (p.fall[1] - p.fall[0]) ** 2), 0);
function pose(cell, angle, translation) {
  const c = Math.cos(angle), s = Math.sin(angle), points = cell.points.map(([x, y]) => [c * x - s * y + translation[0], s * x + c * y + translation[1]]);
  return {points, box: box(points), axes: cell.axes.map(([x, y]) => [c * x - s * y, s * x + c * y])};
}
function at(row) {
  const k = physics.input(row.time);
  return {frame: frame.map(c => pose(c, row.x[2], row.x)), bodies: bodies.map(b => {
    const cells = b.cells.map(c => pose(c, b.input === 'cam' ? k.camAngle : 0, [0, b.input === 'selector' ? k.selectorY : 0]));
    return {cells, box: box(cells.flatMap(c => c.points))};
  })};
}
const fixedGap = (a, b, n) => Math.min(...a.points.map(p => dot(p, n))) - Math.max(...b.points.map(p => dot(p, n)));
const counts = {intervals: 0, groupExclusions: 0, boxExclusions: 0, axisCertificates: 0, subdivisions: 0, failedPairs: 0};
let minimumBound = Infinity, maximumDepth = 0;
const failures = [], started = performance.now();
function certify(localA, localB, body, a, b, start, end, A0, A1, B0, B1, depth = 0) {
  maximumDepth = Math.max(maximumDepth, depth);
  const h = end - start, da = (b.x[2] - a.x[2]) * h / (b.time - a.time);
  const errorA = localA.radius * da * da / 8;
  const errorB = body.input === 'cam' ? localB.radius * (2 * Math.PI * h / data.parameters.period) ** 2 / 8 : body.input === 'selector' ? acceleration * h * h / 8 : 0;
  const broad = gap(union(A0.box, A1.box, errorA), union(B0.box, B1.box, errorB)) - roundoff;
  if (broad >= -tolerance) {counts.boxExclusions++; minimumBound = Math.min(minimumBound, broad); return true;}
  let lower = -Infinity;
  for (const [A, B] of [[A0, B0], [A1, B1]]) {
    const n = physics.contact.separation(A, B).normal;
    lower = Math.max(lower, Math.min(fixedGap(A0, B0, n), fixedGap(A1, B1, n)) - errorA - errorB - roundoff);
  }
  if (lower >= -tolerance) {counts.axisCertificates++; minimumBound = Math.min(minimumBound, lower); return true;}
  if (depth === 12) return false;
  counts.subdivisions++;
  const time = (start + end) / 2, f = (time - a.time) / (b.time - a.time), x = a.x.map((v, i) => v + f * (b.x[i] - v)), k = physics.input(time);
  const A = pose(localA, x[2], x), B = pose(localB, body.input === 'cam' ? k.camAngle : 0, [0, body.input === 'selector' ? k.selectorY : 0]);
  if (physics.contact.separation(A, B).gap < -tolerance) return false;
  return certify(localA, localB, body, a, b, start, time, A0, A, B0, B, depth + 1)
    && certify(localA, localB, body, a, b, time, end, A, A1, B, B1, depth + 1);
}
let before = at(data.rows[0]);
for (let index = 1; index < data.rows.length; index++) {
  const a = data.rows[index - 1], b = data.rows[index], h = b.time - a.time, after = at(b); assert(h > 0); counts.intervals++;
  for (let i = 0; i < frame.length; i++) {
    const errorA = frame[i].radius * (b.x[2] - a.x[2]) ** 2 / 8, sweptA = union(before.frame[i].box, after.frame[i].box, errorA);
    for (let j = 0; j < bodies.length; j++) {
      const body = bodies[j], errorB = body.input === 'cam' ? body.radius * (2 * Math.PI * h / data.parameters.period) ** 2 / 8
        : body.input === 'selector' ? acceleration * h * h / 8 : 0;
      const broad = gap(sweptA, union(before.bodies[j].box, after.bodies[j].box, errorB)) - roundoff;
      if (broad >= -tolerance) {counts.groupExclusions += body.cells.length; minimumBound = Math.min(minimumBound, broad); continue;}
      for (let k = 0; k < body.cells.length; k++) if (!certify(frame[i], body.cells[k], body, a, b, a.time, b.time,
        before.frame[i], after.frame[i], before.bodies[j].cells[k], after.bodies[j].cells[k])) {
        counts.failedPairs++; if (failures.length < 40) failures.push({index, start: a.time, end: b.time, frameCell: i, body: body.name, bodyCell: k});
      }
    }
  }
  before = after;
  if (index % 5000 === 0) console.log({index, seconds: (performance.now() - started) / 1000, counts});
}
verifyStudySources(sources);
const report = {movement: 84, passed: !counts.failedPairs, productionChanged: false, mechanicsPassed: false, input, tolerance, roundoff, validations,
  counts, minimumBound, maximumDepth, selectorAccelerationBound: acceleration, failures, seconds: (performance.now() - started) / 1000, sources,
  qualification: 'Covers the free frame against the working cam, two pin shanks, fixed axle and two guide passages, using complete rendered prisms or containing footprints. On each saved linear center/angle segment, a fixed separating axis and endpoint projections bound the whole interval; rotation and exact quintic selector departures from their endpoint chords have analytic second-derivative bounds. A failed interval is retained. Other hardware pairs, continuum dynamics error and playback qualification remain separate.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined}); if (!report.passed) process.exitCode = 1;
