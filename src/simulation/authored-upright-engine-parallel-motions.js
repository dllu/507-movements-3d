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

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-upright-engine-frame-crank-bearing-and-opposed-radius-pivots';
  // Brown's plate is the official 30 x 30 view: a planked floor over one deep
  // solid cross-beam (plate y -1.71 to -4.86 source units, the flywheel
  // passing behind it), thin capital plates under the beam on two columns,
  // the crank box on the planks, and the cylinder top.
  const framePlaneZ = -0.66;
  const frameDepth = 0.78;
  const frameBox = (minX, maxX, minY, maxY, depth, role) => {
    const part = new THREE.Mesh(
      new THREE.BoxGeometry((maxX - minX) * sourceScale,
        (maxY - minY) * sourceScale, depth),
      frameMaterial,
    );
    part.position.set((minX + maxX) / 2 * sourceScale,
      (minY + maxY) / 2 * sourceScale, framePlaneZ);
    part.userData.fixed = true;
    part.userData.role = role;
    fixedFrame.add(part);
    return part;
  };
  const frameTopRails = [
    [-2.69, -1.71, 'fixed-upper-cross-beam-carrying-crank-box'],
    [-4.86, -2.69, 'fixed-lower-cross-beam-on-column-capitals'],
  ].map(([minY, maxY, role]) => frameBox(-16.5, 16.5, minY, maxY, frameDepth, role));
  const columnCenterX = 7.45;
  const columnHalfWidth = 1.2;
  const columnBottomY = -27.0;
  const framePillars = [-1, 1].map((side, index) => frameBox(
    side * columnCenterX - columnHalfWidth, side * columnCenterX + columnHalfWidth,
    columnBottomY, -5.43, 0.84, `fixed-upright-engine-column-${index + 1}`));
  const columnCapitals = [-1, 1].map((side, index) => frameBox(
    side * columnCenterX - 2.0, side * columnCenterX + 2.0, -5.43, -4.86,
    frameDepth, `fixed-column-capital-under-cross-beam-${index + 1}`));
  const crankBoxShape = new THREE.Shape([
    new THREE.Vector2(-3.0 * sourceScale, -1.71 * sourceScale),
    new THREE.Vector2(2.9 * sourceScale, -1.71 * sourceScale),
    new THREE.Vector2(2.9 * sourceScale, 2.46 * sourceScale),
    new THREE.Vector2(-3.0 * sourceScale, 2.46 * sourceScale),
  ]);
  const crankBoxBore = new THREE.Path();
  crankBoxBore.absarc(0, 0, .42 * sourceScale + .004, 0, FULL_TURN, true);
  crankBoxShape.holes.push(crankBoxBore);
  const crankBearing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(crankBoxShape, {
      bevelEnabled: false, curveSegments: 40, depth: 0.82,
    }).translate(0, 0, -0.41),
    frameMaterial,
  );
  crankBearing.position.set(0, 0, -0.28);
  crankBearing.userData.fixed = true;
  crankBearing.userData.role = 'fixed-crank-box-on-upper-cross-beam';
  const crankShaft = cylinderAlongZ(0.42 * sourceScale, 2.3,
    darkMaterial, 36);
  crankShaft.position.set(0, 0, -.65);
  crankShaft.userData.fixed = true;
  crankShaft.userData.role = 'fixed-crankshaft-axis';
  fixedFrame.add(crankBearing, crankShaft);

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

  // Only the cylinder top is in the plate: gland, neck and cover on a round
  // barrel whose lower end is below the plate edge.
  const cylinderAxisZ = 1.40;
  const rodBore = Math.hypot(.19 * sourceScale, .11) + .012;
  const pistonBore = 3.05 * sourceScale + .012;
  const cylinderTopY = -22.0 * sourceScale;
  const coverBottomY = -23.14 * sourceScale;
  const cylinderBottomY = -31.9 * sourceScale;
  const cylinderPart = (radius, bore, topY, bottomY, role) => {
    const part = new THREE.Mesh(
      boredCylinderGeometry(radius * sourceScale, bore, topY - bottomY),
      frameMaterial,
    );
    part.position.set(0, (topY + bottomY) / 2, cylinderAxisZ);
    part.userData.fixed = true;
    part.userData.role = role;
    fixedFrame.add(part);
    return part;
  };
  const cylinderGland = cylinderPart(1.7, rodBore, -20.0 * sourceScale,
    -21.14 * sourceScale, 'upright-cylinder-piston-rod-gland');
  const cylinderNeck = cylinderPart(1.0, rodBore, -21.14 * sourceScale + .01,
    cylinderTopY - .01, 'upright-cylinder-gland-neck');
  const cylinderTop = cylinderPart(5.43, rodBore, cylinderTopY, coverBottomY,
    'upright-engine-cylinder-top-cover');
  const cylinderBody = cylinderPart(4.3, pistonBore, coverBottomY + .01,
    cylinderBottomY, 'upright-engine-cylinder-barrel');
  const cylinderBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(4.3 * sourceScale, 4.3 * sourceScale, .14, 64),
    frameMaterial,
  );
  cylinderBottom.position.set(0, cylinderBottomY - .07, cylinderAxisZ);
  cylinderBottom.userData.fixed = true;
  cylinderBottom.userData.role = 'upright-engine-cylinder-bottom-below-plate';
  fixedFrame.add(cylinderBottom);
  root.add(fixedFrame);

  const inputCrank = new THREE.Group();
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role =
    'three-point-five-unit-crank-and-large-upright-engine-flywheel';
  // The plate's flywheel rim is a flat band about 13-14.8 units out, seen
  // only below the beam and at the top corners; its four arms sit at these
  // angles from crank A in the plate pose.
  const flywheelPlaneZ = -1.3;
  const flywheelInnerRadius = 13.0 * sourceScale;
  const flywheelOuterRadius = 14.8 * sourceScale;
  const flywheelShape = new THREE.Shape();
  flywheelShape.absarc(0, 0, flywheelOuterRadius, 0, FULL_TURN, false);
  const flywheelHole = new THREE.Path();
  flywheelHole.absarc(0, 0, flywheelInnerRadius, 0, FULL_TURN, true);
  flywheelShape.holes.push(flywheelHole);
  const flywheel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(flywheelShape, {
      bevelEnabled: false, curveSegments: 128, depth: 0.20,
    }).translate(0, 0, -0.10),
    crankMaterial,
  );
  flywheel.position.z = flywheelPlaneZ;
  flywheel.userData.role = 'large-upright-engine-flywheel-rim';
  const flywheelHub = cylinderAlongZ(1.50 * sourceScale, 0.48,
    crankMaterial, 42);
  flywheelHub.position.z = flywheelPlaneZ;
  flywheelHub.geometry.dispose();
  flywheelHub.geometry = boredCylinderGeometry(1.50 * sourceScale, .42 * sourceScale + .012, .48);
  flywheelHub.userData.role = 'moving-flywheel-hub';
  const flywheelSpokes = [-30, 60, 150, -120].map((degrees, index) => {
    const angle = THREE.MathUtils.degToRad(degrees);
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const spoke = beamBetween3D(
      direction.clone().multiplyScalar(1.4 * sourceScale).setZ(flywheelPlaneZ),
      direction.clone().multiplyScalar(13.2 * sourceScale).setZ(flywheelPlaneZ),
      1.0 * sourceScale, 0.16, crankMaterial);
    spoke.userData.role = `flywheel-arm-${index + 1}`;
    inputCrank.add(spoke);
    return spoke;
  });
  const crankLean = Math.asin((1.0 - 0.6) * sourceScale / crankRadius);
  const crankShape = new THREE.Shape();
  crankShape.absarc(0, 0, 1.0 * sourceScale, Math.PI / 2 - crankLean,
    Math.PI * 3 / 2 + crankLean, false);
  crankShape.absarc(crankRadius, 0, 0.6 * sourceScale, -Math.PI / 2 + crankLean,
    Math.PI / 2 - crankLean, false);
  crankShape.closePath();
  const crankArmHole = new THREE.Path();
  crankArmHole.absarc(0, 0, .42 * sourceScale + .012, 0, FULL_TURN, true);
  crankShape.holes.push(crankArmHole);
  const crankArm = new THREE.Mesh(
    new THREE.ExtrudeGeometry(crankShape, {
      bevelEnabled: false, curveSegments: 32, depth: 0.28,
    }).translate(0, 0, -0.14),
    crankMaterial,
  );
  crankArm.position.z = 0.37;
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
  crankHub.geometry = boredCylinderGeometry(.22, .42 * sourceScale + .012, .28);
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
    boreRadius: .19 * sourceScale + .012,
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
    boreRadius: .18 * sourceScale + .012,
    startBoreRadius: .27 * sourceScale + .012,
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
    boreRadius: .18 * sourceScale + .012,
    startBoreRadius: .27 * sourceScale + .012,
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
    ...[-crosspieceHalfLength, 0, crosspieceHalfLength].map(y => poly(circle([0, y], .19 * sourceScale + .012, 64)))), -.09, .09);
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
    boss.geometry = boredCylinderGeometry((name === 'C' ? .58 : .48) * sourceScale, .19 * sourceScale + .012, .18);
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
    new THREE.CylinderGeometry(3.05 * sourceScale, 3.05 * sourceScale,
      0.92 * sourceScale, 64),
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
  root.add(pistonOutput);

  // Each pin is fast in one member and runs in bores of the others.
  const jointPins = {
    C: cylinderAlongZ(0.19 * sourceScale, .98, darkMaterial, 26),
    D: cylinderAlongZ(0.18 * sourceScale, .42, darkMaterial, 26),
    P: cylinderAlongZ(0.19 * sourceScale, .56, darkMaterial, 26),
    U: cylinderAlongZ(0.18 * sourceScale, .42, darkMaterial, 26),
  };
  jointPins.P.position.set(crankRadius, 0, .58);
  inputCrank.add(jointPins.P);
  jointPins.C.position.set(0, 0, 1.03);
  pistonOutput.add(jointPins.C);
  jointPins.U.position.set(radiusRodLength, 0, 1.05);
  topRadiusParts.rod.add(jointPins.U);
  jointPins.D.position.set(radiusRodLength, 0, 1.05);
  bottomRadiusParts.rod.add(jointPins.D);
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
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
    columnCapitals,
    cylinderBody,
    cylinderBottom,
    cylinderGland,
    cylinderNeck,
    cylinderTop,
    fixedFrame,
    flywheel,
    flywheelHub,
    flywheelSpokes,
    framePillars,
    frameTopRails,
    inputCrank,
    jointPins,
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
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  // Brown's plate crops just above the crank box, through the flywheel,
  // and just below the cylinder cover (75.8 plate px per unit, measured
  // from the column spacing: x -3.43..3.5, y -5.97..0.86); the box is
  // inset by the engine's fit margin and depth allowance (about 1.125).
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.05, -5.59, -1.45),
    new THREE.Vector3(3.11, 0.48, 2.7),
  );
  root.userData.cameraDistanceScale = 0.96;
  root.userData.cameraFov = 8;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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
