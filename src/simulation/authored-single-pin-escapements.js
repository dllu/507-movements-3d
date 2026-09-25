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

// Brown's bottle-shaped pendulum plate as one part, in the pendulum frame
// (pivot at the origin, raster scale `scale`): the eye round the pivot, the
// straight rod, the bottle's belly and flat foot, the two adjustment holes,
// and the escapement opening cut directly to Brown's shape. The opening is
// his two D-shaped windows, upper-left and lower-right, joined at the disc
// arbor. Their working edges are the pallets: the upper-right solid's lower
// edge and the lower-left solid's upper edge are dead faces concentric with
// the pivot; the two upright edges beside the arbor are the impulse faces.
function macdowallPlateShape({
  adjustmentCenters,
  adjustmentRadius,
  lowerDeadFaceRadius,
  pinRadius,
  pivotBoreRadius,
  scale,
  upperDeadFaceRadius,
}) {
  // Brown's outline half-widths (raster pixels, to the ink centre) against
  // raster y below the pivot at y 35.
  const profile = [
    [55, 12.5], [160, 12.5], [180, 14.5], [210, 19.5], [240, 25.5],
    [270, 38], [300, 54.5], [330, 75], [360, 91], [390, 97], [402, 97.5],
    [420, 94], [450, 82.5], [480, 65.5], [492, 61.5], [505, 61],
  ].map(([y, half]) => new THREE.Vector2(half * scale, -(y - 35) * scale));
  const eyeRadius = 24 * scale;
  const side = new THREE.SplineCurve(profile.slice(2)).getPoints(96);
  const stemHalf = profile[0].x;
  const eyeJoin = -Math.sqrt(eyeRadius ** 2 - stemHalf ** 2);
  // Counterclockwise outline (the holes run clockwise): down the left side,
  // across the foot, up the right side and over the eye.
  const shape = new THREE.Shape();
  shape.moveTo(-stemHalf, eyeJoin);
  shape.lineTo(-stemHalf, profile[1].y);
  side.forEach((point) => shape.lineTo(-point.x, point.y));
  [...side].reverse().forEach((point) => shape.lineTo(point.x, point.y));
  shape.lineTo(stemHalf, profile[1].y);
  shape.lineTo(stemHalf, eyeJoin);
  shape.absarc(0, 0, eyeRadius, Math.atan2(eyeJoin, stemHalf),
    Math.atan2(eyeJoin, -stemHalf) + FULL_TURN, false);
  shape.closePath();

  const pivotBore = new THREE.Path();
  pivotBore.absarc(0, 0, pivotBoreRadius, 0, FULL_TURN, true);
  shape.holes.push(pivotBore);
  for (const [x, y] of adjustmentCenters) {
    const hole = new THREE.Path();
    hole.absarc(x, y, adjustmentRadius, 0, FULL_TURN, true);
    shape.holes.push(hole);
  }

  // The escapement opening. D-window sizes from Brown: 80 by 50 pixels, the
  // outer corners rounded as quarter ellipses.
  const reach = 74.5 * scale;
  const flat = 33 * scale;
  const height = 50 * scale;
  // The dead faces are arcs about the pivot where the pin works (|x| up to
  // `working`); beyond it their slope eases to level, so the windows keep
  // Brown's straight horizontal edges.
  const working = 0.4;
  const ease = 0.25;
  const deadFace = (radius) => (x) => {
    const u = Math.abs(x);
    if (u <= working) return -Math.sqrt(radius ** 2 - u ** 2);
    const base = -Math.sqrt(radius ** 2 - working ** 2);
    const slope = working / Math.sqrt(radius ** 2 - working ** 2);
    const run = Math.min(u - working, ease);
    return base + slope * (run - run * run / (2 * ease));
  };
  const ceiling = deadFace(upperDeadFaceRadius);
  const floor = deadFace(lowerDeadFaceRadius);
  const points = [];
  const steps = 48;
  for (let index = 0; index <= steps; index += 1) {
    const x = pinRadius + (reach - pinRadius) * index / steps;
    points.push([x, ceiling(x)]);
  }
  const rightTop = ceiling(reach);
  for (let index = 1; index <= 24; index += 1) {
    const t = Math.PI / 2 * index / 24;
    points.push([flat + (reach - flat) * Math.cos(t), rightTop - height * Math.sin(t)]);
  }
  points.push([-pinRadius, rightTop - height]);
  for (let index = 0; index <= steps; index += 1) {
    const x = -pinRadius - (reach - pinRadius) * index / steps;
    points.push([x, floor(x)]);
  }
  const leftBottom = floor(-reach);
  for (let index = 1; index <= 24; index += 1) {
    const t = Math.PI / 2 * index / 24;
    points.push([-flat - (reach - flat) * Math.cos(t), leftBottom + height * Math.sin(t)]);
  }
  points.push([pinRadius, leftBottom + height]);
  const opening = new THREE.Path(points.map(([x, y]) => new THREE.Vector2(x, y)));
  opening.closePath();
  shape.holes.push(opening);
  return { opening: points, shape };
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
  // Depth, back to front: the disc behind the pendulum plate, its pin
  // standing forward through the plate's opening, whose edges are the
  // pallets. Brown's disc (about 36 pixels) is seen through the windows.
  const diskRadius = 0.44;
  const diskDepth = 0.22;
  const palletDepth = 0.25;
  const plateZ = 0.02;
  const plateBack = plateZ - palletDepth / 2;
  const diskZ = plateBack - 0.01 - diskDepth / 2;
  const diskFront = diskZ + diskDepth / 2;
  const pinFront = plateZ + palletDepth / 2 + 0.02;
  // The pin is set into the arbor's end, which lies flush with the disc face.
  const pinSeat = 0.03;
  const pinLength = pinFront - diskFront + pinSeat;
  const workingPlaneZ = (pinFront + diskFront - pinSeat) / 2;
  const contactMarkerZ = pinFront + 0.1;

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
  const rubyMaterial = matte(0x9b2335, {
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
  // Brown's two lower adjustment holes, each holding an eccentric bush with
  // its screw set off centre (raster centres 227 and 295 at y 476).
  const adjustmentCenters = [227, 295].map((x) => [
    (x - sourceRasterPendulumPivot.x) * sourceScale,
    -(476 - sourceRasterPendulumPivot.y) * sourceScale,
  ]);
  const adjustmentRadius = 22 * sourceScale;
  const pivotBoreRadius = 0.076;
  const { opening: escapementOpening, shape: plateShape } = macdowallPlateShape({
    adjustmentCenters,
    adjustmentRadius,
    lowerDeadFaceRadius: lockCenterRadius + pinRadius,
    pinRadius,
    pivotBoreRadius,
    scale: sourceScale,
    upperDeadFaceRadius: lockCenterRadius - pinRadius,
  });
  const plateGeometry = new THREE.ExtrudeGeometry(plateShape, {
    bevelEnabled: false,
    curveSegments: 48,
    depth: palletDepth,
  });
  plateGeometry.translate(0, 0, -palletDepth / 2);
  const plate = new THREE.Mesh(plateGeometry, plateMaterial);
  plate.position.z = plateZ;
  plate.userData.role = 'macdowall-bottle-profile-pallet-plate';
  plate.userData.escapementOpening = escapementOpening;
  palletAssembly.add(plate);

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

  // Each adjustment hole carries an eccentric bush flush with the plate,
  // turned by its off-centre screw (Brown's small hatched circles).
  const bushMaterial = matte(0x3d6e86, { metalness: 0.22, roughness: 0.5 });
  const adjustmentScrews = adjustmentCenters.map(([x, y], index) => {
    const screw = new THREE.Group();
    screw.position.set(x, y, plateZ);
    screw.userData.index = index;
    screw.userData.role = 'pallet-plate-adjustment-screw';
    const bush = cylinderAlongZ(adjustmentRadius - 0.006, palletDepth, bushMaterial, 48);
    bush.userData.role = 'eccentric-adjusting-bush';
    const offset = (index === 0 ? -9 : 14) * sourceScale;
    const head = cylinderAlongZ(7.5 * sourceScale, 0.04, darkMaterial, 32);
    head.position.set(offset, 0, palletDepth / 2 + 0.02);
    head.userData.role = 'eccentric-bush-screw-head';
    screw.add(bush, head);
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
  const disk = cylinderAlongZ(diskRadius, diskDepth, diskMaterial, 64);
  disk.position.z = diskZ;
  disk.userData.role = 'very-small-solid-escape-disc';
  wheelRotor.add(disk);
  // The arbor ends at the disc's face, behind the pin and the plate.
  const diskHub = cylinderAlongZ(0.115, 0.6, darkMaterial);
  diskHub.position.z = diskFront - 0.3;
  diskHub.userData.role = 'single-pin-disc-arbor';
  wheelRotor.add(diskHub);
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
    escapeWheel,
    fixedFrame,
    lowerDeadEdge,
    lowerImpulseEdge,
    palletAssembly,
    plate,
    rubyPin,
    upperDeadEdge,
    upperImpulseEdge,
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
    diskFront,
    diskRadius,
    diskZ,
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
    plateZ,
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
  for (const object of [contactMarker]) {
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
