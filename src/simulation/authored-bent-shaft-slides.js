import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongX(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderBetween(start, end, radius, material, segments = 20) {
  const delta = end.clone().sub(start);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, delta.length(), segments),
    material,
  );
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(Y_AXIS, delta.clone().normalize());
  return cylinder;
}

// Brown's rod B stands square to head A, which turns on the inclined bent
// end of shaft A. Half a turn tips the bent end from down-left to up-left, so
// B leans the other way (his dotted overlay). With B square to the bent end,
// B's lower end can stay on C's single guide only if B slides through the
// swivel socket in C, so the engaged length of B varies slightly.
function sphericalZone(radius, inner, fromPolar, toPolar, segments = 64) {
  const points = [];
  for (let i = 0; i <= 24; i += 1) {
    const a = fromPolar + (toPolar - fromPolar) * i / 24;
    points.push(new THREE.Vector2(radius * Math.sin(a), radius * Math.cos(a)));
  }
  for (let i = 24; i >= 0; i -= 1) {
    const a = fromPolar + (toPolar - fromPolar) * i / 24;
    points.push(new THREE.Vector2(inner * Math.sin(a), inner * Math.cos(a)));
  }
  points.push(points[0].clone());
  return new THREE.LatheGeometry(points.reverse(), segments);
}

function boredBall(radius, bore, segments = 64) {
  const points = [];
  const start = Math.asin(bore / radius);
  for (let i = 0; i <= 32; i += 1) {
    const a = start + (Math.PI - 2 * start) * i / 32;
    points.push(new THREE.Vector2(radius * Math.sin(a), radius * Math.cos(a)));
  }
  points.push(new THREE.Vector2(bore, points[0].y));
  return new THREE.LatheGeometry(points.reverse(), segments);
}

function bentShaftSlide(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const shaftAngularSpeed = FULL_TURN / cycleDuration;
  const shaftAxisY = 1.25;
  const shaftAxisZ = 0;
  const bendX = 1.40;
  const bentEndInclination = THREE.MathUtils.degToRad(14);
  const sinA = Math.sin(bentEndInclination);
  const cosA = Math.cos(bentEndInclination);
  const rodRootOnBentEnd = 0.20;
  const headStart = 0.08;
  const headEnd = 1.10;
  const bentEndLength = 1.22;
  const slideAxisY = -1.25;
  const slideAxisZ = 0;
  const sourceShaftAngle = 0;
  const transverseCenterDistance = shaftAxisY - slideAxisY;
  const harmonicAmplitude = transverseCenterDistance * sinA / cosA;
  const slideMaximumX = bendX + (transverseCenterDistance * sinA - rodRootOnBentEnd) / cosA;
  const slideMinimumX = bendX + (-transverseCenterDistance * sinA - rodRootOnBentEnd) / cosA;
  const slideStroke = slideMaximumX - slideMinimumX;
  const engagedLength = (x) => Math.sqrt((x - bendX) ** 2
    + transverseCenterDistance ** 2 - rodRootOnBentEnd ** 2);
  const rodEngagedLengthMinimum = engagedLength(bendX);
  const rodEngagedLengthMaximum = engagedLength(slideMinimumX);
  const rodTipBeyondSocket = 0.03;
  const rodTipLength = rodEngagedLengthMaximum + rodTipBeyondSocket;
  const bendPoint = new THREE.Vector3(bendX, shaftAxisY, shaftAxisZ);

  const bentEndDirection = (angle) => new THREE.Vector3(
    -cosA, -sinA * Math.cos(angle), -sinA * Math.sin(angle));

  const stateAtShaftAngle = (
    shaftAngle,
    shaftSpeed = shaftAngularSpeed,
    shaftAcceleration = 0,
  ) => {
    const cosine = Math.cos(shaftAngle);
    const sine = Math.sin(shaftAngle);
    const bentEnd = bentEndDirection(shaftAngle);
    const bentEndRate = new THREE.Vector3(0, sinA * sine, -sinA * cosine);
    const bentEndSecond = new THREE.Vector3(0, sinA * cosine, sinA * sine);
    const upperSocket = bendPoint.clone().addScaledVector(bentEnd, rodRootOnBentEnd);
    const upperSocketVelocity = bentEndRate.clone()
      .multiplyScalar(rodRootOnBentEnd * shaftSpeed);
    const upperSocketAcceleration = bentEndSecond.clone()
      .multiplyScalar(rodRootOnBentEnd * shaftSpeed ** 2)
      .addScaledVector(bentEndRate, rodRootOnBentEnd * shaftAcceleration);
    // B square to the bent end: (C - bend).u = rodRoot, C on its guide.
    const slideX = bendX + (transverseCenterDistance * sinA * cosine
      - rodRootOnBentEnd) / cosA;
    const slideSpeed = -harmonicAmplitude * sine * shaftSpeed;
    const slideAcceleration = -harmonicAmplitude
      * (cosine * shaftSpeed ** 2 + sine * shaftAcceleration);
    const lowerSocket = new THREE.Vector3(slideX, slideAxisY, slideAxisZ);
    const lowerSocketVelocity = new THREE.Vector3(slideSpeed, 0, 0);
    const lowerSocketAcceleration = new THREE.Vector3(slideAcceleration, 0, 0);
    const rodVector = lowerSocket.clone().sub(upperSocket);
    const rodEngagedLength = rodVector.length();
    const relativeSocketVelocity = lowerSocketVelocity.clone()
      .sub(upperSocketVelocity);
    const bentEndVelocity = bentEndRate.clone().multiplyScalar(shaftSpeed);
    return {
      bentEnd,
      halfTurnPose: Math.cos(shaftAngle - sourceShaftAngle) >= 0
        ? 'near-bold-source-half'
        : 'near-dotted-opposite-half',
      lowerSocket,
      lowerSocketAcceleration,
      lowerSocketVelocity,
      relativeSocketVelocity,
      rodEngagedLength,
      rodLeanFromVertical: Math.atan2(rodVector.x, -rodVector.y),
      rodSquarenessResidual: rodVector.dot(bentEnd),
      rodSquarenessRateResidual: relativeSocketVelocity.dot(bentEnd)
        + rodVector.dot(bentEndVelocity),
      rodTipBeyondSocket: rodTipLength - rodEngagedLength,
      rodVector,
      shaftAcceleration,
      shaftAngle,
      shaftSpeed,
      slideAcceleration,
      slideDirection: slideSpeed > 1e-10
        ? 'positive-x'
        : slideSpeed < -1e-10
          ? 'negative-x'
          : 'reversal',
      slideDisplacement: slideX - slideMinimumX,
      slideSpeed,
      slideX,
      upperSocket,
      upperSocketAcceleration,
      upperSocketVelocity,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtShaftAngle(
        sourceShaftAngle + shaftAngularSpeed * cycleTime,
      ),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    bendX,
    bentEndInclination,
    bentEndLength,
    cycleDuration,
    headEnd,
    headStart,
    harmonicAmplitude,
    rodEngagedLengthMaximum,
    rodEngagedLengthMinimum,
    rodRootOnBentEnd,
    rodTipBeyondSocket,
    rodTipLength,
    shaftAngularSpeed,
    shaftAxisY,
    shaftAxisZ,
    slideAxisY,
    slideAxisZ,
    slideMaximumX,
    slideMinimumX,
    slideStroke,
    sourceShaftAngle,
    transverseCenterDistance,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.27,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.21,
    roughness: 0.48,
  });
  const socketMaterial = matte(PALETTE.accent, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.39 });

  // Brown's side elevation: a plank bed, the T standard D carrying the long
  // bearing sleeve at the crank end, and slide C as a sectioned bar lying on
  // the plank with B's socket between its two blocks. No rails are drawn.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-bearing-D-and-slide-C-guide-frame';
  const plankTopY = slideAxisY - .30;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.10, 0.30, 1.10),
    frameMaterial,
  );
  base.position.set(0.95, plankTopY - .15, 0);
  base.userData.role = 'fixed-plank-bed-and-guide-for-slide-C';
  fixedFrame.add(base);
  const bearingX = 3.20;
  const bearingHalfLength = .75;
  const bearingOuterRadius = .30;
  const standardShape = new THREE.Shape();
  const standardTop = shaftAxisY - bearingOuterRadius + .02;
  standardShape.moveTo(bearingX - .42, plankTopY);
  standardShape.lineTo(bearingX + .42, plankTopY);
  standardShape.lineTo(bearingX + .42, plankTopY + .14);
  standardShape.lineTo(bearingX + .22, plankTopY + .20);
  standardShape.lineTo(bearingX + .22, standardTop - .75);
  standardShape.quadraticCurveTo(bearingX + .22, standardTop - .10, bearingX + .70, standardTop);
  standardShape.lineTo(bearingX - .70, standardTop);
  standardShape.quadraticCurveTo(bearingX - .22, standardTop - .10, bearingX - .22, standardTop - .75);
  standardShape.lineTo(bearingX - .22, plankTopY + .20);
  standardShape.lineTo(bearingX - .42, plankTopY + .14);
  standardShape.closePath();
  const standardGeometry = new THREE.ExtrudeGeometry(standardShape, {depth: .50, bevelEnabled: false, curveSegments: 16});
  standardGeometry.translate(0, 0, -.25);
  const bearingPost = new THREE.Mesh(standardGeometry, frameMaterial);
  bearingPost.userData.role = 'fixed-T-standard-D-under-bearing';
  fixedFrame.add(bearingPost);
  const bearingD = new THREE.Mesh(boredCylinderGeometry(bearingOuterRadius,.153,2*bearingHalfLength),frameMaterial);
  bearingD.rotation.z=Math.PI/2;
  bearingD.position.set(bearingX, shaftAxisY, shaftAxisZ);
  bearingD.userData.role = 'fixed-bearing-D-around-shaft-A';
  fixedFrame.add(bearingD);
  const bearingBore = new THREE.Mesh(boredCylinderGeometry(.15,.134,2*bearingHalfLength+.04),darkMaterial);
  bearingBore.rotation.z=Math.PI/2;
  bearingBore.position.copy(bearingD.position);
  bearingBore.userData.role = 'dark-bearing-D-bore-and-bushing';
  fixedFrame.add(bearingBore);
  root.add(fixedFrame);

  const shaftRotor = new THREE.Group();
  shaftRotor.position.set(0, shaftAxisY, shaftAxisZ);
  shaftRotor.userData.role = 'continuous-horizontal-shaft-A-rotor';
  const shaftLeft = bendX;
  const shaftRight = bearingX + bearingHalfLength + .38;
  const mainShaft = cylinderAlongX(0.13, shaftRight - shaftLeft, driverMaterial, 38);
  mainShaft.position.x = (shaftLeft + shaftRight) / 2;
  mainShaft.userData.role = 'straight-bearing-portion-of-shaft-A';
  shaftRotor.add(mainShaft);
  // Brown's crank handle on the outer end of A (in place of an input wheel).
  const crankArmLength = .78;
  const crankX = shaftRight - .06;
  const inputWheel = new THREE.Mesh(new THREE.BoxGeometry(.12, crankArmLength + .22, .20), driverMaterial);
  inputWheel.position.set(crankX + .12, crankArmLength / 2, 0);
  inputWheel.userData.role = 'input-crank-arm-fast-on-shaft-A';
  shaftRotor.add(inputWheel);
  const crankHandle = cylinderAlongX(.055, .42, darkMaterial, 20);
  crankHandle.position.set(crankX + .39, crankArmLength, 0);
  crankHandle.userData.role = 'input-crank-handle-on-arm';
  shaftRotor.add(crankHandle);
  const crankKnob = new THREE.Mesh(new THREE.SphereGeometry(.10, 20, 14), darkMaterial);
  crankKnob.scale.set(1.5, 1, 1);
  crankKnob.position.set(crankX + .62, crankArmLength, 0);
  crankKnob.userData.role = 'input-crank-handle-knob';
  shaftRotor.add(crankKnob);
  // The bend: a knuckle at the end of the straight shaft, a collar just
  // inboard of it (Brown's collar at A), and the inclined bent end.
  const bentWeb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 20), driverMaterial);
  bentWeb.position.set(bendX, 0, 0);
  bentWeb.userData.role = 'knuckle-at-bend-of-shaft-A';
  shaftRotor.add(bentWeb);
  const shaftCollar = cylinderAlongX(0.21, 0.20, driverMaterial, 40);
  shaftCollar.position.x = bendX + 0.18;
  shaftCollar.userData.role = 'collar-at-bend-of-shaft-A';
  shaftRotor.add(shaftCollar);
  const bentEndLocal = new THREE.Vector3(-cosA, -sinA, 0);
  const bentJournal = cylinderBetween(
    new THREE.Vector3(bendX, 0, 0),
    new THREE.Vector3(bendX, 0, 0).addScaledVector(bentEndLocal, bentEndLength),
    0.12, darkMaterial, 32);
  bentJournal.userData.role = 'inclined-bent-end-of-shaft-A';
  shaftRotor.add(bentJournal);
  const bentEndWasher = cylinderBetween(
    new THREE.Vector3(bendX, 0, 0).addScaledVector(bentEndLocal, headEnd + 0.02),
    new THREE.Vector3(bendX, 0, 0).addScaledVector(bentEndLocal, headEnd + 0.10),
    0.22, driverMaterial, 40);
  bentEndWasher.userData.role = 'washer-retaining-head-A-on-bent-end';
  shaftRotor.add(bentEndWasher);
  root.add(shaftRotor);

  // Slide C: Brown's sectioned bar, two blocks either side of B's socket,
  // joined behind the seat (the gap in front is open, where B's end dips);
  // it lies on the plank bed.
  const slideC = new THREE.Group();
  slideC.position.set(slideMaximumX, slideAxisY, slideAxisZ);
  slideC.userData.role = 'rectilinearly-reciprocating-slide-C';
  const slideTop = .20;
  const slideBottom = -.30;
  const slideBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, slideTop - slideBottom, 0.70),
    drivenMaterial,
  );
  slideBody.position.set(-.45 - 1.55 / 2, (slideTop + slideBottom) / 2, 0);
  slideBody.userData.role = 'rigid-body-of-slide-C';
  const slideFront = new THREE.Mesh(
    new THREE.BoxGeometry(.62, slideTop - slideBottom, 0.70),
    drivenMaterial,
  );
  slideFront.position.set(.23 + .31, (slideTop + slideBottom) / 2, 0);
  slideFront.userData.role = 'rigid-body-of-slide-C';
  const slideBridge = new THREE.Mesh(
    new THREE.BoxGeometry(.68, slideTop - slideBottom, 0.16),
    drivenMaterial,
  );
  slideBridge.position.set((-.45 + .23) / 2, (slideTop + slideBottom) / 2, -.27);
  slideBridge.userData.role = 'rigid-body-of-slide-C';
  slideC.add(slideBody, slideFront, slideBridge);
  // The swivel ball turns with B, which slides through its bore.
  // Brass (the role name is historical): a white ball would read as a hole.
  const lowerBall = new THREE.Mesh(boredBall(0.17, 0.105), matte(PALETTE.brass, { metalness: 0.2, roughness: 0.42 }));
  lowerBall.userData.role = 'white-lower-swivel-ball-B-slides-through';
  slideC.add(lowerBall);
  // Seat: a spherical band round the ball's equator, carried by the web.
  const lowerSocketCup = new THREE.Mesh(sphericalZone(0.215, 0.176, Math.PI / 3, Math.PI * 2 / 3), socketMaterial);
  lowerSocketCup.userData.role = 'lower-universal-socket-in-slide-C';
  slideC.add(lowerSocketCup);
  const socketWeb = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.14, 0.06), socketMaterial);
  socketWeb.position.set(0, 0, -0.23);
  socketWeb.userData.role = 'web-carrying-socket-from-back-of-slide-C';
  slideC.add(socketWeb);
  root.add(slideC);

  // Rod B: its root is square to head A on the bent end; only the exposed
  // shank is drawn from the head's underside to its rounded tip.
  const rodBody = new THREE.Group();
  rodBody.userData.role = 'rod-B-rigid-with-head-A';
  root.add(rodBody);
  const rodRadius = 0.10;
  const shankStart = 0.30;
  const rodGeometry = new THREE.CylinderGeometry(rodRadius, rodRadius, rodTipLength - shankStart, 32);
  rodGeometry.translate(0, (rodTipLength + shankStart) / 2, 0);
  const rodB = new THREE.Mesh(rodGeometry, drivenMaterial);
  rodB.userData.role = 'square-rod-B-sliding-through-socket-in-C';
  rodBody.add(rodB);
  // Head A: Brown's thick sleeve turning on the bent end, a collar at its
  // outer end; B leaves its underside near the bend.
  // Pass 90: Brown's head has a conical collar flaring from the bend and a
  // chamfered nut-like cap at its outer end.
  const headInner = headStart - rodRootOnBentEnd, headOuter = headEnd - rodRootOnBentEnd;
  const headProfile = [
    [0.27, headInner],
    [0.38, headInner + 0.10],
    [0.38, headInner + 0.14],
    [0.34, headInner + 0.14],
    [0.34, headOuter - 0.17],
    [0.41, headOuter - 0.17],
    [0.41, headOuter - 0.07],
    [0.33, headOuter],
  ].map(([radius, axial]) => ({ axial, radial: radius }));
  const headGeometry = boredLatheGeometry(headProfile, 0.135, 64);
  // Lathe axis Y becomes rod-local -X (the bent end runs out along it).
  headGeometry.rotateZ(Math.PI / 2);
  const upperSocketCup = new THREE.Mesh(headGeometry, drivenMaterial);
  upperSocketCup.userData.role = 'head-A-turning-on-bent-end';
  rodBody.add(upperSocketCup);
  const bossGeometry = new THREE.CylinderGeometry(.13, .17, .16, 32);
  bossGeometry.translate(0, .30 + .08, 0);
  const headBoss = new THREE.Mesh(bossGeometry, drivenMaterial);
  headBoss.userData.role = 'boss-of-head-A-joining-rod-B';
  rodBody.add(headBoss);
  const rodTip = new THREE.Mesh(new THREE.SphereGeometry(rodRadius, 24, 16), drivenMaterial);
  rodTip.position.y = rodTipLength;
  rodTip.userData.role = 'rounded-lower-end-of-rod-B';
  rodBody.add(rodTip);
  // The head's bush on the bent end (hidden inside the head).
  const upperBall = new THREE.Mesh(boredCylinderGeometry(.134,.1235,.20),darkMaterial);
  upperBall.rotation.z=Math.PI/2;
  upperBall.userData.role='bush-of-head-A-on-bent-end';
  rodBody.add(upperBall);

  const rodBasis = new THREE.Matrix4();
  const rodAxis = new THREE.Vector3();
  const rodSide = new THREE.Vector3();
  const rodNormal = new THREE.Vector3();

  const update = (time) => {
    const state = stateAtTime(time);
    shaftRotor.rotation.x = state.shaftAngle;
    slideC.position.x = state.slideX;
    // Rod-local +Y runs down B to C, +X back along the bent end to the bend.
    rodAxis.copy(state.rodVector).normalize();
    rodSide.copy(state.bentEnd).negate();
    rodNormal.crossVectors(rodSide, rodAxis);
    rodBody.position.copy(state.upperSocket);
    rodBody.quaternion.setFromRotationMatrix(rodBasis.makeBasis(rodSide, rodAxis, rodNormal));
    // The swivel ball turns with B.
    lowerBall.quaternion.copy(rodBody.quaternion);
  };

  const sourceState = stateAtTime(0);
  const oppositeState = stateAtTime(cycleDuration / 2);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'horizontal-bent-shaft-transverse-crank-journal-double-ball-socket-oblique-rod-to-single-axis-slide',
    blocks: {
      bearingD, bearingBore, bearingPost, base, slideBody, slideFront, slideBridge, crankHandle, crankKnob,
      bentEndWasher,
      bentJournal,
      bentWeb,
      fixedFrame,
      headBoss,
      inputWheel,
      lowerBall,
      lowerSocketCup,
      mainShaft,
      rodB,
      rodBody,
      rodTip,
      shaftCollar,
      shaftRotor,
      slideC,
      socketWeb,
      upperBall,
      upperSocketCup,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      lowerSocketRotationIndependent: false,
      operatingDegreesOfFreedom: 1,
      rodOrientationIndependent: false,
      rodSlideInSocketIndependent: false,
      slidePositionIndependent: false,
      storedEnergyStates: 0,
      upperSocketRotationIndependent: false,
    },
    dynamics: {
      backlashClearanceElasticityInertiaLoadsAndForcesModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Horizontal shaft A rotates in fixed bearing D. Its end is bent at a small angle, and head A at the upper end of rod B turns on that inclined bent end with B held square to it. As A turns, the bent end tips from down-left to up-left, so B leans one way and then the other, as Brown’s bold and dotted poses show. B’s lower end slides through a swivel socket in slide C, constrained to one X-directed guide; the squareness of B gives exact simple-harmonic rectilinear reciprocation of C.',
    motion: {
      cycleDuration,
      shaftAngularSpeed,
      shaftTurnsPerCycle: 1,
      slideStroke,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 417 page marks its Animated control unavailable and supplies only Brown’s static bold/dotted plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      bold: {
        rodLeanFromVertical: sourceState.rodLeanFromVertical,
        shaftAngle: sourceState.shaftAngle,
        slideX: sourceState.slideX,
        upperSocket: sourceState.upperSocket.clone(),
      },
      dottedAfterHalfRevolution: {
        rodLeanFromVertical: oppositeState.rodLeanFromVertical,
        shaftAngle: oppositeState.shaftAngle,
        slideX: oppositeState.slideX,
        upperSocket: oppositeState.upperSocket.clone(),
      },
    },
    sourceReference: {
      brownPlate417: {
        bearingDApproximateBoundsPixels: [290, 115, 457, 395],
        bentShaftAApproximateBoundsPixels: [123, 80, 294, 218],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        rodBApproximateBoldEndpointsPixels: [[159, 169], [241, 388]],
        slideCApproximateBoldBoundsPixels: [91, 372, 312, 407],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the input is continuous circular motion',
          'shaft A works in fixed bearing D',
          'one end of A is bent',
          'the bent end turns in a socket at the upper end of rod B',
          'the lower end of B works in a socket in slide C',
          'the output of C is rectilinear reciprocation',
          'the dotted pose is exactly half a shaft revolution from the bold pose',
        ],
        engravingEvidence:
          'Brown’s bold view shows a horizontal shaft in the upright bearing D, a thick head A on its bent left end tipped slightly down, rod B leaving the head’s underside and leaning a little to the right down to slide C, and one horizontal guide. The dotted overlay tips head A up to the left and shows B leaning the other way to C’s left position.',
        reconstructionDisclosure:
          'Brown fixes the topology and the half-turn pose relation but gives no dimensions, bend angle, socket clearances, speed or stroke. The 14 degree bend, head and rod proportions, the swivel socket through which B slides, the plank and T-standard proportions, crank handle, and six-second uniform source cycle are independently engineered; B held square to the bent end determines C exactly.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 417',
    },
    stateAtShaftAngle,
    stateAtTime,
    transmission: {
      positionConstraint:
        '(C - bend).u = rodRoot, with u the bent-end direction and C on its guide',
      slideLaw:
        'slideX = bendX + (h sin(alpha) cos(theta) - rodRoot) / cos(alpha)',
      socketConstraint:
        'B turns with head A about the bent end and slides through a swivel ball in C, so its engaged length varies between the stated minimum and maximum',
      velocityConstraint:
        'd/dt[(lowerSocket - upperSocket).u] = 0',
    },
    update,
  };
  root.userData.cameraDistanceScale = 1.04;
  // Brown draws a flat side elevation.
  root.userData.cameraDirection = new THREE.Vector3(0, 0.06, 1);
  root.userData.groundFloorY = slideAxisY - .55;
  markShadows(root);
  base.receiveShadow = true;
  fitPistonGuide(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredBentShaftSlideMovement(movement) {
  if (movement.id !== 417) return null;
  return bentShaftSlide(movement);
}
