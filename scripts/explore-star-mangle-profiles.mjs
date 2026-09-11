import { writeFile } from 'node:fs/promises';
import { starMangleMotion } from '../src/simulation/star-mangle-motion.js';
import { boredSpurGeometry } from '../src/simulation/jaw-clutch-geometry.js';
import { cutRadialTooth } from './lib/star-mangle-cutter.mjs';

const motion = starMangleMotion({ wheelPositions: Number(process.env.WHEEL_TEETH ?? 44),
  pinionTeeth: Number(process.env.PINION_TEETH ?? 6), omittedTeeth: Number(process.env.OMITTED_TEETH ?? 3),
  pinionPressureAngle: process.env.PINION_PRESSURE_DEGREES ? Number(process.env.PINION_PRESSURE_DEGREES) * Math.PI / 180 : undefined,
  pinionProfileShift: process.env.PROFILE_SHIFT ? Number(process.env.PROFILE_SHIFT) : undefined,
  pinionAddendumCoefficient: process.env.ADDENDUM_COEFFICIENT ? Number(process.env.ADDENDUM_COEFFICIENT) : undefined }), p = motion.parameters;
const pinionDepth = 0.34, radialStart = 1.31, radialEnd = Number(process.env.RADIAL_END ?? 1.79), stockRadius = Number(process.env.STOCK_FACTOR ?? 1.19) * p.module;
const cutterDepth = pinionDepth + 2 * Number(process.env.CUTTER_OVERTRAVEL ?? 0);
const stockTangentialRadius = Number(process.env.TANGENTIAL_FACTOR ?? process.env.STOCK_FACTOR ?? 1.19) * p.module;
const pinion = boredSpurGeometry({ teeth: p.pinionTeeth, module: p.module, depth: pinionDepth, boreRadius: 0.04,
  pressureAngle: p.pinionPressureAngle, profileShift: p.pinionProfileShift, addendumCoefficient: p.pinionAddendumCoefficient });
const teeth = [], indices = (process.env.TOOTH_INDICES ?? `0,1,${Math.floor(p.toothCount / 2)},${p.toothCount - 1}`).split(',').map(Number);
for (const toothIndex of indices) {
  const start = performance.now();
  const profile = cutRadialTooth({ motion, toothIndex, outline: pinion.userData.outline, pinionDepth: cutterDepth,
    radialStart, radialEnd, stockRadius, stockTangentialRadius, conservativeRadial: process.env.CONSERVATIVE_RADIAL !== '0',
    outerReliefStart: process.env.OUTER_RELIEF_START ? Number(process.env.OUTER_RELIEF_START) : null,
    outerReliefHeight: process.env.OUTER_RELIEF_HEIGHT ? Number(process.env.OUTER_RELIEF_HEIGHT) : null,
    collarOffset: process.env.COLLAR_CUTTER ? 0.265 : null, clearance: Number(process.env.CUT_CLEARANCE ?? 0.0002),
    samplesPerTurn: Number(process.env.CUTTER_STEPS ?? 512),
    radialBands: Number(process.env.RADIAL_BANDS ?? 16), angularSamples: Number(process.env.ANGULAR_SAMPLES ?? 128) });
  teeth.push(profile);
  console.log(JSON.stringify({ toothIndex, seconds: (performance.now() - start) / 1000,
    activePoses: profile.activePoses, rayChecks: profile.rayChecks, centerCuts: profile.centerCuts,
    minimumRadius: Math.min(...profile.heights.flat()), maximumRadius: Math.max(...profile.heights.flat()) }));
}
await writeFile(process.env.PROFILE_OUTPUT ?? 'artifacts/review/054-candidate-profiles.json',
  JSON.stringify({ status: 'candidate-not-yet-validated', parameters: p, pinionDepth, cutterDepth, radialStart, radialEnd,
    stockRadius, stockTangentialRadius, teeth }) + '\n');
