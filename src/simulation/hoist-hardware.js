import * as THREE from 'three';
import { PALETTE, makeBeam, makePulley, makeShaft, markShadows, matte } from './primitives.js';

// A single sheave block can carry a rope termination in a different axial
// plane. The rigid stirrup reaches that plane above the rim, so the terminating
// rope never needs to pass through the rotating wheel to reach its attachment.
export function makeHoistBlock({ radius, color, ropeRadius = 0.032, width = 0.24,
  upperEyeZ = null, upperEyeScale = 1, lowerEyeZ = null, lowerEyeScale = 1,
  pinBecketZ = null, lowerHook = false, lowerHookScale = 1 }) {
  const block = makePulley({ radius: radius - ropeRadius, width,
    hubLength: Math.min(width * 1.45, width + 0.13), color, spokes: 0 });
  const frame = new THREE.Group();
  const cheekZ = width / 2 + 0.105;
  const pinMin = Math.min(-cheekZ - 0.055, pinBecketZ === null ? 0 : pinBecketZ - 0.04);
  const pinMax = Math.max(cheekZ + 0.055, pinBecketZ === null ? 0 : pinBecketZ + 0.04);
  const pin = makeShaft({ radius: 0.065, length: pinMax - pinMin });
  pin.position.z = (pinMax + pinMin) / 2;
  frame.add(pin);
  const strap = (from, to) => frame.add(makeBeam(from, to,
    { thickness: 0.065, depth: 0.055, color: PALETTE.ink }));
  if (upperEyeZ !== null) {
    const shoulder = radius + 0.12 * upperEyeScale;
    for (const z of [-cheekZ, cheekZ]) strap(new THREE.Vector3(0, 0, z), new THREE.Vector3(0, shoulder, z));
    strap(new THREE.Vector3(0, shoulder, Math.min(-cheekZ, upperEyeZ)),
      new THREE.Vector3(0, shoulder, Math.max(cheekZ, upperEyeZ)));
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), matte(PALETTE.ink));
    eye.scale.setScalar(upperEyeScale);
    eye.position.set(0, shoulder + 0.11 * upperEyeScale, upperEyeZ);
    frame.add(eye);
    block.userData.upperAttachment = new THREE.Vector3(0, radius + 0.32 * upperEyeScale, upperEyeZ);
    block.userData.upperEye = eye;
  }
  if (pinBecketZ !== null) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.015, 12, 40), matte(PALETTE.ink));
    collar.position.z = pinBecketZ;
    frame.add(collar);
    block.userData.upperAttachment = new THREE.Vector3(0, 0.08, pinBecketZ);
    block.userData.becketCollar = collar;
  }
  if (lowerEyeZ !== null) {
    const shoulder = radius + 0.12 * lowerEyeScale;
    for (const z of [-cheekZ, cheekZ]) strap(new THREE.Vector3(0, 0, z), new THREE.Vector3(0, -shoulder, z));
    strap(new THREE.Vector3(0, -shoulder, Math.min(-cheekZ, lowerEyeZ)),
      new THREE.Vector3(0, -shoulder, Math.max(cheekZ, lowerEyeZ)));
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 12, 40), matte(PALETTE.ink));
    eye.scale.setScalar(lowerEyeScale);
    eye.position.set(0, -shoulder - 0.11 * lowerEyeScale, lowerEyeZ);
    frame.add(eye);
    block.userData.lowerAttachment = new THREE.Vector3(0, -radius - 0.32 * lowerEyeScale, lowerEyeZ);
    block.userData.lowerEye = eye;
  }
  if (lowerHook) {
    const shoulder = radius + 0.10;
    for (const z of [-cheekZ, cheekZ]) strap(new THREE.Vector3(0, 0, z), new THREE.Vector3(0, -shoulder, z));
    strap(new THREE.Vector3(0, -shoulder, -cheekZ), new THREE.Vector3(0, -shoulder, cheekZ));
    const hook = makeHoistHook();
    hook.scale.setScalar(lowerHookScale);
    hook.position.y = -shoulder;
    frame.add(hook);
    block.userData.lowerAttachment = new THREE.Vector3(0, -shoulder - 0.35 * lowerHookScale, 0);
  }
  block.add(frame);
  block.userData.frame = frame;
  block.userData.pin = pin;
  block.userData.cheekZ = cheekZ;
  return markShadows(block);
}

// Hardware is carried by the block, independently of the rotating sheave.
export function makeSheaveHanger({ radius, width, direction = 1, openHook = false }) {
  const group = new THREE.Group();
  const cheekZ = width / 2 + 0.095;
  const shoulder = radius + 0.15;
  const material = matte(PALETTE.ink);
  const pin = makeShaft({ length: cheekZ * 2 + 0.12, radius: 0.065 });
  group.add(pin);
  for (const z of [-cheekZ, cheekZ]) {
    group.add(makeBeam(new THREE.Vector3(0, 0, z), new THREE.Vector3(0, direction * shoulder, z),
      { thickness: 0.075, depth: 0.065, color: PALETTE.ink }));
  }
  group.add(makeBeam(new THREE.Vector3(0, direction * shoulder, -cheekZ),
    new THREE.Vector3(0, direction * shoulder, cheekZ),
    { thickness: 0.075, depth: 0.075, color: PALETTE.ink }));
  if (direction > 0 && openHook) {
    const hook = makeHoistHook();
    hook.rotation.z = Math.PI;
    hook.position.y = shoulder;
    group.add(hook);
    group.userData.attachment = new THREE.Vector3(0, shoulder + 0.35, 0);
  } else if (direction > 0) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.034, 12, 48), material);
    eye.position.y = shoulder + 0.14;
    group.add(eye);
    group.userData.attachment = new THREE.Vector3(0, shoulder + 0.27, 0);
  } else {
    const hook = makeHoistHook();
    hook.position.y = -shoulder;
    group.add(hook);
    group.userData.attachment = new THREE.Vector3(0, -shoulder - 0.35, 0);
  }
  group.userData.pin = pin;
  return markShadows(group);
}

export function makeHoistHook() {
  const curve = new THREE.CurvePath();
  const p = (x, y) => new THREE.Vector3(x, y, 0);
  curve.add(new THREE.LineCurve3(p(0, 0.03), p(0, -0.14)));
  curve.add(new THREE.CubicBezierCurve3(p(0, -0.14), p(0, -0.20), p(-0.12, -0.22), p(-0.12, -0.31)));
  curve.add(new THREE.CubicBezierCurve3(p(-0.12, -0.31), p(-0.12, -0.46), p(0.13, -0.46), p(0.13, -0.25)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.035, 12, false), matte(PALETTE.ink));
}

export function makeHoistLoad({ radius = 0.42, height = 0.62, round = false } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(round
    ? new THREE.SphereGeometry(radius, 48, 32)
    : new THREE.CylinderGeometry(radius, radius, height, 64), matte(PALETTE.driven));
  body.position.y = round ? -radius : -height / 2;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 12, 48), matte(PALETTE.ink));
  eye.rotation.y = Math.PI / 2;
  eye.position.y = 0.11;
  group.add(body, eye);
  group.userData.body = body;
  group.userData.eye = eye;
  return markShadows(group);
}

export function makeTackleCase({ levels, radius, width, direction }) {
  const group = new THREE.Group();
  const plateDepth = 0.045;
  const halfWidth = radius + 0.08;
  const halfHeight = radius + 0.18;
  const plateShape = new THREE.Shape();
  plateShape.absellipse(0, 0, halfWidth, halfHeight, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.068, 0, Math.PI * 2, true);
  plateShape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(plateShape,
    { depth: plateDepth, bevelEnabled: false, curveSegments: 64 });
  geometry.translate(0, 0, -plateDepth / 2);
  const orderedLevels = [...levels].sort((a, b) => a - b);
  const edges = [orderedLevels[0] - width / 2 - 0.11,
    ...orderedLevels.slice(1).map((z, index) => (orderedLevels[index] + z) / 2),
    orderedLevels.at(-1) + width / 2 + 0.11];
  const plates = edges.map((z) => {
    const plate = new THREE.Mesh(geometry, matte(PALETTE.frame));
    plate.position.z = z;
    group.add(plate);
    return plate;
  });
  for (const sign of [-1, 1]) {
    group.add(makeBeam(new THREE.Vector3(0, sign * (halfHeight - 0.065), edges[0]),
      new THREE.Vector3(0, sign * (halfHeight - 0.065), edges.at(-1)),
      { thickness: 0.085, depth: 0.1, color: PALETTE.ink }));
  }
  const pin = makeShaft({ length: edges.at(-1) - edges[0] + 0.12, radius: 0.065 });
  pin.position.z = (edges[0] + edges.at(-1)) / 2;
  group.add(pin);
  const hook = makeHoistHook();
  hook.position.y = direction * (halfHeight - 0.065);
  if (direction > 0) hook.rotation.z = Math.PI;
  group.add(hook);
  group.userData.plates = plates;
  group.userData.pin = pin;
  group.userData.hook = hook;
  group.userData.attachment = new THREE.Vector3(0, direction * (halfHeight + 0.285), 0);
  return markShadows(group);
}
