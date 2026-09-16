import * as THREE from 'three';
import { PALETTE, matte } from './primitives.js';
import { capsule, circle, plate, poly, polygonClipping, ring } from './finite-plate-geometry.js';

// A finite rounded hook bridges the separated lever leaves to the rack plane.
// Its toe is integral to the pawl; it is not a freely rotating roller.
export function makeSteppedRatchetPawl({ color, length, role, rootZ, noseRadius }) {
  const pawl = new THREE.Group();
  const material = matte(color, { metalness: 0.13, roughness: 0.61 });
  const shoulder = [length - 0.16, -0.20];
  const outline = polygonClipping.union(capsule([0, 0], shoulder, 0.06, 32), poly(circle([0, 0], 0.115, 64)));
  const bored = polygonClipping.difference(outline, poly(circle([0, 0], 0.087, 64)));
  const beam = new THREE.Mesh(plate(bored, -0.07, 0.07), material);
  beam.userData.role = `${role}-bored-rigid-beam`;
  const hookOutline = polygonClipping.union(capsule(shoulder, [length, 0], 0.019, 32), poly(circle([length, 0], noseRadius, 128)));
  const hook = new THREE.Mesh(plate(hookOutline, -0.08 - rootZ, 0.12 - rootZ), material);
  hook.userData.role = `${role}-finite-working-hook`;
  const bridge = new THREE.Mesh(plate(poly(circle(shoulder, 0.055, 64)), -0.02 - rootZ, 0.04), material);
  bridge.userData.role = `${role}-axial-hook-shoulder`;
  // A transform-only witness at the toe center keeps the kinematic API explicit.
  const nose = new THREE.Object3D();
  nose.position.set(length, 0, 0.02 - rootZ);
  nose.userData.role = `${role}-rounded-toe-center`;
  pawl.add(beam, hook, bridge, nose);
  Object.assign(pawl.userData, { role, length, beam, hook, bridge, nose, noseRadius, hookOutline, shoulder, boreRadius: 0.087 });
  return pawl;
}

export function boredLeverPlate(anchors, handle) {
  const outline = polygonClipping.union(poly(circle([0, 0], 0.22, 64)),
    ...[...anchors, handle].map(point => capsule([0, 0], point.toArray(), 0.1, 32)));
  const holes = [poly(circle([0, 0], 0.134, 64)), ...anchors.map(point => poly(circle(point.toArray(), 0.088, 64)))];
  return plate(polygonClipping.difference(outline, ...holes), -0.1, 0.1);
}

// C2 imposed return: rise before the first crest, descend only after the final
// crest. The finite gap at pickup supplies the otherwise missing overtravel.
export function pawlReturnLift(fraction) {
  const start = 0, riseEnd = 0.40, fallStart = 0.80, end = 1;
  if (fraction <= start || fraction >= end) return { value: 0, first: 0, second: 0 };
  if (fraction >= riseEnd && fraction <= fallStart) return { value: 1, first: 0, second: 0 };
  const rising = fraction < riseEnd, width = rising ? riseEnd : end - fallStart;
  const u = rising ? fraction / width : (end - fraction) / width;
  return { value: u ** 3 * (10 - 15 * u + 6 * u ** 2),
    first: (rising ? 1 : -1) * 30 * u ** 2 * (1 - u) ** 2 / width,
    second: 60 * u * (1 - u) * (1 - 2 * u) / width ** 2 };
}

export function finishRatchetBarSupports(root) {
  const { blocks: b, geometry: g } = root.userData;
  b.baseRail.geometry.dispose();
  b.baseRail.geometry = new THREE.BoxGeometry(6.9, 0.16, 0.54);
  b.baseRail.position.x = -2.34;
  // Replace the overlapping lever bars/solid center disk with one bored plate.
  for (const child of [...b.leverBody.children]) { child.geometry?.dispose(); b.leverBody.remove(child); }
  const lever = new THREE.Mesh(boredLeverPlate([g.longAnchorLocal, g.shortAnchorLocal], g.handleEndLocal), matte(PALETTE.driver));
  lever.userData.role = 'finite-three-bore-vibrating-lever';
  b.leverBody.add(lever);
  for (const pin of b.leverPins) {
    pin.geometry.dispose();
    const center = pin.userData.role === 'fixed-middle-fulcrum-pin';
    pin.geometry = new THREE.CylinderGeometry(center ? 0.13 : 0.085, center ? 0.13 : 0.085, 0.64, 64);
    pin.position.z = 0;
  }
  b.pivotStand.geometry.dispose();
  b.pivotStand.geometry = new THREE.BoxGeometry(0.42, 2.02, 0.7);
  b.pivotStand.position.y = -1.21;
  const bearing = new THREE.Mesh(ring(0.134, 0.25, -0.69, 0.01, 96), matte(PALETTE.frame));
  bearing.userData.role = 'bored-stationary-fulcrum-bearing';
  root.add(bearing);
  for (const { post, cap } of b.guidePosts) {
    post.position.z = -0.58;
    post.geometry.dispose(); post.geometry = new THREE.BoxGeometry(0.54, 0.92, 0.5);
    cap.position.set(post.position.x, g.rackBaseBottomY - 0.075, 0.02);
    cap.geometry.dispose(); cap.geometry = new THREE.BoxGeometry(0.74, 0.13, 0.75);
    cap.userData.role = 'finite-ratchet-bar-lower-guide-shoe';
    const keeper = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.32, 0.12), matte(PALETTE.frame));
    keeper.position.set(post.position.x, g.rackBaseBottomY + 0.13, 0.32);
    keeper.userData.role = 'finite-ratchet-bar-front-keeper';
    root.add(keeper);
  }
  // Include the entire finite bar: its periodic display reset stays explicit.
  root.userData.cameraFitBounds.set(new THREE.Vector3(-5.85, -2.34, -0.85), new THREE.Vector3(2.06, 1.62, 1.1));
}
