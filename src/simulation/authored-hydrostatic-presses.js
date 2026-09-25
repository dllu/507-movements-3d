import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
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

function hydrostaticPress(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12.5;
  const operationEndPhase = 0.76;
  const reliefStartPhase = 0.84;
  const pumpCycleCount = 10;
  const maximumStrokeAngle = pumpCycleCount * FULL_TURN;
  const pumpLeverAmplitude = THREE.MathUtils.degToRad(20);
  const pumpLeverPivot = new THREE.Vector3(1.10, 2.12, 0);
  const pumpLeverPinRadius = 0.55;
  const pumpSliderX = 1.65;
  const pumpPitmanLength = 1.25;
  const pumpPistonRodOffset = 0.80;
  const pumpPlungerRadius = 0.144;
  const ramRadius = 0.72;
  const diameterRatio = ramRadius / pumpPlungerRadius;
  const pumpPlungerArea = Math.PI * pumpPlungerRadius ** 2;
  const ramArea = Math.PI * ramRadius ** 2;
  const areaRatio = ramArea / pumpPlungerArea;
  const nominalInputForce = 120;
  const idealRamForce = nominalInputForce * areaRatio;
  const idealHydraulicPressure = nominalInputForce / pumpPlungerArea;
  const ramCylinderBottomY = -1.28;
  const ramCylinderTopY = 0.28;
  const ramCylinderHeight = ramCylinderTopY - ramCylinderBottomY;
  const ramAxisX = -1.35;
  const initialPlatenY = 1.34;
  const fixedHeadUndersideY = 2.63;
  const initialLoadHeight = fixedHeadUndersideY - initialPlatenY - 0.10;
  const pumpCylinderBottomY = -0.53;
  const pumpCylinderTopY = 0.37;
  const reservoirSurfaceY = 0.18;
  const groundY = -1.52;
  const brownExamplePumpDiameter = 1;
  const brownExampleRamDiameter = 30;
  const brownExampleForceRatio = (
    brownExampleRamDiameter / brownExamplePumpDiameter
  ) ** 2;

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
      0,
    );
    const horizontalOffset = pumpSliderX - leverPin.x;
    const verticalDrop = Math.sqrt(Math.max(
      0,
      pumpPitmanLength ** 2 - horizontalOffset ** 2,
    ));
    const crosshead = new THREE.Vector3(
      pumpSliderX,
      leverPin.y - verticalDrop,
      0,
    );
    const piston = new THREE.Vector3(
      pumpSliderX,
      crosshead.y - pumpPistonRodOffset,
      0,
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
  const maximumRamLift = maximumDeliveredVolume / ramArea;
  const nominalPistonSpeed = pumpStrokeLength * 4.2;

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
    const phase = [0, operationEndPhase, reliefStartPhase].find(
      (boundary) => Math.abs(rawPhase - boundary) < 1e-12,
    ) ?? rawPhase;
    let strokeAngle = maximumStrokeAngle;
    let strokeAngularVelocity = 0;
    let strokeAngularAcceleration = 0;
    let reliefProgress = 0;
    let reliefProgressRate = 0;
    let regime;
    if (phase < operationEndPhase) {
      const local = phase / operationEndPhase;
      const timeScale = operationEndPhase * cycleDuration;
      strokeAngle = maximumStrokeAngle * smootherStep(local);
      strokeAngularVelocity = maximumStrokeAngle
        * smootherStepDerivative(local) / timeScale;
      strokeAngularAcceleration = maximumStrokeAngle
        * smootherStepSecondDerivative(local) / timeScale ** 2;
      regime = 'physical-hand-pumping-and-stepwise-ram-rise';
    } else if (phase < reliefStartPhase) {
      regime = 'press-held-at-full-lift-with-all-pump-checks-seated';
    } else {
      const local = (phase - reliefStartPhase) / (1 - reliefStartPhase);
      const timeScale = (1 - reliefStartPhase) * cycleDuration;
      reliefProgress = smootherStep(local);
      reliefProgressRate = smootherStepDerivative(local) / timeScale;
      regime = 'modeled-relief-valve-return-lowers-ram-to-reservoir';
    }
    const pump = pumpKinematics(
      strokeAngle,
      strokeAngularVelocity,
      strokeAngularAcceleration,
    );
    const deliveredLength = deliveredLengthAtStrokeAngle(strokeAngle, pump);
    const cumulativeDeliveredVolume = pumpPlungerArea * deliveredLength;
    const retainedPressVolume = phase < reliefStartPhase
      ? cumulativeDeliveredVolume
      : maximumDeliveredVolume * (1 - reliefProgress);
    const ramLift = retainedPressVolume / ramArea;
    const deliveryFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, -pump.pistonVelocity)
      : 0;
    const suctionFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, pump.pistonVelocity)
      : 0;
    const reliefReturnFlowRate = phase >= reliefStartPhase
      ? maximumDeliveredVolume * reliefProgressRate
      : 0;
    const ramVelocity = phase < operationEndPhase
      ? deliveryFlowRate / ramArea
      : -reliefReturnFlowRate / ramArea;
    const inletOpenAmount = smootherStep(
      Math.max(0, pump.pistonVelocity) / nominalPistonSpeed,
    );
    const deliveryOpenAmount = smootherStep(
      Math.max(0, -pump.pistonVelocity) / nominalPistonSpeed,
    );
    return {
      ...pump,
      cumulativeDeliveredVolume,
      deliveredLength,
      deliveryFlowRate,
      deliveryOpenAmount,
      idealHydraulicPressure,
      idealRamForce,
      inletOpenAmount,
      loadCompression: ramLift,
      phase,
      ramLift,
      ramVelocity,
      regime,
      reliefOpenAmount: reliefProgress,
      reliefProgress,
      reliefProgressRate,
      reliefReturnFlowRate,
      reservoirVolumeChange: -retainedPressVolume,
      retainedPressVolume,
      suctionFlowRate,
      volumeDisplacementResidual:
        retainedPressVolume - ramArea * ramLift,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const pumpMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.55,
  });
  const ramMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.20,
    roughness: 0.46,
  });
  const glassMaterial = matte(PALETTE.muted, {
    opacity: 0.25,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  glassMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.44,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const loadMaterial = matte(PALETTE.accent, {
    roughness: 0.80,
  });

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.1, 0.16, 3.2),
    frameMaterial,
  ), 'fixed-foundation-under-hydrostatic-press-and-hand-pump');
  foundation.position.set(0, groundY + 0.08, 0);
  root.add(foundation);

  const pressFrame = addRole(new THREE.Group(),
    'fixed-two-column-frame-reacting-large-ram-force');
  root.add(pressFrame);
  for (const x of [-2.55, -0.15]) {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 4.05, 0.38),
      frameMaterial,
    );
    column.position.set(x, 0.63, -0.10);
    pressFrame.add(column);
  }
  const fixedHead = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.86, 0.34, 1.70),
    frameMaterial,
  ), 'fixed-upper-press-head');
  fixedHead.position.set(ramAxisX, fixedHeadUndersideY + 0.17, 0);
  pressFrame.add(fixedHead);

  const ramCylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      ramRadius + 0.09,
      ramRadius + 0.09,
      ramCylinderHeight,
      48,
      1,
      true,
    ),
    glassMaterial,
  ), 'large-water-filled-ram-cylinder');
  ramCylinder.position.set(
    ramAxisX,
    (ramCylinderBottomY + ramCylinderTopY) / 2,
    0,
  );
  root.add(ramCylinder);
  const ramCylinderWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(ramRadius, ramRadius, ramCylinderHeight, 44),
    waterMaterial,
  ), 'pressurized-water-under-large-solid-ram');
  ramCylinderWater.position.copy(ramCylinder.position);
  root.add(ramCylinderWater);
  const ramAssembly = addRole(new THREE.Group(),
    'large-solid-ram-and-moving-lower-platen');
  root.add(ramAssembly);
  const ramPiston = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(ramRadius, ramRadius, 0.18, 42),
    ramMaterial,
  ), 'large-solid-ram-piston');
  ramPiston.position.set(ramAxisX, -0.04, 0);
  ramAssembly.add(ramPiston);
  const ramRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 1.40, 38),
    ramMaterial,
  ), 'large-solid-ram-body');
  ramRod.position.set(ramAxisX, 0.66, 0);
  ramAssembly.add(ramRod);
  const movingPlaten = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.34, 0.20, 1.52),
    ramMaterial,
  ), 'moving-lower-press-platen');
  movingPlaten.position.set(ramAxisX, initialPlatenY, 0);
  ramAssembly.add(movingPlaten);

  const compressibleLoad = addRole(new THREE.Group(),
    'load-compressed-between-moving-platen-and-fixed-head');
  root.add(compressibleLoad);
  for (const y of [-0.29, 0.29]) {
    const bale = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.52, 1.18, 4, 2, 2),
      loadMaterial,
    );
    bale.position.y = y;
    compressibleLoad.add(bale);
  }

  const pumpReservoir = addRole(new THREE.Group(),
    'open-water-reservoir-feeding-small-hand-pump');
  root.add(pumpReservoir);
  const reservoirWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 0.72, 0.62),
    waterMaterial,
  ), 'hand-pump-reservoir-water');
  // Brown rules the reservoir water on the section plane behind the pump; the
  // sheet stands behind the half-section barrel, so no water column is
  // drawn over the pump, its checks or its plunger.
  reservoirWater.position.set(1.70, -0.24, -0.57);
  pumpReservoir.add(reservoirWater);
  for (const x of [0.62, 2.78]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.10, 1.92),
      frameMaterial,
    );
    wall.position.set(x, -0.01, 0);
    pumpReservoir.add(wall);
  }
  // Brown draws the reservoir in section: only its back wall stands behind the pump.
  for (const z of [-0.96]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(2.32, 1.10, 0.16),
      frameMaterial,
    );
    wall.position.set(1.70, -0.01, z);
    pumpReservoir.add(wall);
  }

  const pumpCylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpPlungerRadius + 0.08,
      pumpPlungerRadius + 0.08,
      pumpCylinderTopY - pumpCylinderBottomY,
      32,
      1,
      true,
    ),
    glassMaterial,
  ), 'small-hand-pump-cylinder');
  pumpCylinder.position.set(
    pumpSliderX,
    (pumpCylinderBottomY + pumpCylinderTopY) / 2,
    0,
  );
  root.add(pumpCylinder);
  const pumpPiston = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      pumpPlungerRadius,
      pumpPlungerRadius,
      0.11,
      28,
    ),
    pumpMaterial,
  ), 'small-pump-plunger');
  root.add(pumpPiston);
  const pumpCrosshead = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.16, 0.34),
    pumpMaterial,
  ), 'small-pump-vertical-crosshead');
  root.add(pumpCrosshead);
  const pumpPistonRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 18),
    darkMaterial,
  ), 'small-pump-plunger-rod');
  root.add(pumpPistonRod);
  const pumpPitman = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1, 18),
    darkMaterial,
  ), 'fixed-length-hand-lever-to-plunger-pitman');
  root.add(pumpPitman);

  const pumpLever = addRole(new THREE.Group(),
    'human-operated-hand-lever');
  pumpLever.position.copy(pumpLeverPivot);
  root.add(pumpLever);
  const leverBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.13, 0.20),
    pumpMaterial,
  );
  leverBar.position.x = 0.85;
  pumpLever.add(leverBar);
  const leverHandle = addRole(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.10, 0.34, 4, 12),
    darkMaterial,
  ), 'hand-grip-at-long-end-of-pump-lever');
  leverHandle.rotation.z = Math.PI / 2;
  leverHandle.position.x = 2.20;
  pumpLever.add(leverHandle);
  const leverPin = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.42, 22),
    brassMaterial,
  ), 'short-end-lever-to-pitman-pin');
  leverPin.rotation.x = Math.PI / 2;
  leverPin.position.x = pumpLeverPinRadius;
  pumpLever.add(leverPin);
  const leverAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.58, 24),
    darkMaterial,
  ), 'fixed-hand-lever-fulcrum');
  leverAxle.rotation.x = Math.PI / 2;
  leverAxle.position.copy(pumpLeverPivot);
  root.add(leverAxle);
  const leverStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 2.25, 0.34),
    frameMaterial,
  );
  leverStand.position.set(pumpLeverPivot.x, 1.00, -0.38);
  root.add(leverStand);

  const inletValve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.045, 24),
    brassMaterial,
  ), 'functional-small-pump-reservoir-inlet-check-disk');
  inletValve.position.set(pumpSliderX, pumpCylinderBottomY + 0.08, 0);
  root.add(inletValve);
  const deliveryValve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.045, 24),
    brassMaterial,
  ), 'functional-small-pump-pressure-delivery-check-disk');
  // The delivery check chamber stands clear of the pump barrel's outer wall.
  deliveryValve.position.set(pumpSliderX - 0.46, pumpCylinderBottomY + 0.13, 0);
  root.add(deliveryValve);
  const reliefValve = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24),
    pumpMaterial,
  ), 'modeled-relief-return-valve-for-lowering-press');
  reliefValve.position.set(0.52, 0.42, 0);
  root.add(reliefValve);

  const pressureCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(pumpSliderX - 0.20, 0.42, 0),
    new THREE.Vector3(0.82, 0.42, 0),
    new THREE.Vector3(0.18, -0.18, 0),
    new THREE.Vector3(ramAxisX, -0.72, 0),
  ]);
  const pressurePipe = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pressureCurve, 64, 0.10, 12, false),
    frameMaterial,
  ), 'small-pressure-pipe-from-pump-to-large-ram-cylinder');
  root.add(pressurePipe);
  const pressureWater = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pressureCurve, 64, 0.055, 10, false),
    waterMaterial,
  ), 'pressurized-water-column-linking-small-and-large-cylinders');
  root.add(pressureWater);
  const inletWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.42, 18),
    waterMaterial.clone(),
  ), 'active-reservoir-water-entering-small-pump-on-suction-stroke');
  inletWater.position.set(pumpSliderX, 0.14, 0);
  root.add(inletWater);
  const reliefWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.060, 0.060, 0.42, 18),
    waterMaterial.clone(),
  ), 'active-return-water-from-relief-valve-to-reservoir');
  reliefWater.position.set(0.72, 0.18, 0);
  reliefWater.rotation.z = Math.PI / 2;
  root.add(reliefWater);

  const update = (time) => {
    const state = stateAtTime(time);
    pumpLever.rotation.z = state.leverAngle;
    pumpCrosshead.position.copy(state.crosshead);
    pumpPiston.position.copy(state.piston);
    setRodBetween(pumpPitman, state.leverPin, state.crosshead);
    setRodBetween(pumpPistonRod, state.crosshead, state.piston);
    inletValve.position.y = pumpCylinderBottomY + 0.08
      + 0.07 * state.inletOpenAmount;
    deliveryValve.position.y = -0.15
      + 0.07 * state.deliveryOpenAmount;
    reliefValve.position.y = 0.42 + 0.10 * state.reliefOpenAmount;
    inletWater.visible = state.inletOpenAmount > 1e-4;
    reliefWater.visible = state.reliefOpenAmount > 1e-4;
    ramAssembly.position.y = state.ramLift;
    root.userData.updateSolids?.(state);
    const currentLoadHeight = initialLoadHeight - state.loadCompression;
    compressibleLoad.scale.y = currentLoadHeight / initialLoadHeight;
    compressibleLoad.position.set(
      ramAxisX,
      initialPlatenY + 0.10 + state.ramLift
        + currentLoadHeight / 2,
      0,
    );
  };

  const sourceState = stateAtPhase(0.47);
  const geometry = {
    areaRatio,
    brownExampleForceRatio,
    brownExamplePumpDiameter,
    brownExampleRamDiameter,
    cycleDuration,
    diameterRatio,
    fixedHeadUndersideY,
    groundY,
    idealHydraulicPressure,
    idealRamForce,
    initialLoadHeight,
    initialPlatenY,
    maximumDeliveredVolume,
    maximumRamLift,
    maximumStrokeAngle,
    nominalInputForce,
    nominalPistonSpeed,
    operationEndPhase,
    pumpCycleCount,
    pumpCylinderBottomY,
    pumpCylinderTopY,
    pumpLeverAmplitude,
    pumpLeverPinRadius,
    pumpLeverPivot,
    pumpPistonRodOffset,
    pumpPitmanLength,
    pumpPlungerArea,
    pumpPlungerRadius,
    pumpSliderX,
    pumpStrokeLength,
    ramArea,
    ramAxisX,
    ramCylinderBottomY,
    ramCylinderHeight,
    ramCylinderTopY,
    ramRadius,
    reliefStartPhase,
    reservoirSurfaceY,
  };
  root.userData = {
    archetype:
      'hand-pumped-hydrostatic-press-with-pascal-area-force-ratio-volume-displacement-and-relief-return',
    blocks: {
      compressibleLoad,
      deliveryValve,
      fixedHead,
      foundation,
      inletValve,
      inletWater,
      leverAxle,
      movingPlaten,
      pressFrame,
      pressurePipe,
      pressureWater,
      pumpCrosshead,
      pumpCylinder,
      pumpLever,
      pumpPitman,
      pumpPiston,
      pumpPistonRod,
      pumpReservoir,
      ramAssembly,
      ramCylinder,
      ramCylinderWater,
      ramPiston,
      ramRod,
      reliefValve,
      reliefWater,
      reservoirWater,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pumpAndRamIndependent: false,
      reliefReturnScheduledAfterPumping: true,
    },
    dynamics: {
      compressibilityPipeExpansionSealLeakageValveImpactFrictionStructuralDeflectionAndLoadConstitutiveLawModeled:
        false,
      forceModel:
        'Ideal Pascal pressure is uniform: p=F_pump/A_pump and F_ram=p*A_ram. The visible 5:1 diameter ratio gives exactly 25:1 force multiplication; Brown’s textual 1:30 example gives 900:1.',
      resetModel:
        'After ten complete physical pump cycles and a hold, an explicitly modeled relief valve returns the displaced water to the reservoir and lowers the ram with a C2 profile.',
      volumeModel:
        'Every downward plunger increment displaces A_pump times travel into the large cylinder, whose ram rises by that volume divided by A_ram. Suction strokes refill the small cylinder without raising the ram.',
    },
    deliveredLengthAtStrokeAngle,
    fidelity: 'authored',
    geometry,
    mechanism:
      'A hand lever reciprocates the small pump plunger through one fixed-length pitman. Upstrokes open only the reservoir inlet check; downstrokes open only the pressure delivery check and force water through the small pipe beneath the large solid ram. Uniform hydraulic pressure multiplies force by the piston-area ratio while reducing ram travel by the same ratio. A separate relief return lowers the completed press cycle.',
    motion: {
      cycleDuration,
      motionType:
        'ten exact lever-pump cycles-with-volume-accumulating-slow-ram-rise-hold-and-C2-relief-return',
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
      leverAngle: sourceState.leverAngle,
      pistonPosition: sourceState.piston.clone(),
      ramLift: sourceState.ramLift,
      retainedPressVolume: sourceState.retainedPressVolume,
    },
    sourceReference: {
      brownPlate466: {
        approximateHandLeverBoundsPixels: [307, 134, 203, 71],
        approximateLargeRamCylinderBoundsPixels: [82, 282, 207, 230],
        approximatePressFrameBoundsPixels: [28, 58, 221, 404],
        approximatePumpCylinderBoundsPixels: [334, 189, 65, 223],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a pump forces water through a small pipe into the ram cylinder',
          'water pressure beneath the solid ram raises it',
          'force gain is proportional to piston areas or squared diameters',
          'a one-inch pump and thirty-inch ram give nine-hundred-fold force',
        ],
        engravingEvidence:
          'Brown shows a small lever pump standing in an open right reservoir, two check-valve locations, a narrow connecting pressure pipe, a much larger left ram cylinder, a solid rising ram and platen, a compressed load, and a fixed two-column reaction frame.',
        reconstructionDisclosure:
          'Brown gives no depicted diameters, strokes, lever geometry, check-valve lift, pump count, speed, load stiffness, relief sequence or timing. A visible 5:1 diameter ratio, ten strokes, exact pitman closure, ideal Pascal and volume relations, a modeled relief return, colors and a 12.5-second cycle are independently engineered; Brown’s 1:30 example is retained separately and exactly.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 466',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      force:
        'F_ram/F_pump=A_ram/A_pump=(D_ram/D_pump)^2',
      leverLinkage:
        'The small plunger stays on one vertical slider and one exact fixed-length pitman connects it to the short hand-lever pin.',
      volume:
        'A_pump*sum(delivery downstrokes)=A_ram*ram lift',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.64, groundY - 0.02, -1.68),
    new THREE.Vector3(3.64, 3.20, 1.68),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.0, 2.9, 12.2);
  // Brown's sectional elevation, near-orthographic (camera in source-presentation).
  root.userData.cameraFov = 10;
  root.userData.groundFloorY = groundY;
  correctHydraulicForceParts(root,466);
  {
    // Brown stands the pump cistern on the same ground as the press: carry
    // its three walls down to the foot of the press columns and close it
    // with a floor, the water filling it from that floor.
    const floorY = 0.63 - 4.05 / 2;
    const wallBottomY = -0.56;
    const extension = (sizeX, sizeZ, x, z) => {
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(sizeX, wallBottomY - floorY, sizeZ), frameMaterial);
      piece.position.set(x, (wallBottomY + floorY) / 2, z);
      piece.userData.role = 'fixed-lower-wall-of-pump-cistern';
      pumpReservoir.add(piece);
    };
    extension(0.16, 1.92, 0.62, 0);
    extension(0.16, 1.92, 2.78, 0);
    extension(2.32, 0.16, 1.70, -0.96);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.12, 1.92), frameMaterial);
    floor.position.set(1.70, floorY + 0.06, 0);
    floor.userData.role = 'fixed-floor-of-pump-cistern';
    pumpReservoir.add(floor);
    const waterTop = reservoirWater.position.y + 0.36;
    reservoirWater.geometry.dispose();
    reservoirWater.geometry = new THREE.BoxGeometry(2.05, waterTop - floorY - 0.12, 0.62);
    reservoirWater.position.y = (waterTop + floorY + 0.12) / 2;
  }
  markShadows(root);
  foundation.receiveShadow = true;
  for (const object of [ramCylinderWater, reservoirWater, pressureWater,
    inletWater, reliefWater]) object.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredHydrostaticPressMovement(movement) {
  if (movement.id !== 466) return null;
  return applyCutawayFor(hydrostaticPress(movement), movement.id);
}
