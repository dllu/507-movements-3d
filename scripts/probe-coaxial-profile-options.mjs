import { writeFile } from 'node:fs/promises';
import { makeCoaxialCandidate } from '../artifacts/review/055-candidate-model.mjs';
import { gearBoundary, boundaryIndex, planarPairDistance } from './lib/coaxial-planar-distance.mjs';

const report = [];
for (const [degrees, internalAddendum] of [[20, 0.045], [22.5, 0.06], [23, 0.065], [24, 0.07], [25, 0.08]]) {
  const model = makeCoaxialCandidate({ pressureAngle: degrees * Math.PI / 180, internalAddendum });
  const { parts, geometry: p } = model.root.userData, input = gearBoundary(parts.pinionMesh);
  const record = { degrees, internalAddendum, outputs: {} };
  for (const [name, target] of [['A', parts.gearAMesh], ['C', parts.ringMesh]]) {
    const index = boundaryIndex(gearBoundary(target)), result = { minimumGap: Infinity, maximumGap: 0, intersections: 0 };
    for (let i = 0; i < 257; i += 1) {
      model.update(2 * Math.PI / (p.pinionTeeth * p.inputSpeed) * (i + 0.413) / 257); model.root.updateMatrixWorld(true);
      const contact = planarPairDistance(input, index, target.matrixWorld.clone().invert().multiply(parts.pinionMesh.matrixWorld));
      result.minimumGap = Math.min(result.minimumGap, contact.distance); result.maximumGap = Math.max(result.maximumGap, contact.distance);
      result.intersections += contact.intersections;
    }
    record.outputs[name] = result;
  }
  report.push(record); console.log(JSON.stringify(record));
}
await writeFile('artifacts/review/055-profile-options.json', JSON.stringify(report, null, 2) + '\n');
