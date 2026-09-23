import * as THREE from 'three';
import { makeBoredLinkRod as makeRigidRod } from './bored-link-rod.js';
import { boredCylinderGeometry, boredJournal, fitPistonGuide } from './piston-guide-parts.js';
import { capsule, circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
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

  // Brown's frame is one bell-shaped casting with an upper oval window and a
  // lower arched window; F is carried on the web between them, behind the
  // connecting rod. Every member that sweeps the piston line through F is
  // therefore stacked in front of the radius bar, which alone meets F's pin:
  // casting, radius bar and slot, bar B-C, crosshead, connecting rod.
  const frameFrontZ = -0.57;
  const frameBackZ = -0.87;
  const barBCPlaneZ = -0.02;
  const radiusPlaneZ = -0.28;
  const sliderPlaneZ = -0.29;
  const crossheadPlaneZ = 0.20;
  const connectingPlaneZ = 0.45;
  const crankPlaneZ = 0.12;
  const crankShaftRadius = 0.40 * sourceScale;
  const crankBoreRadius = crankShaftRadius + 0.012;
  const pistonRodRadius = 0.23 * sourceScale;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-engine-casting-crank-bearing-slot-D-cylinder-cover-and-radius-pivot-F';
  const toModel = (points) => points.map(([x, y]) => [x * sourceScale, y * sourceScale]);
  const castingOutline = toModel([
    [8.3, -31.5], [7.2, -20], [6.6, -14], [6.2, -8], [5.3, -4.5],
    [4.0, -2.3], [2.7, -1.14], [2.7, -0.4], [1.9, -0.4], [1.9, 0.9],
    [-1.9, 0.9], [-1.9, -0.4], [-2.7, -0.4], [-2.7, -1.14], [-4.0, -2.3],
    [-5.3, -4.5], [-6.2, -8], [-6.5, -12.6], [-6.5, -14.5], [-12.4, -14.5],
    [-12.4, -13.2], [-18.1, -13.2], [-18.1, -16.3], [-14.0, -16.3],
    [-11.4, -18.6], [-9.2, -21.0], [-7.9, -23.8], [-7.6, -31.5],
  ]);
  const ellipse = (cx, cy, rx, ry, count = 96) => Array.from({ length: count },
    (_, i) => [cx + rx * Math.cos(FULL_TURN * i / count),
      cy + ry * Math.sin(FULL_TURN * i / count)]);
  const upperWindow = toModel(ellipse(0, -8.3, 3.7, 4.75));
  const archRadius = 5.33;
  const lowerWindow = toModel([
    ...Array.from({ length: 49 }, (_, i) => {
      const angle = Math.PI * i / 48;
      return [archRadius * Math.cos(angle),
        -15.6 - archRadius + archRadius * Math.sin(angle)];
    }),
    [-archRadius, -32.5], [archRadius, -32.5],
  ]);
  const casting = new THREE.Mesh(
    plate(clip.difference(poly(castingOutline), poly(upperWindow),
      poly(lowerWindow), poly(circle([0, 0], crankBoreRadius, 64))),
    frameBackZ, frameFrontZ),
    frameMaterial,
  );
  casting.userData.fixed = true;
  casting.userData.role = 'fixed-bell-engine-casting-with-oval-and-arched-windows';
  fixedFrame.add(casting);
  const archMembers = [casting];

  const crankBearing = boredJournal(1.25 * sourceScale, crankBoreRadius,
    frameFrontZ + 0.51 - frameFrontZ, frameMaterial);
  crankBearing.position.set(crankCenterO.x, crankCenterO.y,
    frameFrontZ + 0.255);
  crankBearing.userData.fixed = true;
  crankBearing.userData.role = 'fixed-upper-crank-bearing-O';

  const slotMinimumX = -16.25 * sourceScale;
  const slotMaximumX = -13.25 * sourceScale;
  const slotCenterX = (slotMinimumX + slotMaximumX) / 2;
  const slotRailLength = slotMaximumX - slotMinimumX;
  const slotRails = [-14.5625, -13.4375].map((sourceY, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(slotRailLength, 0.18 * sourceScale, 0.34),
      frameMaterial,
    );
    rail.position.set(slotCenterX, sourceY * sourceScale, sliderPlaneZ);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-horizontal-slot-D-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const slotEnd = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * sourceScale, 1.30 * sourceScale, 0.34),
    frameMaterial,
  );
  slotEnd.position.set(-16.25 * sourceScale, sliderLineY, sliderPlaneZ);
  slotEnd.userData.fixed = true;
  slotEnd.userData.role = 'fixed-closed-end-of-horizontal-slot-D';
  // The slot box D stands off the casting's side bracket behind the shoe.
  const slotSupportBackZ = frameBackZ;
  const slotSupportFrontZ = sliderPlaneZ - 0.165;
  const slotSupport = new THREE.Mesh(
    new THREE.BoxGeometry(3.4 * sourceScale, 1.30 * sourceScale,
      slotSupportFrontZ - slotSupportBackZ),
    frameMaterial,
  );
  slotSupport.position.set(slotCenterX, sliderLineY,
    (slotSupportFrontZ + slotSupportBackZ) / 2);
  slotSupport.userData.fixed = true;
  slotSupport.userData.role = 'fixed-slot-D-backing-on-casting-bracket';
  fixedFrame.add(slotSupport);

  // The plate shows the stuffing box and cover of the cylinder under C, with
  // the cylinder broken off below; the piston itself is hidden inside.
  const verticalBored = (radius, bore, low, high, role) => {
    const mesh = new THREE.Mesh(
      boredCylinderGeometry(radius * sourceScale, bore,
        (high - low) * sourceScale),
      frameMaterial,
    );
    mesh.position.set(pistonLineX, (low + high) / 2 * sourceScale,
      crossheadPlaneZ);
    mesh.userData.fixed = true;
    mesh.userData.role = role;
    fixedFrame.add(mesh);
    return mesh;
  };
  const pistonBore = pistonRodRadius + 0.012;
  const stuffingBox = verticalBored(2.1, pistonBore, -25.1, -23.7,
    'fixed-stuffing-box-gland-on-cylinder-cover');
  const stuffingNeck = verticalBored(1.55, pistonBore, -26.5, -25.1,
    'fixed-stuffing-box-neck');
  const cylinderCover = verticalBored(6.2, pistonBore, -27.8, -26.5,
    'fixed-cylinder-cover-flange');
  const cylinderBody = verticalBored(5.3, 4.9 * sourceScale, -33.2, -27.8,
    'fixed-broken-off-cylinder-body');
  const cylinderCrown = cylinderCover;

  const radiusBearing = cylinderAlongZ(0.57 * sourceScale,
    radiusPlaneZ - 0.12 - frameFrontZ, frameMaterial, 40);
  radiusBearing.position.set(radiusPivotF.x, radiusPivotF.y,
    (frameFrontZ + radiusPlaneZ - 0.12) / 2);
  radiusBearing.userData.fixed = true;
  radiusBearing.userData.role = 'fixed-radius-bar-boss-F-on-casting-web';
  const radiusShaftBackZ = frameFrontZ - 0.03;
  const radiusShaftFrontZ = radiusPlaneZ + 0.11;
  const radiusShaft = cylinderAlongZ(0.22 * sourceScale,
    radiusShaftFrontZ - radiusShaftBackZ, darkMaterial, 32);
  radiusShaft.position.set(radiusPivotF.x, radiusPivotF.y,
    (radiusShaftFrontZ + radiusShaftBackZ) / 2);
  radiusShaft.userData.fixed = true;
  radiusShaft.userData.role = 'fixed-pin-through-radius-pivot-F';
  fixedFrame.add(
    crankBearing,
    slotEnd,
    radiusBearing,
    radiusShaft,
  );
  root.add(fixedFrame);

  const pistonOutput = new THREE.Group();
  pistonOutput.userData.rotationDegreesOfFreedom = 0;
  pistonOutput.userData.role =
    'vertically-guided-direct-action-piston-rod-connected-at-C';
  const pistonCrosshead = new THREE.Mesh(
    new THREE.BoxGeometry(1.34 * sourceScale, 0.76 * sourceScale, 0.24),
    blueMaterial,
  );
  pistonCrosshead.position.z = crossheadPlaneZ;
  pistonCrosshead.userData.role = 'piston-crosshead-centered-at-C';
  const pistonRodLength = 14.5 * sourceScale;
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(pistonRodRadius, pistonRodRadius,
      pistonRodLength, 28),
    blueMaterial,
  );
  pistonRod.position.set(0, -pistonRodLength / 2, crossheadPlaneZ);
  pistonRod.userData.role = 'round-piston-rod-below-C-into-stuffing-box';
  const pointCAnchor = new THREE.Object3D();
  pointCAnchor.position.z = crossheadPlaneZ;
  pointCAnchor.userData.role = 'analytic-piston-and-bar-point-C';
  pistonOutput.add(
    pistonCrosshead,
    pistonRod,
    pointCAnchor,
  );
  root.add(pistonOutput);

  const inputCrank = new THREE.Group();
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role = 'four-unit-upper-driving-crank-O-P';
  const crankDisk = cylinderAlongZ(1.05 * sourceScale, 0.32,
    blueMaterial, 42);
  crankDisk.position.z = crankPlaneZ;
  crankDisk.userData.role = 'moving-upper-crank-disk';
  const crankShaftFrontZ = crankPlaneZ + 0.15;
  const crankShaftBackZ = frameBackZ + 0.02;
  const crankShaft = cylinderAlongZ(crankShaftRadius,
    crankShaftFrontZ - crankShaftBackZ, darkMaterial, 34);
  crankShaft.position.z = (crankShaftFrontZ + crankShaftBackZ) / 2;
  crankShaft.userData.role = 'crankshaft-O-turning-in-casting-bearing';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.52 * sourceScale, 0.27),
    blueMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, crankPlaneZ);
  crankArm.userData.role = 'four-unit-crank-arm-O-P';
  const crankPinBoss = cylinderAlongZ(0.50 * sourceScale, 0.30,
    blueMaterial, 36);
  crankPinBoss.position.set(crankRadius, 0, crankPlaneZ);
  crankPinBoss.userData.role = 'moving-crank-pin-boss-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, crankPlaneZ);
  crankPinAnchor.userData.role = 'analytic-crank-pin-P';
  inputCrank.add(crankDisk, crankShaft, crankArm, crankPinBoss,
    crankPinAnchor);
  root.add(inputCrank);

  const connectingParts = makeRigidRod({
    bodyMaterial: redMaterial,
    depth: 0.19,
    eyeMaterial: darkMaterial,
    length: connectingRodLength,
    planeZ: connectingPlaneZ,
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
    ]), poly(circle([0, 0], 0.22 * sourceScale + 0.006, 64))), -0.13, 0.13),
    greenMaterial,
  );
  sliderBlock.position.z = sliderPlaneZ;
  sliderBlock.userData.role = 'moving-block-B-inside-slot-D';
  const pointBAnchor = new THREE.Object3D();
  pointBAnchor.position.z = sliderPlaneZ;
  pointBAnchor.userData.role = 'analytic-horizontal-slider-point-B';
  sliderB.add(sliderBlock, pointBAnchor);
  root.add(sliderB);

  const barBCParts = makeRigidRod({
    bodyMaterial: greenMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: barBCLength,
    planeZ: barBCPlaneZ,
    role: 'fifteen-unit-rigid-bar-B-C',
    width: 0.42 * sourceScale,
  });
  const pointAAnchor = new THREE.Object3D();
  pointAAnchor.position.set(midpointDistance, 0, barBCPlaneZ);
  pointAAnchor.userData.role = 'analytic-exact-midpoint-A-of-B-C';
  barBCParts.rod.userData.addPinEye(midpointDistance, 0.23 * sourceScale + 0.006);
  barBCParts.rod.add(pointAAnchor);
  root.add(barBCParts.rod);

  const radiusParts = makeRigidRod({
    bodyMaterial: orangeMaterial,
    depth: 0.18,
    eyeMaterial: darkMaterial,
    length: radiusBarLength,
    planeZ: radiusPlaneZ,
    role: 'seven-point-five-unit-fixed-radius-bar-F-A',
    width: 0.40 * sourceScale,
  });
  root.add(radiusParts.rod);

  // Each pin is rigid with one member and turns in true bores of the others.
  const pinBetween = (radius, low, high) => {
    const pin = cylinderAlongZ(radius, high - low, whiteMaterial, 30);
    pin.position.z = (low + high) / 2;
    return pin;
  };
  const jointPins = {
    A: pinBetween(0.23 * sourceScale, radiusPlaneZ - 0.10, barBCPlaneZ + 0.10),
    B: pinBetween(0.22 * sourceScale, sliderPlaneZ - 0.14, barBCPlaneZ + 0.10),
    C: pinBetween(0.25 * sourceScale, barBCPlaneZ - 0.10,
      connectingPlaneZ + 0.105),
    P: pinBetween(0.24 * sourceScale, crankPlaneZ - 0.14,
      connectingPlaneZ + 0.105),
  };
  jointPins.A.position.x = radiusBarLength;
  radiusParts.rod.add(jointPins.A);
  sliderB.add(jointPins.B);
  pistonOutput.add(jointPins.C);
  jointPins.P.position.x = crankRadius;
  inputCrank.add(jointPins.P);
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
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
    contacts.crankAtP.point.set(state.pointP.x, state.pointP.y,
      jointPins.P.position.z);
    contacts.barAtC.point.set(state.pointC.x, state.pointC.y,
      jointPins.C.position.z);
    contacts.pistonGuideC.point.set(state.pointC.x, state.pointC.y,
      crossheadPlaneZ);
    contacts.sliderAtB.point.set(state.pointB.x, state.pointB.y,
      sliderPlaneZ);
    contacts.midpointAtA.point.set(state.pointA.x, state.pointA.y,
      jointPins.A.position.z);
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
    casting,
    connectingRod: connectingParts.rod,
    connectingRodEndAnchor: connectingParts.endAnchor,
    connectingRodStartAnchor: connectingParts.startAnchor,
    crankArm,
    crankDisk,
    crankPinAnchor,
    crankShaft,
    cylinderBody,
    cylinderCover,
    cylinderCrown,
    fixedFrame,
    inputCrank,
    jointPins,
    pistonCrosshead,
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
    stuffingBox,
    stuffingNeck,
    radiusBearing,
    radiusShaft,
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
  // Brown's view: slot box D at the left, crank pedestal at the top and the
  // cylinder broken off just below its cover.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-19.5 * sourceScale, -31.0 * sourceScale, -0.9),
    new THREE.Vector3(9.5 * sourceScale, 1.6 * sourceScale, 0.6),
  );
  root.userData.cameraDistanceScale = 0.96;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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

  // Brown shows only the hatched shaft in the pillar's large eye at F and a
  // bracket from the hatched wall at E; the bed, standard and rod guides are
  // not drawn. E's pin and bracket stand in front of the beam so that the
  // piston end C sweeps past E's height without meeting fixed metal.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-pillar-shaft-F-and-wall-bracket-for-radius-pivot-E';
  const pillarPlaneZ = 0.08;
  const beamPlaneZ = 0.40;
  const radiusPlaneZ = 0.75;
  const rodPlaneZ = 0.18;
  const pillarShaftRadius = 0.95 * sourceScale;
  const pillarShaft = cylinderAlongZ(pillarShaftRadius, 0.52,
    darkMaterial, 40);
  pillarShaft.position.set(pillarPivotF.x, pillarPivotF.y, pillarPlaneZ);
  pillarShaft.userData.fixed = true;
  pillarShaft.userData.role = 'fixed-hatched-shaft-through-F';

  const wallX = 10.1 * sourceScale;
  const wallFrontZ = radiusPlaneZ + 0.30;
  const wallBackZ = -0.45;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.55 * sourceScale, 7.0 * sourceScale,
      wallFrontZ - wallBackZ),
    frameMaterial,
  );
  wall.position.set(wallX, 10 * sourceScale, (wallFrontZ + wallBackZ) / 2);
  wall.userData.fixed = true;
  wall.userData.role = 'fixed-right-wall-for-radius-pivot-E';
  const bracketPlaneZ = radiusPlaneZ + 0.19;
  const radiusBracket = new THREE.Mesh(
    plate(clip.union(
      poly([
        [radiusPivotE.x, radiusPivotE.y - 0.30 * sourceScale],
        [wallX, radiusPivotE.y - 1.9 * sourceScale],
        [wallX, radiusPivotE.y + 0.9 * sourceScale],
        [radiusPivotE.x, radiusPivotE.y + 0.30 * sourceScale],
      ]),
      poly(circle([radiusPivotE.x, radiusPivotE.y], 0.62 * sourceScale, 48)),
    ), bracketPlaneZ - 0.06, bracketPlaneZ + 0.06),
    frameMaterial,
  );
  radiusBracket.userData.fixed = true;
  radiusBracket.userData.role = 'fixed-wall-bracket-to-E';
  const radiusBearing = radiusBracket;
  const radiusShaft = cylinderAlongZ(0.24 * sourceScale,
    bracketPlaneZ - radiusPlaneZ + 0.14, darkMaterial, 32);
  radiusShaft.position.set(radiusPivotE.x, radiusPivotE.y,
    (bracketPlaneZ + radiusPlaneZ - 0.14) / 2);
  radiusShaft.userData.fixed = true;
  radiusShaft.userData.role = 'fixed-pin-through-E';
  fixedFrame.add(
    pillarShaft,
    wall,
    radiusBracket,
    radiusShaft,
  );
  root.add(fixedFrame);

  // The joggling pillar is drawn as a broad tapering link with a large eye
  // round the hatched shaft F and a smaller eye under the beam's boss B.
  const pillarPinRadius = 0.60 * sourceScale;
  const pillarBores = [
    { x: 0, y: 0, radius: pillarShaftRadius + 0.02 },
    { x: pillarLength, y: 0, radius: pillarPinRadius + 0.012 },
  ];
  const pillarBody = new THREE.Mesh(
    plate(clip.difference(
      clip.union(
        poly([
          [0, -1.20 * sourceScale],
          [pillarLength, -0.85 * sourceScale],
          [pillarLength, 0.85 * sourceScale],
          [0, 1.20 * sourceScale],
        ]),
        poly(circle([0, 0], 1.95 * sourceScale, 72)),
        poly(circle([pillarLength, 0], 1.15 * sourceScale, 60)),
      ),
      ...pillarBores.map((bore) => poly(circle([bore.x, bore.y], bore.radius, 60))),
    ), pillarPlaneZ - 0.125, pillarPlaneZ + 0.125),
    pillarMaterial,
  );
  pillarBody.userData.role =
    'joggling-pillar-F-B-vibrating-about-fixed-center-F-bored-tapered-body';
  pillarBody.userData.bores = pillarBores;
  const pillarRod = new THREE.Group();
  pillarRod.userData.nominalLength = pillarLength;
  pillarRod.userData.role = 'joggling-pillar-F-B-vibrating-about-fixed-center-F';
  const pillarStartAnchor = new THREE.Object3D();
  pillarStartAnchor.position.z = pillarPlaneZ;
  pillarStartAnchor.userData.role = 'joggling-pillar-analytic-start-F';
  const pillarEndAnchor = new THREE.Object3D();
  pillarEndAnchor.position.set(pillarLength, 0, pillarPlaneZ);
  pillarEndAnchor.userData.role = 'joggling-pillar-analytic-end-B';
  pillarRod.add(pillarBody, pillarStartAnchor, pillarEndAnchor);
  const pillarParts = {
    body: pillarBody,
    endAnchor: pillarEndAnchor,
    rod: pillarRod,
    startAnchor: pillarStartAnchor,
  };
  root.add(pillarParts.rod);

  // The beam is drawn as a broad bar with rounded ends at D and C and a
  // large boss at B; pins D, B, A and C are rigid with it.
  const beam = new THREE.Group();
  beam.userData.role = 'sixteen-unit-beam-D-B-A-C';
  const beamHalfWidth = 0.90 * sourceScale;
  const beamBody = new THREE.Mesh(
    plate(capsule([0, 0], [beamDCLength, 0], beamHalfWidth, 32),
      beamPlaneZ - 0.14, beamPlaneZ + 0.14),
    beamMaterial,
  );
  beamBody.userData.role = 'rigid-blue-beam-body-D-C';
  const beamBosses = {
    B: cylinderAlongZ(1.45 * sourceScale, 0.36, beamMaterial, 48),
  };
  beamBosses.B.position.set(beamDBLength, 0, beamPlaneZ);
  Object.entries(beamBosses).forEach(([name, boss]) => {
    boss.userData.role = `beam-pin-boss-${name}`;
  });
  const beamAnchors = {
    A: new THREE.Object3D(),
    B: new THREE.Object3D(),
    C: new THREE.Object3D(),
    D: new THREE.Object3D(),
  };
  beamAnchors.D.position.set(0, 0, beamPlaneZ);
  beamAnchors.B.position.set(beamDBLength, 0, beamPlaneZ);
  beamAnchors.A.position.set(beamDALength, 0, beamPlaneZ);
  beamAnchors.C.position.set(beamDCLength, 0, beamPlaneZ);
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
    planeZ: radiusPlaneZ,
    role: 'corrected-four-point-seven-eight-nine-nine-five-six-unit-radius-bar-E-A',
    width: 0.42 * sourceScale,
  });
  root.add(radiusParts.rod);

  // The vertical rods hang behind the beam from bored eyes on pins D and C.
  const endPinRadius = 0.30 * sourceScale;
  const makeVerticalMovingRod = (material, role, colorRole) => {
    const group = new THREE.Group();
    group.userData.rotationDegreesOfFreedom = 0;
    group.userData.role = role;
    const rodLength = sourcePistonRodLength * sourceScale;
    const halfWidth = 0.30 * sourceScale;
    const bore = { x: 0, y: 0, radius: endPinRadius + 0.012 };
    const rod = new THREE.Mesh(
      plate(clip.difference(
        clip.union(
          poly([[-halfWidth, -rodLength], [halfWidth, -rodLength],
            [halfWidth, 0], [-halfWidth, 0]]),
          poly(circle([0, 0], 0.62 * sourceScale, 48)),
        ),
        poly(circle([0, 0], bore.radius, 48)),
      ), rodPlaneZ - 0.07, rodPlaneZ + 0.07),
      material,
    );
    rod.userData.role = `${colorRole}-vertical-rod-with-bored-top-eye`;
    rod.userData.bores = [bore];
    const anchor = new THREE.Object3D();
    anchor.position.z = rodPlaneZ;
    anchor.userData.role = `analytic-${colorRole}-pin`;
    group.add(rod, anchor);
    return { anchor, group, rod };
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

  const pinBetween = (radius, low, high, x) => {
    const pin = cylinderAlongZ(radius, high - low, whiteMaterial, 30);
    pin.position.set(x, 0, (low + high) / 2);
    beam.add(pin);
    return pin;
  };
  const jointPins = {
    A: pinBetween(0.23 * sourceScale, beamPlaneZ - 0.15,
      radiusPlaneZ + 0.11, beamDALength),
    B: pinBetween(pillarPinRadius, pillarPlaneZ - 0.14,
      beamPlaneZ + 0.19, beamDBLength),
    C: pinBetween(endPinRadius, rodPlaneZ - 0.08, beamPlaneZ + 0.15,
      beamDCLength),
    D: pinBetween(endPinRadius, rodPlaneZ - 0.08, beamPlaneZ + 0.15, 0),
  };
  Object.entries(jointPins).forEach(([name, pin]) => {
    pin.userData.role = `common-working-pin-${name}`;
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
    contacts.beamAtD.point.set(state.pointD.x, state.pointD.y,
      jointPins.D.position.z);
    contacts.beamAtB.point.set(state.pointB.x, state.pointB.y,
      jointPins.B.position.z);
    contacts.beamAtA.point.set(state.pointA.x, state.pointA.y,
      jointPins.A.position.z);
    contacts.beamAtC.point.set(state.pointC.x, state.pointC.y,
      jointPins.C.position.z);
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
    beam,
    beamAnchors,
    beamBody,
    beamBosses,
    fixedFrame,
    inputRod: inputRodParts.group,
    inputRodAnchor: inputRodParts.anchor,
    jointPins,
    pillar: pillarParts.rod,
    pillarEndAnchor: pillarParts.endAnchor,
    pillarShaft,
    pillarStartAnchor: pillarParts.startAnchor,
    pistonRod: pistonParts.group,
    pistonRodAnchor: pistonParts.anchor,
    radiusBar: radiusParts.rod,
    radiusBarEndAnchor: radiusParts.endAnchor,
    radiusBarStartAnchor: radiusParts.startAnchor,
    radiusBearing,
    radiusBracket,
    radiusShaft,
    wall,
  };

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
  // Brown's view: beam end D at the left, the wall at E on the right, the
  // pillar shaft F at the foot, and both vertical rods cut by the margin.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.55, -0.90, -0.30),
    new THREE.Vector3(4.00, 5.40, 1.00),
  );
  root.userData.cameraDistanceScale = 0.96;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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

  // Planes follow the plate: the radius bar B is dashed behind the beam, so
  // its wall bracket and pin E stay behind the beam, while the connecting rod,
  // rocking pillar A and piston rod hang in front of it.
  const wallPlaneZ = -0.62;
  const bracketPlaneZ = -0.50;
  const radiusPlaneZ = -0.30;
  const beamPlaneZ = 0;
  const rodPlaneZ = 0.30;
  const crankPlaneZ = 0.12;
  const pedestalPlaneZ = -0.25;
  const beamHalfDepth = 0.15;
  const rodHalfDepth = 0.08;
  const s = sourceScale;
  const pinClearance = 0.012;
  const workingPinRadius = 0.25 * s;
  const radiusPinRadius = 0.23 * s;
  const shaftRadius = 0.36 * s;
  const groundY = -1.26 * s;

  const boredPlate = (outline, bores, low, high, material, role) => {
    const mesh = new THREE.Mesh(plate(bores.length
      ? clip.difference(outline, ...bores.map(bore =>
        poly(circle([bore.x, bore.y], bore.radius, 64))))
      : outline, low, high), material);
    mesh.userData.bores = bores.map(bore => ({ ...bore }));
    mesh.userData.role = role;
    return mesh;
  };

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-grasshopper-cylinder-crank-pedestal-radius-bracket-E-and-pillar-pedestal-R';
  const fixedPart = (mesh, role) => {
    mesh.userData.fixed = true;
    mesh.userData.role = role;
    fixedFrame.add(mesh);
    return mesh;
  };

  const wallFaceX = radiusPivotE.x - 0.85 * s;
  const radiusWall = fixedPart(new THREE.Mesh(
    new THREE.BoxGeometry(0.40 * s, 4.2 * s, 0.66),
    frameMaterial,
  ), 'fixed-left-wall-for-radius-pivot-E');
  radiusWall.position.set(wallFaceX - 0.20 * s, radiusPivotE.y + 0.4 * s,
    wallPlaneZ + 0.04);
  const radiusBracket = fixedPart(new THREE.Mesh(plate(clip.union(
    poly(circle([radiusPivotE.x, radiusPivotE.y], 0.72 * s, 64)),
    poly([
      [wallFaceX - 0.05 * s, radiusPivotE.y - 1.05 * s],
      [radiusPivotE.x - 0.25 * s, radiusPivotE.y - 0.66 * s],
      [radiusPivotE.x, radiusPivotE.y + 0.72 * s],
      [wallFaceX - 0.05 * s, radiusPivotE.y + 0.72 * s],
    ]),
  ), bracketPlaneZ - 0.08, bracketPlaneZ + 0.08), frameMaterial),
  'fixed-wall-bracket-to-radius-pivot-E');
  const radiusBearing = radiusBracket;
  const radiusShaft = fixedPart(cylinderAlongZ(radiusPinRadius,
    radiusPlaneZ + 0.10 - (bracketPlaneZ - 0.04), darkMaterial, 32),
  'fixed-pin-E-from-wall-bracket');
  radiusShaft.position.set(radiusPivotE.x, radiusPivotE.y,
    (radiusPlaneZ + 0.10 + bracketPlaneZ - 0.04) / 2);

  // Closed cylinder with base flange, cover, stuffing-box neck and gland; the
  // piston is hidden inside, so only the rod passes the bored cover.
  const pistonRodRadius = 0.18 * s;
  const pistonBore = pistonRodRadius + pinClearance;
  const cylinderPart = (radius, bore, low, high, role) => {
    const mesh = fixedPart(new THREE.Mesh(bore
      ? boredCylinderGeometry(radius * s, bore, (high - low) * s)
      : new THREE.CylinderGeometry(radius * s, radius * s, (high - low) * s, 48),
    frameMaterial), role);
    mesh.position.set(nominalPistonLineX, (low + high) / 2 * s, rodPlaneZ);
    return mesh;
  };
  const cylinderBase = cylinderPart(1.62, 0, groundY / s, -0.92,
    'fixed-cylinder-base-flange');
  const cylinderBody = cylinderPart(1.40, pistonBore, -0.92, 5.40,
    'fixed-closed-cylinder-body');
  const cylinderCover = cylinderPart(1.62, pistonBore, 5.40, 5.95,
    'fixed-cylinder-cover-flange');
  const stuffingNeck = cylinderPart(0.45, pistonBore, 5.95, 6.45,
    'fixed-stuffing-box-neck');
  const stuffingGland = cylinderPart(0.72, pistonBore, 6.45, 6.80,
    'fixed-stuffing-box-gland');

  const crankBore = shaftRadius + pinClearance;
  const crankPedestal = fixedPart(new THREE.Mesh(plate(clip.difference(
    clip.union(
      poly(circle([crankCenter.x, crankCenter.y], 1.0 * s, 64)),
      poly([
        [crankCenter.x - 1.0 * s, crankCenter.y],
        [crankCenter.x + 1.0 * s, crankCenter.y],
        [crankCenter.x + 1.35 * s, -0.78 * s],
        [2.6 * s, -0.90 * s],
        [2.6 * s, groundY],
        [-2.25 * s, groundY],
        [-2.25 * s, -0.90 * s],
        [crankCenter.x - 1.35 * s, -0.78 * s],
      ]),
    ),
    poly(circle([crankCenter.x, crankCenter.y], crankBore, 64)),
  ), pedestalPlaneZ - 0.18, pedestalPlaneZ + 0.18), frameMaterial),
  'fixed-crank-plummer-pedestal');
  crankPedestal.userData.bores = [
    { x: crankCenter.x, y: crankCenter.y, radius: crankBore },
  ];

  const pillarPedestal = fixedPart(new THREE.Mesh(plate(clip.union(
    poly(circle([pillarPivotR.x, pillarPivotR.y], 0.95 * s, 64)),
    poly([
      [pillarPivotR.x - 0.95 * s, pillarPivotR.y],
      [pillarPivotR.x + 0.95 * s, pillarPivotR.y],
      [pillarPivotR.x + 0.95 * s, groundY],
      [7.9 * s, groundY],
      [7.9 * s, -0.95 * s],
      [pillarPivotR.x - 1.55 * s, -0.82 * s],
    ]),
  ), pedestalPlaneZ - 0.18, pedestalPlaneZ + 0.18), frameMaterial),
  'fixed-rocking-pillar-R-pedestal');
  const pillarPinR = fixedPart(cylinderAlongZ(workingPinRadius,
    rodPlaneZ + rodHalfDepth + 0.04 - pedestalPlaneZ, darkMaterial, 30),
  'fixed-rocking-pillar-pin-R');
  pillarPinR.position.set(pillarPivotR.x, pillarPivotR.y,
    (rodPlaneZ + rodHalfDepth + 0.04 + pedestalPlaneZ) / 2);
  root.add(fixedFrame);

  const inputCrank = new THREE.Group();
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role = 'two-point-zero-six-two-four-four-two-unit-crank';
  const crankArm = new THREE.Mesh(plate(clip.union(
    poly(circle([0, 0], 0.95 * s, 64)),
    poly(circle([crankRadius, 0], 0.55 * s, 64)),
    poly([[0, 0.95 * s], [crankRadius, 0.55 * s], [crankRadius, -0.55 * s],
      [0, -0.95 * s]]),
  ), crankPlaneZ - 0.06, crankPlaneZ + 0.06), beamMaterial);
  crankArm.userData.role = 'crank-arm-to-P';
  const crankDisk = crankArm;
  const crankShaft = cylinderAlongZ(shaftRadius,
    crankPlaneZ + 0.06 - (pedestalPlaneZ - 0.22), darkMaterial, 34);
  crankShaft.position.z = (crankPlaneZ + 0.06 + pedestalPlaneZ - 0.22) / 2;
  crankShaft.userData.role = 'crank-shaft-in-plummer-pedestal';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, crankPlaneZ);
  crankPinAnchor.userData.role = 'analytic-crank-pin-P';
  const crankPinLow = crankPlaneZ - 0.06;
  const crankPinHigh = rodPlaneZ + rodHalfDepth + 0.04;
  const crankPin = cylinderAlongZ(workingPinRadius, crankPinHigh - crankPinLow,
    whiteMaterial, 30);
  crankPin.position.set(crankRadius, 0, (crankPinLow + crankPinHigh) / 2);
  inputCrank.add(crankArm, crankShaft, crankPinAnchor, crankPin);
  root.add(inputCrank);

  // Rods hang from the beam in forked strap ends as drawn at I, L and W.
  const rodBore = workingPinRadius + pinClearance;
  const makeStrapRod = ({ length, width, bottomEye, material, role }) => {
    const rod = new THREE.Group();
    rod.userData.nominalLength = length;
    rod.userData.role = role;
    const strap = 1.2 * s;
    const body = boredPlate(clip.union(
      capsule([0, 0], [length, 0], width / 2, 24),
      poly(circle([0, 0], bottomEye, 64)),
      poly(circle([length, 0], 0.58 * s, 64)),
      poly([[length - strap, -0.52 * s], [length, -0.52 * s],
        [length, 0.52 * s], [length - strap, 0.52 * s]]),
    ), [{ x: 0, y: 0, radius: rodBore }, { x: length, y: 0, radius: rodBore }],
    -rodHalfDepth, rodHalfDepth, material, `${role}-bored-strap-rod`);
    body.position.z = rodPlaneZ;
    const startAnchor = new THREE.Object3D();
    startAnchor.position.z = rodPlaneZ;
    startAnchor.userData.role = `${role}-analytic-start`;
    const endAnchor = new THREE.Object3D();
    endAnchor.position.set(length, 0, rodPlaneZ);
    endAnchor.userData.role = `${role}-analytic-end`;
    rod.add(body, startAnchor, endAnchor);
    return { body, endAnchor, rod, startAnchor };
  };

  const connectingParts = makeStrapRod({
    bottomEye: 0.55 * s,
    length: connectingRodLength,
    material: redMaterial,
    role: 'twelve-point-zero-zero-zero-six-three-seven-unit-connecting-rod-P-I',
    width: 0.30 * s,
  });
  root.add(connectingParts.rod);

  const beam = new THREE.Group();
  beam.userData.role = 'sixteen-unit-grasshopper-beam-L-I-M-W';
  const beamStations = {
    I: 0,
    L: beamStationL,
    M: beamStationM,
    W: beamStationW,
  };
  const beamBellyStation = 2.5 * s;
  const beamPinBores = Object.entries(beamStations).map(([name, station]) => ({
    name,
    radius: (name === 'M' ? radiusPinRadius : workingPinRadius) + pinClearance,
    x: station,
    y: 0,
  }));
  const beamBody = boredPlate(clip.union(
    poly([
      [beamStationL, 0.62 * s],
      [beamBellyStation, 1.30 * s],
      [beamStationW, 0.65 * s],
      [beamStationW, -0.65 * s],
      [beamBellyStation, -1.30 * s],
      [beamStationL, -0.62 * s],
    ]),
    poly(circle([beamStationL, 0], 0.62 * s, 64)),
    poly(circle([beamStationW, 0], 0.65 * s, 64)),
  ), beamPinBores, beamPlaneZ - beamHalfDepth, beamPlaneZ + beamHalfDepth,
  beamMaterial, 'rigid-blue-fish-bellied-grasshopper-beam');
  const beamAnchors = {};
  const beamBosses = {};
  Object.entries(beamStations).forEach(([name, station]) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(station, 0, beamPlaneZ);
    anchor.userData.role = `analytic-beam-station-${name}`;
    beam.add(anchor);
    beamAnchors[name] = anchor;
    beamBosses[name] = beamBody;
  });
  beam.add(beamBody);
  root.add(beam);

  const pillarParts = makeStrapRod({
    bottomEye: 0.66 * s,
    length: pillarLength,
    material: redMaterial,
    role: 'rocking-pillar-A-from-fixed-R-to-beam-W',
    width: 0.32 * s,
  });
  root.add(pillarParts.rod);

  const radiusBore = radiusPinRadius + pinClearance;
  const radiusParts = makeRigidRod({
    bodyMaterial: radiusMaterial,
    boreRadius: radiusBore,
    depth: 0.14,
    length: radiusBarLength,
    planeZ: radiusPlaneZ,
    role: 'eight-unit-corrected-radius-bar-B-from-E-to-beam-center-M',
    width: 0.30 * s,
  });
  root.add(radiusParts.rod);

  const pistonOutput = new THREE.Group();
  pistonOutput.userData.rotationDegreesOfFreedom = 0;
  pistonOutput.userData.role = 'vertical-piston-rod-carried-by-left-beam-point-L';
  const pistonRodLength = sourcePistonRodLength * s;
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(pistonRodRadius, pistonRodRadius,
      pistonRodLength - 1.0 * s, 24),
    outputMaterial,
  );
  pistonRod.position.set(0, -(pistonRodLength + 1.0 * s) / 2, rodPlaneZ);
  pistonRod.userData.role = 'grasshopper-piston-rod-below-L';
  const pistonHead = boredPlate(clip.union(
    poly(circle([0, 0], 0.55 * s, 64)),
    poly([[-0.50 * s, -1.05 * s], [0.50 * s, -1.05 * s], [0.50 * s, 0],
      [-0.50 * s, 0]]),
  ), [{ x: 0, y: 0, radius: rodBore }], rodPlaneZ - rodHalfDepth,
  rodPlaneZ + rodHalfDepth, outputMaterial, 'grasshopper-piston-rod-strap-at-L');
  const pistonAnchor = new THREE.Object3D();
  pistonAnchor.position.z = rodPlaneZ;
  pistonAnchor.userData.role = 'analytic-output-piston-pin-L';
  pistonOutput.add(pistonRod, pistonHead, pistonAnchor);
  root.add(pistonOutput);

  const beamPin = (name, radius, low, high) => {
    const pin = cylinderAlongZ(radius, high - low, whiteMaterial, 30);
    pin.position.set(beamStations[name], 0, (low + high) / 2);
    pin.userData.role = `common-working-pin-${name}`;
    beam.add(pin);
    return pin;
  };
  const frontPinLow = beamPlaneZ - beamHalfDepth - 0.035;
  const frontPinHigh = rodPlaneZ + rodHalfDepth + 0.04;
  const jointPins = {
    I: beamPin('I', workingPinRadius, frontPinLow, frontPinHigh),
    L: beamPin('L', workingPinRadius, frontPinLow, frontPinHigh),
    M: beamPin('M', radiusPinRadius, radiusPlaneZ - 0.10,
      beamPlaneZ + beamHalfDepth + 0.03),
    P: crankPin,
    W: beamPin('W', workingPinRadius, frontPinLow, frontPinHigh),
  };
  crankPin.userData.role = 'common-working-pin-P';
  const pinZ = name => {
    const pin = jointPins[name];
    return pin.position.z;
  };

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
      point: new THREE.Vector3(pillarPivotR.x, pillarPivotR.y, rodPlaneZ),
      type: 'fixed-rocking-pillar-pivot-R',
    },
    radiusPivotE: {
      fixedMember: fixedFrame,
      movingMember: radiusParts.rod,
      point: new THREE.Vector3(radiusPivotE.x, radiusPivotE.y, radiusPlaneZ),
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
    contacts.crankAtP.point.set(state.pointP.x, state.pointP.y, pinZ('P'));
    contacts.beamAtI.point.set(state.pointI.x, state.pointI.y, pinZ('I'));
    contacts.beamAtL.point.set(state.pointL.x, state.pointL.y, pinZ('L'));
    contacts.beamAtM.point.set(state.pointM.x, state.pointM.y, pinZ('M'));
    contacts.beamAtW.point.set(state.pointW.x, state.pointW.y, pinZ('W'));
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
    beam,
    beamAnchors,
    beamBody,
    beamBosses,
    connectingRod: connectingParts.rod,
    connectingRodBody: connectingParts.body,
    connectingRodEndAnchor: connectingParts.endAnchor,
    connectingRodStartAnchor: connectingParts.startAnchor,
    crankArm,
    crankDisk,
    crankPedestal,
    crankPinAnchor,
    crankShaft,
    cylinderBase,
    cylinderBody,
    cylinderCover,
    fixedFrame,
    inputCrank,
    jointPins,
    pillar: pillarParts.rod,
    pillarBody: pillarParts.body,
    pillarEndAnchor: pillarParts.endAnchor,
    pillarPedestal,
    pillarPinR,
    pillarStartAnchor: pillarParts.startAnchor,
    pistonAnchor,
    pistonHead,
    pistonOutput,
    pistonRod,
    radiusBar: radiusParts.rod,
    radiusBarEndAnchor: radiusParts.endAnchor,
    radiusBarStartAnchor: radiusParts.startAnchor,
    radiusBearing,
    radiusBracket,
    radiusShaft,
    radiusWall,
    stuffingGland,
    stuffingNeck,
  };

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
  // Frame Brown's plate: wall bracket at top left, cylinder at the left edge,
  // crank pin at the bottom and pillar pedestal R at the right.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.4 * sourceScale, -2.3 * sourceScale, -0.95),
    new THREE.Vector3(11.6 * sourceScale, 14.6 * sourceScale, 0.95),
  );
  root.userData.cameraDistanceScale = 0.86;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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
