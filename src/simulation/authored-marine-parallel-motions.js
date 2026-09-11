import * as THREE from 'three';
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
    curveSegments: 32,
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
  if (distance === 0) throw new Error('Coincident circle centers');
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
  return {
    acceleration,
    determinant,
    velocity,
  };
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

function makeRigidRod({
  bodyMaterial,
  depth,
  eyeMaterial,
  length,
  planeZ,
  role,
  width,
}) {
  const rod = new THREE.Group();
  rod.userData.nominalLength = length;
  rod.userData.role = role;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    bodyMaterial,
  );
  body.position.set(length / 2, 0, planeZ);
  body.userData.role = `${role}-constant-length-shank`;
  const startBoss = cylinderAlongZ(width * 0.88, depth * 1.18,
    bodyMaterial, 36);
  startBoss.position.z = planeZ;
  startBoss.userData.role = `${role}-start-boss`;
  const endBoss = cylinderAlongZ(width * 0.88, depth * 1.18,
    bodyMaterial, 36);
  endBoss.position.set(length, 0, planeZ);
  endBoss.userData.role = `${role}-end-boss`;
  const startEye = new THREE.Mesh(
    new THREE.TorusGeometry(width * 0.48, width * 0.12, 8, 32),
    eyeMaterial,
  );
  startEye.position.z = planeZ + depth / 2 + 0.014;
  startEye.userData.role = `${role}-start-eye`;
  const endEye = new THREE.Mesh(
    new THREE.TorusGeometry(width * 0.48, width * 0.12, 8, 32),
    eyeMaterial,
  );
  endEye.position.set(length, 0, planeZ + depth / 2 + 0.014);
  endEye.userData.role = `${role}-end-eye`;
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = planeZ;
  startAnchor.userData.role = `${role}-analytic-start`;
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(length, 0, planeZ);
  endAnchor.userData.role = `${role}-analytic-end`;
  rod.add(body, startBoss, endBoss, startEye, endEye,
    startAnchor, endAnchor);
  return {
    body,
    endAnchor,
    endBoss,
    endEye,
    rod,
    startAnchor,
    startBoss,
    startEye,
  };
}

function makeSideLever({
  darkMaterial,
  drivenMaterial,
  length,
  midDistance,
  planeZ,
  scale,
  whiteMaterial,
}) {
  const lever = new THREE.Group();
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role = 'rocking-side-lever-pivoted-at-A';

  const visibleBackExtension = 1.15 * scale;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      length + visibleBackExtension,
      0.42 * scale,
      0.20,
    ),
    drivenMaterial,
  );
  body.position.set((length - visibleBackExtension) / 2, 0, planeZ);
  body.userData.role = 'source-eight-unit-side-lever-body';
  const lowerEdge = body.clone();
  lowerEdge.scale.y = 0.20;
  lowerEdge.position.y = -0.31 * scale;
  lowerEdge.userData.role = 'side-lever-lower-taper-line';

  const pivotA = cylinderAlongZ(1.00 * scale, 0.30,
    drivenMaterial, 44);
  pivotA.position.z = planeZ;
  pivotA.userData.role = 'large-side-lever-pivot-A';
  const pivotABore = cylinderAlongZ(0.56 * scale, 0.325,
    darkMaterial, 38);
  pivotABore.position.z = planeZ + 0.004;
  pivotABore.userData.role = 'fixed-bearing-bore-at-A';
  const pivotAIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.38 * scale, 0.050, 0.032),
    whiteMaterial,
  );
  pivotAIndex.position.set(0.25 * scale, 0, planeZ + 0.175);
  pivotAIndex.userData.role = 'white-rocking-index-at-A';

  const midBoss = cylinderAlongZ(0.28 * scale, 0.26,
    drivenMaterial, 34);
  midBoss.position.set(midDistance, 0, planeZ);
  midBoss.userData.role = 'side-lever-four-unit-middle-pin';
  const rightBoss = cylinderAlongZ(0.50 * scale, 0.28,
    drivenMaterial, 38);
  rightBoss.position.set(length, 0, planeZ);
  rightBoss.userData.role = 'side-lever-eight-unit-right-pin';
  const rightIndex = cylinderAlongZ(0.22 * scale, 0.032,
    whiteMaterial, 30);
  rightIndex.position.set(length, 0, planeZ + 0.165);
  rightIndex.userData.role = 'white-index-at-side-lever-right-pin';

  const midAnchor = new THREE.Object3D();
  midAnchor.position.set(midDistance, 0, planeZ);
  midAnchor.userData.role = 'analytic-four-unit-side-lever-pin';
  const rightAnchor = new THREE.Object3D();
  rightAnchor.position.set(length, 0, planeZ);
  rightAnchor.userData.role = 'analytic-eight-unit-side-lever-pin';
  const hiddenInputAnchor = new THREE.Object3D();
  hiddenInputAnchor.position.set(-length, 0, planeZ);
  hiddenInputAnchor.userData.role =
    'analytic-hidden-negative-eight-unit-animation-driver-point';
  lever.add(
    body,
    lowerEdge,
    pivotA,
    pivotABore,
    pivotAIndex,
    midBoss,
    rightBoss,
    rightIndex,
    midAnchor,
    rightAnchor,
    hiddenInputAnchor,
  );
  return {
    body,
    hiddenInputAnchor,
    lever,
    midAnchor,
    midBoss,
    pivotA,
    pivotABore,
    pivotAIndex,
    rightAnchor,
    rightBoss,
    rightIndex,
  };
}

function makeOutputCrosshead({
  darkMaterial,
  outputMaterial,
  planeZ,
  scale,
  whiteMaterial,
}) {
  const output = new THREE.Group();
  output.userData.role = 'crosshead-E-piston-rod-and-piston-output';
  output.userData.rotationDegreesOfFreedom = 0;

  const housingShape = new THREE.Shape();
  housingShape.moveTo(-0.50 * scale, -0.75 * scale);
  housingShape.lineTo(0.50 * scale, -0.75 * scale);
  housingShape.lineTo(0.50 * scale, 0.75 * scale);
  housingShape.absarc(0, 0.75 * scale, 0.375 * scale,
    0, Math.PI, false);
  housingShape.lineTo(-0.50 * scale, -0.75 * scale);
  housingShape.closePath();
  const jointHole = new THREE.Path();
  jointHole.absarc(0, 0, 0.23 * scale, 0, FULL_TURN, true);
  jointHole.closePath();
  housingShape.holes.push(jointHole);
  const housing = new THREE.Mesh(
    centeredExtrusion(housingShape, 0.24, 0.008),
    outputMaterial,
  );
  housing.position.z = planeZ;
  housing.userData.realJointBore = true;
  housing.userData.role = 'source-crosshead-E-with-real-joint-bore';

  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.375 * scale, 8.25 * scale, 0.18),
    outputMaterial,
  );
  pistonRod.position.set(0, -4.875 * scale, planeZ - 0.02);
  pistonRod.userData.role = 'piston-rod-rigidly-carried-by-crosshead-E';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(4.50 * scale, 1.00 * scale, 0.58),
    outputMaterial,
  );
  pistonHead.position.set(0, -9.50 * scale, planeZ - 0.15);
  pistonHead.userData.role = 'side-lever-engine-piston-head';
  const jointFace = cylinderAlongZ(0.20 * scale, 0.035,
    whiteMaterial, 30);
  jointFace.position.z = planeZ + 0.145;
  jointFace.userData.role = 'white-crosshead-E-joint-index';
  const jointBore = new THREE.Mesh(
    new THREE.TorusGeometry(0.23 * scale, 0.035, 8, 30),
    darkMaterial,
  );
  jointBore.position.z = planeZ + 0.142;
  jointBore.userData.role = 'crosshead-E-working-pin-bore-outline';
  const anchor = new THREE.Object3D();
  anchor.position.z = planeZ;
  anchor.userData.role = 'analytic-crosshead-E-center';
  const pistonAnchor = new THREE.Object3D();
  pistonAnchor.position.set(0, -9.50 * scale, planeZ);
  pistonAnchor.userData.role = 'analytic-piston-center';
  output.add(housing, pistonRod, pistonHead, jointFace, jointBore,
    anchor, pistonAnchor);
  return {
    anchor,
    housing,
    jointBore,
    jointFace,
    output,
    pistonAnchor,
    pistonHead,
    pistonRod,
  };
}

function sideLeverRockshaftParallelMotion(movement) {
  const root = new THREE.Group();

  // Brown's side elevation is an exact parallelogram M-R-N-Q carried by the
  // ten-unit side lever O-R. The two parallel rods R-S and M-Q share one
  // direction; Q is controlled by the short arm F-Q on a transverse fixed
  // rock-shaft, and S is the extrapolated piston point. The official canvas
  // instead forces S onto x=10 and merely aims its drawn F-Q arm at Q. That
  // makes the arm breathe by about 0.00925 source unit. This reconstruction
  // closes the real rigid mechanism and measures the resulting historical
  // near-straight locus rather than suppressing it.
  const sourceScale = 0.35;
  const sourceBeamPivotO = new THREE.Vector2(0, 0);
  const sourceHiddenCrankCenter = new THREE.Vector2(-10, 10);
  const sourceHiddenCrankRadius = 3;
  const sourceHiddenDriveRodLength = 10;
  const sourceHiddenDrivenBeamRadius = 10;
  const sourceSideLeverRightRadius = 10;
  const sourceSideLeverMidRadius = 3;
  const sourceSideRodLength = 10;
  const sourceSideRodIntermediateDistance = 8.5;
  const sourceParallelRodLength = 8.5;
  const sourceCrossbarLength = 7;
  const sourceRockshaftPivotF = new THREE.Vector2(4.757556, 8.5);
  const sourceRadiusArmLength = 1.757556;
  const sourceVerticalStrokeLineX = 10;
  const sourceInputPhaseOffset = FULL_TURN * 0.25;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const beamPivotO = sourceBeamPivotO.clone().multiplyScalar(sourceScale);
  const hiddenCrankCenter = sourceHiddenCrankCenter.clone()
    .multiplyScalar(sourceScale);
  const hiddenCrankRadius = sourceHiddenCrankRadius * sourceScale;
  const hiddenDriveRodLength = sourceHiddenDriveRodLength * sourceScale;
  const hiddenDrivenBeamRadius = sourceHiddenDrivenBeamRadius * sourceScale;
  const sideLeverRightRadius = sourceSideLeverRightRadius * sourceScale;
  const sideLeverMidRadius = sourceSideLeverMidRadius * sourceScale;
  const sideRodLength = sourceSideRodLength * sourceScale;
  const sideRodIntermediateDistance = sourceSideRodIntermediateDistance
    * sourceScale;
  const parallelRodLength = sourceParallelRodLength * sourceScale;
  const crossbarLength = sourceCrossbarLength * sourceScale;
  const rockshaftPivotF = sourceRockshaftPivotF.clone()
    .multiplyScalar(sourceScale);
  const radiusArmLength = sourceRadiusArmLength * sourceScale;
  const verticalStrokeLineX = sourceVerticalStrokeLineX * sourceScale;
  const parallelToSideRatio = parallelRodLength / sideRodLength;
  const sideToParallelRatio = sideRodLength / parallelRodLength;
  const midToRightRatio = sideLeverMidRadius / sideLeverRightRadius;
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
        hiddenDrivenBeamRadius,
        inputCrankPin,
        hiddenDriveRodLength,
      ),
      new THREE.Vector2(-hiddenDrivenBeamRadius, 0),
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
    const beamRightPoint = beamNegativePoint.clone().multiplyScalar(-1);
    const beamRightVelocity = beamNegativeRates.velocity.clone()
      .multiplyScalar(-1);
    const beamRightAcceleration = beamNegativeRates.acceleration.clone()
      .multiplyScalar(-1);
    const beamMidPoint = beamRightPoint.clone()
      .multiplyScalar(midToRightRatio);
    const beamMidVelocity = beamRightVelocity.clone()
      .multiplyScalar(midToRightRatio);
    const beamMidAcceleration = beamRightAcceleration.clone()
      .multiplyScalar(midToRightRatio);

    // Reproduce the source's line-constrained construction only as a
    // reference. Its upper intersection is the piston pin S; Q is 8.5/10 of
    // the way up the side-rod direction from M.
    const officialHorizontalDelta = verticalStrokeLineX - beamRightPoint.x;
    const officialVerticalDelta = Math.sqrt(Math.max(
      0,
      sideRodLength ** 2 - officialHorizontalDelta ** 2,
    ));
    const officialPointS = new THREE.Vector2(
      verticalStrokeLineX,
      beamRightPoint.y + officialVerticalDelta,
    );
    const officialSideVector = officialPointS.clone().sub(beamRightPoint);
    const officialPointQ = beamMidPoint.clone().addScaledVector(
      officialSideVector,
      parallelToSideRatio,
    );
    const officialPointN = beamRightPoint.clone().addScaledVector(
      officialSideVector,
      parallelToSideRatio,
    );

    const pointQ = nearestPoint(
      circleCircleIntersections(
        beamMidPoint,
        parallelRodLength,
        rockshaftPivotF,
        radiusArmLength,
      ),
      officialPointQ,
    );
    const pointQRates = constrainedPointRates({
      accelerationA: beamMidAcceleration,
      accelerationB: zero,
      centerA: beamMidPoint,
      centerB: rockshaftPivotF,
      point: pointQ,
      velocityA: beamMidVelocity,
      velocityB: zero,
    });
    const parallelVector = pointQ.clone().sub(beamMidPoint);
    const parallelVelocity = pointQRates.velocity.clone()
      .sub(beamMidVelocity);
    const parallelAcceleration = pointQRates.acceleration.clone()
      .sub(beamMidAcceleration);
    const pointN = beamRightPoint.clone().add(parallelVector);
    const pointNVelocity = beamRightVelocity.clone().add(parallelVelocity);
    const pointNAcceleration = beamRightAcceleration.clone()
      .add(parallelAcceleration);
    const pointS = beamRightPoint.clone().addScaledVector(
      parallelVector,
      sideToParallelRatio,
    );
    const pointSVelocity = beamRightVelocity.clone().addScaledVector(
      parallelVelocity,
      sideToParallelRatio,
    );
    const pointSAcceleration = beamRightAcceleration.clone().addScaledVector(
      parallelAcceleration,
      sideToParallelRatio,
    );

    const beamRates = rigidLinkRates(
      beamRightPoint,
      beamRightVelocity,
      beamRightAcceleration,
    );
    const sideVector = pointS.clone().sub(beamRightPoint);
    const sideVelocity = pointSVelocity.clone().sub(beamRightVelocity);
    const sideAcceleration = pointSAcceleration.clone()
      .sub(beamRightAcceleration);
    const crossbarVector = pointN.clone().sub(pointQ);
    const crossbarVelocity = pointNVelocity.clone()
      .sub(pointQRates.velocity);
    const crossbarAcceleration = pointNAcceleration.clone()
      .sub(pointQRates.acceleration);
    const radiusVector = pointQ.clone().sub(rockshaftPivotF);
    const driveRodVector = beamNegativePoint.clone().sub(inputCrankPin);
    const driveRodVelocity = beamNegativeRates.velocity.clone()
      .sub(inputCrankPinVelocity);
    const driveRodAcceleration = beamNegativeRates.acceleration.clone()
      .sub(inputCrankPinAcceleration);

    return {
      beam: beamRates,
      beamMidAcceleration,
      beamMidPoint,
      beamMidVelocity,
      beamNegativeAcceleration: beamNegativeRates.acceleration,
      beamNegativePoint,
      beamNegativeVelocity: beamNegativeRates.velocity,
      beamRightAcceleration,
      beamRightPoint,
      beamRightVelocity,
      crossbar: rigidLinkRates(
        crossbarVector,
        crossbarVelocity,
        crossbarAcceleration,
      ),
      crossheadSLateralDeviation: pointS.x - verticalStrokeLineX,
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
        pointN: officialPointN,
        pointQ: officialPointQ,
        pointS: officialPointS,
        radiusArmResidual:
          officialPointQ.distanceTo(rockshaftPivotF) - radiusArmLength,
      },
      parallelRod: rigidLinkRates(
        parallelVector,
        parallelVelocity,
        parallelAcceleration,
      ),
      pointN,
      pointNAcceleration,
      pointNVelocity,
      pointQ,
      pointQAcceleration: pointQRates.acceleration,
      pointQVelocity: pointQRates.velocity,
      pointS,
      pointSAcceleration,
      pointSVelocity,
      radiusArm: rigidLinkRates(
        radiusVector,
        pointQRates.velocity,
        pointQRates.acceleration,
      ),
      sideRod: rigidLinkRates(sideVector, sideVelocity, sideAcceleration),
      unwrappedInputAngle,
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
  let maximumOfficialRadiusArmResidual = 0;
  let maximumPistonVerticalDifference = 0;
  let minimumBeamAngle = Infinity;
  let maximumBeamAngle = -Infinity;
  let minimumCrossheadY = Infinity;
  let maximumCrossheadY = -Infinity;
  let minimumOfficialCrossheadY = Infinity;
  let maximumOfficialCrossheadY = -Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(cyclePeriod * sample / 16384);
    maximumLateralDeviation = Math.max(
      maximumLateralDeviation,
      Math.abs(state.crossheadSLateralDeviation),
    );
    maximumOfficialRadiusArmResidual = Math.max(
      maximumOfficialRadiusArmResidual,
      Math.abs(state.officialCanvasApproximation.radiusArmResidual),
    );
    maximumPistonVerticalDifference = Math.max(
      maximumPistonVerticalDifference,
      Math.abs(state.pointS.y - state.officialCanvasApproximation.pointS.y),
    );
    minimumBeamAngle = Math.min(minimumBeamAngle, state.beam.angle);
    maximumBeamAngle = Math.max(maximumBeamAngle, state.beam.angle);
    minimumCrossheadY = Math.min(minimumCrossheadY, state.pointS.y);
    maximumCrossheadY = Math.max(maximumCrossheadY, state.pointS.y);
    minimumOfficialCrossheadY = Math.min(
      minimumOfficialCrossheadY,
      state.officialCanvasApproximation.pointS.y,
    );
    maximumOfficialCrossheadY = Math.max(
      maximumOfficialCrossheadY,
      state.officialCanvasApproximation.pointS.y,
    );
  }

  const geometry = {
    beamPivotO,
    crossbarLength,
    cyclePeriod,
    hiddenCrankCenter,
    hiddenCrankRadius,
    hiddenDriveRodLength,
    hiddenDrivenBeamRadius,
    inputAngularSpeed,
    maximumBeamAngle,
    maximumCrossheadY,
    maximumLateralDeviation,
    maximumOfficialCrossheadY,
    maximumOfficialRadiusArmResidual,
    maximumPistonVerticalDifference,
    minimumBeamAngle,
    minimumCrossheadY,
    minimumOfficialCrossheadY,
    officialOutputStroke:
      maximumOfficialCrossheadY - minimumOfficialCrossheadY,
    outputStroke: maximumCrossheadY - minimumCrossheadY,
    parallelRodLength,
    radiusArmLength,
    rockshaftPivotF,
    sideLeverMidRadius,
    sideLeverRightRadius,
    sideRodIntermediateDistance,
    sideRodLength,
    sourceInputPhaseOffset,
    sourceScale,
    verticalStrokeLineX,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.11,
    roughness: 0.73,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const rodMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const crossbarMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const outputMaterial = matte(0xd78332, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-marine-engine-frame-beam-bearing-guides-and-F-rockshaft';
  const framePlaneZ = -0.48;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(6.5 * sourceScale, 0.34 * sourceScale, 0.66),
    frameMaterial,
  );
  deck.position.set(10 * sourceScale, 5 * sourceScale, framePlaneZ);
  deck.userData.fixed = true;
  deck.userData.role = 'fixed-marine-engine-deck-at-source-y-five';
  const lowerBed = new THREE.Mesh(
    new THREE.BoxGeometry(6.5 * sourceScale, 0.42 * sourceScale, 0.78),
    frameMaterial,
  );
  lowerBed.position.set(10 * sourceScale, -2.25 * sourceScale, framePlaneZ);
  lowerBed.userData.fixed = true;
  lowerBed.userData.role = 'fixed-lower-marine-engine-bedplate';
  const framePosts = [7, 13].map((sourceX, index) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.30 * sourceScale, 7.25 * sourceScale, 0.54),
      frameMaterial,
    );
    post.position.set(sourceX * sourceScale, 1.375 * sourceScale, framePlaneZ);
    post.userData.fixed = true;
    post.userData.role = `fixed-engine-frame-post-${index + 1}`;
    fixedFrame.add(post);
    return post;
  });
  const cylinderBack = new THREE.Mesh(
    new THREE.BoxGeometry(5.55 * sourceScale, 6.45 * sourceScale, 0.20),
    frameMaterial,
  );
  cylinderBack.position.set(10 * sourceScale, 1.42 * sourceScale, -0.78);
  cylinderBack.userData.fixed = true;
  cylinderBack.userData.role = 'recessed-fixed-cylinder-and-frame-backplate';

  const guideHeight = 8.3 * sourceScale;
  const guideRails = [9.45, 10.55].map((sourceX, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, guideHeight, 0.36),
      darkMaterial,
    );
    rail.position.set(sourceX * sourceScale, 10.15 * sourceScale, -0.22);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-piston-crosshead-guide-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const guideTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.65 * sourceScale, 0.22 * sourceScale, 0.48),
    frameMaterial,
  );
  guideTop.position.set(10 * sourceScale, 14.25 * sourceScale, -0.28);
  guideTop.userData.fixed = true;
  guideTop.userData.role = 'fixed-cap-over-piston-crosshead-guides';

  const beamBearing = cylinderAlongZ(1.125 * sourceScale, 0.62,
    frameMaterial, 46);
  beamBearing.position.set(0, 0, -0.27);
  beamBearing.userData.fixed = true;
  beamBearing.userData.role = 'fixed-large-side-lever-bearing-O';
  const beamShaft = cylinderAlongZ(0.37 * sourceScale, 1.20,
    darkMaterial, 34);
  beamShaft.position.set(0, 0, -0.02);
  beamShaft.userData.fixed = true;
  beamShaft.userData.role = 'fixed-side-lever-shaft-through-O';
  const beamBearingBed = new THREE.Mesh(
    new THREE.BoxGeometry(2.75 * sourceScale, 0.56 * sourceScale, 0.82),
    frameMaterial,
  );
  beamBearingBed.position.set(0, -1.15 * sourceScale, -0.43);
  beamBearingBed.userData.fixed = true;
  beamBearingBed.userData.role = 'fixed-bed-under-side-lever-bearing-O';

  const supportFootA = new THREE.Vector3(
    6.40 * sourceScale,
    5.10 * sourceScale,
    -0.52,
  );
  const supportFootB = new THREE.Vector3(
    5.85 * sourceScale,
    5.10 * sourceScale,
    1.18,
  );
  const supportTopA = new THREE.Vector3(
    rockshaftPivotF.x,
    rockshaftPivotF.y,
    -0.52,
  );
  const supportTopB = new THREE.Vector3(
    rockshaftPivotF.x,
    rockshaftPivotF.y,
    1.18,
  );
  const rockshaftSupports = [
    beamBetween3D(supportFootA, supportTopA,
      0.28 * sourceScale, 0.24, frameMaterial),
    beamBetween3D(supportFootB, supportTopB,
      0.28 * sourceScale, 0.24, frameMaterial),
  ];
  rockshaftSupports.forEach((support, index) => {
    support.userData.fixed = true;
    support.userData.role = `fixed-rockshaft-bearing-standard-${index + 1}`;
  });
  const rockshaft = cylinderAlongZ(0.19 * sourceScale, 2.16,
    darkMaterial, 34);
  rockshaft.position.set(rockshaftPivotF.x, rockshaftPivotF.y, 0.34);
  rockshaft.userData.fixed = true;
  rockshaft.userData.role = 'transverse-fixed-axis-rockshaft-F';
  const rockshaftBearings = [-0.63, 1.31].map((z, index) => {
    const bearing = cylinderAlongZ(0.48 * sourceScale, 0.27,
      frameMaterial, 38);
    bearing.position.set(rockshaftPivotF.x, rockshaftPivotF.y, z);
    bearing.userData.fixed = true;
    bearing.userData.role = `fixed-rockshaft-bearing-${index + 1}`;
    fixedFrame.add(bearing);
    return bearing;
  });
  fixedFrame.add(
    deck,
    lowerBed,
    cylinderBack,
    guideTop,
    beamBearing,
    beamShaft,
    beamBearingBed,
    ...rockshaftSupports,
    rockshaft,
  );
  root.add(fixedFrame);

  const sideLever = new THREE.Group();
  sideLever.userData.axis = Z_AXIS.clone();
  sideLever.userData.role =
    'ten-unit-side-lever-O-R-with-three-unit-parallel-rod-station-M';
  const leverShape = new THREE.Shape();
  leverShape.moveTo(-0.48 * sourceScale, -0.82 * sourceScale);
  leverShape.lineTo(2.2 * sourceScale, -0.69 * sourceScale);
  leverShape.lineTo(9.35 * sourceScale, -0.39 * sourceScale);
  leverShape.lineTo(10.05 * sourceScale, -0.20 * sourceScale);
  leverShape.lineTo(10.05 * sourceScale, 0.20 * sourceScale);
  leverShape.lineTo(9.35 * sourceScale, 0.39 * sourceScale);
  leverShape.lineTo(2.2 * sourceScale, 0.69 * sourceScale);
  leverShape.lineTo(-0.48 * sourceScale, 0.82 * sourceScale);
  leverShape.closePath();
  const leverSlot = new THREE.Path();
  leverSlot.moveTo(1.55 * sourceScale, -0.26 * sourceScale);
  leverSlot.lineTo(8.70 * sourceScale, -0.16 * sourceScale);
  leverSlot.lineTo(8.70 * sourceScale, 0.16 * sourceScale);
  leverSlot.lineTo(1.55 * sourceScale, 0.26 * sourceScale);
  leverSlot.closePath();
  leverShape.holes.push(leverSlot);
  const sideLeverBody = new THREE.Mesh(
    centeredExtrusion(leverShape, 0.28, 0.009),
    leverMaterial,
  );
  sideLeverBody.position.z = 0.04;
  sideLeverBody.userData.role = 'slotted-tapered-rigid-side-lever-body';
  const sideLeverPivotBoss = cylinderAlongZ(1.125 * sourceScale, 0.38,
    leverMaterial, 44);
  sideLeverPivotBoss.position.z = 0.04;
  sideLeverPivotBoss.userData.role = 'large-moving-side-lever-boss-O';
  const sideLeverPivotBore = cylinderAlongZ(0.37 * sourceScale, 0.405,
    darkMaterial, 34);
  sideLeverPivotBore.position.z = 0.045;
  sideLeverPivotBore.userData.role = 'side-lever-working-bore-at-O';
  const sideLeverMidBoss = cylinderAlongZ(0.30 * sourceScale, 0.33,
    leverMaterial, 34);
  sideLeverMidBoss.position.set(sideLeverMidRadius, 0, 0.04);
  sideLeverMidBoss.userData.role = 'side-lever-three-unit-pin-boss-M';
  const sideLeverRightBoss = cylinderAlongZ(0.875 * sourceScale, 0.38,
    leverMaterial, 42);
  sideLeverRightBoss.position.set(sideLeverRightRadius, 0, 0.04);
  sideLeverRightBoss.userData.role = 'side-lever-ten-unit-pin-boss-R';
  const leverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.88 * sourceScale, 0.055, 0.035),
    whiteMaterial,
  );
  leverIndex.position.set(0.52 * sourceScale, 0, 0.245);
  leverIndex.userData.role = 'visible-index-on-rocking-side-lever';
  const beamMidAnchor = new THREE.Object3D();
  beamMidAnchor.position.set(sideLeverMidRadius, 0, 0.04);
  beamMidAnchor.userData.role = 'analytic-side-lever-station-M';
  const beamRightAnchor = new THREE.Object3D();
  beamRightAnchor.position.set(sideLeverRightRadius, 0, 0.04);
  beamRightAnchor.userData.role = 'analytic-side-lever-end-R';
  const beamNegativeAnchor = new THREE.Object3D();
  beamNegativeAnchor.position.set(-hiddenDrivenBeamRadius, 0, 0.04);
  beamNegativeAnchor.userData.role =
    'analytic-hidden-side-lever-driver-station';
  sideLever.add(
    sideLeverBody,
    sideLeverPivotBoss,
    sideLeverPivotBore,
    sideLeverMidBoss,
    sideLeverRightBoss,
    leverIndex,
    beamMidAnchor,
    beamRightAnchor,
    beamNegativeAnchor,
  );
  root.add(sideLever);

  const parallelRodParts = makeRigidRod({
    bodyMaterial: rodMaterial,
    depth: 0.17,
    eyeMaterial: darkMaterial,
    length: parallelRodLength,
    planeZ: 0.37,
    role: 'eight-and-one-half-unit-parallel-rod-M-Q',
    width: 0.34 * sourceScale,
  });
  const sideRodParts = makeRigidRod({
    bodyMaterial: rodMaterial,
    depth: 0.17,
    eyeMaterial: darkMaterial,
    length: sideRodLength,
    planeZ: 0.40,
    role: 'ten-unit-side-rod-R-S-through-N',
    width: 0.34 * sourceScale,
  });
  const sideRodIntermediateBoss = cylinderAlongZ(0.28 * sourceScale, 0.21,
    rodMaterial, 32);
  sideRodIntermediateBoss.position.set(
    sideRodIntermediateDistance,
    0,
    0.40,
  );
  sideRodIntermediateBoss.userData.role =
    'side-rod-eight-and-one-half-unit-intermediate-pin-N';
  const sideRodIntermediateAnchor = new THREE.Object3D();
  sideRodIntermediateAnchor.position.set(
    sideRodIntermediateDistance,
    0,
    0.40,
  );
  sideRodIntermediateAnchor.userData.role = 'analytic-side-rod-point-N';
  sideRodParts.rod.add(sideRodIntermediateBoss, sideRodIntermediateAnchor);
  const crossbarParts = makeRigidRod({
    bodyMaterial: crossbarMaterial,
    depth: 0.17,
    eyeMaterial: darkMaterial,
    length: crossbarLength,
    planeZ: 0.68,
    role: 'seven-unit-parallelogram-crossbar-Q-N',
    width: 0.34 * sourceScale,
  });
  const radiusArmParts = makeRigidRod({
    bodyMaterial: leverMaterial,
    depth: 0.19,
    eyeMaterial: darkMaterial,
    length: radiusArmLength,
    planeZ: 0.94,
    role: 'one-point-seven-five-seven-five-five-six-unit-rockshaft-arm-F-Q',
    width: 0.46 * sourceScale,
  });
  root.add(
    parallelRodParts.rod,
    sideRodParts.rod,
    crossbarParts.rod,
    radiusArmParts.rod,
  );

  const output = new THREE.Group();
  output.userData.rotationDegreesOfFreedom = 0;
  output.userData.role = 'near-vertical-piston-crosshead-carried-by-point-S';
  const crossheadShape = new THREE.Shape();
  crossheadShape.moveTo(-0.50 * sourceScale, -0.75 * sourceScale);
  crossheadShape.lineTo(0.50 * sourceScale, -0.75 * sourceScale);
  crossheadShape.lineTo(0.50 * sourceScale, 0.65 * sourceScale);
  crossheadShape.absarc(0, 0.65 * sourceScale, 0.34 * sourceScale,
    0, Math.PI, false);
  crossheadShape.closePath();
  const crossheadHousing = new THREE.Mesh(
    centeredExtrusion(crossheadShape, 0.29, 0.008),
    outputMaterial,
  );
  crossheadHousing.position.z = 0.59;
  crossheadHousing.userData.role = 'orange-piston-crosshead-housing-at-S';
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.32 * sourceScale, 8.0 * sourceScale, 0.18),
    outputMaterial,
  );
  pistonRod.position.set(0, -4.35 * sourceScale, 0.55);
  pistonRod.userData.role = 'piston-rod-rigidly-suspended-from-S';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(4.45 * sourceScale, 0.60 * sourceScale, 0.55),
    outputMaterial,
  );
  pistonHead.position.set(0, -8.45 * sourceScale, 0.38);
  pistonHead.userData.role = 'wide-marine-engine-piston-head';
  const crossheadPinFace = cylinderAlongZ(0.22 * sourceScale, 0.035,
    whiteMaterial, 30);
  crossheadPinFace.position.z = 0.755;
  crossheadPinFace.userData.role = 'white-working-pin-face-at-S';
  const crossheadPinOutline = new THREE.Mesh(
    new THREE.TorusGeometry(0.24 * sourceScale, 0.028, 8, 30),
    darkMaterial,
  );
  crossheadPinOutline.position.z = 0.752;
  crossheadPinOutline.userData.role = 'working-pin-bore-outline-at-S';
  const crossheadAnchor = new THREE.Object3D();
  crossheadAnchor.position.z = 0.59;
  crossheadAnchor.userData.role = 'analytic-crosshead-point-S';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, -8.45 * sourceScale, 0.38);
  pistonHeadAnchor.userData.role = 'analytic-marine-piston-center';
  output.add(
    crossheadHousing,
    pistonRod,
    pistonHead,
    crossheadPinFace,
    crossheadPinOutline,
    crossheadAnchor,
    pistonHeadAnchor,
  );
  root.add(output);

  const jointPins = {
    M: cylinderAlongZ(0.22 * sourceScale, 0.56, whiteMaterial, 30),
    N: cylinderAlongZ(0.22 * sourceScale, 0.47, whiteMaterial, 30),
    Q: cylinderAlongZ(0.24 * sourceScale, 0.84, whiteMaterial, 30),
    R: cylinderAlongZ(0.24 * sourceScale, 0.56, whiteMaterial, 30),
    S: cylinderAlongZ(0.24 * sourceScale, 0.43, whiteMaterial, 30),
  };
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
    root.add(pin);
  });

  const contacts = {
    crossbarAtN: {
      members: [sideRodParts.rod, crossbarParts.rod],
      point: new THREE.Vector3(),
      type: 'common-parallelogram-pin-N',
    },
    crossheadAtS: {
      members: [sideRodParts.rod, output],
      point: new THREE.Vector3(),
      type: 'piston-crosshead-pin-S',
    },
    parallelRodAtM: {
      members: [sideLever, parallelRodParts.rod],
      point: new THREE.Vector3(),
      type: 'side-lever-to-parallel-rod-pin-M',
    },
    radiusAndCrossbarAtQ: {
      members: [parallelRodParts.rod, crossbarParts.rod,
        radiusArmParts.rod],
      point: new THREE.Vector3(),
      type: 'common-parallel-rod-crossbar-radius-arm-pin-Q',
    },
    rockshaftPivotF: {
      fixedMember: rockshaft,
      movingMember: radiusArmParts.rod,
      point: new THREE.Vector3(
        rockshaftPivotF.x,
        rockshaftPivotF.y,
        0.94,
      ),
      type: 'fixed-revolute-pair-on-transverse-rockshaft-F',
    },
    sideLeverPivotO: {
      fixedMember: fixedFrame,
      movingMember: sideLever,
      point: new THREE.Vector3(0, 0, 0.04),
      type: 'fixed-revolute-pair-O',
    },
    sideRodAtR: {
      members: [sideLever, sideRodParts.rod],
      point: new THREE.Vector3(),
      type: 'side-lever-to-side-rod-pin-R',
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
    sideLever.rotation.z = state.beam.angle;
    sideLever.userData.angularSpeed = state.beam.angularVelocity;
    sideLever.userData.angularAcceleration = state.beam.angularAcceleration;
    setRodPose(parallelRodParts.rod, state.beamMidPoint,
      state.parallelRod);
    setRodPose(sideRodParts.rod, state.beamRightPoint, state.sideRod);
    setRodPose(crossbarParts.rod, state.pointQ, state.crossbar);
    setRodPose(radiusArmParts.rod, rockshaftPivotF, state.radiusArm);
    output.position.set(state.pointS.x, state.pointS.y, 0);
    output.userData.velocity = new THREE.Vector3(
      state.pointSVelocity.x,
      state.pointSVelocity.y,
      0,
    );
    output.userData.acceleration = new THREE.Vector3(
      state.pointSAcceleration.x,
      state.pointSAcceleration.y,
      0,
    );

    jointPins.M.position.set(state.beamMidPoint.x,
      state.beamMidPoint.y, 0.25);
    jointPins.R.position.set(state.beamRightPoint.x,
      state.beamRightPoint.y, 0.25);
    jointPins.Q.position.set(state.pointQ.x, state.pointQ.y, 0.62);
    jointPins.N.position.set(state.pointN.x, state.pointN.y, 0.54);
    jointPins.S.position.set(state.pointS.x, state.pointS.y, 0.57);
    contacts.parallelRodAtM.point.set(state.beamMidPoint.x,
      state.beamMidPoint.y, 0.35);
    contacts.sideRodAtR.point.set(state.beamRightPoint.x,
      state.beamRightPoint.y, 0.37);
    contacts.radiusAndCrossbarAtQ.point.set(state.pointQ.x,
      state.pointQ.y, 0.67);
    contacts.crossbarAtN.point.set(state.pointN.x, state.pointN.y, 0.56);
    contacts.crossheadAtS.point.set(state.pointS.x, state.pointS.y, 0.57);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-3.310402, -3.896792);
  const officialViewWidth = 18;
  const officialViewHeight = 18;
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
    'side-lever-marine-engine-parallelogram-and-rockshaft-radius-arm';
  root.userData.blocks = {
    beamMidAnchor,
    beamNegativeAnchor,
    beamRightAnchor,
    crossbar: crossbarParts.rod,
    crossbarEndAnchor: crossbarParts.endAnchor,
    crossbarStartAnchor: crossbarParts.startAnchor,
    crosshead: output,
    crossheadAnchor,
    crossheadHousing,
    deck,
    fixedFrame,
    framePosts,
    guideRails,
    jointPins,
    lowerBed,
    parallelRod: parallelRodParts.rod,
    parallelRodEndAnchor: parallelRodParts.endAnchor,
    parallelRodStartAnchor: parallelRodParts.startAnchor,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
    radiusArm: radiusArmParts.rod,
    radiusArmEndAnchor: radiusArmParts.endAnchor,
    radiusArmStartAnchor: radiusArmParts.startAnchor,
    rockshaft,
    rockshaftBearings,
    rockshaftSupports,
    sideLever,
    sideLeverBody,
    sideLeverMidBoss,
    sideLeverPivotBoss,
    sideLeverRightBoss,
    sideRod: sideRodParts.rod,
    sideRodEndAnchor: sideRodParts.endAnchor,
    sideRodIntermediateAnchor,
    sideRodStartAnchor: sideRodParts.startAnchor,
  };
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.22, -1.38, -1.02),
    new THREE.Vector3(5.15, 4.98, 1.46),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input:
      'one hidden three-unit timing crank rocks the ten-unit marine side lever',
    mechanism: 1,
    output:
      'point S carries the piston on the near-vertical locus generated by the rigid rockshaft-controlled parallelogram',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -1.41;
  root.userData.mechanism =
    'closed-rigid-side-lever-marine-parallel-motion-with-parallel-rods-M-Q-and-R-S-parallelogram-crossbar-Q-N-and-short-rockshaft-arm-F-Q';
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
      'add_c_rod',
      'add_tx',
      'add_c_rod_r',
      'add_rot_to',
      'add_rot_to',
    ],
    officialGeometry: {
      beamPivotO: sourceBeamPivotO,
      crossbarLength: sourceCrossbarLength,
      hiddenCrankCenter: sourceHiddenCrankCenter,
      hiddenCrankRadius: sourceHiddenCrankRadius,
      hiddenDriveRodLength: sourceHiddenDriveRodLength,
      hiddenDrivenBeamRadius: sourceHiddenDrivenBeamRadius,
      inputPhaseOffsetTurns: 0.25,
      parallelRodLength: sourceParallelRodLength,
      radiusArmLength: sourceRadiusArmLength,
      rockshaftPivotF: sourceRockshaftPivotF,
      sideLeverMidRadius: sourceSideLeverMidRadius,
      sideLeverRightRadius: sourceSideLeverRightRadius,
      sideRodIntermediateDistance: sourceSideRodIntermediateDistance,
      sideRodLength: sourceSideRodLength,
      strokeLine: [
        new THREE.Vector2(10, 9.5),
        new THREE.Vector2(10, 14.5),
      ],
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the official canvas forces piston pin S onto x=10 and lets the drawn F-Q arm vary by about 0.00925 source unit; this model keeps every bar rigid and exposes the genuine roughly 0.0123-unit lateral deviation of S',
    referenceScope:
      'official hidden timing crank, side-lever stations M and R, both parallel-rod lengths, intermediate point N, Q-N crossbar, fixed F rockshaft arm, source branch choices, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate336: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'side lever O-R carries parallel rods M-Q and R-S; M-R-N-Q is the completed parallelogram and the short F-Q arm rocks on a transverse fixed shaft',
      measurementUncertaintyPixels: 4,
      sideElevationOfPairedMarineGear: true,
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
      '|O-R|=10, |O-M|=3, |R-S|=10 with |R-N|=8.5, |M-Q|=8.5, |Q-N|=7, and |F-Q|=1.757556 source units',
    input:
      'the official hidden three-unit crank and ten-unit rod rock the opposed ten-unit station of side lever O-R',
    parallelogram:
      'M-R-N-Q is exact: both upright rods remain parallel and Q-N remains parallel to the seven-unit M-R segment',
    rockshaft:
      'short fixed-radius arm F-Q rocks the transverse shaft carried in two fixed bearings',
    straightness:
      'the rockshaft correction makes extrapolated piston point S nearly vertical; its small lateral deviation is measured rather than forced away',
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.1, 3.7, 13.6),
    root,
    update,
  };
}

function sideLeverMarineParallelMotion(movement) {
  const root = new THREE.Group();

  // Exact source dimensions from the official canvas construction. The
  // visible linkage is solved as a fully closed rigid mechanism; unlike the
  // canvas's line-constrained drawing approximation, no pin is stretched to
  // force E onto x=8. The resulting lateral deviation is measured below.
  const sourceScale = 0.32;
  const sourceSideLeverRadius = 8;
  const sourceSideLeverMidRadius = 4;
  const sourceLeftLinkLength = 8;
  const sourceLeftLinkPointCDistance = 6;
  const sourceRightLinkLength = 8;
  const sourceParallelBarLength = 4;
  const sourceRadiusBarLength = 7.695702;
  const sourceRadiusPivotF = new THREE.Vector2(11.695702, 6);
  const sourceHiddenCrankCenter = new THREE.Vector2(-8, -12);
  const sourceHiddenCrankRadius = 2.75;
  const sourceHiddenDriveRodLength = 12;
  const sourceHiddenDrivenBeamRadius = 8;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const sideLeverRadius = sourceSideLeverRadius * sourceScale;
  const sideLeverMidRadius = sourceSideLeverMidRadius * sourceScale;
  const leftLinkLength = sourceLeftLinkLength * sourceScale;
  const leftLinkPointCDistance = sourceLeftLinkPointCDistance * sourceScale;
  const rightLinkLength = sourceRightLinkLength * sourceScale;
  const parallelBarLength = sourceParallelBarLength * sourceScale;
  const radiusBarLength = sourceRadiusBarLength * sourceScale;
  const radiusPivotF = sourceRadiusPivotF.clone().multiplyScalar(sourceScale);
  const hiddenCrankCenter = sourceHiddenCrankCenter.clone()
    .multiplyScalar(sourceScale);
  const hiddenCrankRadius = sourceHiddenCrankRadius * sourceScale;
  const hiddenDriveRodLength = sourceHiddenDriveRodLength * sourceScale;
  const hiddenDrivenBeamRadius = sourceHiddenDrivenBeamRadius * sourceScale;
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
    const inputCrankPin = new THREE.Vector2(
      hiddenCrankCenter.x + hiddenCrankRadius * cosine,
      hiddenCrankCenter.y + hiddenCrankRadius * sine,
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
        inputCrankPin,
        hiddenDriveRodLength,
        zero,
        hiddenDrivenBeamRadius,
      ),
      new THREE.Vector2(-hiddenDrivenBeamRadius, 0),
    );
    const beamNegativeRates = constrainedPointRates({
      accelerationA: inputCrankPinAcceleration,
      accelerationB: zero,
      centerA: inputCrankPin,
      centerB: zero,
      point: beamNegativePoint,
      velocityA: inputCrankPinVelocity,
      velocityB: zero,
    });
    const beamMidPoint = beamNegativePoint.clone().multiplyScalar(-0.5);
    const beamMidVelocity = beamNegativeRates.velocity.clone()
      .multiplyScalar(-0.5);
    const beamMidAcceleration = beamNegativeRates.acceleration.clone()
      .multiplyScalar(-0.5);
    const beamRightPoint = beamNegativePoint.clone().multiplyScalar(-1);
    const beamRightVelocity = beamNegativeRates.velocity.clone()
      .multiplyScalar(-1);
    const beamRightAcceleration = beamNegativeRates.acceleration.clone()
      .multiplyScalar(-1);
    const beamRates = rigidLinkRates(
      beamRightPoint,
      beamRightVelocity,
      beamRightAcceleration,
    );

    const pointC = nearestPoint(
      circleCircleIntersections(
        beamMidPoint,
        leftLinkPointCDistance,
        radiusPivotF,
        radiusBarLength,
      ),
      new THREE.Vector2(4 * sourceScale, 6 * sourceScale),
    );
    const pointCRates = constrainedPointRates({
      accelerationA: beamMidAcceleration,
      accelerationB: zero,
      centerA: beamMidPoint,
      centerB: radiusPivotF,
      point: pointC,
      velocityA: beamMidVelocity,
      velocityB: zero,
    });
    const leftLinkScale = leftLinkLength / leftLinkPointCDistance;
    const pointD = beamMidPoint.clone().addScaledVector(
      pointC.clone().sub(beamMidPoint),
      leftLinkScale,
    );
    const pointDVelocity = beamMidVelocity.clone().addScaledVector(
      pointCRates.velocity.clone().sub(beamMidVelocity),
      leftLinkScale,
    );
    const pointDAcceleration = beamMidAcceleration.clone().addScaledVector(
      pointCRates.acceleration.clone().sub(beamMidAcceleration),
      leftLinkScale,
    );

    const pointE = nearestPoint(
      circleCircleIntersections(
        pointD,
        parallelBarLength,
        beamRightPoint,
        rightLinkLength,
      ),
      new THREE.Vector2(8 * sourceScale, 8 * sourceScale),
    );
    const pointERates = constrainedPointRates({
      accelerationA: pointDAcceleration,
      accelerationB: beamRightAcceleration,
      centerA: pointD,
      centerB: beamRightPoint,
      point: pointE,
      velocityA: pointDVelocity,
      velocityB: beamRightVelocity,
    });

    const leftVector = pointD.clone().sub(beamMidPoint);
    const leftVelocity = pointDVelocity.clone().sub(beamMidVelocity);
    const leftAcceleration = pointDAcceleration.clone()
      .sub(beamMidAcceleration);
    const rightVector = pointE.clone().sub(beamRightPoint);
    const rightVelocity = pointERates.velocity.clone()
      .sub(beamRightVelocity);
    const rightAcceleration = pointERates.acceleration.clone()
      .sub(beamRightAcceleration);
    const parallelVector = pointD.clone().sub(pointE);
    const parallelVelocity = pointDVelocity.clone()
      .sub(pointERates.velocity);
    const parallelAcceleration = pointDAcceleration.clone()
      .sub(pointERates.acceleration);
    const radiusVector = pointC.clone().sub(radiusPivotF);
    const radiusVelocity = pointCRates.velocity.clone();
    const radiusAcceleration = pointCRates.acceleration.clone();

    // Recreate the source canvas's deliberate drawing approximation for
    // comparison: E is forced to x=8, then D/C are solved from that line.
    const forcedCrossheadX = 8 * sourceScale;
    const forcedVerticalRadicand = rightLinkLength ** 2
      - (forcedCrossheadX - beamRightPoint.x) ** 2;
    const officialPointE = new THREE.Vector2(
      forcedCrossheadX,
      beamRightPoint.y + Math.sqrt(Math.max(0, forcedVerticalRadicand)),
    );
    const officialPointD = nearestPoint(
      circleCircleIntersections(
        beamMidPoint,
        leftLinkLength,
        officialPointE,
        parallelBarLength,
      ),
      officialPointE.clone().add(new THREE.Vector2(-parallelBarLength, 0)),
    );
    const officialPointC = beamMidPoint.clone().addScaledVector(
      officialPointD.clone().sub(beamMidPoint),
      leftLinkPointCDistance / leftLinkLength,
    );
    const officialRadiusBarResidual = officialPointC.distanceTo(radiusPivotF)
      - radiusBarLength;

    return {
      beamAngle: beamRates.angle,
      beamAngularAcceleration: beamRates.angularAcceleration,
      beamAngularVelocity: beamRates.angularVelocity,
      beamMidAcceleration,
      beamMidPoint,
      beamMidVelocity,
      beamNegativeAcceleration: beamNegativeRates.acceleration,
      beamNegativePoint,
      beamNegativeVelocity: beamNegativeRates.velocity,
      beamRightAcceleration,
      beamRightPoint,
      beamRightVelocity,
      crossheadEAcceleration: pointERates.acceleration,
      crossheadELateralDeviation: pointE.x - forcedCrossheadX,
      crossheadEVelocity: pointERates.velocity,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      inputCrankPin,
      inputCrankPinAcceleration,
      inputCrankPinVelocity,
      leftLink: rigidLinkRates(leftVector, leftVelocity, leftAcceleration),
      officialCanvasApproximation: {
        pointC: officialPointC,
        pointD: officialPointD,
        pointE: officialPointE,
        radiusBarResidual: officialRadiusBarResidual,
      },
      parallelBar: rigidLinkRates(
        parallelVector,
        parallelVelocity,
        parallelAcceleration,
      ),
      pointC,
      pointCAcceleration: pointCRates.acceleration,
      pointCVelocity: pointCRates.velocity,
      pointD,
      pointDAcceleration,
      pointDVelocity,
      pointE,
      radiusBar: rigidLinkRates(
        radiusVector,
        radiusVelocity,
        radiusAcceleration,
      ),
      rightLink: rigidLinkRates(rightVector, rightVelocity, rightAcceleration),
      unwrappedInputAngle,
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
    sourcePhase0: 0,
    lowerStroke: cyclePeriod / 4,
    sourcePhaseHalf: cyclePeriod / 2,
    upperStroke: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  let maximumLateralDeviation = 0;
  let maximumOfficialRadiusResidual = 0;
  let minimumCrossheadY = Infinity;
  let maximumCrossheadY = -Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(cyclePeriod * sample / 16384);
    maximumLateralDeviation = Math.max(
      maximumLateralDeviation,
      Math.abs(state.crossheadELateralDeviation),
    );
    maximumOfficialRadiusResidual = Math.max(
      maximumOfficialRadiusResidual,
      Math.abs(state.officialCanvasApproximation.radiusBarResidual),
    );
    minimumCrossheadY = Math.min(minimumCrossheadY, state.pointE.y);
    maximumCrossheadY = Math.max(maximumCrossheadY, state.pointE.y);
  }

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const blueMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const greenMaterial = matte(0x4d8963, {
    metalness: 0.08,
    roughness: 0.63,
  });
  const redMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const outputMaterial = matte(0xd78332, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const frameCenterZ = -0.34;
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-side-lever-marine-engine-frame-and-radius-pivot-F';

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(7 * sourceScale, 0.50 * sourceScale, 0.66),
    frameMaterial,
  );
  deck.position.set(8 * sourceScale, 3.75 * sourceScale, frameCenterZ);
  deck.userData.fixed = true;
  deck.userData.role = 'official-4.5-to-11.5-engine-deck';
  const deckTop = new THREE.Mesh(
    new THREE.BoxGeometry(7 * sourceScale, 0.12 * sourceScale, 0.72),
    darkMaterial,
  );
  deckTop.position.set(8 * sourceScale, 4 * sourceScale, frameCenterZ + 0.02);
  deckTop.userData.fixed = true;
  deckTop.userData.role = 'engine-deck-working-top-line';

  const framePosts = [5.5, 5.75, 10.25, 10.5].map((sourceX, index) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.13 * sourceScale, 10 * sourceScale, 0.34),
      index === 0 || index === 3 ? frameMaterial : darkMaterial,
    );
    post.position.set(
      sourceX * sourceScale,
      -1.5 * sourceScale,
      frameCenterZ,
    );
    post.userData.fixed = true;
    post.userData.role = `engine-frame-upright-${index + 1}`;
    return post;
  });

  const radiusSupportFoot = new THREE.Vector3(
    10.45 * sourceScale,
    4 * sourceScale,
    frameCenterZ,
  );
  const radiusSupportTop = new THREE.Vector3(
    radiusPivotF.x,
    radiusPivotF.y,
    frameCenterZ,
  );
  const radiusSupport = beamBetween3D(
    radiusSupportFoot,
    radiusSupportTop,
    0.38 * sourceScale,
    0.42,
    frameMaterial,
  );
  radiusSupport.userData.fixed = true;
  radiusSupport.userData.role = 'curved-source-support-approximated-by-rigid-F-pedestal';
  const fixedPivotF = cylinderAlongZ(0.50 * sourceScale, 0.56,
    frameMaterial, 40);
  fixedPivotF.position.set(radiusPivotF.x, radiusPivotF.y, frameCenterZ + 0.08);
  fixedPivotF.userData.fixed = true;
  fixedPivotF.userData.role = 'fixed-radius-bar-pivot-F';
  const fixedPivotFBore = cylinderAlongZ(0.25 * sourceScale, 0.59,
    darkMaterial, 34);
  fixedPivotFBore.position.set(radiusPivotF.x, radiusPivotF.y,
    frameCenterZ + 0.085);
  fixedPivotFBore.userData.fixed = true;
  fixedPivotFBore.userData.role = 'fixed-bearing-bore-at-F';

  const pivotABase = new THREE.Mesh(
    new THREE.BoxGeometry(2.70 * sourceScale, 0.55 * sourceScale, 0.88),
    frameMaterial,
  );
  pivotABase.position.set(0, -1.05 * sourceScale, -0.20);
  pivotABase.userData.fixed = true;
  pivotABase.userData.role = 'fixed-side-lever-pivot-A-bedplate';
  fixedFrame.add(
    deck,
    deckTop,
    ...framePosts,
    radiusSupport,
    fixedPivotF,
    fixedPivotFBore,
    pivotABase,
  );
  root.add(fixedFrame);

  const sideLeverParts = makeSideLever({
    darkMaterial,
    drivenMaterial: blueMaterial,
    length: sideLeverRadius,
    midDistance: sideLeverMidRadius,
    planeZ: 0.02,
    scale: sourceScale,
    whiteMaterial,
  });
  root.add(sideLeverParts.lever);

  const leftLinkParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: leftLinkLength,
    planeZ: 0.36,
    role: 'left-eight-unit-parallel-motion-link-through-C',
    width: 0.34 * sourceScale,
  });
  const pointCBoss = cylinderAlongZ(0.28 * sourceScale, 0.22,
    greenMaterial, 34);
  pointCBoss.position.set(leftLinkPointCDistance, 0, 0.36);
  pointCBoss.userData.role = 'point-C-six-units-up-left-link';
  const pointCAnchor = new THREE.Object3D();
  pointCAnchor.position.set(leftLinkPointCDistance, 0, 0.36);
  pointCAnchor.userData.role = 'analytic-point-C-on-left-link';
  leftLinkParts.rod.add(pointCBoss, pointCAnchor);
  root.add(leftLinkParts.rod);

  const rightLinkParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: rightLinkLength,
    planeZ: 0.39,
    role: 'right-eight-unit-link-to-crosshead-E',
    width: 0.34 * sourceScale,
  });
  root.add(rightLinkParts.rod);

  const parallelBarParts = makeRigidRod({
    bodyMaterial: blueMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: parallelBarLength,
    planeZ: 0.66,
    role: 'four-unit-parallel-bar-E-D',
    width: 0.34 * sourceScale,
  });
  root.add(parallelBarParts.rod);

  const radiusBarParts = makeRigidRod({
    bodyMaterial: redMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: radiusBarLength,
    planeZ: 0.91,
    role: 'fixed-length-radius-bar-F-C',
    width: 0.34 * sourceScale,
  });
  root.add(radiusBarParts.rod);

  const outputParts = makeOutputCrosshead({
    darkMaterial,
    outputMaterial,
    planeZ: 0.73,
    scale: sourceScale,
    whiteMaterial,
  });
  root.add(outputParts.output);

  const jointPins = {
    beamMid: cylinderAlongZ(0.22 * sourceScale, 0.62,
      whiteMaterial, 32),
    beamRight: cylinderAlongZ(0.24 * sourceScale, 0.64,
      whiteMaterial, 32),
    pointC: cylinderAlongZ(0.22 * sourceScale, 0.76,
      whiteMaterial, 32),
    pointD: cylinderAlongZ(0.22 * sourceScale, 0.40,
      whiteMaterial, 32),
    pointE: cylinderAlongZ(0.24 * sourceScale, 0.44,
      whiteMaterial, 32),
  };
  jointPins.beamMid.userData.role = 'common-pin-side-lever-to-left-link';
  jointPins.beamRight.userData.role = 'common-pin-side-lever-to-right-link';
  jointPins.pointC.userData.role = 'common-pin-left-link-to-radius-bar-at-C';
  jointPins.pointD.userData.role = 'common-pin-left-link-to-parallel-bar-at-D';
  jointPins.pointE.userData.role =
    'common-pin-right-link-parallel-bar-and-crosshead-E';
  root.add(...Object.values(jointPins));

  const contacts = {
    beamPivotA: {
      fixedMember: fixedFrame,
      movingMember: sideLeverParts.lever,
      point: new THREE.Vector3(0, 0, 0.02),
      type: 'fixed-revolute-pair',
    },
    beamMidToLeftLink: {
      memberA: sideLeverParts.lever,
      memberB: leftLinkParts.rod,
      point: new THREE.Vector3(),
      type: 'revolute-pin',
    },
    beamRightToRightLink: {
      memberA: sideLeverParts.lever,
      memberB: rightLinkParts.rod,
      point: new THREE.Vector3(),
      type: 'revolute-pin',
    },
    leftLinkToParallelBarD: {
      memberA: leftLinkParts.rod,
      memberB: parallelBarParts.rod,
      point: new THREE.Vector3(),
      type: 'revolute-pin-D',
    },
    linksToCrossheadE: {
      members: [rightLinkParts.rod, parallelBarParts.rod, outputParts.output],
      point: new THREE.Vector3(),
      type: 'common-revolute-pin-E',
    },
    radiusBarAtC: {
      memberA: leftLinkParts.rod,
      memberB: radiusBarParts.rod,
      point: new THREE.Vector3(),
      type: 'revolute-pin-C-at-three-quarter-point',
    },
    radiusBarPivotF: {
      fixedMember: fixedPivotF,
      movingMember: radiusBarParts.rod,
      point: new THREE.Vector3(radiusPivotF.x, radiusPivotF.y, 0.91),
      type: 'fixed-revolute-pair-F',
    },
  };

  const setRodPose = (rod, start, rates) => {
    rod.position.set(start.x, start.y, 0);
    rod.rotation.z = rates.angle;
  };
  const update = (time) => {
    const state = stateAtTime(time);
    sideLeverParts.lever.rotation.z = state.beamAngle;
    setRodPose(leftLinkParts.rod, state.beamMidPoint, state.leftLink);
    setRodPose(rightLinkParts.rod, state.beamRightPoint, state.rightLink);
    setRodPose(parallelBarParts.rod, state.pointE, state.parallelBar);
    setRodPose(radiusBarParts.rod, radiusPivotF, state.radiusBar);
    outputParts.output.position.set(state.pointE.x, state.pointE.y, 0);

    jointPins.beamMid.position.set(state.beamMidPoint.x,
      state.beamMidPoint.y, 0.25);
    jointPins.beamRight.position.set(state.beamRightPoint.x,
      state.beamRightPoint.y, 0.26);
    jointPins.pointC.position.set(state.pointC.x, state.pointC.y, 0.62);
    jointPins.pointD.position.set(state.pointD.x, state.pointD.y, 0.52);
    jointPins.pointE.position.set(state.pointE.x, state.pointE.y, 0.61);
    contacts.beamMidToLeftLink.point.set(state.beamMidPoint.x,
      state.beamMidPoint.y, 0.36);
    contacts.beamRightToRightLink.point.set(state.beamRightPoint.x,
      state.beamRightPoint.y, 0.39);
    contacts.leftLinkToParallelBarD.point.set(state.pointD.x,
      state.pointD.y, 0.56);
    contacts.linksToCrossheadE.point.set(state.pointE.x,
      state.pointE.y, 0.61);
    contacts.radiusBarAtC.point.set(state.pointC.x,
      state.pointC.y, 0.66);
    root.userData.kinematics = state;
  };

  const geometry = {
    cyclePeriod,
    hiddenCrankCenter,
    hiddenCrankRadius,
    hiddenDriveRodLength,
    hiddenDrivenBeamRadius,
    inputAngularSpeed,
    leftLinkLength,
    leftLinkPointCDistance,
    maximumCrossheadY,
    maximumLateralDeviation,
    maximumOfficialRadiusResidual,
    minimumCrossheadY,
    outputStroke: maximumCrossheadY - minimumCrossheadY,
    parallelBarLength,
    radiusBarLength,
    radiusPivotF,
    rightLinkLength,
    sideLeverMidRadius,
    sideLeverRadius,
    sourceScale,
  };

  const officialViewMinimum = new THREE.Vector2(-2.354441, -2.9477);
  const officialViewWidth = 15;
  const officialViewHeight = 15;
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
    'side-lever-marine-engine-radius-bar-FC-parallel-bar-ED';
  root.userData.blocks = {
    crossheadE: outputParts.output,
    crossheadEAnchor: outputParts.anchor,
    crossheadEHousing: outputParts.housing,
    deck,
    fixedFrame,
    fixedPivotF,
    fixedPivotFBore,
    framePosts,
    jointPins,
    leftLink: leftLinkParts.rod,
    leftLinkEndAnchor: leftLinkParts.endAnchor,
    leftLinkStartAnchor: leftLinkParts.startAnchor,
    lowerPistonAnchor: outputParts.pistonAnchor,
    parallelBarED: parallelBarParts.rod,
    parallelBarEndAnchor: parallelBarParts.endAnchor,
    parallelBarStartAnchor: parallelBarParts.startAnchor,
    pistonHead: outputParts.pistonHead,
    pistonRod: outputParts.pistonRod,
    pointCAnchor,
    radiusBarFC: radiusBarParts.rod,
    radiusBarEndAnchor: radiusBarParts.endAnchor,
    radiusBarStartAnchor: radiusBarParts.startAnchor,
    rightLink: rightLinkParts.rod,
    rightLinkEndAnchor: rightLinkParts.endAnchor,
    rightLinkStartAnchor: rightLinkParts.startAnchor,
    sideLever: sideLeverParts.lever,
    sideLeverHiddenInputAnchor: sideLeverParts.hiddenInputAnchor,
    sideLeverMidAnchor: sideLeverParts.midAnchor,
    sideLeverPivotA: sideLeverParts.pivotA,
    sideLeverRightAnchor: sideLeverParts.rightAnchor,
  };
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-0.63, -2.18, -0.78),
    new THREE.Vector3(4.22, 3.72, 1.18),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one prescribed rocking side-lever angle from the source timing crank',
    mechanism: 1,
    output:
      'crosshead E follows the near-vertical coupler curve of the closed six-bar linkage',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -2.20;
  root.userData.mechanism =
    'closed-rigid-side-lever-marine-parallel-motion-with-radius-bar-F-C-crosshead-E-and-parallel-bar-E-D';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_rot',
      'add_c_rod_r',
      'add_rot_to',
      'add_c_rod',
      'add_tx',
      'add_c_rod_r',
      'add_rot_to',
      'add_rot_to',
    ],
    officialGeometry: {
      hiddenCrankCenter: sourceHiddenCrankCenter,
      hiddenCrankRadius: sourceHiddenCrankRadius,
      hiddenDriveRodLength: sourceHiddenDriveRodLength,
      leftLinkLength: sourceLeftLinkLength,
      leftLinkPointCDistance: sourceLeftLinkPointCDistance,
      parallelBarLength: sourceParallelBarLength,
      radiusBarLength: sourceRadiusBarLength,
      radiusPivotF: sourceRadiusPivotF,
      rightLinkLength: sourceRightLinkLength,
      sideLeverMidRadius: sourceSideLeverMidRadius,
      sideLeverRadius: sourceSideLeverRadius,
      verticalStrokeLineX: 8,
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the official drawing forces E onto x=8 and incurs a small rounded-dimension F-C residual; this model closes every rigid bar exactly and exposes the resulting sub-0.006-unit lateral deviation of E',
    referenceScope:
      'official pivot coordinates, all bar lengths and intermediate point C, source branch choices, frame landmarks, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate332: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'side lever A, paired eight-unit links, radius bar F-C, parallel bar E-D, and piston crosshead E',
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
      '|A-B4|=4, |A-B8|=8, |B4-D|=8, |B4-C|=6, |F-C|=7.695702, |D-E|=4, |B8-E|=8 source units',
    input:
      'the side lever rocks on A with the official hidden 2.75-unit crank and 12-unit timing-rod law',
    output:
      'crosshead E carries the piston on a near-vertical 5.5-unit stroke',
    straightness:
      'radius bar F-C makes E an approximate straight-line point; lateral deviation is measured, not suppressed',
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.0, 3.6, 13.2),
    root,
    update,
  };
}

function makeExplanatoryPiston({
  darkMaterial,
  outputMaterial,
  planeZ,
  rolePrefix,
  scale,
  whiteMaterial,
}) {
  const output = new THREE.Group();
  output.userData.rotationDegreesOfFreedom = 0;
  output.userData.role =
    `${rolePrefix}-explanatory-piston-added-by-source-animation`;
  const jointBoss = cylinderAlongZ(0.30 * scale, 0.19,
    outputMaterial, 34);
  jointBoss.position.z = planeZ;
  jointBoss.userData.role = `${rolePrefix}-piston-link-joint-boss`;
  const jointFace = cylinderAlongZ(0.16 * scale, 0.025,
    whiteMaterial, 28);
  jointFace.position.z = planeZ + 0.108;
  jointFace.userData.role = `${rolePrefix}-piston-joint-index`;
  const rod = new THREE.Mesh(
    new THREE.BoxGeometry(0.375 * scale, 7.46 * scale, 0.13),
    outputMaterial,
  );
  rod.position.set(0, -3.895 * scale, planeZ - 0.01);
  rod.userData.role = `${rolePrefix}-straight-piston-rod`;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(2 * scale, 0.375 * scale, 0.42),
    outputMaterial,
  );
  head.position.set(0, -7.8125 * scale, planeZ - 0.08);
  head.userData.role = `${rolePrefix}-piston-head`;
  const bore = new THREE.Mesh(
    new THREE.TorusGeometry(0.18 * scale, 0.026, 8, 28),
    darkMaterial,
  );
  bore.position.z = planeZ + 0.105;
  bore.userData.role = `${rolePrefix}-joint-bore-outline`;
  const jointAnchor = new THREE.Object3D();
  jointAnchor.position.z = planeZ;
  jointAnchor.userData.role = `${rolePrefix}-analytic-output-point`;
  const pistonAnchor = new THREE.Object3D();
  pistonAnchor.position.set(0, -7.8125 * scale, planeZ);
  pistonAnchor.userData.role = `${rolePrefix}-analytic-piston-center`;
  output.add(jointBoss, jointFace, rod, head, bore,
    jointAnchor, pistonAnchor);
  return {
    head,
    jointAnchor,
    jointBoss,
    output,
    pistonAnchor,
    rod,
  };
}

function doubleParallelMotion(movement) {
  const root = new THREE.Group();

  // The plate contains two coupled parallel-motion cells. The official canvas
  // adds two orange piston rods for explanation and drives the left endpoint
  // on x=0. Its rounded constants leave the O-M radius bar short by at most
  // about 0.0011 source unit. Here M is kept exactly eight units from O and all
  // five visible bars close rigidly; the genuine near-straight P and N loci
  // are retained and measured instead of forcing either point onto a line.
  const sourceScale = 0.29;
  const sourceLeftPivotO = new THREE.Vector2(0, 0);
  const sourceRightPivotR = new THREE.Vector2(15.727407, -6);
  const sourceLongLinkLength = 16;
  const sourceLongLinkMidpointDistance = 8;
  const sourceLeftRadiusLength = 8;
  const sourceRightUpperRockerLength = 6.006189;
  const sourceCenterLinkLength = 6;
  const sourceCenterLinkMidpointDistance = 3;
  const sourceRightLowerRadiusLength = 8;
  const sourceAddedPistonHalfStroke = 4;
  const sourceNominalCenterOutputX = sourceRightPivotR.x / 2;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const leftPivotO = sourceLeftPivotO.clone().multiplyScalar(sourceScale);
  const rightPivotR = sourceRightPivotR.clone().multiplyScalar(sourceScale);
  const longLinkLength = sourceLongLinkLength * sourceScale;
  const longLinkMidpointDistance = sourceLongLinkMidpointDistance * sourceScale;
  const leftRadiusLength = sourceLeftRadiusLength * sourceScale;
  const rightUpperRockerLength = sourceRightUpperRockerLength * sourceScale;
  const centerLinkLength = sourceCenterLinkLength * sourceScale;
  const centerLinkMidpointDistance = sourceCenterLinkMidpointDistance
    * sourceScale;
  const rightLowerRadiusLength = sourceRightLowerRadiusLength * sourceScale;
  const addedPistonHalfStroke = sourceAddedPistonHalfStroke * sourceScale;
  const nominalCenterOutputX = sourceNominalCenterOutputX * sourceScale;
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
    const forcedPointP = new THREE.Vector2(
      0,
      -addedPistonHalfStroke * cosine,
    );
    const forcedPointPVelocity = new THREE.Vector2(
      0,
      addedPistonHalfStroke * sine * resolvedInputAngularSpeed,
    );
    const forcedPointPAcceleration = new THREE.Vector2(
      0,
      addedPistonHalfStroke * (
        cosine * resolvedInputAngularSpeed ** 2
          + sine * inputAngularAcceleration
      ),
    );

    const officialPointW = nearestPoint(
      circleCircleIntersections(
        forcedPointP,
        longLinkLength,
        rightPivotR,
        rightUpperRockerLength,
      ),
      rightPivotR.clone().add(new THREE.Vector2(0, rightUpperRockerLength)),
    );
    const officialPointWRates = constrainedPointRates({
      accelerationA: forcedPointPAcceleration,
      accelerationB: zero,
      centerA: forcedPointP,
      centerB: rightPivotR,
      point: officialPointW,
      velocityA: forcedPointPVelocity,
      velocityB: zero,
    });
    const officialPointM = forcedPointP.clone().add(officialPointW)
      .multiplyScalar(0.5);
    const officialPointMVelocity = forcedPointPVelocity.clone()
      .add(officialPointWRates.velocity).multiplyScalar(0.5);
    const officialPointMAcceleration = forcedPointPAcceleration.clone()
      .add(officialPointWRates.acceleration).multiplyScalar(0.5);
    const officialMiddleRates = rigidLinkRates(
      officialPointM,
      officialPointMVelocity,
      officialPointMAcceleration,
    );

    const pointM = new THREE.Vector2(
      leftRadiusLength * Math.cos(officialMiddleRates.angle),
      leftRadiusLength * Math.sin(officialMiddleRates.angle),
    );
    const pointMVelocity = new THREE.Vector2(
      -pointM.y * officialMiddleRates.angularVelocity,
      pointM.x * officialMiddleRates.angularVelocity,
    );
    const pointMAcceleration = new THREE.Vector2(
      -pointM.x * officialMiddleRates.angularVelocity ** 2
        - pointM.y * officialMiddleRates.angularAcceleration,
      -pointM.y * officialMiddleRates.angularVelocity ** 2
        + pointM.x * officialMiddleRates.angularAcceleration,
    );

    const pointW = nearestPoint(
      circleCircleIntersections(
        pointM,
        longLinkMidpointDistance,
        rightPivotR,
        rightUpperRockerLength,
      ),
      new THREE.Vector2(16 * sourceScale, 0),
    );
    const pointWRates = constrainedPointRates({
      accelerationA: pointMAcceleration,
      accelerationB: zero,
      centerA: pointM,
      centerB: rightPivotR,
      point: pointW,
      velocityA: pointMVelocity,
      velocityB: zero,
    });
    const pointP = pointM.clone().multiplyScalar(2).sub(pointW);
    const pointPVelocity = pointMVelocity.clone().multiplyScalar(2)
      .sub(pointWRates.velocity);
    const pointPAcceleration = pointMAcceleration.clone().multiplyScalar(2)
      .sub(pointWRates.acceleration);

    const pointQ = nearestPoint(
      circleCircleIntersections(
        pointM,
        centerLinkLength,
        rightPivotR,
        rightLowerRadiusLength,
      ),
      new THREE.Vector2(7.727409, -5.993805)
        .multiplyScalar(sourceScale),
    );
    const pointQRates = constrainedPointRates({
      accelerationA: pointMAcceleration,
      accelerationB: zero,
      centerA: pointM,
      centerB: rightPivotR,
      point: pointQ,
      velocityA: pointMVelocity,
      velocityB: zero,
    });
    const pointN = pointM.clone().add(pointQ).multiplyScalar(0.5);
    const pointNVelocity = pointMVelocity.clone()
      .add(pointQRates.velocity).multiplyScalar(0.5);
    const pointNAcceleration = pointMAcceleration.clone()
      .add(pointQRates.acceleration).multiplyScalar(0.5);

    const longVector = pointW.clone().sub(pointP);
    const longVelocity = pointWRates.velocity.clone().sub(pointPVelocity);
    const longAcceleration = pointWRates.acceleration.clone()
      .sub(pointPAcceleration);
    const centerVector = pointQ.clone().sub(pointM);
    const centerVelocity = pointQRates.velocity.clone().sub(pointMVelocity);
    const centerAcceleration = pointQRates.acceleration.clone()
      .sub(pointMAcceleration);
    const upperRockerVector = pointW.clone().sub(rightPivotR);
    const lowerRadiusVector = pointQ.clone().sub(rightPivotR);

    return {
      centerLink: rigidLinkRates(
        centerVector,
        centerVelocity,
        centerAcceleration,
      ),
      forcedPointP,
      forcedPointPAcceleration,
      forcedPointPVelocity,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      leftRadius: rigidLinkRates(
        pointM,
        pointMVelocity,
        pointMAcceleration,
      ),
      longLink: rigidLinkRates(longVector, longVelocity, longAcceleration),
      officialCanvasApproximation: {
        leftRadiusResidual: officialPointM.length() - leftRadiusLength,
        pointM: officialPointM,
        pointW: officialPointW,
      },
      pointM,
      pointMAcceleration,
      pointMVelocity,
      pointN,
      pointNAcceleration,
      pointNLateralDeviation: pointN.x - nominalCenterOutputX,
      pointNVelocity,
      pointP,
      pointPAcceleration,
      pointPLateralDeviation: pointP.x,
      pointPVerticalDifferenceFromCanvas: pointP.y - forcedPointP.y,
      pointPVelocity,
      pointQ,
      pointQAcceleration: pointQRates.acceleration,
      pointQVelocity: pointQRates.velocity,
      pointW,
      pointWAcceleration: pointWRates.acceleration,
      pointWVelocity: pointWRates.velocity,
      rightLowerRadius: rigidLinkRates(
        lowerRadiusVector,
        pointQRates.velocity,
        pointQRates.acceleration,
      ),
      rightUpperRocker: rigidLinkRates(
        upperRockerVector,
        pointWRates.velocity,
        pointWRates.acceleration,
      ),
      unwrappedInputAngle,
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
    leftPistonBottom: 0,
    sourceQuarter: cyclePeriod / 4,
    leftPistonTop: cyclePeriod / 2,
    sourceThreeQuarter: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  let maximumOfficialLeftRadiusResidual = 0;
  let maximumPointNLateralDeviation = 0;
  let maximumPointPLateralDeviation = 0;
  let maximumPointPVerticalDifference = 0;
  let minimumPointNY = Infinity;
  let maximumPointNY = -Infinity;
  let minimumPointPY = Infinity;
  let maximumPointPY = -Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(cyclePeriod * sample / 16384);
    maximumOfficialLeftRadiusResidual = Math.max(
      maximumOfficialLeftRadiusResidual,
      Math.abs(state.officialCanvasApproximation.leftRadiusResidual),
    );
    maximumPointNLateralDeviation = Math.max(
      maximumPointNLateralDeviation,
      Math.abs(state.pointNLateralDeviation),
    );
    maximumPointPLateralDeviation = Math.max(
      maximumPointPLateralDeviation,
      Math.abs(state.pointPLateralDeviation),
    );
    maximumPointPVerticalDifference = Math.max(
      maximumPointPVerticalDifference,
      Math.abs(state.pointPVerticalDifferenceFromCanvas),
    );
    minimumPointNY = Math.min(minimumPointNY, state.pointN.y);
    maximumPointNY = Math.max(maximumPointNY, state.pointN.y);
    minimumPointPY = Math.min(minimumPointPY, state.pointP.y);
    maximumPointPY = Math.max(maximumPointPY, state.pointP.y);
  }

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const blueMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const greenMaterial = matte(0x4d8963, {
    metalness: 0.08,
    roughness: 0.63,
  });
  const redMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const outputMaterial = matte(0xd78332, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'two-fixed-pedestals-O-and-R';
  const makePedestal = (point, name) => {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, 0);
    group.userData.fixed = true;
    group.userData.role = `fixed-${name}-pedestal`;
    const bearing = cylinderAlongZ(0.50 * sourceScale, 0.62,
      frameMaterial, 42);
    bearing.position.z = -0.20;
    bearing.userData.fixed = true;
    bearing.userData.role = `${name}-fixed-bearing-housing`;
    const bore = cylinderAlongZ(0.25 * sourceScale, 0.65,
      darkMaterial, 34);
    bore.position.z = -0.195;
    bore.userData.fixed = true;
    bore.userData.role = `${name}-fixed-bearing-bore`;
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.36 * sourceScale, 0.70 * sourceScale, 0.50),
      frameMaterial,
    );
    neck.position.set(0, -0.55 * sourceScale, -0.20);
    neck.userData.fixed = true;
    neck.userData.role = `${name}-pedestal-neck`;
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(3.35 * sourceScale, 0.45 * sourceScale, 0.75),
      frameMaterial,
    );
    foot.position.set(0, -1.00 * sourceScale, -0.20);
    foot.userData.fixed = true;
    foot.userData.role = `${name}-hatched-ground-foot`;
    group.add(bearing, bore, neck, foot);
    group.userData.bearing = bearing;
    group.userData.bore = bore;
    group.userData.foot = foot;
    return group;
  };
  const leftPedestalO = makePedestal(leftPivotO, 'left-pivot-O');
  const rightPedestalR = makePedestal(rightPivotR, 'right-pivot-R');
  fixedFrame.add(leftPedestalO, rightPedestalR);
  root.add(fixedFrame);

  const longLinkParts = makeRigidRod({
    bodyMaterial: blueMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: longLinkLength,
    planeZ: 0.10,
    role: 'sixteen-unit-long-ternary-link-P-M-W',
    width: 0.36 * sourceScale,
  });
  const pointMBoss = cylinderAlongZ(0.55 * sourceScale, 0.25,
    blueMaterial, 40);
  pointMBoss.position.set(longLinkMidpointDistance, 0, 0.10);
  pointMBoss.userData.role = 'large-midpoint-M-boss-on-long-link';
  const pointMAnchor = new THREE.Object3D();
  pointMAnchor.position.set(longLinkMidpointDistance, 0, 0.10);
  pointMAnchor.userData.role = 'analytic-midpoint-M-on-long-link';
  longLinkParts.rod.add(pointMBoss, pointMAnchor);
  root.add(longLinkParts.rod);

  const leftRadiusParts = makeRigidRod({
    bodyMaterial: redMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: leftRadiusLength,
    planeZ: 0.36,
    role: 'left-eight-unit-radius-bar-O-M',
    width: 0.32 * sourceScale,
  });
  root.add(leftRadiusParts.rod);

  const rightUpperParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: rightUpperRockerLength,
    planeZ: 0.58,
    role: 'right-upper-6.006189-unit-rocker-R-W',
    width: 0.32 * sourceScale,
  });
  root.add(rightUpperParts.rod);

  const centerLinkParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: centerLinkLength,
    planeZ: 0.77,
    role: 'six-unit-center-ternary-link-M-N-Q',
    width: 0.32 * sourceScale,
  });
  const pointNBoss = cylinderAlongZ(0.30 * sourceScale, 0.22,
    greenMaterial, 34);
  pointNBoss.position.set(centerLinkMidpointDistance, 0, 0.77);
  pointNBoss.userData.role = 'midpoint-N-boss-on-center-link';
  const pointNAnchor = new THREE.Object3D();
  pointNAnchor.position.set(centerLinkMidpointDistance, 0, 0.77);
  pointNAnchor.userData.role = 'analytic-midpoint-N-on-center-link';
  centerLinkParts.rod.add(pointNBoss, pointNAnchor);
  root.add(centerLinkParts.rod);

  const rightLowerParts = makeRigidRod({
    bodyMaterial: redMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: rightLowerRadiusLength,
    planeZ: 0.98,
    role: 'right-lower-eight-unit-radius-bar-R-Q',
    width: 0.32 * sourceScale,
  });
  root.add(rightLowerParts.rod);

  const leftPistonParts = makeExplanatoryPiston({
    darkMaterial,
    outputMaterial,
    planeZ: -0.10,
    rolePrefix: 'left-P',
    scale: sourceScale,
    whiteMaterial,
  });
  const centerPistonParts = makeExplanatoryPiston({
    darkMaterial,
    outputMaterial,
    planeZ: -0.07,
    rolePrefix: 'center-N',
    scale: sourceScale,
    whiteMaterial,
  });
  root.add(leftPistonParts.output, centerPistonParts.output);

  const jointPins = {
    M: cylinderAlongZ(0.27 * sourceScale, 0.92, whiteMaterial, 32),
    N: cylinderAlongZ(0.20 * sourceScale, 0.42, whiteMaterial, 30),
    P: cylinderAlongZ(0.20 * sourceScale, 0.34, whiteMaterial, 30),
    Q: cylinderAlongZ(0.23 * sourceScale, 0.44, whiteMaterial, 30),
    W: cylinderAlongZ(0.23 * sourceScale, 0.56, whiteMaterial, 30),
  };
  for (const [name, pin] of Object.entries(jointPins)) {
    pin.userData.role = `common-working-pin-${name}`;
  }
  root.add(...Object.values(jointPins));

  const contacts = {
    leftRadiusPivotO: {
      fixedMember: leftPedestalO,
      movingMember: leftRadiusParts.rod,
      point: new THREE.Vector3(leftPivotO.x, leftPivotO.y, 0.36),
      type: 'fixed-revolute-pair-O',
    },
    longLinkAtM: {
      members: [longLinkParts.rod, leftRadiusParts.rod,
        centerLinkParts.rod],
      point: new THREE.Vector3(),
      type: 'common-ternary-pin-M',
    },
    longLinkAtW: {
      members: [longLinkParts.rod, rightUpperParts.rod],
      point: new THREE.Vector3(),
      type: 'revolute-pin-W',
    },
    centerLinkAtQ: {
      members: [centerLinkParts.rod, rightLowerParts.rod],
      point: new THREE.Vector3(),
      type: 'revolute-pin-Q',
    },
    rightUpperPivotR: {
      fixedMember: rightPedestalR,
      movingMember: rightUpperParts.rod,
      point: new THREE.Vector3(rightPivotR.x, rightPivotR.y, 0.58),
      type: 'fixed-revolute-pair-R-upper',
    },
    rightLowerPivotR: {
      fixedMember: rightPedestalR,
      movingMember: rightLowerParts.rod,
      point: new THREE.Vector3(rightPivotR.x, rightPivotR.y, 0.98),
      type: 'fixed-revolute-pair-R-lower',
    },
  };

  const setRodPose = (rod, start, rates) => {
    rod.position.set(start.x, start.y, 0);
    rod.rotation.z = rates.angle;
  };
  const update = (time) => {
    const state = stateAtTime(time);
    setRodPose(longLinkParts.rod, state.pointP, state.longLink);
    setRodPose(leftRadiusParts.rod, leftPivotO, state.leftRadius);
    setRodPose(rightUpperParts.rod, rightPivotR,
      state.rightUpperRocker);
    setRodPose(centerLinkParts.rod, state.pointM, state.centerLink);
    setRodPose(rightLowerParts.rod, rightPivotR,
      state.rightLowerRadius);
    leftPistonParts.output.position.set(state.pointP.x, state.pointP.y, 0);
    centerPistonParts.output.position.set(state.pointN.x, state.pointN.y, 0);
    jointPins.P.position.set(state.pointP.x, state.pointP.y, 0.08);
    jointPins.M.position.set(state.pointM.x, state.pointM.y, 0.58);
    jointPins.W.position.set(state.pointW.x, state.pointW.y, 0.35);
    jointPins.N.position.set(state.pointN.x, state.pointN.y, 0.72);
    jointPins.Q.position.set(state.pointQ.x, state.pointQ.y, 0.88);
    contacts.longLinkAtM.point.set(state.pointM.x, state.pointM.y, 0.53);
    contacts.longLinkAtW.point.set(state.pointW.x, state.pointW.y, 0.34);
    contacts.centerLinkAtQ.point.set(state.pointQ.x, state.pointQ.y, 0.87);
    root.userData.kinematics = state;
  };

  const geometry = {
    addedPistonHalfStroke,
    centerLinkLength,
    centerLinkMidpointDistance,
    cyclePeriod,
    inputAngularSpeed,
    leftPivotO,
    leftRadiusLength,
    longLinkLength,
    longLinkMidpointDistance,
    maximumOfficialLeftRadiusResidual,
    maximumPointNLateralDeviation,
    maximumPointNY,
    maximumPointPLateralDeviation,
    maximumPointPY,
    maximumPointPVerticalDifference,
    minimumPointNY,
    minimumPointPY,
    nominalCenterOutputX,
    rightLowerRadiusLength,
    rightPivotR,
    rightUpperRockerLength,
    sourceScale,
  };

  const officialViewMinimum = new THREE.Vector2(-2.636297, -13.5);
  const officialViewWidth = 21;
  const officialViewHeight = 21;
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
    'double-parallel-motion-long-ternary-link-and-center-link';
  root.userData.blocks = {
    centerLink: centerLinkParts.rod,
    centerLinkEndAnchor: centerLinkParts.endAnchor,
    centerLinkStartAnchor: centerLinkParts.startAnchor,
    centerPiston: centerPistonParts.output,
    centerPistonHead: centerPistonParts.head,
    centerPistonPointAnchor: centerPistonParts.jointAnchor,
    fixedFrame,
    jointPins,
    leftPedestalO,
    leftPiston: leftPistonParts.output,
    leftPistonHead: leftPistonParts.head,
    leftPistonPointAnchor: leftPistonParts.jointAnchor,
    leftRadiusBar: leftRadiusParts.rod,
    leftRadiusEndAnchor: leftRadiusParts.endAnchor,
    leftRadiusStartAnchor: leftRadiusParts.startAnchor,
    longLink: longLinkParts.rod,
    longLinkEndAnchor: longLinkParts.endAnchor,
    longLinkMidpointAnchor: pointMAnchor,
    longLinkStartAnchor: longLinkParts.startAnchor,
    pointNAnchor,
    rightLowerRadiusBar: rightLowerParts.rod,
    rightLowerRadiusEndAnchor: rightLowerParts.endAnchor,
    rightLowerRadiusStartAnchor: rightLowerParts.startAnchor,
    rightPedestalR,
    rightUpperRocker: rightUpperParts.rod,
    rightUpperRockerEndAnchor: rightUpperParts.endAnchor,
    rightUpperRockerStartAnchor: rightUpperParts.startAnchor,
  };
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-0.78, -3.92, -0.66),
    new THREE.Vector3(5.32, 1.65, 1.22),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one prescribed rocking angle of radius bar O-M',
    mechanism: 1,
    outputs:
      'near-vertical points P and N, shown by two explanatory piston rods',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -3.94;
  root.userData.mechanism =
    'two-coupled-closed-rigid-parallel-motions-sharing-midpoint-M-and-fixed-pivot-R';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_pos_interp',
      'add_c_rod_r',
      'add_rot_to',
      'add_rot_to',
      'add_c_rod_r',
      'add_rot_to',
      'add_tx',
    ],
    officialGeometry: {
      addedPistonHalfStroke: sourceAddedPistonHalfStroke,
      centerLinkLength: sourceCenterLinkLength,
      centerLinkMidpointDistance: sourceCenterLinkMidpointDistance,
      leftPivotO: sourceLeftPivotO,
      leftRadiusLength: sourceLeftRadiusLength,
      longLinkLength: sourceLongLinkLength,
      longLinkMidpointDistance: sourceLongLinkMidpointDistance,
      nominalCenterOutputX: sourceNominalCenterOutputX,
      rightLowerRadiusLength: sourceRightLowerRadiusLength,
      rightPivotR: sourceRightPivotR,
      rightUpperRockerLength: sourceRightUpperRockerLength,
    },
    officialNotes:
      'the source identifies the plate as two parallel motions combining elements of 343 and 341; its two orange piston rods are explanatory additions of uncertain original application',
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the official canvas forces P to x=0 and inherits a rounded-dimension O-M residual; this model closes every visible bar exactly and retains the sub-0.0013-unit lateral deviations of P and N',
    referenceScope:
      'official fixed pivots, five bar lengths, both ternary midpoint stations, branch choices, explanatory outputs, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate333: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one 16-unit ternary link, one 6-unit ternary link, two 8-unit radius bars, one 6.006189-unit rocker, and two fixed pivots',
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
    relatedMovements: [341, 343],
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
      '|P-W|=16 with M its midpoint, |O-M|=8, |R-W|=6.006189, |M-Q|=6 with N its midpoint, and |R-Q|=8 source units',
    input:
      'radius bar O-M rocks with the smooth phase law inferred from the official added P-piston drive',
    outputs:
      'P and N carry the two explanatory piston rods on independently quantified near-straight loci',
    topology:
      'the two parallel-motion cells share M and the fixed right pivot R',
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.1, 3.5, 13.4),
    root,
    update,
  };
}

export function createAuthoredMarineParallelMotion(movement) {
  switch (movement.id) {
    case 332: return sideLeverMarineParallelMotion(movement);
    case 333: return doubleParallelMotion(movement);
    case 336: return sideLeverRockshaftParallelMotion(movement);
    default: return null;
  }
}
