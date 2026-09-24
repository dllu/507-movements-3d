import * as THREE from 'three';
import { boreBoxAtLocalPoint, boreZCylinder, addZJournal, finishSpringFamily, bellLipSphereGap } from './spring-pivot-family-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function updateCylinderBetween(cylinder, start, end) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    delta.clone().multiplyScalar(1 / length),
  );
  cylinder.scale.set(1, length, 1);
}

function makeSegmentedLeafSpring(segmentCount, radius, material) {
  const spring = new THREE.Group();
  spring.userData.role =
    'preloaded-under-lever-return-leaf-spring';
  spring.userData.segmentCount = segmentCount;
  const segments = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const segment = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1, 10),
      material,
    );
    segment.userData.role = 'flexing-segment-of-return-leaf-spring';
    spring.add(segment);
    segments.push(segment);
  }
  spring.userData.setCurve = (start, controlA, controlB, end) => {
    const curve = new THREE.CubicBezierCurve3(
      start,
      controlA,
      controlB,
      end,
    );
    for (let index = 0; index < segmentCount; index += 1) {
      updateCylinderBetween(
        segments[index],
        curve.getPoint(index / segmentCount),
        curve.getPoint((index + 1) / segmentCount),
      );
    }
  };
  return spring;
}

function compactStrikePulse(unitTime) {
  if (unitTime <= 0 || unitTime >= 1) {
    return {
      acceleration: 0,
      position: 0,
      velocity: 0,
    };
  }
  const u = unitTime;
  const oneMinus = 1 - u;
  return {
    acceleration: 384 * u * (
      1 - 6 * u + 10 * u ** 2 - 5 * u ** 3
    ),
    position: 64 * u ** 3 * oneMinus ** 3,
    velocity: 192 * u ** 2 * oneMinus ** 2 * (1 - 2 * u),
  };
}

function bellRingAngle(
  cycleTime,
  strikeTime,
  ringDuration,
  amplitude,
  angularFrequency,
  decayRate,
) {
  const elapsed = cycleTime - strikeTime;
  if (elapsed <= 0 || elapsed >= ringDuration) return 0;
  const normalized = elapsed / ringDuration;
  const smoothCutoff = 1 - (
    10 * normalized ** 3
      - 15 * normalized ** 4
      + 6 * normalized ** 5
  );
  return amplitude
    * Math.exp(-decayRate * elapsed)
    * smoothCutoff
    * Math.sin(angularFrequency * elapsed);
}

function springReturnBellHammer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const strikeWindowStart = 0.55;
  const strikeWindowDuration = 1.10;
  const strikeTime = strikeWindowStart + strikeWindowDuration / 2;
  const restAngle = THREE.MathUtils.degToRad(38);
  const strikeAngle = THREE.MathUtils.degToRad(18);
  const angularStroke = restAngle - strikeAngle;
  const pivot = new THREE.Vector3(-1.30, -0.48, 0.48);
  const hammerArmLength = 2.28;
  const hammerTailLength = 1.42;
  const strikerRadius = 0.23;
  const springContactRadius = 1.18;
  const springBase = new THREE.Vector3(-0.94, -1.54, 0.56);
  const springPreload = 0.08;
  const springStiffness = 4.6;
  const bellLipRadius = 0.92;
  const bellHeight = 1.90;
  const strikeHeadCenter = new THREE.Vector3(
    pivot.x + hammerArmLength * Math.cos(strikeAngle),
    pivot.y + hammerArmLength * Math.sin(strikeAngle),
    pivot.z,
  );
  const bellBaseY = strikeHeadCenter.y - 0.02;
  const bellCenterX = strikeHeadCenter.x + bellLipRadius
    + Math.sqrt((strikerRadius + 0.075) ** 2 - 0.02 ** 2);
  const bellTopY = bellBaseY + bellHeight;
  const bellContactX = bellCenterX - bellLipRadius;
  const ringDuration = 2.05;
  const bellVibrationAmplitude = THREE.MathUtils.degToRad(1.25);
  const bellAngularFrequency = FULL_TURN * 6.4;
  const bellDecayRate = 2.2;
  const springRestContactY = pivot.y
    + springContactRadius * Math.sin(restAngle) - 0.1752 * Math.cos(restAngle);

  const stateAtCycleTime = (unwrappedTime) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(
      unwrappedTime,
      cycleDuration,
    );
    const unitStrikeTime = (
      cycleTime - strikeWindowStart
    ) / strikeWindowDuration;
    const pulse = compactStrikePulse(unitStrikeTime);
    const hammerAngle = restAngle - angularStroke * pulse.position;
    const hammerAngularSpeed = -angularStroke
      * pulse.velocity / strikeWindowDuration;
    const hammerAngularAcceleration = -angularStroke
      * pulse.acceleration / strikeWindowDuration ** 2;
    const radial = new THREE.Vector3(
      Math.cos(hammerAngle),
      Math.sin(hammerAngle),
      0,
    );
    const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
    const hammerHeadCenter = pivot.clone().addScaledVector(
      radial,
      hammerArmLength,
    );
    const hammerHeadVelocity = tangent.clone().multiplyScalar(
      hammerArmLength * hammerAngularSpeed,
    );
    const hammerHeadAcceleration = tangent.clone().multiplyScalar(
      hammerArmLength * hammerAngularAcceleration,
    ).addScaledVector(
      radial,
      -hammerArmLength * hammerAngularSpeed ** 2,
    );
    const tailEnd = pivot.clone().addScaledVector(
      radial,
      -hammerTailLength,
    );
    const springContact = pivot.clone().addScaledVector(
      radial,
      springContactRadius,
    );
    springContact.addScaledVector(tangent, -0.1752);
    const springDeflection = springRestContactY - springContact.y;
    const springCompression = springPreload + springDeflection;
    const returnSpringForce = springStiffness * springCompression;
    const returnSpringTorque = returnSpringForce
      * (springContact.x - pivot.x);
    const bellAngle = bellRingAngle(
      cycleTime,
      strikeTime,
      ringDuration,
      bellVibrationAmplitude,
      bellAngularFrequency,
      bellDecayRate,
    );
    const contactClearance = bellLipSphereGap(hammerHeadCenter,
      new THREE.Vector3(bellCenterX, bellTopY, pivot.z), bellAngle,
      bellHeight, bellLipRadius, 0.075, strikerRadius);
    const isImpact = Math.abs(cycleTime - strikeTime) <= 1e-12;
    return {
      bellAngle,
      contactClearance,
      cycleTime,
      hammerAngle,
      hammerAngularAcceleration,
      hammerAngularSpeed,
      hammerClearOfBell: contactClearance > 1e-9,
      hammerHeadAcceleration,
      hammerHeadCenter,
      hammerHeadVelocity,
      isImpact,
      phase: cycleTime / cycleDuration,
      pulseAcceleration: pulse.acceleration,
      pulsePosition: pulse.position,
      pulseVelocity: pulse.velocity,
      returnSpringForce,
      returnSpringTorque,
      springCompression,
      springContact,
      springDeflection,
      springElasticEnergy: 0.5 * springStiffness * springCompression ** 2,
      tailEnd,
    };
  };

  const stateAtTime = (time) => stateAtCycleTime(time);
  const geometry = {
    angularStroke,
    bellAngularFrequency,
    bellBaseY,
    bellCenterX,
    bellContactX,
    bellDecayRate,
    bellHeight,
    bellLipRadius,
    bellTopY,
    bellVibrationAmplitude,
    cycleDuration,
    hammerArmLength,
    hammerTailLength,
    pivot: pivot.clone(),
    restAngle,
    ringDuration,
    springBase: springBase.clone(),
    springContactRadius,
    springPreload,
    springStiffness,
    strikeAngle,
    strikeHeadCenter: strikeHeadCenter.clone(),
    strikerRadius,
    strikeTime,
    strikeWindowDuration,
    strikeWindowStart,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.56,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const hammerMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const springMaterial = matte(PALETTE.driven, {
    metalness: 0.34,
    roughness: 0.40,
  });
  const bellMaterial = matte(PALETTE.accent, {
    metalness: 0.58,
    roughness: 0.31,
    side: THREE.DoubleSide,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  // Brown's plank runs under the hammer bracket and ends below the bell.
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(5.1, 0.22, 1.72),
    frameMaterial,
  );
  foundation.position.set(-0.15, -1.78, -0.25);
  foundation.userData.role = 'fixed-foundation-for-bell-hammer';
  root.add(foundation);

  const pivotStand = new THREE.Group();
  pivotStand.userData.role = 'fixed-hammer-pivot-bracket';
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 1.18, 0.78),
    frameMaterial,
  );
  pedestal.position.set(pivot.x, -1.15, 0.02);
  pedestal.userData.role = 'pedestal-below-hammer-pivot';
  pivotStand.add(pedestal);
  const bearing = cylinderAlongZ(0.25, 0.96, darkMaterial, 36);
  bearing.position.copy(pivot);
  bearing.position.z = 0.05;
  boreZCylinder(bearing, 0.25, 0.108, 0.50);
  bearing.userData.role = 'fixed-bearing-at-hammer-pivot';
  pivotStand.add(bearing);
  const pivotPin = cylinderAlongZ(0.105, 1.18, whiteMaterial, 28);
  pivotPin.position.copy(pivot);
  pivotPin.position.z = 0.18;
  pivotPin.userData.role = 'white-hammer-pivot-axis-index';
  pivotStand.add(pivotPin);
  root.add(pivotStand);

  const hammer = new THREE.Group();
  hammer.position.copy(pivot);
  hammer.userData.role = 'pivoted-external-bell-hammer';
  const hammerArm = new THREE.Mesh(
    new THREE.BoxGeometry(hammerArmLength, 0.14, 0.24),
    hammerMaterial,
  );
  hammerArm.position.set(hammerArmLength / 2, 0, 0);
  boreBoxAtLocalPoint(hammerArm, [-hammerArmLength/2, 0], 0.108);
  hammerArm.userData.role = 'rigid-hammer-arm';
  hammer.add(hammerArm);
  const hammerTail = new THREE.Mesh(
    new THREE.BoxGeometry(hammerTailLength, 0.16, 0.26),
    hammerMaterial,
  );
  hammerTail.position.set(-hammerTailLength / 2, 0, 0);
  boreBoxAtLocalPoint(hammerTail, [hammerTailLength/2, 0], 0.108);
  const hammerHub = addZJournal(hammer, 0.21, 0.108, 0.26, hammerMaterial, new THREE.Vector3(), 'bored-hammer-pivot-hub');
  hammerTail.userData.role = 'abstract-actuating-tail-of-hammer';
  hammer.add(hammerTail);
  const hammerHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.46, 0.62),
    hammerMaterial,
  );
  hammerHead.position.set(hammerArmLength - 0.22, 0, 0);
  hammerHead.rotation.z = THREE.MathUtils.degToRad(8);
  hammerHead.userData.role = 'rectangular-hammer-head';
  hammer.add(hammerHead);
  const strikerFace = new THREE.Mesh(
    new THREE.SphereGeometry(strikerRadius, 26, 20),
    whiteMaterial,
  );
  strikerFace.position.set(hammerArmLength, 0, 0);
  strikerFace.userData.role = 'rounded-bell-contact-face';
  hammer.add(strikerFace);
  root.add(hammer);

  const springHeel = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.34, 0.66),
    springMaterial,
  );
  springHeel.position.copy(springBase);
  springHeel.position.y -= 0.13;
  springHeel.position.z = springBase.z;
  springHeel.userData.role = 'fixed-heel-of-return-spring';
  root.add(springHeel);
  const returnLeafSpring = makeSegmentedLeafSpring(
    24,
    0.055,
    springMaterial,
  );
  root.add(returnLeafSpring);
  const springContactPad = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 22, 16),
    whiteMaterial,
  );
  springContactPad.userData.role =
    'sliding-contact-of-leaf-spring-under-hammer';
  root.add(springContactPad);

  const bellPivot = new THREE.Group();
  bellPivot.position.set(bellCenterX, bellTopY, pivot.z);
  bellPivot.userData.role = 'small-post-impact-bell-vibration-pivot';
  const bellProfile = [
    new THREE.Vector2(0.18, bellHeight),
    new THREE.Vector2(0.28, bellHeight - 0.13),
    new THREE.Vector2(0.34, bellHeight - 0.34),
    new THREE.Vector2(0.36, bellHeight - 0.72),
    new THREE.Vector2(0.43, bellHeight - 1.02),
    new THREE.Vector2(0.60, bellHeight - 1.36),
    new THREE.Vector2(0.82, bellHeight - 1.72),
    new THREE.Vector2(bellLipRadius, 0),
  ];
  const bellBody = new THREE.Mesh(
    new THREE.LatheGeometry([...bellProfile,
      ...bellProfile.slice().reverse().map(p => new THREE.Vector2(p.x - 0.055, p.y)), bellProfile[0]].reverse(), 96),
    bellMaterial,
  );
  bellBody.position.set(0, -bellHeight, 0);
  bellBody.userData.role = 'fixed-mounted-struck-bell';
  bellPivot.add(bellBody);
  const bellLip = new THREE.Mesh(
    new THREE.TorusGeometry(bellLipRadius, 0.075, 14, 64),
    bellMaterial,
  );
  bellLip.rotation.x = Math.PI / 2;
  bellLip.position.set(0, -bellHeight, 0);
  bellLip.userData.role = 'reinforced-lip-at-hammer-contact-height';
  bellPivot.add(bellLip);
  const bellCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.34, 0.22, 40),
    bellMaterial,
  );
  // Set just below the hanger pin, which passes through the canon loop.
  bellCrown.position.set(0, -0.15, 0);
  bellCrown.userData.role = 'bell-crown-below-hanger';
  // The cast canon loop Brown draws on the crown; the hanger pin runs through it.
  const bellCanon = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.055, 14, 48),
    bellMaterial,
  );
  bellCanon.position.y = 0.08;
  bellCanon.userData.role = 'bell-canon-loop-on-hanger';
  bellPivot.add(bellCanon);
  bellPivot.add(bellCrown);
  root.add(bellPivot);

  const fixedBellSupport = new THREE.Group();
  fixedBellSupport.userData.role = 'fixed-overhead-bell-support';
  const supportPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, bellTopY + 0.34 + 1.72, 0.28),
    frameMaterial,
  );
  supportPost.position.set(3.12, (bellTopY + 0.34 - 1.72) / 2, -0.38);
  supportPost.userData.role = 'fixed-bell-support-post';
  fixedBellSupport.add(supportPost);
  const supportArm = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.18, 0.28),
    frameMaterial,
  );
  supportArm.position.set(2.62, bellTopY + 0.25, -0.38);
  supportArm.userData.role = 'fixed-overhead-arm-carrying-bell';
  fixedBellSupport.add(supportArm);
  const hanger = cylinderAlongZ(0.07, 1.04, darkMaterial, 26);
  hanger.position.set(bellCenterX, bellTopY + 0.08, 0.06);
  hanger.userData.role = 'fixed-bell-hanger-pin';
  fixedBellSupport.add(hanger);
  root.add(fixedBellSupport);

  const update = (time) => {
    const state = stateAtTime(time);
    hammer.rotation.z = state.hammerAngle;
    springContactPad.position.copy(state.springContact);
    returnLeafSpring.userData.setCurve(
      springBase,
      springBase.clone().add(new THREE.Vector3(0.52, 0.02, 0)),
      state.springContact.clone().add(new THREE.Vector3(-0.46, -0.42, 0)),
      state.springContact,
    );
    bellPivot.rotation.z = state.bellAngle;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'pivoted-bell-hammer-with-preloaded-under-lever-return-leaf-spring-and-clear-ring-dwell',
    blocks: {
      bellBody,
      bellLip,
      bellPivot,
      fixedBellSupport,
      foundation,
      hammer,
      hammerArm,
      hammerHub,
      bearing,
      pivotPin,
      hammerHead,
      hammerTail,
      pivotStand,
      returnLeafSpring,
      springContactPad,
      springHeel,
      strikerFace,
    },
    degreesOfFreedom: {
      bellStructuralModesRepresented: 1,
      hammerAngleIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      springDeflectionIndependent: false,
    },
    dynamics: {
      actuatorAndImpactContactForceHistoryModeled: false,
      bellResponse:
        'small finite-duration damped display rotation begins at the strike event; it is a legibility cue rather than an elastic shell solution',
      hammerMotion:
        'prescribed compact-support strike pulse; spring force is reported quasi-statically and is not integrated as a free dynamic state',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsSpringRateOrLoads: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A rigid external hammer pivots in one fixed bearing. An abstract actuation pulse rotates it to one exact bell-lip contact pose. The preloaded curved leaf spring remains beneath the right-hand lever, gains compression on approach, and returns the hammer to its clear rest angle, leaving the bell untouched throughout the long ringing dwell.',
    motion: {
      clearDwellDuration:
        cycleDuration - strikeWindowDuration,
      cycleDuration,
      hammerAngularStroke: angularStroke,
      strikeTime,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 420 page marks Animated unavailable and provides Brown’s static engraving only.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      hammerAngle: sourceState.hammerAngle,
      hammerHeadCenter: sourceState.hammerHeadCenter.clone(),
      springContact: sourceState.springContact.clone(),
    },
    sourceReference: {
      brownPlate420: {
        bellApproximateBoundsPixels: [295, 101, 502, 304],
        hammerHeadApproximateBoundsPixels: [249, 221, 301, 274],
        hammerPivotApproximateCenterPixels: [161, 327],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        returnSpringApproximateBoundsPixels: [167, 260, 254, 370],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the arrangement is a hammer for striking bells',
          'a spring is below the hammer',
          'the spring raises the hammer after striking',
          'the hammer is taken out of contact with the bell',
          'clearance prevents interference with bell vibration',
        ],
        engravingEvidence:
          'Brown’s plate shows an external rectangular-headed hammer on a fixed pivot, a long left actuating tail, a curved leaf spring fixed below the right-hand lever, and a separate bell to the right.',
        reconstructionDisclosure:
          'Brown gives no actuator, dimensions, spring characteristic, impact speed, bell material model, or timing. The compact-support strike pulse, exact tangent contact pose, linear quasi-static spring readout, tiny damped bell rotation, frame, proportions, and four-second display cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 420',
    },
    stateAtCycleTime,
    stateAtTime,
    transmission: {
      bellClearance:
        'distance from striker center to rotated bell lip centerline minus both contact radii',
      springCompression:
        'preload+restContactHeight-currentContactHeight',
      strikePulse:
        '64*u^3*(1-u)^3 within the finite strike window; zero outside',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.22, -1.94, -1.08),
    new THREE.Vector3(3.35, 2.55, 1.12),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(4.7, 3.0, 10.8);
  root.userData.groundFloorY = -1.94;
  finishSpringFamily(root, cycleDuration);
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSpringReturnBellHammerMovement(movement) {
  if (movement.id !== 420) return null;
  return springReturnBellHammer(movement);
}
