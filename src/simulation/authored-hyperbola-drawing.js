import {installHyperbolaFiniteGeometry} from './hyperbola-finite-cord.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 14),
    material,
  );
  cord.userData.setEndpoints = (start, end) => {
    const delta = end.clone().sub(start);
    cord.position.copy(start).add(end).multiplyScalar(0.5);
    cord.scale.set(1, delta.length(), 1);
    cord.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
  };
  return cord;
}

function hyperbolaDrawingInstrument(movement) {
  const root = new THREE.Group();
  const semiTransverseAxis = 0.90;
  const focalHalfDistance = 1.32;
  const semiConjugateAxis = Math.sqrt(
    focalHalfDistance ** 2 - semiTransverseAxis ** 2,
  );
  const focusSeparation = 2 * focalHalfDistance;
  const distanceDifference = 2 * semiTransverseAxis;
  const ruleLength = 4.45;
  const threadLength = ruleLength - distanceDifference;
  const asymptoteAngle = Math.acos(
    semiTransverseAxis / focalHalfDistance,
  );
  const maximumRuleAngle = THREE.MathUtils.degToRad(30);
  const cycleDuration = 8;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterUpperFocus = new THREE.Vector2(292, 168);
  const sourceRasterLowerFocus = new THREE.Vector2(290, 379);
  const sourceRasterUpperVertex = new THREE.Vector2(292, 200);
  const sourceRasterLowerVertex = new THREE.Vector2(291, 345);
  const sourceRasterRuleEnd = new THREE.Vector2(166, 503);
  const sourceRasterHorizontalAxisY = 273;
  const sourceRuleAngle = Math.atan2(
    sourceRasterRuleEnd.x - sourceRasterUpperFocus.x,
    sourceRasterRuleEnd.y - sourceRasterUpperFocus.y,
  );
  const sourcePhaseAngle = Math.asin(
    sourceRuleAngle / maximumRuleAngle,
  );
  const sourcePhaseOffset = positiveModulo(
    sourcePhaseAngle / FULL_TURN,
    1,
  );
  const targetHalfWidth = 2.10;
  const upperFocus = new THREE.Vector2(0, focalHalfDistance);
  const lowerFocus = new THREE.Vector2(0, -focalHalfDistance);

  const ruleMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
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
    new THREE.BoxGeometry(5.76, 5.08, 0.16),
    boardMaterial,
  );
  board.position.set(0, -0.48, -0.34);
  board.userData.role =
    'fixed-drawing-board-presentational-support-not-source-hardware';
  root.add(board);
  const boardFrame = new THREE.Group();
  boardFrame.userData.role = 'fixed-drawing-board-border';
  for (const x of [-2.93, 2.93]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 5.19, 0.22),
      frameMaterial,
    );
    rail.position.set(x, -0.48, -0.27);
    boardFrame.add(rail);
  }
  for (const y of [-3.08, 2.12]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(5.97, 0.11, 0.22),
      frameMaterial,
    );
    rail.position.set(0, y, -0.27);
    boardFrame.add(rail);
  }
  root.add(boardFrame);

  // Brown's dotted axes are construction notation and are not drawn.

  const hyperbolaY = (x, branchSign) => (
    branchSign * semiTransverseAxis * Math.sqrt(
      1 + x ** 2 / semiConjugateAxis ** 2,
    )
  );
  const makeTargetBranch = (branchSign, role) => {
    const points = Array.from({ length: 129 }, (_, index) => {
      const x = THREE.MathUtils.lerp(
        -targetHalfWidth,
        targetHalfWidth,
        index / 128,
      );
      return new THREE.Vector3(x, hyperbolaY(x, branchSign), -0.145);
    });
    const branch = lineTube(points, 0.026, driverMaterial);
    branch.userData.role = role;
    root.add(branch);
    return branch;
  };
  const targetBranches = {
    lower: makeTargetBranch(
      -1,
      'required-lower-hyperbola-branch-traced-by-instrument',
    ),
    upper: makeTargetBranch(
      1,
      'opposite-hyperbola-branch-shown-in-brown-engraving',
    ),
  };
  const targetVertices = [-1, 1].map((branchSign, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 16, 12),
      whiteMaterial,
    );
    marker.position.set(
      0,
      branchSign * semiTransverseAxis,
      -0.095,
    );
    marker.userData.role = index === 0
      ? 'given-lower-hyperbola-vertex'
      : 'given-upper-hyperbola-vertex';
    root.add(marker);
    return marker;
  });

  const makeFocusPin = (point, role) => {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, 0.04);
    group.userData.role = role;
    const axle = cylinderAlongZ(0.070, 0.58, darkMaterial, 28);
    axle.userData.role = `${role}-fixed-axle`;
    const collar = cylinderAlongZ(0.175, 0.17, accentMaterial, 38);
    collar.position.z = 0.09;
    collar.userData.role = `${role}-brass-collar`;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.060, 18, 12),
      whiteMaterial,
    );
    cap.position.z = 0.34;
    cap.userData.role = `${role}-white-center-index`;
    group.add(axle, collar, cap);
    root.add(group);
    return { axle, cap, collar, group };
  };
  const upperFocusPin = makeFocusPin(
    upperFocus,
    'upper-focus-rule-pivot',
  );
  const lowerFocusPin = makeFocusPin(
    lowerFocus,
    'lower-focus-fixed-thread-loop-pin',
  );
  const lowerThreadLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.025, 10, 36),
    darkMaterial,
  );
  lowerThreadLoop.position.set(lowerFocus.x, lowerFocus.y, 0.255);
  lowerThreadLoop.userData.role =
    'thread-end-looped-around-lower-focus-pin';
  root.add(lowerThreadLoop);

  const rule = new THREE.Group();
  rule.position.set(upperFocus.x, upperFocus.y, 0.035);
  rule.userData.role =
    'single-straight-rule-pivoted-at-upper-focus';
  const ruleBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, ruleLength, 0.16),
    ruleMaterial,
  );
  ruleBody.position.y = -ruleLength / 2;
  ruleBody.userData.role =
    'straight-working-edge-carrying-thread-end';
  rule.add(ruleBody);
  const ruleTicks = Array.from({ length: 10 }, (_, index) => {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.145, 0.025, 0.022),
      whiteMaterial,
    );
    tick.position.set(0, -ruleLength * (index + 0.65) / 10.7, 0.095);
    tick.userData.role = `rule-distance-index-${index + 1}`;
    rule.add(tick);
    return tick;
  });
  const ruleEndCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, 0.20),
    ruleMaterial,
  );
  ruleEndCap.position.y = -ruleLength;
  ruleEndCap.userData.role = 'free-end-of-rule';
  rule.add(ruleEndCap);
  const threadAnchor = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    whiteMaterial,
  );
  threadAnchor.position.set(0, -ruleLength, 0.220);
  threadAnchor.userData.role = 'thread-end-fixed-to-free-end-of-rule';
  rule.add(threadAnchor);
  root.add(rule);

  const focusCord = makeDynamicCord(0.025, darkMaterial);
  focusCord.userData.role =
    'taut-thread-segment-from-lower-focus-loop-to-pencil-bight';
  root.add(focusCord);
  const ruleCord = makeDynamicCord(0.025, darkMaterial);
  ruleCord.userData.role =
    'taut-thread-segment-from-pencil-bight-to-rule-end';
  root.add(ruleCord);

  const pencil = new THREE.Group();
  pencil.userData.role =
    'pencil-held-in-thread-bight-and-against-rule';
  const pencilBarrel = cylinderAlongZ(0.085, 0.55, driverMaterial, 30);
  pencilBarrel.position.z = 0.18;
  pencilBarrel.userData.role = 'moving-pencil-barrel';
  const pencilCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.085, 0.16, 30),
    accentMaterial,
  );
  pencilCone.rotation.x = Math.PI / 2;
  pencilCone.position.z = -0.175;
  pencilCone.userData.role = 'moving-pencil-conical-tip';
  const pencilPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 14, 10),
    darkMaterial,
  );
  pencilPoint.position.z = -0.265;
  pencilPoint.userData.role = 'pencil-point-on-hyperbola';
  const bightCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.026, 10, 36),
    whiteMaterial,
  );
  bightCollar.position.z = 0.255;
  bightCollar.userData.role = 'white-thread-bight-around-pencil';
  pencil.add(pencilBarrel, pencilCone, pencilPoint, bightCollar);
  root.add(pencil);

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(
      cycleCoordinate + sourcePhaseOffset,
      1,
    );
    const phaseAngle = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / cycleDuration;
    const ruleAngle = maximumRuleAngle * Math.sin(phaseAngle);
    const ruleAngularSpeed = maximumRuleAngle
      * angularFrequency * Math.cos(phaseAngle);
    const ruleAngularAcceleration = -maximumRuleAngle
      * angularFrequency ** 2 * Math.sin(phaseAngle);
    const denominator = focalHalfDistance * Math.cos(ruleAngle)
      - semiTransverseAxis;
    const pencilDistanceAlongRule = semiConjugateAxis ** 2
      / denominator;
    const firstDistanceDerivative = semiConjugateAxis ** 2
      * focalHalfDistance * Math.sin(ruleAngle)
      / denominator ** 2;
    const secondDistanceDerivative = semiConjugateAxis ** 2
      * focalHalfDistance * (
        Math.cos(ruleAngle) / denominator ** 2
        + 2 * focalHalfDistance * Math.sin(ruleAngle) ** 2
          / denominator ** 3
      );
    const pencilSlidingSpeed = firstDistanceDerivative
      * ruleAngularSpeed;
    const pencilSlidingAcceleration = secondDistanceDerivative
      * ruleAngularSpeed ** 2
      + firstDistanceDerivative * ruleAngularAcceleration;
    const ruleDirection = new THREE.Vector2(
      Math.sin(ruleAngle),
      -Math.cos(ruleAngle),
    );
    const ruleDirectionDerivative = new THREE.Vector2(
      Math.cos(ruleAngle),
      Math.sin(ruleAngle),
    );
    const pencilPoint2 = upperFocus.clone().addScaledVector(
      ruleDirection,
      pencilDistanceAlongRule,
    );
    const ruleEnd = upperFocus.clone().addScaledVector(
      ruleDirection,
      ruleLength,
    );
    const pencilVelocity = ruleDirection.clone().multiplyScalar(
      pencilSlidingSpeed,
    ).addScaledVector(
      ruleDirectionDerivative,
      pencilDistanceAlongRule * ruleAngularSpeed,
    );
    const pencilAcceleration = ruleDirection.clone().multiplyScalar(
      pencilSlidingAcceleration
        - pencilDistanceAlongRule * ruleAngularSpeed ** 2,
    ).addScaledVector(
      ruleDirectionDerivative,
      2 * pencilSlidingSpeed * ruleAngularSpeed
        + pencilDistanceAlongRule * ruleAngularAcceleration,
    );
    const focusSegmentLength = pencilPoint2.distanceTo(lowerFocus);
    const ruleSegmentLength = ruleLength - pencilDistanceAlongRule;
    const focusSegmentDirection = pencilPoint2.clone()
      .sub(lowerFocus)
      .normalize();
    const focusSegmentRate = focusSegmentDirection.dot(pencilVelocity);
    const ruleSegmentRate = -pencilSlidingSpeed;
    const pivotDistance = pencilPoint2.distanceTo(upperFocus);
    const pencilFromPivot = pencilPoint2.clone().sub(upperFocus);
    return {
      branchHalf: ruleAngle < 0 ? 'left' : 'right',
      cycleCoordinate,
      cyclePhase,
      distanceDifferenceResidual: pivotDistance
        - focusSegmentLength - distanceDifference,
      focusSegmentLength,
      focusSegmentRate,
      hyperbolaEquationResidual:
        pencilPoint2.y ** 2 / semiTransverseAxis ** 2
        - pencilPoint2.x ** 2 / semiConjugateAxis ** 2
        - 1,
      lowerFocus: lowerFocus.clone(),
      pencilAcceleration,
      pencilDistanceAlongRule,
      pencilPoint: pencilPoint2,
      pencilRuleCrossResidual:
        pencilFromPivot.x * ruleDirection.y
        - pencilFromPivot.y * ruleDirection.x,
      pencilSlidingAcceleration,
      pencilSlidingSpeed,
      pencilVelocity,
      phaseAngle,
      pivotDistance,
      ruleAngle,
      ruleAngularAcceleration,
      ruleAngularSpeed,
      ruleDirection,
      ruleEnd,
      ruleSegmentLength,
      ruleSegmentRate,
      segmentRateCancellationResidual:
        focusSegmentRate + ruleSegmentRate,
      threadLengthResidual:
        focusSegmentLength + ruleSegmentLength - threadLength,
      upperFocus: upperFocus.clone(),
    };
  };

  let updateFiniteGeometry = null;
  const update = (time) => {
    const state = stateAtTime(time);
    rule.rotation.z = state.ruleAngle;
    pencil.position.set(
      state.pencilPoint.x,
      state.pencilPoint.y,
      0,
    );
    const focusCordStart = new THREE.Vector3(
      lowerFocus.x,
      lowerFocus.y,
      0.255,
    );
    const bightPoint = new THREE.Vector3(
      state.pencilPoint.x,
      state.pencilPoint.y,
      0.255,
    );
    const ruleEndPoint = new THREE.Vector3(
      state.ruleEnd.x,
      state.ruleEnd.y,
      0.255,
    );
    focusCord.userData.setEndpoints(focusCordStart, bightPoint);
    ruleCord.userData.setEndpoints(bightPoint, ruleEndPoint);
    root.userData.contacts = {
      pencilToRule: {
        active: true,
        crossResidual: state.pencilRuleCrossResidual,
        slidingSpeed: state.pencilSlidingSpeed,
      },
      threadAtLowerFocus: {
        active: true,
        point: state.lowerFocus,
      },
      threadAtPencilBight: {
        active: true,
        point: state.pencilPoint,
        segmentRateCancellationResidual:
          state.segmentRateCancellationResidual,
      },
      threadAtRuleEnd: {
        active: true,
        point: state.ruleEnd,
        totalLengthResidual: state.threadLengthResidual,
      },
      upperFocusRulePivot: {
        active: true,
        point: state.upperFocus,
      },
    };
    updateFiniteGeometry?.(state);
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'two-focus-taut-thread-and-pivoted-rule-hyperbola-drawing-instrument-with-pencil-in-bight',
    blocks: {
      board,
      boardFrame,
      focusCord,
      lowerFocusPin,
      lowerThreadLoop,
      pencil,
      rule,
      ruleBody,
      ruleCord,
      ruleEndCap,
      ruleTicks,
      targetBranches,
      targetVertices,
      threadAnchor,
      upperFocusPin,
    },
    constraints: {
      hyperbola:
        'The pencil satisfies distance(upper focus,pencil)-distance(lower focus,pencil)=2a, hence y^2/a^2-x^2/b^2=1 on the lower branch.',
      pencil:
        'The pencil is manually kept on the rotating rule while occupying the taut thread bight; it slides along the rule rather than being pinned to it.',
      rule:
        'One rigid straight rule turns about the upper focus and carries the second end of the thread at its free end.',
      thread:
        'One inextensible thread runs from the fixed lower-focus loop to the pencil bight and back along the rule to its free-end attachment; the two segment-length rates cancel.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'pencil distance along the rule',
        'two taut thread segment lengths',
        'pencil hyperbola coordinates',
      ],
      independentPrescribedInputs: 1,
      inputs: ['manual angular sweep of the rule about the upper focus'],
      note:
        'The operator supplies rule angle and maintains thread tension and pencil contact; no hidden second actuator is introduced.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'massless inextensible thread with a sharp frictionless bight at the pencil',
        'rigid rule and fixed focus pins',
        'manual motion represented by a smooth sinusoidal sweep',
        'thread tension, pencil force, pivot friction, and material compliance omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless holonomic drawing-instrument kinematics',
    },
    fidelity: 'authored',
    geometry: {
      asymptoteAngle,
      cycleDuration,
      distanceDifference,
      focalHalfDistance,
      focusSeparation,
      lowerFocus,
      maximumRuleAngle,
      ruleLength,
      semiConjugateAxis,
      semiTransverseAxis,
      sourcePhaseOffset,
      sourceRuleAngle,
      targetHalfWidth,
      threadLength,
      upperFocus,
    },
    hyperbolaY,
    mechanism:
      'one rigid rule pivots on the upper focus; one constant-length thread is looped on the lower focus, bends around a pencil constrained to the rule, and terminates at the rule end, making the pencil’s two focal distances differ by the prescribed constant',
    motion: {
      cycleDuration,
      sequence:
        'source left-half pose -> lower vertex -> right-half sweep -> lower vertex -> left-half sweep, with smooth reversals inside the asymptote',
      sourcePosePhase: 0,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 405 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate405: {
        horizontalAxisYApproximatePixels: sourceRasterHorizontalAxisY,
        imageHeight: sourceImageHeight,
        imageWidth: sourceImageWidth,
        lowerFocusApproximatePixels: sourceRasterLowerFocus.toArray(),
        lowerVertexApproximatePixels: sourceRasterLowerVertex.toArray(),
        measurementUncertaintyPixels: 8,
        ruleEndApproximatePixels: sourceRasterRuleEnd.toArray(),
        upperFocusApproximatePixels: sourceRasterUpperFocus.toArray(),
        upperVertexApproximatePixels: sourceRasterUpperVertex.toArray(),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the two foci and vertices are given',
          'one end of the rule turns on one focus',
          'one end of the thread is looped on a pin at the other focus',
          'the other thread end is held at the other end of the rule',
          'the pencil is held in the thread bight',
          'the pencil is kept close to the rule as the rule moves',
          'the rule is reversed to obtain the other half',
        ],
        engravingEvidence:
          'The plate shows two opposite vertical hyperbola branches, two focus centers on the dotted focal axis, one long rule pivoted at the upper focus, a lower-focus thread pin, and the thread returning to the rule end through the pencil bight.',
        reconstructionDisclosure:
          'Brown gives no dimensions, thread length, angular range, timing, loads, or force law. The normalized focus/vertex geometry, rule length, thread length, sinusoidal input, drawing board, colors, and depth are independently engineered; the focal-distance and thread-length constraints are exact.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 405',
      textualErratum: {
        interpretation:
          'The title, two-focus construction, opposed curves in the engraving, and resulting constant difference of focal distances identify a hyperbola.',
        printedWord: 'parabola',
        treatment:
          'The catalog preserves Brown’s printed wording; the model implements the mechanically and geometrically consistent hyperbola.',
      },
    },
    sourcePose: {
      branchHalf: sourceState.branchHalf,
      pencilPoint: sourceState.pencilPoint,
      ruleAngle: sourceState.ruleAngle,
      ruleEnd: sourceState.ruleEnd,
      setting: 'rule leaning down-left as in Brown’s static engraving',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      focalDifferenceRelation:
        '|F_upper P|-|F_lower P|=ruleLength-threadLength=2a',
      pencilRuleRelation:
        's=b^2/(c*cos(theta)-a), with |theta| below acos(a/c)',
      threadRelation:
        '|F_lower P|+(ruleLength-s)=threadLength',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.04, -3.15, -0.48),
    new THREE.Vector3(3.04, 2.18, 0.75),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.4, 3.2, 12.2);
  root.userData.groundFloorY = -3.15;
  markShadows(root);
  board.receiveShadow = true;
  targetBranches.lower.castShadow = false;
  targetBranches.upper.castShadow = false;
  updateFiniteGeometry = installHyperbolaFiniteGeometry(root);
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredHyperbolaDrawingMovement(movement) {
  if (movement.id !== 405) return null;
  return hyperbolaDrawingInstrument(movement);
}
