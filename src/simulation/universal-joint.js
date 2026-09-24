import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';

const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const dimensions = { forkInnerRadius: 0.66, forkOuterRadius: 0.78, forkWidth: 0.18,
  trunnionRadius: 0.72, eyeRadius: 0.12, eyeDepth: 0.12, boreRadius: 0.046,
  pinRadius: 0.045, pinStart: 0.56, pinEnd: 0.795, pinCapRadius: 0.052,
  pinCapStart: 0.784, pinCapEnd: 0.807, armEnd: 0.075, shaftRadius: 0.075,
  shaftInnerDistance: 1.20, forkAxialScale: 1.6, middleAxialScale: 1.12,
  crossEnd: 0.648, crossHalfWidth: 0.063, crossDepth: 0.10 };

function frame(axis, bearingReference) {
  const group = new THREE.Group(), rotor = new THREE.Group(); group.add(rotor);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    bearingReference.clone().cross(axis).normalize(), bearingReference, axis));
  group.userData = { rotor, axis: axis.clone(), bearingReference: bearingReference.clone() };
  return group;
}
function extruded(shape, depth) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 }).translate(0, 0, -depth / 2);
}
function turned(profile, color, options = {}) {
  return new THREE.Mesh(turnedClutchGeometry(profile, { angularSegments: 96, color, ...options }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.57 }));
}
function forkShape(p) {
  const shape = new THREE.Shape(), outer = Math.acos(p.armEnd / p.forkOuterRadius), inner = Math.acos(p.armEnd / p.forkInnerRadius);
  shape.absarc(0, 0, p.forkOuterRadius, -outer, outer, false);
  shape.lineTo(p.armEnd, Math.sqrt(p.forkInnerRadius ** 2 - p.armEnd ** 2));
  shape.absarc(0, 0, p.forkInnerRadius, inner, -inner, true); shape.closePath();
  return shape;
}
function eye(p, color, side) {
  const inner = p.trunnionRadius - p.eyeDepth / 2, outer = inner + p.eyeDepth;
  const part = turned([[inner, p.boreRadius], [inner, p.eyeRadius], [outer, p.eyeRadius], [outer, p.boreRadius]], color);
  part.quaternion.setFromUnitVectors(Z, new THREE.Vector3(0, side, 0));
  part.userData.bearingEye = true; part.userData.side = side;
  return part;
}
function makeFork(axis, reference, direction, length, color, p) {
  const group = frame(axis, reference), rotor = group.userData.rotor;
  // The curved strap terminates before the bore. The cylindrical end lugs
  // overlap only the fixed strap, leaving the complete pivot passage open.
  const bodyGeometry = extruded(forkShape({ ...p, armEnd: p.armEnd / p.forkAxialScale }), p.forkWidth)
    .scale(p.forkAxialScale, 1, 1).rotateY(-direction * Math.PI / 2);
  const body = new THREE.Mesh(bodyGeometry, matte(color, { metalness: 0.18, roughness: 0.57 }));
  body.userData.curvedFork = true;
  const eyes = [-1, 1].map((side) => eye(p, color, side));
  const shaft = turned([[p.shaftInnerDistance, 0], [p.shaftInnerDistance, p.shaftRadius],
    [length, p.shaftRadius], [length, 0]], color);
  if (direction < 0) shaft.rotation.y = Math.PI;
  shaft.userData.shaft = true;
  rotor.add(body, ...eyes, shaft);
  group.userData.parts = { body, eyes, shaft };
  group.userData.shaftDirection = direction;
  return group;
}
function doubleForkShape(p, spacing) {
  const shape = new THREE.Shape(), h = spacing / 2, R = p.forkOuterRadius, r = p.forkInnerRadius;
  const end = h - p.armEnd, outerY = Math.sqrt(R ** 2 - (p.armEnd / p.middleAxialScale) ** 2);
  const innerY = Math.sqrt(r ** 2 - (p.armEnd / p.middleAxialScale) ** 2), inner = Math.acos(p.armEnd / (r * p.middleAxialScale));
  shape.moveTo(-end, outerY);
  shape.bezierCurveTo(-0.45, outerY, -0.22, 0.42, 0, 0.42);
  shape.bezierCurveTo(0.22, 0.42, 0.45, outerY, end, outerY);
  shape.lineTo(end, innerY);
  shape.absellipse(h, 0, r * p.middleAxialScale, r, Math.PI - inner, Math.PI + inner, false, 0);
  shape.lineTo(end, -outerY);
  shape.bezierCurveTo(0.45, -outerY, 0.22, -0.42, 0, -0.42);
  shape.bezierCurveTo(-0.22, -0.42, -0.45, -outerY, -end, -outerY);
  shape.lineTo(-end, -innerY);
  shape.absellipse(-h, 0, r * p.middleAxialScale, r, -inner, inner, false, 0); shape.closePath();
  return shape;
}
function makeDoubleFork(reference, spacing, p) {
  const group = frame(X, reference), rotor = group.userData.rotor;
  // One compact, continuous middle member replaces the two bulky hubs and
  // the exposed intermediate shaft. Its paired bearing axes stay parallel.
  const bodyGeometry = extruded(doubleForkShape(p, spacing), p.forkWidth).rotateY(-Math.PI / 2);
  const body = new THREE.Mesh(bodyGeometry, matte(PALETTE.accent, { metalness: 0.18, roughness: 0.57 }));
  const eyes = [];
  for (const end of [-1, 1]) for (const side of [-1, 1]) {
    const part = eye(p, PALETTE.accent, side); part.position.z = end * spacing / 2; eyes.push(part);
  }
  rotor.add(body, ...eyes); group.userData.parts = { body, eyes };
  return group;
}
function makeCross(p) {
  const group = new THREE.Group(), shape = new THREE.Shape(), e = p.crossEnd, w = p.crossHalfWidth, tip = 0.10;
  shape.moveTo(e, tip); shape.quadraticCurveTo(0.30, w, 0.16, w); shape.quadraticCurveTo(w, w, w, 0.16);
  shape.quadraticCurveTo(w, 0.30, tip, e); shape.lineTo(-tip, e);
  shape.quadraticCurveTo(-w, 0.30, -w, 0.16); shape.quadraticCurveTo(-w, w, -0.16, w);
  shape.quadraticCurveTo(-0.30, w, -e, tip); shape.lineTo(-e, -tip);
  shape.quadraticCurveTo(-0.30, -w, -0.16, -w); shape.quadraticCurveTo(-w, -w, -w, -0.16);
  shape.quadraticCurveTo(-w, -0.30, -tip, -e); shape.lineTo(tip, -e);
  shape.quadraticCurveTo(w, -0.30, w, -0.16); shape.quadraticCurveTo(w, -w, 0.16, -w);
  shape.quadraticCurveTo(0.30, -w, e, -tip); shape.closePath();
  const body = new THREE.Mesh(extruded(shape, p.crossDepth), matte(PALETTE.ink));
  const pins = [], caps = [];
  for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)]) for (const side of [-1, 1]) {
    const direction = axis.clone().multiplyScalar(side);
    const pin = turned([[p.pinStart, 0], [p.pinStart, p.pinRadius], [p.pinEnd, p.pinRadius], [p.pinEnd, 0]], PALETTE.brass);
    const cap = turned([[p.pinCapStart, 0], [p.pinCapStart, p.pinCapRadius], [p.pinCapEnd, p.pinCapRadius], [p.pinCapEnd, 0]], PALETTE.brass);
    pin.quaternion.setFromUnitVectors(Z, direction); cap.quaternion.copy(pin.quaternion);
    pin.userData.pinAxis = direction.clone(); pins.push(pin); caps.push(cap);
  }
  group.add(body, ...pins, ...caps); group.userData.parts = { body, pins, caps };
  return group;
}
function unwrap(angle, reference) { return angle + 2 * Math.PI * Math.round((reference - angle) / (2 * Math.PI)); }
function jointState(inputAxis, outputAxis, inputReference, outputReference, inputAngle, inputSpeed) {
  const first = inputReference.clone().applyAxisAngle(inputAxis, inputAngle);
  const second = outputAxis.clone().cross(first).normalize();
  const tangent = outputAxis.clone().cross(outputReference);
  const outputAngle = unwrap(Math.atan2(second.dot(tangent), second.dot(outputReference)), inputAngle);
  const firstDerivative = inputAxis.clone().cross(first);
  const numerator = outputAxis.clone().cross(first), numeratorDerivative = outputAxis.clone().cross(firstDerivative);
  const secondDerivative = numeratorDerivative.addScaledVector(second, -second.dot(numeratorDerivative)).divideScalar(numerator.length());
  const ratio = outputAxis.dot(second.clone().cross(secondDerivative));
  const normal = first.clone().cross(second).normalize();
  return { inputAngle, outputAngle, inputAngularSpeed: inputSpeed, outputAngularSpeed: ratio * inputSpeed,
    ratio, inputTrunnionAxis: first, outputTrunnionAxis: second,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(first, second, normal)) };
}

export function makeUniversalJoint(id = 50) {
  if (![50, 51].includes(id)) throw new RangeError('Universal-joint reconstruction is for 050 or 051.');
  const p = { ...dimensions, id, shaftEnd: id === 50 ? 2.10 : 2.65, jointSpacing: id === 50 ? 1.70 : 0,
    forkAxialScale: id === 50 ? 1.6 : 1.85, shaftInnerDistance: id === 50 ? 1.20 : 1.40,
    bendAngle: THREE.MathUtils.degToRad(id === 50 ? 52 : 27), inputAngularSpeed: 1.05,
    sourcePhase: id === 50 ? Math.PI / 2 : 0, cyclePeriod: 2 * Math.PI / 1.05 };
  const root = new THREE.Group(), c = Math.cos(p.bendAngle), s = Math.sin(p.bendAngle);
  const inputAxis = new THREE.Vector3(c, s, 0), outputAxis = new THREE.Vector3(c, -s, 0);
  const inputReference = Z.clone(), middleReference = new THREE.Vector3(0, -1, 0);
  const outputReference = id === 50 ? Z.clone().negate() : outputAxis.clone().cross(inputReference).normalize();
  const inputYoke = makeFork(inputAxis, inputReference, -1, p.shaftEnd, PALETTE.driver, p);
  const outputYoke = makeFork(outputAxis, outputReference, 1, p.shaftEnd, PALETTE.driven, p);
  inputYoke.position.x = -p.jointSpacing / 2; outputYoke.position.x = p.jointSpacing / 2;
  const leftCross = makeCross(p); leftCross.position.x = -p.jointSpacing / 2;
  const middle = id === 50 ? makeDoubleFork(middleReference, p.jointSpacing, p) : null;
  const rightCross = id === 50 ? makeCross(p) : null;
  if (rightCross) rightCross.position.x = p.jointSpacing / 2;
  root.add(inputYoke, outputYoke, leftCross); if (middle) root.add(middle, rightCross);
  const stateAtInputAngle = (angle) => {
    const left = jointState(inputAxis, id === 50 ? X : outputAxis, inputReference,
      id === 50 ? middleReference : outputReference, angle, p.inputAngularSpeed);
    const right = id === 50 ? jointState(X, outputAxis, middleReference, outputReference, left.outputAngle, left.outputAngularSpeed) : null;
    return { inputAngle: angle, inputAngularSpeed: p.inputAngularSpeed, middleAngle: id === 50 ? left.outputAngle : null,
      middleAngularSpeed: id === 50 ? left.outputAngularSpeed : null, outputAngle: (right ?? left).outputAngle,
      outputAngularSpeed: (right ?? left).outputAngularSpeed, left, right };
  };
  const stateAtTime = (time) => stateAtInputAngle(time * p.inputAngularSpeed + p.sourcePhase);
  const update = (time) => {
    const state = stateAtTime(time);
    inputYoke.userData.rotor.rotation.z = state.inputAngle; outputYoke.userData.rotor.rotation.z = state.outputAngle;
    leftCross.quaternion.copy(state.left.quaternion);
    if (middle) { middle.userData.rotor.rotation.z = state.middleAngle; rightCross.quaternion.copy(state.right.quaternion); }
    root.userData.kinematics = state;
  };
  root.userData = { fidelity: 'authored', mechanism: id === 50 ? 'compact-double-cardan-with-bored-curved-forks' : 'single-cardan-with-bored-curved-forks',
    cameraFov: 17, hideGround: true, fullCameraDirection: new THREE.Vector3(4, 3, 8),
    blocks: { inputYoke, outputYoke, leftCross, middle, rightCross }, geometry: { ...p, inputAxis, outputAxis, inputReference, outputReference, middleReference },
    stateAtTime, stateAtInputAngle };
  update(0); markShadows(root);
  return { root, update, cameraDirection: id === 50 ? new THREE.Vector3(0.5, 5, 8) : new THREE.Vector3(0, 8, 8) };
}
