import { writeFile } from 'node:fs/promises';
import { makeCoaxialCandidate } from '../artifacts/review/055-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const model = makeCoaxialCandidate(), { parts, blocks, geometry: p } = model.root.userData;
const input = parts.pinionMesh, outputs = { A: parts.gearAMesh, C: blocks.gearC.userData.rotor.children[0] };
const trees = new Map([input, ...Object.values(outputs)].map(mesh => [mesh, triangleTree(mesh.geometry)]));
const period = 2 * Math.PI / (p.pinionTeeth * p.inputSpeed), count = Number(process.env.EXACT_POSES ?? 17);
const report = { method: 'Closest actual extruded triangle skins, including edge/edge minima and crossings.', poses: [] };
for (let i = 0; i < count; i += 1) {
  const time = period * (i + 0.413) / count; model.update(time); model.root.updateMatrixWorld(true);
  for (const [name, output] of Object.entries(outputs)) {
    const transform = output.matrixWorld.clone().invert().multiply(input.matrixWorld);
    const result = { time, output: name, ...meshPairDistance(trees.get(input), trees.get(output), transform, 0.01) };
    report.poses.push(result); console.log(JSON.stringify(result));
  }
}
for (const name of Object.keys(outputs)) {
  const values = report.poses.filter(v => v.output === name);
  report[name] = { poses: values.length, minimumGap: Math.min(...values.map(v => v.distance)), maximumGap: Math.max(...values.map(v => v.distance)) };
}
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/055-candidate-exact-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ A: report.A, C: report.C }));
