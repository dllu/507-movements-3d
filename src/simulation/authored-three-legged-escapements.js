import * as THREE from 'three';
import {correctThreeLegParts, finishPinEscapement} from './pin-escapement-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 14,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function rectangularPalletPlateShape(width, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();

  // One continuous, approximately S-shaped aperture produces the opposed
  // upper and lower pallets visible in Brown and Beckett's full-size plate.
  const openingPoints = [
    new THREE.Vector2(-1.48, 0.02),
    new THREE.Vector2(-1.08, 0.02),
    new THREE.Vector2(-1.02, 0.39),
    new THREE.Vector2(-0.82, 0.64),
    new THREE.Vector2(-0.48, 0.80),
    new THREE.Vector2(-0.06, 0.88),
    new THREE.Vector2(0.08, 0.88),
    new THREE.Vector2(0.04, 0.54),
    new THREE.Vector2(0.48, 0.54),
    new THREE.Vector2(0.83, 0.49),
    new THREE.Vector2(1.13, 0.33),
    new THREE.Vector2(1.34, 0.08),
    new THREE.Vector2(1.41, -0.07),
    new THREE.Vector2(1.02, -0.07),
    new THREE.Vector2(0.97, -0.39),
    new THREE.Vector2(0.77, -0.62),
    new THREE.Vector2(0.42, -0.79),
    new THREE.Vector2(0.04, -0.87),
    new THREE.Vector2(-0.08, -0.87),
    new THREE.Vector2(-0.04, -0.54),
    new THREE.Vector2(-0.49, -0.54),
    new THREE.Vector2(-0.85, -0.49),
    new THREE.Vector2(-1.17, -0.33),
    new THREE.Vector2(-1.38, -0.10),
  ];
  const opening = new THREE.Path();
  openingPoints.forEach((point, index) => {
    if (index === 0) opening.moveTo(point.x, point.y);
    else opening.lineTo(point.x, point.y);
  });
  opening.closePath();
  shape.holes.push(opening);
  return shape;
}

function longToothPalletPlateShape(diskCenterY) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.31, -0.08);
  shape.lineTo(-0.34, -0.92);
  shape.bezierCurveTo(-0.39, -1.72, -0.84, -2.20, -1.48, -2.55);
  shape.bezierCurveTo(-2.04, -2.86, -2.30, -3.41, -2.28, -4.01);
  shape.bezierCurveTo(-2.24, -4.72, -1.70, -5.25, -0.98, -5.49);
  shape.bezierCurveTo(-0.42, -5.68, 0.42, -5.68, 0.98, -5.49);
  shape.bezierCurveTo(1.70, -5.25, 2.24, -4.72, 2.28, -4.01);
  shape.bezierCurveTo(2.30, -3.41, 2.04, -2.86, 1.48, -2.55);
  shape.bezierCurveTo(0.84, -2.20, 0.39, -1.72, 0.34, -0.92);
  shape.lineTo(0.31, -0.08);
  shape.closePath();

  const opening = new THREE.Path();
  opening.absellipse(0, diskCenterY, 1.72, 0.67, 0, FULL_TURN, true);
  shape.holes.push(opening);
  return shape;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function edgeTube(points, z, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    false,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(40, points.length * 2),
      radius, 8, false),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function threeLeggedDeadEscapement(movement) {
  const root = new THREE.Group();

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterPlateBounds = {
    bottom: 395,
    left: 14,
    right: 510,
    top: 159,
  };
  const sourceRasterWheelCenter = new THREE.Vector2(265, 273);
  const sourceRasterUpperWorkingTooth = new THREE.Vector2(277, 181);
  const sourceRasterLowerRightTooth = new THREE.Vector2(328, 346);
  const sourceRasterLowerLeftTooth = new THREE.Vector2(178, 318);
  const sourceRasterUpperPalletCorner = new THREE.Vector2(278, 201);
  const sourceRasterLowerPalletCorner = new THREE.Vector2(272, 369);
  const sourceRasterDirectionArrowStart = new THREE.Vector2(176, 419);
  const sourceRasterDirectionArrowEnd = new THREE.Vector2(371, 419);
  const sourceRasterScrews = [
    new THREE.Vector2(39, 198),
    new THREE.Vector2(487, 198),
    new THREE.Vector2(39, 359),
    new THREE.Vector2(488, 359),
  ];
  const plateWidth = 4.40;
  const plateHeight = plateWidth
    * (sourceRasterPlateBounds.bottom - sourceRasterPlateBounds.top)
    / (sourceRasterPlateBounds.right - sourceRasterPlateBounds.left);
  const sourceScale = plateWidth
    / (sourceRasterPlateBounds.right - sourceRasterPlateBounds.left);
  const wheelCenter = new THREE.Vector2(0, 0);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );

  const toothCount = 3;
  const toothPitch = FULL_TURN / toothCount;
  const wheelAdvancePerBeat = toothPitch / 2;
  const toothTipRadius = 0.78;
  const toothTipVisualRadius = 0.035;
  const centerDistanceRatio = 24;
  const centerDistance = toothTipRadius * centerDistanceRatio;
  const palletPivot = new THREE.Vector2(0, centerDistance);
  const plateCenterLocal = new THREE.Vector2(0, -centerDistance);
  const wheelDepth = 0.28;
  const palletDepth = 0.25;
  const workingPlaneZ = 0.39;
  const contactMarkerZ = 0.67;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const pendulumAmplitude = THREE.MathUtils.degToRad(1.8);
  const escapeAngle = THREE.MathUtils.degToRad(1);
  const releaseHalfPhase = Math.acos(
    escapeAngle / pendulumAmplitude,
  ) / Math.PI;
  const landingHalfPhase = 1 - releaseHalfPhase;
  const clearanceDropDuration = 0.035;
  const impulseEndHalfPhase = landingHalfPhase - clearanceDropDuration;
  const clearanceDropAngle = THREE.MathUtils.degToRad(2.4);
  const impulseAdvance = wheelAdvancePerBeat - clearanceDropAngle;
  const halfDeadRecoil = THREE.MathUtils.degToRad(1.1);
  const lowerPalletMaximumDepth = toothTipRadius * 0.115;
  const lowerPalletDepthLimit = toothTipRadius / 8;

  const pendulumMotionAtHalfPhase = (halfBeatIndex, halfPhase) => {
    const direction = positiveModulo(halfBeatIndex, 2) === 0 ? -1 : 1;
    const argument = Math.PI * halfPhase;
    const angularFrequency = Math.PI / halfBeatDuration;
    return {
      angle: direction * pendulumAmplitude * Math.cos(argument),
      angularAcceleration: -direction * pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angularSpeed: -direction * pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 'upper' : 'lower'
  );
  const oppositeSide = (side) => (side === 'upper' ? 'lower' : 'upper');
  const activeToothIndexAtBeatStart = (halfBeatIndex) => (
    positiveModulo(-halfBeatIndex, toothCount)
  );
  const wheelAngleAtBeatStart = (halfBeatIndex) => (
    Math.PI / 2 - halfBeatIndex * wheelAdvancePerBeat
  );
  const phaseProgress = (phase, start, end) => (
    (phase - start) / (end - start)
  );

  const rawStateAtTime = (time) => {
    const halfCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfCoordinate);
    const halfPhase = halfCoordinate - halfBeatIndex;
    const impulseSide = sideForHalfBeat(halfBeatIndex);
    const landingSide = oppositeSide(impulseSide);
    const pendulum = pendulumMotionAtHalfPhase(halfBeatIndex, halfPhase);
    const startToothIndex = activeToothIndexAtBeatStart(halfBeatIndex);
    const landingToothIndex = activeToothIndexAtBeatStart(halfBeatIndex + 1);
    let activeSide;
    let activeToothIndex;
    let beatAdvance;
    let contactKind;
    let mode;
    let recoil = 0;

    if (halfPhase < releaseHalfPhase) {
      recoil = halfDeadRecoil * (
        1 - smootherStep(halfPhase / releaseHalfPhase)
      );
      beatAdvance = -recoil;
      activeSide = impulseSide;
      activeToothIndex = startToothIndex;
      contactKind = 'half-dead-rest';
      mode = `${impulseSide}-half-dead-rest`;
    } else if (halfPhase <= impulseEndHalfPhase) {
      const progress = phaseProgress(
        halfPhase,
        releaseHalfPhase,
        impulseEndHalfPhase,
      );
      beatAdvance = impulseAdvance * smootherStep(progress);
      activeSide = impulseSide;
      activeToothIndex = startToothIndex;
      contactKind = 'direct-impulse';
      mode = `${impulseSide}-direct-impulse`;
    } else if (halfPhase < landingHalfPhase) {
      const progress = phaseProgress(
        halfPhase,
        impulseEndHalfPhase,
        landingHalfPhase,
      );
      beatAdvance = THREE.MathUtils.lerp(
        impulseAdvance,
        wheelAdvancePerBeat,
        smootherStep(progress),
      );
      activeSide = null;
      activeToothIndex = null;
      contactKind = 'clearance-drop';
      mode = `${impulseSide}-to-${landingSide}-clearance-drop`;
    } else {
      recoil = halfDeadRecoil * smootherStep(
        (halfPhase - landingHalfPhase) / (1 - landingHalfPhase),
      );
      beatAdvance = wheelAdvancePerBeat - recoil;
      activeSide = landingSide;
      activeToothIndex = landingToothIndex;
      contactKind = 'half-dead-rest';
      mode = `${landingSide}-half-dead-rest`;
    }

    const wheelAngle = wheelAngleAtBeatStart(halfBeatIndex) - beatAdvance;
    const activeToothAngle = activeToothIndex === null
      ? null
      : wheelAngle + activeToothIndex * toothPitch;
    const activeToothTip = activeToothAngle === null
      ? null
      : wheelCenter.clone().add(new THREE.Vector2(
        Math.cos(activeToothAngle) * toothTipRadius,
        Math.sin(activeToothAngle) * toothTipRadius,
      ));
    return {
      activeSide,
      activeToothAngle,
      activeToothIndex,
      activeToothTip,
      beatAdvance,
      contactKind,
      halfBeatIndex,
      halfPhase,
      impulseSide,
      landingSide,
      mode,
      palletAngle: pendulum.angle,
      palletAngularAcceleration: pendulum.angularAcceleration,
      palletAngularSpeed: pendulum.angularSpeed,
      recoil,
      startToothIndex,
      wheelAngle,
    };
  };

  const palletPlateLocalPoint = (worldPoint, palletAngle) => rotate2(
    worldPoint.clone().sub(palletPivot),
    -palletAngle,
  ).sub(plateCenterLocal);
  const palletPlateWorldPoint = (platePoint, palletAngle) => palletPivot
    .clone()
    .add(rotate2(
      platePoint.clone().add(plateCenterLocal),
      palletAngle,
    ));
  const addContactState = (state) => {
    if (!state.activeToothTip) {
      return {
        ...state,
        activeFace: null,
        contactError: null,
        contactPoint: null,
        contactPointLocal: null,
      };
    }
    const contactPointLocal = palletPlateLocalPoint(
      state.activeToothTip,
      state.palletAngle,
    );
    const contactPoint = palletPlateWorldPoint(
      contactPointLocal,
      state.palletAngle,
    );
    return {
      ...state,
      activeFace: state.contactKind === 'direct-impulse'
        ? `${state.activeSide}-generated-direct-impulse-face`
        : `${state.activeSide}-generated-half-dead-stopping-face`,
      contactError: contactPoint.distanceTo(state.activeToothTip),
      contactPoint,
      contactPointLocal,
    };
  };
  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = addContactState(rawStateAtTime(time));
    const before = rawStateAtTime(time - derivativeStep).wheelAngle;
    const after = rawStateAtTime(time + derivativeStep).wheelAngle;
    return {
      ...state,
      cycleIndex: Math.floor(time / pendulumPeriod),
      cyclePhase: positiveModulo(time, pendulumPeriod) / pendulumPeriod,
      wheelAngularAcceleration: (
        after - 2 * state.wheelAngle + before
      ) / derivativeStep ** 2,
      wheelAngularSpeed: (after - before) / (2 * derivativeStep),
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const toothTipAt = (wheelAngle, toothIndex) => wheelCenter.clone().add(
    new THREE.Vector2(
      Math.cos(wheelAngle + toothIndex * toothPitch) * toothTipRadius,
      Math.sin(wheelAngle + toothIndex * toothPitch) * toothTipRadius,
    ),
  );
  const profilePointsAcrossTime = (startTime, endTime, samples) => (
    Array.from({ length: samples }, (_, index) => {
      const time = THREE.MathUtils.lerp(
        startTime,
        endTime,
        index / (samples - 1),
      );
      const state = rawStateAtTime(time);
      return palletPlateLocalPoint(
        state.activeToothTip,
        state.palletAngle,
      );
    })
  );
  const upperImpulsePoints = profilePointsAcrossTime(
    releaseHalfPhase * halfBeatDuration,
    impulseEndHalfPhase * halfBeatDuration,
    41,
  );
  const lowerImpulsePoints = profilePointsAcrossTime(
    halfBeatDuration + releaseHalfPhase * halfBeatDuration,
    halfBeatDuration + impulseEndHalfPhase * halfBeatDuration,
    41,
  );
  const upperStoppingPoints = profilePointsAcrossTime(
    0,
    releaseHalfPhase * halfBeatDuration,
    31,
  );
  const lowerStoppingPoints = profilePointsAcrossTime(
    halfBeatDuration,
    halfBeatDuration + releaseHalfPhase * halfBeatDuration,
    31,
  );

  const plateMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.58,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.36,
    roughness: 0.42,
  });
  const faceMaterial = matte(PALETTE.accent, {
    metalness: 0.40,
    roughness: 0.34,
  });
  const markerMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.32,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.55,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-three-legged-escapement-frame';
  root.add(fixedFrame);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, plateHeight + 0.70, 0.19),
      frameMaterial,
    );
    rail.position.set(side * 2.27, 0, -0.43);
    rail.rotation.z = side * THREE.MathUtils.degToRad(4.5);
    rail.userData.role = 'spring-fork-relief-strip';
    fixedFrame.add(rail);
  }
  const rearBridge = beamBetween(
    new THREE.Vector3(-2.28, 1.38, -0.47),
    new THREE.Vector3(2.28, 1.38, -0.47),
    0.13,
    0.17,
    frameMaterial,
  );
  rearBridge.userData.role = 'rear-frame-cross-bridge';
  fixedFrame.add(rearBridge);
  const fixedArbor = cylinderAlongZ(0.13, 0.86, darkMaterial);
  fixedArbor.position.set(0, 0, -0.02);
  fixedArbor.userData.role = 'fixed-three-leg-wheel-arbor';
  fixedFrame.add(fixedArbor);

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role = 'remote-pivot-pendulum-pallet-assembly';
  root.add(palletAssembly);
  const plateCarrier = new THREE.Group();
  plateCarrier.position.set(
    plateCenterLocal.x,
    plateCenterLocal.y,
    0,
  );
  plateCarrier.userData.role = 'laterally-rocking-pallet-plate-carrier';
  palletAssembly.add(plateCarrier);
  const plate = new THREE.Mesh(
    centeredExtrusion(
      rectangularPalletPlateShape(plateWidth, plateHeight),
      palletDepth,
      0.012,
    ),
    plateMaterial,
  );
  plate.position.z = 0.04;
  plate.userData.role = 'single-opening-upper-lower-pallet-plate';
  plateCarrier.add(plate);

  const screwPositions = [
    new THREE.Vector2(-1.96, 0.70),
    new THREE.Vector2(1.96, 0.70),
    new THREE.Vector2(-1.96, -0.70),
    new THREE.Vector2(1.96, -0.70),
  ];
  const screwMeshes = screwPositions.map((position, index) => {
    const screw = cylinderAlongZ(0.12, 0.39, darkMaterial);
    screw.position.set(position.x, position.y, 0.26);
    screw.userData.index = index;
    screw.userData.role = 'pallet-plate-fastening-screw';
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.027, 0.023),
      markerMaterial,
    );
    slot.position.z = 0.205;
    slot.rotation.z = index % 2 === 0
      ? THREE.MathUtils.degToRad(72)
      : THREE.MathUtils.degToRad(-8);
    screw.add(slot);
    plateCarrier.add(screw);
    return screw;
  });

  const profileDefinitions = [
    [upperImpulsePoints, 'upper-generated-direct-impulse-face'],
    [lowerImpulsePoints, 'lower-generated-direct-impulse-face'],
    [upperStoppingPoints, 'upper-generated-half-dead-stopping-face'],
    [lowerStoppingPoints, 'lower-generated-half-dead-stopping-face'],
  ];
  const faceEdges = profileDefinitions.map(([points, role]) => {
    const face = edgeTube(
      points,
      workingPlaneZ + 0.08,
      role.includes('impulse') ? 0.030 : 0.024,
      faceMaterial,
      role,
    );
    plateCarrier.add(face);
    return face;
  });

  const wheel = new THREE.Group();
  wheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  wheel.userData.axis = Z_AXIS.clone();
  wheel.userData.role = 'three-legged-escape-wheel';
  root.add(wheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-sixty-degree-per-beat-rotor';
  wheel.add(wheelRotor);
  const legShape = polygonShape([
    new THREE.Vector2(0.08, -0.105),
    new THREE.Vector2(0.34, -0.16),
    new THREE.Vector2(0.53, -0.24),
    new THREE.Vector2(0.67, -0.15),
    new THREE.Vector2(toothTipRadius, -0.025),
    new THREE.Vector2(toothTipRadius, 0.025),
    new THREE.Vector2(0.61, 0.105),
    new THREE.Vector2(0.42, 0.18),
    new THREE.Vector2(0.12, 0.11),
  ]);
  const legMeshes = [];
  const toothTips = [];
  for (let index = 0; index < toothCount; index += 1) {
    const leg = new THREE.Mesh(
      centeredExtrusion(legShape, wheelDepth, 0.009),
      wheelMaterial,
    );
    leg.rotation.z = index * toothPitch;
    leg.position.z = 0.04;
    leg.userData.index = index;
    leg.userData.role = 'three-legged-wheel-arm-and-working-tooth';
    wheelRotor.add(leg);
    legMeshes.push(leg);

    const toothTip = new THREE.Mesh(
      new THREE.SphereGeometry(toothTipVisualRadius, 14, 10),
      markerMaterial,
    );
    const angle = index * toothPitch;
    toothTip.position.set(
      Math.cos(angle) * toothTipRadius,
      Math.sin(angle) * toothTipRadius,
      workingPlaneZ + 0.10,
    );
    toothTip.userData.index = index;
    toothTip.userData.role = 'sharp-three-leg-working-tip';
    wheelRotor.add(toothTip);
    toothTips.push(toothTip);
  }
  const wheelHub = cylinderAlongZ(0.14, 0.70, darkMaterial);
  wheelHub.position.z = 0.08;
  wheelHub.userData.role = 'light-three-leg-wheel-hub';
  wheelRotor.add(wheelHub);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.066, 16, 12),
    markerMaterial,
  );
  contactMarker.position.z = contactMarkerZ;
  contactMarker.userData.role = 'active-three-leg-pallet-contact';
  root.add(contactMarker);

  const plateMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.25, 0.030),
    markerMaterial,
  );
  plateMotionIndex.position.set(0, -0.91, 0.24);
  plateMotionIndex.userData.role = 'right-left-pendulum-plate-index';
  plateCarrier.add(plateMotionIndex);

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.palletAngle;
    wheelRotor.rotation.z = state.wheelAngle;
    contactMarker.visible = state.contactPoint !== null && !root.userData.workingPartsReview?.contactMarkersSuppressed;
    if (state.contactPoint) {
      contactMarker.position.set(
        state.contactPoint.x,
        state.contactPoint.y,
        contactMarkerZ,
      );
    }
    contactMarker.userData.activeFace = state.activeFace;
    contactMarker.userData.activeSide = state.activeSide;
    contactMarker.userData.activeToothIndex = state.activeToothIndex;
    contactMarker.userData.contactError = state.contactError;
    contactMarker.userData.contactKind = state.contactKind;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    contactMarker,
    faceEdges,
    fixedArbor,
    fixedFrame,
    legMeshes,
    palletAssembly,
    plate,
    plateCarrier,
    plateMotionIndex,
    screwMeshes,
    toothTips,
    wheel,
    wheelHub,
    wheelRotor,
  };
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.75, -1.62, -0.90),
    new THREE.Vector3(2.75, 1.62, 1.00),
  );
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    centerDistance,
    centerDistanceRatio,
    clearanceDropAngle,
    clearanceDropDuration,
    contactMarkerZ,
    escapeAngle,
    halfBeatDuration,
    halfDeadRecoil,
    impulseAdvance,
    impulseEndHalfPhase,
    landingHalfPhase,
    lowerPalletDepthLimit,
    lowerPalletMaximumDepth,
    palletDepth,
    palletPivot: palletPivot.clone(),
    pendulumAmplitude,
    pendulumPeriod,
    plateCenterLocal: plateCenterLocal.clone(),
    plateHeight,
    plateWidth,
    releaseHalfPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    toothCount,
    toothPitch,
    toothTipRadius,
    toothTipVisualRadius,
    wheelAdvancePerBeat,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    workingPlaneZ,
  };
  root.userData.mechanism = 'Denison’s original three-legged half-dead escapement: three lightweight 120-degree-spaced wheel legs act directly on upper and lower pallets cut into one pendulum-carried plate. A clockwise 60-degree step alternates upper rightward and lower leftward impulses; the stopping portions deliberately recoil slightly before release.';
  root.userData.palletFaces = {
    lower: {
      impulsePoints: lowerImpulsePoints,
      maximumDepth: lowerPalletMaximumDepth,
      position: 'lower boundary of the single plate opening',
      stoppingPoints: lowerStoppingPoints,
    },
    upper: {
      impulsePoints: upperImpulsePoints,
      position: 'upper boundary of the single plate opening',
      stoppingPoints: upperStoppingPoints,
    },
  };
  root.userData.palletPlateLocalPoint = palletPlateLocalPoint;
  root.userData.palletPlateWorldPoint = palletPlateWorldPoint;
  root.userData.presentation = 'full-size-style front elevation focused on the rocking pallet plate and open three-leg wheel';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 306 page marks Animated unavailable and supplies Brown’s static plate and description.',
    referenceScope: 'Brown fixes one rectangular pendulum plate, one continuous upper/lower pallet opening, three open wheel legs, and a rightward shown impulse. Beckett fixes the clockwise direct-impulse principle, 60-degree alternating beat, 24:1 centre-distance construction, one-degree escape, lower-pallet depth limit, light wheel, finite clearance, and intentionally half-dead stopping faces.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodConstructionReference: {
      author: 'Edmund Beckett, Lord Grimthorpe',
      construction: 'The pallet-arbor distance is about twenty-four times the wheel radius for a one-degree escape; the greatest lower-pallet depth is less than one-eighth wheel radius; a spring fork protects the teeth in large clocks.',
      designDate: 1851,
      figure: 17,
      figureScale: 'full-sized view of the escapement used for the Westminster pendulum',
      operatingEvidence: 'The upper tooth is shown giving impulse. Three teeth retain the most direct part of Macdowall’s single-pin impulse, while half-dead horizontal stopping faces deliberately introduce slight recoil.',
      page: 71,
      publication: 'A Rudimentary Treatise on Clocks, Watches and Bells for Public Purposes',
      publicationEdition: 8,
      publicationYear: 1903,
      url: 'https://campaners.com/pdf/pdf3067.pdf',
      wheelMass: 'one-sixth ounce (73 grains) in the Westminster trial escapement',
    },
    plate306: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one clockwise three-leg open wheel behind one laterally rocking rectangular plate whose single S-shaped aperture forms alternating upper and lower pallets',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: false,
      rasterDirectionArrowEnd: sourceRasterDirectionArrowEnd.clone(),
      rasterDirectionArrowStart: sourceRasterDirectionArrowStart.clone(),
      rasterLowerLeftTooth: sourceRasterLowerLeftTooth.clone(),
      rasterLowerPalletCorner: sourceRasterLowerPalletCorner.clone(),
      rasterLowerRightTooth: sourceRasterLowerRightTooth.clone(),
      rasterPlateBounds: sourceRasterPlateBounds,
      rasterScrews: sourceRasterScrews.map((point) => point.clone()),
      rasterUpperPalletCorner: sourceRasterUpperPalletCorner.clone(),
      rasterUpperWorkingTooth: sourceRasterUpperWorkingTooth.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      shownAction: 'upper tooth impulses the pendulum plate to the right',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'upper-half-dead-stop-unrecoils-to-release',
      'upper-tooth-directly-impulses-plate-right',
      'finite-clearance-drop-to-lower-pallet',
      'lower-half-dead-stop-recoils-at-right-extreme-and-unrecoils',
      'lower-tooth-directly-impulses-plate-left',
      'finite-clearance-drop-to-upper-pallet',
      'upper-half-dead-stop-recoils-at-left-extreme',
    ],
  };
  root.userData.toothTipAt = toothTipAt;
  root.userData.transmission = {
    clearance: 'a finite 2.4-degree wheel drop separates each impulse face from the next stopping face',
    direction: 'clockwise; the upper tooth therefore drives the plate rightward and the lower tooth leftward',
    impulseAdvanceRadians: impulseAdvance,
    lowerPalletDepthRule: 'modeled at 0.115 wheel radius, below Beckett’s one-eighth-radius maximum',
    recoil: 'intentional half-dead recoil on both stopping faces',
    toothCount,
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
    wheelTurnsPerSixBeats: 1,
  };
  root.userData.wheelAngleAtBeatStart = wheelAngleAtBeatStart;

  correctThreeLegParts(root,movement.id);
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [contactMarker, plateMotionIndex, ...toothTips]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(0.9, 0.7, 13.6),
    root,
    update,
  };
}

function longStoppingToothEscapement(movement) {
  const root = new THREE.Group();

  // This is Beckett's refinement of 306, not the same contact layout in a
  // decorative frame. Three long outer teeth lock on D/E in the front plane;
  // three short axial pins near the arbor impulse A/B in a rear plane.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterPendulumPivot = new THREE.Vector2(291, 28);
  const sourceRasterWheelCenter = new THREE.Vector2(263, 359);
  const sourceRasterPalletA = new THREE.Vector2(307, 333);
  const sourceRasterPalletB = new THREE.Vector2(254, 397);
  const sourceRasterStopD = new THREE.Vector2(79, 355);
  const sourceRasterStopE = new THREE.Vector2(452, 351);
  const sourceRasterUpperLongTooth = new THREE.Vector2(372, 225);
  const sourceRasterLowerLongTooth = new THREE.Vector2(357, 507);
  const sourceRasterLeftLongTooth = new THREE.Vector2(61, 351);
  const sourceRasterOpeningBounds = {
    bottom: 404,
    left: 113,
    right: 428,
    top: 307,
  };
  const sourceRasterPlateBounds = {
    bottom: 470,
    left: 47,
    right: 490,
    top: 24,
  };
  const palletPivot = new THREE.Vector2(0, 4.05);
  const wheelCenter = new THREE.Vector2(0, -0.15);
  const centerDistance = palletPivot.distanceTo(wheelCenter);
  const sourcePivotToWheel = new THREE.Vector2(
    sourceRasterWheelCenter.x - sourceRasterPendulumPivot.x,
    sourceRasterPendulumPivot.y - sourceRasterWheelCenter.y,
  );
  const modelPivotToWheel = wheelCenter.clone().sub(palletPivot);
  const sourceScale = centerDistance / sourcePivotToWheel.length();
  const sourceAlignmentAngle = modelPivotToWheel.angle()
    - sourcePivotToWheel.angle();
  const sourcePointToModel = ({ x, y }) => palletPivot.clone().add(
    rotate2(new THREE.Vector2(
      x - sourceRasterPendulumPivot.x,
      sourceRasterPendulumPivot.y - y,
    ), sourceAlignmentAngle).multiplyScalar(sourceScale),
  );

  const toothCount = 3;
  const toothPitch = FULL_TURN / toothCount;
  const wheelAdvancePerBeat = toothPitch / 2;
  const longToothRadius = 1.88;
  const impulsePinOrbitRadius = 0.39;
  const impulsePinRadius = 0.058;
  const impulsePinLength = 0.38;
  const impulsePinPhaseOffset = -3 * Math.PI / 4;
  const wheelDepth = 0.24;
  const palletDepth = 0.23;
  const lockPlaneZ = 0.43;
  const impulsePlaneZ = -0.31;
  const contactMarkerZ = {
    impulse: 0.64,
    lock: 0.72,
  };

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const pendulumAmplitude = THREE.MathUtils.degToRad(3.0);
  const releaseAngle = THREE.MathUtils.degToRad(0.80);
  const releaseHalfPhase = Math.acos(
    releaseAngle / pendulumAmplitude,
  ) / Math.PI;
  const landingHalfPhase = 1 - releaseHalfPhase;
  const clearanceDropDuration = 0.035;
  const impulseEndHalfPhase = landingHalfPhase - clearanceDropDuration;
  const clearanceDropAngle = THREE.MathUtils.degToRad(8);
  const impulseAdvance = wheelAdvancePerBeat - clearanceDropAngle;
  const phaseBoundaryEpsilon = 1e-12;

  const pendulumMotionAtHalfPhase = (halfBeatIndex, halfPhase) => {
    const direction = positiveModulo(halfBeatIndex, 2) === 0 ? -1 : 1;
    const argument = Math.PI * halfPhase;
    const angularFrequency = Math.PI / halfBeatDuration;
    return {
      angle: direction * pendulumAmplitude * Math.cos(argument),
      angularAcceleration: -direction * pendulumAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angularSpeed: -direction * pendulumAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const lockSideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 'D-left' : 'E-right'
  );
  const impulsePalletForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 'A-upper' : 'B-lower'
  );
  const activeWheelIndexAtBeatStart = (halfBeatIndex) => (
    positiveModulo(-halfBeatIndex, toothCount)
  );
  const wheelAngleAtBeatStart = (halfBeatIndex) => (
    Math.PI - halfBeatIndex * wheelAdvancePerBeat
  );
  const longToothTipAt = (wheelAngle, toothIndex) => wheelCenter.clone().add(
    new THREE.Vector2(
      Math.cos(wheelAngle + toothIndex * toothPitch) * longToothRadius,
      Math.sin(wheelAngle + toothIndex * toothPitch) * longToothRadius,
    ),
  );
  const impulsePinCenterAt = (wheelAngle, pinIndex) => wheelCenter.clone().add(
    new THREE.Vector2(
      Math.cos(
        wheelAngle + pinIndex * toothPitch + impulsePinPhaseOffset,
      ) * impulsePinOrbitRadius,
      Math.sin(
        wheelAngle + pinIndex * toothPitch + impulsePinPhaseOffset,
      ) * impulsePinOrbitRadius,
    ),
  );
  const phaseProgress = (phase, start, end) => (
    (phase - start) / (end - start)
  );

  const rawStateAtTime = (time) => {
    const halfCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfCoordinate);
    const halfPhase = halfCoordinate - halfBeatIndex;
    const startingLockSide = lockSideForHalfBeat(halfBeatIndex);
    const landingLockSide = lockSideForHalfBeat(halfBeatIndex + 1);
    const impulsePallet = impulsePalletForHalfBeat(halfBeatIndex);
    const startIndex = activeWheelIndexAtBeatStart(halfBeatIndex);
    const landingIndex = activeWheelIndexAtBeatStart(halfBeatIndex + 1);
    const pendulum = pendulumMotionAtHalfPhase(halfBeatIndex, halfPhase);
    let activeIndex;
    let activePoint;
    let activeSystem;
    let beatAdvance;
    let contactKind;
    let mode;

    if (halfPhase < releaseHalfPhase - phaseBoundaryEpsilon) {
      beatAdvance = 0;
      activeIndex = startIndex;
      activeSystem = 'outer-lock';
      contactKind = 'dead-lock';
      mode = `${startingLockSide}-outer-dead-lock`;
    } else if (halfPhase <= impulseEndHalfPhase + phaseBoundaryEpsilon) {
      const progress = phaseProgress(
        halfPhase,
        releaseHalfPhase,
        impulseEndHalfPhase,
      );
      beatAdvance = impulseAdvance * smootherStep(progress);
      activeIndex = startIndex;
      activeSystem = 'inner-impulse';
      contactKind = 'direct-impulse';
      mode = `${impulsePallet}-inner-pin-impulse`;
    } else if (halfPhase < landingHalfPhase - phaseBoundaryEpsilon) {
      const progress = phaseProgress(
        halfPhase,
        impulseEndHalfPhase,
        landingHalfPhase,
      );
      beatAdvance = THREE.MathUtils.lerp(
        impulseAdvance,
        wheelAdvancePerBeat,
        smootherStep(progress),
      );
      activeIndex = null;
      activeSystem = null;
      contactKind = 'clearance-drop';
      mode = `${impulsePallet}-to-${landingLockSide}-free-drop`;
    } else {
      beatAdvance = wheelAdvancePerBeat;
      activeIndex = landingIndex;
      activeSystem = 'outer-lock';
      contactKind = 'dead-lock';
      mode = `${landingLockSide}-outer-dead-lock`;
    }

    const wheelAngle = wheelAngleAtBeatStart(halfBeatIndex) - beatAdvance;
    if (activeSystem === 'outer-lock') {
      activePoint = longToothTipAt(wheelAngle, activeIndex);
    } else if (activeSystem === 'inner-impulse') {
      activePoint = impulsePinCenterAt(wheelAngle, activeIndex);
    } else {
      activePoint = null;
    }
    return {
      activeIndex,
      activePoint,
      activeSystem,
      beatAdvance,
      contactKind,
      halfBeatIndex,
      halfPhase,
      impulsePallet,
      landingIndex,
      landingLockSide,
      mode,
      palletAngle: pendulum.angle,
      palletAngularAcceleration: pendulum.angularAcceleration,
      palletAngularSpeed: pendulum.angularSpeed,
      startIndex,
      startingLockSide,
      wheelAngle,
    };
  };

  const plateCenterLocal = wheelCenter.clone().sub(palletPivot);
  const palletPlateLocalPoint = (worldPoint, palletAngle) => rotate2(
    worldPoint.clone().sub(palletPivot),
    -palletAngle,
  ).sub(plateCenterLocal);
  const palletPlateWorldPoint = (platePoint, palletAngle) => palletPivot
    .clone()
    .add(rotate2(
      platePoint.clone().add(plateCenterLocal),
      palletAngle,
    ));
  const addContactState = (state) => {
    if (!state.activePoint) {
      return {
        ...state,
        activeFace: null,
        contactError: null,
        contactPoint: null,
        contactPointLocal: null,
      };
    }
    const contactPointLocal = palletPlateLocalPoint(
      state.activePoint,
      state.palletAngle,
    );
    const contactPoint = palletPlateWorldPoint(
      contactPointLocal,
      state.palletAngle,
    );
    return {
      ...state,
      activeFace: state.activeSystem === 'outer-lock'
        ? `${state.halfPhase < releaseHalfPhase
          ? state.startingLockSide
          : state.landingLockSide}-concentric-dead-stop`
        : `${state.impulsePallet}-generated-impulse-pallet`,
      contactError: contactPoint.distanceTo(state.activePoint),
      contactPoint,
      contactPointLocal,
    };
  };
  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = addContactState(rawStateAtTime(time));
    const before = rawStateAtTime(time - derivativeStep).wheelAngle;
    const after = rawStateAtTime(time + derivativeStep).wheelAngle;
    return {
      ...state,
      cycleIndex: Math.floor(time / pendulumPeriod),
      cyclePhase: positiveModulo(time, pendulumPeriod) / pendulumPeriod,
      wheelAngularAcceleration: (
        after - 2 * state.wheelAngle + before
      ) / derivativeStep ** 2,
      wheelAngularSpeed: (after - before) / (2 * derivativeStep),
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const profilePointsAcrossTime = (startTime, endTime, samples) => (
    Array.from({ length: samples }, (_, index) => {
      const time = THREE.MathUtils.lerp(
        startTime,
        endTime,
        index / (samples - 1),
      );
      const state = rawStateAtTime(time);
      return palletPlateLocalPoint(state.activePoint, state.palletAngle);
    })
  );
  const stopDPoints = profilePointsAcrossTime(
    0,
    releaseHalfPhase * halfBeatDuration,
    33,
  );
  const palletAPoints = profilePointsAcrossTime(
    releaseHalfPhase * halfBeatDuration,
    impulseEndHalfPhase * halfBeatDuration,
    41,
  );
  const stopEPoints = profilePointsAcrossTime(
    halfBeatDuration,
    (1 + releaseHalfPhase) * halfBeatDuration,
    33,
  );
  const palletBPoints = profilePointsAcrossTime(
    (1 + releaseHalfPhase) * halfBeatDuration,
    (1 + impulseEndHalfPhase) * halfBeatDuration,
    41,
  );
  const deadStopRadius = palletPivot.distanceTo(
    longToothTipAt(Math.PI, 0),
  );

  const plateMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.58,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.26,
    roughness: 0.45,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.38,
    roughness: 0.40,
  });
  const faceMaterial = matte(PALETTE.accent, {
    metalness: 0.42,
    roughness: 0.34,
  });
  const markerMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.30,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.54,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-long-tooth-escapement-frame';
  root.add(fixedFrame);
  const rearUpright = beamBetween(
    new THREE.Vector3(-2.55, -1.38, -0.56),
    new THREE.Vector3(-2.55, 4.33, -0.56),
    0.15,
    0.18,
    frameMaterial,
  );
  rearUpright.userData.role = 'rear-clock-frame-upright';
  fixedFrame.add(rearUpright);
  for (const [point, name] of [
    [palletPivot, 'pendulum-pallet-pivot'],
    [wheelCenter, 'three-leg-wheel-arbor'],
  ]) {
    const bracket = beamBetween(
      new THREE.Vector3(-2.55, point.y, -0.56),
      new THREE.Vector3(point.x, point.y, -0.56),
      0.12,
      0.18,
      frameMaterial,
    );
    bracket.userData.role = `${name}-bracket`;
    fixedFrame.add(bracket);
    const bearing = cylinderAlongZ(0.14, 0.96, darkMaterial);
    bearing.position.set(point.x, point.y, -0.06);
    bearing.userData.role = name;
    fixedFrame.add(bearing);
  }

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role = 'long-tooth-pendulum-pallet-plate';
  root.add(palletAssembly);
  const localWheelCenterY = wheelCenter.y - palletPivot.y;
  const plate = new THREE.Mesh(
    centeredExtrusion(
      longToothPalletPlateShape(localWheelCenterY),
      palletDepth,
      0.012,
    ),
    plateMaterial,
  );
  plate.position.z = 0;
  plate.userData.role = 'bottle-profile-long-tooth-pallet-plate';
  palletAssembly.add(plate);
  const pivotEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.075, 10, 40),
    plateMaterial,
  );
  pivotEye.position.z = 0.08;
  pivotEye.userData.role = 'pendulum-pallet-pivot-eye';
  palletAssembly.add(pivotEye);

  const plateCarrier = new THREE.Group();
  plateCarrier.position.set(plateCenterLocal.x, plateCenterLocal.y, 0);
  plateCarrier.userData.role = 'two-plane-pallet-carrier';
  palletAssembly.add(plateCarrier);

  const addFaceBacking = (points, width, z, role) => {
    const start = points[0];
    const end = points.at(-1);
    const backing = beamBetween(
      new THREE.Vector3(start.x, start.y, z),
      new THREE.Vector3(end.x, end.y, z),
      width,
      0.16,
      darkMaterial,
    );
    backing.userData.role = role;
    plateCarrier.add(backing);
    return backing;
  };
  const stopD = addFaceBacking(
    stopDPoints,
    0.17,
    lockPlaneZ,
    'adjustable-dead-stop-D',
  );
  const stopE = addFaceBacking(
    stopEPoints,
    0.17,
    lockPlaneZ,
    'adjustable-dead-stop-E',
  );
  const palletA = addFaceBacking(
    palletAPoints,
    0.14,
    impulsePlaneZ,
    'hardened-impulse-pallet-A',
  );
  const palletB = addFaceBacking(
    palletBPoints,
    0.14,
    impulsePlaneZ,
    'hardened-impulse-pallet-B',
  );
  const faceDefinitions = [
    [stopDPoints, lockPlaneZ + 0.11, 'D-left-concentric-dead-stop'],
    [stopEPoints, lockPlaneZ + 0.11, 'E-right-concentric-dead-stop'],
    [palletAPoints, impulsePlaneZ + 0.11,
      'A-upper-generated-inner-pin-impulse-face'],
    [palletBPoints, impulsePlaneZ + 0.11,
      'B-lower-generated-inner-pin-impulse-face'],
  ];
  const faceEdges = faceDefinitions.map(([points, z, role]) => {
    const face = edgeTube(
      points,
      z,
      role.includes('impulse') ? 0.028 : 0.024,
      faceMaterial,
      role,
    );
    plateCarrier.add(face);
    return face;
  });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role = 'separate-lock-and-impulse-three-leg-wheel';
  root.add(escapeWheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-sixty-degree-long-tooth-rotor';
  escapeWheel.add(wheelRotor);
  const longToothShape = polygonShape([
    new THREE.Vector2(0.12, -0.075),
    new THREE.Vector2(longToothRadius - 0.26, -0.09),
    new THREE.Vector2(longToothRadius, 0),
    new THREE.Vector2(longToothRadius - 0.26, 0.09),
    new THREE.Vector2(0.12, 0.075),
  ]);
  const longToothMeshes = [];
  const impulsePins = [];
  for (let index = 0; index < toothCount; index += 1) {
    const longTooth = new THREE.Mesh(
      centeredExtrusion(longToothShape, wheelDepth, 0.008),
      wheelMaterial,
    );
    longTooth.rotation.z = index * toothPitch;
    longTooth.position.z = lockPlaneZ;
    longTooth.userData.index = index;
    longTooth.userData.role = 'long-outer-locking-tooth-only';
    wheelRotor.add(longTooth);
    longToothMeshes.push(longTooth);

    const pin = cylinderAlongZ(
      impulsePinRadius,
      impulsePinLength,
      markerMaterial,
      24,
    );
    const angle = index * toothPitch + impulsePinPhaseOffset;
    pin.position.set(
      Math.cos(angle) * impulsePinOrbitRadius,
      Math.sin(angle) * impulsePinOrbitRadius,
      impulsePlaneZ,
    );
    pin.userData.index = index;
    pin.userData.pointsBackward = true;
    pin.userData.role = 'short-inner-backward-pointing-impulse-pin';
    wheelRotor.add(pin);
    impulsePins.push(pin);
  }
  const wheelHub = cylinderAlongZ(0.14, 1.12, darkMaterial);
  wheelHub.position.z = 0.05;
  wheelHub.userData.role = 'common-two-plane-three-leg-hub';
  wheelRotor.add(wheelHub);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 16, 12),
    markerMaterial,
  );
  contactMarker.userData.role = 'active-long-tooth-or-inner-pin-contact';
  root.add(contactMarker);

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.palletAngle;
    wheelRotor.rotation.z = state.wheelAngle;
    contactMarker.visible = state.contactPoint !== null && !root.userData.workingPartsReview?.contactMarkersSuppressed;
    if (state.contactPoint) {
      contactMarker.position.set(
        state.contactPoint.x,
        state.contactPoint.y,
        state.activeSystem === 'outer-lock'
          ? contactMarkerZ.lock
          : contactMarkerZ.impulse,
      );
    }
    contactMarker.userData.activeFace = state.activeFace;
    contactMarker.userData.activeIndex = state.activeIndex;
    contactMarker.userData.activeSystem = state.activeSystem;
    contactMarker.userData.contactError = state.contactError;
    contactMarker.userData.contactKind = state.contactKind;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    contactMarker,
    escapeWheel,
    faceEdges,
    fixedFrame,
    impulsePins,
    longToothMeshes,
    palletA,
    palletAssembly,
    palletB,
    plate,
    plateCarrier,
    pivotEye,
    stopD,
    stopE,
    wheelHub,
    wheelRotor,
  };
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.95, -1.82, -1.02),
    new THREE.Vector3(2.95, 4.48, 1.05),
  );
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    centerDistance,
    clearanceDropAngle,
    clearanceDropDuration,
    contactMarkerZ,
    deadStopRadius,
    halfBeatDuration,
    impulseAdvance,
    impulseEndHalfPhase,
    impulsePinLength,
    impulsePinOrbitRadius,
    impulsePinPhaseOffset,
    impulsePinRadius,
    impulsePlaneZ,
    landingHalfPhase,
    lockPlaneZ,
    longToothRadius,
    palletDepth,
    palletPivot: palletPivot.clone(),
    pendulumAmplitude,
    pendulumPeriod,
    plateCenterLocal: plateCenterLocal.clone(),
    releaseAngle,
    releaseHalfPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceAlignmentAngle,
    sourceScale,
    toothCount,
    toothPitch,
    wheelAdvancePerBeat,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
  };
  root.userData.impulsePinCenterAt = impulsePinCenterAt;
  root.userData.longToothTipAt = longToothTipAt;
  root.userData.mechanism = 'Beckett’s long-stopping-tooth refinement of the three-legged dead escapement: three long outer teeth lock alternately on adjustable dead stops D and E in the front plane, while three separate short pins pointing backward act only on hardened impulse pallets A and B near the arbor in the rear plane.';
  root.userData.palletFaces = {
    A: {
      axialPlaneZ: impulsePlaneZ,
      function: 'impulse only',
      points: palletAPoints,
      position: 'upper, near the arbor',
    },
    B: {
      axialPlaneZ: impulsePlaneZ,
      function: 'impulse only',
      points: palletBPoints,
      position: 'lower, near the arbor',
    },
    D: {
      axialPlaneZ: lockPlaneZ,
      function: 'dead locking only',
      points: stopDPoints,
      position: 'outer left',
      radiusFromPalletPivot: deadStopRadius,
    },
    E: {
      axialPlaneZ: lockPlaneZ,
      function: 'dead locking only',
      points: stopEPoints,
      position: 'outer right',
      radiusFromPalletPivot: deadStopRadius,
    },
  };
  root.userData.palletPlateLocalPoint = palletPlateLocalPoint;
  root.userData.palletPlateWorldPoint = palletPlateWorldPoint;
  root.userData.presentation = 'front-oblique elevation exposing the distinct front locking and rear impulse planes';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 307 page marks Animated unavailable and supplies only Brown’s static plate and short cross-reference to 306.',
    referenceScope: 'Brown fixes the bottle plate and labels A, B, D, and E. Beckett figure 18 and the contemporary Britannica description distinguish three long outer locking teeth from three short backward-pointing inner impulse pins, place D/E in the front locking plane and A/B in the rear impulse plane, and explain the reduced friction, easier adjustment, and increased safe pendulum swing.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    britannicaConstructionReference: {
      details: 'Three long wheel teeth lock only on dead pallets D and E set on the front of the pallet plate. Hardened or jeweled pallets A and B are acted on by three sharp-edged pins set in the wheel and pointing backward.',
      figure: 8,
      publication: 'Encyclopaedia Britannica, Ninth Edition, volume 6, Clocks',
      publicationYear: 1878,
      url: 'https://en.wikisource.org/wiki/Page:Encyclop%C3%A6dia_Britannica,_Ninth_Edition,_v._6.djvu/29',
    },
    officialDescription: movement.description,
    periodConstructionReference: {
      author: 'Edmund Beckett, Lord Grimthorpe',
      benefits: 'Long stopping teeth further reduce pallet friction, make pallet adjustment easier, and give room for a longer pendulum swing than the two-degree safe limit of the original form.',
      figure: 18,
      page: 72,
      publication: 'A Rudimentary Treatise on Clocks, Watches and Bells for Public Purposes',
      publicationEdition: 8,
      publicationYear: 1903,
      url: 'https://campaners.com/pdf/pdf3067.pdf',
    },
    plate307: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one three-leg wheel carries long outer locking teeth and a separate inner row of short impulse pins through two axial working planes in one pendulum-carried bottle plate',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterLeftLongTooth: sourceRasterLeftLongTooth.clone(),
      rasterLowerLongTooth: sourceRasterLowerLongTooth.clone(),
      rasterOpeningBounds: sourceRasterOpeningBounds,
      rasterPalletA: sourceRasterPalletA.clone(),
      rasterPalletB: sourceRasterPalletB.clone(),
      rasterPendulumPivot: sourceRasterPendulumPivot.clone(),
      rasterPlateBounds: sourceRasterPlateBounds,
      rasterStopD: sourceRasterStopD.clone(),
      rasterStopE: sourceRasterStopE.clone(),
      rasterUpperLongTooth: sourceRasterUpperLongTooth.clone(),
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'left-long-tooth-dead-lock-on-D',
      'upper-inner-pin-direct-impulse-on-A',
      'finite-free-drop-to-right-long-tooth',
      'right-long-tooth-dead-lock-on-E',
      'lower-inner-pin-direct-impulse-on-B',
      'finite-free-drop-to-left-long-tooth',
    ],
  };
  root.userData.transmission = {
    axialSystems: 2,
    clearance: 'eight-degree free wheel drop between each inner-pin impulse and the next outer-tooth lock',
    direction: 'clockwise',
    impulsePinCount: 3,
    impulseSystem: 'three short backward-pointing inner pins act only on A/B',
    lockingToothCount: 3,
    lockSystem: 'three long outer teeth act only on dead stops D/E',
    recoil: 'none while D or E is engaged',
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
  };
  root.userData.wheelAngleAtBeatStart = wheelAngleAtBeatStart;

  correctThreeLegParts(root,movement.id);
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [contactMarker, ...impulsePins]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(2.0, 1.2, 13.8),
    root,
    update,
  };
}

export function createAuthoredThreeLeggedEscapementMovement(movement) {
  switch (movement.id) {
    case 306: return finishPinEscapement(threeLeggedDeadEscapement(movement));
    case 307: return finishPinEscapement(longStoppingToothEscapement(movement));
    default: return null;
  }
}
