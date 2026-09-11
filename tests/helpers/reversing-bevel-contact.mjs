import * as THREE from 'three';
import { makeReversingClutch } from '../../src/simulation/reversing-clutch.js';
import { solidSurface, surfacePoints } from './solid-surface.mjs';

export function probeReversingBevelContact(poses = 128) {
const model = makeReversingClutch(), g = model.root.userData.geometry, b = model.root.userData.blocks;
const tooth = b.rightGear.userData.toothMeshes[0].geometry, points = surfacePoints(tooth), surface = solidSurface(tooth);
const pairs = [[b.rightGear, b.inputGear], [b.inputGear, b.rightGear], [b.leftGear, b.inputGear], [b.inputGear, b.leftGear]];
const bodySurfaces = new Map([b.rightGear, b.leftGear, b.inputGear].map((gear) => [gear, solidSurface(gear.userData.body.geometry)]));
const toothPitch = 2 * Math.PI / g.teeth;
let checks = 0, penetrations = 0, minimum = Infinity, maximumPoseGap = 0, witness;
for (let pose = 0; pose <= poses; pose += 1) {
  const advance = toothPitch * pose / poses;
  model.update(advance / g.inputAngularSpeed); model.root.updateMatrixWorld(true);
  let poseGap = Infinity;
  for (const [pairIndex, [source, target]] of pairs.entries()) {
    let pairGap = Infinity;
    const inverse = target.userData.cone.matrixWorld.clone().invert(), body = bodySurfaces.get(target);
    for (const mesh of source.userData.toothMeshes) {
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      for (const local of points) {
        const p = local.clone().applyMatrix4(transform); checks += 1;
        let gap = 0.03;
        if (body.box.distanceToPoint(p) < gap) gap = Math.min(gap, body.signedDistance(p, gap));
        const index = Math.round(Math.atan2(p.y, p.x) / toothPitch);
        for (const offset of [-1, 0, 1]) {
          const angle = -(index + offset) * toothPitch, cosine = Math.cos(angle), sine = Math.sin(angle);
          const q = new THREE.Vector3(cosine * p.x - sine * p.y, sine * p.x + cosine * p.y, p.z);
          if (surface.box.distanceToPoint(q) > 0.03) continue;
          gap = Math.min(gap, surface.signedDistance(q, Math.max(0.03, gap)));
        }
        if (gap < -1e-7) penetrations += 1;
        if (gap < minimum) { minimum = gap; witness = { pose, pairIndex, point: p.toArray() }; }
        pairGap = Math.min(pairGap, gap);
        poseGap = Math.min(poseGap, gap);
      }
    }
    maximumPoseGap = Math.max(maximumPoseGap, pairGap);
  }
  maximumPoseGap = Math.max(maximumPoseGap, poseGap);
}
const report = { movement: 53, poses: poses + 1, surfaceChecks: checks, penetratingSamples: penetrations,
  minimumSignedDistance: minimum, maximumPoseGap, witness };
return report;
}
