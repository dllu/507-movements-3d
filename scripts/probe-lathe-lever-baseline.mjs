import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[55]), { blocks, geometry: p } = model.root.userData;
const gear = block => block.userData.rotor.children.find(v => v.geometry?.type === 'ExtrudeGeometry');
const meshes = [gear(blocks.pinion), gear(blocks.largeGear)];
const data = meshes.map(mesh => ({ mesh, solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) }));
const report = { movement: 56, status: 'uncorrected-baseline', poses: [], checks: 0, inside: 0, maximumDepth: 0 };
for (let i = 0; i < 129; i += 1) {
  const time = p.cycleDuration * (i + 0.317) / 129; model.update(time); model.root.updateMatrixWorld(true);
  const record = { time, branch: model.root.userData.kinematics.branch, checks: 0, inside: 0, maximumDepth: 0, nearestSampleGap: 0.08 };
  for (const [a, b] of [[data[0], data[1]], [data[1], data[0]]]) {
    const transform = b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    for (const point of a.points) {
      const q = point.clone().applyMatrix4(transform); record.checks += 1;
      if (!b.solid.inside(q)) { record.nearestSampleGap = Math.min(record.nearestSampleGap, b.solid.distance(q, record.nearestSampleGap)); continue; }
      const depth = b.solid.distance(q); if (depth < 1e-6) continue;
      record.inside += 1; record.maximumDepth = Math.max(record.maximumDepth, depth);
    }
  }
  report.poses.push(record); report.checks += record.checks; report.inside += record.inside; report.maximumDepth = Math.max(report.maximumDepth, record.maximumDepth);
}
await writeFile('artifacts/review/056-tooth-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checks: report.checks, inside: report.inside, maximumDepth: report.maximumDepth,
  intersectingPoses: report.poses.filter(p => p.inside).length }));
