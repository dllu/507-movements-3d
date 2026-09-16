import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredJournal, fitPistonGuide} from './piston-guide-parts.js';

const GUIDE_RADIUS = .065;
const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
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

function cylinderAlongZ(radius, depth, material, segments = 36) {
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
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(64, points.length * 2),
      radius,
      8,
      false,
    ),
    material,
  );
}

function makeRule({
  depth,
  lengthMax,
  lengthMin,
  material,
  outsideSide,
  role,
  whiteMaterial,
  width,
}) {
  const rule = new THREE.Group();
  rule.userData.role = role;
  const length = lengthMax - lengthMin;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    material,
  );
  body.position.set(
    (lengthMin + lengthMax) / 2,
    outsideSide * (width / 2 + GUIDE_RADIUS),
    0,
  );
  body.userData.role = `${role}-straight-rigid-body`;
  rule.add(body);
  const workingEdge = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.032, depth * 0.24),
    whiteMaterial,
  );
  workingEdge.position.set((lengthMin + lengthMax) / 2,
    outsideSide * (GUIDE_RADIUS + .016), depth * 0.58);
  workingEdge.userData.role = `${role}-pin-contact-working-edge`;
  rule.add(workingEdge);
  const endMarks = [lengthMin + 0.22, lengthMax - 0.22].map((x, index) => {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, width * 0.72, depth * 0.16),
      whiteMaterial,
    );
    mark.position.set(x, outsideSide * (width / 2 + GUIDE_RADIUS), depth * 0.59);
    mark.userData.role = `${role}-end-index-${index + 1}`;
    rule.add(mark);
    return mark;
  });
  return {
    body,
    endMarks,
    rule,
    workingEdge,
  };
}

function cyclograph(movement) {
  const root = new THREE.Group();
  const chordHalf = 2.80;
  const chordLength = chordHalf * 2;
  const sagitta = 1.65;
  const circleCenter = new THREE.Vector2(
    0,
    (sagitta ** 2 - chordHalf ** 2) / (2 * sagitta),
  );
  const circleRadius = (sagitta ** 2 + chordHalf ** 2)
    / (2 * sagitta);
  const rightEndpointAngle = Math.atan2(
    -circleCenter.y,
    chordHalf,
  );
  const leftEndpointAngle = Math.PI - rightEndpointAngle;
  const endpointMarginAngle = 0.055;
  const traceStartAngle = leftEndpointAngle - endpointMarginAngle;
  const traceEndAngle = rightEndpointAngle + endpointMarginAngle;
  const traceAngleSpan = traceEndAngle - traceStartAngle;
  const includedRuleAngle = 2 * Math.atan(chordHalf / sagitta);
  const leftGuidePin = new THREE.Vector2(-chordHalf, 0);
  const rightGuidePin = new THREE.Vector2(chordHalf, 0);
  const ruleLengthMin = -0.62;
  const ruleLengthMax = 6.34;
  const ruleWidth = 0.25;
  const ruleDepth = 0.14;
  const braceDistance = 3.05;
  const braceOverhang = 0.29;
  const cycleDuration = 6;
  const sourcePhaseOffset = 0.25;

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterLeftChordEnd = new THREE.Vector2(90, 350);
  const sourceRasterRightChordEnd = new THREE.Vector2(462, 350);
  const sourceRasterApex = new THREE.Vector2(278, 237);
  const sourceRasterBraceLeft = new THREE.Vector2(72, 351);
  const sourceRasterBraceRight = new THREE.Vector2(480, 351);

  const rulerMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const fixedMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.63,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.46,
  });
  const pencilMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.55,
  });
  const traceMaterial = matte(PALETTE.driver, {
    metalness: 0.04,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });
  const paperMaterial = matte(PALETTE.paper, { roughness: 1 });

  const travelLawAtCyclePhase = (cyclePhase) => {
    if (cyclePhase < 0.5) {
      const local = cyclePhase * 2;
      return {
        acceleration: smootherStepSecondDerivative(local)
          * 4 / cycleDuration ** 2,
        direction: 'left-to-right-tracing-stroke',
        rate: smootherStepDerivative(local) * 2 / cycleDuration,
        value: smootherStep(local),
      };
    }
    const local = (cyclePhase - 0.5) * 2;
    return {
      acceleration: -smootherStepSecondDerivative(local)
        * 4 / cycleDuration ** 2,
      direction: 'right-to-left-return-stroke',
      rate: -smootherStepDerivative(local) * 2 / cycleDuration,
      value: 1 - smootherStep(local),
    };
  };

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(
      cycleCoordinate + sourcePhaseOffset,
      1,
    );
    const travel = travelLawAtCyclePhase(cyclePhase);
    const traceAngle = traceStartAngle + traceAngleSpan * travel.value;
    const traceAngularSpeed = traceAngleSpan * travel.rate;
    const traceAngularAcceleration = traceAngleSpan
      * travel.acceleration;
    const cosine = Math.cos(traceAngle);
    const sine = Math.sin(traceAngle);
    const pencilPoint = circleCenter.clone().add(new THREE.Vector2(
      circleRadius * cosine,
      circleRadius * sine,
    ));
    const pencilVelocity = new THREE.Vector2(
      -circleRadius * sine * traceAngularSpeed,
      circleRadius * cosine * traceAngularSpeed,
    );
    const pencilAcceleration = new THREE.Vector2(
      circleRadius * (
        -cosine * traceAngularSpeed ** 2
        - sine * traceAngularAcceleration
      ),
      circleRadius * (
        -sine * traceAngularSpeed ** 2
        + cosine * traceAngularAcceleration
      ),
    );
    const leftVector = leftGuidePin.clone().sub(pencilPoint);
    const rightVector = rightGuidePin.clone().sub(pencilPoint);
    const carriageAngle = Math.atan2(leftVector.y, leftVector.x);
    const rightRuleAngle = carriageAngle + includedRuleAngle;
    const leftContactLocal = rotate2(leftVector, -carriageAngle);
    const rightContactLocal = rotate2(rightVector, -rightRuleAngle);
    const measuredIncludedAngle = Math.acos(THREE.MathUtils.clamp(
      leftVector.dot(rightVector)
        / (leftVector.length() * rightVector.length()),
      -1,
      1,
    ));
    const leftVectorVelocity = pencilVelocity.clone().multiplyScalar(-1);
    const leftVectorAcceleration = pencilAcceleration.clone()
      .multiplyScalar(-1);
    const leftDistanceSquared = leftVector.lengthSq();
    const angleNumerator = leftVector.x * leftVectorVelocity.y
      - leftVector.y * leftVectorVelocity.x;
    const carriageAngularSpeed = angleNumerator / leftDistanceSquared;
    const carriageAngularAcceleration = (
      (
        leftVector.x * leftVectorAcceleration.y
        - leftVector.y * leftVectorAcceleration.x
      ) / leftDistanceSquared
      - 2 * angleNumerator
        * leftVector.dot(leftVectorVelocity) / leftDistanceSquared ** 2
    );
    const velocityOfRuleAtPin = (guidePin) => {
      const radiusVector = guidePin.clone().sub(pencilPoint);
      return pencilVelocity.clone().add(new THREE.Vector2(
        -carriageAngularSpeed * radiusVector.y,
        carriageAngularSpeed * radiusVector.x,
      ));
    };
    const leftWorkingNormal = new THREE.Vector2(
      -Math.sin(carriageAngle),
      Math.cos(carriageAngle),
    );
    const rightWorkingNormal = new THREE.Vector2(
      -Math.sin(rightRuleAngle),
      Math.cos(rightRuleAngle),
    );
    const leftNormalVelocityError = velocityOfRuleAtPin(leftGuidePin)
      .dot(leftWorkingNormal);
    const rightNormalVelocityError = velocityOfRuleAtPin(rightGuidePin)
      .dot(rightWorkingNormal);
    return {
      carriageAngle,
      carriageAngularAcceleration,
      carriageAngularSpeed,
      circleConstraintResidual:
        pencilPoint.distanceTo(circleCenter) - circleRadius,
      cycleCoordinate,
      cyclePhase,
      includedAngleResidual: measuredIncludedAngle - includedRuleAngle,
      leftContactLocal,
      leftGuideConstraintResidual: leftContactLocal.y,
      leftNormalVelocityError,
      measuredIncludedAngle,
      pencilAcceleration,
      pencilPoint,
      pencilSpeed: pencilVelocity.length(),
      pencilVelocity,
      rightContactLocal,
      rightGuideConstraintResidual: rightContactLocal.y,
      rightNormalVelocityError,
      rightRuleAngle,
      traceAngle,
      traceAngularAcceleration,
      traceAngularSpeed,
      travel,
    };
  };

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(8.70, 5.80, 0.10),
    paperMaterial,
  );
  board.position.set(0, -0.20, -0.25);
  board.userData.role = 'fixed-drawing-board';
  root.add(board);
  const boardBorder = [
    [[-4.35, -3.10], [4.35, -3.10]],
    [[4.35, -3.10], [4.35, 2.70]],
    [[4.35, 2.70], [-4.35, 2.70]],
    [[-4.35, 2.70], [-4.35, -3.10]],
  ].map(([start, end], index) => {
    const border = beamBetween(
      new THREE.Vector3(start[0], start[1], -0.17),
      new THREE.Vector3(end[0], end[1], -0.17),
      0.045,
      0.035,
      fixedMaterial,
    );
    border.userData.role = `drawing-board-border-${index + 1}`;
    root.add(border);
    return border;
  });

  const chordLine = beamBetween(
    new THREE.Vector3(-chordHalf, 0, -0.11),
    new THREE.Vector3(chordHalf, 0, -0.11),
    0.032,
    0.025,
    fixedMaterial,
  );
  chordLine.userData.role = 'laid-out-chord-line';
  const versedSineLine = beamBetween(
    new THREE.Vector3(0, 0, -0.105),
    new THREE.Vector3(0, sagitta, -0.105),
    0.028,
    0.026,
    fixedMaterial,
  );
  versedSineLine.userData.role = 'laid-out-versed-sine';
  root.add(chordLine, versedSineLine);

  const arcPoints = Array.from({ length: 161 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(
      leftEndpointAngle,
      rightEndpointAngle,
      index / 160,
    );
    return new THREE.Vector3(
      circleCenter.x + circleRadius * Math.cos(angle),
      circleCenter.y + circleRadius * Math.sin(angle),
      -0.075,
    );
  });
  const describedArc = lineTube(arcPoints, 0.026, traceMaterial);
  describedArc.userData.role =
    'circular-arc-described-by-pencil-at-crossing-angle';
  root.add(describedArc);

  const guidePins = [
    [leftGuidePin, 'left-fixed-chord-end-guide-pin'],
    [rightGuidePin, 'right-fixed-chord-end-guide-pin'],
  ].map(([position, role]) => {
    const assembly = new THREE.Group();
    assembly.position.set(position.x, position.y, 0);
    assembly.userData.role = role;
    const washer = cylinderAlongZ(0.16, 0.075, darkMaterial, 36);
    washer.position.z = -0.03;
    washer.userData.role = `${role}-base-washer`;
    const pin = cylinderAlongZ(GUIDE_RADIUS, 0.56, darkMaterial, 28);
    pin.position.z = 0.18;
    pin.userData.role = `${role}-stationary-point`;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 18, 14),
      whiteMaterial,
    );
    cap.position.z = 0.47;
    cap.userData.role = `${role}-white-cap`;
    assembly.add(washer, pin, cap);
    root.add(assembly);
    return { assembly, cap, pin, washer };
  });

  const carriage = new THREE.Group();
  carriage.position.z = 0.20;
  carriage.userData.role =
    'single-rigid-three-rule-cyclograph-carriage';
  root.add(carriage);
  const leftRule = makeRule({
    depth: ruleDepth,
    lengthMax: ruleLengthMax,
    lengthMin: ruleLengthMin,
    material: rulerMaterial,
    outsideSide: -1,
    role: 'left-sloping-rule-guided-by-left-chord-pin',
    whiteMaterial,
    width: ruleWidth,
  });
  carriage.add(leftRule.rule);
  const rightRule = makeRule({
    depth: ruleDepth,
    lengthMax: ruleLengthMax,
    lengthMin: ruleLengthMin,
    material: rulerMaterial,
    outsideSide: 1,
    role: 'right-sloping-rule-guided-by-right-chord-pin',
    whiteMaterial,
    width: ruleWidth,
  });
  rightRule.rule.rotation.z = includedRuleAngle;
  rightRule.rule.position.z = 0.055;
  carriage.add(rightRule.rule);

  const leftBracePoint = new THREE.Vector2(
    braceDistance,
    -(ruleWidth / 2 + GUIDE_RADIUS),
  );
  const rightBracePoint = rotate2(
    new THREE.Vector2(braceDistance, ruleWidth / 2 + GUIDE_RADIUS),
    includedRuleAngle,
  );
  const braceDirection = rightBracePoint.clone().sub(leftBracePoint)
    .normalize();
  const braceStart = leftBracePoint.clone().addScaledVector(
    braceDirection,
    -braceOverhang,
  );
  const braceEnd = rightBracePoint.clone().addScaledVector(
    braceDirection,
    braceOverhang,
  );
  const brace = beamBetween(
    new THREE.Vector3(braceStart.x, braceStart.y, .42),
    new THREE.Vector3(braceEnd.x, braceEnd.y, .42),
    0.22,
    0.12,
    rulerMaterial,
  );
  brace.userData.role = 'third-straight-rule-fastened-across-as-brace';
  carriage.add(brace);
  const bracePins = [leftBracePoint, rightBracePoint].map((position, index) => {
    const pin = cylinderAlongZ(0.085, .59, whiteMaterial, 28);
    pin.position.set(position.x, position.y, .225);
    pin.userData.role = `fixed-brace-fastener-${index + 1}`;
    carriage.add(pin);
    return pin;
  });
  const apexFastener = boredJournal(.12, .068, .36, darkMaterial);
  apexFastener.position.z = 0.17;
  apexFastener.userData.role =
    'fastened-crossing-of-the-two-sloping-rules';
  carriage.add(apexFastener);

  const pencil = new THREE.Group();
  pencil.userData.role = 'pencil-at-angle-of-crossing-rule-edges';
  const pencilShaft = cylinderAlongZ(GUIDE_RADIUS, .97, pencilMaterial, 64);
  pencilShaft.position.z = .615;
  pencilShaft.userData.role = 'pencil-shaft-perpendicular-to-drawing-plane';
  const pencilTip = new THREE.Mesh(
    new THREE.ConeGeometry(GUIDE_RADIUS, .205, 64),
    pencilMaterial,
  );
  pencilTip.rotation.x = Math.PI / 2;
  pencilTip.position.z = .0275;
  pencilTip.userData.role = 'pencil-point-touching-described-arc';
  const graphite = new THREE.Mesh(
    new THREE.SphereGeometry(.01, 16, 12),
    darkMaterial,
  );
  graphite.position.z = -.075;
  graphite.userData.role = 'graphite-contact-at-rule-edge-intersection';
  pencil.add(pencilShaft, pencilTip, graphite);
  root.add(pencil);

  const update = (time) => {
    const state = stateAtTime(time);
    carriage.position.set(
      state.pencilPoint.x,
      state.pencilPoint.y,
      0.20,
    );
    carriage.rotation.z = state.carriageAngle;
    pencil.position.set(
      state.pencilPoint.x,
      state.pencilPoint.y,
      0,
    );
    root.userData.contacts = {
      leftPinToLeftRuleEdge: {
        active: true,
        localCoordinate: state.leftContactLocal,
        normalPositionError: state.leftGuideConstraintResidual,
        normalVelocityError: state.leftNormalVelocityError,
      },
      pencilToTargetCircle: {
        active: true,
        radialError: state.circleConstraintResidual,
      },
      rightPinToRightRuleEdge: {
        active: true,
        localCoordinate: state.rightContactLocal,
        normalPositionError: state.rightGuideConstraintResidual,
        normalVelocityError: state.rightNormalVelocityError,
      },
    };
    root.userData.kinematics = state;
  };

  const sourcePoseState = stateAtTime(0);
  root.userData = {
    archetype:
      'three-rigid-rule-cyclograph-guided-by-two-fixed-chord-end-pins-with-pencil-intersection-tracing-constant-angle-circle',
    blocks: {
      apexFastener,
      board,
      boardBorder,
      brace,
      bracePins,
      carriage,
      chordLine,
      describedArc,
      graphite,
      guidePins,
      leftRule,
      pencil,
      pencilShaft,
      pencilTip,
      rightRule,
      versedSineLine,
    },
    constraints: {
      brace:
        'The third straight rule joins fixed points on both sloping rules, so all three rules form one rigid planar carriage with a constant included angle.',
      circle:
        'The pencil intersection sees the fixed chord endpoints under one constant included angle; by the inscribed-angle locus it remains on the unique circle through the chord endpoints and prescribed versed-sine apex.',
      leftGuide:
        'The left fixed chord-end pin remains on the designated straight working edge of the left sloping rule and slides only along that edge.',
      rightGuide:
        'The right fixed chord-end pin remains on the designated straight working edge of the right sloping rule and slides only along that edge.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'planar translation of the rigid three-rule carriage',
        'planar rotation of the rigid three-rule carriage',
        'pencil position at the crossing of the two working edges',
      ],
      independentPrescribedInputs: 1,
      inputs: ['position along the circular drawing stroke'],
      note:
        'A free planar rigid body has three coordinates; the two independent fixed-pin-on-rule-line constraints leave the one drawing degree of freedom shown by Brown.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'three perfectly rigid straight rules and rigid fasteners',
        'equal-radius guide pins and pencil barrel; parallel rule edges offset by that radius retain the exact circle locus',
        'massless quasi-static hand guidance with no friction, pencil drag, or compliance',
        'the cycle reverses smoothly short of each singular chord endpoint',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless exact planar constraint reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      braceDistance,
      braceLength: braceStart.distanceTo(braceEnd),
      braceOverhang,
      chordHalf,
      chordLength,
      circleCenter,
      circleRadius,
      cycleDuration,
      endpointMarginAngle,
      includedRuleAngle,
      leftEndpointAngle,
      leftGuidePin,
      rightEndpointAngle,
      rightGuidePin,
      guideRadius: GUIDE_RADIUS,
      ruleDepth,
      ruleLengthMax,
      ruleLengthMin,
      ruleWidth,
      sagitta,
      sourcePhaseOffset,
      traceAngleSpan,
      traceEndAngle,
      traceStartAngle,
    },
    mechanism:
      'two straight sloping rules are fastened at a constant crossing angle and held rigid by one transverse third-rule brace; one fixed pin at each chord end slides along its corresponding working edge, forcing the pencil at the edge intersection to follow a circular arc',
    motion: {
      cycleDuration,
      sequence:
        'trace from near the left chord-end singularity across the prescribed circular arc to near the right endpoint -> reverse with zero speed and acceleration -> retrace to the left -> reverse smoothly',
      tracedArcAngle: Math.abs(traceAngleSpan),
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasModelPresent: true,
      sourcePrescribedAbsoluteTiming: false,
      usedAsVisualReferenceOnly: true,
      visualEvidence:
        'The official canvas shows the two green chord-end pins fixed while the blue three-rule assembly moves, the red pencil stays at the sloping-rule intersection, and that intersection follows the red circular arc.',
    },
    sourceReference: {
      brownPlate403: {
        apexApproximatePixels: sourceRasterApex.toArray(),
        braceApproximateEndpointsPixels: [
          ...sourceRasterBraceLeft.toArray(),
          ...sourceRasterBraceRight.toArray(),
        ],
        imageHeight: sourceImageHeight,
        imageWidth: sourceImageWidth,
        leftChordEndApproximatePixels: sourceRasterLeftChordEnd.toArray(),
        measurementUncertaintyPixels: 9,
        rightChordEndApproximatePixels: sourceRasterRightChordEnd.toArray(),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the cyclograph is composed of three straight rules',
          'two rules are laid to the sloping construction lines and cross at the apex',
          'the two sloping rules are fastened together',
          'another rule is fastened across them as a brace',
          'one pin at each chord end guides the apparatus',
          'the pencil lies in the angle of the crossing edges and describes the arc',
        ],
        engravingEvidence:
          'The plate shows two long crossing rules, a transverse third-rule brace, the prescribed chord and curved arc, and the apex where the sloping working edges cross.',
        geometricInference:
          'The written two-pin guidance is interpreted literally as two point-on-line constraints on one braced rigid body. Circle radius, center, rule angle, and motion are derived from the normalized chord and versed sine rather than copied from the proprietary canvas coordinates.',
        reconstructionDisclosure:
          'Brown supplies no dimensions, stroke timing, ruler thickness, pin diameter, or endpoint clearance. The proportions are normalized from the engraving and the smooth reciprocating time law is independently synthesized.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 403',
    },
    stateAtTime,
    sourcePose: {
      cyclePhase: sourcePoseState.cyclePhase,
      pencilPoint: sourcePoseState.pencilPoint,
    },
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      constraintCount: 2,
      locus:
        '|P-circleCenter|=circleRadius while A and B lie on the two constant-angle rule edges through P',
      planarRigidBodyCoordinates: 3,
      remainingDegreesOfFreedom: 1,
    },
    travelLawAtCyclePhase,
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.78, -3.34, -0.38),
    new THREE.Vector3(5.78, 2.92, 1.48),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.4, 5.4, 11.6);
  root.userData.groundFloorY = -3.12;
  markShadows(root);
  for (const object of [board, describedArc, chordLine, versedSineLine]) {
    object.castShadow = false;
  }
  // The construction lines define a drawing plane without an opaque board
  // obscuring the mechanism when the user orbits underneath it.
  root.remove(board, ...boardBorder);
  root.userData.cameraFov = 8;
  root.userData.cameraDirection = new THREE.Vector3(0, .8, 12);
  fitPistonGuide(root, update, cycleDuration);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredCyclographMovement(movement) {
  if (movement.id !== 403) return null;
  return cyclograph(movement);
}
