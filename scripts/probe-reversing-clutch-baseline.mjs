import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

// Historical 053 baseline. Measure actual jaw skins while the old state
// reports that the corresponding gear is driving the keyed output clutch.
const catalog = JSON.parse(await readFile('src/data/movements.json'));
const model = createMovementModel(catalog.movements[52]), { blocks: b, geometry: p } = model.root.userData;
const parts = (group) => group.children.filter((mesh) => mesh.userData.clutchDog)
  .map((mesh) => ({ mesh, points: surfacePoints(mesh.geometry), skin: solidSurface(mesh.geometry) }));
const report = { movement: 53, poses: 0, surfaceChecks: 0, penetratingSamples: 0,
  minimumSignedDistance: Infinity, maximumPoseGap: 0, sides: [],
  scope: 'Only opposed clutch-jaw skins during the fully inserted left and right driving dwells, across three cycles. Shaft, key, gear bodies and selector are excluded.' };
for (const side of ['left', 'right']) {
  const gear = parts(b[`${side}InputHalf`]), output = parts(b[`${side}OutputHalf`]);
  assert.ok(gear.length && output.length);
  let minimumGap = Infinity, maximumGap = 0;
  for (let cycle = 0; cycle < 3; cycle += 1) for (let pose = 0; pose < 33; pose += 1) {
    const phase = p[`${side}InsertedPhase`] + (p[`${side}WithdrawalStartPhase`] - p[`${side}InsertedPhase`]) * (pose + 0.219) / 33;
    model.update(p.cyclePeriod * (cycle + phase)); model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    assert.equal(state.lockedSide, side); assert.equal(state.torqueTransmission, 1); assert.ok(state.activeDogOverlap > 0);
    let poseGap = Infinity;
    for (const [source, target] of [[gear, output], [output, gear]]) for (const from of source) for (const to of target) {
      const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
      for (const local of from.points) {
        const point = local.clone().applyMatrix4(transform); report.surfaceChecks += 1;
        if (to.skin.box.distanceToPoint(point) > 0.1) continue;
        const gap = to.skin.signedDistance(point, 0.1); assert.ok(Number.isFinite(gap));
        if (gap < -1e-7) report.penetratingSamples += 1;
        poseGap = Math.min(poseGap, gap);
      }
    }
    assert.ok(Number.isFinite(poseGap)); report.poses += 1;
    minimumGap = Math.min(minimumGap, poseGap); maximumGap = Math.max(maximumGap, poseGap);
  }
  report.sides.push({ side, minimumGap, maximumGap });
  report.minimumSignedDistance = Math.min(report.minimumSignedDistance, minimumGap);
  report.maximumPoseGap = Math.max(report.maximumPoseGap, maximumGap);
}
await writeFile('artifacts/review/053-clutch-contact-baseline.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
