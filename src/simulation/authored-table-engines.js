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

function tubeThrough(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 32, radius, 10, false),
    material,
  );
}

function makeSideRod({
  depth,
  eyeMaterial,
  length,
  material,
  role,
  width,
}) {
  const group = new THREE.Group();
  group.userData.axis = Z_AXIS.clone();
  group.userData.nominalLength = length;
  group.userData.role = role;

  const shank = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    material,
  );
  shank.position.x = length / 2;
  shank.userData.role = `${role}-constant-length-shank`;
  const bosses = [0, length].map((x, index) => {
    const boss = cylinderAlongZ(width * 0.86, depth * 1.28,
      material, 34);
    boss.position.x = x;
    boss.userData.role = `${role}-${index === 0 ? 'crank' : 'crosshead'}-boss`;
    group.add(boss);
    return boss;
  });
  const eyes = [0, length].map((x, index) => {
    const eye = new THREE.Mesh(
      new THREE.TorusGeometry(width * 0.46, width * 0.14, 8, 30),
      eyeMaterial,
    );
    eye.position.set(x, 0, depth / 2 + 0.012);
    eye.userData.role = `${role}-${index === 0 ? 'crank' : 'crosshead'}-eye`;
    group.add(eye);
    return eye;
  });
  const startAnchor = new THREE.Object3D();
  startAnchor.userData.role = `${role}-analytic-crank-end-P`;
  const endAnchor = new THREE.Object3D();
  endAnchor.position.x = length;
  endAnchor.userData.role = `${role}-analytic-crosshead-end-C`;
  group.add(shank, startAnchor, endAnchor);

  return {
    bosses,
    endAnchor,
    eyes,
    group,
    shank,
    startAnchor,
  };
}

function tableEngine(movement) {
  const root = new THREE.Group();

  // Exact official source construction. A 2-unit crank P rotates about O.
  // add_c_rod intersects the 11.125-unit rod circle about P with the fixed
  // vertical stroke line x=0 and selects its upper branch. The translated
  // piston assembly then puts its head center exactly 6.25 units below C.
  const sourceScale = 0.36;
  const sourceCrankCenter = new THREE.Vector2(0, 0);
  const sourceCrankRadius = 2;
  const sourceCrankPhaseOffsetTurns = 0;
  const sourceConnectingRodLength = 11.125;
  const sourceStrokeLine = [
    new THREE.Vector2(0, 8.125),
    new THREE.Vector2(0, 13.125),
  ];
  const sourceCrossheadMinimumY = 9.125;
  const sourceCrossheadMaximumY = 13.125;
  const sourceCrossheadWidth = 1;
  const sourceCrossheadHeight = 1.25;
  const sourcePistonRodTopY = -0.625;
  const sourcePistonRodBottomY = -6;
  const sourcePistonRodHalfWidth = 0.125;
  const sourcePistonHeadOffsetY = -6.25;
  const sourcePistonHeadHalfWidth = 1.25;
  const sourcePistonHeadThickness = 0.5;
  const sourceCylinderBoreMinimumY = 2.375;
  const sourceCylinderBoreMaximumY = 7.375;
  const sourceCylinderInnerHalfWidth = 1.25;
  const sourceCylinderOuterHalfWidth = 1.5;
  const sourceCylinderShellMinimumY = 2;
  const sourceCylinderShellMaximumY = 7.75;
  const sourceGuideMinimumY = 7.75;
  const sourceGuideMaximumY = 14.875;
  const sourceTableHalfWidth = 4.5;
  const sourceTableBottomY = 1.75;
  const sourceTableTopY = 2;
  const sourceLegX = 4.25;
  const sourceLegBottomY = -1.25;
  // The official canvas stops its two table-standard lines at the lower
  // viewport edge. Continue those non-kinematic standards to a floor below
  // the complete crank-pin orbit so the 3D crank never cuts the ground.
  const visualLegBottomY = -2.35;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;
  const sourceCrankPhaseOffset = FULL_TURN
    * sourceCrankPhaseOffsetTurns;

  const crankCenter = sourceCrankCenter.clone().multiplyScalar(sourceScale);
  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const crossheadMinimumY = sourceCrossheadMinimumY * sourceScale;
  const crossheadMaximumY = sourceCrossheadMaximumY * sourceScale;
  const pistonHeadOffsetY = sourcePistonHeadOffsetY * sourceScale;
  const pistonHeadHalfWidth = sourcePistonHeadHalfWidth * sourceScale;
  const pistonHeadThickness = sourcePistonHeadThickness * sourceScale;
  const cylinderBoreMinimumY = sourceCylinderBoreMinimumY * sourceScale;
  const cylinderBoreMaximumY = sourceCylinderBoreMaximumY * sourceScale;
  const sideRodPlaneZ = 0.63;

  const sourceStateAtCyclePosition = (cyclePosition) => {
    const unwrappedInputAngle = sourceCrankPhaseOffset
      + FULL_TURN * cyclePosition;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const pointP = sourceCrankCenter.clone().add(new THREE.Vector2(
      sourceCrankRadius * Math.cos(inputAngle),
      sourceCrankRadius * Math.sin(inputAngle),
    ));
    const positiveRoot = Math.sqrt(
      sourceConnectingRodLength ** 2 - pointP.x ** 2,
    );
    const crossheadC = new THREE.Vector2(0, pointP.y + positiveRoot);
    const pistonHeadH = crossheadC.clone().add(
      new THREE.Vector2(0, sourcePistonHeadOffsetY),
    );
    return {
      connectingRodLengthError:
        pointP.distanceTo(crossheadC) - sourceConnectingRodLength,
      crossheadC,
      inputAngle,
      pistonHeadH,
      pointP,
      positiveRoot,
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
    const pointPThetaDerivative = new THREE.Vector2(
      -crankRadius * sine,
      crankRadius * cosine,
    );
    const pointPThetaSecondDerivative = new THREE.Vector2(
      -crankRadius * cosine,
      -crankRadius * sine,
    );
    const pointPVelocity = pointPThetaDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed);
    const pointPAcceleration = pointPThetaSecondDerivative.clone()
      .multiplyScalar(resolvedInputAngularSpeed ** 2)
      .addScaledVector(pointPThetaDerivative, inputAngularAcceleration);
    const positiveRoot = Math.sqrt(
      connectingRodLength ** 2 - pointP.x ** 2,
    );
    const rootThetaDerivative = crankRadius ** 2 * sine * cosine
      / positiveRoot;
    const rootThetaSecondDerivative = crankRadius ** 2
      * (cosine ** 2 - sine ** 2) / positiveRoot
      - crankRadius ** 4 * sine ** 2 * cosine ** 2
        / positiveRoot ** 3;
    const crossheadThetaDerivative = crankRadius * cosine
      + rootThetaDerivative;
    const crossheadThetaSecondDerivative = -crankRadius * sine
      + rootThetaSecondDerivative;
    const crossheadC = new THREE.Vector2(
      0,
      pointP.y + positiveRoot,
    );
    const crossheadVelocity = new THREE.Vector2(
      0,
      crossheadThetaDerivative * resolvedInputAngularSpeed,
    );
    const crossheadAcceleration = new THREE.Vector2(
      0,
      crossheadThetaSecondDerivative * resolvedInputAngularSpeed ** 2
        + crossheadThetaDerivative * inputAngularAcceleration,
    );
    const rodVector = crossheadC.clone().sub(pointP);
    const rodRelativeVelocity = crossheadVelocity.clone()
      .sub(pointPVelocity);
    const rodRelativeAcceleration = crossheadAcceleration.clone()
      .sub(pointPAcceleration);
    const rodRates = rigidLinkRates(
      rodVector,
      rodRelativeVelocity,
      rodRelativeAcceleration,
    );
    const pistonHeadH = crossheadC.clone().add(
      new THREE.Vector2(0, pistonHeadOffsetY),
    );
    const pistonTravel = pistonHeadH.y
      - (crossheadMinimumY + pistonHeadOffsetY);

    return {
      connectingRods: {
        angle: rodRates.angle,
        angularAcceleration: rodRates.angularAcceleration,
        angularVelocity: rodRates.angularVelocity,
        length: rodVector.length(),
        lengthError: rodVector.length() - connectingRodLength,
        relativeAcceleration: rodRelativeAcceleration,
        relativeVelocity: rodRelativeVelocity,
      },
      crank: {
        angle: inputAngle,
        angularAcceleration: inputAngularAcceleration,
        angularVelocity: resolvedInputAngularSpeed,
      },
      crosshead: {
        acceleration: crossheadAcceleration,
        point: crossheadC,
        thetaDerivative: crossheadThetaDerivative,
        thetaSecondDerivative: crossheadThetaSecondDerivative,
        velocity: crossheadVelocity,
      },
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      piston: {
        acceleration: crossheadAcceleration.clone(),
        head: pistonHeadH,
        stroke: (sourceCrossheadMaximumY - sourceCrossheadMinimumY)
          * sourceScale,
        travel: pistonTravel,
        velocity: crossheadVelocity.clone(),
      },
      pointP,
      pointPAcceleration,
      pointPVelocity,
      positiveRoot,
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
    upperDeadCenter: cyclePeriod / 4,
    sourceHalf: cyclePeriod / 2,
    lowerDeadCenter: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const geometry = {
    connectingRodLength,
    crankCenter,
    crankRadius,
    crossheadMaximumY,
    crossheadMinimumY,
    cyclePeriod,
    cylinderBoreMaximumY,
    cylinderBoreMinimumY,
    inputAngularSpeed,
    pistonHeadHalfWidth,
    pistonHeadOffsetY,
    pistonHeadThickness,
    sideRodPlaneZ,
    sourceScale,
    stroke: crossheadMaximumY - crossheadMinimumY,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.62,
  });
  const frameEdgeMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.52,
  });
  const boreMaterial = matte(PALETTE.driven, {
    opacity: 0.22,
    roughness: 0.72,
    transparent: true,
  });
  boreMaterial.depthWrite = false;
  const crankMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.58,
  });
  const rodMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const pistonMaterial = matte(PALETTE.accent, {
    metalness: 0.16,
    roughness: 0.58,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-table-base-cylinder-and-straight-slotted-crosshead-guides';

  const tabletop = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceTableHalfWidth * 2 * sourceScale,
      (sourceTableTopY - sourceTableBottomY) * sourceScale,
      1.72,
    ),
    frameMaterial,
  );
  tabletop.position.set(
    0,
    (sourceTableBottomY + sourceTableTopY) * sourceScale / 2,
    0,
  );
  tabletop.userData.role = 'fixed-table-like-engine-bed';
  const tableTopEdge = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceTableHalfWidth * 2.06 * sourceScale,
      0.07,
      1.82,
    ),
    frameEdgeMaterial,
  );
  tableTopEdge.position.set(0, sourceTableTopY * sourceScale, 0);
  tableTopEdge.userData.role = 'fixed-table-bed-top-edge';

  const tableLegs = [-1, 1].map((side, index) => {
    const legHeight = (sourceTableBottomY - visualLegBottomY)
      * sourceScale;
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.23 * sourceScale, legHeight, 1.48),
      frameMaterial,
    );
    leg.position.set(
      side * sourceLegX * sourceScale,
      (visualLegBottomY + sourceTableBottomY) * sourceScale / 2,
      0,
    );
    leg.userData.role = `fixed-table-standard-${index + 1}`;
    fixedFrame.add(leg);
    return leg;
  });

  const cylinderWallThickness = (
    sourceCylinderOuterHalfWidth - sourceCylinderInnerHalfWidth
  ) * sourceScale;
  const cylinderBoreHeight = cylinderBoreMaximumY
    - cylinderBoreMinimumY;
  const cylinderWalls = [-1, 1].map((side, index) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        cylinderWallThickness,
        cylinderBoreHeight,
        0.72,
      ),
      frameMaterial,
    );
    wall.position.set(
      side * (sourceCylinderOuterHalfWidth
        + sourceCylinderInnerHalfWidth) * sourceScale / 2,
      (cylinderBoreMinimumY + cylinderBoreMaximumY) / 2,
      -0.05,
    );
    wall.userData.role = `fixed-open-cylinder-side-wall-${index + 1}`;
    fixedFrame.add(wall);
    return wall;
  });
  const lowerCylinderCover = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceCylinderOuterHalfWidth * 2.5 * sourceScale,
      (sourceCylinderBoreMinimumY - sourceCylinderShellMinimumY)
        * sourceScale,
      0.84,
    ),
    frameMaterial,
  );
  lowerCylinderCover.position.set(
    0,
    (sourceCylinderShellMinimumY + sourceCylinderBoreMinimumY)
      * sourceScale / 2,
    -0.05,
  );
  lowerCylinderCover.userData.role = 'fixed-table-engine-lower-cylinder-cover';
  const upperCylinderCover = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceCylinderOuterHalfWidth * 2.5 * sourceScale,
      (sourceCylinderShellMaximumY - sourceCylinderBoreMaximumY)
        * sourceScale,
      0.84,
    ),
    frameMaterial,
  );
  upperCylinderCover.position.set(
    0,
    (sourceCylinderBoreMaximumY + sourceCylinderShellMaximumY)
      * sourceScale / 2,
    -0.05,
  );
  upperCylinderCover.userData.role = 'fixed-table-engine-upper-cylinder-cover';
  const cylinderEndPlates = [lowerCylinderCover, upperCylinderCover];
  const boreBack = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceCylinderInnerHalfWidth * 2 * sourceScale,
      cylinderBoreHeight,
      0.05,
    ),
    boreMaterial,
  );
  boreBack.position.set(
    0,
    (cylinderBoreMinimumY + cylinderBoreMaximumY) / 2,
    -0.43,
  );
  boreBack.userData.role = 'fixed-transparent-table-engine-cylinder-bore';
  const gland = new THREE.Group();
  gland.userData.role = 'fixed-piston-rod-gland-atop-cylinder';
  [
    { halfWidth: 0.50, maximumY: 8.125, minimumY: 8.0 },
    { halfWidth: 0.375, maximumY: 8.0, minimumY: 7.75 },
  ].forEach((specification, index) => {
    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(
        specification.halfWidth * 2 * sourceScale,
        (specification.maximumY - specification.minimumY) * sourceScale,
        0.91,
      ),
      index === 0 ? frameEdgeMaterial : frameMaterial,
    );
    collar.position.set(
      0,
      (specification.minimumY + specification.maximumY)
        * sourceScale / 2,
      -0.02,
    );
    collar.userData.role = `fixed-gland-collar-${index + 1}`;
    gland.add(collar);
  });

  const guideRails = [-1, 1].map((side, index) => {
    const start = new THREE.Vector3(
      side * 0.375 * sourceScale,
      8.375 * sourceScale,
      0.19,
    );
    const end = new THREE.Vector3(
      side * 0.375 * sourceScale,
      14.0 * sourceScale,
      0.19,
    );
    const rail = beamBetween3D(
      start,
      end,
      0.25 * sourceScale,
      0.34,
      frameMaterial,
    );
    rail.userData.role = `fixed-straight-slotted-guide-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const guideStandards = [-1, 1].map((side, index) => {
    const start = new THREE.Vector3(
      side * 1.30 * sourceScale,
      sourceGuideMinimumY * sourceScale,
      -0.17,
    );
    const end = new THREE.Vector3(
      side * 0.54 * sourceScale,
      14.33 * sourceScale,
      -0.17,
    );
    const standard = beamBetween3D(
      start,
      end,
      0.18 * sourceScale,
      0.24,
      frameEdgeMaterial,
    );
    standard.userData.role = `fixed-tapered-guide-standard-${index + 1}`;
    fixedFrame.add(standard);
    return standard;
  });
  const guideArchPoints = [];
  for (let index = 0; index <= 16; index += 1) {
    const angle = Math.PI - Math.PI * index / 16;
    guideArchPoints.push(new THREE.Vector3(
      0.54 * sourceScale * Math.cos(angle),
      (14.33 + 0.54 * Math.sin(angle)) * sourceScale,
      -0.17,
    ));
  }
  const guideArch = tubeThrough(
    guideArchPoints,
    0.09 * sourceScale,
    frameEdgeMaterial,
  );
  guideArch.userData.role = 'fixed-rounded-top-of-straight-slotted-guides';
  const guideSlotArchPoints = [];
  for (let index = 0; index <= 16; index += 1) {
    const angle = Math.PI - Math.PI * index / 16;
    guideSlotArchPoints.push(new THREE.Vector3(
      0.25 * sourceScale * Math.cos(angle),
      (14.0 + 0.25 * Math.sin(angle)) * sourceScale,
      0.19,
    ));
  }
  const guideSlotArch = tubeThrough(
    guideSlotArchPoints,
    0.045 * sourceScale,
    frameMaterial,
  );
  guideSlotArch.userData.role = 'fixed-inner-semicircular-end-of-guide-slot';
  const guideFoot = new THREE.Mesh(
    new THREE.BoxGeometry(2.75 * sourceScale, 0.22 * sourceScale, 0.82),
    frameMaterial,
  );
  guideFoot.position.set(0, 7.86 * sourceScale, -0.04);
  guideFoot.userData.role = 'fixed-guide-frame-foot-on-cylinder';

  const crankBearingBlocks = [-1, 1].map((side, index) => {
    const bearing = cylinderAlongZ(0.38 * sourceScale, 0.28,
      frameEdgeMaterial, 36);
    bearing.position.set(0, 0, side * 0.90);
    bearing.userData.role = `fixed-crankshaft-bearing-${index + 1}`;
    fixedFrame.add(bearing);
    return bearing;
  });
  fixedFrame.add(
    tabletop,
    tableTopEdge,
    lowerCylinderCover,
    upperCylinderCover,
    boreBack,
    gland,
    guideArch,
    guideSlotArch,
    guideFoot,
  );
  root.add(fixedFrame);

  const inputCranks = new THREE.Group();
  inputCranks.position.set(crankCenter.x, crankCenter.y, 0);
  inputCranks.userData.axis = Z_AXIS.clone();
  inputCranks.userData.role =
    'moving-common-shaft-with-two-aligned-parallel-cranks';
  const crankShaft = cylinderAlongZ(0.22 * sourceScale, 2.12,
    frameEdgeMaterial, 38);
  crankShaft.userData.role = 'moving-common-crankshaft-under-table';
  inputCranks.add(crankShaft);
  const crankArms = [];
  const crankPinBosses = [];
  const crankIndexMarks = [];
  [-1, 1].forEach((side, index) => {
    const crankArm = new THREE.Mesh(
      new THREE.BoxGeometry(crankRadius, 0.42 * sourceScale, 0.18),
      crankMaterial,
    );
    crankArm.position.set(crankRadius / 2, 0, side * sideRodPlaneZ);
    crankArm.userData.role = `parallel-crank-arm-${index + 1}-O-P`;
    const crankHub = cylinderAlongZ(0.42 * sourceScale, 0.24,
      crankMaterial, 36);
    crankHub.position.z = side * sideRodPlaneZ;
    crankHub.userData.role = `parallel-crank-hub-${index + 1}`;
    const crankPinBoss = cylinderAlongZ(0.32 * sourceScale, 0.34,
      crankMaterial, 34);
    crankPinBoss.position.set(
      crankRadius,
      0,
      side * sideRodPlaneZ,
    );
    crankPinBoss.userData.role = `parallel-crank-pin-boss-${index + 1}-P`;
    const crankIndex = new THREE.Mesh(
      new THREE.BoxGeometry(crankRadius * 0.48, 0.07, 0.025),
      whiteMaterial,
    );
    crankIndex.position.set(
      crankRadius * 0.31,
      0,
      side * sideRodPlaneZ + side * 0.105,
    );
    crankIndex.userData.role = `parallel-crank-angular-index-${index + 1}`;
    inputCranks.add(crankArm, crankHub, crankPinBoss, crankIndex);
    crankArms.push(crankArm);
    crankPinBosses.push(crankPinBoss);
    crankIndexMarks.push(crankIndex);
  });
  root.add(inputCranks);

  const sideRodAssemblies = [-1, 1].map((side, index) => {
    const assembly = makeSideRod({
      depth: 0.18,
      eyeMaterial: whiteMaterial,
      length: connectingRodLength,
      material: rodMaterial,
      role: `moving-side-connecting-rod-${index + 1}-P-C`,
      width: 0.30 * sourceScale,
    });
    assembly.group.position.z = side * sideRodPlaneZ;
    root.add(assembly.group);
    return assembly;
  });

  const pistonAssembly = new THREE.Group();
  pistonAssembly.userData.role =
    'guided-crosshead-piston-rod-and-piston-head-assembly';
  const crosshead = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceCrossheadWidth * sourceScale,
      sourceCrossheadHeight * sourceScale,
      sideRodPlaneZ * 2 + 0.42,
    ),
    pistonMaterial,
  );
  crosshead.userData.role = 'moving-crosshead-in-fixed-straight-slot';
  const crossheadPin = cylinderAlongZ(0.31 * sourceScale,
    sideRodPlaneZ * 2 + 0.72, frameEdgeMaterial, 36);
  crossheadPin.userData.role = 'common-crosshead-pin-C-for-two-side-rods';
  const crossheadPinCaps = [-1, 1].map((side, index) => {
    const cap = cylinderAlongZ(0.36 * sourceScale, 0.09,
      whiteMaterial, 34);
    cap.position.z = side * (sideRodPlaneZ + 0.39);
    cap.userData.role = `crosshead-pin-visible-cap-${index + 1}`;
    pistonAssembly.add(cap);
    return cap;
  });
  const pistonRodLength = (
    sourcePistonRodTopY - sourcePistonRodBottomY
  ) * sourceScale;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonRodHalfWidth * 2 * sourceScale,
      pistonRodLength,
      0.22,
    ),
    pistonMaterial,
  );
  pistonRod.position.set(
    0,
    (sourcePistonRodTopY + sourcePistonRodBottomY)
      * sourceScale / 2,
    0.14,
  );
  pistonRod.userData.role = 'vertical-piston-rod-rigid-with-crosshead';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonHeadHalfWidth * 2 * sourceScale,
      pistonHeadThickness,
      0.58,
    ),
    pistonMaterial,
  );
  pistonHead.position.set(0, pistonHeadOffsetY, 0.10);
  pistonHead.userData.role = 'moving-piston-head-inside-fixed-cylinder';
  const pistonHeadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePistonHeadHalfWidth * 1.70 * sourceScale,
      0.045,
      0.025,
    ),
    whiteMaterial,
  );
  pistonHeadIndex.position.set(0, pistonHeadOffsetY, 0.405);
  pistonHeadIndex.userData.role = 'visible-piston-head-face-index';
  const crossheadAnchor = new THREE.Object3D();
  crossheadAnchor.userData.role = 'analytic-crosshead-center-C';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.y = pistonHeadOffsetY;
  pistonHeadAnchor.userData.role = 'analytic-piston-head-center-H';
  pistonAssembly.add(
    crosshead,
    crossheadPin,
    pistonRod,
    pistonHead,
    pistonHeadIndex,
    crossheadAnchor,
    pistonHeadAnchor,
  );
  root.add(pistonAssembly);

  const contacts = {
    crankshaftBearingO: {
      fixedMember: fixedFrame,
      movingMember: inputCranks,
      point: new THREE.Vector3(crankCenter.x, crankCenter.y, 0),
      type: 'fixed-revolute-common-crankshaft-bearing-O',
    },
    parallelCrankPinsP: [-1, 1].map((side, index) => ({
      members: [inputCranks, sideRodAssemblies[index].group],
      point: new THREE.Vector3(0, 0, side * sideRodPlaneZ),
      type: `revolute-parallel-crank-${index + 1}-to-side-rod-P`,
    })),
    sideRodsAtCrossheadC: [-1, 1].map((side, index) => ({
      members: [sideRodAssemblies[index].group, pistonAssembly],
      point: new THREE.Vector3(0, 0, side * sideRodPlaneZ),
      type: `revolute-side-rod-${index + 1}-to-common-crosshead-C`,
    })),
    crossheadInStraightGuides: {
      axis: new THREE.Vector3(0, 1, 0),
      fixedMember: fixedFrame,
      movingMember: pistonAssembly,
      point: new THREE.Vector3(),
      type: 'vertical-prismatic-crosshead-in-fixed-straight-slotted-guides',
    },
    pistonInFixedCylinder: {
      axis: new THREE.Vector3(0, 1, 0),
      fixedMember: fixedFrame,
      movingMember: pistonAssembly,
      point: new THREE.Vector3(),
      type: 'vertical-prismatic-piston-in-fixed-table-engine-cylinder',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputCranks.rotation.z = state.inputAngle;
    inputCranks.userData.angularSpeed = state.inputAngularSpeed;
    inputCranks.userData.angularAcceleration =
      state.inputAngularAcceleration;
    sideRodAssemblies.forEach((assembly, index) => {
      const side = index === 0 ? -1 : 1;
      assembly.group.position.set(
        state.pointP.x,
        state.pointP.y,
        side * sideRodPlaneZ,
      );
      assembly.group.rotation.z = state.connectingRods.angle;
      assembly.group.userData.angularSpeed =
        state.connectingRods.angularVelocity;
      assembly.group.userData.angularAcceleration =
        state.connectingRods.angularAcceleration;
    });
    pistonAssembly.position.set(
      state.crosshead.point.x,
      state.crosshead.point.y,
      0,
    );
    pistonAssembly.userData.velocity = state.crosshead.velocity.clone();
    pistonAssembly.userData.acceleration =
      state.crosshead.acceleration.clone();
    contacts.parallelCrankPinsP.forEach((contact, index) => {
      contact.point.set(
        state.pointP.x,
        state.pointP.y,
        (index === 0 ? -1 : 1) * sideRodPlaneZ,
      );
    });
    contacts.sideRodsAtCrossheadC.forEach((contact, index) => {
      contact.point.set(
        state.crosshead.point.x,
        state.crosshead.point.y,
        (index === 0 ? -1 : 1) * sideRodPlaneZ,
      );
    });
    contacts.crossheadInStraightGuides.point.set(
      state.crosshead.point.x,
      state.crosshead.point.y,
      0,
    );
    contacts.pistonInFixedCylinder.point.set(
      state.piston.head.x,
      state.piston.head.y,
      0.10,
    );
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-8.5, -1.350861);
  const officialViewWidth = 17;
  const officialViewHeight = 17;
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

  root.userData.archetype = 'table-engine-two-side-rods-parallel-cranks';
  root.userData.blocks = {
    boreBack,
    crankArms,
    crankBearingBlocks,
    crankIndexMarks,
    crankPinBosses,
    crankShaft,
    crosshead,
    crossheadAnchor,
    crossheadPin,
    crossheadPinCaps,
    cylinderEndPlates,
    cylinderWalls,
    fixedFrame,
    gland,
    guideArch,
    guideSlotArch,
    guideFoot,
    guideRails,
    guideStandards,
    inputCranks,
    pistonAssembly,
    pistonHead,
    pistonHeadAnchor,
    pistonHeadIndex,
    pistonRod,
    sideRodAssemblies,
    tableLegs,
    tableTopEdge,
    tabletop,
  };
  root.userData.cameraDistanceScale = 1.27;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.85 * sourceScale, -2.55 * sourceScale, -1.15),
    new THREE.Vector3(4.85 * sourceScale, 15.05 * sourceScale, 1.15),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one common shaft carrying two aligned parallel 2-unit cranks',
    mechanism: 1,
    output:
      'one crosshead and piston assembly constrained to the fixed vertical slot',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -0.90;
  root.userData.mechanism =
    'common-crankshaft-O-with-two-parallel-cranks-O-P-two-equal-side-rods-P-C-common-guided-crosshead-C-rigid-piston-rod-and-head-H-in-fixed-table-cylinder';
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
      'add_text',
    ],
    officialGeometry: {
      connectingRodLength: sourceConnectingRodLength,
      crankCenter: sourceCrankCenter,
      crankPhaseOffsetTurns: sourceCrankPhaseOffsetTurns,
      crankRadius: sourceCrankRadius,
      crossheadHeight: sourceCrossheadHeight,
      crossheadMaximumY: sourceCrossheadMaximumY,
      crossheadMinimumY: sourceCrossheadMinimumY,
      crossheadWidth: sourceCrossheadWidth,
      cylinderBoreMaximumY: sourceCylinderBoreMaximumY,
      cylinderBoreMinimumY: sourceCylinderBoreMinimumY,
      cylinderInnerHalfWidth: sourceCylinderInnerHalfWidth,
      cylinderOuterHalfWidth: sourceCylinderOuterHalfWidth,
      cylinderShellMaximumY: sourceCylinderShellMaximumY,
      cylinderShellMinimumY: sourceCylinderShellMinimumY,
      guideMaximumY: sourceGuideMaximumY,
      guideMinimumY: sourceGuideMinimumY,
      legBottomY: sourceLegBottomY,
      legX: sourceLegX,
      pistonHeadHalfWidth: sourcePistonHeadHalfWidth,
      pistonHeadOffsetY: sourcePistonHeadOffsetY,
      pistonHeadThickness: sourcePistonHeadThickness,
      pistonRodBottomY: sourcePistonRodBottomY,
      pistonRodHalfWidth: sourcePistonRodHalfWidth,
      pistonRodTopY: sourcePistonRodTopY,
      strokeLine: sourceStrokeLine,
      tableBottomY: sourceTableBottomY,
      tableHalfWidth: sourceTableHalfWidth,
      tableTopY: sourceTableTopY,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      applied: false,
      reason:
        'the official add_c_rod closes exactly on its vertical stroke line for the entire cycle, so both 3D side rods use that same exact P-C solution',
    },
    referenceScope:
      'official fixed table and cylinder, straight slotted upper guides, common lower shaft and aligned 2-unit parallel cranks, two physical 11.125-unit side rods, guided crosshead, piston assembly, source phase, view, and 15 rpm timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate346: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one fixed table cylinder with its crosshead above, driven symmetrically by two side rods from two aligned cranks on one lower shaft',
      measurementUncertaintyPixels: 3,
    },
    visualExtrapolation: {
      applied: true,
      reason:
        'the two non-kinematic table-standard lines terminate at the official crop, so they are continued downward to a floor below the full crank orbit',
      sourceCropY: sourceLegBottomY,
      visualLegBottomY,
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
      '|O-P|=2 and C=(0, P_y+sqrt(11.125^2-P_x^2)); both side rods satisfy |P-C|=11.125',
    input:
      'the two aligned parallel cranks rotate together on one shaft below the table',
    output:
      'the two side rods act symmetrically on common crosshead C, which carries piston-head center H=C+(0,-6.25)',
    stroke:
      'C_y ranges exactly from 9.125 to 13.125, so the piston stroke is exactly 4 source units with 0.25 clearance at each bore end',
  };

  update(0);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(6.0, 3.6, 12.5),
    root,
    update,
  };
}

export function createAuthoredTableEngineMovement(movement) {
  switch (movement.id) {
    case 346: return tableEngine(movement);
    default: return null;
  }
}
