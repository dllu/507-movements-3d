import { readFile, writeFile } from 'node:fs/promises';
import { refinedWormProfile } from './lib/refined-worm-profile.mjs';

const candidate = JSON.parse(await readFile(process.env.PROBE_PROFILE ?? 'artifacts/review/031-corrected-worm-profile.json', 'utf8'));
const start = Date.now();
const fine = refinedWormProfile(candidate.parameters, { phaseSteps: 3200, radialSteps: 160, clearance: 0.0004 });
const changes = fine.radii.map((radius, i) => Math.abs(radius - candidate.profile.radii[i]));
const report = { movement: 31, method: 'Double the generating phase and radial searches at every unchanged wheel grid point.',
  base: candidate.profile.id, fine: fine.id, samples: changes.length,
  maximumDifference: Math.max(...changes), rmsDifference: Math.sqrt(changes.reduce((sum, x) => sum + x * x, 0) / changes.length),
  seconds: (Date.now() - start) / 1000 };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/031-cylindrical-hob-convergence.json', JSON.stringify(report, null, 2) + '\n');
console.log(report); if (report.maximumDifference > 1e-10) process.exitCode = 1;
