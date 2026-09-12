import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorContact} from './lib/spring-sector-contact.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/083-variable-bdf-full-eighth-ms.json';
const hardwareFile = 'artifacts/review/083-hardware-verified-travel-bounds.json';
const coilFile = 'artifacts/review/083-coil-verified-travel-bounds.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-variable-bdf-complete-candidate-clearance';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const data = read(input), hardware = read(hardwareFile), coils = read(coilFile);
for (const report of [data, hardware, coils]) for (const source of report.sources) {
  assert.equal(hash(source.file), source.sha256, source.file);
  if (source.archive) assert.equal(hash(source.archive), source.sha256, source.archive);
}
assert.equal(data.failures.length, 0); assert(data.continuousPrimary.passed);
assert(hardware.passed); assert(coils.passed);
assert(data.parameters.amplitude >= 0 && data.parameters.amplitude <= hardware.domain.amplitude);
assert.deepEqual(data.parameters.guideLimits, hardware.domain.liftRange);
const model = makeSpringSectorCandidate(), u = model.root.userData, contact = makeSpringSectorContact(model);
const expected = new Set(), names = Object.keys(u.parts), pairKey = pair => [...pair].sort().join('/');
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
  if (u.families[names[i]] !== u.families[names[j]]) expected.add(pairKey([names[i], names[j]]));
const actual = [...hardware.pairs.map(p => p.pair), ...hardware.primaryPairs].map(pairKey);
assert.equal(new Set(actual).size, actual.length);
assert.deepEqual(new Set(actual), expected);
const crown = new Set(contact.teeth.map(t => t.name));
// The SAT contact helper names its tooth cells separately; compare the count
// and actual mesh family below, without relying on tooth order.
assert.equal(crown.size, contact.teeth.length);
const planeMeshes = [], toothPairs = [];
for (const pair of hardware.primaryPairs) {
  const wheel = pair.find(name => u.families[name] === 'wheel');
  assert(wheel); assert(pair.some(name => /^(front|rear)Sector$/.test(name)));
  if (/^wheelTooth\d+$/.test(wheel)) toothPairs.push(pair);
  else planeMeshes.push(wheel);
}
assert.equal(toothPairs.length, contact.teeth.length * 2);
assert.deepEqual([...new Set(planeMeshes)].sort(), ['outputAxle', 'wheelBody', 'wheelHub']);
let maximumPlaneMeshY = -Infinity;
for (const name of new Set(planeMeshes)) {
  const mesh = u.parts[name];
  for (const triangle of surfaceTriangles(mesh.geometry)) for (const vertex of [triangle.a, triangle.b, triangle.c])
    maximumPlaneMeshY = Math.max(maximumPlaneMeshY, vertex.applyMatrix4(mesh.matrixWorld).y);
}
const planeRounding = maximumPlaneMeshY - u.geometry.wheelTop;
const bodyMargin = data.continuousPrimary.minimumBodyPlaneGap - Math.max(0, planeRounding);
assert(bodyMargin >= -hardware.tolerance);
let positionResidual = 0;
const liftRanges = [[Infinity, -Infinity], [Infinity, -Infinity]];
for (let i = 0; i < data.rows.length; i++) {
  const row = data.rows[i]; assert(Number.isFinite(row.time));
  assert.equal(row.x.length, 3); assert(row.x.every(Number.isFinite));
  for (let side = 0; side < 2; side++) {
    const lift = row.x[side + 1];
    assert(lift >= hardware.domain.liftRange[0] && lift <= hardware.domain.liftRange[1]);
    liftRanges[side] = [Math.min(liftRanges[side][0], lift), Math.max(liftRanges[side][1], lift)];
  }
  if (i) {
    const previous = data.rows[i - 1], dt = row.time - previous.time; assert(dt > 0);
    assert.equal(row.v.length, 3); assert(row.v.every(Number.isFinite));
    assert(['backward-euler', 'variable-bdf2'].includes(row.method));
    const bdf = row.method === 'variable-bdf2', earlier = data.rows[i - 2];
    if (bdf) {
      assert(earlier); assert(previous.time > earlier.time);
      assert(dt / (previous.time - earlier.time) <= 2 + 1e-8);
      assert.deepEqual([...row.active].sort(), [...previous.active].sort());
      assert.deepEqual([...previous.active].sort(), [...earlier.active].sort());
    }
    const ratio = bdf ? dt / (previous.time - earlier.time) : 1;
    const factor = bdf ? ratio * ratio / (1 + 2 * ratio) : 0;
    const history = previous.x.map((x, axis) => bdf ? x + (x - earlier.x[axis]) * factor : x);
    const scale = bdf ? dt * (1 + ratio) / (1 + 2 * ratio) : dt;
    if (bdf) {
      assert(Math.abs(row.historyFactor - factor) < 1e-8);
      assert(Math.abs(row.forceWeight - scale) < 2e-12);
    }
    positionResidual = Math.max(positionResidual, ...row.x.map((x, axis) => Math.abs(x - history[axis] - scale * row.v[axis])));
  }
}
assert(positionResidual <= 1e-12);
const primary = data.continuousPrimary, totals = primary.totals, intervals = data.rows.length - 1;
assert.equal(primary.acceptedIntervals, intervals);
assert.equal(totals.pairs, intervals * contact.cells.reduce((n, cells) => n + cells.length, 0) * contact.teeth.length);
assert.equal(totals.heightExcluded + totals.boxExcluded + totals.axisCertificates, totals.pairs + totals.subdivisions);
assert(primary.minimumCertifiedGap >= -primary.tolerance);
const files = [input, hardwareFile, coilFile, 'scripts/check-spring-sector-variable-bdf-clearance.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'bdf-complete-candidate-continuous-clearance', passed: true,
  productionChanged: false, mechanicsPassed: false, candidateIntegrated: false, tolerance: hardware.tolerance,
  meshes: names.length, distinctFamilyPairs: expected.size, secondaryPairs: hardware.pairs.length,
  crownPairs: toothPairs.length, bodyPlanePairs: planeMeshes.length, springSelfClearance: coils.passed,
  states: data.rows.length, intervals, duration: data.rows.at(-1).time - data.rows[0].time, dt: data.dt,
  liftRanges, positionResidual, primaryMinimumGap: primary.minimumCertifiedGap,
  hardwareMinimumMargin: hardware.minimumMargin, planeRounding, bodyMargin, sources,
  qualification: 'Combined certificates cover every distinct-family pair and all four wire self-surfaces of this candidate through the entire piecewise-linear free-coordinate path with exact prescribed shaft motion. Source hashes, exhaustive pair accounting and travel containment are checked. Position recurrence uses each recorded method, including nonuniform BDF2 history and velocity weights reconstructed from the actual time stamps. This does not establish time-step accuracy, loads, material stress, missing supports, periodic playback or final visual fidelity.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
