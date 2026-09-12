import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {writeStudyReport} from './lib/write-study-report.mjs';

const inputs = JSON.parse(process.env.PROBE_INPUTS ?? '["artifacts/review/083-fast-bdf-full-quarter-ms.json","artifacts/review/083-fast-bdf-second-quarter-ms.json"]');
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/083-fast-bdf-sixteen-quarter-ms.json';
assert(inputs.length >= 2);
const data = inputs.map(file => JSON.parse(fs.readFileSync(file))), hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const first = data[0], core = row => Object.fromEntries(['time', 'x', 'v', 'active'].map(key => [key, row[key]]));
const joins = [], files = new Set(['scripts/join-spring-sector-bdf-dynamics.mjs', 'scripts/lib/write-study-report.mjs', ...inputs]);
for (const [index, d] of data.entries()) {
  assert.equal(d.failures.length, 0); assert(d.continuousPrimary.passed && d.methods);
  assert.equal(d.continuousPrimary.acceptedIntervals, d.rows.length - 1);
  for (const key of ['parameters', 'rawMass', 'dt', 'eventStep', 'minimumStep']) assert.deepEqual(d[key], first[key], key);
  for (const key of ['tolerance', 'roundoff', 'qualification']) assert.deepEqual(d.continuousPrimary[key], first.continuousPrimary[key], key);
  for (const s of d.sources) {
    assert.equal(hash(s.file), s.sha256, s.file); if (s.archive) assert.equal(hash(s.archive), s.sha256, s.archive);
    files.add(s.file);
  }
  if (!index) continue;
  const before = data[index - 1].rows.at(-1), after = d.rows[0];
  assert.deepEqual(core(after), core(before), 'Continuation must carry the exact position, velocity, time and active contacts');
  assert.equal(d.resumeFile, inputs[index - 1]); assert.equal(d.startIndex, data[index - 1].rows.length - 1);
  joins.push({time: before.time, earlier: inputs[index - 1], continuation: inputs[index], exactCarriedState: true,
    qualification: 'Only numerical multistep history restarts, using the integrator’s bounded startup steps; the physical state is carried unchanged.'});
}
const sources = [...files].map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const rows = data.flatMap((d, i) => i ? d.rows.slice(1) : d.rows), duration = data.reduce((sum, d) => sum + d.duration, 0);
assert(Math.abs(rows.at(-1).time - rows[0].time - duration) < 1e-8);
const totals = {}, methods = {};
for (const d of data) {
  for (const [key, value] of Object.entries(d.continuousPrimary.totals)) totals[key] = (totals[key] ?? 0) + value;
  for (const [key, value] of Object.entries(d.methods)) methods[key] = (methods[key] ?? 0) + value;
}
assert.equal(Object.values(methods).reduce((a, b) => a + b, 0), rows.length - 1);
const minimum = key => Math.min(...data.map(d => d[key])), maximum = key => Math.max(...data.map(d => d[key]));
const report = {movement: 83, status: 'joined-bdf-dynamics', productionChanged: false, mechanicsPassed: false,
  parameters: first.parameters, rawMass: first.rawMass, dt: first.dt, duration, eventStep: first.eventStep, minimumStep: first.minimumStep,
  startIndex: first.startIndex, startTime: rows[0].time, rows, failures: [], rejectedSteps: data.flatMap(d => d.rejectedSteps),
  minimumGap: minimum('minimumGap'), maximumResidual: maximum('maximumResidual'), maximumIterations: maximum('maximumIterations'),
  maximumBdfMomentumResidual: maximum('maximumBdfMomentumResidual'), methods, sources, joins,
  continuousPrimary: {...first.continuousPrimary, acceptedIntervals: rows.length - 1, totals,
    minimumCertifiedGap: Math.min(...data.map(d => d.continuousPrimary.minimumCertifiedGap)),
    minimumBodyPlaneGap: Math.min(...data.map(d => d.continuousPrimary.minimumBodyPlaneGap))},
  qualification: 'Concatenates certified segments only after checking exact carried state, parameters, resume provenance and all source hashes. The duplicate boundary row is omitted; no physical state or interval is changed. Numerical history restarts are explicit. This does not establish long-run time-step agreement, periodicity or production playback.'};
writeStudyReport(output, report);
console.log({output, states: rows.length, duration, joins, acceptedIntervals: report.continuousPrimary.acceptedIntervals});
