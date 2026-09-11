import { readFile, writeFile } from 'node:fs/promises';
import { generateWormWheelProfile } from '../src/simulation/worm-wheel-profile.js';

const { parameters, profile } = JSON.parse(await readFile('artifacts/review/066-26-tooth-worm-profile.json', 'utf8'));
const started = Date.now(), refined = generateWormWheelProfile(parameters,
  { phaseSteps: 3200, radialSteps: 160, clearance: profile.clearance });
const differences = profile.radii.map((r, i) => Math.abs(r - refined.radii[i]));
const summary = { samples: differences.length, maximumDifference: Math.max(...differences),
  rmsDifference: Math.sqrt(differences.reduce((s, d) => s + d * d, 0) / differences.length),
  changedSamplesAbove1e9: differences.filter(d => d > 1e-9).length, seconds: (Date.now() - started) / 1000 };
const passed = summary.maximumDifference < 1e-8;
await writeFile('artifacts/review/066-refined-worm-convergence.json', JSON.stringify({ movement: 66, passed,
  method: 'Regenerate the complete 26-tooth radial field with twice the phase search and radial bracketing resolution (3200/160 versus 1600/80), retaining the actual 256-by-32 wheel mesh field. This checks cutter optimization convergence; it does not substitute for actual mesh contact/force sweeps.',
  parameters, summary }, null, 2) + '\n');
console.log({ passed, summary }); if (!passed) process.exitCode = 1;
