import { writeFile } from 'node:fs/promises';
import { makeLatheLeverCandidate } from '../artifacts/review/056-candidate-model.mjs';
import { camContactSamples } from './lib/lathe-lever-cam-contact.mjs';
const report = camContactSamples(makeLatheLeverCandidate(), Number(process.env.PROBE_POSES ?? 65));
await writeFile('artifacts/review/056-candidate-cam-forces.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.intersections || report.summary.minimumInputPower <= 0 || report.summary.minimumOutputPower <= 0 || report.summary.maximumPowerResidual > 0.01) process.exitCode = 1;
