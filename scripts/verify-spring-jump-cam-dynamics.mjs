import { writeFile } from 'node:fs/promises';
import { makeJumpCamMotion } from '../src/simulation/spring-jump-cam-motion.js';

const configurations = [
  { name: 'runtime', contactSamples: 32768, integrationSteps: 180000 },
  { name: 'coarse-time', contactSamples: 32768, integrationSteps: 90000 },
  { name: 'fine-time', contactSamples: 32768, integrationSteps: 360000 },
  { name: 'fine-contact', contactSamples: 65536, integrationSteps: 360000 },
];
const models = configurations.map(options => ({ name: options.name, motion: makeJumpCamMotion(options) }));
const model = models[0].motion, p = model.parameters, rows = [], h = 1e-5;
const physical = angle => {
  const contact = model.cam.atAngle(angle), leaf = model.spring.atFollower(contact.followerAngle, true);
  const force = p.stiffness * (leaf.lambda - p.freeLambda) / leaf.normalDerivative;
  return { contact, leaf, force, torque: -force * leaf.arm * contact.followerDerivative,
    energy: p.stiffness * (leaf.lambda - p.freeLambda) ** 2 / 2 };
};
let maximumLengthError = 0, maximumFixedRootMotion = 0, minimumLeafForce = Infinity;
let maximumEnergyGradientResidual = 0, maximumTableTorqueError = 0, maximumAnalyticRollingResidual = 0;
const initialPath = physical(0).leaf.path;
for (let i = 0; i < 1441; i += 1) {
  const angle = 2 * Math.PI * (i + 0.371) / 1441, state = physical(angle), { contact: c, leaf } = state;
  const energyDerivative = (physical(angle + h).energy - physical(angle - h).energy) / (2 * h);
  const gradientResidual = Math.abs(energyDerivative + state.torque);
  let length = 0, fixedDistance = 0;
  for (let j = 1; j < leaf.path.length; j += 1) {
    length += Math.hypot(leaf.path[j][0] - leaf.path[j - 1][0], leaf.path[j][1] - leaf.path[j - 1][1]);
    fixedDistance += model.spring.pieces[j - 1].length;
    if (fixedDistance < p.springFixedLength - 0.02) maximumFixedRootMotion = Math.max(maximumFixedRootMotion,
      Math.hypot(leaf.path[j][0] - initialPath[j][0], leaf.path[j][1] - initialPath[j][1]));
  }
  const sampled = model.sample(angle), vx = -(c.rollerY - p.followerPivot[1]) * c.followerDerivative;
  const vy = (c.rollerX - p.followerPivot[0]) * c.followerDerivative;
  const relativeX = vx + sampled.rollerRatio * p.rollerRadius * c.normalY + c.contactY;
  const relativeY = vy - sampled.rollerRatio * p.rollerRadius * c.normalX - c.contactX;
  const rollingResidual = Math.hypot(relativeX, relativeY);
  maximumLengthError = Math.max(maximumLengthError, Math.abs(length - p.springNeutralLength));
  minimumLeafForce = Math.min(minimumLeafForce, state.force);
  maximumEnergyGradientResidual = Math.max(maximumEnergyGradientResidual, gradientResidual);
  maximumTableTorqueError = Math.max(maximumTableTorqueError, Math.abs(sampled.torque - state.torque));
  maximumAnalyticRollingResidual = Math.max(maximumAnalyticRollingResidual, rollingResidual);
  rows.push({ angle, leafForce: state.force, torque: state.torque, energyGradientResidual: gradientResidual,
    tableTorqueError: sampled.torque - state.torque, rollingResidual });
}

// Integrate the actual geometry-derived torque along the independently stored
// RK4 trajectory. This does not reuse the interpolated energy/table torque.
let actualWork = 0, actualDampingWork = 0, maximumActualEnergyResidual = 0;
const first = model.frames[0], initial = physical(first.angle).energy + p.inertia * first.speed ** 2 / 2;
for (let i = 1; i < model.frames.length; i += 1) {
  const a = model.frames[i - 1], b = model.frames[i], span = b.time - a.time;
  const tb = physical(b.angle);
  // Four Simpson panels per stored frame resolve the short contact changes
  // traversed during the snap. The terminal velocity is pre-impact.
  for (let j = 0; j <= 8; j += 1) {
    const s = j === 0 ? a : j === 8 ? b : (() => {
      const v = model.atTime(a.time + span * j / 8);
      return { angle: v.camAngle, speed: v.camAngularSpeed };
    })();
    const weight = j === 0 || j === 8 ? 1 : j % 2 ? 4 : 2;
    actualWork += span / 24 * weight * physical(s.angle).torque * s.speed;
    actualDampingWork += p.damping * span / 24 * weight * s.speed ** 2;
  }
  maximumActualEnergyResidual = Math.max(maximumActualEnergyResidual,
    Math.abs(tb.energy + p.inertia * b.speed ** 2 / 2 + actualDampingWork - initial));
}
const last = model.frames.at(-1), kineticChange = p.inertia * (last.speed ** 2 - first.speed ** 2) / 2;
const impact = model.integration.catchState;
const impactResidual = Math.abs(p.inertia * (p.driverSpeed ** 2 - impact.incomingSpeed ** 2) / 2
  - impact.driverImpactWork + impact.impactLoss);
const convergence = models.map(({ name, motion }) => {
  let angleError = 0, speedError = 0;
  for (let i = 0; i < 1201; i += 1) {
    const time = p.cycleDuration * (i + 0.281) / 1201;
    const a = model.atTime(time), b = motion.atTime(time);
    angleError = Math.max(angleError, Math.abs(a.camAngle - b.camAngle));
    speedError = Math.max(speedError, Math.abs(a.camAngularSpeed - b.camAngularSpeed));
  }
  return { name, parameters: motion.parameters, integration: motion.integration, angleError, speedError };
});
let maximumCycleAngleError = 0, maximumCycleSpeedError = 0, minimumPinTorque = Infinity;
for (let i = 0; i < 2001; i += 1) {
  const time = p.cycleDuration * (i + 0.138) / 2001, a = model.atTime(time);
  if (a.pinEngaged) minimumPinTorque = Math.min(minimumPinTorque, a.pinTorque);
  for (const cycle of [1, 2]) {
    const b = model.atTime(time + cycle * p.cycleDuration);
    maximumCycleAngleError = Math.max(maximumCycleAngleError, Math.abs(b.camAngle - a.camAngle - cycle * 2 * Math.PI));
    maximumCycleSpeedError = Math.max(maximumCycleSpeedError, Math.abs(b.camAngularSpeed - a.camAngularSpeed));
  }
}
const summary = { poses: rows.length, maximumLengthError, maximumFixedRootMotion, minimumLeafForce,
  maximumEnergyGradientResidual, maximumTableTorqueError, maximumAnalyticRollingResidual,
  actualWork, actualDampingWork, maximumActualEnergyResidual,
  actualWorkBalanceResidual: Math.abs(kineticChange - actualWork + actualDampingWork), impactResidual,
  maximumCycleAngleError, maximumCycleSpeedError, minimumPinTorque };
const report = { movement: 64, method: 'Independent central differences of geometry-derived spring energy, neutral-axis lengths and fixed-root positions; contact velocity from world roller spin; actual torque work integrated separately along RK4 frames; discrete catch impulse/work/loss; time and contact-table convergence; three repeated cycles. The spring is a single constant-length bending mode, follower/roller massless, and catch inelastic.',
  parameters: p, summary, convergence, rows };
await writeFile('artifacts/review/064-candidate-dynamics.json', JSON.stringify(report, null, 2) + '\n');
console.log({ summary, convergence: convergence.map(row => ({ name: row.name, angleError: row.angleError,
  speedError: row.speedError, releaseTime: row.parameters.releaseTime, catchTime: row.parameters.catchTime })) });
if (minimumLeafForce <= 0 || minimumPinTorque < -1e-5 || maximumLengthError > 1e-10
  || maximumFixedRootMotion > 1e-10 || maximumActualEnergyResidual > 1e-4
  || summary.actualWorkBalanceResidual > 1e-4 || impactResidual > 1e-12
  || maximumEnergyGradientResidual > 0.01 || maximumTableTorqueError > 0.01
  || maximumAnalyticRollingResidual > 0.01 || convergence.some(row => row.angleError > 0.001 || row.speedError > 0.01)) process.exitCode = 1;
