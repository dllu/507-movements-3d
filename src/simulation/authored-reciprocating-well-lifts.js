import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { waterVolumeGeometry, waterVolumeMaterial } from './water-volume.js';
import {WaterStream,collectWaterStreams} from './water-stream.js';
import {makeCellWaterGeometry,updateClippedCell} from './clipped-fluid-cell.js';
import {replaceWithLaidRope} from './laid-rope.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import {correctWaterLiftParts} from './well-scoop-gutter-parts.js';
import {
  PALETTE,
  makePulley,
  makeScrew,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function mergeBoxes(boxes) {
  const parts = boxes.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed());
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return merged;
}

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function fixedProfile(value) {
  return {
    firstDerivativeByPhase: 0,
    secondDerivativeByPhase: 0,
    value,
  };
}

function transitionProfile(phase, startPhase, endPhase, startValue, endValue) {
  const duration = endPhase - startPhase;
  const normalized = (phase - startPhase) / duration;
  const delta = endValue - startValue;
  return {
    firstDerivativeByPhase:
      delta * smootherStepDerivative(normalized) / duration,
    secondDerivativeByPhase:
      delta * smootherStepSecondDerivative(normalized) / duration ** 2,
    value: startValue + delta * smootherStep(normalized),
  };
}

// A lift that cruises at constant speed between smootherstep ramps. The wind
// wheel's display rate is capped by its sustained speed, which a pure
// smootherstep lift pushes to nearly twice its mean.
function cruiseProfile(phase, startPhase, endPhase, startValue, endValue,
  rampFraction = LIFT_RAMP_FRACTION) {
  const duration = endPhase - startPhase;
  const u = THREE.MathUtils.clamp((phase - startPhase) / duration, 0, 1);
  const ramp = rampFraction;
  const area = 1 - ramp;
  const integral = (x) => x ** 4 * (x * x - 3 * x + 2.5);
  let progress;
  let first;
  let second;
  if (u <= ramp) {
    const x = u / ramp;
    progress = ramp * integral(x) / area;
    first = smootherStep(x) / area;
    second = smootherStepDerivative(x) / (ramp * area);
  } else if (u < 1 - ramp) {
    progress = (u - ramp / 2) / area;
    first = 1 / area;
    second = 0;
  } else {
    const x = (u - (1 - ramp)) / ramp;
    progress = (1 - 1.5 * ramp + ramp * (x - integral(x))) / area;
    first = (1 - smootherStep(x)) / area;
    second = -smootherStepDerivative(x) / (ramp * area);
  }
  const delta = endValue - startValue;
  return {
    firstDerivativeByPhase: delta * first / duration,
    secondDerivativeByPhase: delta * second / duration ** 2,
    value: startValue + delta * progress,
  };
}

const LIFT_RAMP_FRACTION = 0.15;

function profileRate(profile, phaseSpeed) {
  return profile.firstDerivativeByPhase * phaseSpeed;
}

function profileAcceleration(profile, phaseSpeed, phaseAcceleration) {
  return profile.secondDerivativeByPhase * phaseSpeed ** 2
    + profile.firstDerivativeByPhase * phaseAcceleration;
}

function setVerticalExtent(mesh, bottom, top) {
  const length = Math.max(0.001, top - bottom);
  mesh.position.y = (bottom + top) / 2;
  mesh.scale.y = length;
  mesh.visible = top > bottom;
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function reciprocatingWellLift(movement) {
  const root = new THREE.Group();
  const cycleDuration = 9.0;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const exchangeLeftEndPhase = 0.10;
  const rightLiftEndPhase = 0.50;
  const exchangeRightEndPhase = 0.60;
  const wheelTeeth = 12;
  const wormStarts = 1;
  const wheelPitchRadius = 0.68;
  const wormPitchRadius = 0.19;
  const axialPitch = FULL_TURN * wheelPitchRadius / wheelTeeth;
  const wormLength = 1.12;
  const pulleyRadius = 0.62;
  // Half a pulley turn per lift (six worm turns) lowers the empty bucket
  // down the well past Brown's ground line, where his plate crops the rope.
  const pulleyTravelAngle = FULL_TURN / 2;
  const bucketStroke = pulleyRadius * pulleyTravelAngle;
  // The worm swings far enough that, midway, its thread crest (0.045 above
  // pitch) clears the pin tips (0.040 above pitch) of both wheels, so the
  // wind-driven worm can keep turning while it crosses between them.
  const engagementShift = 0.12;
  const wheelCenterX = wheelPitchRadius + wormPitchRadius
    + engagementShift;
  const carrierTop = new THREE.Vector3(0, 3.43, 0.03);
  const carrierCenterDistance = 1.13;
  const engagedCarrierAngle = Math.asin(
    engagementShift / carrierCenterDistance,
  );
  const wheelCenterY = carrierTop.y
    - Math.sqrt(carrierCenterDistance ** 2 - engagementShift ** 2);
  const pulleyZ = -0.39;
  const ropeZ = pulleyZ;
  const pulleyCenters = {
    left: new THREE.Vector3(-wheelCenterX, wheelCenterY, pulleyZ),
    right: new THREE.Vector3(wheelCenterX, wheelCenterY, pulleyZ),
  };
  const gearCenters = {
    left: new THREE.Vector3(-wheelCenterX, wheelCenterY, 0.03),
    right: new THREE.Vector3(wheelCenterX, wheelCenterY, 0.03),
  };
  const leftRopeX = -wheelCenterX - pulleyRadius;
  const rightRopeX = wheelCenterX + pulleyRadius;
  const innerRopeSpan = 2 * wheelCenterX;
  const highBailY = 0.58;
  const bucketHeight = 0.68;
  const bucketRadius = 0.34;
  const bucketHandleRise = 0.48;
  const bucketCenterOffset = bucketHandleRise + bucketHeight / 2;
  const maximumBucketTilt = THREE.MathUtils.degToRad(38);
  const tappetHalfLength = Math.abs(leftRopeX);
  const tappetPivot = new THREE.Vector3(0, 0.72, 0.07);
  const tappetAngleMagnitude = Math.asin(
    (tappetPivot.y - highBailY) / tappetHalfLength,
  );
  // Continuous wind: the worm turns at one constant rate. A rising bucket
  // strikes the tappet at highBailY and, still lifted by its wheel, pushes
  // the tappet (and the worm step) until the thread leaves that wheel's
  // pins; the worm then crosses a free window (half a worm turn, rope held)
  // and is taken by the opposite wheel, which starts the other bucket.
  // Pin tips reach 0.030 past the pitch circle (the worm's 6-degree swing
  // makes a longer pin graze the thread flank).
  const pinReach = 0.030;
  const threadReach = 0.045;
  const freeSelectorHalfWidth = engagementShift - pinReach - threadReach - 0.005;
  const leaveRise = tappetHalfLength * (Math.sin(tappetAngleMagnitude)
    - Math.sin(tappetAngleMagnitude * freeSelectorHalfWidth / engagementShift));
  const lowBailY = highBailY - bucketStroke + 2 * leaveRise;
  const freeWormTurns = 0.5;
  const freeWindowPhase = 0.5 * freeWormTurns
    / (wheelTeeth * pulleyTravelAngle / (wormStarts * FULL_TURN) + freeWormTurns);
  const ropePhaseRate = bucketStroke / (0.5 - freeWindowPhase);
  const leavePhaseEnd = leaveRise / ropePhaseRate;
  const freePhaseEnd = leavePhaseEnd + freeWindowPhase;
  const enterPhaseDuration = 0.036;
  const enterPhaseEnd = freePhaseEnd + enterPhaseDuration;
  // Thread phase at which each wheel's pins sit in the thread; each wheel's
  // pin ring is set at that phase (see update), so the wheel taken up after
  // the free window meets the turning thread in step.
  const cycleWormTravel = 2 * wheelTeeth * pulleyTravelAngle / wormStarts
    + 2 * freeWormTurns * FULL_TURN / wormStarts;
  const rightMeshPhase = cycleWormTravel * freePhaseEnd
    + wheelTeeth * leaveRise / pulleyRadius;
  const leftMeshPhase = cycleWormTravel * leavePhaseEnd
    - wheelTeeth * leaveRise / pulleyRadius;
  const fixedRopeLength = Math.PI * pulleyRadius + innerRopeSpan;
  const totalRopeLength = wheelCenterY - highBailY
    + fixedRopeLength + wheelCenterY - lowBailY;
  const wormTravelPerLift = wheelTeeth * pulleyTravelAngle / wormStarts;
  const wormTravelPerCycle = 2 * wormTravelPerLift
    + 2 * freeWormTurns * FULL_TURN / wormStarts;
  const wormTurnsPerLift = wormTravelPerLift / FULL_TURN;
  const wormTurnsPerCycle = wormTravelPerCycle / FULL_TURN;
  const groundY = -3.72;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const rawPhase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const phase = rawPhase;
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    const half = phase < 0.5 ? 0 : 1;
    const local = phase - 0.5 * half;
    const mirror = half ? -1 : 1;
    // Selector (worm step) in the first half; the second half mirrors it.
    const leaveSelector = (u) => {
      const scale = engagementShift / tappetAngleMagnitude;
      const qRate = ropePhaseRate / tappetHalfLength;
      const q = (highBailY + ropePhaseRate * u - tappetPivot.y)
        / tappetHalfLength;
      const root = Math.sqrt(1 - q * q);
      return {
        firstDerivativeByPhase: scale * qRate / root,
        secondDerivativeByPhase: scale * qRate ** 2 * q / root ** 3,
        value: scale * Math.asin(q),
      };
    };
    const leaveEndSlope = leaveSelector(leavePhaseEnd).firstDerivativeByPhase;
    const hermite = (u, start, duration, x0, x1, m0, m1) => {
      const t = (u - start) / duration;
      const t2 = t * t;
      const t3 = t2 * t;
      const value = (2 * t3 - 3 * t2 + 1) * x0 + (t3 - 2 * t2 + t) * duration * m0
        + (-2 * t3 + 3 * t2) * x1 + (t3 - t2) * duration * m1;
      const first = ((6 * t2 - 6 * t) * x0 + (3 * t2 - 4 * t + 1) * duration * m0
        + (-6 * t2 + 6 * t) * x1 + (3 * t2 - 2 * t) * duration * m1) / duration;
      const second = ((12 * t - 6) * x0 + (6 * t - 4) * duration * m0
        + (-12 * t + 6) * x1 + (6 * t - 2) * duration * m1) / duration ** 2;
      return {
        firstDerivativeByPhase: first,
        secondDerivativeByPhase: second,
        value,
      };
    };
    let firstHalfSelector;
    if (local < leavePhaseEnd) firstHalfSelector = leaveSelector(local);
    else if (local < freePhaseEnd) {
      firstHalfSelector = hermite(local, leavePhaseEnd, freeWindowPhase,
        -freeSelectorHalfWidth, freeSelectorHalfWidth,
        leaveEndSlope, leaveEndSlope);
    } else if (local < enterPhaseEnd) {
      firstHalfSelector = hermite(local, freePhaseEnd, enterPhaseDuration,
        freeSelectorHalfWidth, engagementShift, leaveEndSlope, 0);
    } else firstHalfSelector = fixedProfile(engagementShift);
    const selectorProfile = {
      firstDerivativeByPhase: mirror * firstHalfSelector.firstDerivativeByPhase,
      secondDerivativeByPhase: mirror * firstHalfSelector.secondDerivativeByPhase,
      value: mirror * firstHalfSelector.value,
    };
    // Rope: driven at the worm ratio whenever a wheel is engaged.
    const linear = (value, rate) => ({
      firstDerivativeByPhase: rate,
      secondDerivativeByPhase: 0,
      value,
    });
    const topRope = bucketStroke - 2 * leaveRise;
    let ropeProfile;
    let engagedWheel;
    let mode;
    if (phase < leavePhaseEnd) {
      ropeProfile = linear(-ropePhaseRate * phase, -ropePhaseRate);
      engagedWheel = 'left';
      mode = 'left-full-bucket-strikes-tappet-and-drives-worm-off-left-wheel';
    } else if (phase < freePhaseEnd) {
      ropeProfile = fixedProfile(-leaveRise);
      engagedWheel = null;
      mode = 'left-high-bucket-dumps-and-trips-worm-toward-right-wheel';
    } else if (phase < 0.5) {
      ropeProfile = linear(-leaveRise + ropePhaseRate * (phase - freePhaseEnd),
        ropePhaseRate);
      engagedWheel = 'right';
      mode = 'right-worm-wheel-raises-right-full-bucket-and-lowers-left-empty-bucket';
    } else if (phase < 0.5 + leavePhaseEnd) {
      ropeProfile = linear(topRope + ropePhaseRate * (phase - 0.5),
        ropePhaseRate);
      engagedWheel = 'right';
      mode = 'right-full-bucket-strikes-tappet-and-drives-worm-off-right-wheel';
    } else if (phase < 0.5 + freePhaseEnd) {
      ropeProfile = fixedProfile(topRope + leaveRise);
      engagedWheel = null;
      mode = 'right-high-bucket-dumps-and-trips-worm-toward-left-wheel';
    } else {
      ropeProfile = linear(topRope + leaveRise
        - ropePhaseRate * (phase - 0.5 - freePhaseEnd), -ropePhaseRate);
      engagedWheel = 'left';
      mode = 'left-worm-wheel-raises-left-full-bucket-and-lowers-right-empty-bucket';
    }
    let leftWaterProfile;
    let rightWaterProfile;
    let leftTiltProfile = fixedProfile(0);
    let rightTiltProfile = fixedProfile(0);
    if (phase < exchangeLeftEndPhase) {
      leftWaterProfile = transitionProfile(
        phase, 0, exchangeLeftEndPhase, 1, 0);
      rightWaterProfile = transitionProfile(
        phase, 0, exchangeLeftEndPhase, 0, 1);
      const middle = exchangeLeftEndPhase / 2;
      // Pass 69: the struck bucket tips its mouth outward over its trough
      // (bottom swinging in toward the stand), as Brown draws the left one
      // pouring; it used to tip the other way and spill back into the well.
      leftTiltProfile = phase < middle
        ? transitionProfile(phase, 0, middle, 0, maximumBucketTilt)
        : transitionProfile(phase, middle, exchangeLeftEndPhase,
          maximumBucketTilt, 0);
    } else if (phase < rightLiftEndPhase) {
      leftWaterProfile = fixedProfile(0);
      rightWaterProfile = fixedProfile(1);
    } else if (phase < exchangeRightEndPhase) {
      leftWaterProfile = transitionProfile(
        phase, rightLiftEndPhase, exchangeRightEndPhase, 0, 1);
      rightWaterProfile = transitionProfile(
        phase, rightLiftEndPhase, exchangeRightEndPhase, 1, 0);
      const middle = (rightLiftEndPhase + exchangeRightEndPhase) / 2;
      rightTiltProfile = phase < middle
        ? transitionProfile(phase, rightLiftEndPhase, middle,
          0, -maximumBucketTilt)
        : transitionProfile(phase, middle, exchangeRightEndPhase,
          -maximumBucketTilt, 0);
    } else {
      leftWaterProfile = fixedProfile(1);
      rightWaterProfile = fixedProfile(0);
    }

    const ropeDisplacement = ropeProfile.value;
    const ropeSpeed = profileRate(ropeProfile, phaseSpeed);
    const ropeAcceleration = profileAcceleration(
      ropeProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    const pulleyAngle = ropeDisplacement / pulleyRadius;
    const pulleyAngularSpeed = ropeSpeed / pulleyRadius;
    const pulleyAngularAcceleration = ropeAcceleration / pulleyRadius;
    // The wind wheel and worm never stop.
    const wormAngle = wormTravelPerCycle * phase;
    const wormAngularSpeed = wormTravelPerCycle * phaseSpeed;
    const wormAngularAcceleration = wormTravelPerCycle * phaseAcceleration;

    const selectorX = selectorProfile.value;
    const selectorSpeed = profileRate(selectorProfile, phaseSpeed);
    const selectorAcceleration = profileAcceleration(
      selectorProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    const carrierRadicand = carrierCenterDistance ** 2 - selectorX ** 2;
    const carrierVerticalDistance = Math.sqrt(carrierRadicand);
    const carrierAngle = Math.asin(selectorX / carrierCenterDistance);
    const carrierAngularSpeed = selectorSpeed / carrierVerticalDistance;
    const carrierAngularAcceleration =
      selectorAcceleration / carrierVerticalDistance
      + selectorX * selectorSpeed ** 2 / carrierRadicand ** 1.5;
    const wormCenter = new THREE.Vector3(
      selectorX,
      carrierTop.y - carrierVerticalDistance,
      carrierTop.z,
    );
    const carrierBottomDistance = carrierCenterDistance + wormLength / 2;
    const lowerBearing = new THREE.Vector3(
      Math.sin(carrierAngle) * carrierBottomDistance,
      carrierTop.y - Math.cos(carrierAngle) * carrierBottomDistance,
      carrierTop.z,
    );
    const tappetAngle = -selectorX / engagementShift
      * tappetAngleMagnitude;
    const tappetAngularSpeed = -selectorSpeed / engagementShift
      * tappetAngleMagnitude;
    const tappetAngularAcceleration = -selectorAcceleration
      / engagementShift * tappetAngleMagnitude;
    const tappetLeftTip = new THREE.Vector3(
      tappetPivot.x - Math.cos(tappetAngle) * tappetHalfLength,
      tappetPivot.y - Math.sin(tappetAngle) * tappetHalfLength,
      tappetPivot.z,
    );
    const tappetRightTip = new THREE.Vector3(
      tappetPivot.x + Math.cos(tappetAngle) * tappetHalfLength,
      tappetPivot.y + Math.sin(tappetAngle) * tappetHalfLength,
      tappetPivot.z,
    );

    const leftBailY = highBailY - ropeDisplacement;
    const rightBailY = lowBailY + ropeDisplacement;
    const leftBucketTilt = leftTiltProfile.value;
    const rightBucketTilt = rightTiltProfile.value;
    const leftBucketPivot = new THREE.Vector3(leftRopeX, leftBailY, ropeZ);
    const rightBucketPivot = new THREE.Vector3(
      rightRopeX,
      rightBailY,
      ropeZ,
    );
    const centerOffset = new THREE.Vector3(0, -bucketCenterOffset, 0);
    const leftBucketCenter = centerOffset.clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), leftBucketTilt)
      .add(leftBucketPivot);
    const rightBucketCenter = centerOffset.clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), rightBucketTilt)
      .add(rightBucketPivot);
    const leftVerticalLength = wheelCenterY - leftBailY;
    const rightVerticalLength = wheelCenterY - rightBailY;
    const leftWaterFraction = leftWaterProfile.value;
    const rightWaterFraction = rightWaterProfile.value;
    const leftWaterFractionRate = profileRate(
      leftWaterProfile,
      phaseSpeed,
    );
    const rightWaterFractionRate = profileRate(
      rightWaterProfile,
      phaseSpeed,
    );
    const leftWaterFractionAcceleration = profileAcceleration(
      leftWaterProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    const rightWaterFractionAcceleration = profileAcceleration(
      rightWaterProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    const leftBucketTiltSpeed = profileRate(leftTiltProfile, phaseSpeed);
    const rightBucketTiltSpeed = profileRate(rightTiltProfile, phaseSpeed);
    const leftBucketTiltAcceleration = profileAcceleration(
      leftTiltProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    const rightBucketTiltAcceleration = profileAcceleration(
      rightTiltProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    const leftMeshCenterDistance = wormCenter.distanceTo(new THREE.Vector3(
      gearCenters.left.x,
      gearCenters.left.y,
      wormCenter.z,
    ));
    const rightMeshCenterDistance = wormCenter.distanceTo(new THREE.Vector3(
      gearCenters.right.x,
      gearCenters.right.y,
      wormCenter.z,
    ));
    const leftMeshClearance = leftMeshCenterDistance
      - wheelPitchRadius - wormPitchRadius;
    const rightMeshClearance = rightMeshCenterDistance
      - wheelPitchRadius - wormPitchRadius;
    const wormThreadAxialSpeed = -wormAngularSpeed * axialPitch / FULL_TURN;
    const engagedWheelContactTangentialSpeed = engagedWheel === 'right'
      ? -pulleyAngularSpeed * wheelPitchRadius
      : engagedWheel === 'left'
        ? pulleyAngularSpeed * wheelPitchRadius
        : 0;
    const wrap = (angle) => THREE.MathUtils.euclideanModulo(angle + Math.PI,
      FULL_TURN) - Math.PI;
    const meshPhaseInvariant = engagedWheel === 'right'
      ? wrap(wormStarts * wormAngle - wheelTeeth * pulleyAngle
        - rightMeshPhase)
      : engagedWheel === 'left'
        ? wrap(wormStarts * wormAngle + wheelTeeth * pulleyAngle
          - leftMeshPhase)
        : null;
    return {
      activeContactClearance: engagedWheel === 'left'
        ? leftMeshClearance
        : engagedWheel === 'right' ? rightMeshClearance : null,
      carrierAngle,
      carrierAngularAcceleration,
      carrierAngularSpeed,
      engagedWheel,
      engagedWheelContactTangentialSpeed,
      fixedRopeLength,
      inputAcceleration,
      inputAngle: FULL_TURN * phase,
      inputSpeed,
      leftBailY,
      leftBucketCenter,
      leftBucketPivot,
      leftBucketTilt,
      leftBucketTiltAcceleration,
      leftBucketTiltSpeed,
      leftBucketVelocityY: -ropeSpeed,
      leftMeshClearance,
      leftVerticalLength,
      leftWaterFraction,
      leftWaterFractionAcceleration,
      leftWaterFractionRate,
      lowerBearing,
      meshPhaseInvariant,
      mode,
      phase,
      pulleyAngle,
      pulleyAngularAcceleration,
      pulleyAngularSpeed,
      rightBailY,
      rightBucketCenter,
      rightBucketPivot,
      rightBucketTilt,
      rightBucketTiltAcceleration,
      rightBucketTiltSpeed,
      rightBucketVelocityY: ropeSpeed,
      rightMeshClearance,
      rightVerticalLength,
      rightWaterFraction,
      rightWaterFractionAcceleration,
      rightWaterFractionRate,
      ropeAcceleration,
      ropeDisplacement,
      ropeSpeed,
      selectorAcceleration,
      selectorSpeed,
      selectorX,
      tappetAngle,
      tappetAngularAcceleration,
      tappetAngularSpeed,
      tappetLeftTip,
      tappetRightTip,
      totalRopeLength:
        leftVerticalLength + fixedRopeLength + rightVerticalLength,
      wormAngle,
      wormAngularAcceleration,
      wormAngularSpeed,
      wormCenter,
      wormThreadAxialSpeed,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const ropeMaterial = matte(PALETTE.belt, { roughness: 0.64 });
  const bucketMaterial = matte(PALETTE.brass, {
    metalness: 0.12,
    roughness: 0.57,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.76,
    roughness: 0.28,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.14, 3.2),
    frameMaterial,
  ), 'fixed-foundation-of-reciprocating-well-lift');
  base.position.set(0, groundY + 0.07, 0);
  root.add(base);

  // Pass 56: the shaft is Brown's section, not a glazed box: an opaque back
  // wall and floor between the two side walls, open toward the viewer; the
  // side walls end at the section plane just in front of the water.
  const well = addRole(new THREE.Mesh(
    mergeBoxes([[4.24, 3.48, 0.12, 0, 0, -1.06], [4.24, 0.12, 2.12, 0, -1.80, 0]]),
    matte(PALETTE.muted, { roughness: 0.82 }),
  ), 'well-shaft-back-wall-and-floor-beneath-opposed-buckets');
  well.position.set(0, -1.93, ropeZ);
  root.add(well);
  // The well water stands where the lowered bucket's bottom dips 0.14 into
  // it at the end of each descent, and fills the shaft down to its floor.
  const wellWaterTop = lowBailY - bucketCenterOffset - bucketHeight / 2 + 0.14;
  const wellFloorY = -1.93 - 3.48 / 2;
  const wellWater = addRole(new THREE.Mesh(
    waterVolumeGeometry({ xMin: -1.96, xMax: 1.96, surfaceY: 0, bottomY: wellFloorY - wellWaterTop, zMin: -0.86, zMax: 0.86 }),
    waterVolumeMaterial(),
  ), 'well-water-filling-the-low-bucket');
  wellWater.renderOrder = 1;
  wellWater.position.set(0, wellWaterTop, ropeZ);
  root.add(wellWater);
  for (const x of [-2.30, 2.30]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 2.78, 2.075),
      frameMaterial,
    );
    wall.position.set(x, -2.27, ropeZ - 0.1375);
    root.add(wall);
  }

  const support = addRole(new THREE.Group(),
    'fixed-frame-carrying-wind-shaft-two-wheel-axles-and-tappet-pivot');
  root.add(support);
  for (const x of [-2.42, 2.42]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 4.55, 0.28),
      frameMaterial,
    );
    post.position.set(x, 1.24, 0.28);
    post.userData.role = 'fixed-side-post-of-well-frame';
    support.add(post);
  }
  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(5.30, 0.20, 0.34),
    frameMaterial,
  );
  topBeam.position.set(0, 3.72, 0.28);
  topBeam.userData.role = 'fixed-top-beam-of-well-frame';
  support.add(topBeam);
  // Pass 64: Brown draws no bar behind the two chain wheels; their axles
  // end as plain stubs.
  // Pass 80: Brown's central post rises from the bottom line of his
  // elevation to the tappet block, so it stands on the well floor (it ended
  // in mid-air at y -0.63, leaving the frame carried by nothing).
  // Pass 92: the post's head is a round boss concentric with the tappet
  // pivot (r 0.17 against the pin's 0.12), in the post's one extrusion, so
  // the pivot no longer stands wider than the post's square top; the pin's
  // end stands 0.04 proud of the head's face and the tappet's hub (r 0.20)
  // still shows round the head.
  const tappetStandBottom = wellFloorY;
  const tappetStandHead = 0.17;
  const tappetStand = new THREE.Mesh(
    plate(polygonClipping.union(
      poly([[-0.09, tappetStandBottom], [0.09, tappetStandBottom], [0.09, tappetPivot.y], [-0.09, tappetPivot.y]]),
      poly(circle([0, tappetPivot.y], tappetStandHead, 64)),
    ), 0.19, 0.41),
    frameMaterial,
  );
  tappetStand.userData.role = 'fixed-central-post-with-round-head-at-tappet-pivot';
  support.add(tappetStand);

  const windRotor = addRole(new THREE.Group(),
    'horizontal-wind-wheel-continuously-coupled-to-spiral-shaft');
  windRotor.position.set(0, 4.18, 0.03);
  root.add(windRotor);
  const windHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.34, 28),
    darkMaterial,
  );
  windRotor.add(windHub);
  // Brown's horizontal wind wheel is a shallow drum of upright vanes between
  // two annular boards, seen edge-on as a band shaded at its ends.
  const windMaterial = matte(PALETTE.brass, { metalness: 0.08, roughness: 0.62 });
  const windInner = 0.92;
  const windOuter = 1.42;
  const windHalfHeight = 0.19;
  for (const y of [-windHalfHeight - 0.02, windHalfHeight + 0.02]) {
    const board = new THREE.Mesh(plate(polygonClipping.difference(
      poly(circle([0, 0], windOuter, 128)), poly(circle([0, 0], windInner, 128))),
    -0.02, 0.02), windMaterial);
    board.rotation.x = -Math.PI / 2;
    board.position.y = y;
    board.userData.role = 'annular-board-of-horizontal-wind-wheel';
    windRotor.add(board);
  }
  for (let index = 0; index < 20; index += 1) {
    const angle = index * FULL_TURN / 20;
    const vane = new THREE.Mesh(
      new THREE.BoxGeometry(windOuter - windInner, 2 * windHalfHeight, 0.035),
      matte(PALETTE.driver, { metalness: 0.08, roughness: 0.62 }),
    );
    // Each vane is set 35 degrees off radial so the wind turns the drum.
    const mid = (windInner + windOuter) / 2;
    vane.position.set(Math.cos(angle) * mid, 0, Math.sin(angle) * mid);
    vane.rotation.y = -angle - 0.61;
    vane.userData.role = 'upright-vane-of-horizontal-wind-wheel';
    windRotor.add(vane);
  }
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2 + Math.PI / 4;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(windInner - 0.19, 0.06, 0.08),
      darkMaterial);
    arm.position.set(Math.cos(angle) * (windInner + 0.19) / 2, -windHalfHeight - 0.02,
      Math.sin(angle) * (windInner + 0.19) / 2);
    arm.rotation.y = -angle;
    arm.userData.role = 'arm-joining-wind-wheel-to-hub';
    windRotor.add(arm);
  }
  // Pass 86: Brown's upright shaft runs down to a square block at the
  // spiral's head; the spiral rocks sideways under it while both turn. The
  // joint is a Hooke coupling: the square block is the spider, turning with
  // both shafts, with two trunnions along its local x for a fork on the
  // wind-wheel shaft and two along its local z for a fork on the spiral's
  // shaft. The spider's centre is the carrier's rocking point (carrierTop).
  // Fork cheeks: 0.06 plates at 0.12-0.18 from the centre, bored 0.042 for
  // the 0.04 trunnions; bridges at 0.12-0.17 beyond the 0.20 block.
  const forkCheek = (up) => {
    const ring = [[-0.06, up * 0.17], [-0.06, 0]];
    for (let i = 1; i < 24; i += 1) {
      // Round end on the far side of the trunnion from the bridge.
      const a = Math.PI + up * Math.PI * i / 24;
      ring.push([0.06 * Math.cos(a), 0.06 * Math.sin(a)]);
    }
    ring.push([0.06, 0], [0.06, up * 0.17]);
    return polygonClipping.difference(poly(ring), poly(circle([0, 0], 0.042, 48)));
  };
  const cleanParts = (parts) => mergeGeometries(parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k);
    return n;
  }));
  const couplingMaterial = matte(PALETTE.accent, { metalness: 0.22, roughness: 0.48 });
  // The wind-wheel shaft turns with the wheel (one body with its hub) and
  // ends on its fork's bridge (0.17 above the spider's centre).
  const upperShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.57, 24),
    darkMaterial,
  ), 'fixed-axis-upper-wind-wheel-shaft');
  upperShaft.position.set(0, 3.855 - 4.18 + 0.03, 0);
  windRotor.add(upperShaft);
  // Upper fork: cheeks at x ±0.12..0.18, hanging from a bridge over the block.
  const upperFork = addRole(new THREE.Mesh(cleanParts([
    new THREE.BoxGeometry(0.36, 0.05, 0.12).translate(0, 0.145, 0),
    ...[[0.12, 0.18], [-0.18, -0.12]].map(([x0, x1]) => plate(forkCheek(1), x0, x1).rotateY(Math.PI / 2)),
  ]), darkMaterial), 'coupling-fork-on-wind-wheel-shaft');
  upperFork.position.copy(carrierTop).sub(windRotor.position);
  windRotor.add(upperFork);

  const flexibleCoupling = addRole(new THREE.Group(),
    'flexible-coupling-permitting-small-lateral-worm-vibration');
  flexibleCoupling.position.copy(carrierTop);
  root.add(flexibleCoupling);
  const couplingBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.20, 0.20),
    couplingMaterial,
  );
  couplingBlock.userData.role = 'coupling-spider-block';
  flexibleCoupling.add(couplingBlock);
  // Two crossed trunnion bars (x for the upper fork, z for the lower).
  const couplingPin = new THREE.Mesh(cleanParts([
    new THREE.CylinderGeometry(0.04, 0.04, 0.36, 24).rotateZ(Math.PI / 2),
    new THREE.CylinderGeometry(0.04, 0.04, 0.36, 24).rotateX(Math.PI / 2),
  ]), darkMaterial);
  couplingPin.userData.role = 'coupling-spider-trunnions';
  flexibleCoupling.add(couplingPin);

  const wormCarrier = addRole(new THREE.Group(),
    'laterally-rocking-lower-shaft-carrying-one-single-start-worm');
  wormCarrier.position.copy(carrierTop);
  root.add(wormCarrier);
  // The spiral's shaft runs from its lower fork's bridge to the worm's top;
  // a short stub below the worm turns in the step's bore.
  const wormTop = -carrierCenterDistance + wormLength / 2;
  const wormBottom = -carrierCenterDistance - wormLength / 2;
  const lowerShaft = new THREE.Mesh(cleanParts([
    new THREE.CylinderGeometry(0.075, 0.075, -0.15 - wormTop, 24)
      .translate(0, (-0.15 + wormTop) / 2, 0),
    // Lower fork: cheeks at z ±0.12..0.18, rising from a bridge under the block.
    new THREE.BoxGeometry(0.12, 0.05, 0.36).translate(0, -0.145, 0),
    ...[[0.12, 0.18], [-0.18, -0.12]].map(([z0, z1]) => plate(forkCheek(-1), z0, z1)),
  ]), darkMaterial);
  lowerShaft.userData.role = 'spiral-shaft-with-coupling-fork';
  wormCarrier.add(lowerShaft);
  const lowerStub = new THREE.Mesh(
    // Short enough to stay clear of the tappet arm meeting the step below.
    new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24),
    darkMaterial,
  );
  lowerStub.position.y = wormBottom - 0.03;
  wormCarrier.add(lowerStub);
  const worm = addRole(makeScrew({
    axis: Y_AXIS,
    color: PALETTE.accent,
    handedness: 1,
    length: wormLength,
    pitch: axialPitch,
    radius: wormPitchRadius,
    threadRadius: 0.045,
  }), 'single-start-spiral-alternately-meshing-one-worm-wheel-at-a-time');
  worm.position.set(0, -carrierCenterDistance, 0);
  wormCarrier.add(worm);
  // The spiral's shaft and its fork turn with the worm: carry them on the
  // worm's rotor (its local z is the carrier's +y), re-expressed there.
  {
    const rotor = worm.userData.rotor;
    const spin = rotor.rotation.z;
    rotor.rotation.z = 0;
    wormCarrier.updateMatrixWorld(true);
    const toRotor = rotor.matrixWorld.clone().invert().multiply(wormCarrier.matrixWorld);
    rotor.rotation.z = spin;
    lowerShaft.geometry.applyMatrix4(toRotor);
    rotor.add(lowerShaft);
  }
  // The thread is formed on its core: the core reaches the thread's root
  // (pitch radius less the thread radius), so the spiral is not a loose wire.
  {const core=worm.userData.rotor.children.find(o=>o.geometry?.type==='CylinderGeometry');
   const coreRadius=wormPitchRadius-0.045+0.004;
   core.geometry.dispose();core.geometry=new THREE.CylinderGeometry(coreRadius,coreRadius,wormLength,40);}

  const makeWheelAssembly = (side, color) => {
    const center = gearCenters[side];
    // Brown draws each worm wheel as a star: a small boss ringed by long
    // square pins that the single-start spiral takes one at a time.
    const gear = addRole(new THREE.Group(),
      `${side}-worm-wheel-on-common-axis-with-rope-pulley`);
    const gearRotor = new THREE.Group();
    gear.add(gearRotor);
    gear.userData.rotor = gearRotor;
    // Short, slender pins (tips 0.030 past the pitch circle, 0.056 wide) so
    // the thread's crest and flanks clear them on the swung worm.
    const pinOuterRadius = wheelPitchRadius + pinReach;
    const pinHalfWidth = 0.028;
    const starOutline = polygonClipping.difference(polygonClipping.union(
      poly(circle([0, 0], 0.34, 96)),
      ...Array.from({ length: wheelTeeth }, (_, index) => {
        const angle = index * FULL_TURN / wheelTeeth;
        const c = Math.cos(angle), s = Math.sin(angle);
        return poly([[0.30, -pinHalfWidth], [pinOuterRadius, -pinHalfWidth],
          [pinOuterRadius, pinHalfWidth], [0.30, pinHalfWidth]]
          .map(([x, y]) => [x * c - y * s, x * s + y * c]));
      })), poly(circle([0, 0], 0.105, 64)));
    // The star is a thin plate (0.10 deep): deeper square pins reach round
    // the helix off the mesh plane and cut into the thread. At this depth the
    // engaged pins run 0 to 0.006 off the thread flank, with no overlap.
    const star = addRole(new THREE.Mesh(plate(starOutline, -0.05, 0.05),
      matte(color, { metalness: 0.12 })), `${side}-pinned-star-worm-wheel`);
    gearRotor.add(star);
    gear.position.copy(center);
    root.add(gear);
    const pulley = addRole(makePulley({
      color,
      grooves: 1,
      radius: pulleyRadius,
      spokes: 6,
      width: 0.27,
    }), `${side}-rope-pulley-rigidly-coaxial-with-worm-wheel`);
    pulley.position.copy(pulleyCenters[side]);
    root.add(pulley);
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 1.05, 24),
      darkMaterial,
    );
    axle.rotation.x = Math.PI / 2;
    axle.position.set(center.x, center.y, -0.12);
    root.add(axle);
    return { axle, gear, pulley };
  };
  const leftAssembly = makeWheelAssembly('left', PALETTE.driver);
  const rightAssembly = makeWheelAssembly('right', PALETTE.driven);

  const continuousRope = addRole(new THREE.Group(),
    'one-continuous-rope-over-two-coaxially-driven-pulleys-with-two-bucket-ends');
  root.add(continuousRope);
  const makeUpperArc = (center, side) => {
    const first=side==='left'?Math.PI:Math.PI/2;
    const curve=new THREE.Curve();
    curve.getPoint=(t,target=new THREE.Vector3())=>{
      const angle=first-Math.PI*t/2;
      return target.set(center.x+pulleyRadius*Math.cos(angle),center.y+pulleyRadius*Math.sin(angle),ropeZ);
    };
    curve.getTangent=(t,target=new THREE.Vector3())=>{
      const angle=first-Math.PI*t/2;
      return target.set(Math.sin(angle),-Math.cos(angle),0);
    };
    return addRole(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 128, 0.038, 12, false),
      ropeMaterial,
    ), `${side}-fixed-upper-rope-wrap-on-pulley`);
  };
  const leftUpperArc = makeUpperArc(pulleyCenters.left, 'left');
  const rightUpperArc = makeUpperArc(pulleyCenters.right, 'right');
  continuousRope.add(leftUpperArc, rightUpperArc);
  const innerRope = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, innerRopeSpan, 14),
    ropeMaterial,
  ), 'single-rope-inner-span-between-two-pulleys');
  innerRope.rotation.z = Math.PI / 2;
  innerRope.position.set(0, wheelCenterY + pulleyRadius, ropeZ);
  continuousRope.add(innerRope);
  const leftRopeLeg = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 1, 14),
    ropeMaterial,
  ), 'single-rope-left-outer-vertical-leg');
  const rightRopeLeg = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 1, 14),
    ropeMaterial,
  ), 'single-rope-right-outer-vertical-leg');
  continuousRope.add(leftRopeLeg, rightRopeLeg);
  // Brown draws one laid rope: render it as the shared three-strand rope from
  // the left bail over both pulleys to the right bail. The span pieces stay as
  // hidden references for the contact checks.
  const laidRope = addRole(new THREE.Mesh(new THREE.BufferGeometry(), ropeMaterial),
    'single-laid-rope-over-both-pulleys-between-both-bails');
  continuousRope.add(laidRope);
  for (const piece of [leftUpperArc, rightUpperArc, innerRope, leftRopeLeg, rightRopeLeg]) {
    // Pinned hidden: the leg updates would otherwise show the plain tubes
    // again beside the laid rope.
    Object.defineProperty(piece, 'visible', { configurable: true, get: () => false, set: () => {} });
  }
  const layRope = (leftY, rightY) => {
    const arc = (center, first) => {
      const curve = new THREE.Curve();
      curve.getPoint = (t, target = new THREE.Vector3()) => {
        const angle = first - Math.PI * t / 2;
        return target.set(center.x + pulleyRadius * Math.cos(angle), center.y + pulleyRadius * Math.sin(angle), ropeZ);
      };
      return curve;
    };
    const left = pulleyCenters.left, right = pulleyCenters.right;
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(new THREE.Vector3(leftRopeX, leftY, ropeZ),
      new THREE.Vector3(left.x - pulleyRadius, left.y, ropeZ)));
    path.add(arc(left, Math.PI));
    path.add(new THREE.LineCurve3(new THREE.Vector3(left.x, left.y + pulleyRadius, ropeZ),
      new THREE.Vector3(right.x, right.y + pulleyRadius, ropeZ)));
    path.add(arc(right, Math.PI / 2));
    path.add(new THREE.LineCurve3(new THREE.Vector3(right.x + pulleyRadius, right.y, ropeZ),
      new THREE.Vector3(rightRopeX, rightY, ropeZ)));
    replaceWithLaidRope(laidRope, path, {radius: 0.038, tubularSegments: 256});
  };

  const makeBucket = (side) => {
    const bucket = addRole(new THREE.Group(),
      `${side}-bucket-pivoted-at-the-rope-end-for-top-dumping`);
    root.add(bucket);
    const bodyY = -bucketHandleRise - bucketHeight / 2;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        bucketRadius,
        bucketRadius * 0.76,
        bucketHeight,
        34,
        1,
        true,
      ),
      bucketMaterial,
    );
    body.position.y = bodyY;
    bucket.add(body);
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(
        bucketRadius * 0.76,
        bucketRadius * 0.76,
        0.07,
        32,
      ),
      darkMaterial,
    );
    bottom.position.y = bodyY - bucketHeight / 2;
    bucket.add(bottom);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(bucketRadius, 0.045, 10, 38),
      darkMaterial,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -bucketHandleRise;
    bucket.add(rim);
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.29, -bucketHandleRise, 0),
      new THREE.Vector3(-0.20, -0.14, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.20, -0.14, 0),
      new THREE.Vector3(0.29, -bucketHandleRise, 0),
    ], false, 'centripetal');
    const handle = new THREE.Mesh(
      new THREE.TubeGeometry(handleCurve, 40, 0.032, 10, false),
      darkMaterial,
    );
    bucket.add(handle);
    // Pass 69 (p69-w1): the payload is a level-surfaced body inscribed in
    // the tapered bucket and clipped by the world-horizontal surface, which
    // can never stand above the lowest point of the rim: as the struck
    // bucket tips, what no longer fits pours out (it used to stay upright
    // while the bucket tipped and poke through the staves).
    const water = addRole(new THREE.Mesh(makeCellWaterGeometry(), waterVolumeMaterial({opacity: 0.5})), `${side}-bucket-water-payload`);
    water.renderOrder = 1;
    bucket.add(water);
    return { body, bucket, water };
  };
  const leftBucket = makeBucket('left');
  const rightBucket = makeBucket('right');

  // The delivery troughs are open boxes (floor, two sides and an inner end,
  // open at the outer end), so the poured water has somewhere to go.
  const troughGeometry = (() => {
    const parts = [
      [1.25, 0.05, 1.05, 0, -0.075, 0],
      [1.25, 0.20, 0.06, 0, 0, 0.495],
      [1.25, 0.20, 0.06, 0, 0, -0.495],
      [0.06, 0.20, 0.93, 0.595, 0, 0],
    ].map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed());
    const merged = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    return merged;
  })();
  const makeTrough = (side) => {
    const sign = side === 'left' ? -1 : 1;
    const geometry = sign < 0 ? troughGeometry : troughGeometry.clone().scale(-1, 1, 1);
    if (sign > 0) {
      const index = geometry.attributes.position;
      // mirrored: restore outward winding
      for (let i = 0; i < index.count; i += 3) {
        const x = index.getX(i + 1), y = index.getY(i + 1), z = index.getZ(i + 1);
        index.setXYZ(i + 1, index.getX(i + 2), index.getY(i + 2), index.getZ(i + 2));
        index.setXYZ(i + 2, x, y, z);
      }
      geometry.computeVertexNormals();
    }
    const trough = addRole(new THREE.Mesh(
      geometry,
      matte(PALETTE.muted, { metalness: 0.12, roughness: 0.64 }),
    ), `${side}-delivery-trough-receiving-the-tipped-high-bucket`);
    trough.position.set(sign * 2.30, -0.22, ropeZ);
    trough.rotation.z = sign * THREE.MathUtils.degToRad(8);
    root.add(trough);
    return trough;
  };
  const leftTrough = makeTrough('left');
  const rightTrough = makeTrough('right');
  const troughWaterGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.92).translate(0, -0.02, 0);
  const leftTroughWater = new THREE.Mesh(troughWaterGeometry, waterVolumeMaterial({opacity: 0.45}));
  leftTroughWater.userData.role = 'water-running-in-left-trough';
  leftTrough.add(leftTroughWater);
  const rightTroughWater = new THREE.Mesh(troughWaterGeometry, waterVolumeMaterial({opacity: 0.45}));
  rightTroughWater.userData.role = 'water-running-in-right-trough';
  rightTrough.add(rightTroughWater);

  const tappet = addRole(new THREE.Group(),
    'central-vibrating-tappet-struck-by-each-ascending-bucket');
  tappet.position.copy(tappetPivot);
  root.add(tappet);
  // The bar turns on the fixed pivot through a bore (no coaxial overlap).
  const tappetBar = new THREE.Mesh(
    plate(polygonClipping.difference(
      poly([[-tappetHalfLength, -0.065], [tappetHalfLength, -0.065],
        [tappetHalfLength, 0.065], [-tappetHalfLength, 0.065]]),
      poly(circle([0, 0], 0.122, 64)),
    ), -0.11, 0.11),
    matte(PALETTE.accent, { metalness: 0.16, roughness: 0.54 }),
  );
  tappet.add(tappetBar);
  for (const x of [-tappetHalfLength, tappetHalfLength]) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.28, 0.28),
      darkMaterial,
    );
    pad.position.x = x;
    tappet.add(pad);
  }
  // Pass 57: a crank lug rises from the tappet's hub to the pin that carries
  // the arm to the worm step, so the arm ends on the tappet, not in mid-air.
  {
    const lugOutline = polygonClipping.difference(
      polygonClipping.union(poly(circle([0, 0], 0.20, 64)),
        poly([[-0.08, 0], [0.08, 0], [0.08, 0.32], [-0.08, 0.32]]),
        poly(circle([0, 0.32], 0.13, 48))),
      poly(circle([0, 0], 0.122, 64)), poly(circle([0, 0.32], 0.085, 32)));
    // The lug lies behind the arm's plane; a crank pin from it carries the
    // arm's lower end (a pin joint).
    const lug = new THREE.Mesh(plate(lugOutline, -0.20, -0.08), tappetBar.material);
    lug.userData.role = 'tappet-crank-lug-carrying-worm-step-arm';
    const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.084, 0.26, 32).rotateX(Math.PI / 2), darkMaterial);
    crankPin.position.set(0, 0.32, -0.07);
    crankPin.userData.role = 'tappet-crank-pin-carrying-worm-step-arm';
    tappet.add(lug, crankPin);
  }
  const tappetPivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.66, 24).translate(0, 0.05, 0),
    darkMaterial,
  ), 'fixed-tappet-pivot');
  tappetPivotAxle.rotation.x = Math.PI / 2;
  tappetPivotAxle.position.copy(tappetPivot);
  root.add(tappetPivotAxle);

  const selectorBearing = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.38),
    matte(PALETTE.accent, { metalness: 0.18, roughness: 0.52 }),
  ), 'laterally-traversed-step-supporting-lower-spiral-shaft');
  root.add(selectorBearing);
  const selectorLink = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 16),
    darkMaterial,
  ), 'arm-linking-vibrating-tappet-to-traversing-worm-step');
  root.add(selectorLink);

  const payloadHalfDepth = 0.15, payloadFloorY = -bucketHandleRise - bucketHeight + 0.045;
  const payloadRimY = -bucketHandleRise - 0.02, payloadFullRise = 0.52;
  const payloadHalfWidthAt = (y) => {
    const r = bucketRadius * 0.76 - 0.03 + (bucketRadius * 0.24) * (y - (-bucketHandleRise - bucketHeight)) / bucketHeight;
    return Math.sqrt(Math.max(0.001, r * r - payloadHalfDepth * payloadHalfDepth)) - 0.01;
  };
  const payloadOutline = [
    [-payloadHalfWidthAt(payloadFloorY), payloadFloorY], [payloadHalfWidthAt(payloadFloorY), payloadFloorY],
    [payloadHalfWidthAt(payloadRimY), payloadRimY], [-payloadHalfWidthAt(payloadRimY), payloadRimY],
  ];
  const lowestRimLip = new THREE.Vector3();
  const updateBucketWater = (bucket, fraction, tilt) => {
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const ys = payloadOutline.map(([x, y]) => x * sn + y * c);
    const rimLimit = Math.min(ys[2], ys[3]) - Math.min(...ys);
    const fill = Math.min(fraction, Math.max(0, rimLimit - 0.01) / payloadFullRise);
    updateClippedCell(bucket.water, payloadOutline, tilt, fill, payloadFullRise, 2 * payloadHalfDepth);
    const lip = ys[2] < ys[3] ? payloadOutline[2] : payloadOutline[3];
    lowestRimLip.set(lip[0] * c - lip[1] * sn, lip[0] * sn + lip[1] * c, 0);
    return lowestRimLip;
  };
  // Each tipping bucket pours over its lowest lip into the open trough below
  // as one stream whose flow follows the emptying rate, recomputed in place.
  const pourSamples = 16;
  const makePour = (side) => {
    const path = {points: Array.from({length: pourSamples + 1}, () => new THREE.Vector3()),
      speeds: new Array(pourSamples + 1).fill(1), times: new Array(pourSamples + 1).fill(0)};
    const pour = new WaterStream(path, {width: 0.2, thickness: 0.05, widthAxis: new THREE.Vector3(0, 0, 1),
      widthExponent: 0.4, foam: {start: 0.85, amount: 0.4}, cyclePeriod: 9, streakRate: 1.4, opacity: 0.5});
    pour.pourPath = path;
    pour.userData.role = `${side}-tipped-bucket-pouring-into-trough`;
    root.add(pour);
    return pour;
  };
  const pours = {left: makePour('left'), right: makePour('right')};
  const troughTopY = -0.80 - 0.04; // the trough floor
  const updatePour = (pour, bucket, lip, rate, sign) => {
    const flow = Math.min(1, Math.max(0, -rate) / 2.1);
    pour.visible = flow > 0.004;
    if (!pour.visible) return;
    const x0 = bucket.bucket.position.x + lip.x, y0 = bucket.bucket.position.y + lip.y;
    const vx = sign * 1.5, g = 9.81, tEnd = Math.min(1, flow / 0.3) * Math.sqrt(2 * Math.max(0.02, y0 - troughTopY) / g);
    const {points, speeds, times} = pour.pourPath;
    for (let i = 0; i <= pourSamples; i += 1) {
      const t = tEnd * i / pourSamples;
      points[i].set(x0 + vx * t, y0 - 0.5 * g * t * t, ropeZ);
      speeds[i] = Math.hypot(vx, g * t) + 0.4;
      times[i] = t;
    }
    pour.flow = Math.max(0.004, flow);
    pour.setPath(pour.pourPath);
  };
  const updateStreams = collectWaterStreams(root);

  const wheelPhase = Math.PI / (2 * wheelTeeth);
  const spiderAxes = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const spiderBasis = new THREE.Matrix4();
  const update = (time) => {
    const state = stateAtTime(time);
    windRotor.rotation.y = state.wormAngle;
    wormCarrier.rotation.z = state.carrierAngle;
    setSpin(worm, state.wormAngle);
    // Hooke spider: its x trunnions lie on the upper fork's pin axis and its
    // z trunnions on the lower fork's (made exactly perpendicular; the
    // O(tilt^2) Hooke speed ripple, below 0.003 rad here, is not shown).
    {
      const c = Math.cos(state.wormAngle), s = Math.sin(state.wormAngle);
      const a1 = spiderAxes[0].set(c, 0, -s);
      const a2 = spiderAxes[1].set(s, 0, c).applyAxisAngle(spiderAxes[3].set(0, 0, 1), state.carrierAngle);
      a2.addScaledVector(a1, -a1.dot(a2)).normalize();
      const up = spiderAxes[2].crossVectors(a2, a1);
      flexibleCoupling.quaternion.setFromRotationMatrix(spiderBasis.makeBasis(a1, up, a2));
    }
    setSpin(leftAssembly.gear, wheelPhase + state.pulleyAngle
      - leftMeshPhase / wheelTeeth);
    setSpin(rightAssembly.gear, wheelPhase + state.pulleyAngle
      + rightMeshPhase / wheelTeeth);
    setSpin(leftAssembly.pulley, state.pulleyAngle);
    setSpin(rightAssembly.pulley, state.pulleyAngle);
    setVerticalExtent(leftRopeLeg, state.leftBailY, wheelCenterY);
    leftRopeLeg.position.x = leftRopeX;
    leftRopeLeg.position.z = ropeZ;
    setVerticalExtent(rightRopeLeg, state.rightBailY, wheelCenterY);
    rightRopeLeg.position.x = rightRopeX;
    rightRopeLeg.position.z = ropeZ;
    layRope(state.leftBailY, state.rightBailY);
    leftBucket.bucket.position.copy(state.leftBucketPivot);
    leftBucket.bucket.rotation.z = state.leftBucketTilt;
    rightBucket.bucket.position.copy(state.rightBucketPivot);
    rightBucket.bucket.rotation.z = state.rightBucketTilt;
    const leftLip = updateBucketWater(leftBucket, state.leftWaterFraction, state.leftBucketTilt).clone();
    updatePour(pours.left, leftBucket, leftLip, state.leftWaterFractionRate, -1);
    const rightLip = updateBucketWater(rightBucket, state.rightWaterFraction, state.rightBucketTilt);
    updatePour(pours.right, rightBucket, rightLip, state.rightWaterFractionRate, 1);
    for (const [trough, water, pour] of [[leftTrough, leftTroughWater, pours.left], [rightTrough, rightTroughWater, pours.right]]) {
      water.visible = pour.visible;
    }
    updateStreams(time);
    tappet.rotation.z = state.tappetAngle;
    selectorBearing.position.copy(state.lowerBearing);
    // The crank point sits above the pivot, so the arm to the worm step
    // no longer runs down through the fixed pivot axle (0.118 overlap).
    const tappetCrank = new THREE.Vector3(
      tappetPivot.x - Math.sin(state.tappetAngle) * 0.32,
      tappetPivot.y + Math.cos(state.tappetAngle) * 0.32,
      tappetPivot.z,
    );
    // The arm meets the step's lower face, clear of the shaft end above it.
    const stepFoot = state.lowerBearing.clone().add(new THREE.Vector3(
      Math.sin(state.carrierAngle) * 0.11, -Math.cos(state.carrierAngle) * 0.11, 0));
    // The arm's lower end bears on the crank pin's surface.
    const armDirection = stepFoot.clone().sub(tappetCrank).normalize();
    // Pass 80: the arm's slanted end face stops where its upper edge meets
    // the step's underside, so it bears on the step without entering it.
    const stepAxisCos = Math.abs(armDirection.x * Math.sin(state.carrierAngle)
      - armDirection.y * Math.cos(state.carrierAngle));
    const endSetback = 0.045 * Math.sqrt(Math.max(0, 1 - stepAxisCos ** 2)) / Math.max(stepAxisCos, 0.2);
    setRodBetween(selectorLink, tappetCrank.clone().addScaledVector(armDirection, 0.086),
      stepFoot.clone().addScaledVector(armDirection, -endSetback));
    root.userData.updateSolids?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    axialPitch,
    bucketCenterOffset,
    bucketHandleRise,
    bucketHeight,
    bucketRadius,
    bucketStroke,
    carrierCenterDistance,
    carrierTop,
    cycleDuration,
    engagedCarrierAngle,
    engagementShift,
    enterPhaseEnd,
    exchangeLeftEndPhase,
    exchangeRightEndPhase,
    fixedRopeLength,
    freePhaseEnd,
    freeSelectorHalfWidth,
    freeWindowPhase,
    freeWormTurns,
    groundY,
    highBailY,
    innerRopeSpan,
    inputAngularSpeed,
    leavePhaseEnd,
    leaveRise,
    leftMeshPhase,
    leftRopeX,
    lowBailY,
    maximumBucketTilt,
    pinReach,
    pulleyRadius,
    pulleyTravelAngle,
    pulleyCenters,
    rightLiftEndPhase,
    rightMeshPhase,
    rightRopeX,
    ropePhaseRate,
    tappetAngleMagnitude,
    tappetHalfLength,
    tappetPivot,
    threadReach,
    totalRopeLength,
    wheelCenterX,
    wheelCenterY,
    wheelPitchRadius,
    wheelTeeth,
    wormLength,
    wormPitchRadius,
    wormStarts,
    wormTravelPerCycle,
    wormTravelPerLift,
    wormTurnsPerCycle,
    wormTurnsPerLift,
  };
  root.userData = {
    archetype:
      'wind-wheel-rocking-worm-two-opposed-worm-wheels-one-rope-two-buckets-and-trip-tappet-reversal',
    blocks: {
      base,
      continuousRope,
      flexibleCoupling,
      leftAssembly,
      leftBucket,
      leftRopeLeg,
      leftTrough,
      leftUpperArc,
      rightAssembly,
      rightBucket,
      rightRopeLeg,
      rightTrough,
      rightUpperArc,
      selectorBearing,
      selectorLink,
      support,
      tappet,
      tappetPivotAxle,
      upperShaft,
      well,
      wellWater,
      windRotor,
      worm,
      wormCarrier,
    },
    degreesOfFreedom: {
      bucketMotionIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pulleyRotationIndependent: false,
      selectorIndependent: false,
      tappetIndependent: false,
      wormWheelRotationIndependent: false,
    },
    dynamics: {
      aerodynamicWindTorqueBucketImpactGearToothComplianceBacklashRopeElasticityBearingFrictionAndWaterSloshModeled:
        false,
      driveModel:
        'The wind wheel and worm turn at one constant rate. Whenever a wheel is engaged the single-start worm and that 12-tooth wheel obey the exact 12:1 ratio, so the buckets start and stop with the engagement (velocity steps, as a worm taking up a stopped wheel must). Midway through each exchange the thread crest clears both pin rings and the worm turns freely for half a turn while the rope is held; each wheel\u2019s pin ring is phased so the turning thread takes it up in step.',
      tripModel:
        'The rising full bucket strikes the low end of the rocking tappet at highBailY and, still lifted by its wheel, pushes it: tappet tip and bail stay together until the worm step has carried the thread off that wheel\u2019s pins. The tappet then throws the worm across the free window to the other wheel; meanwhile the high bucket tips and empties and the low bucket fills.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A horizontal wind wheel rotates a vertical single-start spiral through a flexible coupling. The lower spiral shaft rocks laterally and meshes with only one of two side-by-side worm wheels. Each worm wheel is rigidly coaxial with a rear rope pulley, and one continuous rope wraps over both pulleys with a bucket at each outer end. Because both pulleys share that rope, they always rotate together; engaging the wheel on the opposite side of the same-handed worm reverses their direction. Each ascending bucket strikes the low end of a central tappet, tips to discharge, and shifts the worm to the other wheel so the other now-full bucket rises.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'bucket-tripped-alternating-worm-selection-and-opposed-two-bucket-lift',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      engagedWheel: sourceState.engagedWheel,
      leftBailY: sourceState.leftBailY,
      leftWaterFraction: sourceState.leftWaterFraction,
      mode: sourceState.mode,
      rightBailY: sourceState.rightBailY,
      rightWaterFraction: sourceState.rightWaterFraction,
      selectorX: sourceState.selectorX,
      tappetAngle: sourceState.tappetAngle,
    },
    sourceReference: {
      brownPlate459: {
        approximateLeftBucketCenterPixels: [214, 370],
        approximateLeftWheelCenterPixels: [226, 190],
        approximateRightRopeXPixel: 355,
        approximateRightWheelCenterPixels: [319, 190],
        approximateTappetPivotPixels: [274, 319],
        approximateWindWheelCenterPixels: [273, 56],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a horizontal wind-wheel drives a shaft carrying a spiral thread',
          'the flexible coupling permits the spiral to vibrate onto one worm-wheel at a time',
          'pulleys behind the worm-wheels carry one rope with a bucket at each extremity',
          'each ascending bucket strikes a central vibrating tappet',
          'the tappet arm traverses the spiral from one wheel to the other',
          'selection reverses the buckets so the emptied bucket lowers while the other rises',
        ],
        engravingEvidence:
          'Brown shows the horizontal wind rotor and vertical coupled spiral above two equal side-by-side toothed wheels, a rear hanging rope leg outside each wheel, an elevated left bucket dumping into a trough, a low right rope end, and a central rocking tappet linked upward to the spiral support.',
        reconstructionDisclosure:
          'Brown gives no tooth count, worm pitch or hand, pulley diameter, rope route behind the wheel faces, bucket stroke, shaft swing, impact law, fill time, wind speed or absolute timing. The exact single-rope topology follows the singular rope and its two bucket extremities; equal coaxial pulley radii, a 12:1 single-start worm ratio, symmetric discharge troughs, contact-coupled trips, a half-turn free window, water display, colors and 9-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 459',
    },
    stateAtInputAngle,
    stateAtTime,
    timeline: {
      exchangeLeftEndPhase,
      exchangeRightEndPhase,
      rightLiftEndPhase,
      leavePhaseEnd,
      freePhaseEnd,
      enterPhaseEnd,
      stages: [
        'left full bucket strikes and pushes tappet; worm leaves left wheel',
        'worm turns free across the window; left bucket dumps, right fills',
        'right wheel taken up; right full bucket rises',
        'right full bucket strikes and pushes tappet; worm leaves right wheel',
        'worm turns free across the window; right bucket dumps, left fills',
        'left wheel taken up; left full bucket rises',
      ],
    },
    transmission: {
      activeMesh:
        'Right wheel engaged: theta_worm-N*theta_pulley=phi_R. Left wheel engaged: theta_worm+N*theta_pulley=phi_L (mod 2*pi). The opposite-side worm contacts therefore reverse a common, constant positive worm input.',
      contactVelocity:
        'With axial pitch p=2*pi*R_wheel/N, worm axial thread speed and the selected wheel pitch-line speed are identical during either engaged lift.',
      constantRopeLength:
        'L_left+2*pi*R_pulley+L_inner+L_right is constant; therefore bucket vertical velocities are exactly opposite.',
      pulleyNoSlip:
        'Both equal rear pulleys are constrained by the same rope and use theta=s/R, omega=ds/dt/R and alpha=d2s/dt2/R.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, groundY, -1.65),
    new THREE.Vector3(3.65, 4.55, 1.65),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(3.0, 3.8, 11.8);
  root.userData.groundFloorY = groundY;
  correctWaterLiftParts(root,459);
  // Brown's plate stops at the foot of the well curbs with the lowered
  // rope running down past them, but a bucket cut in half by the frame edge
  // reads as a framing error rather than his crop. The frame is therefore
  // taken down to just below the lowered bucket and the well water it dips
  // into, so both buckets stay whole through the full stroke. The wind
  // wheel sets the top; the troughs set the sides. Set after the shared
  // fit, which would otherwise frame the whole well to the foundation.
  const lowestBucketBottom = lowBailY - bucketCenterOffset - bucketHeight / 2;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.10, lowestBucketBottom - 0.34, -1.65),
    new THREE.Vector3(3.10, 4.45, 1.65),
  );
  root.userData.cameraFov = 12;
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredReciprocatingWellLiftMovement(movement) {
  if (movement.id !== 459) return null;
  return reciprocatingWellLift(movement);
}
