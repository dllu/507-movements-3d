import {correctEjectorTrapParts} from './ejector-trap-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

function makeTube(curve, radius, material, role, tubularSegments = 80) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function cylinderBetween(start, end, radius, material, role, sides = 44) {
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

function lansdellSteamSiphonPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const steamMarkerPassesPerCycle = 3;
  const waterMarkerPassesPerCycle = 2;
  const steamMarkerCount = 9;
  const waterMarkersPerPath = 5;
  const suctionBranchCount = 2;
  const waterPathsPerBranch = 2;

  const atmosphericPressurePascal = 101325;
  const steamSupplyPressurePascal = 240000;
  const mixingPressurePascal = 84000;
  const steamSupplyTemperatureKelvin = 405;
  const steamHeatCapacityRatio = 1.30;
  const steamSpecificGasConstant = 461.5;
  const steamDischargeCoefficient = 0.85;
  const steamNozzleRadiusMetre = 0.003;
  const waterDensityKilogramPerCubicMetre = 998;
  const gravityMetrePerSecondSquared = 9.80665;
  const suctionLiftMetre = 0.90;
  const waterDischargeCoefficient = 0.74;
  const suctionBranchRadiusMetre = 0.0065;

  const criticalPressureRatio = (2 / (steamHeatCapacityRatio + 1)) ** (
    steamHeatCapacityRatio / (steamHeatCapacityRatio - 1)
  );
  const mixingPressureRatio = mixingPressurePascal
    / steamSupplyPressurePascal;
  const steamNozzleAreaSquareMetre = Math.PI
    * steamNozzleRadiusMetre ** 2;
  const chokedFlowFactor = Math.sqrt(steamHeatCapacityRatio)
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
    * chokedFlowFactor;
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
  const steamDensityAtMixingPlane = mixingPressurePascal
    / (steamSpecificGasConstant * steamExitTemperatureKelvin);
  const maximumStaticLiftMetre = (
    atmosphericPressurePascal - mixingPressurePascal
  ) / (waterDensityKilogramPerCubicMetre
    * gravityMetrePerSecondSquared);
  const suctionHeadMarginMetre = maximumStaticLiftMetre
    - suctionLiftMetre;
  const waterSpeedPerBranchMetrePerSecond = waterDischargeCoefficient
    * Math.sqrt(
      2 * gravityMetrePerSecondSquared * suctionHeadMarginMetre,
    );
  const suctionBranchAreaSquareMetre = Math.PI
    * suctionBranchRadiusMetre ** 2;
  const waterMassFlowPerBranchKilogramPerSecond =
    waterDensityKilogramPerCubicMetre
    * suctionBranchAreaSquareMetre
    * waterSpeedPerBranchMetrePerSecond;
  const totalWaterMassFlowKilogramPerSecond = suctionBranchCount
    * waterMassFlowPerBranchKilogramPerSecond;
  const totalMassFlowKilogramPerSecond = steamMassFlowKilogramPerSecond
    + totalWaterMassFlowKilogramPerSecond;
  const inletMomentumNewton = steamMassFlowKilogramPerSecond
    * steamJetSpeedMetrePerSecond
    + totalWaterMassFlowKilogramPerSecond
      * waterSpeedPerBranchMetrePerSecond;
  const mixedSpeedMetrePerSecond = inletMomentumNewton
    / totalMassFlowKilogramPerSecond;
  const steamVolumetricFlowAtMixingPlane = steamMassFlowKilogramPerSecond
    / steamDensityAtMixingPlane;
  const totalWaterVolumetricFlow = totalWaterMassFlowKilogramPerSecond
    / waterDensityKilogramPerCubicMetre;
  const mixedVolumetricFlow = steamVolumetricFlowAtMixingPlane
    + totalWaterVolumetricFlow;
  const derivedDischargeAreaSquareMetre = mixedVolumetricFlow
    / mixedSpeedMetrePerSecond;
  const outletMomentumNewton = totalMassFlowKilogramPerSecond
    * mixedSpeedMetrePerSecond;

  const forkCenter = new THREE.Vector3(0, 1.26, 0);
  const nozzleTip = new THREE.Vector3(0, 0.91, 0);
  const dischargeTop = new THREE.Vector3(0, 3.48, 0);
  const branchShellCurves = [-1, 1].map((side) =>
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.38, -2.62, 0),
      new THREE.Vector3(side * 1.38, -1.35, 0),
      new THREE.Vector3(side * 1.30, -0.25, 0),
      new THREE.Vector3(side * 1.02, 0.48, 0),
      new THREE.Vector3(side * 0.51, 1.05, 0),
      forkCenter,
    ], false, 'centripetal'));
  const steamFeedStart = new THREE.Vector3(2.22, 1.82, 0.34);
  const steamPipeCurve = new THREE.CatmullRomCurve3([
    steamFeedStart,
    new THREE.Vector3(2.22, 1.15, 0.34),
    new THREE.Vector3(2.18, 0.44, 0.34),
    new THREE.Vector3(1.58, 0.13, 0.30),
    new THREE.Vector3(0.84, 0.13, 0.20),
    new THREE.Vector3(0.26, 0.47, 0.05),
    nozzleTip,
  ], false, 'centripetal');
  const steamFlowCurve = new THREE.CurvePath();
  steamFlowCurve.add(steamPipeCurve);
  steamFlowCurve.add(new THREE.LineCurve3(nozzleTip, dischargeTop));

  const waterCurves = [];
  for (const side of [-1, 1]) {
    for (const lane of [-1, 1]) {
      waterCurves.push(new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.38, -2.73, lane * 0.13),
        new THREE.Vector3(side * 1.36, -1.38, lane * 0.15),
        new THREE.Vector3(side * 1.25, -0.24, lane * 0.19),
        new THREE.Vector3(side * 0.92, 0.51, lane * 0.23),
        new THREE.Vector3(side * 0.47, 1.00, lane * 0.27),
        new THREE.Vector3(side * 0.25, 1.32, lane * 0.24),
        new THREE.Vector3(side * 0.15, 2.12, lane * 0.18),
        new THREE.Vector3(side * 0.12, 3.48, lane * 0.13),
      ], false, 'centripetal'));
    }
  }

  const geometry = {
    atmosphericPressurePascal,
    chokedFlowFactor,
    criticalPressureRatio,
    cycleDuration,
    derivedDischargeAreaSquareMetre,
    forkCenter: forkCenter.clone(),
    gravityMetrePerSecondSquared,
    inletMomentumNewton,
    maximumStaticLiftMetre,
    mixedSpeedMetrePerSecond,
    mixedVolumetricFlow,
    mixingPressurePascal,
    mixingPressureRatio,
    nozzleTip: nozzleTip.clone(),
    outletMomentumNewton,
    steamDensityAtMixingPlane,
    steamDischargeCoefficient,
    steamExitTemperatureKelvin,
    steamHeatCapacityRatio,
    steamJetSpeedMetrePerSecond,
    steamMarkerCount,
    steamMarkerPassesPerCycle,
    steamMassFlowKilogramPerSecond,
    steamNozzleAreaSquareMetre,
    steamNozzleRadiusMetre,
    steamSpecificGasConstant,
    steamSpecificHeatAtConstantPressure,
    steamSupplyPressurePascal,
    steamSupplyTemperatureKelvin,
    steamVolumetricFlowAtMixingPlane,
    suctionBranchAreaSquareMetre,
    suctionBranchCount,
    suctionBranchRadiusMetre,
    suctionHeadMarginMetre,
    suctionLiftMetre,
    totalMassFlowKilogramPerSecond,
    totalWaterMassFlowKilogramPerSecond,
    totalWaterVolumetricFlow,
    waterDensityKilogramPerCubicMetre,
    waterDischargeCoefficient,
    waterMarkerPassesPerCycle,
    waterMarkersPerPath,
    waterMassFlowPerBranchKilogramPerSecond,
    waterPathsPerBranch,
    waterSpeedPerBranchMetrePerSecond,
  };

  const shellMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    opacity: 0.34,
    roughness: 0.42,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const jointMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.44,
  });
  const steamPipeMaterial = matte(PALETTE.driver, {
    metalness: 0.23,
    opacity: 0.80,
    roughness: 0.43,
    transparent: true,
  });
  const steamMaterial = matte(PALETTE.white, {
    opacity: 0.47,
    roughness: 0.24,
    transparent: true,
  });
  steamMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.52,
    roughness: 0.25,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const waterMarkerMaterial = matte(0x91d7e2, {
    opacity: 0.84,
    roughness: 0.29,
    transparent: true,
  });
  waterMarkerMaterial.depthWrite = false;

  const suctionBranches = branchShellCurves.map((curve, index) => {
    const branch = makeTube(
      curve,
      0.43,
      shellMaterial,
      `stationary-suction-pipe-B-${index + 1}-of-two-to-fork`,
      96,
    );
    root.add(branch);
    return branch;
  });
  const dischargePipe = cylinderBetween(
    new THREE.Vector3(0, 1.22, 0),
    new THREE.Vector3(0, 3.42, 0),
    0.54,
    shellMaterial,
    'stationary-single-discharge-pipe-C-above-fork',
    56,
  );
  root.add(dischargePipe);
  // Brown draws plain pipe mouths and a smooth fork neck: no ink rings.

  const steamPipe = makeTube(
    steamPipeCurve,
    0.17,
    steamPipeMaterial,
    'stationary-jet-pipe-A-entering-behind-right-B-at-fork',
    92,
  );
  root.add(steamPipe);
  const steamCore = makeTube(
    steamPipeCurve,
    0.070,
    steamMaterial,
    'steam-inside-A-to-unobstructed-central-nozzle',
    92,
  );
  root.add(steamCore);
  const steamJet = cylinderBetween(
    nozzleTip,
    new THREE.Vector3(0, 3.18, 0),
    0.070,
    steamMaterial,
    'upward-steam-jet-on-centerline-of-C',
    28,
  );
  root.add(steamJet);

  const waterStreams = waterCurves.map((curve, index) => {
    const stream = makeTube(
      curve,
      0.070,
      waterMaterial,
      `unbroken-water-current-${index + 1}-of-four-through-B-fork-C`,
      100,
    );
    root.add(stream);
    return stream;
  });

  const basin = new THREE.Mesh(
    new THREE.BoxGeometry(4.20, 0.18, 2.45),
    jointMaterial,
  );
  basin.position.y = -2.96;
  basin.userData.role = 'fixed-water-source-basin-under-two-B-mouths';
  root.add(basin);
  const basinWater = new THREE.Mesh(
    new THREE.BoxGeometry(3.95, 0.055, 2.20),
    waterMaterial,
  );
  basinWater.position.y = -2.84;
  basinWater.userData.role = 'water-surface-feeding-both-suction-branches';
  root.add(basinWater);

  const steamMarkers = [];
  for (let index = 0; index < steamMarkerCount; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.070, 16, 11),
      steamMaterial,
    );
    marker.userData.role = `steam-A-marker-${index + 1}`;
    root.add(marker);
    steamMarkers.push(marker);
  }
  const waterMarkers = [];
  for (let pathIndex = 0; pathIndex < waterCurves.length;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < waterMarkersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.084, 16, 11),
        waterMarkerMaterial,
      );
      marker.userData.role =
        `water-path-${pathIndex + 1}-marker-${markerIndex + 1}`;
      root.add(marker);
      waterMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      cycleTime,
      inletMomentumNewton,
      mixedSpeedMetrePerSecond,
      mixingPressurePascal,
      outletMomentumNewton,
      phase: cycleTime / cycleDuration,
      steamMassFlowKilogramPerSecond,
      totalMassFlowKilogramPerSecond,
      totalWaterMassFlowKilogramPerSecond,
      waterMassFlowPerBranchKilogramPerSecond,
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
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'lansdell-steam-siphon-pump-with-unobstructed-central-jet-at-y-fork-twin-suction-branches-and-single-unbroken-upper-discharge',
    blocks: {
      basin,
      basinWater,
      dischargePipe,
      steamCore,
      steamJet,
      steamMarkers,
      steamPipe,
      suctionBranches,
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
        'The steady visual state specifies the fork pressure and uses choked ideal-steam flow, equal branch suction, and one-dimensional equal-pressure momentum mixing. Startup air purge, condensation, diffuser recovery, turbulence, cavitation, pipe friction, leakage, unequal source heads, and downstream back-pressure are not integrated.',
      markerContinuity:
        'Every marker follows one complete A-to-C or B-to-C curve by arc length with getPointAt and shrinks continuously to zero at both recycling endpoints.',
      unbrokenCurrent:
        'Each water path is one continuous spline from a lower B mouth, around the central A nozzle, across the fork, and through C; no marker teleports between separately animated pipe pieces.',
    },
    fidelity: 'authored',
    flowPaths: {
      branchShellCurves,
      steamFlowCurve,
      steamPipeCurve,
      waterCurves,
    },
    geometry,
    mechanism:
      'Lansdell’s stationary steam siphon has two separate lower suction pipes B that curve inward as a symmetric Y and join one upper discharge C. Jet pipe A descends outside the right branch, passes behind it into the open fork, turns upward, and ends on the C centerline. Its narrow steam jet occupies only the middle of the fork; equal water currents rise unobstructed on both sides, merge around the jet, and continue through C without a break. There are no mechanical moving parts.',
    motion: {
      branchFlowDirections: [
        new THREE.Vector3(0.35, 1, 0).normalize(),
        new THREE.Vector3(-0.35, 1, 0).normalize(),
      ],
      cycleDuration,
      dischargeDirection: new THREE.Vector3(0, 1, 0),
      steamDirectionAtNozzle: new THREE.Vector3(0, 1, 0),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 476 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate476: {
        approximateDischargeCCenterPixels: [257, 78],
        approximateJetNozzlePixels: [255, 231],
        approximateLeftBPipeCenterPixels: [139, 406],
        approximateRightBPipeCenterPixels: [355, 406],
        approximateSteamSupplyTopPixels: [390, 205],
        approximateYForkCenterPixels: [258, 289],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is the jet pipe',
          'B and B are two suction pipes',
          'the two B pipes have a forked connection with discharge C',
          'A enters at the fork without obstructing upward water',
          'water moves upward in an unbroken current',
        ],
        engravingEvidence:
          'Brown’s section shows two widely separated vertical B legs curving symmetrically into one narrow C neck, while a separate right-side supply bends behind the right B wall to an upward-facing A nozzle in the open fork.',
        historicalCorroboration:
          'The official catalogue of the United States products at Paris in 1867 lists the Steam Siphon Company, H. S. Lansdell superintendent, New York, exhibiting a steam syphon pump and railroad-station pump model.',
        patentIdentityDisclosure:
          'Brown calls this Lansdell’s patent but gives no patent number or claims, and the 1867 catalogue identifies Lansdell as company superintendent rather than expressly as inventor. No patent identifier is inferred.',
        reconstructionDisclosure:
          'All dimensions, SI states, 0.9 m lift, coefficients, branch bores, streamlines, frame colors, and display timing are independently engineered and exposed. Twin suction legs, their Y fork, single discharge, rear-entering central jet, unobstructed annular water route, unbroken upward current, and lack of moving parts are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      paris1867CatalogueUrl:
        'https://upload.wikimedia.org/wikipedia/commons/a/ac/Official_catalogue_of_the_products_of_the_United_States_of_America_exhibited_at_Paris_1867_-_with_statistical_notices_-_catalogue_in_English_%3D_catalogue_fran%C3%A7ais_%3D_deutscher_Catalog_%28IA_gri_33125008624427%29.pdf',
      plate: 'Brown 1868, Movement 476',
    },
    stateAtTime,
    thermodynamics: {
      primaryNozzleChoked: mixingPressureRatio < criticalPressureRatio,
      steamMassFlowEquation:
        'm_s=Cd*A*p0/sqrt(R*T0)*sqrt(gamma)*(2/(gamma+1))^((gamma+1)/(2*(gamma-1)))',
    },
    transmission: {
      equalBranchFlow:
        'm_water_total=2*m_water_branch under equal source level, bore, coefficient, and fork pressure',
      momentumEquation:
        'm_s*v_s+m_water_total*v_B=(m_s+m_water_total)*v_C',
      suctionEquation:
        'v_B=Cd_w*sqrt(2*g*((p_atm-p_fork)/(rho_w*g)-lift))',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.25, -3.15, -1.52),
    new THREE.Vector3(2.52, 3.66, 1.52),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(7.2, 3.8, 9.4);
  root.userData.groundFloorY = -3.15;
  correctEjectorTrapParts(root,476,update);
  markShadows(root);
  basin.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSteamSiphonPumpMovement(movement) {
  if (movement.id !== 476) return null;
  return lansdellSteamSiphonPump(movement);
}
