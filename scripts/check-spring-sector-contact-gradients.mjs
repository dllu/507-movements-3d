import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorContact} from './lib/spring-sector-contact.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-first-contact-gradients';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const oldFile = 'artifacts/review/083-guided-candidate-checkpoint-source-2.txt';
const oldCode = fs.readFileSync(oldFile, 'utf8').replace('../../tests/helpers/solid-surface.mjs',
  pathToFileURL(process.cwd() + '/tests/helpers/solid-surface.mjs').href);
const {makeSpringSectorContact: makePrevious} = await import('data:text/javascript,' + encodeURIComponent(oldCode));
const model = makeSpringSectorCandidate(), contact = makeSpringSectorContact(model), previous = makePrevious(model), rows = [];
const pitch = 2 * Math.PI / model.root.userData.geometry.wheelTeeth, options = {lower: -.06, upper: .18};
const sources = ['scripts/check-spring-sector-contact-gradients.mjs', 'scripts/lib/spring-sector-contact.mjs',
  'scripts/lib/spring-sector-candidate.mjs', 'scripts/lib/spring-sector-source.mjs', 'scripts/lib/spring-sector-linkage.mjs',
  'scripts/lib/spring-rack-coil.mjs', 'tests/helpers/solid-surface.mjs', oldFile].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
let maximumError = 0;
for (let i = 0; i < 64; i++) for (let side = 0; side < 2; side++) {
  const q = -.215 + .43 * ((i * .6180339887498949 + .137) % 1);
  const theta = pitch * ((i * .4142135623730951 + .239) % 1), h = 1e-6;
  const state = contact.seat(q, theta, side, {...options, derivatives: true});
  const active = state.active.find(r => r.cell === state.contact.cell && r.tooth === state.contact.tooth);
  assert(active);
  const numeric = {shaft: (contact.seat(q + h, theta, side, options).lift - contact.seat(q - h, theta, side, options).lift) / (2 * h),
    wheel: (contact.seat(q, theta + h, side, options).lift - contact.seat(q, theta - h, side, options).lift) / (2 * h)};
  const errors = Object.fromEntries(['shaft', 'wheel'].map(key => [key, Math.abs(active.gradient[key] - numeric[key])]));
  maximumError = Math.max(maximumError, ...Object.values(errors));
  const before = previous.seat(q, theta, side, options);
  assert.equal(state.lift, before.lift); assert.equal(state.bodyPlaneGap, before.bodyPlaneGap);
  assert.equal(state.checked, before.checked); assert.equal(state.excluded, before.excluded);
  rows.push({q, theta, side, cell: active.cell, tooth: active.tooth, axis: active.limiting.axis,
    analytic: active.gradient, numeric, errors, lift: state.lift});
}
assert(maximumError < 2e-6, 'Contact derivative mismatch');
const timing = {};
for (const [name, c] of [['previous', previous], ['current', contact]]) {
  const start = performance.now();
  for (const row of rows) c.seat(row.q, row.theta, row.side, options);
  timing[name] = performance.now() - start;
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: 'finite-contact-gradient-check', passed: true, productionChanged: false, mechanicsPassed: false,
  rows, samples: rows.length, derivativeChecks: 2 * rows.length, maximumError, previousGeometryResultsExactlyMatched: rows.length,
  timingMilliseconds: timing, speedup: timing.previous / timing.current, sources,
  qualification: 'Analytic derivatives of selected finite SAT translation-exit features, checked against central differences at 128 nonuniform geometry poses. No feature-switch, normal-cone, force or dynamics qualification is claimed. Early vertical culling preserves all tested prior lifts, body bounds and pair counts exactly; local timings are diagnostic.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, rows: undefined, sources: undefined});
