import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[54]), b = model.root.userData.blocks;
const targets = []; b.pinionB.traverse((mesh) => { if (mesh.geometry) targets.push({ mesh, surface: solidSurface(mesh.geometry) }); });
const spokes = b.supportSpokes.map((mesh) => ({ mesh, points: surfacePoints(mesh.geometry) }));
const period = 2 * Math.PI / Math.abs(model.root.userData.kinematics.gearCAngularSpeed);
const report = { movement: 55, poses: 129, scope: 'Actual ring-support spoke surfaces against the fixed-axis rotating pinion solids through one ring revolution.',
  surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0, witness: null };
for (let i = 0; i < report.poses; i += 1) {
  const time = period * i / (report.poses - 1); model.update(time); model.root.updateMatrixWorld(true);
  for (const { mesh: from, points } of spokes) for (const { mesh: to, surface } of targets) {
    const transform = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
    for (const point of points) {
      const q = point.clone().applyMatrix4(transform); report.surfaceChecks += 1;
      if (!surface.inside(q)) continue;
      const depth = surface.distance(q); if (depth < 1e-6) continue;
      report.penetratingSamples += 1;
      if (depth > report.maximumDepth) { report.maximumDepth = depth; report.witness = { time, spokeIndex: from.userData.index,
        target: to.geometry.type, worldPoint: point.clone().applyMatrix4(from.matrixWorld).toArray() }; }
    }
  }
}
await writeFile('artifacts/review/055-support-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
