import { writeFile } from 'node:fs/promises';
import { makeTwoSpeedSelectorCandidate } from '../artifacts/review/059-candidate-model.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from './lib/coaxial-planar-distance.mjs';

const model = makeTwoSpeedSelectorCandidate(), { parts, geometry: p } = model.root.userData;
const count = Number(process.env.PROBE_POSES ?? 257), poses = [];
for (let pair = 0; pair < p.inputTeeth.length; pair += 1) {
  const input = parts[`inputGear${pair}`], output = parts[`outputGear${pair}`];
  const points = gearBoundary(input), target = boundaryIndex(gearBoundary(output));
  for (let i = 0; i < count; i += 1) {
    // The slow dwell advances less than one tooth of the nine-tooth output.
    // Use the quick dwell so that every requested tooth phase is reachable.
    const progress = 2 * Math.PI / p.driverTurnPerDwell * p.outputTeeth[1] / (p.inputTeeth[1] * p.outputTeeth[pair]) * (i + 0.317) / count;
    if (progress < 0 || progress >= 1) throw new Error('Tooth-cycle sample lies outside the selected dwell');
    let lo = 0, hi = 1;
    for (let step = 0; step < 55; step += 1) { const u = (lo + hi) / 2; if (u ** 3 * (10 - 15 * u + 6 * u ** 2) < progress) lo = u; else hi = u; }
    const time = 2 * p.stageDuration + p.dwellDuration * (lo + hi) / 2;
    model.update(time); model.root.updateMatrixWorld(true);
    const transform = output.matrixWorld.clone().invert().multiply(input.matrixWorld);
    for (const direction of [-1, 1]) {
      // Positive direction is positive torque on the output from a
      // compressive normal pointing from the output skin toward the input.
      const accepts = (a, b) => direction * (b.y * (a.x - b.x) - b.x * (a.y - b.y)) > 0;
      const result = planarPairDistance(points, target, transform, 0.005, accepts);
      if (result.witness && result.distance > 0) {
        const { a, b } = result.witness, nx = (a.x - b.x) / result.distance, ny = (a.y - b.y) / result.distance;
        const inputTorque = (a.x - transform.elements[12]) * ny - (a.y - transform.elements[13]) * nx;
        const outputTorque = b.y * nx - b.x * ny;
        const inputSpeed = model.root.userData.kinematics.inputSpeeds[pair], outputSpeed = model.root.userData.kinematics.outputSpeed;
        const inputPower = inputTorque * inputSpeed, outputPower = outputTorque * outputSpeed;
        result.force = { inputTorque, outputTorque, inputPower, outputPower,
          powerResidual: Math.abs(inputPower + outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower)) };
      }
      poses.push({ pair, direction, time, ...result });
    }
  }
  console.log(`Checked pair ${pair}`);
}
const summary = [];
for (let pair = 0; pair < p.inputTeeth.length; pair += 1) for (const direction of [-1, 1]) {
  const rows = poses.filter(v => v.pair === pair && v.direction === direction);
  summary.push({ pair, direction, poses: rows.length, minimumGap: Math.min(...rows.map(v => v.distance)), maximumGap: Math.max(...rows.map(v => v.distance)),
    intersections: rows.reduce((s, v) => s + v.intersections, 0), maximumPowerResidual: Math.max(...rows.map(v => v.force?.powerResidual ?? Infinity)) });
}
await writeFile('artifacts/review/059-candidate-gear-contact.json', JSON.stringify({ geometry: p, method: 'Exact actual Float32 contours, both compressive torque directions for each pair over one complete relative tooth cycle during the quick dwell. Every sample is checked to be reachable within that dwell. All intersections counted regardless of selected flank.', summary, poses }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (summary.some(v => v.intersections || v.minimumGap <= 1e-6 || v.maximumGap > 0.00006 || v.maximumPowerResidual > 0.01)) process.exitCode = 1;
