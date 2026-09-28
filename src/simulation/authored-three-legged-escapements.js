import * as THREE from 'three';
import {correctThreeLegParts, finishPinEscapement} from './pin-escapement-working-parts.js';
import {correctThreeLegDeadRests} from './three-leg-dead-rest-parts.js';
import {circle, plate as platePrism, poly, polygonClipping as clip} from './finite-plate-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
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


// Brown's 306 opening, in the plate frame with the wheel centre at the origin
// when the pendulum hangs vertically. It is point-symmetric: a vertical upper
// impulse face (x = 0, above y = h) and a vertical lower one (x = 0, below
// y = -h), and two horizontal half-dead rests at the side steps (the underside
// of the upper-left block at y = +s and the top of the lower-right block at
// y = -s, inboard ends at x = -/+restInnerX). The lobes follow the engraving and
// clear every tooth path swept by the reconstructed law.
function denisonOpeningPoints({
  impulseCornerY,
  openingTopY,
  restFaceY,
  restInnerX,
  restOuterX,
}) {
  const h = impulseCornerY;
  const top = openingTopY;
  const s = restFaceY;
  // Both curved edges are smooth, as Brown draws them: the upper-left lobe is
  // a centripetal spline through the traced knots, and the lower-left sweep a
  // quarter-ellipse-like Bezier leaving the side step straight down and
  // meeting the flat bottom edge tangentially (it lies outside the old
  // polyline, so it only widens the opening).
  const sampleCurve = (curve, count) => curve.getPoints(count).map((p) => [p.x, p.y]);
  const upperLeftLobe = sampleCurve(new THREE.CatmullRomCurve3([
    [0, top], [-0.30, top - 0.005], [-0.56, top - 0.04], [-0.77, top - 0.11],
    [-0.93, top - 0.22], [-1.03, top - 0.36], [-1.065, 0.34], [-1.05, 0.20],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal'), 40);
  const sweepEndX = -restOuterX + 0.86;
  const sweepWidth = sweepEndX + restOuterX;
  const sweepHeight = s + h;
  const lowerLeftSweep = sampleCurve(new THREE.CubicBezierCurve(
    new THREE.Vector2(-restOuterX, s),
    new THREE.Vector2(-restOuterX, s - 0.55 * sweepHeight),
    new THREE.Vector2(sweepEndX - 0.55 * sweepWidth, -h),
    new THREE.Vector2(sweepEndX, -h),
  ), 32).slice(1);
  const half = [
    ...upperLeftLobe,
    [-restInnerX, s],
    [-restOuterX, s],
    ...lowerLeftSweep,
    [0, -h],
  ];
  // The second half is the point reflection of the first.
  return [...half, ...half.map(([x, y]) => [-x, -y])]
    .map(([x, y]) => new THREE.Vector2(x, y));
}

function rectangularPalletPlateShape(width, height, openingPoints) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();
  const opening = new THREE.Path();
  openingPoints.forEach((point, index) => {
    if (index === 0) opening.moveTo(point.x, point.y);
    else opening.lineTo(point.x, point.y);
  });
  opening.closePath();
  shape.holes.push(opening);
  return shape;
}

// Brown's bottle-shaped pendulum plate, traced from the 307 raster about the
// wheel centre (raster 258, 350.5): each entry is [raster row, half width in
// raster pixels]. The bulb is widest level with the wheel centre and ends
// about 118 pixels below it; the neck rises about 318 pixels above it.
// Returned in the wheel-centred model frame (the opening is cut separately).
const plate307Profile = [
  [33, 49], [76, 50], [100, 54], [124, 59.5], [148, 67.5], [172, 77],
  [196, 90.5], [220, 111], [244, 145.5], [268, 183.5], [292, 206],
  [316, 218], [340, 223.5], [352, 224], [364, 222.5], [388, 212.5],
  [412, 193.5], [424, 178.5], [436, 153], [448, 124], [456, 95], [462, 68],
  [466, 42], [468.5, 14], [469.5, 0],
];
function longToothPalletPlateOutline(scale) {
  const toModel = ([row, half]) => new THREE.Vector2(half * scale, (350.5 - row) * scale);
  const right = new THREE.SplineCurve(plate307Profile.map(toModel)).getPoints(96)
    .map((point) => [point.x, point.y]);
  right[right.length - 1][0] = 0;
  const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  // Brown breaks the neck off with a ragged edge; the caller carries the
  // neck on up to the pendulum's suspension, so the outline ends square.
  const top = right[0][1];
  return [...right, ...left, [-right[0][0], top]];
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


function bisectRoot(f, low, high, label, iterations = 64) {
  let a = low;
  let b = high;
  const fa = f(a);
  const fb = f(b);
  if (!(fa * fb <= 0)) throw new Error(`${label}: no sign change (${fa}, ${fb})`);
  for (let index = 0; index < iterations; index += 1) {
    const middle = (a + b) / 2;
    const value = f(middle);
    if ((value > 0) === (fa > 0)) a = middle;
    else b = middle;
  }
  return (a + b) / 2;
}

// Beat law for a clockwise three-leg wheel held only by finite faces on a
// pendulum-carried plate. Each face constrains one working point (a leg tip
// or pin edge at `radius`): `residual` is positive while that point is clear
// of the face and `release` positive while the face still holds it. The
// wheel follows an impulse face, falls freely (constant angular acceleration)
// until it strikes a rest, follows the rest (recoiling if the rest is not
// concentric with the pendulum pivot), falls freely again when the rest's end
// passes the point, and strikes the next impulse face. Event times come from
// the finite faces, not from a schedule.
function threeLegContactLaw({
  faces,
  freeDropAcceleration,
  halfBeatDuration,
  patterns,
  pendulumAngleAt,
  toLocal,
  toothCount,
  wheelCenter,
}) {
  const wheelAdvancePerBeat = Math.PI / toothCount;
  const pointAt = (radius, angle) => new THREE.Vector2(
    wheelCenter.x + Math.cos(angle) * radius,
    wheelCenter.y + Math.sin(angle) * radius,
  );
  const localPoint = (face, angle, palletAngle) => toLocal(
    pointAt(faces[face].radius, angle),
    palletAngle,
  );
  const faceAngle = (face, palletAngle) => bisectRoot(
    (angle) => faces[face].residual(localPoint(face, angle, palletAngle)),
    faces[face].nominal + 0.9,
    faces[face].nominal - 0.9,
    `${face} face angle`,
  );
  const freeBeta = (start, time) => start.beta
    - 0.5 * freeDropAcceleration * (time - start.time) ** 2;
  const solved = patterns.map((pattern, parity) => {
    const theta = (tau) => pendulumAngleAt(tau + parity * halfBeatDuration);
    const betaOn = (engagement) => (tau) => faceAngle(
      engagement.face,
      theta(tau),
    ) - engagement.offset;
    const releaseOn = (engagement, beta, tau) => faces[engagement.face].release(
      localPoint(engagement.face, engagement.offset + beta, theta(tau)),
    );
    const impulseBeta = betaOn(pattern.impulse);
    const restBeta = betaOn(pattern.rest);
    const nextBeta = betaOn(pattern.next);
    const impulseEnd = bisectRoot(
      (tau) => releaseOn(pattern.impulse, impulseBeta(tau), tau),
      0,
      halfBeatDuration / 2,
      `${pattern.impulse.face} impulse end`,
    );
    const impulseRelease = { beta: impulseBeta(impulseEnd), time: impulseEnd };
    const landing = bisectRoot(
      (tau) => freeBeta(impulseRelease, tau) - restBeta(tau),
      impulseEnd,
      halfBeatDuration,
      `${pattern.rest.face} landing`,
    );
    const landingCover = releaseOn(pattern.rest, restBeta(landing), landing);
    if (!(landingCover > 0)) throw new Error(`${pattern.rest.face} rest does not cover the landing point`);
    const restRelease = bisectRoot(
      (tau) => releaseOn(pattern.rest, restBeta(tau), tau),
      halfBeatDuration / 2,
      halfBeatDuration,
      `${pattern.rest.face} release`,
    );
    const restDrop = { beta: restBeta(restRelease), time: restRelease };
    const contact = bisectRoot(
      (tau) => freeBeta(restDrop, tau) - nextBeta(tau),
      restRelease,
      halfBeatDuration,
      `${pattern.next.face} contact`,
    );
    return {
      ...pattern,
      contact,
      impulseBeta,
      impulseEnd,
      impulseRelease,
      landing,
      landingCover,
      nextBeta,
      restBeta,
      restDrop,
      restRelease,
      theta,
    };
  });
  const positiveMod = (value, modulus) => ((value % modulus) + modulus) % modulus;
  const stateAtTime = (time) => {
    const halfBeatIndex = Math.floor(time / halfBeatDuration);
    const tau = time - halfBeatIndex * halfBeatDuration;
    const parity = positiveMod(halfBeatIndex, 2);
    const pattern = solved[parity];
    let beta;
    let engagement = null;
    let contactKind;
    let recoil = 0;
    let dropTarget = null;
    if (tau <= pattern.impulseEnd) {
      beta = pattern.impulseBeta(tau);
      engagement = pattern.impulse;
      contactKind = 'direct-impulse';
    } else if (tau < pattern.landing) {
      beta = freeBeta(pattern.impulseRelease, tau);
      contactKind = 'free-drop';
      dropTarget = pattern.rest.face;
    } else if (tau <= pattern.restRelease) {
      beta = pattern.restBeta(tau);
      recoil = beta - pattern.restBeta(pattern.landing);
      engagement = pattern.rest;
      contactKind = faces[pattern.rest.face].kind;
    } else if (tau < pattern.contact) {
      beta = freeBeta(pattern.restDrop, tau);
      contactKind = 'free-drop';
      dropTarget = pattern.next.face;
    } else {
      beta = pattern.nextBeta(tau);
      engagement = pattern.next;
      contactKind = 'direct-impulse';
    }
    const toothShift = Math.floor(halfBeatIndex / 2);
    const globalTooth = (item) => positiveMod(item.tooth + toothShift, toothCount);
    const wheelAngle = pattern.base
      - (halfBeatIndex - parity) * wheelAdvancePerBeat + beta;
    const activePoint = engagement
      ? pointAt(faces[engagement.face].radius, engagement.offset + beta)
      : null;
    return {
      activeFace: engagement ? faces[engagement.face].role : null,
      activePoint,
      activeSide: engagement ? engagement.face : null,
      activeToothIndex: engagement ? globalTooth(engagement) : null,
      contactKind,
      dropTarget,
      halfBeatIndex,
      halfPhase: tau / halfBeatDuration,
      impulseSide: pattern.impulse.face,
      mode: engagement
        ? `${engagement.face}-${contactKind}`
        : `free-drop-to-${dropTarget}`,
      palletAngle: pendulumAngleAt(time),
      recoil,
      startToothIndex: globalTooth(pattern.impulse),
      wheelAngle,
    };
  };
  return { faceAngle, patterns: solved, pointAt, stateAtTime };
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

  // Opening in the plate frame (wheel centre at the origin when the pendulum
  // hangs vertically). The vertical steps at the top and bottom of Brown's
  // opening are the impulse faces; the horizontal side steps are the
  // half-dead rests. Every value below is a reconstruction chosen so that the
  // finite teeth work these faces and clear the rest of the opening.
  const impulseFaceX = 0;
  const impulseCornerY = 0.72;
  const openingTopY = 0.85;
  const restFaceY = 0.07;
  const restInnerX = 1.0;
  const restOuterX = 1.68;
  const openingPoints = denisonOpeningPoints({
    impulseCornerY,
    openingTopY,
    restFaceY,
    restInnerX,
    restOuterX,
  });

  // Sinusoidal pendulum; the plate travel at the wheel is +/-0.34.
  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const plateSwing = 0.34;
  const pendulumAmplitude = Math.asin(plateSwing / centerDistance);
  const pendulumFrequency = FULL_TURN / pendulumPeriod;
  // A light wheel falls freely between faces with this angular acceleration
  // (rad/s^2) and stops on impact with the next face.
  const freeDropAcceleration = 40;
  const lowerPalletDepthLimit = toothTipRadius / 8;
  const lowerPalletMaximumDepth = toothTipRadius - impulseCornerY;

  const pendulumAngleAt = (time) => pendulumAmplitude
    * Math.sin(pendulumFrequency * time);

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
  const tipAtAngle = (angle) => new THREE.Vector2(
    wheelCenter.x + Math.cos(angle) * toothTipRadius,
    wheelCenter.y + Math.sin(angle) * toothTipRadius,
  );

  // Each face constrains the leg tip that works it; residuals are positive
  // while the tip is clear, releases positive while the face holds the tip.
  const faces = {
    upper: {
      kind: 'direct-impulse',
      nominal: Math.PI / 2,
      radius: toothTipRadius,
      release: (p) => p.y - impulseCornerY,
      residual: (p) => impulseFaceX - p.x,
      role: 'upper-direct-impulse-face',
    },
    lower: {
      kind: 'direct-impulse',
      nominal: -Math.PI / 2,
      radius: toothTipRadius,
      release: (p) => -p.y - impulseCornerY,
      residual: (p) => p.x + impulseFaceX,
      role: 'lower-direct-impulse-face',
    },
    left: {
      kind: 'half-dead-rest',
      nominal: Math.PI,
      radius: toothTipRadius,
      release: (p) => -p.x - restInnerX,
      residual: (p) => restFaceY - p.y,
      role: 'left-half-dead-rest-face',
    },
    right: {
      kind: 'half-dead-rest',
      nominal: 0,
      radius: toothTipRadius,
      release: (p) => p.x - restInnerX,
      residual: (p) => p.y + restFaceY,
      role: 'right-half-dead-rest-face',
    },
  };
  // Within a half beat the wheel angle is base + beta; local leg j has tip
  // angle offset + beta. Beat 0 starts with the upper leg on the upper impulse
  // face at the pendulum's centre, beat 1 with the lower leg on the lower face.
  const law = threeLegContactLaw({
    faces,
    freeDropAcceleration,
    halfBeatDuration,
    patterns: [
      {
        base: Math.PI / 2,
        impulse: { face: 'upper', tooth: 0, offset: Math.PI / 2 },
        rest: { face: 'left', tooth: 1, offset: 7 * Math.PI / 6 },
        next: { face: 'lower', tooth: 2, offset: -Math.PI / 6 },
      },
      {
        base: Math.PI / 6,
        impulse: { face: 'lower', tooth: 2, offset: -Math.PI / 2 },
        rest: { face: 'right', tooth: 0, offset: Math.PI / 6 },
        next: { face: 'upper', tooth: 1, offset: 5 * Math.PI / 6 },
      },
    ],
    pendulumAngleAt,
    toLocal: palletPlateLocalPoint,
    toothCount,
    wheelCenter,
  });
  const patterns = law.patterns;
  const faceTipAngle = law.faceAngle;
  const rawStateAtTime = (time) => {
    const state = law.stateAtTime(time);
    const activeToothAngle = state.activeToothIndex === null
      ? null
      : state.wheelAngle + state.activeToothIndex * toothPitch;
    return {
      ...state,
      activeToothAngle,
      activeToothTip: state.activePoint,
      palletAngularAcceleration: -(pendulumFrequency ** 2) * state.palletAngle,
      palletAngularSpeed: pendulumAmplitude * pendulumFrequency
        * Math.cos(pendulumFrequency * time),
    };
  };

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
    return {
      ...state,
      activeFace: faces[state.activeSide].role,
      contactError: Math.abs(faces[state.activeSide].residual(contactPointLocal)),
      contactPoint: state.activeToothTip.clone(),
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
  const wheelAngleAtBeatStart = (halfBeatIndex) => (
    Math.PI / 2 - halfBeatIndex * wheelAdvancePerBeat
  );
  const toothTipAt = (wheelAngle, toothIndex) => tipAtAngle(
    wheelAngle + toothIndex * toothPitch,
  );
  const escapeAngle = Math.abs(patterns[0].theta(patterns[0].restRelease));
  const faceSegments = {
    upper: [new THREE.Vector2(impulseFaceX, impulseCornerY), new THREE.Vector2(impulseFaceX, openingTopY)],
    lower: [new THREE.Vector2(-impulseFaceX, -impulseCornerY), new THREE.Vector2(-impulseFaceX, -openingTopY)],
    left: [new THREE.Vector2(-restInnerX, restFaceY), new THREE.Vector2(-restOuterX, restFaceY)],
    right: [new THREE.Vector2(restInnerX, -restFaceY), new THREE.Vector2(restOuterX, -restFaceY)],
  };

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
  const slotMaterial = matte(PALETTE.muted, {
    metalness: 0.2,
    roughness: 0.4,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.55,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-three-legged-escapement-frame';
  root.add(fixedFrame);
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
      rectangularPalletPlateShape(plateWidth, plateHeight, openingPoints),
      palletDepth,
      0.012,
    ),
    plateMaterial,
  );
  plate.position.z = 0.04;
  plate.userData.role = 'single-opening-upper-lower-pallet-plate';
  plateCarrier.add(plate);
  // Brown draws two flat pendulum-rod strips behind the plate, running above
  // and below it through the four fastening screws; they swing with it.
  const pendulumStrips = [-1, 1].map((side) => {
    // Each strip is one flat bar with round ends, carried a little past the
    // plate's edges rather than cut off square.
    const stripHalfWidth = 0.20, stripHalfStraight = (plateHeight + 1.10) / 2 - stripHalfWidth;
    const stripShape = new THREE.Shape();
    stripShape.moveTo(stripHalfWidth, -stripHalfStraight);
    stripShape.lineTo(stripHalfWidth, stripHalfStraight);
    stripShape.absarc(0, stripHalfStraight, stripHalfWidth, 0, Math.PI, false);
    stripShape.lineTo(-stripHalfWidth, -stripHalfStraight);
    stripShape.absarc(0, -stripHalfStraight, stripHalfWidth, Math.PI, FULL_TURN, false);
    const stripGeometry = new THREE.ExtrudeGeometry(stripShape, { bevelEnabled: false, curveSegments: 32, depth: 0.08 });
    stripGeometry.translate(0, 0, -0.04);
    const strip = new THREE.Mesh(stripGeometry, frameMaterial);
    strip.position.set(side * 1.96, 0, 0.04 - palletDepth / 2 - 0.035);
    strip.userData.role = 'pendulum-rod-strip-behind-plate';
    plateCarrier.add(strip);
    return strip;
  });

  const screwPositions = [
    new THREE.Vector2(-1.96, 0.70),
    new THREE.Vector2(1.96, 0.70),
    new THREE.Vector2(-1.96, -0.70),
    new THREE.Vector2(1.96, -0.70),
  ];
  // Slotted screws through the plate into the rod strips, heads just proud.
  const screwLength = 0.33;
  const screwMeshes = screwPositions.map((position, index) => {
    const screw = cylinderAlongZ(0.12, screwLength, darkMaterial);
    screw.position.set(position.x, position.y, 0.04 + palletDepth / 2 + 0.05 - screwLength / 2);
    screw.userData.index = index;
    screw.userData.role = 'pallet-plate-fastening-screw';
    // The screw's local y is the world z axis (cylinderAlongZ), so the slot
    // is a thin cut in the head face, turned about that axis. Steel grey on
    // the ink head (a white slot would read as a hole on the cream page).
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.02, 0.028),
      slotMaterial,
    );
    slot.position.y = screwLength / 2;
    slot.rotation.y = index % 2 === 0
      ? THREE.MathUtils.degToRad(72)
      : THREE.MathUtils.degToRad(-8);
    screw.add(slot);
    plateCarrier.add(screw);
    return screw;
  });

  const faceEdges = Object.entries(faceSegments).map(([side, points]) => {
    const face = edgeTube(
      points,
      workingPlaneZ + 0.08,
      faces[side].kind === 'direct-impulse' ? 0.030 : 0.024,
      faceMaterial,
      `${faces[side].role}-edge`,
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
  // Brown's legs are narrow offset strips that bend clockwise into a sharp
  // point at the tip radius (traced from the 306 plate, tip on local +x).
  // The three strips are united, cut into congruent 120-degree pieces and
  // bored for the arbor; no bevel grows the tip past its working radius.
  const legDirection = new THREE.Vector2(0.995, 0.098).normalize();
  const legInnerKink = new THREE.Vector2(0.525, 0.128);
  const legOuterKink = new THREE.Vector2(0.537, 0.309);
  const legStrip = (angle) => poly([
    legInnerKink.clone().addScaledVector(legDirection, -0.75),
    legInnerKink,
    new THREE.Vector2(toothTipRadius, 0),
    legOuterKink,
    legOuterKink.clone().addScaledVector(legDirection, -0.75),
  ].map((point) => rotate2(point, angle).toArray()));
  const wheelOutline = clip.difference(
    clip.union(...Array.from({ length: toothCount }, (_, index) => legStrip(index * toothPitch))),
    poly(circle([0, 0], 0.095, 96)),
  );
  const legWedge = (angle) => poly([
    [0, 0],
    ...Array.from({ length: 13 }, (_, index) => {
      const a = angle - Math.PI / 6 + toothPitch * index / 12;
      return [2 * Math.cos(a), 2 * Math.sin(a)];
    }),
  ]);
  const legPieces = Array.from({ length: toothCount }, (_, index) => clip.intersection(
    wheelOutline,
    legWedge(index * toothPitch),
  ));
  const legMeshes = [];
  const toothTips = [];
  for (let index = 0; index < toothCount; index += 1) {
    const leg = new THREE.Mesh(
      platePrism(legPieces[index], -wheelDepth / 2, wheelDepth / 2),
      wheelMaterial,
    );
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
  // Diagnostic only; Brown's plate has no index mark.
  plateMotionIndex.visible = false;
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
    contactMarkerZ,
    escapeAngle,
    freeDropAcceleration,
    halfBeatDuration,
    impulseCornerY,
    impulseFaceX,
    lowerPalletDepthLimit,
    lowerPalletMaximumDepth,
    palletDepth,
    palletPivot: palletPivot.clone(),
    pendulumAmplitude,
    pendulumPeriod,
    plateCenterLocal: plateCenterLocal.clone(),
    plateHeight,
    plateSwing,
    plateWidth,
    restFaceY,
    restInnerX,
    restOuterX,
    openingTopY,
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
  root.userData.mechanism = 'Denison’s original three-legged half-dead escapement: three lightweight 120-degree-spaced wheel legs act directly on upper and lower pallets cut into one pendulum-carried plate. A clockwise 60-degree step alternates upper rightward and lower leftward impulses on the vertical steps of the opening; between them a leg drops onto a horizontal side step, whose half-dead rest makes the wheel recoil slightly as the pendulum rocks the plate.';
  // Beat timing solved from the finite faces (seconds within each half beat).
  root.userData.beatEvents = patterns.map((pattern) => ({
    contact: pattern.contact,
    impulseEnd: pattern.impulseEnd,
    impulseFace: pattern.impulse.face,
    landing: pattern.landing,
    landingCover: pattern.landingCover,
    nextFace: pattern.next.face,
    restFace: pattern.rest.face,
    restRelease: pattern.restRelease,
  }));
  root.userData.faceTipAngle = faceTipAngle;
  root.userData.palletFaces = Object.fromEntries(Object.entries(faces).map(
    ([side, face]) => [side, {
      kind: face.kind,
      role: face.role,
      segment: faceSegments[side].map((point) => point.clone()),
      ...(side === 'lower' ? { maximumDepth: lowerPalletMaximumDepth } : {}),
    }],
  ));
  root.userData.openingPoints = openingPoints.map((point) => point.clone());
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
      'upper-tooth-directly-impulses-plate-right',
      'free-drop-to-left-rest',
      'left-half-dead-rest-recoils-through-right-extreme',
      'free-drop-to-lower-impulse-face',
      'lower-tooth-directly-impulses-plate-left',
      'free-drop-to-right-rest',
      'right-half-dead-rest-recoils-through-left-extreme',
      'free-drop-to-upper-impulse-face',
    ],
  };
  root.userData.toothTipAt = toothTipAt;
  root.userData.transmission = {
    clearance: 'the wheel falls freely between each impulse face and the next rest, and between each rest and the next impulse face; drops end in impact',
    direction: 'clockwise; the upper tooth therefore drives the plate rightward and the lower tooth leftward',
    lowerPalletDepthRule: 'impulse corner 0.06 below the tip radius (0.077 wheel radius), below Beckett’s one-eighth-radius maximum',
    recoil: 'intentional half-dead recoil: the horizontal rest faces are not concentric with the pendulum pivot',
    toothCount,
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
    wheelTurnsPerSixBeats: 1,
  };
  root.userData.wheelAngleAtBeatStart = wheelAngleAtBeatStart;

  correctThreeLegParts(root,movement.id);
  correctThreeLegDeadRests(root,movement.id);
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

  // Beckett's refinement of 306 (his figure 18): three long front teeth lock
  // on dead stops D and E fixed to the plate, and three short sharp-edged pins
  // pointing backward from the wheel give impulse on hardened pallets A and B
  // at the steps of the plate's opening. Brown's plate shows the drawn pose:
  // the left tooth locked on D while the upper pin has just left A.
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
  // The plate hangs from a long pendulum whose suspension is far above the
  // frame; Brown breaks the neck off at the top. The raster "pivot" below is
  // only the top of the drawn neck, used to register the plate.
  const sourceNeckTop = new THREE.Vector2(0, 4.05);
  const palletPivot = new THREE.Vector2(0, 20);
  const wheelCenter = new THREE.Vector2(0, -0.15);
  const centerDistance = palletPivot.distanceTo(wheelCenter);
  const sourceNeckDistance = sourceNeckTop.distanceTo(wheelCenter);
  const sourcePivotToWheel = new THREE.Vector2(
    sourceRasterWheelCenter.x - sourceRasterPendulumPivot.x,
    sourceRasterPendulumPivot.y - sourceRasterWheelCenter.y,
  );
  const modelPivotToWheel = wheelCenter.clone().sub(sourceNeckTop);
  const sourceScale = sourceNeckDistance / sourcePivotToWheel.length();
  const sourceAlignmentAngle = modelPivotToWheel.angle()
    - sourcePivotToWheel.angle();
  const sourcePointToModel = ({ x, y }) => sourceNeckTop.clone().add(
    rotate2(new THREE.Vector2(
      x - sourceRasterPendulumPivot.x,
      sourceRasterPendulumPivot.y - y,
    ), sourceAlignmentAngle).multiplyScalar(sourceScale),
  );

  const toothCount = 3;
  const toothPitch = FULL_TURN / toothCount;
  const wheelAdvancePerBeat = toothPitch / 2;
  const longToothRadius = 1.88;
  // Working edge radius of the sharp inner pins, and their angular offset
  // from the long tooth they are set behind.
  const impulsePinOrbitRadius = 0.36;
  const impulsePinPhaseOffset = THREE.MathUtils.degToRad(1);
  const wheelDepth = 0.18;
  const palletDepth = 0.23;
  const lockPlaneZ = 0.25;
  const impulsePlaneZ = 0;
  const impulsePinBackZ = -palletDepth / 2 - 0.03;
  const impulsePinLength = lockPlaneZ - impulsePinBackZ;
  const contactMarkerZ = {
    impulse: palletDepth / 2 + 0.08,
    lock: lockPlaneZ + wheelDepth / 2 + 0.08,
  };

  // Plate frame: origin at the wheel centre with the pendulum vertical. A and
  // B are vertical faces at x = 0 above/below the pin corner height; D and E
  // are dead faces concentric with the pendulum pivot.
  const plateCenterLocal = wheelCenter.clone().sub(palletPivot);
  const pivotInPlate = plateCenterLocal.clone().negate();
  const impulseCornerY = impulsePinOrbitRadius * Math.cos(THREE.MathUtils.degToRad(25));
  const openingHalfHeight = 0.44;
  const openingHalfLength = 1.75;
  const lockAngle = THREE.MathUtils.degToRad(1.5);
  const lockPoint = new THREE.Vector2(
    -longToothRadius * Math.cos(lockAngle),
    longToothRadius * Math.sin(lockAngle),
  );
  const deadStopRadius = lockPoint.distanceTo(pivotInPlate);
  const lockRelease = 0.13;
  const stopInnerX = longToothRadius * Math.cos(lockAngle) + lockRelease;
  const stopLength = 0.40;
  const stopDepth = 0.11;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const plateSwing = 0.19;
  const pendulumAmplitude = Math.asin(plateSwing / centerDistance);
  const pendulumFrequency = FULL_TURN / pendulumPeriod;
  const freeDropAcceleration = 40;
  const pendulumAngleAt = (time) => pendulumAmplitude
    * Math.sin(pendulumFrequency * time);

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
  const pivotDistance = (p) => p.distanceTo(pivotInPlate);
  // E's lock point is the point reflection of D's about the wheel centre;
  // the pivot is not reflected, so E is concentric on its own radius.
  const deadStopRadiusE = lockPoint.clone().negate().distanceTo(pivotInPlate);
  const faces = {
    A: {
      kind: 'direct-impulse',
      nominal: Math.PI / 2,
      radius: impulsePinOrbitRadius,
      release: (p) => p.y - impulseCornerY,
      residual: (p) => -p.x,
      role: 'A-upper-impulse-pallet-face',
    },
    B: {
      kind: 'direct-impulse',
      nominal: -Math.PI / 2,
      radius: impulsePinOrbitRadius,
      release: (p) => -p.y - impulseCornerY,
      residual: (p) => p.x,
      role: 'B-lower-impulse-pallet-face',
    },
    D: {
      kind: 'dead-lock',
      nominal: Math.PI,
      radius: longToothRadius,
      release: (p) => -p.x - stopInnerX,
      residual: (p) => pivotDistance(p) - deadStopRadius,
      role: 'D-left-concentric-dead-stop',
    },
    E: {
      kind: 'dead-lock',
      nominal: 0,
      radius: longToothRadius,
      release: (p) => p.x - stopInnerX,
      residual: (p) => deadStopRadiusE - pivotDistance(p),
      role: 'E-right-concentric-dead-stop',
    },
  };

  const phi0 = impulsePinPhaseOffset;
  const law = threeLegContactLaw({
    faces,
    freeDropAcceleration,
    halfBeatDuration,
    patterns: [
      {
        base: Math.PI / 2 - phi0,
        impulse: { face: 'A', tooth: 0, offset: Math.PI / 2 },
        rest: { face: 'D', tooth: 1, offset: Math.PI / 2 - phi0 + toothPitch },
        next: { face: 'B', tooth: 2, offset: -Math.PI / 6 },
      },
      {
        base: Math.PI / 6 - phi0,
        impulse: { face: 'B', tooth: 2, offset: -Math.PI / 2 },
        rest: { face: 'E', tooth: 0, offset: Math.PI / 6 - phi0 },
        next: { face: 'A', tooth: 1, offset: 5 * Math.PI / 6 },
      },
    ],
    pendulumAngleAt,
    toLocal: palletPlateLocalPoint,
    toothCount,
    wheelCenter,
  });

  const longToothTipAt = (wheelAngle, toothIndex) => wheelCenter.clone().add(
    new THREE.Vector2(
      Math.cos(wheelAngle + toothIndex * toothPitch) * longToothRadius,
      Math.sin(wheelAngle + toothIndex * toothPitch) * longToothRadius,
    ),
  );
  const impulsePinCenterAt = (wheelAngle, pinIndex) => wheelCenter.clone().add(
    new THREE.Vector2(
      Math.cos(wheelAngle + pinIndex * toothPitch + phi0)
        * impulsePinOrbitRadius,
      Math.sin(wheelAngle + pinIndex * toothPitch + phi0)
        * impulsePinOrbitRadius,
    ),
  );
  const wheelAngleAtBeatStart = (halfBeatIndex) => (
    Math.PI / 2 - phi0 - halfBeatIndex * wheelAdvancePerBeat
  );

  // Time 0 is Brown's drawn pose: the plate at its right extreme with the
  // left long tooth locked on D. The law's own origin is the centre of the A
  // impulse, a quarter period earlier.
  const timeOrigin = pendulumPeriod / 4;
  const rawStateAtTime = (time) => {
    const lawTime = time + timeOrigin;
    const state = law.stateAtTime(lawTime);
    const isLock = state.contactKind === 'dead-lock';
    return {
      ...state,
      activeIndex: state.activeToothIndex,
      activeSystem: state.activeSide === null
        ? null
        : isLock ? 'outer-lock' : 'inner-impulse',
      lawTime,
      palletAngularAcceleration: -(pendulumFrequency ** 2) * state.palletAngle,
      palletAngularSpeed: pendulumAmplitude * pendulumFrequency
        * Math.cos(pendulumFrequency * lawTime),
    };
  };
  const addContactState = (state) => {
    if (!state.activePoint) {
      return {
        ...state,
        contactError: null,
        contactPoint: null,
        contactPointLocal: null,
      };
    }
    const contactPointLocal = palletPlateLocalPoint(
      state.activePoint,
      state.palletAngle,
    );
    return {
      ...state,
      contactError: Math.abs(faces[state.activeSide].residual(contactPointLocal)),
      contactPoint: state.activePoint.clone(),
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
  // Steel stops and impulse pins: white ones would read as holes on the
  // cream page.
  const stopMaterial = matte(PALETTE.muted, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const impulsePinMaterial = matte(PALETTE.muted, {
    metalness: 0.2,
    roughness: 0.4,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.30,
    roughness: 0.54,
  });

  // Fixed arbors and the frame that carries them (not drawn by Brown; the
  // source presentation removes the frame members).
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-long-tooth-escapement-frame';
  root.add(fixedFrame);
  const rearUpright = beamBetween(
    new THREE.Vector3(-2.75, -1.38, -0.56),
    new THREE.Vector3(-2.75, 1.2, -0.56),
    0.15,
    0.18,
    frameMaterial,
  );
  rearUpright.userData.role = 'rear-clock-frame-upright';
  fixedFrame.add(rearUpright);
  const arborRadius = 0.078;
  for (const [point, name, front] of [
    [wheelCenter, 'three-leg-wheel-arbor', lockPlaneZ + wheelDepth / 2 + 0.06],
  ]) {
    const bracket = beamBetween(
      new THREE.Vector3(-2.75, point.y, -0.56),
      new THREE.Vector3(point.x, point.y, -0.56),
      0.12,
      0.18,
      frameMaterial,
    );
    bracket.userData.role = `${name}-bracket`;
    fixedFrame.add(bracket);
    const back = -0.65;
    const bearing = cylinderAlongZ(arborRadius, front - back, darkMaterial);
    bearing.position.set(point.x, point.y, (front + back) / 2);
    bearing.userData.role = name;
    fixedFrame.add(bearing);
  }

  // The pendulum hangs on a fixed suspension pin through its bored eye (far
  // above Brown's crop), held in a small cock behind the plate, with a
  // retaining head in front.
  {
    const pin = cylinderAlongZ(0.118, 0.54, darkMaterial);
    pin.position.set(palletPivot.x, palletPivot.y, -0.06);
    pin.userData.role = 'fixed-pendulum-suspension-pin';
    const head = cylinderAlongZ(0.18, 0.04, darkMaterial);
    head.position.set(palletPivot.x, palletPivot.y, palletDepth / 2 + 0.03);
    head.userData.role = 'suspension-pin-retaining-head';
    // One flat plate: its lower end is a half-round (r 0.35) concentric
    // with the pin, its straight sides rise 0.6 to the unseen mounting.
    const cock = new THREE.Mesh(platePrism(clip.union(poly(circle([0, 0], 0.35, 96)),
      poly([[-0.35, 0], [0.35, 0], [0.35, 0.6], [-0.35, 0.6]])), -0.075, 0.075), frameMaterial);
    cock.position.set(palletPivot.x, palletPivot.y, -palletDepth / 2 - 0.02 - 0.075);
    cock.userData.role = 'fixed-suspension-cock-behind-pendulum';
    fixedFrame.add(pin, head, cock);
  }
  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role = 'long-tooth-pendulum-pallet-plate';
  root.add(palletAssembly);
  const plateCarrier = new THREE.Group();
  plateCarrier.position.set(plateCenterLocal.x, plateCenterLocal.y, 0);
  plateCarrier.userData.role = 'two-plane-pallet-carrier';
  palletAssembly.add(plateCarrier);

  // Brown's opening: a long slot whose upper edge steps down at A and whose
  // lower edge steps down at B (point-symmetric about the wheel centre).
  const h = impulseCornerY;
  const H = openingHalfHeight;
  const L = openingHalfLength;
  const straight = L - 0.30;
  const endArc = (fromY, toY, side) => Array.from({ length: 17 }, (_, index) => {
    const a = Math.PI / 2 + Math.PI * index / 16;
    const cy = (fromY + toY) / 2;
    const ry = Math.abs(fromY - toY) / 2;
    return [side * (straight + 0.30 * -Math.cos(a)), cy + ry * Math.sin(a) * Math.sign(fromY - toY)];
  });
  const openingHalf = [
    [0, H],
    [-straight, H],
    ...endArc(H, -h, -1).slice(1, -1),
    [-straight, -h],
    [0, -h],
  ];
  const openingPlate = [...openingHalf, ...openingHalf.map(([x, y]) => [-x, -y])];
  const toPivotFrame = ([x, y]) => [x + plateCenterLocal.x, y + plateCenterLocal.y];
  // Same width as before (the stops D, E sit on the bulb), with Brown's
  // proportions about the wheel centre.
  const bottle = longToothPalletPlateOutline(2.52 / 224)
    .map(([x, y]) => [x + wheelCenter.x - palletPivot.x, y + wheelCenter.y - palletPivot.y]);
  // The neck is not broken off: it runs on as a strap of its own width to a
  // bored eye at the suspension point (the pallet pivot, far above the view).
  const neckHalf = bottle[0][0], neckTop = bottle.at(-1)[1], eyeRadius = neckHalf;
  const neckStrap = poly([
    [neckHalf, neckTop - 0.02], [neckHalf, 0], [-neckHalf, 0], [-neckHalf, neckTop - 0.02],
  ]);
  const plateOutline = clip.difference(
    clip.union(poly(bottle), neckStrap, poly(circle([0, 0], eyeRadius, 64))),
    poly(openingPlate.map(toPivotFrame)),
    poly(circle([0, 0], 0.12, 48)),
    // Pockets for the hardened pallets A and B: the plate's own step and
    // opening-edge walls are cut back 0.003 inside each pallet, which alone
    // carries those faces (they were coincident). Where a pallet face runs on
    // into the plate's opening edge, the pocket ends exactly at that corner.
    ...[1, -1].map(sign => {
      const e = 0.003, x1 = sign > 0 ? 0.36 : 0.09, top = sign > 0 ? h + 0.11 : H + 0.09;
      const pocket = [[-e, h - e], [x1, h - e], [x1, h + e], [x1 - e, h + e]];
      if (sign > 0) pocket.push([x1 - e, top - e], [0.09 - e, top - e]);
      pocket.push([0.09 - e, H + 0.09 - e], [e, H + 0.09 - e], [e, H], [-e, H]);
      return poly(pocket.map(([x, y]) => toPivotFrame([sign * x, sign * y])));
    }),
  );
  const plate = new THREE.Mesh(
    platePrism(plateOutline, -palletDepth / 2, palletDepth / 2),
    plateMaterial,
  );
  plate.userData.role = 'bottle-profile-long-tooth-pallet-plate';
  palletAssembly.add(plate);
  // Hardened pallets A and B form the two vertical steps of the opening.
  const palletBlock = (points, role) => {
    const mesh = new THREE.Mesh(
      platePrism(poly(points), -palletDepth / 2 - 0.012, palletDepth / 2 + 0.012),
      darkMaterial,
    );
    mesh.userData.role = role;
    plateCarrier.add(mesh);
    return mesh;
  };
  // A's hardened insert also lines the opening's upper edge to the right of
  // the step (solid plate there, never entered by the pins), so, as Brown
  // draws it, a short black block shows beside the upper leg's leading edge
  // instead of hiding behind the leg's root.
  const palletA = palletBlock(
    [[0, h], [0.36, h], [0.36, h + 0.11], [0.09, h + 0.11], [0.09, H + 0.09], [0, H + 0.09]],
    'hardened-impulse-pallet-A',
  );
  const palletB = palletBlock(
    [[0, -h], [0, -H - 0.09], [-0.09, -H - 0.09], [-0.09, -h]],
    'hardened-impulse-pallet-B',
  );

  // Dead stops D and E: arc strips concentric with the pendulum pivot,
  // screwed to the plate's front and reaching forward into the tooth plane.
  const arcSegments = 64;
  const arcStrip = (radius, x0, x1, inward) => {
    const points = [];
    for (let index = 0; index <= arcSegments; index += 1) {
      const x = x0 + (x1 - x0) * index / arcSegments;
      points.push([x, pivotInPlate.y - Math.sqrt(radius ** 2 - x ** 2)]);
    }
    const inner = [];
    for (let index = arcSegments; index >= 0; index -= 1) {
      const x = x0 + (x1 - x0) * index / arcSegments;
      const r = radius + inward * stopDepth;
      inner.push([x, pivotInPlate.y - Math.sqrt(r ** 2 - x ** 2)]);
    }
    return [...points, ...inner];
  };
  const stopBack = palletDepth / 2 - 0.01;
  const stopFront = lockPlaneZ + wheelDepth / 2 + 0.02;
  const makeStop = (outline, role) => {
    const mesh = new THREE.Mesh(
      platePrism(poly(outline), stopBack, stopFront),
      stopMaterial,
    );
    mesh.userData.role = role;
    plateCarrier.add(mesh);
    for (const t of [0.25, 0.75]) {
      const k = Math.round(t * arcSegments);
      const a = outline[k];
      const b = outline[outline.length - 1 - k];
      const screw = cylinderAlongZ(0.028, 0.02, darkMaterial, 16);
      screw.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, stopFront + 0.005);
      screw.userData.role = `${role}-screw`;
      plateCarrier.add(screw);
    }
    return mesh;
  };
  const stopD = makeStop(
    arcStrip(deadStopRadius, -stopInnerX, -stopInnerX - stopLength, -1),
    'adjustable-dead-stop-D',
  );
  const stopE = makeStop(
    arcStrip(deadStopRadiusE, stopInnerX, stopInnerX + stopLength, 1),
    'adjustable-dead-stop-E',
  );

  const faceEdges = [
    ['A', [[0, h], [0, H]], palletDepth / 2 + 0.03],
    ['B', [[0, -h], [0, -H]], palletDepth / 2 + 0.03],
    ['D', arcStrip(deadStopRadius, -stopInnerX, -stopInnerX - stopLength, -1).slice(0, arcSegments + 1), stopFront + 0.03],
    ['E', arcStrip(deadStopRadiusE, stopInnerX, stopInnerX + stopLength, 1).slice(0, arcSegments + 1), stopFront + 0.03],
  ].map(([side, points, z]) => {
    const edge = edgeTube(
      points.map(([x, y]) => new THREE.Vector2(x, y)),
      z,
      0.024,
      faceMaterial,
      faces[side].role,
    );
    edge.visible = false;
    plateCarrier.add(edge);
    return edge;
  });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role = 'separate-lock-and-impulse-three-leg-wheel';
  root.add(escapeWheel);
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-sixty-degree-long-tooth-rotor';
  escapeWheel.add(wheelRotor);

  // Brown's long teeth are slim, straight-tapering blades whose roots meet
  // in a triangular web round the hub. Each is one smooth outline: a
  // straight leading edge running just ahead of the centre (as Brown draws
  // it) and covering the inner pins, a straight trailing edge running back
  // to the next leg's leading edge at Brown's web corner, and a round end
  // tangent to the trailing edge. The working point is the corner where the
  // leading edge meets the round end on the tooth radius, so only that
  // corner meets D or E. Over its last 0.35 the leading edge turns through
  // a tangent arc (sagitta under 0.005, too slight to see) to a rake of
  // 0.085 at the point, against D's face's 0.067 in the tooth's frame, so it
  // falls away from the face faster than the face falls inboard; a straight
  // edge to the point would graze D at the drawn pose.
  const legRake = 0.085;
  const legStraightSlope = -0.02;
  const legBendLength = 0.35;
  const legTipRadius = 0.035;
  const legRootX = 0.08;
  const legLeadingY = (u) => {
    const k = (legStraightSlope - legRake) / (2 * legBendLength);
    if (u <= legBendLength) return legRake * u + k * u * u;
    return (legRake + legStraightSlope) * legBendLength / 2 + legStraightSlope * (u - legBendLength);
  };
  // The trailing root lies on the next leg's leading edge, 0.45 from the
  // centre (Brown's web corner).
  const legTrailRoot = rotate2(new THREE.Vector2(0.45, legLeadingY(longToothRadius - 0.45)), toothPitch).toArray();
  const legOutline = (() => {
    const leading = [];
    for (let i = 0; i <= 60; i += 1) {
      const x = legRootX + (longToothRadius - legRootX) * i / 60;
      leading.push([x, legLeadingY(longToothRadius - x)]);
    }
    // Round end: centre on the tooth radius, so the end leaves the working
    // corner square to the radius and never reaches past it.
    const cx = longToothRadius - legTipRadius;
    const [tx, ty] = legTrailRoot;
    const dx = tx - cx, dy = ty;
    const d = Math.hypot(dx, dy);
    // Tangent from the trailing root to the tip circle, on the +y side.
    const tangentAngle = Math.atan2(dy, dx) - Math.acos(legTipRadius / d);
    const end = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = tangentAngle * i / 24;
      end.push([cx + legTipRadius * Math.cos(a), legTipRadius * Math.sin(a)]);
    }
    return [...leading, ...end.slice(1), legTrailRoot];
  })();
  // The wedge cuts through the root disc can leave zero-area slivers.
  const ringArea = (ring) => Math.abs(ring.reduce((sum, [x0, y0], i) => {
    const [x1, y1] = ring[(i + 1) % ring.length];
    return sum + x0 * y1 - x1 * y0;
  }, 0) / 2);
  const dropSlivers = (multi) => multi
    .filter(([outer]) => ringArea(outer) > 1e-8)
    .map(([outer, ...holes]) => [outer, ...holes.filter((hole) => ringArea(hole) > 1e-8)]);
  const spear = (angle) => poly(legOutline.map(([x, y]) => rotate2(new THREE.Vector2(x, y), angle).toArray()));
  const wheelOutline = clip.difference(
    // The leg roots meet in Brown's triangular web (corners at the trailing
    // roots) round a disc under the hub, so the wheel is one solid outline.
    clip.union(
      poly(circle([0, 0], 0.19, 96)),
      poly(Array.from({ length: toothCount }, (_, index) => rotate2(new THREE.Vector2(...legTrailRoot), index * toothPitch).toArray())),
      ...Array.from({ length: toothCount }, (_, index) => spear(index * toothPitch)),
    ),
    poly(circle([0, 0], arborRadius + 0.0015, 64)),
  );
  const wedge = (angle) => poly([
    [0, 0],
    ...Array.from({ length: 13 }, (_, index) => {
      const a = angle - Math.PI / 6 + toothPitch * index / 12;
      return [3 * Math.cos(a), 3 * Math.sin(a)];
    }),
  ]);
  // Brown's crescents on the leg roots are these pins seen end-on: each is a
  // circular segment (a flat chord and a shallow arc) whose sharp chord end
  // is the working edge, outermost and most clockwise. The arc leaves that
  // edge sloping inward, so nothing trails outside it.
  const r = impulsePinOrbitRadius;
  const pinChordEnd = [r - 0.13, 0.085];
  const pinSection = (() => {
    const [ax, ay] = [r, 0], [bx, by] = pinChordEnd;
    const chord = Math.hypot(bx - ax, by - ay);
    const halfAngle = THREE.MathUtils.degToRad(40);
    const radius = chord / 2 / Math.sin(halfAngle);
    // Centre on the left of the chord (a to b), so the arc bulges right,
    // away from the wheel centre's side.
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const nx = -(by - ay) / chord, ny = (bx - ax) / chord;
    const offset = radius * Math.cos(halfAngle);
    const cx = mx + nx * offset, cy = my + ny * offset;
    const start = Math.atan2(ay - cy, ax - cx);
    const points = [];
    for (let i = 0; i <= 16; i += 1) {
      const angle = start + 2 * halfAngle * i / 16;
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    points[0] = [ax, ay];
    points[16] = [bx, by];
    return points;
  })();
  // The pins pass right through the leg and stand just proud of its face.
  const impulsePinFrontZ = lockPlaneZ + wheelDepth / 2 + 0.012;
  const longToothMeshes = [];
  const impulsePins = [];
  for (let index = 0; index < toothCount; index += 1) {
    const longTooth = new THREE.Mesh(
      platePrism(
        dropSlivers(clip.intersection(wheelOutline, wedge(index * toothPitch))),
        lockPlaneZ - wheelDepth / 2,
        lockPlaneZ + wheelDepth / 2,
      ),
      wheelMaterial,
    );
    longTooth.userData.index = index;
    longTooth.userData.role = 'long-outer-locking-tooth-only';
    wheelRotor.add(longTooth);
    longToothMeshes.push(longTooth);

    const pin = new THREE.Mesh(
      platePrism(
        poly(pinSection.map(([x, y]) => rotate2(
          new THREE.Vector2(x, y),
          index * toothPitch + phi0,
        ).toArray())),
        impulsePinBackZ,
        impulsePinFrontZ,
      ),
      impulsePinMaterial,
    );
    pin.userData.index = index;
    pin.userData.pointsBackward = true;
    pin.userData.role = 'short-inner-backward-pointing-impulse-pin';
    wheelRotor.add(pin);
    impulsePins.push(pin);
  }
  const wheelHub = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -wheelDepth / 2 - 0.03, radial: 0.19 },
      { axial: wheelDepth / 2 + 0.03, radial: 0.19 },
    ], arborRadius + 0.0015, 64),
    darkMaterial,
  );
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.position.z = lockPlaneZ;
  wheelHub.userData.role = 'common-two-plane-three-leg-hub';
  wheelRotor.add(wheelHub);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 16, 12),
    markerMaterial,
  );
  contactMarker.userData.role = 'active-long-tooth-or-inner-pin-contact';
  contactMarker.visible = false;
  root.add(contactMarker);

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.palletAngle;
    wheelRotor.rotation.z = state.wheelAngle;
    // Diagnostic only: the marker would sit inside both working solids.
    contactMarker.visible = false;
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
    stopD,
    stopE,
    wheelHub,
    wheelRotor,
  };
  root.userData.beatEvents = law.patterns.map((pattern) => ({
    contact: pattern.contact,
    impulseEnd: pattern.impulseEnd,
    impulseFace: pattern.impulse.face,
    landing: pattern.landing,
    landingCover: pattern.landingCover,
    nextFace: pattern.next.face,
    restFace: pattern.rest.face,
    restRelease: pattern.restRelease,
  }));
  root.userData.lawTimeOrigin = timeOrigin;
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    arborRadius,
    centerDistance,
    contactMarkerZ,
    deadStopRadius,
    deadStopRadiusE,
    freeDropAcceleration,
    halfBeatDuration,
    impulseCornerY,
    impulsePinBackZ,
    impulsePinLength,
    impulsePinOrbitRadius,
    impulsePinPhaseOffset,
    impulsePlaneZ,
    lockAngle,
    lockPlaneZ,
    lockRelease,
    longToothRadius,
    openingHalfHeight,
    openingHalfLength,
    palletDepth,
    palletPivot: palletPivot.clone(),
    pendulumAmplitude,
    pendulumPeriod,
    plateCenterLocal: plateCenterLocal.clone(),
    plateSwing,
    sourceAlignmentAngle,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    stopInnerX,
    stopLength,
    toothCount,
    toothPitch,
    wheelAdvancePerBeat,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
  };
  root.userData.faceAngle = law.faceAngle;
  root.userData.impulsePinCenterAt = impulsePinCenterAt;
  root.userData.longToothTipAt = longToothTipAt;
  root.userData.mechanism = 'Beckett’s long-stopping-tooth refinement of the three-legged dead escapement: three long front teeth lock alternately on dead stops D and E concentric with the pendulum pivot, while three short sharp-edged pins pointing backward from the wheel act only on hardened pallets A and B at the steps of the plate opening.';
  root.userData.palletFaces = {
    A: {
      axialPlaneZ: impulsePlaneZ,
      function: 'impulse only',
      position: 'upper step of the opening, right of the wheel centre line',
      role: faces.A.role,
    },
    B: {
      axialPlaneZ: impulsePlaneZ,
      function: 'impulse only',
      position: 'lower step of the opening, left of the wheel centre line',
      role: faces.B.role,
    },
    D: {
      axialPlaneZ: lockPlaneZ,
      function: 'dead locking only',
      position: 'outer left',
      radiusFromPalletPivot: deadStopRadius,
      role: faces.D.role,
    },
    E: {
      axialPlaneZ: lockPlaneZ,
      function: 'dead locking only',
      position: 'outer right',
      radiusFromPalletPivot: deadStopRadiusE,
      role: faces.E.role,
    },
  };
  root.userData.palletPlateLocalPoint = palletPlateLocalPoint;
  root.userData.palletPlateWorldPoint = palletPlateWorldPoint;
  root.userData.presentation = 'front elevation of the bottle plate with the long-tooth wheel in front and its pins reaching back into the opening';
  root.userData.reconstructionNote = 'The long teeth rest on stops D and E, which are arcs about the pendulum pivot (no recoil); the backward pins give impulse on pallets A and B at the steps of the opening. The wheel moves only as the finite faces allow: impulse and rest follow contact, and the wheel falls freely between faces. Pendulum motion is prescribed; no force or energy balance is solved.';
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
      'upper-pin-direct-impulse-on-A',
      'free-drop-to-left-long-tooth-on-D',
      'left-long-tooth-dead-lock-on-D',
      'free-drop-to-lower-pin-on-B',
      'lower-pin-direct-impulse-on-B',
      'free-drop-to-right-long-tooth-on-E',
      'right-long-tooth-dead-lock-on-E',
      'free-drop-to-upper-pin-on-A',
    ],
  };
  root.userData.transmission = {
    axialSystems: 2,
    clearance: 'the wheel falls freely between each pin impulse and the next lock and between each unlocking and the next impulse; drops end in impact',
    direction: 'clockwise',
    impulsePinCount: 3,
    impulseSystem: 'three short backward-pointing sharp-edged pins act only on A/B',
    lockingToothCount: 3,
    lockSystem: 'three long outer teeth act only on dead stops D/E',
    recoil: 'none while D or E is engaged (faces concentric with the pendulum pivot)',
    wheelAdvancePerBeatRadians: wheelAdvancePerBeat,
  };
  root.userData.wheelAngleAtBeatStart = wheelAngleAtBeatStart;
  root.userData.workingPartsReview = {
    contactMarkersSuppressed: true,
    qualification: 'Finite faces select every event of the wheel law; the pendulum is prescribed and forces are not solved.',
    scope: 'Long teeth on concentric D/E, sharp pins on stepped A/B, bored hub, pivot eye and plate on fixed arbors.',
  };

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
  contactMarker.castShadow = false;
  contactMarker.receiveShadow = false;
  return {
    cameraDirection: new THREE.Vector3(2.0, 1.2, 13.8),
    root,
    update,
  };
}

export function createAuthoredThreeLeggedEscapementMovement(movement) {
  switch (movement.id) {
    case 306: return finishPinEscapement(threeLeggedDeadEscapement(movement));
    case 307: {
      const model = finishPinEscapement(longStoppingToothEscapement(movement));
      // Frame Brown's crop: the complete neck runs on up to the suspension.
      const bounds = model.root.userData.cameraFitBounds;
      bounds.max.y = Math.min(bounds.max.y, 3.55);
      return model;
    }
    default: return null;
  }
}
