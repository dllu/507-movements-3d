import * as THREE from 'three';
import { markShadows, matte, PALETTE } from './primitives.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { pinClutchMotion } from './pin-clutch-motion.js';

function polygon(cx, cy, radius, count, shape = new THREE.Path()) {
  for (let i = 0; i < count; i += 1) {
    const angle = 2 * Math.PI * i / count, x = cx + radius * Math.cos(angle), y = cy + radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath(); return shape;
}
function plate(shape, depth, color) {
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 })
    .translate(0, 0, -depth / 2), matte(color, { metalness: 0.16, roughness: 0.6 }));
}
function turned(profile, color, options = {}) {
  return new THREE.Mesh(turnedClutchGeometry(profile, { color, angularSegments: 128, ...options }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.57 }));
}
function rotorFrame() {
  const group = new THREE.Group(), rotor = new THREE.Group();
  group.rotation.y = Math.PI / 2; group.add(rotor); group.userData.rotor = rotor; return group;
}

export function makePinClutch() {
  const motion = pinClutchMotion(), p = { ...motion.parameters,
    driverRadius: 1, outputRadius: 1.10, driverThickness: 0.40,
    shaftRadius: 0.10, driverBore: 0.103, driverHubRadius: 0.26,
    grooveLeft: 0.54, grooveRight: 0.73, grooveRadius: 0.16, collarRadius: 0.30,
    shoeClearance: 0.00001, shoeHeight: 0.085, shoeBackZ: 0.205, shoeFrontZ: 0.270,
    leverZ: 0.335, leverDepth: 0.050, pivotRadius: 0.045, pivotBore: 0.046,
    followerRadius: 0.030, followerBore: 0.031 };
  const root = new THREE.Group(), driver = rotorFrame(), output = rotorFrame();
  const driverBody = turned([[-0.55, p.driverBore], [-0.55, p.driverHubRadius], [-0.20, p.driverHubRadius],
    [-0.20, p.driverRadius], [0.20, p.driverRadius], [0.20, p.driverBore]], PALETTE.driver);
  const studs = [-1, 1].map((side) => {
    const part = turned([[p.driverFaceX, 0], [p.driverFaceX, p.studRadius], [p.studTipX, p.studRadius], [p.studTipX, 0]],
      PALETTE.brass, { angularSegments: p.pinSegments });
    part.position.y = side * p.studCircleRadius; part.userData.driveStud = true; return part;
  });
  driver.userData.rotor.add(driverBody, ...studs);
  const diskShape = polygon(0, 0, p.outputRadius, 256, new THREE.Shape());
  diskShape.holes.push(polygon(0, 0, p.shaftRadius, 128));
  for (const side of [-1, 1]) diskShape.holes.push(polygon(0, side * p.studCircleRadius, p.holeRadius, p.holeSegments));
  const outputDisk = plate(diskShape, p.outputThickness, PALETTE.driven); outputDisk.position.z = p.outputThickness / 2;
  const outputHub = turned([[p.outputThickness, p.shaftRadius], [p.outputThickness, 0.28], [p.grooveLeft, 0.28],
    [p.grooveLeft, p.grooveRadius], [p.grooveRight, p.grooveRadius], [p.grooveRight, p.collarRadius],
    [0.82, p.collarRadius], [0.82, p.shaftRadius]], PALETTE.driven);
  const shaft = turned([[-1.9, 0], [-1.9, p.shaftRadius], [2.30, p.shaftRadius], [2.30, 0]], PALETTE.ink);
  const knob = turned([[1.55, p.shaftRadius], [1.55, 0.15], [1.73, 0.27], [2.06, 0.27], [2.22, 0.15], [2.22, p.shaftRadius]], PALETTE.driven);
  output.userData.rotor.add(outputDisk, outputHub, shaft, knob);
  // The common shaft and right disk slide together. The left disk is loose
  // on its sleeve; the two studs provide the only coupling to the output.
  const lever = new THREE.Group(), outline = new THREE.Shape();
  outline.moveTo(-0.13, 0); outline.quadraticCurveTo(-0.13, 0.07, -0.085, 0.15);
  outline.lineTo(-0.063, p.leverLength); outline.absarc(0, p.leverLength, 0.063, Math.PI, 0, true);
  outline.lineTo(0.061, 0.22); outline.quadraticCurveTo(0.07, 0.13, 0.20, 0.065);
  // Brown breaks the handle off near the plate edge. It runs on at even
  // width, just past the edge, into a turned round grip for the hand.
  const handleEnd = p.handleLength + 0.62, handleHalfWidth = 0.03, gripLength = 0.3;
  const gripStart = handleEnd - gripLength;
  outline.lineTo(p.handleLength, handleHalfWidth); outline.lineTo(gripStart, handleHalfWidth);
  outline.lineTo(gripStart, -handleHalfWidth);
  outline.lineTo(p.handleLength, -handleHalfWidth); outline.lineTo(0.12, -0.09); outline.quadraticCurveTo(0.05, -0.13, 0, -0.13);
  outline.quadraticCurveTo(-0.13, -0.13, -0.13, 0); outline.closePath();
  outline.holes.push(polygon(0, 0, p.pivotBore, 128), polygon(0, p.leverLength, p.followerRadius, 128));
  const leverBody = plate(outline, p.leverDepth, PALETTE.frame);
  const followerPin = turned([[-0.160, 0], [-0.160, p.followerRadius], [0.035, p.followerRadius], [0.035, 0]], PALETTE.brass);
  const followerCap = turned([[0.030, 0], [0.030, 0.043], [0.055, 0.043], [0.055, 0]], PALETTE.brass);
  const followerBackCap = turned([[-0.155, 0], [-0.155, 0.043], [-0.135, 0.043], [-0.135, 0]], PALETTE.brass);
  followerPin.position.y = p.leverLength; followerCap.position.y = p.leverLength; followerBackCap.position.y = p.leverLength;
  const grip = turned([[0, 0], [0, 0.042], [0.06, 0.056], [gripLength - 0.07, 0.058], [gripLength - 0.02, 0.048],
    [gripLength, 0.03], [gripLength, 0]], PALETTE.brass);
  grip.rotation.y = Math.PI / 2; grip.position.x = gripStart; grip.userData.role = 'lever-handle-grip';
  lever.add(leverBody, grip, followerPin, followerCap, followerBackCap); lever.position.set(p.leverPivotX, p.leverPivotY, p.leverZ);
  const shoeWidth = p.grooveRight - p.grooveLeft - 2 * p.shoeClearance;
  const shoeShape = new THREE.Shape([new THREE.Vector2(-shoeWidth / 2, -p.shoeHeight / 2),
    new THREE.Vector2(shoeWidth / 2, -p.shoeHeight / 2), new THREE.Vector2(shoeWidth / 2, p.shoeHeight / 2),
    new THREE.Vector2(-shoeWidth / 2, p.shoeHeight / 2)]);
  shoeShape.closePath(); shoeShape.holes.push(polygon(0, 0, p.followerBore, 128));
  const shoe = plate(shoeShape, p.shoeFrontZ - p.shoeBackZ, PALETTE.brass);
  shoe.position.z = (p.shoeFrontZ + p.shoeBackZ) / 2;
  const pivot = new THREE.Group(); pivot.position.set(p.leverPivotX, p.leverPivotY, 0);
  const pivotPin = turned([[0.27, 0], [0.27, p.pivotRadius], [0.385, p.pivotRadius], [0.385, 0]], PALETTE.ink);
  const pivotCaps = [[0.280, 0.305], [0.365, 0.393]].map(([a, b]) =>
    turned([[a, 0], [a, 0.075], [b, 0.075], [b, 0]], PALETTE.brass));
  // Brown draws the fixed fulcrum only as a capped pin, with no bracket; it
  // ends as a plain stub (p62: the undrawn wall flange is removed).
  pivot.add(pivotPin, ...pivotCaps); root.add(driver, output, lever, shoe, pivot);
  const update = (time) => {
    const state = motion.stateAtTime(time);
    driver.userData.rotor.rotation.z = state.driverAngle;
    output.position.x = state.outputFaceX; output.userData.rotor.rotation.z = state.outputAngle;
    lever.rotation.z = state.leverAngle; shoe.position.x = state.followerX; shoe.position.y = state.followerY;
    root.userData.kinematics = state;
  };
  root.userData = { fidelity: 'authored', mechanism: 'two-stud-clutch-with-loaded-hole-walls-and-bell-crank',
    cameraFov: 17, hideGround: true, fullCameraDirection: new THREE.Vector3(5, 3, 8),
    geometry: { ...p, handleEnd, handleHalfWidth }, blocks: { driver, output, lever, shoe, pivot },
    parts: { driverBody, studs, outputDisk, outputHub, shaft, knob, leverBody, grip, followerPin, followerCap, followerBackCap, pivotPin, pivotCaps },
    stateAtTime: motion.stateAtTime };
  // Frame Brown's plate: the measured swept box with the handle to his break.
  // Its run on to the grip stays out of the fit.
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-1.56, -1.1415, -1.1), new THREE.Vector3(3.26, 1.1, 1.1));
  update(0); markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
