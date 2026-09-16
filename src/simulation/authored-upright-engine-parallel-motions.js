import {makeBoredLinkRod as makeRigidRod} from './bored-link-rod.js';
import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';
import {circle, capsule, poly, plate, polygonClipping as clip} from './finite-plate-geometry.js';
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

function circleCircleIntersections(centerA, radiusA, centerB, radiusB) {
  const centerDelta = centerB.clone().sub(centerA);
  const distance = centerDelta.length();
  if (distance === 0) throw new Error('Coincident linkage-circle centers');
  const along = (
    radiusA ** 2 - radiusB ** 2 + distance ** 2
  ) / (2 * distance);
  const heightSquared = radiusA ** 2 - along ** 2;
  if (heightSquared < -1e-10) throw new Error('Disjoint linkage circles');
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

function solveLinear3(matrix, rightHandSide) {
  const augmented = matrix.map((row, index) => [
    ...row,
    rightHandSide[index],
  ]);
  for (let column = 0; column < 3; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][column])
        > Math.abs(augmented[pivotRow][column])) pivotRow = row;
    }
    if (Math.abs(augmented[pivotRow][column]) < 1e-14) {
      throw new Error('Singular three-constraint upright-engine Jacobian');
    }
    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];
    for (let row = column + 1; row < 3; row += 1) {
      const ratio = augmented[row][column] / augmented[column][column];
      for (let entry = column; entry < 4; entry += 1) {
        augmented[row][entry] -= ratio * augmented[column][entry];
      }
    }
  }
  const result = [0, 0, 0];
  for (let row = 2; row >= 0; row -= 1) {
    let value = augmented[row][3];
    for (let column = row + 1; column < 3; column += 1) {
      value -= augmented[row][column] * result[column];
    }
    result[row] = value / augmented[row][row];
  }
  return result;
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

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
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

function opposedRadiusRodUprightEngine(movement) {
  const root = new THREE.Group();

  // The official canvas first forces crosspiece origin C onto x=0, then
  // closes the upper radius rod T-U, and finally only aims the equal lower
  // radius rod B-D at D. That last rod misses by up to 0.05931 source unit.
  // Here Cx, Cy, and crosspiece angle phi are solved simultaneously from
  // |P-C|=10.75, |T-U|=6.194593, and |B-D|=6.194593. The resulting midpoint
  // C is the actual near-straight piston locus rather than a forced line.
  const sourceScale = 0.23;
  const sourceCrankCenter = new THREE.Vector2(0, 0);
  const sourceCrankRadius = 3.5;
  const sourceCrankPhaseOffset = FULL_TURN * 0.875;
  const sourceConnectingRodLength = 10.75;
  const sourceStrokeLine = [
    new THREE.Vector2(0, -7.25),
    new THREE.Vector2(0, -14.75),
  ];
  const sourceTopPivotT = new THREE.Vector2(-5.5, -7.060769);
  const sourceBottomPivotB = new THREE.Vector2(5.5, -14.939231);
  const sourceTopReferenceU = new THREE.Vector2(0.694593, -7.060769);
  const sourceRadiusRodLength = 6.194593;
  const sourceCrosspieceHalfLength = 4;
  const sourceCrosspieceLength = 8;
  const sourcePistonRodLength = 16.125;
  const sourcePistonHeadOffset = -16.625;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const crankCenter = sourceCrankCenter.clone().multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const strokeLine = sourceStrokeLine.map((point) => point.clone()
    .multiplyScalar(sourceScale));
  const topPivotT = sourceTopPivotT.clone().multiplyScalar(sourceScale);
  const bottomPivotB = sourceBottomPivotB.clone().multiplyScalar(sourceScale);
  const topReferenceU = sourceTopReferenceU.clone()
    .multiplyScalar(sourceScale);
  const radiusRodLength = sourceRadiusRodLength * sourceScale;
  const crosspieceHalfLength = sourceCrosspieceHalfLength * sourceScale;
  const crosspieceLength = sourceCrosspieceLength * sourceScale;
  const pistonRodLength = sourcePistonRodLength * sourceScale;
  const pistonHeadOffset = sourcePistonHeadOffset * sourceScale;

  const canvasPositionsAtInputTravel = (inputTravel) => {
    const unwrappedInputAngle = sourceCrankPhaseOffset + inputTravel;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const pointP = crankCenter.clone().add(new THREE.Vector2(
      crankRadius * Math.cos(inputAngle),
      crankRadius * Math.sin(inputAngle),
    ));
    const horizontalOffset = strokeLine[0].x - pointP.x;
    const verticalMagnitude = Math.sqrt(
      connectingRodLength ** 2 - horizontalOffset ** 2,
    );
    const candidateCenters = [
      new THREE.Vector2(strokeLine[0].x, pointP.y + verticalMagnitude),
      new THREE.Vector2(strokeLine[0].x, pointP.y - verticalMagnitude),
    ];
    const strokeMidpoint = strokeLine[0].clone().add(strokeLine[1])
      .multiplyScalar(0.5);
    const pointC = nearestPoint(candidateCenters, strokeMidpoint);
    const pointU = nearestPoint(
      circleCircleIntersections(
        pointC,
        crosspieceHalfLength,
        topPivotT,
        radiusRodLength,
      ),
      topReferenceU,
    );
    const halfCrosspiece = pointU.clone().sub(pointC);
    const pointD = pointC.clone().sub(halfCrosspiece);
    const crosspieceAngle = Math.atan2(
      halfCrosspiece.y,
      halfCrosspiece.x,
    ) - Math.PI / 2;
    const bottomDistance = pointD.distanceTo(bottomPivotB);
    const drawnBottomEndpoint = bottomPivotB.clone().addScaledVector(
      pointD.clone().sub(bottomPivotB).normalize(),
      radiusRodLength,
    );
    return {
      bottomRadiusLengthError: bottomDistance - radiusRodLength,
      crosspieceAngle,
      drawnBottomEndpoint,
      halfCrosspiece,
      inputAngle,
      pointC,
      pointD,
      pointP,
      pointU,
      unwrappedInputAngle,
    };
  };

  const constraintData = (pointC, crosspieceAngle, pointP) => {
    const halfCrosspiece = new THREE.Vector2(
      -crosspieceHalfLength * Math.sin(crosspieceAngle),
      crosspieceHalfLength * Math.cos(crosspieceAngle),
    );
    const halfCrosspieceDerivative = new THREE.Vector2(
      -crosspieceHalfLength * Math.cos(crosspieceAngle),
      -crosspieceHalfLength * Math.sin(crosspieceAngle),
    );
    const pointU = pointC.clone().add(halfCrosspiece);
    const pointD = pointC.clone().sub(halfCrosspiece);
    const connecting = pointC.clone().sub(pointP);
    const topRadius = pointU.clone().sub(topPivotT);
    const bottomRadius = pointD.clone().sub(bottomPivotB);
    const residuals = [
      (connecting.lengthSq() - connectingRodLength ** 2) / 2,
      (topRadius.lengthSq() - radiusRodLength ** 2) / 2,
      (bottomRadius.lengthSq() - radiusRodLength ** 2) / 2,
    ];
    const jacobian = [
      [connecting.x, connecting.y, 0],
      [topRadius.x, topRadius.y,
        topRadius.dot(halfCrosspieceDerivative)],
      [bottomRadius.x, bottomRadius.y,
        -bottomRadius.dot(halfCrosspieceDerivative)],
    ];
    return {
      bottomRadius,
      connecting,
      halfCrosspiece,
      halfCrosspieceDerivative,
      jacobian,
      pointD,
      pointU,
      residuals,
      topRadius,
    };
  };

  const positionsAtInputTravel = (inputTravel) => {
    const canvas = canvasPositionsAtInputTravel(inputTravel);
    const pointC = canvas.pointC.clone();
    let crosspieceAngle = canvas.crosspieceAngle;
    let iterations = 0;
    let data = constraintData(pointC, crosspieceAngle, canvas.pointP);
    for (; iterations < 8; iterations += 1) {
      const maximumResidual = Math.max(
        ...data.residuals.map((value) => Math.abs(value)),
      );
      if (maximumResidual <= 1e-14) break;
      const correction = solveLinear3(
        data.jacobian,
        data.residuals.map((value) => -value),
      );
      pointC.x += correction[0];
      pointC.y += correction[1];
      crosspieceAngle += correction[2];
      data = constraintData(pointC, crosspieceAngle, canvas.pointP);
    }
    if (iterations === 8) {
      throw new Error('Upright-engine visible-loop solver did not converge');
    }
    const maximumLengthResidual = Math.max(
      Math.abs(data.connecting.length() - connectingRodLength),
      Math.abs(data.topRadius.length() - radiusRodLength),
      Math.abs(data.bottomRadius.length() - radiusRodLength),
    );
    return {
      canvas,
      crosspieceAngle,
      halfCrosspiece: data.halfCrosspiece,
      halfCrosspieceDerivative: data.halfCrosspieceDerivative,
      iterations,
      jacobian: data.jacobian,
      maximumLengthResidual,
      pointC,
      pointD: data.pointD,
      pointP: canvas.pointP,
      pointU: data.pointU,
    };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const positions = positionsAtInputTravel(inputTravel);
    const {
      canvas,
      crosspieceAngle,
      halfCrosspiece,
      halfCrosspieceDerivative,
      iterations,
      jacobian,
      maximumLengthResidual,
      pointC,
      pointD,
      pointP,
      pointU,
    } = positions;
    const sine = Math.sin(canvas.inputAngle);
    const cosine = Math.cos(canvas.inputAngle);
    const pointPVelocity = new THREE.Vector2(
      -crankRadius * sine * resolvedInputAngularSpeed,
      crankRadius * cosine * resolvedInputAngularSpeed,
    );
    const pointPAcceleration = new THREE.Vector2(
      -crankRadius * (
        cosine * resolvedInputAngularSpeed ** 2
          + sine * inputAngularAcceleration
      ),
      crankRadius * (
        -sine * resolvedInputAngularSpeed ** 2
          + cosine * inputAngularAcceleration
      ),
    );
    const connecting = pointC.clone().sub(pointP);
    const generalizedVelocity = solveLinear3(jacobian, [
      connecting.dot(pointPVelocity),
      0,
      0,
    ]);
    const pointCVelocity = new THREE.Vector2(
      generalizedVelocity[0],
      generalizedVelocity[1],
    );
    const crosspieceAngularVelocity = generalizedVelocity[2];
    const pointUVelocity = pointCVelocity.clone().addScaledVector(
      halfCrosspieceDerivative,
      crosspieceAngularVelocity,
    );
    const pointDVelocity = pointCVelocity.clone().addScaledVector(
      halfCrosspieceDerivative,
      -crosspieceAngularVelocity,
    );
    const relativeConnectingVelocity = pointCVelocity.clone()
      .sub(pointPVelocity);
    const topRadius = pointU.clone().sub(topPivotT);
    const bottomRadius = pointD.clone().sub(bottomPivotB);
    const generalizedAcceleration = solveLinear3(jacobian, [
      connecting.dot(pointPAcceleration)
        - relativeConnectingVelocity.lengthSq(),
      topRadius.dot(halfCrosspiece) * crosspieceAngularVelocity ** 2
        - pointUVelocity.lengthSq(),
      -bottomRadius.dot(halfCrosspiece) * crosspieceAngularVelocity ** 2
        - pointDVelocity.lengthSq(),
    ]);
    const pointCAcceleration = new THREE.Vector2(
      generalizedAcceleration[0],
      generalizedAcceleration[1],
    );
    const crosspieceAngularAcceleration = generalizedAcceleration[2];
    const pointUAcceleration = pointCAcceleration.clone()
      .addScaledVector(halfCrosspieceDerivative,
        crosspieceAngularAcceleration)
      .addScaledVector(halfCrosspiece,
        -(crosspieceAngularVelocity ** 2));
    const pointDAcceleration = pointCAcceleration.clone()
      .addScaledVector(halfCrosspieceDerivative,
        -crosspieceAngularAcceleration)
      .addScaledVector(halfCrosspiece,
        crosspieceAngularVelocity ** 2);
    const connectingVelocity = pointCVelocity.clone().sub(pointPVelocity);
    const connectingAcceleration = pointCAcceleration.clone()
      .sub(pointPAcceleration);

    return {
      bottomRadiusRod: rigidLinkRates(
        bottomRadius,
        pointDVelocity,
        pointDAcceleration,
      ),
      canvasApproximation: {
        bottomRadiusLengthError: canvas.bottomRadiusLengthError,
        crosspieceAngle: canvas.crosspieceAngle,
        drawnBottomEndpoint: canvas.drawnBottomEndpoint,
        pointC: canvas.pointC,
        pointD: canvas.pointD,
        pointU: canvas.pointU,
      },
      connectingRod: rigidLinkRates(
        connecting,
        connectingVelocity,
        connectingAcceleration,
      ),
      crosspiece: {
        angle: crosspieceAngle,
        angularAcceleration: crosspieceAngularAcceleration,
        angularVelocity: crosspieceAngularVelocity,
      },
      inputAngle: canvas.inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      maximumLengthResidual,
      physicalDifferenceFromCanvas: {
        pointC: pointC.distanceTo(canvas.pointC),
        pointD: pointD.distanceTo(canvas.pointD),
        pointU: pointU.distanceTo(canvas.pointU),
      },
      pointC,
      pointCAcceleration,
      pointCVelocity,
      pointD,
      pointDAcceleration,
      pointDVelocity,
      pointP,
      pointPAcceleration,
      pointPVelocity,
      pointU,
      pointUAcceleration,
      pointUVelocity,
      solverIterations: iterations,
      topRadiusRod: rigidLinkRates(
        topRadius,
        pointUVelocity,
        pointUAcceleration,
      ),
      unwrappedInputAngle: canvas.unwrappedInputAngle,
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

  const sourceStateAtTime = (time) => canvasPositionsAtInputTravel(
    inputAngularSpeed * time,
  );

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

  let maximumCanvasBottomRadiusError = 0;
  let maximumLengthResidual = 0;
  let maximumLateralDeviation = 0;
  let maximumPhysicalDifferenceFromCanvas = 0;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let maximumSolverIterations = 0;
  let minimumCanvasBottomRadiusError = Infinity;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const positions = positionsAtInputTravel(FULL_TURN * sample / 16384);
    maximumCanvasBottomRadiusError = Math.max(
      maximumCanvasBottomRadiusError,
      positions.canvas.bottomRadiusLengthError,
    );
    minimumCanvasBottomRadiusError = Math.min(
      minimumCanvasBottomRadiusError,
      positions.canvas.bottomRadiusLengthError,
    );
    maximumLengthResidual = Math.max(
      maximumLengthResidual,
      positions.maximumLengthResidual,
    );
    maximumLateralDeviation = Math.max(maximumLateralDeviation,
      Math.abs(positions.pointC.x - strokeLine[0].x));
    maximumPhysicalDifferenceFromCanvas = Math.max(
      maximumPhysicalDifferenceFromCanvas,
      positions.pointC.distanceTo(positions.canvas.pointC),
      positions.pointU.distanceTo(positions.canvas.pointU),
      positions.pointD.distanceTo(positions.canvas.pointD),
    );
    maximumPistonX = Math.max(maximumPistonX, positions.pointC.x);
    maximumPistonY = Math.max(maximumPistonY, positions.pointC.y);
    maximumSolverIterations = Math.max(maximumSolverIterations,
      positions.iterations);
    minimumPistonX = Math.min(minimumPistonX, positions.pointC.x);
    minimumPistonY = Math.min(minimumPistonY, positions.pointC.y);
  }

  const geometry = {
    bottomPivotB,
    connectingRodLength,
    crankCenter,
    crankRadius,
    crosspieceHalfLength,
    crosspieceLength,
    cyclePeriod,
    inputAngularSpeed,
    maximumCanvasBottomRadiusError,
    maximumLateralDeviation,
    maximumLengthResidual,
    maximumPhysicalDifferenceFromCanvas,
    maximumPistonX,
    maximumPistonY,
    maximumSolverIterations,
    minimumCanvasBottomRadiusError,
    minimumPistonX,
    minimumPistonY,
    outputStroke: maximumPistonY - minimumPistonY,
    pistonHeadOffset,
    pistonRodLength,
    radiusRodLength,
    sourceCrankPhaseOffset,
    sourceScale,
    strokeLine,
    topPivotT,
    topReferenceU,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const crankMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.59,
  });
  const connectingMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.60,
  });
  const radiusMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const crosspieceMaterial = matte(PALETTE.accent, {
    metalness: 0.09,
    roughness: 0.60,
  });
  const pistonMaterial = matte(0x9a5c92, {
    metalness: 0.08,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-upright-engine-frame-crank-bearing-and-opposed-radius-pivots';
  const framePlaneZ = -0.66;
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(34 * sourceScale, 0.72 * sourceScale, 0.92),
    frameMaterial,
  );
  baseRail.position.set(0, -32.0 * sourceScale, framePlaneZ);
  baseRail.userData.fixed = true;
  baseRail.userData.role = 'fixed-upright-engine-foundation';
  fixedFrame.add(baseRail);

  const framePillars = [-7.12, 7.12].map((sourceX, index) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.72 * sourceScale, 29.0 * sourceScale, 0.84),
      frameMaterial,
    );
    pillar.position.set(sourceX * sourceScale, -17.4 * sourceScale,
      framePlaneZ);
    pillar.userData.fixed = true;
    pillar.userData.role = `fixed-upright-engine-side-pillar-${index + 1}`;
    fixedFrame.add(pillar);
    return pillar;
  });
  const frameTopRails = [-1.75, -3.5].map((sourceY, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(33 * sourceScale, 0.38 * sourceScale, 0.78),
      frameMaterial,
    );
    rail.position.set(0, sourceY * sourceScale, framePlaneZ);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-upper-frame-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const crankBearing = cylinderAlongZ(1.24 * sourceScale, 0.82,
    frameMaterial, 44);
  crankBearing.position.set(0, 0, -0.28);
  crankBearing.geometry.dispose();
  crankBearing.geometry = boredCylinderGeometry(1.24 * sourceScale, .42 * sourceScale + .004, .82);
  crankBearing.userData.fixed = true;
  crankBearing.userData.role = 'fixed-main-crank-bearing';
  const crankShaft = cylinderAlongZ(0.42 * sourceScale, 2.3,
    darkMaterial, 36);
  crankShaft.position.set(0, 0, -.65);
  crankShaft.userData.fixed = true;
  crankShaft.userData.role = 'fixed-crankshaft-axis';
  const crankPedestal = new THREE.Mesh(new THREE.BoxGeometry(.30, .20, .72), frameMaterial);
  crankPedestal.position.set(0, -.33, -.38);
  crankPedestal.userData.role = 'main-bearing-pedestal-on-upper-frame-rail';
  fixedFrame.add(crankBearing, crankShaft, crankPedestal);

  const makePivotBearing = (center, prefix, planeZ) => {
    const bearing = cylinderAlongZ(0.78 * sourceScale, 0.64,
      frameMaterial, 38);
    bearing.position.set(center.x, center.y, .35);
    bearing.geometry.dispose();
    bearing.geometry = boredCylinderGeometry(.78 * sourceScale, .27 * sourceScale + .004, .64);
    bearing.userData.fixed = true;
    bearing.userData.role = `fixed-${prefix}-bearing`;
    const shaft = cylinderAlongZ(0.27 * sourceScale, 1.42,
      darkMaterial, 30);
    shaft.position.set(center.x, center.y, .38);
    shaft.userData.fixed = true;
    shaft.userData.role = `fixed-${prefix}-shaft`;
    const support = new THREE.Mesh(new THREE.BoxGeometry(.50, .15, .90), frameMaterial);
    support.position.set(center.x + Math.sign(center.x) * .13, center.y - .175, -.06);
    support.userData.role = `fixed-${prefix}-bearing-support-to-pillar`;
    fixedFrame.add(bearing, shaft, support);
    return { bearing, shaft, support };
  };
  const topPivotBearing = makePivotBearing(topPivotT,
    'upper-radius-pivot-T', 0.55);
  const bottomPivotBearing = makePivotBearing(bottomPivotB,
    'lower-radius-pivot-B', 0.73);

  const cylinderTopY = -21.1 * sourceScale;
  const cylinderBottomY = -31.9 * sourceScale;
  const cylinderHalfWidth = 3.5 * sourceScale;
  const cylinderWalls = [-1, 1].map((side, index) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 * sourceScale,
        cylinderTopY - cylinderBottomY, 0.76),
      frameMaterial,
    );
    wall.position.set(side * cylinderHalfWidth,
      (cylinderTopY + cylinderBottomY) / 2, framePlaneZ);
    wall.userData.fixed = true;
    wall.userData.role = `upright-engine-cylinder-wall-${index + 1}`;
    fixedFrame.add(wall);
    return wall;
  });
  const cylinderTopLips = [-1, 1].map((side, index) => {
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(0.62 * sourceScale, 0.48 * sourceScale, 0.94),
      frameMaterial,
    );
    lip.position.set(side * cylinderHalfWidth, cylinderTopY, framePlaneZ);
    lip.userData.fixed = true;
    lip.userData.role = `upright-cylinder-top-lip-${index + 1}`;
    fixedFrame.add(lip);
    return lip;
  });
  const cylinderBottom = new THREE.Mesh(
    new THREE.BoxGeometry(7.5 * sourceScale, 0.64 * sourceScale, 0.86),
    frameMaterial,
  );
  cylinderBottom.position.set(0, cylinderBottomY, framePlaneZ);
  cylinderBottom.userData.fixed = true;
  cylinderBottom.userData.role = 'upright-engine-cylinder-bottom';
  fixedFrame.add(cylinderBottom);
  const pistonGuides = [-0.72, 0.72].map((sourceX, index) => {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * sourceScale, 4.5 * sourceScale, 0.44),
      frameMaterial,
    );
    guide.position.set(sourceX * sourceScale, -18.7 * sourceScale, -0.34);
    guide.userData.fixed = true;
    guide.userData.role = `upright-piston-rod-guide-${index + 1}`;
    fixedFrame.add(guide);
    return guide;
  });
  root.add(fixedFrame);

  const inputCrank = new THREE.Group();
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role =
    'three-point-five-unit-crank-and-large-upright-engine-flywheel';
  const flywheel = new THREE.Mesh(
    new THREE.TorusGeometry(11.25 * sourceScale, 0.48 * sourceScale,
      12, 96),
    crankMaterial,
  );
  flywheel.position.z = -1.3;
  flywheel.userData.role = 'large-twelve-unit-upright-engine-flywheel';
  const flywheelHub = cylinderAlongZ(1.50 * sourceScale, 0.48,
    crankMaterial, 42);
  flywheelHub.position.z = -1.3;
  flywheelHub.geometry.dispose();
  flywheelHub.geometry = boredCylinderGeometry(1.50 * sourceScale, .42 * sourceScale + .004, .48);
  flywheelHub.userData.role = 'moving-flywheel-hub';
  const flywheelSpokes = Array.from({ length: 8 }, (_, index) => {
    const angle = FULL_TURN * index / 8;
    const inner = new THREE.Vector3(
      1.6 * sourceScale * Math.cos(angle),
      1.6 * sourceScale * Math.sin(angle),
      -1.3,
    );
    const outer = new THREE.Vector3(
      10.7 * sourceScale * Math.cos(angle),
      10.7 * sourceScale * Math.sin(angle),
      -1.3,
    );
    const spoke = beamBetween3D(inner, outer, 0.34 * sourceScale,
      0.18, crankMaterial);
    spoke.userData.role = `flywheel-spoke-${index + 1}`;
    inputCrank.add(spoke);
    return spoke;
  });
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius - .14, 0.58 * sourceScale, 0.28),
    crankMaterial,
  );
  crankArm.position.set(crankRadius / 2 + .07, 0, 0.37);
  crankArm.userData.role = 'crank-arm-from-O-to-P';
  const crankPinBoss = cylinderAlongZ(0.52 * sourceScale, 0.42,
    crankMaterial, 34);
  crankPinBoss.position.set(crankRadius, 0, 0.37);
  crankPinBoss.userData.role = 'moving-crank-pin-boss-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, 0.37);
  crankPinAnchor.userData.role = 'analytic-crank-pin-P';
  inputCrank.add(
    flywheel,
    flywheelHub,
    crankArm,
    crankPinBoss,
    crankPinAnchor,
  );
  const crankHub = cylinderAlongZ(.22, .28, crankMaterial);
  crankHub.geometry.dispose();
  crankHub.geometry = boredCylinderGeometry(.22, .42 * sourceScale + .004, .28);
  crankHub.position.z = .37;
  crankHub.userData.role = 'bored-crank-hub-joining-arm-to-main-shaft';
  inputCrank.add(crankHub);
  root.add(inputCrank);

  const connectingParts = makeRigidRod({
    bodyMaterial: connectingMaterial,
    depth: 0.20,
    eyeMaterial: darkMaterial,
    length: connectingRodLength,
    planeZ: .70,
    boreRadius: .19 * sourceScale + .004,
    role: 'ten-point-seven-five-unit-connecting-rod-P-C',
    width: 0.48 * sourceScale,
  });
  root.add(connectingParts.rod);

  const topRadiusParts = makeRigidRod({
    bodyMaterial: radiusMaterial,
    depth: .16,
    eyeMaterial: darkMaterial,
    length: radiusRodLength,
    planeZ: .92,
    boreRadius: .18 * sourceScale + .004,
    startBoreRadius: .27 * sourceScale + .004,
    role: 'upper-equal-radius-rod-A-from-fixed-T-to-U',
    width: 0.44 * sourceScale,
  });
  root.add(topRadiusParts.rod);

  const bottomRadiusParts = makeRigidRod({
    bodyMaterial: radiusMaterial,
    depth: .16,
    eyeMaterial: darkMaterial,
    length: radiusRodLength,
    planeZ: .92,
    boreRadius: .18 * sourceScale + .004,
    startBoreRadius: .27 * sourceScale + .004,
    role: 'lower-equal-radius-rod-A-from-fixed-B-to-D',
    width: 0.44 * sourceScale,
  });
  root.add(bottomRadiusParts.rod);

  const crosspiece = new THREE.Group();
  crosspiece.userData.role =
    'eight-unit-vibrating-crosspiece-U-C-D-on-piston-rod';
  const crosspieceBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.68 * sourceScale, crosspieceLength, 0.28),
    crosspieceMaterial,
  );
  crosspieceBody.geometry.dispose();
  const crosspieceOutline = clip.union(capsule([0, -crosspieceHalfLength], [0, crosspieceHalfLength], .34 * sourceScale),
    ...[-crosspieceHalfLength, 0, crosspieceHalfLength].map(y => poly(circle([0, y], .58 * sourceScale, 64))));
  crosspieceBody.geometry = plate(clip.difference(crosspieceOutline,
    ...[-crosspieceHalfLength, 0, crosspieceHalfLength].map(y => poly(circle([0, y], .19 * sourceScale + .004, 64)))), -.09, .09);
  crosspieceBody.position.z = 1.15;
  crosspieceBody.userData.role = 'rigid-upright-engine-vibrating-piece';
  const crosspieceAnchors = {};
  const crosspieceBosses = {};
  for (const [name, y] of [
    ['U', crosspieceHalfLength],
    ['C', 0],
    ['D', -crosspieceHalfLength],
  ]) {
    const boss = cylinderAlongZ((name === 'C' ? 0.58 : 0.48) * sourceScale,
      .18, crosspieceMaterial, 32);
    boss.geometry.dispose();
    boss.geometry = boredCylinderGeometry((name === 'C' ? .58 : .48) * sourceScale, .19 * sourceScale + .004, .18);
    boss.position.set(0, y, 1.15);
    boss.userData.role = `vibrating-crosspiece-boss-${name}`;
    const anchor = new THREE.Object3D();
    anchor.position.set(0, y, 1.15);
    anchor.userData.role = `analytic-crosspiece-point-${name}`;
    crosspiece.add(boss, anchor);
    crosspieceBosses[name] = boss;
    crosspieceAnchors[name] = anchor;
  }
  crosspiece.add(crosspieceBody);
  root.add(crosspiece);

  const pistonOutput = new THREE.Group();
  pistonOutput.userData.rotationDegreesOfFreedom = 0;
  pistonOutput.userData.role =
    'nearly-vertical-upright-piston-rod-carried-at-crosspiece-center-C';
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.38 * sourceScale, -pistonHeadOffset - .09, 0.22),
    pistonMaterial,
  );
  pistonRod.position.set(0, (pistonHeadOffset - .09) / 2, 1.40);
  pistonRod.userData.role = 'upright-engine-piston-rod-below-C';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(6.1 * sourceScale, 0.92 * sourceScale, 0.68),
    pistonMaterial,
  );
  pistonHead.position.set(0, pistonHeadOffset, 1.40);
  pistonHead.userData.role = 'upright-engine-piston-head';
  const pistonTopAnchor = new THREE.Object3D();
  pistonTopAnchor.position.z = 1.40;
  pistonTopAnchor.userData.role = 'analytic-piston-rod-top-C';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, pistonHeadOffset, 1.40);
  pistonHeadAnchor.userData.role = 'analytic-upright-piston-head-center';
  pistonOutput.add(
    pistonRod,
    pistonHead,
    pistonTopAnchor,
    pistonHeadAnchor,
  );
  const pistonTopEye = cylinderAlongZ(.13, .22, pistonMaterial);
  pistonTopEye.geometry.dispose();
  pistonTopEye.geometry = boredCylinderGeometry(.13, .19 * sourceScale + .004, .22);
  pistonTopEye.position.z = 1.40;
  pistonTopEye.userData.role = 'bored-piston-top-eye-at-C';
  pistonOutput.add(pistonTopEye);
  for (const part of [...cylinderWalls, ...cylinderTopLips, cylinderBottom, ...pistonGuides]) part.position.z = 1.40;
  const cylinderFeet = [-1, 1].map(side => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.22, .10, 2.1), frameMaterial);
    foot.position.set(side * cylinderHalfWidth, -32 * sourceScale, .37);
    foot.userData.role = 'depth-foot-joining-cylinder-to-foundation'; fixedFrame.add(foot); return foot;
  });
  root.add(pistonOutput);

  const jointPins = {
    C: cylinderAlongZ(0.19 * sourceScale, 1.10, whiteMaterial, 26),
    D: cylinderAlongZ(0.18 * sourceScale, .60, whiteMaterial, 26),
    P: cylinderAlongZ(0.19 * sourceScale, .70, whiteMaterial, 26),
    U: cylinderAlongZ(0.18 * sourceScale, .60, whiteMaterial, 26),
  };
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
    root.add(pin);
  });

  const contacts = {
    crankAtP: {
      members: [inputCrank, connectingParts.rod],
      point: new THREE.Vector3(),
      type: 'crank-to-connecting-rod-pin-P',
    },
    crosspieceAtC: {
      members: [connectingParts.rod, crosspiece, pistonOutput],
      point: new THREE.Vector3(),
      type: 'connecting-rod-crosspiece-piston-common-pin-C',
    },
    crosspieceAtD: {
      members: [crosspiece, bottomRadiusParts.rod],
      point: new THREE.Vector3(),
      type: 'crosspiece-to-lower-radius-rod-pin-D',
    },
    crosspieceAtU: {
      members: [crosspiece, topRadiusParts.rod],
      point: new THREE.Vector3(),
      type: 'crosspiece-to-upper-radius-rod-pin-U',
    },
    lowerRadiusPivotB: {
      fixedMember: fixedFrame,
      movingMember: bottomRadiusParts.rod,
      point: new THREE.Vector3(bottomPivotB.x, bottomPivotB.y, 0.79),
      type: 'fixed-lower-radius-rod-pivot-B',
    },
    upperRadiusPivotT: {
      fixedMember: fixedFrame,
      movingMember: topRadiusParts.rod,
      point: new THREE.Vector3(topPivotT.x, topPivotT.y, 0.61),
      type: 'fixed-upper-radius-rod-pivot-T',
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
    inputCrank.rotation.z = state.inputAngle;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputCrank.userData.angularAcceleration = state.inputAngularAcceleration;
    setRodPose(connectingParts.rod, state.pointP, state.connectingRod);
    setRodPose(topRadiusParts.rod, topPivotT, state.topRadiusRod);
    setRodPose(bottomRadiusParts.rod, bottomPivotB,
      state.bottomRadiusRod);
    crosspiece.position.set(state.pointC.x, state.pointC.y, 0);
    crosspiece.rotation.z = state.crosspiece.angle;
    crosspiece.userData.angularSpeed = state.crosspiece.angularVelocity;
    crosspiece.userData.angularAcceleration =
      state.crosspiece.angularAcceleration;
    pistonOutput.position.set(state.pointC.x, state.pointC.y, 0);
    pistonOutput.userData.velocity = new THREE.Vector3(
      state.pointCVelocity.x,
      state.pointCVelocity.y,
      0,
    );
    pistonOutput.userData.acceleration = new THREE.Vector3(
      state.pointCAcceleration.x,
      state.pointCAcceleration.y,
      0,
    );
    const points = {
      C: [state.pointC, 1.05],
      D: [state.pointD, 1.08],
      P: [state.pointP, .55],
      U: [state.pointU, 1.08],
    };
    Object.entries(points).forEach(([name, [point, z]]) => {
      jointPins[name].position.set(point.x, point.y, z);
    });
    contacts.crankAtP.point.set(state.pointP.x, state.pointP.y, 0.43);
    contacts.crosspieceAtC.point.set(state.pointC.x, state.pointC.y, 0.65);
    contacts.crosspieceAtD.point.set(state.pointD.x, state.pointD.y, 0.80);
    contacts.crosspieceAtU.point.set(state.pointU.x, state.pointU.y, 0.66);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-15, -26);
  const officialViewWidth = 30;
  const officialViewHeight = 30;
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
    'opposed-equal-radius-rods-vibrating-crosspiece-upright-engine-parallel-motion';
  root.userData.blocks = {
    baseRail,
    bottomPivotBearing,
    bottomRadiusRod: bottomRadiusParts.rod,
    bottomRadiusRodEndAnchor: bottomRadiusParts.endAnchor,
    bottomRadiusRodStartAnchor: bottomRadiusParts.startAnchor,
    connectingRod: connectingParts.rod,
    connectingRodEndAnchor: connectingParts.endAnchor,
    connectingRodStartAnchor: connectingParts.startAnchor,
    crankArm,
    crankHub,
    pistonTopEye,
    crankBearing,
    crankPinAnchor,
    crankPinBoss,
    crankShaft,
    crosspiece,
    crosspieceAnchors,
    crosspieceBody,
    crosspieceBosses,
    cylinderBottom,
    cylinderFeet,
    cylinderTopLips,
    cylinderWalls,
    fixedFrame,
    flywheel,
    flywheelHub,
    flywheelSpokes,
    framePillars,
    frameTopRails,
    inputCrank,
    jointPins,
    pistonGuides,
    pistonHead,
    pistonHeadAnchor,
    pistonOutput,
    pistonRod,
    pistonTopAnchor,
    topPivotBearing,
    topRadiusRod: topRadiusParts.rod,
    topRadiusRodEndAnchor: topRadiusParts.endAnchor,
    topRadiusRodStartAnchor: topRadiusParts.startAnchor,
  };
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-16.8 * sourceScale, -32.8 * sourceScale, -1.15),
    new THREE.Vector3(16.8 * sourceScale, 12.8 * sourceScale, 1.18),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating 3.5-unit crank and flywheel',
    mechanism: 1,
    output:
      'crosspiece midpoint C carries the upright piston on its genuine near-vertical locus',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -7.62;
  root.userData.mechanism =
    'crank-O-P-connecting-rod-P-C-vibrating-crosspiece-U-C-D-upper-radius-T-U-lower-radius-B-D-and-piston-at-C';
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
      'add_c_rod',
      'add_c_rod_r',
      'add_rot_to',
      'add_rot_to',
      'add_tx',
      'add_text',
    ],
    officialGeometry: {
      bottomPivotB: sourceBottomPivotB,
      connectingRodLength: sourceConnectingRodLength,
      crankCenter: sourceCrankCenter,
      crankPhaseOffsetTurns: 0.875,
      crankRadius: sourceCrankRadius,
      crosspieceHalfLength: sourceCrosspieceHalfLength,
      crosspieceLength: sourceCrosspieceLength,
      pistonHeadOffset: sourcePistonHeadOffset,
      pistonRodLength: sourcePistonRodLength,
      radiusRodLength: sourceRadiusRodLength,
      strokeLine: sourceStrokeLine,
      topPivotT: sourceTopPivotT,
      topReferenceU: sourceTopReferenceU,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      canvasBottomRadiusMaximumExtensionSource:
        maximumCanvasBottomRadiusError / sourceScale,
      canvasBottomRadiusMaximumShorteningSource:
        minimumCanvasBottomRadiusError / sourceScale,
      maximumVisiblePointCorrectionSource:
        maximumPhysicalDifferenceFromCanvas / sourceScale,
      reason:
        'the sequential canvas forces C onto x=0, closes only T-U, and then aims the fixed-length lower radius rod from B toward D without closing it',
    },
    referenceScope:
      'official 3.5-unit crank, 10.75-unit connecting rod, eight-unit vibrating crosspiece, both equal A radius rods, piston, frame, source view, phase, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate343: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'two equal radius rods A connect opposite frame pivots to the upper and lower ends of one short vibrating piece centered on the upright piston rod',
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
  root.userData.sourceStateAtTime = sourceStateAtTime;
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    canvasDefect:
      'the source lower A rod can be 0.057643 source unit short or 0.059309 source unit long relative to point D',
    exactRigidConstraints:
      '|O-P|=3.5, |P-C|=10.75, |U-C|=|C-D|=4, and |T-U|=|B-D|=6.194593 source units',
    input:
      'the flywheel crank P drives crosspiece midpoint C through one finite connecting rod',
    output:
      'the exactly closed double-radius linkage guides C through a seven-unit near-vertical piston stroke',
  };

  fitPistonGuide(root, update, cyclePeriod);
  root.userData.cameraFov = 8;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(.6, .3, 14),
    root,
    update,
  };
}

export function createAuthoredUprightEngineParallelMotion(movement) {
  switch (movement.id) {
    case 343: return opposedRadiusRodUprightEngine(movement);
    default: return null;
  }
}
