import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics, advanceSpringSectorStep} from './lib/spring-sector-dynamics.mjs';
import {solveContactProjection} from './lib/jointed-tappet-dynamics-study.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-static-initial-seat';
const model = makeSpringSectorCandidate(), physics = makeSpringSectorDynamics(model, {period: 8});
const q = physics.input(0).q, p = physics.parameters, pitch = 2 * Math.PI / model.root.userData.geometry.wheelTeeth;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evaluate = theta => {
  const lifts = [0, 1].map(side => physics.contact.seat(q, theta, side, {lower: -.06, upper: .18}).lift);
  const energy = lifts.reduce((sum, s, side) => {const m = p.mass[side + 1];
    return sum + p.gravity * (Math.sin(q) * m.first[0] + Math.cos(q) * (m.first[1] + m.m * s))
      + p.stiffness[side] * (s - p.freeLift[side]) ** 2 / 2;
  }, 0);
  return {theta, lifts, energy};
};
const grid = Array.from({length: 257}, (_, i) => evaluate(i / 256 * pitch)), minima = [];
for (let i = 0; i < 256; i++) if (grid[i].energy <= grid[(i + 255) % 256].energy && grid[i].energy <= grid[(i + 1) % 256].energy) {
  let low = (i - 1) / 256 * pitch, high = (i + 1) / 256 * pitch;
  const r = (Math.sqrt(5) - 1) / 2;
  let a = evaluate(high - r * (high - low)), b = evaluate(low + r * (high - low));
  for (let j = 0; j < 64; j++) {
    if (a.energy < b.energy) {high = b.theta; b = a; a = evaluate(high - r * (high - low));}
    else {low = a.theta; a = b; b = evaluate(low + r * (high - low));}
  }
  const state = evaluate((low + high) / 2), epsilon = 1e-7;
  const leftSlope = (state.energy - evaluate(state.theta - epsilon).energy) / epsilon;
  const rightSlope = (evaluate(state.theta + epsilon).energy - state.energy) / epsilon;
  minima.push({...state, leftSlope, rightSlope, bracket: [low, high]});
}
minima.sort((a, b) => a.energy - b.energy); assert(minima.length);
const original = evaluate(physics.initial.x[0]), selected = minima[0];
assert(selected.energy < original.energy && selected.leftSlope < 0 && selected.rightSlope > 0);
const initialPhysics = makeSpringSectorDynamics(model, {period: 8, theta: selected.theta});
const inertia = initialPhysics.parameters.inertia, initialInput = initialPhysics.input(0);
const contacts = initialPhysics.constraints(initialPhysics.initial.x, 0).rows.filter(r => Math.abs(r.gap) < 1e-7);
// Remove only the input-acceleration term for the static preload balance.
// The driven first step below retains the complete original equations.
const staticForces = initialPhysics.forces(initialPhysics.initial.x, 0)
  .map((f, i) => f + (i ? initialInput.acceleration * p.mass[i].first[0] : 0));
const staticSolution = solveContactProjection(inertia.map((v, i) => inertia.map((_, j) => i === j ? 1 / v : 0)),
  staticForces.map((f, i) => f / inertia[i]), contacts, contacts.map(() => 0));
assert(staticSolution && Math.max(...staticSolution.v.map(Math.abs)) < 1e-7);
assert(staticSolution.impulses.every(v => v >= 0));
const firstStep = advanceSpringSectorStep(initialPhysics, initialPhysics.initial, .004); assert(firstStep.okay);
const files = ['scripts/study-spring-sector-initial-seat.mjs', 'scripts/lib/spring-sector-candidate.mjs',
  'scripts/lib/spring-sector-contact.mjs', 'scripts/lib/spring-sector-dynamics.mjs', 'scripts/lib/spring-sector-mass.mjs',
  'scripts/lib/spring-sector-source.mjs', 'scripts/lib/spring-sector-linkage.mjs', 'tests/helpers/solid-surface.mjs',
  'scripts/lib/jointed-tappet-dynamics-study.mjs', 'scripts/lib/alternating-peg-dynamics-study.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 83, status: 'static-startup-energy-seat-study', productionChanged: false, mechanicsPassed: false,
  shaftAngle: q, pitch, original, selected, minima, grid, staticForces, contacts, staticSolution, firstStep, sources,
  qualification: 'A one-pitch scan and bounded scalar minimizations locate a stable seated gravity/spring energy minimum at the actual initial shaft angle. Nonnegative contact forces balance the static preload with zero free velocity; the first driven step retains full input acceleration. The previous wheel phase was chosen for the upright source pose, then reused at the negative shaft limit. Subsequent dynamics, contact-force normals and refinement require separate checks.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, grid: undefined, sources: undefined});
