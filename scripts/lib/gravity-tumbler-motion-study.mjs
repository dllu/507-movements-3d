// Isolated 067 study: the event integrator is copied from verified 066 code.
// Uniform plate moments come from the actual initial scalloped extrusion.
const turn = 2 * Math.PI;
export function gravityJumpParameters(options = {}) {
  const p = { plateMass: 1, plateCentroidX: 0.2194782019650404, plateCentroidY: 0.9403325925249227,
    plateInertiaPerMass: 3.0201833052196014, sleeveMass: 0.12, collarMass: 0.035,
    sleeveBore: 0.35, sleeveRadius: 0.475, pinWidth: 0.145, contactClearance: 0.00015,
    driverSpeed: 0.4, damping: 2.8, gravity: 9.81, sourceAngle: 0, step: 0.0005, ...options };
  const r = p.sleeveBore, R = p.sleeveRadius;
  p.collarCenterX = -4 * (R ** 3 - r ** 3) / (3 * Math.PI * (R ** 2 - r ** 2));
  p.massMomentX = p.plateMass * p.plateCentroidX + p.collarMass * p.collarCenterX;
  p.massMomentY = p.plateMass * p.plateCentroidY;
  p.inertia = p.plateMass * p.plateInertiaPerMass + (p.sleeveMass + p.collarMass) * (R * R + r * r) / 2;
  p.gravityMoment = p.gravity * Math.hypot(p.massMomentX, p.massMomentY);
  p.gravityPeakAngle = Math.atan2(p.massMomentX, p.massMomentY);
  p.pinOffset = Math.asin((p.pinWidth / 2 + p.contactClearance) / p.sleeveBore);
  p.availableLead = Math.PI - 2 * p.pinOffset;
  const ratio = p.damping * p.driverSpeed / p.gravityMoment;
  if (!(ratio >= 0 && ratio < 1 && p.step > 0 && p.driverSpeed > 0 && p.availableLead > 0)) throw new Error('Invalid tumbler study parameters');
  p.releaseAngle = p.gravityPeakAngle + Math.asin(ratio);
  p.cycleDuration = turn / p.driverSpeed; p.sourceTime = (p.sourceAngle - p.releaseAngle) / p.driverSpeed;
  return p;
}

export function makeGravityJumpMotion(options = {}) {
  const p = gravityJumpParameters(options);
  const driverAt = time => p.releaseAngle + p.driverSpeed * time;
  const torque = angle => p.gravity * (p.massMomentY * Math.sin(angle) - p.massMomentX * Math.cos(angle));
  const energy = (angle, speed) => p.inertia * speed * speed / 2
    + p.gravity * (p.massMomentX * Math.sin(angle) + p.massMomentY * Math.cos(angle)) + p.gravityMoment;
  const derivative = (time, lead, relativeSpeed) => {
    const speed = p.driverSpeed + relativeSpeed;
    return [relativeSpeed, (torque(driverAt(time) + lead) - p.damping * speed) / p.inertia,
      p.damping * speed * speed];
  };
  const integrate = (time, lead, relativeSpeed, h) => {
    const a = derivative(time, lead, relativeSpeed);
    const b = derivative(time + h / 2, lead + a[0] * h / 2, relativeSpeed + a[1] * h / 2);
    const c = derivative(time + h / 2, lead + b[0] * h / 2, relativeSpeed + b[1] * h / 2);
    const d = derivative(time + h, lead + c[0] * h, relativeSpeed + c[1] * h);
    return [lead + h * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6,
      relativeSpeed + h * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6,
      h * (a[2] + 2 * b[2] + 2 * c[2] + d[2]) / 6];
  };
  const segments = [], events = [{ time: 0, kind: 'lower-release', angle: p.releaseAngle }];
  let time = 0, lead = 0, relativeSpeed = 0, mode = 'free';
  let dragLoss = 0, driverWork = 0, impactLoss = 0, maximumEnergyResidual = 0;
  let maximumLead = 0, maximumSpeed = p.driverSpeed, minimumSpeed = p.driverSpeed;
  const initialEnergy = energy(p.releaseAngle, p.driverSpeed);
  const audit = () => {
    const speed = p.driverSpeed + relativeSpeed;
    maximumEnergyResidual = Math.max(maximumEnergyResidual,
      Math.abs(energy(driverAt(time) + lead, speed) - initialEnergy - driverWork + dragLoss + impactLoss));
    maximumLead = Math.max(maximumLead, lead);
    maximumSpeed = Math.max(maximumSpeed, speed); minimumSpeed = Math.min(minimumSpeed, speed);
  };
  while (time < p.cycleDuration - 1e-12) {
    if (segments.length > 1e6 || events.length > 1000) throw new Error('Gravity integration failed to advance');
    if (mode !== 'free') {
      const angle = driverAt(time) + lead, reaction = p.damping * p.driverSpeed - torque(angle);
      if ((mode === 'lower' && reaction < -1e-10) || (mode === 'upper' && reaction > 1e-10)) {
        events.push({ time, kind: `${mode}-release`, angle }); mode = 'free'; continue;
      }
      const root = p.gravityPeakAngle + (mode === 'lower'
        ? Math.asin(p.damping * p.driverSpeed / p.gravityMoment)
        : Math.PI - Math.asin(p.damping * p.driverSpeed / p.gravityMoment));
      const nextAngle = root + turn * (Math.floor((angle - root + 1e-10) / turn) + 1);
      const end = Math.min(p.cycleDuration, time + (nextAngle - angle) / p.driverSpeed);
      const next = driverAt(end) + lead, drag = p.damping * p.driverSpeed ** 2 * (end - time);
      segments.push({ start: time, end, mode, lead, relativeSpeed: 0 });
      driverWork += energy(next, p.driverSpeed) - energy(angle, p.driverSpeed) + drag;
      dragLoss += drag; time = end; relativeSpeed = 0; audit();
      if (time < p.cycleDuration - 1e-12) {
        events.push({ time, kind: `${mode}-release`, angle: next }); mode = 'free';
      }
      continue;
    }
    let h = Math.min(p.step, p.cycleDuration - time), next = integrate(time, lead, relativeSpeed, h);
    const side = next[0] < -1e-12 ? 'lower' : next[0] > p.availableLead + 1e-12 ? 'upper' : null;
    if (side) {
      const bound = side === 'lower' ? 0 : p.availableLead;
      let low = 0, high = h;
      for (let i = 0; i < 48; i += 1) {
        const middle = (low + high) / 2, value = integrate(time, lead, relativeSpeed, middle)[0] - bound;
        if (side === 'lower' ? value > 0 : value < 0) low = middle; else high = middle;
      }
      h = (low + high) / 2; next = integrate(time, lead, relativeSpeed, h);
    }
    segments.push({ start: time, end: time + h, mode: 'free', lead, relativeSpeed });
    time += h; [lead, relativeSpeed] = next; dragLoss += next[2]; audit();
    if (side) {
      const incomingSpeed = p.driverSpeed + relativeSpeed;
      const impulse = -p.inertia * relativeSpeed, loss = p.inertia * relativeSpeed ** 2 / 2;
      const impactWork = p.driverSpeed * impulse, before = energy(driverAt(time) + lead, incomingSpeed);
      lead = side === 'lower' ? 0 : p.availableLead; relativeSpeed = 0;
      const after = energy(driverAt(time) + lead, p.driverSpeed);
      events.push({ time, kind: `${side}-impact`, angle: driverAt(time) + lead, incomingSpeed,
        impulse, impactLoss: loss, driverImpactWork: impactWork, energyResidual: after - before - impactWork + loss });
      impactLoss += loss; driverWork += impactWork; mode = side; audit();
    }
  }
  if (mode !== 'lower' || Math.abs(lead) > 1e-10 || Math.abs(relativeSpeed) > 1e-10)
    throw new Error('Gravity jump did not return to its driven periodic state');
  const atCycleTime = absoluteTime => {
    const cycle = Math.floor(absoluteTime / p.cycleDuration), t = absoluteTime - cycle * p.cycleDuration;
    let low = 0, high = segments.length - 1;
    while (low < high) { const mid = (low + high) >> 1; if (segments[mid].end <= t) low = mid + 1; else high = mid; }
    const s = segments[low];
    const value = s.mode === 'free' ? integrate(s.start, s.lead, s.relativeSpeed, t - s.start) : [s.lead, 0];
    const driverAngle = driverAt(t) + cycle * turn, weightAngle = driverAngle + value[0];
    const weightAngularSpeed = p.driverSpeed + value[1];
    const pinTorque = s.mode === 'free' ? 0 : p.damping * p.driverSpeed - torque(weightAngle);
    return { time: absoluteTime, cycle, cycleTime: t, driverAngle, driverAngularSpeed: p.driverSpeed,
      weightAngle, weightAngularSpeed, weightAngularAcceleration: s.mode === 'free'
        ? (torque(weightAngle) - p.damping * weightAngularSpeed) / p.inertia : 0,
      lead: value[0], mode: s.mode, pinEngaged: s.mode !== 'free', pinTorque,
      gravityTorque: torque(weightAngle), dragTorque: -p.damping * weightAngularSpeed,
      energy: energy(weightAngle, weightAngularSpeed) };
  };
  return { parameters: p, events, segments, torque, energy, atCycleTime,
    atTime: time => atCycleTime(time + p.sourceTime),
    summary: { maximumEnergyResidual, maximumLead, maximumSpeed, minimumSpeed,
      driverWork, dragLoss, impactLoss, finalMode: mode, segments: segments.length } };
}
