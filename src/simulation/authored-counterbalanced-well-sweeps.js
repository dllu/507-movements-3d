import * as THREE from 'three';
import {correctWellBucketParts} from './well-bucket-working-parts.js';
import {LaidRopeGeometry} from './laid-rope.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

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

function counterbalancedWellSweep(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8.0;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const beamPivot = new THREE.Vector3(1.38, 2.00, 0);
  const longArmLength = 4.40;
  const shortArmLength = 1.45;
  const counterweightMomentArm = 1.08;
  const highBeamAngle = THREE.MathUtils.degToRad(-42);
  const lowBeamAngle = THREE.MathUtils.degToRad(10);
  const ropeLength = 3.00;
  const bucketHeight = 0.78;
  const bucketHandleRise = .40;
  const emptyBucketWeight = 25;
  const fullBucketWeight = 100;
  const counterbalanceEquivalentWeight = fullBucketWeight / 2;
  const counterweightActualWeight = counterbalanceEquivalentWeight
    * longArmLength / counterweightMomentArm;
  const descentEndPhase = 0.35;
  const fillEndPhase = 0.50;
  const ascentEndPhase = 0.85;
  const wellCenterX = -2.43;
  const wellRimY = .50;
  const wellBottomY = -3.02;
  const gravity = 9.81;
  const groundY = -3.10;

  const easedTransition = (
    phase,
    startPhase,
    endPhase,
    startValue,
    endValue,
  ) => {
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
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    let beamProfile;
    let waterProfile;
    let mode;
    if (phase < descentEndPhase) {
      beamProfile = easedTransition(
        phase,
        0,
        descentEndPhase,
        highBeamAngle,
        lowBeamAngle,
      );
      waterProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: 0 };
      mode = phase === 0
        ? 'top-empty-bucket-ready-to-be-pulled-down'
        : 'operator-pulling-empty-bucket-down-against-counterbalance';
    } else if (phase < fillEndPhase) {
      beamProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: lowBeamAngle };
      waterProfile = easedTransition(
        phase,
        descentEndPhase,
        fillEndPhase,
        0,
        1,
      );
      mode = 'bucket-held-at-bottom-while-filling';
    } else if (phase < ascentEndPhase) {
      beamProfile = easedTransition(
        phase,
        fillEndPhase,
        ascentEndPhase,
        lowBeamAngle,
        highBeamAngle,
      );
      waterProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: 1 };
      mode = phase === fillEndPhase
        ? 'bottom-full-bucket-ready-to-rise'
        : 'operator-raising-full-bucket-with-counterbalance-assistance';
    } else {
      beamProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: highBeamAngle };
      waterProfile = easedTransition(
        phase,
        ascentEndPhase,
        1,
        1,
        0,
      );
      mode = 'bucket-held-at-top-while-emptying';
    }
    const beamAngle = beamProfile.value;
    const beamAngularSpeed = beamProfile.firstDerivativeByPhase
      * phaseSpeed;
    const beamAngularAcceleration =
      beamProfile.secondDerivativeByPhase * phaseSpeed ** 2
      + beamProfile.firstDerivativeByPhase * phaseAcceleration;
    const bucketWaterFraction = waterProfile.value;
    const bucketWaterFractionRate = waterProfile.firstDerivativeByPhase
      * phaseSpeed;
    const leftTip = new THREE.Vector3(
      beamPivot.x - longArmLength * Math.cos(beamAngle),
      beamPivot.y - longArmLength * Math.sin(beamAngle),
      0,
    );
    const leftTipVelocity = new THREE.Vector3(
      longArmLength * Math.sin(beamAngle) * beamAngularSpeed,
      -longArmLength * Math.cos(beamAngle) * beamAngularSpeed,
      0,
    );
    const leftTipAcceleration = new THREE.Vector3(
      longArmLength * (
        Math.cos(beamAngle) * beamAngularSpeed ** 2
          + Math.sin(beamAngle) * beamAngularAcceleration
      ),
      longArmLength * (
        Math.sin(beamAngle) * beamAngularSpeed ** 2
          - Math.cos(beamAngle) * beamAngularAcceleration
      ),
      0,
    );
    const ropeBottom = leftTip.clone();
    ropeBottom.y -= ropeLength;
    const bucketCenter = ropeBottom.clone();
    bucketCenter.y -= bucketHeight / 2 + bucketHandleRise;
    const counterweightCenter = new THREE.Vector3(
      beamPivot.x + counterweightMomentArm * Math.cos(beamAngle),
      beamPivot.y + counterweightMomentArm * Math.sin(beamAngle),
      0,
    );
    const bucketWeight = emptyBucketWeight
      + (fullBucketWeight - emptyBucketWeight) * bucketWaterFraction;
    const gravityLeverFactor = Math.cos(beamAngle);
    const bucketGravityTorque = bucketWeight * gravity
      * longArmLength * gravityLeverFactor;
    const counterweightGravityTorque = -counterweightActualWeight
      * gravity * counterweightMomentArm * gravityLeverFactor;
    const netGravityTorque = bucketGravityTorque
      + counterweightGravityTorque;
    const quasistaticOperatorTorque = -netGravityTorque;
    let operatorAction = 'hold';
    if (beamAngularSpeed > 0) operatorAction = 'pull-empty-bucket-down';
    if (beamAngularSpeed < 0) operatorAction = 'raise-full-bucket';
    return {
      beamAngle,
      beamAngularAcceleration,
      beamAngularSpeed,
      bucketCenter,
      bucketGravityTorque,
      bucketWaterFraction,
      bucketWaterFractionRate,
      bucketWeight,
      counterbalanceEquivalentWeight,
      counterweightActualWeight,
      counterweightCenter,
      counterweightGravityTorque,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      leftTip,
      leftTipAcceleration,
      leftTipVelocity,
      mode,
      netGravityTorque,
      operatorAction,
      phase,
      quasistaticOperatorTorque,
      ropeBottom,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.14,
    roughness: 0.54,
  });
  const beamMaterial = matte(PALETTE.driver, {
    metalness: 0.08,
    roughness: 0.68,
  });
  const bucketMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.72,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const wellMaterial = matte(PALETTE.muted, {
    opacity: 0.35,
    roughness: 0.75,
    side: THREE.DoubleSide,
    transparent: true,
  });
  wellMaterial.depthWrite = false;
  const ropeMaterial = matte(PALETTE.ink, { roughness: 0.72 });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 0.14, 3.1),
    frameMaterial,
  ), 'fixed-ground-support-for-counterbalanced-well-sweep');
  base.position.set(-0.25, groundY + 0.07, 0);
  root.add(base);

  const wellHeight = wellRimY - wellBottomY;
  const well = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, wellHeight, 56, 1, true),
    wellMaterial,
  ), 'shallow-well-below-sweep-bucket');
  well.position.set(
    wellCenterX,
    (wellRimY + wellBottomY) / 2,
    0,
  );
  root.add(well);
  const wellRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(1.08, 0.13, 14, 64),
    frameMaterial,
  ), 'fixed-well-mouth');
  wellRim.rotation.x = Math.PI / 2;
  wellRim.position.set(wellCenterX, wellRimY, 0);
  root.add(wellRim);
  const wellWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.96, 0.96, 0.16, 48),
    waterMaterial,
  ), 'water-source-at-bottom-of-shallow-well');
  wellWater.position.set(wellCenterX, wellBottomY + 0.27, 0);
  root.add(wellWater);

  const support = addRole(new THREE.Group(),
    'fixed-forked-post-supporting-sweep-pivot');
  root.add(support);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.48, 4.65, 14),
    frameMaterial,
  );
  trunk.position.set(beamPivot.x, -0.27, -0.42);
  support.add(trunk);
  for (const side of [-1, 1]) {
    const fork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.20, 1.28, 12),
      frameMaterial,
    );
    fork.position.set(
      beamPivot.x + side * 0.24,
      beamPivot.y - 0.30,
      -0.12,
    );
    fork.rotation.z = side * THREE.MathUtils.degToRad(16);
    support.add(fork);
  }
  const pivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.90, 28),
    darkMaterial,
  ), 'fixed-horizontal-sweep-fulcrum');
  pivotAxle.rotation.x = Math.PI / 2;
  pivotAxle.position.copy(beamPivot);
  root.add(pivotAxle);

  const beam = addRole(new THREE.Group(),
    'unequal-arm-well-sweep-rocking-about-fixed-fulcrum');
  beam.position.copy(beamPivot);
  root.add(beam);
  const beamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-longArmLength, 0, 0),
    new THREE.Vector3(-3.05, 0.08, 0),
    new THREE.Vector3(-1.45, -0.04, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(shortArmLength, -0.08, 0),
  ], false, 'centripetal');
  const beamBody = new THREE.Mesh(
    new THREE.TubeGeometry(beamCurve, 96, 0.15, 18, false),
    beamMaterial,
  );
  beam.add(beamBody);
  const leftRopePin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.58, 24),
    darkMaterial,
  );
  leftRopePin.rotation.x = Math.PI / 2;
  leftRopePin.position.x = -longArmLength;
  beam.add(leftRopePin);

  const counterweight = addRole(new THREE.Group(),
    'rigid-short-arm-counterweight-equivalent-to-half-full-load');
  counterweight.position.set(counterweightMomentArm, -0.02, 0);
  beam.add(counterweight);
  const weightCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.68, 0.76),
    darkMaterial,
  );
  weightCore.rotation.z = THREE.MathUtils.degToRad(-12);
  counterweight.add(weightCore);
  for (const offset of [-0.24, 0.24]) {
    const binding = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.045, 10, 36),
      bucketMaterial,
    );
    binding.rotation.y = Math.PI / 2;
    binding.position.z = offset;
    counterweight.add(binding);
  }

  // Brown draws the well rope twisted: the shared three-strand laid rope,
  // built once at its constant length and hung from the long-arm tip. The
  // rope material does not run along its length, so the lay stays fixed.
  // It is tied under the round tip eye (radius .18 about the rope pin), so
  // the laid rope starts at the eye's lowest point instead of inside it.
  const rope = addRole(new THREE.Mesh(
    new LaidRopeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(0, -0.18, 0),
      new THREE.Vector3(0, -ropeLength, 0),
    ), 96, 0.045, 8, false),
    ropeMaterial,
  ), 'constant-length-rope-hanging-vertically-from-long-arm-tip');
  root.add(rope);

  const bucket = addRole(new THREE.Group(),
    'upright-well-bucket-on-rope');
  root.add(bucket);
  const bucketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.30, bucketHeight, 36, 1, true),
    bucketMaterial,
  );
  bucket.add(bucketBody);
  const bucketBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 0.08, 36),
    darkMaterial,
  );
  bucketBottom.position.y = -bucketHeight / 2;
  bucket.add(bucketBottom);
  const bucketRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.055, 10, 40),
    darkMaterial,
  );
  bucketRim.rotation.x = Math.PI / 2;
  bucketRim.position.y = bucketHeight / 2;
  bucket.add(bucketRim);
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, bucketHeight / 2, 0),
    new THREE.Vector3(-0.24, bucketHeight / 2 + 0.42, 0),
    new THREE.Vector3(0, bucketHeight / 2 + 0.56, 0),
    new THREE.Vector3(0.24, bucketHeight / 2 + 0.42, 0),
    new THREE.Vector3(0.34, bucketHeight / 2, 0),
  ], false, 'centripetal');
  const handle = new THREE.Mesh(
    new THREE.TubeGeometry(handleCurve, 42, 0.035, 10, false),
    darkMaterial,
  );
  bucket.add(handle);
  const bucketWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.27, 1, 32),
    waterMaterial,
  ), 'water-volume-changing-only-at-bottom-and-top-dwells');
  bucket.add(bucketWater);

  const operatorArrow = addRole(new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(),
    0.76,
    PALETTE.white,
    0.24,
    0.15,
  ), 'operator-effort-direction-pull-down-empty-or-lift-up-full');
  root.add(operatorArrow);

  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beamAngle;
    rope.position.copy(state.leftTip);
    bucket.position.copy(state.bucketCenter);
    const waterHeight = 0.60 * state.bucketWaterFraction;
    bucketWater.visible = waterHeight > 1e-5;
    bucketWater.scale.y = Math.max(0.001, waterHeight);
    bucketWater.position.y = -bucketHeight / 2 + 0.08
      + waterHeight / 2;
    operatorArrow.position.set(
      state.bucketCenter.x + 0.62,
      state.bucketCenter.y,
      0.48,
    );
    operatorArrow.visible = state.operatorAction !== 'hold';
    if (state.operatorAction === 'pull-empty-bucket-down') {
      operatorArrow.setDirection(new THREE.Vector3(0, -1, 0));
    } else if (state.operatorAction === 'raise-full-bucket') {
      operatorArrow.setDirection(new THREE.Vector3(0, 1, 0));
    }
    root.userData.updateWorkingParts?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    ascentEndPhase,
    beamPivot,
    bucketHeight,
    bucketHandleRise,
    counterbalanceEquivalentWeight,
    counterweightActualWeight,
    counterweightMomentArm,
    cycleDuration,
    descentEndPhase,
    emptyBucketWeight,
    fillEndPhase,
    fullBucketWeight,
    gravity,
    groundY,
    highBeamAngle,
    inputAngularSpeed,
    longArmLength,
    lowBeamAngle,
    ropeLength,
    shortArmLength,
    wellBottomY,
    wellCenterX,
    wellRimY,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'counterbalanced-shallow-well-sweep-with-long-arm-bucket-rope-and-half-load-short-arm-weight',
    blocks: {
      base,
      beam,
      bucket,
      bucketWater,
      counterweight,
      operatorArrow,
      pivotAxle,
      rope,
      support,
      well,
      wellRim,
      wellWater,
    },
    degreesOfFreedom: {
      bucketIndependent: false,
      counterweightIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      ropeLengthIndependent: false,
    },
    dynamics: {
      fullInertiaRopeElasticityWaterSloshDragPivotFrictionImpactAndOperatorBiomechanicsModeled:
        false,
      loadModel:
        'The full raised weight is normalized to 100 and the empty bucket to 25. Counterweight mass is chosen so its short-arm gravitational moment equals a 50-unit weight at the bucket arm: exactly one-half the full raised load stated by Brown.',
      motionModel:
        'A C2 demonstration prescribes empty descent, bottom filling, full ascent and top emptying. The torque fields are quasistatic diagnostics of the captioned assistance, not a free dynamic simulation.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'An unequal-arm sweep rocks on the forked post. A constant-length rope hangs vertically from the long left tip and keeps the bucket upright; a rigid weight is lashed to the short right arm. Its gravitational moment is equivalent to half the full bucket load at the long arm. Consequently the counterweight overbalances the empty bucket, which must be pulled downward, while it cancels half the full-load moment and assists the operator during the lift.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'C2-empty-descent-fill-dwell-full-ascent-empty-dwell-of-counterbalanced-well-sweep',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 457 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      beamAngle: sourceState.beamAngle,
      bucketCenter: sourceState.bucketCenter.clone(),
      bucketWaterFraction: sourceState.bucketWaterFraction,
      counterweightCenter: sourceState.counterweightCenter.clone(),
      mode: sourceState.mode,
    },
    sourceReference: {
      brownPlate457: {
        approximateBeamLeftTipPixels: [119, 70],
        approximateBucketCenterPixels: [120, 360],
        approximateCounterweightCenterPixels: [473, 353],
        approximatePivotPixels: [400, 329],
        approximateWellCenterPixels: [117, 447],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 19,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the arrangement raises water from wells of inconsiderable depth',
          'the counterbalance equals about one-half the weight to be raised',
          'the empty bucket must be pulled down',
          'the full bucket is assisted upward by the counterbalance',
        ],
        engravingEvidence:
          'Brown shows a very long timber sweep pivoted in a forked tree or post near its right end, a vertical rope and bucket at the elevated left tip above a shallow well mouth, and a bulky lashed counterweight on the short descending right arm.',
        reconstructionDisclosure:
          'Brown gives no arm lengths, pivot height, rope length, bucket capacity, empty-bucket fraction, counterweight arm, motion path, fill timing, friction or absolute timing. Those values, the four-stage C2 demonstration, normalized torque calculation, transparent well, colors and 8-second cycle are independently engineered. The unequal lever, vertical rope, shallow well, short-arm counterweight and half-full-load assistance are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 457',
    },
    stateAtInputAngle,
    stateAtTime,
    timeline: {
      ascentEndPhase,
      descentEndPhase,
      fillEndPhase,
      stages: [
        'empty bucket pulled downward',
        'bucket fills at well bottom',
        'full bucket raised with counterweight assistance',
        'bucket empties at top',
      ],
    },
    transmission: {
      counterbalanceLaw:
        'W_counter*r_short=0.5*W_full*r_long exactly.',
      effortSigns:
        'Empty: W_empty<0.5 W_full, so gravity torque raises the bucket and the operator pulls down. Full: W_full>0.5 W_full, so the operator lifts against only the remaining half-load moment.',
      ropeConstraint:
        'The rope remains vertical with constant length and the bucket center is a fixed bail-plus-half-height below its lower endpoint.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.05, groundY, -1.55),
    new THREE.Vector3(3.35, 4.25, 1.55),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.4, 4.9, 10.8);
  root.userData.groundFloorY = groundY;
  correctWellBucketParts(root,457);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCounterbalancedWellSweepMovement(movement) {
  if (movement.id !== 457) return null;
  return counterbalancedWellSweep(movement);
}
