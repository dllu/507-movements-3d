import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {waterFountainGeometry, waterJetMaterial} from './water-volume.js';

import {
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';

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
  const maximumConeHeight = 1.38;
  const plateTopY = -0.22;
  const nozzleBottomY = 1.08;
  const nozzleTopY = 1.16;
  const reservoirWaterY = 2.21;
  const lowerWaterY = -1.29;
  const groundY = -1.67;

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
  const backMaterial = matte(PALETTE.muted, {
    metalness: 0.08,
    roughness: 0.78,
  });
  const plateMaterial = matte(PALETTE.accent, {
    metalness: 0.28,
    roughness: 0.48,
  });
  const stemMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.62,
    roughness: 0.34,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const streamMaterial = waterMaterial.clone();
  streamMaterial.opacity = 0.40;
  const coneMaterial = waterMaterial.clone();
  coneMaterial.color.setHex(0x2c7f9b);
  coneMaterial.opacity = 0.62;
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  // Brown draws a vertical section: an L-shaped supply conduit ending in a
  // small box whose floor has the orifice, and below it a larger box with a
  // hole in its top, the fixed circular plate on its stem, and a floor-level
  // discharge channel to the right. The boxes are shown cut on their
  // mid-plane (z = 0) so the front half is removed, as in the engraving.
  const wall = (x0, x1, y0, y1, z0, z1, role, material = frameMaterial) => {
    const mesh = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
      material,
    ), role);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    root.add(mesh);
    return mesh;
  };
  // Horizontal plate over the x/z outline (rear half, z <= 0) with a round
  // hole about the vertical axis, spanning y0..y1.
  const holedFloor = (x0, x1, zBack, holeRadius, y0, y1) => {
    const outline = polygonClipping.difference(
      poly([[x0, 0], [x1, 0], [x1, zBack], [x0, zBack]]),
      poly(circle([0, 0], holeRadius, 128)),
    );
    // Outline v = -z, extruded along y after the rotation.
    return plate(outline, y0, y1).rotateX(-Math.PI / 2);
  };
  // Back wall in the x/y plane, extruded between z0 and z1.
  const backWall = (points, z0, z1, role) => {
    const mesh = addRole(
      new THREE.Mesh(plate(poly(points), z0, z1), backMaterial),
      role,
    );
    root.add(mesh);
    return mesh;
  };

  const upperInner = 0.44;
  const upperOuter = 0.52;
  const lowerInner = 0.90;
  const lowerOuter = 0.98;
  const wallThickness = 0.08;
  const channelLeftX = -3.2;
  const channelFloorY = 1.83;
  const channelRoofY = 2.58;
  const chamberFloorY = nozzleTopY;
  const orificeRadius = 0.32;
  const receiverTopY = 0.21;
  const receiverHoleRadius = 0.39;
  const receiverFloorY = -1.59;
  const outletRoofY = -1.17;
  const outletRightX = 1.90;
  const plateRadius = 0.435;
  const plateThickness = 0.08;

  const upperWalls = [
    wall(channelLeftX, upperOuter, channelRoofY,
      channelRoofY + wallThickness, -upperInner, 0,
      'fixed-supply-conduit-roof'),
    wall(channelLeftX, -upperOuter, channelFloorY - wallThickness,
      channelFloorY, -upperInner, 0, 'fixed-supply-conduit-floor'),
    wall(-upperOuter, -upperInner, nozzleBottomY, channelFloorY,
      -upperInner, 0, 'fixed-upper-box-left-wall'),
    wall(upperInner, upperOuter, nozzleBottomY, channelRoofY,
      -upperInner, 0, 'fixed-upper-box-right-wall'),
  ];
  const upperFloor = addRole(new THREE.Mesh(
    holedFloor(-upperInner, upperInner, upperInner, orificeRadius,
      nozzleBottomY, chamberFloorY),
    frameMaterial,
  ), 'fixed-upper-box-floor-with-round-orifice');
  root.add(upperFloor);
  const upperBack = backWall([
    [channelLeftX, channelFloorY - wallThickness],
    [-upperOuter, channelFloorY - wallThickness],
    [-upperOuter, nozzleBottomY],
    [upperOuter, nozzleBottomY],
    [upperOuter, channelRoofY + wallThickness],
    [channelLeftX, channelRoofY + wallThickness],
  ], -upperOuter, -upperInner, 'fixed-rear-wall-of-supply-conduit-and-upper-box');

  const lowerWalls = [
    wall(-lowerOuter, -lowerInner, groundY, receiverTopY,
      -lowerInner, 0, 'fixed-lower-box-left-wall'),
    wall(lowerInner, lowerOuter, outletRoofY, receiverTopY,
      -lowerInner, 0, 'fixed-lower-box-right-wall-above-discharge'),
    wall(-lowerOuter, outletRightX, groundY, receiverFloorY,
      -lowerInner, 0, 'fixed-lower-box-and-discharge-floor'),
    wall(lowerOuter, outletRightX, outletRoofY, outletRoofY + wallThickness,
      -lowerInner, 0, 'fixed-discharge-channel-roof'),
  ];
  const lowerTop = addRole(new THREE.Mesh(
    holedFloor(-lowerInner, lowerInner, lowerInner, receiverHoleRadius,
      receiverTopY - wallThickness, receiverTopY),
    frameMaterial,
  ), 'fixed-lower-box-top-with-round-opening');
  root.add(lowerTop);
  const lowerBack = backWall([
    [-lowerOuter, groundY],
    [outletRightX, groundY],
    [outletRightX, outletRoofY + wallThickness],
    [lowerOuter, outletRoofY + wallThickness],
    [lowerOuter, receiverTopY],
    [-lowerOuter, receiverTopY],
  ], -lowerOuter, -lowerInner, 'fixed-rear-wall-of-lower-box-and-discharge');

  const plate0 = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(plateRadius, plateRadius, plateThickness, 64),
    plateMaterial,
  ), 'fixed-circular-plate-concentric-with-upper-orifice');
  plate0.position.y = plateTopY - plateThickness / 2;
  root.add(plate0);
  const plateStem = addRole(new THREE.Mesh(
    new THREE.LatheGeometry([
      [0, receiverFloorY], [0.16, receiverFloorY], [0.15, -1.52],
      [0.09, -1.40], [0.075, -1.20], [0.075, -0.62], [0.10, -0.42],
      [0.17, -0.32], [0.19, plateTopY - plateThickness],
      [0, plateTopY - plateThickness],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 48),
    stemMaterial,
  ), 'fixed-flared-stem-of-circular-plate');
  root.add(plateStem);

  // Water bodies stand a hair off the wall faces they rest against so the
  // coplanar faces do not z-fight.
  const skin = 0.004;
  const reservoirWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(upperInner - skin - channelLeftX,
      reservoirWaterY - channelFloorY - skin, upperInner - skin),
    waterMaterial,
  ), 'constant-supply-water-at-fixed-head');
  reservoirWater.position.set((channelLeftX + upperInner - skin) / 2,
    (channelFloorY + skin + reservoirWaterY) / 2, -(upperInner - skin) / 2);
  root.add(reservoirWater);

  const nozzleWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2 * (upperInner - skin),
      channelFloorY - chamberFloorY - skin, upperInner - skin),
    waterMaterial,
  ), 'water-within-fixed-upper-box-over-orifice');
  nozzleWater.position.set(0, (channelFloorY + skin + chamberFloorY) / 2,
    -(upperInner - skin) / 2);
  root.add(nozzleWater);

  // Unit-length tapered stream hanging from the orifice; its length follows
  // the top of the cone or raised column below it.
  // Brown's falling stream is waisted: it necks below the orifice and
  // spreads again as it meets the plate.
  const fallingJetProfile = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 24; i += 1) {
    const u = i / 24;
    fallingJetProfile.push(new THREE.Vector2(
      0.24 * (1 - u) + 0.30 * u - 0.10 * Math.sin(Math.PI * u) ** 1.4, -u));
  }
  fallingJetProfile.push(new THREE.Vector2(0, -1));
  const fallingJet = addRole(new THREE.Mesh(
    new THREE.LatheGeometry(fallingJetProfile, 40),
    streamMaterial,
  ), 'unobstructed-descending-stream');
  fallingJet.position.y = chamberFloorY;
  root.add(fallingJet);

  const filmInner = 0.405;
  const filmOuter = 0.455;
  const film = addRole(new THREE.Mesh(
    new THREE.LatheGeometry([
      [filmInner, plateTopY], [filmOuter, plateTopY],
      [filmOuter, plateTopY + 0.02], [filmInner, plateTopY + 0.02],
      [filmInner, plateTopY],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 64),
    streamMaterial,
  ), 'thin-water-film-over-fixed-plate');
  root.add(film);

  // The sheet leaving the plate rim bells outward and then falls almost
  // plumb, as Brown hatches it, rather than as a straight cone.
  const curtainRadius = (t) => 0.466 + 0.124 * (1 - (1 - t) ** 3);
  const curtainOuter = [], curtainInner = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const y = THREE.MathUtils.lerp(plateTopY + 0.01, lowerWaterY, t);
    curtainOuter.push([curtainRadius(t) + 0.01, y]);
    curtainInner.push([curtainRadius(t) - 0.01, y]);
  }
  const spillCurtain = addRole(new THREE.Mesh(
    new THREE.LatheGeometry([...curtainInner, ...curtainOuter.reverse(),
      curtainInner[0]].map(([r, y]) => new THREE.Vector2(r, y)), 64),
    streamMaterial.clone(),
  ), 'water-spreading-over-plate-and-descending-in-lower-box');
  root.add(spillCurtain);

  const stemClearance = 0.175;
  const lowerWater = addRole(new THREE.Mesh(
    holedFloor(-lowerInner + skin, lowerInner, lowerInner - skin,
      stemClearance, receiverFloorY + skin, lowerWaterY),
    waterMaterial,
  ), 'lower-receiver-water-flowing-to-discharge');
  root.add(lowerWater);

  const outletWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(outletRightX - lowerInner,
      lowerWaterY - receiverFloorY - skin, lowerInner - skin),
    waterMaterial,
  ), 'periodic-lower-discharge');
  outletWater.position.set((lowerInner + outletRightX) / 2,
    (lowerWaterY + receiverFloorY + skin) / 2, -(lowerInner - skin) / 2);
  root.add(outletWater);

  const crownRadius = 0.12;
  const coneBodyHeight = maximumConeHeight - crownRadius;
  // Brown's checked cone is concave: broad on the plate, drawing in quickly
  // and rising as a slender column toward the orifice.
  const coneProfile = [new THREE.Vector2(0, -coneBodyHeight / 2)];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    coneProfile.push(new THREE.Vector2(
      crownRadius + (0.40 - crownRadius) * (1 - t) ** 2.2,
      -coneBodyHeight / 2 + coneBodyHeight * t));
  }
  coneProfile.push(new THREE.Vector2(0, coneBodyHeight / 2));
  const waterCone = addRole(new THREE.Mesh(
    new THREE.LatheGeometry(coneProfile, 56),
    coneMaterial,
  ), 'self-forming-water-cone-on-fixed-circular-plate');
  root.add(waterCone);
  const crownProfile = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 12; i += 1) {
    const angle = Math.PI / 2 * i / 12;
    crownProfile.push(new THREE.Vector2(
      crownRadius * Math.cos(angle),
      crownRadius * Math.sin(angle),
    ));
  }
  const coneCrown = addRole(new THREE.Mesh(
    new THREE.LatheGeometry(crownProfile, 48),
    coneMaterial,
  ), 'water-cone-crown-entering-orifice');
  root.add(coneCrown);

  // Unit-length raised column above the cone crown; it ends at the upper
  // water surface where the spray plume sits.
  const risingColumn = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1, 40).translate(0, 0.5, 0),
    coneMaterial,
  ), 'checked-water-column-rising-through-orifice');
  root.add(risingColumn);
  // Where the column breaks the upper surface it heaves up and falls back
  // as a translucent crown thinning into spray, as Brown draws it.
  const topPlume = addRole(new THREE.Mesh(
    waterFountainGeometry({
      nozzleY: -0.04, apexY: 0.24, columnRadius: 0.13, crownRadius: 0.34,
      fallY: -0.03, crownThickness: 0.03, fadeStart: 0.5,
    }),
    waterJetMaterial({ color: 0x2c7f9b, opacity: 0.45 }),
  ), 'raised-water-column-spraying-in-upper-box');
  topPlume.renderOrder = 2;
  topPlume.position.set(0, reservoirWaterY, 0);
  root.add(topPlume);

  const upperColumnTopY = (fraction) => plateTopY
    + (reservoirWaterY - plateTopY) * fraction;

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
  const descendingCurves = descendingMarkers.map((_, index) => {
    const angle = index * 2.39996;
    const curve = new THREE.CatmullRomCurve3([
      [0.10, 1.60], [0.10, 1.12], [0.18, 0.40], [0.26, -0.02],
      [0.50, -0.15], [0.54, -0.42], [0.58, -1.20], [0.56, -1.45],
    ].map(([r, y]) => new THREE.Vector3(
      r * Math.cos(angle),
      y,
      r * Math.sin(angle),
    )), false, 'centripetal');
    curve.arcLengthDivisions = 512;
    curve.updateArcLengths();
    return curve;
  });
  const parts = {
    descendingCurves,
    film,
    fixed: [
      ...upperWalls, upperFloor, upperBack, ...lowerWalls, lowerTop,
      lowerBack, plate0, plateStem,
    ],
    markerTravelTurns: 0,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const coneScale = state.coneFraction;
    const radial = 0.90 + 0.10 * coneScale;
    waterCone.scale.set(radial, coneScale, radial);
    waterCone.position.y = plateTopY + coneBodyHeight * coneScale / 2;
    const coneTopY = plateTopY + coneBodyHeight * coneScale;
    const crownGate = THREE.MathUtils.smoothstep(coneScale, 0.12, 0.22);
    coneCrown.position.y = coneTopY;
    coneCrown.scale.setScalar(radial * crownGate);
    coneCrown.visible = crownGate > 0;
    const crownTopY = coneTopY + crownRadius * radial * crownGate;

    const columnFraction = state.upperColumnFraction;
    const columnTopY = Math.max(crownTopY, upperColumnTopY(columnFraction));
    const columnLength = columnTopY - crownTopY;
    risingColumn.position.y = crownTopY;
    risingColumn.scale.set(
      0.84 + 0.16 * columnFraction,
      Math.max(1e-4, columnLength),
      0.84 + 0.16 * columnFraction,
    );
    risingColumn.visible = columnLength > 1e-3;
    const plumeGate = smoothStep5((columnFraction - 0.94) / 0.06);
    topPlume.visible = plumeGate > 0;
    topPlume.scale.set(plumeGate, plumeGate, plumeGate);

    const relativeDownFlow = state.downwardFlowRate / supplyFlowRate;
    const jetLength = chamberFloorY - columnTopY;
    // Keep the stream clear of the orifice lip even when a short stream's
    // flared foot lies inside the orifice.
    const orificeDepth = chamberFloorY - nozzleBottomY;
    const jetRadial = Math.min(
      THREE.MathUtils.clamp(0.56 + 0.44 * relativeDownFlow, 0.40, 1.20),
      (orificeRadius - 0.01) / (0.24 + 0.06 * Math.min(
        1,
        orificeDepth / Math.max(jetLength, 1e-6),
      )),
    );
    fallingJet.scale.set(jetRadial, Math.max(1e-4, jetLength), jetRadial);
    fallingJet.visible = jetLength > 1e-3;
    spillCurtain.material.opacity = 0.20
      + 0.13 * Math.min(1.5, relativeDownFlow);

    // Integral of Q_down = Q_supply - dV_storage/dt, so tracer travel never
    // reverses or jumps when the prescribed flow changes.
    const turn = sourcePhase + time / cycleDuration
      - state.upperStorageVolume / (supplyFlowRate * cycleDuration);
    const progress = (value) => THREE.MathUtils.euclideanModulo(value, 1);
    descendingMarkers.forEach((marker, index) => {
      const u = progress(turn + index / descendingMarkers.length);
      marker.position.copy(descendingCurves[index].getPointAt(u));
      marker.visible = true;
      marker.scale.setScalar(0.72 * Math.sin(Math.PI * u)
        * Math.min(1, Math.sqrt(Math.max(0, relativeDownFlow))));
    });
    outletMarkers.forEach((marker, index) => {
      const u = progress(turn + index / outletMarkers.length);
      marker.position.set(
        THREE.MathUtils.lerp(0.30, 1.85, u),
        (receiverFloorY + lowerWaterY) / 2,
        -0.45,
      );
      marker.scale.setScalar(0.78 * Math.sin(Math.PI * u));
    });
    risingMarkers.forEach((marker, index) => {
      const u = progress(columnFraction * 1.6 + index / risingMarkers.length);
      marker.position.set(
        0.06 * Math.sin(index * 1.7),
        plateTopY + 0.12 + u * Math.max(0, columnTopY - plateTopY - 0.18),
        0.06,
      );
      const riseGate = Math.min(
        1,
        Math.max(0, state.upperStorageVolumeRate) / 0.055,
      );
      marker.visible = riseGate > 0;
      marker.scale.setScalar(0.72 * Math.sin(Math.PI * u) * riseGate
        * Math.min(1, columnFraction * 5));
    });
    parts.markerTravelTurns = turn;
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
    coneBodyHeight,
    coneBreakStartPhase,
    coneBuildEndPhase,
    coneCollapseEndPhase,
    coneCollapsedFraction,
    coneMinimumFraction,
    crownRadius,
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
      coneCrown,
      descendingMarkers,
      fallingJet,
      lowerBack,
      lowerTop,
      lowerWalls,
      lowerWater,
      nozzleWater,
      outletMarkers,
      outletWater,
      plate: plate0,
      plateStem,
      reservoirWater,
      risingColumn,
      risingMarkers,
      spillCurtain,
      topPlume,
      upperBack,
      upperFloor,
      upperWalls,
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
      'Every solid part is fixed. Water supplied at constant head through a horizontal conduit descends from the orifice in the floor of a small upper box and spreads over the concentric circular plate inside a larger lower box. The impinging water gradually forms a cone on the plate; when the cone reaches into the orifice it checks the downward flow, so continuing supply raises the upper water column. The cone then gives way, the stored column surges downward around the plate, and unobstructed descent begins again.',
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
          ? 'Plate 446 is a vertical section in the checked-flow state: a horizontal supply conduit entering from the left and turning down into a small box with an orifice in its floor, the self-formed water column rising from the fixed circular plate through the opening in the top of a larger lower box and spraying up inside the small box, water still spilling round the plate, the flared stem, and a floor-level discharge channel to the right.'
          : 'Plate 445 is a vertical section in the open-flow state: a horizontal supply conduit entering from the left and turning down into a small box with an orifice in its floor, a stream falling through the opening in the top of a larger lower box onto a circular plate on a fixed flared stem, water spreading down round the plate, and a floor-level discharge channel to the right.',
        reconstructionDisclosure:
          'Brown gives no dimensions, flow rate, head, plate clearance, cone profile, storage volume, pressure, loss coefficients, collapse threshold, cycle time, or transient timing. Box proportions follow the engraving’s section; depths, the mid-plane cutaway, colors, tracer positions, 5.6-second phase schedule, quintic envelopes, and storage amplitude are independently engineered. The fixed topology, constant supply, cone buildup, throat check, upper-column rise, cone failure, and periodic renewal are source-grounded.',
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
    new THREE.Vector3(channelLeftX, groundY, -lowerOuter),
    new THREE.Vector3(outletRightX, channelRoofY + wallThickness, 0.45),
  );
  root.userData.cameraDistanceScale = 1;
  root.userData.cameraDirection = new THREE.Vector3(0.10, 0.12, 1);
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 5.6;
  root.userData.oscillatingColumnParts = parts;
  root.userData.reconstructionNote =
    'All solid parts remain fixed, as in the engraving, which is drawn as a section; the boxes are cut on their mid-plane. Cone buildup, checking, raised-column storage and collapse are prescribed fluid envelopes; pressure recovery, free-surface instability and the historical device’s operating threshold are not solved.';
  root.userData.dynamics.fluidModel =
    'The upper-storage scalar balance is exact, while the visible fluid envelopes are illustrative. This is not a CFD solution: cone volume, pressure-wave propagation, turbulence, entrained air, breakup and losses are not solved.';
  markShadows(root);
  root.traverse((object) => {
    for (const material of [].concat(object.material ?? [])) {
      material.fog = false;
      if (material.transparent) {
        material.depthWrite = false;
        object.castShadow = false;
        object.receiveShadow = false;
      }
    }
  });
  for (const marker of [
    ...descendingMarkers, ...risingMarkers, ...outletMarkers,
  ]) {
    marker.castShadow = false;
    marker.receiveShadow = false;
  }
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
