// Selected actual-solid witnesses for the next ratchet/stop family pass.
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { surfacePoints, solidSurface } from '../tests/helpers/solid-surface.mjs';

const results = [];
for (const id of [237, 240, 241]) {
  const model = create({ id });
  const data = model.root.userData;
  const blocks = data.blocks;
  const targets = [];
  if (id === 237) {
    blocks.crownWheel.traverse(object => {
      if (object.isMesh && object.userData.role === 'axial-sawtooth-on-crown-ratchet') targets.push(object);
    });
  } else targets.push(id === 240 ? blocks.wheelBody : blocks.outputWheelBody);
  const parts = id === 237 ? [blocks.pawlNose, blocks.pawlBody] : id === 240
    ? [blocks.hookGravityStopBody, blocks.straightGravityStopBody, blocks.springPawlStopBody]
    : [blocks.driverTooth, blocks.holdingClickBody];
  const surfaces = new Map();
  for (const target of targets) {
    if (!surfaces.has(target.geometry)) surfaces.set(target.geometry, solidSurface(target.geometry));
  }
  for (const part of parts) {
    const points = surfacePoints(part.geometry);
    let minimumGap = Infinity;
    let witness;
    for (let sample = 0; sample <= 64; sample += 1) {
      const time = data.geometry.cyclePeriod * sample / 64;
      model.update(time);
      model.root.updateMatrixWorld(true);
      for (const target of targets) {
        const transform = target.matrixWorld.clone().invert().multiply(part.matrixWorld);
        const surface = surfaces.get(target.geometry);
        for (const point of points) {
          const local = point.clone().applyMatrix4(transform);
          const gap = surface.signedDistance(local, 0.3);
          if (gap < minimumGap) {
            minimumGap = gap;
            witness = { time, phase: sample / 64, point: local.toArray(),
              targetRole: target.userData.role, targetIndex: target.userData.index };
          }
        }
      }
    }
    results.push({ id, role: part.userData.role, minimumGap, witness });
  }
}
console.log(JSON.stringify({
  scope: '65 poses; selected surface points against actual triangles, distance capped at 0.3; defect screen only',
  results,
}, null, 2));
