import { writeFile } from 'node:fs/promises';
import { generateWormWheelProfile } from '../src/simulation/worm-wheel-profile.js';

for (const teeth of [24, 26, 28]) {
  const pitchRadius = 1.375 / (1 + 2 / teeth);
  const parameters = { teeth, pitchRadius, wormPitchRadius: 319 / (280 / 1.375) - pitchRadius,
    wormLength: 210 / (280 / 1.375), depth: 0.22, pressureAngle: Math.PI / 9 };
  const started = Date.now();
  const profile = generateWormWheelProfile(parameters, { phaseSteps: 1600, radialSteps: 80, clearance: 0.0004 });
  await writeFile(`artifacts/review/067-${teeth}-tooth-worm-profile.json`, JSON.stringify({ parameters, profile }, null, 2) + '\n', { flag: 'wx' });
  console.log({ teeth, seconds: (Date.now() - started) / 1000, samples: profile.radii.length });
}
