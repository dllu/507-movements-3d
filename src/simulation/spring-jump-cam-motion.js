import { jumpCamDimensions, makeJumpCamContact, makeJumpCamSpring } from './spring-jump-cam-contact.js';

const turn = 2 * Math.PI, cache = new Map();
const hermite = (a, b, da, db, t, span) => {
  const t2 = t * t, t3 = t2 * t;
  return { value: (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * span * da
      + (-2 * t3 + 3 * t2) * b + (t3 - t2) * span * db,
    derivative: ((6 * t2 - 6 * t) * a + (3 * t2 - 4 * t + 1) * span * da
      + (-6 * t2 + 6 * t) * b + (3 * t2 - 2 * t) * span * db) / span };
};

function tableSampler(table, { contactSamples, stiffness, freeLambda }) {
  const step = turn / contactSamples;
  return angle => {
    const cycle = Math.floor(angle / turn), local = angle - cycle * turn;
    const coordinate = local / step, index = Math.min(contactSamples - 1, Math.floor(coordinate));
    const t = coordinate - index, a = table[index], b = table[index + 1];
    const lambda = hermite(a.lambda, b.lambda, a.lambdaDerivative, b.lambdaDerivative, t, step);
    const roller = hermite(a.rollerAngle, b.rollerAngle, a.rollerRatio, b.rollerRatio, t, step);
    return { lambda: lambda.value, lambdaDerivative: lambda.derivative,
      energy: 0.5 * stiffness * (lambda.value - freeLambda) ** 2,
      torque: -stiffness * (lambda.value - freeLambda) * lambda.derivative,
      rollerAngle: cycle * table.at(-1).rollerAngle + roller.value, rollerRatio: roller.derivative };
  };
}

export function makeJumpCamMotion({ contactSamples = 32768, integrationSteps = 180000,
  inertia = 0.04, damping = 0.12, springEnergyRange = 1.5, preloadMode = 0.05, precomputed = null } = {}) {
  const key = JSON.stringify({ contactSamples, integrationSteps, inertia, damping, springEnergyRange, preloadMode,
    source: precomputed ? 'precomputed' : 'integrated' });
  if (cache.has(key)) return cache.get(key);
  const cam = makeJumpCamContact(), spring = makeJumpCamSpring(), p = jumpCamDimensions;
  if (precomputed) {
    for (const [name, value] of Object.entries({ ...p, contactSamples, integrationSteps, inertia, damping, springEnergyRange, preloadMode })) {
      if (JSON.stringify(value) !== JSON.stringify(precomputed.parameters[name])) throw new Error(`Stale precomputed cam parameter: ${name}`);
    }
    if (precomputed.table.length !== (contactSamples + 1) * 5 || precomputed.frames.length % 3) throw new Error('Invalid precomputed cam table size');
    const table = Array.from({ length: contactSamples + 1 }, (_, i) => ({ angle: turn * i / contactSamples,
      lambda: precomputed.table[i * 5], lambdaDerivative: precomputed.table[i * 5 + 1],
      followerAngle: precomputed.table[i * 5 + 2], rollerRatio: precomputed.table[i * 5 + 3], rollerAngle: precomputed.table[i * 5 + 4] }));
    const frames = Array.from({ length: precomputed.frames.length / 3 }, (_, i) => ({ time: precomputed.frames[i * 3],
      angle: precomputed.frames[i * 3 + 1], speed: precomputed.frames[i * 3 + 2] }));
    const result = assembleMotion(cam, spring, precomputed.parameters, table, frames, precomputed.integration);
    cache.set(key, result); return result;
  }
  const step = turn / contactSamples, table = [];
  let lowLambda = Infinity, highLambda = -Infinity;
  for (let i = 0; i <= contactSamples; i += 1) {
    const c = cam.atAngle(i * step), leaf = spring.atFollower(c.followerAngle);
    lowLambda = Math.min(lowLambda, leaf.lambda); highLambda = Math.max(highLambda, leaf.lambda);
    const centerVx = -(c.rollerY - p.followerPivot[1]) * c.followerDerivative;
    const centerVy = (c.rollerX - p.followerPivot[0]) * c.followerDerivative;
    const rollerRatio = ((centerVx + c.contactY) * -c.normalY + (centerVy - c.contactX) * c.normalX) / p.rollerRadius;
    table.push({ angle: i * step, lambda: leaf.lambda, lambdaDerivative: leaf.lambdaDerivative * c.followerDerivative,
      followerAngle: c.followerAngle, rollerRatio, rollerAngle: 0 });
  }
  for (let i = 1; i < table.length; i += 1) table[i].rollerAngle = table[i - 1].rollerAngle
    + (table[i - 1].rollerRatio + table[i].rollerRatio) * step / 2;
  const freeLambda = lowLambda - preloadMode;
  const stiffness = 2 * springEnergyRange / ((highLambda - freeLambda) ** 2 - preloadMode ** 2);
  const sample = tableSampler(table, { contactSamples, stiffness, freeLambda });
  const driverSpeed = 0.4, cycleDuration = turn / driverSpeed, dt = cycleDuration / integrationSteps;
  let releaseLow = 0, releaseHigh = 0;
  while (releaseHigh < turn && sample(releaseHigh).torque <= damping * driverSpeed) {
    releaseLow = releaseHigh; releaseHigh += step;
  }
  if (releaseHigh >= turn) throw new Error('The spring cannot release the cam');
  for (let i = 0; i < 40; i += 1) {
    const middle = (releaseLow + releaseHigh) / 2;
    if (sample(middle).torque > damping * driverSpeed) releaseHigh = middle; else releaseLow = middle;
  }
  const releaseAngle = (releaseLow + releaseHigh) / 2, releaseTime = releaseAngle / driverSpeed;
  const rhs = (angle, speed) => {
    const torque = sample(angle).torque;
    return [speed, (torque - damping * speed) / inertia, torque * speed, damping * speed ** 2];
  };
  const integrate = (angle, speed, span) => {
    const a = rhs(angle, speed), b = rhs(angle + span * a[0] / 2, speed + span * a[1] / 2);
    const c = rhs(angle + span * b[0] / 2, speed + span * b[1] / 2), d = rhs(angle + span * c[0], speed + span * c[1]);
    const delta = a.map((_, i) => span / 6 * (a[i] + 2 * b[i] + 2 * c[i] + d[i]));
    return { angle: angle + delta[0], speed: speed + delta[1], springWork: delta[2], dampingWork: delta[3] };
  };
  let time = releaseTime, angle = releaseAngle, speed = driverSpeed, springWork = 0, dampingWork = 0;
  let peakSpeed = speed, maximumLead = 0, settledTime = 0, maximumEnergyResidual = 0;
  const initialEnergy = sample(angle).energy + inertia * speed ** 2 / 2;
  const frames = [{ time, angle, speed }];
  let catchState = null;
  for (let i = 1; i <= integrationSteps; i += 1) {
    let span = dt, next = integrate(angle, speed, span);
    if (time > releaseTime + 0.01 && next.angle < driverSpeed * (time + span)) {
      let low = 0, high = dt;
      for (let j = 0; j < 36; j += 1) {
        const middle = (low + high) / 2, trial = integrate(angle, speed, middle);
        if (trial.angle < driverSpeed * (time + middle)) high = middle; else low = middle;
      }
      span = (low + high) / 2; next = integrate(angle, speed, span);
      catchState = { time: time + span, angle: next.angle, incomingSpeed: next.speed,
        impulse: inertia * (driverSpeed - next.speed),
        driverImpactWork: inertia * driverSpeed * (driverSpeed - next.speed),
        impactLoss: inertia * (driverSpeed - next.speed) ** 2 / 2 };
    }
    time += span; angle = next.angle; speed = next.speed;
    springWork += next.springWork; dampingWork += next.dampingWork;
    peakSpeed = Math.max(peakSpeed, speed); maximumLead = Math.max(maximumLead, angle - time * driverSpeed);
    if (Math.abs(speed) < 0.001) settledTime += span;
    const energy = sample(angle).energy + inertia * speed ** 2 / 2;
    maximumEnergyResidual = Math.max(maximumEnergyResidual, Math.abs(energy + dampingWork - initialEnergy));
    if (i % 8 === 0 || catchState) frames.push({ time, angle, speed });
    if (catchState) break;
  }
  if (!catchState || catchState.time >= cycleDuration) throw new Error('The cam does not rejoin the pin within one turn');
  const parameters = { ...p, driverSpeed, cycleDuration, contactSamples, integrationSteps,
    inertia, damping, stiffness, freeLambda, lowLambda, highLambda, springEnergyRange, preloadMode,
    releaseAngle, releaseTime, catchTime: catchState.time, catchAngle: catchState.angle,
    peakSpeed, maximumLead, settledTime, springNeutralLength: spring.neutralLength };
  const result = assembleMotion(cam, spring, parameters, table, frames,
    { initialEnergy, springWork, dampingWork, maximumEnergyResidual, catchState });
  cache.set(key, result); return result;
}

function assembleMotion(cam, spring, parameters, table, frames, integration) {
  const { cycleDuration, driverSpeed, releaseTime, stiffness, freeLambda, damping, inertia } = parameters;
  const { catchState } = integration, sample = tableSampler(table, parameters);
  const atTime = time => {
    const cycle = Math.floor(time / cycleDuration), local = time - cycle * cycleDuration;
    let camAngle = driverSpeed * time, camSpeed = driverSpeed, stage = 'pin-drive';
    if (local >= releaseTime && local < catchState.time) {
      let low = 0, high = frames.length - 1;
      while (high - low > 1) { const middle = (low + high) >> 1; if (frames[middle].time > local) high = middle; else low = middle; }
      const a = frames[low], b = frames[high], span = b.time - a.time;
      const value = hermite(a.angle, b.angle, a.speed, b.speed, (local - a.time) / span, span);
      camAngle = cycle * turn + value.value; camSpeed = value.derivative;
      stage = Math.abs(camSpeed) < 0.001 ? 'waiting-for-pin' : 'spring-snap';
    }
    const contact = cam.atAngle(camAngle), leaf = spring.atFollower(contact.followerAngle, true);
    const leafForce = stiffness * (leaf.lambda - freeLambda) / leaf.normalDerivative;
    const drive = sample(camAngle), pinEngaged = stage === 'pin-drive';
    const torque = -leafForce * leaf.arm * contact.followerDerivative;
    return { time, cycle, stage, camAngle, camAngularSpeed: camSpeed, driverAngle: driverSpeed * time,
      driverAngularSpeed: driverSpeed, camLead: camAngle - driverSpeed * time, pinEngaged,
      contact, leaf, leafForce, springTorque: torque, springEnergy: 0.5 * stiffness * (leaf.lambda - freeLambda) ** 2,
      camAngularAcceleration: pinEngaged ? 0 : (drive.torque - damping * camSpeed) / inertia,
      pinTorque: pinEngaged ? damping * driverSpeed - torque : 0,
      followerAngle: contact.followerAngle, followerAngularSpeed: contact.followerDerivative * camSpeed,
      rollerAngle: drive.rollerAngle, rollerAngularSpeed: drive.rollerRatio * camSpeed };
  };
  return { parameters, cam, spring, sample, table, frames, atTime, integration };
}
