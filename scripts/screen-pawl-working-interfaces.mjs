// Bounded defect screen for the next shared pawl pass; not qualification.
import * as THREE from 'three';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const results = [];
for (const id of [225, 235, 236]) {
  const model = create({ id });
  const data = model.root.userData;
  const blocks = data.blocks;
  const wheel = blocks.ratchet.userData.body;
  const noses = id === 225 ? [blocks.pawlNose] : id === 235
    ? [blocks.tappetNose, blocks.holdingClickNose]
    : [blocks.longPawlContactFinger, blocks.shortPawlContactFinger];
  const solid = solidSurface(wheel.geometry);
  for (const nose of noses) {
    const points = surfacePoints(nose.geometry);
    let minimumGap = Infinity;
    let witness;
    let maximumClaimedMomentArm = 0;
    for (let step = 0; step <= 64; step += 1) {
      const time = data.canonicalTimes.cycleClosure * step / 64;
      model.update(time);
      model.root.updateMatrixWorld(true);
      const transform = wheel.matrixWorld.clone().invert().multiply(nose.matrixWorld);
      for (const point of points) {
        const local = point.clone().applyMatrix4(transform);
        // Distances larger than 0.2 are deliberately capped: this checks
        // near-surface witnesses, not the full separation history.
        const gap = solid.signedDistance(local, 0.2);
        if (gap < minimumGap) {
          minimumGap = gap;
          witness = { time, phase: step / 64, wheelLocalPoint: local.toArray() };
        }
      }
      if (id === 225 && data.kinematics.driving) {
        const state = data.kinematics;
        const point = state.pawlContactPoint;
        const normal = state.pawlContactCenter.clone().sub(point).normalize();
        maximumClaimedMomentArm = Math.max(maximumClaimedMomentArm,
          Math.abs(point.x * normal.y - point.y * normal.x));
      }
    }
    const noseBox = new THREE.Box3().setFromObject(nose);
    const wheelBox = new THREE.Box3().setFromObject(wheel);
    results.push({
      id, role: nose.userData.role, minimumGap, witness,
      noseDepth: [noseBox.min.z, noseBox.max.z],
      wheelDepth: [wheelBox.min.z, wheelBox.max.z],
      ...(id === 225 ? { maximumClaimedMomentArm } : {}),
    });
  }
}
console.log(JSON.stringify({
  scope: '65-pose finite-surface and depth screen; excludes passive dynamics and exhaustive collision checking',
  results,
}, null, 2));
