import * as THREE from 'three';
import {circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {matte, PALETTE} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

export function makeRulerArm(length, {middleEye = false} = {}) {
  const centers = middleEye ? [0, length / 2, length] : [0, length];
  const outline = polygonClipping.union(
    poly([[0, -.085], [length, -.085], [length, .085], [0, .085]]),
    ...centers.map(x => poly(circle([x, 0], .14, 48))),
  );
  const bored = polygonClipping.difference(outline,
    ...centers.map(x => poly(circle([x, 0], .09, 48))));
  const geometry = plate(bored, -.065, .065);
  geometry.rotateX(Math.PI / 2);
  const arm = new THREE.Mesh(geometry, matte(PALETTE.driver));
  arm.userData.nominalLength = length;
  arm.userData.boreCenters = centers;
  arm.userData.boreRadius = .09;
  arm.userData.setEndpoints = (start, end) => {
    arm.position.copy(start);
    arm.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
  };
  return arm;
}

export function boredRulerPlate(length, width, depth, centers) {
  const outline = poly([[-length/2, -width/2], [length/2, -width/2],
    [length/2, width/2], [-length/2, width/2]]);
  const geometry = plate(polygonClipping.difference(outline,
    ...centers.map(x => poly(circle([x, 0], .09, 48)))), -depth/2, depth/2);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function finishDrawingRuler(root, removed) {
  for (const object of removed) {
    object.removeFromParent();
    disposeObject3D(object);
  }
  root.userData.hideGround = true;
  root.userData.cameraDistanceScale = .94;
  // Source coordinates use +Z upwards on the plan. Reflect the depth plane
  // so the upper face is readable with the renderer's +Y-up camera convention.
  root.scale.z = -1;
  root.userData.sourcePlanReflection = true;
  root.userData.cameraFitBounds.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
  root.traverse(object => {
    for (const material of [object.material].flat().filter(Boolean)) material.fog = false;
  });
}
