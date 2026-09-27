import * as THREE from 'three';
import { LaidRopeGeometry } from './laid-rope.js';
import { PALETTE, markShadows, matte } from './primitives.js';
import { figureGeometry, figureMeshInfo } from './figure-meshes.js';

// Plate 12's hauling hand, modelled in Blender (scripts/blender/figures.py):
// a closed fist whose four fingers wrap the rope, the thumb curling over the
// index end, the back of the hand running down toward a wrist on the rope's
// far side, and a forearm with a ruffled cuff entering from the lower left.
// The fist's rope channel is refitted to each rope so the fingers close on
// it without overlapping it. The group origin is the rope's effort end;
// local +X runs up the rope toward the pulley.
const HAND_SCALE = 1.65;
const CHANNEL_FALLOFF = 0.05;

function fitRopeChannel(bakedRadius, radius) {
  const change = radius - bakedRadius;
  // Wide enough that the radial refit stays monotonic (no folded skin).
  const falloff = Math.max(CHANNEL_FALLOFF, 1.6 * Math.abs(change));
  return (position) => {
    for (let i = 0; i < position.length; i += 3) {
      const y = position[i + 1];
      const z = position[i + 2];
      const r = Math.hypot(y, z);
      if (r < 1e-9) continue;
      const weight = THREE.MathUtils.clamp(1 - (r - bakedRadius) / falloff, 0, 1);
      const scale = (r + change * weight) / r;
      position[i + 1] = y * scale;
      position[i + 2] = z * scale;
    }
  };
}

// The same fist closed on a round bar or rail of `radius` (in the fist's own
// units after `scale`): grip frame +X along the bar, wrist toward +Y and
// -X, back of the hand toward +Z.
export function makeGripFist(radius, scale, material) {
  const { channelRadius } = figureMeshInfo('hand-fist');
  const fist = new THREE.Mesh(
    figureGeometry('hand-fist', fitRopeChannel(channelRadius, radius / scale)), material);
  fist.scale.setScalar(scale);
  fist.name = 'grip-fist';
  return fist;
}

export function makeHaulingHand(ropeDirection, ropeRadius, { armDirection: armDirectionOption, tailPoints: tailOption, clearance = 0.005 } = {}) {
  const hand = new THREE.Group();
  hand.name = 'plate-12-hauling-hand';
  const skin = matte(0xe2b48e, { roughness: 0.8 });
  const grip = new THREE.Group();
  grip.rotation.z = Math.atan2(ropeDirection.y, ropeDirection.x);
  const { channelRadius, wrist: wristLocal } = figureMeshInfo('hand-fist');
  // The fingers close on the rope with a small clearance (more where the
  // rope still curves inside the fist).
  const bore = (ropeRadius + clearance) / HAND_SCALE;
  const fist = new THREE.Mesh(figureGeometry('hand-fist', fitRopeChannel(channelRadius, bore)), skin);
  fist.name = 'hand-fist';
  grip.add(fist);
  const body = new THREE.Group();
  body.scale.setScalar(HAND_SCALE);
  body.add(grip);
  hand.add(body);
  // Forearm, leaving the wrist toward the lower left.
  const wrist = new THREE.Vector3(...wristLocal).applyAxisAngle(new THREE.Vector3(0, 0, 1), grip.rotation.z);
  const armDirection = (armDirectionOption ?? new THREE.Vector3(-0.62, -0.78, 0)).clone().normalize();
  const arm = new THREE.Mesh(figureGeometry('hand-forearm'), skin);
  arm.position.copy(wrist);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), armDirection);
  arm.name = 'hand-forearm';
  const cuffMaterial = matte(0xe9e1d2, { roughness: 0.85 });
  const cuff = new THREE.Mesh(figureGeometry('hand-cuff'), cuffMaterial);
  cuff.position.copy(wrist);
  cuff.quaternion.copy(arm.quaternion);
  cuff.name = 'hand-cuff';
  // The loose end of the rope below the fist, drooping toward vertical.
  const tailPoints = tailOption ?? [
    ropeDirection.clone().multiplyScalar(0.15),
    ropeDirection.clone().multiplyScalar(-0.24),
    new THREE.Vector3(-0.27, -0.42, 0),
    new THREE.Vector3(-0.3, -0.7, 0),
    new THREE.Vector3(-0.27, -1.0, 0),
    new THREE.Vector3(-0.2, -1.25, 0),
  ];
  const tail = new THREE.Mesh(
    new LaidRopeGeometry(new THREE.CatmullRomCurve3(tailPoints), 48, ropeRadius, 8, false),
    matte(PALETTE.belt, { roughness: 0.76 }));
  tail.name = 'loose-rope-tail';
  body.add(arm, cuff);
  hand.add(tail);
  markShadows(hand);
  return hand;
}
