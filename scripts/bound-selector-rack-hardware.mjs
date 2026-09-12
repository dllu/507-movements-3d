import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSelectorRackFreeCandidate} from './lib/selector-rack-free-candidate.mjs';
import {makeSelectorRackDynamics} from './lib/selector-rack-dynamics.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
import {polygonClipping as clip, poly} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport, verifyStudySources, freezeStudySources} from './lib/study-report-io.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/084-planar-eighth-ms-pulses.json.gz';
const primaryFile = process.env.PROBE_PRIMARY ?? 'artifacts/review/084-eighth-ms-continuous-contact-exact-transform.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-loaded-hardware-bounds';
const data = readStudyReport(input), primary = readStudyReport(primaryFile), topology = readStudyReport('artifacts/review/084-supported-candidate-surfaces.json');
for (const d of [data, primary, topology]) verifyStudySources(d.sources);
assert.equal(data.failures.length, 0); assert(primary.passed && topology.passed); assert.equal(primary.input, input);
assert.equal(primary.counts.intervals, data.rows.length - 1); assert.equal(topology.topology.length, 17); assert(topology.topology.every(t => t.closed));
const model = makeSelectorRackFreeCandidate(), u = model.root.userData, physics = makeSelectorRackDynamics(model, data.parameters), pad = 1e-7;
const range = [0, 1, 2].map(k => [Math.min(...data.rows.map(r => r.x[k])), Math.max(...data.rows.map(r => r.x[k]))]);
const selector = [data.parameters.neutral, data.parameters.neutral];
for (const p of data.parameters.pulses) {
  assert(p.rise[0] < p.rise[1] && p.rise[1] <= p.fall[0] && p.fall[0] < p.fall[1]);
  const amplitude = p.heightPixels / u.source.scale - data.parameters.neutral;
  selector[0] += Math.min(0, amplitude); selector[1] += Math.max(0, amplitude);
}
const boxes = {}, points = {}, names = Object.keys(u.parts);
for (const name of names) {
  const mesh = u.parts[name], position = mesh.geometry.attributes.position, matrix = mesh.matrixWorld.elements;
  assert.deepEqual(matrix.slice(0, 12), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]); assert.equal(matrix[15], 1);
  const p = Array.from({length: position.count}, (_, i) => [position.getX(i) + matrix[12], position.getY(i) + matrix[13], position.getZ(i) + matrix[14]]);
  points[name] = p;
  const low = [0, 1, 2].map(k => Math.min(...p.map(v => v[k]))), high = [0, 1, 2].map(k => Math.max(...p.map(v => v[k])));
  if (u.families[name] === 'frame') {
    const angle = (range[2][0] + range[2][1]) / 2, half = (range[2][1] - range[2][0]) / 2, c = Math.cos(angle), s = Math.sin(angle);
    const rotated = p.map(v => {const x = v[0] - u.frameCentroid[0], y = v[1] - u.frameCentroid[1], radius = Math.hypot(x, y);
      return {v: [c * x - s * y, s * x + c * y], error: radius * half};});
    for (let k = 0; k < 2; k++) {low[k] = range[k][0] + Math.min(...rotated.map(p => p.v[k] - p.error)); high[k] = range[k][1] + Math.max(...rotated.map(p => p.v[k] + p.error));}
  } else if (u.families[name] === 'cam') {
    const radius = Math.max(...p.map(v => Math.hypot(v[0], v[1]))); low[0] = low[1] = -radius; high[0] = high[1] = radius;
  } else if (u.families[name] === 'selector') {low[1] += selector[0]; high[1] += selector[1];}
  boxes[name] = {low, high};
}
const prisms = new Map(), prism = name => {
  if (!prisms.has(name)) {assert(points[name].every(p => p.every(Number.isFinite))); const mesh = u.parts[name]; assert(mesh.position.length() === 0);
    prisms.set(name, renderedPrism(mesh.geometry));}
  return prisms.get(name);
};
const cross = (a, b) => a[0] * b[1] - a[1] * b[0], sub = (a, b) => a.map((v, k) => v - b[k]);
function minimumRadius(triangle) {
  if (triangle.every((a, i) => cross(sub(triangle[(i + 1) % 3], a), a.map(v => -v)) >= 0)) return 0;
  return Math.min(...triangle.map((a, i) => {const d = sub(triangle[(i + 1) % 3], a), f = Math.max(0, Math.min(1, -(a[0] * d[0] + a[1] * d[1]) / (d[0] ** 2 + d[1] ** 2)));
    return Math.hypot(a[0] + f * d[0], a[1] + f * d[1]);}));
}
const camNames = ['singleWorkingCam', 'camHub', 'fullCurvedSpokeWheel', 'wheelHub'], boreProof = {};
const shaftRadius = Math.max(...points.fixedCamAxle.map(p => Math.hypot(p[0], p[1])));
for (const name of camNames) {
  const p = prism(name), radius = Math.min(...p.triangles.map(t => minimumRadius(t.points)));
  assert(radius - shaftRadius > pad); boreProof[name] = {minimumRadius: radius, shaftRadius, margin: radius - shaftRadius - pad, validation: p.validation};
}
const capUnion = name => clip.union(...prism(name).triangles.map(t => poly(t.points)));
const camFootprint = capUnion('singleWorkingCam'), containment = {};
for (const name of ['camHub', 'wheelHub']) {
  const remainder = clip.difference(capUnion(name), camFootprint); assert.equal(remainder.length, 0);
  containment[name] = {method: 'empty difference of actual rendered cap unions', remainder};
}
const primaryNames = new Set(['singleWorkingCam', 'suspensionPin0', 'suspensionPin1', 'fixedCamAxle', 'rackGuide0', 'rackGuide1']);
const pairs = [], unresolved = [];
for (const [i, a] of names.entries()) for (const b of names.slice(i + 1)) {
  if (u.families[a] === u.families[b]) continue;
  const A = boxes[a], B = boxes[b], gaps = [0, 1, 2].map(k => Math.max(A.low[k] - B.high[k], B.low[k] - A.high[k])), largest = Math.max(...gaps), pair = {a, b};
  if (largest > pad) pairs.push({...pair, method: 'whole-motion axis bounds', axis: gaps.indexOf(largest), margin: largest - pad});
  else if (a === 'slottedRackFrame' && primaryNames.has(b)) pairs.push({...pair, method: 'continuous primary contact', source: primaryFile, tolerance: primary.tolerance});
  else if (a === 'slottedRackFrame' && containment[b]) pairs.push({...pair, method: 'contained in working-cam footprint', source: primaryFile, tolerance: primary.tolerance});
  else if (b === 'fixedCamAxle' && boreProof[a]) pairs.push({...pair, method: 'rotation-invariant bore radius', ...boreProof[a]});
  else unresolved.push(pair);
}
const sources = freezeStudySources([input, primaryFile, 'artifacts/review/084-supported-candidate-surfaces.json', 'scripts/bound-selector-rack-hardware.mjs',
  'scripts/lib/crossed-rack-mesh-prisms.mjs', ...data.sources.map(s => s.file)], prefix);
const report = {movement: 84, passed: !unresolved.length && pairs.length === 99, productionChanged: false, mechanicsPassed: false, input, primaryFile,
  range, selector, pad, boxes, pairs, unresolved, containment, sources,
  qualification: 'Every independently moving mesh pair is covered through the saved linear frame trajectory and exact prescribed inputs. Global boxes include all translation/angle extrema and every cam angle; fixed separating planes, verified complete bores, actual cap containment or the continuous primary contact certificate cover all pairs. This does not yet qualify a compressed playback or continuation beyond the saved trajectory.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({passed: report.passed, pairs: pairs.length, methods: pairs.reduce((m, p) => (m[p.method] = (m[p.method] ?? 0) + 1, m), {}), unresolved, range, selector});
if (!report.passed) process.exitCode = 1;
