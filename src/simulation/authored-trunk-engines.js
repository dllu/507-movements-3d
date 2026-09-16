import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

import { boredCylinderGeometry, boredJournal, fitPistonGuide } from './piston-guide-parts.js';
import { sectionedCylinder, engineRod, annularSector } from './steam-engine-parts.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function trunkEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const crankCenter = new THREE.Vector3(0, 2.78, 0);
  const crankRadius = 0.48;
  const pitmanLength = crankRadius * (7.45 / 1.5);
  const sourceCrankAngle = 0;
  const pistonRadius = 1.115;
  const pistonThickness = 0.24;
  const trunkOuterRadius = 0.50;
  const trunkLength = 1.42;
  const cylinderHeadY = 1.12;
  const cylinderBottomY = -0.90;
  const cylinderRadius = 1.20;
  const lowerEffectiveArea = Math.PI * pistonRadius ** 2;
  const trunkCrossSectionArea = Math.PI * trunkOuterRadius ** 2;
  const upperEffectiveArea = Math.PI * (
    pistonRadius ** 2 - trunkOuterRadius ** 2
  );
  const equalForceHighToExpansivePressureRatio = lowerEffectiveArea
    / upperEffectiveArea;

  const stateAtCrankAngle = (
    crankAngle,
    crankSpeed = inputAngularSpeed,
    crankAcceleration = 0,
  ) => {
    const cosine = Math.cos(crankAngle);
    const sine = Math.sin(crankAngle);
    const underRoot = pitmanLength ** 2
      - crankRadius ** 2 * cosine ** 2;
    const rootDistance = Math.sqrt(underRoot);
    const sliderOffset = crankRadius * sine - rootDistance;
    const firstDerivative = crankRadius * cosine
      - crankRadius ** 2 * cosine * sine / rootDistance;
    const secondDerivative = -crankRadius * sine
      - crankRadius ** 2 * (
        (cosine ** 2 - sine ** 2) / rootDistance
          - crankRadius ** 2 * cosine ** 2 * sine ** 2
            / rootDistance ** 3
      );
    const pistonY = crankCenter.y + sliderOffset;
    const pistonSpeed = firstDerivative * crankSpeed;
    const pistonAcceleration = secondDerivative * crankSpeed ** 2
      + firstDerivative * crankAcceleration;
    const crankRadial = new THREE.Vector3(cosine, sine, 0);
    const crankTangent = new THREE.Vector3(-sine, cosine, 0);
    const crankPin = crankCenter.clone().addScaledVector(
      crankRadial,
      crankRadius,
    );
    const pistonPin = new THREE.Vector3(0, pistonY, crankCenter.z);
    const crankPinVelocity = crankTangent.clone().multiplyScalar(
      crankRadius * crankSpeed,
    );
    const crankPinAcceleration = crankTangent.clone().multiplyScalar(
      crankRadius * crankAcceleration,
    ).addScaledVector(
      crankRadial,
      -crankRadius * crankSpeed ** 2,
    );
    const pistonPinVelocity = new THREE.Vector3(0, pistonSpeed, 0);
    const pistonPinAcceleration = new THREE.Vector3(
      0,
      pistonAcceleration,
      0,
    );
    const pitmanVector = pistonPin.clone().sub(crankPin);
    const relativePinVelocity = pistonPinVelocity.clone()
      .sub(crankPinVelocity);
    const relativePinAcceleration = pistonPinAcceleration.clone()
      .sub(crankPinAcceleration);
    const upperChamberHeight = cylinderHeadY
      - pistonThickness / 2 - pistonY;
    const lowerChamberHeight = pistonY
      - pistonThickness / 2 - cylinderBottomY;
    return {
      crankAcceleration,
      crankAngle,
      crankPin,
      crankPinAcceleration,
      crankPinVelocity,
      crankSpeed,
      lowerChamberHeight,
      lowerChamberVolume: lowerEffectiveArea * lowerChamberHeight,
      lowerChamberVolumeRate: lowerEffectiveArea * pistonSpeed,
      pistonAcceleration,
      pistonPin,
      pistonPinAcceleration,
      pistonPinVelocity,
      pistonSpeed,
      pistonY,
      pitmanAccelerationConstraintResidual:
        relativePinVelocity.lengthSq()
          + pitmanVector.dot(relativePinAcceleration),
      pitmanLengthResidual: pitmanVector.length() - pitmanLength,
      pitmanVector,
      pitmanVelocityConstraintResidual:
        pitmanVector.dot(relativePinVelocity),
      relativePinAcceleration,
      relativePinVelocity,
      trunkBottomY: pistonY,
      trunkTopY: pistonY + trunkLength,
      upperChamberHeight,
      upperChamberVolume: upperEffectiveArea * upperChamberHeight,
      upperChamberVolumeRate: -upperEffectiveArea * pistonSpeed,
      combinedChamberVolumeRate:
        upperEffectiveArea * -pistonSpeed
          + lowerEffectiveArea * pistonSpeed,
      trunkDisplacementVolumeRateResidual:
        upperEffectiveArea * -pistonSpeed
          + lowerEffectiveArea * pistonSpeed
          - trunkCrossSectionArea * pistonSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtCrankAngle(
        sourceCrankAngle + inputAngularSpeed * cycleTime,
      ),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const bottomDeadCenter = stateAtCrankAngle(-Math.PI / 2);
  const topDeadCenter = stateAtCrankAngle(Math.PI / 2);
  const pistonStroke = topDeadCenter.pistonY - bottomDeadCenter.pistonY;
  const geometry = {
    crankCenter: crankCenter.clone(),
    crankRadius,
    cycleDuration,
    cylinderBottomY,
    cylinderHeadY,
    cylinderRadius,
    equalForceHighToExpansivePressureRatio,
    inputAngularSpeed,
    lowerEffectiveArea,
    pistonRadius,
    pistonMaximumY: topDeadCenter.pistonY,
    pistonMinimumY: bottomDeadCenter.pistonY,
    pistonStroke,
    pistonThickness,
    pitmanLength,
    sourceCrankAngle,
    trunkLength,
    trunkCrossSectionArea,
    trunkOuterRadius,
    upperEffectiveArea,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.23,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const pistonMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const pitmanMaterial = matte(PALETTE.accent, {
    metalness: 0.23,
    roughness: 0.43,
  });
  const shellMaterial = matte(0x6f7b7b, {
    metalness: 0.20,
    opacity: 0.34,
    roughness: 0.52,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const highSteamMaterial = matte(0xde6b52, {
    opacity: 0.16,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const expansiveSteamMaterial = matte(0x4a93a8, {
    opacity: 0.15,
    roughness: 0.64,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(3.36, 0.22, 1.92),
    frameMaterial,
  );
  foundation.position.set(0, -1.16, -0.20);
  foundation.userData.role = 'marine-trunk-engine-foundation';
  root.add(foundation);

  const fixedCylinder = new THREE.Group();
  fixedCylinder.userData.role = 'fixed-cutaway-steam-cylinder';
  const cylinderHeight = cylinderHeadY - cylinderBottomY;
  const backShell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderRadius,
      cylinderRadius,
      cylinderHeight,
      64,
      1,
      true,
      Math.PI / 2,
      Math.PI,
    ),
    shellMaterial,
  );
  backShell.position.set(
    0,
    (cylinderHeadY + cylinderBottomY) / 2,
    0,
  );
  backShell.userData.role = 'transparent-back-half-cylinder-wall';
  fixedCylinder.add(backShell);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, cylinderHeight, 1.58),
      frameMaterial,
    );
    wall.position.set(
      side * cylinderRadius,
      (cylinderHeadY + cylinderBottomY) / 2,
      -0.17,
    );
    wall.userData.role = 'sectioned-side-wall-of-cylinder';
    fixedCylinder.add(wall);
  }
  const lowerFlange = new THREE.Mesh(
    new THREE.BoxGeometry(2.84, 0.20, 1.92),
    frameMaterial,
  );
  lowerFlange.position.set(0, cylinderBottomY - 0.10, -0.10);
  lowerFlange.userData.role = 'lower-cylinder-flange';
  fixedCylinder.add(lowerFlange);
  for (const side of [-1, 1]) {
    const headHalf = new THREE.Mesh(
      new THREE.BoxGeometry(
        cylinderRadius - trunkOuterRadius - 0.07,
        0.22,
        1.92,
      ),
      frameMaterial,
    );
    headHalf.position.set(
      side * (cylinderRadius + trunkOuterRadius + 0.07) / 2,
      cylinderHeadY,
      -0.10,
    );
    headHalf.userData.role =
      'fixed-cylinder-head-half-around-trunk-opening';
    fixedCylinder.add(headHalf);
  }
  const stuffingBox = new THREE.Mesh(
    boredCylinderGeometry(0.68, trunkOuterRadius + 0.008, 0.22), darkMaterial,
  );
  stuffingBox.position.set(0, cylinderHeadY + 0.13, 0);
  stuffingBox.userData.role =
    'fixed-annular-stuffing-box-around-moving-trunk';
  fixedCylinder.add(stuffingBox);
  root.add(fixedCylinder);

  const rearCrankSupport = new THREE.Group();
  rearCrankSupport.userData.role = 'fixed-upper-crankshaft-support';
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 3.86, 0.24),
      frameMaterial,
    );
    post.position.set(side * 1.54, 0.80, -0.72);
    post.userData.role = 'rear-crankshaft-support-column';
    rearCrankSupport.add(post);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.18, 0.24),
      frameMaterial,
    );
    arm.position.set(side * 0.78, crankCenter.y, -0.72);
    arm.userData.role = 'rear-crankshaft-bearing-arm';
    rearCrankSupport.add(arm);
  }
  const crankAxle = cylinderAlongZ(0.12, 1.72, darkMaterial, 30);
  crankAxle.position.copy(crankCenter);
  crankAxle.position.z = -0.10;
  crankAxle.userData.role = 'fixed-horizontal-crankshaft-axis';
  rearCrankSupport.add(crankAxle);
  root.add(rearCrankSupport);

  const crankWheel = new THREE.Group();
  crankWheel.userData.rotor = new THREE.Group();
  crankWheel.add(crankWheel.userData.rotor);
  crankWheel.position.copy(crankCenter);
  crankWheel.userData.role = 'continuously-rotating-upper-crank';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.11, 0.19),
    pitmanMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, -0.20);
  crankArm.userData.role = 'crank-throw-to-pitman';
  crankWheel.userData.rotor.add(crankArm);
  const crankPinMarker = cylinderAlongZ(0.085, 0.43, whiteMaterial);
  crankPinMarker.position.set(crankRadius, 0, -0.12);
  crankPinMarker.userData.role = 'white-upper-crank-pin';
  crankWheel.userData.rotor.add(crankPinMarker);
  root.add(crankWheel);

  const pistonAndTrunk = new THREE.Group();
  pistonAndTrunk.userData.role =
    'single-translating-piston-and-attached-hollow-trunk';
  const piston = new THREE.Mesh(
    sectionedCylinder(pistonRadius, pistonThickness, 0.22),
    pistonMaterial,
  );
  piston.userData.role = 'vertical-sliding-piston';
  pistonAndTrunk.add(piston);
  for (const side of [-1, 1]) {
    const trunkSide = new THREE.Mesh(
      annularSector(0.40, trunkOuterRadius,
        (side < 0 ? Math.PI : 0) - 0.65, (side < 0 ? Math.PI : 0) + 0.65, trunkLength),
      pistonMaterial,
    );
    trunkSide.rotation.x = -Math.PI / 2;
    trunkSide.position.y = trunkLength / 2;
    trunkSide.userData.role =
      'cutaway-side-of-hollow-trunk-attached-to-piston';
    pistonAndTrunk.add(trunkSide);
  }
  const trunkBack = new THREE.Mesh(
    new THREE.CylinderGeometry(
      trunkOuterRadius - 0.05,
      trunkOuterRadius - 0.05,
      trunkLength,
      40,
      1,
      true,
      Math.PI / 2,
      Math.PI,
    ),
    shellMaterial,
  );
  trunkBack.position.set(0, trunkLength / 2, -0.03);
  trunkBack.userData.role = 'open-front-hollow-trunk-shell';
  pistonAndTrunk.add(trunkBack);
  const trunkTopRim = new THREE.Mesh(
    boredCylinderGeometry(trunkOuterRadius, trunkOuterRadius - 0.10, 0.07), pistonMaterial,
  );
  trunkTopRim.position.set(0, trunkLength, 0);
  trunkTopRim.userData.role = 'open-upper-rim-of-moving-trunk';
  pistonAndTrunk.add(trunkTopRim);
  const pistonPinMarker = cylinderAlongZ(0.085, 0.56, whiteMaterial, 28);
  pistonPinMarker.position.z = -0.18;
  pistonPinMarker.userData.role =
    'white-pitman-pin-directly-in-piston-at-trunk-bottom';
  pistonAndTrunk.add(pistonPinMarker);
  const pistonPinSeat = boredJournal(0.16, 0.088, 0.13, pistonMaterial);
  pistonPinSeat.position.z = -0.20;
  pistonPinSeat.userData.role = 'bored-rear-piston-pin-seat';
  pistonAndTrunk.add(pistonPinSeat);
  root.add(pistonAndTrunk);

  const pitman = engineRod(pitmanLength, 0.10, 0.145, 0.088, 0.12,
    pitmanMaterial, 'constant-length-pitman-entering-hollow-trunk');
  root.add(pitman);

  const upperSteam = new THREE.Mesh(
    boredCylinderGeometry(1.09, trunkOuterRadius + 0.015, 1),
    highSteamMaterial,
  );
  upperSteam.userData.role =
    'high-pressure-upper-annular-chamber-indicator';
  root.add(upperSteam);
  const lowerSteam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.90, 0.90, 1, 48),
    expansiveSteamMaterial,
  );
  lowerSteam.userData.role =
    'lower-expansive-exhaust-chamber-indicator';
  root.add(lowerSteam);

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(crankWheel, state.crankAngle);
    pistonAndTrunk.position.set(0, state.pistonY, crankCenter.z);
    pitman.userData.setEndpoints(
      state.crankPin.clone().setZ(0),
      state.pistonPin.clone().setZ(0),
    );
    upperSteam.position.set(
      0,
      state.pistonY + pistonThickness / 2
        + state.upperChamberHeight / 2,
      0,
    );
    upperSteam.scale.y = state.upperChamberHeight;
    lowerSteam.position.set(
      0,
      cylinderBottomY + state.lowerChamberHeight / 2,
      0,
    );
    lowerSteam.scale.y = state.lowerChamberHeight;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'vertical-in-line-trunk-engine-slider-crank-with-hollow-piston-trunk-through-head-stuffing-box-and-area-staged-steam',
    blocks: {
      backShell,
      crankArm,
      crankPinMarker,
      crankWheel,
      fixedCylinder,
      foundation,
      lowerSteam,
      piston,
      pistonAndTrunk,
      pistonPinMarker,
      pitman,
      rearCrankSupport,
      stuffingBox,
      trunkBack,
      trunkTopRim,
      upperSteam,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pistonPositionIndependent: false,
      pitmanAngleIndependent: false,
      trunkPositionIndependent: false,
    },
    dynamics: {
      connectingRodSideThrustBearingFrictionInertiaLeakageAndValveTimingModeled:
        false,
      effectiveAreasAndEqualForcePressureRatioModeled: true,
      expansiveThermodynamicPressureCurveModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A continuously rotating upper crank drives one exact in-line slider-crank pitman. The pitman descends inside the open-front hollow trunk and pins directly to the piston at the trunk’s lower end. Piston and trunk translate as one rigid member; the trunk passes through the fixed annular stuffing box in the cylinder head.',
    motion: {
      crankSpeed: inputAngularSpeed,
      cycleDuration,
      pistonStroke,
    },
    pressureStaging: {
      equalForceCondition:
        'highPressure*upperAnnularArea=expansivePressure*lowerFullArea',
      highPressureAdmissionSide: 'upper annular piston face',
      highToExpansivePressureRatio:
        equalForceHighToExpansivePressureRatio,
      lowerExpansiveSide: 'lower full piston face',
      lowerFullArea: lowerEffectiveArea,
      upperAnnularArea: upperEffectiveArea,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 421 page embeds a four-part Canvas construction showing a 1.5-radius upper crank, 7.45-length pitman, centerline piston pin, cutaway trunk, fixed head, and stuffing box. It was inspected for topology and relative proportions only.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      crankAngle: sourceState.crankAngle,
      crankPin: sourceState.crankPin.clone(),
      pistonPin: sourceState.pistonPin.clone(),
    },
    sourceReference: {
      brownPlate421: {
        crankApproximateCenterPixels: [262, 95],
        cylinderApproximateBoundsPixels: [125, 247, 403, 523],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        pistonPinApproximateCenterPixels: [264, 371],
        trunkApproximateBoundsPixels: [204, 246, 325, 398],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the engine is a marine trunk engine',
          'the trunk is attached to the piston',
          'the pitman connects at the trunk’s lower end directly with the piston',
          'the trunk passes through a stuffing box in the cylinder head',
          'the trunk reduces the effective upper piston area',
          'high-pressure steam first acts above the piston',
          'that steam is exhausted below and used expansively',
        ],
        engravingEvidence:
          'Brown’s cutaway plate shows the crank above the cylinder, an oblique pitman entering a wide open trunk, its lower pin centered directly in the piston, and the trunk sliding through an annular head gland.',
        officialCanvasEvidence:
          'The official embedded construction uses a 1.5-unit crank throw, a 7.45-unit pitman, one vertical centerline slider, a three-unit-wide cutaway trunk, and a four-second display cycle at 15 cycles per minute.',
        reconstructionDisclosure:
          'Brown gives no absolute dimensions, crank speed, piston and trunk diameters, clearance volumes, pressures, cutoff, valve timing, materials, or loads. The scaled geometry, exact analytic slider law, cutaway shell, chamber-volume indicators, effective-area calculation, supports, and display timing are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 421',
    },
    stateAtCrankAngle,
    stateAtTime,
    transmission: {
      pistonGuide: 'pistonPin=(0,pistonY)',
      pitmanConstraint: '|pistonPin-crankPin|=pitmanLength',
      sliderLaw:
        'pistonY=crankCenterY+r*sin(theta)-sqrt(L^2-r^2*cos(theta)^2)',
      trunkConstraint: 'trunkBottomY=pistonY; trunkTopY=pistonY+trunkLength',
    },
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.8, 0.4, 14);
  markShadows(root);
  foundation.receiveShadow = true;
  root.userData.cameraFov = 8;
  fitPistonGuide(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredTrunkEngineMovement(movement) {
  if (movement.id !== 421) return null;
  return trunkEngine(movement);
}
