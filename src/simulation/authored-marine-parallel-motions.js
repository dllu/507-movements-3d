import { makeBoredLinkRod } from './bored-link-rod.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
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

const makeRigidRod = makeBoredLinkRod;

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

  // Brown's elevation: a casing with bands and flanges behind the lever and
  // side rod, a standard carrying rockshaft F, one diagonal frame member,
  // the forked side lever on a bare sectioned shaft O, and no piston guides.
  const s = sourceScale;
  const pinClearance = 0.012;
  const leverPlaneZ = 0.04;
  const leverHalfDepth = 0.14;
  const radiusArmPlaneZ = -0.05;
  const casingHalfDepth = 0.35;
  const cylinderAxisZ = -0.52;
  const casingFrontZ = cylinderAxisZ + casingHalfDepth;
  const pistonLineX = verticalStrokeLineX;
  const pistonRodRadius = 0.16 * s;
  const pistonBore = pistonRodRadius + pinClearance;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-marine-cylinder-casing-standard-F-rockshaft-and-shaft-O';
  const fixedPart = (mesh, role) => {
    mesh.userData.fixed = true;
    mesh.userData.role = role;
    fixedFrame.add(mesh);
    return mesh;
  };
  // Extruded along y so the piston rod can pass a vertical bore.
  const casingBlock = (xMin, xMax, yLow, yHigh, halfDepth, bore, role,
    zCenter = cylinderAxisZ) => {
    const outline = poly([[xMin * s, -halfDepth], [xMax * s, -halfDepth],
      [xMax * s, halfDepth], [xMin * s, halfDepth]]);
    const geometry = plate(bore
      ? clip.difference(outline, poly(circle([pistonLineX, 0], bore, 48)))
      : outline, yLow * s, yHigh * s);
    geometry.rotateX(-Math.PI / 2);
    const mesh = fixedPart(new THREE.Mesh(geometry, frameMaterial), role);
    mesh.position.z = zCenter;
    return mesh;
  };
  const cylinderBack = casingBlock(4.0, 12.9, -1.2, 5.0, casingHalfDepth,
    pistonBore, 'fixed-cylinder-and-valve-casing');
  const cylinderTopFlange = casingBlock(6.6, 13.2, 5.0, 5.6,
    casingHalfDepth + 0.02, pistonBore, 'fixed-cylinder-top-flange');
  const lowerBed = casingBlock(3.9, 13.2, -1.84, -1.2, casingHalfDepth + 0.02,
    0, 'fixed-cylinder-bottom-flange');
  const cylinderCover = casingBlock(8.9, 11.1, 5.6, 5.8, 0.22, pistonBore,
    'fixed-cylinder-cover-plate');
  const stuffingBox = casingBlock(9.3, 10.7, 5.8, 6.15, 0.16, pistonBore,
    'fixed-piston-rod-stuffing-box');
  const casingBands = [[4.4, 4.7], [-0.15, 0.15]].map(([low, high], index) =>
    casingBlock(4.0, 12.9, low, high, 0.02, 0,
      `fixed-cylinder-band-${index + 1}`, casingFrontZ + 0.02));

  const standardLow = -0.62;
  const standardHigh = -0.30;
  const rockshaftStandard = fixedPart(new THREE.Mesh(plate(poly([
    [4.34, 10.7], [5.88, 10.7], [5.88, 7.3], [6.25, 6.4], [7.0, 5.6],
    [5.2, 5.0], [4.9, 6.2], [4.34, 7.35],
  ].map(([x, y]) => [x * s, y * s])), standardLow, standardHigh),
  frameMaterial), 'fixed-standard-on-cylinder-carrying-rockshaft-F');
  const diagonalStart = new THREE.Vector2(-1.6, 11.2);
  const diagonalEnd = new THREE.Vector2(6.9, 6.2);
  const diagonalNormal = diagonalEnd.clone().sub(diagonalStart).normalize()
    .rotateAround(new THREE.Vector2(), Math.PI / 2).multiplyScalar(0.40);
  const diagonalFrame = fixedPart(new THREE.Mesh(plate(poly([
    diagonalStart.clone().add(diagonalNormal),
    diagonalEnd.clone().add(diagonalNormal),
    diagonalEnd.clone().sub(diagonalNormal),
    diagonalStart.clone().sub(diagonalNormal),
  ].map((point) => [point.x * s, point.y * s])), standardLow, standardHigh),
  frameMaterial), 'fixed-diagonal-engine-frame-member');
  const rockshaftSupports = [rockshaftStandard, diagonalFrame];
  const rockshaftBearings = [rockshaftStandard];

  const beamShaftLow = leverPlaneZ - leverHalfDepth - 0.14;
  const beamShaftHigh = leverPlaneZ + leverHalfDepth + 0.02;
  const beamShaft = fixedPart(cylinderAlongZ(0.37 * s,
    beamShaftHigh - beamShaftLow, darkMaterial, 34),
  'fixed-sectioned-side-lever-shaft-O');
  beamShaft.position.z = (beamShaftLow + beamShaftHigh) / 2;
  const rockshaftLow = standardLow;
  const rockshaftHigh = radiusArmPlaneZ + 0.095;
  const rockshaft = fixedPart(cylinderAlongZ(0.19 * s,
    rockshaftHigh - rockshaftLow, darkMaterial, 34),
  'transverse-fixed-axis-rockshaft-F');
  rockshaft.position.set(rockshaftPivotF.x, rockshaftPivotF.y,
    (rockshaftLow + rockshaftHigh) / 2);
  root.add(fixedFrame);

  const sideLever = new THREE.Group();
  sideLever.userData.axis = Z_AXIS.clone();
  sideLever.userData.role =
    'ten-unit-side-lever-O-R-with-three-unit-parallel-rod-station-M';
  const leverBores = [
    { x: 0, y: 0, radius: 0.37 * s + pinClearance },
  ];
  const leverOutline = clip.difference(
    clip.union(
      poly([
        [-2.6, -1.35], [0, -1.45], [2.2, -1.00], [9.35, -0.45],
        [10.05, -0.25], [10.05, 0.25], [9.35, 0.45], [2.2, 1.05],
        [0, 1.60], [-2.6, 1.55],
      ].map(([x, y]) => [x * s, y * s])),
      poly(circle([0, 0], 1.125 * s, 72)),
      poly(circle([sideLeverRightRadius, 0], 0.875 * s, 64)),
    ),
    poly([[1.55, -0.26], [8.70, -0.16], [8.70, 0.16], [1.55, 0.26]]
      .map(([x, y]) => [x * s, y * s])),
    ...leverBores.map((bore) => poly(circle([bore.x, bore.y], bore.radius, 64))),
  );
  const sideLeverBody = new THREE.Mesh(plate(clip.union(leverOutline,
    clip.difference(poly(circle([sideLeverMidRadius, 0], 0.34 * s, 48)),
      poly(circle([sideLeverMidRadius, 0], 0.001, 8))))
    , leverPlaneZ - leverHalfDepth, leverPlaneZ + leverHalfDepth),
  leverMaterial);
  sideLeverBody.userData.bores = leverBores;
  sideLeverBody.userData.role = 'slotted-tapered-rigid-side-lever-body';
  const sideLeverPivotBoss = sideLeverBody;
  const sideLeverMidBoss = sideLeverBody;
  const sideLeverRightBoss = sideLeverBody;
  const beamMidAnchor = new THREE.Object3D();
  beamMidAnchor.position.set(sideLeverMidRadius, 0, leverPlaneZ);
  beamMidAnchor.userData.role = 'analytic-side-lever-station-M';
  const beamRightAnchor = new THREE.Object3D();
  beamRightAnchor.position.set(sideLeverRightRadius, 0, leverPlaneZ);
  beamRightAnchor.userData.role = 'analytic-side-lever-end-R';
  const beamNegativeAnchor = new THREE.Object3D();
  beamNegativeAnchor.position.set(-hiddenDrivenBeamRadius, 0, leverPlaneZ);
  beamNegativeAnchor.userData.role =
    'analytic-hidden-side-lever-driver-station';
  sideLever.add(
    sideLeverBody,
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
  const sideRodIntermediateBoss = null;
  const sideRodIntermediateAnchor = new THREE.Object3D();
  sideRodIntermediateAnchor.position.set(
    sideRodIntermediateDistance,
    0,
    0.40,
  );
  sideRodIntermediateAnchor.userData.role = 'analytic-side-rod-point-N';
  sideRodParts.rod.userData.addPinEye(sideRodIntermediateDistance, 0.22 * sourceScale + 0.005);
  sideRodParts.rod.add(sideRodIntermediateAnchor);
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
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: radiusArmLength,
    planeZ: radiusArmPlaneZ,
    role: 'one-point-seven-five-seven-five-five-six-unit-rockshaft-arm-F-Q',
    boreRadius: 0.24 * sourceScale + 0.005,
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
  const crossheadLow = cylinderAxisZ - 0.25;
  const crossheadHigh = 0.30;
  const crossheadGeometry = new THREE.ExtrudeGeometry(crossheadShape, {
    bevelEnabled: false,
    curveSegments: 16,
    depth: crossheadHigh - crossheadLow,
  });
  crossheadGeometry.translate(0, 0, crossheadLow);
  const crossheadHousing = new THREE.Mesh(crossheadGeometry, outputMaterial);
  crossheadHousing.userData.role =
    'orange-transverse-crosshead-joining-piston-rod-to-side-rod-at-S';
  const pistonRodTop = -0.70 * s;
  const pistonRodBottom = -7.6 * s;
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(pistonRodRadius, pistonRodRadius,
      pistonRodTop - pistonRodBottom, 24),
    outputMaterial,
  );
  pistonRod.position.set(0, (pistonRodTop + pistonRodBottom) / 2,
    cylinderAxisZ);
  pistonRod.userData.role = 'piston-rod-rigidly-suspended-from-S';
  const crossheadAnchor = new THREE.Object3D();
  crossheadAnchor.userData.role = 'analytic-crosshead-point-S';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, pistonRodBottom, cylinderAxisZ);
  pistonHeadAnchor.userData.role = 'analytic-hidden-piston-rod-end';
  output.add(
    crossheadHousing,
    pistonRod,
    crossheadAnchor,
    pistonHeadAnchor,
  );
  root.add(output);

  const pinOn = (parent, name, radius, x, low, high) => {
    const pin = cylinderAlongZ(radius, high - low, whiteMaterial, 30);
    pin.position.set(x, 0, (low + high) / 2);
    pin.userData.role = `common-working-pin-${name}`;
    parent.add(pin);
    return pin;
  };
  const leverBack = leverPlaneZ - leverHalfDepth - 0.02;
  const jointPins = {
    M: pinOn(sideLever, 'M', 0.22 * s, sideLeverMidRadius, leverBack, 0.475),
    N: pinOn(sideRodParts.rod, 'N', 0.22 * s, sideRodIntermediateDistance,
      0.295, 0.785),
    Q: pinOn(parallelRodParts.rod, 'Q', 0.24 * s, parallelRodLength,
      radiusArmPlaneZ - 0.10, 0.785),
    R: pinOn(sideLever, 'R', 0.24 * s, sideLeverRightRadius, leverBack, 0.505),
    S: pinOn(output, 'S', 0.24 * s, 0, crossheadHigh - 0.02, 0.505),
  };
  crossheadAnchor.position.z = jointPins.S.position.z;
  const pinWorld = (name) => jointPins[name].getWorldPosition(new THREE.Vector3());

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
        radiusArmPlaneZ,
      ),
      type: 'fixed-revolute-pair-on-transverse-rockshaft-F',
    },
    sideLeverPivotO: {
      fixedMember: fixedFrame,
      movingMember: sideLever,
      point: new THREE.Vector3(0, 0, leverPlaneZ),
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
    contacts.parallelRodAtM.point.set(state.beamMidPoint.x,
      state.beamMidPoint.y, jointPins.M.position.z);
    contacts.sideRodAtR.point.set(state.beamRightPoint.x,
      state.beamRightPoint.y, jointPins.R.position.z);
    contacts.radiusAndCrossbarAtQ.point.set(state.pointQ.x,
      state.pointQ.y, jointPins.Q.position.z);
    contacts.crossbarAtN.point.set(state.pointN.x, state.pointN.y,
      jointPins.N.position.z);
    contacts.crossheadAtS.point.set(state.pointS.x, state.pointS.y,
      jointPins.S.position.z);
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
    cylinderBack,
    cylinderCover,
    cylinderTopFlange,
    casingBands,
    diagonalFrame,
    beamShaft,
    rockshaftStandard,
    stuffingBox,
    fixedFrame,
    jointPins,
    lowerBed,
    parallelRod: parallelRodParts.rod,
    parallelRodEndAnchor: parallelRodParts.endAnchor,
    parallelRodStartAnchor: parallelRodParts.startAnchor,
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
      'short fixed-radius arm F-Q rocks on the transverse shaft carried by the fixed standard on the cylinder',
    straightness:
      'the rockshaft correction makes extrapolated piston point S nearly vertical; its small lateral deviation is measured rather than forced away',
  };

  update(0);
  root.userData.hideGround = true;
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  // Brown's plate crops the lever just left of O and the frame at the top.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.8 * sourceScale, -2.3 * sourceScale, -0.90),
    new THREE.Vector3(13.4 * sourceScale, 11.8 * sourceScale, 0.80),
  );
  root.userData.cameraDistanceScale = 0.96;
  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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
  // Official canvas: 8-unit links with C at 6, radius bar 7.695702 from
  // F=(11.695702, 6), and a 2.75-unit timing crank (5.5-unit stroke).
  const officialLeftLinkLength = 8;
  const officialLeftLinkPointCDistance = 6;
  const officialRightLinkLength = 8;
  const officialRadiusBarLength = 7.695702;
  const officialRadiusPivotF = new THREE.Vector2(11.695702, 6);
  const officialHiddenCrankRadius = 2.75;
  // Brown's plate, measured with the 8-unit lever as the scale, draws the
  // links taller (E about 10 units over the lever, C at 7.6, F at about
  // (10.9, 7.6)) and a cylinder only about 3.6 units deep between its lid
  // (5.1-5.6) and bottom (about 1.5). The model keeps C at 7.6, a 7.35-unit
  // radius bar, and sets both links to 9.84 so E stays the straight-line
  // point (E = 2 C r / (r + 4)); a 1.7-unit timing crank gives a 3.4-unit
  // stroke that fits the drawn cylinder.
  const sourceLeftLinkLength = 9.84;
  const sourceLeftLinkPointCDistance = 7.6;
  const sourceRightLinkLength = 9.84;
  const sourceParallelBarLength = 4;
  const sourceRadiusBarLength = 7.35;
  const sourceRadiusPivotF = new THREE.Vector2(
    sourceSideLeverMidRadius + sourceRadiusBarLength,
    sourceLeftLinkPointCDistance,
  );
  const sourceHiddenCrankCenter = new THREE.Vector2(-8, -12);
  const sourceHiddenCrankRadius = 1.7;
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
      new THREE.Vector2(sourceSideLeverMidRadius,
        sourceLeftLinkPointCDistance).multiplyScalar(sourceScale),
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
      new THREE.Vector2(sourceSideLeverRadius,
        sourceRightLinkLength).multiplyScalar(sourceScale),
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

  // Brown's elevation: side lever A on a sectioned shaft, the vessel and its
  // lid behind the right link, and a gooseneck bracket on the lid carrying F.
  // There is no deck, frame post or bedplate in the plate.
  const s = sourceScale;
  const pinClearance = 0.012;
  const leverPlaneZ = 0.02;
  const leverHalfDepth = 0.12;
  const vesselRadius = 2.3 * s;
  const vesselAxisZ = leverPlaneZ - leverHalfDepth - 0.035 - vesselRadius;
  const pistonLineX = 8 * s;
  const pistonRodRadius = 0.16 * s;
  const pistonBore = pistonRodRadius + pinClearance;
  const lidLow = 5.08 * s;
  const lidHigh = 5.63 * s;
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-side-lever-marine-engine-frame-and-radius-pivot-F';
  const fixedPart = (mesh, role) => {
    mesh.userData.fixed = true;
    mesh.userData.role = role;
    fixedFrame.add(mesh);
    return mesh;
  };

  // The cylinder, lid and gooseneck follow the plate; the 3.4-unit stroke
  // keeps the piston-rod end between the bore bottom and the lid.
  const vesselBottom = 1.55 * s;
  const vesselBoreBottom = 1.62 * s;
  const vessel = fixedPart(new THREE.Mesh(new THREE.LatheGeometry([
    [0, vesselBottom - 0.45 * s],
    [0.62 * vesselRadius, vesselBottom - 0.38 * s],
    [0.92 * vesselRadius, vesselBottom - 0.18 * s],
    [vesselRadius, vesselBottom],
    [vesselRadius, lidLow],
    [pistonBore, lidLow],
    [pistonBore, vesselBoreBottom],
    [0, vesselBoreBottom],
  ].map(([radius, y]) => new THREE.Vector2(radius, y)), 72), frameMaterial),
  'fixed-round-bottomed-cylinder-vessel-under-E');
  vessel.position.set(pistonLineX, 0, vesselAxisZ);
  const lidHalfDepth = vesselRadius + 0.07;
  const lidOutline = poly([[5.4 * s, -lidHalfDepth], [11.4 * s, -lidHalfDepth],
    [11.4 * s, lidHalfDepth], [5.4 * s, lidHalfDepth]]);
  const lidGeometry = plate(clip.difference(lidOutline,
    poly(circle([pistonLineX, 0], pistonBore, 48))), lidLow, lidHigh);
  lidGeometry.rotateX(-Math.PI / 2);
  const deck = fixedPart(new THREE.Mesh(lidGeometry, frameMaterial),
    'fixed-cylinder-lid-flange-with-piston-rod-bore');
  deck.position.z = vesselAxisZ;

  const bracketLow = vesselAxisZ + lidHalfDepth - 0.30;
  const bracketHigh = 0.78;
  const gooseneck = [];
  for (let step = 0; step <= 12; step += 1) {
    const angle = Math.PI * step / 24;
    gooseneck.push([
      radiusPivotF.x - 1.35 * s + 1.35 * s * Math.sin(angle),
      lidHigh + (radiusPivotF.y - lidHigh - 0.2 * s) * (1 - Math.cos(angle)),
    ]);
  }
  const radiusSupport = fixedPart(new THREE.Mesh(plate(clip.union(
    poly([
      [radiusPivotF.x - 1.6 * s, lidHigh - 0.1 * s],
      [radiusPivotF.x + 0.25 * s, lidHigh - 0.1 * s],
      [radiusPivotF.x + 0.42 * s, radiusPivotF.y],
      [radiusPivotF.x - 0.42 * s, radiusPivotF.y],
      ...gooseneck.reverse(),
    ]),
    poly(circle([radiusPivotF.x, radiusPivotF.y], 0.45 * s, 48)),
  ), bracketLow, bracketHigh), frameMaterial),
  'fixed-gooseneck-bracket-on-cylinder-lid-carrying-F');
  const fixedPivotFLow = bracketHigh - 0.30;
  const fixedPivotFHigh = 1.01;
  const fixedPivotF = fixedPart(cylinderAlongZ(0.25 * s,
    fixedPivotFHigh - fixedPivotFLow, darkMaterial, 34),
  'fixed-radius-bar-pivot-F');
  fixedPivotF.position.set(radiusPivotF.x, radiusPivotF.y,
    (fixedPivotFLow + fixedPivotFHigh) / 2);
  const pivotAShaftLow = leverPlaneZ - leverHalfDepth - 0.03;
  const pivotAShaftHigh = leverPlaneZ + leverHalfDepth + 0.025;
  const pivotAShaft = fixedPart(cylinderAlongZ(0.62 * s,
    pivotAShaftHigh - pivotAShaftLow, darkMaterial, 40),
  'fixed-sectioned-side-lever-shaft-A');
  pivotAShaft.position.z = (pivotAShaftLow + pivotAShaftHigh) / 2;
  root.add(fixedFrame);

  const sideLever = new THREE.Group();
  sideLever.userData.axis = Z_AXIS.clone();
  sideLever.userData.role = 'rocking-side-lever-pivoted-at-A';
  const leverBores = [{ x: 0, y: 0, radius: 0.62 * s + pinClearance }];
  const leverBody = new THREE.Mesh(plate(clip.difference(
    clip.union(
      poly([[-3.2, -1.35], [0, -1.33], [7.4, -0.78], [7.4, 0.78],
        [0, 1.33], [-3.2, 1.35]].map(([x, y]) => [x * s, y * s])),
      poly(circle([0, 0], 1.65 * s, 72)),
      poly(circle([sideLeverRadius, 0], 0.80 * s, 56)),
    ),
    poly(circle([0, 0], leverBores[0].radius, 56)),
  ), leverPlaneZ - leverHalfDepth, leverPlaneZ + leverHalfDepth),
  blueMaterial);
  leverBody.userData.bores = leverBores;
  leverBody.userData.role =
    'tapered-eight-unit-side-lever-with-bosses-A-and-end-pin';
  const leverRib = new THREE.Mesh(plate(poly([
    [1.75 * s, -0.06 * s], [7.0 * s, -0.06 * s],
    [7.0 * s, 0.06 * s], [1.75 * s, 0.06 * s],
  ]), leverPlaneZ + leverHalfDepth - 0.01, leverPlaneZ + leverHalfDepth + 0.012),
  darkMaterial);
  leverRib.userData.role = 'side-lever-centre-web-line';
  const leverAnchor = (x, role) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(x, 0, leverPlaneZ);
    anchor.userData.role = role;
    return anchor;
  };
  const sideLeverParts = {
    hiddenInputAnchor: leverAnchor(-sideLeverRadius,
      'analytic-hidden-negative-eight-unit-animation-driver-point'),
    lever: sideLever,
    midAnchor: leverAnchor(sideLeverMidRadius,
      'analytic-four-unit-side-lever-pin'),
    pivotA: leverBody,
    rightAnchor: leverAnchor(sideLeverRadius,
      'analytic-eight-unit-side-lever-pin'),
  };
  sideLever.add(leverBody, leverRib, sideLeverParts.midAnchor,
    sideLeverParts.rightAnchor, sideLeverParts.hiddenInputAnchor);
  root.add(sideLever);

  const leftLinkParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: leftLinkLength,
    planeZ: 0.36,
    role: 'left-parallel-motion-link-through-C',
    width: 0.34 * sourceScale,
  });
  const pointCAnchor = new THREE.Object3D();
  pointCAnchor.position.set(leftLinkPointCDistance, 0, 0.36);
  pointCAnchor.userData.role = 'analytic-point-C-on-left-link';
  leftLinkParts.rod.userData.addPinEye(leftLinkPointCDistance, 0.22 * sourceScale + 0.005);
  leftLinkParts.rod.add(pointCAnchor);
  root.add(leftLinkParts.rod);

  const rightLinkParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: rightLinkLength,
    planeZ: 0.39,
    role: 'right-link-to-crosshead-E',
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

  // The crosshead sits behind the links and carries pin E forward to them.
  const crossheadOutput = new THREE.Group();
  crossheadOutput.userData.role = 'crosshead-E-piston-rod-and-piston-output';
  crossheadOutput.userData.rotationDegreesOfFreedom = 0;
  const housingShape = new THREE.Shape();
  housingShape.moveTo(-0.50 * s, -0.60 * s);
  housingShape.lineTo(0.50 * s, -0.60 * s);
  housingShape.lineTo(0.50 * s, 0.75 * s);
  housingShape.absarc(0, 0.75 * s, 0.375 * s, 0, Math.PI, false);
  housingShape.closePath();
  const crossheadLow = vesselAxisZ - 0.12;
  const crossheadHigh = 0.29;
  const housingGeometry = new THREE.ExtrudeGeometry(housingShape, {
    bevelEnabled: false,
    curveSegments: 16,
    depth: crossheadHigh - crossheadLow,
  });
  housingGeometry.translate(0, 0, crossheadLow);
  const crossheadHousing = new THREE.Mesh(housingGeometry, outputMaterial);
  crossheadHousing.userData.role = 'source-crosshead-E-with-rounded-cap';
  const pistonRodTop = -0.55 * s;
  const pistonRodBottom = -6.45 * s;
  const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(pistonRodRadius,
    pistonRodRadius, pistonRodTop - pistonRodBottom, 24), outputMaterial);
  pistonRod.position.set(0, (pistonRodTop + pistonRodBottom) / 2, vesselAxisZ);
  pistonRod.userData.role = 'piston-rod-rigidly-carried-by-crosshead-E';
  const crossheadAnchor = new THREE.Object3D();
  crossheadAnchor.userData.role = 'analytic-crosshead-E-center';
  const pistonAnchor = new THREE.Object3D();
  pistonAnchor.position.set(0, pistonRodBottom, vesselAxisZ);
  pistonAnchor.userData.role = 'analytic-hidden-piston-rod-end';
  crossheadOutput.add(crossheadHousing, pistonRod, crossheadAnchor,
    pistonAnchor);
  const outputParts = {
    anchor: crossheadAnchor,
    housing: crossheadHousing,
    output: crossheadOutput,
    pistonAnchor,
    pistonRod,
  };
  root.add(crossheadOutput);

  const pinOn = (parent, radius, x, low, high, role) => {
    const pin = cylinderAlongZ(radius, high - low, whiteMaterial, 32);
    pin.position.set(x, 0, (low + high) / 2);
    pin.userData.role = role;
    parent.add(pin);
    return pin;
  };
  const jointPins = {
    beamMid: pinOn(sideLever, 0.22 * s, sideLeverMidRadius, leverPlaneZ, 0.46,
      'common-pin-side-lever-to-left-link'),
    beamRight: pinOn(sideLever, 0.24 * s, sideLeverRadius, leverPlaneZ, 0.49,
      'common-pin-side-lever-to-right-link'),
    pointC: pinOn(leftLinkParts.rod, 0.22 * s, leftLinkPointCDistance, 0.26,
      1.01, 'common-pin-left-link-to-radius-bar-at-C'),
    pointD: pinOn(leftLinkParts.rod, 0.22 * s, leftLinkLength, 0.26, 0.76,
      'common-pin-left-link-to-parallel-bar-at-D'),
    pointE: pinOn(crossheadOutput, 0.24 * s, 0, crossheadHigh - 0.02, 0.76,
      'common-pin-right-link-parallel-bar-and-crosshead-E'),
  };
  crossheadAnchor.position.z = jointPins.pointE.position.z;

  const contacts = {
    beamPivotA: {
      fixedMember: fixedFrame,
      movingMember: sideLever,
      point: new THREE.Vector3(0, 0, leverPlaneZ),
      type: 'fixed-revolute-pair',
    },
    beamMidToLeftLink: {
      memberA: sideLever,
      memberB: leftLinkParts.rod,
      point: new THREE.Vector3(),
      type: 'revolute-pin',
    },
    beamRightToRightLink: {
      memberA: sideLever,
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
      members: [rightLinkParts.rod, parallelBarParts.rod, crossheadOutput],
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
    sideLever.rotation.z = state.beamAngle;
    setRodPose(leftLinkParts.rod, state.beamMidPoint, state.leftLink);
    setRodPose(rightLinkParts.rod, state.beamRightPoint, state.rightLink);
    setRodPose(parallelBarParts.rod, state.pointE, state.parallelBar);
    setRodPose(radiusBarParts.rod, radiusPivotF, state.radiusBar);
    crossheadOutput.position.set(state.pointE.x, state.pointE.y, 0);
    contacts.beamMidToLeftLink.point.set(state.beamMidPoint.x,
      state.beamMidPoint.y, jointPins.beamMid.position.z);
    contacts.beamRightToRightLink.point.set(state.beamRightPoint.x,
      state.beamRightPoint.y, jointPins.beamRight.position.z);
    contacts.leftLinkToParallelBarD.point.set(state.pointD.x,
      state.pointD.y, jointPins.pointD.position.z);
    contacts.linksToCrossheadE.point.set(state.pointE.x,
      state.pointE.y, jointPins.pointE.position.z);
    contacts.radiusBarAtC.point.set(state.pointC.x,
      state.pointC.y, jointPins.pointC.position.z);
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
    radiusSupport,
    pivotAShaft,
    vessel,
    jointPins,
    leftLink: leftLinkParts.rod,
    leftLinkEndAnchor: leftLinkParts.endAnchor,
    leftLinkStartAnchor: leftLinkParts.startAnchor,
    lowerPistonAnchor: outputParts.pistonAnchor,
    parallelBarED: parallelBarParts.rod,
    parallelBarEndAnchor: parallelBarParts.endAnchor,
    parallelBarStartAnchor: parallelBarParts.startAnchor,
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
      hiddenCrankRadius: officialHiddenCrankRadius,
      hiddenDriveRodLength: sourceHiddenDriveRodLength,
      leftLinkLength: officialLeftLinkLength,
      leftLinkPointCDistance: officialLeftLinkPointCDistance,
      parallelBarLength: sourceParallelBarLength,
      radiusBarLength: officialRadiusBarLength,
      radiusPivotF: officialRadiusPivotF,
      rightLinkLength: officialRightLinkLength,
      sideLeverMidRadius: sourceSideLeverMidRadius,
      sideLeverRadius: sourceSideLeverRadius,
      verticalStrokeLineX: 8,
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the official drawing forces E onto x=8 and incurs a small rounded-dimension F-C residual; this model closes every rigid bar exactly and exposes the resulting sub-0.0008-unit lateral deviation of E',
    referenceScope:
      'official lever stations, parallel bar, timing-rod layout, source branch choices and 15 rpm timing; link heights, C, F and the stroke follow the plate',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate332: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'side lever A, paired links, radius bar F-C, parallel bar E-D, and piston crosshead E',
      measurementUncertaintyPixels: 4,
      plateProportions:
        'with the lever A-end as 8 units: E about 10.1 over the lever, C 7.6, F (10.9, 7.6), D-E 4.6, cylinder lid 5.1-5.6 and bottom about 1.5; model links 9.84, C 7.6, F (11.35, 7.6), stroke 3.4',
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
      '|A-B4|=4, |A-B8|=8, |B4-D|=9.84, |B4-C|=7.6, |F-C|=7.35, |D-E|=4, |B8-E|=9.84 source units',
    input:
      'the side lever rocks on A with a hidden 1.7-unit crank (official 2.75) and the official 12-unit timing-rod law',
    output:
      'crosshead E carries the piston on a near-vertical 3.4-unit stroke that fits the drawn cylinder',
    straightness:
      'radius bar F-C makes E an approximate straight-line point; lateral deviation is measured, not suppressed',
  };

  update(0);
  root.userData.hideGround = true;
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  // Brown's plate crops the lever left of A and frames F at the right edge.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.2 * sourceScale, -2.6 * sourceScale, -1.0),
    new THREE.Vector3(12.4 * sourceScale, 12.0 * sourceScale, 1.0),
  );
  root.userData.cameraDistanceScale = 0.96;
  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
    root,
    update,
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
  // Brown draws the beam tipped about 30 degrees with P some 6.4 units above
  // O, far beyond the official +/-4 drive. The plate half-stroke keeps the
  // official bars and pivots and swings the beam to about 29 degrees.
  const plateAddedPistonHalfStroke = 7.2;
  const addedPistonHalfStroke = plateAddedPistonHalfStroke * sourceScale;
  const nominalCenterOutputX = sourceNominalCenterOutputX * sourceScale;
  const zero = new THREE.Vector2();

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
    poseOffset = 0,
  ) => {
    // Unwrapped travel counts from the demonstration start; the pose offset
    // is applied to the wrapped angle so one turn closes exactly.
    const unwrappedInputAngle = inputTravel;
    const inputAngle = positiveModulo(
      positiveModulo(unwrappedInputAngle, FULL_TURN) + poseOffset,
      FULL_TURN,
    );
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

  // Brown's plate draws P raised and the beam falling toward W, which the
  // official canvas reaches half a cycle after its t=0. The demonstration
  // clock starts at the plate's pose; the official 15 rpm law is unchanged.
  const sourcePoseInputOffset = Math.PI;
  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
      sourcePoseInputOffset,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    leftPistonTop: 0,
    sourceThreeQuarter: cyclePeriod / 4,
    leftPistonBottom: cyclePeriod / 2,
    sourceQuarter: cyclePeriod * 3 / 4,
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

  // Brown's plate: a broad beam P-M-W with a large boss at M, plain bars, two
  // small bearings on hatched ground, and a cut-off rod below P. The official
  // canvas's two explanatory piston rods are not drawn in the plate.
  const s = sourceScale;
  const pinClearance = 0.012;
  const beamPlaneZ = 0.10;
  const beamHalfDepth = 0.09;
  const linkWidth = 0.46 * s;
  const pinRadius = { M: 0.27 * s, N: 0.20 * s, P: 0.20 * s, Q: 0.23 * s,
    W: 0.23 * s, fixed: 0.25 * s };
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'two-fixed-pedestals-O-and-R';
  const makePedestal = (point, name, low, high, pinLow, pinHigh,
    footInFront = false) => {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, 0);
    group.userData.fixed = true;
    group.userData.role = `fixed-${name}-pedestal`;
    // Brown draws each fixed pivot as a small half-round lug standing on a
    // ground line with diagonal hatching below, not a pedestal block.
    const bearing = new THREE.Mesh(plate(clip.difference(clip.union(
      poly(circle([0, 0], 0.52 * s, 48)),
      poly([[-0.52 * s, 0], [0.52 * s, 0], [0.78 * s, -0.62 * s],
        [-0.78 * s, -0.62 * s]]),
    ), poly(circle([0, 0], pinRadius.fixed + pinClearance, 40))), low, high),
    frameMaterial);
    bearing.userData.fixed = true;
    bearing.userData.role = `${name}-fixed-bearing-bracket`;
    const bore = cylinderAlongZ(pinRadius.fixed, pinHigh - pinLow,
      darkMaterial, 34);
    bore.position.z = (pinLow + pinHigh) / 2;
    bore.userData.fixed = true;
    bore.userData.role = `${name}-fixed-bearing-pin`;
    const groundLine = [[-1.65 * s, -0.62 * s], [1.65 * s, -0.62 * s],
      [1.65 * s, -0.70 * s], [-1.65 * s, -0.70 * s]];
    const hatchStrokes = [];
    for (let i = 0; i < 11; i += 1) {
      const x0 = -1.35 * s + i * 0.30 * s;
      hatchStrokes.push(poly([[x0, -0.70 * s], [x0 + 0.06 * s, -0.70 * s],
        [x0 - 0.22 * s, -1.02 * s], [x0 - 0.28 * s, -1.02 * s]]));
    }
    const foot = new THREE.Mesh(plate(clip.union(poly(groundLine),
      ...hatchStrokes), footInFront ? low : low - 0.08,
    footInFront ? high : low), darkMaterial);
    foot.userData.fixed = true;
    foot.userData.role = `${name}-hatched-ground`;
    group.add(bearing, bore, foot);
    group.userData.bearing = bearing;
    group.userData.bore = bore;
    group.userData.foot = foot;
    return group;
  };
  // O sits in front of its radius bar because P's rod sweeps past O behind.
  // Its ground line shares the lug's plane, in front of the radius bar that
  // dips below O at the plate stroke's lower end.
  const leftPedestalO = makePedestal(leftPivotO, 'left-pivot-O',
    0.47, 0.62, 0.26, 0.62, true);
  const rightPedestalR = makePedestal(rightPivotR, 'right-pivot-R',
    0.18, 0.48, 0.18, 1.08);
  fixedFrame.add(leftPedestalO, rightPedestalR);
  root.add(fixedFrame);

  const longLink = new THREE.Group();
  longLink.userData.role = 'sixteen-unit-long-ternary-link-P-M-W';
  const beamBores = [
    { x: 0, y: 0, radius: pinRadius.P + pinClearance },
    { x: longLinkMidpointDistance, y: 0, radius: pinRadius.M + pinClearance },
    { x: longLinkLength, y: 0, radius: pinRadius.W + pinClearance },
  ];
  const beamEdge = [];
  for (let step = 0; step <= 16; step += 1) {
    const x = longLinkLength * step / 16;
    const bulge = Math.sin(Math.PI * step / 16);
    beamEdge.push([x, (0.46 + 0.12 * bulge) * s]);
  }
  const beamBody = new THREE.Mesh(plate(clip.difference(
    clip.union(
      poly([...beamEdge, ...beamEdge.map(([x, y]) => [x, -y]).reverse()]),
      poly(circle([0, 0], 0.55 * s, 40)),
      poly(circle([longLinkMidpointDistance, 0], 1.20 * s, 64)),
      poly(circle([longLinkLength, 0], 0.55 * s, 40)),
    ),
    ...beamBores.map((bore) => poly(circle([bore.x, bore.y], bore.radius, 40))),
  ), beamPlaneZ - beamHalfDepth, beamPlaneZ + beamHalfDepth), blueMaterial);
  beamBody.userData.bores = beamBores;
  beamBody.userData.role = 'broad-beam-P-M-W-with-large-boss-at-M';
  const beamAnchor = (x, role) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(x, 0, beamPlaneZ);
    anchor.userData.role = role;
    return anchor;
  };
  const pointMAnchor = beamAnchor(longLinkMidpointDistance,
    'analytic-midpoint-M-on-long-link');
  const longLinkParts = {
    endAnchor: beamAnchor(longLinkLength, 'analytic-long-link-end-W'),
    rod: longLink,
    startAnchor: beamAnchor(0, 'analytic-long-link-start-P'),
  };
  longLink.add(beamBody, longLinkParts.startAnchor, pointMAnchor,
    longLinkParts.endAnchor);
  root.add(longLink);

  const leftRadiusParts = makeRigidRod({
    bodyMaterial: redMaterial,
    boreRadius: pinRadius.M + pinClearance,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: leftRadiusLength,
    planeZ: 0.36,
    role: 'left-eight-unit-radius-bar-O-M',
    startBoreRadius: pinRadius.fixed + pinClearance,
    width: linkWidth,
  });
  root.add(leftRadiusParts.rod);

  const rightUpperParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    boreRadius: pinRadius.W + pinClearance,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: rightUpperRockerLength,
    planeZ: 0.58,
    role: 'right-upper-6.006189-unit-rocker-R-W',
    startBoreRadius: pinRadius.fixed + pinClearance,
    width: linkWidth,
  });
  root.add(rightUpperParts.rod);

  const centerLinkParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    boreRadius: pinRadius.Q + pinClearance,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: centerLinkLength,
    planeZ: 0.77,
    role: 'six-unit-center-ternary-link-M-N-Q',
    startBoreRadius: pinRadius.M + pinClearance,
    width: linkWidth,
  });
  const pointNAnchor = new THREE.Object3D();
  pointNAnchor.position.set(centerLinkMidpointDistance, 0, 0.77);
  pointNAnchor.userData.role = 'analytic-midpoint-N-on-center-link';
  centerLinkParts.rod.userData.addPinEye(centerLinkMidpointDistance,
    pinRadius.N + pinClearance);
  centerLinkParts.rod.add(pointNAnchor);
  root.add(centerLinkParts.rod);

  const rightLowerParts = makeRigidRod({
    bodyMaterial: redMaterial,
    boreRadius: pinRadius.Q + pinClearance,
    depth: 0.16,
    eyeMaterial: darkMaterial,
    length: rightLowerRadiusLength,
    planeZ: 0.98,
    role: 'right-lower-eight-unit-radius-bar-R-Q',
    startBoreRadius: pinRadius.fixed + pinClearance,
    width: linkWidth,
  });
  root.add(rightLowerParts.rod);

  const leftPiston = new THREE.Group();
  leftPiston.userData.role = 'cut-off-rod-guided-by-point-P';
  leftPiston.userData.rotationDegreesOfFreedom = 0;
  const leftPistonPlaneZ = -0.10;
  const leftPistonRod = new THREE.Mesh(plate(clip.union(
    poly([[-0.22 * s, 0], [0.22 * s, 0], [0.22 * s, -3.0 * s],
      [-0.22 * s, -3.15 * s]]),
    poly(circle([0, 0], 0.50 * s, 40)),
  ), leftPistonPlaneZ - 0.05, leftPistonPlaneZ + 0.05), outputMaterial);
  leftPistonRod.userData.role = 'left-P-rod-shown-cut-off-as-in-the-plate';
  const leftPistonPointAnchor = new THREE.Object3D();
  leftPistonPointAnchor.position.z = leftPistonPlaneZ;
  leftPistonPointAnchor.userData.role = 'analytic-left-P-rod-joint';
  leftPiston.add(leftPistonRod, leftPistonPointAnchor);
  const leftPistonParts = {
    head: leftPistonRod,
    jointAnchor: leftPistonPointAnchor,
    output: leftPiston,
  };
  root.add(leftPiston);

  const pinOn = (parent, name, x, low, high) => {
    const pin = cylinderAlongZ(pinRadius[name], high - low, whiteMaterial, 30);
    pin.position.set(x, 0, (low + high) / 2);
    pin.userData.role = `common-working-pin-${name}`;
    parent.add(pin);
    return pin;
  };
  const beamBack = beamPlaneZ - beamHalfDepth;
  const jointPins = {
    M: pinOn(longLink, 'M', longLinkMidpointDistance, beamBack, 0.87),
    N: pinOn(centerLinkParts.rod, 'N', centerLinkMidpointDistance, 0.67, 0.89),
    P: pinOn(leftPiston, 'P', 0, leftPistonPlaneZ - 0.05,
      beamPlaneZ + beamHalfDepth + 0.02),
    Q: pinOn(centerLinkParts.rod, 'Q', centerLinkLength, 0.67, 1.08),
    W: pinOn(longLink, 'W', longLinkLength, beamBack, 0.68),
  };

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
    contacts.longLinkAtM.point.set(state.pointM.x, state.pointM.y,
      jointPins.M.position.z);
    contacts.longLinkAtW.point.set(state.pointW.x, state.pointW.y,
      jointPins.W.position.z);
    contacts.centerLinkAtQ.point.set(state.pointQ.x, state.pointQ.y,
      jointPins.Q.position.z);
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
    fixedFrame,
    jointPins,
    leftPedestalO,
    leftPiston: leftPistonParts.output,
    leftPistonRod: leftPistonParts.head,
    longLinkBody: beamBody,
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
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one prescribed rocking angle of radius bar O-M',
    mechanism: 1,
    outputs:
      'near-vertical points P and N; P carries the cut-off rod drawn in the plate',
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
      'the official canvas forces P to x=0 and inherits a rounded-dimension O-M residual; this model closes every visible bar exactly, drives P through Brown\'s steeper +/-7.2-unit plate stroke instead of the official +/-4, and retains the resulting sub-0.09-unit lateral deviations of P and N',
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
      'P carries the plate\'s cut-off rod and N is a marked pin, both on independently quantified near-straight loci',
    topology:
      'the two parallel-motion cells share M and the fixed right pivot R',
  };

  update(0);
  root.userData.hideGround = true;
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  // Brown's plate frames O and R at the edges with the beam near the top.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.2 * sourceScale, -9.4 * sourceScale, -0.30),
    new THREE.Vector3(17.4 * sourceScale, 8.6 * sourceScale, 1.10),
  );
  root.userData.cameraDistanceScale = 0.96;
  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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
