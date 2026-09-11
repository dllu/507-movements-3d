import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function smoothStep5First(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 30 * clamped ** 2 * (clamped - 1) ** 2;
}

function smoothStep5Second(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 60 * clamped * (2 * clamped ** 2 - 3 * clamped + 1);
}

function segmentKinematics(
  phase,
  startPhase,
  endPhase,
  startValue,
  endValue,
) {
  if (phase <= startPhase) {
    return { first: 0, second: 0, value: startValue };
  }
  if (phase >= endPhase) {
    return { first: 0, second: 0, value: endValue };
  }
  const duration = endPhase - startPhase;
  const progress = (phase - startPhase) / duration;
  const delta = endValue - startValue;
  return {
    first: delta * smoothStep5First(progress) / duration,
    second: delta * smoothStep5Second(progress) / duration ** 2,
    value: startValue + delta * smoothStep5(progress),
  };
}

function horizontalCylinder(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function horizontalRing(radius, tubeRadius, material) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 56),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function dectolOscillatingColumn(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourcePhase = movement.id === 446 ? 0.77 : 0;
  const freeDescentEndPhase = 0.18;
  const coneBuildEndPhase = 0.52;
  const columnRiseEndPhase = 0.76;
  const coneBreakStartPhase = 0.78;
  const storageDrainStartPhase = 0.80;
  const coneCollapseEndPhase = 0.88;
  const storageDrainEndPhase = 0.96;
  const supplyFlowRate = 0.10;
  const maximumUpperStorageVolume = 0.04;
  const coneMinimumFraction = 0.12;
  const coneCollapsedFraction = 0.08;
  const maximumConeHeight = 0.96;
  const plateTopY = -0.22;
  const nozzleBottomY = 0.58;
  const nozzleTopY = 1.63;
  const reservoirWaterY = 2.19;
  const lowerWaterY = -1.53;
  const groundY = -2.08;

  const coneKinematicsAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < freeDescentEndPhase) {
      return { first: 0, second: 0, value: coneMinimumFraction };
    }
    if (phase < coneBuildEndPhase) {
      return segmentKinematics(
        phase,
        freeDescentEndPhase,
        coneBuildEndPhase,
        coneMinimumFraction,
        1,
      );
    }
    if (phase < coneBreakStartPhase) {
      return { first: 0, second: 0, value: 1 };
    }
    if (phase < coneCollapseEndPhase) {
      return segmentKinematics(
        phase,
        coneBreakStartPhase,
        coneCollapseEndPhase,
        1,
        coneCollapsedFraction,
      );
    }
    return segmentKinematics(
      phase,
      coneCollapseEndPhase,
      1,
      coneCollapsedFraction,
      coneMinimumFraction,
    );
  };

  const upperStorageKinematicsAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < coneBuildEndPhase) {
      return { first: 0, second: 0, value: 0 };
    }
    if (phase < columnRiseEndPhase) {
      return segmentKinematics(
        phase,
        coneBuildEndPhase,
        columnRiseEndPhase,
        0,
        maximumUpperStorageVolume,
      );
    }
    if (phase < storageDrainStartPhase) {
      return {
        first: 0,
        second: 0,
        value: maximumUpperStorageVolume,
      };
    }
    if (phase < storageDrainEndPhase) {
      return segmentKinematics(
        phase,
        storageDrainStartPhase,
        storageDrainEndPhase,
        maximumUpperStorageVolume,
        0,
      );
    }
    return { first: 0, second: 0, value: 0 };
  };

  const modeAtPhase = (phase) => {
    if (phase < freeDescentEndPhase) {
      return 'unobstructed-water-descending-as-in-plate-445';
    }
    if (phase < coneBuildEndPhase) {
      return 'falling-water-forming-cone-on-circular-plate';
    }
    if (phase < columnRiseEndPhase) {
      return 'cone-protruding-into-small-tube-checking-flow-column-rising';
    }
    if (phase < coneBreakStartPhase) {
      return 'checked-cone-and-raised-column-as-in-plate-446';
    }
    if (phase < storageDrainStartPhase) {
      return 'water-cone-giving-way';
    }
    if (phase < coneCollapseEndPhase) {
      return 'collapsed-cone-releasing-accumulated-column';
    }
    if (phase < storageDrainEndPhase) {
      return 'unobstructed-downward-surge-draining-upper-column';
    }
    return 'free-descent-cycle-reset';
  };

  const stateAtCyclePhase = (
    phaseValue,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    const cone = coneKinematicsAtPhase(phase);
    const storage = upperStorageKinematicsAtPhase(phase);
    const upperStorageVolumeRate = storage.first * phaseSpeed;
    const upperStorageVolumeAcceleration = storage.second
      * phaseSpeed ** 2 + storage.first * phaseAcceleration;
    const downwardFlowRate = supplyFlowRate - upperStorageVolumeRate;
    const storageFraction = storage.value / maximumUpperStorageVolume;
    const coneHeight = maximumConeHeight * cone.value;
    const throatPenetration = THREE.MathUtils.clamp(
      (coneHeight - (nozzleBottomY - plateTopY))
        / (maximumConeHeight - (nozzleBottomY - plateTopY)),
      0,
      1,
    );
    return {
      coneAcceleration: maximumConeHeight * (
        cone.second * phaseSpeed ** 2
          + cone.first * phaseAcceleration
      ),
      coneFraction: cone.value,
      coneHeight,
      coneVelocity: maximumConeHeight * cone.first * phaseSpeed,
      downwardFlowRate,
      inputAcceleration,
      inputAngle: FULL_TURN * phase,
      inputSpeed,
      mode: modeAtPhase(phase),
      phase,
      supplyFlowRate,
      throatPenetration,
      upperColumnFraction: storageFraction,
      upperStorageVolume: storage.value,
      upperStorageVolumeAcceleration,
      upperStorageVolumeRate,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => stateAtCyclePhase(
    sourcePhase + inputAngle / FULL_TURN,
    inputSpeed,
    inputAcceleration,
  );

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const outlineMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.28,
    roughness: 0.70,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.73,
    roughness: 0.34,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const coneMaterial = waterMaterial.clone();
  coneMaterial.color.setHex(0x2c7f9b);
  coneMaterial.opacity = 0.84;
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 0.16, 3.3),
    frameMaterial,
  ), 'absolutely-fixed-foundation');
  base.position.set(0.15, groundY + 0.08, 0);
  root.add(base);

  const lowerTube = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      1.34,
      1.34,
      2.18,
      64,
      1,
      true,
    ),
    shellMaterial,
  ), 'fixed-lower-larger-tube');
  lowerTube.position.y = -0.78;
  root.add(lowerTube);

  const lowerTopRim = horizontalRing(1.34, 0.075, outlineMaterial);
  lowerTopRim.position.y = 0.31;
  const lowerBottomRim = horizontalRing(1.34, 0.075, outlineMaterial);
  lowerBottomRim.position.y = -1.87;
  root.add(lowerTopRim, lowerBottomRim);

  const lowerFloor = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.34, 1.34, 0.12, 64),
    frameMaterial,
  ), 'fixed-lower-tube-floor');
  lowerFloor.position.y = -1.87;
  root.add(lowerFloor);

  const outletPipe = addRole(horizontalCylinder(
    0.28,
    2.75,
    shellMaterial,
  ), 'fixed-lower-discharge-pipe');
  outletPipe.position.set(2.40, -1.49, 0);
  root.add(outletPipe);
  const outletRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.045, 10, 40),
    outlineMaterial,
  );
  outletRim.rotation.y = Math.PI / 2;
  outletRim.position.set(3.78, -1.49, 0);
  root.add(outletRim);

  const plate = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.79, 0.79, 0.14, 56),
    matte(PALETTE.accent, { metalness: 0.28, roughness: 0.48 }),
  ), 'fixed-circular-plate-concentric-with-upper-orifice');
  plate.position.y = plateTopY - 0.07;
  root.add(plate);
  const plateRim = horizontalRing(0.80, 0.055, outlineMaterial);
  plateRim.position.y = plateTopY;
  root.add(plateRim);

  const plateStem = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 1.43, 24),
    outlineMaterial,
  ), 'fixed-circular-plate-support');
  plateStem.position.y = -1.01;
  root.add(plateStem);
  const stemFoot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.12, 0.22, 32),
    outlineMaterial,
  );
  stemFoot.position.y = -1.76;
  root.add(stemFoot);

  const nozzle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.43,
      0.43,
      nozzleTopY - nozzleBottomY,
      48,
      1,
      true,
    ),
    shellMaterial,
  ), 'fixed-upper-smaller-tube');
  nozzle.position.y = (nozzleTopY + nozzleBottomY) / 2;
  root.add(nozzle);
  for (const y of [nozzleBottomY, nozzleTopY]) {
    const rim = horizontalRing(0.43, 0.055, outlineMaterial);
    rim.position.y = y;
    root.add(rim);
  }

  const reservoir = addRole(new THREE.Group(),
    'fixed-constantly-supplied-upper-reservoir');
  root.add(reservoir);
  const reservoirBack = new THREE.Mesh(
    new THREE.BoxGeometry(4.25, 1.35, 0.13),
    frameMaterial,
  );
  reservoirBack.position.set(-1.10, 2.23, -0.90);
  reservoir.add(reservoirBack);
  const reservoirLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 1.35, 1.86),
    frameMaterial,
  );
  reservoirLeft.position.set(-3.16, 2.23, 0);
  reservoir.add(reservoirLeft);
  const reservoirRight = reservoirLeft.clone();
  reservoirRight.position.x = 0.96;
  reservoir.add(reservoirRight);
  const reservoirFloorLeft = new THREE.Mesh(
    new THREE.BoxGeometry(2.67, 0.14, 1.86),
    frameMaterial,
  );
  reservoirFloorLeft.position.set(-1.78, 1.61, 0);
  reservoir.add(reservoirFloorLeft);
  const reservoirFloorRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.14, 1.86),
    frameMaterial,
  );
  reservoirFloorRight.position.set(0.70, 1.61, 0);
  reservoir.add(reservoirFloorRight);
  const reservoirFrontRail = new THREE.Mesh(
    new THREE.BoxGeometry(4.25, 0.13, 0.13),
    outlineMaterial,
  );
  reservoirFrontRail.position.set(-1.10, 1.61, 0.90);
  reservoir.add(reservoirFrontRail);

  const reservoirWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.93, 0.53, 1.60),
    waterMaterial,
  ), 'constant-supply-water-at-fixed-head');
  reservoirWater.position.set(-1.10, 1.92, 0);
  root.add(reservoirWater);
  const reservoirSurface = new THREE.Mesh(
    new THREE.BoxGeometry(3.95, 0.035, 1.63),
    coneMaterial,
  );
  reservoirSurface.position.set(-1.10, reservoirWaterY, 0);
  root.add(reservoirSurface);

  const nozzleWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 1.05, 40),
    waterMaterial,
  ), 'water-within-fixed-upper-smaller-tube');
  nozzleWater.position.y = (nozzleTopY + nozzleBottomY) / 2;
  root.add(nozzleWater);

  const fallingJet = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.36, nozzleBottomY - plateTopY, 40),
    waterMaterial,
  ), 'unobstructed-descending-stream');
  fallingJet.position.y = (nozzleBottomY + plateTopY) / 2;
  root.add(fallingJet);

  const spillCurtain = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.76,
      1.13,
      1.22,
      56,
      1,
      true,
    ),
    waterMaterial,
  ), 'water-spreading-over-plate-and-descending-in-larger-tube');
  spillCurtain.position.y = -0.88;
  root.add(spillCurtain);

  const lowerWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.23, 1.23, 0.20, 56),
    waterMaterial,
  ), 'lower-receiver-water-flowing-to-discharge');
  lowerWater.position.y = lowerWaterY;
  root.add(lowerWater);

  const outletWater = addRole(horizontalCylinder(
    0.20,
    2.84,
    waterMaterial,
  ), 'periodic-lower-discharge');
  outletWater.position.set(2.43, -1.49, 0);
  root.add(outletWater);

  const waterCone = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.12,
      0.72,
      maximumConeHeight,
      56,
      1,
      false,
    ),
    coneMaterial,
  ), 'self-forming-water-cone-on-fixed-circular-plate');
  root.add(waterCone);

  const coneCrown = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 32, 18),
    coneMaterial,
  ), 'water-cone-crown-entering-small-tube');
  root.add(coneCrown);

  const risingColumnMaximumHeight = reservoirWaterY - plateTopY + 0.16;
  const risingColumn = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.21,
      0.29,
      risingColumnMaximumHeight,
      40,
    ),
    coneMaterial,
  ), 'checked-water-column-rising-through-upper-tube');
  root.add(risingColumn);
  const topPlume = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 18),
    coneMaterial,
  ), 'raised-water-column-turning-into-upper-reservoir');
  topPlume.scale.set(1.18, 0.48, 0.82);
  topPlume.position.set(0, reservoirWaterY + 0.08, 0);
  root.add(topPlume);

  const descendingMarkers = Array.from({ length: 7 }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 18, 12),
      whiteMaterial,
    ), 'descending-flow-tracer');
    marker.userData.index = index;
    root.add(marker);
    return marker;
  });
  const risingMarkers = Array.from({ length: 5 }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 18, 12),
      whiteMaterial,
    ), 'rising-column-tracer');
    marker.userData.index = index;
    root.add(marker);
    return marker;
  });
  const outletMarkers = Array.from({ length: 6 }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 18, 12),
      whiteMaterial,
    ), 'lower-discharge-flow-tracer');
    marker.userData.index = index;
    root.add(marker);
    return marker;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    const coneScale = state.coneFraction;
    waterCone.scale.set(
      0.90 + 0.10 * coneScale,
      coneScale,
      0.90 + 0.10 * coneScale,
    );
    waterCone.position.y = plateTopY
      + maximumConeHeight * coneScale / 2;
    coneCrown.position.y = plateTopY + state.coneHeight;
    coneCrown.scale.setScalar(0.48 + 0.52 * coneScale);
    coneCrown.visible = coneScale > 0.18;

    const columnFraction = state.upperColumnFraction;
    risingColumn.scale.set(
      0.84 + 0.16 * columnFraction,
      Math.max(0.001, columnFraction),
      0.84 + 0.16 * columnFraction,
    );
    risingColumn.position.y = plateTopY
      + risingColumnMaximumHeight * columnFraction / 2;
    risingColumn.visible = columnFraction > 0.005;
    topPlume.visible = columnFraction > 0.94;
    topPlume.scale.set(
      1.18 * smoothStep5((columnFraction - 0.94) / 0.06),
      0.48 * smoothStep5((columnFraction - 0.94) / 0.06),
      0.82 * smoothStep5((columnFraction - 0.94) / 0.06),
    );

    const relativeDownFlow = state.downwardFlowRate / supplyFlowRate;
    fallingJet.scale.set(
      THREE.MathUtils.clamp(0.56 + 0.44 * relativeDownFlow, 0.40, 1.30),
      1,
      THREE.MathUtils.clamp(0.56 + 0.44 * relativeDownFlow, 0.40, 1.30),
    );
    spillCurtain.scale.set(
      THREE.MathUtils.clamp(0.70 + 0.30 * relativeDownFlow, 0.55, 1.30),
      1,
      THREE.MathUtils.clamp(0.70 + 0.30 * relativeDownFlow, 0.55, 1.30),
    );
    outletWater.scale.y = THREE.MathUtils.clamp(
      0.72 + 0.28 * relativeDownFlow,
      0.62,
      1.30,
    );

    const phaseDistance = state.phase * (
      0.40 + Math.max(0, relativeDownFlow)
    );
    descendingMarkers.forEach((marker, index) => {
      const travel = THREE.MathUtils.euclideanModulo(
        index / descendingMarkers.length + phaseDistance,
        1,
      );
      if (travel < 0.42) {
        const local = travel / 0.42;
        marker.position.set(0, THREE.MathUtils.lerp(
          nozzleBottomY - 0.08,
          plateTopY + 0.05,
          local,
        ), 0.29);
      } else {
        const local = (travel - 0.42) / 0.58;
        const angle = index * 2.39996;
        const radius = THREE.MathUtils.lerp(0.73, 1.10, local);
        marker.position.set(
          radius * Math.cos(angle),
          THREE.MathUtils.lerp(plateTopY - 0.10, lowerWaterY, local),
          radius * Math.sin(angle),
        );
      }
      marker.visible = relativeDownFlow > 0.36;
    });

    risingMarkers.forEach((marker, index) => {
      const travel = THREE.MathUtils.euclideanModulo(
        index / risingMarkers.length - state.phase * 1.8,
        1,
      );
      marker.position.set(
        0.19 * Math.sin(index * 1.7),
        THREE.MathUtils.lerp(
          plateTopY + 0.20,
          reservoirWaterY + 0.03,
          travel,
        ),
        0.16,
      );
      marker.visible = state.upperStorageVolumeRate > 0.002
        && travel < columnFraction;
    });

    outletMarkers.forEach((marker, index) => {
      const travel = THREE.MathUtils.euclideanModulo(
        index / outletMarkers.length + state.phase * relativeDownFlow,
        1,
      );
      marker.position.set(
        THREE.MathUtils.lerp(1.18, 3.72, travel),
        -1.49,
        0.20,
      );
    });
  };

  const sourceState = stateAtInputAngle(0);
  const archetype = movement.id === 446
    ? 'dectol-fixed-oscillating-water-column-raised-cone-checking-state'
    : 'dectol-fixed-oscillating-water-column-free-descent-state';
  const sourcePlateKey = `brownPlate${movement.id}`;
  const sourcePlateMeasurements = movement.id === 446
    ? {
      approximateCircularPlateCenterPixels: [293, 326],
      approximateLowerTubeCenterPixels: [333, 377],
      approximateRaisedColumnTopPixels: [294, 113],
      approximateSmallTubeCenterPixels: [293, 214],
      approximateUpperReservoirWaterlinePixels: [136, 111],
      imageHeight: 525,
      imageWidth: 525,
      measurementUncertaintyPixels: 18,
    }
    : {
      approximateCircularPlateCenterPixels: [294, 328],
      approximateLowerTubeCenterPixels: [332, 374],
      approximateSmallTubeCenterPixels: [292, 215],
      approximateUpperReservoirWaterlinePixels: [136, 112],
      imageHeight: 525,
      imageWidth: 525,
      measurementUncertaintyPixels: 18,
    };
  const geometry = {
    columnRiseEndPhase,
    coneBreakStartPhase,
    coneBuildEndPhase,
    coneCollapseEndPhase,
    coneCollapsedFraction,
    coneMinimumFraction,
    cycleDuration,
    freeDescentEndPhase,
    groundY,
    inputAngularSpeed,
    lowerWaterY,
    maximumConeHeight,
    maximumUpperStorageVolume,
    nozzleBottomY,
    nozzleTopY,
    plateTopY,
    reservoirWaterY,
    sourcePhase,
    storageDrainEndPhase,
    storageDrainStartPhase,
    supplyFlowRate,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype,
    blocks: {
      base,
      coneCrown,
      descendingMarkers,
      fallingJet,
      lowerFloor,
      lowerTube,
      lowerWater,
      nozzle,
      nozzleWater,
      outletMarkers,
      outletPipe,
      outletWater,
      plate,
      plateStem,
      reservoir,
      reservoirWater,
      risingColumn,
      risingMarkers,
      spillCurtain,
      topPlume,
      waterCone,
    },
    coneKinematicsAtPhase,
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      movingSolidParts: 0,
      operatingDegreesOfFreedom: 1,
      upperColumnIndependent: false,
      waterConeIndependent: false,
    },
    dynamics: {
      allSolidPartsAbsolutelyFixed: true,
      fluidModel:
        'The demonstration uses a mass-balanced, axisymmetric kinematic water envelope. It is not a CFD solution: viscosity, turbulence, entrained air, free-surface breakup, impact losses, and pressure-wave propagation are not solved.',
      periodicRegulation:
        'Constant supply minus the exact time derivative of upper storage defines downward flow. The prescribed storage returns exactly to zero each cycle, so integrated discharge equals integrated supply without drift.',
      transitionContinuity:
        'Every cone and stored-column transition uses a quintic smoothstep with zero endpoint velocity and acceleration.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Every solid part is fixed. Water supplied at constant head descends through the smaller upper tube and spreads over the concentric circular plate inside the larger lower tube. The impinging water gradually forms a cone on the plate; when the cone reaches into the small tube it checks the downward flow, so continuing supply raises the upper water column. The cone then gives way, the stored column surges downward around the plate, and unobstructed descent begins again.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'fluid-only-free-descent-cone-build-throat-check-column-rise-cone-break-and-surge-cycle',
      sourcePhase,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        `The official Movement ${movement.id} page supplies Brown's static engraving and the shared 445–446 caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.`,
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      coneFraction: sourceState.coneFraction,
      downwardFlowRate: sourceState.downwardFlowRate,
      mode: sourceState.mode,
      sourcePhase,
      upperColumnFraction: sourceState.upperColumnFraction,
    },
    sourceReference: {
      [sourcePlateKey]: sourcePlateMeasurements,
      constructionEvidence: {
        explicitInBrownDescription: [
          'all parts of the machine are absolutely fixed',
          'an upper smaller tube is constantly supplied with water',
          'a lower larger tube receives that stream',
          'a circular plate is concentric with the upper-tube orifice',
          'descending water gradually forms a cone on the circular plate',
          'the cone protrudes into the smaller tube and checks downward flow',
          'continuing supply raises the upper column until the cone gives way',
          'the supply regulates this periodically renewed action',
        ],
        engravingEvidence: movement.id === 446
          ? 'Plate 446 shows the checked-flow state: a filled upper reservoir, a raised central water column through the narrow throat, the self-formed water cone reaching upward from the fixed circular plate, a broader lower receiver, the plate support, and a low side discharge.'
          : 'Plate 445 shows the open-flow state: a filled upper reservoir, a narrow downward throat, a broader lower receiver, a circular plate on a fixed central stem, water spreading down around that plate, and a low side discharge.',
        reconstructionDisclosure:
          'Brown gives no dimensions, flow rate, head, plate clearance, cone profile, storage volume, pressure, loss coefficients, collapse threshold, cycle time, or transient timing. The dimensions, colors, transparent cutaway, tracer positions, 5.6-second phase schedule, quintic envelopes, and storage amplitude are independently engineered. The fixed topology, constant supply, cone buildup, throat check, upper-column rise, cone failure, and periodic renewal are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      pairedPlate: 'Brown 1868, Movements 445 and 446',
      plate: `Brown 1868, Movement ${movement.id}`,
    },
    stateAtCyclePhase,
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      massBalance:
        'Q_down=Q_supply-dV_upper/dt exactly. V_upper is periodic and closes at zero, hence the cycle integrals of supply and downward discharge are identical.',
      regulation:
        'The self-formed water cone is the only throttle; there is no moving solid valve, linkage, belt, rope, gear, or pulley.',
    },
    update,
    upperStorageKinematicsAtPhase,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.35, groundY, -1.78),
    new THREE.Vector3(3.95, 2.95, 1.78),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 4.7, 10.5);
  root.userData.groundFloorY = groundY;
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredOscillatingWaterColumnMovement(movement) {
  if (movement.id !== 445 && movement.id !== 446) return null;
  return dectolOscillatingColumn(movement);
}
