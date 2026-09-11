import * as THREE from 'three';

export const frictionClutchParameters = Object.freeze({
  cycleDuration: 8, sourcePhase: 0.5, inputAngularSpeed: 1.2,
  inertia: 1, frictionTorque: 5.2, loadTorque: 0.58,
  stroke: 0.10, rollerRadius: 0.05, followerClearance: 0.0002,
  collarRadius: 0.25, grooveLeft: 0.94, grooveRight: 1.06,
  leverLength: 0.484, pivotY: -0.746,
});

const smooth = (u) => u * u * (3 - 2 * u);

// Coulomb clutch with constant input speed and resisting load. Polynomial
// pressure ramps admit exact acceleration and angle integrals. Event roots
// locate breakaway, synchronization, release and stopping independently of
// frame size; there is no frame-dependent numerical speed clamp.
export function makeFrictionClutchMotion(parameters = frictionClutchParameters) {
  const p = parameters, period = p.cycleDuration;
  const frictionAcceleration = p.frictionTorque / p.inertia;
  const loadAcceleration = p.loadTorque / p.inertia;
  const intervals = [
    [0, 0.30, [0]],
    [0.30, 0.38, [0, 0, 3, -2]],
    [0.38, 0.62, [1]],
    [0.62, 0.68, [1, 0, -3, 2]],
    [0.68, 1, [0]],
  ].map(([a, b, pressure]) => ({ a: a * period, b: b * period, pressure }));
  let integral = 0, doubleIntegral = 0;
  for (const interval of intervals) {
    const duration = interval.b - interval.a;
    interval.coefficients = interval.pressure.map((coefficient, power) =>
      frictionAcceleration * coefficient / duration ** power - (power === 0 ? loadAcceleration : 0));
    interval.integral = integral;
    interval.doubleIntegral = doubleIntegral;
    doubleIntegral += integral * duration + interval.coefficients.reduce((sum, c, i) =>
      sum + c * duration ** (i + 2) / ((i + 1) * (i + 2)), 0);
    integral += interval.coefficients.reduce((sum, c, i) => sum + c * duration ** (i + 1) / (i + 1), 0);
  }
  const integralsAt = (time) => {
    const interval = intervals.find(({ b }) => time <= b) ?? intervals.at(-1);
    const dt = time - interval.a, u = dt / (interval.b - interval.a);
    return {
      pressure: interval.pressure.reduce((sum, c, i) => sum + c * u ** i, 0),
      acceleration: interval.coefficients.reduce((sum, c, i) => sum + c * dt ** i, 0),
      integral: interval.integral + interval.coefficients.reduce((sum, c, i) => sum + c * dt ** (i + 1) / (i + 1), 0),
      doubleIntegral: interval.doubleIntegral + interval.integral * dt
        + interval.coefficients.reduce((sum, c, i) => sum + c * dt ** (i + 2) / ((i + 1) * (i + 2)), 0),
    };
  };
  const root = (low, high, value) => {
    const initialSign = Math.sign(value(low));
    for (let i = 0; i < 52; i += 1) {
      const middle = (low + high) / 2;
      if (Math.sign(value(middle)) === initialSign) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };
  const start = root(0.30 * period, 0.38 * period, (t) => integralsAt(t).acceleration);
  const release = root(0.62 * period, 0.68 * period, (t) => integralsAt(t).acceleration);
  const startState = integralsAt(start), releaseState = integralsAt(release);
  const lock = root(start, release, (t) => integralsAt(t).integral - startState.integral - p.inputAngularSpeed);
  const stop = root(release, period, (t) => integralsAt(t).integral - releaseState.integral + p.inputAngularSpeed);
  const gainAt = (time, initialTime, initialState) => integralsAt(time).doubleIntegral
    - initialState.doubleIntegral - initialState.integral * (time - initialTime);
  const lockAngle = gainAt(lock, start, startState);
  const releaseAngle = lockAngle + p.inputAngularSpeed * (release - lock);
  const stopAngle = releaseAngle + p.inputAngularSpeed * (stop - release) + gainAt(stop, release, releaseState);
  const rotationAt = (time) => {
    const cycles = Math.floor(time / period), t = time - cycles * period;
    const state = integralsAt(t);
    let angle = 0, speed = 0, acceleration = 0;
    if (t >= stop) angle = stopAngle;
    else if (t >= release) {
      angle = releaseAngle + p.inputAngularSpeed * (t - release) + gainAt(t, release, releaseState);
      speed = p.inputAngularSpeed + state.integral - releaseState.integral;
      acceleration = state.acceleration;
    } else if (t >= lock) {
      angle = lockAngle + p.inputAngularSpeed * (t - lock);
      speed = p.inputAngularSpeed;
    } else if (t > start) {
      angle = gainAt(t, start, startState);
      speed = state.integral - startState.integral;
      acceleration = state.acceleration;
    }
    return { angle: cycles * stopAngle + angle, speed, acceleration,
      pressure: state.pressure, phase: t / period, locked: t >= lock && t <= release };
  };
  const rollerDistance = p.rollerRadius + p.followerClearance;
  const initialRadialOffset = p.pivotY + p.leverLength + p.collarRadius;
  const pivotX = p.grooveLeft + Math.sqrt(rollerDistance ** 2 - initialRadialOffset ** 2);
  const pivot = new THREE.Vector3(pivotX, p.pivotY, 0);
  const followerAtAngle = (angle) => new THREE.Vector3(pivotX + p.leverLength * Math.sin(angle),
    p.pivotY + p.leverLength * Math.cos(angle), 0);
  const contactAngle = (shift, side) => {
    const edge = new THREE.Vector3(shift + (side === 'left' ? p.grooveLeft : p.grooveRight), -p.collarRadius, 0);
    const difference = edge.clone().sub(pivot), distance = difference.length();
    const cosine = (p.leverLength ** 2 + distance ** 2 - rollerDistance ** 2) / (2 * p.leverLength * distance);
    if (Math.abs(cosine) > 1 + 1e-12) throw new Error('Clutch follower cannot reach the collar');
    const centerAngle = Math.atan2(difference.x, difference.y);
    return centerAngle + (side === 'left' ? 1 : -1) * Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
  };
  const translationAt = (phase) => {
    let shift, angle, side;
    if (phase < 0.10 || phase >= 0.88) {
      shift = p.stroke; side = 'right'; angle = contactAngle(shift, side);
    } else if (phase < 0.16) {
      shift = p.stroke; side = 'free';
      angle = THREE.MathUtils.lerp(contactAngle(shift, 'right'), contactAngle(shift, 'left'), smooth((phase - 0.10) / 0.06));
    } else if (phase < 0.30) {
      shift = p.stroke * (1 - smooth((phase - 0.16) / 0.14)); side = 'left'; angle = contactAngle(shift, side);
    } else if (phase < 0.68) {
      shift = 0; side = 'left'; angle = contactAngle(shift, side);
    } else if (phase < 0.74) {
      shift = 0; side = 'free';
      angle = THREE.MathUtils.lerp(contactAngle(0, 'left'), contactAngle(0, 'right'), smooth((phase - 0.68) / 0.06));
    } else {
      shift = p.stroke * smooth((phase - 0.74) / 0.14); side = 'right'; angle = contactAngle(shift, side);
    }
    return { shift, leverAngle: angle, followerPoint: followerAtAngle(angle), followerSide: side };
  };
  const sourceTime = p.sourcePhase * period, sourceAngle = rotationAt(sourceTime).angle;
  const stateAt = (time) => {
    const rotation = rotationAt(time + sourceTime);
    const translation = translationAt(rotation.phase);
    const appliedFrictionTorque = rotation.locked ? p.loadTorque : Math.max(0, p.frictionTorque * rotation.pressure);
    const appliedLoadTorque = rotation.speed > 1e-12 ? p.loadTorque : Math.min(p.loadTorque, appliedFrictionTorque);
    return { ...translation, phase: rotation.phase, contactPressure: rotation.pressure,
      inputAngle: p.inputAngularSpeed * time, inputAngularSpeed: p.inputAngularSpeed,
      outputAngle: rotation.angle - sourceAngle, outputAngularSpeed: rotation.speed,
      outputAngularAcceleration: rotation.acceleration, locked: rotation.locked,
      slipAngularSpeed: p.inputAngularSpeed - rotation.speed,
      appliedFrictionTorque, appliedLoadTorque };
  };
  return { parameters: p, stateAt, translationAt, rotationAt, integralsAt, contactAngle,
    pivot, followerAtAngle, events: { start, lock, release, stop }, cycleAngle: stopAngle };
}
