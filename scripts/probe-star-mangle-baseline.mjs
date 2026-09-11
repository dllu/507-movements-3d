import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[53]), p = model.root.userData.geometry, b = model.root.userData.blocks;
const targets = [], cache = new Map();
b.pinion.traverse((mesh) => {
  if (!mesh.geometry || mesh.userData.rotationIndicator) return;
  targets.push({ mesh, surface: solidSurface(mesh.geometry) });
});
const sources = [...b.facePins, ...b.toothWebs].map((mesh) => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, surfacePoints(mesh.geometry));
  return { mesh, points: cache.get(mesh.geometry) };
});
const steps = Number(process.env.MANGLE_CONTACT_STEPS ?? 128), report = { movement: 54, poses: steps + 1,
  scope: 'Actual wheel-pin and web vertices, face centers and edge midpoints against closed pinion solids. The open, uncapped rims are not used as inside-test targets.',
  surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0, witness: null, branches: {} };
for (let i = 0; i <= steps; i += 1) {
  const time = p.cycleDuration * i / steps;
  model.update(time); model.root.updateMatrixWorld(true);
  const branch = model.root.userData.kinematics.branch;
  report.branches[branch] ??= { surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0 };
  const entry = report.branches[branch];
  for (const { mesh: from, points } of sources) for (const { mesh: to, surface } of targets) {
    const transform = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
    const box = from.geometry.boundingBox ?? (from.geometry.computeBoundingBox(), from.geometry.boundingBox);
    if (!box.clone().applyMatrix4(transform).intersectsBox(surface.box)) continue;
    for (const v of points) {
      const q = v.clone().applyMatrix4(transform); report.surfaceChecks += 1; entry.surfaceChecks += 1;
      if (!surface.inside(q)) continue;
      const depth = surface.distance(q); if (depth < 1e-6) continue;
      report.penetratingSamples += 1; entry.penetratingSamples += 1; entry.maximumDepth = Math.max(entry.maximumDepth, depth);
      if (depth > report.maximumDepth) { report.maximumDepth = depth; report.witness = { time, branch,
        source: from.userData.facePin ? 'facePin' : 'toothWeb', sourceIndex: from.userData.index, target: to.geometry.type,
        point: v.toArray(), worldPoint: v.clone().applyMatrix4(from.matrixWorld).toArray() }; }
    }
  }
}
await writeFile('artifacts/review/054-contact-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
