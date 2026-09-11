import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { wormWheelGeometry } from '../src/simulation/worm-gear-geometry.js';

// Regenerate 031 alone while preserving every other contact table verbatim.
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[30]);
const key = model.root.userData.blocks.wheel.userData.toothMesh.geometry.userData.profileKey;
const data = wormWheelGeometry(JSON.parse(key), { regenerate: true }).userData;
const profile = { key, id: data.profileId, angularSteps: data.angularSteps, axialSteps: data.axialSteps,
  phaseSteps: data.phaseSteps, radialSteps: data.radialSteps, clearance: data.clearance, radii: data.radii };
const path = 'src/data/contact-profiles.js', source = await readFile(path, 'utf8');
const lines = source.split('\n');
if (lines.filter(line => line.startsWith('export const wormCut = ')).length !== 1) throw new Error('Expected one worm profile export');
await writeFile(path, lines.map(line => line.startsWith('export const wormCut = ')
  ? `export const wormCut = ${JSON.stringify(profile)};` : line).join('\n'));
console.log({ profile: profile.id, samples: profile.radii.length });
