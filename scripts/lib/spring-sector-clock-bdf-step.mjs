import {solveContactProjection} from './jointed-tappet-dynamics-study.mjs';

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

// Variable-step accuracy experiment on smooth contact branches. The caller
// resolves contact changes with backward Euler and rebuilds two stable small
// intervals before using history. Nominal growth is bounded by two with
// a tolerance for subtraction of nearby time stamps, plus a hard ratio cap
// of 2.001. The homogeneous difference multiplier stays below 0.801.
export function advanceSpringSectorClockBdfStep(physics, state, previous, dt) {
  const {inertia, damping, coulomb} = physics.parameters;
  if (coulomb !== 0) throw Error('The spring-sector BDF experiment requires zero friction');
  const oldDt = state.time - previous.time, ratio = dt / oldDt;
  const clockAllowance = 8 * Number.EPSILON * Math.max(1, Math.abs(state.time), Math.abs(previous.time), Math.abs(state.time + dt));
  if (!(dt > 0 && oldDt > 0) || !Number.isFinite(ratio) || ratio > 2.001 || dt > 2 * oldDt + clockAllowance) {
    throw Error('Variable BDF2 requires positive intervals and growth within the clock-rounding bound');
  }
  // Differentiate the quadratic interpolant at the new endpoint.
  const historyFactor = ratio * ratio / (1 + 2 * ratio);
  const time = state.time + dt, scale = dt * (1 + ratio) / (1 + 2 * ratio);
  const positionHistory = state.x.map((value, i) => value + (value - previous.x[i]) * historyFactor);
  const velocityHistory = state.v.map((value, i) => value + (value - previous.v[i]) * historyFactor);
  const effective = inertia.map((value, i) => value + scale * damping[i]);
  const inverse = effective.map((value, i) => effective.map((_, j) => i === j ? 1 / value : 0));
  let x = state.x.map((value, i) => value + dt * state.v[i]), lastIds = state.active;
  for (let iteration = 0; iteration < 40; iteration++) {
    const force = physics.forces(x, time);
    const free = force.map((value, i) => (inertia[i] * velocityHistory[i] + scale * value) / effective[i]);
    const contact = physics.constraints(x, time);
    const bound = contact.rows.map(row => (dot(row.J, x.map((value, i) => value - positionHistory[i])) - row.gap) / scale);
    const solution = solveContactProjection(inverse, free, contact.rows, bound, lastIds);
    if (!solution) return {okay: false, reason: 'contact-projection-infeasible', time, x, contact};
    const next = positionHistory.map((value, i) => value + scale * solution.v[i]);
    const change = Math.max(...next.map((value, i) => Math.abs(value - x[i])));
    x = next; lastIds = solution.active;
    if (change >= 1e-11) continue;
    const final = physics.constraints(x, time), minimumGap = Math.min(...Object.values(final.gaps));
    if (minimumGap < -2e-9) return {okay: false, reason: 'nonlinear-penetration', time, x, minimumGap, contact: final};
    const finalForce = physics.forces(x, time);
    const momentumResidual = Math.max(...inertia.map((value, i) => Math.abs(
      value * (solution.v[i] - velocityHistory[i]) + scale * (damping[i] * solution.v[i] - finalForce[i])
      - contact.rows.reduce((sum, row, j) => sum + row.J[i] * solution.impulses[j], 0))));
    return {okay: true, state: {time, x, v: solution.v, active: lastIds}, diagnostic: {
      method: 'variable-bdf2', stepRatio: ratio, historyFactor, forceWeight: scale, iterations: iteration + 1, minimumGap, residual: solution.residual, momentumResidual,
      frictionImpulse: 0, frictionMode: 'none',
      contacts: contact.rows.map((row, i) => ({id: row.id, key: row.key, pin: row.pin,
        impulse: solution.impulses[i], gap: row.gap})).filter(row => row.impulse > 1e-12),
    }};
  }
  return {okay: false, reason: 'nonlinear-iteration-limit', time, x};
}

export const sameSpringSectorContacts = (a = [], b = []) => a.length === b.length && a.every(id => b.includes(id));
