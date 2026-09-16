import * as THREE from 'three';
import {correctHydraulicForceParts} from './hydraulic-force-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function robertsonJack(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12.4;
  const operationEndPhase = 0.64;
  const loweringStartPhase = 0.70;
  const loweringEndPhase = 0.88;
  const pumpCycleCount = 8;
  const maximumStrokeAngle = pumpCycleCount * FULL_TURN;
  const pumpLeverAmplitude = THREE.MathUtils.degToRad(20);
  const pumpLeverPivot = new THREE.Vector3(-1.32, 1.05, 0.78);
  const pumpLeverPinRadius = 0.42;
  const pumpSliderX = -0.90;
  const pumpPitmanLength = 0.72;
  const pumpPistonRodOffset = 0.50;
  const pumpPlungerRadius = 0.10;
  const fixedRamRadius = 0.42;
  const pumpPlungerArea = Math.PI * pumpPlungerRadius ** 2;
  const fixedRamArea = Math.PI * fixedRamRadius ** 2;
  const hydraulicAreaRatio = fixedRamArea / pumpPlungerArea;
  const baseWaterCapacity = 2.40;
  const baseInitialWaterVolume = 2.10;
  const fixedRamBaseY = -0.54;
  const fixedRamTopY = 1.46;
  const fixedRamHeight = fixedRamTopY - fixedRamBaseY;
  const movingCylinderBottomY = -0.20;
  const movingCylinderTopY = 1.72;
  const movingCylinderHeight = movingCylinderTopY - movingCylinderBottomY;
  const initialPressureChamberHeight = movingCylinderTopY - 0.16 - fixedRamTopY;
  const thumbScrewPitch = 0.045;
  const thumbScrewMaximumTurns = 1;
  const thumbScrewMaximumAngle = thumbScrewMaximumTurns * FULL_TURN;
  const thumbScrewMaximumRetreat = thumbScrewPitch
    * thumbScrewMaximumTurns;
  const groundY = -1.10;

  const pumpKinematics = (
    strokeAngle,
    strokeAngularVelocity = 0,
    strokeAngularAcceleration = 0,
  ) => {
    const leverAngle = pumpLeverAmplitude * Math.cos(strokeAngle);
    const leverAngularVelocity = -pumpLeverAmplitude
      * Math.sin(strokeAngle) * strokeAngularVelocity;
    const leverAngularAcceleration = -pumpLeverAmplitude * (
      Math.cos(strokeAngle) * strokeAngularVelocity ** 2
      + Math.sin(strokeAngle) * strokeAngularAcceleration
    );
    const cosine = Math.cos(leverAngle);
    const sine = Math.sin(leverAngle);
    const leverPin = new THREE.Vector3(
      pumpLeverPivot.x + pumpLeverPinRadius * cosine,
      pumpLeverPivot.y + pumpLeverPinRadius * sine,
      pumpLeverPivot.z,
    );
    const horizontalOffset = pumpSliderX - leverPin.x;
    const verticalDrop = Math.sqrt(Math.max(
      0,
      pumpPitmanLength ** 2 - horizontalOffset ** 2,
    ));
    const crosshead = new THREE.Vector3(
      pumpSliderX,
      leverPin.y - verticalDrop,
      pumpLeverPivot.z,
    );
    const piston = new THREE.Vector3(
      pumpSliderX,
      crosshead.y - pumpPistonRodOffset,
      pumpLeverPivot.z,
    );
    const offsetDerivative = pumpLeverPinRadius * sine;
    const offsetSecondDerivative = pumpLeverPinRadius * cosine;
    const product = horizontalOffset * offsetDerivative;
    const productDerivative = offsetDerivative ** 2
      + horizontalOffset * offsetSecondDerivative;
    const crossheadDerivativeByLeverAngle = pumpLeverPinRadius * cosine
      + product / verticalDrop;
    const crossheadSecondDerivativeByLeverAngle = -pumpLeverPinRadius * sine
      + productDerivative / verticalDrop
      + product ** 2 / verticalDrop ** 3;
    const pistonVelocity = crossheadDerivativeByLeverAngle
      * leverAngularVelocity;
    const pistonAcceleration = crossheadSecondDerivativeByLeverAngle
      * leverAngularVelocity ** 2
      + crossheadDerivativeByLeverAngle * leverAngularAcceleration;
    return {
      crosshead,
      crossheadDerivativeByLeverAngle,
      crossheadSecondDerivativeByLeverAngle,
      horizontalOffset,
      leverAngle,
      leverAngularAcceleration,
      leverAngularVelocity,
      leverPin,
      piston,
      pistonAcceleration,
      pistonVelocity,
      strokeAngle,
      strokeAngularAcceleration,
      strokeAngularVelocity,
      verticalDrop,
    };
  };

  const topPumpState = pumpKinematics(0);
  const bottomPumpState = pumpKinematics(Math.PI);
  const pumpStrokeLength = topPumpState.piston.y
    - bottomPumpState.piston.y;
  const maximumDeliveredVolume = pumpCycleCount
    * pumpPlungerArea * pumpStrokeLength;
  const maximumCylinderLift = maximumDeliveredVolume / fixedRamArea;
  const nominalPistonSpeed = pumpStrokeLength * 4.4;

  const deliveredLengthAtStrokeAngle = (unclampedStrokeAngle, pump) => {
    const strokeAngle = THREE.MathUtils.clamp(
      unclampedStrokeAngle,
      0,
      maximumStrokeAngle,
    );
    if (Math.abs(strokeAngle - maximumStrokeAngle) < 1e-10) {
      return pumpCycleCount * pumpStrokeLength;
    }
    const completedCycles = Math.floor(strokeAngle / FULL_TURN);
    const withinCycle = positiveModulo(strokeAngle, FULL_TURN);
    const currentDelivery = withinCycle <= Math.PI
      ? topPumpState.piston.y - pump.piston.y
      : pumpStrokeLength;
    return completedCycles * pumpStrokeLength + currentDelivery;
  };

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, operationEndPhase, loweringStartPhase,
      loweringEndPhase].find((boundary) =>
      Math.abs(rawPhase - boundary) < 1e-12) ?? rawPhase;
    let strokeAngle = maximumStrokeAngle;
    let strokeAngularVelocity = 0;
    let strokeAngularAcceleration = 0;
    let loweringProgress = 0;
    let loweringProgressRate = 0;
    let screwOpenAmount = 0;
    let regime;
    if (phase < operationEndPhase) {
      const local = phase / operationEndPhase;
      const timeScale = operationEndPhase * cycleDuration;
      strokeAngle = maximumStrokeAngle * smootherStep(local);
      strokeAngularVelocity = maximumStrokeAngle
        * smootherStepDerivative(local) / timeScale;
      strokeAngularAcceleration = maximumStrokeAngle
        * smootherStepSecondDerivative(local) / timeScale ** 2;
      regime = 'physical-pump-strokes-raise-cylinder-and-claw-on-fixed-ram';
    } else if (phase < loweringStartPhase) {
      regime = 'load-held-by-trapped-water-with-thumb-screw-seated';
    } else if (phase < loweringEndPhase) {
      const local = (phase - loweringStartPhase)
        / (loweringEndPhase - loweringStartPhase);
      const timeScale = (loweringEndPhase - loweringStartPhase)
        * cycleDuration;
      loweringProgress = smootherStep(local);
      loweringProgressRate = smootherStepDerivative(local) / timeScale;
      screwOpenAmount = loweringProgress;
      regime = 'thumb-screw-retracts-and-metered-return-lowers-moving-cylinder';
    } else {
      const local = (phase - loweringEndPhase) / (1 - loweringEndPhase);
      loweringProgress = 1;
      screwOpenAmount = 1 - smootherStep(local);
      regime = 'thumb-screw-reseats-after-cylinder-is-fully-lowered';
    }
    const pump = pumpKinematics(
      strokeAngle,
      strokeAngularVelocity,
      strokeAngularAcceleration,
    );
    const deliveredLength = deliveredLengthAtStrokeAngle(strokeAngle, pump);
    const cumulativeDeliveredVolume = pumpPlungerArea * deliveredLength;
    const retainedCylinderVolume = phase < loweringStartPhase
      ? cumulativeDeliveredVolume
      : maximumDeliveredVolume * (1 - loweringProgress);
    const cylinderLift = retainedCylinderVolume / fixedRamArea;
    const deliveryFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, -pump.pistonVelocity)
      : 0;
    const suctionFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, pump.pistonVelocity)
      : 0;
    const returnFlowRate = phase >= loweringStartPhase
      && phase < loweringEndPhase
      ? maximumDeliveredVolume * loweringProgressRate
      : 0;
    const cylinderVelocity = phase < operationEndPhase
      ? deliveryFlowRate / fixedRamArea
      : -returnFlowRate / fixedRamArea;
    const inletOpenAmount = smootherStep(
      Math.max(0, pump.pistonVelocity) / nominalPistonSpeed,
    );
    const deliveryOpenAmount = smootherStep(
      Math.max(0, -pump.pistonVelocity) / nominalPistonSpeed,
    );
    const thumbScrewAngle = thumbScrewMaximumAngle * screwOpenAmount;
    const thumbScrewRetreat = thumbScrewPitch
      * thumbScrewAngle / FULL_TURN;
    return {
      ...pump,
      baseWaterVolume: baseInitialWaterVolume - retainedCylinderVolume,
      cumulativeDeliveredVolume,
      cylinderLift,
      cylinderVelocity,
      deliveredLength,
      deliveryFlowRate,
      deliveryOpenAmount,
      inletOpenAmount,
      loweringProgress,
      loweringProgressRate,
      phase,
      pressureChamberHeight: initialPressureChamberHeight + cylinderLift,
      regime,
      retainedCylinderVolume,
      returnFlowRate,
      screwOpenAmount,
      suctionFlowRate,
      thumbScrewAngle,
      thumbScrewRetreat,
      volumeDisplacementResidual:
        retainedCylinderVolume - fixedRamArea * cylinderLift,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.48,
  });
  const fixedRamMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const movingMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.52,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.45,
  });
  const glassMaterial = matte(PALETTE.muted, {
    opacity: 0.25,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  glassMaterial.depthWrite = false;
  const movingShellMaterial = matte(PALETTE.driven, {
    opacity: 0.48,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  movingShellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.44,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 0.16, 3.0),
    frameMaterial,
  ), 'fixed-ground-plate-under-robertson-jack');
  foundation.position.set(0, groundY + 0.08, 0);
  root.add(foundation);

  const hollowBase = addRole(new THREE.Group(),
    'fixed-hollow-water-reservoir-base-supporting-stationary-ram');
  root.add(hollowBase);
  const baseShell = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.75, 0.72, 2.12),
    glassMaterial,
  ), 'transparent-hollow-base-shell');
  baseShell.position.set(0, -0.70, 0);
  hollowBase.add(baseShell);
  const baseWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.48, 1, 1.84),
    waterMaterial,
  ), 'water-reservoir-inside-hollow-base');
  hollowBase.add(baseWater);
  for (const y of [-1.04, -0.35]) {
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(2.90, 0.10, 2.24),
      frameMaterial,
    );
    rim.position.set(0, y, 0);
    hollowBase.add(rim);
  }

  const fixedRam = addRole(new THREE.Group(),
    'stationary-hollow-ram-fixed-rigidly-to-base');
  root.add(fixedRam);
  const fixedRamBody = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      fixedRamRadius,
      fixedRamRadius,
      fixedRamHeight,
      42,
      1,
      true,
      Math.PI * 0.22,
      Math.PI * 1.56,
    ),
    fixedRamMaterial,
  ), 'stationary-front-cutaway-hollow-ram-body');
  fixedRamBody.position.set(
    0,
    (fixedRamBaseY + fixedRamTopY) / 2,
    0,
  );
  fixedRam.add(fixedRamBody);
  const internalPressurePipe = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, fixedRamHeight + 0.14, 20),
    waterMaterial,
  ), 'water-pipe-running-up-inside-stationary-ram');
  internalPressurePipe.position.copy(fixedRamBody.position);
  fixedRam.add(internalPressurePipe);
  const ramBaseCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 0.20, 38),
    frameMaterial,
  );
  ramBaseCollar.position.set(0, fixedRamBaseY, 0);
  fixedRam.add(ramBaseCollar);

  const movingCylinder = addRole(new THREE.Group(),
    'moving-cylinder-top-saddle-and-side-claw-rigid-assembly');
  root.add(movingCylinder);
  const cylinderShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      fixedRamRadius + 0.12,
      fixedRamRadius + 0.12,
      movingCylinderHeight,
      44,
      1,
      true,
    ),
    movingShellMaterial,
  ), 'outer-cylinder-sliding-around-fixed-ram');
  cylinderShell.position.set(
    0,
    (movingCylinderBottomY + movingCylinderTopY) / 2,
    0,
  );
  movingCylinder.add(cylinderShell);
  const cylinderTopCap = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      fixedRamRadius + 0.12,
      fixedRamRadius + 0.12,
      0.16,
      42,
    ),
    movingMaterial,
  ), 'closed-moving-cylinder-cap-acted-on-by-water-pressure');
  cylinderTopCap.position.set(0, movingCylinderTopY - 0.08, 0);
  movingCylinder.add(cylinderTopCap);
  const cylinderSealBand = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(fixedRamRadius + 0.12, 0.055, 10, 44),
    brassMaterial,
  ), 'moving-cylinder-lower-guide-and-seal-band');
  cylinderSealBand.rotation.x = Math.PI / 2;
  cylinderSealBand.position.set(0, movingCylinderBottomY + 0.11, 0);
  movingCylinder.add(cylinderSealBand);
  const topSaddle = addRole(new THREE.Group(),
    'upper-saddle-attached-to-moving-cylinder');
  movingCylinder.add(topSaddle);
  const saddleStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.48, 0.92),
    movingMaterial,
  );
  saddleStem.position.set(0, 1.98, 0);
  topSaddle.add(saddleStem);
  for (const x of [-0.48, 0.48]) {
    const horn = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.50, 1.02),
      movingMaterial,
    );
    horn.position.set(x, 2.23, 0);
    horn.rotation.z = x < 0
      ? THREE.MathUtils.degToRad(-18)
      : THREE.MathUtils.degToRad(18);
    topSaddle.add(horn);
  }
  const sideClaw = addRole(new THREE.Group(),
    'right-side-lifting-claw-attached-to-moving-cylinder');
  movingCylinder.add(sideClaw);
  const clawArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 1.20, 0.68),
    movingMaterial,
  );
  clawArm.position.set(0.69, 0.86, 0);
  sideClaw.add(clawArm);
  const clawToe = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.22, 0.74),
    movingMaterial,
  );
  clawToe.position.set(0.98, 0.30, 0);
  sideClaw.add(clawToe);

  const pressureChamber = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      fixedRamRadius * 0.92,
      fixedRamRadius * 0.92,
      1,
      38,
    ),
    waterMaterial,
  ), 'variable-water-chamber-between-fixed-ram-top-and-moving-cap');
  root.add(pressureChamber);

  const pumpCylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpPlungerRadius + 0.07,
      pumpPlungerRadius + 0.07,
      0.58,
      30,
      1,
      true,
    ),
    glassMaterial,
  ), 'small-pump-cylinder-taking-water-from-hollow-base');
  pumpCylinder.position.set(pumpSliderX, 0.25, pumpLeverPivot.z);
  root.add(pumpCylinder);
  const pumpPiston = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpPlungerRadius,
      pumpPlungerRadius,
      0.09,
      26,
    ),
    fixedRamMaterial,
  ), 'small-hand-pump-plunger');
  root.add(pumpPiston);
  const pumpCrosshead = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.14, 0.30),
    fixedRamMaterial,
  ), 'small-pump-vertical-crosshead');
  root.add(pumpCrosshead);
  const pumpPitman = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 16),
    darkMaterial,
  ), 'fixed-length-pump-lever-pitman');
  root.add(pumpPitman);
  const pumpPistonRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.040, 0.040, 1, 16),
    darkMaterial,
  ), 'small-pump-plunger-rod');
  root.add(pumpPistonRod);

  const pumpLever = addRole(new THREE.Group(),
    'hand-pump-lever-operating-from-side-of-jack');
  pumpLever.position.copy(pumpLeverPivot);
  root.add(pumpLever);
  const leverBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.12, 0.18),
    fixedRamMaterial,
  );
  leverBar.position.x = 0.84;
  pumpLever.add(leverBar);
  const handle = addRole(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.10, 0.34, 4, 12),
    darkMaterial,
  ), 'long-hand-grip-on-pump-lever');
  handle.rotation.z = Math.PI / 2;
  handle.position.x = 2.15;
  pumpLever.add(handle);
  const pumpLeverPin = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.34, 20),
    brassMaterial,
  ), 'short-pump-lever-pin');
  pumpLeverPin.rotation.x = Math.PI / 2;
  pumpLeverPin.position.x = pumpLeverPinRadius;
  pumpLever.add(pumpLeverPin);
  const pumpLeverAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.46, 22),
    darkMaterial,
  ), 'fixed-pump-lever-fulcrum');
  pumpLeverAxle.rotation.x = Math.PI / 2;
  pumpLeverAxle.position.copy(pumpLeverPivot);
  root.add(pumpLeverAxle);
  const pumpStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 1.62, 0.28),
    frameMaterial,
  );
  pumpStand.position.set(pumpLeverPivot.x, 0.22, pumpLeverPivot.z - 0.24);
  root.add(pumpStand);

  const inletValve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.04, 22),
    brassMaterial,
  ), 'functional-base-reservoir-to-pump-inlet-check-disk');
  inletValve.position.set(pumpSliderX, -0.05, pumpLeverPivot.z);
  root.add(inletValve);
  const deliveryValve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.04, 22),
    brassMaterial,
  ), 'functional-pump-to-internal-ram-pipe-delivery-check-disk');
  deliveryValve.position.set(-0.56, -0.15, pumpLeverPivot.z);
  root.add(deliveryValve);

  const thumbScrew = addRole(new THREE.Group(),
    'threaded-thumb-screw-metering-return-at-bottom-of-ram-pipe');
  thumbScrew.position.set(-0.62, -0.63, 1.17);
  root.add(thumbScrew);
  const screwShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.76, 22),
    brassMaterial,
  ), 'thumb-screw-threaded-shaft');
  screwShaft.rotation.z = Math.PI / 2;
  thumbScrew.add(screwShaft);
  const threadCurve = new THREE.CatmullRomCurve3(
    Array.from({ length: 49 }, (_, index) => {
      const fraction = index / 48;
      const angle = fraction * FULL_TURN * 4;
      return new THREE.Vector3(
        -0.30 + 0.60 * fraction,
        0.086 * Math.cos(angle),
        0.086 * Math.sin(angle),
      );
    }),
  );
  const screwThread = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(threadCurve, 96, 0.012, 7, false),
    darkMaterial,
  ), 'visible-four-turn-helical-thumb-screw-thread');
  thumbScrew.add(screwThread);
  const screwTip = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.105, 0.24, 24),
    brassMaterial,
  ), 'thumb-screw-conical-return-valve-tip');
  screwTip.rotation.z = -Math.PI / 2;
  screwTip.position.x = 0.47;
  thumbScrew.add(screwTip);
  const screwWings = [-1, 1].map((sign, index) => {
    const wing = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 20, 14),
      fixedRamMaterial,
    ), index === 0 ? 'thumb-screw-wing-one' : 'thumb-screw-wing-two');
    wing.position.set(-0.47, sign * 0.24, 0);
    thumbScrew.add(wing);
    return wing;
  });
  const screwWingBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.48, 16),
    fixedRamMaterial,
  );
  screwWingBar.position.x = -0.47;
  thumbScrew.add(screwWingBar);

  const returnCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, fixedRamBaseY + 0.10, 0),
    new THREE.Vector3(-0.30, -0.56, 0.36),
    new THREE.Vector3(-0.55, -0.63, 0.82),
    new THREE.Vector3(-0.84, -0.72, 1.03),
  ]);
  const returnPassage = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(returnCurve, 36, 0.075, 10, false),
    frameMaterial,
  ), 'return-passage-from-ram-pipe-valve-to-hollow-base');
  root.add(returnPassage);
  const returnWaterMaterial = waterMaterial.clone();
  const returnWater = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(returnCurve, 36, 0.040, 8, false),
    returnWaterMaterial,
  ), 'metered-return-water-through-open-thumb-screw-valve');
  root.add(returnWater);

  const update = (time) => {
    const state = stateAtTime(time);
    pumpLever.rotation.z = state.leverAngle;
    pumpCrosshead.position.copy(state.crosshead);
    pumpPiston.position.copy(state.piston);
    setRodBetween(pumpPitman, state.leverPin, state.crosshead);
    setRodBetween(pumpPistonRod, state.crosshead, state.piston);
    inletValve.position.y = -0.82 + 0.065 * state.inletOpenAmount;
    deliveryValve.position.y = -0.43 + 0.065 * state.deliveryOpenAmount;
    movingCylinder.position.y = state.cylinderLift;
    pressureChamber.scale.y = state.pressureChamberHeight;
    pressureChamber.position.set(
      0,
      fixedRamTopY + state.pressureChamberHeight / 2,
      0,
    );
    const baseWaterHeight = 0.52 * state.baseWaterVolume
      / baseInitialWaterVolume;
    baseWater.scale.y = baseWaterHeight;
    baseWater.position.set(0, -1.00 + baseWaterHeight / 2, 0);
    thumbScrew.rotation.x = state.thumbScrewAngle;
    thumbScrew.position.x = -1.25 - state.thumbScrewRetreat;
    root.userData.updateSolids?.(state);
    returnWater.visible = state.returnFlowRate > 1e-5;
    returnWaterMaterial.opacity = 0.16 + 0.50 * state.screwOpenAmount;
  };

  const sourceState = stateAtPhase(0.48);
  const geometry = {
    baseInitialWaterVolume,
    baseWaterCapacity,
    cycleDuration,
    fixedRamArea,
    fixedRamBaseY,
    fixedRamHeight,
    fixedRamRadius,
    fixedRamTopY,
    groundY,
    hydraulicAreaRatio,
    initialPressureChamberHeight,
    loweringEndPhase,
    loweringStartPhase,
    maximumCylinderLift,
    maximumDeliveredVolume,
    maximumStrokeAngle,
    movingCylinderBottomY,
    movingCylinderHeight,
    movingCylinderTopY,
    nominalPistonSpeed,
    operationEndPhase,
    pumpCycleCount,
    pumpLeverAmplitude,
    pumpLeverPinRadius,
    pumpLeverPivot,
    pumpPistonRodOffset,
    pumpPitmanLength,
    pumpPlungerArea,
    pumpPlungerRadius,
    pumpSliderX,
    pumpStrokeLength,
    thumbScrewMaximumAngle,
    thumbScrewMaximumRetreat,
    thumbScrewMaximumTurns,
    thumbScrewPitch,
  };
  root.userData = {
    archetype:
      'robertson-hydrostatic-jack-with-fixed-hollow-ram-rising-cylinder-claw-internal-feed-and-thumb-screw-return',
    blocks: {
      baseShell,
      baseWater,
      cylinderSealBand,
      cylinderShell,
      cylinderTopCap,
      deliveryValve,
      fixedRam,
      fixedRamBody,
      foundation,
      handle,
      hollowBase,
      inletValve,
      internalPressurePipe,
      movingCylinder,
      pressureChamber,
      pumpCrosshead,
      pumpCylinder,
      pumpLever,
      pumpLeverAxle,
      pumpPiston,
      pumpPistonRod,
      pumpPitman,
      returnPassage,
      returnWater,
      screwShaft,
      screwThread,
      screwTip,
      screwWings,
      sideClaw,
      thumbScrew,
      topSaddle,
    },
    degreesOfFreedom: {
      cylinderAndClawIndependent: false,
      fixedRamTranslates: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      thumbScrewReturnScheduledAfterPumping: true,
    },
    deliveredLengthAtStrokeAngle,
    dynamics: {
      compressibilitySealLeakageLoadMassFrictionValveImpactPipeLossesAndStructuralDeflectionModeled:
        false,
      loweringModel:
        'One full thumb-screw turn retracts the conical tip by one thread pitch while the trapped volume returns with a C2 metered profile. After lowering, the unloaded screw turns back onto its seat before the loop closes.',
      volumeModel:
        'Downward small-plunger travel adds A_pump times travel to the chamber above the stationary ram; the complete moving cylinder and claw assembly rises by that volume divided by fixed-ram area.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The central hollow ram is rigidly fixed to the water-filled base. A hand pump draws from that hollow base and delivers through a passage running inside the ram into the chamber beneath the closed cap of the outer cylinder. Pressure raises the cylinder, top saddle and side claw as one rigid assembly around the stationary ram. Turning the bottom thumb-screw off its seat meters the same water back into the base and gradually lowers the assembly.',
    motion: {
      cycleDuration,
      motionType:
        'eight-volume-accumulating-pump-strokes-hold-one-turn-threaded-metered-lowering-and-screw-reseat',
    },
    pumpKinematics,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      cylinderLift: sourceState.cylinderLift,
      leverAngle: sourceState.leverAngle,
      pistonPosition: sourceState.piston.clone(),
      thumbScrewAngle: sourceState.thumbScrewAngle,
    },
    sourceReference: {
      brownPlate467: {
        approximateHollowBaseBoundsPixels: [209, 419, 131, 83],
        approximateMovingCylinderAndClawBoundsPixels: [204, 57, 185, 372],
        approximatePumpLinkageBoundsPixels: [130, 328, 113, 126],
        approximateThumbScrewBoundsPixels: [177, 438, 105, 44],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the ram is stationary upon a hollow base',
          'the cylinder and attached claw slide upon the ram',
          'the pump takes water from the hollow base',
          'water is forced through a pipe inside the ram into the cylinder',
          'a bottom thumb-screw valve lets water back to lower gradually',
        ],
        engravingEvidence:
          'Brown shows a broad hollow base, a central fixed inner member with an internal passage, a tall outer sliding body carrying both an upper saddle and side claw, an offset pump linkage, and a winged horizontal return screw at the internal pipe foot.',
        reconstructionDisclosure:
          'Brown gives no dimensions, area ratio, stroke, pump count, thread pitch, screw turns, return coefficient, load or timing. A 4.2:1 radius ratio, eight exact pump strokes, one 0.045-pitch screw turn, C2 metered lowering and reseating, colors and a 12.4-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 467',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      internalFeed:
        'hollow base reservoir -> small pump checks -> pipe inside fixed ram -> variable chamber under moving cylinder cap',
      movingMembers:
        'outer cylinder + upper saddle + side claw share exactly one translation; fixed ram and base remain stationary',
      screw:
        'axial retreat=pitch*rotation/(2*pi); opening meters chamber water back to the hollow base',
      volume:
        'A_pump*sum(delivery downstrokes)=A_fixed_ram*cylinder lift',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.08, groundY - 0.02, -1.58),
    new THREE.Vector3(3.08, 2.82, 1.58),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(4.8, 2.8, 11.8);
  root.userData.groundFloorY = groundY;
  correctHydraulicForceParts(root,467);
  markShadows(root);
  foundation.receiveShadow = true;
  for (const object of [baseWater, internalPressurePipe, pressureChamber,
    returnWater]) object.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredRobertsonJackMovement(movement) {
  if (movement.id !== 467) return null;
  return robertsonJack(movement);
}
