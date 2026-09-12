import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSelectorRackFreeCandidate} from './lib/selector-rack-free-candidate.mjs';
import {makeSelectorRackDynamics, advanceSelectorRackStep} from './lib/selector-rack-dynamics.mjs';
import {freezeStudySources, writeGzipStudyReport} from './lib/study-report-io.mjs';

const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/084-first-planar-dynamics.json.gz';
const dt = Number(process.env.PROBE_DT ?? .001), duration = Number(process.env.PROBE_DURATION ?? 5.5);
const minimumStep = Number(process.env.PROBE_MIN_STEP ?? 1e-7), options = JSON.parse(process.env.PHYSICS_OPTIONS ?? '{}');
assert(dt > 0 && duration > 0 && minimumStep > 0 && minimumStep <= dt);
const model = makeSelectorRackFreeCandidate(), physics = makeSelectorRackDynamics(model, options), u = model.root.userData;
const files = ['scripts/study-selector-rack-dynamics.mjs', 'scripts/lib/selector-rack-dynamics.mjs', 'scripts/lib/selector-rack-planar-contact.mjs',
  'scripts/lib/selector-rack-free-candidate.mjs', 'scripts/lib/selector-rack-candidate.mjs', 'scripts/lib/selector-rack-contact.mjs',
  'scripts/lib/selector-rack-source.mjs', 'scripts/lib/conforming-plate-mesh.mjs', 'scripts/lib/study-report-io.mjs',
  'scripts/lib/jointed-tappet-dynamics-study.mjs', 'scripts/lib/finite-plate-study.mjs', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js', 'tests/helpers/solid-surface.mjs'];
const sources = freezeStudySources(files, output.replace(/\.json\.gz$/, ''));
const rows = [{...physics.initial}], rejected = [], failures = [];
const vertexRadius = Math.max(...physics.contact.frame.flatMap(c => c.points.map(p => Math.hypot(...p))));
const start = performance.now(); let state = physics.initial, maximumVertexIncrementPixels = 0;
function advance(h, depth = 0) {
  const result = advanceSelectorRackStep(physics, state, h);
  const step = result.okay ? Math.hypot(result.state.x[0] - state.x[0], result.state.x[1] - state.x[1])
    + vertexRadius * Math.abs(result.state.x[2] - state.x[2]) : Infinity;
  if (!result.okay || step * u.source.scale > .25) {
    rejected.push({time: state.time, dt: h, depth, reason: result.okay ? 'large-vertex-increment' : result.reason, stepPixels: Number.isFinite(step) ? step * u.source.scale : null});
    if (h / 2 < minimumStep) {failures.push({time: state.time, dt: h, result}); return false;}
    return advance(h / 2, depth + 1) && advance(h / 2, depth + 1);
  }
  maximumVertexIncrementPixels = Math.max(maximumVertexIncrementPixels, step * u.source.scale);
  state = result.state; rows.push({...state, dt: h, ...result.diagnostic}); return true;
}
for (let i = 0; i < Math.ceil(duration / dt); i++) {
  const h = Math.min(dt, duration - state.time); if (h <= 1e-12) break;
  if (!advance(h)) break;
  if (i % 500 === 0) console.log({baseStep: i, time: state.time, rows: rows.length, seconds: (performance.now() - start) / 1000});
}
const report = {movement: 84, status: 'free-planar-rack-contact-dynamics-study', productionChanged: false, mechanicsPassed: false,
  candidateIntegrated: false, dt, duration, minimumStep, parameters: physics.parameters, rows, rejected, failures,
  vertexRadius, maximumVertexIncrementPixels, seconds: (performance.now() - start) / 1000, sources,
  qualification: 'Gravity, viscous drag, inertia and finite polygon contact determine all three planar rack coordinates. The only input motion is cam rotation and smooth governor pulses. Accepted endpoints solve backward-Euler momentum and nonpenetration. Increment subdivision limits saved motion but is not a continuous collision certificate or time-step error estimate. Contact-force geometry, energy, full hardware clearance and production playback remain unqualified.'};
const serialization = await writeGzipStudyReport(output, report);
console.log({states: rows.length, end: state.time, failures: failures.length, rejected: rejected.length, maximumVertexIncrementPixels, seconds: report.seconds, serialization});
if (failures.length) process.exitCode = 1;
