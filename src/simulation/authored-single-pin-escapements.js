import * as THREE from 'three';
import {correctSinglePinParts, finishPinEscapement} from './pin-escapement-working-parts.js';
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
    curveSegments: 16,
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

function annularShape(outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
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
    new THREE.TubeGeometry(curve, Math.max(36, points.length * 2),
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

function outerPalletPlateShape(diskCenterY) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.22, -0.42);
  shape.lineTo(-0.24, -1.34);
  shape.bezierCurveTo(-0.27, -2.30, -0.64, -2.90, -1.08, -3.55);
  shape.bezierCurveTo(-1.48, -4.16, -1.47, -4.92, -1.19, -5.56);
  shape.lineTo(-0.94, -6.12);
  shape.lineTo(0.94, -6.12);
  shape.lineTo(1.19, -5.56);
  shape.bezierCurveTo(1.47, -4.92, 1.48, -4.16, 1.08, -3.55);
  shape.bezierCurveTo(0.64, -2.90, 0.27, -2.30, 0.24, -1.34);
  shape.lineTo(0.22, -0.42);
  shape.closePath();

  const escapementOpening = new THREE.Path();
  escapementOpening.absarc(0, diskCenterY, 0.91, 0, FULL_TURN, true);
  shape.holes.push(escapementOpening);

  for (const x of [-0.59, 0.59]) {
    const adjustmentOpening = new THREE.Path();
    adjustmentOpening.absarc(x, -5.57, 0.29, 0, FULL_TURN, true);
    shape.holes.push(adjustmentOpening);
  }
  return shape;
}

function macdowallSinglePinEscapement(movement) {
  const root = new THREE.Group();

  // Brown's small open circle is the eccentric ruby pin and the adjacent
  // filled circle is the disc arbor. The dashed lower semicircle is the disc
  // hidden behind the pendulum-carried pallet plate. Contemporary accounts
  // identify this as C. Macdowall's 1851 single-pin dead escapement.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterPendulumPivot = new THREE.Vector2(264, 35);
  const sourceRasterDiskCenter = new THREE.Vector2(260, 380);
  const sourceRasterRubyPin = new THREE.Vector2(241, 380);
  const sourceRasterUpperPalletCorner = new THREE.Vector2(268, 340);
  const sourceRasterLowerPalletCorner = new THREE.Vector2(268, 419);
  const sourceRasterLeftDeadFaceEnd = new THREE.Vector2(191, 389);
  const sourceRasterRightDeadFaceEnd = new THREE.Vector2(338, 370);
  const sourceRasterLeftAdjustment = new THREE.Vector2(224, 479);
  const sourceRasterRightAdjustment = new THREE.Vector2(297, 479);
  const sourceRasterDirectionArrow = new THREE.Vector2(279, 394);

  const sourceScale = 4.5
    / (sourceRasterDiskCenter.y - sourceRasterPendulumPivot.y);
  const palletPivot = new THREE.Vector2(0, 4.30);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    palletPivot.x + (x - sourceRasterPendulumPivot.x) * sourceScale,
    palletPivot.y + (sourceRasterPendulumPivot.y - y) * sourceScale,
  );
  const diskCenter = new THREE.Vector2(0, -0.20);
  const centerDistance = palletPivot.distanceTo(diskCenter);

  // The ninth-edition Encyclopaedia Britannica construction rule limits the
  // eccentricity to 1/60 of the distance between the disc and pallet axes in
  // order to hold the angle of escape to about one degree.
  const eccentricityRatio = 1 / 60;
  const pinOrbitRadius = centerDistance * eccentricityRatio;
  const pinRadius = 0.024;
  const pinLength = 0.42;
  const diskRadius = 0.39;
  const diskDepth = 0.22;
  const palletDepth = 0.25;
  const workingPlaneZ = 0.37;
  const contactMarkerZ = workingPlaneZ + 0.25;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const pendulumAmplitude = THREE.MathUtils.degToRad(3.6);
  const escapeAngle = Math.atan(pinOrbitRadius / centerDistance);
  const contactAngle = escapeAngle * 0.92;
  const releasePhase = Math.acos(escapeAngle / pendulumAmplitude) / Math.PI;
  const impulseStartHalfPhase = Math.acos(
    contactAngle / pendulumAmplitude,
  ) / Math.PI;
  const impulseEndHalfPhase = 1 - impulseStartHalfPhase;
  const landingPhase = 1 - releasePhase;
  const faceEquationScale = centerDistance / pinOrbitRadius;

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
  const canonicalImpulseWheelAngle = (side, palletAngle) => {
    const argument = THREE.MathUtils.clamp(
      faceEquationScale * Math.sin(palletAngle),
      -1,
      1,
    );
    return side === 'upper'
      ? palletAngle + Math.acos(argument)
      : palletAngle - Math.acos(argument);
  };
  const impulseAdvanceForAngle = (side, palletAngle) => (
    side === 'upper'
      ? Math.PI - canonicalImpulseWheelAngle(side, palletAngle)
      : -canonicalImpulseWheelAngle(side, palletAngle)
  );
  const impulseStartAdvance = {
    lower: impulseAdvanceForAngle('lower', contactAngle),
    upper: impulseAdvanceForAngle('upper', -contactAngle),
  };
  const impulseEndAdvance = {
    lower: impulseAdvanceForAngle('lower', -contactAngle),
    upper: impulseAdvanceForAngle('upper', contactAngle),
  };

  const phaseWindowProgress = (phase, start, end) => (
    (phase - start) / (end - start)
  );
  const rawStateAtTime = (time) => {
    const halfCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfCoordinate);
    const halfPhase = halfCoordinate - halfBeatIndex;
    const upperBeat = positiveModulo(halfBeatIndex, 2) === 0;
    const impulseSide = upperBeat ? 'upper' : 'lower';
    const startingRest = upperBeat ? 'upper-left' : 'lower-right';
    const endingRest = upperBeat ? 'lower-right' : 'upper-left';
    const pendulum = pendulumMotionAtHalfPhase(halfBeatIndex, halfPhase);
    const wheelAngleAtBeatStart = Math.PI - halfBeatIndex * Math.PI;
    let beatAdvance;
    let contactKind;
    let mode;

    if (halfPhase < releasePhase) {
      beatAdvance = 0;
      contactKind = 'dead-rest';
      mode = `${startingRest}-dead-rest`;
    } else if (halfPhase < impulseStartHalfPhase) {
      const progress = phaseWindowProgress(
        halfPhase,
        releasePhase,
        impulseStartHalfPhase,
      );
      beatAdvance = impulseStartAdvance[impulseSide]
        * smootherStep(progress);
      contactKind = 'free';
      mode = `${startingRest}-release-drop`;
    } else if (halfPhase <= impulseEndHalfPhase) {
      beatAdvance = impulseAdvanceForAngle(
        impulseSide,
        pendulum.angle,
      );
      contactKind = 'upright-impulse';
      mode = `${impulseSide}-upright-impulse`;
    } else if (halfPhase < landingPhase) {
      const progress = phaseWindowProgress(
        halfPhase,
        impulseEndHalfPhase,
        landingPhase,
      );
      beatAdvance = THREE.MathUtils.lerp(
        impulseEndAdvance[impulseSide],
        Math.PI,
        smootherStep(progress),
      );
      contactKind = 'free';
      mode = `${endingRest}-landing-drop`;
    } else {
      beatAdvance = Math.PI;
      contactKind = 'dead-rest';
      mode = `${endingRest}-dead-rest`;
    }

    const wheelAngle = wheelAngleAtBeatStart - beatAdvance;
    const pinCenter = diskCenter.clone().add(new THREE.Vector2(
      Math.cos(wheelAngle) * pinOrbitRadius,
      Math.sin(wheelAngle) * pinOrbitRadius,
    ));
    return {
      beatAdvance,
      contactKind,
      endingRest,
      halfBeatIndex,
      halfPhase,
      impulseSide,
      mode,
      pendulumAngle: pendulum.angle,
      pendulumAngularAcceleration: pendulum.angularAcceleration,
      pendulumAngularSpeed: pendulum.angularSpeed,
      pinCenter,
      startingRest,
      upperBeat,
      wheelAngle,
    };
  };

  const palletLocalPoint = (worldPoint, palletAngle) => rotate2(
    worldPoint.clone().sub(palletPivot),
    -palletAngle,
  );
  const palletWorldPoint = (localPoint, palletAngle) => palletPivot.clone()
    .add(rotate2(localPoint, palletAngle));
  const lockCenterRadius = Math.hypot(centerDistance, pinOrbitRadius);
  const upperDeadFaceRadius = lockCenterRadius - pinRadius;
  const lowerDeadFaceRadius = lockCenterRadius + pinRadius;

  const addContactState = (state) => {
    let activeFace = null;
    let contactError = null;
    let contactPoint = null;
    let contactPointLocal = null;
    const pinCenterLocal = palletLocalPoint(
      state.pinCenter,
      state.pendulumAngle,
    );

    if (state.contactKind === 'upright-impulse') {
      const faceX = state.impulseSide === 'upper'
        ? pinRadius
        : -pinRadius;
      contactPointLocal = new THREE.Vector2(faceX, pinCenterLocal.y);
      contactPoint = palletWorldPoint(
        contactPointLocal,
        state.pendulumAngle,
      );
      contactError = Math.abs(pinCenterLocal.x);
      activeFace = `${state.impulseSide}-upright-impulse-face`;
    } else if (state.contactKind === 'dead-rest') {
      const activeRest = state.halfPhase < releasePhase
        ? state.startingRest
        : state.endingRest;
      const upperRest = activeRest === 'upper-left';
      const faceRadius = upperRest
        ? upperDeadFaceRadius
        : lowerDeadFaceRadius;
      contactPointLocal = pinCenterLocal.clone()
        .setLength(faceRadius);
      contactPoint = palletWorldPoint(
        contactPointLocal,
        state.pendulumAngle,
      );
      contactError = Math.abs(
        contactPoint.distanceTo(state.pinCenter) - pinRadius,
      );
      activeFace = `${activeRest}-concentric-dead-face`;
    }
    return {
      ...state,
      activeFace,
      contactError,
      contactPoint,
      contactPointLocal,
      pinCenterLocal,
    };
  };

  const derivativeStep = 1e-5;
  const stateAtTime = (time) => {
    const state = addContactState(rawStateAtTime(time));
    const before = rawStateAtTime(time - derivativeStep).wheelAngle;
    const after = rawStateAtTime(time + derivativeStep).wheelAngle;
    const wheelAngularSpeed = (after - before) / (2 * derivativeStep);
    const wheelAngularAcceleration = (
      after - 2 * state.wheelAngle + before
    ) / derivativeStep ** 2;
    return {
      ...state,
      cycleIndex: Math.floor(time / pendulumPeriod),
      cyclePhase: positiveModulo(time, pendulumPeriod) / pendulumPeriod,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const pinCenterAtWheelAngle = (wheelAngle) => diskCenter.clone().add(
    new THREE.Vector2(
      Math.cos(wheelAngle) * pinOrbitRadius,
      Math.sin(wheelAngle) * pinOrbitRadius,
    ),
  );

  const plateMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.57,
  });
  const palletMaterial = matte(0x244e63, {
    metalness: 0.24,
    roughness: 0.50,
  });
  const diskMaterial = matte(PALETTE.driver, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.38,
    roughness: 0.42,
  });
  const faceMaterial = matte(PALETTE.accent, {
    metalness: 0.38,
    roughness: 0.38,
  });
  const rubyMaterial = matte(0xf7f4e8, {
    metalness: 0.05,
    roughness: 0.30,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.32,
    roughness: 0.52,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-two-arbor-clock-frame';
  root.add(fixedFrame);
  const rearUpright = beamBetween(
    new THREE.Vector3(-1.62, -1.27, -0.47),
    new THREE.Vector3(-1.62, 4.54, -0.47),
    0.16,
    0.18,
    frameMaterial,
  );
  rearUpright.userData.role = 'rear-clock-frame-upright';
  fixedFrame.add(rearUpright);
  for (const [point, role] of [
    [palletPivot, 'fixed-pendulum-pivot'],
    [diskCenter, 'fixed-single-pin-disc-arbor'],
  ]) {
    const support = beamBetween(
      new THREE.Vector3(-1.62, point.y, -0.47),
      new THREE.Vector3(point.x, point.y, -0.47),
      0.13,
      0.18,
      frameMaterial,
    );
    support.userData.role = `${role}-bracket`;
    fixedFrame.add(support);
    const bearing = cylinderAlongZ(0.16, 0.82, darkMaterial);
    bearing.position.set(point.x, point.y, -0.05);
    bearing.userData.role = role;
    fixedFrame.add(bearing);
  }

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role = 'pendulum-carried-z-slot-pallet-plate';
  root.add(palletAssembly);
  const localDiskCenterY = diskCenter.y - palletPivot.y;
  const plate = new THREE.Mesh(
    centeredExtrusion(
      outerPalletPlateShape(localDiskCenterY),
      palletDepth,
      0.014,
    ),
    plateMaterial,
  );
  plate.position.z = 0.02;
  plate.userData.role = 'macdowall-bottle-profile-pallet-plate';
  palletAssembly.add(plate);

  const pivotRing = new THREE.Mesh(
    centeredExtrusion(annularShape(0.33, 0.125), palletDepth + 0.08),
    plateMaterial,
  );
  pivotRing.position.z = 0.03;
  pivotRing.userData.role = 'pendulum-suspension-eye';
  palletAssembly.add(pivotRing);
  const neck = beamBetween(
    new THREE.Vector3(0, -0.33, 0.03),
    new THREE.Vector3(0, -0.68, 0.03),
    0.24,
    palletDepth,
    plateMaterial,
  );
  neck.userData.role = 'pendulum-plate-neck';
  palletAssembly.add(neck);

  const upperPalletShape = polygonShape([
    new THREE.Vector2(-0.90, localDiskCenterY + 0.015),
    new THREE.Vector2(-pinRadius, localDiskCenterY + 0.015),
    new THREE.Vector2(-pinRadius, localDiskCenterY + 0.47),
    new THREE.Vector2(-0.27, localDiskCenterY + 0.66),
    new THREE.Vector2(-0.63, localDiskCenterY + 0.58),
    new THREE.Vector2(-0.88, localDiskCenterY + 0.31),
  ]);
  const upperPallet = new THREE.Mesh(
    centeredExtrusion(upperPalletShape, palletDepth + 0.12),
    palletMaterial,
  );
  upperPallet.position.z = workingPlaneZ;
  upperPallet.userData.role = 'upper-left-L-pallet';
  palletAssembly.add(upperPallet);

  const lowerPalletShape = polygonShape([
    new THREE.Vector2(pinRadius, localDiskCenterY - 0.47),
    new THREE.Vector2(pinRadius, localDiskCenterY - 0.015),
    new THREE.Vector2(0.90, localDiskCenterY - 0.015),
    new THREE.Vector2(0.88, localDiskCenterY - 0.31),
    new THREE.Vector2(0.63, localDiskCenterY - 0.58),
    new THREE.Vector2(0.27, localDiskCenterY - 0.66),
  ]);
  const lowerPallet = new THREE.Mesh(
    centeredExtrusion(lowerPalletShape, palletDepth + 0.12),
    palletMaterial,
  );
  lowerPallet.position.z = workingPlaneZ;
  lowerPallet.userData.role = 'lower-right-L-pallet';
  palletAssembly.add(lowerPallet);

  const deadFacePoints = (rest) => {
    const upper = rest === 'upper-left';
    const centerVector = new THREE.Vector2(
      upper ? -pinOrbitRadius : pinOrbitRadius,
      -centerDistance,
    );
    const centerAngle = Math.atan2(centerVector.y, centerVector.x);
    const faceRadius = upper ? upperDeadFaceRadius : lowerDeadFaceRadius;
    return Array.from({ length: 33 }, (_, index) => {
      const offset = THREE.MathUtils.lerp(
        -pendulumAmplitude * 1.18,
        pendulumAmplitude * 1.18,
        index / 32,
      );
      const angle = centerAngle + offset;
      return new THREE.Vector2(
        Math.cos(angle) * faceRadius,
        Math.sin(angle) * faceRadius,
      );
    });
  };
  const upperDeadPoints = deadFacePoints('upper-left');
  const lowerDeadPoints = deadFacePoints('lower-right');
  const upperDeadEdge = edgeTube(
    upperDeadPoints,
    workingPlaneZ + palletDepth * 0.22,
    0.025,
    faceMaterial,
    'upper-left-concentric-horizontal-dead-face',
  );
  const lowerDeadEdge = edgeTube(
    lowerDeadPoints,
    workingPlaneZ + palletDepth * 0.22,
    0.025,
    faceMaterial,
    'lower-right-concentric-horizontal-dead-face',
  );
  palletAssembly.add(upperDeadEdge, lowerDeadEdge);

  const impulseFaceHeight = pinOrbitRadius * 1.36;
  const upperImpulsePoints = [
    new THREE.Vector2(-pinRadius, localDiskCenterY - 0.02),
    new THREE.Vector2(-pinRadius, localDiskCenterY + impulseFaceHeight),
  ];
  const lowerImpulsePoints = [
    new THREE.Vector2(pinRadius, localDiskCenterY - impulseFaceHeight),
    new THREE.Vector2(pinRadius, localDiskCenterY + 0.02),
  ];
  const upperImpulseEdge = edgeTube(
    upperImpulsePoints,
    workingPlaneZ + palletDepth * 0.22,
    0.027,
    faceMaterial,
    'upper-upright-impulse-face',
  );
  const lowerImpulseEdge = edgeTube(
    lowerImpulsePoints,
    workingPlaneZ + palletDepth * 0.22,
    0.027,
    faceMaterial,
    'lower-upright-impulse-face',
  );
  palletAssembly.add(upperImpulseEdge, lowerImpulseEdge);

  const adjustmentScrews = [-0.59, 0.59].map((x, index) => {
    const screw = new THREE.Group();
    screw.position.set(x, -5.57, 0.13);
    screw.userData.index = index;
    screw.userData.role = 'pallet-plate-adjustment-screw';
    const collar = cylinderAlongZ(0.25, 0.34, faceMaterial);
    const head = cylinderAlongZ(0.13, 0.48, darkMaterial);
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.034, 0.025),
      rubyMaterial,
    );
    slot.position.z = 0.26;
    screw.add(collar, head, slot);
    palletAssembly.add(screw);
    return screw;
  });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(diskCenter.x, diskCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role = 'single-pin-escape-disc';
  root.add(escapeWheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-half-turn-per-beat-rotor';
  escapeWheel.add(wheelRotor);
  const disk = cylinderAlongZ(diskRadius, diskDepth, diskMaterial, 48);
  disk.position.z = 0.04;
  disk.userData.role = 'very-small-solid-escape-disc';
  wheelRotor.add(disk);
  const diskRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius * 0.94, 0.025, 8, 48),
    darkMaterial,
  );
  diskRim.position.z = diskDepth / 2 + 0.17;
  diskRim.userData.role = 'single-pin-disc-visible-rim';
  wheelRotor.add(diskRim);
  const diskHub = cylinderAlongZ(0.115, 0.74, darkMaterial);
  diskHub.position.z = 0.11;
  diskHub.userData.role = 'single-pin-disc-arbor';
  wheelRotor.add(diskHub);
  const diskIndex = beamBetween(
    new THREE.Vector3(0, 0, diskDepth / 2 + 0.18),
    new THREE.Vector3(diskRadius * 0.78, 0, diskDepth / 2 + 0.18),
    0.075,
    0.025,
    rubyMaterial,
  );
  diskIndex.userData.role = 'disc-half-turn-index';
  wheelRotor.add(diskIndex);
  const rubyPin = cylinderAlongZ(pinRadius, pinLength, rubyMaterial, 32);
  rubyPin.position.set(pinOrbitRadius, 0, workingPlaneZ);
  rubyPin.userData.eccentricity = pinOrbitRadius;
  rubyPin.userData.index = 0;
  rubyPin.userData.material = 'ruby';
  rubyPin.userData.role = 'single-eccentric-ruby-pin';
  wheelRotor.add(rubyPin);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.088, 18, 12),
    rubyMaterial,
  );
  contactMarker.position.z = contactMarkerZ;
  contactMarker.userData.role = 'active-pin-pallet-contact';
  root.add(contactMarker);

  const pendulumIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.29, 0.035),
    rubyMaterial,
  );
  pendulumIndex.position.set(0, -1.08, palletDepth / 2 + 0.055);
  pendulumIndex.userData.role = 'pendulum-angle-index';
  palletAssembly.add(pendulumIndex);

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.pendulumAngle;
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
    contactMarker.userData.contactKind = state.contactKind;
    contactMarker.userData.contactError = state.contactError;
    contactMarker.userData.mode = state.mode;
    root.userData.currentState = state;
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    adjustmentScrews,
    contactMarker,
    disk,
    diskHub,
    diskIndex,
    diskRim,
    escapeWheel,
    fixedFrame,
    lowerDeadEdge,
    lowerImpulseEdge,
    lowerPallet,
    palletAssembly,
    pendulumIndex,
    plate,
    pivotRing,
    rubyPin,
    upperDeadEdge,
    upperImpulseEdge,
    upperPallet,
    wheelRotor,
  };
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.05, -2.05, -0.95),
    new THREE.Vector3(2.05, 4.80, 1.05),
  );
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    centerDistance,
    contactAngle,
    contactMarkerZ,
    diskCenter: diskCenter.clone(),
    diskDepth,
    diskRadius,
    eccentricityRatio,
    escapeAngle,
    faceEquationScale,
    halfBeatDuration,
    impulseEndHalfPhase,
    impulseStartHalfPhase,
    landingPhase,
    lockCenterRadius,
    lowerDeadFaceRadius,
    palletDepth,
    palletPivot: palletPivot.clone(),
    pendulumAmplitude,
    pendulumPeriod,
    pinCount: 1,
    pinLength,
    pinOrbitRadius,
    pinRadius,
    releasePhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    upperDeadFaceRadius,
    workingPlaneZ,
  };
  root.userData.impulseAdvanceForAngle = impulseAdvanceForAngle;
  root.userData.impulseFaceCenterlineError = (side, palletAngle) => {
    const canonicalWheelAngle = canonicalImpulseWheelAngle(
      side,
      palletAngle,
    );
    const center = pinCenterAtWheelAngle(canonicalWheelAngle);
    return palletLocalPoint(center, palletAngle).x;
  };
  root.userData.mechanism = 'Macdowall single-pin dead escapement: one ruby pin near a very small disc arbor alternates between the upper-left and lower-right horizontal concentric dead rests; after each release it impulses the adjoining upright face and the disc completes exactly one clockwise half-turn per pendulum beat.';
  root.userData.palletFaces = {
    lower: {
      deadFacePoints: lowerDeadPoints,
      deadFaceRadius: lowerDeadFaceRadius,
      impulseCenterlineX: 0,
      impulseFaceX: -pinRadius,
      position: 'lower-right',
    },
    upper: {
      deadFacePoints: upperDeadPoints,
      deadFaceRadius: upperDeadFaceRadius,
      impulseCenterlineX: 0,
      impulseFaceX: pinRadius,
      position: 'upper-left',
    },
  };
  root.userData.palletLocalPoint = palletLocalPoint;
  root.userData.palletWorldPoint = palletWorldPoint;
  root.userData.pinCenterAtWheelAngle = pinCenterAtWheelAngle;
  root.userData.presentation = 'front elevation with the pendulum plate opened around the single working pin';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 305 page marks Animated unavailable and supplies only Brown’s static plate and description.',
    referenceScope: 'Brown fixes the bottle-profile pendulum plate, opposed L-shaped pallet opening, tiny single-pin disc, clockwise arrow, and two lower adjustments. The period Macdowall description fixes the single ruby pin, one-half-turn-per-beat rate, upright impulse faces, horizontal dead faces, and 1:60 eccentricity limit.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    periodConstructionReference: {
      constructionRule: 'For an angle of escape no greater than one degree, the ruby-pin eccentricity is no more than one-sixtieth of the distance between the disc and pallet centres.',
      description: 'A small disc with one ruby pin turns half a revolution at every beat; the pin impulses the vertical faces and rests on the horizontal faces.',
      figure: 7,
      inventor: 'C. Macdowall',
      patentYear: 1851,
      publication: 'Encyclopaedia Britannica, Ninth Edition, volume 6, Clocks',
      publicationYear: 1878,
      url: 'https://en.wikisource.org/wiki/Page:Encyclop%C3%A6dia_Britannica,_Ninth_Edition,_v._6.djvu/29',
    },
    plate305: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one eccentric ruby pin on a tiny disc works through a Z-like opening formed by an upper-left and a lower-right L pallet in the pendulum plate',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterDiskCenter: sourceRasterDiskCenter.clone(),
      rasterLeftAdjustment: sourceRasterLeftAdjustment.clone(),
      rasterLeftDeadFaceEnd: sourceRasterLeftDeadFaceEnd.clone(),
      rasterLowerPalletCorner: sourceRasterLowerPalletCorner.clone(),
      rasterPendulumPivot: sourceRasterPendulumPivot.clone(),
      rasterRightAdjustment: sourceRasterRightAdjustment.clone(),
      rasterRightDeadFaceEnd: sourceRasterRightDeadFaceEnd.clone(),
      rasterRubyPin: sourceRasterRubyPin.clone(),
      rasterUpperPalletCorner: sourceRasterUpperPalletCorner.clone(),
      sourceDirection: 'clockwise, from the curved arrow beside the disc',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    survivingModelReference: {
      collection: 'Franklin Institute escapement collection',
      credit: 'C. Macdowall, London — 1850',
      description: 'The surviving demonstrator confirms one central disc and the opposed upper-left/lower-right pallet openings carried by the pendulum assembly.',
      url: 'https://commons.wikimedia.org/wiki/File:1850_MacDowall_single_pin_escapement_-_Franklin_Institute_-_DSC06671.jpg',
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'upper-left-concentric-dead-rest',
      'short-clockwise-release-drop',
      'upper-upright-face-impulse',
      'short-clockwise-landing-drop-to-lower-right-rest',
      'lower-right-concentric-dead-rest',
      'short-clockwise-release-drop',
      'lower-upright-face-impulse',
      'short-clockwise-landing-drop-to-upper-left-rest',
    ],
  };
  root.userData.transmission = {
    deadFaces: 'two circular rests concentric with the pendulum pivot, seen nearly horizontal at the disc',
    direction: 'clockwise in Brown’s front elevation',
    discAdvancePerBeatRadians: Math.PI,
    discTurnsPerPendulumCycle: 1,
    impulseFaces: 'the two upright faces flanking the Z-like pallet opening',
    pinCount: 1,
    recoil: 'none while either dead face is engaged',
  };

  correctSinglePinParts(root);
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
  for (const object of [contactMarker, diskIndex, pendulumIndex]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(1.1, 1.0, 13.8),
    root,
    update,
  };
}

export function createAuthoredSinglePinEscapementMovement(movement) {
  if (movement.id !== 305) return null;
  return finishPinEscapement(macdowallSinglePinEscapement(movement));
}
