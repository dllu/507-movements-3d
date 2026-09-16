import * as THREE from 'three';
import { fitPistonGuide, boredJournal } from './piston-guide-parts.js';
import { plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
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

// A finite rectangular gland/cover with a passage along local Y.
export function rectangularRodPassageGeometry(width, height, depth, halfX, halfZ, offsetZ = 0) {
  const rectangle = (x0, z0, x1, z1) => poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  const geometry = plate(clip.difference(
    rectangle(-width / 2, -depth / 2, width / 2, depth / 2),
    rectangle(-halfX, offsetZ - halfZ, halfX, offsetZ + halfZ)), -height / 2, height / 2);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

function oscillatingCylinderEngine(movement) {
  const root = new THREE.Group();

  // Official source geometry. The two add_rot_to operations do not impose
  // separate link lengths: they orient both the cylinder and piston assembly
  // on the same instantaneous T-P line. The green assembly is rooted at crank
  // pin P and its piston-head center is 6.75 units down that line. Therefore
  // the head's signed coordinate in the cylinder is |T-P|-6.75.
  const sourceScale = 0.62;
  const sourceCrankCenter = new THREE.Vector2(0, 0);
  const sourceCrankRadius = 2.25;
  const sourceCrankPhaseOffsetTurns = 0.625;
  const sourceCylinderPivot = new THREE.Vector2(0, -6.75);
  const sourcePistonRodLength = 6.75;
  const sourcePistonHeadHalfWidth = 1.3125;
  const sourcePistonHeadThickness = 0.375;
  const sourcePistonRodHalfWidth = 0.15625;
  const sourcePistonRodCrankClearance = 0.340897;
  const sourceCylinderOuterHalfWidth = 1.75;
  const sourceCylinderWallOuterX = 1.5;
  const sourceCylinderWallInnerX = 1.3125;
  const sourceCylinderBoreEnd = 2.5;
  const sourceCylinderShellEnd = 2.875;
  const sourceCylinderDirectionRay = new THREE.Vector2(0, 2.5);
  const sourcePistonDirectionRay = new THREE.Vector2(0, -6.9375);
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;
  const sourceCrankPhaseOffset = FULL_TURN
    * sourceCrankPhaseOffsetTurns;

  const crankCenter = sourceCrankCenter.clone().multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const cylinderPivot = sourceCylinderPivot.clone()
    .multiplyScalar(sourceScale);
  const pistonRodLength = sourcePistonRodLength * sourceScale;
  const pistonHeadHalfWidth = sourcePistonHeadHalfWidth * sourceScale;
  const pistonHeadThickness = sourcePistonHeadThickness * sourceScale;
  const cylinderBoreEnd = sourceCylinderBoreEnd * sourceScale;
  const cylinderShellEnd = sourceCylinderShellEnd * sourceScale;

  const sourceStateAtCyclePosition = (cyclePosition) => {
    const unwrappedInputAngle = sourceCrankPhaseOffset
      + FULL_TURN * cyclePosition;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const pointP = sourceCrankCenter.clone().add(new THREE.Vector2(
      sourceCrankRadius * Math.cos(inputAngle),
      sourceCrankRadius * Math.sin(inputAngle),
    ));
    const trunnionToCrank = pointP.clone().sub(sourceCylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      - Math.PI / 2;
    const pistonTravel = crankToTrunnionDistance
      - sourcePistonRodLength;
    const pistonHead = sourceCylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    return {
      crankToTrunnionDistance,
      cylinderAngle,
      cylinderAxis,
      inputAngle,
      pistonAssemblyOrigin: pointP.clone(),
      pistonHead,
      pistonTravel,
      pointP,
      unwrappedInputAngle,
    };
  };

  const stateAtInputAngle = (
    unwrappedInputAngle,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pointP = crankCenter.clone().add(new THREE.Vector2(
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
    const trunnionToCrank = pointP.clone().sub(cylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAxisNormal = new THREE.Vector2(
      -cylinderAxis.y,
      cylinderAxis.x,
    );
    const pistonTravel = crankToTrunnionDistance - pistonRodLength;
    const pistonVelocity = trunnionToCrank.dot(pointPVelocity)
      / crankToTrunnionDistance;
    const pistonAcceleration = (
      pointPVelocity.lengthSq()
        + trunnionToCrank.dot(pointPAcceleration)
        - pistonVelocity ** 2
    ) / crankToTrunnionDistance;
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      - Math.PI / 2;
    const cylinderAngularVelocity = cross2(
      trunnionToCrank,
      pointPVelocity,
    ) / trunnionToCrank.lengthSq();
    const cylinderAngularAcceleration = cross2(
      trunnionToCrank,
      pointPAcceleration,
    ) / trunnionToCrank.lengthSq()
      - 2 * pistonVelocity * cylinderAngularVelocity
        / crankToTrunnionDistance;
    const cylinderAxisVelocity = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularVelocity);
    const cylinderAxisAcceleration = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularAcceleration)
      .addScaledVector(
        cylinderAxis,
        -(cylinderAngularVelocity ** 2),
      );
    const pistonHead = cylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    const pistonHeadVelocity = cylinderAxis.clone()
      .multiplyScalar(pistonVelocity)
      .addScaledVector(
        cylinderAxisVelocity,
        pistonTravel,
      );
    const pistonHeadAcceleration = cylinderAxis.clone()
      .multiplyScalar(pistonAcceleration)
      .addScaledVector(cylinderAxisVelocity,
        2 * pistonVelocity)
      .addScaledVector(cylinderAxisAcceleration,
        pistonTravel);
    const pistonRodVector = pointP.clone().sub(pistonHead);
    const pistonRodRelativeVelocity = pointPVelocity.clone()
      .sub(pistonHeadVelocity);
    const pistonRodRelativeAcceleration = pointPAcceleration.clone()
      .sub(pistonHeadAcceleration);

    return {
      crank: {
        angle: inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
      },
      crankToTrunnionDistance,
      cylinder: {
        angle: cylinderAngle,
        angularAcceleration: cylinderAngularAcceleration,
        angularVelocity: cylinderAngularVelocity,
        axis: cylinderAxis,
        axisAcceleration: cylinderAxisAcceleration,
        axisNormal: cylinderAxisNormal,
        axisVelocity: cylinderAxisVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      piston: {
        acceleration: pistonAcceleration,
        head: pistonHead,
        headAcceleration: pistonHeadAcceleration,
        headVelocity: pistonHeadVelocity,
        rodAngularAcceleration: cylinderAngularAcceleration,
        rodAngularVelocity: cylinderAngularVelocity,
        rodLengthError: pistonRodVector.length() - pistonRodLength,
        rodRelativeAcceleration: pistonRodRelativeAcceleration,
        rodRelativeVelocity: pistonRodRelativeVelocity,
        travel: pistonTravel,
        velocity: pistonVelocity,
      },
      pointP,
      pointPAcceleration,
      pointPVelocity,
      unwrappedInputAngle,
    };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => stateAtInputAngle(
    sourceCrankPhaseOffset + inputTravel,
    resolvedInputAngularSpeed,
    inputAngularAcceleration,
  );

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
    const state = sourceStateAtCyclePosition(time / cyclePeriod);
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    sourceStart: 0,
    nearestDeadCenter: cyclePeriod / 8,
    sourceQuarter: cyclePeriod / 4,
    sourceHalf: cyclePeriod / 2,
    farthestDeadCenter: cyclePeriod * 5 / 8,
    sourceThreeQuarter: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  let maximumCylinderAngle = -Infinity;
  let maximumCrankToTrunnionDistance = -Infinity;
  let maximumPistonTravel = -Infinity;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let maximumRodLengthError = 0;
  let minimumCylinderAngle = Infinity;
  let minimumCrankToTrunnionDistance = Infinity;
  let minimumPistonTravel = Infinity;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtInputTravel(FULL_TURN * sample / 16384);
    maximumCylinderAngle = Math.max(maximumCylinderAngle,
      state.cylinder.angle);
    minimumCylinderAngle = Math.min(minimumCylinderAngle,
      state.cylinder.angle);
    maximumCrankToTrunnionDistance = Math.max(
      maximumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    minimumCrankToTrunnionDistance = Math.min(
      minimumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    maximumPistonTravel = Math.max(maximumPistonTravel,
      state.piston.travel);
    minimumPistonTravel = Math.min(minimumPistonTravel,
      state.piston.travel);
    maximumPistonX = Math.max(maximumPistonX, state.piston.head.x);
    minimumPistonX = Math.min(minimumPistonX, state.piston.head.x);
    maximumPistonY = Math.max(maximumPistonY, state.piston.head.y);
    minimumPistonY = Math.min(minimumPistonY, state.piston.head.y);
    maximumRodLengthError = Math.max(maximumRodLengthError,
      Math.abs(state.piston.rodLengthError));
  }
  const minimumEndClearance = cylinderBoreEnd
    - pistonHeadThickness / 2
    - Math.max(Math.abs(minimumPistonTravel), maximumPistonTravel);

  const geometry = {
    crankCenter,
    crankRadius,
    cyclePeriod,
    cylinderBoreEnd,
    cylinderPivot,
    cylinderShellEnd,
    inputAngularSpeed,
    maximumCrankToTrunnionDistance,
    maximumCylinderAngle,
    maximumPistonTravel,
    maximumPistonX,
    maximumPistonY,
    maximumRodLengthError,
    minimumCrankToTrunnionDistance,
    minimumCylinderAngle,
    minimumEndClearance,
    minimumPistonTravel,
    minimumPistonX,
    minimumPistonY,
    pistonHeadHalfWidth,
    pistonHeadThickness,
    pistonRodLength,
    pistonStroke: maximumPistonTravel - minimumPistonTravel,
    sourceCrankPhaseOffset,
    sourceScale,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const crankMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.57,
  });
  const cylinderMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.57,
  });
  const pistonMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.59,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const boreMaterial = matte(0x74a4b5, {
    opacity: 0.14,
    roughness: 0.70,
    transparent: true,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-upper-crank-bearing-and-mid-cylinder-trunnion-frame';
  const upperRail = new THREE.Mesh(
    new THREE.BoxGeometry(8 * sourceScale, 0.50 * sourceScale, 0.64),
    frameMaterial,
  );
  upperRail.position.set(0, -0.625 * sourceScale, -0.61);
  upperRail.userData.fixed = true;
  upperRail.userData.role = 'fixed-upper-engine-frame-rail';
  const lowerRail = new THREE.Mesh(
    new THREE.BoxGeometry(8 * sourceScale, 0.75 * sourceScale, 0.68),
    frameMaterial,
  );
  lowerRail.position.set(0, -7.125 * sourceScale, -0.66);
  lowerRail.userData.fixed = true;
  lowerRail.userData.role = 'fixed-mid-height-trunnion-rail';
  const upperBearingPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(2.45 * sourceScale, 0.46 * sourceScale, 0.76),
    frameMaterial,
  );
  upperBearingPedestal.position.set(0, -0.16 * sourceScale, -0.50);
  upperBearingPedestal.userData.fixed = true;
  upperBearingPedestal.userData.role = 'fixed-crank-pillow-block';
  const crankBearing = cylinderAlongZ(0.62 * sourceScale, 0.72,
    frameMaterial, 44);
  crankBearing.position.set(crankCenter.x, crankCenter.y, -0.39);
  crankBearing.userData.fixed = true;
  crankBearing.userData.role = 'fixed-upper-crankshaft-bearing';
  const crankShaft = cylinderAlongZ(0.25 * sourceScale, 1.10,
    darkMaterial, 34);
  crankShaft.position.set(crankCenter.x, crankCenter.y, -0.25);
  crankShaft.userData.fixed = true;
  crankShaft.userData.role = 'fixed-crankshaft-axis-O';
  const trunnionBearingBack = boredJournal(0.75 * sourceScale, 0.30 * sourceScale + 0.006, 0.44,
    frameMaterial);
  trunnionBearingBack.position.set(cylinderPivot.x, cylinderPivot.y, -0.36);
  trunnionBearingBack.userData.fixed = true;
  trunnionBearingBack.userData.role = 'fixed-rear-cylinder-trunnion-bearing';
  const trunnionBearingFront = new THREE.Mesh(
    new THREE.TorusGeometry(0.41 * sourceScale, 0.10 * sourceScale,
      10, 42),
    darkMaterial,
  );
  trunnionBearingFront.position.set(cylinderPivot.x, cylinderPivot.y, 0.89);
  trunnionBearingFront.userData.fixed = true;
  trunnionBearingFront.userData.role = 'fixed-front-cylinder-trunnion-bearing';
  const trunnionCenterCap = cylinderAlongZ(0.16 * sourceScale, 0.18,
    whiteMaterial, 30);
  trunnionCenterCap.position.set(cylinderPivot.x, cylinderPivot.y, 1.04);
  trunnionCenterCap.userData.fixed = true;
  trunnionCenterCap.userData.role = 'fixed-trunnion-axis-index';
  fixedFrame.add(
    upperRail,
    lowerRail,
    upperBearingPedestal,
    crankBearing,
    crankShaft,
    trunnionBearingBack,
    trunnionBearingFront,
    trunnionCenterCap,
  );
  root.add(fixedFrame);

  const inputCrank = new THREE.Group();
  inputCrank.position.set(crankCenter.x, crankCenter.y, 0);
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role =
    'two-point-two-five-unit-direct-acting-crank-O-P';
  const crankDisk = cylinderAlongZ(0.75 * sourceScale, 0.24,
    crankMaterial, 48);
  crankDisk.position.z = 0.12;
  crankDisk.userData.role = 'moving-upper-crank-disk';
  const crankHub = cylinderAlongZ(0.375 * sourceScale, 0.30,
    darkMaterial, 38);
  crankHub.position.z = 0.13;
  crankHub.userData.role = 'moving-crankshaft-hub-O';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.34 * sourceScale, 0.24),
    crankMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 0.12);
  crankArm.userData.role = 'solid-direct-crank-arm-O-P';
  const crankPinBoss = cylinderAlongZ(0.375 * sourceScale, 0.28,
    crankMaterial, 38);
  crankPinBoss.position.set(crankRadius, 0, 0.14);
  crankPinBoss.userData.role = 'moving-crank-pin-boss-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, 0.38);
  crankPinAnchor.userData.role = 'analytic-direct-crank-pin-P';
  const crankIndex = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius * 0.53,
      0.08 * sourceScale, 0.035),
    whiteMaterial,
  );
  crankIndex.position.set(crankRadius * 0.28, 0, 0.26);
  crankIndex.userData.role = 'crank-face-angular-index';
  inputCrank.add(
    crankDisk,
    crankHub,
    crankArm,
    crankPinBoss,
    crankPinAnchor,
    crankIndex,
  );
  root.add(inputCrank);

  const cylinderAssembly = new THREE.Group();
  cylinderAssembly.position.set(cylinderPivot.x, cylinderPivot.y, 0);
  cylinderAssembly.userData.axis = Z_AXIS.clone();
  cylinderAssembly.userData.role =
    'mid-trunnion-open-oscillating-cylinder';
  const cylinderWallThickness = (
    sourceCylinderWallOuterX - sourceCylinderWallInnerX
  ) * sourceScale;
  const cylinderWalls = [-1, 1].map((side, index) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        cylinderWallThickness,
        sourceCylinderBoreEnd * 2 * sourceScale,
        1.00,
      ),
      cylinderMaterial,
    );
    wall.position.set(
      side * (sourceCylinderWallOuterX + sourceCylinderWallInnerX)
        * sourceScale / 2,
      0,
      0.08,
    );
    wall.userData.role = `oscillating-cylinder-side-wall-${index + 1}`;
    cylinderAssembly.add(wall);
    return wall;
  });
  const cylinderEndPlates = [-1, 1].map((side, index) => {
    const plate = new THREE.Mesh(
      (side === 1 ? rectangularRodPassageGeometry : (w, h, d) => new THREE.BoxGeometry(w, h, d))(
        sourceCylinderOuterHalfWidth * 2 * sourceScale,
        (sourceCylinderShellEnd - sourceCylinderBoreEnd) * sourceScale,
        0.94, sourcePistonRodHalfWidth * sourceScale + 0.006, 0.106, 0.34,
      ),
      cylinderMaterial,
    );
    plate.position.set(0,
      side * (sourceCylinderShellEnd + sourceCylinderBoreEnd)
        * sourceScale / 2,
      0.08);
    plate.userData.role =
      `oscillating-cylinder-${index === 0 ? 'bottom' : 'top'}-cover`;
    cylinderAssembly.add(plate);
    return plate;
  });
  const boreBack = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceCylinderWallInnerX * 2 * sourceScale,
      sourceCylinderBoreEnd * 2 * sourceScale,
      0.05,
    ),
    boreMaterial,
  );
  boreBack.position.z = -0.15;
  boreBack.userData.role = 'transparent-open-cylinder-bore';
  cylinderAssembly.add(boreBack);
  const glandCollars = [
    { width: 1.0, height: 0.125, y: 3.1875 },
    { width: 0.50, height: 0.125, y: 3.3125 },
    { width: 1.0, height: 0.125, y: 3.4375 },
  ].map((specification, index) => {
    const collar = new THREE.Mesh(
      rectangularRodPassageGeometry(
        specification.width * sourceScale,
        specification.height * sourceScale,
        0.86, sourcePistonRodHalfWidth * sourceScale + 0.006, 0.106, 0.30,
      ),
      cylinderMaterial,
    );
    collar.position.set(0, specification.y * sourceScale, 0.12);
    collar.userData.role = `oscillating-cylinder-gland-collar-${index + 1}`;
    cylinderAssembly.add(collar);
    return collar;
  });
  const cylinderTrunnion = new THREE.Group();
  for (const [lowZ, highZ] of [[-0.70, 0.10], [0.56, 1.00]]) {
    const stub = cylinderAlongZ(0.30 * sourceScale, highZ - lowZ, cylinderMaterial, 38);
    stub.position.z = (lowZ + highZ) / 2;
    cylinderTrunnion.add(stub);
  }
  cylinderTrunnion.userData.role = 'moving-cylinder-midpoint-trunnion';
  const trunnionBridge = new THREE.Mesh(new THREE.BoxGeometry(
    sourceCylinderWallOuterX * 2 * sourceScale, 0.30 * sourceScale, 0.18), cylinderMaterial);
  trunnionBridge.position.z = 0.65;
  trunnionBridge.userData.role = 'front-trunnion-bridge-clear-of-piston-stroke';
  cylinderAssembly.add(trunnionBridge);
  const cylinderPivotAnchor = new THREE.Object3D();
  cylinderPivotAnchor.position.z = 0.08;
  cylinderPivotAnchor.userData.role = 'analytic-cylinder-pivot-T';
  const cylinderTopAxisAnchor = new THREE.Object3D();
  cylinderTopAxisAnchor.position.set(0,
    sourceCylinderDirectionRay.y * sourceScale, 0.08);
  cylinderTopAxisAnchor.userData.role = 'analytic-cylinder-axis-ray';
  cylinderAssembly.add(
    cylinderTrunnion,
    cylinderPivotAnchor,
    cylinderTopAxisAnchor,
  );
  root.add(cylinderAssembly);

  const pistonAssembly = new THREE.Group();
  pistonAssembly.userData.axis = Z_AXIS.clone();
  pistonAssembly.userData.role =
    'fixed-length-piston-rod-and-head-rooted-at-crank-pin-P';
  const sourceVisibleRodLength = sourcePistonRodLength
    - sourcePistonHeadThickness / 2
    - sourcePistonRodCrankClearance;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonRodHalfWidth * 2 * sourceScale,
      sourceVisibleRodLength * sourceScale,
      0.20,
    ),
    pistonMaterial,
  );
  pistonRod.position.set(
    0,
    -(
      sourcePistonRodCrankClearance
        + sourcePistonRodLength
        - sourcePistonHeadThickness / 2
    ) * sourceScale / 2,
    0.42,
  );
  pistonRod.userData.role = 'constant-length-piston-rod-from-P';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonHeadHalfWidth * 2 * sourceScale,
      sourcePistonHeadThickness * sourceScale,
      0.36,
    ),
    pistonMaterial,
  );
  pistonHead.position.set(0, -pistonRodLength, 0.34);
  pistonHead.userData.role = 'sliding-piston-head-inside-oscillating-cylinder';
  const pistonHeadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonHeadHalfWidth * 1.72 * sourceScale,
      0.045 * sourceScale,
      0.025,
    ),
    whiteMaterial,
  );
  pistonHeadIndex.position.set(0, -pistonRodLength, 0.535);
  pistonHeadIndex.userData.role = 'visible-piston-face-index';
  const pistonCrankEye = boredJournal(0.36 * sourceScale,
    0.17 * sourceScale + 0.006, 0.20, pistonMaterial);
  pistonCrankEye.position.z = 0.42;
  pistonCrankEye.userData.role = 'piston-rod-eye-at-crank-pin-P';
  const pistonCrankAnchor = new THREE.Object3D();
  pistonCrankAnchor.position.z = 0.42;
  pistonCrankAnchor.userData.role = 'analytic-piston-rod-crank-end-P';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, -pistonRodLength, 0.34);
  pistonHeadAnchor.userData.role = 'analytic-piston-head-center-H';
  pistonAssembly.add(
    pistonRod,
    pistonHead,
    pistonHeadIndex,
    pistonCrankEye,
    pistonCrankAnchor,
    pistonHeadAnchor,
  );
  root.add(pistonAssembly);

  const crankPin = cylinderAlongZ(0.17 * sourceScale, 0.82,
    whiteMaterial, 30);
  crankPin.userData.role = 'common-crank-to-piston-rod-pin-P';
  root.add(crankPin);

  const contacts = {
    crankBearingO: {
      fixedMember: fixedFrame,
      movingMember: inputCrank,
      point: new THREE.Vector3(crankCenter.x, crankCenter.y, 0.2),
      type: 'fixed-revolute-crank-bearing-O',
    },
    crankPinP: {
      members: [inputCrank, pistonAssembly],
      point: new THREE.Vector3(),
      type: 'direct-crank-to-piston-rod-revolute-pin-P',
    },
    cylinderTrunnionT: {
      fixedMember: fixedFrame,
      movingMember: cylinderAssembly,
      point: new THREE.Vector3(cylinderPivot.x, cylinderPivot.y, 0.08),
      type: 'fixed-mid-cylinder-revolute-trunnion-T',
    },
    pistonInCylinder: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      signedTravel: 0,
      type: 'coaxial-prismatic-piston-in-oscillating-cylinder',
    },
    pistonRodAtGland: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      type: 'sliding-piston-rod-through-oscillating-gland',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.z = state.inputAngle;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputCrank.userData.angularAcceleration = state.inputAngularAcceleration;
    cylinderAssembly.rotation.z = state.cylinder.angle;
    cylinderAssembly.userData.angularSpeed =
      state.cylinder.angularVelocity;
    cylinderAssembly.userData.angularAcceleration =
      state.cylinder.angularAcceleration;
    pistonAssembly.position.set(state.pointP.x, state.pointP.y, 0);
    pistonAssembly.rotation.z = state.cylinder.angle;
    pistonAssembly.userData.angularSpeed =
      state.piston.rodAngularVelocity;
    pistonAssembly.userData.angularAcceleration =
      state.piston.rodAngularAcceleration;
    pistonAssembly.userData.relativeTravel = state.piston.travel;
    pistonAssembly.userData.relativeVelocity = state.piston.velocity;
    pistonAssembly.userData.relativeAcceleration = state.piston.acceleration;
    crankPin.position.set(state.pointP.x, state.pointP.y, 0.59);
    contacts.crankPinP.point.set(state.pointP.x, state.pointP.y, 0.59);
    contacts.pistonInCylinder.axis.set(
      state.cylinder.axis.x,
      state.cylinder.axis.y,
      0,
    );
    contacts.pistonInCylinder.point.set(
      state.piston.head.x,
      state.piston.head.y,
      0.34,
    );
    contacts.pistonInCylinder.signedTravel = state.piston.travel;
    contacts.pistonRodAtGland.axis.copy(contacts.pistonInCylinder.axis);
    contacts.pistonRodAtGland.point.set(
      cylinderPivot.x + state.cylinder.axis.x * 3.3125 * sourceScale,
      cylinderPivot.y + state.cylinder.axis.y * 3.3125 * sourceScale,
      0.42,
    );
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-6.5, -10.3125);
  const officialViewWidth = 13;
  const officialViewHeight = 13;
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
    'mid-trunnion-oscillating-cylinder-direct-crank-engine';
  root.userData.blocks = {
    boreBack,
    crankArm,
    crankBearing,
    crankDisk,
    crankHub,
    crankIndex,
    crankPin,
    crankPinAnchor,
    crankPinBoss,
    crankShaft,
    cylinderAssembly,
    cylinderEndPlates,
    cylinderPivotAnchor,
    cylinderTopAxisAnchor,
    cylinderTrunnion,
    cylinderWalls,
    fixedFrame,
    glandCollars,
    inputCrank,
    lowerRail,
    pistonAssembly,
    pistonCrankAnchor,
    pistonCrankEye,
    pistonHead,
    pistonHeadAnchor,
    pistonHeadIndex,
    pistonRod,
    trunnionBearingBack,
    trunnionBearingFront,
    trunnionCenterCap,
    upperBearingPedestal,
    upperRail,
  };
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.6 * sourceScale, -10.45 * sourceScale, -1.12),
    new THREE.Vector3(6.6 * sourceScale, 2.8 * sourceScale, 1.08),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating 2.25-unit crank O-P',
    mechanism: 1,
    output:
      'the piston slides along the cylinder while the whole cylinder oscillates about its midpoint trunnions',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -6.72;
  root.userData.mechanism =
    'crank-O-P-direct-piston-rod-P-H-sliding-in-cylinder-oscillating-about-fixed-midpoint-trunnion-T';
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
      'add_rot_to',
      'add_rot_to',
      'add_text',
    ],
    officialGeometry: {
      crankCenter: sourceCrankCenter,
      crankPhaseOffsetTurns: sourceCrankPhaseOffsetTurns,
      crankRadius: sourceCrankRadius,
      cylinderBoreEnd: sourceCylinderBoreEnd,
      cylinderDirectionRay: sourceCylinderDirectionRay,
      cylinderOuterHalfWidth: sourceCylinderOuterHalfWidth,
      cylinderPivot: sourceCylinderPivot,
      cylinderShellEnd: sourceCylinderShellEnd,
      cylinderWallInnerX: sourceCylinderWallInnerX,
      cylinderWallOuterX: sourceCylinderWallOuterX,
      pistonDirectionRay: sourcePistonDirectionRay,
      pistonHeadHalfWidth: sourcePistonHeadHalfWidth,
      pistonHeadThickness: sourcePistonHeadThickness,
      pistonRodCrankClearance: sourcePistonRodCrankClearance,
      pistonRodHalfWidth: sourcePistonRodHalfWidth,
      pistonRodLength: sourcePistonRodLength,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      applied: false,
      reason:
        'both official add_rot_to transforms share the exact T-P axis, and the fixed 6.75-unit piston rod remains physically compatible with the mid-trunnion cylinder through the full crank cycle',
    },
    referenceScope:
      'official 2.25-unit crank, mid-length trunnion T, open cylinder shell and gland, fixed-length direct piston rod and head, frame, source view, phase, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate344: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one cylinder swings about midpoint trunnions in fixed bearings while its piston rod connects directly to the crank pin without a crosshead guide',
      measurementUncertaintyPixels: 3,
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
  root.userData.sourceStateAtCyclePosition = sourceStateAtCyclePosition;
  root.userData.sourceStateAtTime = sourceStateAtTime;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactConstraint:
      '|O-P|=2.25 and H=P-6.75u, where u=(P-T)/|P-T| is the common piston-and-cylinder axis',
    input: 'the upper crank pin P rotates uniformly about fixed bearing O',
    output:
      'distance |T-P| simultaneously sets cylinder angle and the piston coordinate |T-P|-6.75 along its bore',
    stroke:
      '|T-P| ranges from 4.5 to 9.0, giving exactly 4.5 source units of piston travel',
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

function invertedPendulumEngine(movement) {
  const root = new THREE.Group();

  // In 345 the cylinder hangs from an end trunnion instead of pivoting at its
  // midpoint. The official blue add_rot_to points local -Y from T toward crank
  // pin P. The green assembly is rooted at P and points local +Y back toward T;
  // its piston-head center is 7.75 units from P. Thus the signed head position
  // down the five-unit bore is |T-P|-7.75, ranging from 0.25 to 4.75.
  const sourceScale = 0.60;
  const sourceCrankCenter = new THREE.Vector2(0, 0);
  const sourceCrankRadius = 2.25;
  const sourceCrankPhaseOffsetTurns = 0.375;
  const sourceCylinderPivot = new THREE.Vector2(0, 10.25);
  const sourcePistonRodLength = 7.75;
  const sourcePistonHeadHalfWidth = 1.5;
  const sourcePistonHeadThickness = 0.375;
  const sourcePistonRodHalfWidth = 0.15625;
  const sourcePistonRodCrankClearance = 0.340897;
  const sourceCylinderOuterHalfWidth = 1.875;
  const sourceCylinderWallOuterX = 1.6875;
  const sourceCylinderWallInnerX = 1.5;
  const sourceCylinderBoreLength = 5;
  const sourceCylinderShellEnd = 5.375;
  const sourceCylinderDirectionRay = new THREE.Vector2(0, -5);
  const sourcePistonDirectionRay = new THREE.Vector2(0, 7.5625);
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;
  const sourceCrankPhaseOffset = FULL_TURN
    * sourceCrankPhaseOffsetTurns;

  const crankCenter = sourceCrankCenter.clone().multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const cylinderPivot = sourceCylinderPivot.clone()
    .multiplyScalar(sourceScale);
  const pistonRodLength = sourcePistonRodLength * sourceScale;
  const pistonHeadHalfWidth = sourcePistonHeadHalfWidth * sourceScale;
  const pistonHeadThickness = sourcePistonHeadThickness * sourceScale;
  const cylinderBoreLength = sourceCylinderBoreLength * sourceScale;
  const cylinderShellEnd = sourceCylinderShellEnd * sourceScale;

  const sourceStateAtCyclePosition = (cyclePosition) => {
    const unwrappedInputAngle = sourceCrankPhaseOffset
      + FULL_TURN * cyclePosition;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const pointP = sourceCrankCenter.clone().add(new THREE.Vector2(
      sourceCrankRadius * Math.cos(inputAngle),
      sourceCrankRadius * Math.sin(inputAngle),
    ));
    const trunnionToCrank = pointP.clone().sub(sourceCylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      + Math.PI / 2;
    const pistonTravel = crankToTrunnionDistance
      - sourcePistonRodLength;
    const pistonHead = sourceCylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    return {
      crankToTrunnionDistance,
      cylinderAngle,
      cylinderAxis,
      inputAngle,
      pistonAssemblyOrigin: pointP.clone(),
      pistonHead,
      pistonTravel,
      pointP,
      unwrappedInputAngle,
    };
  };

  const stateAtInputAngle = (
    unwrappedInputAngle,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pointP = crankCenter.clone().add(new THREE.Vector2(
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
    const trunnionToCrank = pointP.clone().sub(cylinderPivot);
    const crankToTrunnionDistance = trunnionToCrank.length();
    const cylinderAxis = trunnionToCrank.clone()
      .multiplyScalar(1 / crankToTrunnionDistance);
    const cylinderAxisNormal = new THREE.Vector2(
      -cylinderAxis.y,
      cylinderAxis.x,
    );
    const pistonTravel = crankToTrunnionDistance - pistonRodLength;
    const pistonVelocity = trunnionToCrank.dot(pointPVelocity)
      / crankToTrunnionDistance;
    const pistonAcceleration = (
      pointPVelocity.lengthSq()
        + trunnionToCrank.dot(pointPAcceleration)
        - pistonVelocity ** 2
    ) / crankToTrunnionDistance;
    const cylinderAngle = Math.atan2(cylinderAxis.y, cylinderAxis.x)
      + Math.PI / 2;
    const cylinderAngularVelocity = cross2(
      trunnionToCrank,
      pointPVelocity,
    ) / trunnionToCrank.lengthSq();
    const cylinderAngularAcceleration = cross2(
      trunnionToCrank,
      pointPAcceleration,
    ) / trunnionToCrank.lengthSq()
      - 2 * pistonVelocity * cylinderAngularVelocity
        / crankToTrunnionDistance;
    const cylinderAxisVelocity = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularVelocity);
    const cylinderAxisAcceleration = cylinderAxisNormal.clone()
      .multiplyScalar(cylinderAngularAcceleration)
      .addScaledVector(
        cylinderAxis,
        -(cylinderAngularVelocity ** 2),
      );
    const pistonHead = cylinderPivot.clone().addScaledVector(
      cylinderAxis,
      pistonTravel,
    );
    const pistonHeadVelocity = cylinderAxis.clone()
      .multiplyScalar(pistonVelocity)
      .addScaledVector(cylinderAxisVelocity, pistonTravel);
    const pistonHeadAcceleration = cylinderAxis.clone()
      .multiplyScalar(pistonAcceleration)
      .addScaledVector(cylinderAxisVelocity, 2 * pistonVelocity)
      .addScaledVector(cylinderAxisAcceleration, pistonTravel);
    const pistonRodVector = pointP.clone().sub(pistonHead);
    const pistonRodRelativeVelocity = pointPVelocity.clone()
      .sub(pistonHeadVelocity);
    const pistonRodRelativeAcceleration = pointPAcceleration.clone()
      .sub(pistonHeadAcceleration);

    return {
      crank: {
        angle: inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
      },
      crankToTrunnionDistance,
      cylinder: {
        angle: cylinderAngle,
        angularAcceleration: cylinderAngularAcceleration,
        angularVelocity: cylinderAngularVelocity,
        axis: cylinderAxis,
        axisAcceleration: cylinderAxisAcceleration,
        axisNormal: cylinderAxisNormal,
        axisVelocity: cylinderAxisVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      piston: {
        acceleration: pistonAcceleration,
        head: pistonHead,
        headAcceleration: pistonHeadAcceleration,
        headVelocity: pistonHeadVelocity,
        rodAngularAcceleration: cylinderAngularAcceleration,
        rodAngularVelocity: cylinderAngularVelocity,
        rodLengthError: pistonRodVector.length() - pistonRodLength,
        rodRelativeAcceleration: pistonRodRelativeAcceleration,
        rodRelativeVelocity: pistonRodRelativeVelocity,
        travel: pistonTravel,
        velocity: pistonVelocity,
      },
      pointP,
      pointPAcceleration,
      pointPVelocity,
      unwrappedInputAngle,
    };
  };

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => stateAtInputAngle(
    sourceCrankPhaseOffset + inputTravel,
    resolvedInputAngularSpeed,
    inputAngularAcceleration,
  );
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
    const state = sourceStateAtCyclePosition(time / cyclePeriod);
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const canonicalTimes = {
    sourceStart: 0,
    sourceQuarter: cyclePeriod / 4,
    farthestDeadCenter: cyclePeriod * 3 / 8,
    sourceHalf: cyclePeriod / 2,
    sourceThreeQuarter: cyclePeriod * 3 / 4,
    nearestDeadCenter: cyclePeriod * 7 / 8,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  let maximumCylinderAngle = -Infinity;
  let maximumCrankToTrunnionDistance = -Infinity;
  let maximumPistonTravel = -Infinity;
  let maximumPistonX = -Infinity;
  let maximumPistonY = -Infinity;
  let maximumRodLengthError = 0;
  let minimumCylinderAngle = Infinity;
  let minimumCrankToTrunnionDistance = Infinity;
  let minimumPistonTravel = Infinity;
  let minimumPistonX = Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtInputTravel(FULL_TURN * sample / 16384);
    maximumCylinderAngle = Math.max(maximumCylinderAngle,
      state.cylinder.angle);
    minimumCylinderAngle = Math.min(minimumCylinderAngle,
      state.cylinder.angle);
    maximumCrankToTrunnionDistance = Math.max(
      maximumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    minimumCrankToTrunnionDistance = Math.min(
      minimumCrankToTrunnionDistance,
      state.crankToTrunnionDistance,
    );
    maximumPistonTravel = Math.max(maximumPistonTravel,
      state.piston.travel);
    minimumPistonTravel = Math.min(minimumPistonTravel,
      state.piston.travel);
    maximumPistonX = Math.max(maximumPistonX, state.piston.head.x);
    minimumPistonX = Math.min(minimumPistonX, state.piston.head.x);
    maximumPistonY = Math.max(maximumPistonY, state.piston.head.y);
    minimumPistonY = Math.min(minimumPistonY, state.piston.head.y);
    maximumRodLengthError = Math.max(maximumRodLengthError,
      Math.abs(state.piston.rodLengthError));
  }
  const minimumEndClearance = Math.min(
    minimumPistonTravel - pistonHeadThickness / 2,
    cylinderBoreLength - maximumPistonTravel - pistonHeadThickness / 2,
  );

  const geometry = {
    crankCenter,
    crankRadius,
    cyclePeriod,
    cylinderBoreLength,
    cylinderPivot,
    cylinderShellEnd,
    inputAngularSpeed,
    maximumCrankToTrunnionDistance,
    maximumCylinderAngle,
    maximumPistonTravel,
    maximumPistonX,
    maximumPistonY,
    maximumRodLengthError,
    minimumCrankToTrunnionDistance,
    minimumCylinderAngle,
    minimumEndClearance,
    minimumPistonTravel,
    minimumPistonX,
    minimumPistonY,
    pistonHeadHalfWidth,
    pistonHeadThickness,
    pistonRodLength,
    pistonStroke: maximumPistonTravel - minimumPistonTravel,
    sourceCrankPhaseOffset,
    sourceScale,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const crankMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.57,
  });
  const cylinderMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.57,
  });
  const pistonMaterial = matte(0x4d8963, {
    metalness: 0.09,
    roughness: 0.59,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const boreMaterial = matte(0x74a4b5, {
    opacity: 0.14,
    roughness: 0.70,
    transparent: true,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-upper-end-trunnion-rail-and-lower-crank-standard';
  const upperRail = new THREE.Mesh(
    new THREE.BoxGeometry(7 * sourceScale, 0.75 * sourceScale, 0.68),
    frameMaterial,
  );
  upperRail.position.set(0, 9.875 * sourceScale, -0.66);
  upperRail.userData.fixed = true;
  upperRail.userData.role = 'fixed-upper-pendulum-engine-trunnion-rail';
  const lowerFoundation = new THREE.Mesh(
    new THREE.BoxGeometry(6.8 * sourceScale, 0.42 * sourceScale, 0.72),
    frameMaterial,
  );
  lowerFoundation.position.set(0, -1.85 * sourceScale, -0.66);
  lowerFoundation.userData.fixed = true;
  lowerFoundation.userData.role = 'fixed-lower-crank-foundation';
  const lowerStandards = [-1, 1].map((side, index) => {
    const standard = new THREE.Mesh(
      new THREE.BoxGeometry(0.34 * sourceScale, 2.05 * sourceScale, 0.62),
      frameMaterial,
    );
    standard.position.set(side * 2.5 * sourceScale,
      -0.825 * sourceScale, -0.62);
    standard.userData.fixed = true;
    standard.userData.role = `fixed-lower-crank-standard-${index + 1}`;
    fixedFrame.add(standard);
    return standard;
  });
  const crankPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(2.15 * sourceScale, 0.50 * sourceScale, 0.76),
    frameMaterial,
  );
  crankPedestal.position.set(0, -0.20 * sourceScale, -0.50);
  crankPedestal.userData.fixed = true;
  crankPedestal.userData.role = 'fixed-lower-crank-pillow-block';
  const crankBearing = cylinderAlongZ(0.62 * sourceScale, 0.72,
    frameMaterial, 44);
  crankBearing.position.set(crankCenter.x, crankCenter.y, -0.39);
  crankBearing.userData.fixed = true;
  crankBearing.userData.role = 'fixed-lower-crankshaft-bearing-O';
  const crankShaft = cylinderAlongZ(0.25 * sourceScale, 1.10,
    darkMaterial, 34);
  crankShaft.position.set(crankCenter.x, crankCenter.y, -0.25);
  crankShaft.userData.fixed = true;
  crankShaft.userData.role = 'fixed-lower-crankshaft-axis-O';
  const trunnionBearingBack = boredJournal(0.75 * sourceScale, 0.30 * sourceScale + 0.006, 0.44,
    frameMaterial);
  trunnionBearingBack.position.set(cylinderPivot.x, cylinderPivot.y, -0.36);
  trunnionBearingBack.userData.fixed = true;
  trunnionBearingBack.userData.role = 'fixed-rear-upper-trunnion-bearing';
  const trunnionBearingFront = new THREE.Mesh(
    new THREE.TorusGeometry(0.42 * sourceScale, 0.10 * sourceScale,
      10, 42),
    darkMaterial,
  );
  trunnionBearingFront.position.set(cylinderPivot.x, cylinderPivot.y, 0.89);
  trunnionBearingFront.userData.fixed = true;
  trunnionBearingFront.userData.role = 'fixed-front-upper-trunnion-bearing';
  const trunnionCenterCap = cylinderAlongZ(0.16 * sourceScale, 0.18,
    whiteMaterial, 30);
  trunnionCenterCap.position.set(cylinderPivot.x, cylinderPivot.y, 1.04);
  trunnionCenterCap.userData.fixed = true;
  trunnionCenterCap.userData.role = 'fixed-upper-trunnion-axis-index';
  fixedFrame.add(
    upperRail,
    lowerFoundation,
    crankPedestal,
    crankBearing,
    crankShaft,
    trunnionBearingBack,
    trunnionBearingFront,
    trunnionCenterCap,
  );
  root.add(fixedFrame);

  const inputCrank = new THREE.Group();
  inputCrank.position.set(crankCenter.x, crankCenter.y, 0);
  inputCrank.userData.axis = Z_AXIS.clone();
  inputCrank.userData.role =
    'lower-two-point-two-five-unit-direct-acting-crank-O-P';
  const crankDisk = cylinderAlongZ(0.75 * sourceScale, 0.24,
    crankMaterial, 48);
  crankDisk.position.z = 0.12;
  crankDisk.userData.role = 'moving-lower-crank-disk';
  const crankHub = cylinderAlongZ(0.375 * sourceScale, 0.30,
    darkMaterial, 38);
  crankHub.position.z = 0.13;
  crankHub.userData.role = 'moving-lower-crankshaft-hub-O';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.34 * sourceScale, 0.24),
    crankMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 0.12);
  crankArm.userData.role = 'solid-lower-direct-crank-arm-O-P';
  const crankPinBoss = cylinderAlongZ(0.375 * sourceScale, 0.28,
    crankMaterial, 38);
  crankPinBoss.position.set(crankRadius, 0, 0.14);
  crankPinBoss.userData.role = 'moving-lower-crank-pin-boss-P';
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, 0.38);
  crankPinAnchor.userData.role = 'analytic-lower-direct-crank-pin-P';
  const crankIndex = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius * 0.53,
      0.08 * sourceScale, 0.035),
    whiteMaterial,
  );
  crankIndex.position.set(crankRadius * 0.28, 0, 0.26);
  crankIndex.userData.role = 'lower-crank-face-angular-index';
  inputCrank.add(
    crankDisk,
    crankHub,
    crankArm,
    crankPinBoss,
    crankPinAnchor,
    crankIndex,
  );
  root.add(inputCrank);

  const cylinderAssembly = new THREE.Group();
  cylinderAssembly.position.set(cylinderPivot.x, cylinderPivot.y, 0);
  cylinderAssembly.userData.axis = Z_AXIS.clone();
  cylinderAssembly.userData.role =
    'upper-end-trunnion-open-pendulum-cylinder';
  const cylinderWallThickness = (
    sourceCylinderWallOuterX - sourceCylinderWallInnerX
  ) * sourceScale;
  const cylinderWalls = [-1, 1].map((side, index) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        cylinderWallThickness,
        cylinderBoreLength,
        1.00,
      ),
      cylinderMaterial,
    );
    wall.position.set(
      side * (sourceCylinderWallOuterX + sourceCylinderWallInnerX)
        * sourceScale / 2,
      -cylinderBoreLength / 2,
      0.08,
    );
    wall.userData.role = `pendulum-cylinder-side-wall-${index + 1}`;
    cylinderAssembly.add(wall);
    return wall;
  });
  const cylinderTopPlate = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceCylinderOuterHalfWidth * 2 * sourceScale,
      0.375 * sourceScale,
      0.50,
    ),
    cylinderMaterial,
  );
  cylinderTopPlate.position.set(0, 0.1875 * sourceScale, 0.08);
  cylinderTopPlate.userData.role = 'pendulum-cylinder-pivot-end-cover';
  const cylinderBottomPlate = new THREE.Mesh(
    rectangularRodPassageGeometry(
      sourceCylinderOuterHalfWidth * 2 * sourceScale,
      (sourceCylinderShellEnd - sourceCylinderBoreLength) * sourceScale,
      0.94, sourcePistonRodHalfWidth * sourceScale + 0.006, 0.106, 0.34,
    ),
    cylinderMaterial,
  );
  cylinderBottomPlate.position.set(0,
    -(sourceCylinderShellEnd + sourceCylinderBoreLength)
      * sourceScale / 2,
    0.08);
  cylinderBottomPlate.userData.role = 'pendulum-cylinder-rod-end-cover';
  const cylinderEndPlates = [cylinderTopPlate, cylinderBottomPlate];
  const boreBack = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceCylinderWallInnerX * 2 * sourceScale,
      cylinderBoreLength,
      0.05,
    ),
    boreMaterial,
  );
  boreBack.position.set(0, -cylinderBoreLength / 2, -0.15);
  boreBack.userData.role = 'transparent-pendulum-cylinder-bore';
  const glandCollars = [
    { width: 1.0, height: 0.125, y: -5.6875 },
    { width: 0.50, height: 0.125, y: -5.8125 },
    { width: 1.0, height: 0.125, y: -5.9375 },
  ].map((specification, index) => {
    const collar = new THREE.Mesh(
      rectangularRodPassageGeometry(
        specification.width * sourceScale,
        specification.height * sourceScale,
        0.86, sourcePistonRodHalfWidth * sourceScale + 0.006, 0.106, 0.30,
      ),
      cylinderMaterial,
    );
    collar.position.set(0, specification.y * sourceScale, 0.12);
    collar.userData.role = `pendulum-cylinder-gland-collar-${index + 1}`;
    cylinderAssembly.add(collar);
    return collar;
  });
  const cylinderTrunnion = new THREE.Group();
  for (const [lowZ, highZ] of [[-0.70, 0.10], [0.56, 1.00]]) {
    const stub = cylinderAlongZ(0.30 * sourceScale, highZ - lowZ, cylinderMaterial, 38);
    stub.position.z = (lowZ + highZ) / 2;
    cylinderTrunnion.add(stub);
  }
  cylinderTrunnion.userData.role = 'moving-upper-end-cylinder-trunnion';
  const trunnionBridge = new THREE.Mesh(new THREE.BoxGeometry(
    sourceCylinderWallOuterX * 2 * sourceScale, 0.30 * sourceScale, 0.18), cylinderMaterial);
  trunnionBridge.position.z = 0.65;
  trunnionBridge.userData.role = 'front-trunnion-bridge-clear-of-piston-stroke';
  cylinderAssembly.add(trunnionBridge);
  const cylinderPivotAnchor = new THREE.Object3D();
  cylinderPivotAnchor.position.z = 0.08;
  cylinderPivotAnchor.userData.role = 'analytic-upper-cylinder-pivot-T';
  const cylinderBottomAxisAnchor = new THREE.Object3D();
  cylinderBottomAxisAnchor.position.set(0,
    sourceCylinderDirectionRay.y * sourceScale, 0.08);
  cylinderBottomAxisAnchor.userData.role = 'analytic-downward-cylinder-axis-ray';
  cylinderAssembly.add(
    cylinderTopPlate,
    cylinderBottomPlate,
    boreBack,
    cylinderTrunnion,
    cylinderPivotAnchor,
    cylinderBottomAxisAnchor,
  );
  root.add(cylinderAssembly);

  const pistonAssembly = new THREE.Group();
  pistonAssembly.userData.axis = Z_AXIS.clone();
  pistonAssembly.userData.role =
    'inverted-fixed-length-piston-rod-and-head-rooted-at-lower-crank-pin-P';
  const sourceVisibleRodLength = sourcePistonRodLength
    - sourcePistonHeadThickness / 2
    - sourcePistonRodCrankClearance;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonRodHalfWidth * 2 * sourceScale,
      sourceVisibleRodLength * sourceScale,
      0.20,
    ),
    pistonMaterial,
  );
  pistonRod.position.set(
    0,
    (
      sourcePistonRodCrankClearance
        + sourcePistonRodLength
        - sourcePistonHeadThickness / 2
    ) * sourceScale / 2,
    0.42,
  );
  pistonRod.userData.role = 'constant-length-inverted-piston-rod-from-P';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonHeadHalfWidth * 2 * sourceScale,
      sourcePistonHeadThickness * sourceScale,
      0.36,
    ),
    pistonMaterial,
  );
  pistonHead.position.set(0, pistonRodLength, 0.34);
  pistonHead.userData.role = 'sliding-head-inside-pendulum-cylinder';
  const pistonHeadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonHeadHalfWidth * 1.72 * sourceScale,
      0.045 * sourceScale,
      0.025,
    ),
    whiteMaterial,
  );
  pistonHeadIndex.position.set(0, pistonRodLength, 0.535);
  pistonHeadIndex.userData.role = 'visible-inverted-piston-face-index';
  const pistonCrankEye = boredJournal(0.36 * sourceScale,
    0.17 * sourceScale + 0.006, 0.20, pistonMaterial);
  pistonCrankEye.position.z = 0.42;
  pistonCrankEye.userData.role = 'inverted-piston-rod-eye-at-P';
  const pistonCrankAnchor = new THREE.Object3D();
  pistonCrankAnchor.position.z = 0.42;
  pistonCrankAnchor.userData.role = 'analytic-inverted-piston-crank-end-P';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, pistonRodLength, 0.34);
  pistonHeadAnchor.userData.role = 'analytic-inverted-piston-head-center-H';
  pistonAssembly.add(
    pistonRod,
    pistonHead,
    pistonHeadIndex,
    pistonCrankEye,
    pistonCrankAnchor,
    pistonHeadAnchor,
  );
  root.add(pistonAssembly);

  const crankPin = cylinderAlongZ(0.17 * sourceScale, 0.82,
    whiteMaterial, 30);
  crankPin.userData.role = 'common-lower-crank-to-piston-rod-pin-P';
  root.add(crankPin);

  const contacts = {
    crankBearingO: {
      fixedMember: fixedFrame,
      movingMember: inputCrank,
      point: new THREE.Vector3(crankCenter.x, crankCenter.y, 0.2),
      type: 'fixed-revolute-lower-crank-bearing-O',
    },
    crankPinP: {
      members: [inputCrank, pistonAssembly],
      point: new THREE.Vector3(),
      type: 'lower-crank-to-inverted-piston-rod-pin-P',
    },
    cylinderTrunnionT: {
      fixedMember: fixedFrame,
      movingMember: cylinderAssembly,
      point: new THREE.Vector3(cylinderPivot.x, cylinderPivot.y, 0.08),
      type: 'fixed-upper-end-cylinder-trunnion-T',
    },
    pistonInCylinder: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      signedTravel: 0,
      type: 'coaxial-prismatic-piston-in-pendulum-cylinder',
    },
    pistonRodAtGland: {
      axis: new THREE.Vector3(),
      members: [pistonAssembly, cylinderAssembly],
      point: new THREE.Vector3(),
      type: 'sliding-inverted-piston-rod-through-lower-gland',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCrank.rotation.z = state.inputAngle;
    inputCrank.userData.angularSpeed = state.inputAngularSpeed;
    inputCrank.userData.angularAcceleration = state.inputAngularAcceleration;
    cylinderAssembly.rotation.z = state.cylinder.angle;
    cylinderAssembly.userData.angularSpeed = state.cylinder.angularVelocity;
    cylinderAssembly.userData.angularAcceleration =
      state.cylinder.angularAcceleration;
    pistonAssembly.position.set(state.pointP.x, state.pointP.y, 0);
    pistonAssembly.rotation.z = state.cylinder.angle;
    pistonAssembly.userData.angularSpeed =
      state.piston.rodAngularVelocity;
    pistonAssembly.userData.angularAcceleration =
      state.piston.rodAngularAcceleration;
    pistonAssembly.userData.relativeTravel = state.piston.travel;
    pistonAssembly.userData.relativeVelocity = state.piston.velocity;
    pistonAssembly.userData.relativeAcceleration = state.piston.acceleration;
    crankPin.position.set(state.pointP.x, state.pointP.y, 0.59);
    contacts.crankPinP.point.set(state.pointP.x, state.pointP.y, 0.59);
    contacts.pistonInCylinder.axis.set(
      state.cylinder.axis.x,
      state.cylinder.axis.y,
      0,
    );
    contacts.pistonInCylinder.point.set(
      state.piston.head.x,
      state.piston.head.y,
      0.34,
    );
    contacts.pistonInCylinder.signedTravel = state.piston.travel;
    contacts.pistonRodAtGland.axis.copy(contacts.pistonInCylinder.axis);
    contacts.pistonRodAtGland.point.set(
      cylinderPivot.x + state.cylinder.axis.x * 5.8125 * sourceScale,
      cylinderPivot.y + state.cylinder.axis.y * 5.8125 * sourceScale,
      0.42,
    );
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-6.5, -1.069328);
  const officialViewWidth = 13;
  const officialViewHeight = 13;
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
    'upper-end-trunnion-inverted-oscillating-pendulum-engine';
  root.userData.blocks = {
    boreBack,
    crankArm,
    crankBearing,
    crankDisk,
    crankHub,
    crankIndex,
    crankPedestal,
    crankPin,
    crankPinAnchor,
    crankPinBoss,
    crankShaft,
    cylinderAssembly,
    cylinderBottomAxisAnchor,
    cylinderEndPlates,
    cylinderPivotAnchor,
    cylinderTrunnion,
    cylinderWalls,
    fixedFrame,
    glandCollars,
    inputCrank,
    lowerFoundation,
    lowerStandards,
    pistonAssembly,
    pistonCrankAnchor,
    pistonCrankEye,
    pistonHead,
    pistonHeadAnchor,
    pistonHeadIndex,
    pistonRod,
    trunnionBearingBack,
    trunnionBearingFront,
    trunnionCenterCap,
    upperRail,
  };
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.6 * sourceScale, -2.25 * sourceScale, -1.12),
    new THREE.Vector3(6.6 * sourceScale, 11.95 * sourceScale, 1.08),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one continuously rotating lower 2.25-unit crank O-P',
    mechanism: 1,
    output:
      'the piston slides upward in a cylinder that hangs and oscillates from its upper end trunnion',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -1.43;
  root.userData.mechanism =
    'lower-crank-O-P-direct-inverted-piston-rod-P-H-sliding-in-pendulum-cylinder-hung-from-fixed-upper-end-trunnion-T';
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
      'add_rot_to',
      'add_rot_to',
      'add_text',
    ],
    officialGeometry: {
      crankCenter: sourceCrankCenter,
      crankPhaseOffsetTurns: sourceCrankPhaseOffsetTurns,
      crankRadius: sourceCrankRadius,
      cylinderBoreLength: sourceCylinderBoreLength,
      cylinderDirectionRay: sourceCylinderDirectionRay,
      cylinderOuterHalfWidth: sourceCylinderOuterHalfWidth,
      cylinderPivot: sourceCylinderPivot,
      cylinderShellEnd: sourceCylinderShellEnd,
      cylinderWallInnerX: sourceCylinderWallInnerX,
      cylinderWallOuterX: sourceCylinderWallOuterX,
      pistonDirectionRay: sourcePistonDirectionRay,
      pistonHeadHalfWidth: sourcePistonHeadHalfWidth,
      pistonHeadThickness: sourcePistonHeadThickness,
      pistonRodCrankClearance: sourcePistonRodCrankClearance,
      pistonRodHalfWidth: sourcePistonRodHalfWidth,
      pistonRodLength: sourcePistonRodLength,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      applied: false,
      reason:
        'both official add_rot_to transforms share the exact T-P axis, and the fixed 7.75-unit piston rod remains inside the five-unit end-pivot cylinder with positive clearance throughout the cycle',
    },
    referenceScope:
      'official lower 2.25-unit crank, upper-end trunnion T, hanging open cylinder and lower gland, fixed-length inverted piston rod and head, frame, source view, phase, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate345: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one cylinder hangs like a pendulum from upper-end trunnions while its piston rod extends downward directly to the lower crank pin',
      measurementUncertaintyPixels: 3,
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
  root.userData.sourceStateAtCyclePosition = sourceStateAtCyclePosition;
  root.userData.sourceStateAtTime = sourceStateAtTime;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    exactConstraint:
      '|O-P|=2.25 and H=P+7.75v, where v=(T-P)/|T-P| points from the lower crank pin toward the upper trunnion',
    input: 'the lower crank pin P rotates uniformly about fixed bearing O',
    output:
      'distance |T-P| simultaneously sets pendulum-cylinder angle and piston coordinate |T-P|-7.75 down its bore',
    stroke:
      '|T-P| ranges from 8.0 to 12.5, giving exactly 4.5 source units of piston travel',
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

export function createAuthoredOscillatingEngineMovement(movement) {
  switch (movement.id) {
    case 344: return oscillatingCylinderEngine(movement);
    case 345: return invertedPendulumEngine(movement);
    default: return null;
  }
}
