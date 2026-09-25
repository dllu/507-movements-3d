import {finishParsons394} from './reversing-transmission-working-parts.js';
import * as THREE from 'three';
import {circle, plate, poly, polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.006) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 12,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function stadiumFrameAtDistance(distance, halfStraight, halfHeight) {
  const straightLength = 2 * halfStraight;
  const arcLength = Math.PI * halfHeight;
  const perimeter = 2 * straightLength + 2 * arcLength;
  let s = positiveModulo(distance, perimeter);
  let point;
  let tangent;
  if (s < straightLength) {
    point = new THREE.Vector2(halfStraight - s, halfHeight);
    tangent = new THREE.Vector2(-1, 0);
  } else if ((s -= straightLength) < arcLength) {
    const angle = Math.PI / 2 + s / halfHeight;
    point = new THREE.Vector2(
      -halfStraight + halfHeight * Math.cos(angle),
      halfHeight * Math.sin(angle),
    );
    tangent = new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
  } else if ((s -= arcLength) < straightLength) {
    point = new THREE.Vector2(-halfStraight + s, -halfHeight);
    tangent = new THREE.Vector2(1, 0);
  } else {
    s -= straightLength;
    const angle = -Math.PI / 2 + s / halfHeight;
    point = new THREE.Vector2(
      halfStraight + halfHeight * Math.cos(angle),
      halfHeight * Math.sin(angle),
    );
    tangent = new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
  }
  return {
    inwardNormal: new THREE.Vector2(-tangent.y, tangent.x),
    perimeter,
    point,
    tangent,
  };
}

class StadiumCurve extends THREE.Curve {
  constructor(halfStraight, halfHeight, z) {
    super();
    this.halfStraight = halfStraight;
    this.halfHeight = halfHeight;
    this.perimeter = 4 * halfStraight + FULL_TURN * halfHeight;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const frame = stadiumFrameAtDistance(
      parameter * this.perimeter,
      this.halfStraight,
      this.halfHeight,
    );
    return target.set(frame.point.x, frame.point.y, this.z);
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }

  getTangent(parameter, target = new THREE.Vector3()) {
    const frame = stadiumFrameAtDistance(
      parameter * this.perimeter,
      this.halfStraight,
      this.halfHeight,
    );
    return target.set(frame.tangent.x, frame.tangent.y, 0);
  }

  getTangentAt(parameter, target = new THREE.Vector3()) {
    return this.getTangent(parameter, target);
  }

  getLength() {
    return this.perimeter;
  }

  getLengths(divisions = 200) {
    return Array.from(
      { length: divisions + 1 },
      (_, index) => this.perimeter * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

class PlanarArcCurve3 extends THREE.Curve {
  constructor(center, radius, startAngle, sweep, z) {
    super();
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.sweep = sweep;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      this.center.x + this.radius * Math.cos(angle),
      this.center.y + this.radius * Math.sin(angle),
      this.z,
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }
}

function makeEndlessRack({
  circularPitch,
  darkMaterial,
  depth,
  frameMaterial,
  halfHeight,
  halfStraight,
  toothCount,
  toothHeight,
  toothMaterial,
  whiteMaterial,
}) {
  const rack = new THREE.Group();
  rack.userData.role =
    'rigid-reciprocating-oblong-endless-internal-rack';
  const pitchCurve = new StadiumCurve(halfStraight, halfHeight, 0);
  const outerCurve = new StadiumCurve(
    halfStraight,
    halfHeight + toothHeight + 0.16,
    -0.03,
  );
  const outerRim = new THREE.Mesh(
    new THREE.TubeGeometry(outerCurve, 196, 0.13, 12, true),
    frameMaterial,
  );
  outerRim.userData.role = 'closed-oblong-body-of-endless-rack';
  rack.add(outerRim);
  const rearTopWeb = new THREE.Mesh(
    new THREE.BoxGeometry(halfStraight * 2, 0.16, depth * 0.72),
    frameMaterial,
  );
  rearTopWeb.position.set(0, halfHeight + toothHeight + 0.11, -0.03);
  rearTopWeb.userData.role = 'upper-straight-web-of-endless-rack';
  rack.add(rearTopWeb);
  const rearBottomWeb = rearTopWeb.clone();
  rearBottomWeb.position.y *= -1;
  rearBottomWeb.userData.role = 'lower-straight-web-of-endless-rack';
  rack.add(rearBottomWeb);

  const toothGeometry = new THREE.BoxGeometry(
    circularPitch * 0.57,
    toothHeight,
    depth,
  );
  const teeth = [];
  const toothFrames = [];
  for (let index = 0; index < toothCount; index += 1) {
    const distance = (index + 0.5) * circularPitch;
    const frame = stadiumFrameAtDistance(
      distance,
      halfStraight,
      halfHeight,
    );
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    tooth.position.set(frame.point.x, frame.point.y, 0.03);
    tooth.rotation.z = Math.atan2(frame.tangent.y, frame.tangent.x);
    tooth.userData.index = index;
    tooth.userData.pitchDistance = distance;
    tooth.userData.role =
      'inward-facing-tooth-of-closed-endless-rack';
    rack.add(tooth);
    teeth.push(tooth);
    toothFrames.push(frame);
  }

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.44, 0.040),
    whiteMaterial,
  );
  translationIndex.position.set(
    halfStraight + halfHeight + toothHeight + 0.13,
    0,
    depth / 2 + 0.08,
  );
  translationIndex.userData.role =
    'white-index-showing-rack-reciprocation-and-small-cross-shift';
  rack.add(translationIndex);

  const inputRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 2.25, 24),
    darkMaterial,
  );
  inputRod.rotation.z = Math.PI / 2;
  inputRod.position.x = halfStraight + halfHeight + 1.14;
  inputRod.userData.role =
    'reciprocating-input-rod-rigid-with-endless-rack';
  rack.add(inputRod);
  const pistonHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.24, 36),
    frameMaterial,
  );
  pistonHead.rotation.z = Math.PI / 2;
  pistonHead.position.x = halfStraight + halfHeight + 2.20;
  pistonHead.userData.role = 'input-rod-end-collar';
  rack.add(pistonHead);

  rack.userData.inputRod = inputRod;
  rack.userData.outerRim = outerRim;
  rack.userData.pitchCurve = pitchCurve;
  rack.userData.pistonHead = pistonHead;
  rack.userData.teeth = teeth;
  rack.userData.toothFrames = toothFrames;
  rack.userData.translationIndex = translationIndex;
  return markShadows(rack);
}

function makePinionAndFlanges({
  darkMaterial,
  depth,
  gearMaterial,
  largeFlangeRadius,
  largePlaneZ,
  pitchRadius,
  smallFlangeRadius,
  smallPlaneZ,
  toothCount,
  toothHeight,
  whiteMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.role =
    'fixed-axis-pinion-with-two-fast-concentric-unequal-guide-flanges';
  const angularPitch = FULL_TURN / toothCount;
  const rootRadius = pitchRadius - toothHeight / 2;
  const outerRadius = pitchRadius + toothHeight / 2;
  const shape = new THREE.Shape();
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const [offset, radius] of [
      [-0.50, rootRadius],
      [-0.27, outerRadius],
      [0.27, outerRadius],
      [0.50, rootRadius],
    ]) {
      const angle = (tooth + offset) * angularPitch;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const pinion = new THREE.Mesh(
    centeredExtrusion(shape, depth, 0.007),
    gearMaterial,
  );
  pinion.position.z = 0.09;
  pinion.userData.role = 'fourteen-tooth-output-pinion';
  rotor.add(pinion);
  const hub = cylinderAlongZ(0.18, 1.55, darkMaterial, 32);
  hub.position.z = 0.10;
  hub.userData.role = 'output-shaft-hub-fast-with-pinion-and-flanges';
  rotor.add(hub);
  const shaft = cylinderAlongZ(0.095, 2.02, darkMaterial, 28);
  shaft.position.z = 0.10;
  shaft.userData.role = 'fixed-center-output-shaft';
  rotor.add(shaft);

  const largeFlange = cylinderAlongZ(
    largeFlangeRadius,
    0.11,
    gearMaterial,
    52,
  );
  largeFlange.position.z = largePlaneZ;
  largeFlange.userData.role =
    'larger-concentric-flange-driving-one-pitch-right-handoff';
  rotor.add(largeFlange);

  const smallFlange = cylinderAlongZ(
    smallFlangeRadius,
    0.12,
    gearMaterial,
    40,
  );
  smallFlange.position.z = smallPlaneZ;
  smallFlange.userData.role =
    'smaller-concentric-flange-driving-three-pitch-left-handoff';
  rotor.add(smallFlange);

  const spinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pitchRadius * 0.58, 0.055, 0.036),
    whiteMaterial,
  );
  spinIndex.position.set(pitchRadius * 0.34, 0, smallPlaneZ + 0.15);
  spinIndex.userData.role =
    'white-index-making-unidirectional-pinion-spin-legible';
  rotor.add(spinIndex);

  rotor.userData.angularPitch = angularPitch;
  rotor.userData.hub = hub;
  rotor.userData.largeFlange = largeFlange;
  rotor.userData.outerRadius = outerRadius;
  rotor.userData.pinion = pinion;
  rotor.userData.pitchRadius = pitchRadius;
  rotor.userData.rootRadius = rootRadius;
  rotor.userData.shaft = shaft;
  rotor.userData.smallFlange = smallFlange;
  rotor.userData.spinIndex = spinIndex;
  rotor.userData.toothCount = toothCount;
  return markShadows(rotor);
}

function makeCrossoverGroove({
  center,
  centerRadius,
  flangeRadius,
  frameMaterial,
  name,
  startAngle,
  sweep,
  z,
}) {
  const groove = new THREE.Group();
  groove.userData.role = `${name}-side-groove-for-concentric-flange`;
  const outerRadius = centerRadius + flangeRadius;
  const innerRadius = Math.abs(flangeRadius - centerRadius);
  const outerRailCurve = new PlanarArcCurve3(
    center,
    outerRadius,
    startAngle,
    sweep,
    z,
  );
  const innerStartAngle = flangeRadius > centerRadius
    ? startAngle + Math.PI
    : startAngle;
  const innerRailCurve = new PlanarArcCurve3(
    center,
    innerRadius,
    innerStartAngle,
    sweep,
    z,
  );
  const rails = [outerRailCurve, innerRailCurve].map((curve, index) => {
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 72, 0.055, 10, false),
      frameMaterial,
    );
    rail.userData.edge = index === 0 ? 'outer' : 'inner';
    rail.userData.role = `${name}-groove-${rail.userData.edge}-wall`;
    groove.add(rail);
    return rail;
  });
  groove.userData.center = center.clone();
  groove.userData.centerRadius = centerRadius;
  groove.userData.flangeRadius = flangeRadius;
  groove.userData.innerRadius = innerRadius;
  groove.userData.outerRadius = outerRadius;
  groove.userData.rails = rails;
  return markShadows(groove);
}

function parsonsEndlessRackDrive(movement) {
  const root = new THREE.Group();

  // Movement 394 has no official animation.  The phase allocation below is
  // engineered from the stated topology: the straight internal rack runs
  // each advance five tooth pitches, while unequal coaxial flanges roll in
  // the two side grooves to carry one and three tooth phases respectively.
  const pinionToothCount = 14;
  const pinionPitchRadius = 0.72;
  const pinionAngularPitch = FULL_TURN / pinionToothCount;
  const circularPitch = pinionPitchRadius * pinionAngularPitch;
  const workingPitchesPerStroke = 5;
  const workingStroke = workingPitchesPerStroke * circularPitch;
  const guideHalfStraight = workingStroke / 2;
  const crossShiftRadius = 0.10;
  const largeHandoffPitches = 1;
  const smallHandoffPitches = 3;
  const largeFlangeRadius = crossShiftRadius * pinionToothCount
    / (2 * largeHandoffPitches);
  const smallFlangeRadius = crossShiftRadius * pinionToothCount
    / (2 * smallHandoffPitches);
  const rackPitchHalfHeight = pinionPitchRadius + crossShiftRadius;
  const endlessRackToothCount = 46;
  const rackHalfStraight = (
    endlessRackToothCount * circularPitch
      - FULL_TURN * rackPitchHalfHeight
  ) / 4;
  const toothHeight = 0.22;
  const rackDepth = 0.34;
  const cycleDuration = 8;
  const topEnd = 0.38;
  const largeCrossoverEnd = 0.50;
  const bottomEnd = 0.88;
  const largePlaneZ = -0.42;
  const smallPlaneZ = 0.62;
  const outputAdvancePerCycle = (
    2 * workingPitchesPerStroke
      + largeHandoffPitches + smallHandoffPitches
  ) * pinionAngularPitch;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const driverDarkMaterial = matte(0xb84431, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.45,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const phaseState = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    let stage;
    let progress;
    let motion;
    let relativeShaftCenter;
    let relativeCenterDerivativeByProgress;
    let outputWithinCycle;
    let outputDerivativeByProgress;
    let activeRadius;
    if (phase < topEnd) {
      stage = 'upper-internal-rack-working-left-stroke';
      progress = phase / topEnd;
      motion = quinticState(progress);
      relativeShaftCenter = new THREE.Vector2(
        -guideHalfStraight + workingStroke * motion.value,
        crossShiftRadius,
      );
      relativeCenterDerivativeByProgress = new THREE.Vector2(
        workingStroke * motion.rate,
        0,
      );
      outputWithinCycle = workingPitchesPerStroke
        * pinionAngularPitch * motion.value;
      outputDerivativeByProgress = workingPitchesPerStroke
        * pinionAngularPitch * motion.rate;
      activeRadius = pinionPitchRadius;
    } else if (phase < largeCrossoverEnd) {
      stage = 'right-groove-large-flange-one-pitch-handoff';
      progress = (phase - topEnd) / (largeCrossoverEnd - topEnd);
      motion = quinticState(progress);
      const angle = Math.PI / 2 - Math.PI * motion.value;
      relativeShaftCenter = new THREE.Vector2(
        guideHalfStraight + crossShiftRadius * Math.cos(angle),
        crossShiftRadius * Math.sin(angle),
      );
      relativeCenterDerivativeByProgress = new THREE.Vector2(
        Math.PI * crossShiftRadius * Math.sin(angle) * motion.rate,
        -Math.PI * crossShiftRadius * Math.cos(angle) * motion.rate,
      );
      outputWithinCycle = (
        workingPitchesPerStroke
          + largeHandoffPitches * motion.value
      ) * pinionAngularPitch;
      outputDerivativeByProgress = largeHandoffPitches
        * pinionAngularPitch * motion.rate;
      activeRadius = largeFlangeRadius;
    } else if (phase < bottomEnd) {
      stage = 'lower-internal-rack-working-right-stroke';
      progress = (phase - largeCrossoverEnd)
        / (bottomEnd - largeCrossoverEnd);
      motion = quinticState(progress);
      relativeShaftCenter = new THREE.Vector2(
        guideHalfStraight - workingStroke * motion.value,
        -crossShiftRadius,
      );
      relativeCenterDerivativeByProgress = new THREE.Vector2(
        -workingStroke * motion.rate,
        0,
      );
      outputWithinCycle = (
        workingPitchesPerStroke + largeHandoffPitches
          + workingPitchesPerStroke * motion.value
      ) * pinionAngularPitch;
      outputDerivativeByProgress = workingPitchesPerStroke
        * pinionAngularPitch * motion.rate;
      activeRadius = pinionPitchRadius;
    } else {
      stage = 'left-groove-small-flange-three-pitch-handoff';
      progress = (phase - bottomEnd) / (1 - bottomEnd);
      motion = quinticState(progress);
      const angle = -Math.PI / 2 - Math.PI * motion.value;
      relativeShaftCenter = new THREE.Vector2(
        -guideHalfStraight + crossShiftRadius * Math.cos(angle),
        crossShiftRadius * Math.sin(angle),
      );
      relativeCenterDerivativeByProgress = new THREE.Vector2(
        Math.PI * crossShiftRadius * Math.sin(angle) * motion.rate,
        -Math.PI * crossShiftRadius * Math.cos(angle) * motion.rate,
      );
      outputWithinCycle = (
        2 * workingPitchesPerStroke + largeHandoffPitches
          + smallHandoffPitches * motion.value
      ) * pinionAngularPitch;
      outputDerivativeByProgress = smallHandoffPitches
        * pinionAngularPitch * motion.rate;
      activeRadius = smallFlangeRadius;
    }
    const phaseWidth = stage === 'upper-internal-rack-working-left-stroke'
      ? topEnd
      : stage === 'right-groove-large-flange-one-pitch-handoff'
        ? largeCrossoverEnd - topEnd
        : stage === 'lower-internal-rack-working-right-stroke'
          ? bottomEnd - largeCrossoverEnd
          : 1 - bottomEnd;
    const relativeCenterVelocity = relativeCenterDerivativeByProgress
      .multiplyScalar(1 / (phaseWidth * cycleDuration));
    const rackVelocity = relativeCenterVelocity.clone().multiplyScalar(-1);
    const rackPosition = relativeShaftCenter.clone().multiplyScalar(-1);
    const outputAngularSpeed = outputDerivativeByProgress
      / (phaseWidth * cycleDuration);
    return {
      activeRadius,
      outputAngularSpeed,
      outputWithinCycle,
      phase,
      progress,
      rackPosition,
      rackVelocity,
      relativeCenterSpeed: relativeCenterVelocity.length(),
      relativeCenterVelocity,
      relativeShaftCenter,
      stage,
    };
  };

  const rackCarrier = makeEndlessRack({
    circularPitch,
    darkMaterial,
    depth: rackDepth,
    frameMaterial: driverMaterial,
    halfHeight: rackPitchHalfHeight,
    halfStraight: rackHalfStraight,
    toothCount: endlessRackToothCount,
    toothHeight,
    toothMaterial: driverDarkMaterial,
    whiteMaterial,
  });
  root.add(rackCarrier);

  const largeGroove = makeCrossoverGroove({
    center: new THREE.Vector2(guideHalfStraight, 0),
    centerRadius: crossShiftRadius,
    flangeRadius: largeFlangeRadius,
    frameMaterial: darkMaterial,
    name: 'right-large-flange',
    startAngle: Math.PI / 2,
    sweep: -Math.PI,
    z: largePlaneZ,
  });
  const smallGroove = makeCrossoverGroove({
    center: new THREE.Vector2(-guideHalfStraight, 0),
    centerRadius: crossShiftRadius,
    flangeRadius: smallFlangeRadius,
    frameMaterial: darkMaterial,
    name: 'left-small-flange',
    startAngle: -Math.PI / 2,
    sweep: -Math.PI,
    z: smallPlaneZ,
  });
  rackCarrier.add(largeGroove, smallGroove);

  const outputRotor = makePinionAndFlanges({
    darkMaterial,
    depth: 0.40,
    gearMaterial: drivenMaterial,
    largeFlangeRadius,
    largePlaneZ,
    pitchRadius: pinionPitchRadius,
    smallFlangeRadius,
    smallPlaneZ,
    toothCount: pinionToothCount,
    toothHeight,
    whiteMaterial,
  });
  root.add(outputRotor);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-output-bearing-and-reciprocating-rod-guide-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.35, 0.24, 1.92),
    frameMaterial,
  );
  base.position.set(0.72, -1.82, -0.30);
  base.userData.role = 'fixed-Parsons-device-machine-bed';
  fixedFrame.add(base);
  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 1.66, 0.32),
    frameMaterial,
  );
  bearingPost.position.set(0, -0.91, -0.82);
  bearingPost.userData.role = 'fixed-central-pinion-bearing-standard';
  fixedFrame.add(bearingPost);
  const rodGuide = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.74, 1.05),
    frameMaterial,
  );
  rodGuide.position.set(rackHalfStraight + rackPitchHalfHeight + 2.26,
    0, -0.13);
  rodGuide.userData.role = 'fixed-guide-for-reciprocating-input-rod';
  fixedFrame.add(rodGuide);
  root.add(markShadows(fixedFrame));

  const stateAtTime = (time) => {
    const cycles = Math.floor(time / cycleDuration);
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const phaseData = phaseState(phase);
    const outputAngle = cycles * outputAdvancePerCycle
      + phaseData.outputWithinCycle;
    const upperMeshActive = phaseData.stage
      === 'upper-internal-rack-working-left-stroke';
    const lowerMeshActive = phaseData.stage
      === 'lower-internal-rack-working-right-stroke';
    const largeFlangeActive = phaseData.stage
      === 'right-groove-large-flange-one-pitch-handoff';
    const smallFlangeActive = phaseData.stage
      === 'left-groove-small-flange-three-pitch-handoff';
    const activeRollingResidual = phaseData.relativeCenterSpeed
      - phaseData.activeRadius * phaseData.outputAngularSpeed;
    return {
      ...phaseData,
      activeRollingResidual,
      cycleTime,
      cycles,
      largeFlangeActive,
      lowerMeshActive,
      outputAngle,
      smallFlangeActive,
      upperMeshActive,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rackCarrier.position.set(
      state.rackPosition.x,
      state.rackPosition.y,
      0,
    );
    outputRotor.rotation.z = state.outputAngle;
    root.userData.contacts = {
      largeFlangeToRightSideGroove: {
        active: state.largeFlangeActive,
        centerError: state.largeFlangeActive
          ? state.relativeShaftCenter.clone().add(state.rackPosition).length()
          : null,
        rollingSpeedError: state.largeFlangeActive
          ? state.activeRollingResidual
          : null,
      },
      lowerRackToPinion: {
        active: state.lowerMeshActive,
        pitchLineVelocityError: state.lowerMeshActive
          ? state.rackVelocity.x
            - pinionPitchRadius * state.outputAngularSpeed
          : null,
      },
      smallFlangeToLeftSideGroove: {
        active: state.smallFlangeActive,
        centerError: state.smallFlangeActive
          ? state.relativeShaftCenter.clone().add(state.rackPosition).length()
          : null,
        rollingSpeedError: state.smallFlangeActive
          ? state.activeRollingResidual
          : null,
      },
      upperRackToPinion: {
        active: state.upperMeshActive,
        pitchLineVelocityError: state.upperMeshActive
          ? state.rackVelocity.x
            + pinionPitchRadius * state.outputAngularSpeed
          : null,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'parsons-oblong-endless-internal-rack-pinion-with-unequal-concentric-flange-groove-handoffs',
    blocks: {
      fixedFrame,
      largeGroove,
      outputRotor,
      rackCarrier,
      smallGroove,
    },
    constraintResiduals: {
      closedRackPitchPerimeter:
        4 * rackHalfStraight + FULL_TURN * rackPitchHalfHeight
          - endlessRackToothCount * circularPitch,
      largeFlangePitchHandoff:
        Math.PI * crossShiftRadius / largeFlangeRadius
          - largeHandoffPitches * pinionAngularPitch,
      outputCycleClosure: outputAdvancePerCycle - FULL_TURN,
      rackPinionPitchIdentity:
        circularPitch - pinionPitchRadius * pinionAngularPitch,
      smallFlangePitchHandoff:
        Math.PI * crossShiftRadius / smallFlangeRadius
          - smallHandoffPitches * pinionAngularPitch,
    },
    constraints: {
      endlessRack:
        'Forty-six equal-pitch inward teeth form one closed oblong rack, with upper and lower straight working runs joined by semicircular ends.',
      fixedOutput:
        'The fourteen-tooth pinion and both unequal concentric flanges are fast on one fixed-center output shaft.',
      handoff:
        'At each stroke reversal the straight teeth leave mesh at zero speed and one side groove carries its matching flange through the exact tooth phase needed by the opposite rack run.',
      sideGrooves:
        'Groove walls are offset from the shaft-center crossover locus by the radius of their matching concentric flange.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'small transverse rack shift at each reversal',
        'pinion/output angle',
        'large-flange right groove phase',
        'small-flange left groove phase',
      ],
      independentPrescribedInputs: 1,
      inputs: ['one closed reciprocating trajectory of the rack input rod'],
      note:
        'The output angle is selected by exactly one upper mesh, lower mesh, large-flange groove, or small-flange groove segment.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid rack, pinion, flanges, shaft, and frame',
        'common circular pitch and zero backlash on straight rack meshes',
        'no-slip rolling phase transfer in the side grooves',
        'quintic zero-speed acceleration at all four contact handoffs',
        'inertia, tooth compliance, friction losses, and oscillating-cylinder forces omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless kinematic reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      bottomEnd,
      circularPitch,
      crossShiftRadius,
      endlessRackToothCount,
      guideHalfStraight,
      largeCrossoverEnd,
      largeFlangeRadius,
      largeHandoffPitches,
      largePlaneZ,
      outputAdvancePerCycle,
      pinionAngularPitch,
      pinionPitchRadius,
      pinionToothCount,
      rackDepth,
      rackHalfStraight,
      rackPitchHalfHeight,
      smallFlangeRadius,
      smallHandoffPitches,
      smallPlaneZ,
      toothHeight,
      topEnd,
      workingPitchesPerStroke,
      workingStroke,
    },
    mechanism:
      'one-oblong-endless-internal-rack-reciprocates-around-one-fixed-axis-fourteen-tooth-pinion-with-upper-and-lower-straight-meshes-alternating-through-two-side-groove-handoffs-engaging-two-fast-concentric-flanges-of-different-diameters',
    motion: {
      inputCycleDuration: cycleDuration,
      outputDirection: 'counterclockwise only',
      outputTurnsPerReciprocation: 1,
      rackPath:
        'left on upper mesh, right large-flange crossover, right on lower mesh, left small-flange crossover',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 394 page marks Animated unavailable and contains no canvas model.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate394: {
        endlessRackApproximateBoundsPixels: [39, 199, 384, 328],
        imageHeight: 525,
        imageWidth: 525,
        inputRodCenterlinePixelsY: 271,
        measurementUncertaintyPixels: 10,
        pinionCenterPixels: [244, 254],
        pinionOuterRadiusPixels: 43,
        visibleInnerRackToothCountApproximate: 44,
      },
      constructionEvidence: {
        engravingEvidence:
          'The plate shows an oblong closed inward-toothed rack fixed to a right-hand reciprocating rod, one central pinion, and an irregular paired side-groove envelope surrounding the pinion shaft.',
        explicitInBrownDescription: [
          'C. Parsons patent device',
          'reciprocating motion converted into rotary',
          'one endless rack',
          'grooves on the rack side',
          'one pinion with two concentric flanges of different diameters',
          'substitute for a crank in an oscillating-cylinder engine',
        ],
        reconstructionDisclosure:
          'No official animation, dimensions, groove profile, or tooth-phase allocation is supplied. The one-plus-three-pitch unequal-flange handoffs are independently engineered and explicitly tested while preserving the stated topology and unidirectional conversion.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 394',
    },
    stateAtTime,
    timeline: {
      bottomRackWorking: [largeCrossoverEnd, bottomEnd],
      cycleDuration,
      largeFlangeCrossover: [topEnd, largeCrossoverEnd],
      smallFlangeCrossover: [bottomEnd, 1],
      topRackWorking: [0, topEnd],
    },
    transmission: {
      activeSequence:
        'upper rack:5 pitches -> large flange:1 pitch -> lower rack:5 pitches -> small flange:3 pitches',
      flangeLaw:
        'Delta theta = semicircular shaft-center travel / flange radius = pi*delta/r_flange',
      outputClosure:
        '(5+1+5+3)*(2*pi/14)=2*pi per reciprocation',
      rackMeshLaw:
        'upper: omega=-xDot/R; lower: omega=+xDot/R',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, -2.18, -1.18),
    new THREE.Vector3(5.85, 2.10, 1.22),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(8.2, 4.6, 12.8);
  root.userData.groundFloorY = -1.95;
  update(0);
  const finished = finishParsons394(root, update);
  addParsonsBackBar(root, frameMaterial);
  return finished;
}

// Pass 57: Brown draws no frame. The pinion shaft and the input rod are
// carried on one plain back bar behind the rack: a bored boss takes the rear
// end of the pinion shaft, a bracket standing forward from the bar carries a
// guide slotted for the rod's small transverse shift, and a pillar with a
// foot grounds the bar. The parts are added after the camera fit, so the
// default framing stays on Brown's subject.
function addParsonsBackBar(root, material) {
  const barFront = -0.93, barBack = -1.05, floorY = root.userData.groundFloorY;
  const guideX0 = 4.67, guideX1 = 4.89, rodShift = 0.10, rodRadius = 0.11;
  const parts = [];
  const add = (geometry, role) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;mesh.castShadow = true;mesh.receiveShadow = true;
    root.add(mesh);parts.push(mesh);
    return mesh;
  };
  const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
    .translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  add(box(-0.45, guideX1, -0.30, 0.30, barBack, barFront), 'fixed-back-bar-carrying-pinion-shaft-and-rod-guide');
  add(new THREE.LatheGeometry([new THREE.Vector2(0.096, 0), new THREE.Vector2(0.22, 0), new THREE.Vector2(0.22, 0.13), new THREE.Vector2(0.096, 0.13), new THREE.Vector2(0.096, 0)], 48)
    .rotateX(Math.PI / 2).translate(0, 0, barFront), 'fixed-bored-boss-for-pinion-shaft-rear-end');
  // Guide: a block round the rod with a vertical slot for the shift, on an
  // arm running back to the bar (shape x = -world z, shape y = world y).
  const slot = polygonClipping.union(
    ...[-rodShift, rodShift].map((y) => poly(circle([0, y], rodRadius + 0.005, 48))),
    poly([[-(rodRadius + 0.005), -rodShift], [rodRadius + 0.005, -rodShift], [rodRadius + 0.005, rodShift], [-(rodRadius + 0.005), rodShift]]));
  const guideShape = polygonClipping.difference(polygonClipping.union(
    poly([[-0.24, -0.42], [0.24, -0.42], [0.24, 0.42], [-0.24, 0.42]]),
    poly([[0.20, -0.16], [-barFront, -0.16], [-barFront, 0.16], [0.20, 0.16]])), slot);
  add(plate(guideShape, guideX0, guideX1).rotateY(Math.PI / 2), 'fixed-slotted-rod-guide-on-back-bar');
  add(box(2.10, 2.50, floorY + 0.10, -0.30, barBack, barFront), 'fixed-back-bar-pillar');
  add(box(1.85, 2.75, floorY, floorY + 0.10, barBack - 0.20, barFront + 0.20), 'fixed-back-bar-foot');
  root.userData.blocks.backBar = parts;
}

export function createAuthoredParsonsRackMovement(movement) {
  if (movement.id !== 394) return null;
  return parsonsEndlessRackDrive(movement);
}
