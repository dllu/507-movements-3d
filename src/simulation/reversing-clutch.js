import * as THREE from 'three';
import { pinWallBracket } from './beyond-crop-hardware.js';
import { makeHaulingHand } from './hauling-hand.js';
import { PALETTE, matte, markShadows } from './primitives.js';
import { bevelToothGeometry } from './bevel-geometry.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { jawClutchGeometry } from './jaw-clutch-geometry.js';
import { reversingClutchMotion } from './reversing-clutch-motion.js';

function rotor(axis = new THREE.Vector3(1, 0, 0)) {
  const group = new THREE.Group(), member = new THREE.Group(); group.add(member);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
  group.userData = { rotor: member, axis }; return group;
}
function turned(profile, color, options = {}) {
  return new THREE.Mesh(turnedClutchGeometry(profile, { color, ...options }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.18, roughness: 0.60 }));
}
function plate(shape, depth, center, color) {
  return new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 64 })
    .translate(0, 0, center - depth / 2), matte(color, { metalness: 0.16, roughness: 0.6 }));
}
function hole(shape, x, y, radius) {
  const path = new THREE.Path();
  for (let i = 0; i < 256; i += 1) {
    const a = 2 * Math.PI * i / 256;
    if (i === 0) path.moveTo(x + radius * Math.cos(a), y + radius * Math.sin(a));
    else path.lineTo(x + radius * Math.cos(a), y + radius * Math.sin(a));
  }
  path.closePath(); shape.holes.push(path);
}

export function makeReversingClutch() {
  const motion = reversingClutchMotion(), p = { ...motion.parameters,
    innerDistance: 0.68, outerDistance: 0.97, pitchConeAngle: Math.PI / 4,
    shaftRadius: 0.055, looseBore: 0.060, slidingBore: 0.057, verticalShaftRadius: 0.045,
    crownRadius: 0.26, keyHalfWidth: 0.016, keywayTop: 0.074,
    featherHalfWidth: 0.01599, featherBottom: 0.052, featherTop: 0.072, featherHalfLength: 0.53,
    grooveLeft: -0.08, grooveRight: 0.08, grooveRadius: 0.13, collarRadius: 0.185,
    shoeClearance: 0.00001, shoeHeight: 0.035, shoeBackZ: 0.140, shoeFrontZ: 0.165,
    leverZ: 0.210, leverDepth: 0.028, pivotRadius: 0.027, pivotBore: 0.028,
    followerRadius: 0.012, followerBore: 0.0128, handleRadius: 0.016, handleBore: 0.017,
    rodZ: 0.270, rodDepth: 0.024 };
  const root = new THREE.Group(), tooth = bevelToothGeometry({ teeth: p.teeth, innerDistance: p.innerDistance,
    outerDistance: p.outerDistance, pitchConeAngle: p.pitchConeAngle, toothHeight: 0.13, toothThicknessFactor: 0.999 });
  const r = tooth.userData.root, scale = p.innerDistance / p.outerDistance;
  const bevel = (axis, reversed, color, bore) => {
    const gear = rotor(axis), cone = new THREE.Group(); if (reversed) cone.rotation.y = Math.PI;
    gear.userData.rotor.add(cone);
    const profile = [[r.z * scale, bore], [r.z * scale, r.radius * scale], [r.z, r.radius],
      [r.z + 0.040, r.radius], [1.13, 0.16], [1.16, 0.16], [1.16, 0.10], [1.23, 0.10], [1.23, bore]];
    const body = turned(profile, color), toothMeshes = [];
    cone.add(body);
    for (let i = 0; i < p.teeth; i += 1) {
      const mesh = new THREE.Mesh(tooth, matte(color, { metalness: 0.16, roughness: 0.58 }));
      mesh.rotation.z = 2 * Math.PI * i / p.teeth; mesh.userData.bevelTooth = true; cone.add(mesh); toothMeshes.push(mesh);
    }
    Object.assign(gear.userData, { cone, body, toothMeshes, bore }); return gear;
  };
  const leftGear = bevel(new THREE.Vector3(1, 0, 0), true, PALETTE.accent, p.looseBore);
  const rightGear = bevel(new THREE.Vector3(1, 0, 0), false, PALETTE.driver, p.looseBore);
  const inputGear = bevel(new THREE.Vector3(0, 1, 0), false, PALETTE.brass, p.verticalShaftRadius);
  const crown = (profile, front, direction, workingPhase, color, keyed = false, smoothProfileIndices = []) => {
    // Keep a fixed root station beside each displaced front corner. This
    // splits the bore and outer wall at the working face's lower edge,
    // avoiding a T-junction where a raised tooth meets a valley.
    const expanded = [], moving = [], smoothed = [];
    for (let i = 0; i < profile.length; i += 1) {
      const active = front.includes(i);
      if (active && !front.includes((i + profile.length - 1) % profile.length)) expanded.push([...profile[i]]);
      if (active) moving.push(expanded.length);
      if (smoothProfileIndices.includes(i)) smoothed.push(expanded.length);
      expanded.push([...profile[i]]);
      if (active && !front.includes((i + 1) % profile.length)) expanded.push([...profile[i]]);
    }
    const geometry = jawClutchGeometry(expanded, { movingIndices: moving, direction, hand: 1, symmetric: true, frontRadialSegments: 32,
      phase: workingPhase, jawCount: p.jawCount,
      jawHeight: p.jawHeight, boreRadius: keyed ? p.slidingBore : p.looseBore,
      keyHalfWidth: keyed ? p.keyHalfWidth : 0, keywayTop: keyed ? p.keywayTop : 0, smoothProfileIndices: smoothed, color });
    // Brown draws no index marks: repaint the generator's light rim stripe.
    const base = new THREE.Color(color), colors = geometry.attributes.color;
    for (let i = 0; i < colors.count; i += 1) colors.setXYZ(i, base.r, base.g, base.b);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.18, roughness: 0.60 }));
    mesh.userData.crownJaw = true; return mesh;
  };
  const leftCrown = crown([[-0.82, p.looseBore], [-0.82, p.crownRadius], [-p.gearFaceDistance, p.crownRadius], [-p.gearFaceDistance, p.looseBore]],
    [2, 3], 1, p.leftCrownPhase, PALETTE.accent);
  const rightCrown = crown([[p.gearFaceDistance, p.looseBore], [p.gearFaceDistance, p.crownRadius], [0.82, p.crownRadius], [0.82, p.looseBore]],
    [0, 1], -1, p.rightCrownPhase, PALETTE.driver);
  leftGear.userData.rotor.add(leftCrown); rightGear.userData.rotor.add(rightCrown);
  const shaft = rotor(), shaftBody = turned([[-1.32, 0], [-1.32, p.shaftRadius], [1.32, p.shaftRadius], [1.32, 0]], PALETTE.ink);
  const feather = new THREE.Mesh(new THREE.BoxGeometry(2 * p.featherHalfWidth, p.featherTop - p.featherBottom, 2 * p.featherHalfLength), matte(PALETTE.brass));
  feather.position.y = (p.featherTop + p.featherBottom) / 2; shaft.userData.rotor.add(shaftBody, feather);
  const verticalShaft = rotor(new THREE.Vector3(0, 1, 0));
  const verticalShaftBody = turned([[r.z * scale, 0], [r.z * scale, p.verticalShaftRadius], [1.34, p.verticalShaftRadius], [1.34, 0]], PALETTE.ink);
  verticalShaft.userData.rotor.add(verticalShaftBody);
  const sliding = rotor(), leftProfile = [[-p.centralFaceDistance, p.slidingBore], [-p.centralFaceDistance, p.crownRadius], [-0.24, p.crownRadius]];
  for (let i = 1; i <= 16; i += 1) {
    const u = i / 16; leftProfile.push([-0.24 + 0.15 * u, p.crownRadius + (p.collarRadius - p.crownRadius) * u * u * (3 - 2 * u)]);
  }
  leftProfile.push([p.grooveLeft, p.collarRadius], [p.grooveLeft, p.slidingBore]);
  const rightProfile = [...leftProfile].reverse().map(([x, radius]) => [-x, radius]);
  const smoothLeft = Array.from({ length: 17 }, (_, i) => i + 2), smoothRight = smoothLeft.map((i) => leftProfile.length - 1 - i);
  const leftSlidingCrown = crown(leftProfile, [0, 1], -1, 0, PALETTE.driven, true, smoothLeft);
  const rightSlidingCrown = crown(rightProfile, [rightProfile.length - 2, rightProfile.length - 1], 1, 0, PALETTE.driven, true, smoothRight);
  const core = turned([[p.grooveLeft, p.slidingBore], [p.grooveLeft, p.grooveRadius], [p.grooveRight, p.grooveRadius], [p.grooveRight, p.slidingBore]],
    PALETTE.driven, { boreRadius: p.slidingBore, keyHalfWidth: p.keyHalfWidth, keywayTop: p.keywayTop });
  sliding.userData.rotor.add(leftSlidingCrown, rightSlidingCrown, core);
  const lever = new THREE.Group(), outline = new THREE.Shape();
  outline.moveTo(0.075, 0); outline.quadraticCurveTo(0.075, 0.045, 0.040, 0.090);
  outline.lineTo(0.032, p.leverLength); outline.absarc(0, p.leverLength, 0.032, 0, Math.PI, false);
  outline.lineTo(-0.035, 0.10); outline.quadraticCurveTo(-0.045, 0.045, -0.10, 0.040);
  outline.lineTo(-p.handleLength, 0.045); outline.absarc(-p.handleLength, 0, 0.045, Math.PI / 2, 3 * Math.PI / 2, false);
  outline.lineTo(-0.09, -0.042); outline.quadraticCurveTo(-0.03, -0.075, 0, -0.075);
  outline.quadraticCurveTo(0.075, -0.075, 0.075, 0); outline.closePath();
  hole(outline, 0, 0, p.pivotBore); hole(outline, 0, p.leverLength, p.followerRadius); hole(outline, -p.handleLength, 0, p.handleRadius);
  const leverBody = plate(outline, p.leverDepth, p.leverZ, PALETTE.frame);
  const pin = (radius, a, b) => turned([[a, 0], [a, radius], [b, radius], [b, 0]], PALETTE.brass);
  const followerPin = pin(p.followerRadius, 0.132, 0.234), followerCaps = [pin(0.020, 0.131, 0.136), pin(0.020, 0.228, 0.240)];
  for (const part of [followerPin, ...followerCaps]) part.position.y = p.leverLength;
  const handlePin = pin(p.handleRadius, 0.185, 0.297), handleCaps = [pin(0.027, 0.181, 0.192), pin(0.027, 0.286, 0.304)];
  for (const part of [handlePin, ...handleCaps]) part.position.x = -p.handleLength;
  lever.add(leverBody, followerPin, ...followerCaps, handlePin, ...handleCaps); lever.position.set(p.pivotX, p.pivotY, 0);
  const width = p.grooveRight - p.grooveLeft - 2 * p.shoeClearance;
  const shoeShape = new THREE.Shape([new THREE.Vector2(-width / 2, -p.shoeHeight / 2), new THREE.Vector2(width / 2, -p.shoeHeight / 2),
    new THREE.Vector2(width / 2, p.shoeHeight / 2), new THREE.Vector2(-width / 2, p.shoeHeight / 2)]);
  shoeShape.closePath(); hole(shoeShape, 0, 0, p.followerBore);
  const shoe = plate(shoeShape, p.shoeFrontZ - p.shoeBackZ, (p.shoeFrontZ + p.shoeBackZ) / 2, PALETTE.brass);
  const pivot = new THREE.Group(), pivotPin = pin(p.pivotRadius, 0.165, 0.237), pivotCaps = [pin(0.042, 0.177, 0.192), pin(0.042, 0.228, 0.246)];
  // The fixed fulcrum pin's shank runs back, between the two bevel wheels
  // and below the clutch, to a small flange on the framing behind them.
  const fulcrumBracket = pinWallBracket({ x: 0, y: 0, pinRadius: p.pivotRadius, zPin: 0.165, zWall: -1.05,
    flange: 0.16, role: 'fulcrum-pin-wall-bracket' });
  pivot.add(pivotPin, ...pivotCaps, fulcrumBracket); pivot.position.set(p.pivotX, p.pivotY, 0);
  // Brown crops the hanging operating rod. It tapers over his drawn length,
  // then runs on at even width to the operator's hand just below the plate.
  const rodRunLength = 1.45, gripDepth = 1.3;
  const rod = new THREE.Group(), rodShape = new THREE.Shape();
  rodShape.moveTo(-0.015, -rodRunLength); rodShape.lineTo(0.015, -rodRunLength); rodShape.lineTo(0.015, -p.rodLength);
  rodShape.lineTo(0.030, 0); rodShape.absarc(0, 0, 0.030, 0, Math.PI, false); rodShape.lineTo(-0.015, -p.rodLength);
  rodShape.closePath(); hole(rodShape, 0, 0, p.handleBore);
  const rodBody = plate(rodShape, p.rodDepth, p.rodZ, PALETTE.frame); rod.add(rodBody);
  const hand = makeHaulingHand(new THREE.Vector3(0, 1, 0), 0.02);
  hand.getObjectByName('loose-rope-tail')?.removeFromParent();
  hand.scale.setScalar(0.5); hand.position.set(0, -gripDepth, p.rodZ); rod.add(hand);
  hand.userData.beyondPlateCrop = true; rodBody.userData.beyondPlateCropBelowY = -1.1416;
  root.add(leftGear, rightGear, inputGear, shaft, verticalShaft, sliding, lever, shoe, pivot, rod);
  const update = (time) => {
    const s = motion.stateAtTime(time);
    leftGear.userData.rotor.rotation.z = s.leftAngle; rightGear.userData.rotor.rotation.z = s.rightAngle;
    inputGear.userData.rotor.rotation.z = s.inputAngle; verticalShaft.userData.rotor.rotation.z = s.inputAngle;
    shaft.userData.rotor.rotation.z = s.outputAngle; sliding.userData.rotor.rotation.z = s.outputAngle; sliding.position.x = s.clutchX;
    lever.rotation.z = s.leverAngle; shoe.position.set(s.followerX, s.followerY, 0); rod.position.set(s.handleX, s.handleY, 0);
    root.userData.kinematics = s;
  };
  root.userData = { fidelity: 'authored', mechanism: 'equal-bevel-gears-and-keyed-reversing-crown-clutch',
    // A narrow field keeps the plate's near-orthographic front elevation.
    cameraFov: 8, hideGround: true, shadowCameraHalfExtent: 2, shadowBias: -0.00003,
    fullCameraDirection: new THREE.Vector3(4, 3, 8),
    geometry: p, stateAtTime: motion.stateAtTime, rawStateAtTime: motion.rawStateAtTime,
    blocks: { leftGear, rightGear, inputGear, shaft, verticalShaft, sliding, lever, shoe, pivot, rod },
    // Carried by the rod and the fixed pivot respectively; not separate bodies.
    beyondCrop: { hand, fulcrumBracket },
    parts: { leftCrown, rightCrown, leftSlidingCrown, rightSlidingCrown, core, shaftBody, feather, verticalShaftBody,
      leverBody, followerPin, followerCaps, handlePin, handleCaps, pivotPin, pivotCaps, rodBody } };
  // Frame Brown's plate: the measured swept box with the rod to his crop.
  // The rod's run on to the hand and the fulcrum bracket stay out of the fit.
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-1.32, -1.1416, -1.0047), new THREE.Vector3(1.32, 1.34, 1.0047));
  update(0); markShadows(root); return { root, update, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
