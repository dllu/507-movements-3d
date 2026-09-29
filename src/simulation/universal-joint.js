import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, markShadows, matte } from './primitives.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';

const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
// Brown draws the forks as broad flat bands (straps): a modest radial
// thickness, but a wide face along the pin, their ends rounded about the
// pin eye. The shafts are heavy and flare into the band.
const dimensions = { forkInnerRadius: 0.66, forkOuterRadius: 0.84, forkWidth: 0.30,
  trunnionRadius: 0.75, eyeRadius: 0.15, eyeDepth: 0.18, boreRadius: 0.046,
  pinRadius: 0.045, pinStart: 0.56, pinEnd: 0.855, pinCapRadius: 0.052,
  pinCapStart: 0.844, pinCapEnd: 0.867, armEnd: 0.075, shaftRadius: 0.13, neckRadius: 0.15, neckLength: 0.30,
  shaftInnerDistance: 1.20, forkAxialScale: 1.6, middleAxialScale: 1.12,
  crossEnd: 0.648, crossHalfWidth: 0.063, crossDepth: 0.10, eyeLength: 0.15,
  trunnionStart: 0.50, crossTrunnionRadius: 0.085 };

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
// Each strap is ONE solid: the curved band runs straight into a D-shaped
// eye whose outer end is a semicircle concentric with its pin. The band is
// cut at axial distance eyeLength from the pin, where the eye piece takes
// over with the band's exact section; the shared junction faces are removed,
// so there is no boss, step or square corner at the eye.
function bandShape(p, scale) {
  const shape = new THREE.Shape(), R = p.forkOuterRadius, r = p.forkInnerRadius, L = p.eyeLength;
  const outer = Math.acos(L / (scale * R)), inner = Math.acos(L / (scale * r));
  shape.absellipse(0, 0, scale * R, R, -outer, outer, false, 0);
  shape.lineTo(L, r * Math.sin(inner));
  shape.absellipse(0, 0, scale * r, r, inner, -inner, true, 0); shape.closePath();
  return shape;
}
// Eye piece in its own coordinates: a (axial, measured from the pin toward
// the band), z (across the strap), extruded radially between the band's
// inner and outer faces. sigma/x0 place it along the member's axis; side
// picks the pin (+y or -y).
function eyeGeometry(p, { x0, sigma, side, inner, outer }) {
  const half = p.forkWidth / 2, L = p.eyeLength, shape = new THREE.Shape();
  shape.moveTo(L, -half); shape.lineTo(L, half); shape.lineTo(0, half);
  shape.absarc(0, 0, half, Math.PI / 2, 3 * Math.PI / 2, false); shape.lineTo(L, -half);
  const bore = new THREE.Path(); bore.absarc(0, 0, p.boreRadius, 0, 2 * Math.PI, true); shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 48 });
  const position = geometry.attributes.position, zeta = -sigma * side;
  for (let i = 0; i < position.count; i += 1) {
    const a = position.getX(i), v = position.getY(i), w = position.getZ(i), t = Math.max(a, 0);
    const radial = inner(t) + (outer(t) - inner(t)) * w;
    position.setXYZ(i, x0 + sigma * a, side * radial, zeta * v);
  }
  return geometry;
}
function joinedStrap(bandGeometry, eyes, joins) {
  // Drop the band's end faces and the eyes' flat faces: every triangle whose
  // three corners lie on a junction plane x = join.
  const parts = [bandGeometry, ...eyes].map((g) => (g.index ? g.toNonIndexed() : g));
  const onJoin = (x) => joins.some((join) => Math.abs(x - join) < 1e-6);
  const snap = new Map(), key = (x, y, z) => [x, y, z].map((c) => Math.round(c * 1e5)).join(',');
  const source = parts[0].attributes.position;
  for (let i = 0; i < source.count; i += 1) if (onJoin(source.getX(i))) snap.set(key(source.getX(i), source.getY(i), source.getZ(i)), [source.getX(i), source.getY(i), source.getZ(i)]);
  const positions = [], uvs = [];
  for (const [index, part] of parts.entries()) {
    const position = part.attributes.position, uv = part.attributes.uv;
    for (let i = 0; i < position.count; i += 3) {
      if ([0, 1, 2].every((k) => onJoin(position.getX(i + k)))) continue;
      for (let k = 0; k < 3; k += 1) {
        let xyz = [position.getX(i + k), position.getY(i + k), position.getZ(i + k)];
        if (index > 0 && onJoin(xyz[0])) xyz = snap.get(key(...xyz)) ?? xyz;
        positions.push(...xyz); uvs.push(uv.getX(i + k), uv.getY(i + k));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return toCreasedNormals(geometry, Math.PI / 6);
}
function eyeFrame(p, side) {
  // Frame marker for the bearing (its local z is the pin axis); the eye
  // material itself belongs to the strap body.
  const marker = new THREE.Object3D();
  marker.quaternion.setFromUnitVectors(Z, new THREE.Vector3(0, side, 0));
  marker.userData.bearingEye = true; marker.userData.side = side;
  return marker;
}
function ellipseHeight(radius, scale) { return (a) => radius * Math.sqrt(Math.max(0, 1 - (a / (scale * radius)) ** 2)); }
function makeFork(axis, reference, direction, length, color, p) {
  const group = frame(axis, reference), rotor = group.userData.rotor, s = p.forkAxialScale;
  const inner = ellipseHeight(p.forkInnerRadius, s), outer = ellipseHeight(p.forkOuterRadius, s);
  const band = extruded(bandShape(p, s), p.forkWidth);
  const eyeParts = [-1, 1].map((side) => eyeGeometry(p, { x0: 0, sigma: 1, side, inner, outer }));
  const bodyGeometry = joinedStrap(band, eyeParts, [p.eyeLength]).rotateY(-direction * Math.PI / 2);
  const body = new THREE.Mesh(bodyGeometry, matte(color, { metalness: 0.18, roughness: 0.57 }));
  body.userData.curvedFork = true;
  const eyes = [-1, 1].map((side) => eyeFrame(p, side));
  // The shaft swells into a neck as broad as the band where it joins the
  // bottom of the strap (kept outside the strap's inner face).
  const neckStart = p.forkInnerRadius * s + 0.03, neckEnd = p.forkOuterRadius * s + p.neckLength;
  const shaft = turned([[neckStart, 0], [neckStart, p.neckRadius], [p.forkOuterRadius * s, p.neckRadius],
    [neckEnd, p.shaftRadius], [length, p.shaftRadius], [length, 0]], color);
  if (direction < 0) shaft.rotation.y = Math.PI;
  shaft.userData.shaft = true;
  rotor.add(body, ...eyes, shaft);
  group.userData.parts = { body, eyes, shaft };
  group.userData.shaftDirection = direction;
  return group;
}
function doubleForkShape(p, spacing) {
  const shape = new THREE.Shape(), h = spacing / 2, R = p.forkOuterRadius, r = p.forkInnerRadius, k = p.middleAxialScale;
  const end = h - p.eyeLength, inner = Math.acos(p.eyeLength / (r * k)), innerY = r * Math.sin(inner);
  shape.moveTo(-end, R);
  shape.bezierCurveTo(-0.45, R, -0.22, 0.42, 0, 0.42);
  shape.bezierCurveTo(0.22, 0.42, 0.45, R, end, R);
  shape.lineTo(end, innerY);
  shape.absellipse(h, 0, r * k, r, Math.PI - inner, Math.PI + inner, false, 0);
  shape.lineTo(end, -R);
  shape.bezierCurveTo(0.45, -R, 0.22, -0.42, 0, -0.42);
  shape.bezierCurveTo(-0.22, -0.42, -0.45, -R, -end, -R);
  shape.lineTo(-end, -innerY);
  shape.absellipse(-h, 0, r * k, r, -inner, inner, false, 0); shape.closePath();
  return shape;
}
function makeDoubleFork(reference, spacing, p) {
  const group = frame(X, reference), rotor = group.userData.rotor, h = spacing / 2;
  // One compact, continuous middle member whose four eyes are part of the
  // same solid. Its paired bearing axes stay parallel.
  const inner = ellipseHeight(p.forkInnerRadius, p.middleAxialScale), outer = () => p.forkOuterRadius;
  const eyeParts = [];
  for (const end of [-1, 1]) for (const side of [-1, 1]) eyeParts.push(eyeGeometry(p, { x0: end * h, sigma: -end, side, inner, outer }));
  const bodyGeometry = joinedStrap(extruded(doubleForkShape(p, spacing), p.forkWidth), eyeParts,
    [-(h - p.eyeLength), h - p.eyeLength]).rotateY(-Math.PI / 2);
  const body = new THREE.Mesh(bodyGeometry, matte(PALETTE.accent, { metalness: 0.18, roughness: 0.57 }));
  const eyes = [];
  for (const end of [-1, 1]) for (const side of [-1, 1]) {
    const part = eyeFrame(p, side); part.position.z = end * h; eyes.push(part);
  }
  rotor.add(body, ...eyes); group.userData.parts = { body, eyes };
  return group;
}
function makeCross(p) {
  // Straight arms of constant width, each ending in a round trunnion
  // concentric with its pin.
  const group = new THREE.Group(), shape = new THREE.Shape(), e = p.trunnionStart + 0.03, w = p.crossHalfWidth, f = 0.16;
  shape.moveTo(e, w); shape.lineTo(f, w); shape.quadraticCurveTo(w, w, w, f); shape.lineTo(w, e); shape.lineTo(-w, e);
  shape.lineTo(-w, f); shape.quadraticCurveTo(-w, w, -f, w); shape.lineTo(-e, w); shape.lineTo(-e, -w);
  shape.lineTo(-f, -w); shape.quadraticCurveTo(-w, -w, -w, -f); shape.lineTo(-w, -e); shape.lineTo(w, -e);
  shape.lineTo(w, -f); shape.quadraticCurveTo(w, -w, f, -w); shape.lineTo(e, -w); shape.closePath();
  const body = new THREE.Mesh(extruded(shape, p.crossDepth), matte(PALETTE.ink));
  const pins = [], caps = [], trunnions = [], t = p.crossTrunnionRadius, c = 0.012;
  for (const axis of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)]) for (const side of [-1, 1]) {
    const direction = axis.clone().multiplyScalar(side);
    const trunnion = turned([[p.trunnionStart, 0], [p.trunnionStart, t], [p.crossEnd - c, t],
      [p.crossEnd, t - c], [p.crossEnd, 0]], PALETTE.ink);
    const pin = turned([[p.pinStart, 0], [p.pinStart, p.pinRadius], [p.pinEnd, p.pinRadius], [p.pinEnd, 0]], PALETTE.brass);
    const cap = turned([[p.pinCapStart, 0], [p.pinCapStart, p.pinCapRadius], [p.pinCapEnd, p.pinCapRadius], [p.pinCapEnd, 0]], PALETTE.brass);
    pin.quaternion.setFromUnitVectors(Z, direction); cap.quaternion.copy(pin.quaternion); trunnion.quaternion.copy(pin.quaternion);
    trunnion.userData.trunnion = true;
    pin.userData.pinAxis = direction.clone(); pins.push(pin); caps.push(cap); trunnions.push(trunnion);
  }
  group.add(body, ...trunnions, ...pins, ...caps); group.userData.parts = { body, pins, caps, trunnions };
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
  const p = { ...dimensions, id, shaftEnd: id === 50 ? 2.75 : 3.70, jointSpacing: id === 50 ? 1.70 : 0,
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
