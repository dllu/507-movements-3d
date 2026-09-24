import * as THREE from 'three';
import {correctFountain,fountainBowlLevel} from './fountain-balance-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

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

function heronsFountain(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12.5;
  const operationEndPhase = 0.72;
  const resetStartPhase = 0.80;
  const atmosphericPressure = 101325;
  const waterDensity = 1000;
  const gravitationalAcceleration = 9.81;
  const initialPressureRatio = 1.22;
  const intermediateInnerRadius = 0.90;
  const intermediateBottomY = 2.00;
  const intermediateInnerHeight = 1.20;
  const intermediateCapacity = 2.60 * 1.55 * (3.73 - .77);
  const intermediateInitialWaterVolume = 2.00;
  const lowerInnerLength = 4.10;
  const lowerInnerWidth = 1.45;
  const lowerInnerHeight = 0.62;
  const lowerArea = lowerInnerLength * lowerInnerWidth;
  const lowerBottomY = 0.05;
  const lowerCapacity = lowerArea * lowerInnerHeight;
  const lowerInitialWaterVolume = 1.40;
  const topInnerLength = 4.20;
  const topInnerWidth = 1.35;
  const topArea = topInnerLength * topInnerWidth;
  const topBasinBottomY = 3.85;
  const topWaterVolume = 1.05;
  const nozzleY = 4.40;
  const lowerTransfer = 0.32;
  const intermediateTransfer = 0.24;
  const externalPourTransfer = lowerTransfer - intermediateTransfer;
  const initialLowerGasVolume = lowerCapacity - lowerInitialWaterVolume;
  const initialIntermediateGasVolume = intermediateCapacity
    - intermediateInitialWaterVolume;
  const initialSharedGasVolume = initialLowerGasVolume
    + initialIntermediateGasVolume;
  const initialSharedGasPressure = atmosphericPressure * initialPressureRatio;
  const sharedGasPVConstant = initialSharedGasPressure
    * initialSharedGasVolume;
  const groundY = -0.18;

  const stateAtTransferProgress = (unclampedProgress) => {
    const transferProgress = THREE.MathUtils.clamp(unclampedProgress, 0, 1);
    const drainTransferVolume = lowerTransfer * transferProgress;
    const jetTransferVolume = intermediateTransfer * transferProgress;
    const externallyPouredVolume = externalPourTransfer * transferProgress;
    const lowerWaterVolume = lowerInitialWaterVolume + drainTransferVolume;
    const intermediateWaterVolume = intermediateInitialWaterVolume
      - jetTransferVolume;
    const upperWaterVolume = topWaterVolume;
    const lowerGasVolume = lowerCapacity - lowerWaterVolume;
    const intermediateGasVolume = intermediateCapacity
      - intermediateWaterVolume;
    const sharedGasVolume = lowerGasVolume + intermediateGasVolume;
    const sharedGasPressure = sharedGasPVConstant / sharedGasVolume;
    const lowerWaterHeight = lowerWaterVolume / lowerArea;
    const intermediateWaterHeight = fountainBowlLevel(intermediateWaterVolume) - intermediateBottomY;
    const topWaterHeight = upperWaterVolume / topArea;
    const lowerWaterSurfaceY = lowerBottomY + lowerWaterHeight;
    const intermediateWaterSurfaceY = intermediateBottomY
      + intermediateWaterHeight;
    const topWaterSurfaceY = topBasinBottomY + topWaterHeight;
    const pneumaticPressureHead = (sharedGasPressure - atmosphericPressure)
      / (waterDensity * gravitationalAcceleration);
    const availableJetHead = pneumaticPressureHead
      + intermediateWaterSurfaceY - nozzleY;
    const idealJetHeight = Math.max(0, availableJetHead);
    const modeledWaterVolume = lowerWaterVolume
      + intermediateWaterVolume + upperWaterVolume;
    const initialModeledWaterVolume = lowerInitialWaterVolume
      + intermediateInitialWaterVolume + topWaterVolume;
    const waterBalanceResidual = modeledWaterVolume
      - initialModeledWaterVolume - externallyPouredVolume;
    return {
      availableJetHead,
      drainTransferVolume,
      externallyPouredVolume,
      idealJetHeight,
      intermediateGasVolume,
      intermediateWaterHeight,
      intermediateWaterSurfaceY,
      intermediateWaterVolume,
      jetTransferVolume,
      lowerGasVolume,
      lowerWaterHeight,
      lowerWaterSurfaceY,
      lowerWaterVolume,
      pneumaticPressureHead,
      sharedGasPV: sharedGasPressure * sharedGasVolume,
      sharedGasPressure,
      sharedGasVolume,
      topWaterHeight,
      topWaterSurfaceY,
      upperWaterVolume,
      waterBalanceResidual,
      transferProgress,
    };
  };

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, operationEndPhase, resetStartPhase].find(
      (boundary) => Math.abs(rawPhase - boundary) < 1e-12,
    ) ?? rawPhase;
    let transferProgress;
    let transferProgressRate = 0;
    let flowFraction = 0;
    let regime;
    if (phase < operationEndPhase) {
      const local = phase / operationEndPhase;
      transferProgress = smootherStep(local);
      transferProgressRate = smootherStepDerivative(local)
        / (operationEndPhase * cycleDuration);
      flowFraction = smootherStepDerivative(local) / 1.875;
      regime = 'physical-pour-drain-air-compression-and-fountain-operation';
    } else if (phase < resetStartPhase) {
      transferProgress = 1;
      regime = 'physical-flow-complete-before-demonstration-reset';
    } else {
      const local = (phase - resetStartPhase) / (1 - resetStartPhase);
      transferProgress = 1 - smootherStep(local);
      transferProgressRate = -smootherStepDerivative(local)
        / ((1 - resetStartPhase) * cycleDuration);
      regime = 'nonphysical-hidden-level-reset-for-looping-demonstration';
    }
    const hydraulic = stateAtTransferProgress(transferProgress);
    const drainFlowRate = phase < operationEndPhase
      ? lowerTransfer * transferProgressRate
      : 0;
    const jetFlowRate = phase < operationEndPhase
      ? intermediateTransfer * transferProgressRate
      : 0;
    const externalPourFlowRate = phase < operationEndPhase
      ? externalPourTransfer * transferProgressRate
      : 0;
    return {
      ...hydraulic,
      drainFlowRate,
      externalPourFlowRate,
      flowFraction,
      jetFlowRate,
      phase,
      physicalFlowsVisible: flowFraction > 1e-4
        && phase < operationEndPhase,
      regime,
      transferProgressRate,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.50,
  });
  const pipeMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.24,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.44,
    roughness: 0.25,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const activeDrainMaterial = matte(PALETTE.fluid, {
    opacity: 0.58,
    roughness: 0.22,
    transparent: true,
  });
  activeDrainMaterial.depthWrite = false;
  const activeJetMaterial = activeDrainMaterial.clone();
  const activePourMaterial = activeDrainMaterial.clone();
  const airMaterial = matte(PALETTE.white, {
    opacity: 0.72,
    roughness: 0.38,
    transparent: true,
  });
  airMaterial.depthWrite = false;

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.16, 2.8),
    frameMaterial,
  ), 'fixed-foundation-under-three-vessel-fountain');
  foundation.position.set(0, groundY + 0.08, 0);
  root.add(foundation);

  const lowerVessel = addRole(new THREE.Group(),
    'sealed-lower-vessel-receiving-right-hand-drain-water');
  root.add(lowerVessel);
  const lowerShell = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.46, 0.80, 1.78),
    shellMaterial,
  ), 'transparent-sealed-lower-vessel-shell');
  lowerShell.position.set(0, lowerBottomY + lowerInnerHeight / 2, 0);
  lowerVessel.add(lowerShell);
  for (const y of [lowerBottomY - 0.05,
    lowerBottomY + lowerInnerHeight + 0.05]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(4.58, 0.10, 1.90),
      frameMaterial,
    );
    rail.position.set(0, y, 0);
    lowerVessel.add(rail);
  }
  const lowerWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(lowerInnerLength, 1, lowerInnerWidth),
    waterMaterial,
  ), 'water-rising-in-sealed-lower-vessel');
  lowerVessel.add(lowerWater);
  const lowerAirCavity = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(lowerInnerLength * 0.96, 1, lowerInnerWidth * 0.96),
    airMaterial,
  ), 'compressed-air-cavity-above-lower-vessel-water');
  lowerVessel.add(lowerAirCavity);

  const intermediateVessel = addRole(new THREE.Group(),
    'sealed-intermediate-vessel-supplying-central-water-jet');
  root.add(intermediateVessel);
  const intermediateCenterY = intermediateBottomY
    + intermediateInnerHeight / 2;
  const intermediateShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      intermediateInnerRadius + 0.09,
      intermediateInnerRadius + 0.09,
      intermediateInnerHeight + 0.12,
      48,
      1,
      true,
    ),
    shellMaterial,
  ), 'transparent-sealed-intermediate-vessel-shell');
  intermediateShell.position.set(0, intermediateCenterY, 0);
  intermediateVessel.add(intermediateShell);
  const intermediateRims = [
    intermediateBottomY - 0.06,
    intermediateBottomY + intermediateInnerHeight + 0.06,
  ].map((y, index) => {
    const rim = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(
        intermediateInnerRadius + 0.09,
        0.055,
        10,
        48,
      ),
      frameMaterial,
    ), index === 0
      ? 'intermediate-vessel-bottom-seal-rim'
      : 'intermediate-vessel-top-seal-rim');
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, y, 0);
    intermediateVessel.add(rim);
    return rim;
  });
  const intermediateWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      intermediateInnerRadius,
      intermediateInnerRadius,
      1,
      44,
    ),
    waterMaterial,
  ), 'water-falling-in-intermediate-vessel-as-jet-is-delivered');
  intermediateVessel.add(intermediateWater);
  const intermediateAirCavity = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      intermediateInnerRadius * 0.96,
      intermediateInnerRadius * 0.96,
      1,
      40,
    ),
    airMaterial,
  ), 'compressed-air-cavity-above-intermediate-vessel-water');
  intermediateVessel.add(intermediateAirCavity);

  const topBasin = addRole(new THREE.Group(),
    'open-upper-basin-receiving-pour-and-returning-fountain-spray');
  root.add(topBasin);
  const basinFloor = new THREE.Mesh(
    new THREE.BoxGeometry(4.62, 0.12, 1.76),
    frameMaterial,
  );
  basinFloor.position.set(0, topBasinBottomY - 0.06, 0);
  topBasin.add(basinFloor);
  for (const z of [-0.85, 0.85]) {
    const wallHeight = z > 0 ? 0.20 : 0.52;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(4.62, wallHeight, 0.10),
      frameMaterial,
    );
    wall.position.set(0, topBasinBottomY + wallHeight / 2, z);
    topBasin.add(wall);
  }
  for (const x of [-2.26, 2.26]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.52, 1.70),
      frameMaterial,
    );
    wall.position.set(x, topBasinBottomY + 0.20, 0);
    topBasin.add(wall);
  }
  const topWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(topInnerLength, 1, topInnerWidth),
    waterMaterial,
  ), 'constant-level-water-in-open-upper-basin');
  topBasin.add(topWater);

  const rightDrainOuter = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 2.62, 24),
    pipeMaterial,
  ), 'right-hand-water-drain-from-upper-basin-to-lower-vessel');
  rightDrainOuter.position.set(1.66, 1.38, 0);
  root.add(rightDrainOuter);
  const rightDrainWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 2.54, 20),
    activeDrainMaterial,
  ), 'active-downward-water-column-inside-right-drain');
  rightDrainWater.position.copy(rightDrainOuter.position);
  root.add(rightDrainWater);

  const airCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.66, 0.53, 0),
    new THREE.Vector3(-1.66, 1.00, 0),
    new THREE.Vector3(-1.58, 1.82, 0),
    new THREE.Vector3(-0.88, 1.88, 0),
  ]);
  const leftAirPipe = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(airCurve, 52, 0.095, 12, false),
    pipeMaterial,
  ), 'left-hand-pneumatic-communication-tube-between-two-air-cavities');
  root.add(leftAirPipe);
  const airCore = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(airCurve, 52, 0.045, 10, false),
    airMaterial,
  ), 'shared-compressed-air-column-in-left-communication-tube');
  root.add(airCore);

  const centralRiser = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 2.25, 24),
    pipeMaterial,
  ), 'central-water-riser-from-intermediate-vessel-to-nozzle');
  centralRiser.position.set(0, 1.86, 0);
  root.add(centralRiser);
  const centralRiserWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 2.18, 18),
    activeJetMaterial,
  ), 'active-upward-water-column-inside-central-riser');
  centralRiserWater.position.copy(centralRiser.position);
  root.add(centralRiserWater);
  const nozzle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.20, 22),
    darkMaterial,
  ), 'central-fountain-nozzle');
  nozzle.position.set(0, nozzleY - 0.10, 0);
  root.add(nozzle);

  const jetColumn = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.065, 1, 18),
    activeJetMaterial,
  ), 'pressure-driven-free-jet-above-central-nozzle');
  root.add(jetColumn);
  const nominalJetApexY = nozzleY
    + stateAtTransferProgress(0.5).idealJetHeight;
  const makeSprayCurve = (sign) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, nominalJetApexY, 0),
    new THREE.Vector3(sign * 0.22, nominalJetApexY + 0.07, 0),
    new THREE.Vector3(sign * 0.58, nominalJetApexY - 0.14, 0),
    new THREE.Vector3(sign * 0.92, topBasinBottomY + 0.30, 0),
  ]);
  const fountainSprays = [-1, 1].map((sign, index) => addRole(
    new THREE.Mesh(
      new THREE.TubeGeometry(makeSprayCurve(sign), 38, 0.035, 9, false),
      activeJetMaterial,
    ),
    index === 0
      ? 'left-returning-fountain-spray-into-upper-basin'
      : 'right-returning-fountain-spray-into-upper-basin',
  ));
  fountainSprays.forEach((spray) => root.add(spray));

  const pourCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.52, 3.82, 0.20),
    new THREE.Vector3(-1.46, 3.55, 0.12),
    new THREE.Vector3(-1.31, 3.20, 0.04),
    new THREE.Vector3(-1.18, topBasinBottomY + 0.30, 0),
  ]);
  const externalPour = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pourCurve, 36, 0.055, 10, false),
    activePourMaterial,
  ), 'external-water-pour-into-open-upper-basin');
  root.add(externalPour);

  const update = (time) => {
    const state = stateAtTime(time);
    lowerWater.scale.y = state.lowerWaterHeight;
    lowerWater.position.set(
      0,
      lowerBottomY + state.lowerWaterHeight / 2,
      0,
    );
    const lowerAirHeight = lowerInnerHeight - state.lowerWaterHeight;
    lowerAirCavity.scale.y = lowerAirHeight;
    lowerAirCavity.position.set(
      0,
      state.lowerWaterSurfaceY + lowerAirHeight / 2,
      0,
    );
    intermediateWater.scale.y = state.intermediateWaterHeight;
    intermediateWater.position.set(
      0,
      intermediateBottomY + state.intermediateWaterHeight / 2,
      0,
    );
    const intermediateAirHeight = intermediateInnerHeight
      - state.intermediateWaterHeight;
    intermediateAirCavity.scale.y = intermediateAirHeight;
    intermediateAirCavity.position.set(
      0,
      state.intermediateWaterSurfaceY + intermediateAirHeight / 2,
      0,
    );
    topWater.scale.y = state.topWaterHeight;
    topWater.position.set(
      0,
      topBasinBottomY + state.topWaterHeight / 2,
      0,
    );
    const streamsVisible = state.physicalFlowsVisible;
    rightDrainWater.visible = streamsVisible;
    centralRiserWater.visible = streamsVisible;
    jetColumn.visible = streamsVisible;
    fountainSprays.forEach((spray) => {
      spray.visible = streamsVisible;
    });
    externalPour.visible = streamsVisible;
    const flowOpacity = 0.20 + 0.48 * state.flowFraction;
    activeDrainMaterial.opacity = flowOpacity;
    activeJetMaterial.opacity = flowOpacity;
    activePourMaterial.opacity = flowOpacity;
    const visibleJetHeight = Math.max(0.02, state.idealJetHeight);
    jetColumn.scale.y = visibleJetHeight;
    jetColumn.position.set(0, nozzleY + visibleJetHeight / 2, 0);
    root.userData.updateWorkingParts?.(state);
  };

  const sourceState = stateAtTransferProgress(0.35);
  const geometry = {
    atmosphericPressure,
    cycleDuration,
    externalPourTransfer,
    gravitationalAcceleration,
    groundY,
    initialIntermediateGasVolume,
    initialLowerGasVolume,
    initialPressureRatio,
    initialSharedGasPressure,
    initialSharedGasVolume,
    intermediateBottomY,
    intermediateCapacity,
    intermediateInitialWaterVolume,
    intermediateInnerHeight,
    intermediateInnerRadius,
    intermediateTransfer,
    lowerArea,
    lowerBottomY,
    lowerCapacity,
    lowerInitialWaterVolume,
    lowerInnerHeight,
    lowerInnerLength,
    lowerInnerWidth,
    lowerTransfer,
    nozzleY,
    operationEndPhase,
    resetStartPhase,
    sharedGasPVConstant,
    topArea,
    topBasinBottomY,
    topInnerLength,
    topInnerWidth,
    topWaterVolume,
    waterDensity,
  };
  root.userData = {
    archetype:
      'herons-three-vessel-fountain-with-water-drain-shared-air-line-and-pressure-driven-central-jet',
    blocks: {
      airCore,
      basinFloor,
      centralRiser,
      centralRiserWater,
      downstreamWaterPath: rightDrainWater,
      externalPour,
      foundation,
      fountainSprays,
      intermediateAirCavity,
      intermediateRims,
      intermediateShell,
      intermediateVessel,
      intermediateWater,
      jetColumn,
      leftAirPipe,
      lowerAirCavity,
      lowerShell,
      lowerVessel,
      lowerWater,
      nozzle,
      rightDrainOuter,
      rightDrainWater,
      topBasin,
      topWater,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      sharedAirPressureIndependent: false,
      threeWaterLevelsIndependent: false,
    },
    dynamics: {
      airModel:
        'The two sealed-vessel headspaces and left communication tube are one ideal isothermal gas volume, so P times V remains constant.',
      lossesBubbleFlowFreeSurfaceSloshPipeInertiaJetBreakupEvaporationAndHeatTransferModeled:
        false,
      resetDisclosure:
        'The physical operating interval stops before the hidden-stream reset. During reset only vessel levels and pressure return smoothly to the initial demonstration state; no reverse water or air flow is depicted or claimed.',
      waterModel:
        'During the physical interval, lower gain equals right-drain transfer, intermediate loss equals jet transfer, and the smaller external pour exactly supplies their difference so upper-basin volume remains constant.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Water poured into the open upper basin descends only through the right tube into the sealed lower vessel. The rising lower water compresses a single shared air volume connected by the left tube to the sealed intermediate vessel. That pressure acts on the intermediate water and drives it only through the central riser and nozzle; the spray returns to the upper basin.',
    motion: {
      cycleDuration,
      motionType:
        'finite-volume-conserving-operating-stroke-followed-by-disclosed-flow-hidden-C2-reset',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      idealJetHeight: sourceState.idealJetHeight,
      intermediateWaterSurfaceY: sourceState.intermediateWaterSurfaceY,
      lowerWaterSurfaceY: sourceState.lowerWaterSurfaceY,
      sharedGasPressure: sourceState.sharedGasPressure,
      topWaterSurfaceY: sourceState.topWaterSurfaceY,
      transferProgress: sourceState.transferProgress,
    },
    sourceReference: {
      brownPlate464: {
        approximateCentralJetBoundsPixels: [226, 47, 61, 201],
        approximateIntermediateVesselBoundsPixels: [161, 155, 184, 125],
        approximateLowerVesselBoundsPixels: [105, 402, 297, 65],
        approximateTopBasinBoundsPixels: [93, 106, 326, 63],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'water poured into the upper vessel descends the right tube into the lower vessel',
          'the intermediate vessel is initially filled',
          'air is confined above water in both sealed vessels',
          'the left tube communicates between those air cavities',
          'compressed air drives a jet up the central tube',
        ],
        engravingEvidence:
          'Brown shows an open rectangular upper basin, a right-hand downpipe reaching the lower vessel, a left pneumatic return rising from that vessel to the intermediate bowl, and a central riser passing from the intermediate water through the upper basin to a two-sided fountain spray.',
        reconstructionDisclosure:
          'Brown gives no vessel capacities, fill fractions, air pressure, pipe bores, flow rates, loss coefficients, jet height, duration or reset. Vessel dimensions, a 1.22-atmosphere initial shared pressure, ideal isothermal gas law, finite transfer volumes, a twelve-and-a-half-second explanatory cycle, colors and the explicitly nonphysical hidden-flow reset are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 464',
    },
    stateAtPhase,
    stateAtTime,
    stateAtTransferProgress,
    transmission: {
      airPath:
        'lower sealed headspace <-> left communication tube <-> intermediate sealed headspace',
      centralJetPath:
        'intermediate water -> submerged central riser intake -> nozzle -> upper basin',
      rightDrainPath:
        'open upper basin -> right downpipe -> sealed lower vessel water',
      topologyInvariant:
        'The right pipe carries water and never connects to the intermediate vessel; the left pipe carries compressed air and never connects the water volumes.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.22, groundY - 0.02, -1.52),
    new THREE.Vector3(3.22, 4.02, 1.52),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(4.8, 2.7, 11.8);
  root.userData.groundFloorY = groundY;
  correctFountain(root);
  markShadows(root);
  foundation.receiveShadow = true;
  for (const object of [lowerWater, lowerAirCavity, intermediateWater,
    intermediateAirCavity, topWater, rightDrainWater, centralRiserWater,
    jetColumn, ...fountainSprays, externalPour]) {
    object.castShadow = false;
  }
  // Brown's section is a flat engraving: its cut walls cast no shadows.
  root.userData.sectionFrame?.group.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
  });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredHeronsFountainMovement(movement) {
  if (movement.id !== 464) return null;
  return heronsFountain(movement);
}
