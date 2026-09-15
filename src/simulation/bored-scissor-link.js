import * as THREE from 'three';
import { plate, poly, circle, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
import { matte } from './primitives.js';

// A rigid, flat link: its geometry is never stretched during playback.
export function makeBoredScissorLink({ length, depth, thickness, color, pinRadius, centerPin }) {
  const group = new THREE.Group();
  const joints = centerPin ? [0, length / 2, length] : [0, length];
  const boreRadius = pinRadius + 0.003;
  const outline = clip.union(
    capsule([0, 0], [length, 0], thickness / 2, 12),
    ...joints.map(x => poly(circle([x, 0], 0.17, 48))),
  );
  const section = clip.difference(outline,
    ...joints.map(x => poly(circle([x, 0], boreRadius, 48))));
  const body = new THREE.Mesh(plate(section, -depth / 2, depth / 2), matte(color));
  body.name = 'bored-link-body';
  const startJoint = new THREE.Object3D(), endJoint = new THREE.Object3D();
  startJoint.name = 'start-pin-center'; endJoint.name = 'end-pin-center';
  group.add(body, startJoint, endJoint);
  group.userData.bores = joints.map(x => ({ x, radius: boreRadius }));
  group.userData.setEndpoints = (start, end) => {
    body.position.copy(start);
    body.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
    startJoint.position.copy(start); endJoint.position.copy(end);
  };
  return group;
}
