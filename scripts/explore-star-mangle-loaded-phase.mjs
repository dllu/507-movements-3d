import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const data = JSON.parse(await readFile(process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate-profiles-overtravel.json', 'utf8'));
const model = makeStarMangleCandidate(data), parts = model.root.userData.parts, p = model.root.userData.geometry;
const cache = new Map(), tree = (mesh) => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, triangleTree(mesh.geometry));
  return cache.get(mesh.geometry);
};
const pinionTree = tree(parts.pinion), report = { status: 'loaded-contact-pilot-only', phaseBackoff: 0.0001,
  method: 'Hold the wheel and collar on one geometric path station. Advance the pinion to the first exact triangle-skin crossing, then retain a small angular clearance. A final motion map must invert input = path + advance and verify unilateral forces and interpolation.', poses: [] };
const phases = [66.50992820418958];
for (const start of [p.runTravel, p.returnStart]) for (const fraction of [0, 0.25, 0.5, 0.75, 1]) phases.push(start + fraction * Math.PI);
for (let i = 0; i < Number(process.env.LOAD_STEPS ?? 8); i += 1) phases.push(p.cycleTravel * (i + 0.431) / Number(process.env.LOAD_STEPS ?? 8));
for (const travel of phases) {
  const startTime = performance.now(); model.root.userData.updateTravel(travel); model.root.updateMatrixWorld(true);
  const baseRotation = parts.pinion.parent.rotation.z, initialInverse = parts.pinion.matrixWorld.clone().invert();
  const expandedBox = pinionTree.box.clone().expandByScalar(0.03);
  const teeth = parts.teeth.filter((tooth) => tree(tooth).box.clone().applyMatrix4(initialInverse.clone().multiply(tooth.matrixWorld)).intersectsBox(expandedBox));
  const atAdvance = (advance, maximum) => {
    parts.pinion.parent.rotation.z = baseRotation + advance; model.root.updateMatrixWorld(true);
    const inverse = parts.pinion.matrixWorld.clone().invert(); let nearest = { distance: maximum };
    for (const tooth of teeth) {
      const result = meshPairDistance(tree(tooth), pinionTree, inverse.clone().multiply(tooth.matrixWorld), nearest.distance);
      if (result.distance < nearest.distance) nearest = { ...result, tooth: tooth.userData.index };
      if (nearest.distance === 0) break;
    }
    return nearest;
  };
  let lower = 0, upper = 0.02;
  if (atAdvance(0, 1e-9).distance < 1e-9) throw new Error(`Initial skin crossing at ${travel}`);
  while (atAdvance(upper, 1e-9).distance >= 1e-9) {
    upper *= 2; if (upper > 0.08) throw new Error(`No driving-flank crossing near ${travel}`);
  }
  for (let i = 0; i < 20; i += 1) {
    const middle = (lower + upper) / 2;
    if (atAdvance(middle, 1e-9).distance < 1e-9) upper = middle; else lower = middle;
  }
  const advance = Math.max(0, lower - report.phaseBackoff), contact = atAdvance(advance, 0.01);
  const result = { pathTravel: travel, inputTravel: travel + advance, phaseAdvance: advance,
    branch: model.root.userData.kinematics.branch, ...contact, seconds: (performance.now() - startTime) / 1000 };
  report.poses.push(result); console.log(JSON.stringify(result));
}
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/054-candidate-loaded-phase-pilot.json', JSON.stringify(report, null, 2) + '\n');
