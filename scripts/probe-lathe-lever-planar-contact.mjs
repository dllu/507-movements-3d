import { writeFile } from 'node:fs/promises';
import { makeLatheLeverCandidate } from '../artifacts/review/056-candidate-model.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from './lib/coaxial-planar-distance.mjs';

const model = makeLatheLeverCandidate({ loadPhase: Number(process.env.LOAD_PHASE ?? 0.000412) });
const { parts, geometry: p } = model.root.userData;
const inputPoints = gearBoundary(parts.pinion), target = boundaryIndex(gearBoundary(parts.largeGear));
const count = Number(process.env.PROBE_POSES ?? 257);
const report = { configuration: p, method: 'Exact actual Float32 sidewall contours of axially overlapping gear extrusions.', poses: [] };
for (let i = 0; i <= count; i += 1) {
  let time = p.cycleDuration * i / count;
  if (process.env.PROBE_MODE === 'engaged-tooth') {
    const targetTurns = i / (count * p.pinionTeeth);
    let lo = 0, hi = 1;
    for (let step = 0; step < 55; step += 1) {
      const u = (lo + hi) / 2, turns = u ** 3 * (10 - 15 * u + 6 * u ** 2);
      if (turns < targetTurns) lo = u; else hi = u;
    }
    time = p.runDuration * (lo + hi) / 2;
  }
  model.update(time); model.root.updateMatrixWorld(true);
  const state = model.root.userData.kinematics;
  const transform = parts.largeGear.matrixWorld.clone().invert().multiply(parts.pinion.matrixWorld);
  const result = planarPairDistance(inputPoints, target, transform, 0.04);
  if (result.witness && result.distance > 0 && state.inputSpeed > 1e-10 && state.engaged) {
    const { a, b } = result.witness, nx = (b.x - a.x) / result.distance, ny = (b.y - a.y) / result.distance;
    const outputTorque = b.x * ny - b.y * nx;
    const inputTorque = (a.x - transform.elements[12]) * ny - (a.y - transform.elements[13]) * nx;
    const inputPower = inputTorque * state.inputSpeed, outputPower = outputTorque * state.outputSpeed;
    result.unitNormalForce = { inputTorque, outputTorque, inputPower, outputPower,
      relativePowerResidual: Math.abs(inputPower - outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower)) };
  }
  report.poses.push({ time, branch: state.branch, ...result });
}
const engaged = report.poses.filter(v => v.branch === 'engaged-run'), forces = engaged.filter(v => v.unitNormalForce).map(v => v.unitNormalForce);
report.summary = { poses: report.poses.length, intersections: report.poses.reduce((sum, v) => sum + v.intersections, 0),
  engagedMinimumGap: Math.min(...engaged.map(v => v.distance)), engagedMaximumGap: Math.max(...engaged.map(v => v.distance)),
  minimumInputPower: Math.min(...forces.map(v => v.inputPower)), minimumOutputPower: Math.min(...forces.map(v => v.outputPower)),
  maximumPowerResidual: Math.max(...forces.map(v => v.relativePowerResidual)),
  intersectingBranches: [...new Set(report.poses.filter(v => v.intersections).map(v => v.branch))] };
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/056-candidate-planar-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.intersections) process.exitCode = 1;
