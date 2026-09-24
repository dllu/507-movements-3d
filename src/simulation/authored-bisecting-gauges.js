import {correctBisectingGauge,finishDrawingGauge} from './drawing-gauge-parts.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {plate as platePrism,poly,polygonClipping} from './finite-plate-geometry.js';
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

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function quinticStepWithDerivatives(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  if (u <= 1e-12) {
    return { acceleration: 0, position: 0, velocity: 0 };
  }
  if (u >= 1 - 1e-12) {
    return { acceleration: 0, position: 1, velocity: 0 };
  }
  const u2 = u * u;
  const u3 = u2 * u;
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    position: u3 * (10 + u * (-15 + 6 * u)),
    velocity: 30 * u2 * (1 - u) ** 2,
  };
}

function transitionState(
  cyclePhase,
  startPhase,
  endPhase,
  startValue,
  endValue,
  cycleDuration,
) {
  const duration = (endPhase - startPhase) * cycleDuration;
  const normalized = (cyclePhase - startPhase)
    / (endPhase - startPhase);
  const step = quinticStepWithDerivatives(normalized);
  const delta = endValue - startValue;
  return {
    acceleration: delta * step.acceleration / duration ** 2,
    position: startValue + delta * step.position,
    velocity: delta * step.velocity / duration,
  };
}

function bisectingGauge(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8.4;
  const workpieceHalfWidth = 1.48;
  const workpieceHalfLength = 2.72;
  const cheekThickness = 0.34;
  const fixedCheekX = -(workpieceHalfWidth + cheekThickness / 2);
  const fittedAdjustableCheekX = -fixedCheekX;
  const setupAdjustableCheekX = 1.98;
  const fittedCheekSpacing = fittedAdjustableCheekX - fixedCheekX;
  const equalLinkLength = 2.08;
  const linkAnchorLocalY = -0.22;
  const fittedMarkerOffset = Math.sqrt(
    equalLinkLength ** 2 - (fittedCheekSpacing / 2) ** 2,
  );
  const traverseStartY = 1.82;
  const traverseEndY = -0.76;
  const crossbarMinimumX = fixedCheekX - 0.62;
  const crossbarMaximumX = fittedAdjustableCheekX + 0.78;
  const crossbarLength = crossbarMaximumX - crossbarMinimumX;
  const geometry = {
    cheekThickness,
    crossbarLength,
    crossbarMaximumX,
    crossbarMinimumX,
    cycleDuration,
    equalLinkLength,
    fittedAdjustableCheekX,
    fittedCheekSpacing,
    fittedMarkerOffset,
    fixedCheekX,
    linkAnchorLocalY,
    setupAdjustableCheekX,
    traverseEndY,
    traverseStartY,
    workpieceHalfLength,
    workpieceHalfWidth,
  };

  const frameMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.55,
  });
  const adjustableMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.54,
  });
  const linkMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.45,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });
  const woodMaterial = matte(0xd8b06f, {
    metalness: 0.01,
    roughness: 0.86,
  });

  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(
      workpieceHalfWidth * 2,
      workpieceHalfLength * 2,
      0.22,
    ),
    woodMaterial,
  );
  workpiece.position.z = -0.29;
  workpiece.userData.role =
    'fixed-parallel-sided-workpiece-being-bisected';
  root.add(workpiece);
  const workpieceEdges = new THREE.Group();
  workpieceEdges.userData.role =
    'two-fixed-parallel-workpiece-edges-contacted-by-cheeks';
  for (const x of [-workpieceHalfWidth, workpieceHalfWidth]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, workpieceHalfLength * 2, 0.055),
      darkMaterial,
    );
    edge.position.set(x, 0, -0.155);
    edge.userData.role = x < 0
      ? 'left-parallel-workpiece-contact-edge'
      : 'right-parallel-workpiece-contact-edge';
    workpieceEdges.add(edge);
  }
  root.add(workpieceEdges);
  const exactCenterline = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, workpieceHalfLength * 1.78, 0.020),
    whiteMaterial,
  );
  exactCenterline.position.set(0, -0.34, -0.155);
  exactCenterline.userData.role =
    'nonphysical-exact-workpiece-centerline-reference';
  root.add(exactCenterline);
  const endGrainBars = [-2.48, 2.48].map((y, index) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(workpieceHalfWidth * 1.75, 0.035, 0.025),
      darkMaterial,
    );
    bar.position.set(0, y, -0.145);
    bar.userData.role = `workpiece-end-grain-line-${index + 1}`;
    root.add(bar);
    return bar;
  });

  const gauge = new THREE.Group();
  gauge.userData.role =
    'single-bisecting-gauge-sliding-longitudinally-on-workpiece';
  root.add(gauge);
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(crossbarLength, 0.34, 0.24),
    frameMaterial,
  );
  crossbar.position.set(
    (crossbarMinimumX + crossbarMaximumX) / 2,
    0,
    0.23,
  );
  crossbar.userData.role =
    'rigid-cross-bar-fixed-to-left-cheek-and-guiding-right-cheek';
  gauge.add(crossbar);
  const crossbarTopIndex = new THREE.Mesh(
    new THREE.BoxGeometry(crossbarLength - 0.18, 0.035, 0.028),
    whiteMaterial,
  );
  crossbarTopIndex.position.set(
    (crossbarMinimumX + crossbarMaximumX) / 2,
    -0.13,
    0.365,
  );
  crossbarTopIndex.userData.role = 'crossbar-straightness-index';
  gauge.add(crossbarTopIndex);
  const crossbarTicks = Array.from({ length: 12 }, (_, index) => {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, index % 3 === 0 ? 0.18 : 0.12, 0.026),
      whiteMaterial,
    );
    tick.position.set(
      THREE.MathUtils.lerp(
        setupAdjustableCheekX - 0.08,
        fittedAdjustableCheekX + 0.43,
        index / 11,
      ),
      0,
      0.372,
    );
    tick.userData.role = index % 3 === 0
      ? 'major-adjustable-cheek-setting-mark'
      : 'minor-adjustable-cheek-setting-mark';
    gauge.add(tick);
    return tick;
  });

  const makeCheek = (material, role, fixed) => {
    const group = new THREE.Group();
    group.userData.role = role;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(cheekThickness, 0.94, 0.70),
      material,
    );
    plate.position.z = 0.10;
    plate.userData.role = fixed
      ? 'fixed-left-parallel-cheek-body'
      : 'sliding-right-parallel-cheek-body';
    const innerContact = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.80, 0.30),
      whiteMaterial,
    );
    innerContact.position.set(
      fixed ? cheekThickness / 2 + 0.015 : -cheekThickness / 2 - 0.015,
      0,
      -0.17,
    );
    innerContact.userData.role = fixed
      ? 'fixed-cheek-inner-face-on-left-workpiece-edge'
      : 'adjustable-cheek-inner-face-on-right-workpiece-edge';
    const lowerFoot = new THREE.Mesh(
      new THREE.BoxGeometry(cheekThickness + 0.18, 0.20, 0.16),
      material,
    );
    lowerFoot.position.set(
      fixed ? 0.08 : -0.08,
      -0.48,
      -0.17,
    );
    lowerFoot.userData.role = `${fixed ? 'fixed' : 'adjustable'}-cheek-lower-foot`;
    group.add(plate, innerContact, lowerFoot);
    return { group, innerContact, lowerFoot, plate };
  };
  const fixedCheek = makeCheek(
    frameMaterial,
    'left-cheek-rigidly-fixed-to-crossbar',
    true,
  );
  fixedCheek.group.position.x = fixedCheekX;
  gauge.add(fixedCheek.group);
  const adjustableCheek = makeCheek(
    adjustableMaterial,
    'right-cheek-sliding-on-crossbar',
    false,
  );
  gauge.add(adjustableCheek.group);

  const thumbScrew = new THREE.Group();
  thumbScrew.position.set(0, 0, 0.49);
  thumbScrew.userData.role =
    'thumb-screw-locking-adjustable-cheek-to-crossbar';
  const thumbStem = cylinderAlongZ(0.075, 0.36, darkMaterial, 26);
  thumbStem.position.z = 0.05;
  const thumbHead = cylinderAlongZ(0.25, 0.11, whiteMaterial, 38);
  thumbHead.position.z = 0.25;
  thumbHead.userData.role = 'visible-thumb-screw-head';
  const thumbSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.045, 0.025),
    darkMaterial,
  );
  thumbSlot.position.z = 0.32;
  thumbSlot.userData.role = 'thumb-screw-driver-slot';
  const lockIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 14, 10),
    linkMaterial,
  );
  lockIndex.position.set(0.15, 0, 0.32);
  lockIndex.userData.role = 'thumb-screw-lock-state-index';
  thumbScrew.add(thumbStem, thumbHead, thumbSlot, lockIndex);
  adjustableCheek.group.add(thumbScrew);

  const fixedLinkAnchor = cylinderAlongZ(
    0.13,
    0.28,
    darkMaterial,
    30,
  );
  fixedLinkAnchor.position.set(fixedCheekX, linkAnchorLocalY, 0.12);
  fixedLinkAnchor.userData.role =
    'equal-left-link-pivot-centered-in-fixed-cheek';
  gauge.add(fixedLinkAnchor);
  const adjustableLinkAnchor = cylinderAlongZ(
    0.13,
    0.28,
    darkMaterial,
    30,
  );
  adjustableLinkAnchor.position.set(
    fittedAdjustableCheekX,
    linkAnchorLocalY,
    0.12,
  );
  adjustableLinkAnchor.userData.role =
    'equal-right-link-pivot-centered-in-adjustable-cheek';
  gauge.add(adjustableLinkAnchor);

  const initialMarker = new THREE.Vector3(
    0,
    linkAnchorLocalY - fittedMarkerOffset,
    0.10,
  );
  const leftLink = beamBetween(
    new THREE.Vector3(fixedCheekX, linkAnchorLocalY, 0.10),
    initialMarker,
    0.23,
    0.13,
    linkMaterial,
  );
  leftLink.userData.role = 'left-equal-short-centering-bar';
  gauge.add(leftLink);
  const rightLink = beamBetween(
    new THREE.Vector3(
      fittedAdjustableCheekX,
      linkAnchorLocalY,
      0.10,
    ),
    initialMarker,
    0.23,
    0.13,
    linkMaterial,
  );
  rightLink.userData.role = 'right-equal-short-centering-bar';
  gauge.add(rightLink);

  const markingPoint = new THREE.Group();
  markingPoint.position.copy(initialMarker);
  markingPoint.userData.role =
    'sharp-marking-point-at-common-equal-link-pivot';
  const markerCollar = cylinderAlongZ(0.22, 0.18, darkMaterial, 34);
  markerCollar.position.z = 0.04;
  markerCollar.userData.role = 'common-link-pivot-marker-collar';
  const markerIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.060, 16, 12),
    whiteMaterial,
  );
  markerIndex.position.z = 0.17;
  markerIndex.userData.role = 'white-midpoint-marker-index';
  const markerNeedle = new THREE.Mesh(
    new THREE.ConeGeometry(0.070, 0.44, 28),
    darkMaterial,
  );
  markerNeedle.rotation.x = -Math.PI / 2;
  markerNeedle.position.z = -0.06;
  markerNeedle.userData.role = 'sharp-marker-needle-touching-workpiece';
  markingPoint.add(markerCollar, markerIndex, markerNeedle);
  gauge.add(markingPoint);

  const fittedCenterWitness = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, fittedMarkerOffset + 0.36, 0.020),
    whiteMaterial,
  );
  fittedCenterWitness.position.set(
    0,
    linkAnchorLocalY - fittedMarkerOffset / 2,
    -0.12,
  );
  fittedCenterWitness.userData.role =
    'nonphysical-perpendicular-bisector-witness-at-fitted-width';
  gauge.add(fittedCenterWitness);

  const segmentState = (cyclePhase) => {
    const still = (position) => ({
      acceleration: 0,
      position,
      velocity: 0,
    });
    if (cyclePhase < 0.30) {
      return {
        adjustableX: still(fittedAdjustableCheekX),
        gaugeY: transitionState(
          cyclePhase,
          0,
          0.30,
          traverseStartY,
          traverseEndY,
          cycleDuration,
        ),
        lock: still(1),
        stage: 'locked-forward-centerline-traverse',
      };
    }
    if (cyclePhase < 0.37) {
      return {
        adjustableX: still(fittedAdjustableCheekX),
        gaugeY: still(traverseEndY),
        lock: still(1),
        stage: 'locked-far-end-dwell',
      };
    }
    if (cyclePhase < 0.62) {
      return {
        adjustableX: still(fittedAdjustableCheekX),
        gaugeY: transitionState(
          cyclePhase,
          0.37,
          0.62,
          traverseEndY,
          traverseStartY,
          cycleDuration,
        ),
        lock: still(1),
        stage: 'locked-return-centerline-traverse',
      };
    }
    if (cyclePhase < 0.70) {
      return {
        adjustableX: still(fittedAdjustableCheekX),
        gaugeY: still(traverseStartY),
        lock: transitionState(
          cyclePhase,
          0.62,
          0.70,
          1,
          0,
          cycleDuration,
        ),
        stage: 'releasing-adjustable-cheek-thumb-screw',
      };
    }
    if (cyclePhase < 0.80) {
      return {
        adjustableX: transitionState(
          cyclePhase,
          0.70,
          0.80,
          fittedAdjustableCheekX,
          setupAdjustableCheekX,
          cycleDuration,
        ),
        gaugeY: still(traverseStartY),
        lock: still(0),
        stage: 'unlocked-cheek-retracted-from-workpiece-edge',
      };
    }
    if (cyclePhase < 0.92) {
      return {
        adjustableX: transitionState(
          cyclePhase,
          0.80,
          0.92,
          setupAdjustableCheekX,
          fittedAdjustableCheekX,
          cycleDuration,
        ),
        gaugeY: still(traverseStartY),
        lock: still(0),
        stage: 'unlocked-cheek-adjusted-to-workpiece-edge',
      };
    }
    return {
      adjustableX: still(fittedAdjustableCheekX),
      gaugeY: still(traverseStartY),
      lock: transitionState(
        cyclePhase,
        0.92,
        1,
        0,
        1,
        cycleDuration,
      ),
      stage: 'tightening-thumb-screw-at-fitted-width',
    };
  };

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const segment = segmentState(cyclePhase);
    const adjustableCheekX = segment.adjustableX.position;
    const adjustableCheekSpeed = segment.adjustableX.velocity;
    const adjustableCheekAcceleration = segment.adjustableX.acceleration;
    const cheekSpacing = adjustableCheekX - fixedCheekX;
    const cheekSpacingSpeed = adjustableCheekSpeed;
    const cheekSpacingAcceleration = adjustableCheekAcceleration;
    const halfSpacing = cheekSpacing / 2;
    const markerOffset = Math.sqrt(
      equalLinkLength ** 2 - halfSpacing ** 2,
    );
    const markerLocalX = (fixedCheekX + adjustableCheekX) / 2;
    const markerLocalY = linkAnchorLocalY - markerOffset;
    const markerLocalXSpeed = adjustableCheekSpeed / 2;
    const markerLocalXAcceleration = adjustableCheekAcceleration / 2;
    const markerLocalYDerivativeBySpacing = cheekSpacing
      / (4 * markerOffset);
    const markerLocalYSecondDerivativeBySpacing =
      1 / (4 * markerOffset)
      + cheekSpacing ** 2 / (16 * markerOffset ** 3);
    const markerLocalYSpeed = markerLocalYDerivativeBySpacing
      * cheekSpacingSpeed;
    const markerLocalYAcceleration =
      markerLocalYSecondDerivativeBySpacing * cheekSpacingSpeed ** 2
      + markerLocalYDerivativeBySpacing * cheekSpacingAcceleration;
    const markerWorld = new THREE.Vector2(
      markerLocalX,
      segment.gaugeY.position + markerLocalY,
    );
    const markerVelocity = new THREE.Vector2(
      markerLocalXSpeed,
      segment.gaugeY.velocity + markerLocalYSpeed,
    );
    const markerAcceleration = new THREE.Vector2(
      markerLocalXAcceleration,
      segment.gaugeY.acceleration + markerLocalYAcceleration,
    );
    const fixedLinkPivotWorld = new THREE.Vector2(
      fixedCheekX,
      segment.gaugeY.position + linkAnchorLocalY,
    );
    const adjustableLinkPivotWorld = new THREE.Vector2(
      adjustableCheekX,
      segment.gaugeY.position + linkAnchorLocalY,
    );
    const leftLinkVector = markerWorld.clone().sub(fixedLinkPivotWorld);
    const rightLinkVector = markerWorld.clone()
      .sub(adjustableLinkPivotWorld);
    const leftInnerFaceX = fixedCheekX + cheekThickness / 2;
    const rightInnerFaceX = adjustableCheekX - cheekThickness / 2;
    return {
      adjustableCheekAcceleration,
      adjustableCheekSpeed,
      adjustableCheekX,
      adjustableLinkPivotWorld,
      centerResidual:
        markerLocalX - (fixedCheekX + adjustableCheekX) / 2,
      cheekSpacing,
      cheekSpacingAcceleration,
      cheekSpacingSpeed,
      cycleCoordinate,
      cyclePhase,
      fitted: Math.abs(
        adjustableCheekX - fittedAdjustableCheekX,
      ) < 1e-12,
      fixedLinkPivotWorld,
      gaugeAcceleration: segment.gaugeY.acceleration,
      gaugeSpeed: segment.gaugeY.velocity,
      gaugeY: segment.gaugeY.position,
      leftCheekContactResidual:
        leftInnerFaceX + workpieceHalfWidth,
      leftLinkAngle: Math.atan2(leftLinkVector.y, leftLinkVector.x),
      leftLinkLengthResidual: leftLinkVector.length() - equalLinkLength,
      lockAcceleration: segment.lock.acceleration,
      lockFraction: segment.lock.position,
      lockSpeed: segment.lock.velocity,
      markerAcceleration,
      markerLocal: new THREE.Vector2(markerLocalX, markerLocalY),
      markerOffset,
      markerVelocity,
      markerWorld,
      rightCheekContactResidual:
        rightInnerFaceX - workpieceHalfWidth,
      rightLinkAngle: Math.atan2(rightLinkVector.y, rightLinkVector.x),
      rightLinkLengthResidual: rightLinkVector.length() - equalLinkLength,
      stage: segment.stage,
    };
  };

  const orientLink = (link, start, end) => {
    const delta = end.clone().sub(start);
    link.position.set(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      link.userData.workingZ ?? .10,
    );
    link.rotation.z = Math.atan2(delta.y, delta.x);
  };
  const update = (time) => {
    const state = stateAtTime(time);
    gauge.position.y = state.gaugeY;
    adjustableCheek.group.position.x = state.adjustableCheekX;
    adjustableLinkAnchor.position.x = state.adjustableCheekX;
    markingPoint.position.set(
      state.markerLocal.x,
      state.markerLocal.y,
      0.10,
    );
    orientLink(
      leftLink,
      new THREE.Vector2(fixedCheekX, linkAnchorLocalY),
      state.markerLocal,
    );
    orientLink(
      rightLink,
      new THREE.Vector2(state.adjustableCheekX, linkAnchorLocalY),
      state.markerLocal,
    );
    thumbScrew.position.z = 0.49 + 0.13 * (1 - state.lockFraction);
    thumbScrew.rotation.z = FULL_TURN * (1 - state.lockFraction);
    root.userData.contacts = {
      adjustableCheekToCrossbar: {
        locked: state.lockFraction === 1,
        position: state.adjustableCheekX,
      },
      adjustableCheekToWorkpiece: {
        active: state.fitted,
        residual: state.rightCheekContactResidual,
      },
      fixedCheekToWorkpiece: {
        active: true,
        residual: state.leftCheekContactResidual,
      },
      markerToWorkpiece: {
        active: true,
        point: state.markerWorld,
        transverseCenterResidual: state.fitted
          ? state.markerWorld.x
          : null,
      },
    };
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'fixed-and-adjustable-parallel-cheek-bisecting-gauge-with-equal-link-midpoint-marker',
    blocks: {
      adjustableCheek,
      adjustableLinkAnchor,
      crossbar,
      crossbarTicks,
      crossbarTopIndex,
      endGrainBars,
      exactCenterline,
      fittedCenterWitness,
      fixedCheek,
      fixedLinkAnchor,
      gauge,
      leftLink,
      markerCollar,
      markerIndex,
      markerNeedle,
      markingPoint,
      rightLink,
      thumbScrew,
      workpiece,
      workpieceEdges,
    },
    constraints: {
      cheeks:
        'The fixed and sliding cheeks remain parallel on one rigid cross-bar; at the fitted setting their equal inner offsets contact the two workpiece edges.',
      equalLinks:
        'Two bars of exactly equal fixed length pivot at the cheek centers and meet at one common marking pivot on the selected below-bar branch.',
      midpoint:
        'Equal link radii force the common marking pivot onto the perpendicular bisector of the cheek-pivot segment for every admissible spacing.',
      usage:
        'With the thumb screw locked at the fitted width, longitudinal gauge translation carries the sharp point exactly along the workpiece centerline.',
      witness:
        'The white workpiece line and short perpendicular guide are nonphysical center references and exert no constraint.',
    },
    degreesOfFreedom: {
      configurationCoordinates: [
        'adjustable-cheek position while thumb screw is released',
      ],
      dependentCoordinates: [
        'two equal-link angles',
        'marking-point transverse midpoint and longitudinal offset',
      ],
      independentManualCoordinates: 2,
      independentPrescribedInputs: 1,
      inputs: [
        'one-at-a-time staged cheek adjustment or longitudinal gauge traverse',
      ],
      note:
        'Cheek setting and workpiece traverse are distinct manual coordinates, but the demonstration activates at most one at a time; during working traverse the cheek screw is locked and only translation remains.',
      operatingDegreesOfFreedomWhenLocked: 1,
      simultaneouslyActiveManualCoordinates: 1,
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid cross-bar, cheeks, equal links, and workpiece',
        'perfect revolute pins and zero-clearance cross-bar slide',
        'perfectly parallel workpiece edges and equal cheek offsets',
        'sharp marking point with no cutting-force or wear model',
        'manual setup and traverse represented by piecewise quintic laws',
        'mass, inertia, friction, screw torque, elasticity, and tolerances omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless planar linkage and drafting-gauge kinematics',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'one cheek is fixed to a rigid cross-bar and one parallel cheek slides and locks by thumb screw; equal fixed-length bars pivot at the two cheek centers and join at the sharp marking point, whose equal distances put it exactly halfway between the cheeks while the locked gauge traverses a parallel-sided workpiece',
    motion: {
      cycleDuration,
      sequence: [
        'locked forward centerline traverse',
        'far-end dwell',
        'locked return centerline traverse',
        'thumb-screw release',
        'unlocked cheek retraction',
        'unlocked cheek readjustment to the edge',
        'thumb-screw relock and exact source closure',
      ],
      sourcePosePhase: 0,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 410 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate410: {
        adjustableCheekApproximateBoundsPixels: [301, 230, 474, 417],
        crossbarApproximateBoundsPixels: [132, 153, 431, 321],
        fixedCheekApproximateBoundsPixels: [48, 91, 205, 275],
        imageHeight: 525,
        imageWidth: 525,
        markingPivotApproximatePixels: [191, 315],
        measurementUncertaintyPixels: 12,
        workpieceApproximateBoundsPixels: [23, 76, 507, 510],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'two parallel cheeks lie on one cross-bar',
          'one cheek is fixed',
          'the other cheek is adjustable and held by a thumb screw',
          'one short bar is centered in each cheek',
          'the two short bars have equal length',
          'the bars unite at a pivot carrying a sharp marking point',
          'the point remains central between the cheeks at every spacing',
          'drawing the fitted gauge along a parallel-sided solid bisects it end to end',
          'a loose adjustable cheek may follow a nonparallel solid for analogous bisection',
        ],
        engravingEvidence:
          'The plate shows a long cross-bar passing through two deep parallel cheek plates, a thumb screw atop the right sliding cheek, two links beneath the bar joining at a low marking pivot, and a broad workpiece between the cheeks.',
        reconstructionDisclosure:
          'Brown gives no dimensions, link branch, operating timing, depth, loads, or clearances. Equal cheek offsets, selected workpiece width, staged parallel-sided use cycle, colors, graduations, and nonphysical center witnesses are independently engineered; the exact equal-link midpoint construction is retained.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 410',
    },
    sourcePose: {
      adjustableCheekX: sourceState.adjustableCheekX,
      gaugeY: sourceState.gaugeY,
      lockFraction: sourceState.lockFraction,
      markerWorld: sourceState.markerWorld,
      setting:
        'both parallel cheeks fitted to the workpiece, thumb screw locked, equal links on the below-bar branch, and marker centered, matching Brown’s assembled plate',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
      stages: [
        [0, 0.30, 'locked-forward-centerline-traverse'],
        [0.30, 0.37, 'locked-far-end-dwell'],
        [0.37, 0.62, 'locked-return-centerline-traverse'],
        [0.62, 0.70, 'releasing-adjustable-cheek-thumb-screw'],
        [0.70, 0.80, 'unlocked-cheek-retracted-from-workpiece-edge'],
        [0.80, 0.92, 'unlocked-cheek-adjusted-to-workpiece-edge'],
        [0.92, 1, 'tightening-thumb-screw-at-fitted-width'],
      ],
    },
    transmission: {
      equalLinkClosure:
        '|marker-left cheek pivot|=|marker-right cheek pivot|=link length',
      midpointRelation:
        'marker transverse coordinate=(fixed cheek center+adjustable cheek center)/2',
      parallelWorkpieceRelation:
        'at fitted equal-offset cheek contacts, marker transverse coordinate=(left workpiece edge+right workpiece edge)/2=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.36, -2.84, -0.43),
    new THREE.Vector3(2.42, 2.84, 1.10),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(6.0, 4.5, 12.5);
  root.userData.groundFloorY = -2.84;
  // Plate cleanup: Brown's board runs on past the gauge in both directions
  // and carries only a dark bisecting line; no end-grain bars, white
  // indices, slotted white thumb head or witness strip are drawn.
  workpiece.geometry.dispose();
  workpiece.geometry = new THREE.BoxGeometry(workpieceHalfWidth * 2, workpieceHalfLength + 3.80, 0.22);
  workpiece.position.y = (3.80 - workpieceHalfLength) / 2;
  exactCenterline.material = darkMaterial;
  exactCenterline.geometry.dispose();
  exactCenterline.geometry = new THREE.BoxGeometry(0.030, workpieceHalfLength + 3.80, 0.004);
  exactCenterline.position.set(0, workpiece.position.y, -0.178);
  for (const bar of endGrainBars) bar.visible = false;
  fittedCenterWitness.visible = false;
  markerIndex.visible = false;
  thumbSlot.visible = false;
  lockIndex.visible = false;
  thumbHead.material = darkMaterial;
  thumbHead.geometry.dispose();
  thumbHead.geometry = new THREE.CylinderGeometry(0.19, 0.16, 0.12, 24);
  // Seat the knob on the cheek cap instead of sinking it into the cap.
  thumbHead.position.z = 0.32;
  markShadows(root);
  workpiece.receiveShadow = true;
  exactCenterline.castShadow = false;
  fittedCenterWitness.castShadow = false;
  correctBisectingGauge(root);
  archBrownCheeks(root);
  // Isometric view from the adjustable cheek's side and the near board end.
  return finishDrawingGauge(root,update,cycleDuration,new THREE.Vector3(1,1.05,1));
}

// Brown's cheeks are tall blocks with a segmental arched top, the cross-bar
// passing through their lower middle and the thumb screw rising from the
// crown of the sliding cheek. Rebuild the shared-helper notched cheek
// locally: same crossbar window, link slot and footprint, taller arched top.
function archBrownCheeks(root) {
  const b = root.userData.blocks, g = root.userData.geometry;
  const rect = (y0, z0, y1, z1) => poly([[y0, z0], [y1, z0], [y1, z1], [y0, z1]]);
  const half = 0.47, bottom = -0.25, springing = 0.95, crown = 1.12;
  const radius = (half ** 2 + (crown - springing) ** 2) / (2 * (crown - springing));
  const centerZ = crown - radius;
  const outline = [[-half, bottom], [half, bottom]];
  for (let i = 0; i <= 48; i++) {
    const y = half - 2 * half * i / 48;
    outline.push([y, centerZ + Math.sqrt(radius ** 2 - y ** 2)]);
  }
  const arched = poly(outline);
  const toCheek = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const t = g.cheekThickness / 2;
  for (const [i, cheek] of [b.fixedCheek, b.adjustableCheek].entries()) {
    const linkZ = i ? 0.13 : -0.02;
    let body = polygonClipping.difference(arched, rect(-0.178, 0.302, 0.178, 0.558),
      rect(-0.51, linkZ - 0.071, -0.02, linkZ + 0.071));
    const parts = [];
    if (i) {
      // Square vertical passage for the thumb-screw stem through the crown.
      const band = rect(-0.08, 0.558, 0.08, crown + 0.1);
      const crownBand = polygonClipping.intersection(body, band);
      body = polygonClipping.difference(body, band);
      parts.push(platePrism(crownBand, -t, -0.08), platePrism(crownBand, 0.08, t));
    }
    parts.push(platePrism(body, -t, t));
    const merged = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    merged.applyMatrix4(toCheek);
    cheek.plate.geometry.dispose();
    cheek.plate.geometry = merged;
    cheek.plate.position.z = 0;
  }
  // Stem from the crossbar top up through the crown; knob just above it.
  const stem = b.thumbScrew.children[0];
  stem.geometry.dispose();
  stem.geometry = new THREE.CylinderGeometry(0.075, 0.075, 0.66, 32);
  stem.position.z = 0.06 + 0.33;
  const head = b.thumbScrew.children[1];
  head.position.z = 0.78;
  root.userData.reconstructionNote = `${root.userData.reconstructionNote} Cheeks are Brown's tall blocks with arched tops.`;
}

export function createAuthoredBisectingGaugeMovement(movement) {
  if (movement.id !== 410) return null;
  return bisectingGauge(movement);
}
