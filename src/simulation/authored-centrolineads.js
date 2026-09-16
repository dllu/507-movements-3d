import {correctCentrolinead,finishDrawingGauge} from './drawing-gauge-parts.js';
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

function centrolinead(movement) {
  const root = new THREE.Group();
  const vanishingDistance = 4.50;
  const pinHalfSpacing = 1.25;
  const contactPinX = -(
    vanishingDistance
      - Math.sqrt(vanishingDistance ** 2 - 4 * pinHalfSpacing ** 2)
  ) / 2;
  const vanishingPoint = new THREE.Vector2(-vanishingDistance, 0);
  const upperPin = new THREE.Vector2(contactPinX, pinHalfSpacing);
  const lowerPin = new THREE.Vector2(contactPinX, -pinHalfSpacing);
  const locusCircleCenter = new THREE.Vector2(
    -vanishingDistance / 2,
    0,
  );
  const locusCircleRadius = vanishingDistance / 2;
  const pinCircleAngle = Math.asin(
    pinHalfSpacing / locusCircleRadius,
  );
  const maximumJointCircleAngle = .26;
  const bladeLength = 4.15;
  const bladeWidth = 0.24;
  const visibleLegLength = 2.45;
  const legWidth = 0.24;
  const headRadius = 0.58;
  const cycleDuration = 7;
  const sourcePhaseOffset = 0;
  const sourceJoint = new THREE.Vector2(0, 0);
  const upperLegDirectionLocal = upperPin.clone()
    .sub(sourceJoint)
    .normalize();
  const lowerLegDirectionLocal = lowerPin.clone()
    .sub(sourceJoint)
    .normalize();
  const upperLegAngleRelativeToBlade = Math.atan2(
    upperLegDirectionLocal.y,
    upperLegDirectionLocal.x,
  );
  const lowerLegAngleRelativeToBlade = Math.atan2(
    lowerLegDirectionLocal.y,
    lowerLegDirectionLocal.x,
  );
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterHeadBounds = [63, 204, 192, 354];
  const sourceRasterJoint = new THREE.Vector2(169, 264);
  const sourceRasterUpperLegEnd = new THREE.Vector2(39, 62);
  const sourceRasterLowerLegEnd = new THREE.Vector2(29, 462);
  const sourceRasterBladeBounds = [169, 252, 506, 278];
  const sourceRasterUpperClamp = new THREE.Vector2(123, 224);
  const sourceRasterLowerClamp = new THREE.Vector2(123, 337);
  const sourceRasterConstructionCircleBounds = [188, 54, 332, 196];
  const sourceRasterConstructionChord = [307, 72, 326, 161];

  const toolMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
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
    metalness: 0.23,
    roughness: 0.45,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });
  const boardMaterial = matte(0xdadad4, {
    metalness: 0.02,
    roughness: 0.92,
  });

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(8.12, 5.30, 0.16),
    boardMaterial,
  );
  board.position.set(0.40, 0, -0.34);
  board.userData.role =
    'fixed-drawing-board-with-vanishing-point-beyond-left-edge';
  root.add(board);
  const boardFrame = new THREE.Group();
  boardFrame.userData.role = 'fixed-drawing-board-border';
  for (const x of [-3.72, 4.52]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 5.41, 0.22),
      frameMaterial,
    );
    rail.position.set(x, 0, -0.27);
    boardFrame.add(rail);
  }
  for (const y of [-2.71, 2.71]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(8.35, 0.11, 0.22),
      frameMaterial,
    );
    rail.position.set(0.40, y, -0.27);
    boardFrame.add(rail);
  }
  root.add(boardFrame);

  const locusArcPoints = Array.from({ length: 121 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(
      -pinCircleAngle,
      pinCircleAngle,
      index / 120,
    );
    return new THREE.Vector3(
      locusCircleCenter.x + locusCircleRadius * Math.cos(angle),
      locusCircleCenter.y + locusCircleRadius * Math.sin(angle),
      -0.15,
    );
  });
  const constructionCircleArc = lineTube(
    locusArcPoints,
    0.024,
    driverMaterial,
  );
  constructionCircleArc.userData.role =
    'visible-arc-of-circle-through-two-pins-joint-and-vanishing-point';
  root.add(constructionCircleArc);
  const fixedPinChord = beamBetween(
    new THREE.Vector3(upperPin.x, upperPin.y, -0.18),
    new THREE.Vector3(lowerPin.x, lowerPin.y, -0.18),
    0.022,
    0.018,
    frameMaterial,
  );
  fixedPinChord.userData.role =
    'dotted-line-equivalent-joining-fixed-board-pins';
  root.add(fixedPinChord);

  const makeFixedPin = (point, role) => {
    const group = new THREE.Group();
    group.position.set(point.x, point.y, 0.05);
    group.userData.role = role;
    const axle = cylinderAlongZ(0.075, 0.62, darkMaterial, 30);
    axle.userData.role = `${role}-vertical-axle`;
    const collar = cylinderAlongZ(0.17, 0.19, accentMaterial, 38);
    collar.position.z = 0.08;
    collar.userData.role = `${role}-contact-collar`;
    const index = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      whiteMaterial,
    );
    index.position.z = 0.36;
    index.userData.role = `${role}-white-axis-index`;
    group.add(axle, collar, index);
    root.add(group);
    return { axle, collar, group, index };
  };
  const fixedPins = {
    lower: makeFixedPin(lowerPin, 'lower-fixed-board-pin'),
    upper: makeFixedPin(upperPin, 'upper-fixed-board-pin'),
  };

  const instrument = new THREE.Group();
  instrument.userData.role =
    'single-rigid-centrolinead-after-both-leg-angles-are-clamped';
  const makeLeg = (direction, role) => {
    const normal = new THREE.Vector2(-direction.y, direction.x);
    const end = direction.clone().multiplyScalar(visibleLegLength);
    const body = beamBetween(
      new THREE.Vector3(
        normal.x * legWidth / 2,
        normal.y * legWidth / 2,
        0,
      ),
      new THREE.Vector3(
        end.x + normal.x * legWidth / 2,
        end.y + normal.y * legWidth / 2,
        0,
      ),
      legWidth,
      0.16,
      toolMaterial,
    );
    body.userData.role = `${role}-adjustable-leg-body`;
    const backEdge = beamBetween(
      new THREE.Vector3(0, 0, 0.095),
      new THREE.Vector3(end.x, end.y, 0.095),
      0.026,
      0.018,
      whiteMaterial,
    );
    backEdge.userData.role =
      `${role}-working-back-edge-through-joint-center`;
    const clamp = new THREE.Group();
    clamp.position.set(direction.x * 0.43, direction.y * 0.43, 0.13);
    clamp.userData.role = `${role}-leg-angle-clamp`;
    const clampBody = cylinderAlongZ(0.14, 0.19, accentMaterial, 34);
    const clampIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 14, 10),
      whiteMaterial,
    );
    clampIndex.position.z = 0.13;
    clamp.add(clampBody, clampIndex);
    instrument.add(body, backEdge, clamp);
    return { backEdge, body, clamp, direction, end };
  };
  const legs = {
    lower: makeLeg(lowerLegDirectionLocal, 'lower'),
    upper: makeLeg(upperLegDirectionLocal, 'upper'),
  };

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(bladeLength, bladeWidth, 0.18),
    toolMaterial,
  );
  blade.position.set(bladeLength / 2, -bladeWidth / 2, 0.01);
  blade.userData.role =
    'long-straight-blade-whose-upper-drawing-edge-crosses-joint-center';
  instrument.add(blade);
  const drawingEdge = beamBetween(
    new THREE.Vector3(-3.10, 0, 0.12),
    new THREE.Vector3(bladeLength, 0, 0.12),
    0.030,
    0.022,
    driverMaterial,
  );
  drawingEdge.userData.role =
    'drawing-edge-and-visible-extension-toward-off-board-vanishing-point';
  instrument.add(drawingEdge);
  const bladeTicks = Array.from({ length: 12 }, (_, index) => {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.135, 0.025),
      whiteMaterial,
    );
    tick.position.set(
      bladeLength * (index + 0.65) / 12.8,
      -bladeWidth / 2,
      0.115,
    );
    tick.userData.role = `blade-distance-index-${index + 1}`;
    instrument.add(tick);
    return tick;
  });

  const head = cylinderAlongZ(headRadius, 0.20, toolMaterial, 64);
  head.position.z = 0.035;
  head.userData.role =
    'common-centrolinead-head-carrying-blade-and-adjustable-legs';
  instrument.add(head);
  const centralJoint = cylinderAlongZ(0.14, 0.58, darkMaterial, 34);
  centralJoint.position.z = 0.06;
  centralJoint.userData.role =
    'moving-center-joint-at-intersection-of-three-working-lines';
  instrument.add(centralJoint);
  const jointIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.060, 18, 12),
    whiteMaterial,
  );
  jointIndex.position.z = 0.39;
  jointIndex.userData.role = 'white-moving-joint-center-index';
  instrument.add(jointIndex);
  const adjustmentArcs = [-1, 1].map((side, index) => {
    const start = side > 0 ? 1.86 : -2.93;
    const end = side > 0 ? 2.93 : -1.86;
    const points = Array.from({ length: 33 }, (_, pointIndex) => {
      const angle = THREE.MathUtils.lerp(start, end, pointIndex / 32);
      return new THREE.Vector3(
        0.40 * Math.cos(angle),
        0.40 * Math.sin(angle),
        0.155,
      );
    });
    const arc = lineTube(points, 0.026, darkMaterial);
    arc.userData.role = `curved-leg-adjustment-slot-${index + 1}`;
    instrument.add(arc);
    return arc;
  });
  root.add(instrument);

  const worldDirection = (localDirection, bladeAngle) => (
    localDirection.clone().rotateAround(
      new THREE.Vector2(0, 0),
      bladeAngle,
    )
  );
  const cross2 = (left, right) => left.x * right.y
    - left.y * right.x;
  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(
      cycleCoordinate + sourcePhaseOffset,
      1,
    );
    const phaseAngle = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / cycleDuration;
    const jointCircleAngle = maximumJointCircleAngle
      * Math.sin(phaseAngle);
    const jointCircleAngularSpeed = maximumJointCircleAngle
      * angularFrequency * Math.cos(phaseAngle);
    const jointCircleAngularAcceleration = -maximumJointCircleAngle
      * angularFrequency ** 2 * Math.sin(phaseAngle);
    const joint = new THREE.Vector2(
      locusCircleCenter.x
        + locusCircleRadius * Math.cos(jointCircleAngle),
      locusCircleCenter.y
        + locusCircleRadius * Math.sin(jointCircleAngle),
    );
    const jointVelocity = new THREE.Vector2(
      -locusCircleRadius * Math.sin(jointCircleAngle)
        * jointCircleAngularSpeed,
      locusCircleRadius * Math.cos(jointCircleAngle)
        * jointCircleAngularSpeed,
    );
    const jointAcceleration = new THREE.Vector2(
      -locusCircleRadius * (
        Math.cos(jointCircleAngle) * jointCircleAngularSpeed ** 2
          + Math.sin(jointCircleAngle)
            * jointCircleAngularAcceleration
      ),
      locusCircleRadius * (
        -Math.sin(jointCircleAngle) * jointCircleAngularSpeed ** 2
          + Math.cos(jointCircleAngle)
            * jointCircleAngularAcceleration
      ),
    );
    const bladeAngle = jointCircleAngle / 2;
    const bladeAngularSpeed = jointCircleAngularSpeed / 2;
    const bladeAngularAcceleration = jointCircleAngularAcceleration / 2;
    const bladeDirection = new THREE.Vector2(
      Math.cos(bladeAngle),
      Math.sin(bladeAngle),
    );
    const upperLegDirection = worldDirection(
      upperLegDirectionLocal,
      bladeAngle,
    );
    const lowerLegDirection = worldDirection(
      lowerLegDirectionLocal,
      bladeAngle,
    );
    const upperPinVector = upperPin.clone().sub(joint);
    const lowerPinVector = lowerPin.clone().sub(joint);
    const upperContactCoordinate = upperPinVector.dot(upperLegDirection);
    const lowerContactCoordinate = lowerPinVector.dot(lowerLegDirection);
    return {
      bladeAngle,
      bladeAngularAcceleration,
      bladeAngularSpeed,
      bladeDirection,
      bladeVanishingResidual: cross2(
        vanishingPoint.clone().sub(joint),
        bladeDirection,
      ),
      concyclicJointResidual:
        joint.distanceTo(locusCircleCenter) - locusCircleRadius,
      cycleCoordinate,
      cyclePhase,
      joint,
      jointAcceleration,
      jointCircleAngle,
      jointCircleAngularAcceleration,
      jointCircleAngularSpeed,
      jointVelocity,
      lowerContactCoordinate,
      lowerLegDirection,
      lowerPin: lowerPin.clone(),
      lowerPinLineResidual: cross2(lowerPinVector, lowerLegDirection),
      phaseAngle,
      upperContactCoordinate,
      upperLegDirection,
      upperPin: upperPin.clone(),
      upperPinLineResidual: cross2(upperPinVector, upperLegDirection),
      vanishingPoint: vanishingPoint.clone(),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    instrument.position.set(state.joint.x, state.joint.y, 0.04);
    instrument.rotation.z = state.bladeAngle;
    root.userData.contacts = {
      lowerLegBackEdgeToFixedPin: {
        active: true,
        coordinate: state.lowerContactCoordinate,
        lineResidual: state.lowerPinLineResidual,
        point: state.lowerPin,
      },
      upperLegBackEdgeToFixedPin: {
        active: true,
        coordinate: state.upperContactCoordinate,
        lineResidual: state.upperPinLineResidual,
        point: state.upperPin,
      },
    };
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'two-preset-leg-centrolinead-sliding-on-two-fixed-board-pins-with-blade-concurrent-at-inaccessible-vanishing-point',
    blocks: {
      adjustmentArcs,
      blade,
      bladeTicks,
      board,
      boardFrame,
      constructionCircleArc,
      centralJoint,
      drawingEdge,
      fixedPinChord,
      fixedPins,
      head,
      instrument,
      jointIndex,
      legs,
    },
    constraints: {
      blade:
        'The upper drawing edge passes through the moving joint center and the one fixed off-board vanishing point at every pose.',
      circle:
        'The two fixed pin axes, moving joint, and vanishing point are concyclic; the moving joint stays on the pin-defined circle arc.',
      legs:
        'After adjustment, both leg angles are clamped to the head; each working back edge passes through the common joint center and its corresponding fixed pin axis.',
      pins:
        'Two vertical board pins remain fixed at the ends of the transverse chord while the rigid instrument slides against them.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'joint translation on the construction circle',
        'blade orientation toward the vanishing point',
        'two changing pin contact coordinates along the fixed leg edges',
      ],
      independentPrescribedInputs: 1,
      inputs: ['manual sweep of the centrolinead joint between the pins'],
      note:
        'A planar rigid body has three coordinates; the two pin-on-leg-line contacts leave one operating degree of freedom after the leg clamps are set.',
      planarRigidBodyCoordinates: 3,
      scalarContactConstraints: 2,
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid blade, head, and clamped legs',
        'point-axis pin contacts on zero-thickness working lines',
        'fixed planar board and frictionless sliding contacts',
        'manual input represented by a smooth sinusoidal circle coordinate',
        'pin radius, clearance, friction, pencil force, and elastic deflection omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless planar rigid-body drafting kinematics',
    },
    fidelity: 'authored',
    geometry: {
      bladeLength,
      bladeWidth,
      contactPinX,
      cycleDuration,
      headRadius,
      legWidth,
      locusCircleCenter,
      locusCircleRadius,
      lowerLegAngleRelativeToBlade,
      lowerLegDirectionLocal,
      lowerPin,
      maximumJointCircleAngle,
      pinCircleAngle,
      pinHalfSpacing,
      sourceJoint,
      sourcePhaseOffset,
      upperLegAngleRelativeToBlade,
      upperLegDirectionLocal,
      upperPin,
      vanishingDistance,
      vanishingPoint,
      visibleLegLength,
    },
    mechanism:
      'one rigid centrolinead carries a long drawing blade and two independently adjustable but operating-cycle-clamped legs; the two leg backs slide against two fixed board pins so the common head joint follows their construction circle and every blade line passes through one inaccessible vanishing point',
    motion: {
      cycleDuration,
      sequence:
        'horizontal source pose -> upper circle excursion -> horizontal pose -> lower circle excursion -> horizontal pose',
      sourcePosePhase: 0,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 408 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate408: {
        bladeApproximateBoundsPixels: sourceRasterBladeBounds,
        constructionChordApproximatePixels:
          sourceRasterConstructionChord,
        constructionCircleApproximateBoundsPixels:
          sourceRasterConstructionCircleBounds,
        headApproximateBoundsPixels: sourceRasterHeadBounds,
        imageHeight: sourceImageHeight,
        imageWidth: sourceImageWidth,
        jointApproximatePixels: sourceRasterJoint.toArray(),
        lowerClampApproximatePixels: sourceRasterLowerClamp.toArray(),
        lowerLegEndApproximatePixels:
          sourceRasterLowerLegEnd.toArray(),
        measurementUncertaintyPixels: 10,
        upperClampApproximatePixels: sourceRasterUpperClamp.toArray(),
        upperLegEndApproximatePixels:
          sourceRasterUpperLegEnd.toArray(),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the tool draws toward an inaccessible or inconveniently distant point',
          'the blade upper drawing edge intersects the joint center',
          'the working back of each movable leg intersects the joint center',
          'the two legs may make unequal angles with the blade',
          'one vertical pin is placed at each end of the transverse dotted line',
          'the instrument works against those two pins',
          'parallel inward offsets may reproduce convergences that cannot be physically extended for setup',
        ],
        engravingEvidence:
          'The plate shows one long blade, a common circular head, two separately clamped oblique legs, two curved adjustment slots, and an inset circle-and-chord construction whose rays converge on one point.',
        reconstructionDisclosure:
          'Brown gives no dimensions, selected vanishing distance, pin spacing, sweep range, timing, loads, or contact clearances. A symmetric pin setting is used for clarity, while the exact concyclic and line-contact construction is retained; colors, board, visible locus arc, and sinusoidal input are independently engineered.',
      },
      historicalGeometry:
        'A contemporary mathematical-instrument account states that the two studs, moving joint, and vanishing point lie on one circle; fixed inscribed angles make every straight-edge position pass through the same second circle intersection.',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 408',
    },
    sourcePose: {
      bladeAngle: sourceState.bladeAngle,
      joint: sourceState.joint,
      setting:
        'blade horizontal to the right with two preset legs opening left, matching Brown’s main engraving',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      bladeAngleRelation:
        'bladeAngle=jointCircleAngle/2 for the selected circle diameter through the vanishing point and source joint',
      circleRelation:
        '|joint-circleCenter|=circleRadius=vanishingDistance/2',
      concurrencyRelation:
        'cross(vanishingPoint-joint, bladeDirection)=0',
      pinRelations:
        'cross(pin-joint, rotatedPresetLegDirection)=0 for both fixed pins',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.80, -2.79, -0.48),
    new THREE.Vector3(4.60, 2.79, 0.82),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 3.6, 13.5);
  root.userData.groundFloorY = -2.79;
  markShadows(root);
  board.receiveShadow = true;
  constructionCircleArc.castShadow = false;
  fixedPinChord.castShadow = false;
  correctCentrolinead(root);
  return finishDrawingGauge(root,update,cycleDuration);
}

export function createAuthoredCentrolineadMovement(movement) {
  if (movement.id !== 408) return null;
  return centrolinead(movement);
}
