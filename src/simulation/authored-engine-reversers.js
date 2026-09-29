import {ring} from './finite-plate-geometry.js';
import {groundBlock} from './ground-block.js';
import {turnedHandleGeometry} from './turned-handle.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const HALF_TURN = Math.PI;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevel = 0.012) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 64,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annulusShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function eccentricDiskShape({ boreRadius, eccentricity, radius }) {
  const shape = new THREE.Shape();
  shape.absarc(-eccentricity, 0, radius, 0, FULL_TURN, false);
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  bore.closePath();
  shape.holes.push(bore);
  return shape;
}

function annularSectorShape(innerRadius, outerRadius, startAngle, endAngle) {
  const shape = new THREE.Shape();
  shape.moveTo(
    outerRadius * Math.cos(startAngle),
    outerRadius * Math.sin(startAngle),
  );
  shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
  shape.lineTo(
    innerRadius * Math.cos(endAngle),
    innerRadius * Math.sin(endAngle),
  );
  shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
  shape.closePath();
  return shape;
}

function sourceScaledSingleEngineReverser() {
  const root = new THREE.Group();

  // Brown draws the operating lever and the eccentric strap as two fragments
  // of one long eccentric rod. These measured locks join the omitted 26 px
  // span while retaining the engraving's proportions and source pose.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.022;
  // A four-pixel shaft-center compromise keeps the engraved short hand-lever
  // link reachable through the full eccentric stroke.
  const sourceRasterShaftCenter = new THREE.Vector2(442, 289);
  const shaftCenter = new THREE.Vector2(4.3, 0);
  // Shared bearing center fitted between the engraving's slightly different
  // apparent strap and sheave centers. Keep the actual bearing concentric.
  const sourceRasterEccentricCenter = new THREE.Vector2(425, 290);
  const sourceRasterValvePin = new THREE.Vector2(180, 289);
  const sourceRasterSpindleLinkPin = new THREE.Vector2(123, 289);
  const sourceRasterLeverBasePivot = new THREE.Vector2(91, 361);
  const sourceRasterLeverJoint = new THREE.Vector2(81, 309);
  const sourceRasterLeverHandle = new THREE.Vector2(24, 43);
  const sourceRasterStuffingBoxCenter = new THREE.Vector2(43, 289);
  const sourceRasterLeftRodBreak = new THREE.Vector2(248, 289);
  const sourceRasterRightRodBreak = new THREE.Vector2(274, 289);
  const sourceRasterStrapOuterRadius = 76;
  const sourceRasterEccentricRadius = 56;
  const sourceRasterShaftRadius = 29;
  const sourceRasterStopMeanRadius = 36;

  const sourceRasterPointToModel = (point) => new THREE.Vector2(
    shaftCenter.x + (point.x - sourceRasterShaftCenter.x) * sourceScale,
    shaftCenter.y - (point.y - sourceRasterShaftCenter.y) * sourceScale,
  );
  const modelPointToSourceRaster = (point) => new THREE.Vector2(
    sourceRasterShaftCenter.x + (point.x - shaftCenter.x) / sourceScale,
    sourceRasterShaftCenter.y - (point.y - shaftCenter.y) / sourceScale,
  );

  const sourcePoseEccentricCenter = sourceRasterPointToModel(
    sourceRasterEccentricCenter,
  );
  const sourcePoseValvePin = sourceRasterPointToModel(sourceRasterValvePin);
  const sourcePoseSpindleLinkPin = sourceRasterPointToModel(
    sourceRasterSpindleLinkPin,
  );
  const leverBasePivot = sourceRasterPointToModel(
    sourceRasterLeverBasePivot,
  );
  const sourcePoseLeverJoint = sourceRasterPointToModel(
    sourceRasterLeverJoint,
  );
  const sourcePoseLeverHandle = sourceRasterPointToModel(
    sourceRasterLeverHandle,
  );
  const stuffingBoxCenter = sourceRasterPointToModel(
    sourceRasterStuffingBoxCenter,
  );

  const sourceEccentricVector = sourcePoseEccentricCenter.clone().sub(
    shaftCenter,
  );
  const eccentricity = sourceEccentricVector.length();
  const sourceEccentricAngle = positiveModulo(
    Math.atan2(
      sourceEccentricVector.y,
      sourceEccentricVector.x,
    ) - Math.PI,
    FULL_TURN,
  );
  const sourceShaftAngle = sourceEccentricAngle + Math.PI / 2;
  const valveGuideY = sourcePoseValvePin.y;
  const eccentricRodLength = sourcePoseEccentricCenter.distanceTo(
    sourcePoseValvePin,
  );
  const spindleLinkOffset = sourcePoseValvePin.x
    - sourcePoseSpindleLinkPin.x;
  const leverJointRadius = leverBasePivot.distanceTo(sourcePoseLeverJoint);
  const reversingLinkLength = sourcePoseLeverJoint.distanceTo(
    sourcePoseSpindleLinkPin,
  );
  const manualLeverLength = leverBasePivot.distanceTo(sourcePoseLeverHandle);

  const sheaveRadius = sourceRasterEccentricRadius * sourceScale;
  const bearingClearance = 0.035;
  const strapLinerInnerRadius = sheaveRadius + bearingClearance;
  const strapBodyInnerRadius = strapLinerInnerRadius + 0.085;
  const strapOuterRadius = sourceRasterStrapOuterRadius * sourceScale;
  const shaftFaceRadius = sourceRasterShaftRadius * sourceScale;
  const shaftRadius = 0.42;
  const shaftLength = 2.55;
  const sheaveDepth = 0.5;
  const strapDepth = 0.68;
  const stopMeanRadius = sourceRasterStopMeanRadius * sourceScale;
  const stopRadialThickness = 0.22;
  const stopInnerRadius = stopMeanRadius - stopRadialThickness / 2;
  const stopOuterRadius = stopMeanRadius + stopRadialThickness / 2;
  const stopDepth = 0.18;
  const stopPlaneZ = sheaveDepth / 2 + stopDepth / 2 + 0.015;
  const forwardStopLocalAngle = Math.PI / 2;
  const reverseStopLocalAngle = -Math.PI / 2;
  const permittedRelativeTravel = HALF_TURN;
  const stopEndRelief = Math.asin(.095 / stopInnerRadius) + .002;
  const rodLiftAngle = 0.25;
  const manualValveStroke = 0.62;
  const gabPinRadius = 0.17;
  const gabRadialClearance = 0.045;
  const cyclePeriod = 24;

  const sequenceBreaks = Object.freeze({
    forwardRunEnd: 0.18,
    reverseRodLiftEnd: 0.26,
    reverseTakeUpEnd: 0.43,
    reverseRodLowerEnd: 0.50,
    reverseRunEnd: 0.68,
    forwardRodLiftEnd: 0.76,
    forwardTakeUpEnd: 0.93,
    forwardRodLowerEnd: 1,
  });

  const smoothStep = (u) => u ** 3 * (10 + u * (-15 + 6 * u));
  const smoothStepFirst = (u) => 30 * u ** 2 * (u - 1) ** 2;
  const smoothStepSecond = (u) => 60 * u * (2 * u ** 2 - 3 * u + 1);
  const pulse = (u) => 16 * u ** 2 * (1 - u) ** 2;
  const pulseFirst = (u) => 32 * u * (1 - u) * (1 - 2 * u);
  const pulseSecond = (u) => 32 * (1 - 6 * u + 6 * u ** 2);

  const easedSegment = (phase, start, end) => {
    const width = end - start;
    const u = THREE.MathUtils.clamp((phase - start) / width, 0, 1);
    return {
      u,
      value: smoothStep(u),
      first: smoothStepFirst(u) / width,
      second: smoothStepSecond(u) / width ** 2,
    };
  };

  const pulseSegment = (phase, start, end) => {
    const width = end - start;
    const u = THREE.MathUtils.clamp((phase - start) / width, 0, 1);
    return {
      u,
      value: pulse(u),
      first: pulseFirst(u) / width,
      second: pulseSecond(u) / width ** 2,
    };
  };

  const sequenceAtCyclePhase = (cyclePhase) => {
    const phase = positiveModulo(Number(cyclePhase) || 0, 1);
    let shaftAngle = sourceShaftAngle;
    let shaftFirst = 0;
    let shaftSecond = 0;
    let eccentricAngle = sourceEccentricAngle;
    let eccentricFirst = 0;
    let eccentricSecond = 0;
    let liftFraction = 0;
    let liftFirst = 0;
    let liftSecond = 0;
    let manualShift = 0;
    let manualFirst = 0;
    let manualSecond = 0;
    let stage;
    let requestedDirection;
    let takeUpProgress = null;

    if (phase < sequenceBreaks.forwardRunEnd) {
      const motion = easedSegment(
        phase,
        0,
        sequenceBreaks.forwardRunEnd,
      );
      shaftAngle += FULL_TURN * motion.value;
      eccentricAngle += FULL_TURN * motion.value;
      shaftFirst = FULL_TURN * motion.first;
      eccentricFirst = shaftFirst;
      shaftSecond = FULL_TURN * motion.second;
      eccentricSecond = shaftSecond;
      stage = 'forward-running-with-gab-engaged';
      requestedDirection = 'forward';
    } else if (phase < sequenceBreaks.reverseRodLiftEnd) {
      const motion = easedSegment(
        phase,
        sequenceBreaks.forwardRunEnd,
        sequenceBreaks.reverseRodLiftEnd,
      );
      shaftAngle += FULL_TURN;
      eccentricAngle += FULL_TURN;
      liftFraction = motion.value;
      liftFirst = motion.first;
      liftSecond = motion.second;
      stage = 'raising-eccentric-rod-to-release-valve-spindle';
      requestedDirection = 'reverse';
    } else if (phase < sequenceBreaks.reverseTakeUpEnd) {
      const takeUp = easedSegment(
        phase,
        sequenceBreaks.reverseRodLiftEnd,
        sequenceBreaks.reverseTakeUpEnd,
      );
      const handStroke = pulseSegment(
        phase,
        sequenceBreaks.reverseRodLiftEnd,
        sequenceBreaks.reverseTakeUpEnd,
      );
      shaftAngle += FULL_TURN - HALF_TURN * takeUp.value;
      eccentricAngle += FULL_TURN;
      shaftFirst = -HALF_TURN * takeUp.first;
      shaftSecond = -HALF_TURN * takeUp.second;
      liftFraction = 1;
      manualShift = manualValveStroke * handStroke.value;
      manualFirst = manualValveStroke * handStroke.first;
      manualSecond = manualValveStroke * handStroke.second;
      stage = handStroke.u < 0.5
        ? 'manual-lever-opens-valve-for-reverse-lost-motion'
        : 'manual-lever-returns-valve-as-reverse-stop-approaches';
      requestedDirection = 'reverse';
      takeUpProgress = takeUp.value;
    } else if (phase < sequenceBreaks.reverseRodLowerEnd) {
      const motion = easedSegment(
        phase,
        sequenceBreaks.reverseTakeUpEnd,
        sequenceBreaks.reverseRodLowerEnd,
      );
      shaftAngle += HALF_TURN;
      eccentricAngle += FULL_TURN;
      liftFraction = 1 - motion.value;
      liftFirst = -motion.first;
      liftSecond = -motion.second;
      stage = 'lowering-gab-after-reverse-stop-contact';
      requestedDirection = 'reverse';
    } else if (phase < sequenceBreaks.reverseRunEnd) {
      const motion = easedSegment(
        phase,
        sequenceBreaks.reverseRodLowerEnd,
        sequenceBreaks.reverseRunEnd,
      );
      shaftAngle += HALF_TURN - FULL_TURN * motion.value;
      eccentricAngle += FULL_TURN - FULL_TURN * motion.value;
      shaftFirst = -FULL_TURN * motion.first;
      eccentricFirst = shaftFirst;
      shaftSecond = -FULL_TURN * motion.second;
      eccentricSecond = shaftSecond;
      stage = 'reverse-running-with-gab-engaged';
      requestedDirection = 'reverse';
    } else if (phase < sequenceBreaks.forwardRodLiftEnd) {
      const motion = easedSegment(
        phase,
        sequenceBreaks.reverseRunEnd,
        sequenceBreaks.forwardRodLiftEnd,
      );
      shaftAngle -= HALF_TURN;
      liftFraction = motion.value;
      liftFirst = motion.first;
      liftSecond = motion.second;
      stage = 'raising-eccentric-rod-to-restore-forward-motion';
      requestedDirection = 'forward';
    } else if (phase < sequenceBreaks.forwardTakeUpEnd) {
      const takeUp = easedSegment(
        phase,
        sequenceBreaks.forwardRodLiftEnd,
        sequenceBreaks.forwardTakeUpEnd,
      );
      const handStroke = pulseSegment(
        phase,
        sequenceBreaks.forwardRodLiftEnd,
        sequenceBreaks.forwardTakeUpEnd,
      );
      shaftAngle += -HALF_TURN + HALF_TURN * takeUp.value;
      shaftFirst = HALF_TURN * takeUp.first;
      shaftSecond = HALF_TURN * takeUp.second;
      liftFraction = 1;
      manualShift = -manualValveStroke * handStroke.value;
      manualFirst = -manualValveStroke * handStroke.first;
      manualSecond = -manualValveStroke * handStroke.second;
      stage = handStroke.u < 0.5
        ? 'manual-lever-opens-valve-for-forward-lost-motion'
        : 'manual-lever-returns-valve-as-forward-stop-approaches';
      requestedDirection = 'forward';
      takeUpProgress = takeUp.value;
    } else {
      const motion = easedSegment(
        phase,
        sequenceBreaks.forwardTakeUpEnd,
        sequenceBreaks.forwardRodLowerEnd,
      );
      liftFraction = 1 - motion.value;
      liftFirst = -motion.first;
      liftSecond = -motion.second;
      stage = 'lowering-gab-after-forward-stop-contact';
      requestedDirection = 'forward';
    }

    return {
      cyclePhase: phase,
      eccentricAngle,
      eccentricFirst,
      eccentricSecond,
      liftFirst,
      liftFraction,
      liftSecond,
      manualFirst,
      manualSecond,
      manualShift,
      requestedDirection,
      shaftAngle,
      shaftFirst,
      shaftSecond,
      stage,
      takeUpProgress,
    };
  };

  const circleIntersectionForLever = (spindleLinkPoint) => {
    const centerVector = spindleLinkPoint.clone().sub(leverBasePivot);
    const centerDistance = centerVector.length();
    if (
      centerDistance > leverJointRadius + reversingLinkLength + 1e-12
      || centerDistance < Math.abs(
        leverJointRadius - reversingLinkLength,
      ) - 1e-12
    ) {
      throw new Error('Movement 179 hand-lever linkage cannot close.');
    }
    const along = (
      leverJointRadius ** 2
      - reversingLinkLength ** 2
      + centerDistance ** 2
    ) / (2 * centerDistance);
    const height = Math.sqrt(Math.max(
      0,
      leverJointRadius ** 2 - along ** 2,
    ));
    const unit = centerVector.clone().divideScalar(centerDistance);
    const base = leverBasePivot.clone().addScaledVector(unit, along);
    const perpendicular = new THREE.Vector2(-unit.y, unit.x);
    const first = base.clone().addScaledVector(perpendicular, height);
    const second = base.clone().addScaledVector(perpendicular, -height);
    return first.y >= second.y ? first : second;
  };

  const stateAtCyclePhase = (cyclePhase) => {
    const sequence = sequenceAtCyclePhase(cyclePhase);
    const shaftAngularSpeed = sequence.shaftFirst / cyclePeriod;
    const shaftAngularAcceleration = sequence.shaftSecond / cyclePeriod ** 2;
    const eccentricAngularSpeed = sequence.eccentricFirst / cyclePeriod;
    const eccentricAngularAcceleration = sequence.eccentricSecond
      / cyclePeriod ** 2;
    const rodLift = rodLiftAngle * sequence.liftFraction;
    const rodLiftSpeed = rodLiftAngle * sequence.liftFirst / cyclePeriod;
    const rodLiftAcceleration = rodLiftAngle * sequence.liftSecond
      / cyclePeriod ** 2;
    const manualShiftSpeed = sequence.manualFirst / cyclePeriod;
    const manualShiftAcceleration = sequence.manualSecond / cyclePeriod ** 2;

    const eccentricOffsetAngle = sequence.eccentricAngle + Math.PI;
    const eccentricCenter = shaftCenter.clone().add(new THREE.Vector2(
      eccentricity * Math.cos(eccentricOffsetAngle),
      eccentricity * Math.sin(eccentricOffsetAngle),
    ));
    const eccentricCenterVelocity = new THREE.Vector2(
      -eccentricity * Math.sin(eccentricOffsetAngle) * eccentricAngularSpeed,
      eccentricity * Math.cos(eccentricOffsetAngle) * eccentricAngularSpeed,
    );
    const eccentricCenterAcceleration = new THREE.Vector2(
      -eccentricity * (
        Math.cos(eccentricOffsetAngle) * eccentricAngularSpeed ** 2
        + Math.sin(eccentricOffsetAngle) * eccentricAngularAcceleration
      ),
      eccentricity * (
        -Math.sin(eccentricOffsetAngle) * eccentricAngularSpeed ** 2
        + Math.cos(eccentricOffsetAngle) * eccentricAngularAcceleration
      ),
    );

    const verticalDifference = valveGuideY - eccentricCenter.y;
    const rodHorizontal = Math.sqrt(Math.max(
      0,
      eccentricRodLength ** 2 - verticalDifference ** 2,
    ));
    const baselineValvePin = new THREE.Vector2(
      eccentricCenter.x - rodHorizontal,
      valveGuideY,
    );
    const baselineValveSpeedX = eccentricCenterVelocity.x
      - verticalDifference * eccentricCenterVelocity.y / rodHorizontal;
    const valvePin = baselineValvePin.clone().add(
      new THREE.Vector2(sequence.manualShift, 0),
    );
    const valvePinVelocity = new THREE.Vector2(
      baselineValveSpeedX + manualShiftSpeed,
      0,
    );
    const spindleLinkPoint = valvePin.clone().add(
      new THREE.Vector2(-spindleLinkOffset, 0),
    );
    const spindleLinkVelocity = valvePinVelocity.clone();

    const downRodVector = baselineValvePin.clone().sub(eccentricCenter);
    const downRodAngle = Math.atan2(downRodVector.y, downRodVector.x);
    const downRodVectorVelocity = new THREE.Vector2(
      baselineValveSpeedX - eccentricCenterVelocity.x,
      -eccentricCenterVelocity.y,
    );
    const downRodAngularSpeed = (
      downRodVector.x * downRodVectorVelocity.y
      - downRodVector.y * downRodVectorVelocity.x
    ) / eccentricRodLength ** 2;
    const rodAngle = downRodAngle - rodLift;
    const rodAngularSpeed = downRodAngularSpeed - rodLiftSpeed;
    const gabCenter = eccentricCenter.clone().add(new THREE.Vector2(
      eccentricRodLength * Math.cos(rodAngle),
      eccentricRodLength * Math.sin(rodAngle),
    ));
    const gabCenterVelocity = eccentricCenterVelocity.clone().add(
      new THREE.Vector2(
        -eccentricRodLength * Math.sin(rodAngle) * rodAngularSpeed,
        eccentricRodLength * Math.cos(rodAngle) * rodAngularSpeed,
      ),
    );
    const gabPinSeparation = gabCenter.distanceTo(valvePin);
    const gabEngaged = sequence.liftFraction <= 1e-12
      && Math.abs(sequence.manualShift) <= 1e-12;

    const leverJointPoint = circleIntersectionForLever(spindleLinkPoint);
    const leverAngle = Math.atan2(
      leverJointPoint.y - leverBasePivot.y,
      leverJointPoint.x - leverBasePivot.x,
    );
    const leverRadial = leverJointPoint.clone().sub(leverBasePivot);
    const reversingLinkVector = leverJointPoint.clone().sub(
      spindleLinkPoint,
    );
    const leverTangent = new THREE.Vector2(-leverRadial.y, leverRadial.x);
    const leverSpeedDenominator = reversingLinkVector.dot(leverTangent);
    const leverAngularSpeed = Math.abs(leverSpeedDenominator) < 1e-12
      ? 0
      : reversingLinkVector.dot(spindleLinkVelocity)
        / leverSpeedDenominator;
    const leverJointVelocity = leverTangent.multiplyScalar(
      leverAngularSpeed,
    );
    const leverHandlePoint = leverBasePivot.clone().add(new THREE.Vector2(
      manualLeverLength * Math.cos(leverAngle),
      manualLeverLength * Math.sin(leverAngle),
    ));

    const relativeLugAngle = sequence.shaftAngle - sequence.eccentricAngle;
    const forwardStopClearance = Math.PI / 2 - relativeLugAngle;
    const reverseStopClearance = relativeLugAngle + Math.PI / 2;
    const stopTolerance = 2e-12;
    let shaftStopContact = 'between-stops';
    if (Math.abs(forwardStopClearance) <= stopTolerance) {
      shaftStopContact = 'forward-stop';
    } else if (Math.abs(reverseStopClearance) <= stopTolerance) {
      shaftStopContact = 'reverse-stop';
    }
    const lugPoint = shaftCenter.clone().add(new THREE.Vector2(
      stopMeanRadius * Math.cos(sequence.shaftAngle),
      stopMeanRadius * Math.sin(sequence.shaftAngle),
    ));
    const forwardStopPoint = shaftCenter.clone().add(new THREE.Vector2(
      stopMeanRadius * Math.cos(
        sequence.eccentricAngle + forwardStopLocalAngle,
      ),
      stopMeanRadius * Math.sin(
        sequence.eccentricAngle + forwardStopLocalAngle,
      ),
    ));
    const reverseStopPoint = shaftCenter.clone().add(new THREE.Vector2(
      stopMeanRadius * Math.cos(
        sequence.eccentricAngle + reverseStopLocalAngle,
      ),
      stopMeanRadius * Math.sin(
        sequence.eccentricAngle + reverseStopLocalAngle,
      ),
    ));
    const activeStopPoint = shaftStopContact === 'forward-stop'
      ? forwardStopPoint
      : shaftStopContact === 'reverse-stop'
        ? reverseStopPoint
        : null;
    const activeStopPositionError = activeStopPoint
      ? lugPoint.distanceTo(activeStopPoint)
      : 0;
    const stopPenetrationError = Math.max(
      0,
      -forwardStopClearance,
      -reverseStopClearance,
    );

    return {
      activeStopPoint,
      activeStopPositionError,
      baselineValvePin,
      cyclePhase: sequence.cyclePhase,
      downRodAngle,
      eccentricAngle: sequence.eccentricAngle,
      eccentricAngularAcceleration,
      eccentricAngularSpeed,
      eccentricCenter,
      eccentricCenterAcceleration,
      eccentricCenterVelocity,
      forwardStopClearance,
      forwardStopPoint,
      gabCaptureError: gabEngaged ? gabPinSeparation : 0,
      gabCenter,
      gabCenterVelocity,
      gabEngaged,
      gabPinSeparation,
      leverAngle,
      leverAngularSpeed,
      leverHandlePoint,
      leverJointPoint,
      leverJointVelocity,
      liftFraction: sequence.liftFraction,
      lugPoint,
      manualShift: sequence.manualShift,
      manualShiftAcceleration,
      manualShiftSpeed,
      permittedRelativeTravel,
      relativeLugAngle,
      requestedDirection: sequence.requestedDirection,
      reverseStopClearance,
      reverseStopPoint,
      reversingLinkLengthError: Math.abs(
        reversingLinkVector.length() - reversingLinkLength,
      ),
      rodAngle,
      rodAngularSpeed,
      rodHorizontal,
      rodLengthError: Math.abs(
        eccentricCenter.distanceTo(baselineValvePin)
          - eccentricRodLength,
      ),
      rodLift,
      rodLiftAcceleration,
      rodLiftSpeed,
      shaftAngle: sequence.shaftAngle,
      shaftAngularAcceleration,
      shaftAngularSpeed,
      shaftStopContact,
      spindleLinkPoint,
      spindleLinkVelocity,
      spindleStrokeCoordinate: valvePin.x - sourcePoseValvePin.x,
      stage: sequence.stage,
      stopPenetrationError,
      takeUpProgress: sequence.takeUpProgress,
      valveGuideError: Math.abs(valvePin.y - valveGuideY),
      valvePin,
      valvePinVelocity,
    };
  };

  const stateAtTime = (time) => stateAtCyclePhase(
    (Number(time) || 0) / cyclePeriod,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.57,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.61,
  });
  const drivenDarkMaterial = matte(0x244f67, {
    metalness: 0.18,
    roughness: 0.56,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.28,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.5,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const looseEccentric = new THREE.Group();
  looseEccentric.position.set(shaftCenter.x, shaftCenter.y, 0);
  looseEccentric.userData.role =
    'loose-eccentric-and-shaft-concentric-half-turn-stop';
  const eccentricDisk = new THREE.Mesh(
    centeredExtrusion(eccentricDiskShape({
      boreRadius: shaftRadius + 0.045,
      eccentricity,
      radius: sheaveRadius,
    }), sheaveDepth, 0.018),
    drivenMaterial,
  );
  eccentricDisk.userData.role = 'loose-circular-eccentric-with-shaft-bore';
  const eccentricOuterRim = new THREE.Mesh(
    ring(sheaveRadius * 0.94 - .025, sheaveRadius * 0.94 + .025, 0, .001, 128),
    darkMaterial,
  );
  eccentricOuterRim.position.set(-eccentricity, 0, sheaveDepth / 2 + 0.018);
  eccentricOuterRim.userData.role = 'painted-face-outline-of-loose-eccentric';
  // Brown's inner circle is only an inked edge, not a separate part.
  eccentricOuterRim.visible = false;
  eccentricOuterRim.userData.retiredInkOutline = true;
  const eccentricCenterMark = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.035, 8, 36),
    whiteMaterial,
  );
  eccentricCenterMark.position.set(
    -eccentricity,
    0,
    sheaveDepth / 2 + 0.055,
  );
  eccentricCenterMark.userData.role = 'visible-center-of-loose-eccentric';
  const eccentricPhaseIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.075, 0.035),
    whiteMaterial,
  );
  eccentricPhaseIndex.position.set(
    -eccentricity - sheaveRadius * 0.46,
    0,
    sheaveDepth / 2 + 0.018 + 0.035 / 2,
  );
  eccentricPhaseIndex.userData.role = 'loose-eccentric-rotation-index';
  const eccentricCenterAnchor = new THREE.Group();
  eccentricCenterAnchor.position.x = -eccentricity;
  eccentricCenterAnchor.userData.role = 'exact-loose-eccentric-center-anchor';

  const semicircularStop = new THREE.Mesh(
    centeredExtrusion(
      annularSectorShape(
        stopInnerRadius,
        stopOuterRadius,
        forwardStopLocalAngle + stopEndRelief,
        forwardStopLocalAngle + HALF_TURN - stopEndRelief,
      ),
      stopDepth,
      0,
    ),
    brassMaterial,
  );
  semicircularStop.position.z = stopPlaneZ;
  semicircularStop.userData.role =
    'nearly-semicircular-projection-on-side-of-loose-eccentric';
  semicircularStop.userData.angularSpan = permittedRelativeTravel - 2*stopEndRelief;
  const stopEndPads = [
    ['forward', forwardStopLocalAngle],
    ['reverse', reverseStopLocalAngle],
  ].map(([direction, angle]) => {
    const pad = cylinderAlongZ(
      stopRadialThickness * 0.66,
      stopDepth + 0.08,
      brassMaterial,
      20,
    );
    pad.position.set(
      stopMeanRadius * Math.cos(angle),
      stopMeanRadius * Math.sin(angle),
      stopPlaneZ,
    );
    pad.userData.role = `${direction}-drive-stop-end-on-eccentric`;
    pad.userData.direction = direction;
    return pad;
  });
  const forwardStopAnchor = new THREE.Group();
  forwardStopAnchor.position.set(
    stopMeanRadius * Math.cos(forwardStopLocalAngle),
    stopMeanRadius * Math.sin(forwardStopLocalAngle),
    stopPlaneZ,
  );
  forwardStopAnchor.userData.role = 'exact-forward-stop-contact-anchor';
  const reverseStopAnchor = new THREE.Group();
  reverseStopAnchor.position.set(
    stopMeanRadius * Math.cos(reverseStopLocalAngle),
    stopMeanRadius * Math.sin(reverseStopLocalAngle),
    stopPlaneZ,
  );
  reverseStopAnchor.userData.role = 'exact-reverse-stop-contact-anchor';
  looseEccentric.add(
    eccentricDisk,
    eccentricOuterRim,
    eccentricCenterMark,
    eccentricPhaseIndex,
    eccentricCenterAnchor,
    semicircularStop,
    ...stopEndPads,
    forwardStopAnchor,
    reverseStopAnchor,
  );

  const shaftRotor = new THREE.Group();
  shaftRotor.position.set(shaftCenter.x, shaftCenter.y, 0);
  shaftRotor.userData.role = 'reversible-shaft-and-driving-projection';
  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  inputShaft.userData.role = 'reversible-engine-crankshaft';
  const shaftFace = cylinderAlongZ(
    shaftFaceRadius,
    0.22,
    driverMaterial,
    64,
  );
  shaftFace.position.z = sheaveDepth / 2 + stopDepth + 0.23;
  shaftFace.userData.role = 'front-face-fast-on-reversible-shaft';
  const shaftLugLength = stopMeanRadius - shaftFaceRadius * 0.56;
  const shaftLug = new THREE.Mesh(
    new THREE.BoxGeometry(shaftLugLength, 0.19, 0.24),
    driverMaterial,
  );
  shaftLug.position.set(
    shaftFaceRadius * 0.56 + shaftLugLength / 2,
    0,
    stopPlaneZ + 0.035,
  );
  shaftLug.userData.role =
    'radial-shaft-projection-driving-eccentric-stop-ends';
  const shaftLugIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.23, 0.035),
    whiteMaterial,
  );
  shaftLugIndex.position.set(
    stopMeanRadius - 0.05,
    0,
    stopPlaneZ + 0.035 + 0.24 / 2 + 0.035 / 2,
  );
  shaftLugIndex.userData.role = 'white-index-at-shaft-lug-contact-radius';
  const shaftLugContactAnchor = new THREE.Group();
  shaftLugContactAnchor.position.set(stopMeanRadius, 0, stopPlaneZ);
  shaftLugContactAnchor.userData.role = 'exact-shaft-lug-contact-anchor';
  shaftRotor.add(
    inputShaft,
    shaftFace,
    shaftLug,
    shaftLugIndex,
    shaftLugContactAnchor,
  );

  const strap = new THREE.Group();
  strap.userData.role = 'liftable-split-eccentric-strap-rod-and-gab';
  const strapBody = new THREE.Mesh(
    centeredExtrusion(
      annulusShape(strapBodyInnerRadius, strapOuterRadius),
      strapDepth,
      0.018,
    ),
    drivenDarkMaterial,
  );
  strapBody.userData.role = 'split-eccentric-strap-body';
  const strapLiner = new THREE.Mesh(
    new THREE.TorusGeometry(
      (strapLinerInnerRadius + strapBodyInnerRadius) / 2,
      (strapBodyInnerRadius - strapLinerInnerRadius) / 2,
      10,
      80,
    ),
    brassMaterial,
  );
  strapLiner.position.z = strapDepth / 2 + 0.015;
  strapLiner.userData.role = 'close-fitting-bearing-liner-around-eccentric';
  const strapLugs = [];
  const strapBolts = [];
  for (const signY of [-1, 1]) {
    for (const signX of [-1, 1]) {
      const lug = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.37, strapDepth),
        drivenDarkMaterial,
      );
      lug.position.set(
        signX * 0.21,
        signY * (strapOuterRadius + 0.12),
        0,
      );
      lug.userData.role = 'split-strap-clamping-lug';
      lug.userData.end = signY < 0 ? 'lower' : 'upper';
      strapLugs.push(lug);
    }
    const bolt = cylinderAlongX(0.07, 0.98, brassMaterial, 12);
    bolt.position.y = signY * (strapOuterRadius + 0.12);
    bolt.userData.role = 'through-bolt-clamping-eccentric-strap';
    bolt.userData.end = signY < 0 ? 'lower' : 'upper';
    strapBolts.push(bolt);
  }

  const rodNeckEnd = strapOuterRadius + 0.8;
  const rodNeckShape = new THREE.Shape();
  rodNeckShape.moveTo(strapOuterRadius - 0.08, -0.28);
  rodNeckShape.lineTo(rodNeckEnd, -0.19);
  rodNeckShape.lineTo(rodNeckEnd, 0.19);
  rodNeckShape.lineTo(strapOuterRadius - 0.08, 0.28);
  rodNeckShape.closePath();
  const rodNeck = new THREE.Mesh(
    centeredExtrusion(rodNeckShape, 0.44, 0.012),
    drivenMaterial,
  );
  rodNeck.userData.role = 'flared-neck-joining-strap-to-eccentric-rod';
  const eccentricRodBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      eccentricRodLength - rodNeckEnd - 0.25,
      0.25,
      0.36,
    ),
    drivenMaterial,
  );
  eccentricRodBeam.position.x = (
    rodNeckEnd + eccentricRodLength - 0.25
  ) / 2;
  eccentricRodBeam.userData.role =
    'one-continuous-rigid-rod-across-engraving-break';

  const gabHalfGap = gabPinRadius + gabRadialClearance;
  const gabJawWidth = 0.18;
  const gabJawHeight = 0.72;
  const gabBridge = new THREE.Mesh(
    new THREE.BoxGeometry(
      gabHalfGap * 2 + gabJawWidth * 2,
      0.2,
      0.5,
    ),
    drivenMaterial,
  );
  gabBridge.position.set(eccentricRodLength, -0.31, 0);
  gabBridge.userData.role = 'closed-crown-of-liftable-gab';
  const gabJaws = [-1, 1].map((signX) => {
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(gabJawWidth, gabJawHeight, 0.5),
      drivenMaterial,
    );
    jaw.position.set(
      eccentricRodLength + signX * (gabHalfGap + gabJawWidth / 2),
      0,
      0,
    );
    jaw.userData.role = 'open-bottom-gab-jaw-around-valve-pin';
    jaw.userData.side = signX < 0 ? 'strap-side' : 'outer-side';
    return jaw;
  });
  const gabContactShoes = [-1, 1].map((signX) => {
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.28, 0.54),
      brassMaterial,
    );
    shoe.position.set(
      eccentricRodLength + signX * gabHalfGap,
      0.06,
      0,
    );
    shoe.userData.role = 'replaceable-gab-contact-shoe';
    shoe.userData.side = signX < 0 ? 'strap-side' : 'outer-side';
    return shoe;
  });

  const liftingHandleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(eccentricRodLength - 0.9, -0.05, 0),
    new THREE.Vector3(eccentricRodLength - 1.18, -0.48, 0),
    new THREE.Vector3(eccentricRodLength - 1.42, -1.12, 0),
    new THREE.Vector3(eccentricRodLength - 2.02, -1.55, 0),
  ]);
  const liftingHandle = new THREE.Mesh(
    new THREE.TubeGeometry(liftingHandleCurve, 64, 0.105, 10, false),
    drivenMaterial,
  );
  liftingHandle.userData.role = 'curved-hand-grip-for-raising-eccentric-rod';
  const liftingHandleGrip = cylinderAlongX(0.15, 0.56, darkMaterial, 24);
  liftingHandleGrip.position.set(eccentricRodLength - 2.15, -1.57, 0);
  liftingHandleGrip.userData.role = 'hand-grip-at-end-of-lifting-handle';
  const gabCenterAnchor = new THREE.Group();
  gabCenterAnchor.position.x = eccentricRodLength;
  gabCenterAnchor.userData.role = 'exact-center-anchor-of-gab-notch';
  strap.add(
    strapBody,
    strapLiner,
    ...strapLugs,
    ...strapBolts,
    rodNeck,
    eccentricRodBeam,
    gabBridge,
    ...gabJaws,
    ...gabContactShoes,
    liftingHandle,
    liftingHandleGrip,
    gabCenterAnchor,
  );

  const valveSpindle = new THREE.Group();
  valveSpindle.userData.role =
    'horizontal-valve-spindle-with-link-pin-and-gab-pin';
  const spindleLeftReach = sourcePoseValvePin.x
    - stuffingBoxCenter.x + 0.65;
  const spindleRightReach = 0.62;
  const spindleStem = cylinderAlongX(
    0.095,
    spindleLeftReach + spindleRightReach,
    darkMaterial,
    24,
  );
  spindleStem.position.x = (spindleRightReach - spindleLeftReach) / 2;
  spindleStem.position.z = .48;
  spindleStem.userData.role = 'sliding-valve-spindle';
  const spindleLinkPin = cylinderAlongZ(0.16, 1.14, brassMaterial, 24);
  spindleLinkPin.position.set(-spindleLinkOffset, 0, .08);
  spindleLinkPin.userData.role = 'pin-joining-hand-lever-link-to-spindle';
  const gabPin = cylinderAlongZ(gabPinRadius, 1.08, brassMaterial, 32);
  gabPin.position.set(0, 0, 0.07);
  gabPin.userData.role = 'valve-spindle-pin-captured-by-lowered-gab';
  const gabPinIndex = new THREE.Mesh(
    new THREE.TorusGeometry(gabPinRadius * 0.7, 0.035, 8, 28),
    whiteMaterial,
  );
  gabPinIndex.position.set(0, 0, 0.63);
  gabPinIndex.userData.role = 'visible-valve-spindle-gab-pin-index';
  const valvePinAnchor = new THREE.Group();
  valvePinAnchor.userData.role = 'exact-valve-spindle-gab-pin-anchor';
  const spindleLinkAnchor = new THREE.Group();
  spindleLinkAnchor.position.x = -spindleLinkOffset;
  spindleLinkAnchor.userData.role = 'exact-valve-spindle-link-pin-anchor';
  valveSpindle.add(
    spindleStem,
    spindleLinkPin,
    gabPin,
    gabPinIndex,
    valvePinAnchor,
    spindleLinkAnchor,
  );

  const stuffingBox = new THREE.Group();
  stuffingBox.position.set(stuffingBoxCenter.x, valveGuideY, .48);
  stuffingBox.userData.role = 'fixed-stuffing-box-guiding-valve-spindle';
  const stuffingSleeve = new THREE.Mesh(ring(.105, .24, -.23, .23, 96).rotateY(Math.PI/2), frameMaterial);
  stuffingSleeve.userData.role = 'fixed-valve-spindle-guide-sleeve';
  const stuffingCollars = [-0.29, 0.29].map((x) => {
    const collar = new THREE.Mesh(ring(.105, .34, -.065, .065, 96).rotateY(Math.PI/2), frameMaterial);
    collar.position.x = x;
    collar.userData.role = 'fixed-stuffing-box-collar';
    return collar;
  });
  stuffingBox.add(stuffingSleeve, ...stuffingCollars);

  const manualLever = new THREE.Group();
  manualLever.position.set(leverBasePivot.x, leverBasePivot.y, -0.22);
  manualLever.userData.role = 'upright-hand-lever-for-reversing-valve';
  // Pass 98: Brown ends the lever in a turned knob (a collar, a slim neck and
  // a bulb) centred on the plate's handle point. The bar stops inside the
  // knob's collar, which encloses its corners, instead of running on through
  // a plain cylinder whose radius its corners overhung.
  const leverKnobHalfLength = 0.31;
  const leverBarLength = manualLeverLength - leverKnobHalfLength + 0.004;
  // Pass 104: the bar ends in a round eye concentric with the base pin
  // (radius 0.22, 1.8 x the 0.12 pin), one extrusion with the bar and joined
  // to it by tangent fillets; the pin no longer sits on the bar's edge.
  const leverHalfWidth = 0.09;
  const leverEyeRadius = 0.22;
  const leverEyeFillet = 0.12;
  const leverFoot = new THREE.Shape();
  {
    const h = leverHalfWidth, R = leverEyeRadius, f = leverEyeFillet;
    const cx = Math.sqrt((R + f) ** 2 - (h + f) ** 2);
    // Fillet centres (cx, +-(h + f)); each touches the eye along the line
    // from the pin to its centre and the bar edge directly below/above it.
    const eyeAngle = Math.atan2(h + f, cx);
    leverFoot.moveTo(leverBarLength, -h);
    leverFoot.lineTo(cx, -h);
    leverFoot.absarc(cx, -(h + f), f, Math.PI / 2, Math.PI / 2 + (Math.PI / 2 - eyeAngle), false);
    leverFoot.absarc(0, 0, R, -eyeAngle, -2 * Math.PI + eyeAngle, true);
    leverFoot.absarc(cx, h + f, f, -Math.PI / 2 - (Math.PI / 2 - eyeAngle), -Math.PI / 2, false);
    leverFoot.lineTo(leverBarLength, h);
    leverFoot.closePath();
  }
  // 0.30 deep: its rear face stays 0.008 in front of the foundation, which
  // the eye now overhangs.
  const manualLeverBar = new THREE.Mesh(
    centeredExtrusion(leverFoot, 0.30, 0),
    brassMaterial,
  );
  manualLeverBar.userData.role = 'long-upright-reversing-lever';
  // Brown draws a plain pin (about 0.1 radius) through the lug. It runs
  // through the lug (0.02 proud behind) to 0.04 proud of the lever's face.
  const leverBaseHub = cylinderAlongZ(0.12, .64, darkMaterial, 48);
  leverBaseHub.position.z = -.12;
  leverBaseHub.userData.role = 'fixed-base-pivot-of-reversing-lever';
  const leverLinkHub = cylinderAlongZ(0.22, 0.66, darkMaterial, 30);
  leverLinkHub.position.set(leverJointRadius, 0, 0.16);
  leverLinkHub.userData.role = 'reversing-link-pin-on-upright-lever';
  const leverHandle = new THREE.Mesh(
    turnedHandleGeometry({ height: 2 * leverKnobHalfLength, shank: 0.08, side: [
      [0.195, 0], [0.125, 0.13], [0.09, 0.36], [0.15, 0.6], [0.18, 0.78],
    ] }),
    darkMaterial,
  );
  leverHandle.rotation.z = -Math.PI / 2; // lathe +y out along the lever
  leverHandle.position.x = manualLeverLength - leverKnobHalfLength;
  leverHandle.userData.role = 'hand-grip-of-upright-reversing-lever';
  const leverJointAnchor = new THREE.Group();
  leverJointAnchor.position.x = leverJointRadius;
  leverJointAnchor.userData.role = 'exact-upright-lever-link-joint-anchor';
  const leverHandleAnchor = new THREE.Group();
  leverHandleAnchor.position.x = manualLeverLength;
  leverHandleAnchor.userData.role = 'exact-upright-lever-handle-anchor';
  manualLever.add(
    manualLeverBar,
    leverBaseHub,
    leverLinkHub,
    leverHandle,
    leverJointAnchor,
    leverHandleAnchor,
  );

  const reversingLink = makeDynamicLink({
    thickness: 0.16,
    depth: 0.24,
    color: PALETTE.brass,
    jointRadius: 0.18,
  });
  reversingLink.userData.role = 'finite-link-from-upright-lever-to-valve-spindle';
  const [linkBeam, leverEye, spindleEye] = reversingLink.children;
  linkBeam.geometry.dispose();
  linkBeam.geometry = new THREE.BoxGeometry(1-.50/reversingLinkLength, .16, .16);
  const oldEye = leverEye.geometry;
  leverEye.geometry = ring(.23,.32,-.08,.08,96);
  spindleEye.geometry = ring(.17,.32,-.08,.08,96);oldEye.dispose();
  linkBeam.userData.role='reversing-link-beam';
  leverEye.userData.role='bored-lever-link-eye';spindleEye.userData.role='bored-spindle-link-eye';

  const baseY = -2.08;
  const baseZ = -0.9;
  const baseRail = new THREE.Mesh(new THREE.BoxGeometry(170*sourceScale,21*sourceScale,.50),frameMaterial);
  const foundationCenter=sourceRasterPointToModel(new THREE.Vector2(105,380.5));
  baseRail.position.set(foundationCenter.x,foundationCenter.y,baseZ);
  baseRail.userData.role = 'engraved-foundation-under-hand-lever';
  {
    // Brown draws this foundation as a ground line with diagonal hatching:
    // notation for a cut solid. Keep the slab's extent and render it as a
    // plain solid ground block (no hatch texture).
    const width = 170 * sourceScale;
    const height = 21 * sourceScale;
    const block = groundBlock(width, height, .5, {spacing: .16, name: 'engraved-foundation-under-hand-lever'});
    baseRail.geometry.dispose();
    baseRail.geometry = block.geometry;
    baseRail.material = block.material;
  }
  // Pass 101: the lever pedestal is one cast lug, as Brown draws it: a top
  // arc concentric with the pin, straight flanks tangent to that arc, and
  // concave fillets flaring into a flat foot that sits on the foundation.
  // The foundation's front face is brought forward under the lug.
  const pedestalRadius = 0.30;
  const pedestalFootHalfWidth = 0.42;
  const pedestalFillet = 0.09;
  const foundationTop = foundationCenter.y + 21 * sourceScale / 2;
  const pedestalHeight = leverBasePivot.y - foundationTop;
  const pedestalShape = new THREE.Shape();
  {
    const foot = new THREE.Vector2(pedestalFootHalfWidth, -pedestalHeight - 0.01);
    const tangentAngle = Math.atan2(foot.y, foot.x)
      + Math.acos(pedestalRadius / foot.length());
    const tangent = new THREE.Vector2(Math.cos(tangentAngle), Math.sin(tangentAngle))
      .multiplyScalar(pedestalRadius);
    const flank = tangent.clone().sub(foot).normalize();
    const flankStart = foot.clone().addScaledVector(flank, pedestalFillet);
    pedestalShape.moveTo(-foot.x - pedestalFillet, foot.y);
    pedestalShape.lineTo(foot.x + pedestalFillet, foot.y);
    pedestalShape.quadraticCurveTo(foot.x, foot.y, flankStart.x, flankStart.y);
    pedestalShape.lineTo(tangent.x, tangent.y);
    pedestalShape.absarc(0, 0, pedestalRadius, tangentAngle, Math.PI - tangentAngle, false);
    pedestalShape.lineTo(-flankStart.x, flankStart.y);
    pedestalShape.quadraticCurveTo(-foot.x, foot.y, -foot.x - pedestalFillet, foot.y);
    const bore = new THREE.Path();
    bore.absarc(0, 0, 0.123, 0, 2 * Math.PI, true); // 0.003 running fit
    pedestalShape.holes.push(bore);
  }
  const leverPedestal = new THREE.Mesh(
    centeredExtrusion(pedestalShape, 0.24, 0),
    frameMaterial,
  );
  leverPedestal.position.set(leverBasePivot.x, leverBasePivot.y, -.52);
  leverPedestal.userData.role = 'fixed-pedestal-under-upright-lever';
  {
    // Deepen the foundation forward (z -1.15 .. -0.39) so the lug's foot
    // (z -0.64 .. -0.40) stands wholly on it. Pass 104: its front stops
    // behind the lever, whose round eye hangs below the foundation top.
    const front = -0.39, back = baseZ - 0.25;
    // Pass 104: stone grey, as 185's wall (the pale beige read as paper).
    const stone = {plain: matte(0x8a8276, {roughness: 0.9}), side: matte(0x776f64, {roughness: 0.9})};
    const block = groundBlock(170 * sourceScale, 21 * sourceScale, front - back,
      {name: 'engraved-foundation-under-hand-lever', materials: stone});
    baseRail.geometry.dispose();
    baseRail.geometry = block.geometry;
    baseRail.material = block.material;
    baseRail.position.z = (front + back) / 2;
  }

  const shaftBearing = new THREE.Group();
  shaftBearing.position.set(shaftCenter.x, shaftCenter.y, -0.68);
  shaftBearing.userData.role = 'fixed-rear-bearing-for-reversible-shaft';
  const bearingRing = new THREE.Mesh(
    ring(shaftRadius+.01, .63, -.13, .13, 96),
    frameMaterial,
  );
  bearingRing.userData.role = 'fixed-shaft-bearing-ring';
  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, shaftCenter.y - baseY - .60, 0.5),
    frameMaterial,
  );
  bearingPost.position.y = -(shaftCenter.y - baseY + .60) / 2;
  bearingPost.userData.role = 'fixed-bearing-pedestal-post';
  shaftBearing.add(bearingRing, bearingPost);
  const shaftBearingBraces = [-1, 1].map((signX) => {
    const brace = makeBeam(
      new THREE.Vector3(shaftCenter.x + signX * 0.9, baseY, baseZ),
      new THREE.Vector3(shaftCenter.x, shaftCenter.y - 0.52, -0.75),
      { thickness: 0.14, depth: 0.22, color: PALETTE.frame },
    );
    brace.userData.role = 'diagonal-brace-for-shaft-bearing';
    return brace;
  });

  const valveGuideSupport = makeBeam(
    new THREE.Vector3(stuffingBoxCenter.x, baseY, .85),
    new THREE.Vector3(stuffingBoxCenter.x, valveGuideY - .30, .85),
    { thickness: 0.14, depth: 0.22, color: PALETTE.frame },
  );
  valveGuideSupport.userData.role = 'fixed-support-for-valve-stuffing-box';
  const guideElbow = makeBeam(new THREE.Vector3(stuffingBoxCenter.x,valveGuideY-.30,.85),
    new THREE.Vector3(stuffingBoxCenter.x,valveGuideY-.30,.48),{thickness:.14,depth:.14,color:PALETTE.frame});
  const guideFoot = makeBeam(new THREE.Vector3(stuffingBoxCenter.x,baseY,baseZ),
    new THREE.Vector3(stuffingBoxCenter.x,baseY,.85),{thickness:.14,depth:.14,color:PALETTE.frame});
  guideElbow.userData.role='fixed-guide-support-elbow';guideFoot.userData.role='fixed-guide-support-foot';
  root.add(guideElbow,guideFoot);

  const stopContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 20, 14),
    whiteMaterial,
  );
  stopContactMarker.userData.role = 'visible-active-shaft-stop-contact';
  const gabContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 14),
    whiteMaterial,
  );
  gabContactMarker.userData.role = 'visible-engaged-gab-contact';

  root.add(
    baseRail,
    leverPedestal,
    shaftBearing,
    ...shaftBearingBraces,
    valveGuideSupport,
    stuffingBox,
    looseEccentric,
    shaftRotor,
    strap,
    valveSpindle,
    manualLever,
    reversingLink,
    stopContactMarker,
    gabContactMarker,
  );

  const update = (time) => {
    const state = stateAtTime(time);
    looseEccentric.rotation.z = state.eccentricAngle;
    looseEccentric.userData.angularSpeed = state.eccentricAngularSpeed;
    shaftRotor.rotation.z = state.shaftAngle;
    shaftRotor.userData.angularSpeed = state.shaftAngularSpeed;
    strap.position.set(state.eccentricCenter.x, state.eccentricCenter.y, 0);
    strap.rotation.z = state.rodAngle;
    strap.userData.angularSpeed = state.rodAngularSpeed;
    valveSpindle.position.set(state.valvePin.x, state.valvePin.y, 0);
    valveSpindle.userData.velocity = state.valvePinVelocity.clone();
    manualLever.rotation.z = state.leverAngle;
    manualLever.userData.angularSpeed = state.leverAngularSpeed;
    reversingLink.userData.setEndpoints(
      new THREE.Vector3(
        state.leverJointPoint.x,
        state.leverJointPoint.y,
        .18,
      ),
      new THREE.Vector3(
        state.spindleLinkPoint.x,
        state.spindleLinkPoint.y,
        .18,
      ),
    );
    stopContactMarker.visible = state.activeStopPoint !== null;
    if (state.activeStopPoint) {
      stopContactMarker.position.set(
        state.activeStopPoint.x,
        state.activeStopPoint.y,
        stopPlaneZ + 0.22,
      );
    }
    gabContactMarker.visible = state.gabEngaged;
    gabContactMarker.position.set(
      state.valvePin.x,
      state.valvePin.y,
      strapDepth / 2 + 0.28,
    );
    root.userData.contacts = {
      eccentricBearing: {
        centerError: 0,
        clearance: bearingClearance,
        eccentricCenter: state.eccentricCenter.clone(),
        strapCenter: state.eccentricCenter.clone(),
      },
      eccentricRodGab: {
        captureError: state.gabCaptureError,
        engaged: state.gabEngaged,
        gabCenter: state.gabCenter.clone(),
        pinCenter: state.valvePin.clone(),
        separation: state.gabPinSeparation,
      },
      manualLeverLink: {
        length: state.leverJointPoint.distanceTo(state.spindleLinkPoint),
        lengthError: state.reversingLinkLengthError,
      },
      shaftLugAndEccentricStop: {
        activeStop: state.shaftStopContact,
        angularTravelBetweenStops: permittedRelativeTravel,
        contactPositionError: state.activeStopPositionError,
        forwardClearance: state.forwardStopClearance,
        penetrationError: state.stopPenetrationError,
        relativeAngle: state.relativeLugAngle,
        reverseClearance: state.reverseStopClearance,
      },
      valveSpindleGuide: {
        lineY: valveGuideY,
        positionError: state.valveGuideError,
      },
    };
    root.userData.kinematics = state;
  };

  const canonicalStates = {
    sourceForwardContact: stateAtCyclePhase(0),
    forwardRunMidpoint: stateAtCyclePhase(
      sequenceBreaks.forwardRunEnd / 2,
    ),
    rodRaisedForReverse: stateAtCyclePhase(
      sequenceBreaks.reverseRodLiftEnd,
    ),
    reverseLostMotionMidpoint: stateAtCyclePhase(
      (sequenceBreaks.reverseRodLiftEnd
        + sequenceBreaks.reverseTakeUpEnd) / 2,
    ),
    reverseStopReached: stateAtCyclePhase(
      sequenceBreaks.reverseTakeUpEnd,
    ),
    reverseReengaged: stateAtCyclePhase(
      sequenceBreaks.reverseRodLowerEnd,
    ),
    reverseRunMidpoint: stateAtCyclePhase(
      (sequenceBreaks.reverseRodLowerEnd
        + sequenceBreaks.reverseRunEnd) / 2,
    ),
    rodRaisedForForward: stateAtCyclePhase(
      sequenceBreaks.forwardRodLiftEnd,
    ),
    forwardLostMotionMidpoint: stateAtCyclePhase(
      (sequenceBreaks.forwardRodLiftEnd
        + sequenceBreaks.forwardTakeUpEnd) / 2,
    ),
    forwardStopReached: stateAtCyclePhase(
      sequenceBreaks.forwardTakeUpEnd,
    ),
  };

  const sourcePose = stateAtCyclePhase(0);
  const sourcePoseLeverJointError = sourcePose.leverJointPoint.distanceTo(
    sourcePoseLeverJoint,
  );
  const sourcePoseLeverHandleError = sourcePose.leverHandlePoint.distanceTo(
    sourcePoseLeverHandle,
  );

  root.userData.archetype =
    'single-engine-liftable-gab-manual-valve-lever-loose-eccentric-half-turn-stop-reversing-gear';
  root.userData.blocks = {
    baseRail,
    bearingPost,
    bearingRing,
    eccentricCenterAnchor,
    eccentricCenterMark,
    eccentricDisk,
    eccentricOuterRim,
    eccentricPhaseIndex,
    eccentricRodBeam,
    gabBridge,
    gabCenterAnchor,
    gabContactMarker,
    gabContactShoes,
    gabJaws,
    gabPin,
    gabPinIndex,
    inputShaft,
    leverBaseHub,
    leverHandle,
    leverHandleAnchor,
    leverJointAnchor,
    leverLinkHub,
    leverPedestal,
    liftingHandle,
    liftingHandleGrip,
    looseEccentric,
    manualLever,
    manualLeverBar,
    reversingLink,
    reverseStopAnchor,
    rodNeck,
    semicircularStop,
    shaftBearing,
    shaftBearingBraces,
    shaftFace,
    shaftLug,
    shaftLugContactAnchor,
    shaftLugIndex,
    shaftRotor,
    spindleLinkPin,
    spindleLinkAnchor,
    spindleStem,
    stopContactMarker,
    stopEndPads,
    forwardStopAnchor,
    strap,
    strapBody,
    strapBolts,
    strapLiner,
    strapLugs,
    stuffingBox,
    stuffingCollars,
    stuffingSleeve,
    valveGuideSupport,
    valvePinAnchor,
    valveSpindle,
  };
  root.userData.cameraDistanceScale = 0.96;
  root.userData.canonicalStates = canonicalStates;
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    baseY,
    bearingClearance,
    cyclePeriod,
    eccentricRodLength,
    eccentricity,
    forwardStopLocalAngle,
    fullTurn: FULL_TURN,
    gabPinRadius,
    gabRadialClearance,
    halfTurn: HALF_TURN,
    leverBasePivot: leverBasePivot.clone(),
    leverJointRadius,
    manualLeverLength,
    manualValveStroke,
    permittedRelativeTravel,
    reverseStopLocalAngle,
    reversingLinkLength,
    rodLiftAngle,
    sequenceBreaks,
    shaftCenter: shaftCenter.clone(),
    shaftFaceRadius,
    shaftLength,
    shaftRadius,
    sheaveDepth,
    sheaveRadius,
    sourceEccentricAngle,
    sourceImageHeight,
    sourceImageWidth,
    sourcePoseEccentricCenter: sourcePoseEccentricCenter.clone(),
    sourcePoseLeverHandle: sourcePoseLeverHandle.clone(),
    sourcePoseLeverHandleError,
    sourcePoseLeverJoint: sourcePoseLeverJoint.clone(),
    sourcePoseLeverJointError,
    sourcePoseSpindleLinkPin: sourcePoseSpindleLinkPin.clone(),
    sourcePoseValvePin: sourcePoseValvePin.clone(),
    sourceRasterEccentricCenter: sourceRasterEccentricCenter.clone(),
    sourceRasterEccentricRadius,
    sourceRasterLeftRodBreak: sourceRasterLeftRodBreak.clone(),
    sourceRasterLeverBasePivot: sourceRasterLeverBasePivot.clone(),
    sourceRasterLeverHandle: sourceRasterLeverHandle.clone(),
    sourceRasterLeverJoint: sourceRasterLeverJoint.clone(),
    sourceRasterRightRodBreak: sourceRasterRightRodBreak.clone(),
    sourceRasterShaftCenter: sourceRasterShaftCenter.clone(),
    sourceRasterShaftRadius,
    sourceRasterSpindleLinkPin: sourceRasterSpindleLinkPin.clone(),
    sourceRasterStopMeanRadius,
    sourceRasterStrapOuterRadius,
    sourceRasterStuffingBoxCenter: sourceRasterStuffingBoxCenter.clone(),
    sourceRasterValvePin: sourceRasterValvePin.clone(),
    sourceScale,
    sourceShaftAngle,
    spindleLinkOffset,
    stopDepth,
    stopEndRelief,
    stopInnerRadius,
    stopMeanRadius,
    stopOuterRadius,
    stopPlaneZ,
    stopRadialThickness,
    strapBodyInnerRadius,
    strapDepth,
    strapLinerInnerRadius,
    strapOuterRadius,
    stuffingBoxCenter: stuffingBoxCenter.clone(),
    valveGuideY,
  };
  root.userData.mechanism =
    'liftable-gab-manual-valve-spindle-reversal-with-loose-eccentric-and-exact-half-turn-shaft-stop-takeup';
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sequenceAtCyclePhase = sequenceAtCyclePhase;
  root.userData.sourceRasterPointToModel = sourceRasterPointToModel;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  // Reconstruct the rounded, downward-opening gab and the lifting handle
  // from the initial engraving. Convert raster points into the rod's frame.
  const rodPoint = (x,y) => sourceRasterPointToModel(new THREE.Vector2(x,y))
    .sub(sourcePose.eccentricCenter).rotateAround(new THREE.Vector2(), -sourcePose.rodAngle);
  const neck=new THREE.Shape();
  const neckLine=(x,y)=>neck.lineTo(...rodPoint(x,y).toArray());
  const neckCurve=(a,b,c)=>neck.bezierCurveTo(...rodPoint(...a).toArray(),...rodPoint(...b).toArray(),...rodPoint(...c).toArray());
  neck.moveTo(...rodPoint(274,276).toArray());neckLine(310,275);
  neckCurve([327,274],[327,267],[336,250]);neckCurve([345,239],[357,236],[369,240]);neckLine(375,252);
  neckCurve([351,276],[351,302],[375,328]);neckLine(369,340);neckCurve([357,344],[345,340],[338,328]);
  neckCurve([332,311],[331,304],[315,303]);neckLine(274,302);neck.closePath();
  rodNeck.geometry.dispose();rodNeck.geometry=centeredExtrusion(neck,.44,0);
  const gab = new THREE.Shape(), outer=.40, inner=gabHalfGap, bottom=.176;
  gab.moveTo(eccentricRodLength-outer,bottom);
  gab.lineTo(eccentricRodLength-outer,0);
  gab.absarc(eccentricRodLength,0,outer,Math.PI,2*Math.PI,false);
  gab.lineTo(eccentricRodLength+outer,bottom);
  gab.lineTo(eccentricRodLength+inner,bottom);
  gab.lineTo(eccentricRodLength+inner,0);
  gab.absarc(eccentricRodLength,0,inner,0,-Math.PI,true);
  gab.lineTo(eccentricRodLength-inner,bottom);gab.closePath();
  gabBridge.geometry.dispose();gabBridge.geometry=centeredExtrusion(gab,.50,0);
  gabBridge.position.set(0,0,0);gabBridge.userData.role='rounded-open-bottom-gab';
  const handle = new THREE.Shape();
  const move=(x,y)=>handle.moveTo(...rodPoint(x,y).toArray());
  const line=(x,y)=>handle.lineTo(...rodPoint(x,y).toArray());
  const curve=(a,b,c)=>handle.bezierCurveTo(...rodPoint(...a).toArray(),...rodPoint(...b).toArray(),...rodPoint(...c).toArray());
  move(166,282);curve([149,286],[146,271],[141,252]);
  curve([135,219],[119,201],[95,197]);line(94,203);
  curve([118,208],[126,227],[131,254]);curve([135,280],[142,292],[165,291]);handle.closePath();
  liftingHandle.geometry.dispose();liftingHandle.geometry=centeredExtrusion(handle,.22,0);
  // Pass 98: Brown ends the lifting handle in a turned knob (a collar, a slim
  // neck and a bulb) standing straight out of the handle's end face. The
  // collar (r 0.14) encloses the end's corners (half-diagonal 0.128), with
  // 0.06 of it over the end, and the knob reaches the old grip's tip.
  const handleEndA=rodPoint(95,197), handleEndB=rodPoint(94,203);
  const handleEnd=handleEndA.clone().add(handleEndB).multiplyScalar(.5);
  const handleOut=new THREE.Vector2(handleEndB.y-handleEndA.y,handleEndA.x-handleEndB.x).normalize();
  if(handleOut.dot(handleEnd.clone().sub(rodPoint(119,201)))<0)handleOut.negate();
  liftingHandleGrip.geometry.dispose();
  liftingHandleGrip.geometry=turnedHandleGeometry({height:.46,shank:.06,side:[
    [.14,0],[.09,.12],[.065,.32],[.1,.6],[.12,.78]]});
  liftingHandleGrip.rotation.set(0,0,0);
  liftingHandleGrip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(handleOut.x,handleOut.y,0));
  liftingHandleGrip.position.set(handleEnd.x-.012*handleOut.x,handleEnd.y-.012*handleOut.y,.09);liftingHandle.position.z=.09;
  for (const [parent,x,z,radius,name] of [[manualLever,leverJointRadius,.51,.28,'lever-link-pin-head'],
    [valveSpindle,-spindleLinkOffset,.67,.21,'spindle-link-pin-head']]) {
    const head=cylinderAlongZ(radius,.04,darkMaterial,64);head.position.set(x,0,z);
    head.userData.role=name;parent.add(head);root.userData.blocks[name]=head;
  }
  // Brown draws no phase indices on the eccentric, shaft lug or gab pin.
  for (const index of [eccentricPhaseIndex, shaftLugIndex, gabPinIndex]) index.visible = false;
  for (const decoration of [eccentricCenterMark, stopContactMarker, gabContactMarker, ...stopEndPads,
    ...gabJaws, ...gabContactShoes]) {
    decoration.removeFromParent();decoration.geometry.dispose();
  }
  // The source sections the engine away at the shaft and valve guide. Preserve
  // that cutaway instead of adding an unillustrated full-width bed and braces.
  for(const omitted of [shaftBearing,...shaftBearingBraces,valveGuideSupport,guideElbow,guideFoot]){
    omitted.removeFromParent();omitted.traverse(part=>part.geometry?.dispose());
  }
  Object.assign(root.userData, {hideGround:true, supportsRestart:true,
    minimumDisplayCycleSeconds:24, animationTiming:{authoredCyclePeriod:cyclePeriod},
    reconstructionStatus:'reconstructed',
    reconstructionNote:'Ideal operator sequence: lift the rod, work the valve by hand, take up the half-turn shaft clearance, and lower the rod. Bearing geometry and shaft position reconcile the hand-drawn outlines with full linkage reach; unillustrated engine supports are sectioned away.'});
  const motionBounds=new THREE.Box3();
  for(let i=0;i<=192;i++){update(cyclePeriod*i/192);root.updateMatrixWorld(true);
    motionBounds.union(new THREE.Box3().setFromObject(root,true));}
  root.userData.cameraFitBounds=motionBounds.expandByScalar(.06);
  root.userData.cameraFov=8;
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
  stopContactMarker.castShadow = false;
  gabContactMarker.castShadow = false;

  return {
    cameraDirection: new THREE.Vector3(0, 0, 1),
    root,
    update,
    reset: () => update(0),
  };
}

export function createAuthoredEngineReverserMovement(movement) {
  if (movement.id === 179) return sourceScaledSingleEngineReverser();
  return null;
}
