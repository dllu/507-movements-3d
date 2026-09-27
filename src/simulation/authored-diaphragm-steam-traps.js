import {correctEjectorTrapParts} from './ejector-trap-working-parts.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { waterVolumeMaterial } from './water-volume.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function horizontalRing(radius, tubeRadius, material, role) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 64),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  ring.userData.role = role;
  return ring;
}

function openCylinder(radius, length, material, role, segments = 56) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      segments,
      1,
      true,
    ),
    material,
  );
  cylinder.userData.role = role;
  return cylinder;
}

function diaphragmGeometry(radius, depth) {
  const profile = [];
  const samples = 20;
  for (let index = 0; index <= samples; index += 1) {
    const radialFraction = index / samples;
    const radialPosition = Math.max(0.015, radius * radialFraction);
    const normalizedHeight = (1 - radialFraction ** 2) ** 2;
    profile.push(new THREE.Vector2(
      radialPosition,
      -depth * normalizedHeight,
    ));
  }
  return new THREE.LatheGeometry(profile, 64, 0, FULL_TURN);
}

// Rear half of a body of revolution about Y from a closed (radius, y)
// section, closed by the two cut faces that Brown's sectional view shows.
function halfLatheSolid(section, segments = 160) {
  let area = 0;
  section.forEach(([r, y], i) => {
    const [r2, y2] = section[(i + 1) % section.length];
    area += r * y2 - r2 * y;
  });
  const ordered = area < 0 ? [...section].reverse() : section;
  const points = [...ordered, ordered[0]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry(points, segments, Math.PI / 2,
    Math.PI).toNonIndexed();
  lathe.deleteAttribute('uv');
  const shape = new THREE.Shape(ordered.map(([r, y]) => new THREE.Vector2(r, y)));
  const right = new THREE.ShapeGeometry(shape).toNonIndexed();
  right.deleteAttribute('uv');
  const left = right.clone();
  left.scale(-1, 1, 1);
  const q = left.attributes.position;
  for (let i = 0; i < q.count; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      const t = q.getComponent(i + 1, k);
      q.setComponent(i + 1, k, q.getComponent(i + 2, k));
      q.setComponent(i + 2, k, t);
    }
  }
  const geometry = mergeGeometries([lathe, right, left]);
  [lathe, right, left].forEach((part) => part.dispose());
  geometry.computeVertexNormals();
  return geometry;
}

// Brown draws a round cast casing in section: a cup body with a flanged
// cover carrying inlet A and a bottom boss carrying outlet B. The former open
// square frame is replaced by the rear half of that casing, so the cut faces
// read as Brown's hatched walls and the valve stays visible inside.
function flangedCastCasing(root) {
  const d = root.userData, b = d.blocks;
  const material = b.caseWalls[0].material;
  const casing = new THREE.Mesh(halfLatheSolid([
    [0.765, -1.90], [1.78, -1.90], [2.00, -1.84], [2.10, -1.70],
    [2.10, 1.58], [2.42, 1.58], [2.42, 1.96], [0.745, 1.96],
    [0.745, 1.78], [1.91, 1.78], [1.91, -1.60], [1.83, -1.68],
    [0.765, -1.68],
  ]), material);
  casing.userData.role = 'fixed-flanged-cast-casing-in-section';
  for (const wall of b.caseWalls) {
    wall.removeFromParent();
    wall.geometry.dispose();
  }
  b.fixedCase.add(casing);
  b.caseWalls = [casing];
  // A and B are cast pipes drawn in the same section.
  b.inletPipeA.geometry.dispose();
  b.inletPipeA.geometry = halfLatheSolid([
    [0.66, 1.96], [0.74, 1.96], [0.74, 3.76], [0.66, 3.76],
  ], 96);
  b.inletPipeA.position.y = 0;
  b.inletPipeA.material = material;
  b.outletPipeB.geometry.dispose();
  b.outletPipeB.geometry = halfLatheSolid([
    [0.68, -3.185], [0.76, -3.185], [0.76, -1.735], [0.68, -1.735],
  ], 96);
  b.outletPipeB.position.y = 0;
  b.outletPipeB.material = material;
  // Brown ends A and B as broken pipe; the dark mouth rims are not drawn.
  for (const rim of [b.inletTopRim, b.outletBottomRim]) rim.removeFromParent();
}


// Condensate in the rear half-section: every body is a half lathe (z <= 0)
// on the casing's axis, like the casing itself.
const HALF_LATHE_SEGMENTS = 48;
function halfLatheBuffer(pointCount) {
  const geometry = new THREE.BufferGeometry();
  const count = (HALF_LATHE_SEGMENTS + 1) * pointCount;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const index = [];
  for (let i = 0; i < HALF_LATHE_SEGMENTS; i += 1) {
    for (let j = 0; j < pointCount - 1; j += 1) {
      const a = i * pointCount + j, b = a + pointCount;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  geometry.setIndex(index);
  return geometry;
}
function writeHalfLathe(geometry, profile) {
  const position = geometry.attributes.position;
  for (let i = 0; i <= HALF_LATHE_SEGMENTS; i += 1) {
    const phi = Math.PI / 2 + Math.PI * i / HALF_LATHE_SEGMENTS;
    const sin = Math.sin(phi), cos = Math.cos(phi);
    for (let j = 0; j < profile.length; j += 1) {
      const [r, y] = profile[j];
      position.setXYZ(i * profile.length + j, r * sin, y, r * cos);
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
}

// Hoard & Wiggin's trap passes water of condensation, so the water is shown:
// it gathers in A on the shut seat while steam keeps D hot, and when D has
// cooled and dropped it runs out through the opened seat, down the outside of
// D and its diaphragm flange, across the floor of the box and out through B.
// The coil feeds A at the mean discharge rate, so the stored water in A rises
// while the seat is shut and falls while it drains, closing every cycle.
function condensateWater(root, stateAtTime, cycleDuration, liftScale) {
  const b = root.userData.blocks;
  const material = waterVolumeMaterial({ opacity: 0.5 });
  material.side = THREE.DoubleSide;
  const annulus = [0.405, 0.655], seatTop = 1.70, seatBore = [0.405, 0.475];
  const area = Math.PI * (annulus[1] ** 2 - annulus[0] ** 2);
  // Stored volume from the discharge history (inflow = mean discharge).
  const samples = 512, flows = [];
  for (let i = 0; i < samples; i += 1) flows.push(stateAtTime(cycleDuration * i / samples).flowFraction);
  const mean = flows.reduce((sum, f) => sum + f, 0) / samples;
  const stored = [0];
  for (let i = 1; i <= samples; i += 1) stored.push(stored[i - 1] + (mean - flows[i - 1]));
  const lowest = Math.min(...stored), highest = Math.max(...stored);
  const levelRange = 0.62, lowestLevel = seatTop + 0.08;
  const levelAt = (time) => {
    const u = THREE.MathUtils.euclideanModulo(time, cycleDuration) / cycleDuration * samples;
    const k = Math.min(samples - 1, Math.floor(u)), w = u - k;
    const v = stored[k] * (1 - w) + stored[k + 1] * w;
    return lowestLevel + levelRange * (v - lowest) / (highest - lowest);
  };
  const addWater = (geometry, role, own = false) => {
    const mesh = new THREE.Mesh(geometry, own ? material.clone() : material);
    mesh.userData.role = role;
    mesh.renderOrder = 1;
    mesh.castShadow = false;
    root.add(mesh);
    return mesh;
  };
  const seatWater = addWater(halfLatheBuffer(5), 'condensate-sealing-the-seat-bore-of-A');
  writeHalfLathe(seatWater.geometry, [[seatBore[0], 1.50], [seatBore[1], 1.50], [seatBore[1], seatTop], [seatBore[0], seatTop], [seatBore[0], 1.50]]);
  const pool = addWater(halfLatheBuffer(5), 'condensate-gathering-in-A-on-the-seat');
  const film = addWater(halfLatheBuffer(10), 'condensate-running-down-D-to-the-box-floor', true);
  const outlet = addWater(halfLatheBuffer(5), 'condensate-leaving-through-B', true);
  writeHalfLathe(outlet.geometry, [[0.001, -1.70], [0.66, -1.70], [0.66, -3.18], [0.001, -3.18], [0.001, -1.70]]);
  const store = { area, levelAt, levelRange, lowestLevel, mean };
  const update = (time, state) => {
    const level = levelAt(time);
    writeHalfLathe(pool.geometry, [[annulus[0], seatTop], [annulus[1], seatTop], [annulus[1], level], [annulus[0], level], [annulus[0], seatTop]]);
    const lift = state.valveLiftMetre * liftScale;
    // Over D's shoulder edge, its waist and dished foot to the flange rim,
    // down to the floor and in to the mouth of B.
    writeHalfLathe(film.geometry, [[0.82, 1.10], [0.815, 0.775 + lift], [0.83, 0.62 + lift], [0.90, 0.30 + lift],
      [0.995, 0.08 + lift], [1.025, -0.07 + lift], [1.03, -1.40], [1.02, -1.665], [0.85, -1.672], [0.70, -1.69]]);
    const flow = THREE.MathUtils.clamp(state.flowFraction, 0, 1);
    film.material.opacity = material.opacity * THREE.MathUtils.smoothstep(flow, 0, 0.25);
    outlet.material.opacity = material.opacity * THREE.MathUtils.smoothstep(flow, 0, 0.25);
  };
  Object.assign(b, { condensateFilm: film, condensateOutlet: outlet, condensatePool: pool, condensateSeat: seatWater });
  return { store, update };
}

function thermalDiaphragmSteamTrap(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;

  // Brown gives no temperatures, dimensions, fluid properties, or valve
  // stiffness. These exposed SI values form one auditable quasi-static
  // reconstruction. The valve travel is exaggerated only in the rendering.
  const coolTemperatureKelvin = 323;
  const hotTemperatureKelvin = 388;
  const temperatureSwingKelvin = hotTemperatureKelvin
    - coolTemperatureKelvin;
  const sealedLiquidReferenceVolumeCubicMetre = 55e-6;
  const effectiveVolumetricExpansionPerKelvin = 0.00065;
  const effectiveDiaphragmRadiusMetre = 0.021;
  const effectiveDiaphragmAreaSquareMetre = Math.PI
    * effectiveDiaphragmRadiusMetre ** 2;
  const physicalSeatClearanceMetre = 0.00125;
  const liftDisplayScaleSceneUnitPerMetre = 260;
  const contactStiffnessNewtonPerMetre = 9500;

  const inletPressurePascal = 170000;
  const outletPressurePascal = 101325;
  const condensateDensityKilogramPerCubicMetre = 985;
  const dischargeCoefficient = 0.62;
  const annularSeatRadiusMetre = 0.0125;
  const pressureDropPascal = inletPressurePascal - outletPressurePascal;
  const hydraulicSpeedFactorMetrePerSecond = Math.sqrt(
    2 * pressureDropPascal / condensateDensityKilogramPerCubicMetre,
  );
  const maximumUnconstrainedDiaphragmLiftMetre =
    effectiveVolumetricExpansionPerKelvin
    * sealedLiquidReferenceVolumeCubicMetre
    * temperatureSwingKelvin
    / effectiveDiaphragmAreaSquareMetre;
  const seatingTemperatureKelvin = coolTemperatureKelvin
    + physicalSeatClearanceMetre
      * effectiveDiaphragmAreaSquareMetre
      / (effectiveVolumetricExpansionPerKelvin
        * sealedLiquidReferenceVolumeCubicMetre);
  const physicalMaximumAnnularGapAreaSquareMetre = FULL_TURN
    * annularSeatRadiusMetre * physicalSeatClearanceMetre;
  const maximumCondensateVolumeFlowCubicMetrePerSecond =
    dischargeCoefficient * physicalMaximumAnnularGapAreaSquareMetre
    * hydraulicSpeedFactorMetrePerSecond;

  const stateAtTimeWithoutFlowIntegral = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const angle = FULL_TURN * phase;
    const heatingFraction = 0.5 * (1 - Math.cos(angle));
    const heatingFractionRatePerSecond = Math.PI / cycleDuration
      * Math.sin(angle);
    const temperatureKelvin = coolTemperatureKelvin
      + temperatureSwingKelvin * heatingFraction;
    const temperatureRateKelvinPerSecond = temperatureSwingKelvin
      * heatingFractionRatePerSecond;
    const liquidVolumeCubicMetre = sealedLiquidReferenceVolumeCubicMetre
      * (1 + effectiveVolumetricExpansionPerKelvin
        * (temperatureKelvin - coolTemperatureKelvin));
    const thermalExpansionVolumeCubicMetre = liquidVolumeCubicMetre
      - sealedLiquidReferenceVolumeCubicMetre;
    const unconstrainedDiaphragmLiftMetre =
      thermalExpansionVolumeCubicMetre
      / effectiveDiaphragmAreaSquareMetre;
    const unconstrainedLiftRateMetrePerSecond =
      effectiveVolumetricExpansionPerKelvin
      * sealedLiquidReferenceVolumeCubicMetre
      * temperatureRateKelvinPerSecond
      / effectiveDiaphragmAreaSquareMetre;
    const valveLiftMetre = Math.min(
      unconstrainedDiaphragmLiftMetre,
      physicalSeatClearanceMetre,
    );
    const valveLiftRateMetrePerSecond =
      unconstrainedDiaphragmLiftMetre < physicalSeatClearanceMetre
        ? unconstrainedLiftRateMetrePerSecond
        : 0;
    const blockedExpansionMetre = Math.max(
      0,
      unconstrainedDiaphragmLiftMetre - physicalSeatClearanceMetre,
    );
    const seatContactForceNewton = contactStiffnessNewtonPerMetre
      * blockedExpansionMetre;
    const physicalSeatGapMetre = Math.max(
      0,
      physicalSeatClearanceMetre - valveLiftMetre,
    );
    const annularGapAreaSquareMetre = FULL_TURN
      * annularSeatRadiusMetre * physicalSeatGapMetre;
    const condensateVolumeFlowCubicMetrePerSecond = dischargeCoefficient
      * annularGapAreaSquareMetre * hydraulicSpeedFactorMetrePerSecond;
    const flowFraction = maximumCondensateVolumeFlowCubicMetrePerSecond > 0
      ? condensateVolumeFlowCubicMetrePerSecond
        / maximumCondensateVolumeFlowCubicMetrePerSecond
      : 0;
    return {
      annularGapAreaSquareMetre,
      blockedExpansionMetre,
      condensateVolumeFlowCubicMetrePerSecond,
      cycleTime,
      diaphragmDeflectionMetre: valveLiftMetre,
      flowFraction,
      heatingFraction,
      liquidVolumeCubicMetre,
      phase,
      physicalSeatGapMetre,
      seatContact: physicalSeatGapMetre <= 1e-12,
      seatContactForceNewton,
      temperatureKelvin,
      temperatureRateKelvinPerSecond,
      thermalExpansionVolumeCubicMetre,
      unconstrainedDiaphragmLiftMetre,
      unconstrainedLiftRateMetrePerSecond,
      valveLiftMetre,
      valveLiftRateMetrePerSecond,
    };
  };

  // Integrating Q rather than time makes every condensate marker stop while
  // the valve is seated and resume from the same point as the trap reopens.
  const integrationSamples = 2048;
  const cumulativeDischargeVolumeTable = new Float64Array(
    integrationSamples + 1,
  );
  for (let index = 1; index <= integrationSamples; index += 1) {
    const previousTime = cycleDuration * (index - 1)
      / integrationSamples;
    const currentTime = cycleDuration * index / integrationSamples;
    const previousFlow = stateAtTimeWithoutFlowIntegral(previousTime)
      .condensateVolumeFlowCubicMetrePerSecond;
    const currentFlow = index === integrationSamples
      ? stateAtTimeWithoutFlowIntegral(0)
        .condensateVolumeFlowCubicMetrePerSecond
      : stateAtTimeWithoutFlowIntegral(currentTime)
        .condensateVolumeFlowCubicMetrePerSecond;
    cumulativeDischargeVolumeTable[index] =
      cumulativeDischargeVolumeTable[index - 1]
      + 0.5 * (previousFlow + currentFlow)
        * (currentTime - previousTime);
  }
  const dischargeVolumePerCycleCubicMetre =
    cumulativeDischargeVolumeTable[integrationSamples];
  const markerPassesPerCycle = 2;
  const markerPathEquivalentVolumeCubicMetre =
    dischargeVolumePerCycleCubicMetre / markerPassesPerCycle;

  const cumulativeDischargeVolumeWithinCycle = (cycleTime) => {
    const tableCoordinate = cycleTime / cycleDuration
      * integrationSamples;
    const lowerIndex = Math.min(
      integrationSamples - 1,
      Math.floor(tableCoordinate),
    );
    const interpolation = tableCoordinate - lowerIndex;
    return THREE.MathUtils.lerp(
      cumulativeDischargeVolumeTable[lowerIndex],
      cumulativeDischargeVolumeTable[lowerIndex + 1],
      interpolation,
    );
  };

  const cumulativeDischargeVolumeAtTime = (time) => {
    const completeCycles = Math.floor(time / cycleDuration);
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return completeCycles * dischargeVolumePerCycleCubicMetre
      + cumulativeDischargeVolumeWithinCycle(cycleTime);
  };

  const stateAtTime = (time) => {
    const state = stateAtTimeWithoutFlowIntegral(time);
    const cumulativeDischargeVolumeCubicMetre =
      cumulativeDischargeVolumeAtTime(time);
    return {
      ...state,
      cumulativeDischargeVolumeCubicMetre,
      markerTravelTurns: markerPathEquivalentVolumeCubicMetre > 0
        ? cumulativeDischargeVolumeCubicMetre
          / markerPathEquivalentVolumeCubicMetre
        : 0,
    };
  };

  const caseMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const caseCutawayMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    opacity: 0.24,
    roughness: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
  });
  caseCutawayMaterial.depthWrite = false;
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const valveMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    opacity: 0.70,
    roughness: 0.34,
    side: THREE.DoubleSide,
    transparent: true,
  });
  valveMaterial.depthWrite = false;
  const diaphragmMaterial = matte(PALETTE.ink, {
    metalness: 0.05,
    roughness: 0.64,
    side: THREE.DoubleSide,
  });
  const liquidMaterial = matte(PALETTE.driver, {
    opacity: 0.72,
    roughness: 0.25,
    side: THREE.DoubleSide,
    transparent: true,
  });
  liquidMaterial.depthWrite = false;
  const condensateMaterial = matte(PALETTE.fluid, {
    opacity: 0.28,
    roughness: 0.28,
    transparent: true,
  });
  condensateMaterial.depthWrite = false;
  const markerMaterial = matte(0xdaf5f7, {
    opacity: 0.90,
    roughness: 0.28,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const fixedCase = new THREE.Group();
  fixedCase.userData.role =
    'fixed-cutaway-outer-box-connected-between-A-and-B';
  const rearWall = new THREE.Mesh(
    new THREE.BoxGeometry(4.24, 3.66, 0.16),
    caseCutawayMaterial,
  );
  rearWall.position.set(0, 0, -0.77);
  rearWall.userData.role = 'transparent-rear-wall-of-outer-box';
  fixedCase.add(rearWall);

  const caseWallSpecifications = [
    [-2.02, 0, 0.22, 3.78, 1.55, 'left-side-wall'],
    [2.02, 0, 0.22, 3.78, 1.55, 'right-side-wall'],
    [-1.40, 1.79, 1.02, 0.22, 1.55, 'top-wall-left-of-A'],
    [1.40, 1.79, 1.02, 0.22, 1.55, 'top-wall-right-of-A'],
    [-1.38, -1.79, 1.06, 0.22, 1.55, 'bottom-wall-left-of-B'],
    [1.38, -1.79, 1.06, 0.22, 1.55, 'bottom-wall-right-of-B'],
  ];
  const caseWalls = caseWallSpecifications.map(([
    x,
    y,
    width,
    height,
    depth,
    role,
  ]) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      caseMaterial,
    );
    wall.position.set(x, y, 0);
    wall.userData.role = `fixed-${role}`;
    fixedCase.add(wall);
    return wall;
  });

  const inletPipeA = openCylinder(
    0.66,
    2.08,
    caseCutawayMaterial,
    'fixed-top-inlet-A-from-steam-coil',
  );
  inletPipeA.position.y = 2.72;
  const outletPipeB = openCylinder(
    0.68,
    1.45,
    caseCutawayMaterial,
    'fixed-bottom-condensate-outlet-B',
  );
  outletPipeB.position.y = -2.46;
  const inletTopRim = horizontalRing(
    0.66,
    0.075,
    darkMaterial,
    'fixed-rim-at-mouth-of-A',
  );
  inletTopRim.position.y = 3.75;
  const outletBottomRim = horizontalRing(
    0.68,
    0.075,
    darkMaterial,
    'fixed-rim-at-mouth-of-B',
  );
  outletBottomRim.position.y = -3.18;
  fixedCase.add(inletPipeA, outletPipeB, inletTopRim, outletBottomRim);
  root.add(fixedCase);

  const shoulderContactLocalY = 1.175;
  const seatPlaneY = shoulderContactLocalY
    + physicalSeatClearanceMetre * liftDisplayScaleSceneUnitPerMetre;
  const annularSeat = horizontalRing(
    0.72,
    0.095,
    darkMaterial,
    'fixed-annular-seat-a-a-at-inlet-A',
  );
  annularSeat.position.y = seatPlaneY + 0.095;
  root.add(annularSeat);

  const fixedBridge = new THREE.Group();
  fixedBridge.userData.role =
    'fixed-bridge-over-outlet-B-supporting-flexible-diaphragm';
  const bridgeCrossbar = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.18, 0.30),
    darkMaterial,
  );
  bridgeCrossbar.position.y = -0.43;
  bridgeCrossbar.userData.role = 'fixed-bridge-crossbar';
  const bridgeCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.14, 40),
    darkMaterial,
  );
  bridgeCap.position.y = -0.32;
  bridgeCap.userData.role = 'fixed-rounded-diaphragm-reaction-cap';
  const bridgeLegs = [-1, 1].map((side, index) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.08, 0.30),
      darkMaterial,
    );
    leg.position.set(side * 0.71, -0.95, 0);
    leg.userData.role = `fixed-bridge-leg-${index + 1}`;
    fixedBridge.add(leg);
    return leg;
  });
  fixedBridge.add(bridgeCrossbar, bridgeCap);
  root.add(fixedBridge);

  const valveD = new THREE.Group();
  valveD.userData.role =
    'one-sliding-hermetically-sealed-hollow-valve-D';
  const valveStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.40, 0.40, 2.63, 52),
    valveMaterial,
  );
  valveStem.position.y = 1.52;
  valveStem.userData.role = 'rigid-hollow-upper-stem-of-valve-D';
  const valveTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.405, 48, 18, 0, FULL_TURN, 0,
      Math.PI / 2),
    valveMaterial,
  );
  valveTop.position.y = 2.835;
  valveTop.userData.role = 'sealed-rounded-top-of-valve-D';
  const valveShoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.80, 0.40, 56),
    valveMaterial,
  );
  valveShoulder.position.y = 0.975;
  valveShoulder.userData.role =
    'rigid-conical-valve-shoulder-closing-seat-a-a';
  const valveReservoir = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.98, 0.58, 56),
    valveMaterial,
  );
  valveReservoir.position.y = 0.25;
  valveReservoir.userData.role =
    'rigid-lower-hollow-reservoir-of-valve-D';
  const valveNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.60, 0.88, 0.34, 56),
    valveMaterial,
  );
  valveNeck.position.y = 0.70;
  valveNeck.userData.role = 'rigid-neck-between-reservoir-and-shoulder';
  const diaphragmRim = horizontalRing(
    0.94,
    0.075,
    darkMaterial,
    'moving-clamped-rim-of-flexible-diaphragm',
  );
  diaphragmRim.position.y = -0.05;

  const baselineDiaphragmDepthSceneUnit = 0.20;
  const flexibleDiaphragm = new THREE.Mesh(
    diaphragmGeometry(0.94, baselineDiaphragmDepthSceneUnit),
    diaphragmMaterial,
  );
  flexibleDiaphragm.position.y = -0.05;
  flexibleDiaphragm.userData.role =
    'flexible-bottom-diaphragm-of-valve-D-resting-on-bridge';

  const workingFluidColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.275, 0.275, 2.38, 42),
    liquidMaterial,
  );
  workingFluidColumn.position.y = 1.57;
  workingFluidColumn.userData.role =
    'sealed-thermal-working-liquid-inside-hollow-D-column';
  const workingFluidReservoir = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 48, 24),
    liquidMaterial,
  );
  workingFluidReservoir.scale.y = 0.38;
  workingFluidReservoir.position.y = 0.24;
  workingFluidReservoir.userData.role =
    'sealed-thermal-working-liquid-above-diaphragm';

  const rigidValveParts = [
    valveStem,
    valveTop,
    valveShoulder,
    valveReservoir,
    valveNeck,
    diaphragmRim,
    workingFluidColumn,
    workingFluidReservoir,
  ];
  valveD.add(...rigidValveParts, flexibleDiaphragm);
  root.add(valveD);

  const flowPathCount = 4;
  const condensateFlowCurves = [];
  for (let index = 0; index < flowPathCount; index += 1) {
    const angle = Math.PI / 4 + index * FULL_TURN / flowPathCount;
    const radialPoint = (radius, y) => new THREE.Vector3(
      radius * Math.cos(angle),
      y,
      radius * Math.sin(angle),
    );
    condensateFlowCurves.push(new THREE.CatmullRomCurve3([
      radialPoint(0.53, 3.64),
      radialPoint(0.53, 2.38),
      radialPoint(0.58, 1.70),
      radialPoint(0.92, 1.38),
      radialPoint(1.28, 0.79),
      radialPoint(1.40, -0.10),
      radialPoint(1.29, -0.92),
      radialPoint(0.95, -1.43),
      radialPoint(0.52, -1.70),
      radialPoint(0.20, -2.18),
      radialPoint(0.15, -3.10),
    ], false, 'centripetal'));
  }

  const condensateStreams = condensateFlowCurves.map((curve, index) => {
    const stream = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 112, 0.055, 10, false),
      condensateMaterial,
    );
    stream.userData.role =
      `continuous-condensate-path-${index + 1}-from-A-around-D-to-B`;
    root.add(stream);
    return stream;
  });
  const markersPerPath = 5;
  const condensateMarkers = [];
  for (let pathIndex = 0; pathIndex < flowPathCount;
    pathIndex += 1) {
    for (let markerIndex = 0; markerIndex < markersPerPath;
      markerIndex += 1) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 18, 12),
        markerMaterial,
      );
      marker.userData.role =
        `condensate-path-${pathIndex + 1}-marker-${markerIndex + 1}`;
      root.add(marker);
      condensateMarkers.push({ marker, markerIndex, pathIndex });
    }
  }

  const coolLiquidColor = new THREE.Color(PALETTE.driver);
  const displayedDiaphragmApexY = -0.05
    - baselineDiaphragmDepthSceneUnit;

  const markerProgressAtTime = (time, markerIndex) => {
    const state = stateAtTime(time);
    return THREE.MathUtils.euclideanModulo(
      state.markerTravelTurns + markerIndex / markersPerPath,
      1,
    );
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const displayedLift = state.valveLiftMetre
      * liftDisplayScaleSceneUnitPerMetre;
    valveD.position.y = displayedLift;
    flexibleDiaphragm.scale.y = (
      baselineDiaphragmDepthSceneUnit + displayedLift
    ) / baselineDiaphragmDepthSceneUnit;

    // Colour is not a signal: the working liquid keeps one colour while
    // its expansion shows only as the valve's lift.
    liquidMaterial.color.copy(coolLiquidColor);
    condensateMaterial.opacity = 0.05 + 0.30 * state.flowFraction;

    for (const entry of condensateMarkers) {
      const progress = markerProgressAtTime(time, entry.markerIndex);
      entry.marker.position.copy(
        condensateFlowCurves[entry.pathIndex].getPointAt(progress),
      );
      const endpointFade = Math.sin(Math.PI * progress) ** 0.55;
      entry.marker.scale.setScalar(
        endpointFade * Math.sqrt(state.flowFraction),
      );
    }
    root.userData.updateWorkingParts?.(time,state);
  };

  const geometry = {
    annularSeatRadiusMetre,
    baselineDiaphragmDepthSceneUnit,
    condensateDensityKilogramPerCubicMetre,
    contactStiffnessNewtonPerMetre,
    coolTemperatureKelvin,
    cycleDuration,
    dischargeCoefficient,
    dischargeVolumePerCycleCubicMetre,
    effectiveDiaphragmAreaSquareMetre,
    effectiveDiaphragmRadiusMetre,
    effectiveVolumetricExpansionPerKelvin,
    flowPathCount,
    hotTemperatureKelvin,
    hydraulicSpeedFactorMetrePerSecond,
    inletPressurePascal,
    integrationSamples,
    liftDisplayScaleSceneUnitPerMetre,
    markerPassesPerCycle,
    markerPathEquivalentVolumeCubicMetre,
    markersPerPath,
    maximumCondensateVolumeFlowCubicMetrePerSecond,
    maximumUnconstrainedDiaphragmLiftMetre,
    outletPressurePascal,
    physicalMaximumAnnularGapAreaSquareMetre,
    physicalSeatClearanceMetre,
    pressureDropPascal,
    sealedLiquidReferenceVolumeCubicMetre,
    seatingTemperatureKelvin,
    shoulderContactLocalY,
    seatPlaneY,
    temperatureSwingKelvin,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'hoard-wiggin-direct-acting-sealed-liquid-diaphragm-steam-trap-with-bridge-reacted-lift-annular-inlet-seat-and-bottom-condensate-outlet',
    blocks: {
      annularSeat,
      bridgeCap,
      bridgeCrossbar,
      bridgeLegs,
      caseWalls,
      condensateMarkers: condensateMarkers.map(({ marker }) => marker),
      condensateStreams,
      diaphragmRim,
      fixedBridge,
      fixedCase,
      flexibleDiaphragm,
      inletPipeA,
      inletTopRim,
      outletBottomRim,
      outletPipeB,
      rearWall,
      rigidValveParts,
      valveD,
      valveNeck,
      valveReservoir,
      valveShoulder,
      valveStem,
      valveTop,
      workingFluidColumn,
      workingFluidReservoir,
    },
    degreesOfFreedom: {
      flexibleCoordinatesSlavedToThermalExpansion: 1,
      mechanicalMovingAssemblies: 1,
      operatingDegreesOfFreedom: 1,
      valveDTranslationAxis: new THREE.Vector3(0, 1, 0),
    },
    dynamics: {
      assumptionScope:
        'The displayed cycle prescribes a smooth temperature history and solves quasi-static thermal expansion plus unilateral seat contact. It does not integrate heat transfer, condensate inventory, two-phase flashing, fluid compressibility, valve inertia, gravity, guide friction, leakage, water hammer, or upstream pressure transients.',
      contactLaw:
        'valveLift=min(unconstrainedLift, seatClearance); blockedExpansion=max(unconstrainedLift-seatClearance,0); contactForce=k*blockedExpansion. The rendered diaphragm uses only the admitted lift, so neither valve nor diaphragm penetrates its fixed reaction surface.',
      markerContinuity:
        'Marker phase is the integral of discharged condensate volume, not clock time. Every marker follows one complete A-to-B spline by arc length with getPointAt, freezes while the seat is closed, and shrinks continuously at either recycling endpoint.',
      quasiStaticDescent:
        'Brown says contraction allows D to descend. This reconstruction therefore maps cooling contraction directly to downward valve travel and does not invent an unshown return spring.',
      visualScaleDisclosure:
        'Physical lift is multiplied by 260 scene units per metre to keep the roughly millimetric seat motion legible; all hydraulic and contact equations use unscaled SI travel.',
    },
    fidelity: 'authored',
    flowPaths: {
      condensateFlowCurves,
      cumulativeDischargeVolumeAtTime,
      cumulativeDischargeVolumeTable,
      cumulativeDischargeVolumeWithinCycle,
      markerProgressAtTime,
    },
    geometry,
    mechanism:
      'The fixed box connects upper inlet A to lower outlet B. One hollow, hermetically sealed valve D slides vertically inside it. D has a conical shoulder below A and a flexible bottom diaphragm resting on a fixed bridge over B. Heating expands the sealed working liquid, bows the diaphragm downward against the bridge, and the equal reaction lifts the whole valve until its shoulder contacts annular seat a,a and shuts in steam. Cooling condensate contracts the liquid, reduces diaphragm bow, lets D descend under its own allowed return, opens the annular gap, and drains from A around D to B.',
    motion: {
      cycleDuration,
      diaphragmApexWorldY:
        'valveDisplayLift-(baselineDepth+valveDisplayLift)-0.05',
      displayedDiaphragmApexY,
      displayedValveLiftEquation:
        'y_D=displayScale*min(beta*V0*(T-Tcool)/A_diaphragm, clearance)',
      valveTranslationDirection: new THREE.Vector3(0, 1, 0),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 477 HTML marks Animated unavailable and supplies only Brown’s engraving and caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate477: {
        approximateBridgeTopPixels: [258, 358],
        approximateInletACenterPixels: [279, 64],
        approximateOutletBCenterPixels: [255, 462],
        approximateSeatPairCenterPixels: [262, 219],
        approximateValveDShoulderPixels: [259, 225],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the outer box connects A to the coil or waste pipe',
          'B is the outlet',
          'D is hollow, liquid-filled, and hermetically sealed',
          'the bottom of D is a flexible diaphragm resting on a bridge',
          'steam heating raises D to annular seat a,a',
          'cooling condensate lets D descend and drain water',
        ],
        engravingEvidence:
          'Brown’s section shows one centered moving capsule D inside a rectangular fixed box, its narrow upper column extending into A, opposed shoulder faces immediately below seat a,a, a bowed diaphragm bearing on a bridge, and B directly below that bridge.',
        historicalCorroboration:
          'Scientific American’s July 24, 1858 cutaway account describes Hoard’s compact trap with a sealed holder, alcohol above mercury, a rubber diaphragm reacting on a cap supported over the exit, and the holder lifting to close the steam inlet. It also reports continuous condensate discharge rather than jumping.',
        patentIdentityDisclosure:
          'US 21,472, issued September 7, 1858 to J. W. Hoard and assigned to Hoard and G. B. Wiggin, is a related improvement with a diaphragm, lever, and rotary valve. It explicitly refers back to Hoard’s May 1858 direct-acting diaphragm design. Because its lever topology does not match Brown 477, this model does not present US 21,472 as the patent drawing for the plate.',
        reconstructionDisclosure:
          'The A-box-B topology, single hollow D, flexible bottom diaphragm, bridge reaction, annular seat, and hot-close/cool-open sequence are source-grounded. SI temperatures, effective liquid coefficient, dimensions, pressures, stiffness, coefficients, four illustrative streamlines, color, and display timing are independently engineered and exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 477',
      relatedImprovementPatentUrl:
        'https://patents.google.com/patent/US21472A/en',
      scientificAmerican1858Url:
        'https://www.scientificamerican.com/article/hoard-wiggins-trap-valve/',
    },
    stateAtTime,
    thermodynamics: {
      effectiveLiquidExpansionEquation:
        'V(T)=V0*(1+beta*(T-Tcool)); unconstrainedLift=(V(T)-V0)/A_diaphragm',
      prescribedTemperatureEquation:
        'T=Tcool+(Thot-Tcool)*(1-cos(2*pi*t/cycleDuration))/2',
      sourceFluidDisclosure:
        'Brown calls the sealed charge liquid and once calls it water; the 1858 Scientific American account describes alcohol over mercury. The coefficient here is therefore labeled effective and is not asserted as a recovered historical charge property.',
    },
    transmission: {
      annularDischargeEquation:
        'Q=Cd*(2*pi*r_seat*gap)*sqrt(2*(p_in-p_out)/rho)',
      bridgeReaction:
        'downward diaphragm expansion against the fixed bridge produces equal upward displacement of rigid valve D until unilateral seat contact',
      seatComplementarity:
        'gap>=0, contactForce>=0, gap*contactForce=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.35, -3.34, -1.35),
    new THREE.Vector3(2.35, 3.92, 1.35),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(7.4, 2.7, 10.4);
  root.userData.groundFloorY = -3.34;
  correctEjectorTrapParts(root,477,update);
  flangedCastCasing(root);
  {
    const condensate = condensateWater(root, stateAtTime, cycleDuration, liftDisplayScaleSceneUnitPerMetre);
    const working = root.userData.updateWorkingParts;
    root.userData.updateWorkingParts = (time, state) => {
      working?.(time, state);
      condensate.update(time, state);
    };
    root.userData.condensateStore = condensate.store;
  }
  fitPistonGuide(root, update, cycleDuration);
  // Brown draws a flat section; a narrow view keeps the cut case flat.
  root.userData.cameraDirection.set(0.05, 0.08, 15);
  root.userData.cameraFov = 10;
  markShadows(root);
  rearWall.castShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDiaphragmSteamTrapMovement(movement) {
  if (movement.id !== 477) return null;
  return applyCutawayFor(thermalDiaphragmSteamTrap(movement), movement.id);
}
