import * as THREE from 'three';
import { flangeColumn, glandCylinder, pinWallBracket } from './beyond-crop-hardware.js';
import { makeBoredLinkRod as makeRigidRod } from './bored-link-rod.js';
import { boredJournal, fitPistonGuide } from './piston-guide-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 28,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function beamBetween3D(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    delta.clone().normalize(),
  );
  return beam;
}

function circleCircleIntersections(centerA, radiusA, centerB, radiusB) {
  const centerDelta = centerB.clone().sub(centerA);
  const distance = centerDelta.length();
  if (distance === 0) throw new Error('Coincident linkage-circle centers');
  const along = (
    radiusA ** 2 - radiusB ** 2 + distance ** 2
  ) / (2 * distance);
  const heightSquared = radiusA ** 2 - along ** 2;
  if (heightSquared < -1e-12) throw new Error('Disjoint linkage circles');
  const height = Math.sqrt(Math.max(0, heightSquared));
  const direction = centerDelta.multiplyScalar(1 / distance);
  const foot = centerA.clone().addScaledVector(direction, along);
  const perpendicular = new THREE.Vector2(-direction.y, direction.x);
  return [
    foot.clone().addScaledVector(perpendicular, height),
    foot.clone().addScaledVector(perpendicular, -height),
  ];
}

function nearestPoint(points, reference) {
  return points[0].distanceToSquared(reference)
    <= points[1].distanceToSquared(reference) ? points[0] : points[1];
}

function constrainedPointRates({
  accelerationA,
  accelerationB,
  centerA,
  centerB,
  point,
  velocityA,
  velocityB,
}) {
  const radialA = point.clone().sub(centerA);
  const radialB = point.clone().sub(centerB);
  const determinant = cross2(radialA, radialB);
  if (Math.abs(determinant) < 1e-12) {
    throw new Error('Singular two-circle linkage state');
  }
  const velocityRhsA = radialA.dot(velocityA);
  const velocityRhsB = radialB.dot(velocityB);
  const velocity = new THREE.Vector2(
    (velocityRhsA * radialB.y - radialA.y * velocityRhsB)
      / determinant,
    (radialA.x * velocityRhsB - velocityRhsA * radialB.x)
      / determinant,
  );
  const relativeVelocityA = velocity.clone().sub(velocityA);
  const relativeVelocityB = velocity.clone().sub(velocityB);
  const accelerationRhsA = radialA.dot(accelerationA)
    - relativeVelocityA.lengthSq();
  const accelerationRhsB = radialB.dot(accelerationB)
    - relativeVelocityB.lengthSq();
  const acceleration = new THREE.Vector2(
    (accelerationRhsA * radialB.y - radialA.y * accelerationRhsB)
      / determinant,
    (radialA.x * accelerationRhsB
      - accelerationRhsA * radialB.x) / determinant,
  );
  return { acceleration, determinant, velocity };
}

function rigidLinkRates(vector, velocity, acceleration) {
  const lengthSquared = vector.lengthSq();
  const crossVelocity = cross2(vector, velocity);
  return {
    angle: Math.atan2(vector.y, vector.x),
    angularAcceleration: (
      cross2(vector, acceleration) * lengthSquared
        - 2 * vector.dot(velocity) * crossVelocity
    ) / lengthSquared ** 2,
    angularVelocity: crossVelocity / lengthSquared,
  };
}


function midpointVibratingRodParallelMotion(movement) {
  const root = new THREE.Group();

  // The upper end B of the short vibrating rod B-D is pinned to the rocking
  // beam. Its lower end D is fixed ten units from radius pivot F, and the
  // piston point C is the exact midpoint of B-D. The official animation
  // already closes both circles, so this model retains its rounded constants
  // and branch verbatim; C's small lateral error is the real historical
  // approximate-straight-line behavior, not an animation artifact.
  const sourceScale = 0.285;
  const sourceBeamPivotO = new THREE.Vector2(0, 0);
  const sourceBeamPinRadius = 10;
  const sourceBeamUpperDirection = new THREE.Vector2(9.396926, 3.420201);
  const sourceBeamLowerDirection = new THREE.Vector2(9.396926, -3.420201);
  const sourceBeamHalfSwing = Math.atan2(
    sourceBeamUpperDirection.y,
    sourceBeamUpperDirection.x,
  );
  const sourceVibratingRodLength = 5.582196;
  const sourceVibratingRodMidpointDistance = 2.791098;
  const sourceRadiusPivotF = new THREE.Vector2(-19.0375, -5.498592);
  const sourceRadiusReferencePoint = new THREE.Vector2(-9.0375, -5.498592);
  const sourceRadiusRodLength = sourceRadiusPivotF
    .distanceTo(sourceRadiusReferencePoint);
  const sourceNominalPistonLineX = -9.51875;
  const sourceCanvasPistonRodLength = 20;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const beamPivotO = sourceBeamPivotO.clone().multiplyScalar(sourceScale);
  const beamPinRadius = sourceBeamPinRadius * sourceScale;
  const vibratingRodLength = sourceVibratingRodLength * sourceScale;
  const vibratingRodMidpointDistance =
    sourceVibratingRodMidpointDistance * sourceScale;
  const radiusPivotF = sourceRadiusPivotF.clone().multiplyScalar(sourceScale);
  const radiusReferencePoint = sourceRadiusReferencePoint.clone()
    .multiplyScalar(sourceScale);
  const radiusRodLength = sourceRadiusRodLength * sourceScale;
  const nominalPistonLineX = sourceNominalPistonLineX * sourceScale;
  const zero = new THREE.Vector2();

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const unwrappedInputAngle = inputTravel;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const beamAngle = -sourceBeamHalfSwing * sine;
    const beamAngularVelocity = -sourceBeamHalfSwing * cosine
      * resolvedInputAngularSpeed;
    const beamAngularAcceleration = sourceBeamHalfSwing * (
      sine * resolvedInputAngularSpeed ** 2
        - cosine * inputAngularAcceleration
    );
    const beamSine = Math.sin(beamAngle);
    const beamCosine = Math.cos(beamAngle);
    const pointB = new THREE.Vector2(
      -beamPinRadius * beamCosine,
      -beamPinRadius * beamSine,
    );
    const pointBVelocity = new THREE.Vector2(
      -pointB.y * beamAngularVelocity,
      pointB.x * beamAngularVelocity,
    );
    const pointBAcceleration = new THREE.Vector2(
      -pointB.x * beamAngularVelocity ** 2
        - pointB.y * beamAngularAcceleration,
      -pointB.y * beamAngularVelocity ** 2
        + pointB.x * beamAngularAcceleration,
    );

    const pointD = nearestPoint(
      circleCircleIntersections(
        pointB,
        vibratingRodLength,
        radiusPivotF,
        radiusRodLength,
      ),
      radiusReferencePoint,
    );
    const pointDRates = constrainedPointRates({
      accelerationA: pointBAcceleration,
      accelerationB: zero,
      centerA: pointB,
      centerB: radiusPivotF,
      point: pointD,
      velocityA: pointBVelocity,
      velocityB: zero,
    });
    const pointC = pointB.clone().add(pointD).multiplyScalar(0.5);
    const pointCVelocity = pointBVelocity.clone()
      .add(pointDRates.velocity).multiplyScalar(0.5);
    const pointCAcceleration = pointBAcceleration.clone()
      .add(pointDRates.acceleration).multiplyScalar(0.5);
    const vibratingVector = pointD.clone().sub(pointB);
    const vibratingVelocity = pointDRates.velocity.clone()
      .sub(pointBVelocity);
    const vibratingAcceleration = pointDRates.acceleration.clone()
      .sub(pointBAcceleration);
    const radiusVector = pointD.clone().sub(radiusPivotF);

    return {
      beam: {
        angle: beamAngle,
        angularAcceleration: beamAngularAcceleration,
        angularVelocity: beamAngularVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      pistonLateralDeviation: pointC.x - nominalPistonLineX,
      pointB,
      pointBAcceleration,
      pointBVelocity,
      pointC,
      pointCAcceleration,
      pointCVelocity,
      pointD,
      pointDAcceleration: pointDRates.acceleration,
      pointDVelocity: pointDRates.velocity,
      radiusRod: rigidLinkRates(
        radiusVector,
        pointDRates.velocity,
        pointDRates.acceleration,
      ),
      unwrappedInputAngle,
      vibratingRod: rigidLinkRates(
        vibratingVector,
        vibratingVelocity,
        vibratingAcceleration,
      ),
    };
  };

  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    beamLevelDescending: 0,
    upperPistonReversal: cyclePeriod / 4,
    beamLevelAscending: cyclePeriod / 2,
    lowerPistonReversal: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  let maximumLateralDeviation = 0;
  let minimumPistonX = Infinity;
  let maximumPistonX = -Infinity;
  let minimumPistonY = Infinity;
  let maximumPistonY = -Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(cyclePeriod * sample / 16384);
    maximumLateralDeviation = Math.max(
      maximumLateralDeviation,
      Math.abs(state.pistonLateralDeviation),
    );
    minimumPistonX = Math.min(minimumPistonX, state.pointC.x);
    maximumPistonX = Math.max(maximumPistonX, state.pointC.x);
    minimumPistonY = Math.min(minimumPistonY, state.pointC.y);
    maximumPistonY = Math.max(maximumPistonY, state.pointC.y);
  }

  const geometry = {
    beamHalfSwing: sourceBeamHalfSwing,
    beamPinRadius,
    beamPivotO,
    cyclePeriod,
    inputAngularSpeed,
    maximumLateralDeviation,
    maximumPistonX,
    maximumPistonY,
    minimumPistonX,
    minimumPistonY,
    nominalPistonLineX,
    outputStroke: maximumPistonY - minimumPistonY,
    radiusPivotF,
    radiusReferencePoint,
    radiusRodLength,
    sourceScale,
    vibratingRodLength,
    vibratingRodMidpointDistance,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    roughness: 0.73,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const beamMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const vibratingMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const radiusMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const outputMaterial = matte(0xd78332, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  // Brown's plate shows only the beam boss and shaft end at O and a bare
  // pin at F; the engine bed, standards and piston guides are not drawn.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-beam-shaft-O-and-radius-pin-F';
  const beamShaftRadius = 0.62 * sourceScale;
  const beamBoreRadius = beamShaftRadius + 0.02;
  const beamShaft = cylinderAlongZ(beamShaftRadius, 0.62, darkMaterial, 40);
  beamShaft.position.set(0, 0, 0.04);
  beamShaft.userData.fixed = true;
  beamShaft.userData.role = 'fixed-shaft-through-beam-fulcrum-O';
  const radiusShaft = cylinderAlongZ(0.23 * sourceScale, 0.34,
    darkMaterial, 32);
  radiusShaft.position.set(radiusPivotF.x, radiusPivotF.y, 0.70);
  radiusShaft.userData.fixed = true;
  radiusShaft.userData.role = 'fixed-pin-at-radius-pivot-F';
  fixedFrame.add(beamShaft, radiusShaft);
  // Neither fixed pin floats: each runs back to a small flange on the engine
  // framing behind the mechanism, hidden behind its boss in the plate view.
  fixedFrame.add(
    pinWallBracket({ x: 0, y: 0, pinRadius: beamShaftRadius, zPin: 0.04 - 0.31, zWall: -0.55, beyondPlateCrop: true,
      flange: 0.5, role: 'fixed-wall-bracket-of-beam-shaft-O' }),
    pinWallBracket({ x: radiusPivotF.x, y: radiusPivotF.y, pinRadius: 0.23 * sourceScale, zPin: 0.53, zWall: -0.55, beyondPlateCrop: true,
      flange: 0.16, role: 'fixed-wall-bracket-of-radius-pin-F' }),
    // F's small flange is carried at the head of a plain column standing on
    // the engine-house floor (level with the cylinder's foot).
    flangeColumn({ x: radiusPivotF.x, yTop: radiusPivotF.y + 0.08, yFloor: -7.9, zWall: -0.55, width: 0.24,
      beyondPlateCrop: true, role: 'fixed-floor-column-carrying-radius-pin-F-flange' }),
  );
  root.add(fixedFrame);

  const beam = new THREE.Group();
  beam.userData.axis = Z_AXIS.clone();
  beam.userData.role = 'twenty-unit-rocking-beam-with-left-pin-B';
  const beamShape = new THREE.Shape();
  beamShape.moveTo(-10.04 * sourceScale, -0.50 * sourceScale);
  beamShape.lineTo(-0.10 * sourceScale, -1.10 * sourceScale);
  beamShape.lineTo(10.04 * sourceScale, -0.50 * sourceScale);
  beamShape.lineTo(10.04 * sourceScale, 0.50 * sourceScale);
  beamShape.lineTo(0.10 * sourceScale, 1.10 * sourceScale);
  beamShape.lineTo(-10.04 * sourceScale, 0.50 * sourceScale);
  beamShape.closePath();
  const beamFulcrumHole = new THREE.Path();
  beamFulcrumHole.absarc(0, 0, beamBoreRadius, 0, FULL_TURN, true);
  beamShape.holes.push(beamFulcrumHole);
  const beamBody = new THREE.Mesh(
    centeredExtrusion(beamShape, 0.28, 0.009),
    beamMaterial,
  );
  beamBody.position.z = 0.04;
  beamBody.userData.role = 'source-tapered-rocking-beam-body';
  const beamPivotBoss = boredJournal(1.35 * sourceScale, beamBoreRadius,
    0.38, beamMaterial);
  beamPivotBoss.position.z = 0.04;
  beamPivotBoss.userData.role = 'large-moving-beam-boss-O';
  const pointBBoss = cylinderAlongZ(0.50 * sourceScale, 0.36,
    beamMaterial, 38);
  pointBBoss.position.set(-beamPinRadius, 0, 0.04);
  pointBBoss.userData.role = 'beam-left-end-pin-boss-B';
  const farEndBoss = cylinderAlongZ(0.50 * sourceScale, 0.34,
    beamMaterial, 38);
  farEndBoss.position.set(beamPinRadius, 0, 0.04);
  farEndBoss.userData.role = 'opposite-beam-end-boss-beyond-source-view';
  const pointBAnchor = new THREE.Object3D();
  pointBAnchor.position.set(-beamPinRadius, 0, 0.04);
  pointBAnchor.userData.role = 'analytic-beam-pin-B';
  const beamPivotAnchor = new THREE.Object3D();
  beamPivotAnchor.position.z = 0.04;
  beamPivotAnchor.userData.role = 'analytic-fixed-beam-pivot-O';
  beam.add(
    beamBody,
    beamPivotBoss,
    pointBBoss,
    farEndBoss,
    pointBAnchor,
    beamPivotAnchor,
  );
  root.add(beam);

  const vibratingParts = makeRigidRod({
    bodyMaterial: vibratingMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: vibratingRodLength,
    planeZ: 0.39,
    role: 'short-five-point-five-eight-two-one-nine-six-unit-vibrating-rod-B-D',
    width: 0.38 * sourceScale,
  });
  vibratingParts.rod.userData.addPinEye(vibratingRodMidpointDistance, 0.22 * sourceScale + 0.006);
  const pointCAnchor = new THREE.Object3D();
  pointCAnchor.position.set(vibratingRodMidpointDistance, 0, 0.39);
  pointCAnchor.userData.role = 'analytic-vibrating-rod-midpoint-C';
  vibratingParts.rod.add(pointCAnchor);
  root.add(vibratingParts.rod);

  const radiusParts = makeRigidRod({
    bodyMaterial: radiusMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: radiusRodLength,
    planeZ: 0.70,
    role: 'ten-unit-fixed-radius-rod-F-D',
    width: 0.34 * sourceScale,
  });
  root.add(radiusParts.rod);

  // The piston rod runs in front of the radius-rod plane so that it passes
  // clear of the pin at D, which it overlaps in elevation near mid-stroke.
  const output = new THREE.Group();
  output.userData.rotationDegreesOfFreedom = 0;
  output.userData.role = 'piston-rod-attached-to-vibrating-rod-midpoint-C';
  const outputPlaneZ = 0.90;
  const crossheadBoss = cylinderAlongZ(0.36 * sourceScale, 0.16,
    outputMaterial, 34);
  crossheadBoss.position.z = outputPlaneZ;
  crossheadBoss.userData.role = 'piston-crosshead-boss-at-C';
    // Brown breaks the rod off below C; it is whole, running down through the
  // gland of its cylinder below the plate's view over the whole stroke.
  const cylinderTopY337 = -5.3;
  const visiblePistonRodLength = 10 * sourceScale;
  const wholePistonRodLength = 0.18 - cylinderTopY337 + 0.3;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.30 * sourceScale, visiblePistonRodLength, 0.12),
    outputMaterial,
  );
  pistonRod.position.set(0, -visiblePistonRodLength / 2, outputPlaneZ);
  pistonRod.userData.role = 'vertical-piston-rod-continuing-below-C';
  const pistonRodBeyondCrop = new THREE.Mesh(
    new THREE.BoxGeometry(0.30 * sourceScale, wholePistonRodLength - visiblePistonRodLength, 0.12),
    outputMaterial,
  );
  pistonRodBeyondCrop.position.set(0, -(visiblePistonRodLength + wholePistonRodLength) / 2, outputPlaneZ);
  pistonRodBeyondCrop.userData.role = 'piston-rod-running-on-into-its-cylinder';
  pistonRodBeyondCrop.userData.beyondPlateCrop = true;
  root.add(glandCylinder({ x: -2.713, topY: cylinderTopY337, z: outputPlaneZ, length: 2.6,
    glandRadius: 0.1, boreRadius: 0.3, outerRadius: 0.42, role: 'piston-cylinder-below-plate-crop' }));
  const outputAnchor = new THREE.Object3D();
  outputAnchor.position.z = outputPlaneZ;
  outputAnchor.userData.role = 'analytic-piston-point-C';
  output.add(
    crossheadBoss,
    pistonRod,
    pistonRodBeyondCrop,
    outputAnchor,
  );
  root.add(output);

  // Each working pin is rigid with one member and turns in true bores of the
  // others: B in the beam, C in the crosshead and D in the radius rod.
  const jointPins = {
    B: cylinderAlongZ(0.22 * sourceScale, 0.55, whiteMaterial, 30),
    C: cylinderAlongZ(0.20 * sourceScale, 0.70, whiteMaterial, 30),
    D: cylinderAlongZ(0.22 * sourceScale, 0.52, whiteMaterial, 30),
  };
  jointPins.B.position.set(-beamPinRadius, 0, 0.26);
  beam.add(jointPins.B);
  jointPins.C.position.set(0, 0, 0.63);
  output.add(jointPins.C);
  jointPins.D.position.set(radiusRodLength, 0, 0.545);
  radiusParts.rod.add(jointPins.D);
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
  });

  const contacts = {
    beamAtB: {
      members: [beam, vibratingParts.rod],
      point: new THREE.Vector3(),
      type: 'beam-to-vibrating-rod-pin-B',
    },
    beamPivotO: {
      fixedMember: fixedFrame,
      movingMember: beam,
      point: new THREE.Vector3(0, 0, 0.04),
      type: 'fixed-revolute-pair-O',
    },
    pistonAtC: {
      members: [vibratingParts.rod, output],
      point: new THREE.Vector3(),
      type: 'midpoint-piston-pin-C',
    },
    radiusAtD: {
      members: [vibratingParts.rod, radiusParts.rod],
      point: new THREE.Vector3(),
      type: 'vibrating-rod-to-radius-rod-pin-D',
    },
    radiusPivotF: {
      fixedMember: fixedFrame,
      movingMember: radiusParts.rod,
      point: new THREE.Vector3(radiusPivotF.x, radiusPivotF.y, 0.70),
      type: 'fixed-revolute-pair-F',
    },
  };

  const setRodPose = (rod, start, rates) => {
    rod.position.set(start.x, start.y, 0);
    rod.rotation.z = rates.angle;
    rod.userData.angularSpeed = rates.angularVelocity;
    rod.userData.angularAcceleration = rates.angularAcceleration;
  };
  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beam.angle;
    beam.userData.angularSpeed = state.beam.angularVelocity;
    beam.userData.angularAcceleration = state.beam.angularAcceleration;
    setRodPose(vibratingParts.rod, state.pointB, state.vibratingRod);
    setRodPose(radiusParts.rod, radiusPivotF, state.radiusRod);
    output.position.set(state.pointC.x, state.pointC.y, 0);
    output.userData.velocity = new THREE.Vector3(
      state.pointCVelocity.x,
      state.pointCVelocity.y,
      0,
    );
    output.userData.acceleration = new THREE.Vector3(
      state.pointCAcceleration.x,
      state.pointCAcceleration.y,
      0,
    );
    contacts.beamAtB.point.set(state.pointB.x, state.pointB.y, 0.30);
    contacts.pistonAtC.point.set(state.pointC.x, state.pointC.y, 0.63);
    contacts.radiusAtD.point.set(state.pointD.x, state.pointD.y, 0.55);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-20.683712, -15.631788);
  const officialViewWidth = 24;
  const officialViewHeight = 24;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  root.userData.archetype =
    'beam-midpoint-vibrating-rod-and-fixed-radius-parallel-motion';
  root.userData.blocks = {
    beam,
    beamBody,
    beamPivotAnchor,
    beamPivotBoss,
    beamShaft,
    fixedFrame,
    jointPins,
    output,
    outputAnchor,
    pistonRod,
    pointBAnchor,
    pointCAnchor,
    radiusShaft,
    radiusRod: radiusParts.rod,
    radiusRodEndAnchor: radiusParts.endAnchor,
    radiusRodStartAnchor: radiusParts.startAnchor,
    vibratingRod: vibratingParts.rod,
    vibratingRodEndAnchor: vibratingParts.endAnchor,
    vibratingRodMidpointAnchor: pointCAnchor,
    vibratingRodStartAnchor: vibratingParts.startAnchor,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one prescribed smooth twenty-degree rocking-beam cycle',
    mechanism: 1,
    output:
      'piston point C is the midpoint of the short vibrating rod and follows its near-vertical coupler curve',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -4.58;
  root.userData.mechanism =
    'closed-rigid-beam-O-B-short-vibrating-rod-B-C-D-fixed-radius-rod-F-D-with-piston-at-midpoint-C';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_pos_interp',
      'add_c_rod_r',
      'add_rot_to',
      'add_tx',
    ],
    officialGeometry: {
      beamLowerDirection: sourceBeamLowerDirection,
      beamPinRadius: sourceBeamPinRadius,
      beamPivotO: sourceBeamPivotO,
      beamUpperDirection: sourceBeamUpperDirection,
      canvasPistonRodLength: sourceCanvasPistonRodLength,
      nominalPistonLineX: sourceNominalPistonLineX,
      radiusPivotF: sourceRadiusPivotF,
      radiusReferencePoint: sourceRadiusReferencePoint,
      radiusRodLength: sourceRadiusRodLength,
      vibratingRodLength: sourceVibratingRodLength,
      vibratingRodMidpointDistance: sourceVibratingRodMidpointDistance,
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'none in kinematics: this model retains the official rounded beam directions, B-D and F-D lengths, circle branch, midpoint construction, and sinusoidal interpolation exactly',
    referenceScope:
      'official beam directions and pin B, fixed pivot F, short vibrating rod B-D with midpoint C, radius rod F-D, branch reference point, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate337: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'beam pin B drives the upper end of short vibrating rod B-D; fixed radius F-D controls its lower end and the piston joins its exact midpoint C',
      measurementUncertaintyPixels: 4,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactRigidConstraints:
      '|O-B|=10, |B-D|=5.582196, |F-D|=10, and C=(B+D)/2 in source units',
    input:
      'the beam rocks smoothly between the official rounded plus and minus twenty-degree direction rays',
    output:
      'the piston rod is pinned to exact midpoint C of the short vibrating rod B-D',
    straightness:
      'the midpoint construction gives C a near-vertical 6.839-unit stroke with a measured 0.014272-unit maximum lateral deviation',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  // Brown's view stops just beyond fulcrum O and below pin D; the far half of
  // the beam and the rest of the piston rod continue out of frame as drawn.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(radiusPivotF.x - 0.30, -3.15, -0.25),
    new THREE.Vector3(0.55, 0.55, 1.00),
  );
  root.userData.cameraDistanceScale = 0.98;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
    root,
    update,
  };
}

function upperRadiusVibratingRodParallelMotion(movement) {
  const root = new THREE.Group();

  // This is the inverted companion to 337. Beam pin R carries the center of
  // the four-unit vibrating rod L-R-U, the upper endpoint U is constrained by
  // radius bar F-U above the beam, and the lower endpoint L carries the
  // piston. The canvas uses the distance to its rounded branch-reference
  // point (4.254550197...) to solve U but draws a 4.25455-unit bar. We close
  // the stated bar length exactly and retain that 1.97e-7-unit discrepancy as
  // source metadata.
  const sourceScale = 0.48;
  const sourceBeamPivotO = new THREE.Vector2(0, 0);
  const sourceHiddenCrankCenter = new THREE.Vector2(-8, -10);
  const sourceHiddenCrankRadius = 2;
  const sourceHiddenDriveRodLength = 10;
  const sourceBeamHalfRadius = 8;
  const sourceVibratingRodHalfLength = 2;
  const sourceVibratingRodLength = 4;
  const sourceRadiusPivotF = new THREE.Vector2(3.74545, 2);
  const sourceRadiusReferencePoint = new THREE.Vector2(7.935364, 2.738795);
  const sourceCanvasRadiusConstraintLength = sourceRadiusPivotF
    .distanceTo(sourceRadiusReferencePoint);
  const sourceRadiusBarLength = 4.25455;
  const sourceVerticalStrokeLineX = 8;
  const sourceInputPhaseOffset = FULL_TURN * 0.125;
  const sourceCanvasPistonRodLength = 16;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const beamPivotO = sourceBeamPivotO.clone().multiplyScalar(sourceScale);
  const hiddenCrankCenter = sourceHiddenCrankCenter.clone()
    .multiplyScalar(sourceScale);
  const hiddenCrankRadius = sourceHiddenCrankRadius * sourceScale;
  const hiddenDriveRodLength = sourceHiddenDriveRodLength * sourceScale;
  const beamHalfRadius = sourceBeamHalfRadius * sourceScale;
  const vibratingRodHalfLength = sourceVibratingRodHalfLength * sourceScale;
  const vibratingRodLength = sourceVibratingRodLength * sourceScale;
  const radiusPivotF = sourceRadiusPivotF.clone().multiplyScalar(sourceScale);
  const radiusReferencePoint = sourceRadiusReferencePoint.clone()
    .multiplyScalar(sourceScale);
  const canvasRadiusConstraintLength = sourceCanvasRadiusConstraintLength
    * sourceScale;
  const radiusBarLength = sourceRadiusBarLength * sourceScale;
  const verticalStrokeLineX = sourceVerticalStrokeLineX * sourceScale;
  const zero = new THREE.Vector2();

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const unwrappedInputAngle = inputTravel;
    const inputAngle = positiveModulo(
      sourceInputPhaseOffset + unwrappedInputAngle,
      FULL_TURN,
    );
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const inputCrankPin = hiddenCrankCenter.clone().add(
      new THREE.Vector2(cosine, sine).multiplyScalar(hiddenCrankRadius),
    );
    const inputCrankPinVelocity = new THREE.Vector2(
      -hiddenCrankRadius * sine * resolvedInputAngularSpeed,
      hiddenCrankRadius * cosine * resolvedInputAngularSpeed,
    );
    const inputCrankPinAcceleration = new THREE.Vector2(
      -hiddenCrankRadius * (
        cosine * resolvedInputAngularSpeed ** 2
          + sine * inputAngularAcceleration
      ),
      hiddenCrankRadius * (
        -sine * resolvedInputAngularSpeed ** 2
          + cosine * inputAngularAcceleration
      ),
    );

    const beamNegativePoint = nearestPoint(
      circleCircleIntersections(
        beamPivotO,
        beamHalfRadius,
        inputCrankPin,
        hiddenDriveRodLength,
      ),
      new THREE.Vector2(-beamHalfRadius, 0),
    );
    const beamNegativeRates = constrainedPointRates({
      accelerationA: zero,
      accelerationB: inputCrankPinAcceleration,
      centerA: beamPivotO,
      centerB: inputCrankPin,
      point: beamNegativePoint,
      velocityA: zero,
      velocityB: inputCrankPinVelocity,
    });
    const beamPointR = beamNegativePoint.clone().multiplyScalar(-1);
    const beamPointRVelocity = beamNegativeRates.velocity.clone()
      .multiplyScalar(-1);
    const beamPointRAcceleration = beamNegativeRates.acceleration.clone()
      .multiplyScalar(-1);

    const officialPointU = nearestPoint(
      circleCircleIntersections(
        beamPointR,
        vibratingRodHalfLength,
        radiusPivotF,
        canvasRadiusConstraintLength,
      ),
      radiusReferencePoint,
    );
    const officialPointL = beamPointR.clone().multiplyScalar(2)
      .sub(officialPointU);
    const pointU = nearestPoint(
      circleCircleIntersections(
        beamPointR,
        vibratingRodHalfLength,
        radiusPivotF,
        radiusBarLength,
      ),
      officialPointU,
    );
    const pointURates = constrainedPointRates({
      accelerationA: beamPointRAcceleration,
      accelerationB: zero,
      centerA: beamPointR,
      centerB: radiusPivotF,
      point: pointU,
      velocityA: beamPointRVelocity,
      velocityB: zero,
    });
    const pointL = beamPointR.clone().multiplyScalar(2).sub(pointU);
    const pointLVelocity = beamPointRVelocity.clone().multiplyScalar(2)
      .sub(pointURates.velocity);
    const pointLAcceleration = beamPointRAcceleration.clone()
      .multiplyScalar(2).sub(pointURates.acceleration);
    const vibratingVector = pointU.clone().sub(pointL);
    const vibratingVelocity = pointURates.velocity.clone()
      .sub(pointLVelocity);
    const vibratingAcceleration = pointURates.acceleration.clone()
      .sub(pointLAcceleration);
    const radiusVector = pointU.clone().sub(radiusPivotF);
    const driveRodVector = beamNegativePoint.clone().sub(inputCrankPin);
    const driveRodVelocity = beamNegativeRates.velocity.clone()
      .sub(inputCrankPinVelocity);
    const driveRodAcceleration = beamNegativeRates.acceleration.clone()
      .sub(inputCrankPinAcceleration);

    return {
      beam: rigidLinkRates(
        beamPointR,
        beamPointRVelocity,
        beamPointRAcceleration,
      ),
      beamNegativeAcceleration: beamNegativeRates.acceleration,
      beamNegativePoint,
      beamNegativeVelocity: beamNegativeRates.velocity,
      beamPointR,
      beamPointRAcceleration,
      beamPointRVelocity,
      driveRod: rigidLinkRates(
        driveRodVector,
        driveRodVelocity,
        driveRodAcceleration,
      ),
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      inputCrankPin,
      inputCrankPinAcceleration,
      inputCrankPinVelocity,
      officialCanvasApproximation: {
        pointL: officialPointL,
        pointU: officialPointU,
        radiusBarResidual:
          officialPointU.distanceTo(radiusPivotF) - radiusBarLength,
      },
      pistonDifferenceFromCanvas: pointL.distanceTo(officialPointL),
      pistonLateralDeviation: pointL.x - verticalStrokeLineX,
      pointL,
      pointLAcceleration,
      pointLVelocity,
      pointU,
      pointUAcceleration: pointURates.acceleration,
      pointUVelocity: pointURates.velocity,
      radiusBar: rigidLinkRates(
        radiusVector,
        pointURates.velocity,
        pointURates.acceleration,
      ),
      unwrappedInputAngle,
      vibratingRod: rigidLinkRates(
        vibratingVector,
        vibratingVelocity,
        vibratingAcceleration,
      ),
    };
  };

  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    sourceStart: 0,
    sourceQuarter: cyclePeriod / 4,
    sourceHalf: cyclePeriod / 2,
    sourceThreeQuarter: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  let maximumLateralDeviation = 0;
  let maximumPistonDifferenceFromCanvas = 0;
  let minimumBeamAngle = Infinity;
  let maximumBeamAngle = -Infinity;
  let minimumPistonX = Infinity;
  let maximumPistonX = -Infinity;
  let minimumPistonY = Infinity;
  let maximumPistonY = -Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(cyclePeriod * sample / 16384);
    maximumLateralDeviation = Math.max(
      maximumLateralDeviation,
      Math.abs(state.pistonLateralDeviation),
    );
    maximumPistonDifferenceFromCanvas = Math.max(
      maximumPistonDifferenceFromCanvas,
      state.pistonDifferenceFromCanvas,
    );
    minimumBeamAngle = Math.min(minimumBeamAngle, state.beam.angle);
    maximumBeamAngle = Math.max(maximumBeamAngle, state.beam.angle);
    minimumPistonX = Math.min(minimumPistonX, state.pointL.x);
    maximumPistonX = Math.max(maximumPistonX, state.pointL.x);
    minimumPistonY = Math.min(minimumPistonY, state.pointL.y);
    maximumPistonY = Math.max(maximumPistonY, state.pointL.y);
  }

  const geometry = {
    beamHalfRadius,
    beamPivotO,
    canvasRadiusConstraintLength,
    cyclePeriod,
    hiddenCrankCenter,
    hiddenCrankRadius,
    hiddenDriveRodLength,
    inputAngularSpeed,
    maximumBeamAngle,
    maximumLateralDeviation,
    maximumPistonDifferenceFromCanvas,
    maximumPistonX,
    maximumPistonY,
    minimumBeamAngle,
    minimumPistonX,
    minimumPistonY,
    outputStroke: maximumPistonY - minimumPistonY,
    radiusBarLength,
    radiusPivotF,
    radiusReferencePoint,
    sourceInputPhaseOffset,
    sourceScale,
    verticalStrokeLineX,
    vibratingRodHalfLength,
    vibratingRodLength,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    roughness: 0.73,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const beamMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const vibratingMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const radiusMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const outputMaterial = matte(0xd78332, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  // As in 337, Brown draws only the beam boss and shaft at O and a bare pin
  // at F; no bed, standards or piston guides appear on the plate.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-beam-shaft-O-and-upper-radius-pin-F';
  const beamShaftRadius = 0.36 * sourceScale;
  const beamBoreRadius = beamShaftRadius + 0.02;
  const beamShaft = cylinderAlongZ(beamShaftRadius, 0.62, darkMaterial, 36);
  beamShaft.position.set(0, 0, 0.04);
  beamShaft.userData.fixed = true;
  beamShaft.userData.role = 'fixed-shaft-through-beam-pivot-O';
  const radiusShaft = cylinderAlongZ(0.20 * sourceScale, 0.34,
    darkMaterial, 32);
  radiusShaft.position.set(radiusPivotF.x, radiusPivotF.y, 0.70);
  radiusShaft.userData.fixed = true;
  radiusShaft.userData.role = 'fixed-pin-at-upper-radius-pivot-F';
  fixedFrame.add(beamShaft, radiusShaft);
  // Neither fixed pin floats: each runs back to a small flange on the engine
  // framing behind the mechanism, hidden behind its boss in the plate view.
  fixedFrame.add(
    pinWallBracket({ x: 0, y: 0, pinRadius: beamShaftRadius, zPin: 0.04 - 0.31, zWall: -0.55, beyondPlateCrop: true,
      flange: 0.4, role: 'fixed-wall-bracket-of-beam-shaft-O' }),
    pinWallBracket({ x: radiusPivotF.x, y: radiusPivotF.y, pinRadius: 0.20 * sourceScale, zPin: 0.53, zWall: -0.55, beyondPlateCrop: true,
      flange: 0.16, role: 'fixed-wall-bracket-of-radius-pin-F' }),
    // F's small flange is carried at the head of a plain column standing on
    // the engine-house floor (level with the cylinder's foot).
    flangeColumn({ x: radiusPivotF.x, yTop: radiusPivotF.y + 0.08, yFloor: -6.85, zWall: -0.55, width: 0.24,
      beyondPlateCrop: true, role: 'fixed-floor-column-carrying-radius-pin-F-flange' }),
  );
  root.add(fixedFrame);

  const beam = new THREE.Group();
  beam.userData.axis = Z_AXIS.clone();
  beam.userData.role = 'sixteen-unit-rocking-beam-with-right-pin-R';
  const beamShape = new THREE.Shape();
  beamShape.moveTo(-8.02 * sourceScale, -0.31 * sourceScale);
  beamShape.lineTo(-0.04 * sourceScale, -0.66 * sourceScale);
  beamShape.lineTo(8.02 * sourceScale, -0.31 * sourceScale);
  beamShape.lineTo(8.02 * sourceScale, 0.31 * sourceScale);
  beamShape.lineTo(0.04 * sourceScale, 0.66 * sourceScale);
  beamShape.lineTo(-8.02 * sourceScale, 0.31 * sourceScale);
  beamShape.closePath();
  const beamFulcrumHole = new THREE.Path();
  beamFulcrumHole.absarc(0, 0, beamBoreRadius, 0, FULL_TURN, true);
  beamShape.holes.push(beamFulcrumHole);
  const beamBody = new THREE.Mesh(
    centeredExtrusion(beamShape, 0.28, 0.009),
    beamMaterial,
  );
  beamBody.position.z = 0.04;
  beamBody.userData.role = 'source-tapered-blue-rocking-beam';
  const beamPivotBoss = boredJournal(0.75 * sourceScale, beamBoreRadius,
    0.38, beamMaterial);
  beamPivotBoss.position.z = 0.04;
  beamPivotBoss.userData.role = 'moving-beam-fulcrum-boss-O';
  const pointRBoss = cylinderAlongZ(0.3125 * sourceScale, 0.36,
    beamMaterial, 36);
  pointRBoss.position.set(beamHalfRadius, 0, 0.04);
  pointRBoss.userData.role = 'beam-right-pin-boss-R';
  const beamNegativeAnchor = new THREE.Object3D();
  beamNegativeAnchor.position.set(-beamHalfRadius, 0, 0.04);
  beamNegativeAnchor.userData.role = 'analytic-hidden-beam-driver-point';
  const beamPointRAnchor = new THREE.Object3D();
  beamPointRAnchor.position.set(beamHalfRadius, 0, 0.04);
  beamPointRAnchor.userData.role = 'analytic-beam-center-pin-R';
  const beamPivotAnchor = new THREE.Object3D();
  beamPivotAnchor.position.z = 0.04;
  beamPivotAnchor.userData.role = 'analytic-fixed-beam-pivot-O';
  beam.add(
    beamBody,
    beamPivotBoss,
    pointRBoss,
    beamNegativeAnchor,
    beamPointRAnchor,
    beamPivotAnchor,
  );
  root.add(beam);

  const vibratingParts = makeRigidRod({
    bodyMaterial: vibratingMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: vibratingRodLength,
    planeZ: 0.39,
    role: 'four-unit-vibrating-rod-L-R-U-centered-on-beam',
    width: 0.34 * sourceScale,
  });
  vibratingParts.rod.userData.addPinEye(vibratingRodHalfLength, 0.22 * sourceScale + 0.006);
  const vibratingMidpointAnchor = new THREE.Object3D();
  vibratingMidpointAnchor.position.set(vibratingRodHalfLength, 0, 0.39);
  vibratingMidpointAnchor.userData.role = 'analytic-vibrating-rod-center-R';
  vibratingParts.rod.add(vibratingMidpointAnchor);
  root.add(vibratingParts.rod);

  const radiusParts = makeRigidRod({
    bodyMaterial: radiusMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: radiusBarLength,
    planeZ: 0.70,
    role: 'four-point-two-five-four-five-five-unit-upper-radius-bar-F-U',
    width: 0.34 * sourceScale,
  });
  root.add(radiusParts.rod);

  const output = new THREE.Group();
  output.userData.rotationDegreesOfFreedom = 0;
  output.userData.role = 'piston-rod-carried-by-lower-vibrating-rod-end-L';
  const outputBoss = cylinderAlongZ(0.32 * sourceScale, 0.16,
    outputMaterial, 34);
  outputBoss.position.z = 0.57;
  outputBoss.userData.role = 'piston-crosshead-boss-at-L';
  // Brown breaks the rod off below L; it is whole, running down through the
  // gland of its cylinder below the plate's view over the whole stroke.
  const cylinderTopY338 = -4.3;
  const visiblePistonRodLength = 3.2 * sourceScale;
  const wholePistonRodLength = 0.01 - cylinderTopY338 + 0.3;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.28 * sourceScale, visiblePistonRodLength, 0.12),
    outputMaterial,
  );
  pistonRod.position.set(0, -visiblePistonRodLength / 2, 0.57);
  pistonRod.userData.role = 'vertical-piston-rod-continuing-below-L';
  const pistonRodBeyondCrop = new THREE.Mesh(
    new THREE.BoxGeometry(0.28 * sourceScale, wholePistonRodLength - visiblePistonRodLength, 0.12),
    outputMaterial,
  );
  pistonRodBeyondCrop.position.set(0, -(visiblePistonRodLength + wholePistonRodLength) / 2, 0.57);
  pistonRodBeyondCrop.userData.role = 'piston-rod-running-on-into-its-cylinder';
  pistonRodBeyondCrop.userData.beyondPlateCrop = true;
  root.add(glandCylinder({ x: 3.836, topY: cylinderTopY338, z: 0.57, length: 2.55,
    glandRadius: 0.12, boreRadius: 0.3, outerRadius: 0.42, role: 'piston-cylinder-below-plate-crop' }));
  const outputAnchor = new THREE.Object3D();
  outputAnchor.position.z = 0.57;
  outputAnchor.userData.role = 'analytic-piston-point-L';
  output.add(
    outputBoss,
    pistonRod,
    pistonRodBeyondCrop,
    outputAnchor,
  );
  root.add(output);

  // Pins are rigid with one member and pass through true bores of the rest:
  // L in the crosshead, R in the beam and U in the radius bar.
  const jointPins = {
    L: cylinderAlongZ(0.19 * sourceScale, 0.38, whiteMaterial, 30),
    R: cylinderAlongZ(0.22 * sourceScale, 0.55, whiteMaterial, 30),
    U: cylinderAlongZ(0.20 * sourceScale, 0.67, whiteMaterial, 30),
  };
  jointPins.L.position.set(0, 0, 0.47);
  output.add(jointPins.L);
  jointPins.R.position.set(beamHalfRadius, 0, 0.36);
  beam.add(jointPins.R);
  jointPins.U.position.set(radiusBarLength, 0, 0.55);
  radiusParts.rod.add(jointPins.U);
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
  });

  const contacts = {
    beamAtR: {
      members: [beam, vibratingParts.rod],
      point: new THREE.Vector3(),
      type: 'beam-to-vibrating-rod-center-pin-R',
    },
    beamPivotO: {
      fixedMember: fixedFrame,
      movingMember: beam,
      point: new THREE.Vector3(0, 0, 0.04),
      type: 'fixed-revolute-pair-O',
    },
    pistonAtL: {
      members: [vibratingParts.rod, output],
      point: new THREE.Vector3(),
      type: 'lower-vibrating-rod-piston-pin-L',
    },
    radiusAtU: {
      members: [vibratingParts.rod, radiusParts.rod],
      point: new THREE.Vector3(),
      type: 'upper-vibrating-rod-radius-bar-pin-U',
    },
    radiusPivotF: {
      fixedMember: fixedFrame,
      movingMember: radiusParts.rod,
      point: new THREE.Vector3(radiusPivotF.x, radiusPivotF.y, 0.70),
      type: 'fixed-revolute-pair-F-above-beam',
    },
  };

  const setRodPose = (rod, start, rates) => {
    rod.position.set(start.x, start.y, 0);
    rod.rotation.z = rates.angle;
    rod.userData.angularSpeed = rates.angularVelocity;
    rod.userData.angularAcceleration = rates.angularAcceleration;
  };
  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beam.angle;
    beam.userData.angularSpeed = state.beam.angularVelocity;
    beam.userData.angularAcceleration = state.beam.angularAcceleration;
    setRodPose(vibratingParts.rod, state.pointL, state.vibratingRod);
    setRodPose(radiusParts.rod, radiusPivotF, state.radiusBar);
    output.position.set(state.pointL.x, state.pointL.y, 0);
    output.userData.velocity = new THREE.Vector3(
      state.pointLVelocity.x,
      state.pointLVelocity.y,
      0,
    );
    output.userData.acceleration = new THREE.Vector3(
      state.pointLAcceleration.x,
      state.pointLAcceleration.y,
      0,
    );
    contacts.beamAtR.point.set(state.beamPointR.x,
      state.beamPointR.y, 0.35);
    contacts.pistonAtL.point.set(state.pointL.x, state.pointL.y, 0.52);
    contacts.radiusAtU.point.set(state.pointU.x, state.pointU.y, 0.55);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-2.207959, -6);
  const officialViewWidth = 12;
  const officialViewHeight = 12;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  root.userData.archetype =
    'beam-centered-vibrating-rod-with-upper-fixed-radius-parallel-motion';
  root.userData.blocks = {
    beam,
    beamBody,
    beamNegativeAnchor,
    beamPivotAnchor,
    beamPivotBoss,
    beamPointRAnchor,
    beamShaft,
    fixedFrame,
    jointPins,
    output,
    outputAnchor,
    pistonRod,
    radiusBar: radiusParts.rod,
    radiusBarEndAnchor: radiusParts.endAnchor,
    radiusBarStartAnchor: radiusParts.startAnchor,
    radiusShaft,
    vibratingMidpointAnchor,
    vibratingRod: vibratingParts.rod,
    vibratingRodEndAnchor: vibratingParts.endAnchor,
    vibratingRodStartAnchor: vibratingParts.startAnchor,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input:
      'one hidden two-unit crank rocks the eight-unit half-beam through a ten-unit rod',
    mechanism: 1,
    output:
      'lower vibrating-rod endpoint L carries the piston on a near-vertical four-unit stroke',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -3.03;
  root.userData.mechanism =
    'closed-rigid-beam-O-R-centered-vibrating-rod-L-R-U-upper-radius-bar-F-U-and-piston-at-lower-end-L';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_rot',
      'add_c_rod_r',
      'add_rot_to',
      'add_c_rod_r',
      'add_rot_to',
      'add_tx',
    ],
    officialGeometry: {
      beamHalfRadius: sourceBeamHalfRadius,
      beamPivotO: sourceBeamPivotO,
      canvasPistonRodLength: sourceCanvasPistonRodLength,
      canvasRadiusConstraintLength: sourceCanvasRadiusConstraintLength,
      hiddenCrankCenter: sourceHiddenCrankCenter,
      hiddenCrankRadius: sourceHiddenCrankRadius,
      hiddenDriveRodLength: sourceHiddenDriveRodLength,
      inputPhaseOffsetTurns: 0.125,
      radiusBarLength: sourceRadiusBarLength,
      radiusPivotF: sourceRadiusPivotF,
      radiusReferencePoint: sourceRadiusReferencePoint,
      strokeLine: [
        new THREE.Vector2(8, -1),
        new THREE.Vector2(8, -9),
      ],
      vibratingRodHalfLength: sourceVibratingRodHalfLength,
      vibratingRodLength: sourceVibratingRodLength,
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the canvas solves U at the 4.254550197-unit distance implied by its rounded branch point but draws a 4.25455-unit F-U bar; this model closes the stated bar exactly and differs at L by less than 0.000000243 source unit',
    referenceScope:
      'official hidden crank and rod, both eight-unit beam stations, centered four-unit vibrating rod L-R-U, fixed upper pivot F, F-U bar, branch reference point, piston line, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate338: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'beam pin R carries the center of vibrating rod L-R-U, radius bar F-U lies above the beam, and lower endpoint L carries the piston',
      measurementUncertaintyPixels: 4,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactRigidConstraints:
      '|O-R|=8, |L-R|=|R-U|=2, |F-U|=4.25455, and L=2R-U in source units',
    input:
      'a hidden two-unit crank and ten-unit connecting rod rock the opposed eight-unit station of beam O-R',
    output:
      'lower endpoint L carries the piston while R remains the exact center of the four-unit vibrating rod',
    straightness:
      'placing F-U above the beam gives L a near-vertical 3.9996-unit stroke with measured lateral deviation',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  // Brown's view begins just behind fulcrum O and ends below piston pin L.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-0.75, -2.85, -0.25),
    new THREE.Vector3(4.55, 1.35, 0.95),
  );
  root.userData.cameraDistanceScale = 0.98;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
    root,
    update,
  };
}

export function createAuthoredVibratingRodParallelMotion(movement) {
  switch (movement.id) {
    case 337: return midpointVibratingRodParallelMotion(movement);
    case 338: return upperRadiusVibratingRodParallelMotion(movement);
    default: return null;
  }
}
