import * as THREE from 'three';
import {
  PALETTE,
  makePulley,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

import { correctGasometerWorkingParts } from './gasometer-working-parts.js';

const FULL_TURN = Math.PI * 2;

function cylinderBetween(start, end, radius, material, role, sides = 36) {
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

function annularPrism(innerRadius, outerRadius, height, material, role) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const prism = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 64,
      depth: height,
      steps: 1,
    }),
    material,
  );
  prism.geometry.translate(0, 0, -height / 2);
  prism.rotation.x = Math.PI / 2;
  prism.userData.role = role;
  return prism;
}

function upperHemisphere(radius, verticalScale, material, role) {
  const hemisphere = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius,
      64,
      24,
      0,
      FULL_TURN,
      0,
      Math.PI / 2,
    ),
    material,
  );
  hemisphere.scale.y = verticalScale;
  hemisphere.userData.role = role;
  return hemisphere;
}

function ropeArc(center, radius, material, role) {
  const points = [];
  for (let index = 0; index <= 40; index += 1) {
    const angle = index * Math.PI / 40;
    points.push(new THREE.Vector3(
      center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle),
      center.z,
    ));
  }
  const arc = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      80,
      0.052,
      9,
      false,
    ),
    material,
  );
  arc.userData.role = role;
  return arc;
}

function singleLiftCounterweightedGasometer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const sceneUnitsPerMetre = 8 / 3;

  // Exposed SI reconstruction. Brown specifies the topology and qualitative
  // action but no size, mass, gas state, pressure, timing, or guide details.
  const bellRadiusMetre = 0.75;
  const bellAreaSquareMetre = Math.PI * bellRadiusMetre ** 2;
  const bellMassKilogram = 300;
  const counterweightCount = 2;
  const counterweightMassKilogram = 60;
  const gravityMetrePerSecondSquared = 9.80665;
  const waterDensityKilogramPerCubicMetre = 998;
  const atmosphericPressurePascal = 101325;
  const gasTemperatureKelvin = 293.15;
  const universalGasConstantJoulePerMoleKelvin = 8.314462618;
  const physicalStrokeMetre = 0.45;
  const minimumGasVolumeCubicMetre = 0.70;

  const residualSupportedMassKilogram = bellMassKilogram
    - counterweightCount * counterweightMassKilogram;
  const gasGaugePressurePascal = residualSupportedMassKilogram
    * gravityMetrePerSecondSquared / bellAreaSquareMetre;
  const gasAbsolutePressurePascal = atmosphericPressurePascal
    + gasGaugePressurePascal;
  const waterLevelDifferenceMetre = gasGaugePressurePascal
    / (waterDensityKilogramPerCubicMetre
      * gravityMetrePerSecondSquared);
  const maximumGasVolumeCubicMetre = minimumGasVolumeCubicMetre
    + bellAreaSquareMetre * physicalStrokeMetre;
  const pressureChangePerAddedKilogramEachCounterweightPascal =
    -counterweightCount * gravityMetrePerSecondSquared
    / bellAreaSquareMetre;

  const externalWaterSurfaceY = 0.20;
  const internalWaterSurfaceY = externalWaterSurfaceY
    - waterLevelDifferenceMetre * sceneUnitsPerMetre;
  const bellMinimumY = -0.05;
  const bellStrokeSceneUnit = physicalStrokeMetre * sceneUnitsPerMetre;
  const bellLocalRimY = -1.35;
  const bellLocalShoulderY = 0.95;
  const bellLocalRopeAttachmentY = 1.23;
  const highestBellRimY = bellMinimumY + bellStrokeSceneUnit
    + bellLocalRimY;
  const minimumInternalSealDepthMetre = (
    internalWaterSurfaceY - highestBellRimY
  ) / sceneUnitsPerMetre;

  const pulleyRadiusSceneUnit = 0.46;
  const pulleyCenters = [
    new THREE.Vector3(-2.48, 3.35, 0),
    new THREE.Vector3(2.48, 3.35, 0),
  ];
  const baseCounterweightY = 1.15;
  const counterweightTopOffsetY = 0.48;
  const constantRopeLengthSceneUnit = pulleyCenters[0].y
    - (bellMinimumY + bellLocalRopeAttachmentY)
    + Math.PI * pulleyRadiusSceneUnit
    + pulleyCenters[0].y
    - (baseCounterweightY + counterweightTopOffsetY);
  const maximumVolumeFlowCubicMetrePerSecond = bellAreaSquareMetre
    * physicalStrokeMetre * Math.PI / cycleDuration;

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const angle = FULL_TURN * phase;
    const fillFraction = 0.5 * (1 - Math.cos(angle));
    const fillFractionRatePerSecond = Math.PI / cycleDuration
      * Math.sin(angle);
    const bellLiftMetre = physicalStrokeMetre * fillFraction;
    const bellVelocityMetrePerSecond = physicalStrokeMetre
      * fillFractionRatePerSecond;
    const bellLiftSceneUnit = bellLiftMetre * sceneUnitsPerMetre;
    const gasVolumeCubicMetre = minimumGasVolumeCubicMetre
      + bellAreaSquareMetre * bellLiftMetre;
    const netGasVolumeFlowCubicMetrePerSecond = bellAreaSquareMetre
      * bellVelocityMetrePerSecond;
    const inletGasVolumeFlowCubicMetrePerSecond = Math.max(
      0,
      netGasVolumeFlowCubicMetrePerSecond,
    );
    const outletGasVolumeFlowCubicMetrePerSecond = Math.max(
      0,
      -netGasVolumeFlowCubicMetrePerSecond,
    );
    const gasMoles = gasAbsolutePressurePascal * gasVolumeCubicMetre
      / (universalGasConstantJoulePerMoleKelvin
        * gasTemperatureKelvin);
    const netMolarFlowMolePerSecond = gasAbsolutePressurePascal
      * netGasVolumeFlowCubicMetrePerSecond
      / (universalGasConstantJoulePerMoleKelvin
        * gasTemperatureKelvin);
    const flowFraction = maximumVolumeFlowCubicMetrePerSecond > 0
      ? Math.abs(netGasVolumeFlowCubicMetrePerSecond)
        / maximumVolumeFlowCubicMetrePerSecond
      : 0;
    const rising = netGasVolumeFlowCubicMetrePerSecond > 1e-14;
    const falling = netGasVolumeFlowCubicMetrePerSecond < -1e-14;
    return {
      bellLiftMetre,
      bellLiftSceneUnit,
      bellVelocityMetrePerSecond,
      counterweightY: baseCounterweightY - bellLiftSceneUnit,
      cycleTime,
      falling,
      fillFraction,
      fillFractionRatePerSecond,
      flowFraction,
      gasMoles,
      gasVolumeCubicMetre,
      inletGasVolumeFlowCubicMetrePerSecond,
      inletMarkerTravelTurns: phase <= 0.5 ? 2 * fillFraction : 2,
      netGasVolumeFlowCubicMetrePerSecond,
      netMolarFlowMolePerSecond,
      outletGasVolumeFlowCubicMetrePerSecond,
      outletMarkerTravelTurns: phase < 0.5 ? 0 : 2 * (1 - fillFraction),
      phase,
      pulleyAngularDisplacementRadian:
        bellLiftSceneUnit / pulleyRadiusSceneUnit,
      rising,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const bellMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    opacity: 0.64,
    roughness: 0.35,
    side: THREE.DoubleSide,
    transparent: true,
  });
  bellMaterial.depthWrite = false;
  const tankMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    opacity: 0.29,
    roughness: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
  });
  tankMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.41,
    roughness: 0.25,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const gasMaterial = matte(PALETTE.driver, {
    opacity: 0.18,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  gasMaterial.depthWrite = false;
  const ropeMaterial = matte(PALETTE.ink, {
    metalness: 0.08,
    roughness: 0.67,
  });
  const weightMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.43,
  });
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.90,
    roughness: 0.25,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const tankB = new THREE.Group();
  tankB.userData.role = 'fixed-water-seal-tank-B';
  const tankWall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.70, 2.70, 2.20, 72, 1, true),
    tankMaterial,
  );
  tankWall.position.y = -0.88;
  tankWall.userData.role = 'transparent-fixed-side-wall-of-tank-B';
  const tankBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.70, 2.70, 0.18, 72),
    frameMaterial,
  );
  tankBottom.position.y = -2.03;
  tankBottom.userData.role = 'fixed-bottom-of-water-tank-B';
  const tankTopRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.70, 0.095, 12, 72),
    darkMaterial,
  );
  tankTopRim.rotation.x = Math.PI / 2;
  tankTopRim.position.y = 0.22;
  tankTopRim.userData.role = 'fixed-top-rim-of-tank-B';
  tankB.add(tankWall, tankBottom, tankTopRim);
  root.add(tankB);

  const outerAnnularWater = annularPrism(
    1.93,
    2.58,
    2.02,
    waterMaterial,
    'outer-water-annulus-at-atmospheric-level',
  );
  outerAnnularWater.position.y = externalWaterSurfaceY - 1.01;
  const innerWater = new THREE.Mesh(
    new THREE.CylinderGeometry(1.89, 1.89, 1.92, 64),
    waterMaterial,
  );
  innerWater.position.y = internalWaterSurfaceY - 0.96;
  innerWater.userData.role =
    'inner-water-column-depressed-by-constant-gas-pressure-head';
  root.add(outerAnnularWater, innerWater);

  const bellA = new THREE.Group();
  bellA.userData.role =
    'one-open-bottomed-inverted-vessel-A-rising-in-water-tank';
  const bellSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(2.00, 2.00, 2.30, 72, 1, true),
    bellMaterial,
  );
  bellSkirt.position.y = (bellLocalRimY + bellLocalShoulderY) / 2;
  bellSkirt.userData.role = 'open-bottomed-cylindrical-skirt-of-A';
  const bellCrown = upperHemisphere(
    2.00,
    0.43,
    bellMaterial,
    'closed-domed-crown-of-vessel-A',
  );
  bellCrown.position.y = bellLocalShoulderY;
  const bellBottomRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.00, 0.075, 10, 72),
    darkMaterial,
  );
  bellBottomRim.rotation.x = Math.PI / 2;
  bellBottomRim.position.y = bellLocalRimY;
  bellBottomRim.userData.role =
    'submerged-open-lower-rim-maintaining-water-seal';
  const bellCrownBand = new THREE.Mesh(
    new THREE.TorusGeometry(2.00, 0.070, 10, 72),
    darkMaterial,
  );
  bellCrownBand.rotation.x = Math.PI / 2;
  bellCrownBand.position.y = bellLocalShoulderY;
  bellCrownBand.userData.role = 'crown-to-skirt-seam-of-A';
  const bellRopeLugs = [-1, 1].map((side, index) => {
    const lug = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.28, 0.34),
      darkMaterial,
    );
    lug.position.set(
      side * 2.00,
      bellLocalRopeAttachmentY,
      0,
    );
    lug.userData.role = `rope-lug-on-A-${index + 1}`;
    bellA.add(lug);
    return lug;
  });
  bellA.add(bellSkirt, bellCrown, bellBottomRim, bellCrownBand);
  root.add(bellA);

  const gasCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(1.80, 1.80, 1, 64),
    gasMaterial,
  );
  gasCylinder.userData.role =
    'variable-height-gas-volume-between-inner-water-and-A-crown';
  const gasDome = upperHemisphere(
    1.80,
    0.40,
    gasMaterial,
    'gas-volume-inside-domed-crown-of-A',
  );
  gasDome.position.y = bellLocalShoulderY;
  bellA.add(gasDome);
  root.add(gasCylinder);

  const pipeCentersX = [-0.48, 0.48];
  const gasPipes = pipeCentersX.map((x, index) => {
    const pipe = new THREE.Group();
    pipe.userData.role = index === 0
      ? 'fixed-left-gas-inlet-through-bottom-of-B'
      : 'fixed-right-gas-outlet-through-bottom-of-B';
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 2.55, 36, 1, true),
      frameMaterial,
    );
    shell.position.set(x, -0.80, 0);
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 2.58, 28),
      gasMaterial,
    );
    bore.position.set(x, -0.80, 0);
    shell.userData.role = `${index === 0 ? 'inlet' : 'outlet'}-pipe-shell`;
    bore.userData.role = `${index === 0 ? 'inlet' : 'outlet'}-gas-core`;
    pipe.add(shell, bore);
    root.add(pipe);
    return { bore, pipe, shell };
  });

  const guidePosts = pulleyCenters.map((center, index) => {
    const post = cylinderBetween(
      new THREE.Vector3(center.x, -2.04, -0.24),
      new THREE.Vector3(center.x, center.y, -0.24),
      0.10,
      frameMaterial,
      `fixed-pulley-guide-post-${index + 1}`,
      28,
    );
    root.add(post);
    return post;
  });
  const pulleys = pulleyCenters.map((center, index) => {
    const pulley = makePulley({
      axis: new THREE.Vector3(0, 0, 1),
      color: PALETTE.accent,
      grooves: 1,
      radius: pulleyRadiusSceneUnit,
      spokes: 4,
      width: 0.28,
    });
    pulley.position.copy(center);
    pulley.userData.role = `fixed-axis-counterweight-pulley-${index + 1}`;
    root.add(pulley);
    return pulley;
  });

  const counterweights = pulleyCenters.map((center, sideIndex) => {
    const side = sideIndex === 0 ? -1 : 1;
    const group = new THREE.Group();
    group.position.set(
      center.x + side * pulleyRadiusSceneUnit,
      baseCounterweightY,
      0,
    );
    group.userData.role = `counterweight-C-${sideIndex + 1}`;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.70, 40),
      weightMaterial,
    );
    core.userData.role = `main-mass-of-counterweight-C-${sideIndex + 1}`;
    group.add(core);
    const adjustmentDisks = [-0.30, 0, 0.30].map((offset, index) => {
      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.12, 40),
        darkMaterial,
      );
      disk.position.y = offset;
      disk.userData.role =
        `removable-pressure-adjustment-disk-${index + 1}-on-C-${sideIndex + 1}`;
      group.add(disk);
      return disk;
    });
    group.userData.adjustmentDisks = adjustmentDisks;
    root.add(group);
    return group;
  });

  const ropeArcs = pulleyCenters.map((center, index) => {
    const arc = ropeArc(
      center,
      pulleyRadiusSceneUnit,
      ropeMaterial,
      `fixed-semicircular-contact-arc-on-pulley-${index + 1}`,
    );
    root.add(arc);
    return arc;
  });
  const innerRopeSegments = [];
  const outerRopeSegments = [];
  for (let index = 0; index < 2; index += 1) {
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 1, 14),
      ropeMaterial,
    );
    inner.userData.role = `taut-inner-rope-segment-${index + 1}-to-A`;
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 1, 14),
      ropeMaterial,
    );
    outer.userData.role = `taut-outer-rope-segment-${index + 1}-to-C`;
    root.add(inner, outer);
    innerRopeSegments.push(inner);
    outerRopeSegments.push(outer);
  }

  const inletFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.48, -2.48, 0.02),
    new THREE.Vector3(-0.48, -1.30, 0.02),
    new THREE.Vector3(-0.48, 0.43, 0.02),
    new THREE.Vector3(-0.68, 0.72, 0.12),
    new THREE.Vector3(-0.92, 0.91, 0.20),
  ], false, 'centripetal');
  const outletFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.92, 0.91, -0.20),
    new THREE.Vector3(0.68, 0.72, -0.12),
    new THREE.Vector3(0.48, 0.43, -0.02),
    new THREE.Vector3(0.48, -1.30, -0.02),
    new THREE.Vector3(0.48, -2.48, -0.02),
  ], false, 'centripetal');
  const markersPerPath = 7;
  const inletMarkers = [];
  const outletMarkers = [];
  for (let index = 0; index < markersPerPath; index += 1) {
    const inletMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 18, 12),
      markerMaterial,
    );
    inletMarker.userData.role = `inlet-gas-marker-${index + 1}`;
    const outletMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 18, 12),
      markerMaterial,
    );
    outletMarker.userData.role = `outlet-gas-marker-${index + 1}`;
    root.add(inletMarker, outletMarker);
    inletMarkers.push(inletMarker);
    outletMarkers.push(outletMarker);
  }

  const markerProgress = (turns, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath,
      1,
    );
  const update = (time) => {
    const state = stateAtTime(time);
    bellA.position.y = bellMinimumY + state.bellLiftSceneUnit;
    const gasTopY = bellA.position.y + bellLocalShoulderY;
    const gasHeight = gasTopY - internalWaterSurfaceY;
    gasCylinder.scale.y = gasHeight;
    gasCylinder.position.y = (gasTopY + internalWaterSurfaceY) / 2;
    for (let index = 0; index < counterweights.length; index += 1) {
      counterweights[index].position.y = state.counterweightY;
      setSpin(
        pulleys[index],
        (index === 0 ? 1 : -1)
          * state.pulleyAngularDisplacementRadian,
      );
      const center = pulleyCenters[index];
      const side = index === 0 ? -1 : 1;
      const innerX = center.x - side * pulleyRadiusSceneUnit;
      const outerX = center.x + side * pulleyRadiusSceneUnit;
      const attachmentY = bellA.position.y + bellLocalRopeAttachmentY;
      const weightTopY = state.counterweightY + counterweightTopOffsetY;
      const innerLength = center.y - attachmentY;
      const outerLength = center.y - weightTopY;
      innerRopeSegments[index].position.set(
        innerX,
        (center.y + attachmentY) / 2,
        0,
      );
      innerRopeSegments[index].scale.y = innerLength;
      outerRopeSegments[index].position.set(
        outerX,
        (center.y + weightTopY) / 2,
        0,
      );
      outerRopeSegments[index].scale.y = outerLength;
    }

    for (let index = 0; index < markersPerPath; index += 1) {
      const inletProgress = markerProgress(
        state.inletMarkerTravelTurns,
        index,
      );
      const outletProgress = markerProgress(
        state.outletMarkerTravelTurns,
        index,
      );
      inletMarkers[index].position.copy(
        inletFlowCurve.getPointAt(inletProgress),
      );
      outletMarkers[index].position.copy(
        outletFlowCurve.getPointAt(outletProgress),
      );
      const inletFade = state.rising
        ? Math.sin(Math.PI * inletProgress) ** 0.55
          * Math.sqrt(state.flowFraction)
        : 0;
      const outletFade = state.falling
        ? Math.sin(Math.PI * outletProgress) ** 0.55
          * Math.sqrt(state.flowFraction)
        : 0;
      inletMarkers[index].scale.setScalar(inletFade);
      outletMarkers[index].scale.setScalar(outletFade);
    }
  };

  const geometry = {
    atmosphericPressurePascal,
    baseCounterweightY,
    bellAreaSquareMetre,
    bellLocalRimY,
    bellLocalRopeAttachmentY,
    bellLocalShoulderY,
    bellMassKilogram,
    bellMinimumY,
    bellRadiusMetre,
    bellStrokeSceneUnit,
    counterweightCount,
    counterweightMassKilogram,
    counterweightTopOffsetY,
    constantRopeLengthSceneUnit,
    cycleDuration,
    externalWaterSurfaceY,
    gasAbsolutePressurePascal,
    gasGaugePressurePascal,
    gasTemperatureKelvin,
    gravityMetrePerSecondSquared,
    highestBellRimY,
    internalWaterSurfaceY,
    markersPerPath,
    maximumGasVolumeCubicMetre,
    maximumVolumeFlowCubicMetrePerSecond,
    minimumGasVolumeCubicMetre,
    minimumInternalSealDepthMetre,
    physicalStrokeMetre,
    pressureChangePerAddedKilogramEachCounterweightPascal,
    pulleyCenters: pulleyCenters.map((center) => center.clone()),
    pulleyRadiusSceneUnit,
    residualSupportedMassKilogram,
    sceneUnitsPerMetre,
    universalGasConstantJoulePerMoleKelvin,
    waterDensityKilogramPerCubicMetre,
    waterLevelDifferenceMetre,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'single-lift-water-sealed-gasometer-with-open-bottom-bell-twin-bottom-gas-pipes-and-two-equal-counterweight-rope-pulley-constraints',
    blocks: {
      bellA,
      bellBottomRim,
      bellCrown,
      bellCrownBand,
      bellRopeLugs,
      bellSkirt,
      counterweights,
      gasCylinder,
      gasDome,
      gasPipes: gasPipes.map(({ pipe }) => pipe),
      guidePosts,
      hollowGasRegion: [gasCylinder, gasDome],
      innerRopeSegments,
      innerWater,
      inletMarkers,
      outerAnnularWater,
      outerRopeSegments,
      outletMarkers,
      pulleys,
      ropeArcs,
      tankB,
      tankBottom,
      tankTopRim,
      tankWall,
    },
    degreesOfFreedom: {
      bellVerticalTranslation: 1,
      counterweightTranslationsSlavedByRopes: 2,
      independentOperatingCoordinates: 1,
      pulleyRotationsSlavedByNoSlip: 2,
    },
    dynamics: {
      assumptionScope:
        'The motion prescribes a smooth fill-and-withdraw cycle and uses quasi-static force balance. Bell and water inertia, guide friction, rope elasticity and mass, pulley inertia, gas temperature change, water slosh, leakage, skirt buoyancy detail, and pipe pressure losses are not integrated.',
      gasInventory:
        'At constant modeled pressure and temperature, n=p_abs*V/(R*T) and dn/dt=p_abs*A_bell*dy/dt/(R*T). Positive flow enters through the left pipe while A rises; equal returned volume leaves through the right pipe while A descends.',
      pressureRegulation:
        'p_gauge*A_bell=(m_bell-2*m_C)*g. Adding equal mass to both C weights reduces delivered pressure by 2*g/A_bell pascals per kilogram; removing it raises pressure.',
      markerContinuity:
        'Each visible marker advances from integrated admitted or withdrawn gas volume, is sampled at equal arc-length with getPointAt, fades at the pipe endpoints, and is hidden on the inactive pipe.',
      ropeConstraint:
        'For each inextensible rope, innerVerticalLength+pi*pulleyRadius+outerVerticalLength is constant. A rise shortens the inner leg, lengthens the C leg equally, lowers C by the same distance, and turns each pulley by ropeTravel/radius without slip.',
      waterSeal:
        'The constant gauge pressure depresses the water inside A by p_gauge/(rho_water*g); the highest open rim remains below that inner surface, so gas cannot bypass the water seal.',
    },
    fidelity: 'authored',
    flowPaths: {
      inletFlowCurve,
      markerProgress,
      outletFlowCurve,
    },
    geometry,
    mechanism:
      'A is one closed-top, open-bottom bell immersed in fixed water tank B. Gas enters through the left of two separate bottom pipes, displaces the gas volume, and raises A while its lower rim remains submerged; withdrawal through the right pipe reverses that motion. Two independent, taut ropes attached to opposite sides of A pass over equal fixed pulleys to equal counterweights C,C. Every rise of A lowers each C by the same distance and turns the two pulleys in opposite senses. The residual bell weight establishes the nearly constant gas pressure, while adding counterweight lowers that pressure and removing it raises pressure.',
    motion: {
      bellDirection: new THREE.Vector3(0, 1, 0),
      counterweightDirections: [
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, -1, 0),
      ],
      leftPulleySenseOnRise: 'counterclockwise',
      rightPulleySenseOnRise: 'clockwise',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 479 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      accumTreatiseUrl:
        'https://classic-literature.net/friedrich-christian-accum-1769-1838/a-practical-treatise-on-gas-light-exhibiting-a-summary-description-of-the-apparatus-and-machinery-best-calculated-for-illuminating-streets-houses-and-manufactories-with-carburetted-hydrogen-or-coal-gas-with-remarks-on-the-utility-safety-and-general-nature-of-this-new-branch-of-civil-economy-by-friedrich-christian-accum-1769-1838/',
      brownPlate479: {
        approximateBellCrownPixels: [258, 79],
        approximateExternalWaterLevelPixels: [261, 309],
        approximateLeftCounterweightPixels: [92, 220],
        approximateLeftPipeTopPixels: [233, 302],
        approximateRightCounterweightPixels: [421, 220],
        approximateRightPipeTopPixels: [275, 301],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is open-bottomed and arranged in water tank B',
          'A is partly counterbalanced by two weights C,C',
          'one bottom pipe admits gas and the other removes it',
          'A rises as gas enters and descends as gas leaves',
          'adding or reducing C weights regulates pressure',
        ],
        engravingEvidence:
          'Brown’s section shows a single domed bell with both lower edges submerged, two separate bottom pipes ending beneath the crown, and mirror-image vertical ropes passing over two upper pulleys to hanging C weights.',
        historicalCorroboration:
          'F. C. Accum’s early gas-light treatise describes an inverted vessel in a water cistern, counterpoise adjustment, and the internal-versus-external water-level difference as the pressure head. Modern Canadian bell-prover procedure likewise sets reference pressure by adjusting the counterweight.',
        reconstructionDisclosure:
          'The A-in-B water seal, two gas pipes, twin C counterweights, rise-on-entry, descent-on-withdrawal, and weight pressure adjustment are source-grounded. Circular 3D form, guides, dimensions, masses, pressure, gas state, streamline shape, colors, and timing are independently engineered and exposed.',
      },
      measurementCanadaBellPressureUrl:
        'https://ised-isde.canada.ca/site/measurement-canada/en/laws-and-requirements/gs-eng-09-011-procedures-calibration-certification-and-use-gas-measuring-apparatus-working-level',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 479',
    },
    stateAtTime,
    thermodynamics: {
      constantPressureInventoryEquation:
        'V=V_min+A_bell*y; n=p_abs*V/(R*T); dn/dt=p_abs*A_bell*dy/dt/(R*T)',
      pressureHeadEquation:
        'Delta_h=p_gauge/(rho_water*g)',
    },
    transmission: {
      counterweightEquation: 'y_C=y_C0-y_A',
      leftPulleyEquation: 'theta_left=+y_A/r_pulley',
      pressureEquation:
        'p_gauge=(m_bell-2*m_C)*g/A_bell',
      rightPulleyEquation: 'theta_right=-y_A/r_pulley',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.50, -2.55, -2.90),
    new THREE.Vector3(3.50, 4.15, 2.90),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(8.5, 4.7, 10.5);
  root.userData.groundFloorY = -2.55;
  correctGasometerWorkingParts(root, 479);
  markShadows(root);
  tankWall.castShadow = false;
  outerAnnularWater.castShadow = false;
  innerWater.castShadow = false;
  root.traverse(object => {
    if (object.material?.transparent) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

function centerGuidedGasometer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const sceneUnitsPerMetre = 2.7;

  // Brown gives the topology but no dimensions, load, pressure, gas state,
  // or timing. These SI values expose one coherent reconstruction.
  const bellRadiusMetre = 0.72;
  const bellAreaSquareMetre = Math.PI * bellRadiusMetre ** 2;
  const bellMassKilogram = 235;
  const gravityMetrePerSecondSquared = 9.80665;
  const waterDensityKilogramPerCubicMetre = 998;
  const atmosphericPressurePascal = 101325;
  const gasTemperatureKelvin = 293.15;
  const universalGasConstantJoulePerMoleKelvin = 8.314462618;
  const physicalStrokeMetre = 0.36;
  const minimumGasVolumeCubicMetre = 0.62;
  const gasGaugePressurePascal = bellMassKilogram
    * gravityMetrePerSecondSquared / bellAreaSquareMetre;
  const gasAbsolutePressurePascal = atmosphericPressurePascal
    + gasGaugePressurePascal;
  const waterLevelDifferenceMetre = gasGaugePressurePascal
    / (waterDensityKilogramPerCubicMetre
      * gravityMetrePerSecondSquared);
  const maximumGasVolumeCubicMetre = minimumGasVolumeCubicMetre
    + bellAreaSquareMetre * physicalStrokeMetre;
  const maximumVolumeFlowCubicMetrePerSecond = bellAreaSquareMetre
    * physicalStrokeMetre * Math.PI / cycleDuration;

  const externalWaterSurfaceY = 0.15;
  const internalWaterSurfaceY = externalWaterSurfaceY
    - waterLevelDifferenceMetre * sceneUnitsPerMetre;
  const tankBottomY = -2.04;
  const bellMinimumY = -0.10;
  const bellStrokeSceneUnit = physicalStrokeMetre * sceneUnitsPerMetre;
  const bellLocalRimY = -1.35;
  const bellLocalShoulderY = 0.85;
  const highestBellRimY = bellMinimumY + bellStrokeSceneUnit
    + bellLocalRimY;
  const minimumInternalSealDepthMetre = (
    internalWaterSurfaceY - highestBellRimY
  ) / sceneUnitsPerMetre;

  const fixedTubeOuterRadiusMetre = 0.11;
  const movingTubeInnerRadiusMetre = 0.13;
  const movingTubeOuterRadiusMetre = 0.165;
  const fixedTubeOuterRadiusSceneUnit = fixedTubeOuterRadiusMetre
    * sceneUnitsPerMetre;
  const movingTubeInnerRadiusSceneUnit = movingTubeInnerRadiusMetre
    * sceneUnitsPerMetre;
  const movingTubeOuterRadiusSceneUnit = movingTubeOuterRadiusMetre
    * sceneUnitsPerMetre;
  const guideRadialClearanceMetre = movingTubeInnerRadiusMetre
    - fixedTubeOuterRadiusMetre;
  const fixedTubeBottomY = tankBottomY;
  const fixedTubeTopY = 3.50;
  const fixedTubeLengthSceneUnit = fixedTubeTopY - fixedTubeBottomY;
  const movingTubeLocalBottomY = -1.31;
  const movingTubeLocalTopY = 1.73;
  const movingTubeLengthSceneUnit = movingTubeLocalTopY
    - movingTubeLocalBottomY;

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const angle = FULL_TURN * phase;
    const fillFraction = 0.5 * (1 - Math.cos(angle));
    const fillFractionRatePerSecond = Math.PI / cycleDuration
      * Math.sin(angle);
    const bellLiftMetre = physicalStrokeMetre * fillFraction;
    const bellVelocityMetrePerSecond = physicalStrokeMetre
      * fillFractionRatePerSecond;
    const bellLiftSceneUnit = bellLiftMetre * sceneUnitsPerMetre;
    const bellY = bellMinimumY + bellLiftSceneUnit;
    const movingTubeBottomY = bellY + movingTubeLocalBottomY;
    const movingTubeTopY = bellY + movingTubeLocalTopY;
    const guideOverlapSceneUnit = Math.max(
      0,
      Math.min(fixedTubeTopY, movingTubeTopY)
        - Math.max(fixedTubeBottomY, movingTubeBottomY),
    );
    const gasVolumeCubicMetre = minimumGasVolumeCubicMetre
      + bellAreaSquareMetre * bellLiftMetre;
    const netGasVolumeFlowCubicMetrePerSecond = bellAreaSquareMetre
      * bellVelocityMetrePerSecond;
    const inletGasVolumeFlowCubicMetrePerSecond = Math.max(
      0,
      netGasVolumeFlowCubicMetrePerSecond,
    );
    const outletGasVolumeFlowCubicMetrePerSecond = Math.max(
      0,
      -netGasVolumeFlowCubicMetrePerSecond,
    );
    const gasMoles = gasAbsolutePressurePascal * gasVolumeCubicMetre
      / (universalGasConstantJoulePerMoleKelvin
        * gasTemperatureKelvin);
    const netMolarFlowMolePerSecond = gasAbsolutePressurePascal
      * netGasVolumeFlowCubicMetrePerSecond
      / (universalGasConstantJoulePerMoleKelvin
        * gasTemperatureKelvin);
    const flowFraction = Math.abs(netGasVolumeFlowCubicMetrePerSecond)
      / maximumVolumeFlowCubicMetrePerSecond;
    const rising = netGasVolumeFlowCubicMetrePerSecond > 1e-14;
    const falling = netGasVolumeFlowCubicMetrePerSecond < -1e-14;
    return {
      bellLiftMetre,
      bellLiftSceneUnit,
      bellVelocityMetrePerSecond,
      bellY,
      cycleTime,
      falling,
      fillFraction,
      fillFractionRatePerSecond,
      flowFraction,
      gasMoles,
      gasVolumeCubicMetre,
      guideOverlapSceneUnit,
      inletGasVolumeFlowCubicMetrePerSecond,
      inletMarkerTravelTurns: phase <= 0.5 ? 2 * fillFraction : 2,
      movingTubeBottomY,
      movingTubeTopY,
      netGasVolumeFlowCubicMetrePerSecond,
      netMolarFlowMolePerSecond,
      outletGasVolumeFlowCubicMetrePerSecond,
      outletMarkerTravelTurns: phase < 0.5
        ? 0
        : 2 * (1 - fillFraction),
      phase,
      rising,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.23,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const bellMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    opacity: 0.61,
    roughness: 0.34,
    side: THREE.DoubleSide,
    transparent: true,
  });
  bellMaterial.depthWrite = false;
  const guideMaterial = matte(PALETTE.accent, {
    metalness: 0.27,
    roughness: 0.40,
  });
  const tankMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    opacity: 0.28,
    roughness: 0.43,
    side: THREE.DoubleSide,
    transparent: true,
  });
  tankMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.25,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const gasMaterial = matte(PALETTE.driver, {
    opacity: 0.17,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  gasMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.92,
    roughness: 0.24,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const tankB = new THREE.Group();
  tankB.userData.role = 'fixed-water-seal-tank-B';
  const tankWall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.66, 2.66, 2.20, 72, 1, true),
    tankMaterial,
  );
  tankWall.position.y = -0.91;
  tankWall.userData.role = 'transparent-fixed-side-wall-of-tank-B';
  const tankBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.66, 2.66, 0.18, 72),
    frameMaterial,
  );
  tankBottom.position.y = tankBottomY;
  tankBottom.userData.role = 'fixed-bottom-of-water-tank-B';
  const tankTopRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.66, 0.095, 12, 72),
    darkMaterial,
  );
  tankTopRim.rotation.x = Math.PI / 2;
  tankTopRim.position.y = 0.20;
  tankTopRim.userData.role = 'fixed-top-rim-of-tank-B';
  tankB.add(tankWall, tankBottom, tankTopRim);
  root.add(tankB);

  const outerWaterHeight = externalWaterSurfaceY - (tankBottomY + 0.10);
  const outerAnnularWater = annularPrism(
    2.02,
    2.55,
    outerWaterHeight,
    waterMaterial,
    'outer-water-annulus-at-atmospheric-level',
  );
  outerAnnularWater.position.y = (
    externalWaterSurfaceY + tankBottomY + 0.10
  ) / 2;
  const innerWaterHeight = internalWaterSurfaceY - (tankBottomY + 0.10);
  const innerAnnularWater = annularPrism(
    movingTubeOuterRadiusSceneUnit + 0.03,
    1.88,
    innerWaterHeight,
    waterMaterial,
    'inner-water-annulus-depressed-by-bell-gas-pressure',
  );
  innerAnnularWater.position.y = (
    internalWaterSurfaceY + tankBottomY + 0.10
  ) / 2;
  root.add(outerAnnularWater, innerAnnularWater);

  const fixedTubeB = new THREE.Group();
  fixedTubeB.userData.role =
    'fixed-central-tube-b-guiding-integral-moving-sleeve-a';
  const fixedTubeShell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      fixedTubeOuterRadiusSceneUnit,
      fixedTubeOuterRadiusSceneUnit,
      fixedTubeLengthSceneUnit,
      42,
      1,
      true,
    ),
    frameMaterial,
  );
  fixedTubeShell.position.y = (fixedTubeTopY + fixedTubeBottomY) / 2;
  fixedTubeShell.userData.role = 'fixed-hollow-shell-of-central-tube-b';
  const fixedTubeTopRim = new THREE.Mesh(
    new THREE.TorusGeometry(
      fixedTubeOuterRadiusSceneUnit,
      0.045,
      9,
      42,
    ),
    darkMaterial,
  );
  fixedTubeTopRim.rotation.x = Math.PI / 2;
  fixedTubeTopRim.position.y = fixedTubeTopY;
  fixedTubeTopRim.userData.role = 'visible-top-rim-of-fixed-tube-b';
  const fixedTubeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.58, 0.24, 42),
    darkMaterial,
  );
  fixedTubeBase.position.y = tankBottomY - 0.03;
  fixedTubeBase.userData.role = 'fixed-base-securing-tube-b-to-tank';
  fixedTubeB.add(fixedTubeShell, fixedTubeTopRim, fixedTubeBase);
  root.add(fixedTubeB);

  const bellA = new THREE.Group();
  bellA.userData.role =
    'one-open-bottomed-vessel-A-constrained-by-central-telescoping-guide';
  const bellSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(1.98, 1.98, 2.20, 72, 1, true),
    bellMaterial,
  );
  bellSkirt.position.y = (bellLocalRimY + bellLocalShoulderY) / 2;
  bellSkirt.userData.role = 'open-bottomed-cylindrical-skirt-of-A';
  const bellCrown = upperHemisphere(
    1.98,
    0.44,
    bellMaterial,
    'closed-domed-crown-of-vessel-A-around-guide-sleeve',
  );
  bellCrown.position.y = bellLocalShoulderY;
  const bellBottomRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.98, 0.075, 10, 72),
    darkMaterial,
  );
  bellBottomRim.rotation.x = Math.PI / 2;
  bellBottomRim.position.y = bellLocalRimY;
  bellBottomRim.userData.role =
    'submerged-open-lower-rim-maintaining-water-seal';
  const bellCrownBand = new THREE.Mesh(
    new THREE.TorusGeometry(1.98, 0.067, 10, 72),
    darkMaterial,
  );
  bellCrownBand.rotation.x = Math.PI / 2;
  bellCrownBand.position.y = bellLocalShoulderY;
  bellCrownBand.userData.role = 'crown-to-skirt-seam-of-A';

  const movingTubeA = new THREE.Group();
  movingTubeA.userData.role =
    'central-tube-a-permanently-secured-within-vessel-A';
  const movingTubeShell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      movingTubeOuterRadiusSceneUnit,
      movingTubeOuterRadiusSceneUnit,
      movingTubeLengthSceneUnit,
      42,
      1,
      true,
    ),
    guideMaterial,
  );
  movingTubeShell.position.y = (
    movingTubeLocalTopY + movingTubeLocalBottomY
  ) / 2;
  movingTubeShell.userData.role =
    'sliding-outer-shell-of-integral-tube-a-around-b';
  const movingTubeRims = [
    movingTubeLocalBottomY,
    movingTubeLocalTopY,
  ].map((y, index) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(
        movingTubeOuterRadiusSceneUnit,
        0.045,
        9,
        42,
      ),
      darkMaterial,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    rim.userData.role = index === 0
      ? 'lower-sliding-rim-of-tube-a'
      : 'upper-crown-fastening-rim-of-tube-a';
    movingTubeA.add(rim);
    return rim;
  });
  movingTubeA.add(movingTubeShell);
  bellA.add(
    bellSkirt,
    bellCrown,
    bellBottomRim,
    bellCrownBand,
    movingTubeA,
  );
  root.add(bellA);

  const gasAnnulus = annularPrism(
    movingTubeOuterRadiusSceneUnit + 0.05,
    1.78,
    1,
    gasMaterial,
    'variable-height-annular-gas-volume-around-central-guide',
  );
  // Bake the helper's horizontal orientation into this dynamic mesh so its
  // local Y scale changes height, rather than stretching the annulus in Z.
  gasAnnulus.geometry.rotateX(Math.PI / 2);
  gasAnnulus.rotation.x = 0;
  const gasDome = upperHemisphere(
    1.78,
    0.40,
    gasMaterial,
    'gas-volume-under-domed-crown-of-A',
  );
  gasDome.position.y = bellLocalShoulderY;
  bellA.add(gasDome);
  root.add(gasAnnulus);

  const gasPipeCentersX = [-0.68, 0.68];
  const pipeBottomY = -2.48;
  const pipeTopY = 0.12;
  const gasPipes = gasPipeCentersX.map((x, index) => {
    const pipe = new THREE.Group();
    pipe.userData.role = index === 0
      ? 'fixed-left-gas-outlet-through-bottom-of-B'
      : 'fixed-right-gas-inlet-through-bottom-of-B';
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.155,
        0.155,
        pipeTopY - pipeBottomY,
        34,
        1,
        true,
      ),
      frameMaterial,
    );
    shell.position.set(x, (pipeTopY + pipeBottomY) / 2, 0);
    shell.userData.role = index === 0
      ? 'left-outlet-pipe-shell'
      : 'right-inlet-pipe-shell';
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.082,
        0.082,
        pipeTopY - pipeBottomY + 0.02,
        26,
      ),
      gasMaterial,
    );
    bore.position.copy(shell.position);
    bore.userData.role = index === 0
      ? 'left-outlet-gas-core'
      : 'right-inlet-gas-core';
    const topRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.035, 8, 34),
      darkMaterial,
    );
    topRim.rotation.x = Math.PI / 2;
    topRim.position.set(x, pipeTopY, 0);
    topRim.userData.role = index === 0
      ? 'left-outlet-opening-above-inner-water'
      : 'right-inlet-opening-above-inner-water';
    pipe.add(shell, bore, topRim);
    root.add(pipe);
    return { bore, pipe, shell, topRim };
  });

  const inletFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.68, pipeBottomY - 0.12, 0.03),
    new THREE.Vector3(0.68, -1.25, 0.03),
    new THREE.Vector3(0.68, pipeTopY, 0.03),
    new THREE.Vector3(0.78, 0.40, 0.10),
    new THREE.Vector3(1.02, 0.62, 0.19),
  ], false, 'centripetal');
  const outletFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.02, 0.62, -0.19),
    new THREE.Vector3(-0.78, 0.40, -0.10),
    new THREE.Vector3(-0.68, pipeTopY, -0.03),
    new THREE.Vector3(-0.68, -1.25, -0.03),
    new THREE.Vector3(-0.68, pipeBottomY - 0.12, -0.03),
  ], false, 'centripetal');
  const markersPerPath = 7;
  const inletMarkers = [];
  const outletMarkers = [];
  for (let index = 0; index < markersPerPath; index += 1) {
    const inletMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 18, 12),
      markerMaterial,
    );
    inletMarker.userData.role = `right-inlet-gas-marker-${index + 1}`;
    const outletMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 18, 12),
      markerMaterial,
    );
    outletMarker.userData.role = `left-outlet-gas-marker-${index + 1}`;
    root.add(inletMarker, outletMarker);
    inletMarkers.push(inletMarker);
    outletMarkers.push(outletMarker);
  }
  const markerProgress = (turns, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath,
      1,
    );

  const update = (time) => {
    const state = stateAtTime(time);
    bellA.position.y = state.bellY;
    const gasTopY = state.bellY + bellLocalShoulderY;
    const gasHeight = gasTopY - internalWaterSurfaceY;
    gasAnnulus.scale.y = gasHeight;
    gasAnnulus.position.y = (gasTopY + internalWaterSurfaceY) / 2;
    for (let index = 0; index < markersPerPath; index += 1) {
      const inletProgress = markerProgress(
        state.inletMarkerTravelTurns,
        index,
      );
      const outletProgress = markerProgress(
        state.outletMarkerTravelTurns,
        index,
      );
      inletMarkers[index].position.copy(
        inletFlowCurve.getPointAt(inletProgress),
      );
      outletMarkers[index].position.copy(
        outletFlowCurve.getPointAt(outletProgress),
      );
      const inletFade = state.rising
        ? Math.sin(Math.PI * inletProgress) ** 0.55
          * Math.sqrt(state.flowFraction)
        : 0;
      const outletFade = state.falling
        ? Math.sin(Math.PI * outletProgress) ** 0.55
          * Math.sqrt(state.flowFraction)
        : 0;
      inletMarkers[index].scale.setScalar(inletFade);
      outletMarkers[index].scale.setScalar(outletFade);
    }
  };

  const geometry = {
    atmosphericPressurePascal,
    bellAreaSquareMetre,
    bellLocalRimY,
    bellLocalShoulderY,
    bellMassKilogram,
    bellMinimumY,
    bellRadiusMetre,
    bellStrokeSceneUnit,
    cycleDuration,
    externalWaterSurfaceY,
    fixedTubeBottomY,
    fixedTubeLengthSceneUnit,
    fixedTubeOuterRadiusMetre,
    fixedTubeOuterRadiusSceneUnit,
    fixedTubeTopY,
    gasAbsolutePressurePascal,
    gasGaugePressurePascal,
    gasTemperatureKelvin,
    gravityMetrePerSecondSquared,
    guideRadialClearanceMetre,
    highestBellRimY,
    internalWaterSurfaceY,
    markersPerPath,
    maximumGasVolumeCubicMetre,
    maximumVolumeFlowCubicMetrePerSecond,
    minimumGasVolumeCubicMetre,
    minimumInternalSealDepthMetre,
    movingTubeInnerRadiusMetre,
    movingTubeInnerRadiusSceneUnit,
    movingTubeLengthSceneUnit,
    movingTubeLocalBottomY,
    movingTubeLocalTopY,
    movingTubeOuterRadiusMetre,
    movingTubeOuterRadiusSceneUnit,
    physicalStrokeMetre,
    pipeBottomY,
    pipeTopY,
    sceneUnitsPerMetre,
    tankBottomY,
    universalGasConstantJoulePerMoleKelvin,
    waterDensityKilogramPerCubicMetre,
    waterLevelDifferenceMetre,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'center-guided-water-sealed-gasometer-with-open-bottom-bell-integral-sliding-sleeve-a-fixed-tube-b-and-opposed-bottom-gas-pipes',
    blocks: {
      bellA,
      bellBottomRim,
      bellCrown,
      bellCrownBand,
      bellSkirt,
      fixedTubeB,
      fixedTubeBase,
      fixedTubeShell,
      fixedTubeTopRim,
      gasAnnulus,
      gasDome,
      gasPipes: gasPipes.map(({ pipe }) => pipe),
      innerAnnularWater,
      inletMarkers,
      movingTubeA,
      movingTubeRims,
      movingTubeShell,
      outerAnnularWater,
      outletMarkers,
      tankB,
      tankBottom,
      tankTopRim,
      tankWall,
    },
    degreesOfFreedom: {
      bellAndIntegralTubeVerticalTranslation: 1,
      independentOperatingCoordinates: 1,
      lateralTranslationsConstrainedByGuide: 2,
      movingTubeSeparateMotionRelativeToBell: 0,
    },
    dynamics: {
      assumptionScope:
        'The gas flow prescribes a smooth fill-and-withdraw cycle and the pressure balance is quasi-static. Bell and water inertia, guide friction, gas-temperature change, water slosh, leakage, skirt buoyancy detail, and pipe losses are not integrated.',
      gasInventory:
        'At constant modeled pressure and temperature, V=V_min+A_bell*y and n=p_abs*V/(R*T). Gas entering through the right pipe raises A; gas leaving through the left pipe lowers it.',
      guideConstraint:
        'Tube a is a rigid child of vessel A and remains coaxial with fixed tube b. Its exposed radial clearance is positive and its axial overlap remains equal to the full sleeve length throughout the modeled stroke.',
      markerContinuity:
        'Markers advance from integrated admitted or withdrawn volume, use getPointAt for equal arc-length sampling, fade at both pipe endpoints, and remain hidden on the inactive pipe.',
      pressureBalance:
        'With no counterweights shown in Movement 480, the reconstruction uses p_gauge*A_bell=m_bell*g; the resulting internal water depression is p_gauge/(rho_water*g).',
      waterSeal:
        'The open lower rim of A stays below the depressed internal water surface at every lift, so the annular water path around tube a remains a gas seal.',
    },
    fidelity: 'authored',
    flowPaths: {
      inletFlowCurve,
      markerProgress,
      outletFlowCurve,
    },
    geometry,
    mechanism:
      'One closed-top, open-bottom vessel A rises and falls in water tank B. A central tube a is permanently secured within A, so it translates with the bell and slides coaxially over the taller fixed tube b anchored at the center of the tank. This telescoping pair guides A without the ropes, pulleys, or counterweights used in Movement 479. The right bottom pipe admits gas above the depressed inner water surface and raises A; the left bottom pipe withdraws gas and lowers A. The submerged bell rim preserves the water seal throughout the stroke.',
    motion: {
      bellDirection: new THREE.Vector3(0, 1, 0),
      fixedTubeBMotion: 'none',
      movingTubeAMotion: 'rigidly identical to vessel A',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 480 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate480: {
        approximateBellCrownPixels: [261, 128],
        approximateFixedTubeBPixels: [246, 213],
        approximateLeftOutletTopPixels: [191, 279],
        approximateMovingTubeAPixels: [276, 215],
        approximateRightInletTopPixels: [319, 279],
        approximateWaterLevelPixels: [263, 283],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the apparatus is another kind of gasometer',
          'the moving vessel is A',
          'central tube a is permanently secured within A',
          'tube a slides on fixed tube b',
          'fixed tube b stands in the center of the tank',
        ],
        engravingEvidence:
          'Brown’s section shows one domed open-bottom bell A in water tank B, a narrow moving sleeve a surrounding a taller fixed central tube b, no external counterweight gear, and two distinct bottom pipes whose arrows show right-side admission and left-side withdrawal.',
        reconstructionDisclosure:
          'The A-in-B water seal, integral sleeve a, fixed central tube b, absence of counterweights, and two pipe directions are source-grounded. Circular 3D form, guide clearance, dimensions, bell mass, pressure, gas state, colors, streamline shape, and timing are independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 480',
      publicDomainBookScanUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c3/Five_hundred_and_seven_mechanial_movements%2C_embracing_all_those_which_are_most_important_in_dynamics%2C_hydraulics%2C_hydrostatics%2C_pneumatics%2C_steam_engines%2C_mill_and_other_gearing_.._%28IA_fivehundredseven02brow%29.pdf',
    },
    stateAtTime,
    thermodynamics: {
      constantPressureInventoryEquation:
        'V=V_min+A_bell*y; n=p_abs*V/(R*T); dn/dt=p_abs*A_bell*dy/dt/(R*T)',
      pressureHeadEquation:
        'Delta_h=p_gauge/(rho_water*g)',
    },
    transmission: {
      guideEquation:
        'x_a=x_b=0; z_a=z_b=0; y_a=y_A; clearance=r_a_inner-r_b_outer>0',
      pressureEquation: 'p_gauge=m_bell*g/A_bell',
      volumeEquation: 'V=V_min+A_bell*y_A',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.05, -2.72, -2.85),
    new THREE.Vector3(3.05, 3.72, 2.85),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(8.3, 4.4, 10.4);
  root.userData.groundFloorY = -2.72;
  correctGasometerWorkingParts(root, 480);
  markShadows(root);
  tankWall.castShadow = false;
  outerAnnularWater.castShadow = false;
  innerAnnularWater.castShadow = false;
  root.traverse(object => {
    if (object.material?.transparent) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredGasometerMovement(movement) {
  if (movement.id === 479) return singleLiftCounterweightedGasometer(movement);
  if (movement.id === 480) return centerGuidedGasometer(movement);
  return null;
}
