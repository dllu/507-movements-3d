import * as THREE from 'three';
import { finishGrooveDrive } from './groove-drive-working-parts.js';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

// Movement 398: continuous rotation of cam C into intermittent circular
// motion of the wheel.
//
// Groove derivation. The roller rides on a crosshead guided along the line
// through both shafts (y = 0) and drives the wheel's crank through a finite
// rod: an in-line slider-crank. With crank radius r, rod length L, wheel
// centre x_w and the roller a fixed distance e left of the rod pin, the
// roller's distance from the cam centre x_c for crank angle phi is
//
//   d(phi) = x_w - x_c - e + r cos(phi) - sqrt(L^2 - r^2 sin^2(phi)).
//
// A crank driven through a rod can only go right round if the roller covers
// the full stroke 2r: d runs from d(pi) (crank toward the cam) to d(0). We
// prescribe the wheel angle as a function of cam angle psi, three turns of
// the wheel per cam turn (one per side of Brown's three-sided groove):
//
//   u = 3 psi / 2 pi,  phi(psi) = pi + 2 pi [ floor(u) + g(u - floor(u)) ],
//   g(f) = f - (a / 2 pi) sin(2 pi f),  0 < a < 1,
//
// so phi is monotone (phi' = 3 (1 - a cos 2 pi f) > 0: the wheel never stops
// or reverses), C1 across the sides, slowest (1 - a) with the crank toward
// the cam and fastest (1 + a) with it away. The groove centreline is then the
// roller centre carried round by the cam: in cam coordinates, polar radius
// d(phi(psi)) at polar angle psi (the cam turns clockwise under the fixed
// roller line). Its walls are that curve offset by the roller radius. The
// roller always has the stroke 2r to cover, which is what lets the wheel turn
// fully round instead of rocking.
export function cam398Law({crankRadius, rodLength, wheelX, camX, pivotOffset, unevenness}) {
  const g = (f) => f - unevenness / FULL_TURN * Math.sin(FULL_TURN * f);
  const wheelAngle = (camTurn) => {
    const u = 3 * camTurn / FULL_TURN;
    const n = Math.floor(u);
    return Math.PI + FULL_TURN * (n + g(u - n));
  };
  const rollerDistance = (phi) => wheelX - camX - pivotOffset + crankRadius * Math.cos(phi)
    - Math.sqrt(rodLength ** 2 - (crankRadius * Math.sin(phi)) ** 2);
  const centerline = (psi) => {
    const d = rollerDistance(wheelAngle(psi));
    return [d * Math.cos(psi), d * Math.sin(psi)];
  };
  return {wheelAngle, rollerDistance, centerline, g};
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function makeFollower({
  darkMaterial,
  followerMaterial,
  rollerRadius,
  scale,
  whiteMaterial,
}) {
  const follower = new THREE.Group();
  follower.userData.role =
    'one-piece-horizontal-roller-crosshead-and-rod-pivot-carriage';

  const roller = cylinderAlongZ(rollerRadius, 0.62, followerMaterial, 32);
  roller.position.z = 0.37;
  roller.userData.role = 'cam-contact-roller-constrained-to-horizontal-line';
  follower.add(roller);

  const pivotOffset = 8.197955 * scale;
  // The rails run into an eye round the roller's upper end, which stands
  // above the cam land (z 0.30), so the crosshead carries the roller as
  // Brown's rod eye does.
  const railStart = 0.17;
  const rollerEye = new THREE.Mesh(plate(clip.difference(
    poly(circle([0, 0], 0.22, 72)),
    poly(circle([0, 0], rollerRadius + 0.0005, 72)),
  ), 0.471, 0.629), followerMaterial);
  rollerEye.userData.role = 'crosshead-eye-carrying-cam-roller';
  follower.add(rollerEye);
  const railEnd = 7.43 * scale;
  const rails = [-0.095, 0.095].map((y) => {
    const rail = beamBetween(
      new THREE.Vector3(railStart, y, 0.55),
      new THREE.Vector3(railEnd, y, 0.55),
      0.075,
      0.16,
      followerMaterial,
    );
    rail.userData.role = 'horizontal-follower-crosshead-rail';
    follower.add(rail);
    return rail;
  });

  const blocks = [4.65, 7.35].map((sourceX) => {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.72, 0.36),
      followerMaterial,
    );
    block.position.set(sourceX * scale, 0, 0.45);
    block.userData.role = 'guided-follower-crosshead-block';
    follower.add(block);
    return block;
  });

  const pivot = cylinderAlongZ(0.14, 0.58, darkMaterial, 28);
  pivot.position.set(pivotOffset, 0, 0.54);
  pivot.userData.role = 'crosshead-pin-to-finite-connecting-rod';
  follower.add(pivot);
  const pivotIndex = cylinderAlongZ(0.072, 0.10, whiteMaterial, 22);
  pivotIndex.position.set(pivotOffset, 0, 0.89);
  pivotIndex.userData.role = 'white-index-on-crosshead-rod-pin';
  follower.add(pivotIndex);

  follower.userData.blocks = blocks;
  follower.userData.pivot = pivot;
  follower.userData.pivotIndex = pivotIndex;
  follower.userData.rails = rails;
  follower.userData.roller = roller;
  return markShadows(follower);
}

function makeOutputWheel({
  crankVector,
  darkMaterial,
  drivenMaterial,
  radius,
  whiteMaterial,
}) {
  const wheel = new THREE.Group();
  wheel.userData.role =
    'intermittently-rocking-output-wheel-with-offset-crank-pin';

  // Brown draws the output wheel as a plain disc, not a spoked rim.
  const rim = cylinderAlongZ(radius + 0.12, 0.24, drivenMaterial, 96);
  rim.position.z = 0.10;
  rim.userData.role = 'rocking-output-wheel-rim';
  wheel.add(rim);
  const spokes = [];

  // Brown shows only the shaft end in the crank's eye: a plain shaft,
  // standing just proud of the crank plate.
  const hub = cylinderAlongZ(0.155, 0.70, darkMaterial, 32);
  hub.position.z = 0.17;
  hub.userData.role = 'fixed-axis-output-wheel-hub';
  wheel.add(hub);

  // Brown's crank is an eyed lever plate: a broad eye on the shaft
  // tapering to a small eye at the pin (the hull of the two eyes).
  const crankLength = Math.hypot(crankVector.x, crankVector.y);
  const shaftEye = 0.30, pinEye = 0.20;
  const tangent = Math.acos((shaftEye - pinEye) / crankLength);
  const crankOutline = clip.union(
    poly(circle([0, 0], shaftEye, 72)),
    poly(circle([crankLength, 0], pinEye, 48)),
    [[[shaftEye * Math.cos(tangent), shaftEye * Math.sin(tangent)],
      [shaftEye * Math.cos(tangent), -shaftEye * Math.sin(tangent)],
      [crankLength + pinEye * Math.cos(tangent), -pinEye * Math.sin(tangent)],
      [crankLength + pinEye * Math.cos(tangent), pinEye * Math.sin(tangent)]]],
  );
  const crankArm = new THREE.Mesh(
    plate(crankOutline, 0.28, 0.50),
    // A separate plate on the disc face, so it reads as Brown's outlined lever.
    matte(PALETTE.brass, {metalness: 0.2, roughness: 0.5}),
  );
  crankArm.rotation.z = Math.atan2(crankVector.y, crankVector.x);
  crankArm.userData.role = 'output-wheel-offset-crank-arm';
  wheel.add(crankArm);
  const crankPin = cylinderAlongZ(0.145, 0.64, darkMaterial, 30);
  crankPin.position.set(crankVector.x, crankVector.y, 0.50);
  crankPin.userData.role = 'output-crank-pin-driven-by-finite-rod';
  wheel.add(crankPin);

  const index = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.45, 0.085, 0.05),
    whiteMaterial,
  );
  index.position.set(radius * 0.72, 0, 0.28);
  index.userData.role = 'white-radial-index-showing-output-rocking-angle';
  wheel.add(index);

  wheel.userData.crankArm = crankArm;
  wheel.userData.crankPin = crankPin;
  wheel.userData.hub = hub;
  wheel.userData.index = index;
  wheel.userData.rim = rim;
  wheel.userData.spokes = spokes;
  return markShadows(wheel);
}

function camFullTurnDrive(movement) {
  const root = new THREE.Group();
  const cycleDuration = 7; // one cam turn, three wheel turns
  const scale = 0.40;
  const camX = -3.82;
  const camRadius = 5 * scale;
  const rollerRadius = 0.16;
  const clearance = 0.0006;
  const pivotOffset = 8.197955 * scale; // roller to rod pin on the crosshead
  const rodLength = 8 * scale;
  const wheelX = camX + 19.070509 * scale;
  // The crank throw is half the roller's stroke; Brown's groove runs its
  // roller between about 0.39 and 0.77 of the cam radius, so r = 0.4.
  const crankRadius = 0.40;
  const unevenness = 0.8;
  const law = cam398Law({crankRadius, rodLength, wheelX, camX, pivotOffset, unevenness});
  // Time zero: the roller near the lobe at three o'clock and the crank
  // raised, as Brown draws it; the cam lobes then lie as on the plate.
  const sourceCamTurn = FULL_TURN / 3 * 0.55;

  const driverMaterial = matte(PALETTE.driver, {metalness: 0.16, roughness: 0.54});
  const followerMaterial = matte(PALETTE.driven, {metalness: 0.14, roughness: 0.58});
  const darkMaterial = matte(PALETTE.ink, {metalness: 0.24, roughness: 0.45});
  const frameMaterial = matte(PALETTE.frame, {metalness: 0.12, roughness: 0.67});
  const rodMaterial = matte(0x3f8057, {metalness: 0.10, roughness: 0.58});
  const whiteMaterial = matte(PALETTE.white, {roughness: 0.48});

  // Cam C: a disc with the derived groove sunk in its face.
  const samples = 1440;
  const centre = [], inner = [], outer = [];
  let minimumConvexRadius = Infinity;
  for (let i = 0; i < samples; i += 1) {
    const psi = FULL_TURN * i / samples, h = 1e-5;
    const [x, y] = law.centerline(psi);
    const [x1, y1] = law.centerline(psi + h), [x0, y0] = law.centerline(psi - h);
    const tx = (x1 - x0) / (2 * h), ty = (y1 - y0) / (2 * h), tl = Math.hypot(tx, ty);
    // Outward normal of a counterclockwise curve.
    const nx = ty / tl, ny = -tx / tl;
    centre.push([x, y]);
    inner.push([x - nx * (rollerRadius + clearance), y - ny * (rollerRadius + clearance)]);
    outer.push([x + nx * (rollerRadius + clearance), y + ny * (rollerRadius + clearance)]);
    const ax = (x1 - 2 * x + x0) / h ** 2, ay = (y1 - 2 * y + y0) / h ** 2;
    const curvature = (tx * ay - ty * ax) / tl ** 3;
    if (curvature > 0) minimumConvexRadius = Math.min(minimumConvexRadius, 1 / curvature);
  }
  const cam = new THREE.Group();
  cam.userData.role = 'constant-speed-clockwise-disc-cam-with-derived-three-sided-groove';
  const bore = poly(circle([0, 0], 0.323, 96)), disk = poly(circle([0, 0], camRadius, 256));
  const camDisk = new THREE.Mesh(plate(clip.difference(disk, bore), -0.21, 0.03), driverMaterial);
  camDisk.userData.role = 'single-solid-input-cam-disc';
  const innerLand = new THREE.Mesh(plate(clip.difference(poly(inner), bore), 0.03, 0.30), driverMaterial);
  innerLand.userData.role = 'derived-groove-inner-cam-land';
  const outerLand = new THREE.Mesh(plate(clip.difference(disk, poly(outer)), 0.03, 0.30), driverMaterial);
  outerLand.userData.role = 'derived-groove-outer-wall';
  const camShaft = cylinderAlongZ(0.32, 0.84, darkMaterial, 32);
  camShaft.position.z = -0.05;
  camShaft.userData.role = 'fixed-axis-input-camshaft';
  cam.add(camDisk, innerLand, outerLand, camShaft);
  cam.userData = {...cam.userData, disk: camDisk, innerLand, outerLand, shaft: camShaft,
    recess: {floorZ: 0.03, frontZ: 0.30, innerClearance: clearance, outerClearance: clearance}};
  cam.position.set(camX, 0, 0);
  root.add(markShadows(cam));

  const follower = makeFollower({darkMaterial, followerMaterial, rollerRadius, scale, whiteMaterial});
  root.add(follower);

  const outputWheel = makeOutputWheel({crankVector: new THREE.Vector2(crankRadius, 0), darkMaterial,
    drivenMaterial: followerMaterial, radius: camRadius, whiteMaterial});
  outputWheel.position.set(wheelX, 0, 0);
  root.add(outputWheel);

  const connectingRod = makeBoredPlanarLink({length: rodLength, width: .21, eyeRadius: .22, boreRadius: .148, depth: .12}, rodMaterial);
  connectingRod.userData.role = 'single-finite-connecting-rod-from-crosshead-to-output-crank';
  root.add(markShadows(connectingRod));

  const guideStartX = camX + 5.573977 * scale;
  const guideEndX = camX + 12.573977 * scale;
  const guides = [-0.44, 0.44].map((guideY) => {
    const guide = beamBetween(new THREE.Vector3(guideStartX, guideY, 0.43),
      new THREE.Vector3(guideEndX, guideY, 0.43), 0.15, 0.40, frameMaterial);
    guide.userData.role = 'fixed-horizontal-crosshead-guide';
    root.add(guide);
    return guide;
  });
  for (const [parent, z0] of [[cam, -0.47], [outputWheel, -0.18]]) {
    const stubLength = 0.30;
    const journal = cylinderAlongZ(0.16, stubLength, darkMaterial, 32);
    journal.position.z = z0 + 0.02 - stubLength / 2;
    journal.userData.role = 'plain-shaft-stub-behind-disc';
    parent.add(journal);
  }

  const stateAtTime = (time) => {
    const camTurn = sourceCamTurn + FULL_TURN * time / cycleDuration;
    const phi = law.wheelAngle(camTurn);
    const d = law.rollerDistance(phi);
    const h = 1e-6;
    const phiRate = (law.wheelAngle(camTurn + h) - law.wheelAngle(camTurn - h)) / (2 * h) * FULL_TURN / cycleDuration;
    const rollerCenterWorld = new THREE.Vector2(camX + d, 0);
    const followerPivotWorld = new THREE.Vector2(camX + d + pivotOffset, 0);
    const outputCrankPointWorld = new THREE.Vector2(wheelX + crankRadius * Math.cos(phi), crankRadius * Math.sin(phi));
    return {
      camAngle: -camTurn,
      camTurn,
      camAngularSpeed: -FULL_TURN / cycleDuration,
      followerPivotWorld,
      guideError: 0,
      outputAngularSpeed: phiRate,
      outputCrankPointWorld,
      outputRotorAngle: phi,
      rodLengthError: followerPivotWorld.distanceTo(outputCrankPointWorld) - rodLength,
      rollerCenterWorld,
      rollerDistance: d,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    cam.rotation.z = state.camAngle;
    follower.position.set(state.rollerCenterWorld.x, 0, 0);
    outputWheel.rotation.z = state.outputRotorAngle;
    connectingRod.userData.setEndpoints(
      new THREE.Vector3(state.followerPivotWorld.x, state.followerPivotWorld.y, 0.72),
      new THREE.Vector3(state.outputCrankPointWorld.x, state.outputCrankPointWorld.y, 0.72));
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype: movement.archetype,
    fidelity: 'authored',
    blocks: {cam, connectingRod, follower, guides, outputWheel},
    geometry: {camRadius, camX, crankRadius, cycleDuration, mechanismCyclePeriod: cycleDuration, minimumConvexRadius,
      pivotOffset, rodLength, rollerRadius, sourceCamTurn, unevenness, wheelX,
      strokeRange: [law.rollerDistance(Math.PI), law.rollerDistance(0)]},
    law,
    mechanism: 'one-constant-speed-clockwise-disc-cam-whose-derived-three-sided-groove-drives-one-horizontal-roller-crosshead-and-single-finite-rod-to-turn-one-fixed-axis-output-wheel-fully-round-three-times-per-cam-turn-at-varying-speed',
    degreesOfFreedom: {independentPrescribedInputs: 1, storedEnergyStates: 0, inputs: ['constant-speed clockwise cam angle']},
    motion: {cycleDuration, inputDirection: 'clockwise continuously', outputTurnsPerCycle: 3,
      outputCharacter: 'full counterclockwise turns at varying speed, slowest with the crank toward the cam', outputIsContinuousUnidirectionalRotation: true},
    sourceAnimation: {available: true, officialPage: movement.sourceUrl,
      discrepancy: 'The official 2D animation rocks the wheel back and forth; following the user\'s reading of "intermittent circular", the groove is re-derived so the wheel turns fully round.'},
    reconstructionNote: 'Groove derived from the in-line slider-crank so the roller covers exactly the crank stroke; the wheel angle law phi(psi) is prescribed (smooth, monotone, three turns per cam turn). Passing the crank dead centres relies on the groove (it positions the roller both ways) and the wheel\'s momentum is not needed kinematically, but at the dead centres the rod alone cannot choose the direction: the prescribed law does. Pressure angles on the steep flanks reach about 60 degrees; loads and friction are not modelled.',
    stateAtTime,
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-6.08, -2.3, -0.70), new THREE.Vector3(6.05, 2.3, 1.15));
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(0.25, 0.2, 16);
  finishGrooveDrive(root, cycleDuration);
  update(0);
  return {root, update, cameraDirection: root.userData.cameraDirection};
}

export function createAuthoredCamRockingDriveMovement(movement) {
  if (movement.id !== 398) return null;
  return camFullTurnDrive(movement);
}
