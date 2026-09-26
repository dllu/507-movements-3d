import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { bevelToothGeometry } from './bevel-geometry.js';
import { keyedBoreRadius, turnedClutchGeometry } from './clutch-section-geometry.js';
import { makeRatchetBevelMotion } from './ratchet-bevel-motion.js';

function extruded(shape, depth, center) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 }).translate(0, 0, center - depth / 2);
}
function circleHole(shape, x, y, radius) {
  const hole = new THREE.Path(); hole.absarc(x, y, radius, 0, 2 * Math.PI, true); shape.holes.push(hole);
}
function keyedHole(shape, bore, halfWidth, top) {
  const angles = Array.from({ length: 129 }, (_, i) => 2 * Math.PI * i / 128);
  const a = Math.acos(halfWidth / bore), b = Math.atan2(top, halfWidth);
  angles.push(a, b, Math.PI - a, Math.PI - b); angles.sort((a, b) => b - a);
  const points = angles.map((angle) => {
    const radius = keyedBoreRadius(angle, bore, halfWidth, top);
    return new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
  });
  shape.holes.push(new THREE.Path(points));
}

export function makeRatchetBevel() {
  const root = new THREE.Group(), motion = makeRatchetBevelMotion(), f = motion.follower, p = f.parameters;
  const shaftRadius = 0.085, looseBoreRadius = 0.093, carrierBore = 0.0865;
  const teeth = 40, innerDistance = 0.60, outerDistance = 0.97, pitchConeAngle = Math.PI / 4;
  const ratchetZ = 1.33, ratchetDepth = 0.16, armZ = 1.51, armDepth = 0.09, pawlDepth = 0.09;
  const keyHalfWidth = 0.018, keyTop = 0.104, pivotBore = 0.0185, pivotRadius = 0.017;
  const rotor = (axis) => {
    const group = new THREE.Group(), member = new THREE.Group(); group.add(member);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    group.userData = { rotor: member, axis: axis.clone() }; return group;
  };
  const turned = (profile, color, options = {}) => new THREE.Mesh(turnedClutchGeometry(profile, { color, ...options }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.17, roughness: 0.61 }));
  const toothGeometry = bevelToothGeometry({ teeth, innerDistance, outerDistance, pitchConeAngle, toothHeight: 0.13,
    toothThicknessFactor: 0.999 });
  const bevelRoot = toothGeometry.userData.root, innerScale = innerDistance / outerDistance;
  const makeBevel = (axis, color, bore, hubEnd) => {
    const group = rotor(axis);
    const profile = [[bevelRoot.z * innerScale, bore], [bevelRoot.z * innerScale, bevelRoot.radius * innerScale],
      [bevelRoot.z, bevelRoot.radius], [bevelRoot.z + 0.065, bevelRoot.radius], [1.19, 0.32],
      [1.22, 0.32], [1.22, 0.20], [hubEnd, 0.20], [hubEnd, bore]];
    const body = turned(profile, color), toothMeshes = [];
    group.userData.rotor.add(body);
    for (let i = 0; i < teeth; i += 1) {
      const mesh = new THREE.Mesh(toothGeometry, matte(color, { metalness: 0.16, roughness: 0.58 }));
      mesh.rotation.z = i * 2 * Math.PI / teeth;
      mesh.userData = { bevelTooth: true, index: i }; toothMeshes.push(mesh); group.userData.rotor.add(mesh);
    }
    Object.assign(group.userData, { body, profile, toothMeshes, boreRadius: bore, teeth, pitchConeAngle,
      toothProfile: 'back-cone-involute-approximation', innerDistance, outerDistance });
    return group;
  };
  const rightGear = makeBevel(new THREE.Vector3(1, 0, 0), PALETTE.driver, looseBoreRadius, 1.25);
  const leftGear = makeBevel(new THREE.Vector3(-1, 0, 0), PALETTE.accent, looseBoreRadius, 1.25);
  // The output member is fitted to its shaft; only the two horizontal
  // members need loose running bores.
  const outputGear = makeBevel(new THREE.Vector3(0, 1, 0), PALETTE.driven, 0.075, 1.27);
  const shaft = rotor(new THREE.Vector3(1, 0, 0));
  const shaftBody = turned([[-1.90, 0], [-1.90, shaftRadius], [1.90, shaftRadius], [1.90, 0]], PALETTE.ink);
  shaft.userData.rotor.add(shaftBody);
  const feathers = [-1, 1].map((side) => {
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.020, armDepth), matte(PALETTE.brass));
    key.position.set(0, 0.090, side * armZ); shaft.userData.rotor.add(key); return key;
  });
  const outputShaft = rotor(new THREE.Vector3(0, 1, 0));
  const outputShaftBody = turned([[0.58, 0], [0.58, 0.075], [1.48, 0.075], [1.48, 0]], PALETTE.ink);
  outputShaft.userData.rotor.add(outputShaftBody);
  const armShape = new THREE.Shape(), hubRadius = 0.15, stemHalf = 0.055;
  const hubAngle = Math.acos(stemHalf / hubRadius), hubY = Math.sqrt(hubRadius ** 2 - stemHalf ** 2);
  armShape.moveTo(0.08, p.armRadius); armShape.lineTo(stemHalf, hubY);
  armShape.absarc(0, 0, hubRadius, hubAngle, Math.PI - hubAngle, true);
  armShape.lineTo(-0.08, p.armRadius); armShape.absarc(0, p.armRadius, 0.08, Math.PI, 0, true); armShape.closePath();
  keyedHole(armShape, carrierBore, keyHalfWidth, keyTop); circleHole(armShape, 0, p.armRadius, pivotBore);
  const armGeometry = extruded(armShape, armDepth, armZ);
  const pawlShape = new THREE.Shape();
  pawlShape.moveTo(p.heelRadius, p.heelLength);
  pawlShape.absarc(0, p.heelLength, p.heelRadius, 0, Math.PI, false);
  pawlShape.lineTo(-0.030, 0); pawlShape.lineTo(-0.016, -f.length + 0.016);
  pawlShape.lineTo(-p.noseRadius, -f.length);
  pawlShape.absarc(0, -f.length, p.noseRadius, Math.PI, 2 * Math.PI, false);
  pawlShape.lineTo(0.016, -f.length + 0.016); pawlShape.lineTo(0.030, 0); pawlShape.closePath();
  circleHole(pawlShape, 0, 0, pivotBore);
  const pawlGeometry = extruded(pawlShape, pawlDepth, 0);
  const makeCarrier = (side, gear, color) => {
    const carrier = rotor(new THREE.Vector3(side, 0, 0));
    const arm = new THREE.Mesh(armGeometry, matte(PALETTE.frame));
    const pawl = new THREE.Group(); pawl.position.set(0, p.armRadius, ratchetZ);
    const pawlBody = new THREE.Mesh(pawlGeometry, matte(PALETTE.ink)); pawl.add(pawlBody);
    const pivotPin = turned([[1.275, 0], [1.275, pivotRadius], [1.565, pivotRadius], [1.565, 0]], PALETTE.brass);
    pivotPin.position.y = p.armRadius;
    const stop = new THREE.Vector2(-p.heelRadius - p.stopRadius, p.heelLength).rotateAround(new THREE.Vector2(), f.restAngle);
    const stopPin = turned([[1.285, 0], [1.285, p.stopRadius], [1.565, p.stopRadius], [1.565, 0]], PALETTE.brass);
    stopPin.position.set(stop.x, p.armRadius + stop.y, 0);
    const ratchetShape = new THREE.Shape(f.outline); circleHole(ratchetShape, 0, 0, looseBoreRadius);
    const ratchetGeometry = extruded(ratchetShape, ratchetDepth, ratchetZ);
    ratchetGeometry.rotateZ(-Math.PI / 2);
    ratchetGeometry.userData.outline = f.outline.map((v) => new THREE.Vector2(Math.fround(v.y), -Math.fround(v.x)));
    const ratchet = new THREE.Mesh(ratchetGeometry, matte(color, { metalness: 0.17, roughness: 0.59 }));
    gear.userData.rotor.add(ratchet);
    // A small torsion coil occupies the gap between pawl and carrier. Its
    // free leg follows the heel; elastic stresses are outside this model.
    const springMaterial = matte(PALETTE.brass), spring = new THREE.Mesh(new THREE.BufferGeometry(), springMaterial);
    let previousAngle = Infinity;
    const updateSpring = (angle) => {
      if (Math.abs(angle - previousAngle) < 1e-10) return; previousAngle = angle;
      const points = [];
      points.push(new THREE.Vector3(0.031, p.armRadius, 1.49));
      for (let i = 0; i <= 96; i += 1) {
        const turn = i / 96 * (6 * Math.PI + angle - f.restAngle);
        points.push(new THREE.Vector3(0.029 * Math.cos(turn), p.armRadius + 0.029 * Math.sin(turn), 1.445 - 0.04 * i / 96));
      }
      const heel = new THREE.Vector2(0, p.heelLength).rotateAround(new THREE.Vector2(), angle);
      points.push(new THREE.Vector3(heel.x, p.armRadius + heel.y, 1.39));
      points.push(new THREE.Vector3(heel.x, p.armRadius + heel.y, ratchetZ + pawlDepth / 2));
      spring.geometry.dispose(); spring.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 0.0025, 6, false);
    };
    carrier.userData.rotor.add(arm, pawl, pivotPin, stopPin, spring);
    carrier.userData.parts = { arm, pawl, pawlBody, pivotPin, stopPin, ratchet, spring, updateSpring };
    return carrier;
  };
  const rightCarrier = makeCarrier(1, rightGear, PALETTE.driver), leftCarrier = makeCarrier(-1, leftGear, PALETTE.accent);
  const bearings = [-1, 1].map((side) => {
    const bearing = rotor(new THREE.Vector3(side, 0, 0));
    const shape = new THREE.Shape([new THREE.Vector2(-0.13, -1.19), new THREE.Vector2(0.13, -1.19),
      new THREE.Vector2(0.13, 0.26), new THREE.Vector2(-0.13, 0.26)]);
    circleHole(shape, 0, 0, 0.092);
    const body = new THREE.Mesh(extruded(shape, 0.14, 1.65), matte(PALETTE.frame)); bearing.userData.rotor.add(body);
    const braceShape = new THREE.Shape();
    braceShape.moveTo(1.72, -0.20); braceShape.quadraticCurveTo(1.79, -1.13, 2.15, -1.19);
    braceShape.lineTo(1.72, -1.19); braceShape.closePath();
    const braceGeometry = extruded(braceShape, 0.12, 0);
    if (side < 0) { braceGeometry.scale(-1, 1, 1); const a = braceGeometry.attributes.position;
      for (let i = 0; i < a.count; i += 3) {
        const b = new THREE.Vector3().fromBufferAttribute(a, i + 1), c = new THREE.Vector3().fromBufferAttribute(a, i + 2);
        a.setXYZ(i + 1, c.x, c.y, c.z); a.setXYZ(i + 2, b.x, b.y, b.z);
      } braceGeometry.computeVertexNormals(); }
    const brace = new THREE.Mesh(braceGeometry, matte(PALETTE.frame)); root.add(brace);
    bearing.userData.body = body; bearing.userData.brace = brace; return bearing;
  });
  // Brown stands each standard's flared foot directly on the hatched
  // ground; no base slab joins them, so none is modelled.
  root.add(rightGear, leftGear, outputGear, shaft, outputShaft, rightCarrier, leftCarrier, ...bearings);
  const update = (time) => {
    const state = motion.stateAt(time);
    for (const gear of [rightGear, leftGear]) gear.userData.rotor.rotation.z = Math.PI / 2 + state.advance;
    outputGear.userData.rotor.rotation.z = -Math.PI / teeth - state.advance;
    outputShaft.userData.rotor.rotation.z = -Math.PI / teeth - state.advance;
    shaft.userData.rotor.rotation.z = state.inputAngle;
    for (const [carrier, sign, angle] of [[rightCarrier, 1, state.rightPawlAngle], [leftCarrier, -1, state.leftPawlAngle]]) {
      carrier.userData.rotor.rotation.z = sign * state.inputAngle;
      carrier.userData.parts.pawl.rotation.z = angle; carrier.userData.parts.updateSpring(angle);
    }
    root.userData.ratchetState = state; root.userData.kinematics = state;
  };
  root.userData = { fidelity: 'authored', mechanism: 'equal-miter-gears-with-contact-driven-opposed-pawls', motion,
    cameraFov: 17, hideGround: true, fullCameraDirection: new THREE.Vector3(4.8, 3.2, 8),
    blocks: { rightGear, leftGear, outputGear, rightCarrier, leftCarrier, shaft, shaftBody, feathers,
      outputShaft, outputShaftBody, bearings },
    geometry: { ...motion.parameters, ...p, teeth, ratchetTeeth: p.teeth, innerDistance, outerDistance, pitchConeAngle, shaftRadius, looseBoreRadius,
      carrierBore, ratchetZ, ratchetDepth, armZ, armDepth, pawlDepth, keyHalfWidth, keyTop, pivotBore, pivotRadius,
      pawlLength: f.length, pawlRestAngle: f.restAngle, cycleMeaning: 'one-oscillation-of-the-horizontal-shaft' } };
  update(0); markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.02, 0.02, 10) };
}
