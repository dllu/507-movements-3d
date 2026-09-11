import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const data = JSON.parse(await readFile(process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate-profiles-overtravel.json', 'utf8'));
const contactMap = process.env.MAP_INPUT ? JSON.parse(await readFile(process.env.MAP_INPUT, 'utf8')) : null;
const model = makeStarMangleCandidate(data, { contactMap }), parts = model.root.userData.parts, p = model.root.userData.geometry;
const cache = new Map(), tree = (mesh) => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, triangleTree(mesh.geometry));
  return cache.get(mesh.geometry);
};
const report = { status: 'candidate', method: 'Closest triangle skins including edge-to-edge minima and crossings, in the pinion frame.',
  contactMap: process.env.MAP_INPUT ?? null, poses: [] };
const phases = (process.env.GAP_PATHS ?? '66.50992820418958').split(',').map(Number);
const count = Number(process.env.GAP_STEPS ?? 0);
for (let i = 0; i < count; i += 1) phases.push(p.cycleTravel * (i + 0.431) / count);
if (process.env.GAP_CROSSOVERS) for (const start of [p.runTravel, p.returnStart]) {
  for (const fraction of [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]) phases.push(start + Math.PI * fraction);
}
for (const travel of phases) {
  model.root.userData.updateTravel(travel); model.root.updateMatrixWorld(true);
  const inverse = parts.pinion.matrixWorld.clone().invert(); let nearest = { distance: 0.01 }, testedTriangles = 0;
  for (const tooth of parts.teeth) {
    const result = meshPairDistance(tree(tooth), tree(parts.pinion), inverse.clone().multiply(tooth.matrixWorld), nearest.distance);
    testedTriangles += result.testedTriangles;
    if (result.distance < nearest.distance) nearest = { ...result, toothIndex: tooth.userData.index };
  }
  const result = { travel, branch: model.root.userData.kinematics.branch, ...nearest, testedTriangles };
  report.poses.push(result); console.log(JSON.stringify(result));
}
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/054-candidate-exact-gap.json', JSON.stringify(report, null, 2) + '\n');
