import {correctEjectorTrapParts, ejectorOperatingStage} from './ejector-trap-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

function makeTube(curve, radius, material, role, tubularSegments = 72) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function cylinderBetween(start, end, radius, material, role, sides = 40) {
  const direction = end.clone().sub(start);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  cylinder.userData.role = role;
  return cylinder;
}

function brearBilgeEjector(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const steamMarkerPassesPerCycle = 3;
  const waterMarkerPassesPerCycle = 2;
  const steamMarkerCount = 9;
  const waterPathCount = 4;
  const waterMarkersPerPath = 6;

  // Brown gives no hydraulic dimensions or operating data. The following SI
  // reconstruction is deliberately exposed and keeps every displayed stream
  // consistent with one choked primary-jet, suction-head, continuity, and
  // one-dimensional mixing-momentum calculation.
  const atmosphericPressurePascal = 101325;
  const steamSupplyPressurePascal = 250000;
  const steamSupplyTemperatureKelvin = 410;
  const mixingChamberPressurePascal = 85000;
  const steamSpecificGasConstant = 461.5;
  const steamHeatCapacityRatio = 1.30;
  const steamDischargeCoefficient = 0.86;
  const steamNozzleThroatRadiusMetre = 0.003;
  const waterDensityKilogramPerCubicMetre = 998;
  const gravityMetrePerSecondSquared = 9.80665;
  const bilgeLiftMetre = 1.0;
  const waterSuctionDischargeCoefficient = 0.72;
  const suctionPipeRadiusMetre = 0.008;

  const criticalPressureRatio = (2 / (steamHeatCapacityRatio + 1)) ** (
    steamHeatCapacityRatio / (steamHeatCapacityRatio - 1)
  );
  const mixingPressureRatio = mixingChamberPressurePascal
    / steamSupplyPressurePascal;
  const steamNozzleAreaSquareMetre = Math.PI
    * steamNozzleThroatRadiusMetre ** 2;
  const chokedMassFluxFactor = Math.sqrt(steamHeatCapacityRatio)
    * (2 / (steamHeatCapacityRatio + 1)) ** (
      (steamHeatCapacityRatio + 1)
      / (2 * (steamHeatCapacityRatio - 1))
    );
  const steamMassFlowKilogramPerSecond = steamDischargeCoefficient
    * steamNozzleAreaSquareMetre
    * steamSupplyPressurePascal
    / Math.sqrt(
      steamSpecificGasConstant * steamSupplyTemperatureKelvin,
    )
    * chokedMassFluxFactor;
  const steamExitTemperatureKelvin = steamSupplyTemperatureKelvin
    * mixingPressureRatio ** (
      (steamHeatCapacityRatio - 1) / steamHeatCapacityRatio
    );
  const steamSpecificHeatAtConstantPressure = steamHeatCapacityRatio
    * steamSpecificGasConstant / (steamHeatCapacityRatio - 1);
  const steamJetSpeedMetrePerSecond = Math.sqrt(
    2 * steamSpecificHeatAtConstantPressure
      * (steamSupplyTemperatureKelvin - steamExitTemperatureKelvin),
  );
  const steamDensityAtMixingPlane = mixingChamberPressurePascal
    / (steamSpecificGasConstant * steamExitTemperatureKelvin);
  const maximumStaticSuctionLiftMetre = (
    atmosphericPressurePascal - mixingChamberPressurePascal
  ) / (waterDensityKilogramPerCubicMetre
    * gravityMetrePerSecondSquared);
  const suctionHeadMarginMetre = maximumStaticSuctionLiftMetre
    - bilgeLiftMetre;
  const waterSuctionSpeedMetrePerSecond =
    waterSuctionDischargeCoefficient * Math.sqrt(
      2 * gravityMetrePerSecondSquared * suctionHeadMarginMetre,
    );
  const suctionPipeAreaSquareMetre = Math.PI * suctionPipeRadiusMetre ** 2;
  const waterMassFlowKilogramPerSecond = waterDensityKilogramPerCubicMetre
    * suctionPipeAreaSquareMetre * waterSuctionSpeedMetrePerSecond;
  const waterVolumetricFlowCubicMetrePerSecond =
    waterMassFlowKilogramPerSecond / waterDensityKilogramPerCubicMetre;
  const steamVolumetricFlowAtMixingPlane = steamMassFlowKilogramPerSecond
    / steamDensityAtMixingPlane;
  const totalMassFlowKilogramPerSecond = steamMassFlowKilogramPerSecond
    + waterMassFlowKilogramPerSecond;
  const inletAxialMomentumNewton = steamMassFlowKilogramPerSecond
    * steamJetSpeedMetrePerSecond
    + waterMassFlowKilogramPerSecond
      * waterSuctionSpeedMetrePerSecond;
  const mixedStreamSpeedMetrePerSecond = inletAxialMomentumNewton
    / totalMassFlowKilogramPerSecond;
  const mixedVolumetricFlowCubicMetrePerSecond =
    waterVolumetricFlowCubicMetrePerSecond
    + steamVolumetricFlowAtMixingPlane;
  const derivedDischargeAreaSquareMetre =
    mixedVolumetricFlowCubicMetrePerSecond
    / mixedStreamSpeedMetrePerSecond;
  const derivedDischargeRadiusMetre = Math.sqrt(
    derivedDischargeAreaSquareMetre / Math.PI,
  );
  const outletAxialMomentumNewton = totalMassFlowKilogramPerSecond
    * mixedStreamSpeedMetrePerSecond;
  const entrainmentMassRatio = waterMassFlowKilogramPerSecond
    / steamMassFlowKilogramPerSecond;

  const nozzleTip = new THREE.Vector3(0, 0.68, 0);
  const steamInlet = new THREE.Vector3(3.10, 0.05, 0);
  const steamExit = new THREE.Vector3(0, 3.45, 0);
  const steamPipeCurve = new THREE.CatmullRomCurve3([
    steamInlet,
    new THREE.Vector3(2.25, 0.05, 0),
    new THREE.Vector3(1.20, 0.08, 0),
    new THREE.Vector3(0.55, 0.16, 0),
    new THREE.Vector3(0.18, 0.42, 0),
    nozzleTip,
  ], false, 'centripetal');
  const steamFlowCurve = new THREE.CurvePath();
  steamFlowCurve.add(steamPipeCurve);
  steamFlowCurve.add(new THREE.LineCurve3(nozzleTip, steamExit));

  const waterCurves = [];
  for (let index = 0; index < waterPathCount; index += 1) {
    const angle = index * Math.PI * 2 / waterPathCount + Math.PI / 4;
    const offset = (radius, y) => new THREE.Vector3(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius,
    );
    waterCurves.push(new THREE.CatmullRomCurve3([
      offset(0.18, -2.95),
      offset(0.21, -2.05),
      offset(0.24, -1.12),
      offset(0.72, -0.42),
      offset(0.56, 0.30),
      offset(0.40, 0.88),
      offset(0.31, 1.48),
      offset(0.20, 2.34),
      offset(0.18, 3.45),
    ], false, 'centripetal'));
  }

  const geometry = {
    atmosphericPressurePascal,
    bilgeLiftMetre,
    chokedMassFluxFactor,
    criticalPressureRatio,
    cycleDuration,
    derivedDischargeAreaSquareMetre,
    derivedDischargeRadiusMetre,
    entrainmentMassRatio,
    gravityMetrePerSecondSquared,
    inletAxialMomentumNewton,
    maximumStaticSuctionLiftMetre,
    mixedStreamSpeedMetrePerSecond,
    mixedVolumetricFlowCubicMetrePerSecond,
    mixingChamberPressurePascal,
    mixingPressureRatio,
    nozzleTip: nozzleTip.clone(),
    outletAxialMomentumNewton,
    steamDensityAtMixingPlane,
    steamDischargeCoefficient,
    steamExitTemperatureKelvin,
    steamHeatCapacityRatio,
    steamJetSpeedMetrePerSecond,
    steamMarkerCount,
    steamMarkerPassesPerCycle,
    steamMassFlowKilogramPerSecond,
    steamNozzleAreaSquareMetre,
    steamNozzleThroatRadiusMetre,
    steamSpecificGasConstant,
    steamSpecificHeatAtConstantPressure,
    steamSupplyPressurePascal,
    steamSupplyTemperatureKelvin,
    steamVolumetricFlowAtMixingPlane,
    suctionHeadMarginMetre,
    suctionPipeAreaSquareMetre,
    suctionPipeRadiusMetre,
    totalMassFlowKilogramPerSecond,
    waterDensityKilogramPerCubicMetre,
    waterMarkersPerPath,
    waterMassFlowKilogramPerSecond,
    waterPathCount,
    waterSuctionDischargeCoefficient,
    waterSuctionSpeedMetrePerSecond,
    waterMarkerPassesPerCycle,
    waterVolumetricFlowCubicMetrePerSecond,
  };

  const shellMaterial = matte(PALETTE.frame, {
    metalness: 0.21,
    opacity: 0.34,
    roughness: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const rimMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.44,
  });
  const steamPipeMaterial = matte(PALETTE.driver, {
    metalness: 0.22,
    opacity: 0.79,
    roughness: 0.43,
    transparent: true,
  });
  const steamMaterial = matte(PALETTE.white, {
    opacity: 0.46,
    roughness: 0.23,
    transparent: true,
  });
  steamMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.53,
    roughness: 0.24,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const waterMarkerMaterial = matte(0x8dd3e0, {
    opacity: 0.84,
    roughness: 0.29,
    transparent: true,
  });
  waterMarkerMaterial.depthWrite = false;
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.58,
  });

  const chamberProfile = [
    [0.53, -1.16],
    [0.89, -1.02],
    [1.23, -0.65],
    [1.38, -0.08],
    [1.30, 0.48],
    [1.04, 1.05],
    [0.57, 1.56],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const chamber = new THREE.Mesh(
    new THREE.LatheGeometry(
      chamberProfile,
      72,
      Math.PI * 0.07,
      Math.PI * 1.76,
    ),
    shellMaterial,
  );
  chamber.userData.role = 'stationary-cutaway-mixing-chamber-D';
  root.add(chamber);

  const suctionPipe = cylinderBetween(
    new THREE.Vector3(0, -2.91, 0),
    new THREE.Vector3(0, -1.12, 0),
    0.47,
    shellMaterial,
    'stationary-suction-pipe-B-rising-from-bilge',
    56,
  );
  root.add(suctionPipe);
  const dischargePipe = cylinderBetween(
    new THREE.Vector3(0, 1.52, 0),
    new THREE.Vector3(0, 3.40, 0),
    0.54,
    shellMaterial,
    'stationary-vertical-discharge-pipe-C',
    56,
  );
  root.add(dischargePipe);
  const suctionCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.50, 0.065, 10, 52),
    rimMaterial,
  );
  suctionCollar.rotation.x = Math.PI / 2;
  suctionCollar.position.y = -1.14;
  suctionCollar.userData.role = 'suction-B-to-chamber-D-joint';
  root.add(suctionCollar);
  const dischargeCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.57, 0.065, 10, 52),
    rimMaterial,
  );
  dischargeCollar.rotation.x = Math.PI / 2;
  dischargeCollar.position.y = 1.55;
  dischargeCollar.userData.role = 'chamber-D-to-discharge-C-joint';
  root.add(dischargeCollar);

  const steamPipe = makeTube(
    steamPipeCurve,
    0.20,
    steamPipeMaterial,
    'stationary-steam-pipe-A-turning-upward-inside-D',
    90,
  );
  root.add(steamPipe);
  const steamPipeCore = makeTube(
    steamPipeCurve,
    0.085,
    steamMaterial,
    'steam-flow-inside-pipe-A-to-nozzle',
    90,
  );
  root.add(steamPipeCore);
  const nozzle = cylinderBetween(
    new THREE.Vector3(0, 0.46, 0),
    nozzleTip,
    0.14,
    steamPipeMaterial,
    'upward-steam-nozzle-A-coaxial-with-discharge-C',
    40,
  );
  root.add(nozzle);
  const steamJet = cylinderBetween(
    nozzleTip,
    new THREE.Vector3(0, 2.66, 0),
    0.075,
    steamMaterial,
    'free-primary-steam-jet-entraining-water-upward',
    28,
  );
  root.add(steamJet);

  const waterStreams = waterCurves.map((curve, index) => {
    const stream = makeTube(
      curve,
      0.075,
      waterMaterial,
      `continuous-bilge-water-stream-${index + 1}-of-four-B-through-D-to-C`,
      96,
    );
    root.add(stream);
    return stream;
  });

  const bilgeBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(1.62, 1.68, 0.18, 64),
    frameMaterial,
  );
  bilgeBasin.position.y = -3.04;
  bilgeBasin.userData.role = 'stationary-bilge-well-surrounding-suction-B';
  root.add(bilgeBasin);
  const bilgeWater = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, 0.055, 60),
    waterMaterial,
  );
  bilgeWater.position.y = -2.92;
  bilgeWater.userData.role = 'bilge-water-source-at-foot-of-B';
  root.add(bilgeWater);
  const steamMarkers = [];
  for (let index = 0; index < steamMarkerCount; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 16, 11),
      steamMaterial,
    );
    marker.userData.role = `steam-A-marker-${index + 1}`;
    root.add(marker);
    steamMarkers.push(marker);
  }
  const waterMarkers = [];
  for (let pathIndex = 0; pathIndex < waterPathCount; pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < waterMarkersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.088, 16, 11),
        waterMarkerMaterial,
      );
      marker.userData.role =
        `water-B-to-C-path-${pathIndex + 1}-marker-${markerIndex + 1}`;
      root.add(marker);
      waterMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  // The display loop starts the ejector, runs it and shuts it off, so the
  // water level itself shows the process: the steam purges the air (the
  // water still at the bilge, the foot of B), the vacuum draws the water
  // up through B, D and C, the ejector runs full and discharges through C,
  // and when the steam is shut off the water falls back down B. The flow
  // quantities below are those of the running stage.
  const bilgeLevelY = -2.91;
  const outletLevelY = 3.40;
  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const operation = ejectorOperatingStage(phase);
    const waterLevelY = bilgeLevelY
      + (outletLevelY - bilgeLevelY) * operation.levelFraction;
    return {
      ...operation,
      waterLevelY,
      cycleTime,
      inletAxialMomentumNewton,
      mixedStreamSpeedMetrePerSecond,
      mixingChamberPressurePascal,
      outletAxialMomentumNewton,
      phase,
      steamMassFlowKilogramPerSecond,
      totalMassFlowKilogramPerSecond,
      waterMassFlowKilogramPerSecond,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    for (let index = 0; index < steamMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        state.phase * steamMarkerPassesPerCycle
          + index / steamMarkerCount,
        1,
      );
      steamMarkers[index].position.copy(steamFlowCurve.getPointAt(progress));
      steamMarkers[index].scale.setScalar(
        Math.sin(Math.PI * progress) ** 0.55,
      );
    }
    for (const entry of waterMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        state.phase * waterMarkerPassesPerCycle
          + entry.markerIndex / waterMarkersPerPath,
        1,
      );
      entry.marker.position.copy(
        waterCurves[entry.pathIndex].getPointAt(progress),
      );
      entry.marker.scale.setScalar(
        Math.sin(Math.PI * progress) ** 0.55,
      );
    }
    root.userData.updateWorkingParts?.(time, state);
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'brear-bilge-ejector-with-side-steam-pipe-upward-coaxial-nozzle-bulb-mixing-chamber-bottom-suction-and-top-discharge',
    blocks: {
      bilgeBasin,
      bilgeWater,
      chamber,
      dischargeCollar,
      dischargePipe,
      nozzle,
      steamJet,
      steamMarkers,
      steamPipe,
      steamPipeCore,
      suctionCollar,
      suctionPipe,
      waterMarkers: waterMarkers.map(({ marker }) => marker),
      waterStreams,
    },
    degreesOfFreedom: {
      mechanicalMovingParts: 0,
      operatingDegreesOfFreedom: 0,
      prescribedAdvectiveFlowPhases: 2,
    },
    dynamics: {
      assumptionScope:
        'The displayed running state uses a specified mixing-chamber pressure and one-dimensional, equal-pressure, adiabatic momentum mixing. It does not integrate startup air evacuation, steam condensation, heat transfer, diffuser pressure recovery, turbulent entrainment, cavitation, salinity, pipe friction, leakage, or downstream back-pressure.',
      markerContinuity:
        'Every steam and water marker traverses one complete inlet-to-outlet curve by arc length with getPointAt and shrinks continuously to zero at both recycling endpoints.',
      operatingSequence:
        'The steam jet first purges air from D and C, lowering pressure in B; after priming, atmospheric pressure raises bilge water through B and the continuing jet entrains it into a regular mixed discharge through C. The presented loop shows the water level doing this: it stands at the bilge during the purge, rises through B, D and C, holds full while the ejector runs and the discharge issues from the open mouth of C, and falls back down B when the steam is shut off. The level is a prescribed smoothstep, not an integrated priming transient; the flow quantities are those of the steady running stage.',
    },
    fidelity: 'authored',
    flowPaths: {
      steamFlowCurve,
      steamPipeCurve,
      waterCurves,
    },
    geometry,
    mechanism:
      'The ejector has no moving mechanism. Fixed side pipe A enters chamber D, turns through a smooth elbow, and ends in an upward nozzle coaxial with discharge C. Its high-speed steam jet purges D and C and maintains a sub-atmospheric pressure over suction B. Bilge water consequently rises through B, divides around the unobstructed central nozzle, is entrained upward by the jet, recombines, and leaves continuously through C. Chamber, pipes, nozzle, and support remain stationary; only the two fluid marker populations advance in the offline model, and the presented water level rises through B, D and C, discharges from the mouth of C and falls back as the ejector is started, run and shut off.',
    motion: {
      cycleDuration,
      dischargeDirection: new THREE.Vector3(0, 1, 0),
      steamDirectionAtNozzle: new THREE.Vector3(0, 1, 0),
      waterDirectionInSuction: new THREE.Vector3(0, 1, 0),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 475 HTML marks Animated unavailable and provides only Brown’s static section and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate475: {
        approximateChamberCenterPixels: [270, 286],
        approximateDischargeCCenterPixels: [260, 73],
        approximateNozzleTipPixels: [248, 221],
        approximateSteamAEntryPixels: [405, 302],
        approximateSuctionBCenterPixels: [253, 452],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'D is the chamber between bottom suction B and top discharge C',
          'steam pipe A enters at one side and its nozzle points toward C',
          'the steam jet expels air from D and C and produces vacuum in B',
          'water rises through B and passes through D and C in a regular constant stream',
          'compressed air may replace steam',
        ],
        engravingEvidence:
          'Brown’s axial section shows one bulb-shaped chamber D, straight lower B and upper C connections, and side pipe A curving inside D until its open end points upward on the C axis.',
        patentIdentityDisclosure:
          'Brown names Brear’s patent but supplies no patent number, inventor forenames, filing jurisdiction, dimensions, or claims. No unsupported patent identifier is assigned here.',
        reconstructionDisclosure:
          'All SI pressures, temperatures, densities, pipe and nozzle areas, one-metre lift, coefficients, mass flows, mixing approximation, frame, cutaway angle, colors, and four visual water streamlines are independently engineered and exposed. Labels A–D, topology, upward nozzle, air purge, induced suction, continuous discharge, and absence of mechanical moving parts are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 475',
      workshopReceiptsReprint:
        'Workshop Receipts, Pumps—Water, fig. 45, repeats Brown’s Brear ejector description without adding patent particulars',
      workshopReceiptsUrl:
        'https://upload.wikimedia.org/wikipedia/commons/1/1e/Workshop_receipts_%28IA_b2149938x%29.pdf',
    },
    stateAtTime,
    thermodynamics: {
      primaryNozzleChoked: mixingPressureRatio < criticalPressureRatio,
      steamExpansion:
        'ideal isentropic expansion from supply state to specified mixing pressure; mass flow is limited at the sonic throat',
      steamMassFlowEquation:
        'm_s=Cd*A*p0/sqrt(R*T0)*sqrt(gamma)*(2/(gamma+1))^((gamma+1)/(2*(gamma-1)))',
    },
    transmission: {
      continuityEquation:
        'A_C=(m_w/rho_w+m_s/rho_s)/v_mix',
      momentumEquation:
        '(m_s*v_s+m_w*v_w)=(m_s+m_w)*v_mix',
      suctionEquation:
        'v_w=Cd_w*sqrt(2*g*((p_atm-p_mix)/(rho_w*g)-lift))',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.10, -3.22, -1.80),
    new THREE.Vector3(3.38, 4.00, 1.80),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(7.4, 3.7, 9.0);
  root.userData.groundFloorY = -3.22;
  correctEjectorTrapParts(root,475,update);
  markShadows(root);
  bilgeBasin.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredBilgeEjectorMovement(movement) {
  if (movement.id !== 475) return null;
  return brearBilgeEjector(movement);
}
