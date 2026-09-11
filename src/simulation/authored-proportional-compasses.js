import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, depth, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamAlongY(startY, endY, width, depth, material) {
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(width, Math.abs(endY - startY), depth),
    material,
  );
  beam.position.y = (startY + endY) / 2;
  return beam;
}

function pointedPlate(baseY, tipY, baseWidth, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-baseWidth / 2, baseY);
  shape.lineTo(baseWidth / 2, baseY);
  shape.lineTo(0, tipY);
  shape.closePath();
  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.025,
      bevelThickness: 0.018,
      curveSegments: 12,
      depth,
      steps: 1,
    }),
    material,
  );
  plate.position.z = -depth / 2;
  return plate;
}

function makeLeg({
  accentMaterial,
  bodyMaterial,
  darkMaterial,
  geometry,
  name,
  paperMaterial,
  planeZ,
  scaleMaterial,
  showScale,
}) {
  const group = new THREE.Group();
  group.position.z = planeZ;
  group.userData.role = `${name}-single-rigid-double-ended-compass-leg`;
  const bodyDepth = geometry.legDepth;
  const upperBossY = geometry.shortArmLength - 0.53;
  const lowerBossY = -0.88;
  const lowerPointBaseY = -geometry.longArmLength + 0.83;

  const spine = beamAlongY(
    lowerPointBaseY,
    upperBossY,
    geometry.legWidth,
    bodyDepth,
    bodyMaterial,
  );
  spine.userData.role = `${name}-longitudinal-slotted-leg-body`;
  group.add(spine);

  const upperBoss = cylinderAlongZ(
    geometry.bossRadius,
    bodyDepth + 0.02,
    bodyMaterial,
    42,
  );
  upperBoss.position.set(0, upperBossY, 0);
  upperBoss.userData.role = `${name}-short-arm-rounded-slot-end`;
  group.add(upperBoss);
  const upperPoint = pointedPlate(
    upperBossY + 0.03,
    geometry.shortArmLength,
    geometry.legWidth * 0.82,
    bodyDepth,
    bodyMaterial,
  );
  upperPoint.userData.role = `${name}-short-arm-sharp-point`;
  group.add(upperPoint);

  const lowerBoss = cylinderAlongZ(
    geometry.bossRadius * 1.03,
    bodyDepth + 0.02,
    bodyMaterial,
    42,
  );
  lowerBoss.position.set(0, lowerBossY, 0);
  lowerBoss.userData.role = `${name}-long-arm-rounded-shoulder`;
  group.add(lowerBoss);
  const lowerGrip = beamAlongY(
    lowerPointBaseY,
    lowerBossY,
    geometry.legWidth * 0.78,
    bodyDepth,
    bodyMaterial,
  );
  lowerGrip.userData.role = `${name}-long-arm-scalloped-grip`;
  group.add(lowerGrip);
  const scallops = [];
  for (let index = 0; index < 3; index += 1) {
    const y = THREE.MathUtils.lerp(
      lowerBossY - 0.23,
      lowerPointBaseY + 0.18,
      index / 2,
    );
    for (const side of [-1, 1]) {
      const scallop = cylinderAlongZ(
        0.105,
        bodyDepth + 0.025,
        bodyMaterial,
        24,
      );
      scallop.position.set(
        side * geometry.legWidth * 0.34,
        y,
        0,
      );
      scallop.userData.role = `${name}-grip-scallop-${index + 1}`;
      group.add(scallop);
      scallops.push(scallop);
    }
  }
  const lowerPoint = pointedPlate(
    lowerPointBaseY,
    -geometry.longArmLength,
    geometry.legWidth * 0.60,
    bodyDepth,
    bodyMaterial,
  );
  lowerPoint.userData.role = `${name}-long-arm-sharp-point`;
  group.add(lowerPoint);

  const slotStartY = geometry.slotMinimumCoordinate;
  const slotEndY = geometry.slotMaximumCoordinate;
  const slot = beamAlongY(
    slotStartY,
    slotEndY,
    geometry.slotWidth,
    0.026,
    darkMaterial,
  );
  slot.position.z = bodyDepth / 2 + 0.018;
  slot.userData.role = `${name}-longitudinal-pivot-adjustment-slot`;
  group.add(slot);
  const slotInterior = beamAlongY(
    slotStartY + 0.015,
    slotEndY - 0.015,
    geometry.slotWidth * 0.48,
    0.030,
    paperMaterial,
  );
  slotInterior.position.z = bodyDepth / 2 + 0.034;
  slotInterior.userData.role = `${name}-visible-slot-opening`;
  group.add(slotInterior);
  const slotEnds = [slotStartY, slotEndY].map((y, index) => {
    const rim = cylinderAlongZ(
      geometry.slotWidth / 2,
      0.029,
      darkMaterial,
      24,
    );
    rim.position.set(0, y, bodyDepth / 2 + 0.019);
    rim.userData.role = `${name}-slot-rounded-end-${index + 1}`;
    const opening = cylinderAlongZ(
      geometry.slotWidth * 0.24,
      0.032,
      paperMaterial,
      22,
    );
    opening.position.set(0, y, bodyDepth / 2 + 0.036);
    opening.userData.role = `${name}-slot-end-opening-${index + 1}`;
    group.add(rim, opening);
    return { opening, rim };
  });

  const scaleTicks = [];
  if (showScale) {
    for (const entry of geometry.scaleCalibration) {
      const major = Number.isInteger(entry.ratio * 2);
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(
          major ? 0.21 : 0.15,
          0.030,
          0.030,
        ),
        scaleMaterial,
      );
      tick.position.set(
        -geometry.legWidth / 2 + (major ? 0.12 : 0.09),
        entry.localCoordinate,
        bodyDepth / 2 + 0.052,
      );
      tick.userData.role = major
        ? 'major-proportion-scale-graduation'
        : 'minor-proportion-scale-graduation';
      tick.userData.ratio = entry.ratio;
      tick.userData.pivotFromShortPoint = entry.pivotFromShortPoint;
      group.add(tick);
      scaleTicks.push(tick);
    }
    const selectedIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.050, 16, 12),
      accentMaterial,
    );
    selectedIndex.position.set(
      -geometry.legWidth * 0.37,
      0,
      bodyDepth / 2 + 0.075,
    );
    selectedIndex.userData.role =
      'locked-pivot-index-at-selected-proportion';
    group.add(selectedIndex);
  }

  const pivotShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      geometry.legWidth + 0.16,
      0.50,
      0.075,
    ),
    accentMaterial,
  );
  pivotShoe.position.z = bodyDepth / 2 + 0.085;
  pivotShoe.userData.role =
    `${name}-pivot-slide-locked-in-longitudinal-slot`;
  group.add(pivotShoe);

  const shortTipIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    paperMaterial,
  );
  shortTipIndex.position.set(
    0,
    geometry.shortArmLength,
    bodyDepth / 2 + 0.035,
  );
  shortTipIndex.userData.role = `${name}-short-point-contact-index`;
  group.add(shortTipIndex);
  const longTipIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    paperMaterial,
  );
  longTipIndex.position.set(
    0,
    -geometry.longArmLength,
    bodyDepth / 2 + 0.035,
  );
  longTipIndex.userData.role = `${name}-long-point-contact-index`;
  group.add(longTipIndex);

  return {
    group,
    lowerBoss,
    lowerGrip,
    lowerPoint,
    longTipIndex,
    pivotShoe,
    scaleTicks,
    scallops,
    shortTipIndex,
    slot,
    slotEnds,
    slotInterior,
    spine,
    upperBoss,
    upperPoint,
  };
}

function proportionalCompasses(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6.8;
  const shortArmLength = 2.00;
  const longArmLength = 2.55;
  const totalPointLength = shortArmLength + longArmLength;
  const selectedScaleRatio = longArmLength / shortArmLength;
  const minimumHalfOpeningAngle = 0.20;
  const maximumHalfOpeningAngle = 0.535;
  const meanHalfOpeningAngle = (
    minimumHalfOpeningAngle + maximumHalfOpeningAngle
  ) / 2;
  const halfOpeningAmplitude = (
    maximumHalfOpeningAngle - minimumHalfOpeningAngle
  ) / 2;
  const legWidth = 0.46;
  const legDepth = 0.14;
  const bossRadius = 0.31;
  const slotWidth = 0.17;
  const slotMinimumCoordinate = -0.72;
  const slotMaximumCoordinate = 1.37;
  const scaleRatios = [1, 1.125, 1.25, 1.275, 1.5, 1.75, 2, 2.5];
  const scaleCalibration = scaleRatios.map((ratio) => {
    const pivotFromShortPoint = totalPointLength / (ratio + 1);
    return {
      localCoordinate: shortArmLength - pivotFromShortPoint,
      pivotFromShortPoint,
      ratio,
    };
  });
  const geometry = {
    bossRadius,
    cycleDuration,
    halfOpeningAmplitude,
    legDepth,
    legWidth,
    longArmLength,
    maximumHalfOpeningAngle,
    meanHalfOpeningAngle,
    minimumHalfOpeningAngle,
    pivotFromLongPoint: longArmLength,
    pivotFromShortPoint: shortArmLength,
    scaleCalibration,
    scaleRatios,
    selectedScaleRatio,
    shortArmLength,
    slotMaximumCoordinate,
    slotMinimumCoordinate,
    slotWidth,
    totalPointLength,
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.43,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.24,
    roughness: 0.46,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });
  const boardMaterial = matte(0xdcdad4, {
    metalness: 0.01,
    roughness: 0.94,
  });

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(4.55, 5.34, 0.14),
    boardMaterial,
  );
  board.position.z = -0.30;
  board.userData.role = 'fixed-flat-drawing-board-behind-compasses';
  root.add(board);
  const boardBorder = new THREE.Group();
  boardBorder.userData.role = 'fixed-drawing-board-border';
  for (const x of [-2.32, 2.32]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 5.45, 0.19),
      darkMaterial,
    );
    rail.position.set(x, 0, -0.25);
    boardBorder.add(rail);
  }
  for (const y of [-2.72, 2.72]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(4.73, 0.09, 0.19),
      darkMaterial,
    );
    rail.position.set(0, y, -0.25);
    boardBorder.add(rail);
  }
  root.add(boardBorder);

  const legA = makeLeg({
    accentMaterial,
    bodyMaterial: drivenMaterial,
    darkMaterial,
    geometry,
    name: 'left-upper-right-lower',
    paperMaterial: whiteMaterial,
    planeZ: 0.06,
    scaleMaterial: whiteMaterial,
    showScale: true,
  });
  const legB = makeLeg({
    accentMaterial,
    bodyMaterial: driverMaterial,
    darkMaterial,
    geometry,
    name: 'right-upper-left-lower',
    paperMaterial: whiteMaterial,
    planeZ: -0.12,
    scaleMaterial: whiteMaterial,
    showScale: false,
  });
  root.add(legB.group, legA.group);

  const pivotAssembly = new THREE.Group();
  pivotAssembly.position.z = 0.29;
  pivotAssembly.userData.role =
    'common-adjustable-pivot-slide-and-set-screw';
  const lowerPivotWasher = cylinderAlongZ(
    0.48,
    0.15,
    darkMaterial,
    52,
  );
  lowerPivotWasher.userData.role = 'pivot-slide-outer-retaining-washer';
  const pivotCollar = cylinderAlongZ(
    0.39,
    0.20,
    accentMaterial,
    48,
  );
  pivotCollar.position.z = 0.085;
  pivotCollar.userData.role =
    'set-screw-collar-locking-pivot-position-in-both-slots';
  const pivotAxle = cylinderAlongZ(0.22, 0.36, darkMaterial, 40);
  pivotAxle.position.z = 0.14;
  pivotAxle.userData.role =
    'common-pivot-axis-allowing-relative-leg-rotation';
  const setScrewHead = cylinderAlongZ(
    0.29,
    0.12,
    whiteMaterial,
    38,
  );
  setScrewHead.position.z = 0.35;
  setScrewHead.userData.role =
    'visible-set-screw-head-clamping-selected-proportion';
  const setScrewSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.048, 0.025),
    darkMaterial,
  );
  setScrewSlot.position.z = 0.425;
  setScrewSlot.rotation.z = 0.34;
  setScrewSlot.userData.role = 'set-screw-driver-slot';
  const pivotIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  pivotIndex.position.set(0, 0, 0.45);
  pivotIndex.userData.role = 'white-common-pivot-center-index';
  pivotAssembly.add(
    lowerPivotWasher,
    pivotCollar,
    pivotAxle,
    setScrewHead,
    setScrewSlot,
    pivotIndex,
  );
  root.add(pivotAssembly);

  const upperSpanWitness = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.025, 0.018),
    whiteMaterial,
  );
  upperSpanWitness.position.z = -0.19;
  upperSpanWitness.userData.role =
    'nonphysical-short-pair-dimension-witness';
  const lowerSpanWitness = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.025, 0.018),
    accentMaterial,
  );
  lowerSpanWitness.position.z = -0.19;
  lowerSpanWitness.userData.role =
    'nonphysical-long-pair-transferred-dimension-witness';
  root.add(upperSpanWitness, lowerSpanWitness);

  const rotateLocal = (point, angle) => point.clone().rotateAround(
    new THREE.Vector2(0, 0),
    angle,
  );
  const pointKinematics = (
    localPoint,
    angle,
    angularSpeed,
    angularAcceleration,
  ) => {
    const position = rotateLocal(localPoint, angle);
    const perpendicular = new THREE.Vector2(-position.y, position.x);
    return {
      acceleration: perpendicular.clone().multiplyScalar(angularAcceleration)
        .addScaledVector(position, -(angularSpeed ** 2)),
      position,
      velocity: perpendicular.multiplyScalar(angularSpeed),
    };
  };
  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const phaseAngle = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / cycleDuration;
    const halfOpeningAngle = meanHalfOpeningAngle
      + halfOpeningAmplitude * Math.cos(phaseAngle);
    const halfOpeningAngularSpeed = -halfOpeningAmplitude
      * angularFrequency * Math.sin(phaseAngle);
    const halfOpeningAngularAcceleration = -halfOpeningAmplitude
      * angularFrequency ** 2 * Math.cos(phaseAngle);
    const legAAngle = halfOpeningAngle;
    const legBAngle = -halfOpeningAngle;
    const legAAngularSpeed = halfOpeningAngularSpeed;
    const legBAngularSpeed = -halfOpeningAngularSpeed;
    const legAAngularAcceleration = halfOpeningAngularAcceleration;
    const legBAngularAcceleration = -halfOpeningAngularAcceleration;
    const upperLocal = new THREE.Vector2(0, shortArmLength);
    const lowerLocal = new THREE.Vector2(0, -longArmLength);
    const upperLeft = pointKinematics(
      upperLocal,
      legAAngle,
      legAAngularSpeed,
      legAAngularAcceleration,
    );
    const upperRight = pointKinematics(
      upperLocal,
      legBAngle,
      legBAngularSpeed,
      legBAngularAcceleration,
    );
    const lowerRight = pointKinematics(
      lowerLocal,
      legAAngle,
      legAAngularSpeed,
      legAAngularAcceleration,
    );
    const lowerLeft = pointKinematics(
      lowerLocal,
      legBAngle,
      legBAngularSpeed,
      legBAngularAcceleration,
    );
    const upperSpan = upperRight.position.x - upperLeft.position.x;
    const lowerSpan = lowerRight.position.x - lowerLeft.position.x;
    const upperSpanRate = 2 * shortArmLength
      * Math.cos(halfOpeningAngle) * halfOpeningAngularSpeed;
    const lowerSpanRate = 2 * longArmLength
      * Math.cos(halfOpeningAngle) * halfOpeningAngularSpeed;
    const upperSpanAcceleration = 2 * shortArmLength * (
      -Math.sin(halfOpeningAngle) * halfOpeningAngularSpeed ** 2
      + Math.cos(halfOpeningAngle) * halfOpeningAngularAcceleration
    );
    const lowerSpanAcceleration = 2 * longArmLength * (
      -Math.sin(halfOpeningAngle) * halfOpeningAngularSpeed ** 2
      + Math.cos(halfOpeningAngle) * halfOpeningAngularAcceleration
    );
    return {
      cycleCoordinate,
      cyclePhase,
      halfOpeningAngle,
      halfOpeningAngularAcceleration,
      halfOpeningAngularSpeed,
      legAAngle,
      legAAngularAcceleration,
      legAAngularSpeed,
      legBAngle,
      legBAngularAcceleration,
      legBAngularSpeed,
      lowerLeft,
      lowerRight,
      lowerSpan,
      lowerSpanAcceleration,
      lowerSpanRate,
      pivot: new THREE.Vector2(0, 0),
      ratioResidual: lowerSpan - selectedScaleRatio * upperSpan,
      rateRatioResidual:
        lowerSpanRate - selectedScaleRatio * upperSpanRate,
      accelerationRatioResidual:
        lowerSpanAcceleration
          - selectedScaleRatio * upperSpanAcceleration,
      upperLeft,
      upperRight,
      upperSpan,
      upperSpanAcceleration,
      upperSpanRate,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    legA.group.rotation.z = state.legAAngle;
    legB.group.rotation.z = state.legBAngle;
    upperSpanWitness.position.set(
      0,
      (state.upperLeft.position.y + state.upperRight.position.y) / 2,
      -0.19,
    );
    upperSpanWitness.scale.x = state.upperSpan;
    lowerSpanWitness.position.set(
      0,
      (state.lowerLeft.position.y + state.lowerRight.position.y) / 2,
      -0.19,
    );
    lowerSpanWitness.scale.x = state.lowerSpan;
    root.userData.contacts = {
      commonPivotToLegASlot: {
        active: true,
        lockedLongitudinalCoordinate: 0,
        radialResidual: 0,
      },
      commonPivotToLegBSlot: {
        active: true,
        lockedLongitudinalCoordinate: 0,
        radialResidual: 0,
      },
      setScrew: {
        locked: true,
        selectedScaleRatio,
      },
    };
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'locked-sliding-pivot-two-leg-proportional-compasses-with-invariant-opposed-point-span-ratio',
    blocks: {
      board,
      boardBorder,
      legA,
      legB,
      lowerSpanWitness,
      pivotAssembly,
      upperSpanWitness,
    },
    calibration: {
      scaleCalibration,
      scaleLaw:
        'for total point-to-point leg length L and pivot distance a from either short point, indicated enlargement ratio=(L-a)/a',
      selectedScaleRatio,
    },
    constraints: {
      legs:
        'Two equal rigid double-ended legs rotate oppositely about one common axis; their point-to-pivot distances remain fixed after adjustment.',
      pivot:
        'The common pivot slide lies on both longitudinal slot centerlines and its set screw locks the selected division of both legs.',
      ratio:
        'At every opening, short-pair span=2a sin(alpha), long-pair span=2b sin(alpha), and long span / short span=b/a.',
      witnesses:
        'The two thin transverse lines are nonphysical dimension witnesses added to make the copied and transferred spans legible; they exert no constraint.',
    },
    degreesOfFreedom: {
      configurationCoordinates: [
        'pivot position along both slots while the set screw is released',
      ],
      dependentCoordinates: [
        'opposed rotation of the second rigid leg',
        'both short-point positions',
        'both long-point positions',
        'short and long measured spans',
      ],
      independentPrescribedInputs: 1,
      inputs: ['manual opening angle after the proportion is locked'],
      note:
        'The setting slide supplies a configuration parameter, not an operating-cycle degree of freedom; after the set screw is locked, the compass has one opening coordinate.',
      operatingDegreesOfFreedom: 1,
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'two identical rigid legs and perfectly sharp point contacts',
        'frictionless common revolute axis after longitudinal adjustment is clamped',
        'zero slot and pivot clearance',
        'manual opening represented by a smooth cosine law',
        'no point force, friction, material compliance, mass, or inertia model',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless planar rigid-body drafting-instrument kinematics',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'two equal rigid double-ended compass legs cross at one common pivot carried by longitudinal slides; the set screw locks equal short arms and equal long arms on the two legs, so opening one point pair measures a dimension and the opposed pair transfers it at the selected constant proportion',
    motion: {
      cycleDuration,
      sequence:
        'source maximum opening -> smooth closing -> minimum opening -> smooth reopening -> source closure',
      sourcePosePhase: 0,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 409 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate409: {
        centralPivotApproximatePixels: [261, 231],
        imageHeight: 525,
        imageWidth: 525,
        leftScaleApproximateBoundsPixels: [164, 113, 219, 240],
        lowerLeftPointApproximatePixels: [87, 488],
        lowerRightPointApproximatePixels: [426, 503],
        measurementUncertaintyPixels: 10,
        upperLeftPointApproximatePixels: [144, 10],
        upperRightPointApproximatePixels: [391, 18],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the instrument copies drawings at a chosen larger or smaller scale',
          'the pivot is secured in a slide',
          'the slide is adjustable in longitudinal slots of the legs',
          'the pivot slide is secured by a set screw',
          'one pair of points takes the source dimension',
          'the opposite pair transfers that dimension',
          'the transfer proportion equals the relative point-to-pivot distances',
          'a scale on one or both legs indicates the proportion',
        ],
        engravingEvidence:
          'The plate shows two crossed double-ended legs, two long central slots, a common circular pivot collar, a graduation scale beside one slot, two shorter upper points, and two longer lower points.',
        reconstructionDisclosure:
          'Brown supplies no dimensions, chosen ratio, angle range, timing, depth, loads, or material. The selected 1.275 ratio follows the approximate plate proportions; exact equal-arm geometry, scale calibration, cosine demonstration, colors, board, and nonphysical span witnesses are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 409',
    },
    sourcePose: {
      halfOpeningAngle: sourceState.halfOpeningAngle,
      lowerSpan: sourceState.lowerSpan,
      selectedScaleRatio,
      setting:
        'maximum demonstration opening with shorter points above, longer points below, and the pivot index at the selected scale graduation, matching Brown’s crossed-leg plate pose',
      upperSpan: sourceState.upperSpan,
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      accelerationRatio:
        'long-span acceleration=(b/a) times short-span acceleration',
      displacementRatio:
        'long-point-pair span / short-point-pair span=b/a=selected scale ratio for every nonzero opening',
      rateRatio:
        'long-span rate=(b/a) times short-span rate',
      selectedScaleRatio,
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.37, -2.77, -0.39),
    new THREE.Vector3(2.37, 2.77, 0.84),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(5.4, 3.3, 12.8);
  root.userData.groundFloorY = -2.77;
  markShadows(root);
  board.receiveShadow = true;
  upperSpanWitness.castShadow = false;
  lowerSpanWitness.castShadow = false;
  update(0);
  return { root, update };
}

export function createAuthoredProportionalCompassMovement(movement) {
  if (movement.id !== 409) return null;
  return proportionalCompasses(movement);
}
