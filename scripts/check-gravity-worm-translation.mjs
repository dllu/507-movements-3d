import { readFile, writeFile } from 'node:fs/promises';
import { generateWormWheelProfile } from '../src/simulation/worm-wheel-profile.js';

const variant = process.env.WHEEL_TEETH;
const { parameters, profile } = JSON.parse(await readFile(`artifacts/review/${variant ? `066-${variant}-tooth-worm-profile` : '066-candidate-worm-profile'}.json`, 'utf8'));
const offset = 34 / 218, rows = [];
for (const [name, length] of [['common-center', parameters.wormLength - 2 * offset],
  ['enclosing-center', parameters.wormLength + 2 * offset]]) {
  const cut = generateWormWheelProfile({ ...parameters, wormLength: length }, { phaseSteps: 1600, radialSteps: 80, clearance: 0.0004 });
  const differences = cut.radii.map((r, i) => Math.abs(r - profile.radii[i]));
  const row = { name, wormLength: length, samples: differences.length, maximumDifference: Math.max(...differences),
    changedSamples: differences.filter(d => d > 1e-9).length };
  rows.push(row); console.log(row);
}
const passed = rows.every(row => row.maximumDifference < 1e-9);
await writeFile(`artifacts/review/${process.env.REVIEW_PREFIX ?? '066'}-worm-translation-envelope.json`, JSON.stringify({ movement: 66, passed, teeth: parameters.teeth,
  method: 'An axially translated finite worm, with phase correction offset/lead, has the same infinite helical surface. The common centered interval is contained in both finite worms, and the enclosing centered interval contains both. Comparing the generated wheel radial fields for these two bounds checks whether trimming at either end changes the active hob envelope. This comparison uses the complete sampled generating field; actual translated-mesh force and containment checks remain required.',
  sourceOffsetPixels: 34, offset, localAxisTranslation: -offset, phaseCorrection: -offset / (parameters.pitchRadius / parameters.teeth), rows }, null, 2) + '\n');
if (!passed) process.exitCode = 1;
