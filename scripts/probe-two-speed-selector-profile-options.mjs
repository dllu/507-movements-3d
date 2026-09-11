import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { selectorGearGeometry } from '../src/simulation/three-speed-selector-geometry.js';
import { gearBoundary, boundaryIndex, planarPairDistance } from './lib/coaxial-planar-distance.mjs';

const centerDistance = 1.3325, module = 2 * centerDistance / 54, rows = [];
for (const degrees of [20, 25, 30]) {
  for (const [inputTeeth, outputTeeth, inputBore] of [[12, 42, 0.1425], [45, 9, 0.2725]]) {
    const gear = (teeth, boreRadius) => new THREE.Mesh(selectorGearGeometry({ teeth, module, depth: 0.4,
      boreRadius, backlash: 0.00002, pressureAngle: degrees * Math.PI / 180 }));
    const input = gear(inputTeeth, inputBore), output = gear(outputTeeth, 0.14);
    output.position.y = -centerDistance;
    const inputPhase = Math.PI / 2;
    const outputPhase = ((outputTeeth - 1) * Math.PI - (inputTeeth + outputTeeth) * Math.PI / 2 - inputTeeth * inputPhase) / outputTeeth;
    const points = gearBoundary(input), target = boundaryIndex(gearBoundary(output));
    const contacts = [];
    for (let i = 0; i < 129; i += 1) {
      const angle = 2 * Math.PI / inputTeeth * (i + 0.317) / 129;
      input.rotation.z = inputPhase + angle; output.rotation.z = outputPhase - angle * inputTeeth / outputTeeth;
      input.updateMatrixWorld(true); output.updateMatrixWorld(true);
      const transform = output.matrixWorld.clone().invert().multiply(input.matrixWorld);
      for (const direction of [-1, 1]) {
        const result = planarPairDistance(points, target, transform, 0.005,
          (a, b) => direction * (b.y * (a.x - b.x) - b.x * (a.y - b.y)) > 0);
        if (result.witness && result.distance > 0) {
          const { a, b } = result.witness, nx = (a.x - b.x) / result.distance, ny = (a.y - b.y) / result.distance;
          const inputTorque = (a.x - transform.elements[12]) * ny - (a.y - transform.elements[13]) * nx;
          const outputTorque = b.y * nx - b.x * ny;
          const inputPower = inputTorque, outputPower = -outputTorque * inputTeeth / outputTeeth;
          result.powerResidual = Math.abs(inputPower + outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower));
        }
        contacts.push({ direction, ...result });
      }
    }
    rows.push({ degrees, inputTeeth, outputTeeth, contacts: contacts.length,
      minimumGap: Math.min(...contacts.map(v => v.distance)), maximumGap: Math.max(...contacts.map(v => v.distance)),
      intersections: contacts.reduce((s, v) => s + v.intersections, 0),
      maximumPowerResidual: Math.max(...contacts.map(v => v.powerResidual ?? Infinity)) });
    console.log(JSON.stringify(rows.at(-1)));
    input.geometry.dispose(); output.geometry.dispose();
  }
}
await writeFile('artifacts/review/059-profile-options.json', JSON.stringify({
  method: 'Unused profile feasibility comparison. Each pair uses the same measured shaft spacing, compatible inferred tooth counts, rounded rack-generated roots, real bores and both actual Float32 torque flanks over one relative tooth cycle. This is not a full mechanism candidate or assembly audit.',
  centerDistance, module, rows,
}, null, 2) + '\n');
