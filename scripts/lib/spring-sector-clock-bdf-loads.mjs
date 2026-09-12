const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

// The physical five-family energy and input momentum come from the unchanged
// mesh-mass helper. Only the time-difference operator changes here. Signed
// multistep history exchanges must not be described as dissipated energy.
export function springSectorClockBdfLoadInterval(loads, parameters, earlier, before, after, contacts) {
  const bdf = after.method === 'variable-bdf2';
  if (!bdf && after.method !== 'backward-euler') throw Error('Unknown integration method');
  const dt = after.time - before.time, oldDt = bdf && earlier ? before.time - earlier.time : dt;
  const ratio = dt / oldDt;
  const clockAllowance = 16 * Number.EPSILON * Math.max(1, Math.abs(after.time), Math.abs(before.time), Math.abs(earlier?.time ?? 0));
  if (!(dt > 0 && oldDt > 0) || (bdf && (!earlier || ratio > 2.002 || dt > 2 * oldDt + clockAllowance)))
    throw Error('Invalid method history or clock growth');
  const factor = bdf ? ratio * ratio / (1 + 2 * ratio) : 0, alpha = 1 + factor, beta = -factor;
  const weight = bdf ? dt * (1 + ratio) / (1 + 2 * ratio) : dt, multiplier = dt / weight;
  const a = loads.state(before), b = loads.state(after), old = bdf ? loads.state(earlier) : a;
  const difference = key => b[key] - a[key] - factor * (a[key] - old[key]);
  const contactInputImpulse = contacts.reduce((sum, c) => sum + c.impulse * c.inputJacobian, 0);
  const equationInputImpulse = difference('momentum') - weight * b.Tq + weight * b.Uq - contactInputImpulse;
  const inputImpulse = multiplier * equationInputImpulse, inputWork = inputImpulse * b.k.v;
  const rodImpulse = inputImpulse / b.rod.sliderQ;
  if (!Number.isFinite(rodImpulse) || Math.abs(b.rod.sliderQ) < 1e-8) throw Error('Input rod force is singular');
  const velocityMetric = (row, value) => {
    const dv = after.v.map((v, i) => v - row.v[i]), dq = b.k.v - value.k.v;
    let result = loads.masses.wheel.Iy * dv[0] ** 2 + b.M * dq ** 2;
    for (let i = 0; i < 2; i++) result += b.sectors[i].mass * dv[i + 1] ** 2 + 2 * b.sectors[i].coupling * dq * dv[i + 1];
    return result;
  };
  const springMetric = row => [0, 1].reduce((sum, i) => sum
    + parameters.stiffness[i] * (after.x[i + 1] - row.x[i + 1]) ** 2, 0);
  const velocityHistoryWork = multiplier / 2 * (alpha * velocityMetric(before, a) + beta * velocityMetric(bdf ? earlier : before, old));
  const springHistoryWork = multiplier / 2 * (alpha * springMetric(before) + beta * springMetric(bdf ? earlier : before));
  const change = b.energy - a.energy;
  const energyHistoryWork = multiplier * difference('energy') - change;
  const dampingWork = dt * after.v.reduce((sum, v, i) => sum + parameters.damping[i] * v ** 2, 0);
  const loadWork = dt * parameters.load * after.v[0];
  const contactVelocityWork = multiplier * contacts.reduce((sum, c) => sum
    + c.impulse * (dot(c.J, after.v) + c.inputJacobian * b.k.v), 0);
  return {change, inputWork, rodWork: rodImpulse * b.rod.sliderQ * b.k.v,
    equationInputImpulse, inputImpulse, rodImpulse, inputForce: rodImpulse / dt, sliderQ: b.rod.sliderQ,
    dampingWork, loadWork, velocityHistoryWork, springHistoryWork, energyHistoryWork, contactVelocityWork,
    correctedResidual: change - inputWork + dampingWork + loadWork + velocityHistoryWork + springHistoryWork
      + energyHistoryWork - contactVelocityWork};
}
