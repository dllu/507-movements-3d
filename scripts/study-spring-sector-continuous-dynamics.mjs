import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics, advanceSpringSectorStep} from './lib/spring-sector-dynamics.mjs';
import {makeSpringSectorSweep} from './lib/spring-sector-sweep.mjs';
import {writeStudyReport} from './lib/write-study-report.mjs';

const resumeFile = process.env.PROBE_RESUME, resume = resumeFile ? JSON.parse(fs.readFileSync(resumeFile)) : null;
const startIndex = Number(process.env.PROBE_START_INDEX ?? (resume ? resume.rows.length - 1 : 0));
if (resume) assert(Number.isInteger(startIndex) && startIndex >= 0 && startIndex < resume.rows.length);
// The default initial phase is the statically balanced seat measured in
// 083-static-initial-equilibrium.json at this input amplitude and geometry.
const options = {...(resume?.parameters ?? {period: 8, theta: .033189177145424485}), ...JSON.parse(process.env.PHYSICS_OPTIONS ?? '{}')};
const model = makeSpringSectorCandidate(), physics = makeSpringSectorDynamics(model, options), sweep = makeSpringSectorSweep(model, physics.parameters);
const dt = Number(process.env.PROBE_DT ?? .001), duration = Number(process.env.PROBE_DURATION ?? 8);
const minimumStep = Number(process.env.PROBE_MIN_STEP ?? dt / 8192);
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/083-continuous-start-dynamics.json';
assert([dt, duration, minimumStep].every(Number.isFinite) && dt > 0 && duration > 0 && minimumStep > 0 && minimumStep <= dt);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (resume) for (const source of resume.sources) assert.equal(hash(source.file), source.sha256, source.file);
const files = ['scripts/study-spring-sector-continuous-dynamics.mjs', 'scripts/lib/spring-sector-sweep.mjs', 'scripts/lib/write-study-report.mjs',
  'scripts/lib/spring-sector-dynamics.mjs', 'scripts/lib/spring-sector-contact.mjs', 'scripts/lib/spring-sector-mass.mjs',
  'scripts/lib/spring-sector-candidate.mjs', 'scripts/lib/spring-sector-linkage.mjs', 'scripts/lib/spring-sector-source.mjs',
  'scripts/lib/spring-rack-coil.mjs', 'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs',
  'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js', ...(resumeFile ? [resumeFile] : [])];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
let state = resume ? Object.fromEntries(['time', 'x', 'v', 'active'].map(key => [key, resume.rows[startIndex][key]])) : physics.initial;
const initial = state, rows = [state], rejectedSteps = [], failures = [];
const totals = {pairs: 0, heightExcluded: 0, boxExcluded: 0, axisCertificates: 0, subdivisions: 0};
let minimumGap = Infinity, minimumCertifiedGap = Infinity, minimumBodyPlaneGap = Infinity, maximumIterations = 0, maximumResidual = 0;
const advance = step => {
  let result, continuous;
  try {
    result = advanceSpringSectorStep(physics, state, step);
    if (result.okay) {
      continuous = sweep.checkStep(state, result.state);
      if (!continuous.passed) result = {okay: false, reason: 'continuous-primary-clearance', failure: continuous.failure};
    }
  } catch (error) {result = {okay: false, reason: error.message};}
  if (!result.okay) {
    const rejected = {time: state.time, dt: step, ...result}; rejectedSteps.push(rejected);
    if (step / 2 < minimumStep) {failures.push(rejected); return false;}
    // Discard the unsuccessful trial and integrate both halves from their
    // carried states. Never reseat a pawl or overwrite a accepted position.
    return advance(step / 2) && advance(step / 2);
  }
  state = result.state;
  const d = result.diagnostic;
  for (const key of Object.keys(totals)) totals[key] += continuous.stats[key];
  minimumGap = Math.min(minimumGap, d.minimumGap); maximumIterations = Math.max(maximumIterations, d.iterations);
  maximumResidual = Math.max(maximumResidual, d.residual);
  minimumCertifiedGap = Math.min(minimumCertifiedGap, continuous.stats.minimumCertifiedGap);
  minimumBodyPlaneGap = Math.min(minimumBodyPlaneGap, continuous.stats.minimumBodyPlaneGap);
  rows.push({...state, dt: step, ...d}); return true;
};
const steps = Math.round(duration / dt); assert(Math.abs(steps * dt - duration) < 1e-10);
for (let i = 0; i < steps; i++) {
  if (!advance(dt)) break;
  if ((i + 1) % 100 === 0) console.log({baseStep: i + 1, time: state.time, rows: rows.length,
    rejectedSteps: rejectedSteps.length, minimumCertifiedGap, minimumBodyPlaneGap});
}
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: failures.length ? 'finite-spring-dynamics-failed' : 'finite-spring-dynamics-ran',
  productionChanged: false, mechanicsPassed: false, parameters: physics.parameters, rawMass: physics.rawMass,
  dt, duration, minimumStep, resumeFile, startIndex, startTime: initial.time, rows, failures, rejectedSteps,
  minimumGap, maximumResidual, maximumIterations, sources,
  continuousPrimary: {passed: failures.length === 0, tolerance: sweep.tolerance, roundoff: sweep.roundoff, acceptedIntervals: rows.length - 1,
    totals, minimumCertifiedGap, minimumBodyPlaneGap, qualification: sweep.qualification},
  qualification: 'The unchanged implicit contact equations are integrated with step rejection when an analytic continuous primary-solid bound fails. Failed trials are discarded and both half steps are integrated; no state is geometrically reseated. Other hardware, spring self-contact, time-step accuracy, forces and energy remain separate qualifications.'};
writeStudyReport(output, report);
console.log({output, rows: rows.length, finalTime: state.time, rejectedSteps: rejectedSteps.length, failures: failures.length,
  minimumCertifiedGap, teethAdvanced: (state.x[0] - initial.x[0]) / (2 * Math.PI / model.root.userData.geometry.wheelTeeth)});
if (failures.length) process.exitCode = 1;
