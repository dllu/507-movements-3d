import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function eccentricShaftRadialPistonEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceScale = 0.5;
  const sourceCylinderRadius = 6;
  const sourceHubRadius = 5;
  const sourceShaftEccentricity = 1;
  const sourcePackingOrbitRadius = 4;
  const sourcePackingRadius = 1;
  const sourceGuideRingInnerRadius = 2.25;
  const sourceGuideRingOuterRadius = 2.75;
  const sourcePistonNoseCenter = 1.765687;
  const sourcePistonNoseRadius = 2;
  const sourcePistonBodyEnd = 3.75;
  const sourcePistonHalfWidth = 0.25;
  const cylinderRadius = sourceCylinderRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const shaftEccentricity = sourceShaftEccentricity * sourceScale;
  const packingOrbitRadius = sourcePackingOrbitRadius * sourceScale;
  const packingRadius = sourcePackingRadius * sourceScale;
  const guideRingInnerRadius = sourceGuideRingInnerRadius * sourceScale;
  const guideRingOuterRadius = sourceGuideRingOuterRadius * sourceScale;
  const pistonNoseCenter = sourcePistonNoseCenter * sourceScale;
  const pistonNoseRadius = sourcePistonNoseRadius * sourceScale;
  const pistonBodyEnd = sourcePistonBodyEnd * sourceScale;
  const pistonHalfWidth = sourcePistonHalfWidth * sourceScale;
  const pistonRootRadius = cylinderRadius
    - pistonNoseCenter - pistonNoseRadius;
  const shaftCenter = new THREE.Vector3(0, shaftEccentricity, 0);
  const cylinderCenter = new THREE.Vector3(0, 0, 0);

  const solvePiston = (
    side,
    rotorAngle,
    inputSpeed,
    inputAcceleration,
  ) => {
    const cosine = Math.cos(rotorAngle);
    const sine = Math.sin(rotorAngle);
    const orbitRadial = new THREE.Vector3(cosine, sine, 0);
    const packingCenter = shaftCenter.clone().addScaledVector(
      orbitRadial,
      side * packingOrbitRadius,
    );

    // rotorAngle=-inputAngle, so these are derivatives with respect to the
    // positive input coordinate rather than with respect to rotorAngle.
    const packingCenterPrime = new THREE.Vector3(
      side * packingOrbitRadius * sine,
      -side * packingOrbitRadius * cosine,
      0,
    );
    const packingCenterSecond = orbitRadial.clone().multiplyScalar(
      -side * packingOrbitRadius,
    );
    const packingCenterVelocity = packingCenterPrime.clone()
      .multiplyScalar(inputSpeed);
    const packingCenterAcceleration = packingCenterSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(packingCenterPrime, inputAcceleration);
    const packingCylinderRadius = packingCenter.length();
    const pistonRadial = packingCenter.clone().multiplyScalar(
      1 / packingCylinderRadius,
    );
    const pistonTangent = new THREE.Vector3(
      -pistonRadial.y,
      pistonRadial.x,
      0,
    );
    const pistonAngle = Math.atan2(pistonRadial.y, pistonRadial.x);
    const crossPackingVelocity = packingCenter.x * packingCenterPrime.y
      - packingCenter.y * packingCenterPrime.x;
    const packingDotVelocity = packingCenter.dot(packingCenterPrime);
    const pistonAnglePrime = crossPackingVelocity
      / packingCylinderRadius ** 2;
    const crossPackingAcceleration = packingCenter.x
      * packingCenterSecond.y
      - packingCenter.y * packingCenterSecond.x;
    const pistonAngleSecond = crossPackingAcceleration
      / packingCylinderRadius ** 2
      - 2 * packingDotVelocity * crossPackingVelocity
        / packingCylinderRadius ** 4;
    const pistonAngularSpeed = pistonAnglePrime * inputSpeed;
    const pistonAngularAcceleration = pistonAngleSecond * inputSpeed ** 2
      + pistonAnglePrime * inputAcceleration;
    const pistonRoot = pistonRadial.clone().multiplyScalar(pistonRootRadius);
    const pistonRootPrime = pistonTangent.clone().multiplyScalar(
      pistonRootRadius * pistonAnglePrime,
    );
    const pistonRootSecond = pistonTangent.clone().multiplyScalar(
      pistonRootRadius * pistonAngleSecond,
    ).addScaledVector(
      pistonRadial,
      -pistonRootRadius * pistonAnglePrime ** 2,
    );
    const pistonRootVelocity = pistonRootPrime.clone().multiplyScalar(
      inputSpeed,
    );
    const pistonRootAcceleration = pistonRootSecond.clone()
      .multiplyScalar(inputSpeed ** 2)
      .addScaledVector(pistonRootPrime, inputAcceleration);
    const pistonOuterTip = pistonRadial.clone().multiplyScalar(
      cylinderRadius,
    );
    const pistonOuterTipVelocity = pistonTangent.clone().multiplyScalar(
      cylinderRadius * pistonAngularSpeed,
    );
    const pistonOuterTipAcceleration = pistonTangent.clone().multiplyScalar(
      cylinderRadius * pistonAngularAcceleration,
    ).addScaledVector(
      pistonRadial,
      -cylinderRadius * pistonAngularSpeed ** 2,
    );
    const slideThroughPacking = packingCylinderRadius - pistonRootRadius;
    const slideThroughPackingPrime = packingDotVelocity
      / packingCylinderRadius;
    const slideThroughPackingSecond = (
      packingCenterPrime.lengthSq()
        + packingCenter.dot(packingCenterSecond)
    ) / packingCylinderRadius - packingDotVelocity ** 2
      / packingCylinderRadius ** 3;
    const slideThroughPackingSpeed = slideThroughPackingPrime * inputSpeed;
    const slideThroughPackingAcceleration = slideThroughPackingSecond
      * inputSpeed ** 2 + slideThroughPackingPrime * inputAcceleration;

    return {
      cylinderRadialAlignmentResidual:
        packingCenter.x * pistonRadial.y
          - packingCenter.y * pistonRadial.x,
      outerSealRadiusResidual:
        pistonOuterTip.length() - cylinderRadius,
      packingCenter,
      packingCenterAcceleration,
      packingCenterPrime,
      packingCenterSecond,
      packingCenterVelocity,
      packingCylinderRadius,
      packingOrbitResidual:
        packingCenter.distanceTo(shaftCenter) - packingOrbitRadius,
      packingRelativeAngleToHub: pistonAngle - rotorAngle,
      pistonAngle,
      pistonAnglePrime,
      pistonAngleSecond,
      pistonAngularAcceleration,
      pistonAngularSpeed,
      pistonOuterTip,
      pistonOuterTipAcceleration,
      pistonOuterTipVelocity,
      pistonRadial,
      pistonRoot,
      pistonRootAcceleration,
      pistonRootPrime,
      pistonRootSecond,
      pistonRootVelocity,
      pistonTangent,
      side,
      slideThroughPacking,
      slideThroughPackingAcceleration,
      slideThroughPackingPrime,
      slideThroughPackingSecond,
      slideThroughPackingSpeed,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const rotorAngle = -inputAngle;
    const rightPiston = solvePiston(
      1,
      rotorAngle,
      inputSpeed,
      inputAcceleration,
    );
    const leftPiston = solvePiston(
      -1,
      rotorAngle,
      inputSpeed,
      inputAcceleration,
    );
    return {
      inputAcceleration,
      inputAngle,
      inputSpeed,
      leftPiston,
      packingAntipodalAboutShaftResidual: leftPiston.packingCenter.clone()
        .add(rightPiston.packingCenter)
        .addScaledVector(shaftCenter, -2),
      rightPiston,
      rotorAngle,
      rotorAngularAcceleration: -inputAcceleration,
      rotorAngularSpeed: -inputSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    cycleDuration,
    cylinderCenter: cylinderCenter.clone(),
    cylinderRadius,
    guideRingInnerRadius,
    guideRingOuterRadius,
    hubRadius,
    inputAngularSpeed,
    packingOrbitRadius,
    packingRadius,
    pistonBodyEnd,
    pistonHalfWidth,
    pistonNoseCenter,
    pistonNoseRadius,
    pistonRootRadius,
    shaftCenter: shaftCenter.clone(),
    shaftEccentricity,
    sourceCylinderRadius,
    sourceGuideRingInnerRadius,
    sourceGuideRingOuterRadius,
    sourceHubRadius,
    sourcePackingOrbitRadius,
    sourcePackingRadius,
    sourcePistonBodyEnd,
    sourcePistonHalfWidth,
    sourcePistonNoseCenter,
    sourcePistonNoseRadius,
    sourceScale,
    sourceShaftEccentricity,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.41,
  });
  const hubMaterial = matte(PALETTE.driven, {
    metalness: 0.21,
    roughness: 0.46,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.46,
  });
  const packingMaterial = matte(0xd9a62b, {
    metalness: 0.24,
    roughness: 0.42,
  });
  const steamMaterial = matte(0xe66f4a, {
    opacity: 0.20,
    roughness: 0.60,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const exhaustMaterial = matte(0x4a93a8, {
    opacity: 0.18,
    roughness: 0.64,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const cylinderOuterRadius = 3.43;
  const cylinderA = new THREE.Mesh(
    new THREE.RingGeometry(
      cylinderRadius,
      cylinderOuterRadius,
      96,
      1,
      0,
      FULL_TURN,
    ),
    frameMaterial,
  );
  cylinderA.position.z = -0.38;
  cylinderA.userData.role =
    'fixed-circular-cylinder-concentric-with-guide-rings';
  root.add(cylinderA);
  const innerCylinderWall = new THREE.Mesh(
    new THREE.TorusGeometry(cylinderRadius, 0.11, 10, 96),
    frameMaterial,
  );
  innerCylinderWall.position.z = -0.02;
  innerCylinderWall.userData.role = 'fixed-inner-sealing-wall-of-cylinder';
  root.add(innerCylinderWall);

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(7.80, 0.28, 1.42),
    frameMaterial,
  );
  foundation.position.set(0, -3.72, -0.14);
  foundation.userData.role = 'fixed-foundation-of-eccentric-shaft-engine';
  root.add(foundation);

  for (const side of [-1, 1]) {
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 1.56, 0.68),
      frameMaterial,
    );
    neck.position.set(side * 1.58, 3.54, -0.05);
    neck.userData.role = side < 0
      ? 'left-cylinder-port-neck'
      : 'right-cylinder-port-neck';
    root.add(neck);
  }

  const guideRingInner = new THREE.Mesh(
    new THREE.TorusGeometry(guideRingInnerRadius, 0.045, 8, 72),
    darkMaterial,
  );
  guideRingInner.position.z = 0.72;
  guideRingInner.userData.role =
    'inner-fixed-head-ring-keeping-pistons-radial';
  const guideRingOuter = new THREE.Mesh(
    new THREE.TorusGeometry(guideRingOuterRadius, 0.045, 8, 72),
    darkMaterial,
  );
  guideRingOuter.position.z = 0.72;
  guideRingOuter.userData.role =
    'outer-fixed-head-ring-keeping-pistons-radial';
  root.add(guideRingInner, guideRingOuter);

  const hubRotor = new THREE.Group();
  hubRotor.position.copy(shaftCenter);
  hubRotor.userData.role = 'hub-C-concentric-with-eccentric-shaft-B';
  const hubC = cylinderAlongZ(hubRadius, 0.66, hubMaterial, 72);
  hubC.position.z = 0.08;
  hubC.userData.role = 'rotating-circular-hub-C';
  hubRotor.add(hubC);
  const hubRotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.12, 0.24),
    darkMaterial,
  );
  hubRotationMarker.position.set(0.79, 0, 0.46);
  hubRotationMarker.userData.role = 'visible-clockwise-rotation-marker-on-C';
  hubRotor.add(hubRotationMarker);
  root.add(hubRotor);

  const shaftB = cylinderAlongZ(0.31, 1.24, darkMaterial, 36);
  shaftB.position.copy(shaftCenter);
  shaftB.position.z = 0.43;
  shaftB.userData.role = 'main-shaft-B-in-fixed-eccentric-bearings';
  root.add(shaftB);

  const makePiston = (name) => {
    const group = new THREE.Group();
    group.userData.role = `${name}-piston-A-always-radial-to-cylinder`;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(pistonBodyEnd, 2 * pistonHalfWidth, 0.52),
      pistonMaterial,
    );
    body.position.set(pistonBodyEnd / 2, 0, 0.48);
    body.userData.role = `${name}-radially-sliding-blade-A`;
    group.add(body);
    const seal = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.34, 0.64),
      pistonMaterial,
    );
    seal.position.set(cylinderRadius - pistonRootRadius - 0.14, 0, 0.50);
    seal.userData.role = `${name}-outer-seal-of-A-on-cylinder-wall`;
    group.add(seal);
    const marker = cylinderAlongZ(0.10, 0.76, whiteMaterial, 20);
    marker.position.set(pistonBodyEnd - 0.08, 0, 0.53);
    marker.userData.role = `${name}-piston-A-angle-marker`;
    group.add(marker);
    root.add(group);
    return { body, group, marker, seal };
  };
  const rightPistonParts = makePiston('right-orbit');
  const leftPistonParts = makePiston('left-orbit');

  const makePacking = (name) => {
    const group = new THREE.Group();
    group.userData.role = `${name}-rolling-packing-a-in-hub-C`;
    const body = cylinderAlongZ(packingRadius, 0.78, packingMaterial, 40);
    body.position.z = 0.55;
    body.userData.role = `${name}-cylindrical-body-of-rolling-packing-a`;
    group.add(body);
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.18, 0.16),
      darkMaterial,
    );
    slot.position.z = 0.98;
    slot.userData.role = `${name}-piston-slot-through-packing-a`;
    group.add(slot);
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.08, 0.12),
      whiteMaterial,
    );
    marker.position.set(0.27, 0.28, 1.03);
    marker.rotation.z = Math.PI / 4;
    marker.userData.role = `${name}-packing-orientation-marker`;
    group.add(marker);
    root.add(group);
    return { body, group, marker, slot };
  };
  const rightPackingParts = makePacking('right-orbit');
  const leftPackingParts = makePacking('left-orbit');

  const inductionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 22, 14),
    steamMaterial,
  );
  inductionIndicator.position.set(-1.58, 3.28, 0.46);
  inductionIndicator.userData.role = 'induction-flow-arrow-indicator';
  const eductionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 22, 14),
    exhaustMaterial,
  );
  eductionIndicator.position.set(1.58, 3.28, 0.46);
  eductionIndicator.userData.role = 'eduction-flow-arrow-indicator';
  root.add(inductionIndicator, eductionIndicator);

  const updatePistonAndPacking = (state, pistonParts, packingParts) => {
    pistonParts.group.position.copy(state.pistonRoot);
    pistonParts.group.rotation.z = state.pistonAngle;
    packingParts.group.position.copy(state.packingCenter);
    packingParts.group.rotation.z = state.pistonAngle;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    hubRotor.rotation.z = state.rotorAngle;
    updatePistonAndPacking(
      state.rightPiston,
      rightPistonParts,
      rightPackingParts,
    );
    updatePistonAndPacking(
      state.leftPiston,
      leftPistonParts,
      leftPackingParts,
    );
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'eccentric-shaft-hub-with-two-orbiting-rolling-packings-guiding-cylinder-radial-sliding-pistons',
    blocks: {
      cylinderA,
      eductionIndicator,
      foundation,
      guideRingInner,
      guideRingOuter,
      hubC,
      hubRotationMarker,
      hubRotor,
      inductionIndicator,
      innerCylinderWall,
      leftPacking: leftPackingParts.group,
      leftPackingBody: leftPackingParts.body,
      leftPiston: leftPistonParts.group,
      leftPistonBody: leftPistonParts.body,
      leftPistonSeal: leftPistonParts.seal,
      rightPacking: rightPackingParts.group,
      rightPackingBody: rightPackingParts.body,
      rightPiston: rightPistonParts.group,
      rightPistonBody: rightPistonParts.body,
      rightPistonSeal: rightPistonParts.seal,
      shaftB,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      leftPistonAngleAndSlideIndependent: false,
      operatingDegreesOfFreedom: 1,
      rightPistonAngleAndSlideIndependent: false,
    },
    dynamics: {
      guideRingConstraint:
        'The fixed head rings are represented as ideal kinematic orientation constraints on the rolling packing hubs.',
      pressureExpansionCutoffLeakageFrictionPackingForcesInertiaAndLoadsModeled:
        false,
      rollingPackingModel:
        'Each packing center is fixed in hub C while its slotted body turns to remain aligned with the cylinder-radius piston; rolling contact forces are not solved.',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Main shaft B runs in fixed bearings one unit eccentric to the cylinder center. Circular hub C is concentric with B and rotates clockwise. Two rolling packings a occupy diametrically opposed radius-4 points of C. Each piston A passes through one packing, but its blade and packing slot continually turn onto the ray from the fixed cylinder center through that packing. The A outer seal therefore remains exactly on the radius-6 cylinder while changing angular speed and sliding through a. Fixed concentric head rings impose this radial orientation.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      shaftDirection: 'clockwise',
      shaftRevolutionsPerCycle: 1,
      slideMaximum: packingOrbitRadius + shaftEccentricity
        - pistonRootRadius,
      slideMinimum: packingOrbitRadius - shaftEccentricity
        - pistonRootRadius,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 427 page embeds a nine-part Canvas construction. Its cylinder center, shaft offset, radius-5 hub, radius-4 opposed packing pivots, packing slots aimed at the fixed cylinder center, radius-6 piston contact envelope, fixed guide rings, clockwise rotation, and exact piston-root radius were extracted and independently reconstructed.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      leftPackingCenter: sourceState.leftPiston.packingCenter.clone(),
      leftPistonAngle: sourceState.leftPiston.pistonAngle,
      leftPistonRoot: sourceState.leftPiston.pistonRoot.clone(),
      rightPackingCenter: sourceState.rightPiston.packingCenter.clone(),
      rightPistonAngle: sourceState.rightPiston.pistonAngle,
      rightPistonRoot: sourceState.rightPiston.pistonRoot.clone(),
      rotorAngle: sourceState.rotorAngle,
    },
    sourceReference: {
      brownPlate427: {
        cylinderApproximateCenterPixels: [263, 286],
        guideRingApproximateRadiiPixels: [54, 72],
        imageHeight: 525,
        imageWidth: 525,
        mainShaftBApproximateCenterPixels: [274, 246],
        measurementUncertaintyPixels: 12,
        packingAApproximateCentersPixels: [[191, 187], [338, 343]],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'shaft B runs in fixed bearings eccentric to the cylinder',
          'there are two pistons A, A',
          'the pistons slide in grooves in hub C',
          'hub C is concentric with shaft B',
          'the pistons are always radial to the cylinder',
          'rings on the cylinder heads keep the radial orientation',
          'the pistons slide through rolling packings a, a',
        ],
        engravingEvidence:
          'Brown’s cutaway shows an offset shaft B, large hub C, two oblique piston blades A, circular slotted packings a at the blade/hub crossings, two dotted guide rings concentric with the cylinder, and a crescent working chamber.',
        officialCanvasEvidence:
          'The official model places the cylinder center at (0,0), shaft and hub center at (0,1), gives C radius 5, puts the packing pivots at local (+/-4,0), fixes the cylinder contact circle at radius 6, uses guide-ring radii 2.25 and 2.75, and places each piston origin at radius 2.234313 because 2.234313+1.765687+2=6.',
        reconstructionDisclosure:
          'Brown gives no absolute scale, axial depth, detailed ring-to-packing joint, port timing, pressure cycle, speed, materials, rolling friction, packing force, inertia, or loads. Housing depth, supports, colors, and flow indicators are independently engineered; the complete planar constraint and timing come from the official model.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 427',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      outerSealConstraint:
        'pistonOuterTip=cylinderRadius*normalize(packingCenter)',
      packingOrbit:
        'packingCenter=shaftCenter+side*packingOrbitRadius*[cos(-inputAngle),sin(-inputAngle)]',
      pistonRadialConstraint:
        'pistonAngle=atan2(packingCenter.y,packingCenter.x)',
      slideThroughPacking:
        'slide=|packingCenter|-pistonRootRadius',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.98, -3.88, -1.00),
    new THREE.Vector3(3.98, 4.42, 1.48),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(5.0, 3.7, 11.8);
  root.userData.groundFloorY = -3.88;
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredEccentricShaftRadialPistonEngineMovement(
  movement,
) {
  if (movement.id !== 427) return null;
  return eccentricShaftRadialPistonEngine(movement);
}
