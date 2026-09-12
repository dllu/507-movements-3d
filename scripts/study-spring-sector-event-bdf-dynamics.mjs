import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics} from './lib/spring-sector-dynamics.mjs';
import {makeSpringSectorSweep} from './lib/spring-sector-sweep.mjs';
import {makeSpringSectorEventBdfIntegrator} from './lib/spring-sector-event-bdf-integrator.mjs';
import {writeStudyReport} from './lib/write-study-report.mjs';

const resumeFile = process.env.PROBE_RESUME, resume = resumeFile ? JSON.parse(fs.readFileSync(resumeFile)) : null;
const startIndex = Number(process.env.PROBE_START_INDEX ?? (resume ? resume.rows.length - 1 : 0));
if (resume) assert(Number.isInteger(startIndex) && startIndex >= 0 && startIndex < resume.rows.length);
const options = {...(resume?.parameters ?? {period: 8, theta: .033189177145424485}), ...JSON.parse(process.env.PHYSICS_OPTIONS ?? '{}')};
const model = makeSpringSectorCandidate(), physics = makeSpringSectorDynamics(model, options);
const sweep = makeSpringSectorSweep(model, physics.parameters);
const dt = Number(process.env.PROBE_DT ?? .001), duration = Number(process.env.PROBE_DURATION ?? 4);
const eventStep = Number(process.env.PROBE_EVENT_STEP ?? 1e-6), minimumStep = Number(process.env.PROBE_MIN_STEP ?? eventStep / 128);
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/083-event-bdf-first-half-cycle.json';
assert([dt, duration, eventStep, minimumStep].every(Number.isFinite) && dt > 0 && duration > 0
  && minimumStep > 0 && minimumStep <= eventStep && eventStep <= dt);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (resume) for (const source of resume.sources) assert.equal(hash(source.file), source.sha256, source.file);
const files = ['scripts/study-spring-sector-event-bdf-dynamics.mjs', 'scripts/lib/spring-sector-bdf-step.mjs',
  'scripts/lib/spring-sector-event-bdf-integrator.mjs', 'scripts/lib/spring-sector-sweep.mjs', 'scripts/lib/write-study-report.mjs',
  'scripts/lib/spring-sector-dynamics.mjs', 'scripts/lib/spring-sector-contact.mjs', 'scripts/lib/spring-sector-mass.mjs',
  'scripts/lib/spring-sector-candidate.mjs', 'scripts/lib/spring-sector-linkage.mjs', 'scripts/lib/spring-sector-source.mjs',
  'scripts/lib/spring-rack-coil.mjs', 'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs',
  'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js', ...(resumeFile ? [resumeFile] : [])];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const initial = resume ? Object.fromEntries(['time', 'x', 'v', 'active'].map(key => [key, resume.rows[startIndex][key]])) : physics.initial;
const integration = makeSpringSectorEventBdfIntegrator(physics, initial, {eventStep, minimumStep, checkStep: sweep.checkStep});
const steps = Math.round(duration / dt); assert(Math.abs(steps * dt - duration) < 1e-10);
const started = performance.now();
for (let i = 0; i < steps; i++) {
  if (!integration.advance(dt)) break;
  if ((i + 1) % 100 === 0) console.log({baseStep: i + 1, time: integration.rows.at(-1).time,
    rows: integration.rows.length, rejectedTrials: integration.rejectedSteps.length, seconds: (performance.now() - started) / 1000});
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const totals = {pairs: 0, heightExcluded: 0, boxExcluded: 0, axisCertificates: 0, subdivisions: 0};
let minimumCertifiedGap = Infinity, minimumBodyPlaneGap = Infinity, minimumGap = Infinity, maximumResidual = 0;
let maximumIterations = 0, maximumBdfMomentumResidual = 0;
const methods = {}, rows = integration.rows;
for (const row of rows.slice(1)) {
  const stats = row.continuous.stats;
  for (const key of Object.keys(totals)) totals[key] += stats[key];
  minimumCertifiedGap = Math.min(minimumCertifiedGap, stats.minimumCertifiedGap);
  minimumBodyPlaneGap = Math.min(minimumBodyPlaneGap, stats.minimumBodyPlaneGap);
  minimumGap = Math.min(minimumGap, row.minimumGap); maximumResidual = Math.max(maximumResidual, row.residual);
  maximumIterations = Math.max(maximumIterations, row.iterations);
  maximumBdfMomentumResidual = Math.max(maximumBdfMomentumResidual, row.momentumResidual ?? 0);
  methods[row.method] = (methods[row.method] ?? 0) + 1;
  delete row.continuous;
}
const report = {movement: 83, status: integration.failures.length ? 'bdf-experiment-failed' : 'bdf-experiment-ran',
  productionChanged: false, mechanicsPassed: false, parameters: physics.parameters, rawMass: physics.rawMass,
  dt, duration, eventStep, minimumStep, resumeFile, startIndex, startTime: initial.time, rows,
  failures: integration.failures, rejectedSteps: integration.rejectedSteps, minimumGap, maximumResidual, maximumIterations,
  maximumBdfMomentumResidual, methods, sources, seconds: (performance.now() - started) / 1000,
  continuousPrimary: {passed: integration.failures.length === 0, tolerance: sweep.tolerance, roundoff: sweep.roundoff,
    acceptedIntervals: rows.length - 1, totals, minimumCertifiedGap, minimumBodyPlaneGap, qualification: sweep.qualification},
  qualification: 'Isolated BDF2 experiment on smooth contact branches. Active-contact transitions are resolved with the original backward-Euler solve at eventStep or smaller, and two stable small intervals resolve post-impact velocity before a larger step is allowed. Startup receives the same treatment. Every accepted segment has the unchanged continuous primary-solid certificate. Recorded BDF impulses satisfy the BDF momentum equation; the backward-Euler energy and increment audits cannot be reused. Motion accuracy, full spatial reactions, energy, supports and final playback are not established.'};
writeStudyReport(output, report);
console.log({output, rows: rows.length, finalTime: rows.at(-1).time, failures: report.failures.length,
  rejectedTrials: report.rejectedSteps.length, methods, minimumCertifiedGap, maximumBdfMomentumResidual, seconds: report.seconds});
if (report.failures.length) process.exitCode = 1;
