import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { makeFrictionClutchMotion } from './friction-clutch-motion.js';
import { makeClutchSections, turnedClutchGeometry } from './clutch-section-geometry.js';
import { applyRotationIndicator } from './rotation-indicator.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1), X_AXIS = new THREE.Vector3(1, 0, 0);

export function makeFrictionClutch() {
  const root = new THREE.Group(), motion = makeFrictionClutchMotion();
  const p = motion.parameters, offsetX = -0.72;
  const shaftRadius = 0.1145, boreRadius = 0.124, keyHalfWidth = 0.025, keywayTop = 0.153;
  const outputPhase = -Math.PI / 2;
  const inputProfile = [[0, boreRadius], [0, 1], [0.467, 1], [0.467, 0.890],
    [0.168, 0.890], [0.168, 0.794], [0.467, 0.794], [0.467, 0.685],
    [0.168, 0.685], [0.168, 0.269], [0.292, 0.269], [0.292, boreRadius]];
  const outputProfile = [[0.572, boreRadius], [0.572, 0.800], [0.168, 0.800],
    [0.168, 0.884], [0.729, 0.884], [0.729, 0.25], [p.grooveLeft, 0.25],
    [p.grooveLeft, 0.182], [p.grooveRight, 0.182], [p.grooveRight, 0.25], [1.222, 0.25], [1.222, boreRadius]];
  // Brown's half-section is shown as ONE clean quarter cutaway: only the
  // upper near quarter (y > 0, z > 0) of each turned member is removed, so the
  // upper half shows Brown's section face while the lower half and every
  // turned view keep whole round bodies. Both exposed cut faces are capped.
  const planes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  const makeRotor = () => {
    const group = new THREE.Group(), rotor = new THREE.Group();
    group.quaternion.setFromUnitVectors(Z_AXIS, X_AXIS);
    group.position.x = offsetX;
    group.add(rotor);
    group.userData = { rotor, axis: X_AXIS.clone() };
    return group;
  };
  const makeMember = (profile, color, keyed) => {
    const group = makeRotor();
    const geometry = turnedClutchGeometry(profile, { boreRadius, keyHalfWidth: keyed ? keyHalfWidth : 0,
      keywayTop: keyed ? keywayTop : 0, color });
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.15, roughness: 0.62,
      clippingPlanes: planes, clipIntersection: true, clipShadows: true });
    const body = new THREE.Mesh(geometry, material);
    group.userData.rotor.add(body);
    Object.assign(group.userData, { body, profile, boreRadius, keyHalfWidth: keyed ? keyHalfWidth : 0,
      keywayTop: keyed ? keywayTop : 0 });
    return group;
  };
  const input = makeMember(inputProfile, PALETTE.driver, false);
  const output = makeMember(outputProfile, PALETTE.driven, true);
  // The two plain turned clutch members carry the shared quadrant rotation
  // cue about their own axis (rotor Z). The fixed section caps do not turn.
  for (const member of [input, output]) applyRotationIndicator(member.userData.body, { axis: 'z' });
  const inputSection = makeClutchSections(inputProfile, { boreRadius, color: PALETTE.driver });
  const outputSection = makeClutchSections(outputProfile, { boreRadius, keyHalfWidth, keywayTop,
    color: PALETTE.driven });
  // Horizontal cut faces (plane y = 0, z > 0): the same section turned a
  // quarter about the shaft; the keyway angle is shifted to match.
  const inputFloor = makeClutchSections(inputProfile, { boreRadius, color: PALETTE.driver });
  const outputFloor = makeClutchSections(outputProfile, { boreRadius, keyHalfWidth, keywayTop,
    color: PALETTE.driven });
  for (const [section, keep] of [[inputSection, 'y'], [outputSection, 'y'], [inputFloor, 'z'], [outputFloor, 'z']]) {
    const { caps } = section.userData;
    section.remove(caps[1]);
    section.userData.caps = [caps[0]];
    caps[0].material = caps[0].material.clone();
    // The horizontal faces are turned a quarter, so render both sides: the
    // cut face must read solid from above and below as well as from the front.
    caps[0].material.side = THREE.DoubleSide;
    caps[0].material.clippingPlanes = [new THREE.Plane(keep === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1), 0)];
    section.position.x = offsetX;
  }
  inputFloor.rotation.x = outputFloor.rotation.x = Math.PI / 2;
  inputFloor.userData.setAngle(-Math.PI / 2);
  const shaft = makeRotor();
  const shaftProfile = [[-0.404, 0], [-0.404, 0.070], [-0.159, 0.070],
    [-0.159, shaftRadius], [1.636, shaftRadius], [1.636, 0]];
  const shaftBody = new THREE.Mesh(turnedClutchGeometry(shaftProfile, { color: PALETTE.ink }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.22, roughness: 0.5 }));
  const keyBottom = 0.109, keyTop = 0.148, keyLeft = 0.49, keyRight = 1.54, featherHalfWidth = 0.022;
  // The feather is the shaft's own steel, not a brass stripe along it.
  const feather = new THREE.Mesh(new THREE.BoxGeometry(featherHalfWidth * 2, keyTop - keyBottom, keyRight - keyLeft),
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.5 }));
  feather.position.set(0, (keyTop + keyBottom) / 2, (keyLeft + keyRight) / 2);
  feather.userData.shaftFeather = true;
  shaft.userData.rotor.add(shaftBody, feather);
  Object.assign(shaft.userData, { body: shaftBody, feather, shaftRadius, featherHalfWidth, keyBottom, keyTop, keyLeft, keyRight });

  const lever = new THREE.Group();
  lever.position.set(offsetX + motion.pivot.x, motion.pivot.y, 0);
  const handleLength = 0.769, leverDepth = 0.05, leverBackZ = 0.041;
  const leverShape = new THREE.Shape();
  leverShape.moveTo(0.034, p.leverLength);
  leverShape.lineTo(0.054, 0.025);
  leverShape.lineTo(handleLength, 0.022);
  leverShape.absarc(handleLength, 0, 0.022, Math.PI / 2, -Math.PI / 2, true);
  const handleJoinX = Math.sqrt(0.06 ** 2 - 0.022 ** 2);
  leverShape.lineTo(handleJoinX, -0.022);
  leverShape.absarc(0, 0, 0.06, -Math.asin(0.022 / 0.06), -Math.PI, true);
  leverShape.lineTo(-0.034, p.leverLength);
  leverShape.absarc(0, p.leverLength, 0.034, Math.PI, 0, true);
  leverShape.closePath();
  const pivotBore = 0.0245, followerBore = 0.0175;
  for (const [y, r] of [[0, pivotBore], [p.leverLength, followerBore]]) {
    const hole = new THREE.Path(); hole.absarc(0, y, r, 0, 2 * Math.PI, true); leverShape.holes.push(hole);
  }
  const leverBody = new THREE.Mesh(new THREE.ExtrudeGeometry(leverShape,
    { depth: leverDepth, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, leverBackZ),
  matte(PALETTE.frame, { metalness: 0.15, roughness: 0.61 }));
  // The handle ends in a turned grip for the hand. Brown draws the lever's
  // fixed pivot as a plain circle with no frame, so the pivot is a short
  // fixed pin stub, as on 48 and 52.
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.24, 24),
    matte(PALETTE.brass, { metalness: 0.1, roughness: 0.66 }));
  grip.rotation.z = Math.PI / 2;
  grip.position.set(handleLength + 0.022 + 0.004 + 0.12, 0, leverBackZ + leverDepth / 2);
  grip.userData.role = 'lever-handle-grip';
  lever.add(leverBody, grip);
  Object.assign(lever.userData, { body: leverBody, pivotBore, followerBore, handleLength, leverLength: p.leverLength,
    leverBackZ, leverDepth });

  const followerProfile = [[-0.036, followerBore], [-0.036, p.rollerRadius], [0.036, p.rollerRadius], [0.036, followerBore]];
  const follower = new THREE.Mesh(turnedClutchGeometry(followerProfile, { boreRadius: followerBore, color: PALETTE.brass }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.17, roughness: 0.59 }));
  follower.userData = { groovedCollarFollower: true, radius: p.rollerRadius, boreRadius: followerBore };
  const pin = (radius, low, high) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 32), matte(PALETTE.ink));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = (low + high) / 2;
    return mesh;
  };
  const followerPin = pin(0.016, -0.040, 0.10), pivotPin = pin(0.023, leverBackZ - 0.03, 0.10);
  pivotPin.position.x = lever.position.x;
  pivotPin.position.y = lever.position.y;
  root.add(input, output, shaft, inputSection, outputSection, inputFloor, outputFloor, lever, follower, followerPin, pivotPin);
  const setSectionView = (enabled) => {
    for (const member of [input, output]) {
      member.userData.body.material.clippingPlanes = enabled ? planes : [];
      member.userData.body.material.needsUpdate = true;
    }
    inputSection.visible = enabled; outputSection.visible = enabled;
    inputFloor.visible = enabled; outputFloor.visible = enabled;
    root.userData.sectionView = enabled;
    root.userData.hideGround = enabled;
  };
  root.userData = { fidelity: 'authored', mechanism: 'annular-tongue-friction-clutch-with-fixed-section', localClippingEnabled: true,
    sectionView: true, hideGround: true, setSectionView, motion,
    fullCameraDirection: new THREE.Vector3(5.4, 3.6, 8),
    blocks: { input, output, shaft, feather, inputSection, outputSection, inputFloor, outputFloor, lever, follower, followerPin, pivotPin },
    geometry: { inputProfile, outputProfile, offsetX, shaftRadius, boreRadius, keyHalfWidth, keywayTop,
      ...p, outputPhase, handleLength, shaftLeft: -0.404, shaftShoulder: -0.159, shaftRight: 1.636,
      sectionBackZ: -0.08, cycleMeaning: 'engage-drive-release-and-coast' } };
  const update = (time) => {
    const state = motion.stateAt(time);
    state.outputAngle += outputPhase;
    input.userData.rotor.rotation.z = state.inputAngle;
    output.userData.rotor.rotation.z = state.outputAngle;
    shaft.userData.rotor.rotation.z = state.outputAngle;
    output.position.x = offsetX + state.shift;
    outputSection.position.x = offsetX + state.shift;
    outputSection.userData.setAngle(state.outputAngle);
    outputFloor.position.x = offsetX + state.shift;
    outputFloor.userData.setAngle(state.outputAngle - Math.PI / 2);
    lever.rotation.z = -state.leverAngle;
    follower.position.copy(state.followerPoint).add(new THREE.Vector3(offsetX, 0, 0));
    followerPin.position.x = follower.position.x; followerPin.position.y = follower.position.y;
    root.userData.clutchState = state;
    root.userData.kinematics = { ...state, contactGap: state.shift,
      frictionCapacity: p.frictionTorque * state.contactPressure, loadTorque: p.loadTorque, inertia: p.inertia };
  };
  update(0);
  root.userData.cameraFov = 17;
  markShadows(root);
  for (const section of [inputSection, outputSection, inputFloor, outputFloor]) section.traverse((part) => {
    part.castShadow = false; part.receiveShadow = false;
  });
  return { root, update, cameraDirection: new THREE.Vector3(0.025, 0.025, 10) };
}
