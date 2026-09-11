import { readFile, writeFile } from 'node:fs/promises';
import { bevelToothGeometry } from '../src/simulation/bevel-geometry.js';

// An isolated dimension study, not the production model or a contact proof.
const p = {
  sourceScale: 200, sourceOrigin: [610, 1066], driverHeight: 3.29,
  driverRadius: 1.385, sideDriverRadius: 0.725, pulleyRadius: 1.425,
  driverSpan: [-1.18, 0.60], sideDriverSpan: [0.61, 2.04],
  driverShaftRadius: 0.225, driverShaftSpan: [-2.485, 2.79],
  outputShaftRadius: 0.2125, outputShaftSpan: [-2.30, 2.55],
  pulleySpans: [[-0.91, -0.30], [-0.29, 0.27], [0.28, 0.865], [0.875, 1.4]],
  bandZs: [-0.55, -0.04, 0.435], sideBandZ: 1.125,
  beltWidth: 0.30, beltThickness: 0.02, beltClearance: 0.00015,
  looseBore: 0.2185, sideHubRadius: 0.27, carrierBore: 0.276,
  rimInnerRadius: 1.24, directWebEnd: -0.27, carrierWebStart: 0.848,
  bevelCenterZ: 0.45, sideTeeth: 34, planetTeeth: 20,
  sideInnerDistance: 0.215, sideOuterDistance: 0.35,
  toothHeight: 0.072, pressureAngle: Math.PI / 9,
  toothThicknessFactor: 0.999, flankSegments: 64, tipSegments: 16,
  planetSpindleRadius: 0.055, planetBore: 0.061,
  planetSpindleSpan: [0.245, 1.255], planetHubEnd: 0.795,
};
p.sideConeAngle = Math.atan(p.sideTeeth / p.planetTeeth);
p.planetConeAngle = Math.PI / 2 - p.sideConeAngle;
p.planetInnerDistance = p.sideInnerDistance * p.sideTeeth / p.planetTeeth;
p.planetOuterDistance = p.sideOuterDistance * p.sideTeeth / p.planetTeeth;
const side = bevelToothGeometry({ ...p, teeth: p.sideTeeth,
  innerDistance: p.sideInnerDistance, outerDistance: p.sideOuterDistance,
  pitchConeAngle: p.sideConeAngle });
const planet = bevelToothGeometry({ ...p, teeth: p.planetTeeth,
  innerDistance: p.planetInnerDistance, outerDistance: p.planetOuterDistance,
  pitchConeAngle: p.planetConeAngle });
side.computeBoundingBox(); planet.computeBoundingBox();
const upperCenter = p.sourceOrigin[1] - p.driverHeight * p.sourceScale;
const outline = (center, radius) => [center - p.sourceScale * radius, center + p.sourceScale * radius];
const measurements = JSON.parse(await readFile('artifacts/review/062-source-envelope-measurement.json', 'utf8'));
const sourceResiduals = measurements.rows.map(({ name, top, bottom }) => {
  let predicted;
  if (name.startsWith('driver-drum')) predicted = outline(upperCenter, p.driverRadius);
  else if (name.startsWith('small-driver')) predicted = outline(upperCenter, p.sideDriverRadius);
  else if (name.startsWith('driver-shaft')) predicted = outline(upperCenter, p.driverShaftRadius);
  else if (name.startsWith('output-shaft')) predicted = outline(p.sourceOrigin[1], p.outputShaftRadius);
  else predicted = outline(p.sourceOrigin[1], p.pulleyRadius);
  return { name, predicted, topResidual: predicted[0] - top, bottomResidual: predicted[1] - bottom };
});
const neutralOffset = p.beltThickness / 2 + p.beltClearance;
const mainRatio = (p.driverRadius + neutralOffset) / (p.pulleyRadius + neutralOffset);
const sideRatio = (p.sideDriverRadius + neutralOffset) / (p.pulleyRadius + neutralOffset);
const report = {
  status: 'provisional-dimension-study-not-integrated-or-contact-verified', parameters: p,
  sourceResiduals,
  maximumMeasuredOutlineResidual: Math.max(...sourceResiduals.flatMap(row => [Math.abs(row.topResidual), Math.abs(row.bottomResidual)])),
  ratios: { main: mainRatio, auxiliaryMagnitude: sideRatio,
    openCarrierDriveOutput: 2 * mainRatio - sideRatio,
    crossedCarrierDriveOutput: 2 * mainRatio + sideRatio },
  necessaryClearances: {
    sideGearBodyToCarrierWeb: p.carrierWebStart - (p.bevelCenterZ + side.userData.root.z),
    carrierBearingRadial: p.carrierBore - p.sideHubRadius,
    looseBearingRadial: p.looseBore - p.outputShaftRadius,
    spindleToMainShaft: p.planetSpindleSpan[0] - p.outputShaftRadius,
    planetBearingRadial: p.planetBore - p.planetSpindleRadius,
    selectorBandAtUpperRightEdge: p.driverSpan[1] - p.bandZs[2] - p.beltWidth / 2,
    selectorBandAtCarrierLeftEdge: p.bandZs[2] - p.beltWidth / 2 - p.pulleySpans[2][0],
  },
  actualToothBounds: { side: side.boundingBox, planet: planet.boundingBox },
  limits: 'Measured drum and shaft envelopes use chosen concentric axes; source centers disagree. Tooth bounds are actual Float32 geometry, but this study does not assemble or test meshes against each other, verify working flanks or band surfaces, decide neutral dynamics, or implement separate open/crossed configurations. Tooth counts and concealed bearings are inferred.',
};
await writeFile('artifacts/review/062-provisional-layout.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ maximumMeasuredOutlineResidual: report.maximumMeasuredOutlineResidual,
  ratios: report.ratios, necessaryClearances: report.necessaryClearances }, null, 2));
