import fs from 'node:fs';
import crypto from 'node:crypto';
import {writeStudyReport} from './lib/write-study-report.mjs';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetDynamics, advanceTreadleRatchetStep} from './lib/treadle-ratchet-dynamics.mjs';
const resumeFile = process.env.PROBE_RESUME;
const resume = resumeFile ? JSON.parse(fs.readFileSync(resumeFile)) : null;
const options = {...(resume?.parameters ?? {}), ...JSON.parse(process.env.PHYSICS_OPTIONS ?? '{}')};
const geometry = JSON.parse(process.env.GEOMETRY_OPTIONS ?? JSON.stringify(resume?.geometry ?? {}));
const candidate = makeTreadleRatchetCandidate(geometry), physics = makeTreadleRatchetDynamics(candidate, options);
const dt = Number(process.env.PROBE_DT ?? .002), duration = Number(process.env.PROBE_DURATION ?? 8);
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-gravity-dynamics.json';
if (!(dt > 0 && duration > 0)) throw Error('Invalid study duration or time step');
const files = ['scripts/study-treadle-ratchet-dynamics.mjs', 'scripts/lib/write-study-report.mjs', 'scripts/lib/treadle-ratchet-dynamics.mjs',
  'scripts/lib/treadle-ratchet-contact.mjs', 'scripts/lib/treadle-ratchet-input.mjs',
  'scripts/lib/treadle-ratchet-candidate.mjs', 'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs',
  'src/simulation/finite-polygon-contact.js', 'src/simulation/finite-plate-geometry.js',
  'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs', ...(resumeFile ? [resumeFile] : [])];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt';
  fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
let state = resume ? Object.fromEntries(['time', 'x', 'v', 'active'].map(key => [key, resume.rows.at(-1)[key]])) : physics.initial;
let minimumGap = Infinity, maximumResidual = 0, maximumIterations = 0;
const startTime = state.time, startTheta = state.x[0], minimumStep = Number(process.env.PROBE_MIN_STEP ?? dt);
const rows = [state], failures = [], rejectedSteps = [], pitch = 2 * Math.PI / 26;
function advance(step) {
  const result = advanceTreadleRatchetStep(physics, state, step);
  if (!result.okay) {
    rejectedSteps.push({time: state.time, dt: step, reason: result.reason});
    if (step / 2 < minimumStep) {failures.push(result); return false;}
    return advance(step / 2) && advance(step / 2);
  }
  state = result.state; const d = result.diagnostic;
  minimumGap = Math.min(minimumGap, d.minimumGap);
  maximumResidual = Math.max(maximumResidual, d.residual);
  maximumIterations = Math.max(maximumIterations, d.iterations);
  rows.push({...state, dt: step, ...d});
  return true;
}
for (let i = 0; i < Math.round(duration / dt); i++) {
  if (!advance(dt)) break;
  if ((i + 1) % 250 === 0) console.log({step: i + 1, time: state.time,
    teeth: (state.x[0] - physics.initial.x[0]) / pitch, pawls: state.x.slice(1), minimumGap, maximumIterations});
}
const report = {movement: 82, status: failures.length ? 'finite-dynamics-study-failed' : 'finite-dynamics-study-ran',
  productionChanged: false, mechanicsPassed: false, geometry: candidate.root.userData.geometry.options, parameters: physics.parameters,
  dt, duration, startTime, minimumStep, resumeFile, minimumGap, maximumResidual, maximumIterations, rows, failures, rejectedSteps, sources,
  qualification: 'Exploratory wheel and two free pawl angles with common-density gravity, moving-hinge inertia, damping and optional explicit ideal hinge preload. No framewise pawl seating. Complete solid clearance, physical reactions, energy, convergence and source alignment remain unverified.'};
writeStudyReport(output, report);
console.log({output, rows: rows.length, failures: failures.map(f => ({reason: f.reason, time: f.time})),
  finalTeeth: (state.x[0] - physics.initial.x[0]) / pitch, additionalTeeth: (state.x[0] - startTheta) / pitch,
  rejectedSteps: rejectedSteps.length});
if (failures.length) process.exitCode = 1;
