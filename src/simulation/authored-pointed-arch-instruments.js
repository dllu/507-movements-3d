import {correctDrawingTemplateParts,pointedTemplateParameters,taperedBendIntegrals} from './drawing-template-parts.js';
import * as THREE from 'three';
import { LaidRopeGeometry, replaceWithLaidRope } from './laid-rope.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (x - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (2 * x ** 2 - 3 * x + 1);
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

function lineTube(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(80, points.length * 2),
      radius,
      8,
      false,
    ),
    material,
  );
}

function makeDynamicCord(radius, material) {
  // Brown hatches the cord as a laid rope: the shared three-strand rope,
  // rebuilt along the straight run between its two moving ends.
  const cord = new THREE.Mesh(new THREE.BufferGeometry(), material);
  cord.userData.crossSection = 'laid-rope';
  cord.userData.setEndpoints = (start, end, travel = 0) => {
    replaceWithLaidRope(cord, new THREE.LineCurve3(start.clone(), end.clone()), {
      radius,
      travel,
      // Enough samples for the longest run, so the buffers never reallocate.
      tubularSegments: 1024,
    });
  };
  return cord;
}

function pointedArchInstrument(movement) {
  const root = new THREE.Group();
  const halfSpan = 2.45;
  const rise = 2.125;
  const springingY = 0;
  const leftSpringingX = -halfSpan;
  const rightSpringingX = halfSpan;
  const selectedTemplate = pointedTemplateParameters(halfSpan,rise);
  const maximumTurningAngle = selectedTemplate.angle;
  const elasticBarLength = selectedTemplate.length;
  const apex = new THREE.Vector2(0, rise);
  const barDepth = 0.22;
  const barThickness = 0.18;
  const barSampleCount = 257;
  const slidePin = new THREE.Vector2(0, -0.23);
  const slotLeft = -1.90;
  const slotRight = 0.55;
  const cycleDuration = 6;
  const sourcePhaseOffset = 0.5;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterSpringing = new THREE.Vector2(72, 414);
  const sourceRasterApex = new THREE.Vector2(419, 113);
  const sourceRasterJambBounds = [72, 12, 95, 365];
  const sourceRasterHorizontalBarBounds = [22, 387, 501, 444];
  const sourceRasterSlotBounds = [134, 404, 475, 427];
  const sourceRasterSlidePin = new THREE.Vector2(419, 420);
  const sourceRasterFulcrumBounds = [70, 352, 134, 416];

  const barMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.61,
    side: THREE.DoubleSide,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.21,
    roughness: 0.46,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.49,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });
  const boardMaterial = matte(0xdadad4, {
    metalness: 0.02,
    roughness: 0.92,
  });

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(6.28, 4.82, 0.16),
    boardMaterial,
  );
  board.position.set(0, 1.58, -0.34);
  board.userData.role =
    'fixed-drawing-board-presentational-support-not-source-hardware';
  root.add(board);
  const boardFrame = new THREE.Group();
  boardFrame.userData.role = 'fixed-drawing-board-border';
  for (const x of [-3.20, 3.20]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 4.93, 0.22),
      frameMaterial,
    );
    rail.position.set(x, 1.58, -0.27);
    boardFrame.add(rail);
  }
  for (const y of [-0.89, 4.05]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(6.51, 0.11, 0.22),
      frameMaterial,
    );
    rail.position.set(0, y, -0.27);
    boardFrame.add(rail);
  }
  root.add(boardFrame);

  const jambs = [-1, 1].map((side, index) => {
    const innerX = side * halfSpan;
    const outerX = innerX + side * 0.11;
    const jamb = beamBetween(
      new THREE.Vector3(outerX, springingY, -0.19),
      new THREE.Vector3(outerX, 3.84, -0.19),
      0.19,
      0.025,
      frameMaterial,
    );
    jamb.userData.role = index === 0
      ? 'left-jamb-reference-aligned-with-back-of-elastic-bar'
      : 'mirrored-right-jamb-reference-for-complete-arch';
    root.add(jamb);
    return jamb;
  });
  const springingLine = new THREE.Mesh(
    new THREE.BoxGeometry(6.06, 0.035, 0.34),
    whiteMaterial,
  );
  springingLine.position.set(0, springingY, 0.025);
  springingLine.userData.role =
    'white-upper-edge-of-horizontal-bar-on-springing-line';
  root.add(springingLine);

  const baseBar = new THREE.Mesh(
    new THREE.BoxGeometry(6.06, 0.42, 0.38),
    frameMaterial,
  );
  baseBar.position.set(0, springingY - 0.21, 0);
  baseBar.userData.role =
    'horizontal-slotted-bar-set-on-springing-line';
  root.add(baseBar);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(slotRight - slotLeft, 0.15, 0.055),
    darkMaterial,
  );
  slot.position.set(
    (slotLeft + slotRight) / 2,
    springingY - 0.23,
    0.215,
  );
  slot.userData.role = 'longitudinal-slot-in-horizontal-bar';
  root.add(slot);

  const slide = new THREE.Group();
  slide.position.set(slidePin.x, slidePin.y, 0.24);
  slide.userData.role =
    'apex-position-slide-locked-in-horizontal-slot';
  const slideBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.40, 0.25, 0.19),
    accentMaterial,
  );
  slideBlock.userData.role = 'slot-slide-block';
  const slideIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 16, 12),
    whiteMaterial,
  );
  slideIndex.position.z = 0.16;
  slideIndex.userData.role = 'white-slide-position-index';
  const cordPin = cylinderAlongZ(0.075, 0.52, darkMaterial, 28);
  cordPin.userData.role = 'slide-pin-carrying-cord-loop';
  slide.add(slideBlock, slideIndex, cordPin);
  root.add(slide);
  const cordLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.025, 10, 36),
    darkMaterial,
  );
  cordLoop.position.set(slidePin.x, slidePin.y, 0.33);
  cordLoop.userData.role = 'cord-loop-around-slide-pin';
  root.add(cordLoop);

  const fulcrumPiece = new THREE.Group();
  fulcrumPiece.userData.role =
    'base-fulcrum-piece-maintaining-tangency-to-jamb';
  const fulcrumBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.58, 0.42),
    frameMaterial,
  );
  fulcrumBlock.position.set(leftSpringingX + 0.20, 0.19, 0.02);
  fulcrumBlock.userData.role = 'elastic-bar-fixed-end-clamp';
  const fulcrumRoller = cylinderAlongZ(0.16, 0.48, accentMaterial, 36);
  fulcrumRoller.position.set(
    leftSpringingX + barDepth + 0.10,
    0.31,
    0.08,
  );
  fulcrumRoller.userData.role =
    'rounded-fulcrum-support-on-inside-of-bar-base';
  fulcrumPiece.add(fulcrumBlock, fulcrumRoller);
  root.add(fulcrumPiece);

  const pointOnWorkingEdge = (arcFraction, bend) => {
    const normalized = THREE.MathUtils.clamp(arcFraction, 0, 1);
    const totalAngle = maximumTurningAngle
      * THREE.MathUtils.clamp(bend, 0, 1);
    const ratios = taperedBendIntegrals(totalAngle,normalized);
    if(normalized===1&&bend===1)return apex.clone();
    return new THREE.Vector2(
      leftSpringingX
        + elasticBarLength * ratios.f,
      springingY
        + elasticBarLength * ratios.g,
    );
  };
  const tangentOnWorkingEdge = (arcFraction, bend) => {
    const angle = maximumTurningAngle
      * THREE.MathUtils.clamp(bend, 0, 1)
      * (2*THREE.MathUtils.clamp(arcFraction, 0, 1)-THREE.MathUtils.clamp(arcFraction, 0, 1)**2);
    return new THREE.Vector2(Math.sin(angle), Math.cos(angle));
  };
  const pathAtBend = (bend) => {
    const outerPoints = Array.from(
      { length: barSampleCount },
      (_, index) => pointOnWorkingEdge(
        index / (barSampleCount - 1),
        bend,
      ),
    );
    const innerPoints = outerPoints.map((point, index) => {
      const tangent = tangentOnWorkingEdge(
        index / (barSampleCount - 1),
        bend,
      );
      const inwardNormal = new THREE.Vector2(tangent.y, -tangent.x);
      return point.clone().addScaledVector(inwardNormal, barDepth);
    });
    let polylineLength = 0;
    for (let index = 1; index < outerPoints.length; index += 1) {
      polylineLength += outerPoints[index]
        .distanceTo(outerPoints[index - 1]);
    }
    return {
      innerPoints,
      outerPoints,
      polylineLength,
      tip: outerPoints.at(-1),
    };
  };

  const barPositions = new Float32Array(barSampleCount * 4 * 3);
  const barIndices = [];
  for (let index = 0; index < barSampleCount - 1; index += 1) {
    const current = index * 4;
    const next = current + 4;
    barIndices.push(
      current, current + 1, next,
      next, current + 1, next + 1,
      current + 2, next + 2, current + 3,
      next + 2, next + 3, current + 3,
      current, next, current + 2,
      next, next + 2, current + 2,
      current + 1, current + 3, next + 1,
      next + 1, current + 3, next + 3,
    );
  }
  barIndices.push(
    0, 2, 1, 1, 2, 3,
    (barSampleCount - 1) * 4,
    (barSampleCount - 1) * 4 + 1,
    (barSampleCount - 1) * 4 + 2,
    (barSampleCount - 1) * 4 + 1,
    (barSampleCount - 1) * 4 + 3,
    (barSampleCount - 1) * 4 + 2,
  );
  const barGeometry = new THREE.BufferGeometry();
  const barPositionAttribute = new THREE.BufferAttribute(barPositions, 3);
  barPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  barGeometry.setAttribute('position', barPositionAttribute);
  barGeometry.setIndex(barIndices);
  const elasticBar = new THREE.Mesh(barGeometry, barMaterial);
  elasticBar.position.z = 0.12;
  elasticBar.frustumCulled = false;
  elasticBar.userData.role =
    'single-inextensible-elastic-wood-arch-bar-fixed-at-left-springing';
  root.add(elasticBar);

  const edgePositions = new Float32Array(barSampleCount * 3);
  const edgeGeometry = new THREE.BufferGeometry();
  const edgePositionAttribute = new THREE.BufferAttribute(
    edgePositions,
    3,
  );
  edgePositionAttribute.setUsage(THREE.DynamicDrawUsage);
  edgeGeometry.setAttribute('position', edgePositionAttribute);
  const workingEdge = new THREE.Line(
    edgeGeometry,
    new THREE.LineBasicMaterial({ color: PALETTE.white }),
  );
  workingEdge.position.z = 0.22;
  workingEdge.userData.role =
    'upper-working-edge-tangent-to-jamb-and-meeting-apex';
  root.add(workingEdge);

  const updateBarGeometry = (bend) => {
    const path = pathAtBend(bend);
    for (let index = 0; index < barSampleCount; index += 1) {
      const u=index/(barSampleCount-1)*(1-.115/elasticBarLength);
      const outer=pointOnWorkingEdge(u,bend),tangent=tangentOnWorkingEdge(u,bend);
      const inner=outer.clone().addScaledVector(new THREE.Vector2(tangent.y,-tangent.x),barDepth);
      const offset = index * 12;
      barPositions[offset] = outer.x;
      barPositions[offset + 1] = outer.y;
      barPositions[offset + 2] = barThickness / 2;
      barPositions[offset + 3] = inner.x;
      barPositions[offset + 4] = inner.y;
      barPositions[offset + 5] = barThickness / 2;
      barPositions[offset + 6] = outer.x;
      barPositions[offset + 7] = outer.y;
      barPositions[offset + 8] = -barThickness / 2;
      barPositions[offset + 9] = inner.x;
      barPositions[offset + 10] = inner.y;
      barPositions[offset + 11] = -barThickness / 2;
      const edgeOffset = index * 3;
      edgePositions[edgeOffset] = path.outerPoints[index].x;
      edgePositions[edgeOffset + 1] = path.outerPoints[index].y;
      edgePositions[edgeOffset + 2] = 0;
    }
    barPositionAttribute.needsUpdate = true;
    edgePositionAttribute.needsUpdate = true;
    barGeometry.computeVertexNormals();
    barGeometry.computeBoundingSphere();
    edgeGeometry.computeBoundingSphere();
    elasticBar.userData.currentPath = path;
    return path;
  };
  elasticBar.userData.updateForBend = updateBarGeometry;

  const targetLeftPoints = pathAtBend(1).outerPoints.map((point) => (
    new THREE.Vector3(point.x, point.y, -0.145)
  ));
  const targetRightPoints = [...targetLeftPoints].reverse().map((point) => (
    new THREE.Vector3(-point.x, point.y, point.z)
  ));
  const targetArch = {
    left: lineTube(targetLeftPoints, 0.026, driverMaterial),
    right: lineTube(targetRightPoints, 0.026, driverMaterial),
  };
  targetArch.left.userData.role =
    'selected-left-half-of-pointed-arch';
  targetArch.right.userData.role =
    'mirrored-right-half-completing-pointed-arch';
  root.add(targetArch.left, targetArch.right);
  const prescribedPoints = [
    new THREE.Vector2(leftSpringingX, springingY),
    apex,
    new THREE.Vector2(rightSpringingX, springingY),
  ].map((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 16, 12),
      whiteMaterial,
    );
    marker.position.set(point.x, point.y, -0.095);
    marker.userData.role = [
      'given-left-springing-point',
      'given-pointed-arch-apex',
      'given-right-springing-point',
    ][index];
    root.add(marker);
    return marker;
  });

  const cord = makeDynamicCord(0.04, matte(PALETTE.belt, { roughness: 0.78 }));
  cord.userData.role =
    'single-working-cord-from-elastic-bar-tip-to-slide-pin';
  root.add(cord);

  const pencil = new THREE.Group();
  pencil.userData.role =
    'pencil-secured-at-elastic-bar-and-cord-connection';
  const pencilBarrel = cylinderAlongZ(0.085, 0.55, driverMaterial, 30);
  pencilBarrel.position.z = 0.18;
  pencilBarrel.userData.role = 'moving-pointed-arch-pencil-barrel';
  const pencilCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.085, 0.16, 30),
    accentMaterial,
  );
  pencilCone.rotation.x = Math.PI / 2;
  pencilCone.position.z = -0.175;
  pencilCone.userData.role = 'moving-pointed-arch-pencil-tip';
  const pencilPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 14, 10),
    darkMaterial,
  );
  pencilPoint.position.z = -0.265;
  pencilPoint.userData.role = 'pencil-point-on-drawing-board';
  const connectionCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.026, 10, 36),
    accentMaterial,
  );
  connectionCollar.position.z = 0.33;
  connectionCollar.userData.role =
    'white-cord-and-bar-tip-connection-collar';
  pencil.add(
    pencilBarrel,
    pencilCone,
    pencilPoint,
    connectionCollar,
  );
  root.add(pencil);

  // The bar is only partly released between settings: straightened fully it
  // would lie along the jamb, its pencil clamp over the jamb reference.
  const minimumBend = 0.4;
  const bendSpan = 1 - minimumBend;
  const bendLawAtCyclePhase = (cyclePhase) => {
    if (cyclePhase < 0.5) {
      const local = cyclePhase * 2;
      return {
        acceleration: bendSpan * smootherStepSecondDerivative(local)
          * 4 / cycleDuration ** 2,
        direction: 'cord-drawn-in-and-elastic-bar-bending-to-apex',
        rate: bendSpan * smootherStepDerivative(local) * 2 / cycleDuration,
        value: minimumBend + bendSpan * smootherStep(local),
      };
    }
    const local = (cyclePhase - 0.5) * 2;
    return {
      acceleration: -bendSpan * smootherStepSecondDerivative(local)
        * 4 / cycleDuration ** 2,
      direction: 'cord-released-and-elastic-bar-relaxing',
      rate: -bendSpan * smootherStepDerivative(local) * 2 / cycleDuration,
      value: 1 - bendSpan * smootherStep(local),
    };
  };

  const relaxedTip = pointOnWorkingEdge(1, minimumBend);
  const relaxedCordLength = relaxedTip.distanceTo(slidePin);
  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(
      cycleCoordinate + sourcePhaseOffset,
      1,
    );
    const bendLaw = bendLawAtCyclePhase(cyclePhase);
    const bend = bendLaw.value;
    const bendRate = bendLaw.rate;
    const bendAcceleration = bendLaw.acceleration;
    const totalTurningAngle = maximumTurningAngle * bend;
    const turningRate = maximumTurningAngle * bendRate;
    const turningAcceleration = maximumTurningAngle * bendAcceleration;
    const functions = taperedBendIntegrals(totalTurningAngle);
    const tip = new THREE.Vector2(
      leftSpringingX + elasticBarLength * functions.f,
      springingY + elasticBarLength * functions.g,
    );
    if(bend===1)tip.copy(apex);
    const tipVelocity = new THREE.Vector2(
      elasticBarLength * functions.f1 * turningRate,
      elasticBarLength * functions.g1 * turningRate,
    );
    const tipAcceleration = new THREE.Vector2(
      elasticBarLength * (
        functions.f2 * turningRate ** 2
          + functions.f1 * turningAcceleration
      ),
      elasticBarLength * (
        functions.g2 * turningRate ** 2
          + functions.g1 * turningAcceleration
      ),
    );
    const cordVector = tip.clone().sub(slidePin);
    const workingCordLength = cordVector.length();
    const cordDirection = cordVector.clone().normalize();
    const workingCordSpeed = cordDirection.dot(tipVelocity);
    const path = pathAtBend(bend);
    const baseTangent = tangentOnWorkingEdge(0, bend);
    const tipTangent = tangentOnWorkingEdge(1, bend);
    return {
      apexAlignmentResidual: bend === 1 ? tip.x - apex.x : null,
      barAnalyticLengthResidual: 0,
      barPolylineLengthResidual:
        path.polylineLength - elasticBarLength,
      basePositionResidual:
        path.outerPoints[0].distanceTo(new THREE.Vector2(
          leftSpringingX,
          springingY,
        )),
      baseTangent,
      baseTangencyResidual: baseTangent.x,
      bend,
      bendAcceleration,
      bendLaw,
      bendRate,
      cordTakeUp: relaxedCordLength - workingCordLength,
      cycleCoordinate,
      cyclePhase,
      path,
      slidePin: slidePin.clone(),
      tip,
      tipAcceleration,
      tipTangent,
      tipVelocity,
      totalTurningAngle,
      turningAcceleration,
      turningRate,
      workingCordLength,
      workingCordSpeed,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const path = updateBarGeometry(state.bend);
    pencil.position.set(state.tip.x, state.tip.y, 0);
    cord.userData.setEndpoints(
      new THREE.Vector3(state.slidePin.x, state.slidePin.y, 0.33),
      new THREE.Vector3(state.tip.x, state.tip.y, 0.33),
    );
    root.userData.contacts = {
      barAtFixedClamp: {
        active: true,
        point: path.outerPoints[0],
        positionResidual: state.basePositionResidual,
        tangencyResidual: state.baseTangencyResidual,
      },
      cordAtSlidePin: {
        active: true,
        point: state.slidePin,
      },
      cordAtTipAndPencil: {
        active: true,
        point: state.tip,
      },
      slideInHorizontalSlot: {
        active: true,
        locked: true,
        slotRange: [slotLeft, slotRight],
      },
    };
    root.userData.updateWorkingParts?.(state);
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'cord-set-inextensible-elastic-wood-half-arch-clamped-tangent-to-jamb-with-locked-apex-slide-and-tip-pencil',
    bendLawAtCyclePhase,
    blocks: {
      baseBar,
      board,
      boardFrame,
      cord,
      cordLoop,
      elasticBar,
      fulcrumPiece,
      jambs,
      pencil,
      prescribedPoints,
      slide,
      slideBlock,
      slideIndex,
      slot,
      springingLine,
      targetArch,
      workingEdge,
    },
    constraints: {
      bar:
        'One elastic wood bar keeps one working-edge material length; its fixed end stays at the left springing point with tangent parallel to the jamb.',
      cord:
        'One working cord joins the bar-tip/pencil collar to the loop pin on the locked horizontal slide; the operator takes up cord to set the bend.',
      finalArch:
        'At greatest bend the left working edge is one monotone tapering-curvature half-arch from springing point to apex, and its mirror forms a genuine pointed crown.',
      slide:
        'The slide is first positioned beneath the selected apex and locked; it is an adjustment coordinate, not a second cyclic actuator.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'tapering-curvature elastic-bar profile',
        'bar-tip and pencil coordinates',
        'working cord length and take-up',
      ],
      independentPrescribedInputs: 1,
      inputs: ['operator cord take-up after locking the apex slide'],
      note:
        'The source fixes only the configured geometry. The displayed release/reset cycle is a disclosed quasi-static setup demonstration.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'one inextensible elastic working edge with uniform curvature at each displayed setup pose',
        'rigid base, fulcrum, locked slide, cord pin, and pencil collar',
        'massless cord with operator-controlled take-up',
        'bar modulus, bending stiffness, distributed load, cord tension, friction, and hysteresis omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless quasi-static flexible-template setup kinematics',
    },
    fidelity: 'authored',
    geometry: {
      apex,
      barDepth,
      barSampleCount,
      barThickness,
      cycleDuration,
      elasticBarLength,
      halfSpan,
      leftSpringingX,
      maximumTurningAngle,
      minimumBend,
      relaxedCordLength,
      rightSpringingX,
      rise,
      slidePin,
      slotLeft,
      slotRight,
      sourcePhaseOffset,
      springingY,
    },
    mechanism:
      'one elastic wood arch bar is fixed at right angles to a horizontal slotted bar, a base fulcrum preserves tangency to the jamb, a cord runs from its pencil-carrying tip to a pin on the locked apex slide, and cord take-up sets the half-arch to the selected crown',
    motion: {
      cycleDuration,
      sequence:
        'source greatest-bend arch -> cord released and bar returns straight along jamb -> cord taken up and bar returns to selected apex',
      sourcePosePhase: 0,
    },
    pathAtBend,
    pointOnWorkingEdge,
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 407 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate407: {
        apexApproximatePixels: sourceRasterApex.toArray(),
        fulcrumApproximateBoundsPixels: sourceRasterFulcrumBounds,
        horizontalBarApproximateBoundsPixels:
          sourceRasterHorizontalBarBounds,
        imageHeight: sourceImageHeight,
        imageWidth: sourceImageWidth,
        jambApproximateBoundsPixels: sourceRasterJambBounds,
        measurementUncertaintyPixels: 8,
        slidePinApproximatePixels: sourceRasterSlidePin.toArray(),
        slotApproximateBoundsPixels: sourceRasterSlotBounds,
        springingApproximatePixels: sourceRasterSpringing.toArray(),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one horizontal bar is slotted',
          'the slot contains a slide with a pin for the cord loop',
          'one elastic wood arch bar is fixed to the horizontal bar at right angles',
          'the horizontal bar upper edge is placed on the springing line',
          'the back of the arch bar is aligned with the jamb',
          'a fulcrum piece preserves the bar’s tangential relation to the jamb',
          'the elastic bar is bent until its upper side meets the apex',
          'the pencil is secured where the cord connects to the arched bar',
        ],
        engravingEvidence:
          'The plate shows one long slotted base on the springing line, one slide pin beneath the crown, one nearly vertical cord, one thick elastic strip fixed at the left base and bowed to the crown, a small tip collar, and a jamb reference behind the strip.',
        reconstructionDisclosure:
          'Brown gives no bar length, section, elastic modulus, force law, cord length, slide procedure, exact arch family, dimensions, or timing. An inextensible tapering-curvature pointed profile is selected for the normalized final pose; tapering-curvature intermediate setup shapes and operator cord take-up are independently synthesized and identified as such.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 407',
    },
    sourcePose: {
      bend: sourceState.bend,
      pencilPoint: sourceState.tip,
      setting:
        'cord vertical beneath the apex and elastic bar at greatest bend, matching Brown’s engraving',
    },
    stateAtTime,
    tangentOnWorkingEdge,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      finalArcRelation:
        'theta(u)=phi*(2u-u^2); phi and length match the prescribed span and rise with a monotone rising tangent',
      inextensibleBarRelation:
        'working-edge arclength is constant for every displayed bend',
      setupRelation:
        'total turning angle equals maximum turning angle times the single bend coordinate',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.28, -0.96, -0.48),
    new THREE.Vector3(3.28, 4.13, 0.78),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(5.5, 3.3, 12.4);
  root.userData.groundFloorY = -0.96;
  markShadows(root);
  board.receiveShadow = true;
  targetArch.left.castShadow = false;
  targetArch.right.castShadow = false;
  updateBarGeometry(1);
  update(0);
  correctDrawingTemplateParts(root,407,update);
  // The loop round the slide pin is the same cord: a closed laid-rope ring
  // on the helper's finite loop radius.
  {
    const loop = root.userData.blocks.cordLoop;
    const loopRadius = loop.geometry.parameters.radius;
    const loopTube = loop.geometry.parameters.tube;
    const circle = new THREE.EllipseCurve(0, 0, loopRadius, loopRadius);
    const ring = new THREE.CatmullRomCurve3(
      circle.getSpacedPoints(96).slice(0, -1).map((p) => new THREE.Vector3(p.x, p.y, 0)),
      true,
    );
    loop.geometry.dispose();
    loop.geometry = new LaidRopeGeometry(ring, 128, loopTube, 8, true);
    loop.material = root.userData.blocks.cord.material;
    loop.userData.crossSection = 'laid-rope';
  }
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredPointedArchMovement(movement) {
  if (movement.id !== 407) return null;
  return pointedArchInstrument(movement);
}
