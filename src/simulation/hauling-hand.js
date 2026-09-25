import * as THREE from 'three';
import { LaidRopeGeometry } from './laid-rope.js';
import { PALETTE, markShadows, matte } from './primitives.js';

// Plate 12's hauling hand: a fist bored for the rope (no rope overlap), a
// thumb over the fingers, a forearm and cuff entering from the lower left,
// and the loose rope tail hanging below the fist. The group origin is the
// rope's effort end; local +X runs up the rope toward the pulley.
export function makeHaulingHand(ropeDirection, ropeRadius, { armDirection: armDirectionOption, tailPoints: tailOption } = {}) {
  const hand = new THREE.Group();
  hand.name = 'plate-12-hauling-hand';
  const skin = matte(0xe2b48e, { roughness: 0.8 });
  const grip = new THREE.Group();
  grip.rotation.z = Math.atan2(ropeDirection.y, ropeDirection.x);
  const bore = ropeRadius + 0.014;
  const section = new THREE.Shape();
  const [y0, y1, z0, z1, r] = [-0.12, 0.2, -0.115, 0.115, 0.07];
  section.moveTo(y0 + r, z0);
  section.lineTo(y1 - r, z0);
  section.quadraticCurveTo(y1, z0, y1, z0 + r);
  section.lineTo(y1, z1 - r);
  section.quadraticCurveTo(y1, z1, y1 - r, z1);
  section.lineTo(y0 + r, z1);
  section.quadraticCurveTo(y0, z1, y0, z1 - r);
  section.lineTo(y0, z0 + r);
  section.quadraticCurveTo(y0, z0, y0 + r, z0);
  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  section.holes.push(hole);
  const fistLength = 0.3;
  const fistGeometry = new THREE.ExtrudeGeometry(section, {
    depth: fistLength - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.012,
    bevelSegments: 3, curveSegments: 20,
  });
  // Cyclic axis swap: extrusion (z) -> grip X, shape x -> Y, shape y -> Z.
  fistGeometry.translate(0, 0, -(fistLength - 0.06) / 2);
  fistGeometry.applyMatrix4(new THREE.Matrix4().set(
    0, 0, 1, 0,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 1));
  const fist = new THREE.Mesh(fistGeometry, skin);
  fist.name = 'hand-fist';
  // Knuckle ridges across the fingers on the side away from the wrist.
  for (let i = 0; i < 4; i += 1) {
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), skin);
    knuckle.scale.set(1, 0.8, 0.9);
    knuckle.position.set(-0.105 + i * 0.07, -0.115, 0.05);
    knuckle.name = 'hand-knuckle';
    grip.add(knuckle);
  }
  // An elongated sphere, not a capsule grip handle.
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skin);
  thumb.scale.set(0.036, 0.1, 0.036);
  thumb.position.set(0.12, 0.02, 0.118);
  thumb.rotation.z = Math.PI / 2 - 0.5;
  thumb.name = 'hand-thumb';
  grip.add(fist, thumb);
  // Brown's fist is about 0.45 of the sheave diameter; the rope bore scales
  // with it, so the rope stays clear.
  const body = new THREE.Group();
  body.scale.setScalar(1.35);
  body.add(grip);
  hand.add(body);
  // Forearm, leaving the heel of the fist steeply toward the lower left.
  const wrist = new THREE.Vector3(-0.03, 0.17, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), grip.rotation.z);
  const armDirection = (armDirectionOption ?? new THREE.Vector3(-0.62, -0.78, 0)).clone().normalize();
  const armLength = 0.5;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, armLength, 20), skin);
  arm.position.copy(wrist).addScaledVector(armDirection, armLength / 2);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), armDirection);
  arm.name = 'hand-forearm';
  const cuffMaterial = matte(0xe9e1d2, { roughness: 0.85 });
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.16, 20), cuffMaterial);
  cuff.position.copy(wrist).addScaledVector(armDirection, armLength + 0.07);
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
