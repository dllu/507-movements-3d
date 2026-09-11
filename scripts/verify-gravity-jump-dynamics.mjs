import { writeFile } from 'node:fs/promises';
import { makeGravityJumpMotion } from './lib/gravity-jump-motion.mjs';

const cases = [0, 1, 4, 8, 12].map(damping => {
  const motion = makeGravityJumpMotion({ damping });
  return { damping, parameters: motion.parameters, events: motion.events, summary: motion.summary };
});
const baseline = makeGravityJumpMotion(), p = baseline.parameters;
const refinements = [0.001, 0.00025, 0.000125].map(step => {
  const motion = makeGravityJumpMotion({ step });
  let maximumAngleError = 0, maximumSpeedError = 0;
  for (let i = 0; i < 4001; i += 1) {
    const time = p.cycleDuration * (i + 0.319) / 4001;
    const a = baseline.atCycleTime(time), b = motion.atCycleTime(time);
    maximumAngleError = Math.max(maximumAngleError, Math.abs(a.weightAngle - b.weightAngle));
    maximumSpeedError = Math.max(maximumSpeedError, Math.abs(a.weightAngularSpeed - b.weightAngularSpeed));
  }
  return { step, maximumAngleError, maximumSpeedError, events: motion.events, summary: motion.summary };
});
let maximumAccelerationResidual = 0, maximumEnergyRateResidual = 0, maximumRepeatError = 0;
let minimumLead = Infinity, maximumLead = 0, minimumLowerReaction = Infinity;
const rows = [], h = 0.000002;
for (let i = 0; i < 4001; i += 1) {
  const time = p.cycleDuration * (i + 0.237) / 4001;
  const a = baseline.atCycleTime(time), before = baseline.atCycleTime(time - h), after = baseline.atCycleTime(time + h);
  if (before.mode !== after.mode) continue;
  // Differentiate the sampled pose, independently of its acceleration metadata.
  const acceleration = (after.weightAngularSpeed - before.weightAngularSpeed) / (2 * h);
  const x = p.massMomentX * Math.cos(a.weightAngle) - p.massMomentY * Math.sin(a.weightAngle);
  const actualGravityTorque = -p.gravity * x;
  const residual = p.inertia * acceleration - actualGravityTorque + p.damping * a.weightAngularSpeed - a.pinTorque;
  const rateResidual = (after.energy - before.energy) / (2 * h)
    - a.pinTorque * a.weightAngularSpeed + p.damping * a.weightAngularSpeed ** 2;
  maximumAccelerationResidual = Math.max(maximumAccelerationResidual, Math.abs(residual));
  maximumEnergyRateResidual = Math.max(maximumEnergyRateResidual, Math.abs(rateResidual));
  minimumLead = Math.min(minimumLead, a.lead); maximumLead = Math.max(maximumLead, a.lead);
  if (a.mode === 'lower') minimumLowerReaction = Math.min(minimumLowerReaction, a.pinTorque);
  for (const cycle of [-2, -1, 1, 2, 10]) {
    const b = baseline.atCycleTime(time + cycle * p.cycleDuration);
    maximumRepeatError = Math.max(maximumRepeatError, Math.abs(b.weightAngle - a.weightAngle - cycle * 2 * Math.PI),
      Math.abs(b.weightAngularSpeed - a.weightAngularSpeed));
  }
  if (i % 40 === 0) rows.push({ time, ...a, accelerationResidual: residual, energyRateResidual: rateResidual });
}
const summary = { ...baseline.summary, maximumAccelerationResidual, maximumEnergyRateResidual,
  maximumRepeatError, minimumLead, maximumLead, minimumLowerReaction };
const passed = cases.every(c => c.summary.maximumEnergyResidual < 1e-7
  && c.events.filter(e => e.kind.endsWith('impact')).every(e => Math.abs(e.energyResidual) < 1e-10
    && (e.kind === 'lower-impact' ? e.impulse > 0 : e.impulse < 0)))
  && refinements.every(r => r.maximumAngleError < 1e-7 && r.maximumSpeedError < 1e-7)
  && maximumAccelerationResidual < 1e-5 && maximumEnergyRateResidual < 1e-5
  && minimumLead >= -1e-12 && maximumLead < p.availableLead && minimumLowerReaction > 0 && maximumRepeatError < 1e-10;
await writeFile('artifacts/review/066-event-resolved-dynamics.json', JSON.stringify({ movement: 66,
  status: passed ? 'isolated-dynamics-verified' : 'isolated-dynamics-failed', productionChanged: false,
  method: 'RK4 in relative angle and speed; 48-step bisection locates both finite collar impacts within the integration step. Analytic unilateral release and exact driven work. Uniform source-proportioned bob, arm, sleeve and eccentric half-collar masses. Viscous bearing resistance and perfectly inelastic impacts are explicit modeling assumptions; no source animation is available. Time-step convergence and independent mass-center gravity, energy-rate and repeated-cycle checks. Candidate geometry still requires actual-surface validation.',
  parameters: p, summary, events: baseline.events, cases, refinements, rows }, null, 2) + '\n');
console.log({ passed, summary, events: baseline.events, refinements: refinements.map(({ events, summary, ...r }) => r),
  cases: cases.map(c => ({ damping: c.damping, maximumEnergyResidual: c.summary.maximumEnergyResidual, events: c.events })) });
if (!passed) process.exitCode = 1;
