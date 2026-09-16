import * as THREE from 'three';
import { makeBoredLinkRod as makeRigidRod } from './bored-link-rod.js';
import { fitPistonGuide } from './piston-guide-parts.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
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
      throw new Error('Singular three-constraint linkage Jacobian');
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


function directActionEngineParallelMotion(movement) {
  const root = new THREE.Group();

  // B is confined to the horizontal slot D, C is confined to the vertical
  // piston line, and BC is a fifteen-unit rigid bar. Their guide lines meet
  // at fixed pivot F. Therefore triangle BFC is right-angled at F and its
  // hypotenuse midpoint A is exactly 7.5 units from F for every position.
  // This is the complete geometrical reason the radius bar F-A closes.
  const sourceScale = 0.255;
  const sourceCrankCenterO = new THREE.Vector2(0, 0);
  const sourceCrankPinLocalP = new THREE.Vector2(0, -4);
  const sourceCrankRadius = 4;
  const sourceConnectingRodLength = 14;
  const sourcePistonLineX = 0;
  const sourcePistonStrokeLine = [
    new THREE.Vector2(0, -24.5),
    new THREE.Vector2(0, -26.5),
  ];
  const sourceSliderLineD = [
    new THREE.Vector2(-16, -14),
    new THREE.Vector2(-18, -14),
  ];
  const sourceSliderLineY = -14;
  const sourceBarBCLength = 15;
  const sourceMidpointDistance = 7.5;
  const sourceRadiusPivotF = new THREE.Vector2(0, -14);
  const sourceRadiusBarLength = 7.5;
  const sourcePistonRodLocalShoulderY = -14.875;
  const sourcePistonRodLocalEndY = -16.375;
  const sourceInputPhaseOffset = -FULL_TURN / 4;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const crankCenterO = sourceCrankCenterO.clone()
    .multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const pistonLineX = sourcePistonLineX * sourceScale;
  const sliderLineY = sourceSliderLineY * sourceScale;
  const barBCLength = sourceBarBCLength * sourceScale;
  const midpointDistance = sourceMidpointDistance * sourceScale;
  const radiusPivotF = sourceRadiusPivotF.clone()
    .multiplyScalar(sourceScale);
  const radiusBarLength = sourceRadiusBarLength * sourceScale;

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const unwrappedInputAngle = sourceInputPhaseOffset + inputTravel;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pointP = crankCenterO.clone().add(new THREE.Vector2(
      crankRadius * cosine,
      crankRadius * sine,
    ));
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

    const horizontalToPistonLine = pistonLineX - pointP.x;
    const connectingVertical = Math.sqrt(
      connectingRodLength ** 2 - horizontalToPistonLine ** 2,
    );
    const pointC = new THREE.Vector2(
      pistonLineX,
      pointP.y - connectingVertical,
    );
    const connectingFromP = pointC.clone().sub(pointP);
    const pointCVelocity = new THREE.Vector2(
      0,
      connectingFromP.dot(pointPVelocity) / connectingFromP.y,
    );
    const connectingRelativeVelocity = pointCVelocity.clone()
      .sub(pointPVelocity);
    const pointCAcceleration = new THREE.Vector2(
      0,
      (
        connectingFromP.dot(pointPAcceleration)
          - connectingRelativeVelocity.lengthSq()
      ) / connectingFromP.y,
    );

    const verticalToSliderLine = sliderLineY - pointC.y;
    const barHorizontal = Math.sqrt(
      barBCLength ** 2 - verticalToSliderLine ** 2,
    );
    const pointB = new THREE.Vector2(
      pointC.x - barHorizontal,
      sliderLineY,
    );
    const barFromC = pointB.clone().sub(pointC);
    const pointBVelocity = new THREE.Vector2(
      barFromC.dot(pointCVelocity) / barFromC.x,
      0,
    );
    const barRelativeVelocity = pointBVelocity.clone()
      .sub(pointCVelocity);
    const pointBAcceleration = new THREE.Vector2(
      (
        barFromC.dot(pointCAcceleration)
          - barRelativeVelocity.lengthSq()
      ) / barFromC.x,
      0,
    );

    const pointA = pointB.clone().add(pointC).multiplyScalar(0.5);
    const pointAVelocity = pointBVelocity.clone().add(pointCVelocity)
      .multiplyScalar(0.5);
    const pointAAcceleration = pointBAcceleration.clone()
      .add(pointCAcceleration).multiplyScalar(0.5);
    const barVector = pointC.clone().sub(pointB);
    const barVelocity = pointCVelocity.clone().sub(pointBVelocity);
    const barAcceleration = pointCAcceleration.clone()
      .sub(pointBAcceleration);
    const radiusVector = pointA.clone().sub(radiusPivotF);
    const connectingVelocity = pointCVelocity.clone().sub(pointPVelocity);
    const connectingAcceleration = pointCAcceleration.clone()
      .sub(pointPAcceleration);
    const radiusDeflectionFromLeft = Math.atan2(
      -radiusVector.y,
      -radiusVector.x,
    );

    return {
      barBC: rigidLinkRates(barVector, barVelocity, barAcceleration),
      connectingRod: rigidLinkRates(
        connectingFromP,
        connectingVelocity,
        connectingAcceleration,
      ),
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      pointA,
      pointAAcceleration,
      pointAVelocity,
      pointB,
      pointBAcceleration,
      pointBVelocity,
      pointC,
      pointCAcceleration,
      pointCVelocity,
      pointP,
      pointPAcceleration,
      pointPVelocity,
      radiusBar: rigidLinkRates(
        radiusVector,
        pointAVelocity,
        pointAAcceleration,
      ),
      radiusClosureResidual: pointA.distanceTo(radiusPivotF)
        - radiusBarLength,
      radiusDeflectionFromLeft,
      rightAngleDot: pointB.clone().sub(radiusPivotF)
        .dot(pointC.clone().sub(radiusPivotF)),
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

  let maximumPistonY = -Infinity;
  let minimumPistonY = Infinity;
  let maximumSliderX = -Infinity;
  let minimumSliderX = Infinity;
  let maximumRadiusClosureResidual = 0;
  let maximumRightAngleResidual = 0;
  let maximumRadiusDeflection = 0;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtTime(cyclePeriod * sample / 16384);
    maximumPistonY = Math.max(maximumPistonY, state.pointC.y);
    minimumPistonY = Math.min(minimumPistonY, state.pointC.y);
    maximumSliderX = Math.max(maximumSliderX, state.pointB.x);
    minimumSliderX = Math.min(minimumSliderX, state.pointB.x);
    maximumRadiusClosureResidual = Math.max(
      maximumRadiusClosureResidual,
      Math.abs(state.radiusClosureResidual),
    );
    maximumRightAngleResidual = Math.max(
      maximumRightAngleResidual,
      Math.abs(state.rightAngleDot),
    );
    maximumRadiusDeflection = Math.max(
      maximumRadiusDeflection,
      Math.abs(state.radiusDeflectionFromLeft),
    );
  }
  // These four extrema are algebraic, not sampled approximations. C reaches
  // -18 and -10 at the crank dead centers. B reaches -15 when C crosses F's
  // horizontal, and reaches -sqrt(209) at either piston dead center.
  minimumPistonY = -18 * sourceScale;
  maximumPistonY = -10 * sourceScale;
  minimumSliderX = -15 * sourceScale;
  maximumSliderX = -Math.sqrt(209) * sourceScale;

  const geometry = {
    barBCLength,
    connectingRodLength,
    crankCenterO,
    crankRadius,
    cyclePeriod,
    inputAngularSpeed,
    maximumPistonY,
    maximumRadiusClosureResidual,
    maximumRadiusDeflection,
    maximumRightAngleResidual,
    maximumSliderX,
    midpointDistance,
    minimumPistonY,
    minimumSliderX,
    pistonLineX,
    pistonStroke: maximumPistonY - minimumPistonY,
    radiusBarLength,
    radiusPivotF,
    sliderLineY,
    sliderTravel: maximumSliderX - minimumSliderX,
    sourceInputPhaseOffset,
    sourceScale,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const blueMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const redMaterial = matte(0xd95c40, {
    metalness: 0.09,
    roughness: 0.60,
  });
  const greenMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const orangeMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-engine-frame-crank-bearing-slot-D-piston-guide-and-radius-pivot-F';
  const framePlaneZ = -0.72;
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(13.5 * sourceScale, 0.72 * sourceScale, 0.92),
    frameMaterial,
  );
  baseRail.position.set(0, -24 * sourceScale, framePlaneZ);
  baseRail.userData.fixed = true;
  baseRail.userData.role = 'fixed-direct-action-engine-bed';
  fixedFrame.add(baseRail);

  const archSourcePoints = [
    [-5.6, -23.7],
    [-5.45, -13.0],
    [-5.0, -6.0],
    [-3.8, -2.4],
    [-1.9, 0.35],
    [0, 1.12],
    [1.9, 0.35],
    [3.8, -2.4],
    [5.0, -6.0],
    [5.6, -23.7],
  ];
  const archMembers = [];
  for (let index = 1; index < archSourcePoints.length; index += 1) {
    const [startX, startY] = archSourcePoints[index - 1];
    const [endX, endY] = archSourcePoints[index];
    const member = beamBetween3D(
      new THREE.Vector3(startX * sourceScale, startY * sourceScale,
        framePlaneZ),
      new THREE.Vector3(endX * sourceScale, endY * sourceScale,
        framePlaneZ),
      0.48 * sourceScale,
      0.58,
      frameMaterial,
    );
    member.userData.fixed = true;
    member.userData.role = `fixed-engine-arch-member-${index}`;
    fixedFrame.add(member);
    archMembers.push(member);
  }

  const crankBearing = cylinderAlongZ(1.25 * sourceScale, 0.66,
    frameMaterial, 46);
  crankBearing.position.set(crankCenterO.x, crankCenterO.y, -0.40);
  crankBearing.userData.fixed = true;
  crankBearing.userData.role = 'fixed-upper-crank-bearing-O';
  const crankShaft = cylinderAlongZ(0.40 * sourceScale, 1.18,
    darkMaterial, 34);
  crankShaft.position.set(crankCenterO.x, crankCenterO.y, -0.05);
  crankShaft.userData.fixed = true;
  crankShaft.userData.role = 'fixed-shaft-through-crank-center-O';

  const slotMinimumX = -16.25 * sourceScale;
  const slotMaximumX = -13.25 * sourceScale;
  const slotCenterX = (slotMinimumX + slotMaximumX) / 2;
  const slotRailLength = slotMaximumX - slotMinimumX;
  const slotRails = [-14.5625, -13.4375].map((sourceY, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(slotRailLength, 0.18 * sourceScale, 0.54),
      frameMaterial,
    );
    rail.position.set(slotCenterX, sourceY * sourceScale, 0.18);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-horizontal-slot-D-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const slotEnd = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * sourceScale, 1.30 * sourceScale, 0.54),
    frameMaterial,
  );
  slotEnd.position.set(-16.25 * sourceScale, sliderLineY, 0.18);
  slotEnd.userData.fixed = true;
  slotEnd.userData.role = 'fixed-closed-end-of-horizontal-slot-D';
  // The source casts D into the left side of the engine frame. Keep its
  // backing behind the sliding shoe while joining the rails to that frame.
  const slotSupport = new THREE.Mesh(
    new THREE.BoxGeometry(10.94 * sourceScale, 1.30 * sourceScale, 0.76),
    frameMaterial,
  );
  slotSupport.position.set(-10.87 * sourceScale, sliderLineY, -0.38);
  slotSupport.userData.fixed = true;
  slotSupport.userData.role = 'fixed-slot-D-backing-and-frame-bridge';
  fixedFrame.add(slotSupport);

  const pistonGuideRails = [-0.82, 0.82].map((sourceX, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * sourceScale, 14.1 * sourceScale, 0.50),
      frameMaterial,
    );
    rail.position.set(sourceX * sourceScale, -17.2 * sourceScale, -0.46);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-vertical-piston-guide-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const cylinderCrown = new THREE.Mesh(
    new THREE.BoxGeometry(3.8 * sourceScale, 0.68 * sourceScale, 0.74),
    frameMaterial,
  );
  cylinderCrown.position.set(0, -22.0 * sourceScale, -0.52);
  cylinderCrown.userData.fixed = true;
  cylinderCrown.userData.role = 'fixed-cylinder-upper-crosspiece';
  const radiusBearing = cylinderAlongZ(0.57 * sourceScale, 0.68,
    frameMaterial, 40);
  radiusBearing.position.set(radiusPivotF.x, radiusPivotF.y, -0.24);
  radiusBearing.userData.fixed = true;
  radiusBearing.userData.role = 'fixed-radius-bar-bearing-F';
  const radiusShaft = cylinderAlongZ(0.22 * sourceScale, 1.70,
    darkMaterial, 32);
  radiusShaft.position.set(radiusPivotF.x, radiusPivotF.y, 0.32);
  radiusShaft.userData.fixed = true;
  radiusShaft.userData.role = 'fixed-shaft-through-radius-pivot-F';
  fixedFrame.add(
    crankBearing,
    crankShaft,
    slotEnd,
    cylinderCrown,
    radiusBearing,
    radiusShaft,
  );
  root.add(fixedFrame);

  const pistonOutput = new THREE.Group();
  pistonOutput.userData.rotationDegreesOfFreedom = 0;
  pistonOutput.userData.role =
    'vertically-guided-direct-action-piston-rod-connected-at-C';
  const pistonCrosshead = new THREE.Mesh(
    new THREE.BoxGeometry(1.34 * sourceScale, 0.76 * sourceScale, 0.30),
    blueMaterial,
  );
  pistonCrosshead.position.z = 0.05;
  pistonCrosshead.userData.role = 'piston-crosshead-centered-at-C';
  const pistonRodLength = -sourcePistonRodLocalShoulderY * sourceScale;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.46 * sourceScale, pistonRodLength, 0.22),
    blueMaterial,
  );
  pistonRod.position.set(0, -pistonRodLength / 2, 0.04);
  pistonRod.userData.role = 'source-length-vertical-piston-rod-below-C';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(9.5 * sourceScale, 1.5 * sourceScale, 0.66),
    blueMaterial,
  );
  pistonHead.position.set(0, -15.625 * sourceScale, -0.03);
  pistonHead.userData.role = 'wide-direct-action-piston-head';
  const pistonIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 2.0 * sourceScale, 0.035),
    whiteMaterial,
  );
  pistonIndex.position.set(0, -4.0 * sourceScale, 0.175);
  pistonIndex.userData.role = 'visible-index-on-vertical-piston-rod';
  const pointCAnchor = new THREE.Object3D();
  pointCAnchor.position.z = 0.05;
  pointCAnchor.userData.role = 'analytic-piston-and-bar-point-C';
  pistonOutput.add(
    pistonCrosshead,
    pistonRod,
    pistonHead,
    pistonIndex,
    pointCAnchor,
  );
  root.add(pistonOutput);

  const inputCrank = new THREE.Group();
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role = 'four-unit-upper-driving-crank-O-P';
  const crankDisk = cylinderAlongZ(1.05 * sourceScale, 0.32,
    blueMaterial, 42);
  crankDisk.position.z = 0.12;
  crankDisk.userData.role = 'moving-upper-crank-disk';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.52 * sourceScale, 0.27),
    blueMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 0.12);
  crankArm.userData.role = 'four-unit-crank-arm-O-P';
  const crankPinBoss = cylinderAlongZ(0.50 * sourceScale, 0.38,
    blueMaterial, 36);
  crankPinBoss.position.set(crankRadius, 0, 0.12);
  crankPinBoss.userData.role = 'moving-crank-pin-boss-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, 0.12);
  crankPinAnchor.userData.role = 'analytic-crank-pin-P';
  inputCrank.add(crankDisk, crankArm, crankPinBoss, crankPinAnchor);
  root.add(inputCrank);

  const connectingParts = makeRigidRod({
    bodyMaterial: redMaterial,
    depth: 0.19,
    eyeMaterial: darkMaterial,
    length: connectingRodLength,
    planeZ: 0.35,
    role: 'fourteen-unit-connecting-rod-P-C',
    width: 0.46 * sourceScale,
  });
  root.add(connectingParts.rod);

  const sliderB = new THREE.Group();
  sliderB.userData.rotationDegreesOfFreedom = 0;
  sliderB.userData.role = 'horizontal-slider-B-in-fixed-slot-D';
  const sliderBlock = new THREE.Mesh(
    plate(clip.difference(poly([
      [-0.71 * sourceScale, -0.41 * sourceScale],
      [0.71 * sourceScale, -0.41 * sourceScale],
      [0.71 * sourceScale, 0.41 * sourceScale],
      [-0.71 * sourceScale, 0.41 * sourceScale],
    ]), poly(circle([0, 0], 0.22 * sourceScale + 0.006, 64))), -0.17, 0.17),
    greenMaterial,
  );
  sliderBlock.position.z = 0.25;
  sliderBlock.userData.role = 'moving-block-B-inside-slot-D';
  const pointBAnchor = new THREE.Object3D();
  pointBAnchor.position.z = 0.25;
  pointBAnchor.userData.role = 'analytic-horizontal-slider-point-B';
  sliderB.add(sliderBlock, pointBAnchor);
  root.add(sliderB);

  const barBCParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: barBCLength,
    planeZ: 0.62,
    role: 'fifteen-unit-rigid-bar-B-C',
    width: 0.42 * sourceScale,
  });
  const pointAAnchor = new THREE.Object3D();
  pointAAnchor.position.set(midpointDistance, 0, 0.62);
  pointAAnchor.userData.role = 'analytic-exact-midpoint-A-of-B-C';
  barBCParts.rod.userData.addPinEye(midpointDistance, 0.23 * sourceScale + 0.006);
  barBCParts.rod.add(pointAAnchor);
  root.add(barBCParts.rod);

  const radiusParts = makeRigidRod({
    bodyMaterial: orangeMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: radiusBarLength,
    planeZ: 0.91,
    role: 'seven-point-five-unit-fixed-radius-bar-F-A',
    width: 0.40 * sourceScale,
  });
  root.add(radiusParts.rod);

  const jointPins = {
    A: cylinderAlongZ(0.23 * sourceScale, 0.62, whiteMaterial, 30),
    B: cylinderAlongZ(0.22 * sourceScale, 0.76, whiteMaterial, 30),
    C: cylinderAlongZ(0.25 * sourceScale, 1.00, whiteMaterial, 30),
    P: cylinderAlongZ(0.24 * sourceScale, 0.50, whiteMaterial, 30),
  };
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
    root.add(pin);
  });

  const contacts = {
    barAtC: {
      members: [barBCParts.rod, connectingParts.rod, pistonOutput],
      point: new THREE.Vector3(),
      type: 'three-member-pin-at-piston-point-C',
    },
    crankAtP: {
      members: [inputCrank, connectingParts.rod],
      point: new THREE.Vector3(),
      type: 'crank-to-connecting-rod-pin-P',
    },
    crankPivotO: {
      fixedMember: fixedFrame,
      movingMember: inputCrank,
      point: new THREE.Vector3(crankCenterO.x, crankCenterO.y, 0.12),
      type: 'fixed-revolute-pair-O',
    },
    midpointAtA: {
      members: [barBCParts.rod, radiusParts.rod],
      point: new THREE.Vector3(),
      type: 'radius-bar-to-hypotenuse-midpoint-pin-A',
    },
    pistonGuideC: {
      fixedMember: fixedFrame,
      movingMember: pistonOutput,
      point: new THREE.Vector3(),
      type: 'vertical-prismatic-pair-through-C',
    },
    radiusPivotF: {
      fixedMember: fixedFrame,
      movingMember: radiusParts.rod,
      point: new THREE.Vector3(radiusPivotF.x, radiusPivotF.y, 0.91),
      type: 'fixed-revolute-pair-F-at-guide-line-intersection',
    },
    sliderAtB: {
      fixedMember: fixedFrame,
      members: [sliderB, barBCParts.rod],
      movingMember: sliderB,
      point: new THREE.Vector3(),
      type: 'horizontal-prismatic-and-pin pair-B-in-slot-D',
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
    setRodPose(barBCParts.rod, state.pointB, state.barBC);
    setRodPose(radiusParts.rod, radiusPivotF, state.radiusBar);
    sliderB.position.set(state.pointB.x, state.pointB.y, 0);
    sliderB.userData.velocity = new THREE.Vector3(
      state.pointBVelocity.x,
      state.pointBVelocity.y,
      0,
    );
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
    jointPins.P.position.set(state.pointP.x, state.pointP.y, 0.38);
    jointPins.B.position.set(state.pointB.x, state.pointB.y, 0.42);
    jointPins.C.position.set(state.pointC.x, state.pointC.y, 0.40);
    jointPins.A.position.set(state.pointA.x, state.pointA.y, 0.84);
    contacts.crankAtP.point.set(state.pointP.x, state.pointP.y, 0.38);
    contacts.barAtC.point.set(state.pointC.x, state.pointC.y, 0.40);
    contacts.pistonGuideC.point.set(state.pointC.x, state.pointC.y, 0.05);
    contacts.sliderAtB.point.set(state.pointB.x, state.pointB.y, 0.25);
    contacts.midpointAtA.point.set(state.pointA.x, state.pointA.y, 0.84);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-19.176395, -27.33186);
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
    'direct-action-engine-right-angle-slider-midpoint-radius-parallel-motion';
  root.userData.blocks = {
    archMembers,
    barBC: barBCParts.rod,
    barBCEndAnchor: barBCParts.endAnchor,
    barBCMidpointAnchor: pointAAnchor,
    barBCStartAnchor: barBCParts.startAnchor,
    baseRail,
    connectingRod: connectingParts.rod,
    connectingRodEndAnchor: connectingParts.endAnchor,
    connectingRodStartAnchor: connectingParts.startAnchor,
    crankArm,
    crankDisk,
    crankPinAnchor,
    fixedFrame,
    inputCrank,
    jointPins,
    pistonCrosshead,
    pistonGuideRails,
    pistonHead,
    pistonOutput,
    pistonRod,
    pointBAnchor,
    pointCAnchor,
    radiusBar: radiusParts.rod,
    radiusBarEndAnchor: radiusParts.endAnchor,
    radiusBarStartAnchor: radiusParts.startAnchor,
    sliderB,
    sliderBlock,
    slotRails,
    slotSupport,
    radiusBearing,
  };
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(
      officialViewMinimum.x * sourceScale,
      officialViewMinimum.y * sourceScale,
      -1.12,
    ),
    new THREE.Vector3(
      (officialViewMinimum.x + officialViewWidth) * sourceScale,
      (officialViewMinimum.y + officialViewHeight) * sourceScale,
      1.30,
    ),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating four-unit crank O-P',
    mechanism: 1,
    output: 'direct-action piston point C translates vertically through eight source units',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -7.08;
  root.userData.mechanism =
    'crank-O-P-fourteen-unit-rod-P-C-vertical-piston-C-fifteen-unit-bar-B-A-C-horizontal-slider-B-slot-D-and-fixed-radius-F-A';
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
      'add_tx',
      'add_c_rod',
      'add_rot_to',
      'add_text',
    ],
    officialGeometry: {
      barBCLength: sourceBarBCLength,
      barBCMidpointLocal: new THREE.Vector2(-7.5, 0),
      barBCSliderLocal: new THREE.Vector2(-15, 0),
      connectingRodLength: sourceConnectingRodLength,
      connectingRodWristLocal: new THREE.Vector2(0, -14),
      crankCenterO: sourceCrankCenterO,
      crankPinLocalP: sourceCrankPinLocalP,
      crankRadius: sourceCrankRadius,
      inputPhaseOffsetTurns: -0.25,
      pistonLineX: sourcePistonLineX,
      pistonRodLocalEndY: sourcePistonRodLocalEndY,
      pistonRodLocalShoulderY: sourcePistonRodLocalShoulderY,
      pistonStrokeLine: sourcePistonStrokeLine,
      radiusBarLength: sourceRadiusBarLength,
      radiusPivotF: sourceRadiusPivotF,
      sliderLineD: sourceSliderLineD,
      sliderLineY: sourceSliderLineY,
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'none in the linkage: both slider-line intersections, all three rigid lengths, the midpoint, branch choices, crank phase, and timing are reconstructed exactly',
    referenceScope:
      'official four-unit crank, fourteen-unit connecting rod, vertical C line, fifteen-unit B-C bar, horizontal slot D, midpoint A, fixed pivot F, 7.5-unit radius bar, piston shape landmarks, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate339: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'B slides in horizontal slot D, C is carried by the vertical piston rod, A is the exact midpoint of B-C, and fixed radius F-A closes because B-F-C is a right triangle',
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
      '|O-P|=4, |P-C|=14, C.x=0, B.y=-14, |B-C|=15, A=(B+C)/2, F=(0,-14), and |F-A|=7.5 in source units',
    geometricProof:
      'B-F is horizontal and F-C is vertical, so F is the right-angle vertex of triangle B-F-C; A is the hypotenuse midpoint and is therefore exactly 7.5 units from all three vertices',
    input:
      'the upper crank O-P and fourteen-unit connecting rod drive C on the vertical piston line',
    output:
      'C is the direct-action piston connection; B accommodates the bar angle by sliding only horizontally in D',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(1.2, 0.6, 14),
    root,
    update,
  };
}

function jogglingPillarParallelMotion(movement) {
  const root = new THREE.Group();

  // The official canvas drives D through a hidden crank-rocker, solves B from
  // the pillar circle, and then only aims the drawn E-A bar toward A. Its
  // 4.742772-unit bar is 0.047-0.064 unit short and is not used as a closure
  // constraint. The intended four-bar is recovered by making the negative-B
  // center pose an exact external tangent: 8.839627 - (-0.200329) - 4.25 =
  // 4.789956. This closes F-B-A-E exactly and makes C substantially straighter
  // while retaining the official crank-rocker phase law for B.
  const sourceScale = 0.38;
  const sourceHiddenCrankPivot = new THREE.Vector2(-7.799671, -6);
  const sourceHiddenCrankRadius = 2.499197;
  const sourceHiddenCrankPinLocal = new THREE.Vector2(2.499197, 0);
  const sourceHiddenCrankPhaseOffset = FULL_TURN * 0.25;
  const sourceHiddenConnectingRodLength = 16.005141;
  const sourceHiddenRockerCenter = new THREE.Vector2(-3.899836, 10);
  const sourceHiddenRockerReferenceD = new THREE.Vector2(-8.200329, 10);
  const sourceHiddenRockerRadius = sourceHiddenRockerCenter
    .distanceTo(sourceHiddenRockerReferenceD);
  const sourcePillarPivotF = new THREE.Vector2(0, 0);
  const sourcePillarReferenceB = new THREE.Vector2(0.200329, 10);
  const sourcePillarNegativeTangentB = new THREE.Vector2(-0.200329, 10);
  const sourcePillarLength = sourcePillarPivotF
    .distanceTo(sourcePillarReferenceB);
  const sourceBeamDBLength = 8;
  const sourceBeamDALength = 12.25;
  const sourceBeamDCLength = 16;
  const sourceBeamBALength = sourceBeamDALength - sourceBeamDBLength;
  const sourceBeamBCLength = sourceBeamDCLength - sourceBeamDBLength;
  const sourceRadiusPivotE = new THREE.Vector2(8.839627, 10);
  const sourceCanvasRadiusBarLength = 4.742772;
  const sourcePhysicalRadiusBarLength = sourceRadiusPivotE.x
    - sourcePillarNegativeTangentB.x - sourceBeamBALength;
  const sourcePistonRodLength = 16.005141;
  const sourceNominalPistonLineX = 7.799671;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const hiddenCrankPivot = sourceHiddenCrankPivot.clone()
    .multiplyScalar(sourceScale);
  const hiddenCrankRadius = sourceHiddenCrankRadius * sourceScale;
  const hiddenConnectingRodLength = sourceHiddenConnectingRodLength
    * sourceScale;
  const hiddenRockerCenter = sourceHiddenRockerCenter.clone()
    .multiplyScalar(sourceScale);
  const hiddenRockerReferenceD = sourceHiddenRockerReferenceD.clone()
    .multiplyScalar(sourceScale);
  const hiddenRockerRadius = sourceHiddenRockerRadius * sourceScale;
  const pillarPivotF = sourcePillarPivotF.clone().multiplyScalar(sourceScale);
  const pillarReferenceB = sourcePillarReferenceB.clone()
    .multiplyScalar(sourceScale);
  const pillarLength = sourcePillarLength * sourceScale;
  const beamDBLength = sourceBeamDBLength * sourceScale;
  const beamDALength = sourceBeamDALength * sourceScale;
  const beamDCLength = sourceBeamDCLength * sourceScale;
  const beamBALength = sourceBeamBALength * sourceScale;
  const beamBCLength = sourceBeamBCLength * sourceScale;
  const radiusPivotE = sourceRadiusPivotE.clone().multiplyScalar(sourceScale);
  const canvasRadiusBarLength = sourceCanvasRadiusBarLength * sourceScale;
  const physicalRadiusBarLength = sourcePhysicalRadiusBarLength * sourceScale;
  const nominalPistonLineX = sourceNominalPistonLineX * sourceScale;
  const zero = new THREE.Vector2();

  const positionsAtInputTravel = (inputTravel) => {
    const unwrappedInputAngle = sourceHiddenCrankPhaseOffset + inputTravel;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const hiddenCrankPin = hiddenCrankPivot.clone().add(new THREE.Vector2(
      hiddenCrankRadius * Math.cos(inputAngle),
      hiddenCrankRadius * Math.sin(inputAngle),
    ));
    const canvasPointD = nearestPoint(
      circleCircleIntersections(
        hiddenCrankPin,
        hiddenConnectingRodLength,
        hiddenRockerCenter,
        hiddenRockerRadius,
      ),
      hiddenRockerReferenceD,
    );
    const pointB = nearestPoint(
      circleCircleIntersections(
        canvasPointD,
        beamDBLength,
        pillarPivotF,
        pillarLength,
      ),
      pillarReferenceB,
    );
    const canvasBeamDirection = pointB.clone().sub(canvasPointD)
      .normalize();
    const canvasPointA = canvasPointD.clone().addScaledVector(
      canvasBeamDirection,
      beamDALength,
    );
    const canvasPointC = canvasPointD.clone().addScaledVector(
      canvasBeamDirection,
      beamDCLength,
    );
    const canvasRadiusDirection = canvasPointA.clone().sub(radiusPivotE)
      .normalize();
    const canvasDrawnRadiusEndpoint = radiusPivotE.clone().addScaledVector(
      canvasRadiusDirection,
      canvasRadiusBarLength,
    );
    const pointA = nearestPoint(
      circleCircleIntersections(
        pointB,
        beamBALength,
        radiusPivotE,
        physicalRadiusBarLength,
      ),
      canvasPointA,
    );
    const physicalBeamDirection = pointA.clone().sub(pointB).normalize();
    const pointD = pointB.clone().addScaledVector(
      physicalBeamDirection,
      -beamDBLength,
    );
    const pointC = pointB.clone().addScaledVector(
      physicalBeamDirection,
      beamBCLength,
    );
    return {
      canvasDrawnRadiusEndpoint,
      canvasPointA,
      canvasPointC,
      canvasPointD,
      hiddenCrankPin,
      inputAngle,
      pointA,
      pointB,
      pointC,
      pointD,
      unwrappedInputAngle,
    };
  };

  const pointAParameterRates = (inputTravel, pointA) => {
    // A moderately wide parameter stencil avoids subtractive cancellation in
    // the second derivative precisely where the two circles are tangent.
    const step = 2e-3;
    const minusTwo = positionsAtInputTravel(inputTravel - 2 * step).pointA;
    const minusOne = positionsAtInputTravel(inputTravel - step).pointA;
    const plusOne = positionsAtInputTravel(inputTravel + step).pointA;
    const plusTwo = positionsAtInputTravel(inputTravel + 2 * step).pointA;
    const first = minusTwo.clone()
      .addScaledVector(minusOne, -8)
      .addScaledVector(plusOne, 8)
      .addScaledVector(plusTwo, -1)
      .multiplyScalar(1 / (12 * step));
    const second = plusTwo.clone().multiplyScalar(-1)
      .addScaledVector(plusOne, 16)
      .addScaledVector(pointA, -30)
      .addScaledVector(minusOne, 16)
      .addScaledVector(minusTwo, -1)
      .multiplyScalar(1 / (12 * step ** 2));
    return { first, second };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const positions = positionsAtInputTravel(inputTravel);
    const {
      canvasDrawnRadiusEndpoint,
      canvasPointA,
      canvasPointC,
      canvasPointD,
      hiddenCrankPin,
      inputAngle,
      pointA,
      pointB,
      pointC,
      pointD,
      unwrappedInputAngle,
    } = positions;
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const hiddenCrankPinVelocity = new THREE.Vector2(
      -hiddenCrankRadius * sine * resolvedInputAngularSpeed,
      hiddenCrankRadius * cosine * resolvedInputAngularSpeed,
    );
    const hiddenCrankPinAcceleration = new THREE.Vector2(
      -hiddenCrankRadius * (
        cosine * resolvedInputAngularSpeed ** 2
          + sine * inputAngularAcceleration
      ),
      hiddenCrankRadius * (
        -sine * resolvedInputAngularSpeed ** 2
          + cosine * inputAngularAcceleration
      ),
    );
    const canvasPointDRates = constrainedPointRates({
      accelerationA: hiddenCrankPinAcceleration,
      accelerationB: zero,
      centerA: hiddenCrankPin,
      centerB: hiddenRockerCenter,
      point: canvasPointD,
      velocityA: hiddenCrankPinVelocity,
      velocityB: zero,
    });
    const pointBRates = constrainedPointRates({
      accelerationA: canvasPointDRates.acceleration,
      accelerationB: zero,
      centerA: canvasPointD,
      centerB: pillarPivotF,
      point: pointB,
      velocityA: canvasPointDRates.velocity,
      velocityB: zero,
    });

    const radialBA = pointA.clone().sub(pointB);
    const radialEA = pointA.clone().sub(radiusPivotE);
    const radiusDeterminant = cross2(radialBA, radialEA);
    let pointAVelocity;
    let pointAAcceleration;
    let rateMethod = 'analytic-two-circle-constraints';
    if (Math.abs(radiusDeterminant) > 1e-4) {
      const pointARates = constrainedPointRates({
        accelerationA: pointBRates.acceleration,
        accelerationB: zero,
        centerA: pointB,
        centerB: radiusPivotE,
        point: pointA,
        velocityA: pointBRates.velocity,
        velocityB: zero,
      });
      pointAVelocity = pointARates.velocity;
      pointAAcceleration = pointARates.acceleration;
    } else {
      // At the exact external-tangent reversal the ordinary two-circle
      // Jacobian is singular although the branch-changing motion is smooth:
      // B has zero speed there. A symmetric fourth-order parameter limit
      // evaluates that finite velocity and acceleration without dividing by
      // the vanishing circle-intersection determinant.
      const parameterRates = pointAParameterRates(inputTravel, pointA);
      pointAVelocity = parameterRates.first.clone()
        .multiplyScalar(resolvedInputAngularSpeed);
      pointAAcceleration = parameterRates.second
        .multiplyScalar(resolvedInputAngularSpeed ** 2)
        .addScaledVector(parameterRates.first, inputAngularAcceleration);
      rateMethod = 'fourth-order-tangent-limit';
    }

    const beamStationRatio = beamBCLength / beamBALength;
    const pointCVelocity = pointBRates.velocity.clone()
      .addScaledVector(
        pointAVelocity.clone().sub(pointBRates.velocity),
        beamStationRatio,
      );
    const pointCAcceleration = pointBRates.acceleration.clone()
      .addScaledVector(
        pointAAcceleration.clone().sub(pointBRates.acceleration),
        beamStationRatio,
      );
    const pointDVelocity = pointBRates.velocity.clone()
      .addScaledVector(
        pointAVelocity.clone().sub(pointBRates.velocity),
        -beamDBLength / beamBALength,
      );
    const pointDAcceleration = pointBRates.acceleration.clone()
      .addScaledVector(
        pointAAcceleration.clone().sub(pointBRates.acceleration),
        -beamDBLength / beamBALength,
      );
    const canvasStationA = beamDALength / beamDBLength;
    const canvasPointAVelocity = canvasPointDRates.velocity.clone()
      .addScaledVector(
        pointBRates.velocity.clone().sub(canvasPointDRates.velocity),
        canvasStationA,
      );
    const canvasPointAAcceleration = canvasPointDRates.acceleration.clone()
      .addScaledVector(
        pointBRates.acceleration.clone().sub(canvasPointDRates.acceleration),
        canvasStationA,
      );
    const canvasPointCVelocity = pointBRates.velocity.clone()
      .multiplyScalar(2).sub(canvasPointDRates.velocity);
    const canvasPointCAcceleration = pointBRates.acceleration.clone()
      .multiplyScalar(2).sub(canvasPointDRates.acceleration);
    const beamVector = pointC.clone().sub(pointD);
    const beamVelocity = pointCVelocity.clone().sub(pointDVelocity);
    const beamAcceleration = pointCAcceleration.clone()
      .sub(pointDAcceleration);
    const pillarVector = pointB.clone().sub(pillarPivotF);
    const radiusVector = pointA.clone().sub(radiusPivotE);

    return {
      beam: rigidLinkRates(beamVector, beamVelocity, beamAcceleration),
      canvasApproximation: {
        drawnRadiusEndpoint: canvasDrawnRadiusEndpoint,
        pointA: canvasPointA,
        pointAAcceleration: canvasPointAAcceleration,
        pointAVelocity: canvasPointAVelocity,
        pointC: canvasPointC,
        pointCAcceleration: canvasPointCAcceleration,
        pointCVelocity: canvasPointCVelocity,
        pointD: canvasPointD,
        radiusEndpointGap: canvasDrawnRadiusEndpoint.distanceTo(canvasPointA),
        radiusLengthToA: radiusPivotE.distanceTo(canvasPointA),
      },
      hiddenCrankPin,
      hiddenCrankPinAcceleration,
      hiddenCrankPinVelocity,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      physicalDifferenceFromCanvas: {
        pointA: pointA.distanceTo(canvasPointA),
        pointC: pointC.distanceTo(canvasPointC),
        pointD: pointD.distanceTo(canvasPointD),
      },
      pillar: rigidLinkRates(
        pillarVector,
        pointBRates.velocity,
        pointBRates.acceleration,
      ),
      pointA,
      pointAAcceleration,
      pointAVelocity,
      pointB,
      pointBAcceleration: pointBRates.acceleration,
      pointBVelocity: pointBRates.velocity,
      pointC,
      pointCAcceleration,
      pointCVelocity,
      pointD,
      pointDAcceleration,
      pointDVelocity,
      radiusBar: rigidLinkRates(
        radiusVector,
        pointAVelocity,
        pointAAcceleration,
      ),
      radiusClosureResidual: radiusVector.length() - physicalRadiusBarLength,
      radiusConstraintDeterminant: radiusDeterminant,
      rateMethod,
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
  const sourceStateAtTime = (time) => {
    const state = stateAtTime(time);
    return {
      hiddenCrankPin: state.hiddenCrankPin,
      inputAngle: state.inputAngle,
      pointA: state.canvasApproximation.pointA,
      pointC: state.canvasApproximation.pointC,
      pointD: state.canvasApproximation.pointD,
      radiusEndpointGap: state.canvasApproximation.radiusEndpointGap,
      radiusLengthToA: state.canvasApproximation.radiusLengthToA,
    };
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

  let maximumCanvasRadiusEndpointGap = 0;
  let maximumCanvasLateralDeviation = 0;
  let maximumLateralDeviation = 0;
  let maximumPhysicalPointADifferenceFromCanvas = 0;
  let maximumPhysicalPointCDifferenceFromCanvas = 0;
  let maximumRadiusClosureResidual = 0;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 32768; sample += 1) {
    const positions = positionsAtInputTravel(FULL_TURN * sample / 32768);
    maximumCanvasRadiusEndpointGap = Math.max(
      maximumCanvasRadiusEndpointGap,
      positions.canvasDrawnRadiusEndpoint.distanceTo(positions.canvasPointA),
    );
    maximumCanvasLateralDeviation = Math.max(
      maximumCanvasLateralDeviation,
      Math.abs(positions.canvasPointC.x - nominalPistonLineX),
    );
    maximumLateralDeviation = Math.max(
      maximumLateralDeviation,
      Math.abs(positions.pointC.x - nominalPistonLineX),
    );
    maximumPhysicalPointADifferenceFromCanvas = Math.max(
      maximumPhysicalPointADifferenceFromCanvas,
      positions.pointA.distanceTo(positions.canvasPointA),
    );
    maximumPhysicalPointCDifferenceFromCanvas = Math.max(
      maximumPhysicalPointCDifferenceFromCanvas,
      positions.pointC.distanceTo(positions.canvasPointC),
    );
    maximumRadiusClosureResidual = Math.max(
      maximumRadiusClosureResidual,
      Math.abs(positions.pointA.distanceTo(radiusPivotE)
        - physicalRadiusBarLength),
    );
    maximumPistonX = Math.max(maximumPistonX, positions.pointC.x);
    maximumPistonY = Math.max(maximumPistonY, positions.pointC.y);
    minimumPistonX = Math.min(minimumPistonX, positions.pointC.x);
    minimumPistonY = Math.min(minimumPistonY, positions.pointC.y);
  }

  const geometry = {
    beamBALength,
    beamBCLength,
    beamDALength,
    beamDBLength,
    beamDCLength,
    canvasRadiusBarLength,
    cyclePeriod,
    hiddenConnectingRodLength,
    hiddenCrankPivot,
    hiddenCrankRadius,
    hiddenRockerCenter,
    hiddenRockerRadius,
    inputAngularSpeed,
    maximumCanvasLateralDeviation,
    maximumCanvasRadiusEndpointGap,
    maximumLateralDeviation,
    maximumPhysicalPointADifferenceFromCanvas,
    maximumPhysicalPointCDifferenceFromCanvas,
    maximumPistonX,
    maximumPistonY,
    maximumRadiusClosureResidual,
    minimumPistonX,
    minimumPistonY,
    nominalPistonLineX,
    outputStroke: maximumPistonY - minimumPistonY,
    physicalRadiusBarLength,
    pillarLength,
    pillarPivotF,
    radiusPivotE,
    sourceHiddenCrankPhaseOffset,
    sourceScale,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const beamMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const pillarMaterial = matte(0xd95c40, {
    metalness: 0.09,
    roughness: 0.60,
  });
  const radiusMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const outputMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-supports-for-pillar-pivot-F-radius-pivot-E-and-two-vertical-guides';
  const framePlaneZ = -0.62;
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(8.0 * sourceScale, 0.52 * sourceScale, 0.86),
    frameMaterial,
  );
  baseRail.position.set(0, -1.05 * sourceScale, framePlaneZ);
  baseRail.userData.fixed = true;
  baseRail.userData.role = 'fixed-lower-bed-under-pillar-F';
  const pillarStandard = beamBetween3D(
    new THREE.Vector3(0, -1.0 * sourceScale, framePlaneZ),
    new THREE.Vector3(0, -0.40 * sourceScale, framePlaneZ),
    1.45 * sourceScale,
    0.70,
    frameMaterial,
  );
  pillarStandard.userData.fixed = true;
  pillarStandard.userData.role = 'fixed-standard-under-pillar-pivot-F';
  const pillarBearing = cylinderAlongZ(1.0 * sourceScale, 0.74,
    frameMaterial, 44);
  pillarBearing.position.set(pillarPivotF.x, pillarPivotF.y, -0.28);
  pillarBearing.userData.fixed = true;
  pillarBearing.userData.role = 'fixed-lower-bearing-F';
  const pillarShaft = cylinderAlongZ(0.38 * sourceScale, 1.26,
    darkMaterial, 34);
  pillarShaft.position.set(pillarPivotF.x, pillarPivotF.y, 0.02);
  pillarShaft.userData.fixed = true;
  pillarShaft.userData.role = 'fixed-shaft-through-F';

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.55 * sourceScale, 7.0 * sourceScale, 0.82),
    frameMaterial,
  );
  wall.position.set(10.1 * sourceScale, 10 * sourceScale, framePlaneZ);
  wall.userData.fixed = true;
  wall.userData.role = 'fixed-right-wall-for-radius-pivot-E';
  const radiusBracket = beamBetween3D(
    new THREE.Vector3(10.0 * sourceScale, 10 * sourceScale, framePlaneZ),
    new THREE.Vector3(radiusPivotE.x, radiusPivotE.y, framePlaneZ),
    0.48 * sourceScale,
    0.66,
    frameMaterial,
  );
  radiusBracket.userData.fixed = true;
  radiusBracket.userData.role = 'fixed-wall-bracket-to-E';
  const radiusBearing = cylinderAlongZ(0.58 * sourceScale, 0.70,
    frameMaterial, 40);
  radiusBearing.position.set(radiusPivotE.x, radiusPivotE.y, -0.27);
  radiusBearing.userData.fixed = true;
  radiusBearing.userData.role = 'fixed-radius-bearing-E';
  const radiusShaft = cylinderAlongZ(0.24 * sourceScale, 1.70,
    darkMaterial, 32);
  radiusShaft.position.set(radiusPivotE.x, radiusPivotE.y, 0.30);
  radiusShaft.userData.fixed = true;
  radiusShaft.userData.role = 'fixed-shaft-through-E';

  const makeVerticalGuides = (sourceX, prefix) => [-0.47, 0.47].map(
    (offset, index) => {
      const guide = new THREE.Mesh(
        new THREE.BoxGeometry(0.16 * sourceScale, 14.0 * sourceScale, 0.38),
        frameMaterial,
      );
      guide.position.set((sourceX + offset) * sourceScale,
        5.0 * sourceScale, -0.45);
      guide.userData.fixed = true;
      guide.userData.role = `fixed-${prefix}-guide-rail-${index + 1}`;
      fixedFrame.add(guide);
      return guide;
    },
  );
  const inputGuideRails = makeVerticalGuides(-7.799671, 'D-input');
  const pistonGuideRails = makeVerticalGuides(7.799671, 'C-piston');
  fixedFrame.add(
    baseRail,
    pillarStandard,
    pillarBearing,
    pillarShaft,
    wall,
    radiusBracket,
    radiusBearing,
    radiusShaft,
  );
  root.add(fixedFrame);

  const pillarParts = makeRigidRod({
    bodyMaterial: pillarMaterial,
    depth: 0.25,
    eyeMaterial: darkMaterial,
    length: pillarLength,
    planeZ: 0.08,
    role: 'joggling-pillar-F-B-vibrating-about-fixed-center-F',
    width: 0.78 * sourceScale,
  });
  const pillarMidFlare = new THREE.Mesh(
    new THREE.BoxGeometry(3.1 * sourceScale, 1.05 * sourceScale, 0.28),
    pillarMaterial,
  );
  pillarMidFlare.position.set(pillarLength * 0.54, 0, 0.08);
  pillarMidFlare.userData.role = 'joggled-broad-middle-of-pillar-B-F';
  pillarParts.rod.add(pillarMidFlare);
  root.add(pillarParts.rod);

  const beam = new THREE.Group();
  beam.userData.role = 'sixteen-unit-beam-D-B-A-C';
  const beamBody = new THREE.Mesh(
    new THREE.BoxGeometry(beamDCLength, 0.76 * sourceScale, 0.28),
    beamMaterial,
  );
  beamBody.position.set(beamDCLength / 2, 0, 0.40);
  beamBody.userData.role = 'rigid-blue-beam-body-D-C';
  const beamBosses = {
    A: cylinderAlongZ(0.42 * sourceScale, 0.36, beamMaterial, 34),
    B: cylinderAlongZ(1.05 * sourceScale, 0.38, beamMaterial, 42),
    C: cylinderAlongZ(0.58 * sourceScale, 0.36, beamMaterial, 36),
    D: cylinderAlongZ(0.58 * sourceScale, 0.36, beamMaterial, 36),
  };
  beamBosses.D.position.set(0, 0, 0.40);
  beamBosses.B.position.set(beamDBLength, 0, 0.40);
  beamBosses.A.position.set(beamDALength, 0, 0.40);
  beamBosses.C.position.set(beamDCLength, 0, 0.40);
  Object.entries(beamBosses).forEach(([name, boss]) => {
    boss.userData.role = `beam-pin-boss-${name}`;
  });
  const beamAnchors = {
    A: new THREE.Object3D(),
    B: new THREE.Object3D(),
    C: new THREE.Object3D(),
    D: new THREE.Object3D(),
  };
  beamAnchors.D.position.set(0, 0, 0.40);
  beamAnchors.B.position.set(beamDBLength, 0, 0.40);
  beamAnchors.A.position.set(beamDALength, 0, 0.40);
  beamAnchors.C.position.set(beamDCLength, 0, 0.40);
  Object.entries(beamAnchors).forEach(([name, anchor]) => {
    anchor.userData.role = `analytic-beam-point-${name}`;
  });
  beam.add(
    beamBody,
    ...Object.values(beamBosses),
    ...Object.values(beamAnchors),
  );
  root.add(beam);

  const radiusParts = makeRigidRod({
    bodyMaterial: radiusMaterial,
    depth: 0.19,
    eyeMaterial: darkMaterial,
    length: physicalRadiusBarLength,
    planeZ: 0.75,
    role: 'corrected-four-point-seven-eight-nine-nine-five-six-unit-radius-bar-E-A',
    width: 0.42 * sourceScale,
  });
  root.add(radiusParts.rod);

  const makeVerticalMovingRod = (material, role, colorRole) => {
    const group = new THREE.Group();
    group.userData.rotationDegreesOfFreedom = 0;
    group.userData.role = role;
    const rodLength = sourcePistonRodLength * sourceScale;
    const rod = new THREE.Mesh(
      new THREE.BoxGeometry(0.38 * sourceScale, rodLength, 0.20),
      material,
    );
    rod.position.set(0, -rodLength / 2, 0.18);
    rod.userData.role = `${colorRole}-vertical-rod-below-pin`;
    const crosshead = new THREE.Mesh(
      new THREE.BoxGeometry(1.15 * sourceScale, 0.62 * sourceScale, 0.28),
      material,
    );
    crosshead.position.z = 0.18;
    crosshead.userData.role = `${colorRole}-guided-crosshead`;
    const anchor = new THREE.Object3D();
    anchor.position.z = 0.18;
    anchor.userData.role = `analytic-${colorRole}-pin`;
    group.add(rod, crosshead, anchor);
    return { anchor, crosshead, group, rod };
  };
  const inputRodParts = makeVerticalMovingRod(
    pillarMaterial,
    'left-input-rod-connected-at-beam-end-D',
    'input-D',
  );
  const pistonParts = makeVerticalMovingRod(
    outputMaterial,
    'piston-rod-connected-at-beam-end-C',
    'output-C',
  );
  root.add(inputRodParts.group, pistonParts.group);

  const jointPins = {
    A: cylinderAlongZ(0.23 * sourceScale, 0.62, whiteMaterial, 30),
    B: cylinderAlongZ(0.34 * sourceScale, 0.84, whiteMaterial, 30),
    C: cylinderAlongZ(0.26 * sourceScale, 0.48, whiteMaterial, 30),
    D: cylinderAlongZ(0.26 * sourceScale, 0.44, whiteMaterial, 30),
  };
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
    root.add(pin);
  });

  const contacts = {
    beamAtA: {
      members: [beam, radiusParts.rod],
      point: new THREE.Vector3(),
      type: 'beam-to-radius-bar-pin-A',
    },
    beamAtB: {
      members: [beam, pillarParts.rod],
      point: new THREE.Vector3(),
      type: 'beam-to-joggling-pillar-pin-B',
    },
    beamAtC: {
      members: [beam, pistonParts.group],
      point: new THREE.Vector3(),
      type: 'beam-to-piston-rod-pin-C',
    },
    beamAtD: {
      members: [beam, inputRodParts.group],
      point: new THREE.Vector3(),
      type: 'beam-to-left-input-rod-pin-D',
    },
    pillarPivotF: {
      fixedMember: fixedFrame,
      movingMember: pillarParts.rod,
      point: new THREE.Vector3(pillarPivotF.x, pillarPivotF.y, 0.08),
      type: 'fixed-revolute-pair-F',
    },
    radiusPivotE: {
      fixedMember: fixedFrame,
      movingMember: radiusParts.rod,
      point: new THREE.Vector3(radiusPivotE.x, radiusPivotE.y, 0.75),
      type: 'fixed-revolute-pair-E',
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
    setRodPose(pillarParts.rod, pillarPivotF, state.pillar);
    setRodPose(beam, state.pointD, state.beam);
    setRodPose(radiusParts.rod, radiusPivotE, state.radiusBar);
    inputRodParts.group.position.set(state.pointD.x, state.pointD.y, 0);
    pistonParts.group.position.set(state.pointC.x, state.pointC.y, 0);
    inputRodParts.group.userData.velocity = new THREE.Vector3(
      state.pointDVelocity.x,
      state.pointDVelocity.y,
      0,
    );
    pistonParts.group.userData.velocity = new THREE.Vector3(
      state.pointCVelocity.x,
      state.pointCVelocity.y,
      0,
    );
    pistonParts.group.userData.acceleration = new THREE.Vector3(
      state.pointCAcceleration.x,
      state.pointCAcceleration.y,
      0,
    );
    jointPins.D.position.set(state.pointD.x, state.pointD.y, 0.38);
    jointPins.B.position.set(state.pointB.x, state.pointB.y, 0.36);
    jointPins.A.position.set(state.pointA.x, state.pointA.y, 0.67);
    jointPins.C.position.set(state.pointC.x, state.pointC.y, 0.42);
    contacts.beamAtD.point.set(state.pointD.x, state.pointD.y, 0.38);
    contacts.beamAtB.point.set(state.pointB.x, state.pointB.y, 0.36);
    contacts.beamAtA.point.set(state.pointA.x, state.pointA.y, 0.67);
    contacts.beamAtC.point.set(state.pointC.x, state.pointC.y, 0.42);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-9.428577, -1.740102);
  const officialViewWidth = 20;
  const officialViewHeight = 20;
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
    'joggling-pillar-four-bar-coupler-point-parallel-motion';
  root.userData.blocks = {
    baseRail,
    beam,
    beamAnchors,
    beamBody,
    beamBosses,
    fixedFrame,
    inputGuideRails,
    inputRod: inputRodParts.group,
    inputRodAnchor: inputRodParts.anchor,
    jointPins,
    pillar: pillarParts.rod,
    pillarEndAnchor: pillarParts.endAnchor,
    pillarStartAnchor: pillarParts.startAnchor,
    pistonGuideRails,
    pistonRod: pistonParts.group,
    pistonRodAnchor: pistonParts.anchor,
    radiusBar: radiusParts.rod,
    radiusBarEndAnchor: radiusParts.endAnchor,
    radiusBarStartAnchor: radiusParts.startAnchor,
    radiusBearing,
    wall,
  };
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(
      officialViewMinimum.x * sourceScale,
      officialViewMinimum.y * sourceScale,
      -1.08,
    ),
    new THREE.Vector3(
      (officialViewMinimum.x + officialViewWidth) * sourceScale,
      (officialViewMinimum.y + officialViewHeight) * sourceScale,
      1.20,
    ),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input:
      'the official hidden crank-rocker phase law vibrates pillar B-F through B',
    mechanism: 1,
    output:
      'coupler extension C carries the piston through a near-vertical five-unit stroke',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -0.72;
  root.userData.mechanism =
    'fixed-pivots-F-E-joggling-pillar-F-B-rigid-beam-D-B-A-C-corrected-radius-E-A-input-at-D-and-piston-at-C';
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
      'add_c_rod_r',
      'add_rot_to',
      'add_rot_to',
      'add_tx',
      'add_text',
    ],
    officialGeometry: {
      beamBALength: sourceBeamBALength,
      beamBCLength: sourceBeamBCLength,
      beamDALength: sourceBeamDALength,
      beamDBLength: sourceBeamDBLength,
      beamDCLength: sourceBeamDCLength,
      canvasRadiusBarLength: sourceCanvasRadiusBarLength,
      hiddenConnectingRodLength: sourceHiddenConnectingRodLength,
      hiddenCrankPhaseOffsetTurns: 0.25,
      hiddenCrankPinLocal: sourceHiddenCrankPinLocal,
      hiddenCrankPivot: sourceHiddenCrankPivot,
      hiddenCrankRadius: sourceHiddenCrankRadius,
      hiddenRockerCenter: sourceHiddenRockerCenter,
      hiddenRockerRadius: sourceHiddenRockerRadius,
      hiddenRockerReferenceD: sourceHiddenRockerReferenceD,
      nominalPistonLineX: sourceNominalPistonLineX,
      pillarLength: sourcePillarLength,
      pillarNegativeTangentB: sourcePillarNegativeTangentB,
      pillarPivotF: sourcePillarPivotF,
      pillarReferenceB: sourcePillarReferenceB,
      pistonRodLength: sourcePistonRodLength,
      radiusPivotE: sourceRadiusPivotE,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      derivation:
        'EA = E.x - B_tangent.x - BA = 8.839627 - (-0.200329) - 4.25',
      radiusBarLength: sourcePhysicalRadiusBarLength,
      reason:
        'the canvas 4.742772-unit bar is only aimed at A and is too short to close the visible four-bar; the corrected length makes the negative-B reversal an exact external tangent',
    },
    reconstructionDifference:
      'the model closes corrected E-A exactly; the official drawn radius endpoint misses canvas A by up to 0.064 source unit, while the corrected physical C stays within 0.082 source unit of canvas C',
    referenceScope:
      'official hidden crank-rocker timing, beam stations D-B-A-C, pillar F-B, fixed pivots F and E, drawn radius length and its closure defect, piston rod, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate340: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'beam D-B-A-C is carried by joggling pillar F-B and constrained at A by fixed radius E-A; piston rod is pinned at C',
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
      'the source solves D-B from its hidden input and only points the 4.742772-unit E-A drawing, leaving a visible endpoint gap',
    exactRigidConstraints:
      '|F-B|=10.002006384, |D-B|=|B-C|=8, |B-A|=4.25, and corrected |E-A|=4.789956 in source units',
    input:
      'the official hidden crank-rocker law supplies the oscillation of B about F; no hidden member is presented as part of the visible four-bar',
    output:
      'the beam coupler point C carries the piston on a near-vertical five-unit stroke',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(1.2, 0.6, 14),
    root,
    update,
  };
}

function grasshopperBeamEngine(movement) {
  const root = new THREE.Group();

  // Brown's engraved radius bar lands away from the useful coupler station.
  // The official page explicitly corrects it to local station M=3, but its
  // sequential canvas construction still lets the nominal eight-unit bar
  // overrun M by as much as 0.000426 unit. We solve the three visible loops
  // simultaneously instead: crank rod P-I, rocking pillar R-W, and radius
  // E-M all close on the one rigid beam L-I-M-W.
  const sourceScale = 0.36;
  const sourceCrankCenter = new THREE.Vector2(0, 0);
  const sourceCrankRadius = 2.062442;
  const sourceCrankPhaseOffset = FULL_TURN * 0.625;
  const sourceConnectingRodLength = 12.000637;
  const sourceCanvasRockerCenter = new THREE.Vector2(-23.967497, 12);
  const sourceCanvasRockerReferenceI = new THREE.Vector2(0, 12);
  const sourceCanvasRockerRadius = sourceCanvasRockerCenter
    .distanceTo(sourceCanvasRockerReferenceI);
  const sourcePillarPivotR = new THREE.Vector2(10.806247, 0);
  const sourcePillarReferenceW = new THREE.Vector2(11, 12);
  const sourcePillarLength = sourcePillarPivotR
    .distanceTo(sourcePillarReferenceW);
  const sourceRadiusPivotE = new THREE.Vector2(-5, 12);
  const sourceRadiusBarLength = 8;
  const sourceBeamStationL = -5;
  const sourceBeamStationI = 0;
  const sourceBeamStationM = 3;
  const sourceBeamStationW = 11;
  const sourceBeamLength = sourceBeamStationW - sourceBeamStationL;
  const sourcePistonRodLength = 9.5;
  const sourceNominalPistonLineX = -5;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const crankCenter = sourceCrankCenter.clone().multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const canvasRockerCenter = sourceCanvasRockerCenter.clone()
    .multiplyScalar(sourceScale);
  const canvasRockerReferenceI = sourceCanvasRockerReferenceI.clone()
    .multiplyScalar(sourceScale);
  const canvasRockerRadius = sourceCanvasRockerRadius * sourceScale;
  const pillarPivotR = sourcePillarPivotR.clone().multiplyScalar(sourceScale);
  const pillarReferenceW = sourcePillarReferenceW.clone()
    .multiplyScalar(sourceScale);
  const pillarLength = sourcePillarLength * sourceScale;
  const radiusPivotE = sourceRadiusPivotE.clone().multiplyScalar(sourceScale);
  const radiusBarLength = sourceRadiusBarLength * sourceScale;
  const beamStationL = sourceBeamStationL * sourceScale;
  const beamStationM = sourceBeamStationM * sourceScale;
  const beamStationW = sourceBeamStationW * sourceScale;
  const beamLength = sourceBeamLength * sourceScale;
  const nominalPistonLineX = sourceNominalPistonLineX * sourceScale;

  const canvasPositionsAtInputTravel = (inputTravel) => {
    const unwrappedInputAngle = sourceCrankPhaseOffset + inputTravel;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const pointP = crankCenter.clone().add(new THREE.Vector2(
      crankRadius * Math.cos(inputAngle),
      crankRadius * Math.sin(inputAngle),
    ));
    const pointI = nearestPoint(
      circleCircleIntersections(
        pointP,
        connectingRodLength,
        canvasRockerCenter,
        canvasRockerRadius,
      ),
      canvasRockerReferenceI,
    );
    const pointW = nearestPoint(
      circleCircleIntersections(
        pointI,
        beamStationW,
        pillarPivotR,
        pillarLength,
      ),
      pillarReferenceW,
    );
    const beamDirection = pointW.clone().sub(pointI).normalize();
    const pointL = pointI.clone().addScaledVector(beamDirection, beamStationL);
    const pointM = pointI.clone().addScaledVector(beamDirection, beamStationM);
    const drawnRadiusEndpoint = radiusPivotE.clone().addScaledVector(
      pointM.clone().sub(radiusPivotE).normalize(),
      radiusBarLength,
    );
    return {
      beamAngle: Math.atan2(beamDirection.y, beamDirection.x),
      drawnRadiusEndpoint,
      inputAngle,
      pointI,
      pointL,
      pointM,
      pointP,
      pointW,
      unwrappedInputAngle,
    };
  };

  const constraintData = (pointI, beamAngle, pointP) => {
    const direction = new THREE.Vector2(
      Math.cos(beamAngle),
      Math.sin(beamAngle),
    );
    const normal = new THREE.Vector2(-direction.y, direction.x);
    const pointW = pointI.clone().addScaledVector(direction, beamStationW);
    const pointM = pointI.clone().addScaledVector(direction, beamStationM);
    const crankRod = pointI.clone().sub(pointP);
    const pillar = pointW.clone().sub(pillarPivotR);
    const radius = pointM.clone().sub(radiusPivotE);
    const residuals = [
      (crankRod.lengthSq() - connectingRodLength ** 2) / 2,
      (pillar.lengthSq() - pillarLength ** 2) / 2,
      (radius.lengthSq() - radiusBarLength ** 2) / 2,
    ];
    const jacobian = [
      [crankRod.x, crankRod.y, 0],
      [pillar.x, pillar.y, beamStationW * pillar.dot(normal)],
      [radius.x, radius.y, beamStationM * radius.dot(normal)],
    ];
    return {
      crankRod,
      direction,
      jacobian,
      normal,
      pillar,
      pointM,
      pointW,
      radius,
      residuals,
    };
  };

  const positionsAtInputTravel = (inputTravel) => {
    const canvas = canvasPositionsAtInputTravel(inputTravel);
    const pointI = canvas.pointI.clone();
    let beamAngle = canvas.beamAngle;
    let iterations = 0;
    let data = constraintData(pointI, beamAngle, canvas.pointP);
    for (; iterations < 8; iterations += 1) {
      const maximumResidual = Math.max(
        ...data.residuals.map((value) => Math.abs(value)),
      );
      if (maximumResidual <= 1e-13) break;
      const correction = solveLinear3(
        data.jacobian,
        data.residuals.map((value) => -value),
      );
      pointI.x += correction[0];
      pointI.y += correction[1];
      beamAngle += correction[2];
      data = constraintData(pointI, beamAngle, canvas.pointP);
    }
    if (iterations === 8) {
      throw new Error('Grasshopper visible-loop solver did not converge');
    }
    const pointL = pointI.clone().addScaledVector(
      data.direction,
      beamStationL,
    );
    const maximumLengthResidual = Math.max(
      Math.abs(data.crankRod.length() - connectingRodLength),
      Math.abs(data.pillar.length() - pillarLength),
      Math.abs(data.radius.length() - radiusBarLength),
    );
    return {
      beamAngle,
      canvas,
      direction: data.direction,
      iterations,
      jacobian: data.jacobian,
      maximumLengthResidual,
      normal: data.normal,
      pointI,
      pointL,
      pointM: data.pointM,
      pointP: canvas.pointP,
      pointW: data.pointW,
    };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const positions = positionsAtInputTravel(inputTravel);
    const {
      beamAngle,
      canvas,
      direction,
      iterations,
      jacobian,
      maximumLengthResidual,
      normal,
      pointI,
      pointL,
      pointM,
      pointP,
      pointW,
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
    const crankRod = pointI.clone().sub(pointP);
    const generalizedVelocity = solveLinear3(jacobian, [
      crankRod.dot(pointPVelocity),
      0,
      0,
    ]);
    const pointIVelocity = new THREE.Vector2(
      generalizedVelocity[0],
      generalizedVelocity[1],
    );
    const beamAngularVelocity = generalizedVelocity[2];
    const velocityAtStation = (station) => pointIVelocity.clone()
      .addScaledVector(normal, station * beamAngularVelocity);
    const pointWVelocity = velocityAtStation(beamStationW);
    const pointMVelocity = velocityAtStation(beamStationM);
    const relativeCrankRodVelocity = pointIVelocity.clone()
      .sub(pointPVelocity);
    const pillarVector = pointW.clone().sub(pillarPivotR);
    const radiusVector = pointM.clone().sub(radiusPivotE);
    const generalizedAcceleration = solveLinear3(jacobian, [
      crankRod.dot(pointPAcceleration)
        - relativeCrankRodVelocity.lengthSq(),
      beamStationW * beamAngularVelocity ** 2
        * pillarVector.dot(direction) - pointWVelocity.lengthSq(),
      beamStationM * beamAngularVelocity ** 2
        * radiusVector.dot(direction) - pointMVelocity.lengthSq(),
    ]);
    const pointIAcceleration = new THREE.Vector2(
      generalizedAcceleration[0],
      generalizedAcceleration[1],
    );
    const beamAngularAcceleration = generalizedAcceleration[2];
    const accelerationAtStation = (station) => pointIAcceleration.clone()
      .addScaledVector(normal, station * beamAngularAcceleration)
      .addScaledVector(direction,
        -station * beamAngularVelocity ** 2);
    const pointLVelocity = velocityAtStation(beamStationL);
    const pointLAcceleration = accelerationAtStation(beamStationL);
    const pointMAcceleration = accelerationAtStation(beamStationM);
    const pointWAcceleration = accelerationAtStation(beamStationW);
    const connectingVector = pointI.clone().sub(pointP);
    const connectingVelocity = pointIVelocity.clone().sub(pointPVelocity);
    const connectingAcceleration = pointIAcceleration.clone()
      .sub(pointPAcceleration);

    return {
      beam: {
        angle: beamAngle,
        angularAcceleration: beamAngularAcceleration,
        angularVelocity: beamAngularVelocity,
      },
      canvasApproximation: {
        beamAngle: canvas.beamAngle,
        drawnRadiusEndpoint: canvas.drawnRadiusEndpoint,
        pointI: canvas.pointI,
        pointL: canvas.pointL,
        pointM: canvas.pointM,
        pointW: canvas.pointW,
        radiusEndpointOvershoot:
          canvas.drawnRadiusEndpoint.distanceTo(canvas.pointM),
        radiusLengthToM: radiusPivotE.distanceTo(canvas.pointM),
      },
      connectingRod: rigidLinkRates(
        connectingVector,
        connectingVelocity,
        connectingAcceleration,
      ),
      inputAngle: canvas.inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      maximumLengthResidual,
      physicalDifferenceFromCanvas: {
        pointI: pointI.distanceTo(canvas.pointI),
        pointL: pointL.distanceTo(canvas.pointL),
        pointM: pointM.distanceTo(canvas.pointM),
        pointW: pointW.distanceTo(canvas.pointW),
      },
      pillar: rigidLinkRates(
        pillarVector,
        pointWVelocity,
        pointWAcceleration,
      ),
      pointI,
      pointIAcceleration,
      pointIVelocity,
      pointL,
      pointLAcceleration,
      pointLVelocity,
      pointM,
      pointMAcceleration,
      pointMVelocity,
      pointP,
      pointPAcceleration,
      pointPVelocity,
      pointW,
      pointWAcceleration,
      pointWVelocity,
      radiusBar: rigidLinkRates(
        radiusVector,
        pointMVelocity,
        pointMAcceleration,
      ),
      solverIterations: iterations,
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
  const sourceStateAtTime = (time) => {
    const canvas = canvasPositionsAtInputTravel(inputAngularSpeed * time);
    return {
      beamAngle: canvas.beamAngle,
      drawnRadiusEndpoint: canvas.drawnRadiusEndpoint,
      inputAngle: canvas.inputAngle,
      pointI: canvas.pointI,
      pointL: canvas.pointL,
      pointM: canvas.pointM,
      pointP: canvas.pointP,
      pointW: canvas.pointW,
    };
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

  let maximumCanvasRadiusEndpointOvershoot = 0;
  let maximumLateralDeviation = 0;
  let maximumLengthResidual = 0;
  let maximumPhysicalDifferenceFromCanvas = 0;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let maximumSolverIterations = 0;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const positions = positionsAtInputTravel(FULL_TURN * sample / 16384);
    const canvasOvershoot = positions.canvas.drawnRadiusEndpoint
      .distanceTo(positions.canvas.pointM);
    maximumCanvasRadiusEndpointOvershoot = Math.max(
      maximumCanvasRadiusEndpointOvershoot,
      canvasOvershoot,
    );
    maximumLateralDeviation = Math.max(
      maximumLateralDeviation,
      Math.abs(positions.pointL.x - nominalPistonLineX),
    );
    maximumLengthResidual = Math.max(
      maximumLengthResidual,
      positions.maximumLengthResidual,
    );
    maximumPhysicalDifferenceFromCanvas = Math.max(
      maximumPhysicalDifferenceFromCanvas,
      positions.pointI.distanceTo(positions.canvas.pointI),
      positions.pointL.distanceTo(positions.canvas.pointL),
      positions.pointM.distanceTo(positions.canvas.pointM),
      positions.pointW.distanceTo(positions.canvas.pointW),
    );
    maximumPistonX = Math.max(maximumPistonX, positions.pointL.x);
    maximumPistonY = Math.max(maximumPistonY, positions.pointL.y);
    maximumSolverIterations = Math.max(maximumSolverIterations,
      positions.iterations);
    minimumPistonX = Math.min(minimumPistonX, positions.pointL.x);
    minimumPistonY = Math.min(minimumPistonY, positions.pointL.y);
  }

  const geometry = {
    beamLength,
    beamStationL,
    beamStationM,
    beamStationW,
    canvasRockerCenter,
    canvasRockerRadius,
    connectingRodLength,
    crankCenter,
    crankRadius,
    cyclePeriod,
    inputAngularSpeed,
    maximumCanvasRadiusEndpointOvershoot,
    maximumLateralDeviation,
    maximumLengthResidual,
    maximumPhysicalDifferenceFromCanvas,
    maximumPistonX,
    maximumPistonY,
    maximumSolverIterations,
    minimumPistonX,
    minimumPistonY,
    nominalPistonLineX,
    outputStroke: maximumPistonY - minimumPistonY,
    pillarLength,
    pillarPivotR,
    radiusBarLength,
    radiusPivotE,
    sourceCrankPhaseOffset,
    sourceScale,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const beamMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const redMaterial = matte(0xd95c40, {
    metalness: 0.09,
    roughness: 0.60,
  });
  const radiusMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const outputMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-grasshopper-bed-cylinder-crank-bearing-radius-pivot-E-and-pillar-pivot-R';
  const framePlaneZ = -0.64;
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(20 * sourceScale, 0.58 * sourceScale, 0.86),
    frameMaterial,
  );
  baseRail.position.set(3 * sourceScale, -1.18 * sourceScale, framePlaneZ);
  baseRail.userData.fixed = true;
  baseRail.userData.role = 'fixed-grasshopper-engine-bed';

  const cylinderSides = [-6.35, -3.65].map((sourceX, index) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.24 * sourceScale, 8.8 * sourceScale, 0.66),
      frameMaterial,
    );
    side.position.set(sourceX * sourceScale, 4.0 * sourceScale, framePlaneZ);
    side.userData.fixed = true;
    side.userData.role = `fixed-cylinder-side-${index + 1}`;
    fixedFrame.add(side);
    return side;
  });
  const cylinderCaps = [0, 8.4].map((sourceY, index) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(3.4 * sourceScale, 0.62 * sourceScale, 0.78),
      frameMaterial,
    );
    cap.position.set(-5 * sourceScale, sourceY * sourceScale, framePlaneZ);
    cap.userData.fixed = true;
    cap.userData.role = `fixed-cylinder-cap-${index + 1}`;
    fixedFrame.add(cap);
    return cap;
  });
  const pistonGuideRails = [-5.54, -4.46].map((sourceX, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * sourceScale, 7.0 * sourceScale, 0.42),
      frameMaterial,
    );
    rail.position.set(sourceX * sourceScale, 10.5 * sourceScale, -0.43);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-piston-guide-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });

  const makePedestal = (center, prefix) => {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(3.2 * sourceScale, 0.65 * sourceScale, 0.86),
      frameMaterial,
    );
    foot.position.set(center.x, -0.65 * sourceScale, framePlaneZ);
    foot.userData.fixed = true;
    foot.userData.role = `fixed-${prefix}-pedestal-foot`;
    const bearing = cylinderAlongZ(0.92 * sourceScale, 0.72,
      frameMaterial, 42);
    bearing.position.set(center.x, center.y, -0.28);
    bearing.userData.fixed = true;
    bearing.userData.role = `fixed-${prefix}-bearing`;
    const shaft = cylinderAlongZ(0.35 * sourceScale, 1.22,
      darkMaterial, 34);
    shaft.position.set(center.x, center.y, 0.02);
    shaft.userData.fixed = true;
    shaft.userData.role = `fixed-${prefix}-shaft`;
    fixedFrame.add(foot, bearing, shaft);
    return { bearing, foot, shaft };
  };
  const crankPedestal = makePedestal(crankCenter, 'crank-center');
  const pillarPedestal = makePedestal(pillarPivotR, 'rocking-pillar-R');

  const radiusWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.54 * sourceScale, 5.0 * sourceScale, 0.82),
    frameMaterial,
  );
  radiusWall.position.set(-7.0 * sourceScale, 12 * sourceScale, framePlaneZ);
  radiusWall.userData.fixed = true;
  radiusWall.userData.role = 'fixed-left-wall-for-radius-pivot-E';
  const radiusBracket = beamBetween3D(
    new THREE.Vector3(-6.9 * sourceScale, 12 * sourceScale, framePlaneZ),
    new THREE.Vector3(radiusPivotE.x, radiusPivotE.y, framePlaneZ),
    0.48 * sourceScale,
    0.68,
    frameMaterial,
  );
  radiusBracket.userData.fixed = true;
  radiusBracket.userData.role = 'fixed-wall-bracket-to-radius-pivot-E';
  const radiusBearing = cylinderAlongZ(0.66 * sourceScale, 0.70,
    frameMaterial, 40);
  radiusBearing.position.set(radiusPivotE.x, radiusPivotE.y, -0.27);
  radiusBearing.userData.fixed = true;
  radiusBearing.userData.role = 'fixed-radius-bar-bearing-E';
  const radiusShaft = cylinderAlongZ(0.25 * sourceScale, 1.70,
    darkMaterial, 32);
  radiusShaft.position.set(radiusPivotE.x, radiusPivotE.y, 0.30);
  radiusShaft.userData.fixed = true;
  radiusShaft.userData.role = 'fixed-shaft-through-E';
  fixedFrame.add(
    baseRail,
    radiusWall,
    radiusBracket,
    radiusBearing,
    radiusShaft,
  );
  root.add(fixedFrame);

  const inputCrank = new THREE.Group();
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role = 'two-point-zero-six-two-four-four-two-unit-crank';
  const crankDisk = cylinderAlongZ(0.88 * sourceScale, 0.30,
    beamMaterial, 42);
  crankDisk.position.z = 0.10;
  crankDisk.userData.role = 'moving-grasshopper-crank-disk';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.54 * sourceScale, 0.26),
    beamMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 0.10);
  crankArm.userData.role = 'crank-arm-to-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, 0.10);
  crankPinAnchor.userData.role = 'analytic-crank-pin-P';
  inputCrank.add(crankDisk, crankArm, crankPinAnchor);
  root.add(inputCrank);

  const connectingParts = makeRigidRod({
    bodyMaterial: redMaterial,
    depth: 0.20,
    eyeMaterial: darkMaterial,
    length: connectingRodLength,
    planeZ: 0.30,
    role: 'twelve-point-zero-zero-zero-six-three-seven-unit-connecting-rod-P-I',
    width: 0.43 * sourceScale,
  });
  root.add(connectingParts.rod);

  const beam = new THREE.Group();
  beam.userData.role = 'sixteen-unit-grasshopper-beam-L-I-M-W';
  const beamBody = new THREE.Mesh(
    new THREE.BoxGeometry(beamLength, 0.78 * sourceScale, 0.30),
    beamMaterial,
  );
  beamBody.position.set((beamStationL + beamStationW) / 2, 0, 0.48);
  beamBody.userData.role = 'rigid-blue-grasshopper-beam';
  const beamStations = {
    I: 0,
    L: beamStationL,
    M: beamStationM,
    W: beamStationW,
  };
  const beamAnchors = {};
  const beamBosses = {};
  Object.entries(beamStations).forEach(([name, station]) => {
    const radius = name === 'I' ? 0.68 : 0.52;
    const boss = cylinderAlongZ(radius * sourceScale, 0.39,
      beamMaterial, 36);
    boss.position.set(station, 0, 0.48);
    boss.userData.role = `beam-station-boss-${name}`;
    const anchor = new THREE.Object3D();
    anchor.position.set(station, 0, 0.48);
    anchor.userData.role = `analytic-beam-station-${name}`;
    beam.add(boss, anchor);
    beamBosses[name] = boss;
    beamAnchors[name] = anchor;
  });
  beam.add(beamBody);
  root.add(beam);

  const pillarParts = makeRigidRod({
    bodyMaterial: redMaterial,
    depth: 0.22,
    eyeMaterial: darkMaterial,
    length: pillarLength,
    planeZ: 0.08,
    role: 'rocking-pillar-A-from-fixed-R-to-beam-W',
    width: 0.48 * sourceScale,
  });
  root.add(pillarParts.rod);

  const radiusParts = makeRigidRod({
    bodyMaterial: radiusMaterial,
    depth: 0.19,
    eyeMaterial: darkMaterial,
    length: radiusBarLength,
    planeZ: 0.78,
    role: 'eight-unit-corrected-radius-bar-B-from-E-to-beam-center-M',
    width: 0.42 * sourceScale,
  });
  root.add(radiusParts.rod);

  const pistonOutput = new THREE.Group();
  pistonOutput.userData.rotationDegreesOfFreedom = 0;
  pistonOutput.userData.role = 'vertical-piston-rod-carried-by-left-beam-point-L';
  const pistonRodLength = sourcePistonRodLength * sourceScale;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.38 * sourceScale, pistonRodLength, 0.20),
    outputMaterial,
  );
  pistonRod.position.set(0, -pistonRodLength / 2, 0.16);
  pistonRod.userData.role = 'grasshopper-piston-rod-below-L';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(2.45 * sourceScale, 0.64 * sourceScale, 0.62),
    outputMaterial,
  );
  pistonHead.position.set(0, -9.05 * sourceScale, 0.03);
  pistonHead.userData.role = 'grasshopper-piston-head';
  const pistonAnchor = new THREE.Object3D();
  pistonAnchor.position.z = 0.16;
  pistonAnchor.userData.role = 'analytic-output-piston-pin-L';
  pistonOutput.add(pistonRod, pistonHead, pistonAnchor);
  root.add(pistonOutput);

  const jointPins = {
    I: cylinderAlongZ(0.25 * sourceScale, 0.52, whiteMaterial, 30),
    L: cylinderAlongZ(0.25 * sourceScale, 0.48, whiteMaterial, 30),
    M: cylinderAlongZ(0.23 * sourceScale, 0.66, whiteMaterial, 30),
    P: cylinderAlongZ(0.23 * sourceScale, 0.46, whiteMaterial, 30),
    W: cylinderAlongZ(0.27 * sourceScale, 0.90, whiteMaterial, 30),
  };
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
    root.add(pin);
  });

  const contacts = {
    beamAtI: {
      members: [beam, connectingParts.rod],
      point: new THREE.Vector3(),
      type: 'connecting-rod-to-beam-pin-I',
    },
    beamAtL: {
      members: [beam, pistonOutput],
      point: new THREE.Vector3(),
      type: 'beam-to-piston-pin-L',
    },
    beamAtM: {
      members: [beam, radiusParts.rod],
      point: new THREE.Vector3(),
      type: 'corrected-radius-to-beam-center-pin-M',
    },
    beamAtW: {
      members: [beam, pillarParts.rod],
      point: new THREE.Vector3(),
      type: 'beam-to-rocking-pillar-pin-W',
    },
    crankAtP: {
      members: [inputCrank, connectingParts.rod],
      point: new THREE.Vector3(),
      type: 'crank-to-connecting-rod-pin-P',
    },
    pillarPivotR: {
      fixedMember: fixedFrame,
      movingMember: pillarParts.rod,
      point: new THREE.Vector3(pillarPivotR.x, pillarPivotR.y, 0.08),
      type: 'fixed-rocking-pillar-pivot-R',
    },
    radiusPivotE: {
      fixedMember: fixedFrame,
      movingMember: radiusParts.rod,
      point: new THREE.Vector3(radiusPivotE.x, radiusPivotE.y, 0.78),
      type: 'fixed-radius-bar-pivot-E',
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
    beam.position.set(state.pointI.x, state.pointI.y, 0);
    beam.rotation.z = state.beam.angle;
    beam.userData.angularSpeed = state.beam.angularVelocity;
    beam.userData.angularAcceleration = state.beam.angularAcceleration;
    setRodPose(pillarParts.rod, pillarPivotR, state.pillar);
    setRodPose(radiusParts.rod, radiusPivotE, state.radiusBar);
    pistonOutput.position.set(state.pointL.x, state.pointL.y, 0);
    pistonOutput.userData.velocity = new THREE.Vector3(
      state.pointLVelocity.x,
      state.pointLVelocity.y,
      0,
    );
    pistonOutput.userData.acceleration = new THREE.Vector3(
      state.pointLAcceleration.x,
      state.pointLAcceleration.y,
      0,
    );
    const points = {
      I: [state.pointI, 0.43],
      L: [state.pointL, 0.42],
      M: [state.pointM, 0.69],
      P: [state.pointP, 0.34],
      W: [state.pointW, 0.40],
    };
    Object.entries(points).forEach(([name, [point, z]]) => {
      jointPins[name].position.set(point.x, point.y, z);
    });
    contacts.crankAtP.point.set(state.pointP.x, state.pointP.y, 0.34);
    contacts.beamAtI.point.set(state.pointI.x, state.pointI.y, 0.43);
    contacts.beamAtL.point.set(state.pointL.x, state.pointL.y, 0.42);
    contacts.beamAtM.point.set(state.pointM.x, state.pointM.y, 0.69);
    contacts.beamAtW.point.set(state.pointW.x, state.pointW.y, 0.40);
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-7.955301, -3.78029);
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
    'grasshopper-engine-crank-six-bar-corrected-mid-beam-radius-motion';
  root.userData.blocks = {
    baseRail,
    beam,
    beamAnchors,
    beamBody,
    beamBosses,
    connectingRod: connectingParts.rod,
    connectingRodEndAnchor: connectingParts.endAnchor,
    connectingRodStartAnchor: connectingParts.startAnchor,
    crankArm,
    crankDisk,
    crankPedestal,
    crankPinAnchor,
    cylinderCaps,
    cylinderSides,
    fixedFrame,
    inputCrank,
    jointPins,
    pillar: pillarParts.rod,
    pillarEndAnchor: pillarParts.endAnchor,
    pillarPedestal,
    pillarStartAnchor: pillarParts.startAnchor,
    pistonAnchor,
    pistonGuideRails,
    pistonHead,
    pistonOutput,
    pistonRod,
    radiusBar: radiusParts.rod,
    radiusBarEndAnchor: radiusParts.endAnchor,
    radiusBarStartAnchor: radiusParts.startAnchor,
    radiusBearing,
    radiusWall,
  };
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(
      officialViewMinimum.x * sourceScale,
      officialViewMinimum.y * sourceScale,
      -1.08,
    ),
    new THREE.Vector3(
      (officialViewMinimum.x + officialViewWidth) * sourceScale,
      (officialViewMinimum.y + officialViewHeight) * sourceScale,
      1.22,
    ),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating 2.062442-unit crank',
    mechanism: 1,
    output:
      'left beam station L carries the piston through an almost exact vertical six-unit stroke',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -1.42;
  root.userData.mechanism =
    'crank-P-connecting-rod-P-I-rigid-beam-L-I-M-W-rocking-pillar-R-W-corrected-radius-E-M-and-piston-at-L';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    correctionNote:
      'the official animation moves Brown’s ineffective radius-bar joint to local beam station M=3, the center station used here',
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_rot',
      'add_c_rod_r',
      'add_c_rod_r',
      'add_rot_to',
      'add_rot_to',
      'add_tx',
      'add_text',
    ],
    officialGeometry: {
      beamLength: sourceBeamLength,
      beamStationI: sourceBeamStationI,
      beamStationL: sourceBeamStationL,
      beamStationM: sourceBeamStationM,
      beamStationW: sourceBeamStationW,
      canvasRockerCenter: sourceCanvasRockerCenter,
      canvasRockerRadius: sourceCanvasRockerRadius,
      canvasRockerReferenceI: sourceCanvasRockerReferenceI,
      connectingRodLength: sourceConnectingRodLength,
      crankCenter: sourceCrankCenter,
      crankPhaseOffsetTurns: 0.625,
      crankRadius: sourceCrankRadius,
      nominalPistonLineX: sourceNominalPistonLineX,
      pillarLength: sourcePillarLength,
      pillarPivotR: sourcePillarPivotR,
      pillarReferenceW: sourcePillarReferenceW,
      pistonRodLength: sourcePistonRodLength,
      radiusBarLength: sourceRadiusBarLength,
      radiusPivotE: sourceRadiusPivotE,
    },
    officialPageAnimatedTabDisabled: false,
    reconstructionDifference:
      'the exact simultaneous visible-loop solve removes the canvas radius endpoint overrun of at most 0.000426 source unit and moves every point by less than 0.000442 source unit',
    referenceScope:
      'official crank and connecting rod, beam stations L-I-M-W, rocking pillar, corrected center radius joint, piston, source correction note, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate341: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'right beam end W is carried by rocking pillar A, left point L carries the piston, and radius bar B is corrected from Brown’s drawn joint to center station M',
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
    officialNote:
      'The radius-bar in Brown’s illustration would not appear to generate a parallel motion; the official animation moves its right joint to the center of the beam.',
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
    canvasRounding:
      'the sequential canvas solve aims an eight-unit bar through M but can overrun that joint by 0.000426 source unit',
    exactRigidConstraints:
      '|P-I|=12.000637, |R-W|=12.001564074, |E-M|=8, and rigid beam stations L=-5, I=0, M=3, W=11 in source units',
    input:
      'the compact crank beside the cylinder drives beam station I through one finite connecting rod',
    output:
      'the corrected six-bar carries piston point L on an almost perfectly vertical six-unit stroke',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(1.2, 0.6, 14),
    root,
    update,
  };
}

export function createAuthoredDirectActionParallelMotion(movement) {
  switch (movement.id) {
    case 339: return directActionEngineParallelMotion(movement);
    case 340: return jogglingPillarParallelMotion(movement);
    case 341: return grasshopperBeamEngine(movement);
    default: return null;
  }
}
