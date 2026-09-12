import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics, advanceSpringSectorStep} from './lib/spring-sector-dynamics.mjs';
import {makeSpringSectorFastDynamics} from './lib/spring-sector-fast-dynamics.mjs';
import {convexTranslationInterval} from './lib/spring-sector-contact.mjs';
import {fastConvexTranslationInterval} from './lib/spring-sector-fast-contact.mjs';

const input = process.env.PROBE_INPUT ?? 'artifacts/review/083-event-bdf-full-half-ms.json';
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-fast-contact-parity';
const d = JSON.parse(fs.readFileSync(input)), model = makeSpringSectorCandidate();
const old = makeSpringSectorDynamics(model, d.parameters), fast = makeSpringSectorFastDynamics(model, d.parameters);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const s of d.sources) assert.equal(hash(s.file), s.sha256, s.file);
const files = [...new Set(['scripts/check-spring-sector-fast-contact.mjs', 'scripts/lib/spring-sector-fast-dynamics.mjs',
  'scripts/lib/spring-sector-fast-contact.mjs', input, ...d.sources.map(s => s.file)])];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
// The dynamics factory differs only in which contact implementation it uses.
const originalSource = fs.readFileSync('scripts/lib/spring-sector-dynamics.mjs', 'utf8');
const normalized = fs.readFileSync('scripts/lib/spring-sector-fast-dynamics.mjs', 'utf8')
  .replaceAll('makeSpringSectorFastContact', 'makeSpringSectorContact').replaceAll('spring-sector-fast-contact.mjs', 'spring-sector-contact.mjs')
  .replaceAll('makeSpringSectorFastDynamics', 'makeSpringSectorDynamics');
assert.equal(normalized, originalSource); assert.deepEqual(fast.parameters, old.parameters); assert.deepEqual(fast.initial, old.initial);
assert.deepEqual(fast.contact.cells, old.contact.cells); assert.deepEqual(fast.contact.teeth, old.contact.teeth);
const indices = new Set(Array.from({length: 512}, (_, i) => Math.floor(i * (d.rows.length - 1) / 511)));
for (let i = 1; i < d.rows.length; i++) if (d.rows[i].transition || d.rows[i].contacts.some(c => c.impulse > .02))
  for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < d.rows.length) indices.add(j);
const counts = {constraints: 0, seats: 0, intervals: 0, steps: 0}, timings = {referenceMs: 0, fastMs: 0};
const measure = row => {
  let t = performance.now(); const a = old.constraints(row.x, row.time); timings.referenceMs += performance.now() - t;
  t = performance.now(); const b = fast.constraints(row.x, row.time); timings.fastMs += performance.now() - t;
  assert.deepEqual(b, a); counts.constraints++;
};
for (const index of [...indices].sort((a, b) => a - b)) measure(d.rows[index]);
// Revisit angles in non-monotone order and change every query option while
// reusing caches. Include signed zero and the complete unpruned cell set.
for (const q of [0, -0, -.22, .22, .071, -.22, .071]) for (const theta of [.033189177145424485, 0, -.031, .21]) {
  for (const side of [1, 0]) for (const options of [
    {lower: -.06, upper: .18, derivatives: false},
    {lower: -.06, upper: .18, derivatives: true, contactMargin: 0},
    {lower: -.06, upper: .18, derivatives: true, padding: 0, contactMargin: .02},
    {lower: -.06, upper: .18, derivatives: true, padding: 1e-7},
  ]) {assert.deepEqual(fast.contact.seat(q, theta, side, options), old.contact.seat(q, theta, side, options)); counts.seats++;}
}
for (const q of [-.22, 0, .22]) for (const side of [0, 1]) {
  const options = {lower: -.06, upper: .18, derivatives: true, prune: false};
  assert.deepEqual(fast.contact.seat(q, .031, side, options), old.contact.seat(q, .031, side, options)); counts.seats++;
}
const rz = (v, a) => [Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1], v[2]];
const ry = (v, a) => [Math.cos(a) * v[0] + Math.sin(a) * v[2], v[1], -Math.sin(a) * v[0] + Math.cos(a) * v[2]];
const transform = (cell, rotate, angle, plane = 0) => ({vertices: cell.vertices.map(v => rotate(v, angle).map((x, i) => x + (i === 2 ? plane : 0))),
  normals: cell.normals.map(v => rotate(v, angle)), edges: cell.edges.map(v => rotate(v, angle))});
const teeth = new Map(old.contact.teeth.map(t => [t.name, t.cell]));
for (let i = 0; i < 256; i++) {
  const row = d.rows[Math.max(1, Math.floor(i * (d.rows.length - 1) / 255))], q = old.input(row.time).q;
  for (const c of row.contacts) {
    const match = /^([01]):(\d+):(wheelTooth\d+):/.exec(c.id); if (!match) continue;
    const side = Number(match[1]), cell = Number(match[2]), plane = model.root.userData.geometry.wheelPitchRadius * (side ? -1 : 1);
    const a = transform(old.contact.cells[side][cell], rz, q, plane), b = transform(teeth.get(match[3]), ry, row.x[0]);
    for (const range of [[-.06, .18], [-1, 1], [0, .001], [.16, .18]]) for (const padding of [0, 2e-9, 1e-7]) {
      const options = {range, padding};
      assert.deepEqual(fastConvexTranslationInterval(a, b, rz([0, 1, 0], q), options), convexTranslationInterval(a, b, rz([0, 1, 0], q), options)); counts.intervals++;
    }
  }
}
for (let i = 0; i < 64; i++) {
  const row = d.rows[Math.floor(i * (d.rows.length - 1) / 63)];
  assert.deepEqual(advanceSpringSectorStep(fast, row, .000125), advanceSpringSectorStep(old, row, .000125)); counts.steps++;
}
for (const s of sources) assert.equal(hash(s.file), s.sha256, s.file);
const report = {movement: 83, status: 'exact-contact-kernel-parity', passed: true, productionChanged: false, mechanicsPassed: false,
  input, counts, timings, observedSpeedRatio: timings.referenceMs / timings.fastMs, sources,
  qualification: 'Exact deep equality includes numeric signs, active-feature order, derivatives, limits and pruning counts. Covers stored transitions/impacts, cache revisits, option changes, all-pair scans, raw SAT intervals and complete implicit steps. Factory source differs only in the contact provider. Timings are paired in-process observations, not a controlled system benchmark. Whole-trajectory replay and new motion refinement remain separate.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
