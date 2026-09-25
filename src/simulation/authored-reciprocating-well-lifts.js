import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { waterVolumeGeometry, waterVolumeMaterial } from './water-volume.js';
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
      leftTiltProfile = phase < middle
        ? transitionProfile(phase, 0, middle, 0, -maximumBucketTilt)
        : transitionProfile(phase, middle, exchangeLeftEndPhase,
          -maximumBucketTilt, 0);
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
          0, maximumBucketTilt)
        : transitionProfile(phase, middle, exchangeRightEndPhase,
          maximumBucketTilt, 0);
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
  const gearBeam = new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 0.15, 0.22),
    frameMaterial,
  );
  gearBeam.position.set(0, wheelCenterY, -0.80);
  support.add(gearBeam);
  const tappetStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.45, 0.22),
    frameMaterial,
  );
  tappetStand.position.set(0, 0.10, 0.30);
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
  // The wind-wheel shaft turns with the wheel (one body with its hub) and
  // ends on the coupling block's top face instead of entering it.
  const upperShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.63, 24),
    darkMaterial,
  ), 'fixed-axis-upper-wind-wheel-shaft');
  upperShaft.position.set(0, 3.855 - 4.18, 0);
  windRotor.add(upperShaft);

  const flexibleCoupling = addRole(new THREE.Group(),
    'flexible-coupling-permitting-small-lateral-worm-vibration');
  flexibleCoupling.position.copy(carrierTop);
  root.add(flexibleCoupling);
  const couplingBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.22, 0.30),
    matte(PALETTE.accent, { metalness: 0.22, roughness: 0.48 }),
  );
  flexibleCoupling.add(couplingBlock);
  const couplingPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.48, 18),
    darkMaterial,
  );
  couplingPin.rotation.z = Math.PI / 2;
  flexibleCoupling.add(couplingPin);

  const wormCarrier = addRole(new THREE.Group(),
    'laterally-rocking-lower-shaft-carrying-one-single-start-worm');
  wormCarrier.position.copy(carrierTop);
  root.add(wormCarrier);
  // The shaft runs from just below the coupling block (clear of it and its
  // cross pin through the carrier's small rocking angle) to the worm's top;
  // a short stub below the worm turns in the step's bore.
  const wormTop = -carrierCenterDistance + wormLength / 2;
  const wormBottom = -carrierCenterDistance - wormLength / 2;
  const lowerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, -0.12 - wormTop, 24),
    darkMaterial,
  );
  lowerShaft.position.y = (-0.12 + wormTop) / 2;
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
    const star = addRole(new THREE.Mesh(plate(starOutline, -0.10, 0.10),
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
    const water = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(
        bucketRadius * 0.77,
        bucketRadius * 0.70,
        1,
        30,
      ),
      waterMaterial,
    ), `${side}-bucket-water-payload`);
    bucket.add(water);
    return { body, bucket, water };
  };
  const leftBucket = makeBucket('left');
  const rightBucket = makeBucket('right');

  const makeTrough = (side) => {
    const sign = side === 'left' ? -1 : 1;
    const trough = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.20, 1.05),
      matte(PALETTE.muted, { metalness: 0.12, roughness: 0.64 }),
    ), `${side}-delivery-trough-receiving-the-tipped-high-bucket`);
    trough.position.set(sign * 2.30, -0.22, ropeZ);
    trough.rotation.z = sign * THREE.MathUtils.degToRad(8);
    root.add(trough);
    return trough;
  };
  const leftTrough = makeTrough('left');
  const rightTrough = makeTrough('right');

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
  const tappetPivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.56, 24),
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

  const updateBucketWater = (bucket, fraction, tilt) => {
    const height = 0.52 * fraction;
    bucket.water.visible = height > 1e-5;
    bucket.water.scale.y = Math.max(0.001, height);
    bucket.water.position.y = -bucketHandleRise - bucketHeight
      + 0.07 + height / 2;
    bucket.water.rotation.z = -tilt;
  };

  const wheelPhase = Math.PI / (2 * wheelTeeth);
  const update = (time) => {
    const state = stateAtTime(time);
    windRotor.rotation.y = state.wormAngle;
    wormCarrier.rotation.z = state.carrierAngle;
    setSpin(worm, state.wormAngle);
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
    updateBucketWater(
      leftBucket,
      state.leftWaterFraction,
      state.leftBucketTilt,
    );
    updateBucketWater(
      rightBucket,
      state.rightWaterFraction,
      state.rightBucketTilt,
    );
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
    setRodBetween(selectorLink, tappetCrank, stepFoot);
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
