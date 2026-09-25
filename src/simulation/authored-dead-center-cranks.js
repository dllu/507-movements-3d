import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {boredJournal, fitPistonGuide} from './piston-guide-parts.js';
import {makeBoredLinkRod} from './bored-link-rod.js';
import {circle, plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';

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

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function capsuleHole(startX, endX, radius) {
  const hole = new THREE.Path();
  hole.moveTo(startX, -radius);
  hole.absarc(
    startX,
    0,
    radius,
    -Math.PI / 2,
    -Math.PI * 1.5,
    true,
  );
  hole.lineTo(endX, radius);
  hole.absarc(
    endX,
    0,
    radius,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  hole.lineTo(startX, -radius);
  hole.closePath();
  return hole;
}

function tangentSlideShape({
  halfHeight,
  halfLength,
  slotCenterX,
  slotHalfStraight,
  slotRadius,
}) {
  const cornerRadius = 0.09;
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength + cornerRadius, -halfHeight);
  shape.lineTo(halfLength - cornerRadius, -halfHeight);
  shape.quadraticCurveTo(
    halfLength,
    -halfHeight,
    halfLength,
    -halfHeight + cornerRadius,
  );
  shape.lineTo(halfLength, halfHeight - cornerRadius);
  shape.quadraticCurveTo(
    halfLength,
    halfHeight,
    halfLength - cornerRadius,
    halfHeight,
  );
  shape.lineTo(-halfLength + cornerRadius, halfHeight);
  shape.quadraticCurveTo(
    -halfLength,
    halfHeight,
    -halfLength,
    halfHeight - cornerRadius,
  );
  shape.lineTo(-halfLength, -halfHeight + cornerRadius);
  shape.quadraticCurveTo(
    -halfLength,
    -halfHeight,
    -halfLength + cornerRadius,
    -halfHeight,
  );
  shape.closePath();
  for (const centerX of [-slotCenterX, slotCenterX]) {
    shape.holes.push(capsuleHole(
      centerX - slotHalfStraight,
      centerX + slotHalfStraight,
      slotRadius,
    ));
  }
  return shape;
}

function extrudedMesh(shape, depth, material) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    bevelSegments: 2,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 24,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, material);
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

function makeVoluteRibbon({
  innerRadius,
  outerRadius,
  sampleCount,
  slideHalfHeight,
  slideRadius,
  turns,
  width,
}) {
  const positions = new Float32Array(sampleCount * 2 * 3);
  const normals = new Float32Array(sampleCount * 2 * 3);
  const indices = [];
  for (let index = 0; index < sampleCount - 1; index += 1) {
    const lowerLeft = index * 2;
    const lowerRight = lowerLeft + 1;
    const upperLeft = lowerLeft + 2;
    const upperRight = lowerLeft + 3;
    indices.push(
      lowerLeft,
      upperLeft,
      lowerRight,
      lowerRight,
      upperLeft,
      upperRight,
    );
  }
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);

  const centers = Array.from(
    { length: sampleCount },
    () => new THREE.Vector2(),
  );
  const spiralFraction = 0.91;
  const span = turns * FULL_TURN;
  const endAngle = Math.PI / 2;
  const startAngle = endAngle - span;

  const update = (advance) => {
    const twist = Math.asin(THREE.MathUtils.clamp(
      advance / outerRadius,
      -0.98,
      0.98,
    ));
    const outerEnd = new THREE.Vector2(
      -outerRadius * Math.sin(twist),
      outerRadius * Math.cos(twist),
    );
    const attachment = new THREE.Vector2(
      -advance,
      slideRadius - slideHalfHeight + 0.015,
    );
    for (let index = 0; index < sampleCount; index += 1) {
      const u = index / (sampleCount - 1);
      if (u <= spiralFraction) {
        const v = u / spiralFraction;
        const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, v);
        const angle = startAngle + span * v + twist * v ** 2;
        centers[index].set(
          radius * Math.cos(angle),
          radius * Math.sin(angle),
        );
      } else {
        centers[index].copy(outerEnd).lerp(
          attachment,
          (u - spiralFraction) / (1 - spiralFraction),
        );
      }
    }
    for (let index = 0; index < sampleCount; index += 1) {
      const previous = centers[Math.max(0, index - 1)];
      const next = centers[Math.min(sampleCount - 1, index + 1)];
      const tangentX = next.x - previous.x;
      const tangentY = next.y - previous.y;
      const inverseLength = 1 / Math.max(
        1e-12,
        Math.hypot(tangentX, tangentY),
      );
      const normalX = -tangentY * inverseLength;
      const normalY = tangentX * inverseLength;
      for (let side = 0; side < 2; side += 1) {
        const sign = side === 0 ? -1 : 1;
        const offset = (index * 2 + side) * 3;
        positions[offset] = centers[index].x + sign * width * normalX / 2;
        positions[offset + 1] = centers[index].y
          + sign * width * normalY / 2;
        positions[offset + 2] = 0;
        normals[offset] = 0;
        normals[offset + 1] = 0;
        normals[offset + 2] = 1;
      }
    }
    positionAttribute.needsUpdate = true;
    geometry.computeBoundingSphere();
    return {
      attachment,
      outerEnd,
      twist,
    };
  };

  const spring = new THREE.Mesh(
    geometry,
    matte(PALETTE.accent, {
      metalness: 0.32,
      roughness: 0.46,
      side: THREE.DoubleSide,
    }),
  );
  spring.userData.role =
    'volute-spring-B-anchored-to-faceplate-and-returning-tangent-slide';
  spring.userData.updateForAdvance = update;
  spring.userData.sampleCount = sampleCount;
  return spring;
}

function circleIntersectionForTreadle({
  pitmanLength,
  rearArmLength,
  treadlePivot,
  wrist,
}) {
  const delta = wrist.clone().sub(treadlePivot);
  const centerDistance = delta.length();
  const direction = delta.clone().multiplyScalar(1 / centerDistance);
  const along = (
    rearArmLength ** 2
    - pitmanLength ** 2
    + centerDistance ** 2
  ) / (2 * centerDistance);
  const transverseSquared = rearArmLength ** 2 - along ** 2;
  if (transverseSquared < -1e-10) {
    throw new Error('Brownell treadle circles do not intersect');
  }
  const transverse = Math.sqrt(Math.max(0, transverseSquared));
  const leftNormal = new THREE.Vector2(-direction.y, direction.x);
  const rearJoint = treadlePivot.clone()
    .addScaledVector(direction, along)
    .addScaledVector(leftNormal, transverse);
  return {
    centerDistance,
    rearJoint,
    transverse,
  };
}

function brownellDeadCenterCrank(movement) {
  const root = new THREE.Group();
  const wheelCenter = new THREE.Vector2(-0.22, 1.06);
  const wheelRadius = 1.62;
  // Plate proportions: the wrist sits about a third of the wheel radius from
  // the centre and the treadle's rear arm is roughly three wrist radii, so the
  // treadle rocks through a shallow ~36 degree arc about horizontal.
  const crankRadius = 0.45;
  const crossingLeadPhase = 0.04;
  const slideTravel = crankRadius * Math.tan(
    FULL_TURN * crossingLeadPhase,
  );
  const slideHalfLength = 1.18;
  const slideHalfHeight = 0.19;
  const slideDepth = 0.17;
  const slotCenterX = 0.72;
  const slotHalfStraight = 0.30;
  const slotRadius = 0.075;
  const guidePinRadius = 0.058;
  const treadlePivot = new THREE.Vector2(1.00, -2.19);
  const treadleRearArm = 1.50;
  const treadleForwardArm = 1.73;
  const pitmanLength = 3.34;
  const cycleDuration = 6;
  const springOuterRadius = 0.44;
  const springTurns = 1.6;
  const advanceStart = 0.82;
  const advanceEnd = 1 - crossingLeadPhase;
  const springReturnStart = crossingLeadPhase;
  const springReturnEnd = 0.16;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.56,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.65,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const base = beamBetween(
    new THREE.Vector3(-2.22, -2.72, -0.46),
    new THREE.Vector3(2.72, -2.72, -0.46),
    0.15,
    0.22,
    frameMaterial,
  );
  base.userData.role = 'fixed-floor-base';
  root.add(base);

  const wheelStand = beamBetween(
    new THREE.Vector3(-1.46, -2.67, -0.48),
    new THREE.Vector3(wheelCenter.x, wheelCenter.y-.26, -0.48),
    0.14,
    0.20,
    frameMaterial,
  );
  wheelStand.userData.role = 'fixed-wheel-shaft-standard';
  root.add(wheelStand);
  const treadleStand = beamBetween(
    new THREE.Vector3(1.72, -2.67, -0.48),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y-.20, -0.48),
    0.14,
    0.20,
    frameMaterial,
  );
  treadleStand.userData.role = 'fixed-treadle-pivot-standard';
  root.add(treadleStand);

  const wheelBearing = boredJournal(.24, .124, .60, inkMaterial);
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, -.44);
  wheelBearing.userData.role = 'fixed-faceplate-shaft-bearing';
  root.add(wheelBearing);
  const treadleBearing = boredJournal(.16, .094, .52, inkMaterial);
  treadleBearing.position.set(treadlePivot.x, treadlePivot.y, -0.13);
  treadleBearing.userData.role = 'fixed-treadle-fulcrum-bearing';
  root.add(treadleBearing);

  const faceplate = new THREE.Group();
  faceplate.position.set(wheelCenter.x, wheelCenter.y, 0);
  faceplate.userData.role =
    'single-rotating-flywheel-faceplate-carrying-tangent-slide';
  root.add(faceplate);

  const faceDisc = boredJournal(wheelRadius-.035,.124,.20,driverMaterial);
  faceDisc.position.z = 0.02;
  faceDisc.userData.role = 'rigid-flywheel-faceplate';
  faceplate.add(faceDisc);
  // The rounded rim is part of the flywheel, in the wheel's own colour.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius, 0.095, 12, 84),
    driverMaterial,
  );
  rim.position.z = 0.03;
  rim.userData.role = 'flywheel-rim';
  faceplate.add(rim);
  // Brown draws a plain faceplate with one inner turned ring, no spokes or
  // index: a low turned bead in the faceplate's colour, not an ink line.
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(wheelRadius * 0.74, 0.03, 8, 84),
    driverMaterial,
  );
  faceRing.position.z = 0.135;
  faceRing.userData.role = 'faceplate-inner-turned-ring';
  faceplate.add(faceRing);
  const hub = boredJournal(.28,.124,.18,inkMaterial);
  hub.position.z = .02;
  hub.userData.role = 'flywheel-hub';
  faceplate.add(hub);

  const voluteSpring = makeVoluteRibbon({
    innerRadius: 0.21,
    outerRadius: springOuterRadius,
    sampleCount: 96,
    slideHalfHeight,
    slideRadius: crankRadius,
    turns: springTurns,
    width: 0.075,
  });
  voluteSpring.position.z = .225;
  faceplate.add(voluteSpring);
  const springAnchor = cylinderAlongZ(.045,.15,inkMaterial);
  const anchorAngle = Math.PI/2-springTurns*FULL_TURN;
  springAnchor.position.set(.21*Math.cos(anchorAngle),.21*Math.sin(anchorAngle),.18);
  faceplate.add(springAnchor);
  const springSlideAttachment = cylinderAlongZ(.045,.14,inkMaterial);
  springSlideAttachment.position.set(0,crankRadius-slideHalfHeight+.015,.27);
  faceplate.add(springSlideAttachment);

  const tangentSlide = new THREE.Group();
  tangentSlide.position.set(0, crankRadius, 0.33);
  tangentSlide.userData.role =
    'tangent-slide-A-translating-only-along-faceplate-tangent';
  faceplate.add(tangentSlide);
  const slideBody = extrudedMesh(
    tangentSlideShape({
      halfHeight: slideHalfHeight,
      halfLength: slideHalfLength,
      slotCenterX,
      slotHalfStraight,
      slotRadius,
    }),
    slideDepth,
    drivenMaterial,
  );
  slideBody.userData.role =
    'rigid-slide-A-with-two-parallel-traverse-guide-slots';
  tangentSlide.add(slideBody);
  const slideStop = new THREE.Mesh(new THREE.BoxGeometry(.12,.18,.29),inkMaterial);
  slideStop.position.set(slideHalfLength+.06,crankRadius,.25);
  slideStop.userData.role='faceplate-stop-for-spring-returned-slide';
  faceplate.add(slideStop);
  const wristBoss = cylinderAlongZ(0.145, 0.26, drivenMaterial, 38);
  wristBoss.position.z = 0.06;
  wristBoss.userData.role = 'wrist-boss-rigidly-fixed-to-slide-A';
  tangentSlide.add(wristBoss);
  // The pin's rear end stops in front of spring B's plane (z .225).
  const wristPin = cylinderAlongZ(0.075, 0.94, inkMaterial, 32);
  wristPin.position.z = .39;
  wristPin.userData.role = 'crank-wrist-pin-fixed-on-tangent-slide';
  tangentSlide.add(wristPin);

  const guidePins = [-slotCenterX, slotCenterX].map((x, index) => {
    const pin = cylinderAlongZ(guidePinRadius, .52, whiteMaterial, 30);
    pin.position.set(x, crankRadius, .32);
    pin.userData.role =
      `faceplate-fixed-guide-pin-${index + 1}-through-slide-slot`;
    faceplate.add(pin);
    return pin;
  });

  const treadle = new THREE.Group();
  treadle.position.set(treadlePivot.x, treadlePivot.y, 0.34);
  treadle.userData.role =
    'single-pivot-foot-treadle-applying-pressure-through-pitman';
  root.add(treadle);
  const treadleBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      treadleRearArm + treadleForwardArm,
      0.13,
      0.15,
    ),
    drivenMaterial,
  );
  treadleBeam.position.x = (treadleRearArm - treadleForwardArm) / 2;
  const beamCenterX=treadleBeam.position.x;
  treadleBeam.geometry.dispose();
  treadleBeam.geometry=plate(clip.difference(poly([
    [-treadleForwardArm-beamCenterX,-.03],
    [treadleRearArm-beamCenterX,-.065],
    [treadleRearArm-beamCenterX,.065],
    [-treadleForwardArm-beamCenterX,.03],
  ]),poly(circle([-beamCenterX,0],.094,64))),-.075,.075);
  treadleBeam.userData.role = 'rigid-treadle-rocker';
  treadle.add(treadleBeam);
  const treadlePivotBoss = boredJournal(.18,.094,.38,inkMaterial);
  treadlePivotBoss.userData.role = 'treadle-fulcrum-boss';
  treadle.add(treadlePivotBoss);
  const rearJointBoss = cylinderAlongZ(.09, 1.02, whiteMaterial, 30);
  rearJointBoss.position.z = .25;
  rearJointBoss.position.x = treadleRearArm;
  rearJointBoss.userData.role = 'pitman-to-treadle-pin';
  treadle.add(rearJointBoss);

  const {rod: pitman, body: pitmanBar} = makeBoredLinkRod({
    bodyMaterial: drivenMaterial, depth: .12, length: pitmanLength,
    planeZ: 0, role: 'rigid-pitman-from-treadle-to-sliding-wrist',
    width: .115, boreRadius: .079, startBoreRadius: .094,
  });
  pitman.position.z = .82;
  root.add(pitman);
  const wheelShaft = cylinderAlongZ(.12, .90, inkMaterial);
  wheelShaft.position.set(wheelCenter.x,wheelCenter.y,-.35);
  root.add(wheelShaft);
  const treadleShaft = cylinderAlongZ(.09,.94,inkMaterial);
  treadleShaft.position.set(treadlePivot.x,treadlePivot.y,.05);
  root.add(treadleShaft);

  const slideLawAtPhase = (phase) => {
    const p = positiveModulo(phase, 1);
    if (p >= advanceStart && p < advanceEnd) {
      const width = advanceEnd - advanceStart;
      const motion = quinticState((p - advanceStart) / width);
      return {
        accelerationPerPhaseSquared: motion.acceleration / width ** 2,
        ratePerPhase: motion.rate / width,
        stage: 'treadle-pressure-advancing-tangent-slide',
        value: motion.value,
      };
    }
    if (p >= advanceEnd || p < springReturnStart) {
      return {
        accelerationPerPhaseSquared: 0,
        ratePerPhase: 0,
        stage: 'wrist-carried-past-upper-dead-center',
        value: 1,
      };
    }
    if (p < springReturnEnd) {
      const width = springReturnEnd - springReturnStart;
      const motion = quinticState((p - springReturnStart) / width);
      return {
        accelerationPerPhaseSquared: -motion.acceleration / width ** 2,
        ratePerPhase: -motion.rate / width,
        stage: 'volute-spring-return-to-stop',
        value: 1 - motion.value,
      };
    }
    return {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      stage: 'slide-held-against-stop',
      value: 0,
    };
  };

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const slideLaw = slideLawAtPhase(cyclePhase);
    const slideAdvance = slideTravel * slideLaw.value;
    const slideVelocity = slideTravel * slideLaw.ratePerPhase
      / cycleDuration;
    const faceplateAngle = FULL_TURN * cycleCoordinate;
    const cosine = Math.cos(faceplateAngle);
    const sine = Math.sin(faceplateAngle);
    const wristFaceLocal = new THREE.Vector2(-slideAdvance, crankRadius);
    const wristWorld = new THREE.Vector2(
      wheelCenter.x
        + wristFaceLocal.x * cosine
        - wristFaceLocal.y * sine,
      wheelCenter.y
        + wristFaceLocal.x * sine
        + wristFaceLocal.y * cosine,
    );
    const intersection = circleIntersectionForTreadle({
      pitmanLength,
      rearArmLength: treadleRearArm,
      treadlePivot,
      wrist: wristWorld,
    });
    const treadleRearVector = intersection.rearJoint.clone()
      .sub(treadlePivot);
    const treadleUnit = treadleRearVector.clone()
      .multiplyScalar(1 / treadleRearArm);
    const footTipWorld = treadlePivot.clone().addScaledVector(
      treadleUnit,
      -treadleForwardArm,
    );
    const pitmanVector = wristWorld.clone().sub(intersection.rearJoint);
    const pitmanAngle = Math.atan2(pitmanVector.y, pitmanVector.x);
    const treadleAngle = Math.atan2(treadleUnit.y, treadleUnit.x);
    const wristLeadAngle = Math.atan2(slideAdvance, crankRadius);
    const wristAngularSpeed = FULL_TURN / cycleDuration
      + crankRadius * slideVelocity
        / (crankRadius ** 2 + slideAdvance ** 2);
    const guidePinPositionsInSlide = guidePins.map((pin) => new THREE.Vector2(
      pin.position.x + slideAdvance,
      0,
    ));
    const pitmanLengthResidual = pitmanVector.length() - pitmanLength;
    const treadleRadiusResidual = treadleRearVector.length()
      - treadleRearArm;
    return {
      cycleCoordinate,
      cyclePhase,
      faceplateAngle,
      faceplateAngularSpeed: FULL_TURN / cycleDuration,
      footTipWorld,
      guidePinPositionsInSlide,
      pitmanAngle,
      pitmanLengthResidual,
      pitmanVector,
      rearJointWorld: intersection.rearJoint,
      slideAcceleration: slideTravel
        * slideLaw.accelerationPerPhaseSquared / cycleDuration ** 2,
      slideAdvance,
      slideLaw,
      slideVelocity,
      springDeflectionAngle: Math.asin(slideAdvance / springOuterRadius),
      springReturnActive:
        slideLaw.stage === 'volute-spring-return-to-stop',
      treadleAngle,
      treadleRadiusResidual,
      wristAngularSpeed,
      wristFaceLocal,
      wristLeadAngle,
      wristUnwrappedAngle:
        faceplateAngle + Math.PI / 2 + wristLeadAngle,
      wristWorld,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    faceplate.rotation.z = state.faceplateAngle;
    tangentSlide.position.x = -state.slideAdvance;
    springSlideAttachment.position.x = -state.slideAdvance;
    voluteSpring.userData.springState =
      voluteSpring.userData.updateForAdvance(state.slideAdvance);
    treadle.rotation.z = state.treadleAngle;
    pitman.position.set(
      state.rearJointWorld.x,
      state.rearJointWorld.y,
      .82,
    );
    pitman.rotation.z = state.pitmanAngle;
    root.userData.contacts = {
      guidePinsInTraverseSlots: state.guidePinPositionsInSlide.map(
        (position, index) => ({
          active: true,
          guidePin: index + 1,
          position,
          remainingTravelToForwardSlotEnd:
            slotHalfStraight - state.slideAdvance,
        }),
      ),
      pitmanToTreadle: {
        active: true,
        residual: state.pitmanLengthResidual,
      },
      slideToSpring: {
        active: true,
        advance: state.slideAdvance,
        returning: state.springReturnActive,
      },
    };
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  const conventionalDeadCenterWrist = new THREE.Vector2(
    wheelCenter.x,
    wheelCenter.y + crankRadius,
  );
  const sourcePitmanDirection = sourceState.pitmanVector.clone().normalize();
  const actualCrankVector = sourceState.wristWorld.clone().sub(wheelCenter);
  const conventionalCrankVector = conventionalDeadCenterWrist.clone()
    .sub(wheelCenter);
  const signedMomentArm = (crankVector, direction) => (
    crankVector.x * direction.y - crankVector.y * direction.x
  );

  root.userData = {
    archetype:
      'brownell-faceplate-tangent-slide-wrist-and-volute-spring-carrying-treadle-crank-past-dead-center',
    blocks: {
      base,
      faceplate,
      guidePins,
      pitman,
      tangentSlide,
      treadle,
      voluteSpring,
      wheelBearing,
      wheelStand,
      faceDisc, treadleBeam, treadlePivotBoss, slideStop, slideBody, wristPin, wristBoss, pitmanBar, rearJointBoss,
      wheelShaft, treadleShaft, treadleBearing, hub,
    },
    constraintResiduals: {
      sourcePitmanLength: sourceState.pitmanLengthResidual,
      sourceTreadleRadius: sourceState.treadleRadiusResidual,
    },
    constraints: {
      guide:
        'Two faceplate-fixed pins pass through parallel traverse slots, leaving slide A one tangential translation relative to the rotating faceplate.',
      pitman:
        'The wrist is rigidly fixed to A and the constant-length pitman joins it to the rear pin of one rigid pivoted treadle.',
      spring:
        'Volute spring B is anchored to the faceplate, deflects as A advances, and returns A to its stop only after the wrist crosses upper center.',
      wheel:
        'The flywheel, faceplate, guide pins, shaft, and spring inner anchor form one rotating body; there is no belt, gear, or second wheel drive.',
    },
    deadCenterDemonstration: {
      actualSourceMomentArm: signedMomentArm(
        actualCrankVector,
        sourcePitmanDirection,
      ),
      conventionalDeadCenterMomentArm: signedMomentArm(
        conventionalCrankVector,
        sourcePitmanDirection,
      ),
      crossingLeadPhase,
      explanation:
        'At the source pose the faceplate radius is vertical but the spring-loaded tangent slide holds the wrist forward of that radius. On the pressure stroke A advances until the wrist crosses upper center; B then returns A to the stop.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'tangent-slide advance relative to faceplate',
        'wrist position fixed on slide A',
        'treadle angle selected by rigid pitman circle closure',
      ],
      independentPrescribedInputs: 1,
      inputs: ['demonstration cycle phase representing repeated foot pressure'],
      note:
        'The historical source specifies event order but not force, inertia, dimensions, or timing; a smooth event-driven quasi-static cycle is prescribed.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid faceplate, slide, pins, wrist, pitman, treadle, and frame',
        'finite guide-slot and bored-joint running clearance',
        'volute spring deformation shown kinematically without a force law',
        'foot force, flywheel inertia, friction, impact, and bearing clearance omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless event-driven planar kinematic reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      crankRadius,
      guidePinRadius,
      pitmanLength,
      slideDepth,
      slideHalfHeight,
      slideHalfLength,
      slideTravel,
      slotCenterX,
      slotHalfStraight,
      slotRadius,
      treadleForwardArm,
      treadlePivot,
      treadleRearArm,
      wheelCenter,
      wheelRadius,
    },
    mechanism:
      'one-rotating-faceplate-carries-a-pin-guided-tangent-slide-A-whose-fixed-wrist-drives-one-rigid-pitman-and-pivoted-treadle-while-volute-spring-B-returns-the-slide-after-center-crossing',
    motion: {
      cycleDuration,
      eventPhases: {
        slideAdvance: [advanceStart, advanceEnd],
        springReturn: [springReturnStart, springReturnEnd],
        upperCenterCrossing: advanceEnd,
      },
      sequence:
        'slide on stop -> treadle pressure advances A and its wrist -> wrist crosses upper center -> spring B returns A to stop -> ordinary treadle rotation continues',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 401 page marks Animated unavailable and provides only Brown’s static engraving and operation sentence.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate401: {
        faceplateCenterApproximatePixels: [252, 183],
        guideSlotsApproximatePixels: [178, 218, 309, 339, 132],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
        tangentSlideApproximatePixels: [163, 346, 105, 153],
        treadlePivotApproximatePixels: [327, 461],
        wristApproximatePixels: [251, 119],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is a slotted slide carrying the wrist',
          'treadle pressure moves A forward with the wrist until the wrist passes center',
          'spring B then forces A against its stops',
        ],
        engravingEvidence:
          'The plate shows one flywheel face, a tangential two-slot carriage A around the wrist, two faceplate guide pins, a central volute spring B, one pitman, and one treadle.',
        reconstructionDisclosure:
          'Brown supplies no dimensions, spring law, force, speed, or event duration. The proportions are normalized from the plate and the smooth advance/return timing is independently synthesized while preserving the stated event order.',
      },
      historicalCorroboration: {
        citation:
          'Gardner D. Hiscox, Mechanical Movements, Powers, Devices and Appliances, movement 1113, page 274',
        operationalEvidence:
          'Hiscox identifies the wrist pin as fixed on a tangent slide, the slide as held by a volute spring attached to the faceplate, and the guide as pins retained in traverse slots.',
        url:
          'https://archive.org/details/mechanicalmovements00hiscrich/page/274/mode/2up',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 401',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      slideLaw:
        's(phi)=slideTravel times a smooth pressure-rise/center-dwell/spring-return law; wrist local coordinates on the faceplate are (-s, crankRadius)',
      treadleClosure:
        '|wrist-rearJoint|=pitmanLength and |rearJoint-treadlePivot|=rearArmLength, selecting the engraving-consistent left circle intersection',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.15, -2.78, -0.65),
    new THREE.Vector3(2.95, 2.78, 0.92),
  );
  root.userData.cameraDistanceScale = 1.09;
  root.userData.cameraDirection = new THREE.Vector3(1.1, .6, 14);
  root.userData.groundFloorY = -2.73;
  markShadows(root);
  fitPistonGuide(root, update, cycleDuration);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredDeadCenterCrankMovement(movement) {
  if (movement.id !== 401) return null;
  return brownellDeadCenterCrank(movement);
}
