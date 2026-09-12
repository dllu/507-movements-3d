import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics, advanceSpringSectorStep} from './lib/spring-sector-dynamics.mjs';

const options = JSON.parse(process.env.PHYSICS_OPTIONS ?? '{}');
const candidate = makeSpringSectorCandidate(), physics = makeSpringSectorDynamics(candidate, options);
const dt = Number(process.env.PROBE_DT ?? .004), duration = Number(process.env.PROBE_DURATION ?? 8);
const minimumStep = Number(process.env.PROBE_MIN_STEP ?? dt / 128);
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/083-first-spring-dynamics.json';
if (!(dt > 0 && duration > 0 && minimumStep > 0 && minimumStep <= dt)) throw Error('Invalid study domain');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = ['scripts/study-spring-sector-dynamics.mjs', 'scripts/lib/spring-sector-dynamics.mjs', 'scripts/lib/spring-sector-contact.mjs',
  'scripts/lib/spring-sector-mass.mjs', 'scripts/lib/spring-sector-candidate.mjs', 'scripts/lib/spring-sector-linkage.mjs',
  'scripts/lib/spring-sector-source.mjs', 'scripts/lib/spring-rack-coil.mjs', 'scripts/lib/alternating-peg-dynamics-study.mjs',
  'scripts/lib/jointed-tappet-dynamics-study.mjs', 'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
let state = physics.initial, minimumGap = Infinity, maximumResidual = 0, maximumIterations = 0;
const rows = [state], failures = [], rejectedSteps = [], pitch = 2 * Math.PI / candidate.root.userData.geometry.wheelTeeth;
function advance(step) {
  let result;
  try {result = advanceSpringSectorStep(physics, state, step);}
  catch (error) {result = {okay: false, reason: error.message, time: state.time};}
  if (!result.okay) {
    rejectedSteps.push({time: state.time, dt: step, reason: result.reason});
    if (step / 2 < minimumStep) {failures.push(result); return false;}
    return advance(step / 2) && advance(step / 2);
  }
  state = result.state; const d = result.diagnostic;
  minimumGap = Math.min(minimumGap, d.minimumGap); maximumResidual = Math.max(maximumResidual, d.residual);
  maximumIterations = Math.max(maximumIterations, d.iterations); rows.push({...state, dt: step, ...d}); return true;
}
for (let i = 0; i < Math.round(duration / dt); i++) {
  if (!advance(dt)) break;
  if ((i + 1) % 100 === 0) console.log({step: i + 1, time: state.time,
    teeth: (state.x[0] - physics.initial.x[0]) / pitch, lifts: state.x.slice(1), minimumGap, maximumIterations});
}
for (const source of sources) if (hash(source.file) !== source.sha256) throw Error('Study source changed: ' + source.file);
const report = {movement: 83, status: failures.length ? 'finite-spring-dynamics-failed' : 'finite-spring-dynamics-ran',
  productionChanged: false, mechanicsPassed: false, parameters: physics.parameters, rawMass: physics.rawMass,
  dt, duration, minimumStep, rows, failures, rejectedSteps, minimumGap, maximumResidual, maximumIterations, sources,
  qualification: 'Exploratory free wheel angle and two radial sector lifts, with mesh inertia, gravity, ideal massless compression springs and prescribed shaft input. Startup is seated once; subsequent positions come from contact impulses. Contact feature transitions, forces, energy, refinement, complete clearance and final playback remain unqualified.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({output, rows: rows.length, finalTime: state.time, teeth: (state.x[0] - physics.initial.x[0]) / pitch,
  rejectedSteps: rejectedSteps.length, failures: failures.map(f => ({time: f.time, reason: f.reason}))});
if (failures.length) process.exitCode = 1;
