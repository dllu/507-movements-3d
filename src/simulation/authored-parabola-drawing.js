import {correctDrawingTemplateParts} from './drawing-template-parts.js';
import * as THREE from 'three';
import {addDrawingBoard} from './drawing-board-parts.js';
import {plate, polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
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

function addDashedAxis(root, start, end, material) {
  const direction = end.clone().sub(start);
  const group = new THREE.Group();
  for (let index = 0; index < 21; index += 1) {
    const from = start.clone().addScaledVector(
      direction,
      (index + 0.08) / 21,
    );
    const to = start.clone().addScaledVector(
      direction,
      (index + 0.58) / 21,
    );
    group.add(beamBetween(from, to, 0.024, 0.018, material));
  }
  root.add(group);
  return group;
}

function parabolaDrawingInstrument(movement) {
  const root = new THREE.Group();
  const focalLength = 0.50;
  const directrixY = focalLength;
  const focus = new THREE.Vector2(0, -focalLength);
  const vertex = new THREE.Vector2(0, 0);
  const bladeLength = 3.55;
  const threadLength = bladeLength;
  // Pass 90: the square slides until the pencil comes down to the blade
  // end, just above the toe that carries the thread's anchor (pass 94: toe
  // top 0.07 above the anchor, pencil barrel radius 0.085, 0.04 clearance),
  // so Brown's curve runs down nearly to the blade foot on both sides.
  const lowestPencilY = directrixY - bladeLength + 0.09 + 0.085 + 0.02;
  const maximumSquareOffset = Math.sqrt(-4 * focalLength * lowestPencilY);
  const targetHalfWidth = maximumSquareOffset;
  const targetBaseY = -(targetHalfWidth ** 2) / (4 * focalLength);
  const stockWidth = 0.96;
  const stockHeight = 0.20;
  const bladeWidth = 0.22;
  const cycleDuration = 8;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterStraightedgeBounds = [35, 99, 501, 148];
  const sourceRasterBladeWorkingX = 165;
  const sourceRasterFocus = new THREE.Vector2(220, 223);
  const sourceRasterVertex = new THREE.Vector2(220, 191);
  const sourceRasterBladeEnd = new THREE.Vector2(165, 498);
  const sourceRasterBaseEndpoints = [52, 466, 390, 466];
  const sourceFocalLengthPixels = sourceRasterFocus.y
    - sourceRasterVertex.y;
  const sourceSquareOffset = focalLength
    * (sourceRasterBladeWorkingX - sourceRasterFocus.x)
    / sourceFocalLengthPixels;
  const sourcePhaseAngle = Math.asin(
    sourceSquareOffset / maximumSquareOffset,
  );
  const sourcePhaseOffset = positiveModulo(
    sourcePhaseAngle / FULL_TURN,
    1,
  );

  const squareMaterial = matte(PALETTE.driven, {
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
  // The thread's end and bight take the thread's ink: white ones would read
  // as holes on the cream page and the pale board.
  // Pass 101: the thread, its looped end, knot and bight are the shared hemp
  // brown, as every rope and cord and as sibling 405's thread.
  const threadMaterial = matte(PALETTE.rope, { roughness: 0.78 });
  const boardMaterial = matte(0xdadad4, {
    metalness: 0.02,
    roughness: 0.92,
  });

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(5.76, 4.67, 0.16),
    boardMaterial,
  );
  board.position.set(0, -0.96, -0.34);
  board.userData.role =
    'fixed-drawing-board-presentational-support-not-source-hardware';
  root.add(board);
  const boardFrame = new THREE.Group();
  boardFrame.userData.role = 'fixed-drawing-board-border';
  for (const x of [-2.93, 2.93]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 4.78, 0.22),
      frameMaterial,
    );
    rail.position.set(x, -0.96, -0.27);
    boardFrame.add(rail);
  }
  for (const y of [-3.40, 1.48]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(5.97, 0.11, 0.22),
      frameMaterial,
    );
    rail.position.set(0, y, -0.27);
    boardFrame.add(rail);
  }
  root.add(boardFrame);

  const focalAxis = addDashedAxis(
    root,
    new THREE.Vector3(0, -3.24, -0.205),
    new THREE.Vector3(0, 1.34, -0.205),
    frameMaterial,
  );
  focalAxis.userData.role =
    'dashed-parabola-axis-parallel-to-square-blade';

  const parabolaY = (x) => -(x ** 2) / (4 * focalLength);
  const targetPoints = Array.from({ length: 161 }, (_, index) => {
    const x = THREE.MathUtils.lerp(
      -targetHalfWidth,
      targetHalfWidth,
      index / 160,
    );
    return new THREE.Vector3(x, parabolaY(x), -0.145);
  });
  const targetParabola = lineTube(
    targetPoints,
    0.027,
    driverMaterial,
  );
  targetParabola.userData.role =
    'required-parabola-locus-equal-focus-and-directrix-distance';
  root.add(targetParabola);
  const givenBase = beamBetween(
    new THREE.Vector3(-targetHalfWidth, targetBaseY, -0.185),
    new THREE.Vector3(targetHalfWidth, targetBaseY, -0.185),
    0.025,
    0.020,
    frameMaterial,
  );
  givenBase.userData.role = 'given-parabola-base-chord';
  root.add(givenBase);
  const baseMarkers = [-1, 1].map((side, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.050, 16, 12),
      whiteMaterial,
    );
    marker.position.set(side * targetHalfWidth, targetBaseY, -0.095);
    marker.userData.role = `given-base-endpoint-${index + 1}`;
    root.add(marker);
    return marker;
  });
  const vertexMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 16, 12),
    whiteMaterial,
  );
  vertexMarker.position.set(vertex.x, vertex.y, -0.095);
  vertexMarker.userData.role = 'given-parabola-vertex';
  root.add(vertexMarker);

  const straightedgeHeight = 0.34;
  const straightedge = new THREE.Mesh(
    new THREE.BoxGeometry(5.9, straightedgeHeight, 0.30),
    frameMaterial,
  );
  straightedge.position.set(
    0,
    directrixY + straightedgeHeight / 2,
    0,
  );
  straightedge.userData.role =
    'fixed-straightedge-with-near-edge-coincident-with-directrix';
  root.add(straightedge);
  const directrixHighlight = new THREE.Mesh(
    new THREE.BoxGeometry(5.33, 0.035, 0.34),
    whiteMaterial,
  );
  directrixHighlight.position.set(0, directrixY, 0.025);
  directrixHighlight.userData.role =
    'white-near-edge-marking-the-directrix';
  root.add(directrixHighlight);

  const focusPin = new THREE.Group();
  focusPin.position.set(focus.x, focus.y, 0.04);
  focusPin.userData.role = 'fixed-parabola-focus-thread-pin';
  const focusAxle = cylinderAlongZ(0.070, 0.58, darkMaterial, 28);
  focusAxle.userData.role = 'fixed-focus-pin-axle';
  const focusCollar = cylinderAlongZ(0.175, 0.17, accentMaterial, 38);
  focusCollar.position.z = 0.09;
  focusCollar.userData.role = 'parabola-focus-brass-collar';
  const focusIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.060, 18, 12),
    whiteMaterial,
  );
  focusIndex.position.z = 0.34;
  focusIndex.userData.role = 'white-focus-center-index';
  focusPin.add(focusAxle, focusCollar, focusIndex);
  root.add(focusPin);
  const focusThreadLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.025, 10, 36),
    threadMaterial,
  );
  focusThreadLoop.position.set(focus.x, focus.y, 0.255);
  focusThreadLoop.userData.role = 'thread-end-looped-on-focus-pin';
  root.add(focusThreadLoop);

  const square = new THREE.Group();
  square.position.z = 0.035;
  square.userData.role =
    'single-rigid-square-sliding-with-stock-against-straightedge';
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(stockWidth, stockHeight, 0.22),
    squareMaterial,
  );
  stock.position.set(0, directrixY - stockHeight / 2, 0);
  stock.userData.role =
    'square-stock-maintaining-contact-with-directrix-straightedge';
  square.add(stock);
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(bladeWidth, bladeLength, 0.16),
    squareMaterial,
  );
  blade.position.set(0, directrixY - bladeLength / 2, 0);
  blade.userData.role =
    'square-blade-perpendicular-to-directrix-and-parallel-to-axis';
  square.add(blade);
  const bladeTicks = Array.from({ length: 10 }, (_, index) => {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.145, 0.025, 0.022),
      whiteMaterial,
    );
    tick.position.set(
      0,
      directrixY - bladeLength * (index + 0.65) / 10.7,
      0.095,
    );
    tick.userData.role = `square-blade-distance-index-${index + 1}`;
    square.add(tick);
    return tick;
  });
  const bladeEnd = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, 0.20),
    squareMaterial,
  );
  bladeEnd.position.set(0, directrixY - bladeLength, 0);
  bladeEnd.userData.role = 'free-end-of-square-blade';
  square.add(bladeEnd);
  const threadAnchor = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    threadMaterial,
  );
  threadAnchor.position.set(0, directrixY - bladeLength, 0.220);
  threadAnchor.userData.role =
    'thread-end-fixed-to-free-end-of-square-blade';
  square.add(threadAnchor);
  root.add(square);

  const focusCord = makeDynamicCord(0.025, threadMaterial);
  focusCord.userData.role =
    'taut-thread-segment-from-focus-to-pencil-bight';
  root.add(focusCord);
  const bladeCord = makeDynamicCord(0.025, threadMaterial);
  bladeCord.userData.role =
    'taut-thread-segment-from-pencil-bight-along-blade-to-anchor';
  root.add(bladeCord);

  const pencil = new THREE.Group();
  pencil.userData.role =
    'pencil-held-in-thread-bight-and-against-square-blade';
  const pencilBarrel = cylinderAlongZ(0.085, 0.55, driverMaterial, 30);
  pencilBarrel.position.z = 0.18;
  pencilBarrel.userData.role = 'moving-parabola-pencil-barrel';
  const pencilCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.085, 0.16, 30),
    accentMaterial,
  );
  pencilCone.rotation.x = Math.PI / 2;
  pencilCone.position.z = -0.175;
  pencilCone.userData.role = 'moving-parabola-pencil-conical-tip';
  const pencilPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 14, 10),
    darkMaterial,
  );
  pencilPoint.position.z = -0.265;
  pencilPoint.userData.role = 'pencil-point-on-parabola';
  const bightCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.026, 10, 36),
    threadMaterial,
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
    const squareOffset = maximumSquareOffset * Math.sin(phaseAngle);
    const squareSpeed = maximumSquareOffset
      * angularFrequency * Math.cos(phaseAngle);
    const squareAcceleration = -maximumSquareOffset
      * angularFrequency ** 2 * Math.sin(phaseAngle);
    const pencilY = parabolaY(squareOffset);
    const pencilPoint2 = new THREE.Vector2(squareOffset, pencilY);
    const pencilVerticalSpeed = -squareOffset * squareSpeed
      / (2 * focalLength);
    const pencilVerticalAcceleration = -(
      squareSpeed ** 2 + squareOffset * squareAcceleration
    ) / (2 * focalLength);
    const pencilVelocity = new THREE.Vector2(
      squareSpeed,
      pencilVerticalSpeed,
    );
    const pencilAcceleration = new THREE.Vector2(
      squareAcceleration,
      pencilVerticalAcceleration,
    );
    const directrixFoot = new THREE.Vector2(squareOffset, directrixY);
    const bladeEndPoint = new THREE.Vector2(
      squareOffset,
      directrixY - bladeLength,
    );
    const perpendicularDistance = directrixY - pencilY;
    const focusSegmentLength = pencilPoint2.distanceTo(focus);
    const bladeSegmentLength = pencilY - bladeEndPoint.y;
    const focusDirection = pencilPoint2.clone().sub(focus).normalize();
    const focusSegmentRate = focusDirection.dot(pencilVelocity);
    const bladeSegmentRate = pencilVerticalSpeed;
    return {
      bladeEnd: bladeEndPoint,
      bladeSegmentLength,
      bladeSegmentRate,
      cycleCoordinate,
      cyclePhase,
      directrixDistanceResidual:
        focusSegmentLength - perpendicularDistance,
      directrixFoot,
      focus: focus.clone(),
      focusSegmentLength,
      focusSegmentRate,
      parabolaEquationResidual:
        pencilY + squareOffset ** 2 / (4 * focalLength),
      pencilAcceleration,
      pencilBladeResidual: pencilPoint2.x - squareOffset,
      pencilPoint: pencilPoint2,
      pencilVelocity,
      pencilVerticalAcceleration,
      pencilVerticalSpeed,
      perpendicularDistance,
      phaseAngle,
      segmentRateCancellationResidual:
        focusSegmentRate + bladeSegmentRate,
      squareAcceleration,
      squareOffset,
      squareSpeed,
      stockContactResidual:
        directrixY - (directrixY - stockHeight / 2
          + stockHeight / 2),
      threadLengthResidual:
        focusSegmentLength + bladeSegmentLength - threadLength,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    square.position.x = state.squareOffset;
    pencil.position.set(
      state.pencilPoint.x,
      state.pencilPoint.y,
      0,
    );
    const focusPoint3 = new THREE.Vector3(
      state.focus.x,
      state.focus.y,
      0.255,
    );
    const bightPoint3 = new THREE.Vector3(
      state.pencilPoint.x,
      state.pencilPoint.y,
      0.255,
    );
    const bladeEnd3 = new THREE.Vector3(
      state.bladeEnd.x,
      state.bladeEnd.y,
      0.255,
    );
    focusCord.userData.setEndpoints(focusPoint3, bightPoint3);
    bladeCord.userData.setEndpoints(bightPoint3, bladeEnd3);
    root.userData.contacts = {
      focusThreadLoop: {
        active: true,
        point: state.focus,
      },
      pencilToBlade: {
        active: true,
        residual: state.pencilBladeResidual,
        slidingSpeed: state.pencilVerticalSpeed,
      },
      stockToStraightedge: {
        active: true,
        directrixY,
        residual: state.stockContactResidual,
      },
      threadAtPencilBight: {
        active: true,
        point: state.pencilPoint,
        segmentRateCancellationResidual:
          state.segmentRateCancellationResidual,
      },
      threadAtBladeEnd: {
        active: true,
        point: state.bladeEnd,
        totalLengthResidual: state.threadLengthResidual,
      },
    };
    root.userData.updateWorkingParts?.(state);
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'sliding-square-against-directrix-with-taut-focus-thread-and-pencil-bight-tracing-parabola',
    blocks: {
      baseMarkers,
      blade,
      bladeCord,
      bladeEnd,
      bladeTicks,
      board,
      boardFrame,
      directrixHighlight,
      focalAxis,
      focusCord,
      focusPin,
      focusThreadLoop,
      givenBase,
      pencil,
      square,
      stock,
      straightedge,
      targetParabola,
      threadAnchor,
      vertexMarker,
    },
    constraints: {
      parabola:
        'The pencil’s distance to the fixed focus equals its perpendicular distance to the straightedge edge used as directrix, so y=-x^2/(4f).',
      pencil:
        'The pencil is manually held both in the taut thread bight and against the translating square blade, and therefore slides along that blade.',
      square:
        'One rigid square translates along the fixed straightedge without rotating; its stock stays against the directrix and its blade remains parallel to the parabola axis.',
      thread:
        'One inextensible thread has length equal to the blade from directrix to anchor and runs focus-to-pencil plus pencil-to-blade-end; the two segment-length rates cancel.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'pencil vertical position along the square blade',
        'focus-side and blade-side thread lengths',
        'pencil parabola coordinates',
      ],
      independentPrescribedInputs: 1,
      inputs: ['manual horizontal translation of the square'],
      note:
        'The operator translates the square and maintains thread tension and pencil contact; the pencil coordinate follows from one exact thread-length constraint.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'massless inextensible thread with a sharp frictionless bight at the pencil',
        'rigid straightedge and square with zero-clearance sliding contact',
        'manual motion represented by a smooth sinusoidal sweep',
        'thread tension, pencil force, sliding friction, and material compliance omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless holonomic drawing-instrument kinematics',
    },
    fidelity: 'authored',
    geometry: {
      bladeLength,
      bladeWidth,
      cycleDuration,
      directrixY,
      focalLength,
      focus,
      maximumSquareOffset,
      sourcePhaseOffset,
      sourceSquareOffset,
      stockHeight,
      stockWidth,
      targetBaseY,
      targetHalfWidth,
      threadLength,
      vertex,
    },
    mechanism:
      'one square slides by its stock along a straightedge whose near side is the directrix; one constant-length thread runs from the fixed focus around a pencil constrained to the square blade and then to the blade end, forcing equal focus and directrix distances',
    motion: {
      cycleDuration,
      sequence:
        'source left-of-axis pose -> left limit -> vertex crossing -> right limit -> vertex crossing -> repeat',
      sourcePosePhase: 0,
    },
    parabolaY,
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 406 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate406: {
        baseEndpointsApproximatePixels: sourceRasterBaseEndpoints,
        bladeEndApproximatePixels: sourceRasterBladeEnd.toArray(),
        bladeWorkingXApproximatePixels: sourceRasterBladeWorkingX,
        focusApproximatePixels: sourceRasterFocus.toArray(),
        imageHeight: sourceImageHeight,
        imageWidth: sourceImageWidth,
        measurementUncertaintyPixels: 8,
        straightedgeApproximateBoundsPixels:
          sourceRasterStraightedgeBounds,
        vertexApproximatePixels: sourceRasterVertex.toArray(),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the base, altitude, focus, and directrix are given',
          'the near side of a fixed straightedge coincides with the directrix',
          'the square stock bears against that straightedge',
          'the square blade is parallel with the parabola axis',
          'the pencil is carried in the bight of a thread as in Movement 405',
        ],
        engravingEvidence:
          'The plate shows a long horizontal straightedge, a translating square with vertical blade, a focus pin, two thread legs meeting at a pencil on the blade, and a downward-opening parabola with base chord.',
        reconstructionDisclosure:
          'Brown gives no dimensions, thread length, square travel, timing, loads, or force law. Focal length, blade/thread length, travel, sinusoidal input, drawing board, colors, and depth are independently engineered; equal focus/directrix distance and constant thread length are exact.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 406',
    },
    sourcePose: {
      pencilPoint: sourceState.pencilPoint,
      squareOffset: sourceState.squareOffset,
      setting: 'square blade left of the focus axis as in Brown’s engraving',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      parabolaRelation:
        '|FP|=directrixY-P.y, equivalently P.y=-P.x^2/(4f)',
      squareRelation:
        'blade x-coordinate equals the single translating square coordinate',
      threadRelation:
        '|FP|+(P.y-(directrixY-bladeLength))=bladeLength',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.04, -3.46, -0.48),
    new THREE.Vector3(3.04, 1.55, 0.75),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.4, 3.2, 12.2);
  root.userData.groundFloorY = -3.46;
  markShadows(root);
  board.receiveShadow = true;
  targetParabola.castShadow = false;
  focalAxis.traverse((object) => {
    object.castShadow = false;
  });
  update(0);
  correctDrawingTemplateParts(root,406,update);
  // Pass 57: the parabola is traced on a plain drawing board whose top face
  // is the drawing plane at the pencil point. The traced line lies on it, the
  // straightedge and the square's stock stand on it, and the focus pin stands
  // in a bore through it with its collar seated on the face.
  {
    const boardTop = -0.26;
    addDrawingBoard(root, {
      min: [-3.25, -3.35], max: [3.25, 0.95], top: boardTop,
      holes: [[focusPin.position.x, focusPin.position.y, 0.0705]], holeDepth: 0.115,
    });
    // The traced line is a thin drawn stroke lying on the board, so the
    // pencil point meets it without sinking into a raised tube.
    targetParabola.scale.z = 0.3;
    targetParabola.position.z = boardTop + 0.0075 + 0.145 * 0.3;
    straightedge.geometry.dispose();
    straightedge.geometry = new THREE.BoxGeometry(6.5, straightedgeHeight, 0.15 - boardTop);
    straightedge.position.z = (0.15 + boardTop) / 2;
    directrixHighlight.visible = false;
    const stockTop = square.position.z + stock.position.z + stock.geometry.parameters.depth / 2;
    const stockGeometry = stock.geometry.parameters;
    stock.geometry.dispose();
    stock.geometry = new THREE.BoxGeometry(stockGeometry.width, stockGeometry.height, stockTop - boardTop - 0.001);
    stock.position.z = (stockTop + boardTop + 0.001) / 2 - square.position.z;
    // Pass 94: Brown's square is one-sided. Its stock runs left of the blade
    // only (about 2.4 stock heights) and ends in a concave cove; the blade
    // hangs from the stock's underside and ends in a curved foot whose toe
    // carries the thread's anchor, with no separate end block. Stock and
    // blade tops are flush (0.765).
    {
      const b = root.userData.blocks;
      const bladeLeft = b.blade.position.x - bladeWidth / 2;
      const bladeRight = b.blade.position.x + bladeWidth / 2;
      const stockLeft = bladeLeft - 0.48;
      const coveRadius = stockHeight - 0.03;
      const arc = (cx, cy, r, a0, a1, n = 24) => Array.from({ length: n + 1 },
        (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
      const ccw = (ring) => {
        let area = 0;
        for (let i = 0; i < ring.length; i += 1) {
          const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
          area += x0 * y1 - x1 * y0;
        }
        return area > 0 ? ring : ring.slice().reverse();
      };
      const halfHeight = stockHeight / 2;
      const stockRing = ccw([
        [bladeRight, halfHeight], [stockLeft, halfHeight], [stockLeft, halfHeight - 0.03],
        ...arc(stockLeft, -halfHeight, coveRadius, Math.PI / 2, 0).slice(1),
        [bladeRight, -halfHeight],
      ]);
      const stockLow = boardTop + 0.001;
      const stockHigh = square.position.z + 0.08;
      stock.geometry.dispose();
      stock.geometry = plate([[stockRing]], stockLow, stockHigh);
      stock.position.set(0, directrixY - stockHeight / 2, -square.position.z);
      stock.userData.oneSided = { stockLeft, bladeRight, coveRadius };
      // Blade: square coordinates, then shifted into the blade's frame.
      const top = directrixY - stockHeight;
      const footY = directrixY - bladeLength;
      const anchorX = b.threadAnchor.position.x;
      const toeRadius = 0.07, filletRadius = 0.04, heelRadius = 0.20;
      const bladeRing = ccw([
        [bladeRight, top],
        ...arc(bladeRight + filletRadius, footY + toeRadius + filletRadius, filletRadius, Math.PI, 1.5 * Math.PI, 8),
        ...arc(anchorX, footY, toeRadius, Math.PI / 2, -Math.PI / 2),
        ...arc(bladeLeft + heelRadius, footY - toeRadius + heelRadius, heelRadius, -Math.PI / 2, -Math.PI),
        [bladeLeft, top],
      ]).map(([x, y]) => [x - b.blade.position.x, y - b.blade.position.y]);
      b.blade.geometry.dispose();
      b.blade.geometry = plate([[bladeRing]], -0.08, 0.08);
      b.blade.userData.curvedFoot = { toeRadius, filletRadius, heelRadius, anchorX, footY };
      b.bladeEnd.removeFromParent();
      b.bladeEnd.geometry.dispose();
    }
    focusAxle.geometry.dispose();
    // The pin stops just above its thread loop (top 0.255), below the
    // blade-side thread run (z 0.27 and up) that passes over it at the vertex.
    focusAxle.geometry = new THREE.CylinderGeometry(0.070, 0.070, 0.255 + 0.37, 28);
    focusAxle.position.z = (0.255 - 0.37) / 2 - focusPin.position.z;
    focusCollar.position.z = boardTop + 0.085 - focusPin.position.z;
  }
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredParabolaDrawingMovement(movement) {
  if (movement.id !== 406) return null;
  return parabolaDrawingInstrument(movement);
}
