// Actual rendered-solid witnesses, not a mechanism validation or collision proof.
import { createMovementModel } from '../src/simulation/registry.js';
import { readFileSync } from 'node:fs';
import { surfacePoints, solidSurface } from '../tests/helpers/solid-surface.mjs';

const catalog = JSON.parse(readFileSync(new URL('../src/data/movements.json', import.meta.url)));
const results = [];
for (const id of [233, 238, 239]) {
  const model = createMovementModel(catalog.movements[id - 1]);
  const data = model.root.userData;
  const b = data.blocks;
  const targets = id === 233 ? b.wheel.userData.trundles
    : [id === 238 ? b.escapeWheel.userData.body : b.gearBody];
  const parts = id === 233 ? [['latch body', b.latchBody], ['roller assembly', b.rollerWheel]] : id === 238
    ? [['B face', b.bPallet.face], ['C face', b.cPallet.face], ['anchor body', b.palletBody]]
    : [['left stop', b.leftStop.userData.body], ['right stop', b.rightStop.userData.body]];
  const surfaces = new Map(targets.map(target => [target.geometry, solidSurface(target.geometry)]));
  const meshes = [];
  const childIndices = new Map();
  for (const [name, object] of parts) object.traverse(part => {
    if (part.isMesh) {
      const index = childIndices.get(name) ?? 0;
      childIndices.set(name, index + 1);
      meshes.push([`${name} mesh ${index}`, part]);
    }
  });
  for (const [name, part] of meshes) {
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
            witness = { time, phase: sample / 64, targetLocalPoint: local.toArray(),
              targetRole: target.userData.role, targetIndex: target.userData.index };
          }
        }
      }
    }
    results.push({ id, part: name, minimumGap, witness });
  }
}
console.log(JSON.stringify({
  scope: '65 poses; selected actual vertices/edge midpoints/triangle centers; distance capped at 0.3; defect screen only',
  results,
}, null, 2));
