import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return bounded * bounded * bounded
    * (bounded * (bounded * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * bounded * bounded
    * (bounded - 1) * (bounded - 1);
}

function smootherStepIntegral(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return bounded ** 6 - 3 * bounded ** 5
    + 2.5 * bounded ** 4;
}

function cylinderAlongZ(radius, length, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function annularDiskAlongZ({
  depth,
  innerRadius,
  material,
  outerRadius,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.018, depth * 0.10),
    bevelThickness: Math.min(0.018, depth * 0.10),
    curveSegments: 96,
    depth,
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

function scrollGear(movement) {
  const root = new THREE.Group();
  const cycleDuration = 10;
  const rampDuration = 0.75;
  const cruiseDuration = 2.50;
  const oneWayMotionDuration = rampDuration * 2 + cruiseDuration;
  const innerDwellDuration = 1;
  const outerDwellDuration = 1;
  const reverseStartTime = oneWayMotionDuration + innerDwellDuration;
  const outerDwellStartTime = reverseStartTime + oneWayMotionDuration;
  const scrollOuterRadius = 2.06;
  const scrollInnerRadius = 0.92;
  const scrollSweep = FULL_TURN * 1.65;
  const spiralLeadPerRadian = (
    scrollOuterRadius - scrollInnerRadius
  ) / scrollSweep;
  const contactWorldAngle = -Math.PI / 2;
  const spiralMaximumLocalAngle = contactWorldAngle;
  const spiralMinimumLocalAngle = contactWorldAngle - scrollSweep;
  const pinionPitchRadius = 0.42;
  const pinionFaceLength = 0.46;
  const plateFaceZ = 0.16;
  const pinionAxisZ = plateFaceZ - pinionPitchRadius;
  const pinionTeeth = 18;
  const scrollToothCount = 108;
  const rolledDistance = scrollOuterRadius * scrollSweep
    - spiralLeadPerRadian * scrollSweep ** 2 / 2;
  const pinionMaximumAngle = rolledDistance / pinionPitchRadius;
  const cruisePinionAngularSpeed = pinionMaximumAngle
    / (cruiseDuration + rampDuration);
  const spiralRadiusAtPlateAngle = (plateAngle) =>
    scrollOuterRadius - spiralLeadPerRadian * plateAngle;
  const spiralLocalAngleAtPlateAngle = (plateAngle) =>
    contactWorldAngle - plateAngle;
  const geometry = {
    contactWorldAngle,
    cruiseDuration,
    cruisePinionAngularSpeed,
    cycleDuration,
    innerDwellDuration,
    outerDwellDuration,
    pinionAxisZ,
    pinionFaceLength,
    pinionMaximumAngle,
    pinionPitchRadius,
    pinionTeeth,
    plateFaceZ,
    rampDuration,
    reverseStartTime,
    rolledDistance,
    scrollInnerRadius,
    scrollOuterRadius,
    scrollSweep,
    scrollToothCount,
    spiralLeadPerRadian,
    spiralMaximumLocalAngle,
    spiralMinimumLocalAngle,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.28,
    roughness: 0.50,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.19,
    roughness: 0.51,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.26,
    roughness: 0.46,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.39 });
  const plateMaterial = matte(PALETTE.driven, {
    metalness: 0.08,
    opacity: 0.24,
    roughness: 0.65,
    transparent: true,
  });
  plateMaterial.depthWrite = false;
  plateMaterial.side = THREE.DoubleSide;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-right-angle-scroll-gear-support-frame';
  root.add(fixedFrame);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.60, 0.22, 2.24),
    frameMaterial,
  );
  base.position.set(0, -2.77, -0.38);
  base.userData.role = 'fixed-scroll-gear-foundation';
  fixedFrame.add(base);
  const rearStandard = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 4.75, 0.38),
    frameMaterial,
  );
  rearStandard.position.set(-2.48, -0.22, -0.85);
  rearStandard.userData.role = 'fixed-rear-scroll-plate-standard';
  fixedFrame.add(rearStandard);
  const scrollBearingArm = beamBetween(
    new THREE.Vector3(-2.48, 0, -0.85),
    new THREE.Vector3(-0.30, 0, -0.85),
    0.25,
    0.32,
    frameMaterial,
  );
  scrollBearingArm.userData.role = 'fixed-scroll-axis-bearing-arm';
  fixedFrame.add(scrollBearingArm);
  const scrollBearing = cylinderAlongZ(0.31, 0.42, frameMaterial, 36);
  scrollBearing.position.z = -0.77;
  scrollBearing.userData.role = 'fixed-scroll-plate-axis-bearing';
  fixedFrame.add(scrollBearing);
  const lowerPinionBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.40, 32),
    frameMaterial,
  );
  lowerPinionBearing.position.set(0, -2.44, pinionAxisZ);
  lowerPinionBearing.userData.role = 'fixed-lower-pinion-shaft-bearing';
  fixedFrame.add(lowerPinionBearing);
  const upperPinionBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.40, 32),
    frameMaterial,
  );
  upperPinionBearing.position.set(0, 2.42, pinionAxisZ);
  upperPinionBearing.userData.role = 'fixed-upper-pinion-shaft-bearing';
  fixedFrame.add(upperPinionBearing);

  const scrollRotor = new THREE.Group();
  scrollRotor.userData.role =
    'variable-speed-scroll-plate-A-output-rotor';
  root.add(scrollRotor);
  const scrollBackplate = annularDiskAlongZ({
    depth: 0.13,
    innerRadius: 0.56,
    material: plateMaterial,
    outerRadius: 2.24,
  });
  scrollBackplate.position.z = 0.02;
  scrollBackplate.userData.role =
    'translucent-scroll-plate-A-supporting-web';
  scrollRotor.add(scrollBackplate);
  const scrollOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.22, 0.055, 10, 96),
    darkMaterial,
  );
  scrollOuterRim.position.z = 0.02;
  scrollOuterRim.userData.role = 'scroll-plate-A-outer-rim';
  scrollRotor.add(scrollOuterRim);
  const scrollHub = cylinderAlongZ(0.34, 0.56, darkMaterial, 40);
  scrollHub.position.z = -0.05;
  scrollHub.userData.role = 'scroll-plate-A-central-hub';
  scrollRotor.add(scrollHub);
  const scrollShaft = cylinderAlongZ(0.14, 2.18, darkMaterial, 36);
  scrollShaft.position.z = -0.30;
  scrollShaft.userData.role = 'scroll-plate-A-output-shaft';
  scrollRotor.add(scrollShaft);

  const spiralPoints = [];
  const spiralPointCount = 420;
  for (let index = 0; index <= spiralPointCount; index += 1) {
    const fraction = index / spiralPointCount;
    const localAngle = THREE.MathUtils.lerp(
      spiralMinimumLocalAngle,
      spiralMaximumLocalAngle,
      fraction,
    );
    const radius = scrollInnerRadius
      + spiralLeadPerRadian * (
        localAngle - spiralMinimumLocalAngle
      );
    spiralPoints.push(new THREE.Vector3(
      Math.cos(localAngle) * radius,
      Math.sin(localAngle) * radius,
      plateFaceZ,
    ));
  }
  const spiralCurve = new THREE.CatmullRomCurve3(
    spiralPoints,
    false,
    'centripetal',
  );
  spiralCurve.arcLengthDivisions = 1600;
  const spiralRail = new THREE.Mesh(
    new THREE.TubeGeometry(spiralCurve, 540, 0.115, 10, false),
    drivenMaterial,
  );
  spiralRail.userData.role =
    'single-finite-archimedean-scroll-rack-on-plate-A';
  scrollRotor.add(spiralRail);
  const scrollTeeth = Array.from({ length: scrollToothCount }, (_, index) => {
    const fraction = (index + 0.5) / scrollToothCount;
    const point = spiralCurve.getPointAt(fraction);
    const tangent = spiralCurve.getTangentAt(fraction).normalize();
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.31, 0.12),
      index % 6 === 0 ? accentMaterial : darkMaterial,
    );
    tooth.position.copy(point);
    tooth.position.z += 0.075;
    tooth.rotation.z = Math.atan2(tangent.y, tangent.x);
    tooth.userData.role = `scroll-rack-face-tooth-${index + 1}`;
    tooth.userData.scrollTooth = true;
    tooth.userData.pathFraction = fraction;
    scrollRotor.add(tooth);
    return tooth;
  });
  const scrollRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.72, 0.035),
    whiteMaterial,
  );
  scrollRotationIndex.position.set(2.09, 0, 0.31);
  scrollRotationIndex.rotation.z = Math.PI / 2;
  scrollRotationIndex.userData.role =
    'white-scroll-plate-A-output-rotation-index';
  scrollRotor.add(scrollRotationIndex);

  const pinionShaftRotor = new THREE.Group();
  pinionShaftRotor.position.z = pinionAxisZ;
  pinionShaftRotor.userData.role =
    'uniform-input-feathered-radial-pinion-shaft';
  root.add(pinionShaftRotor);
  const pinionShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 5.30, 36),
    darkMaterial,
  );
  pinionShaft.userData.role = 'long-radial-pinion-input-shaft';
  pinionShaftRotor.add(pinionShaft);
  const shaftFeather = new THREE.Mesh(
    new THREE.BoxGeometry(0.105, 4.22, 0.075),
    accentMaterial,
  );
  shaftFeather.position.x = 0.125;
  shaftFeather.userData.role =
    'longitudinal-feather-key-on-input-shaft';
  pinionShaftRotor.add(shaftFeather);
  const shaftRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.54, 0.035),
    whiteMaterial,
  );
  shaftRotationIndex.position.set(0.145, 2.02, 0);
  shaftRotationIndex.userData.role =
    'white-input-shaft-rotation-index';
  pinionShaftRotor.add(shaftRotationIndex);

  const slidingPinion = new THREE.Group();
  slidingPinion.userData.role =
    'pinion-B-sliding-axially-on-shaft-feather';
  pinionShaftRotor.add(slidingPinion);
  const pinionBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pinionPitchRadius + 0.07,
      pinionPitchRadius * 0.66,
      pinionFaceLength,
      54,
    ),
    driverMaterial,
  );
  pinionBody.userData.role = 'bevel-like-sliding-pinion-B-body';
  slidingPinion.add(pinionBody);
  const pinionHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.70, 34),
    darkMaterial,
  );
  pinionHub.position.y = -0.12;
  pinionHub.userData.role =
    'pinion-B-hub-with-longitudinal-keyway';
  slidingPinion.add(pinionHub);
  const pinionTeethMeshes = Array.from({ length: pinionTeeth }, (_, index) => {
    const angle = FULL_TURN * index / pinionTeeth;
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.075),
      darkMaterial,
    );
    tooth.position.set(
      Math.cos(angle) * (pinionPitchRadius + 0.025),
      pinionFaceLength / 2 - 0.045,
      Math.sin(angle) * (pinionPitchRadius + 0.025),
    );
    tooth.rotation.y = -angle;
    tooth.userData.role = `pinion-B-face-tooth-${index + 1}`;
    slidingPinion.add(tooth);
    return tooth;
  });
  const pinionRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  pinionRotationIndex.position.set(
    0,
    pinionFaceLength / 2 + 0.02,
    pinionPitchRadius,
  );
  pinionRotationIndex.userData.role =
    'white-sliding-pinion-B-rotation-index';
  slidingPinion.add(pinionRotationIndex);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    whiteMaterial,
  );
  contactMarker.userData.role =
    'white-moving-scroll-pinion-pitch-contact';
  root.add(contactMarker);
  const radialTravelGuide = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, scrollOuterRadius - scrollInnerRadius, 0.04),
    frameMaterial,
  );
  radialTravelGuide.position.set(
    0,
    -(scrollOuterRadius + scrollInnerRadius) / 2,
    plateFaceZ + 0.31,
  );
  radialTravelGuide.userData.role =
    'fixed-radial-line-of-pinion-B-scroll-contact-travel';
  root.add(radialTravelGuide);

  function inputStateAtTime(cycleTime) {
    const rampDisplacement = cruisePinionAngularSpeed
      * rampDuration / 2;
    const cruiseStartAngle = rampDisplacement;
    const decelerationStartAngle = cruiseStartAngle
      + cruisePinionAngularSpeed * cruiseDuration;
    if (cycleTime < rampDuration) {
      const unitTime = cycleTime / rampDuration;
      return {
        acceleration: cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: cruisePinionAngularSpeed * rampDuration
          * smootherStepIntegral(unitTime),
        speed: cruisePinionAngularSpeed * smootherStep(unitTime),
        stage: 'forward-smooth-start',
      };
    }
    if (cycleTime < rampDuration + cruiseDuration) {
      const elapsed = cycleTime - rampDuration;
      return {
        acceleration: 0,
        angle: cruiseStartAngle + cruisePinionAngularSpeed * elapsed,
        speed: cruisePinionAngularSpeed,
        stage: 'forward-uniform-input-increasing-output-speed',
      };
    }
    if (cycleTime < oneWayMotionDuration) {
      const elapsed = cycleTime - rampDuration - cruiseDuration;
      const unitTime = elapsed / rampDuration;
      return {
        acceleration: -cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: decelerationStartAngle
          + cruisePinionAngularSpeed * rampDuration
            * (unitTime - smootherStepIntegral(unitTime)),
        speed: cruisePinionAngularSpeed * (1 - smootherStep(unitTime)),
        stage: 'forward-smooth-stop-at-inner-end',
      };
    }
    if (cycleTime < reverseStartTime) {
      return {
        acceleration: 0,
        angle: pinionMaximumAngle,
        speed: 0,
        stage: 'stationary-inner-end-reversal-dwell',
      };
    }
    const reverseTime = cycleTime - reverseStartTime;
    if (reverseTime < rampDuration) {
      const unitTime = reverseTime / rampDuration;
      return {
        acceleration: -cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: pinionMaximumAngle
          - cruisePinionAngularSpeed * rampDuration
            * smootherStepIntegral(unitTime),
        speed: -cruisePinionAngularSpeed * smootherStep(unitTime),
        stage: 'reverse-smooth-start',
      };
    }
    if (reverseTime < rampDuration + cruiseDuration) {
      const elapsed = reverseTime - rampDuration;
      return {
        acceleration: 0,
        angle: pinionMaximumAngle - cruiseStartAngle
          - cruisePinionAngularSpeed * elapsed,
        speed: -cruisePinionAngularSpeed,
        stage: 'reverse-uniform-input-decreasing-output-speed',
      };
    }
    if (cycleTime < outerDwellStartTime) {
      const elapsed = reverseTime - rampDuration - cruiseDuration;
      const unitTime = elapsed / rampDuration;
      return {
        acceleration: cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: pinionMaximumAngle - decelerationStartAngle
          - cruisePinionAngularSpeed * rampDuration
            * (unitTime - smootherStepIntegral(unitTime)),
        speed: -cruisePinionAngularSpeed
          * (1 - smootherStep(unitTime)),
        stage: 'reverse-smooth-stop-at-outer-end',
      };
    }
    return {
      acceleration: 0,
      angle: 0,
      speed: 0,
      stage: 'stationary-outer-end-cycle-dwell',
    };
  }

  function stateAtTime(time) {
    const cycleTime = positiveModulo(time, cycleDuration);
    const input = inputStateAtTime(cycleTime);
    const discriminant = Math.max(
      0,
      scrollOuterRadius ** 2
        - 2 * spiralLeadPerRadian
          * pinionPitchRadius * input.angle,
    );
    const contactRadius = Math.sqrt(discriminant);
    const plateAngle = (
      scrollOuterRadius - contactRadius
    ) / spiralLeadPerRadian;
    const plateAngularSpeed = pinionPitchRadius * input.speed
      / contactRadius;
    const plateAngularAcceleration = (
      pinionPitchRadius * input.acceleration
        + spiralLeadPerRadian * plateAngularSpeed ** 2
    ) / contactRadius;
    const contactRadiusSpeed = -spiralLeadPerRadian
      * plateAngularSpeed;
    const contactRadiusAcceleration = -spiralLeadPerRadian
      * plateAngularAcceleration;
    const pinionCenterY = -contactRadius - pinionFaceLength / 2;
    const pinionSlideSpeed = -contactRadiusSpeed;
    const pinionSlideAcceleration = -contactRadiusAcceleration;
    const spiralLocalAngle = spiralLocalAngleAtPlateAngle(plateAngle);
    const spiralLocalContact = new THREE.Vector3(
      Math.cos(spiralLocalAngle) * contactRadius,
      Math.sin(spiralLocalAngle) * contactRadius,
      plateFaceZ,
    );
    const spiralWorldContact = spiralLocalContact.clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), plateAngle);
    const pitchContact = new THREE.Vector3(
      0,
      -contactRadius,
      plateFaceZ,
    );
    const pinionPitchLineSpeed = pinionPitchRadius * input.speed;
    const platePitchLineSpeed = contactRadius * plateAngularSpeed;
    const integratedRollingResidual = pinionPitchRadius * input.angle
      - (scrollOuterRadius * plateAngle
        - spiralLeadPerRadian * plateAngle ** 2 / 2);
    const accelerationConstraintResidual = pinionPitchRadius
      * input.acceleration
      - (contactRadius * plateAngularAcceleration
        - spiralLeadPerRadian * plateAngularSpeed ** 2);
    return {
      accelerationConstraintResidual,
      contactRadius,
      contactRadiusAcceleration,
      contactRadiusSpeed,
      cyclePhase: cycleTime / cycleDuration,
      cycleTime,
      instantaneousOutputToInputRatio:
        pinionPitchRadius / contactRadius,
      integratedRollingResidual,
      pinionAngle: input.angle,
      pinionAngularAcceleration: input.acceleration,
      pinionAngularSpeed: input.speed,
      pinionCenterY,
      pinionPitchLineSpeed,
      pinionSlideAcceleration,
      pinionSlideSpeed,
      pitchContact,
      pitchLineSpeedResidual:
        platePitchLineSpeed - pinionPitchLineSpeed,
      plateAngle,
      plateAngularAcceleration,
      plateAngularSpeed,
      platePitchLineSpeed,
      spiralLocalAngle,
      spiralLocalContact,
      spiralRadiusResidual:
        contactRadius - spiralRadiusAtPlateAngle(plateAngle),
      spiralWorldContact,
      stage: input.stage,
    };
  }

  function update(time) {
    const state = stateAtTime(time);
    scrollRotor.rotation.z = state.plateAngle;
    pinionShaftRotor.rotation.y = state.pinionAngle;
    slidingPinion.position.y = state.pinionCenterY;
    contactMarker.position.copy(state.pitchContact);
  }

  const sourceState = stateAtTime(0);
  const archetype =
    'archimedean-face-scroll-driven-by-feather-keyed-axially-sliding-radial-pinion-with-reciprocal-radius-speed-law';
  root.userData = {
    archetype,
    blocks: {
      base,
      contactMarker,
      fixedFrame,
      pinionBody,
      pinionHub,
      pinionRotationIndex,
      pinionShaft,
      pinionShaftRotor,
      pinionTeethMeshes,
      radialTravelGuide,
      scrollBackplate,
      scrollBearing,
      scrollHub,
      scrollOuterRim,
      scrollRotationIndex,
      scrollRotor,
      scrollShaft,
      scrollTeeth,
      shaftFeather,
      shaftRotationIndex,
      slidingPinion,
      spiralRail,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pinionAxialPositionIndependent: false,
      simultaneouslyActiveInputs: 1,
      storedEnergyStates: 0,
    },
    dynamics: {
      backlashElasticityInertiaLoadsAndForcesModeled: false,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Uniform rotation of the vertical radial shaft is transmitted through its longitudinal feather to pinion B while leaving B free to slide axially. B rolls against one finite Archimedean face-scroll on plate A. Forward plate rotation carries the contact from the outer radius to the inner radius, so the exact instantaneous speed gain pinionPitchRadius/contactRadius increases; reverse rotation retraces the same scroll outward and the gain decreases.',
    motion: {
      cycleDuration,
      innerDwellDuration,
      oneWayMotionDuration,
      outerDwellDuration,
      reverseStartTime,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 414 page marks its Animated control unavailable and supplies only Brown’s static plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      contactRadius: sourceState.contactRadius,
      pinionCenterY: sourceState.pinionCenterY,
      setting:
        'outer scroll end at the lower radial pinion shaft, with B at its lowest feather-guided position as in Brown’s plate',
    },
    sourceReference: {
      brownPlate414: {
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        pinionBApproximateBoundsPixels: [205, 332, 327, 405],
        radialShaftApproximateBoundsPixels: [243, 38, 291, 482],
        scrollPlateAApproximateBoundsPixels: [92, 108, 413, 374],
        scrollTrackInnerEndApproximatePixels: [207, 315],
        scrollTrackOuterEndApproximatePixels: [385, 349],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device consists of a scroll gear and sliding pinion',
          'the scroll plate is A',
          'pinion B slides',
          'B moves on a feather on its shaft',
          'A has increasing velocity in one direction',
          'A has decreasing velocity when motion is reversed',
        ],
        engravingEvidence:
          'The plate shows one finite spiral band of transverse face teeth on vertical plate A, a straight radial shaft crossing its center line, and a conical pinion B at the lower intersection whose hub can travel along that shaft.',
        reconstructionDisclosure:
          'Brown fixes the face-scroll topology, feather-guided axial slide, and opposite speed trends but gives no scroll equation, dimensions, tooth counts, input speed, timing, or end treatment. The finite Archimedean scroll, 18 pinion teeth, 108 displayed rack teeth, radii, smooth acceleration ramps, dwells, and reversals are independently engineered; the exact integrated rolling constraint is retained throughout.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 414',
    },
    stateAtTime,
    transmission: {
      accelerationConstraint:
        'pinionRadius*pinionAcceleration=contactRadius*plateAcceleration-lead*plateSpeed^2',
      integratedRollingConstraint:
        'pinionRadius*pinionAngle=outerRadius*plateAngle-(lead/2)*plateAngle^2',
      instantaneousSpeedConstraint:
        'pinionRadius*pinionSpeed=contactRadius*plateSpeed',
      pinionSlideConstraint:
        'pinion center y=-contact radius-pinion face length/2',
      scrollConstraint:
        'contact radius=outer radius-lead*plate angle',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.92, -2.89, -1.25),
    new THREE.Vector3(2.72, 2.68, 1.25),
  );
  root.userData.cameraDistanceScale = 1.01;
  root.userData.cameraDirection = new THREE.Vector3(6.5, 4.0, 10.8);
  root.userData.groundFloorY = -2.89;
  markShadows(root);
  base.receiveShadow = true;
  contactMarker.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredScrollGearMovement(movement) {
  if (movement.id !== 414) return null;
  return scrollGear(movement);
}
