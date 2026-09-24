import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { boredJournal, fitPistonGuide } from './piston-guide-parts.js';
import { annularSector } from './steam-engine-parts.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeTubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 4, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function sectorPistonEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const rockshaftCenter = new THREE.Vector3(0, -1.18, 0.30);
  const pistonCenterAngle = Math.PI / 2;
  const officialRightPose = Math.atan2(4.602524, 1.953656);
  const pistonAngularAmplitude = pistonCenterAngle - officialRightPose;
  const sectorHalfAngle = (2.012233 - 1.12936) / 2;
  const sectorRightAngle = pistonCenterAngle - sectorHalfAngle;
  const sectorLeftAngle = pistonCenterAngle + sectorHalfAngle;
  const innerCylinderRadius = 0.42;
  const outerCylinderRadius = 2.31;
  const pistonSealRadius = 2.30;
  const radialSealClearance = outerCylinderRadius - pistonSealRadius;
  const angularEndClearance = sectorHalfAngle - pistonAngularAmplitude;
  const pistonVaneInnerRadius = 0.26;
  const pistonVaneLength = pistonSealRadius - pistonVaneInnerRadius;
  const valveTravelAmplitude = 0.30;
  const valveCenter = new THREE.Vector3(0, 1.96, 0.34);
  const outputCrankRadius = 0.72;
  const outputCrankOffset = -Math.PI / 2;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const cosine = Math.cos(inputAngle);
    const sine = Math.sin(inputAngle);
    const pistonAngle = pistonCenterAngle
      - pistonAngularAmplitude * cosine;
    const pistonAngularSpeed = pistonAngularAmplitude
      * sine * inputSpeed;
    const pistonAngularAcceleration = pistonAngularAmplitude * (
      cosine * inputSpeed ** 2 + sine * inputAcceleration
    );
    const pistonRadial = new THREE.Vector3(
      Math.cos(pistonAngle),
      Math.sin(pistonAngle),
      0,
    );
    const pistonTangent = new THREE.Vector3(
      -pistonRadial.y,
      pistonRadial.x,
      0,
    );
    const pistonTip = rockshaftCenter.clone().addScaledVector(
      pistonRadial,
      pistonSealRadius,
    );
    const pistonTipVelocity = pistonTangent.clone().multiplyScalar(
      pistonSealRadius * pistonAngularSpeed,
    );
    const pistonTipAcceleration = pistonTangent.clone().multiplyScalar(
      pistonSealRadius * pistonAngularAcceleration,
    ).addScaledVector(
      pistonRadial,
      -pistonSealRadius * pistonAngularSpeed ** 2,
    );
    const valveX = -valveTravelAmplitude * sine;
    const valveSpeed = -valveTravelAmplitude * cosine * inputSpeed;
    const valveAcceleration = valveTravelAmplitude * (
      sine * inputSpeed ** 2 - cosine * inputAcceleration
    );
    const clockwisePortOpening = Math.max(0, sine);
    const counterclockwisePortOpening = Math.max(0, -sine);
    const outputCrankAngle = pistonAngle + outputCrankOffset;
    const outputCrankPin = rockshaftCenter.clone().add(
      new THREE.Vector3(
        outputCrankRadius * Math.cos(outputCrankAngle),
        outputCrankRadius * Math.sin(outputCrankAngle),
        0,
      ),
    );
    return {
      admissionSide: pistonAngularSpeed > 1e-10
        ? 'clockwise-side-of-B'
        : pistonAngularSpeed < -1e-10
          ? 'counterclockwise-side-of-B'
          : 'valve-lap-at-reversal',
      angularLeftClearance: sectorLeftAngle - pistonAngle,
      angularRightClearance: pistonAngle - sectorRightAngle,
      clockwisePortOpening,
      counterclockwisePortOpening,
      exhaustSide: pistonAngularSpeed > 1e-10
        ? 'counterclockwise-side-of-B'
        : pistonAngularSpeed < -1e-10
          ? 'clockwise-side-of-B'
          : 'both-ports-lapped-at-reversal',
      inputAcceleration,
      inputAngle,
      inputSpeed,
      outputCrankAngle,
      outputCrankAngularAcceleration: pistonAngularAcceleration,
      outputCrankAngularSpeed: pistonAngularSpeed,
      outputCrankPin,
      pistonAngle,
      pistonAngularAcceleration,
      pistonAngularSpeed,
      pistonRadial,
      pistonTangent,
      pistonTip,
      pistonTipAcceleration,
      pistonTipVelocity,
      portOpeningSum: clockwisePortOpening + counterclockwisePortOpening,
      radialSealClearance,
      valveAcceleration,
      valvePhaseConstraintResidual:
        valveX + valveTravelAmplitude * sine,
      valveSpeed,
      valveX,
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
    angularEndClearance,
    cycleDuration,
    innerCylinderRadius,
    inputAngularSpeed,
    outerCylinderRadius,
    outputCrankOffset,
    outputCrankRadius,
    pistonAngularAmplitude,
    pistonAngularStroke: pistonAngularAmplitude * 2,
    pistonCenterAngle,
    pistonSealRadius,
    pistonVaneInnerRadius,
    pistonVaneLength,
    radialSealClearance,
    rockshaftCenter: rockshaftCenter.clone(),
    sectorHalfAngle,
    sectorLeftAngle,
    sectorRightAngle,
    valveCenter: valveCenter.clone(),
    valveTravelAmplitude,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const valveMaterial = matte(PALETTE.driven, {
    metalness: 0.23,
    roughness: 0.45,
  });
  const steamMaterial = matte(0xd47b61, {
    opacity: 0.18,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const exhaustMaterial = matte(0x4a93a8, {
    opacity: 0.15,
    roughness: 0.64,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(5.50, 0.25, 1.82),
    frameMaterial,
  );
  foundation.position.set(0, -1.70, -0.22);
  foundation.userData.role = 'fixed-foundation-of-sector-cylinder-A';
  root.add(foundation);

  const cylinderA = new THREE.Group();
  cylinderA.position.copy(rockshaftCenter);
  cylinderA.userData.role = 'fixed-annular-sector-cylinder-A';
  const sectorBack = new THREE.Mesh(
    new THREE.RingGeometry(
      innerCylinderRadius,
      outerCylinderRadius,
      72,
      1,
      sectorRightAngle,
      sectorLeftAngle - sectorRightAngle,
    ),
    steamMaterial,
  );
  sectorBack.position.z = -0.36;
  sectorBack.userData.role = 'cutaway-back-of-sector-steam-space';
  cylinderA.add(sectorBack);
  const innerArc = boredJournal(0.42, 0.282, 0.30, frameMaterial);
  innerArc.position.z = -0.55;
  innerArc.userData.role = 'inner-curved-wall-of-sector-cylinder-A';
  const outerArc = new THREE.Mesh(annularSector(2.31, 2.50,
    sectorRightAngle - 0.0125, sectorLeftAngle + 0.0125, 0.68), frameMaterial);
  outerArc.userData.role = 'outer-curved-wall-of-sector-cylinder-A';
  cylinderA.add(innerArc, outerArc);
  for (const [angle, role] of [
    [sectorRightAngle, 'clockwise-end-wall-of-sector-cylinder-A'],
    [sectorLeftAngle, 'counterclockwise-end-wall-of-sector-cylinder-A'],
  ]) {
    const wall = new THREE.Mesh(annularSector(0.40, 2.50,
      angle - 0.0125, angle + 0.0125, 1.04), frameMaterial);
    wall.position.z = -0.18;
    wall.userData.role = role;
    cylinderA.add(wall);
  }
  const bearingFoot = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.30), frameMaterial);
  bearingFoot.position.set(0, -0.48, -0.55);
  cylinderA.add(bearingFoot);
  root.add(cylinderA);

  const rockshaftRotor = new THREE.Group();
  rockshaftRotor.position.copy(rockshaftCenter);
  rockshaftRotor.userData.role =
    'rock-shaft-C-with-rigid-sector-piston-B';
  const pistonVane = new THREE.Mesh(
    annularSector(0.26, pistonSealRadius - 0.08, -0.018, 0.018, 0.61),
    pistonMaterial,
  );

  pistonVane.userData.role = 'radial-oscillating-piston-B';
  rockshaftRotor.add(pistonVane);
  const pistonSeal = new THREE.Mesh(
    annularSector(2.13, pistonSealRadius, -0.018, 0.018, 0.61),
    pistonMaterial,
  );

  pistonSeal.userData.role = 'outer-sealing-head-of-piston-B';
  rockshaftRotor.add(pistonSeal);
  const shaftC = cylinderAlongZ(0.28, 1.28, darkMaterial, 40);
  shaftC.position.z = 0.02;
  shaftC.userData.role = 'fixed-axis-rock-shaft-C';
  rockshaftRotor.add(shaftC);
  const outputCrankArm = new THREE.Mesh(
    new THREE.BoxGeometry(outputCrankRadius, 0.12, 0.18),
    valveMaterial,
  );
  outputCrankArm.position.set(0, -outputCrankRadius / 2, 0.52);
  outputCrankArm.rotation.z = -Math.PI / 2;
  outputCrankArm.userData.role =
    'output-crank-on-C-for-connection-to-rotary-train';
  rockshaftRotor.add(outputCrankArm);
  const outputCrankPin = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 18),
    whiteMaterial,
  );
  outputCrankPin.position.set(0, -outputCrankRadius, 0.52);
  outputCrankPin.userData.role = 'white-output-crank-pin-on-C';
  rockshaftRotor.add(outputCrankPin);
  root.add(rockshaftRotor);

  const fixedValveChest = new THREE.Group();
  fixedValveChest.userData.role = 'fixed-slide-valve-chest-above-A';
  const chest = new THREE.Mesh(plate(polygonClipping.difference(
    poly([[-0.90, -0.40], [0.90, -0.40], [0.90, 0.40], [-0.90, 0.40]]),
    poly([[-0.70, -0.21], [0.70, -0.21], [0.70, 0.21], [-0.70, 0.21]]),
    poly([[0.69, -0.055], [0.91, -0.055], [0.91, 0.055], [0.69, 0.055]])
  ), -0.38, 0.38), frameMaterial);
  chest.position.copy(valveCenter);
  chest.userData.role = 'fixed-valve-D-chest';
  fixedValveChest.add(chest);
  const valveGuide = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.08, 0.72), darkMaterial);
  valveGuide.position.copy(valveCenter).add(new THREE.Vector3(0, -0.25, 0));
  valveGuide.userData.role = 'horizontal-guide-for-slide-valve-D';
  fixedValveChest.add(valveGuide);
  root.add(fixedValveChest);

  const slideValveD = new THREE.Group();
  slideValveD.position.copy(valveCenter);
  slideValveD.userData.role =
    'horizontally-reciprocating-slide-valve-D';
  const valveBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.34, 0.66),
    valveMaterial,
  );
  valveBlock.userData.role = 'working-block-of-slide-valve-D';
  slideValveD.add(valveBlock);
  const valveStem = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.10, 0.14),
    valveMaterial,
  );
  valveStem.position.x = 1.15;
  valveStem.userData.role = 'external-stem-of-slide-valve-D';
  slideValveD.add(valveStem);
  const valveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.40, 0.70),
    whiteMaterial,
  );
  valveIndex.userData.role = 'white-valve-D-position-index';
  slideValveD.add(valveIndex);
  root.add(slideValveD);

  const rightPortPoint = rockshaftCenter.clone().add(
    new THREE.Vector3(
      outerCylinderRadius * Math.cos(sectorRightAngle),
      outerCylinderRadius * Math.sin(sectorRightAngle),
      0.04,
    ),
  );
  const leftPortPoint = rockshaftCenter.clone().add(
    new THREE.Vector3(
      outerCylinderRadius * Math.cos(sectorLeftAngle),
      outerCylinderRadius * Math.sin(sectorLeftAngle),
      0.04,
    ),
  );
  const rightPassage = makeTubeThrough([
    rightPortPoint,
    rightPortPoint.clone().add(new THREE.Vector3(0.28, 0.32, 0)),
    new THREE.Vector3(0.48, 1.65, 0.04),
    new THREE.Vector3(0.40, valveCenter.y - 0.30, 0.04),
  ], 0.075, frameMaterial, 'clockwise-steam-passage-from-D-to-A');
  const leftPassage = makeTubeThrough([
    leftPortPoint,
    leftPortPoint.clone().add(new THREE.Vector3(-0.28, 0.32, 0)),
    new THREE.Vector3(-0.48, 1.65, 0.04),
    new THREE.Vector3(-0.40, valveCenter.y - 0.30, 0.04),
  ], 0.075, frameMaterial, 'counterclockwise-steam-passage-from-D-to-A');
  root.add(rightPassage, leftPassage);

  // Brown's cast casing A: a vase-shaped wall standing off the sector's end
  // walls (the side passages lie between), shouldered into the valve chest
  // and flanged into a foot round the boss of C.
  const casingSide = (points) => [...points, ...points.slice().reverse().map(([x, y]) => [-x, y])];
  const wallPoint = (r, offset) => {
    const a = sectorHalfAngle;
    return [offset * Math.cos(a) + r * Math.sin(a),
      rockshaftCenter.y - offset * Math.sin(a) + r * Math.cos(a)];
  };
  const casingOuter = casingSide([
    [1.30, -1.84], [1.30, -1.52], [0.74, -1.52], [0.66, -1.22],
    wallPoint(0.75, 0.47), wallPoint(1.6, 0.47), wallPoint(2.4, 0.47),
    [1.52, 1.10], [1.40, 1.40], [1.08, 1.56], [0.90, 1.56],
  ].reverse());
  const casingInner = casingSide([
    [0.50, -0.86], wallPoint(0.95, 0.34), wallPoint(1.6, 0.34), wallPoint(2.4, 0.34),
    [1.39, 1.09], [1.29, 1.33], [1.00, 1.46], [0.30, 1.46],
  ].reverse());
  const casingA = new THREE.Mesh(plate(polygonClipping.difference(
    poly(casingOuter), poly(casingInner),
    poly(circle([rockshaftCenter.x, rockshaftCenter.y], 0.40, 96)),
  ), -0.04, 0.64), frameMaterial);
  casingA.userData.role = 'cast-vase-casing-of-sector-cylinder-A-with-foot';
  root.add(casingA);

  const clockwiseAdmissionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 22, 16),
    steamMaterial,
  );
  clockwiseAdmissionIndicator.position.copy(rightPortPoint);
  clockwiseAdmissionIndicator.userData.role =
    'clockwise-chamber-admission-indicator';
  root.add(clockwiseAdmissionIndicator);
  const counterclockwiseAdmissionIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 22, 16),
    exhaustMaterial,
  );
  counterclockwiseAdmissionIndicator.position.copy(leftPortPoint);
  counterclockwiseAdmissionIndicator.userData.role =
    'counterclockwise-chamber-admission-indicator';
  root.add(counterclockwiseAdmissionIndicator);

  const update = (time) => {
    const state = stateAtTime(time);
    rockshaftRotor.rotation.z = state.pistonAngle;
    slideValveD.position.x = valveCenter.x + state.valveX;
    clockwiseAdmissionIndicator.scale.setScalar(
      0.55 + 0.75 * state.clockwisePortOpening,
    );
    counterclockwiseAdmissionIndicator.scale.setScalar(
      0.55 + 0.75 * state.counterclockwisePortOpening,
    );
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'fixed-annular-sector-cylinder-with-radial-vane-piston-keyed-to-rockshaft-and-quadrature-slide-valve',
    blocks: {
      clockwiseAdmissionIndicator,
      counterclockwiseAdmissionIndicator,
      cylinderA,
      fixedValveChest,
      foundation,
      innerArc,
      leftPassage,
      outerArc,
      outputCrankArm,
      outputCrankPin,
      pistonSeal,
      pistonVane,
      rightPassage,
      rockshaftRotor,
      sectorBack,
      shaftC,
      slideValveD,
      valveBlock,
      valveStem,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pistonAngleIndependent: false,
      slideValvePositionIndependent: false,
    },
    dynamics: {
      downstreamCrankLinkAndFlywheelModeled: false,
      pressureExpansionLeakageFrictionInertiaAndValveLapModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsPressuresOrLoads: false,
      valveIndicators:
        'port spheres show which chamber is admitted; they are not pressure or mass-flow solutions',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Fixed cylinder A is an annular sector centered on rock-shaft C. Radial vane piston B is rigidly keyed to C and oscillates between the sector end walls with constant radial seal clearance. Horizontal slide-valve D runs in exact quadrature with B’s displacement so alternate ports admit steam on the side that drives each half-stroke. The visible crank on C rocks with the shaft; Brown’s undrawn downstream rotary linkage is not invented.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      pistonAngularStroke: pistonAngularAmplitude * 2,
      valveStroke: valveTravelAmplitude * 2,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 422 page embeds a three-part Canvas construction showing fixed sector A, B/C rocking from approximately 67 to 113 degrees, and horizontal D moving one quarter-cycle ahead. It was inspected for topology, phase, and relative proportions only.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      pistonAngle: sourceState.pistonAngle,
      pistonTip: sourceState.pistonTip.clone(),
      valveX: sourceState.valveX,
    },
    sourceReference: {
      brownPlate422: {
        cylinderAApproximateBoundsPixels: [122, 145, 405, 487],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        pistonBApproximateBoundsPixels: [250, 205, 282, 421],
        rockshaftCApproximateCenterPixels: [264, 440],
        slideValveDApproximateBoundsPixels: [212, 87, 415, 174],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A has the profile of a sector',
          'B is the oscillating piston',
          'B is attached to rock-shaft C',
          'steam acts alternately on the two sides of B',
          'D is a slide valve like that of a reciprocating engine',
          'C is connected with a crank to produce rotary motion',
        ],
        engravingEvidence:
          'Brown’s cutaway plate shows a fixed curved sector chamber A, a thin radial vane B rising from the bottom rock-shaft C, two passages from the chamber ends, and horizontal slide-valve D in the chest above.',
        officialCanvasEvidence:
          'The official embedded construction places B at endpoint vectors (1.953656,4.602524) and (-1.953656,4.602524), bounds A by approximately 64.7 and 115.3 degrees, gives D 0.6 unit total travel, and phases D one quarter-cycle ahead of B displacement.',
        reconstructionDisclosure:
          'Brown gives no absolute dimensions, vane thickness, sealing clearances, port areas, pressure cycle, crank linkage geometry, speed, materials, or loads. The scaled annular-sector cutaway, harmonic law corroborated by the official model, port indicators, output crank stub, supports, and four-second display cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 422',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      pistonLaw:
        'pistonAngle=pi/2-amplitude*cos(inputAngle)',
      rigidKeying:
        'outputCrankAngle=pistonAngle+fixedOffset',
      valveLaw:
        'valveX=-valveAmplitude*sin(inputAngle)',
      valvePhase:
        'D displacement is in quadrature with B displacement and changes sign with B velocity',
    },
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.8, 0.3, 14);
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

export function createAuthoredSectorPistonEngineMovement(movement) {
  if (movement.id !== 422) return null;
  return sectorPistonEngine(movement);
}
