import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { boredSpurGeometry, jawClutchGeometry } from './jaw-clutch-geometry.js';
import { makeJawClutchMotion } from './jaw-clutch-motion.js';

export function makeJawClutch() {
  const root = new THREE.Group(), motion = makeJawClutchMotion(), p = motion.parameters;
  const shaftRadius = 0.15, boreRadius = 0.161, keyHalfWidth = 0.028, keywayTop = 0.193;
  const gearTeeth = 32, pinionTeeth = 18, module = 0.05875, gearDepth = 0.27;
  const gearPitchRadius = gearTeeth * module / 2, pinionPitchRadius = pinionTeeth * module / 2;
  const sourcePhase = 0.93, jawPhase = 0.24 * motion.pitch;
  const pinionY = gearPitchRadius + pinionPitchRadius;
  const rotor = () => {
    const group = new THREE.Group(), member = new THREE.Group(); group.add(member);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    group.userData = { rotor: member, axis: new THREE.Vector3(1, 0, 0) }; return group;
  };
  const input = rotor(), output = rotor(), shaft = rotor(), pinion = rotor(); pinion.position.y = pinionY;
  const solidMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.17, roughness: 0.61 });
  const turned = (profile, color, options = {}) => new THREE.Mesh(turnedClutchGeometry(profile, { color, ...options }), solidMaterial());
  const inputProfile = [[0.135, boreRadius], [0.135, 0.54], [0.69, 0.54], [0.69, 0.54],
    [0.69, boreRadius], [0.69, boreRadius]];
  const shoulder = Array.from({ length: 17 }, (_, i) => [1.95 + 0.23 * i / 16, 0.54 - 0.09 * (0.5 - 0.5 * Math.cos(Math.PI * i / 16))]);
  const outputProfile = [[1.47, boreRadius], [1.47, boreRadius], [1.47, 0.54], [1.47, 0.54],
    ...shoulder, [2.35, 0.45],
    [2.35, 0.29], [2.60, 0.29], [2.60, 0.46], [2.72, 0.46], [2.72, boreRadius]];
  const inputBody = new THREE.Mesh(jawClutchGeometry(inputProfile, { movingIndices: [3, 4], direction: 1,
    phase: jawPhase, ...p, boreRadius, color: PALETTE.accent }), solidMaterial());
  const outputBody = new THREE.Mesh(jawClutchGeometry(outputProfile, { movingIndices: [1, 2], direction: -1,
    phase: jawPhase + motion.pitch / 2, ...p, boreRadius, keyHalfWidth, keywayTop,
    smoothProfileIndices: shoulder.map((_, i) => i + 4), color: PALETTE.driven }), solidMaterial());
  const gearBody = new THREE.Mesh(boredSpurGeometry({ teeth: gearTeeth, module, depth: gearDepth, boreRadius }),
    matte(PALETTE.accent, { metalness: 0.16, roughness: 0.61 }));
  const pinionBody = new THREE.Mesh(boredSpurGeometry({ teeth: pinionTeeth, module, depth: gearDepth, boreRadius: 0.083 }),
    matte(PALETTE.driver, { metalness: 0.16, roughness: 0.61 }));
  const gearHub = turned([[-0.235, boreRadius], [-0.235, 0.34], [-0.135, 0.34], [-0.135, boreRadius]], PALETTE.accent);
  const pinionHubs = [-1, 1].map((side) => {
    const a = side < 0 ? -0.235 : 0.135, b = side < 0 ? -0.135 : 0.235;
    return turned([[a, 0.083], [a, 0.245], [b, 0.245], [b, 0.083]], PALETTE.driver);
  });
  const pinionShaft = turned([[-0.25, 0], [-0.25, 0.078], [0.25, 0.078], [0.25, 0]], PALETTE.ink);
  input.userData.rotor.add(gearBody, gearHub, inputBody);
  pinion.userData.rotor.add(pinionBody, ...pinionHubs, pinionShaft);
  output.userData.rotor.add(outputBody);
  const shaftBody = turned([[-0.56, 0], [-0.56, shaftRadius], [3.99, shaftRadius], [3.99, 0]], PALETTE.ink);
  const keyLeft = 0.93, keyRight = 3.87, keyBottom = 0.145, keyTop = 0.187, featherHalfWidth = 0.025;
  const feather = new THREE.Mesh(new THREE.BoxGeometry(2 * featherHalfWidth, keyTop - keyBottom, keyRight - keyLeft),
    matte(PALETTE.brass)); feather.position.set(0, (keyBottom + keyTop) / 2, (keyLeft + keyRight) / 2);
  shaft.userData.rotor.add(shaftBody, feather);
  const lever = new THREE.Group(); lever.position.set(p.pivotX, p.pivotY, 0);
  const handleLength = 1.09, leverBackZ = 0.385, leverDepth = 0.055;
  const shape = new THREE.Shape();
  shape.moveTo(0.055, p.leverLength); shape.lineTo(0.053, 0.046);
  shape.lineTo(handleLength, 0.032); shape.absarc(handleLength, 0, 0.068, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(0.074, -0.046); shape.absarc(0, 0, 0.09, -Math.PI / 4, -Math.PI, true);
  shape.lineTo(-0.055, p.leverLength); shape.absarc(0, p.leverLength, 0.055, Math.PI, 0, true); shape.closePath();
  for (const [x, y, r] of [[0, 0, 0.034], [0, p.leverLength, 0.022], [handleLength, 0, 0.022]]) {
    const hole = new THREE.Path(); hole.absarc(x, y, r, 0, 2 * Math.PI, true); shape.holes.push(hole);
  }
  const leverBody = new THREE.Mesh(new THREE.ExtrudeGeometry(shape,
    { depth: leverDepth, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, leverBackZ), matte(PALETTE.frame));
  lever.add(leverBody);
  const pin = (r, low, high) => turned([[low, 0], [low, r], [high, r], [high, 0]], PALETTE.ink);
  const follower = turned([[0.310, 0.022], [0.310, p.followerRadius], [0.365, p.followerRadius], [0.365, 0.022]],
    PALETTE.brass, { boreRadius: 0.022 });
  const followerPin = pin(0.020, 0.305, 0.45), pivotPin = pin(0.032, 0.31, 0.46), handlePin = pin(0.020, 0.38, 0.51);
  pivotPin.position.set(p.pivotX, p.pivotY, 0); handlePin.position.set(handleLength, 0, 0); lever.add(handlePin);
  // The engraving ends at a short vertical operating rod. Its top eye is
  // pinned to the bell crank and follows that endpoint without stretching.
  const rod = new THREE.Group(), rodShape = new THREE.Shape();
  rodShape.moveTo(-0.028, -0.58); rodShape.lineTo(0.028, -0.58); rodShape.lineTo(0.028, 0);
  rodShape.absarc(0, 0, 0.044, 0, Math.PI, false); rodShape.closePath();
  const rodBore = new THREE.Path(); rodBore.absarc(0, 0, 0.022, 0, 2 * Math.PI, true); rodShape.holes.push(rodBore);
  const rodBody = new THREE.Mesh(new THREE.ExtrudeGeometry(rodShape,
    { depth: 0.042, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, 0.455), matte(PALETTE.frame)); rod.add(rodBody);
  root.add(input, output, shaft, pinion, lever, follower, followerPin, pivotPin, rod);
  const update = (time) => {
    const state = motion.stateAt(time + sourcePhase * p.cycleDuration);
    state.pinionAngle = -state.inputAngle * gearTeeth / pinionTeeth;
    state.pinionAngularSpeed = -state.inputAngularSpeed * gearTeeth / pinionTeeth;
    input.userData.rotor.rotation.z = state.inputAngle;
    pinion.userData.rotor.rotation.z = state.pinionAngle;
    output.userData.rotor.rotation.z = state.outputAngle; shaft.userData.rotor.rotation.z = state.outputAngle;
    output.position.x = state.shift - p.stroke;
    lever.rotation.z = -state.leverAngle;
    follower.position.set(state.followerPoint.x, state.followerPoint.y, 0);
    followerPin.position.copy(follower.position);
    rod.position.set(p.pivotX + handleLength * Math.cos(state.leverAngle), p.pivotY - handleLength * Math.sin(state.leverAngle), 0);
    root.userData.clutchState = state; root.userData.kinematics = state;
  };
  root.userData = { fidelity: 'authored', mechanism: 'tapered-jaw-clutch-with-positive-flank-contact', hideGround: true,
    cameraFov: 17, fullCameraDirection: new THREE.Vector3(5.4, 3.6, 8), motion,
    blocks: { input, output, shaft, pinion, inputBody, outputBody, gearBody, pinionBody, shaftBody, feather,
      lever, leverBody, follower, followerPin, pivotPin, rod, rodBody, handlePin },
    geometry: { ...p, sourcePhase, jawPhase, inputProfile, outputProfile, shaftRadius, boreRadius, keyHalfWidth, keywayTop,
      keyLeft, keyRight, keyBottom, keyTop, featherHalfWidth, pinionTeeth, gearTeeth, module, gearDepth,
      gearPitchRadius, pinionPitchRadius, pinionY, handleLength, leverBackZ, leverDepth,
      cycleMeaning: 'align-insert-positive-drive-withdraw-and-coast' } };
  update(0); markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0.03, 0.06, 10) };
}
