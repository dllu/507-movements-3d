import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeGravityJumpMotion } from './lib/gravity-tumbler-motion-study.mjs';

const outline = JSON.parse(await readFile('artifacts/review/067-scalloped-outline-study.json', 'utf8'));
const options = { plateCentroidX: outline.summary.centroid[0], plateCentroidY: outline.summary.centroid[1],
  plateInertiaPerMass: outline.summary.polarInertiaPerUnitMass };
const cases = [0, 1.5, 2.8, 4, 6].map(damping => {
  const motion = makeGravityJumpMotion({ ...options, damping });
  return { damping, parameters: motion.parameters, summary: motion.summary, events: motion.events };
});
const candidate = makeGravityJumpMotion(options), fine = makeGravityJumpMotion({ ...options, step: 0.00025 });
let maximumAngleError = 0, maximumSpeedError = 0;
for (let i = 0; i < 1601; i++) {
  const time = candidate.parameters.cycleDuration * (i + 0.319) / 1601;
  const a = candidate.atTime(time), b = fine.atTime(time);
  maximumAngleError = Math.max(maximumAngleError, Math.abs(a.weightAngle - b.weightAngle));
  maximumSpeedError = Math.max(maximumSpeedError, Math.abs(a.weightAngularSpeed - b.weightAngularSpeed));
}
const files = ['scripts/lib/gravity-tumbler-motion-study.mjs', 'scripts/study-gravity-tumbler-outline.mjs',
  'src/simulation/gravity-jump-motion.js'];
const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file,
  createHash('sha256').update(await readFile(file)).digest('hex')])));
await writeFile('artifacts/review/067-gravity-dynamics-study.json', JSON.stringify({ movement: 67,
  status: 'isolated-source-shaped-dynamics-study', productionChanged: false, hashes, cases,
  convergence: { maximumAngleError, maximumSpeedError },
  qualification: 'The initial scalloped plate mass moments replace the old annular-sector assumptions. Trial sleeve/collar dimensions and masses are included analytically. The event-resolved integrator is copied from 066, with geometry-specific parameter preparation. Viscous resistance is varied explicitly. This is not an accepted mechanism: the source outline still needs rendered inspection, and no complete candidate pin/sleeve/worm geometry or actual contact sweep exists for 067.' }, null, 2) + '\n');
console.log({ cases: cases.map(({ damping, summary, events }) => ({ damping, summary, events })), maximumAngleError, maximumSpeedError });
if (cases.some(c => c.summary.maximumEnergyResidual > 1e-7) || maximumAngleError > 1e-7 || maximumSpeedError > 1e-7) process.exitCode = 1;
