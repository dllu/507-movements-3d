import {correctGasMeterParts} from './gas-meter-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function cylinderBetween(start, end, radius, material, role, sides = 24) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.userData.role = role;
  return mesh;
}

function setUnitCylinderBetween(mesh, start, end) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.set(1, length, 1);
  if (length > 1e-12) {
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.multiplyScalar(1 / length),
    );
  }
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => point.clone()),
    false,
    'centripetal',
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 16, false),
    material,
  );
  mesh.userData.role = role;
  return { curve, mesh };
}

function quinticStep(parameter) {
  const clamped = THREE.MathUtils.clamp(parameter, 0, 1);
  const u = clamped < 1e-12
    ? 0
    : clamped > 1 - 1e-12 ? 1 : clamped;
  return u ** 3 * (10 + u * (-15 + 6 * u));
}

function quinticStepDerivative(parameter) {
  const clamped = THREE.MathUtils.clamp(parameter, 0, 1);
  const u = clamped < 1e-12
    ? 0
    : clamped > 1 - 1e-12 ? 1 : clamped;
  return 30 * u ** 2 * (1 - u) ** 2;
}

function quinticStepSecondDerivative(parameter) {
  const clamped = THREE.MathUtils.clamp(parameter, 0, 1);
  const u = clamped < 1e-12
    ? 0
    : clamped > 1 - 1e-12 ? 1 : clamped;
  return 60 * u * (1 - u) * (1 - 2 * u);
}

function createRectangularBellows({
  fixedX,
  frameMaterial,
  material,
  movingX,
  role,
}) {
  const group = addRole(new THREE.Group(), role);
  const stationScales = [0.94, 1.05, 0.84, 1.05, 0.84,
    1.05, 0.84, 1.05, 0.94];
  const stationFractions = stationScales.map(
    (_, index) => index / (stationScales.length - 1),
  );
  const halfHeights = stationScales.map((scale) => 1.10 * scale);
  const halfDepths = stationScales.map((scale) => 0.58 * scale);
  const segmentCount = stationScales.length - 1;
  const positionArray = new Float32Array(segmentCount * 4 * 6 * 3);
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(positionArray, 3);
  positions.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  const skin = addRole(new THREE.Mesh(geometry, material),
    `${role}-continuous-flexible-pleated-skin`);
  group.add(skin);

  const stationFrames = stationScales.map((_, index) => {
    const halfHeight = halfHeights[index];
    const halfDepth = halfDepths[index];
    const frame = addRole(new THREE.Group(),
      `${role}-pleat-frame-${index + 1}`);
    for (const side of [-1, 1]) {
      const horizontal = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.055, 2 * halfDepth),
        frameMaterial,
      );
      horizontal.position.y = side * halfHeight;
      frame.add(horizontal);
      const vertical = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 2 * halfHeight, 0.055),
        frameMaterial,
      );
      vertical.position.z = side * halfDepth;
      frame.add(vertical);
    }
    group.add(frame);
    return frame;
  });

  const corner = (x, halfHeight, halfDepth, index) => {
    const corners = [
      [x, halfHeight, halfDepth],
      [x, halfHeight, -halfDepth],
      [x, -halfHeight, -halfDepth],
      [x, -halfHeight, halfDepth],
    ];
    return corners[index];
  };

  const update = (nextFixedX, nextMovingX) => {
    const stationXs = stationFractions.map((fraction) =>
      THREE.MathUtils.lerp(nextFixedX, nextMovingX, fraction));
    stationFrames.forEach((frame, index) => {
      frame.position.x = stationXs[index];
    });
    let cursor = 0;
    const put = (value) => {
      positionArray[cursor] = value[0];
      positionArray[cursor + 1] = value[1];
      positionArray[cursor + 2] = value[2];
      cursor += 3;
    };
    for (let segment = 0; segment < segmentCount; segment += 1) {
      for (let side = 0; side < 4; side += 1) {
        const nextSide = (side + 1) % 4;
        const a = corner(
          stationXs[segment],
          halfHeights[segment],
          halfDepths[segment],
          side,
        );
        const b = corner(
          stationXs[segment],
          halfHeights[segment],
          halfDepths[segment],
          nextSide,
        );
        const c = corner(
          stationXs[segment + 1],
          halfHeights[segment + 1],
          halfDepths[segment + 1],
          nextSide,
        );
        const d = corner(
          stationXs[segment + 1],
          halfHeights[segment + 1],
          halfDepths[segment + 1],
          side,
        );
        put(a);
        put(b);
        put(c);
        put(a);
        put(c);
        put(d);
      }
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  update(fixedX, movingX);
  return {
    geometry,
    group,
    halfDepths,
    halfHeights,
    skin,
    stationFractions,
    stationFrames,
    update,
  };
}

function dryGasMeter(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const strokePhaseFraction = 0.40;
  const switchPhaseFraction = 0.10;
  const strokeDurationSecond = strokePhaseFraction * cycleDuration;
  const switchDurationSecond = switchPhaseFraction * cycleDuration;
  const bellowsEffectiveAreaSquareMetre = 0.035;
  const bellowsPhysicalStrokeMetre = 0.060;
  const chamberStrokeVolumeCubicMetre = bellowsEffectiveAreaSquareMetre
    * bellowsPhysicalStrokeMetre;
  const chamberDeadVolumeCubicMetre = 0.00060;
  const volumePerMeterCycleCubicMetre = 2
    * chamberStrokeVolumeCubicMetre;
  const minimumBellowsLengthSceneUnit = 0.82;
  const maximumBellowsLengthSceneUnit = 1.72;
  const bellowsLengthStrokeSceneUnit = maximumBellowsLengthSceneUnit
    - minimumBellowsLengthSceneUnit;
  const bellowsLengthMidpointSceneUnit = (
    minimumBellowsLengthSceneUnit + maximumBellowsLengthSceneUnit
  ) / 2;
  const sceneStrokePerPhysicalMetre = bellowsLengthStrokeSceneUnit
    / bellowsPhysicalStrokeMetre;
  const leftFixedPlateX = -2.65;
  const rightFixedPlateX = 2.65;
  const leftMovingPlateMidpointX = leftFixedPlateX
    + bellowsLengthMidpointSceneUnit;
  const rightMovingPlateMidpointX = rightFixedPlateX
    - bellowsLengthMidpointSceneUnit;
  const valveStrokeSceneUnit = 0.38;
  const valveRockerArmSceneUnit = 0.76;
  const fillsPerUnitsDialRevolution = 10;
  const dialFillRatios = Object.freeze([10, 100, 1000]);
  const markerPacketVolumeCubicMetre = chamberStrokeVolumeCubicMetre / 4;
  const markersPerPath = 7;
  const bellowsCenterY = -0.45;

  const stateAtTime = (time) => {
    const completedCycles = Math.floor(time / cycleDuration);
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    let chamberAFillFraction;
    let chamberAFillFractionRatePerSecond = 0;
    let chamberAFillFractionAccelerationPerSecondSquared = 0;
    let valveNormalizedPosition;
    let valveNormalizedVelocityPerSecond = 0;
    let measuredVolumeWithinCycleCubicMetre;
    let mode;
    let valveSwitchProgress = 0;

    if (phase < strokePhaseFraction) {
      const parameter = phase / strokePhaseFraction;
      chamberAFillFraction = quinticStep(parameter);
      chamberAFillFractionRatePerSecond =
        quinticStepDerivative(parameter) / strokeDurationSecond;
      chamberAFillFractionAccelerationPerSecondSquared =
        quinticStepSecondDerivative(parameter) / strokeDurationSecond ** 2;
      valveNormalizedPosition = 1;
      measuredVolumeWithinCycleCubicMetre =
        chamberStrokeVolumeCubicMetre * chamberAFillFraction;
      mode = 'A-filling-A-prime-discharging-through-B';
    } else if (phase < strokePhaseFraction + switchPhaseFraction) {
      const parameter = (phase - strokePhaseFraction)
        / switchPhaseFraction;
      valveSwitchProgress = quinticStep(parameter);
      chamberAFillFraction = 1;
      valveNormalizedPosition = 1 - 2 * valveSwitchProgress;
      valveNormalizedVelocityPerSecond =
        -2 * quinticStepDerivative(parameter) / switchDurationSecond;
      measuredVolumeWithinCycleCubicMetre = chamberStrokeVolumeCubicMetre;
      mode = 'dead-center-A-full-B-switching-to-A-prime-supply';
    } else if (phase < 2 * strokePhaseFraction + switchPhaseFraction) {
      const parameter = (phase - strokePhaseFraction - switchPhaseFraction)
        / strokePhaseFraction;
      const reverseFillProgress = quinticStep(parameter);
      chamberAFillFraction = 1 - reverseFillProgress;
      chamberAFillFractionRatePerSecond =
        -quinticStepDerivative(parameter) / strokeDurationSecond;
      chamberAFillFractionAccelerationPerSecondSquared =
        -quinticStepSecondDerivative(parameter) / strokeDurationSecond ** 2;
      valveNormalizedPosition = -1;
      measuredVolumeWithinCycleCubicMetre = chamberStrokeVolumeCubicMetre
        * (1 + reverseFillProgress);
      mode = 'A-discharging-A-prime-filling-through-B';
    } else {
      const parameter = (phase
        - 2 * strokePhaseFraction - switchPhaseFraction)
        / switchPhaseFraction;
      valveSwitchProgress = quinticStep(parameter);
      chamberAFillFraction = 0;
      valveNormalizedPosition = -1 + 2 * valveSwitchProgress;
      valveNormalizedVelocityPerSecond =
        2 * quinticStepDerivative(parameter) / switchDurationSecond;
      measuredVolumeWithinCycleCubicMetre = volumePerMeterCycleCubicMetre;
      mode = 'dead-center-A-prime-full-B-switching-to-A-supply';
    }

    const chamberAPrimeFillFraction = 1 - chamberAFillFraction;
    const bellowsCoordinate = 2 * chamberAFillFraction - 1;
    const bellowsCoordinateRatePerSecond = 2
      * chamberAFillFractionRatePerSecond;
    const bellowsCoordinateAccelerationPerSecondSquared = 2
      * chamberAFillFractionAccelerationPerSecondSquared;
    const chamberALengthSceneUnit = minimumBellowsLengthSceneUnit
      + bellowsLengthStrokeSceneUnit * chamberAFillFraction;
    const chamberAPrimeLengthSceneUnit = minimumBellowsLengthSceneUnit
      + bellowsLengthStrokeSceneUnit * chamberAPrimeFillFraction;
    const leftMovingPlateX = leftFixedPlateX + chamberALengthSceneUnit;
    const rightMovingPlateX = rightFixedPlateX
      - chamberAPrimeLengthSceneUnit;
    const commonPlateDisplacementSceneUnit =
      bellowsLengthStrokeSceneUnit * chamberAFillFraction
      - bellowsLengthStrokeSceneUnit / 2;
    const commonPlateVelocitySceneUnitPerSecond =
      bellowsLengthStrokeSceneUnit
      * chamberAFillFractionRatePerSecond;
    const commonPlateAccelerationSceneUnitPerSecondSquared =
      bellowsLengthStrokeSceneUnit
      * chamberAFillFractionAccelerationPerSecondSquared;
    const chamberADisplacementMetre = bellowsPhysicalStrokeMetre
      * chamberAFillFraction;
    const chamberAPrimeDisplacementMetre = bellowsPhysicalStrokeMetre
      * chamberAPrimeFillFraction;
    const chamberAVolumeCubicMetre = chamberDeadVolumeCubicMetre
      + bellowsEffectiveAreaSquareMetre * chamberADisplacementMetre;
    const chamberAPrimeVolumeCubicMetre = chamberDeadVolumeCubicMetre
      + bellowsEffectiveAreaSquareMetre
        * chamberAPrimeDisplacementMetre;
    const chamberAVolumeRateCubicMetrePerSecond =
      chamberStrokeVolumeCubicMetre
      * chamberAFillFractionRatePerSecond;
    const chamberAPrimeVolumeRateCubicMetrePerSecond =
      -chamberAVolumeRateCubicMetrePerSecond;
    const instantaneousThroughputCubicMetrePerSecond =
      Math.abs(chamberAVolumeRateCubicMetrePerSecond);
    const cumulativeMeasuredVolumeCubicMetre = completedCycles
      * volumePerMeterCycleCubicMetre
      + measuredVolumeWithinCycleCubicMetre;
    const fillEventsElapsed = cumulativeMeasuredVolumeCubicMetre
      / chamberStrokeVolumeCubicMetre;
    const valveBShiftSceneUnit = valveStrokeSceneUnit
      * valveNormalizedPosition;
    const valveBVelocitySceneUnitPerSecond = valveStrokeSceneUnit
      * valveNormalizedVelocityPerSecond;
    const valveRockerAngleRadian = Math.asin(
      valveBShiftSceneUnit / valveRockerArmSceneUnit,
    );
    const supplyToAFraction = (1 + valveNormalizedPosition) / 2;
    const supplyToAPrimeFraction = 1 - supplyToAFraction;
    const exhaustFromAFraction = supplyToAPrimeFraction;
    const exhaustFromAPrimeFraction = supplyToAFraction;
    const dialAnglesRadian = dialFillRatios.map((fillsPerRevolution) =>
      -FULL_TURN * fillEventsElapsed / fillsPerRevolution);
    return {
      bellowsCoordinate,
      bellowsCoordinateAccelerationPerSecondSquared,
      bellowsCoordinateRatePerSecond,
      chamberADisplacementMetre,
      chamberAFillFraction,
      chamberALengthSceneUnit,
      chamberAPrimeDisplacementMetre,
      chamberAPrimeFillFraction,
      chamberAPrimeLengthSceneUnit,
      chamberAPrimeVolumeCubicMetre,
      chamberAPrimeVolumeRateCubicMetrePerSecond,
      chamberAVolumeCubicMetre,
      chamberAVolumeRateCubicMetrePerSecond,
      commonPlateAccelerationSceneUnitPerSecondSquared,
      commonPlateDisplacementSceneUnit,
      commonPlateVelocitySceneUnitPerSecond,
      completedCycles,
      cumulativeMeasuredVolumeCubicMetre,
      cycleTime,
      dialAnglesRadian,
      exhaustFromAFraction,
      exhaustFromAPrimeFraction,
      fillEventsElapsed,
      instantaneousInletFlowCubicMetrePerSecond:
        instantaneousThroughputCubicMetrePerSecond,
      instantaneousOutletFlowCubicMetrePerSecond:
        instantaneousThroughputCubicMetrePerSecond,
      instantaneousThroughputCubicMetrePerSecond,
      leftMovingPlateX,
      markerTravelTurns: cumulativeMeasuredVolumeCubicMetre
        / markerPacketVolumeCubicMetre,
      measuredVolumeWithinCycleCubicMetre,
      mode,
      phase,
      rightMovingPlateX,
      supplyToAFraction,
      supplyToAPrimeFraction,
      totalTrappedChamberVolumeCubicMetre:
        chamberAVolumeCubicMetre + chamberAPrimeVolumeCubicMetre,
      valveBShiftSceneUnit,
      valveBVelocitySceneUnitPerSecond,
      valveNormalizedPosition,
      valveNormalizedVelocityPerSecond,
      valveRockerAngleRadian,
      valveSwitchProgress,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.40,
  });
  const housingMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    opacity: 0.11,
    roughness: 0.46,
    side: THREE.DoubleSide,
    transparent: true,
  });
  housingMaterial.depthWrite = false;
  const bellowsAMaterial = matte(PALETTE.driven, {
    metalness: 0.08,
    opacity: 0.52,
    roughness: 0.50,
    side: THREE.DoubleSide,
    transparent: true,
  });
  bellowsAMaterial.depthWrite = false;
  const bellowsAPrimeMaterial = matte(PALETTE.accent, {
    metalness: 0.08,
    opacity: 0.54,
    roughness: 0.48,
    side: THREE.DoubleSide,
    transparent: true,
  });
  bellowsAPrimeMaterial.depthWrite = false;
  const plateAMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.40,
  });
  const plateAPrimeMaterial = matte(PALETTE.accent, {
    metalness: 0.17,
    roughness: 0.40,
  });
  const valveMaterial = matte(PALETTE.driver, {
    metalness: 0.23,
    roughness: 0.38,
  });
  const gasAMaterial = matte(PALETTE.driven, {
    opacity: 0.16,
    roughness: 0.28,
    transparent: true,
  });
  gasAMaterial.depthWrite = false;
  const gasAPrimeMaterial = matte(PALETTE.accent, {
    opacity: 0.16,
    roughness: 0.28,
    transparent: true,
  });
  gasAPrimeMaterial.depthWrite = false;
  const pipeMaterial = matte(PALETTE.frame, {
    metalness: 0.23,
    roughness: 0.44,
  });
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.95,
    roughness: 0.22,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const fixedHousing = addRole(new THREE.Group(),
    'fixed-gas-tight-dry-meter-case');
  const housingShell = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.18, 5.08, 2.42),
    housingMaterial,
  ), 'transparent-cutaway-dry-meter-case');
  housingShell.position.y = 0.53;
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.38, 0.22, 2.62),
    frameMaterial,
  ), 'fixed-dry-meter-base');
  base.position.y = -2.05;
  const roof = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.35, 0.20, 2.58),
    frameMaterial,
  ), 'fixed-dry-meter-roof');
  roof.position.y = 3.05;
  const housingPosts = [];
  for (const x of [-3.08, 3.08]) {
    for (const z of [-1.18, 1.18]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 5.00, 0.16),
        frameMaterial,
      );
      post.position.set(x, 0.50, z);
      post.userData.role = `fixed-case-corner-post-${housingPosts.length + 1}`;
      fixedHousing.add(post);
      housingPosts.push(post);
    }
  }
  const galleryFloor = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(5.92, 0.13, 2.22),
    frameMaterial,
  ), 'fixed-gallery-floor-separating-valve-work-from-bellows');
  galleryFloor.position.y = 0.91;
  const centerPartition = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.72, 1.82),
    housingMaterial,
  ), 'fixed-central-partition-between-A-and-A-prime');
  centerPartition.position.y = -0.54;
  fixedHousing.add(
    housingShell,
    base,
    roof,
    galleryFloor,
    centerPartition,
  );
  root.add(fixedHousing);

  const initialState = stateAtTime(0);
  const bellowsA = createRectangularBellows({
    fixedX: leftFixedPlateX,
    frameMaterial: darkMaterial,
    material: bellowsAMaterial,
    movingX: initialState.leftMovingPlateX,
    role: 'bellows-like-measuring-chamber-A',
  });
  bellowsA.group.position.y = bellowsCenterY;
  root.add(bellowsA.group);
  const bellowsAPrime = createRectangularBellows({
    fixedX: rightFixedPlateX,
    frameMaterial: darkMaterial,
    material: bellowsAPrimeMaterial,
    movingX: initialState.rightMovingPlateX,
    role: 'bellows-like-measuring-chamber-A-prime',
  });
  bellowsAPrime.group.position.y = bellowsCenterY;
  root.add(bellowsAPrime.group);

  const fixedPlateGeometry = new THREE.BoxGeometry(0.16, 2.48, 1.34);
  const leftFixedPlate = addRole(new THREE.Mesh(
    fixedPlateGeometry,
    frameMaterial,
  ), 'fixed-outer-end-plate-of-A');
  leftFixedPlate.position.set(leftFixedPlateX, bellowsCenterY, 0);
  const rightFixedPlate = addRole(new THREE.Mesh(
    fixedPlateGeometry,
    frameMaterial,
  ), 'fixed-outer-end-plate-of-A-prime');
  rightFixedPlate.position.set(rightFixedPlateX, bellowsCenterY, 0);
  root.add(leftFixedPlate, rightFixedPlate);

  const makeMovingAssembly = (midpointX, material, role, rodRole) => {
    const assembly = addRole(new THREE.Group(), role);
    assembly.position.x = midpointX;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.46, 1.32),
      material,
    );
    plate.position.y = bellowsCenterY;
    plate.userData.role = `${role}-gas-tight-moving-plate`;
    const flagRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.43, 20),
      darkMaterial,
    );
    flagRod.position.y = 0.33;
    flagRod.position.z = 0.61;
    flagRod.userData.role = rodRole;
    assembly.add(plate, flagRod);
    root.add(assembly);
    return { assembly, flagRod, plate };
  };
  const movingA = makeMovingAssembly(
    leftMovingPlateMidpointX,
    plateAMaterial,
    'moving-diaphragm-plate-of-A',
    'flag-rod-from-A-to-common-meter-work',
  );
  const movingAPrime = makeMovingAssembly(
    rightMovingPlateMidpointX,
    plateAPrimeMaterial,
    'moving-diaphragm-plate-of-A-prime',
    'flag-rod-from-A-prime-to-common-meter-work',
  );

  const commonCrosshead = addRole(new THREE.Group(),
    'rigid-common-crosshead-coupling-opposed-bellows-strokes');
  const crossheadBar = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(
      rightMovingPlateMidpointX - leftMovingPlateMidpointX,
      0.13,
      0.14,
    ),
    darkMaterial,
  ), 'common-horizontal-bellows-crosshead-bar');
  crossheadBar.position.set(
    (rightMovingPlateMidpointX + leftMovingPlateMidpointX) / 2,
    0.99,
    0.61,
  );
  commonCrosshead.add(crossheadBar);
  root.add(commonCrosshead);

  const gasA = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1.78, 0.94),
    gasAMaterial,
  ), 'measured-gas-volume-inside-A');
  gasA.position.y = bellowsCenterY;
  const gasAPrime = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1.78, 0.94),
    gasAPrimeMaterial,
  ), 'measured-gas-volume-inside-A-prime');
  gasAPrime.position.y = bellowsCenterY;
  root.add(gasA, gasAPrime);

  const leftPortX = -0.76;
  const centerPortX = 0;
  const rightPortX = 0.76;
  const portPlateY = 1.20;
  const valvePortPlate = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.14, 1.16),
    frameMaterial,
  ), 'fixed-three-port-seat-under-slide-valve-B');
  valvePortPlate.position.set(0, portPlateY - 0.09, 0);
  root.add(valvePortPlate);
  const valvePorts = [
    { role: 'left-port-to-bellows-A', x: leftPortX },
    { role: 'central-common-exhaust-port', x: centerPortX },
    { role: 'right-port-to-bellows-A-prime', x: rightPortX },
  ].map(({ role, x }) => {
    const port = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.16, 28),
      darkMaterial,
    );
    port.position.set(x, portPlateY, 0);
    port.userData.role = role;
    root.add(port);
    return port;
  });

  const valveChest = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.52, 0.92, 1.34),
    housingMaterial,
  ), 'fixed-inlet-pressure-chest-around-B');
  valveChest.position.set(0, 1.61, 0);
  root.add(valveChest);
  const valveB = addRole(new THREE.Group(),
    'single-D-slide-valve-B-routing-both-bellows');
  valveB.position.y = portPlateY + 0.04;
  const valveBTop = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 0.16, 0.82),
    valveMaterial,
  ), 'closed-top-of-D-slide-valve-B');
  valveBTop.position.y = 0.35;
  const valveBSkirts = [-1, 1].map((side, index) => {
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.62, 0.82),
      valveMaterial,
    );
    skirt.position.set(side * 0.475, 0.10, 0);
    skirt.userData.role = `lower-skirt-${index + 1}-of-B`;
    valveB.add(skirt);
    return skirt;
  });
  const exhaustCavity = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.80, 0.34, 0.62),
    matte(PALETTE.driver, {
      opacity: 0.17,
      roughness: 0.24,
      transparent: true,
    }),
  ), 'moving-exhaust-cavity-beneath-D-slide-B');
  exhaustCavity.position.y = 0.17;
  exhaustCavity.material.depthWrite = false;
  const valveBStem = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.58, 20),
    darkMaterial,
  ), 'stem-of-slide-valve-B-worked-by-bellows');
  valveBStem.position.set(0, 0.72, 0.42);
  valveB.add(valveBTop, exhaustCavity, valveBStem);
  root.add(valveB);

  const inletTube = makeTube([
    new THREE.Vector3(0, 3.22, -0.46),
    new THREE.Vector3(0, 2.48, -0.46),
    new THREE.Vector3(0, 1.82, -0.38),
  ], 0.20, pipeMaterial, 'fixed-unlettered-main-inlet-to-valve-chest');
  root.add(inletTube.mesh);
  const leftBranchTube = makeTube([
    new THREE.Vector3(leftPortX, portPlateY - 0.05, 0),
    new THREE.Vector3(-1.48, 0.72, -0.05),
    new THREE.Vector3(leftFixedPlateX, 0.10, -0.02),
    new THREE.Vector3(leftFixedPlateX, bellowsCenterY, 0),
  ], 0.16, pipeMaterial, 'fixed-branch-between-B-and-chamber-A');
  const rightBranchTube = makeTube([
    new THREE.Vector3(rightPortX, portPlateY - 0.05, 0),
    new THREE.Vector3(1.48, 0.72, -0.05),
    new THREE.Vector3(rightFixedPlateX, 0.10, -0.02),
    new THREE.Vector3(rightFixedPlateX, bellowsCenterY, 0),
  ], 0.16, pipeMaterial, 'fixed-branch-between-B-and-chamber-A-prime');
  root.add(leftBranchTube.mesh, rightBranchTube.mesh);
  const outletTube = makeTube([
    new THREE.Vector3(centerPortX, portPlateY - 0.06, 0),
    new THREE.Vector3(0, 0.98, 0.45),
    new THREE.Vector3(0, 1.00, 1.86),
  ], 0.20, pipeMaterial, 'fixed-unlettered-common-outlet-from-B');
  root.add(outletTube.mesh);
  const outletFlange = cylinderBetween(
    new THREE.Vector3(0, 1.00, 1.76),
    new THREE.Vector3(0, 1.00, 2.08),
    0.31,
    darkMaterial,
    'fixed-front-outlet-flange',
    32,
  );
  root.add(outletFlange);

  const valveGuides = [-1, 1].map((side, index) => {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.08, 0.09),
      darkMaterial,
    );
    guide.position.set(0, 1.84 + index * 0.27, 0.44);
    guide.userData.role = side < 0
      ? 'lower-horizontal-guide-for-B-stem'
      : 'upper-horizontal-guide-for-B-stem';
    root.add(guide);
    return guide;
  });
  const rockerPivot = new THREE.Vector3(0, 2.52, 0.43);
  const valveRocker = addRole(new THREE.Group(),
    'fixed-pivot-valve-reversing-rocker');
  valveRocker.position.copy(rockerPivot);
  const rockerArm = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.12, valveRockerArmSceneUnit, 0.12),
    valveMaterial,
  ), 'rigid-arm-of-valve-reversing-rocker');
  rockerArm.position.y = -valveRockerArmSceneUnit / 2;
  valveRocker.add(rockerArm);
  root.add(valveRocker);
  const rockerFulcrum = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.28, 24),
    darkMaterial,
  ), 'fixed-fulcrum-of-valve-reversing-rocker');
  rockerFulcrum.rotation.x = Math.PI / 2;
  rockerFulcrum.position.copy(rockerPivot);
  root.add(rockerFulcrum);
  const valveRockerConnector = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 18),
    valveMaterial,
  ), 'sliding-link-from-rocker-to-stem-of-B');
  root.add(valveRockerConnector);

  const springSegmentCount = 12;
  const overCenterSpringSegments = Array.from(
    { length: springSegmentCount },
    (_, index) => {
      const segment = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 1, 12),
        valveMaterial,
      );
      segment.userData.role =
        `flexible-over-center-spring-segment-${index + 1}`;
      root.add(segment);
      return segment;
    },
  );

  const registerHousing = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 0.92, 0.18),
    darkMaterial,
  ), 'fixed-dial-work-register-housing');
  registerHousing.position.set(2.04, 2.47, 1.23);
  root.add(registerHousing);
  const dialCentersX = [1.42, 2.04, 2.66];
  const registerDials = [];
  const registerPointers = [];
  for (let index = 0; index < dialFillRatios.length; index += 1) {
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.055, 36),
      matte(PALETTE.paper, { roughness: 0.66 }),
    );
    dial.rotation.x = Math.PI / 2;
    dial.position.set(dialCentersX[index], 2.47, 1.35);
    dial.userData.role =
      `register-dial-${index + 1}-one-revolution-per-${dialFillRatios[index]}-fills`;
    root.add(dial);
    registerDials.push(dial);
    const pointer = addRole(new THREE.Group(),
      `moving-pointer-of-register-dial-${index + 1}`);
    pointer.position.set(dialCentersX[index], 2.47, 1.40);
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.21, 0.035),
      valveMaterial,
    );
    hand.position.y = 0.085;
    pointer.add(hand);
    root.add(pointer);
    registerPointers.push(pointer);
    for (let tick = 0; tick < 10; tick += 1) {
      const angle = FULL_TURN * tick / 10;
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.055, 0.018),
        darkMaterial,
      );
      mark.position.set(
        dialCentersX[index] + 0.205 * Math.sin(angle),
        2.47 + 0.205 * Math.cos(angle),
        1.405,
      );
      mark.rotation.z = -angle;
      mark.userData.role = `tick-${tick}-of-register-dial-${index + 1}`;
      root.add(mark);
    }
  }

  const countInputRotor = addRole(new THREE.Group(),
    'fill-count-input-wheel-driving-dial-work');
  countInputRotor.position.set(0.86, 2.47, 1.31);
  const countWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.10, 28),
    valveMaterial,
  );
  countWheel.rotation.x = Math.PI / 2;
  const countIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.16, 0.04),
    markerMaterial,
  );
  countIndex.position.set(0, 0.19, 0.065);
  countInputRotor.add(countWheel, countIndex);
  root.add(countInputRotor);

  const pathDefinitions = {
    inletToA: [
      new THREE.Vector3(0, 3.18, -0.46),
      new THREE.Vector3(0, 1.80, -0.38),
      new THREE.Vector3(leftPortX, 1.37, -0.12),
      new THREE.Vector3(-1.48, 0.70, -0.04),
      new THREE.Vector3(leftFixedPlateX, bellowsCenterY, 0.05),
      new THREE.Vector3(-2.18, bellowsCenterY, 0.10),
    ],
    inletToAPrime: [
      new THREE.Vector3(0, 3.18, -0.46),
      new THREE.Vector3(0, 1.80, -0.38),
      new THREE.Vector3(rightPortX, 1.37, -0.12),
      new THREE.Vector3(1.48, 0.70, -0.04),
      new THREE.Vector3(rightFixedPlateX, bellowsCenterY, 0.05),
      new THREE.Vector3(2.18, bellowsCenterY, 0.10),
    ],
    AToOutlet: [
      new THREE.Vector3(-2.18, bellowsCenterY, 0.10),
      new THREE.Vector3(leftFixedPlateX, bellowsCenterY, 0.05),
      new THREE.Vector3(-1.48, 0.70, -0.04),
      new THREE.Vector3(leftPortX, 1.30, 0.06),
      new THREE.Vector3(-0.38, 1.48, 0.12),
      new THREE.Vector3(centerPortX, 1.27, 0.14),
      new THREE.Vector3(0, 1.00, 0.64),
      new THREE.Vector3(0, 1.00, 2.08),
    ],
    APrimeToOutlet: [
      new THREE.Vector3(2.18, bellowsCenterY, 0.10),
      new THREE.Vector3(rightFixedPlateX, bellowsCenterY, 0.05),
      new THREE.Vector3(1.48, 0.70, -0.04),
      new THREE.Vector3(rightPortX, 1.30, 0.06),
      new THREE.Vector3(0.38, 1.48, 0.12),
      new THREE.Vector3(centerPortX, 1.27, 0.14),
      new THREE.Vector3(0, 1.00, 0.64),
      new THREE.Vector3(0, 1.00, 2.08),
    ],
  };
  const flowPaths = {};
  const flowMarkerSets = {};
  for (const [name, points] of Object.entries(pathDefinitions)) {
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    flowPaths[name] = curve;
    flowMarkerSets[name] = Array.from(
      { length: markersPerPath },
      (_, index) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.070, 17, 12),
          markerMaterial,
        );
        marker.userData.role = `${name}-gas-marker-${index + 1}`;
        root.add(marker);
        return marker;
      },
    );
  }
  const markerProgress = (turns, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath,
      1,
    );

  const updateSpring = (start, end) => {
    const direction = end.clone().sub(start);
    const normal = new THREE.Vector3(-direction.y, direction.x, 0);
    if (normal.lengthSq() < 1e-12) normal.set(1, 0, 0);
    else normal.normalize();
    const points = Array.from(
      { length: springSegmentCount + 1 },
      (_, index) => {
        const fraction = index / springSegmentCount;
        const point = start.clone().lerp(end, fraction);
        if (index > 0 && index < springSegmentCount) {
          point.addScaledVector(normal, index % 2 === 0 ? 0.075 : -0.075);
        }
        return point;
      },
    );
    overCenterSpringSegments.forEach((segment, index) => {
      setUnitCylinderBetween(segment, points[index], points[index + 1]);
    });
  };

  const update = (time) => {
    const state = stateAtTime(time);
    bellowsA.update(leftFixedPlateX, state.leftMovingPlateX);
    bellowsAPrime.update(rightFixedPlateX, state.rightMovingPlateX);
    movingA.assembly.position.x = state.leftMovingPlateX;
    movingAPrime.assembly.position.x = state.rightMovingPlateX;
    commonCrosshead.position.x = state.commonPlateDisplacementSceneUnit;
    gasA.position.x = (leftFixedPlateX + state.leftMovingPlateX) / 2;
    gasA.scale.x = Math.max(0.08, 0.92 * state.chamberALengthSceneUnit);
    gasA.material.opacity = 0.045 + 0.24 * state.chamberAFillFraction;
    gasAPrime.position.x = (
      rightFixedPlateX + state.rightMovingPlateX
    ) / 2;
    gasAPrime.scale.x = Math.max(
      0.08,
      0.92 * state.chamberAPrimeLengthSceneUnit,
    );
    gasAPrime.material.opacity = 0.045
      + 0.24 * state.chamberAPrimeFillFraction;

    valveB.position.x = state.valveBShiftSceneUnit;
    valveRocker.rotation.z = state.valveRockerAngleRadian;
    const rockerEndpoint = new THREE.Vector3(
      rockerPivot.x + valveRockerArmSceneUnit
        * Math.sin(state.valveRockerAngleRadian),
      rockerPivot.y - valveRockerArmSceneUnit
        * Math.cos(state.valveRockerAngleRadian),
      rockerPivot.z,
    );
    const valveStemPin = new THREE.Vector3(
      state.valveBShiftSceneUnit,
      valveB.position.y + 0.86,
      rockerPivot.z,
    );
    setUnitCylinderBetween(
      valveRockerConnector,
      rockerEndpoint,
      valveStemPin,
    );
    updateSpring(
      new THREE.Vector3(
        state.commonPlateDisplacementSceneUnit,
        1.00,
        0.72,
      ),
      rockerEndpoint,
    );

    countInputRotor.rotation.z = -FULL_TURN * state.fillEventsElapsed;
    registerPointers.forEach((pointer, index) => {
      pointer.rotation.z = state.dialAnglesRadian[index];
    });

    const leftChamberPoint = new THREE.Vector3(
      THREE.MathUtils.lerp(leftFixedPlateX, state.leftMovingPlateX, 0.58),
      bellowsCenterY,
      0.10,
    );
    const rightChamberPoint = new THREE.Vector3(
      THREE.MathUtils.lerp(rightFixedPlateX, state.rightMovingPlateX, 0.58),
      bellowsCenterY,
      0.10,
    );
    flowPaths.inletToA.points.at(-1).copy(leftChamberPoint);
    flowPaths.AToOutlet.points[0].copy(leftChamberPoint);
    flowPaths.inletToAPrime.points.at(-1).copy(rightChamberPoint);
    flowPaths.APrimeToOutlet.points[0].copy(rightChamberPoint);
    Object.values(flowPaths).forEach((curve) => curve.updateArcLengths());

    const maximumFlowCubicMetrePerSecond = chamberStrokeVolumeCubicMetre
      * 1.875 / strokeDurationSecond;
    const flowScale = state.instantaneousThroughputCubicMetrePerSecond
      / maximumFlowCubicMetrePerSecond;
    const activity = {
      inletToA: state.chamberAVolumeRateCubicMetrePerSecond > 0
        ? flowScale : 0,
      inletToAPrime: state.chamberAPrimeVolumeRateCubicMetrePerSecond > 0
        ? flowScale : 0,
      AToOutlet: state.chamberAVolumeRateCubicMetrePerSecond < 0
        ? flowScale : 0,
      APrimeToOutlet: state.chamberAPrimeVolumeRateCubicMetrePerSecond < 0
        ? flowScale : 0,
    };
    for (const [name, markers] of Object.entries(flowMarkerSets)) {
      markers.forEach((marker, index) => {
        const progress = markerProgress(state.markerTravelTurns, index);
        marker.position.copy(flowPaths[name].getPointAt(progress));
        const scale = Math.sin(Math.PI * progress) ** 0.52
          * activity[name];
        marker.scale.setScalar(scale);
        marker.visible = scale > 1e-7;
      });
    }
  };

  const geometry = {
    bellowsCenterY,
    bellowsEffectiveAreaSquareMetre,
    bellowsLengthMidpointSceneUnit,
    bellowsLengthStrokeSceneUnit,
    bellowsPhysicalStrokeMetre,
    chamberDeadVolumeCubicMetre,
    chamberStrokeVolumeCubicMetre,
    cycleDuration,
    dialFillRatios,
    fillsPerUnitsDialRevolution,
    leftFixedPlateX,
    leftMovingPlateMidpointX,
    markerPacketVolumeCubicMetre,
    markersPerPath,
    maximumBellowsLengthSceneUnit,
    minimumBellowsLengthSceneUnit,
    rightFixedPlateX,
    rightMovingPlateMidpointX,
    sceneStrokePerPhysicalMetre,
    strokeDurationSecond,
    strokePhaseFraction,
    switchDurationSecond,
    switchPhaseFraction,
    valveRockerArmSceneUnit,
    valveStrokeSceneUnit,
    volumePerMeterCycleCubicMetre,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'two-opposed-variable-volume-bellows-A-A-prime-dead-center-shifted-D-slide-valve-B-positive-displacement-dry-gas-meter-with-fill-count-dials',
    blocks: {
      base,
      bellowsA,
      bellowsAPrime,
      centerPartition,
      commonCrosshead,
      countInputRotor,
      crossheadBar,
      exhaustCavity,
      fixedHousing,
      galleryFloor,
      gasA,
      gasAPrime,
      housingPosts,
      housingShell,
      inletTube,
      leftBranchTube,
      leftFixedPlate,
      movingA,
      movingAPrime,
      outletFlange,
      outletTube,
      overCenterSpringSegments,
      registerDials,
      registerHousing,
      registerPointers,
      rightBranchTube,
      rightFixedPlate,
      rockerArm,
      rockerFulcrum,
      roof,
      valveB,
      valveBSkirts,
      valveBStem,
      valveBTop,
      valveChest,
      valveGuides,
      valvePortPlate,
      valvePorts,
      valveRocker,
      valveRockerConnector,
    },
    degreesOfFreedom: {
      bellowsAAndAPrimeOpposedStroke: 1,
      dialRotationSlavedToMeasuredVolume: 1,
      independentOperatingCoordinates: 1,
      valveBTranslationOccursOnlyAtDeadCenters: 1,
    },
    dynamics: {
      deadCenterSwitching:
        'Each measuring stroke uses a C2 quintic displacement. Both bellows stop with zero velocity and acceleration for a dedicated dwell while B moves through a separate C2 quintic shift; the gas flow is exactly zero throughout each valve change.',
      historicalScope:
        'Brown specifies two alternately filled bellows-like chambers and one B valve. Later standard dry meters commonly use four measuring spaces and two valves; that later topology is cited only as corroboration and is not substituted here.',
      markerContinuity:
        'Every white packet advances by the analytic accumulated positive-displacement volume. Separate inlet and exhaust paths use getPointAt arc-length sampling; their scale goes continuously to zero before routing changes at dead center.',
      positiveDisplacement:
        'A and A-prime exchange equal volume, so their total trapped volume is constant. Each completed fill contributes one exact chamber stroke volume and each full cycle contributes two.',
      valveRouting:
        'At the first B position, inlet-chest gas reaches A while the D-shaped cavity connects A-prime to the common exhaust. At the other position those connections reverse. B changes position only while both chamber rates are zero.',
    },
    fidelity: 'authored',
    flowPaths: {
      curves: flowPaths,
      markerProgress,
      markerSets: flowMarkerSets,
    },
    geometry,
    mechanism:
      'Two opposed bellows-like measuring chambers A and A-prime share one displacement coordinate: as A expands through one known stroke volume, A-prime contracts by exactly the same volume, then their roles reverse. A single D-shaped slide valve B works over two chamber ports and a central exhaust port like a steam-engine slide valve. It holds one routing position throughout each measuring stroke and shifts during a zero-flow dead-center dwell. The bellows crosshead and over-center spring visibly work B. Accumulated complete chamber fills drive three decimal dial pointers, so indicated volume is the known chamber capacity multiplied by the registered fill count.',
    motion: {
      firstStroke:
        'A expands and fills while A-prime contracts and discharges',
      secondStroke:
        'A contracts and discharges while A-prime expands and fills',
      valveAxis: new THREE.Vector3(1, 0, 0),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 483 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate483: {
        approximateBellowsACenterPixels: [188, 334],
        approximateBellowsAPrimeCenterPixels: [382, 334],
        approximateDialWorkHousingPixels: [399, 98],
        approximateSlideValveBPixels: [293, 132],
        approximateUpperWorkingLinkPixels: [345, 181],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      bureauOfStandardsCircular309Url:
        'https://www.govinfo.gov/content/pkg/GOVPUB-C13-bcd86cede6b39b231bf2f405be30379b/pdf/GOVPUB-C13-bcd86cede6b39b231bf2f405be30379b.pdf',
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is a dry gas meter',
          'there are two bellows-like chambers A and A-prime',
          'A and A-prime are alternately filled with gas and discharged',
          'one valve B works like a steam-engine slide valve and is worked by the chambers',
          'known chamber capacity times the dial-registered number of fills gives gas quantity',
        ],
        engravingEvidence:
          'Brown’s section shows two large side-by-side pleated chamber bodies, moving center plates and flag rods, a common upper working linkage, slide-valve B above its port face, an over-center-looking upper member, and a dial-work housing at upper right.',
        historicalCorroboration:
          'William Lyon and Charles W. Dickinson’s U.S. Patent 14,770 of April 29, 1856 describes metallic spring bellows of definite capacity, steam-engine-like slide valves worked by bellows levers and connections, and a registering wheel geared to indicate measured gas. Bureau of Standards Circular 309 (1926), pages 25–28, independently explains equal cyclic displacement, bellows-driven valves, and registered volume per cycle.',
        historicalTopologyDisclosure:
          'Patent 14,770 uses two pairs of bellows and plural slide valves, while the later Bureau circular describes four measuring chambers and two valves. Neither is claimed as Brown’s exact pictured machine; Brown’s explicit two chambers and singular B control this reconstruction.',
        reconstructionDisclosure:
          'The A/A-prime/B topology, alternation, bellows-worked valve, known-volume counting, and visible general arrangement are source-grounded. Chamber dimensions, physical capacity, dead volume, one-cap three-port D-valve interpretation, rigid opposed crosshead, over-center spring detail, C2 stroke-and-dwell timing, 10/100/1000-fill dials, pipes, colors, and camera are independently engineered and exposed.',
      },
      lyonDickinsonPatentUrl:
        'https://patents.google.com/patent/US14770A/en',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 483',
    },
    stateAtTime,
    transmission: {
      chamberVolumeEquation:
        'V_A=V_dead+A_eff*x; V_A_prime=V_dead+A_eff*(stroke-x)',
      dialEquation:
        'theta_dial_j=-2*pi*(V_measured/V_stroke)/fills_per_revolution_j',
      meterEquation:
        'V_measured=N_complete_fills*V_stroke; Delta_V_per_cycle=2*V_stroke',
      opposedStrokeConstraint:
        'x_A+x_A_prime=stroke and dV_A/dt=-dV_A_prime/dt',
      valveConstraint:
        'B is fixed at either routing limit during nonzero flow and follows a C2 quintic between limits only during dead-center dwell',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.55, -2.25, -1.55),
    new THREE.Vector3(3.55, 3.38, 2.32),
  );
  root.userData.cameraDistanceScale = 1.12;
  root.userData.cameraDirection = new THREE.Vector3(8.8, 4.8, 12.5);
  root.userData.groundFloorY = -2.25;
  correctGasMeterParts(root,483,update);
  markShadows(root);
  housingShell.castShadow = false;
  centerPartition.castShadow = false;
  gasA.castShadow = false;
  gasAPrime.castShadow = false;
  bellowsA.skin.castShadow = false;
  bellowsAPrime.skin.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDryGasMeterMovement(movement) {
  if (movement.id !== 483) return null;
  return dryGasMeter(movement);
}
