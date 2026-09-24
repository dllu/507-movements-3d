import { correctAeolipile } from './thermal-steam-working-parts.js';
import { circle, plate, poly, polygonClipping, turned } from './finite-plate-geometry.js';
import { curvedPipeWall, mergePassageParts } from './finite-fluid-passages.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function radialAroundX(angle) {
  return new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
}

function tangentAroundX(angle) {
  return new THREE.Vector3(0, -Math.sin(angle), Math.cos(angle));
}

function makeTube(curve, radius, material, role, tubularSegments = 72) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function cylinderBetween(start, end, radius, material, role, sides = 32) {
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

// Brown draws both hollow risers as straight uprights standing in the
// boiler lid near its rim (here within about 5 degrees of plumb, the most the
// lid radius and the pivot collars allow) and hooking inward only at the globe's pivot ends.
// The finite working-parts correction bends them in from lid ports near the
// centre; replace only that lower crank, keeping its reducer, neck, trunnions
// and bearings.
const RISER_FOOT_X = 1.40;
const RISER_UPPER_X = 1.60;
const RISER_UPPER_Y = 2.42;
const LID_PORT_RADIUS = 0.12;
function straightenSourceRisers(root) {
  const d = root.userData;
  const b = d.blocks;
  const g = d.geometry;
  const lean = (RISER_UPPER_X - RISER_FOOT_X) / (RISER_UPPER_Y - 0.30);
  const portCenterX = RISER_FOOT_X + lean * (0.42 - 0.30);
  for (let i = 0; i < 2; i += 1) {
    const side = i ? 1 : -1;
    const corner = new THREE.Vector3(side * 1.55, g.globeCenter.y, 0);
    const upper = new THREE.Vector3(side * RISER_UPPER_X, RISER_UPPER_Y, 0);
    const bend = new THREE.CurvePath();
    bend.add(new THREE.LineCurve3(
      new THREE.Vector3(side * RISER_FOOT_X, 0.30, 0),
      upper,
    ));
    bend.add(new THREE.CubicBezierCurve3(
      upper,
      new THREE.Vector3(side * RISER_UPPER_X, 2.60, 0),
      new THREE.Vector3(side * 1.64, 2.72, 0),
      corner,
    ));
    const neck = new THREE.LineCurve3(
      new THREE.Vector3(side * 1.48, g.globeCenter.y, 0),
      new THREE.Vector3(side * 1.08, g.globeCenter.y, 0),
    );
    const full = new THREE.CurvePath();
    full.add(bend);
    full.add(new THREE.LineCurve3(corner, g.globeCenter.clone()));
    d.flowPaths.feedCurves[i] = full;
    // Same reducer and neck as the finite correction.
    const reducer = turned(
      [[1.48, 0.055], [1.48, 0.075], [1.55, 0.13], [1.55, 0.09]],
      128,
    ).rotateY(side * Math.PI / 2).translate(0, g.globeCenter.y, 0);
    const pipe = b.fixedFeedPipes[i];
    pipe.geometry.dispose();
    pipe.geometry = mergePassageParts([
      curvedPipeWall(bend, 0.09, 0.13, 112),
      reducer,
      curvedPipeWall(neck, 0.055, 0.075, 8),
    ]);
    const core = b.fixedFeedSteamCores[i];
    core.geometry.dispose();
    core.geometry = new THREE.TubeGeometry(full, 128, 0.045, 12, false);
  }
  const lid = polygonClipping.difference(
    poly(circle([0, 0], 1.52, 256)),
    ...[-1, 1].map((side) =>
      poly(circle([side * portCenterX, 0], LID_PORT_RADIUS, 96))),
  );
  b.boilerLid.geometry.dispose();
  b.boilerLid.geometry = plate(lid, -0.08, 0.08).rotateX(-Math.PI / 2);
  d.geometry.riserLidPortCenterX = portCenterX;
}

function heroAeolipile(movement) {
  const root = new THREE.Group();

  // Brown supplies topology and direction, but no dimensions or operating
  // data. These SI values make the otherwise indeterminate running speed an
  // auditable steady-state calculation instead of a hand-set animation rate.
  const atmosphericPressurePascal = 101325;
  const boilerPressurePascal = 160000;
  const boilerTemperatureKelvin = 390;
  const steamSpecificGasConstant = 461.5;
  const steamHeatCapacityRatio = 1.30;
  const dischargeCoefficient = 0.82;
  const nozzleBoreRadiusMetre = 0.0015;
  const physicalNozzleOrbitRadiusMetre = 0.15;
  const effectiveQuadraticDragCoefficient = 0.008;
  const nozzleCount = 4;
  const nozzlePitch = FULL_TURN / nozzleCount;
  const pressureRatio = atmosphericPressurePascal / boilerPressurePascal;
  const criticalPressureRatio = (2 / (steamHeatCapacityRatio + 1)) ** (
    steamHeatCapacityRatio / (steamHeatCapacityRatio - 1)
  );
  const exitTemperatureKelvin = boilerTemperatureKelvin * pressureRatio ** (
    (steamHeatCapacityRatio - 1) / steamHeatCapacityRatio
  );
  const idealExitSpeedMetrePerSecond = Math.sqrt(
    2 * steamHeatCapacityRatio / (steamHeatCapacityRatio - 1)
      * steamSpecificGasConstant * boilerTemperatureKelvin
      * (1 - pressureRatio ** (
        (steamHeatCapacityRatio - 1) / steamHeatCapacityRatio
      )),
  );
  const exitSteamDensityKilogramPerCubicMetre =
    atmosphericPressurePascal
    / (steamSpecificGasConstant * exitTemperatureKelvin);
  const nozzleFlowAreaSquareMetre = Math.PI * nozzleBoreRadiusMetre ** 2;
  const massFlowPerNozzleKilogramPerSecond = dischargeCoefficient
    * exitSteamDensityKilogramPerCubicMetre
    * nozzleFlowAreaSquareMetre
    * idealExitSpeedMetrePerSecond;
  const totalMassFlowKilogramPerSecond = nozzleCount
    * massFlowPerNozzleKilogramPerSecond;
  const stationaryJetTorqueNewtonMetre = nozzleCount
    * massFlowPerNozzleKilogramPerSecond
    * physicalNozzleOrbitRadiusMetre
    * idealExitSpeedMetrePerSecond;
  const momentumSlopeNewtonMetreSecond = nozzleCount
    * massFlowPerNozzleKilogramPerSecond
    * physicalNozzleOrbitRadiusMetre ** 2;
  const terminalSpeedMagnitude = (
    -momentumSlopeNewtonMetreSecond
    + Math.sqrt(
      momentumSlopeNewtonMetreSecond ** 2
      + 4 * effectiveQuadraticDragCoefficient
        * stationaryJetTorqueNewtonMetre,
    )
  ) / (2 * effectiveQuadraticDragCoefficient);
  const steadyAngularSpeed = -terminalSpeedMagnitude;
  const steadyRevolutionsPerMinute = terminalSpeedMagnitude
    * 60 / FULL_TURN;
  const cycleDuration = FULL_TURN / terminalSpeedMagnitude;

  const globeCenter = new THREE.Vector3(0, 2.72, 0);
  const globeRadius = 1.22;
  const nozzleOrbitRadius = 1.67;
  const nozzleStartRadius = globeRadius * 0.86;
  const sourcePoseNozzleOffset = Math.PI / 8;
  const feedMarkerPassesPerCycle = 2;
  const exhaustMarkerPassesPerCycle = 3;
  const markersPerFeed = 5;
  const markersPerExhaust = 6;

  const reactionStateAtAngle = (
    rotorAngle,
    angularSpeed = steadyAngularSpeed,
    angularAcceleration = 0,
  ) => {
    const nozzles = [];
    let totalJetTorqueNewtonMetre = 0;
    for (let index = 0; index < nozzleCount; index += 1) {
      const localAngle = sourcePoseNozzleOffset + index * nozzlePitch;
      const worldAngle = localAngle + rotorAngle;
      const radial = radialAroundX(worldAngle);
      const tangent = tangentAroundX(worldAngle);
      const localRadial = radialAroundX(localAngle);
      const localTangent = tangentAroundX(localAngle);
      const nozzlePoint = globeCenter.clone().addScaledVector(
        radial,
        nozzleOrbitRadius,
      );
      const nozzleVelocity = tangent.clone().multiplyScalar(
        nozzleOrbitRadius * angularSpeed,
      );
      const nozzleAcceleration = tangent.clone().multiplyScalar(
        nozzleOrbitRadius * angularAcceleration,
      ).addScaledVector(
        radial,
        -nozzleOrbitRadius * angularSpeed ** 2,
      );
      const relativeExitVelocity = tangent.clone().multiplyScalar(
        idealExitSpeedMetrePerSecond,
      );
      const absoluteExitVelocity = tangent.clone().multiplyScalar(
        idealExitSpeedMetrePerSecond
          + angularSpeed * physicalNozzleOrbitRadiusMetre,
      );
      const reactionForceNewton = absoluteExitVelocity.clone()
        .multiplyScalar(-massFlowPerNozzleKilogramPerSecond);
      const physicalLever = radial.clone().multiplyScalar(
        physicalNozzleOrbitRadiusMetre,
      );
      const reactionTorqueNewtonMetre = new THREE.Vector3()
        .crossVectors(physicalLever, reactionForceNewton).x;
      totalJetTorqueNewtonMetre += reactionTorqueNewtonMetre;
      nozzles.push({
        absoluteExitVelocity,
        index,
        jetDirection: tangent.clone(),
        localAngle,
        localNozzlePoint: localRadial.clone().multiplyScalar(
          nozzleOrbitRadius,
        ),
        localRadial,
        localTangent,
        nozzleAcceleration,
        nozzlePoint,
        nozzleVelocity,
        physicalLever,
        radial,
        reactionForceNewton,
        reactionTorqueNewtonMetre,
        relativeExitVelocity,
        tangent,
        worldAngle,
      });
    }
    const dragTorqueNewtonMetre = -effectiveQuadraticDragCoefficient
      * angularSpeed * Math.abs(angularSpeed);
    return {
      angularAcceleration,
      angularSpeed,
      dragTorqueNewtonMetre,
      netTorqueNewtonMetre:
        totalJetTorqueNewtonMetre + dragTorqueNewtonMetre,
      nozzles,
      rotorAngle,
      totalJetTorqueNewtonMetre,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...reactionStateAtAngle(steadyAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    atmosphericPressurePascal,
    boilerPressurePascal,
    boilerTemperatureKelvin,
    criticalPressureRatio,
    cycleDuration,
    dischargeCoefficient,
    effectiveQuadraticDragCoefficient,
    exhaustMarkerPassesPerCycle,
    exitSteamDensityKilogramPerCubicMetre,
    exitTemperatureKelvin,
    feedMarkerPassesPerCycle,
    feedTrunnionPoints: [
      new THREE.Vector3(-globeRadius, globeCenter.y, 0),
      new THREE.Vector3(globeRadius, globeCenter.y, 0),
    ],
    globeCenter: globeCenter.clone(),
    globeRadius,
    idealExitSpeedMetrePerSecond,
    markersPerExhaust,
    markersPerFeed,
    massFlowPerNozzleKilogramPerSecond,
    momentumSlopeNewtonMetreSecond,
    nozzleBoreRadiusMetre,
    nozzleCount,
    nozzleFlowAreaSquareMetre,
    nozzleOrbitRadius,
    nozzlePitch,
    nozzleStartRadius,
    physicalNozzleOrbitRadiusMetre,
    pressureRatio,
    sourcePoseNozzleOffset,
    stationaryJetTorqueNewtonMetre,
    steamHeatCapacityRatio,
    steamSpecificGasConstant,
    steadyAngularSpeed,
    steadyRevolutionsPerMinute,
    terminalSpeedMagnitude,
    totalMassFlowKilogramPerSecond,
  };

  const boilerMaterial = matte(PALETTE.driver, {
    metalness: 0.27,
    roughness: 0.45,
  });
  const rotorMaterial = matte(PALETTE.driven, {
    metalness: 0.25,
    roughness: 0.43,
    opacity: 0.88,
    transparent: true,
  });
  const pipeMaterial = matte(PALETTE.brass, {
    metalness: 0.35,
    roughness: 0.38,
    opacity: 0.86,
    transparent: true,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.35,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.57,
  });
  const steamMaterial = matte(PALETTE.white, {
    opacity: 0.42,
    roughness: 0.25,
    transparent: true,
  });
  steamMaterial.depthWrite = false;
  const steamCoreMaterial = matte(0xc7eef3, {
    opacity: 0.27,
    roughness: 0.20,
    transparent: true,
  });
  steamCoreMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.64,
    roughness: 0.26,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.82,
    roughness: 0.31,
    transparent: true,
  });
  markerMaterial.depthWrite = false;
  const flameMaterial = matte(PALETTE.accent, {
    emissive: 0x6b1908,
    roughness: 0.44,
  });
  flameMaterial.emissive = new THREE.Color(0x6b1908);
  flameMaterial.emissiveIntensity = 0.54;

  const boilerProfile = [
    [0.48, -1.40],
    [0.93, -1.30],
    [1.35, -1.02],
    [1.58, -0.53],
    [1.61, 0.08],
    [1.51, 0.38],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const boiler = new THREE.Mesh(
    new THREE.LatheGeometry(boilerProfile, 72),
    boilerMaterial,
  );
  boiler.userData.role = 'fixed-sealed-lower-steam-boiler';
  root.add(boiler);
  const boilerLid = new THREE.Mesh(
    new THREE.CylinderGeometry(1.52, 1.52, 0.16, 64),
    boilerMaterial,
  );
  boilerLid.position.y = 0.42;
  boilerLid.userData.role = 'fixed-boiler-lid-sealed-around-two-risers';
  root.add(boilerLid);
  const boilerRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.53, 0.075, 10, 72),
    darkMaterial,
  );
  boilerRim.rotation.x = Math.PI / 2;
  boilerRim.position.y = 0.50;
  boilerRim.userData.role = 'fixed-boiler-lid-rim';
  root.add(boilerRim);
  const boilerWater = new THREE.Mesh(
    new THREE.CylinderGeometry(1.32, 1.32, 0.045, 60),
    waterMaterial,
  );
  boilerWater.position.y = 0.16;
  boilerWater.userData.role = 'heated-water-inside-boiler';
  root.add(boilerWater);
  const boilerSteamSpace = new THREE.Mesh(
    new THREE.CylinderGeometry(1.29, 1.29, 0.18, 60),
    steamCoreMaterial,
  );
  boilerSteamSpace.position.y = 0.29;
  boilerSteamSpace.userData.role = 'pressurized-steam-space-under-lid';
  root.add(boilerSteamSpace);

  const feedCurves = [-1, 1].map((side) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.67, 0.38, 0),
    new THREE.Vector3(side * 0.72, 0.76, 0),
    new THREE.Vector3(side * 1.54, 1.08, 0),
    new THREE.Vector3(side * 1.55, 2.32, 0),
    new THREE.Vector3(side * 1.48, 2.62, 0),
    new THREE.Vector3(side * globeRadius, globeCenter.y, 0),
    globeCenter.clone(),
  ], false, 'centripetal'));
  const fixedFeedPipes = [];
  const fixedFeedSteamCores = [];
  for (let index = 0; index < feedCurves.length; index += 1) {
    const sideName = index === 0 ? 'left' : 'right';
    const visiblePipeCurve = new THREE.CatmullRomCurve3(
      feedCurves[index].points.slice(0, -1),
      false,
      'centripetal',
    );
    const pipe = makeTube(
      visiblePipeCurve,
      0.13,
      pipeMaterial,
      `fixed-${sideName}-hollow-steam-riser-and-pivot-feed`,
      86,
    );
    root.add(pipe);
    fixedFeedPipes.push(pipe);
    const core = makeTube(
      feedCurves[index],
      0.056,
      steamCoreMaterial,
      `steam-passage-through-${sideName}-riser-trunnion-and-into-globe`,
      92,
    );
    root.add(core);
    fixedFeedSteamCores.push(core);
  }

  const stationaryBearingCollars = [-1, 1].map((side, index) => {
    const bearing = cylinderBetween(
      new THREE.Vector3(side * 1.47, globeCenter.y, 0),
      new THREE.Vector3(side * 1.28, globeCenter.y, 0),
      0.205,
      darkMaterial,
      `fixed-${index === 0 ? 'left' : 'right'}-pivot-bearing-collar`,
      40,
    );
    root.add(bearing);
    return bearing;
  });

  const rotor = new THREE.Group();
  rotor.position.copy(globeCenter);
  rotor.userData.role =
    'horizontal-axis-rotor-globe-four-bent-nozzles-and-trunnions';
  root.add(rotor);
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(globeRadius, 64, 36),
    rotorMaterial,
  );
  globe.userData.role = 'rotating-hollow-steam-globe';
  rotor.add(globe);
  const globeSteam = new THREE.Mesh(
    new THREE.SphereGeometry(globeRadius * 0.88, 48, 28),
    steamCoreMaterial,
  );
  globeSteam.userData.role = 'steam-volume-inside-rotating-globe';
  rotor.add(globeSteam);
  const pivotManifold = cylinderBetween(
    new THREE.Vector3(-globeRadius * 1.10, 0, 0),
    new THREE.Vector3(globeRadius * 1.10, 0, 0),
    0.073,
    steamMaterial,
    'horizontal-steam-manifold-on-pivot-axis',
    28,
  );
  rotor.add(pivotManifold);
  const rotatingTrunnions = [-1, 1].map((side, index) => {
    const trunnion = cylinderBetween(
      new THREE.Vector3(side * globeRadius * 0.91, 0, 0),
      new THREE.Vector3(side * globeRadius * 1.18, 0, 0),
      0.15,
      pipeMaterial,
      `rotating-${index === 0 ? 'left' : 'right'}-hollow-trunnion`,
      38,
    );
    rotor.add(trunnion);
    return trunnion;
  });
  const rotationBand = new THREE.Mesh(
    new THREE.TorusGeometry(globeRadius * 1.004, 0.035, 8, 88),
    darkMaterial,
  );
  rotationBand.rotation.y = Math.PI / 2;
  rotationBand.userData.role = 'globe-equator-about-horizontal-pivot-axis';
  rotor.add(rotationBand);
  const rotationMarkers = [
    new THREE.Vector3(0.44, 0.91, 0.69),
    new THREE.Vector3(-0.31, -0.72, 0.93),
    new THREE.Vector3(0.68, -0.87, -0.46),
  ].map((direction, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 20, 14),
      markerMaterial,
    );
    marker.position.copy(direction.normalize().multiplyScalar(
      globeRadius * 1.015,
    ));
    marker.userData.role = `visible-globe-rotation-marker-${index + 1}`;
    rotor.add(marker);
    return marker;
  });

  const nozzlePipes = [];
  const nozzleSteamCores = [];
  const nozzleCollars = [];
  const exhaustPlumes = [];
  const exhaustCurves = [];
  for (let index = 0; index < nozzleCount; index += 1) {
    const angle = sourcePoseNozzleOffset + index * nozzlePitch;
    const radial = radialAroundX(angle);
    const tangent = tangentAroundX(angle);
    const start = radial.clone().multiplyScalar(nozzleStartRadius);
    const elbowEnd = radial.clone().multiplyScalar(nozzleOrbitRadius)
      .addScaledVector(tangent, -0.30);
    const nozzlePoint = radial.clone().multiplyScalar(nozzleOrbitRadius);
    const armCurve = new THREE.CurvePath();
    armCurve.add(new THREE.CubicBezierCurve3(
      start,
      radial.clone().multiplyScalar(1.32),
      elbowEnd.clone().addScaledVector(tangent, -0.28),
      elbowEnd,
    ));
    armCurve.add(new THREE.LineCurve3(elbowEnd, nozzlePoint));
    const pipe = makeTube(
      armCurve,
      0.112,
      rotorMaterial,
      `rotating-hollow-bent-steam-arm-${index + 1}-of-four`,
      74,
    );
    rotor.add(pipe);
    nozzlePipes.push(pipe);
    const steamCore = makeTube(
      armCurve,
      0.047,
      steamCoreMaterial,
      `steam-core-through-bent-arm-${index + 1}-of-four`,
      74,
    );
    rotor.add(steamCore);
    nozzleSteamCores.push(steamCore);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.035, 8, 28),
      pipeMaterial,
    );
    collar.position.copy(nozzlePoint);
    collar.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      tangent,
    );
    collar.userData.role = `tangential-steam-outlet-${index + 1}-of-four`;
    rotor.add(collar);
    nozzleCollars.push(collar);
    const plumeCurve = new THREE.CubicBezierCurve3(
      nozzlePoint,
      nozzlePoint.clone().addScaledVector(tangent, 0.34),
      nozzlePoint.clone().addScaledVector(tangent, 0.82)
        .addScaledVector(radial, 0.05),
      nozzlePoint.clone().addScaledVector(tangent, 1.22)
        .addScaledVector(radial, 0.13),
    );
    exhaustCurves.push(plumeCurve);
    const plume = makeTube(
      plumeCurve,
      0.052,
      steamMaterial,
      `quasi-steady-tangential-steam-plume-${index + 1}-of-four`,
      48,
    );
    rotor.add(plume);
    exhaustPlumes.push(plume);
  }

  const feedMarkers = [];
  for (let feedIndex = 0; feedIndex < feedCurves.length; feedIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerFeed;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.066, 16, 11),
        markerMaterial,
      );
      marker.userData.role =
        `steam-feed-${feedIndex + 1}-marker-${markerIndex + 1}`;
      root.add(marker);
      feedMarkers.push({ feedIndex, marker, markerIndex });
    }
  }
  const exhaustMarkers = [];
  for (let nozzleIndex = 0; nozzleIndex < nozzleCount;
    nozzleIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerExhaust;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.074, 16, 11),
        markerMaterial,
      );
      marker.userData.role =
        `exhaust-${nozzleIndex + 1}-marker-${markerIndex + 1}`;
      rotor.add(marker);
      exhaustMarkers.push({ marker, markerIndex, nozzleIndex });
    }
  }

  const handleCurves = [-1, 1].map((side) =>
    new THREE.CubicBezierCurve3(
      new THREE.Vector3(side * 1.49, 0.10, -0.18),
      new THREE.Vector3(side * 2.10, 0.08, -0.18),
      new THREE.Vector3(side * 2.08, -0.72, -0.18),
      new THREE.Vector3(side * 1.39, -0.78, -0.18),
    ));
  const boilerHandles = handleCurves.map((curve, index) => {
    const handle = makeTube(
      curve,
      0.085,
      darkMaterial,
      `fixed-boiler-handle-${index + 1}-of-two`,
      48,
    );
    root.add(handle);
    return handle;
  });

  const hearthRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.06, 1.18, 0.15, 56),
    darkMaterial,
  );
  hearthRing.position.y = -1.53;
  hearthRing.userData.role = 'fixed-hearth-ring-below-boiler';
  root.add(hearthRing);
  const flames = [];
  for (let index = 0; index < 7; index += 1) {
    const angle = index * FULL_TURN / 7;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.48 + 0.08 * (index % 2), 18),
      flameMaterial,
    );
    flame.position.set(
      Math.cos(angle) * 0.66,
      -1.37,
      Math.sin(angle) * 0.66,
    );
    flame.userData.role = `fixed-fire-flame-${index + 1}-of-seven`;
    root.add(flame);
    flames.push(flame);
  }
  // Brown's four cabriole legs leave the lower flank of the boiler, splay
  // outward, drop nearly vertically and turn their feet out again.
  const legProfile = [
    [1.22, -1.08],
    [1.66, -1.27],
    [1.84, -1.62],
    [1.83, -1.98],
    [2.08, -2.16],
  ];
  const standLegs = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI / 4 + index * Math.PI / 2;
    const legCurve = new THREE.CatmullRomCurve3(
      legProfile.map(([radius, height]) => new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
      )),
      false,
      'centripetal',
    );
    const leg = makeTube(
      legCurve,
      0.115,
      frameMaterial,
      `fixed-boiler-stand-leg-${index + 1}-of-four`,
      48,
    );
    root.add(leg);
    standLegs.push(leg);
  }
  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(1.72, 1.82, 0.16, 64),
    frameMaterial,
  );
  foundation.position.y = -2.21;
  foundation.userData.role = 'fixed-aeolipile-foundation';
  root.add(foundation);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.x = state.rotorAngle;
    const phase = state.phase;
    for (const entry of feedMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        phase * feedMarkerPassesPerCycle
          + entry.markerIndex / markersPerFeed,
        1,
      );
      entry.marker.position.copy(
        feedCurves[entry.feedIndex].getPointAt(progress),
      );
      entry.marker.scale.setScalar(Math.sin(Math.PI * progress) ** 0.55);
    }
    for (const entry of exhaustMarkers) {
      const progress = THREE.MathUtils.euclideanModulo(
        phase * exhaustMarkerPassesPerCycle
          + entry.markerIndex / markersPerExhaust,
        1,
      );
      entry.marker.position.copy(
        exhaustCurves[entry.nozzleIndex].getPointAt(progress),
      );
      entry.marker.scale.setScalar(Math.sin(Math.PI * progress) ** 0.55);
    }
  };

  const sourceState = reactionStateAtAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'hero-aeolipile-with-twin-hollow-pivot-risers-horizontal-axis-steam-globe-four-tangential-bent-nozzles-and-momentum-balanced-reaction-speed',
    blocks: {
      boiler,
      boilerHandles,
      boilerLid,
      boilerRim,
      boilerSteamSpace,
      boilerWater,
      exhaustMarkers: exhaustMarkers.map(({ marker }) => marker),
      exhaustPlumes,
      feedMarkers: feedMarkers.map(({ marker }) => marker),
      fixedFeedPipes,
      fixedFeedSteamCores,
      flames,
      foundation,
      globe,
      globeSteam,
      hearthRing,
      nozzleCollars,
      nozzlePipes,
      nozzleSteamCores,
      pivotManifold,
      rotationBand,
      rotationMarkers,
      rotatingTrunnions,
      rotor,
      standLegs,
      stationaryBearingCollars,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 0,
      nozzleAndGlobeIndependent: false,
      operatingDegreesOfFreedom: 1,
      steamFlowIndependentOfBoilerState: false,
    },
    dynamics: {
      assumptionScope:
        'The model is a steady-running momentum and drag balance. Boiler heat-up, water depletion, two-phase boiling, condensation, pivot leakage, transient rotor inertia, turbulence, bearing stick-slip, and useful external load are not integrated.',
      exhaustMarkerContinuity:
        'Markers traverse each current rotor-frame plume by arc length with getPointAt and shrink continuously to zero at both recycling endpoints.',
      feedMarkerContinuity:
        'Markers traverse each complete boiler-to-globe feed curve by arc length with getPointAt and shrink continuously to zero at both recycling endpoints.',
      momentumBalance:
        'Steam enters on the horizontal pivot axis with zero angular momentum. Each outlet reaction is minus mass flow times absolute tangential exit velocity; four equal negative moments balance the positive effective quadratic drag moment at the derived steady speed.',
      runningState: 'steady terminal rotation',
    },
    fidelity: 'authored',
    flowPaths: {
      exhaustCurves,
      feedCurves,
    },
    geometry,
    mechanism:
      'A sealed lower boiler supplies steam through two fixed hollow risers that turn inward as the left and right horizontal trunnion feeds. Steam enters the hollow globe on its pivot axis, divides equally into four radial pipes, follows four equally handed right-angle bends, and exhausts tangent to the nozzle orbit. The four opposite reactions reinforce about the common horizontal axis, so the globe, trunnions, arms, collars, and visible globe markers rotate as one rigid assembly opposite the jets while the boiler, risers, bearings, fire, and stand remain fixed.',
    motion: {
      cycleDuration,
      exhaustDirectionRelativeToRotation: 'opposite',
      physicalSteadyRevolutionsPerMinute: steadyRevolutionsPerMinute,
      pivotAxis: new THREE.Vector3(1, 0, 0),
      rotorDirectionViewedFromPositiveXAxis: 'negative about x',
      rotorRevolutionsPerCycle: -1,
      steadyAngularSpeed,
    },
    reactionStateAtAngle,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 474 HTML marks Animated unavailable and supplies only Brown’s static engraving and caption, so it prescribes no absolute timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      nozzles: sourceState.nozzles.map((nozzle) => ({
        jetDirection: nozzle.jetDirection.clone(),
        nozzlePoint: nozzle.nozzlePoint.clone(),
        worldAngle: nozzle.worldAngle,
      })),
      rotorAngle: 0,
      totalJetTorqueNewtonMetre: sourceState.totalJetTorqueNewtonMetre,
    },
    sourceReference: {
      brownPlate474: {
        approximateBoilerCenterPixels: [259, 370],
        approximateGlobeCenterPixels: [261, 201],
        approximateNozzleTipsPixels: [
          [266, 42],
          [137, 164],
          [339, 191],
          [255, 315],
        ],
        approximatePivotRiserPixels: [
          [215, 306],
          [344, 255],
        ],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a lower vessel is the boiler',
          'two pipes conduct steam to the globular vessel and form its pivots',
          'escaping steam through bent arms revolves the vessel in the arrow direction',
          'the operating principle is the same as Barker’s reaction mill, Movement 438',
        ],
        engravingEvidence:
          'Brown’s perspective engraving shows a lidded round boiler over a fire, two opposed risers meeting a globular rotor on one projected horizontal diameter, and four visible bent outlet arms distributed around the globe.',
        historicalComparison:
          'Bennet Woodcroft’s 1851 translation of Hero, Pneumatics 50, specifies one bent boiler feed and an opposite support pivot, with two bent outlet pipes at opposite ends of a diameter. This model follows Brown’s later plate and caption—two conducting pivot pipes and four pictured outlets—rather than silently replacing Movement 474 with that two-nozzle historical variant.',
        reconstructionDisclosure:
          'Brown gives no dimensions, pressure, temperature, nozzle bore, mass flow, materials, leakage, friction, drag, inertia, load, or speed. The SI boiler state, steam properties, 3 mm outlet bores, 150 mm physical nozzle orbit, discharge coefficient, effective drag coefficient, exact arm spacing, colors, and display normalization are independently engineered and exposed. The horizontal common pivot, twin hollow feeds, rotating globe, four pictured bent arms, tangential escape, and reverse reaction are source-grounded.',
      },
      heroPrimaryTranslation:
        'Hero of Alexandria, Pneumatics 50, translated by Bennet Woodcroft (1851)',
      heroTranslationUrl:
        'https://www.gutenberg.org/cache/epub/77400/pg77400-images.html#Page_72',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 474',
    },
    stateAtTime,
    thermodynamics: {
      choked: pressureRatio <= criticalPressureRatio,
      exitSpeedEquation:
        'v=sqrt(2*gamma/(gamma-1)*R*T0*(1-(p2/p0)^((gamma-1)/gamma)))',
      massFlowEquation: 'm_dot=Cd*rho_exit*A*v',
      pressureRegime: 'subcritical isentropic expansion to atmosphere',
    },
    transmission: {
      dragTorqueEquation: 'tau_drag=-c*omega*abs(omega)',
      equalFlowSplit:
        'each of four nozzles receives one quarter of total modeled steam mass flow',
      jetTorqueEquation:
        'tau_jet=-N*m_dot*r*(v_exit+omega*r)',
      steadySpeedEquation:
        'c*q^2+N*m_dot*r^2*q-N*m_dot*r*v_exit=0, omega=-q',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.42, -2.42, -2.45),
    new THREE.Vector3(2.42, 5.16, 2.45),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 4.3, 9.4);
  root.userData.groundFloorY = -2.42;
  correctAeolipile(root);
  straightenSourceRisers(root);
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredAeolipileMovement(movement) {
  if (movement.id !== 474) return null;
  return heroAeolipile(movement);
}
