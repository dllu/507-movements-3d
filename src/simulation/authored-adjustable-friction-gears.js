import { correctFriction413, finishFrictionFamily } from './friction-family-working-parts.js';
import * as THREE from 'three';
import { standardTurnedHandleGeometry, handleShank, HANDLE_FOOT_EMBED } from './turned-handle.js';
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

function smootherStepSecondDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * bounded
    * (2 * bounded * bounded - 3 * bounded + 1);
}

function profile(span, duration, elapsed) {
  const unitTime = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
  return {
    acceleration: span * smootherStepSecondDerivative(unitTime)
      / (duration * duration),
    displacement: span * smootherStep(unitTime),
    speed: span * smootherStepDerivative(unitTime) / duration,
    unitTime,
  };
}

function cylinderAlongX(radius, length, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function frustumAlongX({
  length,
  material,
  radiusAtNegativeX,
  radiusAtPositiveX,
  segments = 64,
}) {
  const frustum = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusAtPositiveX,
      radiusAtNegativeX,
      length,
      segments,
    ),
    material,
  );
  frustum.rotation.z = -Math.PI / 2;
  return frustum;
}

function torusNormalToX(majorRadius, tubeRadius, material, segments = 72) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
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

function helixAlongX({
  endX,
  material,
  radius,
  startX,
  turns,
  tubeRadius,
}) {
  const points = [];
  const segments = Math.ceil(turns * 32);
  for (let index = 0; index <= segments; index += 1) {
    const fraction = index / segments;
    const angle = fraction * turns * FULL_TURN;
    points.push(new THREE.Vector3(
      THREE.MathUtils.lerp(startX, endX, fraction),
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments * 2, tubeRadius, 7, false),
    material,
  );
}

function adjustableFrictionGear(movement) {
  const root = new THREE.Group();
  const cycleDuration = 9;
  const tighteningDuration = 2;
  const operatingDuration = 5;
  const looseningDuration = 2;
  const centerDistance = 2;
  const upperCenter = new THREE.Vector3(0, 1.02, 0);
  const lowerCenter = new THREE.Vector3(0, upperCenter.y - centerDistance, 0);
  const looseRubberWidth = 0.50;
  const tightRubberWidth = 0.42;
  const looseRubberCoreRadius = 0.70;
  const looseRubberTipRadius = 0.90;
  const upperPitchRadius = (
    looseRubberCoreRadius + looseRubberTipRadius
  ) / 2;
  const lowerGrooveLipRadius = centerDistance - looseRubberCoreRadius;
  const lowerGrooveRootRadius = centerDistance - looseRubberTipRadius;
  const lowerPitchRadius = (
    lowerGrooveLipRadius + lowerGrooveRootRadius
  ) / 2;
  const upperInputTurns = 3;
  const lowerOutputTurns = -2;
  const adjustmentNutTurns = 1;
  const leftPlateLooseX = -looseRubberWidth / 2 - 0.07;
  const leftPlateTightX = -tightRubberWidth + looseRubberWidth / 2 - 0.07;
  const rightPlateX = looseRubberWidth / 2 + 0.07;
  const plateThickness = 0.14;
  const looseNutX = leftPlateLooseX - plateThickness / 2 - 0.11;
  const nutAdvance = leftPlateTightX - leftPlateLooseX;
  const threadLead = nutAdvance / adjustmentNutTurns;
  const rubberVolumeProxy = looseRubberWidth * looseRubberTipRadius ** 2;
  const frictionCoefficientProxy = 0.78;
  const radialStiffnessProxy = 11.5;
  const contactY = upperCenter.y - upperPitchRadius;
  const pitchContactAxialPositions = [
    -looseRubberWidth / 4,
    looseRubberWidth / 4,
  ];
  const contactSampleAxialPositions = [-1, 1].flatMap((side) =>
    [0.125, 0.375, 0.625, 0.875].map((fraction) =>
      side * looseRubberWidth / 2 * fraction));
  const upperRadiusAtAxialPosition = (axialPosition) =>
    THREE.MathUtils.lerp(
      looseRubberTipRadius,
      looseRubberCoreRadius,
      Math.abs(axialPosition) / (looseRubberWidth / 2),
    );
  const contactSamples = contactSampleAxialPositions.map((axialPosition) => {
    const upperRadius = upperRadiusAtAxialPosition(axialPosition);
    return {
      axialPosition,
      lowerRadius: centerDistance - upperRadius,
      point: new THREE.Vector3(
        axialPosition,
        upperCenter.y - upperRadius,
        0,
      ),
      upperRadius,
    };
  });
  const pitchContacts = pitchContactAxialPositions.map((axialPosition) => ({
    axialPosition,
    lowerRadius: lowerPitchRadius,
    point: new THREE.Vector3(axialPosition, contactY, 0),
    upperRadius: upperPitchRadius,
  }));
  const geometry = {
    adjustmentNutTurns,
    centerDistance,
    contactSamples,
    contactY,
    cycleDuration,
    frictionCoefficientProxy,
    leftPlateLooseX,
    leftPlateTightX,
    looseNutX,
    looseRubberCoreRadius,
    looseRubberTipRadius,
    looseRubberWidth,
    lowerCenter,
    lowerGrooveLipRadius,
    lowerGrooveRootRadius,
    lowerOutputTurns,
    lowerPitchRadius,
    nutAdvance,
    pitchContacts,
    radialStiffnessProxy,
    rightPlateX,
    rubberVolumeProxy,
    threadLead,
    tightRubberWidth,
    upperCenter,
    upperInputTurns,
    upperPitchRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.28,
    roughness: 0.49,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const rubberMaterial = matte(0x222a2d, {
    metalness: 0.01,
    roughness: 0.84,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.26,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-two-shaft-friction-gear-frame';
  root.add(fixedFrame);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.70, 0.22, 2.10),
    frameMaterial,
  );
  base.position.set(0.30, -2.45, 0);
  base.userData.role = 'fixed-friction-gear-foundation';
  fixedFrame.add(base);
  const upright = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 3.75, 0.42),
    frameMaterial,
  );
  upright.position.set(1.95, -0.57, -0.58);
  upright.userData.role = 'fixed-right-bearing-standard';
  fixedFrame.add(upright);
  const upperBearing = cylinderAlongX(0.24, 0.38, frameMaterial, 32);
  upperBearing.position.set(1.95, upperCenter.y, -0.01);
  upperBearing.userData.role = 'fixed-upper-shaft-bearing';
  fixedFrame.add(upperBearing);
  const lowerBearing = cylinderAlongX(0.27, 0.38, frameMaterial, 32);
  lowerBearing.position.set(1.95, lowerCenter.y, -0.01);
  lowerBearing.userData.role = 'fixed-lower-shaft-bearing';
  fixedFrame.add(lowerBearing);

  const upperRotor = new THREE.Group();
  upperRotor.position.copy(upperCenter);
  upperRotor.userData.role =
    'upper-adjustable-wheel-and-shaft-A-driver';
  root.add(upperRotor);
  // Brown's shafts leave the wheels only to the right; the upper one ends in
  // the threaded bolt beyond nut B, the lower one at the nut on its hub.
  const upperShaft = cylinderAlongX(0.13, 3.685, darkMaterial, 36);
  upperShaft.position.x = 0.6825;
  upperShaft.userData.role = 'upper-wheel-A-shaft';
  upperRotor.add(upperShaft);
  const threadedEnd = helixAlongX({
    endX: -0.37,
    material: accentMaterial,
    radius: 0.145,
    startX: -1.12,
    tubeRadius: 0.018,
    turns: 7.5,
  });
  threadedEnd.userData.role = 'upper-shaft-exposed-adjustment-thread';
  upperRotor.add(threadedEnd);

  const rubberRotor = new THREE.Group();
  rubberRotor.userData.role =
    'incompressible-v-edged-rubber-disk-A';
  upperRotor.add(rubberRotor);
  const leftRubberHalf = frustumAlongX({
    length: looseRubberWidth / 2,
    material: rubberMaterial,
    radiusAtNegativeX: looseRubberCoreRadius,
    radiusAtPositiveX: looseRubberTipRadius,
  });
  leftRubberHalf.position.x = -looseRubberWidth / 4;
  leftRubberHalf.userData.role = 'left-flank-of-v-edged-rubber-disk';
  rubberRotor.add(leftRubberHalf);
  const rightRubberHalf = frustumAlongX({
    length: looseRubberWidth / 2,
    material: rubberMaterial,
    radiusAtNegativeX: looseRubberTipRadius,
    radiusAtPositiveX: looseRubberCoreRadius,
  });
  rightRubberHalf.position.x = looseRubberWidth / 4;
  rightRubberHalf.userData.role = 'right-flank-of-v-edged-rubber-disk';
  rubberRotor.add(rightRubberHalf);
  const rubberTipSeam = torusNormalToX(
    looseRubberTipRadius,
    0.026,
    rubberMaterial,
    80,
  );
  rubberTipSeam.userData.role = 'rubber-v-edge-crown';
  rubberRotor.add(rubberTipSeam);
  const rubberRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    whiteMaterial,
  );
  rubberRotationIndex.position.set(0, looseRubberTipRadius, 0);
  rubberRotationIndex.userData.role =
    'white-upper-rubber-wheel-rotation-index';
  rubberRotationIndex.visible = false;
  rubberRotor.add(rubberRotationIndex);

  const leftClampPlate = cylinderAlongX(0.72, plateThickness,
    driverMaterial, 56);
  leftClampPlate.position.x = leftPlateLooseX;
  leftClampPlate.userData.role =
    'nut-driven-left-metal-clamping-plate';
  upperRotor.add(leftClampPlate);
  const rightClampPlate = cylinderAlongX(0.72, plateThickness,
    driverMaterial, 56);
  rightClampPlate.position.x = rightPlateX;
  rightClampPlate.userData.role =
    'fixed-shoulder-right-metal-clamping-plate';
  upperRotor.add(rightClampPlate);
  const rightShoulder = cylinderAlongX(0.29, 0.24, darkMaterial, 36);
  rightShoulder.position.x = rightPlateX + 0.18;
  rightShoulder.userData.role = 'fixed-upper-shaft-clamping-shoulder';
  upperRotor.add(rightShoulder);
  const upperFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.52, 0.075),
    whiteMaterial,
  );
  upperFaceIndex.position.set(leftPlateLooseX - plateThickness / 2 - 0.018,
    0.32, 0);
  upperFaceIndex.userData.role =
    'white-upper-clamp-plate-rotation-index';
  upperFaceIndex.visible = false;
  upperRotor.add(upperFaceIndex);

  const adjustmentNut = new THREE.Group();
  adjustmentNut.position.x = looseNutX;
  adjustmentNut.userData.role =
    'threaded-nut-B-advancing-left-clamp-plate';
  upperRotor.add(adjustmentNut);
  const nutBody = cylinderAlongX(0.27, 0.22, accentMaterial, 6);
  nutBody.userData.role = 'hexagonal-adjustment-nut-B';
  adjustmentNut.add(nutBody);
  const nutCollar = cylinderAlongX(0.20, 0.30, darkMaterial, 32);
  nutCollar.userData.role = 'adjustment-nut-threaded-collar';
  adjustmentNut.add(nutCollar);
  const nutHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.78, 0.12),
    accentMaterial,
  );
  nutHandle.userData.role = 'adjustment-nut-B-turning-handle';
  adjustmentNut.add(nutHandle);
  const nutHandleEnds = [-1, 1].map((side) => {
    const end = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 18, 12),
      darkMaterial,
    );
    end.position.y = side * 0.42;
    end.userData.role = `adjustment-nut-handle-end-${side < 0 ? 'lower' : 'upper'}`;
    adjustmentNut.add(end);
    return end;
  });

  const lowerRotor = new THREE.Group();
  lowerRotor.position.copy(lowerCenter);
  lowerRotor.userData.role =
    'lower-rigid-v-grooved-friction-wheel-driven-output';
  root.add(lowerRotor);
  const lowerShaft = cylinderAlongX(0.15, 3.255, darkMaterial, 40);
  lowerShaft.position.x = 1.0075;
  lowerShaft.userData.role = 'lower-driven-wheel-shaft';
  lowerRotor.add(lowerShaft);
  const lowerLeftHalf = frustumAlongX({
    length: 0.34,
    material: drivenMaterial,
    radiusAtNegativeX: lowerGrooveLipRadius,
    radiusAtPositiveX: lowerGrooveRootRadius,
  });
  lowerLeftHalf.position.x = -0.19;
  lowerLeftHalf.userData.role = 'left-rigid-v-groove-flank';
  lowerRotor.add(lowerLeftHalf);
  const lowerRightHalf = frustumAlongX({
    length: 0.34,
    material: drivenMaterial,
    radiusAtNegativeX: lowerGrooveRootRadius,
    radiusAtPositiveX: lowerGrooveLipRadius,
  });
  lowerRightHalf.position.x = 0.19;
  lowerRightHalf.userData.role = 'right-rigid-v-groove-flank';
  lowerRotor.add(lowerRightHalf);
  const grooveRoot = torusNormalToX(
    lowerGrooveRootRadius,
    0.035,
    darkMaterial,
    88,
  );
  grooveRoot.userData.role = 'rigid-v-groove-root';
  lowerRotor.add(grooveRoot);
  const lowerHub = cylinderAlongX(0.31, 0.92, darkMaterial, 36);
  lowerHub.userData.role = 'lower-driven-wheel-hub';
  lowerRotor.add(lowerHub);
  const lowerFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.76, 0.09),
    whiteMaterial,
  );
  lowerFaceIndex.position.set(-0.42, 0.48, 0);
  lowerFaceIndex.userData.role =
    'white-lower-driven-wheel-rotation-index';
  lowerFaceIndex.visible = false;
  lowerRotor.add(lowerFaceIndex);
  // The hub nut and the turned crank handle Brown draws on the left face of
  // the grooved wheel, near its lower rim.
  const lowerHubNut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.14, 6),
    darkMaterial,
  );
  lowerHubNut.rotation.z = Math.PI / 2;
  lowerHubNut.position.x = -0.53;
  lowerHubNut.userData.role = 'lower-wheel-hub-nut';
  lowerRotor.add(lowerHubNut);
  const handleRadius = lowerGrooveLipRadius - 0.26;
  // Pass 98: the handle is the shared turned handle, one piece as Brown
  // draws it (a collar at the wheel, a slim neck swelling to a long bulb,
  // about 0.40 long against the flank's 0.247: 195 px against 120 px), in
  // place of a rod and a separate ellipsoid 0.82 long. Its foot is sunk in
  // the left flank's outer face (x -0.247; see correctFriction413) and its
  // shank runs on through the flank, ending just inside its back at x 0.
  const flankOuterX = -0.247;
  const handleGrip = new THREE.Mesh(
    standardTurnedHandleGeometry({ height: 0.40 + HANDLE_FOOT_EMBED, bulbRadius: 0.09,
      shank: handleShank(-flankOuterX) }),
    accentMaterial,
  );
  handleGrip.rotation.z = Math.PI / 2; // lathe +y points out along -x
  handleGrip.position.set(flankOuterX + HANDLE_FOOT_EMBED, -handleRadius, 0);
  handleGrip.userData.role = 'lower-wheel-crank-handle-grip';
  lowerRotor.add(handleGrip);

  const contactIndicators = pitchContacts.map((contact, index) => {
    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 10),
      whiteMaterial,
    );
    indicator.position.copy(contact.point);
    indicator.userData.role =
      `white-effective-pitch-contact-${index + 1}-on-v-flank`;
    root.add(indicator);
    return indicator;
  });

  const compressionGuide = new THREE.Group();
  compressionGuide.userData.role =
    'stationary-axial-compression-direction-guide';
  root.add(compressionGuide);
  const compressionRail = beamBetween(
    new THREE.Vector3(-1.10, upperCenter.y - 1.18, -0.72),
    new THREE.Vector3(0.58, upperCenter.y - 1.18, -0.72),
    0.055,
    0.055,
    frameMaterial,
  );
  compressionRail.userData.role =
    'nut-tightening-axis-reference-below-upper-wheel';
  compressionGuide.add(compressionRail);

  function stateAtTime(time) {
    const cycleTime = positiveModulo(time, cycleDuration);
    let stage;
    let compression;
    let compressionRate;
    let compressionAcceleration;
    let upperAngle;
    let upperAngularSpeed;
    let upperAngularAcceleration;

    if (cycleTime < tighteningDuration) {
      stage = 'stationary-nut-tightening-and-radial-expansion';
      const adjustment = profile(1, tighteningDuration, cycleTime);
      compression = adjustment.displacement;
      compressionRate = adjustment.speed;
      compressionAcceleration = adjustment.acceleration;
      upperAngle = 0;
      upperAngularSpeed = 0;
      upperAngularAcceleration = 0;
    } else if (cycleTime < tighteningDuration + operatingDuration) {
      stage = 'tightened-no-slip-friction-drive';
      const drive = profile(
        upperInputTurns * FULL_TURN,
        operatingDuration,
        cycleTime - tighteningDuration,
      );
      compression = 1;
      compressionRate = 0;
      compressionAcceleration = 0;
      upperAngle = drive.displacement;
      upperAngularSpeed = drive.speed;
      upperAngularAcceleration = drive.acceleration;
    } else {
      stage = 'stationary-nut-loosening-and-radial-contraction';
      const adjustment = profile(
        1,
        looseningDuration,
        cycleTime - tighteningDuration - operatingDuration,
      );
      compression = 1 - adjustment.displacement;
      compressionRate = -adjustment.speed;
      compressionAcceleration = -adjustment.acceleration;
      upperAngle = upperInputTurns * FULL_TURN;
      upperAngularSpeed = 0;
      upperAngularAcceleration = 0;
    }

    const lowerRatio = -upperPitchRadius / lowerPitchRadius;
    const lowerAngle = lowerRatio * upperAngle;
    const lowerAngularSpeed = lowerRatio * upperAngularSpeed;
    const lowerAngularAcceleration = lowerRatio
      * upperAngularAcceleration;
    const rubberWidth = THREE.MathUtils.lerp(
      looseRubberWidth,
      tightRubberWidth,
      compression,
    );
    const rubberAxialScale = rubberWidth / looseRubberWidth;
    const rubberRadialScale = Math.sqrt(
      looseRubberWidth / rubberWidth,
    );
    const freeRubberTipRadius = looseRubberTipRadius
      * rubberRadialScale;
    const freeRubberPitchRadius = upperPitchRadius
      * rubberRadialScale;
    const freeRubberCoreRadius = looseRubberCoreRadius
      * rubberRadialScale;
    const pitchInterference = freeRubberPitchRadius - upperPitchRadius;
    const normalLoadProxy = radialStiffnessProxy * pitchInterference;
    const tractionCapacityProxy = frictionCoefficientProxy
      * normalLoadProxy;
    const leftPlateX = THREE.MathUtils.lerp(
      leftPlateLooseX,
      leftPlateTightX,
      compression,
    );
    const rubberCenterX = (
      leftPlateX + plateThickness / 2
      + rightPlateX - plateThickness / 2
    ) / 2;
    const nutX = looseNutX + nutAdvance * compression;
    const nutRelativeAngle = adjustmentNutTurns * FULL_TURN * compression;
    const nutRelativeAngularSpeed = adjustmentNutTurns * FULL_TURN
      * compressionRate;
    const nutRelativeAngularAcceleration = adjustmentNutTurns * FULL_TURN
      * compressionAcceleration;
    const sampleStates = contactSamples.map((sample) => {
      const upperSurfaceSpeed = -upperAngularSpeed * sample.upperRadius;
      const lowerSurfaceSpeed = lowerAngularSpeed * sample.lowerRadius;
      const signedSlidingSpeed = lowerSurfaceSpeed - upperSurfaceSpeed;
      return {
        ...sample,
        freeRubberInterference:
          sample.upperRadius * (rubberRadialScale - 1),
        lowerSurfaceSpeed,
        signedSlidingSpeed,
        slidingSpeed: Math.abs(signedSlidingSpeed),
        upperSurfaceSpeed,
      };
    });
    const pitchContactStates = pitchContacts.map((contact) => {
      const upperSurfaceSpeed = -upperAngularSpeed * upperPitchRadius;
      const lowerSurfaceSpeed = lowerAngularSpeed * lowerPitchRadius;
      return {
        ...contact,
        lowerSurfaceSpeed,
        rollingResidual: lowerSurfaceSpeed - upperSurfaceSpeed,
        upperSurfaceSpeed,
      };
    });
    const rubberVolumeResidual = rubberWidth
      * (freeRubberTipRadius ** 2) - rubberVolumeProxy;
    const threadAdvanceResidual = nutX - looseNutX
      - threadLead * nutRelativeAngle / FULL_TURN;

    return {
      activeCoordinates: [
        Math.abs(compressionRate) > 1e-12,
        Math.abs(upperAngularSpeed) > 1e-12,
      ].filter(Boolean).length,
      compression,
      compressionAcceleration,
      compressionRate,
      cyclePhase: cycleTime / cycleDuration,
      cycleTime,
      freeRubberCoreRadius,
      freeRubberPitchRadius,
      freeRubberTipRadius,
      leftPlateX,
      lowerAngle,
      lowerAngularAcceleration,
      lowerAngularSpeed,
      lowerRatio,
      normalLoadProxy,
      nutRelativeAngle,
      nutRelativeAngularAcceleration,
      nutRelativeAngularSpeed,
      nutX,
      pitchContactStates,
      pitchInterference,
      rubberAxialScale,
      rubberCenterX,
      rubberRadialScale,
      rubberVolumeResidual,
      rubberWidth,
      sampleStates,
      stage,
      threadAdvanceResidual,
      tractionCapacityProxy,
      upperAngle,
      upperAngularAcceleration,
      upperAngularSpeed,
    };
  }

  function update(time) {
    const state = stateAtTime(time);
    upperRotor.rotation.x = state.upperAngle;
    lowerRotor.rotation.x = state.lowerAngle;
    rubberRotor.position.x = state.rubberCenterX;
    rubberRotor.scale.set(
      state.rubberAxialScale,
      state.rubberRadialScale,
      state.rubberRadialScale,
    );
    leftClampPlate.position.x = state.leftPlateX;
    upperFaceIndex.position.x = state.leftPlateX
      - plateThickness / 2 - 0.018;
    adjustmentNut.position.x = state.nutX;
    adjustmentNut.rotation.x = state.nutRelativeAngle;
  }

  const sourceState = stateAtTime(tighteningDuration);
  const archetype =
    'nut-compressed-v-edged-rubber-friction-wheel-in-rigid-v-groove-with-adjustable-traction';
  root.userData = {
    archetype,
    blocks: {
      adjustmentNut,
      base,
      compressionGuide,
      contactIndicators,
      fixedFrame,
      grooveRoot,
      leftClampPlate,
      leftRubberHalf,
      lowerFaceIndex,
      lowerLeftHalf,
      lowerRightHalf,
      lowerRotor,
      lowerShaft,
      nutBody,
      nutHandle,
      nutHandleEnds,
      rightClampPlate,
      rightRubberHalf,
      rubberRotationIndex,
      rubberRotor,
      threadedEnd,
      upperFaceIndex,
      upperRotor,
      upperShaft,
    },
    degreesOfFreedom: {
      independentSetupCoordinates: 1,
      operatingDegreesOfFreedomWhenTightened: 1,
      simultaneouslyActiveCoordinates: 1,
      storedEnergyStates: 0,
    },
    dynamics: {
      contactForceLaw:
        'dimensionless linear radial-interference proxy used only to show increasing tractive capacity',
      frictionCoefficientProxy,
      inertiaLoadsComplianceSlipAndWearModeled: false,
      radialStiffnessProxy,
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Upper wheel A is one V-edged rubber disk clamped between two metal plates on a horizontal shaft. Turning threaded nut B advances only the left plate against the fixed right shoulder: axial rubber width decreases, its free radius expands, and interference with the complementary rigid V groove increases tractive capacity. Adjustment occurs at rest; when tight, the upper wheel drives the lower wheel oppositely at the exact ratio of the two selected effective pitch radii.',
    motion: {
      cycleDuration,
      looseningDuration,
      operatingDuration,
      tighteningDuration,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 413 page marks its Animated control unavailable and supplies only Brown’s static plate.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      compression: sourceState.compression,
      freeRubberTipRadius: sourceState.freeRubberTipRadius,
      setting:
        'section through upper rubber V wheel A, left threaded nut B and clamping plates engaged with the lower rigid V groove as in Brown’s plate',
    },
    sourceReference: {
      brownPlate413: {
        imageHeight: 525,
        imageWidth: 525,
        lowerGroovedWheelApproximateBoundsPixels: [128, 198, 407, 495],
        lowerShaftApproximateBoundsPixels: [327, 334, 445, 386],
        measurementUncertaintyPixels: 12,
        nutBApproximateBoundsPixels: [112, 135, 235, 222],
        upperRubberWheelApproximateBoundsPixels: [199, 75, 304, 270],
        upperShaftApproximateBoundsPixels: [256, 138, 399, 184],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device is J. W. Howlett’s patent adjustable frictional gearing',
          'it improves upon Movement 45',
          'upper wheel A is shown in section',
          'upper wheel A contains a rubber disk',
          'the rubber disk has a V edge',
          'two metal plates clamp the rubber disk',
          'nut B holds the parts together',
          'tightening nut B expands the rubber disk radially',
          'radial expansion gives greater tractive power between the wheels',
        ],
        engravingEvidence:
          'The plate shows two parallel horizontal shafts, a small upper wheel in axial section, nut B at its threaded left end, two metal cheek plates around one dark V-edged insert, and a larger lower wheel whose opposed rims form the mating V groove.',
        reconstructionDisclosure:
          'Brown fixes the component topology, axial clamp action, radial rubber expansion, and increased traction but supplies no dimensions, screw lead, material law, speed, coefficient, force, or load. Constant rubber-volume scaling, the 0.8/1.2 effective pitch radii, a linear force proxy, three input turns, and all timing are independently engineered and exposed; the model does not claim quantitative rubber stress or torque capacity.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 413',
      relatedMovement: {
        id: 45,
        relation:
          'Brown explicitly calls 413 an improvement upon the rigid grooved friction gearing in Movement 45',
      },
    },
    stateAtTime,
    transmission: {
      effectivePitchContacts:
        'two symmetric mid-flank points at upper radius 0.8 and lower radius 1.2',
      noSlipRelation:
        'lower angular speed=-(upper pitch radius/lower pitch radius)*upper angular speed',
      outputToInputSpeedRatio: -upperPitchRadius / lowerPitchRadius,
      rubberVolumeRelation:
        'rubber width*(free tip radius)^2 is held constant by inverse-square-root radial scaling',
      threadRelation:
        'nut axial advance=thread lead*relative nut turns',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.72, -2.58, -1.54),
    new THREE.Vector3(2.62, 2.22, 1.54),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(-7.8, 4.5, 9.4);
  root.userData.groundFloorY = -2.58;
  markShadows(root);
  base.receiveShadow = true;
  contactIndicators.forEach((indicator) => {
    indicator.castShadow = false;
  });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredAdjustableFrictionGearMovement(movement) {
  if (movement.id !== 413) return null;
  return finishFrictionFamily(correctFriction413(adjustableFrictionGear(movement)), 413);
}
