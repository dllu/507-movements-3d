import * as THREE from 'three';
import {makeBoredPlanarLink, boredPlanarLinkGeometry} from './bored-planar-link.js';
import {circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function boredBoss(radius, depth, boreRadius, material) {
  return new THREE.Mesh(boredPlanarLinkGeometry({
    length: 0, width: radius * 2, eyeRadius: radius, boreRadius, depth,
  }), material);
}

// Finite tapered lever, with different eyes at the shaft and driven pin.
function boredGabLever(end, {startRadius, endRadius, startBore, endBore, depth, width}, material) {
  const length = Math.hypot(end.x, end.y);
  const startHalfWidth = width === undefined ? startRadius * .72 : width / 2;
  const endHalfWidth = width === undefined ? endRadius * .72 : width / 2;
  const outline = polygonClipping.union(
    poly(circle([0, 0], startRadius, 64)),
    poly(circle([length, 0], endRadius, 64)),
    poly([[0, -startHalfWidth], [length, -endHalfWidth],
      [length, endHalfWidth], [0, startHalfWidth]]),
  );
  const bores = [{x: 0, y: 0, radius: startBore}];
  if (endBore > 0) bores.push({x: length, y: 0, radius: endBore});
  const geometry = plate(polygonClipping.difference(outline,
    ...bores.map(bore => poly(circle([bore.x, bore.y], bore.radius, 64)))), -depth / 2, depth / 2);
  geometry.userData.bores = bores;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.z = Math.atan2(end.y, end.x);
  return mesh;
}

function rotate2(angle, point) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function boredCamHandle(points, radius, boreRadius, material) {
  const curve = new THREE.SplineCurve(points), left = [], right = [];
  for (let i = 0; i <= 128; i++) {
    const p = curve.getPoint(i / 128), tangent = curve.getTangent(i / 128);
    left.push([p.x - radius * tangent.y, p.y + radius * tangent.x]);
    right.push([p.x + radius * tangent.y, p.y - radius * tangent.x]);
  }
  const outline = polygonClipping.union(poly([...left, ...right.reverse()]), poly(circle([0, 0], .20, 64)));
  return new THREE.Mesh(plate(polygonClipping.difference(outline,
    poly(circle([0, 0], boreRadius, 64))), -radius, radius), material);
}

// A round cam toe bears on a flat shoulder. Rocking the free handle resolves
// the changing rod/support pose without prescribing a penetrated contact.
function camAngleOnShoulder(pivot, toe, support, normal, commandedAngle) {
  const residual = rotate2(commandedAngle, toe).add(pivot).sub(support).dot(normal);
  if (Math.abs(residual) < 1e-13) return commandedAngle;
  const projection = support.clone().sub(pivot).dot(normal) / toe.length();
  if (Math.abs(projection) > 1 + 1e-12) throw new RangeError('Gab cam cannot reach its shoulder');
  const supportAngle = Math.atan2(normal.y, normal.x) - Math.PI / 2;
  const toeAngle = Math.atan2(toe.y, toe.x);
  const angle = Math.asin(THREE.MathUtils.clamp(projection, -1, 1));
  return [angle, Math.PI - angle].map(candidate => {
    const result = supportAngle + candidate - toeAngle;
    return commandedAngle + THREE.MathUtils.euclideanModulo(result - commandedAngle + Math.PI, FULL_TURN) - Math.PI;
  }).sort((a, b) => Math.abs(a - commandedAngle) - Math.abs(b - commandedAngle))[0];
}

function pointInPose(position, angle, localPoint) {
  return rotate2(angle, localPoint).add(position);
}

function smootherstepLaw(normalized) {
  const value = normalized ** 3 * (
    normalized * (normalized * 6 - 15) + 10
  );
  const firstDerivative = 30 * normalized ** 2 * (1 - normalized) ** 2;
  const secondDerivative = 60 * normalized
    * (1 - normalized)
    * (1 - 2 * normalized);
  return { firstDerivative, secondDerivative, value };
}

function c2BumpLaw(normalized) {
  const value = 64 * normalized ** 3 * (1 - normalized) ** 3;
  const firstDerivative = 192 * normalized ** 2
    * (1 - normalized) ** 2
    * (1 - 2 * normalized);
  return { firstDerivative, value };
}

function transitionLaw(phase, start, end, from, to) {
  const duration = end - start;
  const normalized = THREE.MathUtils.clamp(
    (phase - start) / duration,
    0,
    1,
  );
  const smooth = smootherstepLaw(normalized);
  return {
    accelerationPerPhaseSquared:
      (to - from) * smooth.secondDerivative / duration ** 2,
    ratePerPhase: (to - from) * smooth.firstDerivative / duration,
    value: THREE.MathUtils.lerp(from, to, smooth.value),
  };
}

function bumpLaw(phase, start, end, amplitude) {
  const duration = end - start;
  const normalized = THREE.MathUtils.clamp(
    (phase - start) / duration,
    0,
    1,
  );
  const bump = c2BumpLaw(normalized);
  return {
    ratePerPhase: amplitude * bump.firstDerivative / duration,
    value: amplitude * bump.value,
  };
}

function makeTube(points, radius, material, z = 0, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, point.z ?? z)),
    closed,
    'centripetal',
  );
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(64, points.length * 18), radius, 12, closed),
    material,
  );
}

function distanceToRectangle(point, minimum, maximum) {
  const dx = Math.max(minimum.x - point.x, 0, point.x - maximum.x);
  const dy = Math.max(minimum.y - point.y, 0, point.y - maximum.y);
  return Math.hypot(dx, dy);
}

function springHandleGabDisengager() {
  const root = new THREE.Group();

  // Brown's square engraving is measured about the gab-pin center. One scale
  // maps its valve-rocker axis, cam pivot, handle grip, spring loop, and notch
  // a into a common model plane; z is then used only to separate the nested
  // physical plates and the through-pins that join them.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(266, 254);
  const sourceRasterValvePivot = new THREE.Vector2(261, 57);
  const sourceRasterCamPivot = new THREE.Vector2(340, 207);
  const sourceRasterHandleGrip = new THREE.Vector2(470, 213);
  const sourceRasterCamContact = new THREE.Vector2(285, 151);
  const sourceRasterNotchA = new THREE.Vector2(480, 319);
  const sourceRasterSpringAnchor = new THREE.Vector2(358, 240);
  const sourceRasterSpringBottom = new THREE.Vector2(436, 482);
  const sourceRasterSpringFreeTip = new THREE.Vector2(418, 319);
  const sourceUnitsPerPixel = 0.015;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const valvePivot = sourcePointFromRaster(sourceRasterValvePivot);
  const valvePinLocal = valvePivot.clone().multiplyScalar(-1);
  const valveArmLength = valvePinLocal.length();
  const valveRockerAmplitude = 0.12;
  const camPivotLocal = sourcePointFromRaster(sourceRasterCamPivot);
  const sourceHandleGrip = sourcePointFromRaster(sourceRasterHandleGrip);
  const handleGripLocal = sourceHandleGrip.clone().sub(camPivotLocal);
  const maximumHandleAngle = 0.75;
  const camToeRadius = .145;
  const camSupportHalfLength = .82;
  const sourceCamContact = sourcePointFromRaster(sourceRasterCamContact);
  const camContactLocal = sourceCamContact.clone().sub(camPivotLocal);
  const camContactSourceHeight = camPivotLocal.y + camContactLocal.y;
  const camSupportValveLocal = sourceCamContact.clone().sub(valvePivot);
  const sourceNotchA = sourcePointFromRaster(sourceRasterNotchA);
  const camNotchALocal = sourceNotchA.clone().sub(camPivotLocal);
  const springHandleAnchorLocal = sourcePointFromRaster(
    sourceRasterSpringAnchor,
  );
  const springRestPathLocal = [
    sourceRasterSpringAnchor,
    new THREE.Vector2(374, 287),
    new THREE.Vector2(402, 365),
    new THREE.Vector2(420, 449),
    sourceRasterSpringBottom,
    new THREE.Vector2(458, 467),
    new THREE.Vector2(468, 425),
    new THREE.Vector2(453, 361),
    sourceRasterSpringFreeTip,
  ].map(sourcePointFromRaster);
  const springRestTipLocal = springRestPathLocal.at(-1).clone();
  const springMaximumDeflection = 0.14;

  const gabPinRadius = 0.18;
  const gabInnerHalfWidth = gabPinRadius + 0.06;
  const gabJawWidth = 0.17;
  const gabMouthDepth = 0.48;
  const gabTopBridgeMinimumY = 0.22;
  const gabTopBridgeMaximumY = 0.43;
  const fullClearCouplingStart = gabMouthDepth + gabPinRadius + 0.04;
  const fullClearCouplingEnd = fullClearCouplingStart + 0.06;

  const handleLiftAtAngle = (handleAngle) => camContactLocal.y
    - rotate2(handleAngle, camContactLocal).y;
  const maximumGabLift = handleLiftAtAngle(maximumHandleAngle);
  if (maximumGabLift <= fullClearCouplingEnd) {
    throw new RangeError('Movement 186 cam cannot lift the gab clear of its pin.');
  }

  const cyclePeriod = 18;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    sourceEngagedHoldEnd: 0.18,
    springSnapStart: 0.28,
    handlePullEnd: 0.32,
    latchedHoldEnd: 0.58,
    springReleaseEnd: 0.64,
    handleLowerEnd: 0.80,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.sourceEngagedHoldEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.sourceEngagedHoldEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handlePullEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.latchedHoldEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handlePullEnd,
        sequenceBreaks.latchedHoldEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.handleLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.sourceEngagedHoldEnd
        && phase < sequenceBreaks.handlePullEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.sourceEngagedHoldEnd,
        sequenceBreaks.handlePullEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handlePullEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.handleLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.springReleaseEnd,
        sequenceBreaks.handleLowerEnd,
        1,
        0,
      );
    }

    let latch = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.springSnapStart
        && phase < sequenceBreaks.handlePullEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.springSnapStart,
        sequenceBreaks.handlePullEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handlePullEnd
        && phase < sequenceBreaks.latchedHoldEnd
    ) {
      latch.value = 1;
    } else if (
      phase >= sequenceBreaks.latchedHoldEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.latchedHoldEnd,
        sequenceBreaks.springReleaseEnd,
        1,
        0,
      );
    }

    let spring = { ratePerPhase: 0, value: 0 };
    if (
      phase >= sequenceBreaks.springSnapStart
        && phase < sequenceBreaks.handlePullEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.springSnapStart,
        sequenceBreaks.handlePullEnd,
        -springMaximumDeflection,
      );
    } else if (
      phase >= sequenceBreaks.latchedHoldEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.latchedHoldEnd,
        sequenceBreaks.springReleaseEnd,
        springMaximumDeflection,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-gear';
    if (
      phase >= sequenceBreaks.sourceEngagedHoldEnd
        && phase < sequenceBreaks.springSnapStart
    ) stage = 'pulling-spring-handle-cam-lifting-gab';
    else if (
      phase >= sequenceBreaks.springSnapStart
        && phase < sequenceBreaks.handlePullEnd
    ) stage = 'spring-handle-passing-notch-a';
    else if (
      phase >= sequenceBreaks.handlePullEnd
        && phase < sequenceBreaks.latchedHoldEnd
    ) stage = 'spring-handle-latched-gab-clear-of-pin';
    else if (
      phase >= sequenceBreaks.latchedHoldEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) stage = 'spring-handle-flexing-out-of-notch-a';
    else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.handleLowerEnd
    ) stage = 'cam-lowering-gab-around-valve-pin';
    else if (phase >= sequenceBreaks.handleLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-gear';
    }

    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      latchAccelerationPerPhaseSquared:
        latch.accelerationPerPhaseSquared,
      latchEngagement: latch.value,
      latchRatePerPhase: latch.ratePerPhase,
      phase,
      springDeflection: spring.value,
      springDeflectionRatePerPhase: spring.ratePerPhase,
      stage,
    };
  };

  const notchALocalAtHandleAngle = (handleAngle) => camPivotLocal
    .clone()
    .add(rotate2(handleAngle, camNotchALocal));
  const springHandlePointsAtConfiguration = ({
    handleAngle,
    handleFraction,
    springDeflection,
  }) => {
    const notchALocal = notchALocalAtHandleAngle(handleAngle);
    const desiredTip = springRestTipLocal.clone().lerp(
      notchALocal,
      handleFraction,
    );
    const tipDisplacement = desiredTip.clone().sub(springRestTipLocal);
    return springRestPathLocal.map((restPoint, index) => {
      const normalized = index / (springRestPathLocal.length - 1);
      const bendWeight = smootherstepLaw(normalized).value;
      return new THREE.Vector3(
        restPoint.x + tipDisplacement.x * bendWeight,
        restPoint.y + tipDisplacement.y * bendWeight,
        0.62 + springDeflection * bendWeight,
      );
    });
  };

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
    latchEngagement = 0,
    springDeflection = 0,
  }) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const handleAngle = maximumHandleAngle * resolvedHandleFraction;
    const gabLift = handleLiftAtAngle(handleAngle);
    const liftDerivativeByAngle = -camContactLocal.x * Math.cos(handleAngle)
      + camContactLocal.y * Math.sin(handleAngle);
    const liftSecondDerivativeByAngle = rotate2(
      handleAngle,
      camContactLocal,
    ).y;
    const gabLiftVelocity = liftDerivativeByAngle * handleAngularVelocity;
    const gabLiftAcceleration = liftSecondDerivativeByAngle
      * handleAngularVelocity ** 2
      + liftDerivativeByAngle * handleAcceleration;

    const nominalRockerAngle = valveRockerAmplitude
      * Math.sin(resolvedInputAngle);
    const nominalValvePin = pointInPose(
      valvePivot,
      nominalRockerAngle,
      valvePinLocal,
    );
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const rockerAngle = nominalRockerAngle * couplingBlend;
    const valvePin = pointInPose(valvePivot, rockerAngle, valvePinLocal);
    const gabCenter = nominalValvePin.clone().add(
      new THREE.Vector2(0, gabLift),
    );
    const pinRelativeToGab = valvePin.clone().sub(gabCenter);

    const camPivot = gabCenter.clone().add(camPivotLocal);
    const camSupportCenter = pointInPose(
      valvePivot,
      rockerAngle,
      camSupportValveLocal,
    );
    const camSupportTangent = rotate2(
      rockerAngle,
      new THREE.Vector2(1, 0),
    );
    const camSupportNormal = new THREE.Vector2(
      -camSupportTangent.y,
      camSupportTangent.x,
    );
    const camAngle = camAngleOnShoulder(camPivot, camContactLocal,
      camSupportCenter, camSupportNormal, handleAngle);
    const camContactPoint = camPivot.clone().add(rotate2(camAngle, camContactLocal));
    const camSurfacePoint = camContactPoint.clone().addScaledVector(camSupportNormal, -camToeRadius);
    const contactFromSupportCenter = camContactPoint.clone().sub(
      camSupportCenter,
    );
    const camContactSignedNormalError = contactFromSupportCenter.dot(
      camSupportNormal,
    );
    const camSupportPoint = camContactPoint.clone().addScaledVector(
      camSupportNormal,
      -camContactSignedNormalError,
    );
    const camContactError = Math.abs(camContactSignedNormalError);

    const notchALocal = notchALocalAtHandleAngle(camAngle);
    const notchA = gabCenter.clone().add(notchALocal);
    const springHandlePointsLocal = springHandlePointsAtConfiguration({
      handleAngle: camAngle,
      handleFraction: resolvedHandleFraction,
      springDeflection,
    });
    const springLatchTipLocal = springHandlePointsLocal.at(-1);
    const springLatchTip = gabCenter.clone().add(
      new THREE.Vector2(springLatchTipLocal.x, springLatchTipLocal.y),
    );
    const latchPlanarGap = springLatchTip.distanceTo(notchA);
    const latchGap = Math.hypot(latchPlanarGap, springDeflection);
    const latchCaptureError = latchEngagement >= 1 - 1e-12
      ? latchGap
      : 0;

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth - gabJawWidth,
        jawMinimumY,
      ),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth,
        gabTopBridgeMinimumY,
      ),
      new THREE.Vector2(
        gabInnerHalfWidth,
        gabTopBridgeMaximumY,
      ),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = gabLift <= 1e-12
      && couplingBlend >= 1 - 1e-12
      && valvePin.distanceTo(gabCenter) <= 1e-12;

    return {
      camAngle, camSurfacePoint,
      camRockingCorrection: camAngle - handleAngle,
      camContactError,
      camContactPoint,
      camContactSignedNormalError,
      camPivot,
      camSupportCenter,
      camSupportNormal,
      camSupportPoint,
      couplingBlend,
      gabCaptured,
      gabCenter,
      gabLift,
      gabLiftAcceleration,
      gabLiftVelocity,
      handleAcceleration,
      handleAngle,
      handleAngularVelocity,
      handleFraction: resolvedHandleFraction,
      inputAngle: resolvedInputAngle,
      latchCaptureError,
      latchEngagement: THREE.MathUtils.clamp(latchEngagement, 0, 1),
      latchGap,
      latchPlanarGap,
      minimumGabSolidClearance,
      nominalRockerAngle,
      nominalValvePin,
      notchA,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      rockerAngle,
      springDeflection,
      springHandlePointsLocal,
      springLatchTip,
      springLatchTipLocal: springLatchTipLocal.clone(),
      valvePin,
      valvePinRadiusError: Math.abs(
        valvePin.distanceTo(valvePivot) - valveArmLength
      ),
      valvePivot: valvePivot.clone(),
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumHandleAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumHandleAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
      latchEngagement: sequence.latchEngagement,
      springDeflection: sequence.springDeflection,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.latchAcceleration = sequence.latchAccelerationPerPhaseSquared
      * phaseRate ** 2;
    state.latchRate = sequence.latchRatePerPhase * phaseRate;
    state.springDeflectionRate = sequence.springDeflectionRatePerPhase
      * phaseRate;
    state.stage = sequence.stage;
    state.camContactActive = true;
    state.camLiftActive = (
      sequence.stage === 'pulling-spring-handle-cam-lifting-gab'
        || sequence.stage === 'spring-handle-passing-notch-a'
        || sequence.stage === 'cam-lowering-gab-around-valve-pin'
    );
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  const valveRocker = new THREE.Group();
  valveRocker.position.set(valvePivot.x, valvePivot.y, -.48);
  valveRocker.userData.axis = Z_AXIS.clone();
  valveRocker.userData.role =
    'fixed-axis-valve-gab-lever-carrying-the-engagement-pin';
  const valveShaft = cylinderAlongZ(0.34, 1.66, darkMaterial, 40);
  valveShaft.userData.role = 'fixed-valve-rockshaft';
  const valveShaftFace = boredBoss(0.58, 0.22, 0.352, drivenMaterial);
  valveShaftFace.position.z = 0.46;
  valveShaftFace.userData.role = 'source-round-valve-rockshaft-boss';
  const valveArm = boredGabLever(valvePinLocal, {
    startRadius: 0.58, endRadius: gabPinRadius + .16,
    startBore: 0.352, endBore: gabPinRadius + .012, depth: 0.32,
  }, drivenMaterial);
  valveArm.userData.role = 'rigid-valve-lever-from-rockshaft-to-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 1.78, brassMaterial, 32);
  valvePin.position.set(valvePinLocal.x, valvePinLocal.y, 0.50);
  valvePin.userData.role = 'valve-gear-pin-captured-by-eccentric-rod-gab';
  const valvePinIndex = new THREE.Mesh(
    new THREE.TorusGeometry(gabPinRadius * 0.67, 0.032, 8, 28),
    whiteMaterial,
  );
  valvePinIndex.position.set(valvePinLocal.x, valvePinLocal.y, 1.41);
  valvePinIndex.userData.role = 'white-index-on-valve-gear-pin';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.position.set(valvePinLocal.x, valvePinLocal.y, 0);
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valveShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.075, 0.04),
    whiteMaterial,
  );
  valveShaftIndex.position.set(0.25, 0, 0.61);
  valveShaftIndex.userData.role = 'white-index-on-valve-rockshaft';
  const camSupportShoe = makeBeam(
    new THREE.Vector3(
      camSupportValveLocal.x - camSupportHalfLength,
      camSupportValveLocal.y,
      .23,
    ),
    new THREE.Vector3(
      camSupportValveLocal.x + camSupportHalfLength,
      camSupportValveLocal.y,
      .23,
    ),
    {
      color: PALETTE.driven,
      depth: 0.14,
      jointRadius: 0.001,
      thickness: 0.16,
    },
  );
  camSupportShoe.position.y -= camToeRadius + .08;
  camSupportShoe.userData.role =
    'valve-lever-shoulder-on-which-the-lifting-cam-slides';
  const camSupportAnchor = new THREE.Group();
  camSupportAnchor.position.set(
    camSupportValveLocal.x,
    camSupportValveLocal.y,
    .23,
  );
  camSupportAnchor.userData.role = 'source-center-of-cam-support-shoulder';
  valveRocker.add(
    camSupportAnchor,
    camSupportShoe,
    valveShaft,
    valveShaftFace,
    valveArm,
    valvePin,
    valvePinIndex,
    valvePinAnchor,
    valveShaftIndex,
  );
  root.add(valveRocker);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.18;
  eccentricRod.userData.role =
    'reciprocating-eccentric-rod-with-downward-opening-gab';
  const rodLeftEnd = -3.72;
  const rodLeftBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.abs(rodLeftEnd) - gabInnerHalfWidth - gabJawWidth + 0.12,
      0.30,
      0.34,
    ),
    driverMaterial,
  );
  rodLeftBody.position.set(
    (rodLeftEnd - gabInnerHalfWidth - gabJawWidth) / 2,
    0.22,
    0,
  );
  rodLeftBody.userData.role = 'off-frame-eccentric-rod-body';
  const rodRightBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.30, 0.34),
    driverMaterial,
  );
  rodRightBody.position.set(0.95, 0.22, 0);
  rodRightBody.userData.role = 'gab-crown-to-cam-pivot-rod-body';
  const gabTopBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * (gabInnerHalfWidth + gabJawWidth),
      gabTopBridgeMaximumY - gabTopBridgeMinimumY,
      0.42,
    ),
    driverMaterial,
  );
  gabTopBridge.position.set(
    0,
    (gabTopBridgeMinimumY + gabTopBridgeMaximumY) / 2,
    0.02,
  );
  gabTopBridge.userData.role = 'closed-crown-of-eccentric-rod-gab';
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(
        gabJawWidth,
        gabMouthDepth + gabTopBridgeMaximumY,
        0.42,
      ),
      driverMaterial,
    );
    jaw.position.set(
      sign * (gabInnerHalfWidth + gabJawWidth / 2),
      (gabTopBridgeMaximumY - gabMouthDepth) / 2,
      0.02,
    );
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-open-bottom-gab-jaw`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, gabMouthDepth * 0.72, 0.50),
      brassMaterial,
    );
    shoe.position.set(
      sign * gabInnerHalfWidth,
      -gabMouthDepth * 0.28,
      0.08,
    );
    shoe.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-contact-shoe`;
    eccentricRod.add(shoe);
    return shoe;
  });
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const offFrameRodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.075, 0.04),
    whiteMaterial,
  );
  offFrameRodIndex.position.set(-2.82, 0.40, 0.24);
  offFrameRodIndex.userData.role = 'white-index-on-moving-eccentric-rod';
  eccentricRod.add(
    rodLeftBody,
    rodRightBody,
    gabTopBridge,
    gabCenterAnchor,
    offFrameRodIndex,
  );
  root.add(eccentricRod);

  const camLever = new THREE.Group();
  camLever.position.set(camPivotLocal.x, camPivotLocal.y, 0.43);
  camLever.userData.axis = Z_AXIS.clone();
  camLever.userData.role =
    'upper-cam-lever-pivoted-independently-on-the-eccentric-rod';
  const camLeverPath = [
    camContactLocal.clone(),
    new THREE.Vector2(-0.72, 1.22),
    new THREE.Vector2(-0.42, 1.52),
    new THREE.Vector2(-0.10, 1.38),
    new THREE.Vector2(0.10, 0.72),
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.55, -0.13),
    new THREE.Vector2(1.15, -0.24),
    new THREE.Vector2(1.70, -0.18),
    handleGripLocal.clone(),
  ];
  const camLeverBody = boredCamHandle(camLeverPath, .115, .127, accentMaterial);
  camLeverBody.userData.role = 'curved-cam-and-upper-pull-handle';
  const camPivotPin = cylinderAlongZ(0.115, 1.18, darkMaterial, 28);
  camPivotPin.position.set(camPivotLocal.x, camPivotLocal.y, 0.42);
  camPivotPin.userData.role = 'cam-lever-pivot-fixed-in-eccentric-rod';
  camLeverBody.position.z = .18;
  const camContactNose = cylinderAlongZ(camToeRadius, .16, accentMaterial, 128);
  camContactNose.position.set(camContactLocal.x, camContactLocal.y, -.81);
  const camToeNeck = cylinderAlongZ(.10, 1.02, accentMaterial, 32);
  camToeNeck.userData.role = 'axial-neck-joining-rear-cam-toe-to-visible-handle';
  camToeNeck.position.set(camContactLocal.x, camContactLocal.y, -.315);
  camLever.add(camToeNeck);
  camContactNose.userData.role = 'finite-round-cam-toe-bearing-on-valve-gear-shoulder';
  const upperHandleGrip = cylinderAlongZ(0.15, 0.60, darkMaterial, 28);
  upperHandleGrip.position.set(handleGripLocal.x, handleGripLocal.y, 0.10);
  upperHandleGrip.userData.role = 'source-upper-handle-grip';
  const camLatchTangPath = [
    handleGripLocal.clone(),
    new THREE.Vector2(2.15, -0.38),
    new THREE.Vector2(2.25, -0.86),
    new THREE.Vector2(2.23, -1.30),
    new THREE.Vector2(camNotchALocal.x + 0.14, camNotchALocal.y + 0.10),
  ];
  const camLatchTang = makeTube(
    camLatchTangPath,
    0.075,
    accentMaterial,
    0.19,
  );
  camLatchTang.userData.role =
    'cam-lever-spring-catch-tang-containing-notch-a';
  const notchLipUpper = makeBeam(
    new THREE.Vector3(
      camNotchALocal.x + 0.17,
      camNotchALocal.y + 0.11,
      0.19,
    ),
    new THREE.Vector3(camNotchALocal.x, camNotchALocal.y, 0.19),
    {
      color: PALETTE.accent,
      depth: 0.11,
      jointRadius: 0.001,
      thickness: 0.09,
    },
  );
  notchLipUpper.userData.role = 'upper-working-lip-of-notch-a';
  const notchLipLower = makeBeam(
    new THREE.Vector3(camNotchALocal.x, camNotchALocal.y, 0.19),
    new THREE.Vector3(
      camNotchALocal.x - 0.22,
      camNotchALocal.y + 0.02,
      0.19,
    ),
    {
      color: PALETTE.accent,
      depth: 0.11,
      jointRadius: 0.001,
      thickness: 0.09,
    },
  );
  notchLipLower.userData.role = 'lower-working-lip-of-notch-a';
  const notchAAnchor = new THREE.Group();
  notchAAnchor.position.set(camNotchALocal.x, camNotchALocal.y, 0.19);
  notchAAnchor.userData.role = 'exact-moving-center-of-notch-a';
  camLever.add(
    camLeverBody,
    camContactNose,
    camLatchTang,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    upperHandleGrip,
  );
  eccentricRod.add(camLever, camPivotPin);

  const springHandle = makeDynamicCable({
    color: PALETTE.brass,
    maxSegments: 64,
    radius: 0.075,
  });
  springHandle.userData.role =
    'separate-rod-mounted-flexible-loop-spring-handle-pulled-up-to-notch-a';
  const springHandleAnchor = cylinderAlongZ(
    0.105,
    0.86,
    darkMaterial,
    28,
  );
  springHandleAnchor.position.set(
    springHandleAnchorLocal.x,
    springHandleAnchorLocal.y,
    0.38,
  );
  springHandleAnchor.userData.role =
    'fixed-root-of-spring-handle-in-eccentric-rod';
  const springTipIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    whiteMaterial,
  );
  springTipIndex.position.set(
    springRestTipLocal.x,
    springRestTipLocal.y,
    0.62,
  );
  springTipIndex.userData.role = 'white-index-on-spring-latch-tip';
  eccentricRod.add(springHandle, springHandleAnchor, springTipIndex);

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-frame-supporting-valve-rockshaft';
  const frameBeams = [
    [new THREE.Vector3(-1.24, -1.18, -0.98), new THREE.Vector3(-1.24, 3.44, -0.98)],
    [new THREE.Vector3(-1.24, 3.44, -0.98), new THREE.Vector3(1.18, 3.44, -0.98)],
    [new THREE.Vector3(1.18, 3.44, -0.98), new THREE.Vector3(0.44, 2.95, -0.98)],
    [new THREE.Vector3(-4.02, -1.18, -0.98), new THREE.Vector3(3.88, -1.18, -0.98)],
  ].map(([start, end], index) => {
    const beam = makeBeam(start, end, {
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: index === 3 ? 0.19 : 0.16,
    });
    beam.userData.role = `fixed-frame-member-${index + 1}`;
    frame.add(beam);
    return beam;
  });
  const valveBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.47, 0.10, 12, 42),
    frameMaterial,
  );
  valveBearing.position.set(valvePivot.x, valvePivot.y, -0.82);
  valveBearing.userData.role = 'rear-valve-rockshaft-bearing';
  frame.add(valveBearing);
  root.add(frame);

  const camContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 14),
    whiteMaterial,
  );
  camContactMarker.userData.role = 'visible-cam-lifting-contact';
  const gabCaptureMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    whiteMaterial,
  );
  gabCaptureMarker.userData.role = 'visible-gab-pin-capture';
  const latchMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 20, 14),
    whiteMaterial,
  );
  latchMarker.userData.role = 'visible-spring-handle-notch-a-capture';
  root.add(camContactMarker, gabCaptureMarker, latchMarker);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 8.2, 3.0),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.05, 0.15, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    camContactMarker,
    camContactNose,
    camToeNeck,
    camSupportAnchor,
    camSupportShoe,
    camLatchTang,
    camLever,
    camLeverBody,
    camPivotPin,
    eccentricRod,
    frame,
    frameBeams,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabJaws,
    gabTopBridge,
    latchMarker,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    offFrameRodIndex,
    rodLeftBody,
    rodRightBody,
    springHandle,
    springHandleAnchor,
    springTipIndex,
    upperHandleGrip,
    valveArm,
    valveBearing,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveRocker,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  };

  const geometry = {
    camToeRadius,
    camContactLocal: camContactLocal.clone(),
    camSupportHalfLength,
    camContactSourceHeight,
    camSupportValveLocal: camSupportValveLocal.clone(),
    camNotchALocal: camNotchALocal.clone(),
    camPivotLocal: camPivotLocal.clone(),
    cyclePeriod,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    handleGripLocal: handleGripLocal.clone(),
    inputTurnsPerCycle,
    maximumGabLift,
    maximumHandleAngle,
    sequenceBreaks,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCamContact: sourceRasterCamContact.clone(),
    sourceRasterCamPivot: sourceRasterCamPivot.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterHandleGrip: sourceRasterHandleGrip.clone(),
    sourceRasterNotchA: sourceRasterNotchA.clone(),
    sourceRasterSpringAnchor: sourceRasterSpringAnchor.clone(),
    sourceRasterSpringBottom: sourceRasterSpringBottom.clone(),
    sourceRasterSpringFreeTip: sourceRasterSpringFreeTip.clone(),
    sourceRasterValvePivot: sourceRasterValvePivot.clone(),
    sourceUnitsPerPixel,
    springHandleAnchorLocal: springHandleAnchorLocal.clone(),
    springMaximumDeflection,
    springRestPathLocal: springRestPathLocal.map((point) => point.clone()),
    springRestTipLocal: springRestTipLocal.clone(),
    valveArmLength,
    valvePinLocal: valvePinLocal.clone(),
    valvePivot: valvePivot.clone(),
    valveRockerAmplitude,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveRocker.rotation.z = state.rockerAngle;
    eccentricRod.position.set(
      state.gabCenter.x,
      state.gabCenter.y,
      0.18,
    );
    camLever.rotation.z = state.camAngle;
    const springCurve = new THREE.CatmullRomCurve3(
      state.springHandlePointsLocal,
      false,
      'centripetal',
    );
    springHandle.userData.setPoints(springCurve.getSpacedPoints(48));
    springTipIndex.position.copy(state.springLatchTipLocal);
    camContactMarker.position.set(
      state.camSurfacePoint.x,
      state.camSurfacePoint.y,
      0.61,
    );
    camContactMarker.visible = state.camLiftActive;
    gabCaptureMarker.position.set(
      state.valvePin.x,
      state.valvePin.y,
      1.12,
    );
    gabCaptureMarker.visible = state.gabCaptured;
    latchMarker.position.set(state.notchA.x, state.notchA.y, 0.80);
    latchMarker.visible = state.latchEngagement > 1 - 1e-8;
    root.userData.contacts = {
      camShoulder: {
        active: state.camContactActive,
        contactError: state.camContactError,
        point: state.camSurfacePoint.clone(),
        toeCenter: state.camContactPoint.clone(),
      },
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      notchA: {
        captureError: state.latchCaptureError,
        engagement: state.latchEngagement,
        gap: state.latchGap,
        point: state.notchA.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    engagedRunning: 0,
    handleHalfRaised: cyclePeriod * 0.25,
    latchedDisengaged: cyclePeriod * 0.45,
    springFlexedForRelease: cyclePeriod * 0.61,
    handleHalfLowered: cyclePeriod * 0.72,
    nextEngagedRunning: cyclePeriod,
  };
  const canonicalStates = {
    engagedAtQuarterTurn: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedAtQuarterTurn: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
      latchEngagement: 1,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'spring-handle-cam-lifted-eccentric-rod-gab-pin-notch-latch';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.handleLiftAtAngle = handleLiftAtAngle;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.mechanism =
    'rod-carried-cam-lever-lifts-downward-opening-eccentric-rod-gab-off-valve-pin-and-spring-handle-latches-in-notch-a';
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.springHandlePointsAtConfiguration =
    springHandlePointsAtConfiguration;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.02;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    camContactMarker,
    gabCaptureMarker,
    latchMarker,
    offFrameRodIndex,
    springTipIndex,
    valvePinIndex,
    valveShaftIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.6, 3.4, 14.8),
    root,
    update,
  };
}

function twoHandleGabDisengager() {
  const root = new THREE.Group();

  // Brown's 187 side elevation is measured from the gab-pin center. Unlike
  // 186, the lower handle is one rigid piece with the eccentric rod and the
  // upper handle alone pivots. Its rear cam toe bears on the top surface
  // of the valve-lever shoulder: raising that handle makes the toe descend about
  // its rod-mounted pivot, so the reaction lifts the rod and its open gab.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(313, 242);
  const sourceRasterValvePivot = new THREE.Vector2(313, 111);
  const sourceRasterCamPivot = new THREE.Vector2(320, 198);
  const sourceRasterCamContact = new THREE.Vector2(283, 175);
  const sourceRasterUpperGrip = new THREE.Vector2(474, 195);
  const sourceRasterLowerGrip = new THREE.Vector2(474, 245);
  const sourceRasterRodLeftEnd = new THREE.Vector2(15, 242);
  const sourceRasterSupportLeft = new THREE.Vector2(258, 175);
  const sourceRasterSupportRight = new THREE.Vector2(370, 175);
  const sourceUnitsPerPixel = 0.018;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const valvePivot = sourcePointFromRaster(sourceRasterValvePivot);
  const valvePinLocal = valvePivot.clone().multiplyScalar(-1);
  const valveArmLength = valvePinLocal.length();
  const camPivotLocal = sourcePointFromRaster(sourceRasterCamPivot);
  const sourceCamContact = sourcePointFromRaster(sourceRasterCamContact);
  const camContactLocal = sourceCamContact.clone().sub(camPivotLocal);
  const upperGripLocal = sourcePointFromRaster(sourceRasterUpperGrip)
    .sub(camPivotLocal);
  const lowerGripLocal = sourcePointFromRaster(sourceRasterLowerGrip);
  const rodLeftEndLocal = sourcePointFromRaster(sourceRasterRodLeftEnd);
  const supportLeftLocal = sourcePointFromRaster(sourceRasterSupportLeft)
    .sub(valvePivot);
  const supportRightLocal = sourcePointFromRaster(sourceRasterSupportRight)
    .sub(valvePivot);
  const camSupportValveLocal = supportLeftLocal.clone()
    .add(supportRightLocal)
    .multiplyScalar(0.5);
  const camSupportHalfLength = supportLeftLocal.distanceTo(supportRightLocal)
    / 2;

  const rodStroke = 0.30;
  const maximumHandleAngle = 0.92;
  const camToeRadius = .16;
  const gabPinRadius = 0.22;
  const gabInnerHalfWidth = gabPinRadius + 0.05;
  const gabJawWidth = 0.17;
  const gabMouthDepth = 0.36;
  const gabTopBridgeMinimumY = 0.36;
  const gabTopBridgeMaximumY = 0.52;
  const fullClearCouplingStart = gabMouthDepth + gabPinRadius + 0.03;
  const fullClearCouplingEnd = gabMouthDepth + gabPinRadius + 0.07;

  const handleLiftAtAngle = (handleAngle) => camContactLocal.y
    - rotate2(handleAngle, camContactLocal).y;
  const maximumGabLift = handleLiftAtAngle(maximumHandleAngle);
  if (maximumGabLift <= fullClearCouplingEnd) {
    throw new RangeError('Movement 187 cam cannot lift the gab clear of its pin.');
  }

  const cyclePeriod = 16;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    engagedRunEnd: 0.20,
    handleRaiseStart: 0.24,
    handleRaiseEnd: 0.40,
    releasedRunEnd: 0.66,
    handleLowerStart: 0.70,
    handleLowerEnd: 0.84,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.engagedRunEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.engagedRunEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handleRaiseEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.releasedRunEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleRaiseEnd,
        sequenceBreaks.releasedRunEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.handleLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.handleRaiseStart
        && phase < sequenceBreaks.handleRaiseEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleRaiseStart,
        sequenceBreaks.handleRaiseEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleRaiseEnd
        && phase < sequenceBreaks.handleLowerStart
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLowerStart,
        sequenceBreaks.handleLowerEnd,
        1,
        0,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-gear';
    if (
      phase >= sequenceBreaks.engagedRunEnd
        && phase < sequenceBreaks.handleRaiseStart
    ) stage = 'eccentric-stopped-with-gab-pin-aligned';
    else if (
      phase >= sequenceBreaks.handleRaiseStart
        && phase < sequenceBreaks.handleRaiseEnd
    ) stage = 'raising-upper-cam-handle-lifting-gab';
    else if (
      phase >= sequenceBreaks.handleRaiseEnd
        && phase < sequenceBreaks.releasedRunEnd
    ) stage = 'operator-holding-two-handle-gab-clear-while-rod-runs';
    else if (
      phase >= sequenceBreaks.releasedRunEnd
        && phase < sequenceBreaks.handleLowerStart
    ) stage = 'eccentric-stopped-with-gab-held-clear';
    else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) stage = 'lowering-upper-cam-handle-recapturing-pin';
    else if (phase >= sequenceBreaks.handleLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-gear';
    }

    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      phase,
      stage,
    };
  };

  const nominalRockerAngleAtInput = (inputAngle) => Math.asin(
    THREE.MathUtils.clamp(
      rodStroke * Math.sin(inputAngle) / valveArmLength,
      -1,
      1,
    ),
  );

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
  }) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const handleAngle = maximumHandleAngle * resolvedHandleFraction;
    const gabLift = handleLiftAtAngle(handleAngle);
    const liftDerivativeByAngle = -camContactLocal.x * Math.cos(handleAngle)
      + camContactLocal.y * Math.sin(handleAngle);
    const liftSecondDerivativeByAngle = rotate2(
      handleAngle,
      camContactLocal,
    ).y;
    const gabLiftVelocity = liftDerivativeByAngle * handleAngularVelocity;
    const gabLiftAcceleration = liftSecondDerivativeByAngle
      * handleAngularVelocity ** 2
      + liftDerivativeByAngle * handleAcceleration;

    const gabCenter = new THREE.Vector2(
      rodStroke * Math.sin(resolvedInputAngle),
      gabLift,
    );
    const nominalRockerAngle = nominalRockerAngleAtInput(resolvedInputAngle);
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const rockerAngle = nominalRockerAngle * couplingBlend;
    const valvePin = pointInPose(valvePivot, rockerAngle, valvePinLocal);
    const pinRelativeToGab = valvePin.clone().sub(gabCenter);

    const camPivot = gabCenter.clone().add(camPivotLocal);
    const lowerGrip = gabCenter.clone().add(lowerGripLocal);
    const camSupportCenter = pointInPose(
      valvePivot,
      rockerAngle,
      camSupportValveLocal,
    );
    const camSupportTangent = rotate2(
      rockerAngle,
      new THREE.Vector2(1, 0),
    );
    const camSupportNormal = new THREE.Vector2(
      -camSupportTangent.y,
      camSupportTangent.x,
    );
    const camAngle = camAngleOnShoulder(camPivot, camContactLocal,
      camSupportCenter, camSupportNormal, handleAngle);
    const camContactPoint = camPivot.clone().add(rotate2(camAngle, camContactLocal));
    const camSurfacePoint = camContactPoint.clone().addScaledVector(camSupportNormal, -camToeRadius);
    const contactFromSupportCenter = camContactPoint.clone().sub(
      camSupportCenter,
    );
    const camContactAlongSupport = contactFromSupportCenter.dot(
      camSupportTangent,
    );
    const camContactSignedNormalError = contactFromSupportCenter.dot(
      camSupportNormal,
    );
    const camSupportPoint = camContactPoint.clone().addScaledVector(
      camSupportNormal,
      -camContactSignedNormalError,
    );
    const camContactError = Math.abs(camContactSignedNormalError);
    const camContactWithinSupport = Math.abs(camContactAlongSupport)
      <= camSupportHalfLength + 1e-10;

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth - gabJawWidth, jawMinimumY),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth, gabTopBridgeMinimumY),
      new THREE.Vector2(gabInnerHalfWidth, gabTopBridgeMaximumY),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = gabLift <= 1e-12
      && couplingBlend >= 1 - 1e-12
      && pinInsideGabMouth;

    const upperGrip = camPivot.clone().add(rotate2(camAngle, upperGripLocal));
    return {
      camAngle, camSurfacePoint,
      camRockingCorrection: camAngle - handleAngle,
      camContactAlongSupport,
      camContactError,
      camContactPoint,
      camContactSignedNormalError,
      camContactWithinSupport,
      camPivot,
      camSupportCenter,
      camSupportNormal,
      camSupportPoint,
      camSupportTangent,
      couplingBlend,
      gabCaptured,
      gabCenter,
      gabLift,
      gabLiftAcceleration,
      gabLiftVelocity,
      handleAcceleration,
      handleAngle,
      handleAngularVelocity,
      handleFraction: resolvedHandleFraction,
      inputAngle: resolvedInputAngle,
      lateralDriveError: Math.abs(pinRelativeToGab.x),
      leftJawClearance,
      lowerGrip,
      minimumGabSolidClearance,
      nominalRockerAngle,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      rightJawClearance,
      rockerAngle,
      topBridgeClearance,
      upperGrip,
      valvePin,
      valvePinRadiusError: Math.abs(
        valvePin.distanceTo(valvePivot) - valveArmLength
      ),
      valvePivot: valvePivot.clone(),
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumHandleAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumHandleAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.stage = sequence.stage;
    state.camContactActive = true;
    state.camLiftActive = (
      sequence.stage === 'raising-upper-cam-handle-lifting-gab'
        || sequence.stage
          === 'operator-holding-two-handle-gab-clear-while-rod-runs'
        || sequence.stage === 'eccentric-stopped-with-gab-held-clear'
        || sequence.stage === 'lowering-upper-cam-handle-recapturing-pin'
    );
    state.operatorHoldingHandle = (
      sequence.stage
        === 'operator-holding-two-handle-gab-clear-while-rod-runs'
        || sequence.stage === 'eccentric-stopped-with-gab-held-clear'
    );
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.19,
    roughness: 0.51,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  const valveRocker = new THREE.Group();
  valveRocker.position.set(valvePivot.x, valvePivot.y, -.54);
  valveRocker.userData.axis = Z_AXIS.clone();
  valveRocker.userData.role =
    'top-pivoted-valve-lever-carrying-the-gab-pin-and-cam-support';
  const valveShaft = cylinderAlongZ(0.32, 1.72, darkMaterial, 40);
  valveShaft.userData.role = 'fixed-valve-rockshaft';
  const valveShaftFace = boredBoss(0.56, 0.24, 0.332, drivenMaterial);
  valveShaftFace.position.z = 0.48;
  valveShaftFace.userData.role = 'source-round-valve-rockshaft-boss';
  const valveArm = boredGabLever(valvePinLocal, {
    startRadius: 0.56, endRadius: gabPinRadius + .16,
    startBore: 0.332, endBore: gabPinRadius + .012, depth: 0.34,
  }, drivenMaterial);
  valveArm.userData.role = 'rigid-valve-lever-from-rockshaft-to-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 1.82, brassMaterial, 32);
  valvePin.position.set(valvePinLocal.x, valvePinLocal.y, 0.62);
  valvePin.userData.role = 'round-valve-gear-pin-captured-by-the-open-gab';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.position.set(valvePinLocal.x, valvePinLocal.y, 0);
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valvePinIndex = new THREE.Mesh(
    new THREE.TorusGeometry(gabPinRadius * 0.67, 0.033, 8, 28),
    whiteMaterial,
  );
  valvePinIndex.position.set(valvePinLocal.x, valvePinLocal.y, 1.54);
  valvePinIndex.userData.role = 'white-index-on-valve-gear-pin';
  const valveShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.075, 0.04),
    whiteMaterial,
  );
  valveShaftIndex.position.set(0.24, 0, 0.62);
  valveShaftIndex.userData.role = 'white-index-on-valve-rockshaft';
  const camSupportShoe = makeBeam(
    new THREE.Vector3(supportLeftLocal.x, supportLeftLocal.y, .23),
    new THREE.Vector3(supportRightLocal.x, supportRightLocal.y, .23),
    {
      color: PALETTE.driven,
      depth: 0.14,
      jointRadius: 0.001,
      thickness: 0.17,
    },
  );
  camSupportShoe.position.y -= camToeRadius + .085;
  camSupportShoe.userData.role =
    'rear-valve-lever-shoulder-supporting-the-upper-cam';
  const camSupportAnchor = new THREE.Group();
  camSupportAnchor.position.set(
    camSupportValveLocal.x,
    camSupportValveLocal.y,
    .23,
  );
  camSupportAnchor.userData.role = 'center-of-valve-lever-cam-support-line';
  valveRocker.add(
    camSupportAnchor,
    camSupportShoe,
    valveArm,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  );
  root.add(valveRocker);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.14;
  eccentricRod.userData.role =
    'reciprocating-eccentric-rod-with-open-gab-and-integral-lower-grip';
  const rodLeftBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.abs(rodLeftEndLocal.x) - gabInnerHalfWidth - gabJawWidth + 0.12,
      0.30,
      0.36,
    ),
    driverMaterial,
  );
  rodLeftBody.position.set(
    (rodLeftEndLocal.x - gabInnerHalfWidth - gabJawWidth) / 2,
    0.18,
    0,
  );
  rodLeftBody.userData.role = 'off-frame-eccentric-rod-body';
  const rodCrownBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.30, 0.38),
    driverMaterial,
  );
  rodCrownBody.position.set(0.77, 0.18, 0);
  rodCrownBody.userData.role = 'gab-crown-to-handle-pivot-rod-body';
  const gabTopBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * (gabInnerHalfWidth + gabJawWidth),
      gabTopBridgeMaximumY - gabTopBridgeMinimumY,
      0.46,
    ),
    driverMaterial,
  );
  gabTopBridge.position.set(
    0,
    (gabTopBridgeMinimumY + gabTopBridgeMaximumY) / 2,
    0.02,
  );
  gabTopBridge.userData.role = 'closed-crown-of-downward-opening-gab';
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(
        gabJawWidth,
        gabMouthDepth + gabTopBridgeMaximumY,
        0.46,
      ),
      driverMaterial,
    );
    jaw.position.set(
      sign * (gabInnerHalfWidth + gabJawWidth / 2),
      (gabTopBridgeMaximumY - gabMouthDepth) / 2,
      0.02,
    );
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-open-bottom-gab-jaw`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, gabMouthDepth * 0.74, 0.54),
      brassMaterial,
    );
    shoe.position.set(
      sign * gabInnerHalfWidth,
      -gabMouthDepth * 0.24,
      0.08,
    );
    shoe.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-driving-shoe`;
    eccentricRod.add(shoe);
    return shoe;
  });
  const lowerHandlePath = [
    new THREE.Vector2(0.48, 0.12),
    new THREE.Vector2(0.88, 0.02),
    new THREE.Vector2(1.44, -0.04),
    new THREE.Vector2(2.05, -0.05),
    lowerGripLocal.clone(),
  ];
  const lowerHandle = makeTube(
    lowerHandlePath,
    0.16,
    driverMaterial,
    0,
  );
  lowerHandle.userData.role =
    'rigid-lower-reaction-handle-integral-with-the-eccentric-rod';
  const lowerHandleGrip = cylinderAlongZ(0.18, 0.54, darkMaterial, 28);
  lowerHandleGrip.position.set(lowerGripLocal.x, lowerGripLocal.y, 0.02);
  lowerHandleGrip.userData.role = 'source-lower-rigid-handle-grip';
  const lowerGripAnchor = new THREE.Group();
  lowerGripAnchor.position.set(lowerGripLocal.x, lowerGripLocal.y, 0);
  lowerGripAnchor.userData.role = 'exact-integral-lower-grip-center';
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const offFrameRodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.075, 0.04),
    whiteMaterial,
  );
  offFrameRodIndex.position.set(-4.15, 0.36, 0.24);
  offFrameRodIndex.userData.role = 'white-index-on-moving-eccentric-rod';
  eccentricRod.add(
    gabCenterAnchor,
    gabTopBridge,
    lowerGripAnchor,
    lowerHandle,
    lowerHandleGrip,
    offFrameRodIndex,
    rodCrownBody,
    rodLeftBody,
  );
  root.add(eccentricRod);

  const upperCamHandle = new THREE.Group();
  upperCamHandle.position.set(camPivotLocal.x, camPivotLocal.y, 0.42);
  upperCamHandle.userData.axis = Z_AXIS.clone();
  upperCamHandle.userData.role =
    'separate-upper-cam-handle-pivoted-on-the-eccentric-rod';
  const upperCamPath = [
    camContactLocal.clone(),
    new THREE.Vector2(-0.60, 0.28),
    new THREE.Vector2(-0.43, 0.13),
    new THREE.Vector2(-0.18, 0.03),
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.48, 0.03),
    new THREE.Vector2(1.00, 0.13),
    new THREE.Vector2(1.62, 0.10),
    upperGripLocal.clone(),
  ];
  const upperCamBody = boredCamHandle(upperCamPath, .145, .132, accentMaterial);
  upperCamBody.userData.role = 'curved-cam-and-upper-lifting-handle';
  upperCamBody.position.z = .12;
  const camContactNose = cylinderAlongZ(camToeRadius, .16, accentMaterial, 128);
  camContactNose.position.set(camContactLocal.x, camContactLocal.y, -.82);
  const camToeNeck = cylinderAlongZ(.10, 1.02, accentMaterial, 32);
  camToeNeck.userData.role = 'axial-neck-joining-rear-cam-toe-to-visible-handle';
  camToeNeck.position.set(camContactLocal.x, camContactLocal.y, -.345);
  upperCamHandle.add(camToeNeck);
  camContactNose.userData.role =
    'finite-round-cam-toe-bearing-on-rear-valve-lever-shoulder';
  const upperHandleGrip = cylinderAlongZ(0.18, 0.56, darkMaterial, 28);
  upperHandleGrip.position.set(upperGripLocal.x, upperGripLocal.y, 0.02);
  upperHandleGrip.userData.role = 'source-upper-moving-handle-grip';
  const upperGripAnchor = new THREE.Group();
  upperGripAnchor.position.set(upperGripLocal.x, upperGripLocal.y, 0);
  upperGripAnchor.userData.role = 'exact-upper-moving-grip-center';
  const upperHandleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.07, 0.04),
    whiteMaterial,
  );
  upperHandleIndex.position.set(1.72, 0.10, 0.19);
  upperHandleIndex.userData.role = 'white-index-on-upper-cam-handle';
  upperCamHandle.add(
    camContactNose,
    upperCamBody,
    upperGripAnchor,
    upperHandleGrip,
    upperHandleIndex,
  );
  const camPivotPin = cylinderAlongZ(0.12, 1.26, darkMaterial, 30);
  camPivotPin.position.set(camPivotLocal.x, camPivotLocal.y, 0.36);
  camPivotPin.userData.role =
    'independent-upper-handle-pivot-fixed-through-the-eccentric-rod';
  eccentricRod.add(camPivotPin, upperCamHandle);

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-frame-supporting-the-valve-rockshaft';
  const frameBeams = [
    [new THREE.Vector3(-1.08, -1.10, -1.00), new THREE.Vector3(-1.08, 2.92, -1.00)],
    [new THREE.Vector3(-1.08, 2.92, -1.00), new THREE.Vector3(0.62, 2.92, -1.00)],
    [new THREE.Vector3(-5.64, -1.10, -1.00), new THREE.Vector3(3.26, -1.10, -1.00)],
  ].map(([start, end], index) => {
    const beam = makeBeam(start, end, {
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: index === 2 ? 0.19 : 0.16,
    });
    beam.userData.role = `fixed-frame-member-${index + 1}`;
    frame.add(beam);
    return beam;
  });
  const valveBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.10, 12, 42),
    frameMaterial,
  );
  valveBearing.position.set(valvePivot.x, valvePivot.y, -0.82);
  valveBearing.userData.role = 'rear-valve-rockshaft-bearing';
  frame.add(valveBearing);
  root.add(frame);

  const camContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    whiteMaterial,
  );
  camContactMarker.userData.role = 'visible-upper-cam-to-valve-shoe-contact';
  const gabCaptureMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 20, 14),
    whiteMaterial,
  );
  gabCaptureMarker.userData.role = 'visible-gab-pin-capture';
  const heldClearMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 20, 14),
    whiteMaterial,
  );
  heldClearMarker.userData.role = 'visible-operator-held-gab-clearance';
  root.add(camContactMarker, gabCaptureMarker, heldClearMarker);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 6.6, 3.1),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-1.06, 0.62, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    camContactMarker,
    camContactNose,
    camToeNeck,
    camPivotPin,
    camSupportAnchor,
    camSupportShoe,
    eccentricRod,
    frame,
    frameBeams,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabJaws,
    gabTopBridge,
    heldClearMarker,
    lowerGripAnchor,
    lowerHandle,
    lowerHandleGrip,
    offFrameRodIndex,
    rodCrownBody,
    rodLeftBody,
    upperCamBody,
    upperCamHandle,
    upperGripAnchor,
    upperHandleGrip,
    upperHandleIndex,
    valveArm,
    valveBearing,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveRocker,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  };

  const geometry = {
    camToeRadius,
    camContactLocal: camContactLocal.clone(),
    camPivotLocal: camPivotLocal.clone(),
    camSupportHalfLength,
    camSupportValveLocal: camSupportValveLocal.clone(),
    cyclePeriod,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    inputTurnsPerCycle,
    lowerGripLocal: lowerGripLocal.clone(),
    maximumGabLift,
    maximumHandleAngle,
    rodLeftEndLocal: rodLeftEndLocal.clone(),
    rodStroke,
    sequenceBreaks,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCamContact: sourceRasterCamContact.clone(),
    sourceRasterCamPivot: sourceRasterCamPivot.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterLowerGrip: sourceRasterLowerGrip.clone(),
    sourceRasterRodLeftEnd: sourceRasterRodLeftEnd.clone(),
    sourceRasterSupportLeft: sourceRasterSupportLeft.clone(),
    sourceRasterSupportRight: sourceRasterSupportRight.clone(),
    sourceRasterUpperGrip: sourceRasterUpperGrip.clone(),
    sourceRasterValvePivot: sourceRasterValvePivot.clone(),
    sourceUnitsPerPixel,
    supportLeftLocal: supportLeftLocal.clone(),
    supportRightLocal: supportRightLocal.clone(),
    upperGripLocal: upperGripLocal.clone(),
    valveArmLength,
    valvePinLocal: valvePinLocal.clone(),
    valvePivot: valvePivot.clone(),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveRocker.rotation.z = state.rockerAngle;
    eccentricRod.position.set(state.gabCenter.x, state.gabCenter.y, 0.14);
    upperCamHandle.rotation.z = state.camAngle;
    camContactMarker.position.set(
      state.camSurfacePoint.x,
      state.camSurfacePoint.y,
      0.56,
    );
    camContactMarker.visible = state.camLiftActive;
    gabCaptureMarker.position.set(state.valvePin.x, state.valvePin.y, 1.18);
    gabCaptureMarker.visible = state.gabCaptured;
    heldClearMarker.position.set(
      state.gabCenter.x,
      state.gabCenter.y - gabMouthDepth,
      0.84,
    );
    heldClearMarker.visible = state.operatorHoldingHandle;
    root.userData.contacts = {
      camShoulder: {
        active: state.camContactActive,
        contactError: state.camContactError,
        point: state.camSurfacePoint.clone(),
        toeCenter: state.camContactPoint.clone(),
        withinSupport: state.camContactWithinSupport,
      },
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        fullyClear: state.pinFullyClearBelowGab,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      twoHandleOperator: {
        holding: state.operatorHoldingHandle,
        lowerGrip: state.lowerGrip.clone(),
        upperGrip: state.upperGrip.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    engagedRunning: cyclePeriod * 0.10,
    handleHalfRaised: cyclePeriod * 0.32,
    heldClearPositiveStroke: cyclePeriod * 0.465,
    heldClearStopped: cyclePeriod * 0.68,
    handleHalfLowered: cyclePeriod * 0.77,
    nextEngagedRunning: cyclePeriod * 0.92,
    sourceEngaged: 0,
  };
  const canonicalStates = {
    engagedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedStopped: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: 0,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'two-handle-cam-lifted-eccentric-rod-gab-pin-release';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.handleLiftAtAngle = handleLiftAtAngle;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.mechanism =
    'rod-integral-lower-grip-and-pivoted-upper-cam-handle-lift-downward-opening-gab-off-valve-pin';
  root.userData.nominalRockerAngleAtInput = nominalRockerAngleAtInput;
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.00;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    camContactMarker,
    gabCaptureMarker,
    heldClearMarker,
    offFrameRodIndex,
    upperHandleIndex,
    valvePinIndex,
    valveShaftIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.4, 3.1, 15.2),
    root,
    update,
  };
}

function loopHandlePinCamGabDisengager() {
  const root = new THREE.Group();

  // In Brown's 188 plate the long loop, its hidden working cam, and notch a
  // are one rigid lever pivoted on the eccentric rod. The separate leaf
  // spring is screwed to that rod. Hidden lines show the cam bearing directly
  // on the same valve pin captured by the open-bottom gab; there is no remote
  // rocker shoulder like 186/187. The handle first lifts on a conjugate cam,
  // then overtravels onto a relieved profile so the spring can latch it and
  // the released rod can reciprocate without striking the stationary pin.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(394, 326);
  const sourceRasterCamPivot = new THREE.Vector2(287, 290);
  const sourceRasterLoopGrip = new THREE.Vector2(35, 112);
  const sourceRasterNotchA = new THREE.Vector2(224, 174);
  const sourceRasterLeafAnchor = new THREE.Vector2(117, 288);
  const sourceRasterLeafFreeTip = new THREE.Vector2(207, 232);
  const sourceRasterCamBackCrown = new THREE.Vector2(361, 239);
  const sourceRasterRodLeftEnd = new THREE.Vector2(15, 319);
  const sourceRasterRodRightEnd = new THREE.Vector2(510, 326);
  const sourceUnitsPerPixel = 0.017;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const camPivotLocal = sourcePointFromRaster(sourceRasterCamPivot);
  const loopGripLocal = sourcePointFromRaster(sourceRasterLoopGrip)
    .sub(camPivotLocal);
  const notchALocal = sourcePointFromRaster(sourceRasterNotchA)
    .sub(camPivotLocal);
  const leafAnchorLocal = sourcePointFromRaster(sourceRasterLeafAnchor);
  const leafRestTipLocal = sourcePointFromRaster(sourceRasterLeafFreeTip);
  const rodLeftEndLocal = sourcePointFromRaster(sourceRasterRodLeftEnd);
  const rodRightEndLocal = sourcePointFromRaster(sourceRasterRodRightEnd);
  const camBackCrownLocal = sourcePointFromRaster(sourceRasterCamBackCrown)
    .sub(camPivotLocal);
  const leafRestPathLocal = [
    sourceRasterLeafAnchor,
    new THREE.Vector2(140, 286),
    new THREE.Vector2(164, 274),
    new THREE.Vector2(188, 250),
    sourceRasterLeafFreeTip,
  ].map(sourcePointFromRaster);

  const rodStroke = 0.28;
  const maximumHandleAngle = 0.70;
  const workingCamEndAngle = 0.50;
  const workingHandleFraction = workingCamEndAngle / maximumHandleAngle;
  const maximumGabLift = 0.68;
  const maximumCamRelief = 0.38;
  const gabPinRadius = 0.23;
  const gabInnerHalfWidth = gabPinRadius + 0.05;
  const gabJawWidth = 0.17;
  const gabMouthDepth = 0.28;
  const gabTopBridgeMinimumY = 0.36;
  const gabTopBridgeMaximumY = 0.56;
  const fullClearCouplingStart = gabMouthDepth + gabPinRadius + 0.03;
  const fullClearCouplingEnd = gabMouthDepth + gabPinRadius + 0.07;
  const springMaximumDeflection = 0.14;

  const camLawAtHandleAngle = (handleAngle) => {
    const angle = THREE.MathUtils.clamp(
      handleAngle,
      0,
      maximumHandleAngle,
    );
    const workingNormalized = THREE.MathUtils.clamp(
      angle / workingCamEndAngle,
      0,
      1,
    );
    const workingLaw = smootherstepLaw(workingNormalized);
    const lift = maximumGabLift * workingLaw.value;
    const liftDerivativeByAngle = angle < workingCamEndAngle
      ? maximumGabLift * workingLaw.firstDerivative / workingCamEndAngle
      : 0;
    const liftSecondDerivativeByAngle = angle < workingCamEndAngle
      ? maximumGabLift * workingLaw.secondDerivative
        / workingCamEndAngle ** 2
      : 0;
    const reliefNormalized = THREE.MathUtils.clamp(
      (angle - workingCamEndAngle)
        / (maximumHandleAngle - workingCamEndAngle),
      0,
      1,
    );
    const reliefLaw = smootherstepLaw(reliefNormalized);
    const relief = maximumCamRelief * reliefLaw.value;
    return {
      angle,
      lift,
      liftDerivativeByAngle,
      liftSecondDerivativeByAngle,
      relief,
      reliefNormalized,
      workingNormalized,
    };
  };

  const camProfileAtHandleAngle = (handleAngle) => {
    const law = camLawAtHandleAngle(handleAngle);
    const pinFromPivotWorld = new THREE.Vector2(
      -camPivotLocal.x,
      -law.lift - camPivotLocal.y,
    );
    const pitchPointLocal = rotate2(-law.angle, pinFromPivotWorld);
    const pitchDerivativeWorld = new THREE.Vector2(
      pinFromPivotWorld.y,
      -law.liftDerivativeByAngle - pinFromPivotWorld.x,
    );
    const pitchTangentLocal = rotate2(
      -law.angle,
      pitchDerivativeWorld,
    ).normalize();
    let profileNormalLocal = new THREE.Vector2(
      -pitchTangentLocal.y,
      pitchTangentLocal.x,
    );
    if (profileNormalLocal.dot(pitchPointLocal.clone().negate()) < 0) {
      profileNormalLocal.negate();
    }
    const profilePointLocal = pitchPointLocal.clone().addScaledVector(
      profileNormalLocal,
      gabPinRadius + law.relief,
    );
    return {
      ...law,
      pitchPointLocal,
      pitchTangentLocal,
      profileNormalLocal,
      profilePointLocal,
    };
  };

  const camProfileSampleCount = 160;
  const camProfilePointsLocal = Array.from(
    { length: camProfileSampleCount + 1 },
    (_, index) => camProfileAtHandleAngle(
      maximumHandleAngle * index / camProfileSampleCount,
    ).profilePointLocal,
  );
  if (maximumGabLift <= fullClearCouplingEnd) {
    throw new RangeError('Movement 188 cam cannot lift the gab clear of its pin.');
  }

  const cyclePeriod = 18;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    engagedRunEnd: 0.18,
    handleLiftStart: 0.22,
    camLiftEnd: 0.34,
    handleLatchEnd: 0.40,
    latchedRunEnd: 0.64,
    springReleaseEnd: 0.70,
    reliefReturnEnd: 0.76,
    camLowerEnd: 0.88,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.engagedRunEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.engagedRunEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handleLatchEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.latchedRunEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLatchEnd,
        sequenceBreaks.latchedRunEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.camLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.camLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.camLiftEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLiftStart,
        sequenceBreaks.camLiftEnd,
        0,
        workingHandleFraction,
      );
    } else if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.camLiftEnd,
        sequenceBreaks.handleLatchEnd,
        workingHandleFraction,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleLatchEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.reliefReturnEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.springReleaseEnd,
        sequenceBreaks.reliefReturnEnd,
        1,
        workingHandleFraction,
      );
    } else if (
      phase >= sequenceBreaks.reliefReturnEnd
        && phase < sequenceBreaks.camLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.reliefReturnEnd,
        sequenceBreaks.camLowerEnd,
        workingHandleFraction,
        0,
      );
    }

    let latch = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.camLiftEnd,
        sequenceBreaks.handleLatchEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleLatchEnd
        && phase < sequenceBreaks.latchedRunEnd
    ) {
      latch.value = 1;
    } else if (
      phase >= sequenceBreaks.latchedRunEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      latch = transitionLaw(
        phase,
        sequenceBreaks.latchedRunEnd,
        sequenceBreaks.springReleaseEnd,
        1,
        0,
      );
    }

    let spring = { ratePerPhase: 0, value: 0 };
    if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.camLiftEnd,
        sequenceBreaks.handleLatchEnd,
        -springMaximumDeflection,
      );
    } else if (
      phase >= sequenceBreaks.latchedRunEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) {
      spring = bumpLaw(
        phase,
        sequenceBreaks.latchedRunEnd,
        sequenceBreaks.springReleaseEnd,
        springMaximumDeflection,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-pin';
    if (
      phase >= sequenceBreaks.engagedRunEnd
        && phase < sequenceBreaks.handleLiftStart
    ) stage = 'eccentric-stopped-with-direct-cam-aligned-to-pin';
    else if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.camLiftEnd
    ) stage = 'loop-handle-cam-lifting-gab-directly-from-pin';
    else if (
      phase >= sequenceBreaks.camLiftEnd
        && phase < sequenceBreaks.handleLatchEnd
    ) stage = 'loop-handle-overtravel-leaf-spring-passing-notch-a';
    else if (
      phase >= sequenceBreaks.handleLatchEnd
        && phase < sequenceBreaks.latchedRunEnd
    ) stage = 'leaf-spring-latched-gab-clear-while-eccentric-rod-runs';
    else if (
      phase >= sequenceBreaks.latchedRunEnd
        && phase < sequenceBreaks.springReleaseEnd
    ) stage = 'leaf-spring-flexing-out-of-notch-a';
    else if (
      phase >= sequenceBreaks.springReleaseEnd
        && phase < sequenceBreaks.reliefReturnEnd
    ) stage = 'loop-handle-returning-through-relieved-cam-overtravel';
    else if (
      phase >= sequenceBreaks.reliefReturnEnd
        && phase < sequenceBreaks.camLowerEnd
    ) stage = 'direct-pin-cam-lowering-gab-to-recapture';
    else if (phase >= sequenceBreaks.camLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-pin';
    }

    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      latchAccelerationPerPhaseSquared:
        latch.accelerationPerPhaseSquared,
      latchEngagement: latch.value,
      latchRatePerPhase: latch.ratePerPhase,
      phase,
      springDeflection: spring.value,
      springDeflectionRatePerPhase: spring.ratePerPhase,
      stage,
    };
  };

  const notchALocalAtHandleAngle = (handleAngle) => camPivotLocal
    .clone()
    .add(rotate2(handleAngle, notchALocal));
  const loopGripLocalAtHandleAngle = (handleAngle) => camPivotLocal
    .clone()
    .add(rotate2(handleAngle, loopGripLocal));
  const leafSpringPointsAtConfiguration = ({
    handleAngle,
    latchEngagement,
    springDeflection,
  }) => {
    const notchLocal = notchALocalAtHandleAngle(handleAngle);
    const desiredTip = leafRestTipLocal.clone().lerp(
      notchLocal,
      latchEngagement,
    );
    const tipDisplacement = desiredTip.clone().sub(leafRestTipLocal);
    return leafRestPathLocal.map((restPoint, index) => {
      const normalized = index / (leafRestPathLocal.length - 1);
      const bendWeight = smootherstepLaw(normalized).value;
      return new THREE.Vector3(
        restPoint.x + tipDisplacement.x * bendWeight,
        restPoint.y + tipDisplacement.y * bendWeight,
        0.64 + springDeflection * bendWeight,
      );
    });
  };

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
    latchEngagement = 0,
    springDeflection = 0,
  }) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const handleAngle = maximumHandleAngle * resolvedHandleFraction;
    const cam = camProfileAtHandleAngle(handleAngle);
    const gabLift = cam.lift;
    const gabLiftVelocity = cam.liftDerivativeByAngle
      * handleAngularVelocity;
    const gabLiftAcceleration = cam.liftSecondDerivativeByAngle
      * handleAngularVelocity ** 2
      + cam.liftDerivativeByAngle * handleAcceleration;
    const gabCenter = new THREE.Vector2(
      rodStroke * Math.sin(resolvedInputAngle),
      gabLift,
    );
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const nominalValvePinX = gabCenter.x;
    const valvePin = new THREE.Vector2(
      nominalValvePinX * couplingBlend,
      0,
    );
    const pinRelativeToGab = valvePin.clone().sub(gabCenter);
    const camPivot = gabCenter.clone().add(camPivotLocal);
    const camProfilePoint = camPivot.clone().add(
      rotate2(handleAngle, cam.profilePointLocal),
    );
    const camProfileNormalWorld = rotate2(
      handleAngle,
      cam.profileNormalLocal,
    );
    const pinSurfacePoint = valvePin.clone().addScaledVector(
      camProfileNormalWorld,
      gabPinRadius,
    );
    const camPinIntendedGap = camProfilePoint.distanceTo(pinSurfacePoint);

    const cosine = Math.cos(handleAngle);
    const sine = Math.sin(handleAngle);
    let camProfileMinimumGap = Infinity;
    for (const point of camProfilePointsLocal) {
      const worldX = camPivot.x + cosine * point.x - sine * point.y;
      const worldY = camPivot.y + sine * point.x + cosine * point.y;
      camProfileMinimumGap = Math.min(
        camProfileMinimumGap,
        Math.hypot(worldX - valvePin.x, worldY - valvePin.y)
          - gabPinRadius,
      );
    }
    // Include the analytical point at the current handle angle as well as the
    // sampled render mesh. This preserves exact tangency between samples while
    // the sampled points guard the rest of the rigid profile against contact.
    camProfileMinimumGap = Math.min(
      camProfileMinimumGap,
      camProfilePoint.distanceTo(valvePin) - gabPinRadius,
    );

    const notchALocalPosition = notchALocalAtHandleAngle(handleAngle);
    const notchA = gabCenter.clone().add(notchALocalPosition);
    const loopGrip = gabCenter.clone().add(
      loopGripLocalAtHandleAngle(handleAngle),
    );
    const leafSpringPointsLocal = leafSpringPointsAtConfiguration({
      handleAngle,
      latchEngagement: THREE.MathUtils.clamp(latchEngagement, 0, 1),
      springDeflection,
    });
    const leafSpringTipLocal = leafSpringPointsLocal.at(-1);
    const leafSpringTip = gabCenter.clone().add(
      new THREE.Vector2(leafSpringTipLocal.x, leafSpringTipLocal.y),
    );
    const latchPlanarGap = leafSpringTip.distanceTo(notchA);
    const latchGap = Math.hypot(latchPlanarGap, springDeflection);
    const latchCaptureError = latchEngagement >= 1 - 1e-12
      ? latchGap
      : 0;

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth - gabJawWidth, jawMinimumY),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(-gabInnerHalfWidth, gabTopBridgeMinimumY),
      new THREE.Vector2(gabInnerHalfWidth, gabTopBridgeMaximumY),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = gabLift <= 1e-12
      && couplingBlend >= 1 - 1e-12
      && pinInsideGabMouth;

    return {
      camPinIntendedGap,
      camPivot,
      camProfileMinimumGap,
      camProfileNormalWorld,
      camProfilePoint,
      camProfileRelief: cam.relief,
      camProfileTangentLocal: cam.pitchTangentLocal.clone(),
      camProfileWorkingNormalLocal: cam.profileNormalLocal.clone(),
      couplingBlend,
      gabCaptured,
      gabCenter,
      gabLift,
      gabLiftAcceleration,
      gabLiftVelocity,
      handleAcceleration,
      handleAngle,
      handleAngularVelocity,
      handleFraction: resolvedHandleFraction,
      inputAngle: resolvedInputAngle,
      latchCaptureError,
      latchEngagement: THREE.MathUtils.clamp(latchEngagement, 0, 1),
      latchGap,
      latchPlanarGap,
      leafSpringPointsLocal,
      leafSpringTip,
      leafSpringTipLocal: leafSpringTipLocal.clone(),
      leftJawClearance,
      loopGrip,
      minimumGabSolidClearance,
      nominalValvePinX,
      notchA,
      notchALocalPosition,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      pinSurfacePoint,
      rightJawClearance,
      springDeflection,
      topBridgeClearance,
      valvePin,
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumHandleAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumHandleAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
      latchEngagement: sequence.latchEngagement,
      springDeflection: sequence.springDeflection,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.latchAcceleration = sequence.latchAccelerationPerPhaseSquared
      * phaseRate ** 2;
    state.latchRate = sequence.latchRatePerPhase * phaseRate;
    state.springDeflectionRate = sequence.springDeflectionRatePerPhase
      * phaseRate;
    state.stage = sequence.stage;
    state.camContactActive = (
      sequence.stage === 'loop-handle-cam-lifting-gab-directly-from-pin'
        || sequence.stage === 'direct-pin-cam-lowering-gab-to-recapture'
    );
    state.camRelievedForRodMotion = (
      sequence.stage
        === 'leaf-spring-latched-gab-clear-while-eccentric-rod-runs'
        || sequence.stage === 'leaf-spring-flexing-out-of-notch-a'
    );
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.19,
    roughness: 0.51,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  const valveGear = new THREE.Group();
  valveGear.position.z = -0.30;
  valveGear.userData.role =
    'locally-rendered-guided-valve-gear-carrier-with-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 1.86, brassMaterial, 34);
  valvePin.position.z = 0.66;
  valvePin.userData.role =
    'round-valve-gear-pin-serving-as-gab-capture-and-direct-cam-follower';
  const valvePinBoss = boredBoss(0.38, 0.20, gabPinRadius + .012, drivenMaterial);
  valvePinBoss.position.z = 0.12;
  valvePinBoss.userData.role = 'rear-boss-of-guided-valve-gear-pin';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valvePinIndex = new THREE.Mesh(
    new THREE.TorusGeometry(gabPinRadius * 0.66, 0.033, 8, 28),
    whiteMaterial,
  );
  valvePinIndex.position.z = 1.60;
  valvePinIndex.userData.role = 'white-index-on-valve-gear-pin';
  const valveCarrierTongue = new THREE.Mesh(
    new THREE.BoxGeometry(1.32, 0.20, 0.30),
    drivenMaterial,
  );
  valveCarrierTongue.position.set(0, -0.53, -0.08);
  valveCarrierTongue.userData.role = 'rear-guided-valve-gear-pin-carrier';
  const valveCarrierWeb = new THREE.Mesh(plate(polygonClipping.difference(
    poly([[-.10, -.49], [.10, -.49], [.10, -.08], [-.10, -.08]]),
    poly(circle([0, 0], gabPinRadius + .012, 64))), -.14, .14), drivenMaterial);
  valveCarrierWeb.position.z = -.08;
  valveCarrierWeb.userData.role = 'valve-pin-carrier-web';
  valveGear.add(
    valveCarrierTongue,
    valveCarrierWeb,
    valvePin,
    valvePinAnchor,
    valvePinBoss,
    valvePinIndex,
  );
  root.add(valveGear);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.12;
  eccentricRod.userData.role =
    'reciprocating-eccentric-rod-with-downward-gab-loop-cam-and-leaf-latch';
  const rodLeftBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.abs(rodLeftEndLocal.x) - gabInnerHalfWidth - gabJawWidth + 0.08,
      0.32,
      0.38,
    ),
    driverMaterial,
  );
  rodLeftBody.position.set(
    (rodLeftEndLocal.x - gabInnerHalfWidth - gabJawWidth) / 2,
    0.12,
    0,
  );
  rodLeftBody.userData.role = 'off-frame-eccentric-rod-body';
  const rodMiddleBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.48, 0.32, 0.40),
    driverMaterial,
  );
  rodMiddleBody.position.set(-1.48, 0.12, 0);
  rodMiddleBody.userData.role = 'rod-body-supporting-loop-handle-pivot';
  const rodRightTail = makeTube(
    [
      new THREE.Vector2(0.40, 0.20),
      new THREE.Vector2(0.76, 0.14),
      new THREE.Vector2(1.22, 0.03),
      rodRightEndLocal.clone(),
    ],
    0.15,
    driverMaterial,
    0,
  );
  rodRightTail.userData.role = 'source-short-tail-beyond-gab';
  const gabTopBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * (gabInnerHalfWidth + gabJawWidth),
      gabTopBridgeMaximumY - gabTopBridgeMinimumY,
      0.48,
    ),
    driverMaterial,
  );
  gabTopBridge.position.set(
    0,
    (gabTopBridgeMinimumY + gabTopBridgeMaximumY) / 2,
    0.02,
  );
  gabTopBridge.userData.role = 'closed-crown-of-downward-opening-gab';
  const gabCrownArch = makeTube(
    [
      new THREE.Vector2(-0.56, 0.23),
      new THREE.Vector2(-0.38, 0.65),
      new THREE.Vector2(0, 0.87),
      new THREE.Vector2(0.38, 0.67),
      new THREE.Vector2(0.57, 0.25),
    ],
    0.145,
    driverMaterial,
    0.01,
  );
  gabCrownArch.userData.role = 'source-raised-outer-gab-crown';
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(
        gabJawWidth,
        gabMouthDepth + gabTopBridgeMaximumY,
        0.48,
      ),
      driverMaterial,
    );
    jaw.position.set(
      sign * (gabInnerHalfWidth + gabJawWidth / 2),
      (gabTopBridgeMaximumY - gabMouthDepth) / 2,
      0.02,
    );
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-open-bottom-gab-jaw`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, gabMouthDepth * 0.74, 0.56),
      brassMaterial,
    );
    shoe.position.set(
      sign * gabInnerHalfWidth,
      -gabMouthDepth * 0.22,
      0.09,
    );
    shoe.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-driving-shoe`;
    eccentricRod.add(shoe);
    return shoe;
  });
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const offFrameRodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.075, 0.04),
    whiteMaterial,
  );
  offFrameRodIndex.position.set(-5.30, 0.31, 0.24);
  offFrameRodIndex.userData.role = 'white-index-on-moving-eccentric-rod';
  eccentricRod.add(
    gabCenterAnchor,
    gabCrownArch,
    gabTopBridge,
    offFrameRodIndex,
    rodLeftBody,
    rodMiddleBody,
    rodRightTail,
  );
  root.add(eccentricRod);

  const loopCamHandle = new THREE.Group();
  loopCamHandle.position.set(camPivotLocal.x, camPivotLocal.y, 0.42);
  loopCamHandle.userData.axis = Z_AXIS.clone();
  loopCamHandle.userData.role =
    'single-rigid-loop-handle-with-direct-pin-cam-and-notch-a';
  const loopCenterPath = [
    new THREE.Vector2(-0.46, 0.34),
    new THREE.Vector2(-1.05, 1.35),
    new THREE.Vector2(-1.45, 3.10),
    new THREE.Vector2(-2.75, 3.76),
    new THREE.Vector2(-4.10, 3.12),
    new THREE.Vector2(-4.16, 2.54),
    new THREE.Vector2(-3.50, 2.24),
    new THREE.Vector2(-2.45, 2.04),
    new THREE.Vector2(-1.14, 0.86),
  ];
  const loopHandleBody = makeTube(
    loopCenterPath,
    0.115,
    accentMaterial,
    0,
    true,
  );
  loopHandleBody.userData.role = 'source-rigid-hollow-loop-handle';
  const handleStem = makeTube(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(-0.20, 0.10),
      new THREE.Vector2(-0.46, 0.34),
    ],
    0.13,
    accentMaterial,
    0,
  );
  handleStem.userData.role = 'rigid-stem-joining-loop-to-cam-pivot';

  const camLobe = new THREE.Group();
  camLobe.userData.role =
    'slender-conjugate-direct-pin-cam-with-overtravel-relief';
  const camBackArm = makeTube(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0.34),
      new THREE.Vector2(0.72, 0.88),
      camBackCrownLocal.clone(),
      new THREE.Vector2(1.54, 0.76),
      new THREE.Vector2(1.63, 0.24),
      camProfilePointsLocal[0].clone(),
    ],
    0.12,
    accentMaterial,
    -0.10,
  );
  camBackArm.userData.role = 'source-visible-upper-back-of-direct-pin-cam';
  const camWorkingRail = makeTube(
    camProfilePointsLocal,
    0.085,
    accentMaterial,
    -0.46,
  );
  camWorkingRail.userData.role =
    'hidden-conjugate-working-rail-bearing-directly-on-valve-pin';
  const camWorkingEdge = makeTube(
    camProfilePointsLocal,
    0.025,
    brassMaterial,
    -0.28,
  );
  camWorkingEdge.userData.role =
    'visible-working-and-relieved-edge-of-direct-pin-cam';
  camLobe.add(camBackArm, camWorkingRail);
  const notchLipUpper = makeBeam(
    new THREE.Vector3(
      notchALocal.x - 0.18,
      notchALocal.y + 0.09,
      0.22,
    ),
    new THREE.Vector3(notchALocal.x, notchALocal.y, 0.22),
    {
      color: PALETTE.accent,
      depth: 0.10,
      jointRadius: 0.001,
      thickness: 0.085,
    },
  );
  notchLipUpper.userData.role = 'upper-working-lip-of-notch-a';
  const notchLipLower = makeBeam(
    new THREE.Vector3(notchALocal.x, notchALocal.y, 0.22),
    new THREE.Vector3(
      notchALocal.x + 0.17,
      notchALocal.y - 0.10,
      0.22,
    ),
    {
      color: PALETTE.accent,
      depth: 0.10,
      jointRadius: 0.001,
      thickness: 0.085,
    },
  );
  notchLipLower.userData.role = 'lower-working-lip-of-notch-a';
  const notchAAnchor = new THREE.Group();
  notchAAnchor.position.set(notchALocal.x, notchALocal.y, 0.22);
  notchAAnchor.userData.role = 'exact-moving-center-of-notch-a';
  const loopGripAnchor = new THREE.Group();
  loopGripAnchor.position.set(loopGripLocal.x, loopGripLocal.y, 0);
  loopGripAnchor.userData.role = 'source-center-of-rigid-loop-grip';
  const handleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.07, 0.04),
    whiteMaterial,
  );
  handleIndex.position.set(-2.83, 3.71, 0.18);
  handleIndex.rotation.z = -0.46;
  handleIndex.userData.role = 'white-index-on-rigid-loop-handle';
  loopCamHandle.add(
    camLobe,
    camWorkingEdge,
    handleIndex,
    handleStem,
    loopGripAnchor,
    loopHandleBody,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
  );
  const camPivotPin = cylinderAlongZ(0.12, 1.30, darkMaterial, 30);
  camPivotPin.position.set(camPivotLocal.x, camPivotLocal.y, 0.36);
  camPivotPin.userData.role =
    'loop-handle-cam-pivot-fixed-through-eccentric-rod';
  eccentricRod.add(camPivotPin, loopCamHandle);

  const leafSpring = makeDynamicCable({
    color: PALETTE.brass,
    maxSegments: 64,
    radius: 0.07,
  });
  leafSpring.userData.role =
    'separate-rod-mounted-leaf-spring-catching-moving-notch-a';
  const leafSpringAnchor = cylinderAlongZ(0.105, 0.88, darkMaterial, 28);
  leafSpringAnchor.position.set(
    leafAnchorLocal.x,
    leafAnchorLocal.y,
    0.49,
  );
  leafSpringAnchor.userData.role = 'fixed-screw-root-of-leaf-spring';
  const leafSpringTipIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 20, 14),
    whiteMaterial,
  );
  leafSpringTipIndex.position.set(
    leafRestTipLocal.x,
    leafRestTipLocal.y,
    0.64,
  );
  leafSpringTipIndex.userData.role = 'white-index-on-leaf-spring-catch-tip';
  eccentricRod.add(leafSpring, leafSpringAnchor, leafSpringTipIndex);

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-frame-and-valve-carrier-guide';
  const frameBeams = [
    [new THREE.Vector3(-6.55, -1.15, -1.02), new THREE.Vector3(2.52, -1.15, -1.02)],
    [new THREE.Vector3(-0.92, -0.82, -0.90), new THREE.Vector3(0.92, -0.82, -0.90)],
    [new THREE.Vector3(-0.92, -1.02, -0.90), new THREE.Vector3(-0.92, -0.48, -0.90)],
    [new THREE.Vector3(0.92, -1.02, -0.90), new THREE.Vector3(0.92, -0.48, -0.90)],
  ].map(([start, end], index) => {
    const beam = makeBeam(start, end, {
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: index === 0 ? 0.19 : 0.14,
    });
    beam.userData.role = `fixed-frame-member-${index + 1}`;
    frame.add(beam);
    return beam;
  });
  const valveGuideRail = new THREE.Mesh(
    new THREE.BoxGeometry(1.86, 0.12, 0.26),
    frameMaterial,
  );
  valveGuideRail.position.set(0, -0.53, -0.64);
  valveGuideRail.userData.role = 'rear-horizontal-guide-for-valve-pin-carrier';
  frame.add(valveGuideRail);
  root.add(frame);

  const camContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.070, 20, 14),
    whiteMaterial,
  );
  camContactMarker.userData.role = 'visible-direct-cam-to-valve-pin-contact';
  const gabCaptureMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.070, 20, 14),
    whiteMaterial,
  );
  gabCaptureMarker.userData.role = 'visible-gab-pin-capture';
  const latchMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 20, 14),
    whiteMaterial,
  );
  latchMarker.userData.role = 'visible-leaf-spring-notch-a-capture';
  const relievedCamMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 20, 14),
    whiteMaterial,
  );
  relievedCamMarker.userData.role = 'visible-relieved-cam-clear-of-valve-pin';
  root.add(
    camContactMarker,
    gabCaptureMarker,
    latchMarker,
    relievedCamMarker,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.4, 7.3, 3.2),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-2.00, 1.35, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    camBackArm,
    camContactMarker,
    camLobe,
    camPivotPin,
    camWorkingRail,
    camWorkingEdge,
    eccentricRod,
    frame,
    frameBeams,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabCrownArch,
    gabJaws,
    gabTopBridge,
    handleIndex,
    handleStem,
    latchMarker,
    leafSpring,
    leafSpringAnchor,
    leafSpringTipIndex,
    loopCamHandle,
    loopGripAnchor,
    loopHandleBody,
    notchAAnchor,
    notchLipLower,
    notchLipUpper,
    offFrameRodIndex,
    relievedCamMarker,
    rodLeftBody,
    rodMiddleBody,
    rodRightTail,
    valveCarrierTongue,
    valveCarrierWeb,
    valveGear,
    valveGuideRail,
    valvePin,
    valvePinAnchor,
    valvePinBoss,
    valvePinIndex,
  };

  const geometry = {
    camBackCrownLocal: camBackCrownLocal.clone(),
    camPivotLocal: camPivotLocal.clone(),
    camProfilePointsLocal: camProfilePointsLocal.map((point) => point.clone()),
    camProfileSampleCount,
    cyclePeriod,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    inputTurnsPerCycle,
    leafAnchorLocal: leafAnchorLocal.clone(),
    leafRestPathLocal: leafRestPathLocal.map((point) => point.clone()),
    leafRestTipLocal: leafRestTipLocal.clone(),
    loopGripLocal: loopGripLocal.clone(),
    maximumCamRelief,
    maximumGabLift,
    maximumHandleAngle,
    notchALocal: notchALocal.clone(),
    rodLeftEndLocal: rodLeftEndLocal.clone(),
    rodRightEndLocal: rodRightEndLocal.clone(),
    rodStroke,
    sequenceBreaks,
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCamBackCrown: sourceRasterCamBackCrown.clone(),
    sourceRasterCamPivot: sourceRasterCamPivot.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterLeafAnchor: sourceRasterLeafAnchor.clone(),
    sourceRasterLeafFreeTip: sourceRasterLeafFreeTip.clone(),
    sourceRasterLoopGrip: sourceRasterLoopGrip.clone(),
    sourceRasterNotchA: sourceRasterNotchA.clone(),
    sourceRasterRodLeftEnd: sourceRasterRodLeftEnd.clone(),
    sourceRasterRodRightEnd: sourceRasterRodRightEnd.clone(),
    sourceUnitsPerPixel,
    springMaximumDeflection,
    workingCamEndAngle,
    workingHandleFraction,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveGear.position.set(state.valvePin.x, state.valvePin.y, -0.30);
    eccentricRod.position.set(state.gabCenter.x, state.gabCenter.y, 0.12);
    loopCamHandle.rotation.z = state.handleAngle;
    const springCurve = new THREE.CatmullRomCurve3(
      state.leafSpringPointsLocal,
      false,
      'centripetal',
    );
    leafSpring.userData.setPoints(springCurve.getSpacedPoints(48));
    leafSpringTipIndex.position.copy(state.leafSpringTipLocal);
    camContactMarker.position.set(
      state.pinSurfacePoint.x,
      state.pinSurfacePoint.y,
      1.02,
    );
    camContactMarker.visible = state.camContactActive;
    gabCaptureMarker.position.set(state.valvePin.x, state.valvePin.y, 1.22);
    gabCaptureMarker.visible = state.gabCaptured;
    latchMarker.position.set(state.notchA.x, state.notchA.y, 0.88);
    latchMarker.visible = state.latchEngagement > 1 - 1e-8;
    relievedCamMarker.position.set(
      state.camProfilePoint.x,
      state.camProfilePoint.y,
      0.92,
    );
    relievedCamMarker.visible = state.camRelievedForRodMotion;
    root.userData.contacts = {
      camPin: {
        active: state.camContactActive,
        intendedGap: state.camPinIntendedGap,
        minimumProfileGap: state.camProfileMinimumGap,
        point: state.pinSurfacePoint.clone(),
        relief: state.camProfileRelief,
      },
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        fullyClear: state.pinFullyClearBelowGab,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      notchA: {
        captureError: state.latchCaptureError,
        engagement: state.latchEngagement,
        gap: state.latchGap,
        point: state.notchA.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    camHalfLift: cyclePeriod * 0.28,
    fullLiftBeforeLatch: cyclePeriod * sequenceBreaks.camLiftEnd,
    handleOvertravelHalf: cyclePeriod * 0.37,
    latchedReleasedPositiveStroke: cyclePeriod * 0.46,
    leafFlexedForRelease: cyclePeriod * 0.67,
    camHalfLowered: cyclePeriod * 0.82,
    nextEngagedRunning: cyclePeriod * 0.94,
    sourceEngaged: 0,
  };
  const canonicalStates = {
    engagedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyLiftedAndLatched: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: 0,
      latchEngagement: 1,
    }),
    fullyLiftedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
      latchEngagement: 1,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
    workingCamAtFullLift: stateAtConfiguration({
      handleFraction: workingHandleFraction,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'loop-handle-direct-pin-conjugate-cam-leaf-spring-notch-gab-release';
  root.userData.blocks = blocks;
  root.userData.camLawAtHandleAngle = camLawAtHandleAngle;
  root.userData.camProfileAtHandleAngle = camProfileAtHandleAngle;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.leafSpringPointsAtConfiguration =
    leafSpringPointsAtConfiguration;
  root.userData.loopGripLocalAtHandleAngle = loopGripLocalAtHandleAngle;
  root.userData.mechanism =
    'rod-pivoted-loop-handle-conjugate-cam-lifts-gab-directly-from-valve-pin-then-leaf-spring-latches-notch-a-on-relieved-overtravel';
  root.userData.notchALocalAtHandleAngle = notchALocalAtHandleAngle;
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.00;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    camContactMarker,
    gabCaptureMarker,
    handleIndex,
    latchMarker,
    leafSpringTipIndex,
    offFrameRodIndex,
    relievedCamMarker,
    valvePinIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.2, 3.2, 15.4),
    root,
    update,
  };
}

function bellCrankHangerGabDisengager() {
  const root = new THREE.Group();

  // Brown gives 189 only as "another modification of 186." The plate itself
  // supplies the missing topology: a fixed operating-lever pivot carries a
  // short crank, that crank pulls a long hanger pinned to the right end of the
  // eccentric rod, and the rod rocks about its remote eccentric connection to
  // raise its gab off the valve-lever pin. These measured anchors all use the
  // center of the source gab pin as their common origin.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterGabPin = new THREE.Vector2(342, 406);
  const sourceRasterValvePivot = new THREE.Vector2(327, 282);
  const sourceRasterOperatingPivot = new THREE.Vector2(401, 235);
  const sourceRasterCrankPin = new THREE.Vector2(471, 235);
  const sourceRasterRodHangerPin = new THREE.Vector2(470, 404);
  const sourceRasterOperatingHandleTop = new THREE.Vector2(400, 28);
  const sourceRasterEccentricJoint = new THREE.Vector2(15, 399);
  const sourceRasterRodRightEnd = new THREE.Vector2(511, 407);
  const sourceUnitsPerPixel = 0.016;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterGabPin.x) * sourceUnitsPerPixel,
    (sourceRasterGabPin.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceRasterFromPoint = (point) => new THREE.Vector2(
    sourceRasterGabPin.x + point.x / sourceUnitsPerPixel,
    sourceRasterGabPin.y - point.y / sourceUnitsPerPixel,
  );

  const valvePivot = sourcePointFromRaster(sourceRasterValvePivot);
  const valvePinLocal = valvePivot.clone().multiplyScalar(-1);
  const valveArmLength = valvePinLocal.length();
  const operatingPivot = sourcePointFromRaster(
    sourceRasterOperatingPivot,
  );
  const sourceCrankPin = sourcePointFromRaster(sourceRasterCrankPin);
  const operatingCrankLocal = sourceCrankPin.clone().sub(operatingPivot);
  const operatingHandleTopLocal = sourcePointFromRaster(
    sourceRasterOperatingHandleTop,
  ).sub(operatingPivot);
  const rodHangerPinLocal = sourcePointFromRaster(
    sourceRasterRodHangerPin,
  );
  const eccentricJointLocal = sourcePointFromRaster(
    sourceRasterEccentricJoint,
  );
  const rodRightEndLocal = sourcePointFromRaster(sourceRasterRodRightEnd);
  const rodHangerFromEccentricLocal = rodHangerPinLocal.clone().sub(
    eccentricJointLocal,
  );
  const operatingCrankLength = operatingCrankLocal.length();
  const hangerLength = sourceCrankPin.distanceTo(rodHangerPinLocal);
  const gabToRodHangerLength = rodHangerPinLocal.length();
  const eccentricToRodHangerLength = rodHangerFromEccentricLocal.length();
  const eccentricToGabLength = eccentricJointLocal.length();

  const valveRockerAmplitude = 0.12;
  const maximumOperatingAngle = 1.02;
  const gabPinRadius = 0.20;
  const gabInnerHalfWidth = gabPinRadius + 0.07;
  const gabJawWidth = 0.18;
  const gabMouthDepth = 0.38;
  const gabTopBridgeMinimumY = 0.23;
  const gabTopBridgeMaximumY = 0.43;
  const fullClearCouplingStart = 0.54;
  const fullClearCouplingEnd = 0.62;

  const circleIntersectionNear = (
    firstCenter,
    firstRadius,
    secondCenter,
    secondRadius,
    preferred,
  ) => {
    const centerVector = secondCenter.clone().sub(firstCenter);
    const centerDistance = centerVector.length();
    if (
      centerDistance <= 1e-12
        || centerDistance > firstRadius + secondRadius + 1e-10
        || centerDistance < Math.abs(firstRadius - secondRadius) - 1e-10
    ) {
      throw new RangeError(
        'Movement 189 four-bar has no real assembly at this configuration.',
      );
    }
    const along = (
      firstRadius ** 2
        - secondRadius ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const heightSquared = Math.max(0, firstRadius ** 2 - along ** 2);
    const height = Math.sqrt(heightSquared);
    const unit = centerVector.divideScalar(centerDistance);
    const base = firstCenter.clone().addScaledVector(unit, along);
    const perpendicular = new THREE.Vector2(-unit.y, unit.x);
    const candidates = [
      base.clone().addScaledVector(perpendicular, height),
      base.clone().addScaledVector(perpendicular, -height),
    ];
    return candidates[0].distanceToSquared(preferred)
      <= candidates[1].distanceToSquared(preferred)
      ? candidates[0]
      : candidates[1];
  };

  const nominalEngagedPoseAtInputAngle = (inputAngle) => {
    const resolvedInputAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const nominalRockerAngle = valveRockerAmplitude
      * Math.sin(resolvedInputAngle);
    const nominalValvePin = pointInPose(
      valvePivot,
      nominalRockerAngle,
      valvePinLocal,
    );
    const preferredHangerPin = rodHangerPinLocal.clone().add(
      nominalValvePin,
    );
    const rodHangerPin = circleIntersectionNear(
      nominalValvePin,
      gabToRodHangerLength,
      sourceCrankPin,
      hangerLength,
      preferredHangerPin,
    );
    const rodAngle = Math.atan2(
      rodHangerPin.y - nominalValvePin.y,
      rodHangerPin.x - nominalValvePin.x,
    ) - Math.atan2(rodHangerPinLocal.y, rodHangerPinLocal.x);
    const eccentricJoint = nominalValvePin.clone().add(
      rotate2(rodAngle, eccentricJointLocal),
    );
    return {
      eccentricJoint,
      nominalRockerAngle,
      nominalValvePin,
      resolvedInputAngle,
      rodAngle,
      rodHangerPin,
    };
  };

  const rodPoseAtConfiguration = ({ handleFraction, inputAngle }) => {
    const resolvedHandleFraction = THREE.MathUtils.clamp(
      handleFraction,
      0,
      1,
    );
    const operatingAngle = maximumOperatingAngle
      * resolvedHandleFraction;
    const nominal = nominalEngagedPoseAtInputAngle(inputAngle);
    const crankPin = operatingPivot.clone().add(
      rotate2(operatingAngle, operatingCrankLocal),
    );
    const preferredHangerPin = nominal.rodHangerPin.clone().add(
      crankPin.clone().sub(sourceCrankPin),
    );
    const rodHangerPin = circleIntersectionNear(
      nominal.eccentricJoint,
      eccentricToRodHangerLength,
      crankPin,
      hangerLength,
      preferredHangerPin,
    );
    const rodAngle = Math.atan2(
      rodHangerPin.y - nominal.eccentricJoint.y,
      rodHangerPin.x - nominal.eccentricJoint.x,
    ) - Math.atan2(
      rodHangerFromEccentricLocal.y,
      rodHangerFromEccentricLocal.x,
    );
    const gabCenter = nominal.eccentricJoint.clone().add(
      rotate2(
        rodAngle,
        eccentricJointLocal.clone().multiplyScalar(-1),
      ),
    );
    const operatingHandleTop = operatingPivot.clone().add(
      rotate2(operatingAngle, operatingHandleTopLocal),
    );
    return {
      crankPin,
      eccentricJoint: nominal.eccentricJoint.clone(),
      gabCenter,
      nominal,
      operatingAngle,
      operatingHandleTop,
      resolvedHandleFraction,
      rodAngle,
      rodHangerPin,
    };
  };

  const maximumLiftAuditSamples = 4096;
  let minimumFullyRaisedGabLift = Infinity;
  for (let index = 0; index <= maximumLiftAuditSamples; index += 1) {
    const inputAngle = FULL_TURN * index / maximumLiftAuditSamples;
    const pose = rodPoseAtConfiguration({ handleFraction: 1, inputAngle });
    const lift = pose.gabCenter.y - pose.nominal.nominalValvePin.y;
    minimumFullyRaisedGabLift = Math.min(
      minimumFullyRaisedGabLift,
      lift,
    );
  }
  if (minimumFullyRaisedGabLift <= fullClearCouplingEnd) {
    throw new RangeError(
      'Movement 189 hanger cannot lift the gab clear of its pin.',
    );
  }

  const cyclePeriod = 18;
  const inputTurnsPerCycle = 6;
  const sequenceBreaks = Object.freeze({
    engagedRunEnd: 0.18,
    handleLiftStart: 0.22,
    handleLiftEnd: 0.36,
    releasedRunEnd: 0.64,
    handleLowerStart: 0.68,
    handleLowerEnd: 0.82,
  });

  const inputMotionAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let turns = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 2,
    };
    if (phase < sequenceBreaks.engagedRunEnd) {
      turns = transitionLaw(
        phase,
        0,
        sequenceBreaks.engagedRunEnd,
        0,
        2,
      );
    } else if (phase < sequenceBreaks.handleLiftEnd) {
      turns.value = 2;
    } else if (phase < sequenceBreaks.releasedRunEnd) {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLiftEnd,
        sequenceBreaks.releasedRunEnd,
        2,
        4,
      );
    } else if (phase < sequenceBreaks.handleLowerEnd) {
      turns.value = 4;
    } else {
      turns = transitionLaw(
        phase,
        sequenceBreaks.handleLowerEnd,
        1,
        4,
        inputTurnsPerCycle,
      );
    }
    return {
      accelerationPerPhaseSquared:
        FULL_TURN * turns.accelerationPerPhaseSquared,
      angle: FULL_TURN * turns.value,
      phase,
      ratePerPhase: FULL_TURN * turns.ratePerPhase,
      turns: turns.value,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    let handle = {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      value: 0,
    };
    if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.handleLiftEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLiftStart,
        sequenceBreaks.handleLiftEnd,
        0,
        1,
      );
    } else if (
      phase >= sequenceBreaks.handleLiftEnd
        && phase < sequenceBreaks.handleLowerStart
    ) {
      handle.value = 1;
    } else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) {
      handle = transitionLaw(
        phase,
        sequenceBreaks.handleLowerStart,
        sequenceBreaks.handleLowerEnd,
        1,
        0,
      );
    }

    let stage = 'engaged-eccentric-rod-driving-valve-gear';
    if (
      phase >= sequenceBreaks.engagedRunEnd
        && phase < sequenceBreaks.handleLiftStart
    ) stage = 'eccentric-stopped-at-gab-release-alignment';
    else if (
      phase >= sequenceBreaks.handleLiftStart
        && phase < sequenceBreaks.handleLiftEnd
    ) stage = 'operating-lever-and-hanger-lifting-gab';
    else if (
      phase >= sequenceBreaks.handleLiftEnd
        && phase < sequenceBreaks.releasedRunEnd
    ) stage = 'operator-holding-gab-clear-while-eccentric-runs';
    else if (
      phase >= sequenceBreaks.releasedRunEnd
        && phase < sequenceBreaks.handleLowerStart
    ) stage = 'eccentric-stopped-with-gab-held-clear';
    else if (
      phase >= sequenceBreaks.handleLowerStart
        && phase < sequenceBreaks.handleLowerEnd
    ) stage = 'operating-lever-lowering-gab-to-recapture-pin';
    else if (phase >= sequenceBreaks.handleLowerEnd) {
      stage = 'gab-recaptured-eccentric-rod-driving-valve-gear';
    }
    return {
      handleAccelerationPerPhaseSquared:
        handle.accelerationPerPhaseSquared,
      handleFraction: handle.value,
      handleRatePerPhase: handle.ratePerPhase,
      phase,
      stage,
    };
  };

  const stateAtConfiguration = ({
    handleAcceleration = 0,
    handleAngularVelocity = 0,
    handleFraction = 0,
    inputAngle = 0,
  }) => {
    const pose = rodPoseAtConfiguration({ handleFraction, inputAngle });
    const gabLift = pose.gabCenter.y
      - pose.nominal.nominalValvePin.y;
    const clearNormalized = THREE.MathUtils.clamp(
      (gabLift - fullClearCouplingStart)
        / (fullClearCouplingEnd - fullClearCouplingStart),
      0,
      1,
    );
    const couplingBlend = 1 - smootherstepLaw(clearNormalized).value;
    const rockerAngle = pose.nominal.nominalRockerAngle * couplingBlend;
    const valvePin = pointInPose(
      valvePivot,
      rockerAngle,
      valvePinLocal,
    );
    const pinRelativeWorld = valvePin.clone().sub(pose.gabCenter);
    const pinRelativeToGab = rotate2(-pose.rodAngle, pinRelativeWorld);

    const jawMinimumY = -gabMouthDepth;
    const jawMaximumY = gabTopBridgeMaximumY;
    const leftJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth - gabJawWidth,
        jawMinimumY,
      ),
      new THREE.Vector2(-gabInnerHalfWidth, jawMaximumY),
    ) - gabPinRadius;
    const rightJawClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(gabInnerHalfWidth, jawMinimumY),
      new THREE.Vector2(
        gabInnerHalfWidth + gabJawWidth,
        jawMaximumY,
      ),
    ) - gabPinRadius;
    const topBridgeClearance = distanceToRectangle(
      pinRelativeToGab,
      new THREE.Vector2(
        -gabInnerHalfWidth,
        gabTopBridgeMinimumY,
      ),
      new THREE.Vector2(
        gabInnerHalfWidth,
        gabTopBridgeMaximumY,
      ),
    ) - gabPinRadius;
    const minimumGabSolidClearance = Math.min(
      leftJawClearance,
      rightJawClearance,
      topBridgeClearance,
    );
    const pinInsideGabMouth = (
      Math.abs(pinRelativeToGab.x) + gabPinRadius
        <= gabInnerHalfWidth + 1e-10
        && pinRelativeToGab.y - gabPinRadius
          >= -gabMouthDepth - 1e-10
        && pinRelativeToGab.y + gabPinRadius
          <= gabTopBridgeMinimumY + 1e-10
    );
    const pinFullyClearBelowGab = pinRelativeToGab.y + gabPinRadius
      < -gabMouthDepth;
    const gabCaptured = (
      pose.resolvedHandleFraction <= 1e-12
        && pose.gabCenter.distanceTo(valvePin) <= 1e-10
        && couplingBlend >= 1 - 1e-12
    );
    const rodRightEnd = pose.gabCenter.clone().add(
      rotate2(pose.rodAngle, rodRightEndLocal),
    );
    const crankLengthError = Math.abs(
      pose.crankPin.distanceTo(operatingPivot) - operatingCrankLength,
    );
    const hangerLengthError = Math.abs(
      pose.crankPin.distanceTo(pose.rodHangerPin) - hangerLength,
    );
    const eccentricToHangerLengthError = Math.abs(
      pose.eccentricJoint.distanceTo(pose.rodHangerPin)
        - eccentricToRodHangerLength,
    );
    const eccentricToGabLengthError = Math.abs(
      pose.eccentricJoint.distanceTo(pose.gabCenter)
        - eccentricToGabLength,
    );
    const gabToHangerLengthError = Math.abs(
      pose.gabCenter.distanceTo(pose.rodHangerPin)
        - gabToRodHangerLength,
    );

    return {
      couplingBlend,
      crankLengthError,
      crankPin: pose.crankPin,
      eccentricJoint: pose.eccentricJoint,
      eccentricToGabLengthError,
      eccentricToHangerLengthError,
      gabCaptured,
      gabCenter: pose.gabCenter,
      gabLift,
      gabToHangerLengthError,
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: pose.resolvedHandleFraction,
      hangerLengthError,
      inputAngle: pose.nominal.resolvedInputAngle,
      minimumGabSolidClearance,
      nominalRockerAngle: pose.nominal.nominalRockerAngle,
      nominalValvePin: pose.nominal.nominalValvePin,
      operatingAngle: pose.operatingAngle,
      operatingHandleTop: pose.operatingHandleTop,
      pinFullyClearBelowGab,
      pinInsideGabMouth,
      pinRelativeToGab,
      rockerAngle,
      rodAngle: pose.rodAngle,
      rodHangerPin: pose.rodHangerPin,
      rodRightEnd,
      valvePin,
      valvePinRadiusError: Math.abs(
        valvePin.distanceTo(valvePivot) - valveArmLength
      ),
      valvePivot: valvePivot.clone(),
    };
  };

  const stateAtInputAngle = (inputAngle, handleFraction = 0) => (
    stateAtConfiguration({ handleFraction, inputAngle })
  );
  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const input = inputMotionAtCyclePhase(sequence.phase);
    const phaseRate = 1 / cyclePeriod;
    const handleAngularVelocity = maximumOperatingAngle
      * sequence.handleRatePerPhase
      * phaseRate;
    const handleAcceleration = maximumOperatingAngle
      * sequence.handleAccelerationPerPhaseSquared
      * phaseRate ** 2;
    const state = stateAtConfiguration({
      handleAcceleration,
      handleAngularVelocity,
      handleFraction: sequence.handleFraction,
      inputAngle: input.angle,
    });
    state.cyclePhase = sequence.phase;
    state.inputAngularAcceleration = input.accelerationPerPhaseSquared
      * phaseRate ** 2;
    state.inputAngularSpeed = input.ratePerPhase * phaseRate;
    state.inputTurns = input.turns;
    state.stage = sequence.stage;
    return state;
  };
  const stateAtTime = (time) => {
    const state = stateAtCyclePhase(time / cyclePeriod);
    state.time = time;
    return state;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.41 });

  const valveRocker = new THREE.Group();
  valveRocker.position.set(valvePivot.x, valvePivot.y, -0.32);
  valveRocker.userData.axis = Z_AXIS.clone();
  valveRocker.userData.role =
    'fixed-axis-valve-gab-lever-carrying-the-engagement-pin';
  const valveShaft = cylinderAlongZ(0.31, 1.62, darkMaterial, 40);
  valveShaft.userData.role = 'fixed-valve-rockshaft';
  const valveShaftFace = boredBoss(0.53, 0.23, 0.322, drivenMaterial);
  valveShaftFace.position.z = 0.48;
  valveShaftFace.userData.role = 'source-hatched-valve-rockshaft-boss';
  const valveArm = boredGabLever(valvePinLocal, {
    startRadius: 0.53, endRadius: gabPinRadius + .16,
    startBore: 0.322, endBore: gabPinRadius + .012, depth: 0.34,
  }, drivenMaterial);
  valveArm.userData.role = 'rigid-valve-lever-from-rockshaft-to-gab-pin';
  const valvePin = cylinderAlongZ(gabPinRadius, 1.82, brassMaterial, 34);
  valvePin.position.set(valvePinLocal.x, valvePinLocal.y, 0.55);
  valvePin.userData.role = 'valve-gear-pin-captured-by-eccentric-rod-gab';
  const valvePinIndex = new THREE.Mesh(
    new THREE.TorusGeometry(gabPinRadius * 0.66, 0.031, 8, 28),
    whiteMaterial,
  );
  valvePinIndex.position.set(valvePinLocal.x, valvePinLocal.y, 1.49);
  valvePinIndex.userData.role = 'white-index-on-valve-gear-pin';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.position.set(valvePinLocal.x, valvePinLocal.y, 0);
  valvePinAnchor.userData.role = 'exact-valve-pin-center-anchor';
  const valveShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.075, 0.04),
    whiteMaterial,
  );
  valveShaftIndex.position.set(0.25, 0, 0.62);
  valveShaftIndex.userData.role = 'white-index-on-valve-rockshaft';
  valveRocker.add(
    valveArm,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  );
  root.add(valveRocker);

  const eccentricRod = new THREE.Group();
  eccentricRod.position.z = 0.10;
  eccentricRod.userData.role =
    'rigid-eccentric-rod-with-downward-gab-and-hanger-pin';
  const rodLeftBody = makeBeam(
    new THREE.Vector3(eccentricJointLocal.x + 0.62, 0.09, 0),
    new THREE.Vector3(-0.48, 0.09, 0),
    {
      color: PALETTE.driver,
      depth: 0.42,
      jointRadius: 0.001,
      thickness: 0.30,
    },
  );
  rodLeftBody.userData.role = 'long-source-eccentric-rod-body';
  const leftForkProngs = [-1, 1].map((sign) => {
    const prong = makeBeam(
      new THREE.Vector3(
        eccentricJointLocal.x,
        eccentricJointLocal.y + sign * 0.12,
        0.01,
      ),
      new THREE.Vector3(
        eccentricJointLocal.x + 0.78,
        0.09 + sign * 0.12,
        0.01,
      ),
      {
        color: PALETTE.driver,
        depth: 0.43,
        jointRadius: 0.001,
        thickness: 0.10,
      },
    );
    prong.userData.role = `${sign < 0 ? 'lower' : 'upper'}-off-frame-eccentric-fork-prong`;
    return prong;
  });
  const tailCurve = new THREE.SplineCurve([
    new THREE.Vector2(.40, .18), new THREE.Vector2(.72, .10),
    new THREE.Vector2(1.44, .02), rodRightEndLocal.clone(),
  ]);
  const tailLeft = [], tailRight = [];
  for (let i = 0; i <= 48; i++) {
    const point = tailCurve.getPoint(i / 48), tangent = tailCurve.getTangent(i / 48);
    tailLeft.push([point.x - .11 * tangent.y, point.y + .11 * tangent.x]);
    tailRight.push([point.x + .11 * tangent.y, point.y - .11 * tangent.x]);
  }
  const tailProfile = polygonClipping.union(poly([...tailLeft, ...tailRight.reverse()]),
    poly(circle(rodHangerPinLocal.toArray(), .25, 64)));
  const rodRightTail = new THREE.Mesh(plate(polygonClipping.difference(tailProfile,
    poly(circle(rodHangerPinLocal.toArray(), .132, 64))), -.11, .11), driverMaterial);
  rodRightTail.userData.role = 'source-tail-beyond-gab-to-hanger-pin';
  const gabTopBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      2 * (gabInnerHalfWidth + gabJawWidth),
      gabTopBridgeMaximumY - gabTopBridgeMinimumY,
      0.48,
    ),
    driverMaterial,
  );
  gabTopBridge.position.set(
    0,
    (gabTopBridgeMinimumY + gabTopBridgeMaximumY) / 2,
    0.02,
  );
  gabTopBridge.userData.role = 'closed-crown-of-downward-opening-gab';
  const gabCrownArch = makeTube(
    [
      new THREE.Vector2(-0.58, 0.26),
      new THREE.Vector2(-0.38, 0.66),
      new THREE.Vector2(0, 0.85),
      new THREE.Vector2(0.39, 0.66),
      new THREE.Vector2(0.58, 0.24),
    ],
    0.14,
    driverMaterial,
    0.01,
  );
  gabCrownArch.userData.role = 'source-raised-outer-gab-crown';
  const gabJaws = [-1, 1].map((sign) => {
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(
        gabJawWidth,
        gabMouthDepth + gabTopBridgeMaximumY,
        0.48,
      ),
      driverMaterial,
    );
    jaw.position.set(
      sign * (gabInnerHalfWidth + gabJawWidth / 2),
      (gabTopBridgeMaximumY - gabMouthDepth) / 2,
      0.02,
    );
    jaw.userData.role = `${sign < 0 ? 'left' : 'right'}-open-bottom-gab-jaw`;
    eccentricRod.add(jaw);
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((sign) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, gabMouthDepth * 0.74, 0.56),
      brassMaterial,
    );
    shoe.position.set(
      sign * gabInnerHalfWidth,
      -gabMouthDepth * 0.22,
      0.09,
    );
    shoe.userData.role = `${sign < 0 ? 'left' : 'right'}-gab-driving-shoe`;
    eccentricRod.add(shoe);
    return shoe;
  });
  const rodHangerBoss = boredBoss(0.25, 0.52, .132, driverMaterial);
  rodHangerBoss.position.set(
    rodHangerPinLocal.x,
    rodHangerPinLocal.y,
    0.18,
  );
  rodHangerBoss.userData.role = 'source-boss-around-rod-hanger-pin';
  const rodHangerPin = cylinderAlongZ(0.12, 1.48, darkMaterial, 30);
  rodHangerPin.position.set(
    rodHangerPinLocal.x,
    rodHangerPinLocal.y,
    0.57,
  );
  rodHangerPin.userData.role = 'through-pin-joining-hanger-to-eccentric-rod';
  const rodHangerPinAnchor = new THREE.Group();
  rodHangerPinAnchor.position.set(
    rodHangerPinLocal.x,
    rodHangerPinLocal.y,
    0,
  );
  rodHangerPinAnchor.userData.role = 'exact-center-of-rod-hanger-pin';
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.userData.role = 'exact-center-of-eccentric-rod-gab';
  const eccentricJointAnchor = new THREE.Group();
  eccentricJointAnchor.position.set(
    eccentricJointLocal.x,
    eccentricJointLocal.y,
    0,
  );
  eccentricJointAnchor.userData.role =
    'exact-remote-eccentric-connection-of-rigid-rod';
  const rodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.075, 0.04),
    whiteMaterial,
  );
  rodIndex.position.set(-4.52, 0.29, 0.24);
  rodIndex.userData.role = 'white-index-on-moving-eccentric-rod';
  eccentricRod.add(
    eccentricJointAnchor,
    gabCenterAnchor,
    gabCrownArch,
    gabTopBridge,
    ...leftForkProngs,
    rodHangerBoss,
    rodHangerPin,
    rodHangerPinAnchor,
    rodIndex,
    rodLeftBody,
    rodRightTail,
  );
  root.add(eccentricRod);

  const operatingLever = new THREE.Group();
  operatingLever.position.set(operatingPivot.x, operatingPivot.y, 0.62);
  operatingLever.userData.axis = Z_AXIS.clone();
  operatingLever.userData.role =
    'single-rigid-operating-handle-and-short-lifting-crank';
  const operatingHandleStem = boredGabLever(operatingHandleTopLocal, {
    startRadius: .31, endRadius: .08, startBore: .162, endBore: 0, depth: .30, width: .16,
  }, accentMaterial);
  operatingHandleStem.userData.role = 'source-long-upright-operating-handle';
  const operatingCrankArm = boredGabLever(operatingCrankLocal, {
    startRadius: .31, endRadius: .23, startBore: .162, endBore: .132, depth: .34, width: .25,
  }, accentMaterial);
  operatingCrankArm.userData.role =
    'source-short-crank-rigid-with-operating-handle';
  const crankPin = cylinderAlongZ(0.12, 1.44, darkMaterial, 30);
  crankPin.position.set(
    operatingCrankLocal.x,
    operatingCrankLocal.y,
    0.37,
  );
  crankPin.userData.role = 'through-pin-joining-short-crank-to-hanger';
  const crankPinAnchor = new THREE.Group();
  crankPinAnchor.position.set(
    operatingCrankLocal.x,
    operatingCrankLocal.y,
    0,
  );
  crankPinAnchor.userData.role = 'exact-center-of-short-crank-pin';
  const operatingHandleTopAnchor = new THREE.Group();
  operatingHandleTopAnchor.position.set(
    operatingHandleTopLocal.x,
    operatingHandleTopLocal.y,
    0,
  );
  operatingHandleTopAnchor.userData.role =
    'source-top-center-of-operating-handle';
  const handleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.42, 0.04),
    whiteMaterial,
  );
  handleIndex.position.copy(
    new THREE.Vector3(
      operatingHandleTopLocal.x * 0.72,
      operatingHandleTopLocal.y * 0.72,
      0.24,
    ),
  );
  handleIndex.userData.role = 'white-index-on-operating-handle';
  operatingLever.add(
    crankPin,
    crankPinAnchor,
    handleIndex,
    operatingCrankArm,
    operatingHandleStem,
    operatingHandleTopAnchor,
  );
  root.add(operatingLever);

  const operatingPivotPin = cylinderAlongZ(0.15, 1.72, darkMaterial, 34);
  operatingPivotPin.position.set(
    operatingPivot.x,
    operatingPivot.y,
    0.40,
  );
  operatingPivotPin.userData.role = 'fixed-pivot-of-operating-bell-crank';
  const operatingPivotFace = boredBoss(.31, .18, .162, accentMaterial);
  operatingPivotFace.position.set(
    operatingPivot.x,
    operatingPivot.y,
    1.20,
  );
  operatingPivotFace.userData.role = 'source-round-operating-pivot-boss';
  const operatingPivotAnchor = new THREE.Group();
  operatingPivotAnchor.position.set(operatingPivot.x, operatingPivot.y, 0);
  operatingPivotAnchor.userData.role = 'exact-fixed-operating-pivot-center';
  root.add(operatingPivotAnchor, operatingPivotFace, operatingPivotPin);

  const hangerLink = makeBoredPlanarLink({
    length: hangerLength, width: .16, eyeRadius: .22, boreRadius: .132, depth: .24,
  }, brassMaterial);
  hangerLink.userData.role =
    'single-finite-hanger-link-between-crank-and-eccentric-rod';
  root.add(hangerLink);

  const frame = new THREE.Group();
  frame.position.z = -0.92;
  frame.userData.role = 'fixed-support-frame-behind-source-linkage';
  const frameBeams = [
    [new THREE.Vector3(-5.72, -1.14, 0), new THREE.Vector3(3.14, -1.14, 0)],
    [new THREE.Vector3(-0.86, -1.14, 0), new THREE.Vector3(-0.38, 1.87, 0)],
    [new THREE.Vector3(1.48, -1.14, 0), new THREE.Vector3(1.08, 2.61, 0)],
  ].map(([start, end], index) => {
    const beam = makeBeam(start, end, {
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: 0.12,
    });
    beam.userData.role = `fixed-frame-member-${index + 1}`;
    frame.add(beam);
    return beam;
  });
  const frameValveBearing = boredBoss(0.39, 0.22, .322, frameMaterial);
  frameValveBearing.position.set(valvePivot.x, valvePivot.y, 0.10);
  frameValveBearing.userData.role = 'rear-valve-rockshaft-frame-bearing';
  const frameOperatingBearing = boredBoss(.36, .22, .162, frameMaterial);
  frameOperatingBearing.position.set(
    operatingPivot.x,
    operatingPivot.y,
    0.10,
  );
  frameOperatingBearing.userData.role = 'rear-operating-pivot-frame-bearing';
  frame.add(frameOperatingBearing, frameValveBearing);
  root.add(frame);

  const gabCaptureMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.066, 20, 14),
    whiteMaterial,
  );
  gabCaptureMarker.userData.role = 'visible-gab-pin-capture';
  const fullClearMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.056, 20, 14),
    whiteMaterial,
  );
  fullClearMarker.userData.role = 'visible-gab-fully-clear-of-valve-pin';
  root.add(fullClearMarker, gabCaptureMarker);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 8.0, 3.4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-1.30, 2.05, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-full-motion-camera-envelope';
  root.add(cameraEnvelope);

  const blocks = {
    cameraEnvelope,
    crankPin,
    crankPinAnchor,
    eccentricJointAnchor,
    eccentricRod,
    frame,
    frameBeams,
    frameOperatingBearing,
    frameValveBearing,
    fullClearMarker,
    gabCaptureMarker,
    gabCenterAnchor,
    gabContactShoes,
    gabCrownArch,
    gabJaws,
    gabTopBridge,
    handleIndex,
    hangerLink,
    leftForkProngs,
    operatingCrankArm,
    operatingHandleStem,
    operatingHandleTopAnchor,
    operatingLever,
    operatingPivotAnchor,
    operatingPivotFace,
    operatingPivotPin,
    rodHangerBoss,
    rodHangerPin,
    rodHangerPinAnchor,
    rodIndex,
    rodLeftBody,
    rodRightTail,
    valveArm,
    valvePin,
    valvePinAnchor,
    valvePinIndex,
    valveRocker,
    valveShaft,
    valveShaftFace,
    valveShaftIndex,
  };

  const geometry = {
    cyclePeriod,
    eccentricJointLocal: eccentricJointLocal.clone(),
    eccentricToGabLength,
    eccentricToRodHangerLength,
    fullClearCouplingEnd,
    fullClearCouplingStart,
    gabInnerHalfWidth,
    gabJawWidth,
    gabMouthDepth,
    gabPinRadius,
    gabToRodHangerLength,
    gabTopBridgeMaximumY,
    gabTopBridgeMinimumY,
    hangerLength,
    inputTurnsPerCycle,
    maximumOperatingAngle,
    minimumFullyRaisedGabLift,
    operatingCrankLength,
    operatingCrankLocal: operatingCrankLocal.clone(),
    operatingHandleTopLocal: operatingHandleTopLocal.clone(),
    operatingPivot: operatingPivot.clone(),
    rodHangerPinLocal: rodHangerPinLocal.clone(),
    rodRightEndLocal: rodRightEndLocal.clone(),
    sequenceBreaks,
    sourceCrankPin: sourceCrankPin.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceRasterCrankPin: sourceRasterCrankPin.clone(),
    sourceRasterEccentricJoint: sourceRasterEccentricJoint.clone(),
    sourceRasterGabPin: sourceRasterGabPin.clone(),
    sourceRasterOperatingHandleTop:
      sourceRasterOperatingHandleTop.clone(),
    sourceRasterOperatingPivot: sourceRasterOperatingPivot.clone(),
    sourceRasterRodHangerPin: sourceRasterRodHangerPin.clone(),
    sourceRasterRodRightEnd: sourceRasterRodRightEnd.clone(),
    sourceRasterValvePivot: sourceRasterValvePivot.clone(),
    sourceUnitsPerPixel,
    valveArmLength,
    valvePivot: valvePivot.clone(),
    valveRockerAmplitude,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveRocker.rotation.z = state.rockerAngle;
    eccentricRod.position.set(
      state.gabCenter.x,
      state.gabCenter.y,
      0.10,
    );
    eccentricRod.rotation.z = state.rodAngle;
    operatingLever.rotation.z = state.operatingAngle;
    hangerLink.userData.setEndpoints(
      new THREE.Vector3(state.crankPin.x, state.crankPin.y, 0.96),
      new THREE.Vector3(
        state.rodHangerPin.x,
        state.rodHangerPin.y,
        0.96,
      ),
    );
    gabCaptureMarker.position.set(
      state.valvePin.x,
      state.valvePin.y,
      1.30,
    );
    gabCaptureMarker.visible = state.gabCaptured;
    fullClearMarker.position.set(
      state.valvePin.x,
      state.valvePin.y,
      1.24,
    );
    fullClearMarker.visible = state.pinFullyClearBelowGab;
    root.userData.contacts = {
      gabPin: {
        captured: state.gabCaptured,
        clearance: state.minimumGabSolidClearance,
        fullyClear: state.pinFullyClearBelowGab,
        gabCenter: state.gabCenter.clone(),
        pin: state.valvePin.clone(),
      },
      hanger: {
        crankError: state.crankLengthError,
        eccentricRodError: state.eccentricToHangerLengthError,
        lengthError: state.hangerLengthError,
        lowerPin: state.rodHangerPin.clone(),
        upperPin: state.crankPin.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalTimes = {
    engagedRunning: cyclePeriod * 0.10,
    handleHalfRaised: cyclePeriod * 0.29,
    heldClearPositiveStroke: cyclePeriod * 0.43,
    heldClearStopped: cyclePeriod * 0.66,
    handleHalfLowered: cyclePeriod * 0.75,
    nextEngagedRunning: cyclePeriod * 0.91,
    sourceEngaged: 0,
  };
  const canonicalStates = {
    engagedAtNegativeStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 3 * Math.PI / 2,
    }),
    engagedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: Math.PI / 2,
    }),
    fullyRaisedAtNegativeStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: 3 * Math.PI / 2,
    }),
    fullyRaisedAtPositiveStroke: stateAtConfiguration({
      handleFraction: 1,
      inputAngle: Math.PI / 2,
    }),
    sourceEngaged: stateAtConfiguration({
      handleFraction: 0,
      inputAngle: 0,
    }),
  };

  root.userData.archetype =
    'bell-crank-hanger-lifted-eccentric-rod-gab-pin-release';
  root.userData.blocks = blocks;
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = geometry;
  root.userData.inputMotionAtCyclePhase = inputMotionAtCyclePhase;
  root.userData.mechanism =
    'fixed-pivot-operating-handle-short-crank-and-finite-hanger-rock-the-eccentric-rod-to-lift-its-gab-from-the-valve-pin';
  root.userData.nominalEngagedPoseAtInputAngle =
    nominalEngagedPoseAtInputAngle;
  root.userData.rodPoseAtConfiguration = rodPoseAtConfiguration;
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.sourcePointFromRaster = sourcePointFromRaster;
  root.userData.sourceRasterFromPoint = sourceRasterFromPoint;
  root.userData.stateAtConfiguration = stateAtConfiguration;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.cameraDistanceScale = 1.00;
  root.userData.fidelity = 'authored';

  update(0);
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    fullClearMarker,
    gabCaptureMarker,
    handleIndex,
    rodIndex,
    valvePinIndex,
    valveShaftIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(4.4, 3.4, 15.6),
    root,
    update,
  };
}

export function createAuthoredGabDisengagerMovement(movement) {
  const factory = {
    186: springHandleGabDisengager,
    187: twoHandleGabDisengager,
    188: loopHandlePinCamGabDisengager,
    189: bellCrankHangerGabDisengager,
  }[movement.id];
  if (!factory) return null;
  const model = factory();
  model.root.userData.hideGround = true;
  model.root.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) material.fog = false;
    }
  });
  return model;
}
