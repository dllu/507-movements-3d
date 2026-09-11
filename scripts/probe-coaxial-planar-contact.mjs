import { writeFile } from 'node:fs/promises';
import { gearBoundary, boundaryIndex, planarPairDistance } from './lib/coaxial-planar-distance.mjs';

const factory = await import(process.env.COAXIAL_SHARP ? '../artifacts/review/055-candidate-sharp-rack-model.mjs' : '../artifacts/review/055-candidate-model.mjs');
const model = factory.makeCoaxialCandidate({ gearALoadPhase: Number(process.env.A_PHASE ?? 0.000928), gearCLoadPhase: Number(process.env.C_PHASE ?? -0.000417),
  pressureAngle: Number(process.env.PRESSURE_DEGREES ?? 25) * Math.PI / 180, internalAddendum: Number(process.env.C_ADDENDUM ?? 0.08) });
const { parts, blocks, geometry: p } = model.root.userData, input = parts.pinionMesh;
const outputs = { A: parts.gearAMesh, C: blocks.gearC.userData.rotor.children[0] }, inputPoints = gearBoundary(input);
const targets = Object.fromEntries(Object.entries(outputs).map(([name, mesh]) => [name, boundaryIndex(gearBoundary(mesh))]));
const report = { configuration: p, method: 'Exact Float32 XY boundary segments of axially overlapping straight extrusions.', phases: [], summaries: {} };
const count = Number(process.env.PROBE_POSES ?? 129), period = 2 * Math.PI / (p.pinionTeeth * p.inputSpeed);
for (let i = 0; i < count; i += 1) {
  const time = period * (i + 0.413) / count; model.update(time); model.root.updateMatrixWorld(true);
  for (const [name, output] of Object.entries(outputs)) {
    const transform = output.matrixWorld.clone().invert().multiply(input.matrixWorld);
    const result = planarPairDistance(inputPoints, targets[name], transform);
    if (result.distance > 0 && result.witness) {
      const { a, b } = result.witness, nx = (b.x - a.x) / result.distance, ny = (b.y - a.y) / result.distance;
      const outputTorque = b.x * ny - b.y * nx;
      const inputTorque = (a.x - transform.elements[12]) * ny - (a.y - transform.elements[13]) * nx;
      const outputSpeed = (name === 'A' ? -1 : 1) * p.inputSpeed * p.pinionTeeth / (name === 'A' ? p.gearATeeth : p.gearCTeeth);
      const inputPower = inputTorque * p.inputSpeed, outputPower = outputTorque * outputSpeed;
      result.unitNormalForce = { inputTorque, outputTorque, inputPower, outputPower,
        relativePowerResidual: Math.abs(inputPower - outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower)) };
    }
    report.phases.push({ time, output: name, ...result });
  }
}
for (const name of Object.keys(outputs)) {
  const values = report.phases.filter(v => v.output === name);
  report.summaries[name] = { poses: values.length, minimumGap: Math.min(...values.map(v => v.distance)),
    maximumGap: Math.max(...values.map(v => v.distance)), intersections: values.reduce((sum, v) => sum + v.intersections, 0),
    worst: values.reduce((a, b) => a.distance > b.distance ? a : b),
    minimumInputPower: Math.min(...values.map(v => v.unitNormalForce?.inputPower ?? -Infinity)),
    minimumOutputPower: Math.min(...values.map(v => v.unitNormalForce?.outputPower ?? -Infinity)),
    maximumPowerResidual: Math.max(...values.map(v => v.unitNormalForce?.relativePowerResidual ?? Infinity)) };
}
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/055-rounded-rack-planar-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summaries, null, 2));
