import * as THREE from 'three';
import {replaceWithLaidRope} from './laid-rope.js';
import {correctWellBucketParts} from './well-bucket-working-parts.js';
import {
  PALETTE,
  makePulley,
  markShadows,
  matte,
  setSpin,
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

function setVerticalExtent(mesh, bottom, top) {
  const height = Math.max(0.001, top - bottom);
  mesh.position.y = (bottom + top) / 2;
  mesh.scale.y = height;
  mesh.visible = top > bottom;
}

function twoBucketWellPulley(movement) {
  const root = new THREE.Group();
  const cycleDuration = 7.5;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const pulleyCenter = new THREE.Vector3(0, 3.02, 0);
  const pulleyRadius = 0.78;
  const maximumRopeDisplacement = 2.90;
  const bucketHandleRise = 0.54;
  const leftHighBailY = 1.32;
  const rightLowBailY = leftHighBailY - maximumRopeDisplacement;
  const bucketHeight = 0.78;
  const bucketRadius = 0.38;
  const outwardEndPhase = 0.40;
  const exchangeDwellEndPhase = 0.50;
  const returnEndPhase = 0.90;
  const emptyBucketWeight = 24;
  const waterPayloadWeight = 76;
  const groundY = -3.04;
  const fixedArcLength = Math.PI * pulleyRadius;
  const initialLeftVerticalLength = pulleyCenter.y - leftHighBailY;
  const initialRightVerticalLength = pulleyCenter.y - rightLowBailY;
  const totalRopeLength = initialLeftVerticalLength
    + fixedArcLength + initialRightVerticalLength;

  const transition = (
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
    const rawPhase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const phase = [0, outwardEndPhase, exchangeDwellEndPhase,
      returnEndPhase].find(
      (boundary) => Math.abs(rawPhase - boundary) < 1e-12,
    ) ?? rawPhase;
    const cycleAngle = FULL_TURN * phase;
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    let ropeProfile;
    let leftWaterProfile;
    let rightWaterProfile;
    let mode;
    if (phase < outwardEndPhase) {
      ropeProfile = transition(
        phase,
        0,
        outwardEndPhase,
        0,
        maximumRopeDisplacement,
      );
      leftWaterProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: 0 };
      rightWaterProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: 1 };
      mode = phase === 0
        ? 'left-empty-high-right-full-low-ready-for-exchange'
        : 'left-empty-pulled-down-raising-right-full-bucket';
    } else if (phase < exchangeDwellEndPhase) {
      ropeProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: maximumRopeDisplacement };
      leftWaterProfile = transition(
        phase,
        outwardEndPhase,
        exchangeDwellEndPhase,
        0,
        1,
      );
      rightWaterProfile = transition(
        phase,
        outwardEndPhase,
        exchangeDwellEndPhase,
        1,
        0,
      );
      mode = 'left-bucket-filling-low-right-bucket-emptying-high';
    } else if (phase < returnEndPhase) {
      ropeProfile = transition(
        phase,
        exchangeDwellEndPhase,
        returnEndPhase,
        maximumRopeDisplacement,
        0,
      );
      leftWaterProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: 1 };
      rightWaterProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: 0 };
      mode = phase === exchangeDwellEndPhase
        ? 'left-full-low-right-empty-high-ready-for-return'
        : 'right-empty-pulled-down-raising-left-full-bucket';
    } else {
      ropeProfile = { firstDerivativeByPhase: 0,
        secondDerivativeByPhase: 0, value: 0 };
      leftWaterProfile = transition(
        phase,
        returnEndPhase,
        1,
        1,
        0,
      );
      rightWaterProfile = transition(
        phase,
        returnEndPhase,
        1,
        0,
        1,
      );
      mode = 'left-bucket-emptying-high-right-bucket-filling-low';
    }
    const ropeDisplacement = ropeProfile.value;
    const ropeSpeed = ropeProfile.firstDerivativeByPhase * phaseSpeed;
    const ropeAcceleration =
      ropeProfile.secondDerivativeByPhase * phaseSpeed ** 2
      + ropeProfile.firstDerivativeByPhase * phaseAcceleration;
    const leftBailY = leftHighBailY - ropeDisplacement;
    const rightBailY = rightLowBailY + ropeDisplacement;
    const leftBucketCenter = new THREE.Vector3(
      -pulleyRadius,
      leftBailY - bucketHandleRise - bucketHeight / 2,
      0,
    );
    const rightBucketCenter = new THREE.Vector3(
      pulleyRadius,
      rightBailY - bucketHandleRise - bucketHeight / 2,
      0,
    );
    const leftVerticalLength = pulleyCenter.y - leftBailY;
    const rightVerticalLength = pulleyCenter.y - rightBailY;
    const pulleyAngle = ropeDisplacement / pulleyRadius;
    const pulleyAngularSpeed = ropeSpeed / pulleyRadius;
    const pulleyAngularAcceleration = ropeAcceleration / pulleyRadius;
    const leftWaterFraction = leftWaterProfile.value;
    const rightWaterFraction = rightWaterProfile.value;
    const leftWaterFractionAcceleration =
      leftWaterProfile.secondDerivativeByPhase * phaseSpeed ** 2
      + leftWaterProfile.firstDerivativeByPhase * phaseAcceleration;
    const rightWaterFractionAcceleration =
      rightWaterProfile.secondDerivativeByPhase * phaseSpeed ** 2
      + rightWaterProfile.firstDerivativeByPhase * phaseAcceleration;
    const leftBucketWeight = emptyBucketWeight
      + waterPayloadWeight * leftWaterFraction;
    const rightBucketWeight = emptyBucketWeight
      + waterPayloadWeight * rightWaterFraction;
    let pulledEmptySide = null;
    if (ropeSpeed > 0) pulledEmptySide = 'left';
    if (ropeSpeed < 0) pulledEmptySide = 'right';
    return {
      fixedArcLength,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      leftBailY,
      leftBucketCenter,
      leftBucketAccelerationY: -ropeAcceleration,
      leftBucketVelocityY: -ropeSpeed,
      leftBucketWeight,
      leftVerticalLength,
      leftWaterFraction,
      leftWaterFractionAcceleration,
      leftWaterFractionRate:
        leftWaterProfile.firstDerivativeByPhase * phaseSpeed,
      mode,
      phase,
      pulleyAngle,
      pulleyAngularAcceleration,
      pulleyAngularSpeed,
      pulledEmptySide,
      rightBailY,
      rightBucketCenter,
      rightBucketAccelerationY: ropeAcceleration,
      rightBucketVelocityY: ropeSpeed,
      rightBucketWeight,
      rightVerticalLength,
      rightWaterFraction,
      rightWaterFractionAcceleration,
      rightWaterFractionRate:
        rightWaterProfile.firstDerivativeByPhase * phaseSpeed,
      ropeAcceleration,
      ropeDisplacement,
      ropeSpeed,
      totalRopeLength:
        leftVerticalLength + fixedArcLength + rightVerticalLength,
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
    metalness: 0.18,
    roughness: 0.52,
  });
  const ropeMaterial = matte(PALETTE.belt, {
    roughness: 0.62,
  });
  const bucketMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.74,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const wellMaterial = matte(PALETTE.muted, {
    opacity: 0.28,
    roughness: 0.74,
    side: THREE.DoubleSide,
    transparent: true,
  });
  wellMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 0.14, 3.0),
    frameMaterial,
  ), 'fixed-common-well-pulley-foundation');
  base.position.set(0, groundY + 0.07, 0);
  root.add(base);

  const shaftWell = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.40, 3.12, 2.0),
    wellMaterial,
  ), 'transparent-well-shaft-containing-two-opposed-buckets');
  shaftWell.position.set(0, -1.46, 0);
  root.add(shaftWell);
  const wellWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.12, 0.18, 1.72),
    waterMaterial,
  ), 'well-water-at-bottom-of-two-bucket-shaft');
  wellWater.position.set(0, -2.76, 0);
  root.add(wellWater);
  for (const x of [-1.86, 1.86]) {
    const bank = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 2.45, 2.28),
      frameMaterial,
    );
    bank.position.set(x, -1.74, 0);
    root.add(bank);
  }

  const frame = addRole(new THREE.Group(),
    'fixed-roof-frame-supporting-single-common-pulley');
  root.add(frame);
  for (const x of [-2.35, 2.35]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 3.38, 0.30),
      frameMaterial,
    );
    post.position.set(x, 1.30, -0.55);
    frame.add(post);
  }
  const leftRafter = new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 0.18, 0.34),
    frameMaterial,
  );
  leftRafter.position.set(-1.38, 3.64, -0.55);
  leftRafter.rotation.z = THREE.MathUtils.degToRad(22);
  frame.add(leftRafter);
  const rightRafter = leftRafter.clone();
  rightRafter.position.x = 1.38;
  rightRafter.rotation.z = THREE.MathUtils.degToRad(-22);
  frame.add(rightRafter);
  const pulleyHanger = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.88, 0.30),
    frameMaterial,
  );
  pulleyHanger.position.set(0, 3.48, -0.25);
  frame.add(pulleyHanger);

  const pulley = addRole(makePulley({
    color: PALETTE.driver,
    grooves: 1,
    radius: pulleyRadius,
    spokes: 6,
    width: 0.42,
  }), 'one-fixed-axis-common-sheave-with-no-slip-rope-contact');
  pulley.position.copy(pulleyCenter);
  root.add(pulley);
  const fixedAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.92, 28),
    darkMaterial,
  ), 'fixed-common-pulley-axle');
  fixedAxle.rotation.x = Math.PI / 2;
  fixedAxle.position.copy(pulleyCenter);
  root.add(fixedAxle);

  const continuousRope = addRole(new THREE.Group(),
    'one-continuous-open-rope-with-two-bucket-ends');
  root.add(continuousRope);
  const arcPoints = Array.from({ length: 65 }, (_, index) => {
    const angle = Math.PI - Math.PI * index / 64;
    return new THREE.Vector3(
      pulleyCenter.x + pulleyRadius * Math.cos(angle),
      pulleyCenter.y + pulleyRadius * Math.sin(angle),
      0,
    );
  });
  const arcCurve = new THREE.CatmullRomCurve3(
    arcPoints,
    false,
    'centripetal',
  );
  const upperArc = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(arcCurve, 128, 0.045, 14, false),
    ropeMaterial,
  ), 'single-rope-upper-half-wrapped-over-sheave');
  continuousRope.add(upperArc);
  const leftRopeLeg = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 16),
    ropeMaterial,
  ), 'single-rope-left-vertical-leg');
  continuousRope.add(leftRopeLeg);
  const rightRopeLeg = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 16),
    ropeMaterial,
  ), 'single-rope-right-vertical-leg');
  continuousRope.add(rightRopeLeg);
  // Brown draws one laid rope: render it as the shared three-strand rope from
  // the left bail over the sheave to the right bail. The leg and arc pieces
  // stay as hidden references for the contact checks.
  const laidRope = addRole(new THREE.Mesh(new THREE.BufferGeometry(), ropeMaterial),
    'single-laid-rope-over-sheave-between-both-bails');
  continuousRope.add(laidRope);
  for (const piece of [upperArc, leftRopeLeg, rightRopeLeg]) piece.visible = false;
  const layRope = (leftY, rightY) => {
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(new THREE.Vector3(-pulleyRadius, leftY, 0), arcPoints[0].clone()));
    path.add(arcCurve);
    path.add(new THREE.LineCurve3(arcPoints.at(-1).clone(), new THREE.Vector3(pulleyRadius, rightY, 0)));
    replaceWithLaidRope(laidRope, path, {radius: 0.045, tubularSegments: 256});
  };

  const makeBucket = (side) => {
    const bucket = addRole(new THREE.Group(),
      `${side}-well-bucket-at-one-end-of-common-rope`);
    root.add(bucket);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        bucketRadius,
        bucketRadius * 0.76,
        bucketHeight,
        36,
        1,
        true,
      ),
      bucketMaterial,
    );
    bucket.add(body);
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(
        bucketRadius * 0.76,
        bucketRadius * 0.76,
        0.08,
        34,
      ),
      darkMaterial,
    );
    bottom.position.y = -bucketHeight / 2;
    bucket.add(bottom);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(bucketRadius, 0.05, 10, 40),
      darkMaterial,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = bucketHeight / 2;
    bucket.add(rim);
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.32, bucketHeight / 2, 0),
      new THREE.Vector3(-0.22, bucketHeight / 2 + 0.40, 0),
      new THREE.Vector3(0, bucketHeight / 2 + bucketHandleRise, 0),
      new THREE.Vector3(0.22, bucketHeight / 2 + 0.40, 0),
      new THREE.Vector3(0.32, bucketHeight / 2, 0),
    ], false, 'centripetal');
    const handle = new THREE.Mesh(
      new THREE.TubeGeometry(handleCurve, 40, 0.035, 10, false),
      darkMaterial,
    );
    bucket.add(handle);
    const water = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(
        bucketRadius * 0.77,
        bucketRadius * 0.70,
        1,
        32,
      ),
      waterMaterial,
    ), `${side}-bucket-water-payload`);
    bucket.add(water);
    return { bucket, water };
  };
  const leftBucket = makeBucket('left');
  const rightBucket = makeBucket('right');

  const updateBucketWater = (bucket, fraction) => {
    const height = 0.58 * fraction;
    bucket.water.visible = height > 1e-5;
    bucket.water.scale.y = Math.max(0.001, height);
    bucket.water.position.y = -bucketHeight / 2 + 0.08 + height / 2;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(pulley, state.pulleyAngle);
    setVerticalExtent(leftRopeLeg, state.leftBailY, pulleyCenter.y);
    leftRopeLeg.position.x = -pulleyRadius;
    setVerticalExtent(rightRopeLeg, state.rightBailY, pulleyCenter.y);
    rightRopeLeg.position.x = pulleyRadius;
    layRope(state.leftBailY, state.rightBailY);
    leftBucket.bucket.position.copy(state.leftBucketCenter);
    rightBucket.bucket.position.copy(state.rightBucketCenter);
    updateBucketWater(leftBucket, state.leftWaterFraction);
    updateBucketWater(rightBucket, state.rightWaterFraction);
    root.userData.updateWorkingParts?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const sourceCanvasBucketStroke = 14.252667 - 1.843376;
  const sourceCanvasPulleyRadius = 1.075;
  const sourceCanvasCommandedTurns = 2;
  const sourceCanvasNoSlipTurns = sourceCanvasBucketStroke
    / (FULL_TURN * sourceCanvasPulleyRadius);
  const geometry = {
    bucketHeight,
    bucketHandleRise,
    bucketRadius,
    cycleDuration,
    emptyBucketWeight,
    exchangeDwellEndPhase,
    fixedArcLength,
    groundY,
    inputAngularSpeed,
    leftHighBailY,
    maximumRopeDisplacement,
    outwardEndPhase,
    pulleyCenter,
    pulleyRadius,
    returnEndPhase,
    rightLowBailY,
    totalRopeLength,
    waterPayloadWeight,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      sourceNormalizedKeyframes: [0, 0.4, 0.5, 0.9, 1],
      targetCycleDuration: 2,
    },
    archetype:
      'single-fixed-sheave-one-continuous-rope-two-opposed-well-buckets-with-exact-no-slip-spin',
    blocks: {
      base,
      continuousRope,
      fixedAxle,
      frame,
      leftBucket,
      leftRopeLeg,
      pulley,
      rightBucket,
      rightRopeLeg,
      shaftWell,
      upperArc,
      wellWater,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      leftBucketIndependent: false,
      operatingDegreesOfFreedom: 1,
      pulleySpinIndependent: false,
      rightBucketIndependent: false,
    },
    dynamics: {
      fullBucketInertiaRopeElasticitySlipBearingFrictionWaterSloshAndOperatorBiomechanicsModeled:
        false,
      loadModel:
        'Exactly one bucket is full during each exchange. The empty side is prescribed downward to raise the heavier full side, matching Brown’s caption; required operator force is not dynamically solved.',
      noSlipModel:
        'Pulley angle, speed and acceleration are exactly rope displacement, speed and acceleration divided by sheave radius. No independent pulley rate and no decorative moving rope markers are used.',
      smoothingDisclosure:
        'The official 0/.4/.5/.9 normalized keyframes and opposing endpoints are retained. Quintic C2 interpolation replaces the source canvas model’s piecewise constant-speed starts and stops to remove visible jerk.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One open rope has a bucket at each end, two vertical legs, and one upper semicircle in contact with a single fixed-axis sheave. Pulling the empty high bucket down shortens the opposite leg by the same amount and raises the full low bucket; after filling and emptying at the dwell, the roles reverse. Constant total rope length enforces exactly opposite bucket travel, and no-slip contact alone determines sheave rotation.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'source-timed-opposed-two-bucket-exchange-on-one-constant-length-rope-and-one-sheave',
    },
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      runtimeModelFlagPresent: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: true,
      staticMarkupInitiallyLabelsAnimatedControlUnavailable: true,
    },
    sourcePose: {
      leftBailY: sourceState.leftBailY,
      leftWaterFraction: sourceState.leftWaterFraction,
      mode: sourceState.mode,
      pulleyAngle: sourceState.pulleyAngle,
      rightBailY: sourceState.rightBailY,
      rightWaterFraction: sourceState.rightWaterFraction,
    },
    sourceReference: {
      brownPlate458: {
        approximateLeftBucketCenterPixels: [233, 299],
        approximatePulleyCenterPixels: [273, 126],
        approximatePulleyRadiusPixels: 44,
        approximateRightBucketCenterPixels: [306, 425],
        approximateWellOpeningBoundsPixels: [169, 478, 370, 304],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 17,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one common pulley raises water with two buckets',
          'the empty bucket is pulled down',
          'pulling the empty bucket down raises the full bucket',
        ],
        engravingEvidence:
          'Brown shows one roof-supported spoked sheave, one rope over its upper half with exactly two vertical legs, and one bucket on each end at opposite elevations inside a well.',
        reconstructionDisclosure:
          'Brown gives no sheave diameter, rope length, bucket capacity, well depth, force, friction or absolute timing. The official canvas supplies opposing endpoint coordinates and 0/.4/.5/.9 normalized keyframes but commands an approximate pulley turn count. Model dimensions, water-state display, C2 interpolation, colors and 7.5-second cycle are independently engineered; the single-rope topology, opposite travel, bucket roles and normalized dwell timing are source-grounded.',
      },
      officialCanvasModel: {
        bucketKeyframeFractions: [0, 0.4, 0.5, 0.9],
        commandedPulleyTurnsPerExchange: sourceCanvasCommandedTurns,
        leftHighY: -1.843376,
        leftLowY: -14.252667,
        noSlipTurnsForCanvasDimensions: sourceCanvasNoSlipTurns,
        pulleyRadius: sourceCanvasPulleyRadius,
        stroke: sourceCanvasBucketStroke,
        turnCommandToNoSlipRatio:
          sourceCanvasCommandedTurns / sourceCanvasNoSlipTurns,
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 458',
    },
    stateAtInputAngle,
    stateAtTime,
    timeline: {
      exchangeDwellEndPhase,
      outwardEndPhase,
      returnEndPhase,
      stages: [
        'left empty down / right full up',
        'left fills / right empties',
        'right empty down / left full up',
        'right fills / left empties',
      ],
    },
    transmission: {
      constantLength:
        'L_left_vertical+pi*R+L_right_vertical=L_rope exactly.',
      noSlip:
        'theta_pulley=s/R, omega_pulley=ds/dt/R, alpha_pulley=d2s/dt2/R.',
      oppositeTravel:
        'y_left=y_left,high-s and y_right=y_right,low+s, so v_left=-v_right.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.45, groundY, -1.55),
    new THREE.Vector3(3.45, 4.18, 1.55),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.0, 4.7, 10.8);
  root.userData.groundFloorY = groundY;
  correctWellBucketParts(root,458);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredTwoBucketWellPulleyMovement(movement) {
  if (movement.id !== 458) return null;
  return twoBucketWellPulley(movement);
}
