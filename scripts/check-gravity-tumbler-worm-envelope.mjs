import { readFile, writeFile } from 'node:fs/promises';
import { generateWormWheelProfile } from '../src/simulation/worm-wheel-profile.js';

const { parameters, profile } = JSON.parse(await readFile('artifacts/review/067-24-tooth-worm-profile.json', 'utf8'));
const offset = -10 / (280 / 1.375), rows = [];
for (const [name, length, phaseSteps, radialSteps] of [
  ['double-resolution', parameters.wormLength, 3200, 160],
  ['common-center', parameters.wormLength - 2 * Math.abs(offset), 1600, 80],
  ['enclosing-center', parameters.wormLength + 2 * Math.abs(offset), 1600, 80],
]) {
  const cut = generateWormWheelProfile({ ...parameters, wormLength: length }, { phaseSteps, radialSteps, clearance: 0.0004 });
  const differences = cut.radii.map((r, i) => Math.abs(r - profile.radii[i]));
  const row = { name, wormLength: length, phaseSteps, radialSteps, samples: differences.length,
    maximumDifference: Math.max(...differences), rmsDifference: Math.sqrt(differences.reduce((sum, d) => sum + d * d, 0) / differences.length),
    changedSamples: differences.filter(d => d > 1e-9).length };
  rows.push(row); console.log(row);
}
const passed = rows.every(row => row.maximumDifference < 1e-9);
await writeFile('artifacts/review/067-worm-envelope-convergence.json', JSON.stringify({ movement: 67, passed, teeth: parameters.teeth,
  method: 'Double generating phase/radial resolution, then compare the original field with common and enclosing centered finite-worm intervals. Phase correction keeps an axially translated worm on the same infinite helix. The two length bounds establish that neither end changes the active sampled hob envelope. Actual translated mesh containment and normal-force contact are checked separately.',
  offset, sourceOffsetPixels: -10, localAxisTranslation: -offset, phaseCorrection: -offset / (parameters.pitchRadius / parameters.teeth), rows }, null, 2) + '\n', { flag: 'wx' });
if (!passed) process.exitCode = 1;
