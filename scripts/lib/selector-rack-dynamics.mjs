import {makeSelectorRackPlanarContact} from './selector-rack-planar-contact.mjs';
import {solveContactProjection} from './jointed-tappet-dynamics-study.mjs';

const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function ramp(time, start, end) {
  const s = Math.max(0, Math.min(1, (time - start) / (end - start))), h = end - start;
  return {x: s ** 3 * (10 - 15 * s + 6 * s * s), v: 30 * s * s * (1 - s) ** 2 / h,
    a: 60 * s * (1 - s) * (1 - 2 * s) / (h * h)};
}
export function makeSelectorRackDynamics(candidate, {period = 4, gravity = 9.81, damping = [8, .2, .2],
  pulses = [{heightPixels: 16, rise: [.3, .7], fall: [1.4, 1.75]}, {heightPixels: -28, rise: [2.4, 2.85], fall: [3.8, 4.25]}]} = {}) {
  const u = candidate.root.userData, contact = makeSelectorRackPlanarContact(candidate), center = u.frameCentroid;
  const inertia = [1, 1, u.frameMass.normalizedInertia], neutral = -3 / u.source.scale, omega = -2 * Math.PI / period;
  const input = time => {
    let selectorY = neutral, selectorVelocity = 0, selectorAcceleration = 0;
    for (const p of pulses) {
      const up = ramp(time, ...p.rise), down = ramp(time, ...p.fall), scale = p.heightPixels / u.source.scale - neutral;
      selectorY += scale * (up.x - down.x); selectorVelocity += scale * (up.v - down.v); selectorAcceleration += scale * (up.a - down.a);
    }
    return {camAngle: omega * time, camVelocity: omega, selectorY, selectorVelocity, selectorAcceleration};
  };
  const constraints = (x, time) => contact.at(x, input(time));
  const initial = {time: 0, x: [center[0], center[1] + neutral, 0], v: [0, 0, 0], active: []};
  const first = constraints(initial.x, 0), pinGap = Math.min(first.gaps.pin0, first.gaps.pin1);
  initial.x[1] += -pinGap + 2e-9;
  return {parameters: {period, gravity, damping, pulses, inertia, density: 1 / u.frameMass.volume, frameMass: u.frameMass,
    neutral, initialSeatingCorrection: -pinGap + 2e-9,
    idealizations: 'Prescribed cam angle and governor height; massless input actuators; uniform frame density normalized to mass one; free planar rack translation and rotation; viscous drag at the frame center and on rotation; frictionless plastic normal contact.'},
    input, contact, constraints, initial, forces: () => [0, -gravity, 0]};
}

export function advanceSelectorRackStep(physics, state, dt) {
  const time = state.time + dt, {inertia, damping} = physics.parameters;
  const effective = inertia.map((m, i) => m + dt * damping[i]), inverse = effective.map((v, i) => effective.map((_, j) => i === j ? 1 / v : 0));
  const force = physics.forces(), free = force.map((f, i) => (inertia[i] * state.v[i] + dt * f) / effective[i]);
  let x = state.x.map((v, i) => v + dt * state.v[i]), active = state.active;
  for (let iteration = 0; iteration < 40; iteration++) {
    const contact = physics.constraints(x, time), b = contact.rows.map(r => (dot(r.J, x.map((v, i) => v - state.x[i])) - r.gap) / dt);
    const solution = solveContactProjection(inverse, free, contact.rows, b, active);
    if (!solution) return {okay: false, reason: 'infeasible-projection', time, x};
    const next = state.x.map((v, i) => v + dt * solution.v[i]), change = Math.max(...next.map((v, i) => Math.abs(v - x[i])));
    x = next; active = solution.active; if (change >= 1e-11) continue;
    const final = physics.constraints(x, time), minimumGap = Math.min(...Object.values(final.gaps));
    if (minimumGap < -2e-9) return {okay: false, reason: 'nonlinear-penetration', time, x, minimumGap};
    const contacts = contact.rows.flatMap((r, i) => solution.impulses[i] > 1e-12 ? [{...r, impulse: solution.impulses[i]}] : []);
    const momentumResidual = Math.max(...inertia.map((m, i) => Math.abs(m * (solution.v[i] - state.v[i]) + dt * (damping[i] * solution.v[i] - force[i])
      - contacts.reduce((sum, r) => sum + r.J[i] * r.impulse, 0))));
    return {okay: true, state: {time, x, v: solution.v, active}, diagnostic: {iterations: iteration + 1, minimumGap,
      momentumResidual, projectionResidual: solution.residual, contacts, checkedPairs: final.checkedPairs, excludedPairs: final.excludedPairs}};
  }
  return {okay: false, reason: 'iteration-limit', time, x};
}
