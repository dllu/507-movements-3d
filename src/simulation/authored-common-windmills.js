import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { correctWindRotorWorkingParts } from './wind-rotor-working-parts.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function cylinderBetween(start, end, radius, material, role, sides = 18) {
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

function bladePitchAt(radialFraction, rootPitchRadian, tipPitchRadian) {
  return THREE.MathUtils.lerp(
    rootPitchRadian,
    tipPitchRadian,
    radialFraction,
  );
}

function bladeSurfacePoint({
  chordFraction,
  radialFraction,
  rootChordSceneUnit,
  rootPitchRadian,
  rootRadiusSceneUnit,
  tipChordSceneUnit,
  tipPitchRadian,
  tipRadiusSceneUnit,
}) {
  const radius = THREE.MathUtils.lerp(
    rootRadiusSceneUnit,
    tipRadiusSceneUnit,
    radialFraction,
  );
  const halfChord = THREE.MathUtils.lerp(
    rootChordSceneUnit,
    tipChordSceneUnit,
    radialFraction,
  ) / 2;
  const chordCoordinate = chordFraction * halfChord;
  const pitch = bladePitchAt(
    radialFraction,
    rootPitchRadian,
    tipPitchRadian,
  );
  return new THREE.Vector3(
    -chordCoordinate,
    radius,
    chordCoordinate * Math.tan(pitch),
  );
}

function windmillSailGeometry(parameters) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= parameters.segments; index += 1) {
    const radialFraction = index / parameters.segments;
    positions.push(
      ...bladeSurfacePoint({
        ...parameters,
        chordFraction: -1,
        radialFraction,
      }).toArray(),
      ...bladeSurfacePoint({
        ...parameters,
        chordFraction: 1,
        radialFraction,
      }).toArray(),
    );
    if (index < parameters.segments) {
      const base = 2 * index;
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    rootChordSceneUnit: parameters.rootChordSceneUnit,
    rootPitchRadian: parameters.rootPitchRadian,
    rootRadiusSceneUnit: parameters.rootRadiusSceneUnit,
    segments: parameters.segments,
    tipChordSceneUnit: parameters.tipChordSceneUnit,
    tipPitchRadian: parameters.tipPitchRadian,
    tipRadiusSceneUnit: parameters.tipRadiusSceneUnit,
  };
  return geometry;
}

function makeWindArrow({ material, position, role }) {
  const group = addRole(new THREE.Group(), role);
  group.position.copy(position);
  const shaft = cylinderBetween(
    new THREE.Vector3(0, 0, 0.44),
    new THREE.Vector3(0, 0, -0.18),
    0.032,
    material,
    `${role}-shaft`,
    12,
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.105, 0.27, 16),
    material,
  );
  head.rotation.x = -Math.PI / 2;
  head.position.z = -0.31;
  head.userData.role = `${role}-head`;
  group.add(shaft, head);
  return group;
}

function commonWindmill(movement) {
  const root = new THREE.Group();
  const sailCount = 4;
  const bladeSegments = 36;
  const rootRadiusSceneUnit = 0.34;
  const tipRadiusSceneUnit = 1.82;
  // Brown's lattice sails are broad trapezoids, about two thirds as wide at
  // the tip as they are long.
  const rootChordSceneUnit = 0.34;
  const tipChordSceneUnit = 1.00;
  const rootPitchRadian = THREE.MathUtils.degToRad(17);
  const tipPitchRadian = THREE.MathUtils.degToRad(8);
  const rotorCenter = new THREE.Vector3(0, 1.19, 1.14);
  const physicalRotorRadiusMetre = 7.9248;
  const physicalBladeRootRadiusMetre = 1.2192;
  const physicalRootChordMetre = 0.9144;
  const physicalTipChordMetre = 2.4384;
  const windSpeedMagnitudeMetrePerSecond = 8.9408;
  const windVelocityZMetrePerSecond = -windSpeedMagnitudeMetrePerSecond;
  const referenceRotorSpeedRevolutionPerMinute = 20;
  const shaftAngularVelocityRadianPerSecond =
    referenceRotorSpeedRevolutionPerMinute * FULL_TURN / 60;
  const tipSpeedRatio = shaftAngularVelocityRadianPerSecond
    * physicalRotorRadiusMetre / windSpeedMagnitudeMetrePerSecond;
  const cycleDuration = FULL_TURN / shaftAngularVelocityRadianPerSecond;
  const airDensityKilogramPerCubicMetre = 1.225;
  const powerCoefficient = 0.22;
  const sweptAreaSquareMetre = Math.PI * physicalRotorRadiusMetre ** 2;
  const totalSailAreaSquareMetre = sailCount
    * (physicalRotorRadiusMetre - physicalBladeRootRadiusMetre)
    * (physicalRootChordMetre + physicalTipChordMetre) / 2;
  const sailSolidity = totalSailAreaSquareMetre / sweptAreaSquareMetre;
  const availableWindPowerWatt = 0.5
    * airDensityKilogramPerCubicMetre
    * sweptAreaSquareMetre
    * windSpeedMagnitudeMetrePerSecond ** 3;
  const shaftPowerWatt = powerCoefficient * availableWindPowerWatt;
  const drivingTorqueZNewtonMetre = shaftPowerWatt
    / shaftAngularVelocityRadianPerSecond;
  const resistingLoadTorqueZNewtonMetre = -drivingTorqueZNewtonMetre;
  const markerPacketAdvanceMetre = windSpeedMagnitudeMetrePerSecond
    * cycleDuration / 4;
  const markersPerPath = 4;

  const bladeParameters = {
    rootChordSceneUnit,
    rootPitchRadian,
    rootRadiusSceneUnit,
    segments: bladeSegments,
    tipChordSceneUnit,
    tipPitchRadian,
    tipRadiusSceneUnit,
  };
  const bladePointScene = (radialFraction, chordFraction) =>
    bladeSurfacePoint({
      ...bladeParameters,
      chordFraction,
      radialFraction,
    });
  const bladeSectionAt = (radialFraction) => {
    const pitchRadian = bladePitchAt(
      radialFraction,
      rootPitchRadian,
      tipPitchRadian,
    );
    const localPositiveTangentialDirection = new THREE.Vector3(-1, 0, 0);
    const localUpstreamSurfaceNormal = new THREE.Vector3(
      Math.sin(pitchRadian),
      0,
      Math.cos(pitchRadian),
    );
    const localWindwardForceDirection = localUpstreamSurfaceNormal
      .clone().negate();
    return {
      localPositiveTangentialDirection,
      localUpstreamSurfaceNormal,
      localWindwardForceDirection,
      pitchRadian,
      positiveTangentialForceFraction:
        localWindwardForceDirection.dot(localPositiveTangentialDirection),
    };
  };
  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const windAxialDisplacementMetre = windVelocityZMetrePerSecond * time;
    const rotorAngleRadian = shaftAngularVelocityRadianPerSecond * time;
    return {
      availableWindPowerWatt,
      cycleTime,
      drivingTorqueZNewtonMetre,
      markerTravelTurns: -windAxialDisplacementMetre
        / markerPacketAdvanceMetre,
      phase: cycleTime / cycleDuration,
      resistingLoadTorqueZNewtonMetre,
      rotorAngleRadian,
      shaftAngularVelocityRadianPerSecond,
      shaftPowerWatt,
      windAxialDisplacementMetre,
      windVelocityZMetrePerSecond,
    };
  };

  const towerMaterial = matte(PALETTE.muted, {
    metalness: 0.04,
    roughness: 0.82,
  });
  const capMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.38,
  });
  const stockMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.46,
  });
  const sailMaterial = matte(PALETTE.accent, {
    metalness: 0.06,
    opacity: 0.83,
    roughness: 0.55,
    side: THREE.DoubleSide,
    transparent: true,
  });
  sailMaterial.depthWrite = false;
  // Brown's lattice sails are timber frames: a wood tone, not black edging.
  const sailFrameMaterial = matte(0x7a5a34, {
    metalness: 0.02,
    roughness: 0.8,
  });
  const hubMaterial = matte(PALETTE.driven, {
    metalness: 0.30,
    roughness: 0.35,
  });
  const windMaterial = matte(PALETTE.fluid, {
    opacity: 0.40,
    roughness: 0.25,
    transparent: true,
  });
  windMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.95,
    roughness: 0.18,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const foundation = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.11, 1.19, 0.17, 56),
    capMaterial,
  ), 'fixed-circular-foundation-under-tower');
  foundation.position.y = -1.93;
  root.add(foundation);
  const tower = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 1.02, 2.84, 56),
    towerMaterial,
  ), 'fixed-tapered-common-windmill-tower');
  tower.position.y = -0.47;
  root.add(tower);

  const capTurntable = addRole(new THREE.Group(),
    'fixed-yaw-aligned-cap-and-tail-assembly');
  const dome = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(
      0.80,
      48,
      22,
      0,
      FULL_TURN,
      0,
      Math.PI / 2,
    ),
    capMaterial,
  ), 'domed-windmill-head-covering-windshaft-bearings');
  dome.position.y = 0.95;
  // The curb ring under the cap is part of the cap casting (its colour),
  // not a dark band.
  const capRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.055, 12, 48),
    capMaterial,
  );
  capRing.rotation.x = Math.PI / 2;
  capRing.position.y = 0.95;
  capRing.userData.role = 'fixed-cap-yaw-ring';
  capTurntable.add(dome, capRing);
  root.add(capTurntable);

  const door = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.43, 0.82, 0.07),
    darkMaterial,
  ), 'fixed-front-door-of-tower');
  door.position.set(0, -1.42, 0.91);
  root.add(door);
  const windows = [-0.38, 0.38].map((x, index) => {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.39, 0.055),
      darkMaterial,
    );
    window.position.set(x, -0.43, 0.83);
    window.userData.role = `fixed-tower-window-${index + 1}`;
    root.add(window);
    return window;
  });

  // The tail beam starts inside the dome just behind the windshaft's rear
  // end (z -0.16), clear of the turning shaft instead of running along it.
  const tailRod = cylinderBetween(
    new THREE.Vector3(0, 1.23, -0.24),
    new THREE.Vector3(0, 1.40, -2.42),
    0.065,
    darkMaterial,
    'fixed-tail-beam-aligning-cap-with-wind',
    18,
  );
  const tailVane = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.88, 1.20),
    stockMaterial,
  ), 'fixed-broad-tail-vane-in-vertical-axial-plane');
  tailVane.position.set(0, 1.47, -2.20);
  capTurntable.add(tailRod, tailVane);

  const bearings = [0.54, 0.83].map((z, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.065, 12, 36),
      darkMaterial,
    );
    bearing.position.set(0, rotorCenter.y, z);
    bearing.userData.role = `fixed-windshaft-gudgeon-bearing-${index + 1}`;
    root.add(bearing);
    return bearing;
  });

  const rotor = addRole(new THREE.Group(),
    'single-rigid-four-sail-windshaft-rotor');
  rotor.position.copy(rotorCenter);
  root.add(rotor);
  const windshaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 1.62, 24),
    darkMaterial,
  ), 'single-rigid-horizontal-windshaft');
  windshaft.rotation.x = Math.PI / 2;
  windshaft.position.z = -0.49;
  rotor.add(windshaft);

  const sails = [];
  for (let sailIndex = 0; sailIndex < sailCount; sailIndex += 1) {
    const sail = addRole(new THREE.Group(),
      `rigid-oblique-lattice-sail-${sailIndex + 1}`);
    sail.rotation.z = sailIndex * FULL_TURN / sailCount;
    const stock = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.115, tipRadiusSceneUnit + 0.17, 0.105),
      stockMaterial,
    ), `radial-stock-of-sail-${sailIndex + 1}`);
    stock.position.y = (tipRadiusSceneUnit + 0.17) / 2;
    const panel = addRole(new THREE.Mesh(
      windmillSailGeometry(bladeParameters),
      sailMaterial,
    ), `continuous-twisted-oblique-surface-of-sail-${sailIndex + 1}`);
    sail.add(stock, panel);

    const perimeter = [];
    for (const chordFraction of [-1, 1]) {
      const points = Array.from(
        { length: bladeSegments + 1 },
        (_, index) => bladePointScene(
          index / bladeSegments,
          chordFraction,
        ),
      );
      const curve = new THREE.CatmullRomCurve3(
        points,
        false,
        'centripetal',
      );
      const edge = new THREE.Mesh(
        new THREE.TubeGeometry(curve, bladeSegments, 0.026, 8, false),
        sailFrameMaterial,
      );
      edge.userData.role =
        `longitudinal-perimeter-${chordFraction < 0 ? 'leading' : 'trailing'}-sail-${sailIndex + 1}`;
      sail.add(edge);
      perimeter.push(edge);
    }
    for (const radialFraction of [0, 1]) {
      const edge = cylinderBetween(
        bladePointScene(radialFraction, -1),
        bladePointScene(radialFraction, 1),
        0.026,
        sailFrameMaterial,
        `${radialFraction === 0 ? 'root' : 'tip'}-perimeter-sail-${sailIndex + 1}`,
        10,
      );
      sail.add(edge);
      perimeter.push(edge);
    }

    const lattice = [];
    for (const chordFraction of [-0.5, 0, 0.5]) {
      const points = Array.from(
        { length: bladeSegments + 1 },
        (_, index) => bladePointScene(
          index / bladeSegments,
          chordFraction,
        ),
      );
      const curve = new THREE.CatmullRomCurve3(
        points,
        false,
        'centripetal',
      );
      const rib = new THREE.Mesh(
        new THREE.TubeGeometry(curve, bladeSegments, 0.014, 7, false),
        sailFrameMaterial,
      );
      rib.userData.role =
        `longitudinal-lattice-rib-${chordFraction}-sail-${sailIndex + 1}`;
      sail.add(rib);
      lattice.push(rib);
    }
    for (let ribIndex = 1; ribIndex <= 7; ribIndex += 1) {
      const radialFraction = ribIndex / 8;
      const rib = cylinderBetween(
        bladePointScene(radialFraction, -1),
        bladePointScene(radialFraction, 1),
        0.013,
        sailFrameMaterial,
        `cross-lattice-rib-${ribIndex}-sail-${sailIndex + 1}`,
        7,
      );
      sail.add(rib);
      lattice.push(rib);
    }
    rotor.add(sail);
    sails.push({ lattice, panel, perimeter, sail, stock });
  }

  const hub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.36, 36),
    hubMaterial,
  ), 'single-hub-fixing-all-four-sails-to-windshaft');
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.08;
  rotor.add(hub);
  const hubRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.285, 0.045, 10, 36),
    darkMaterial,
  ), 'rigid-front-rim-of-windshaft-hub');
  hubRim.position.z = 0.27;
  // Only the hub's drawn edge: hidden reference, not a dark rim.
  hubRim.visible = false;
  hubRim.userData.retiredInkOutline = true;
  rotor.add(hubRim);
  const windshaftIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.075, 0.055),
    markerMaterial,
  ), 'white-windshaft-rotation-index');
  windshaftIndex.position.set(0.17, 0, 0.325);
  rotor.add(windshaftIndex);
  const sailIndexMarker = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    markerMaterial,
  ), 'white-index-marker-fixed-to-first-sail');
  sailIndexMarker.position.copy(bladePointScene(0.79, 0.73));
  sails[0].sail.add(sailIndexMarker);

  const windPathOffsets = [
    [-2.34, 2.40],
    [-1.55, 1.56],
    [-0.78, 2.77],
    [0.78, 2.77],
    [1.55, 1.56],
    [2.34, 0.40],
  ];
  const windCurves = [];
  const windMarkerSets = [];
  for (let pathIndex = 0; pathIndex < windPathOffsets.length; pathIndex += 1) {
    const [x, y] = windPathOffsets[pathIndex];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, y, 2.86),
      new THREE.Vector3(x, y, 1.52),
      new THREE.Vector3(x, y, 0.10),
      new THREE.Vector3(x, y, -2.60),
    ], false, 'centripetal');
    windCurves.push(curve);
    const markers = Array.from({ length: markersPerPath }, (_, index) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.066, 16, 11),
        markerMaterial,
      );
      marker.userData.role =
        `axial-wind-marker-path-${pathIndex + 1}-${index + 1}`;
      root.add(marker);
      return marker;
    });
    windMarkerSets.push(markers);
  }
  const markerProgress = (turns, pathIndex, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / markersPerPath
        + pathIndex / (windPathOffsets.length * markersPerPath),
      1,
    );
  const windArrows = [-2.48, 2.48].map((x, index) => {
    const arrow = makeWindArrow({
      material: windMaterial,
      position: new THREE.Vector3(x, 2.85, 2.42),
      role: `fixed-negative-z-wind-direction-arrow-${index + 1}`,
    });
    root.add(arrow);
    return arrow;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngleRadian;
    for (let pathIndex = 0; pathIndex < windMarkerSets.length;
      pathIndex += 1) {
      const markers = windMarkerSets[pathIndex];
      for (let markerIndex = 0; markerIndex < markers.length;
        markerIndex += 1) {
        const progress = markerProgress(
          state.markerTravelTurns,
          pathIndex,
          markerIndex,
        );
        markers[markerIndex].position.copy(
          windCurves[pathIndex].getPointAt(progress),
        );
        markers[markerIndex].scale.setScalar(
          Math.sin(Math.PI * progress) ** 0.50,
        );
      }
    }
  };

  const geometry = {
    airDensityKilogramPerCubicMetre,
    availableWindPowerWatt,
    bladeSegments,
    cycleDuration,
    markerPacketAdvanceMetre,
    markersPerPath,
    physicalBladeRootRadiusMetre,
    physicalRootChordMetre,
    physicalRotorRadiusMetre,
    physicalTipChordMetre,
    powerCoefficient,
    referenceRotorSpeedRevolutionPerMinute,
    rootChordSceneUnit,
    rootPitchRadian,
    rootRadiusSceneUnit,
    rotorCenter,
    sailCount,
    sailSolidity,
    shaftAngularVelocityRadianPerSecond,
    sweptAreaSquareMetre,
    tipChordSceneUnit,
    tipPitchRadian,
    tipRadiusSceneUnit,
    tipSpeedRatio,
    totalSailAreaSquareMetre,
    windSpeedMagnitudeMetrePerSecond,
    windVelocityZMetrePerSecond,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'four-twisted-oblique-lattice-sails-on-one-horizontal-windshaft-direct-axial-wind-to-rigid-rotation',
    bladePointScene,
    bladeSectionAt,
    blocks: {
      bearings,
      capRing,
      capTurntable,
      dome,
      door,
      foundation,
      hub,
      hubRim,
      rotor,
      sailIndexMarker,
      sails,
      tailRod,
      tailVane,
      tower,
      windows,
      windArrows,
      windMarkerSets,
      windshaft,
      windshaftIndex,
    },
    degreesOfFreedom: {
      capYawLockedToDisplayedWindDirection: 0,
      independentOperatingCoordinates: 1,
      rigidWindshaftAndFourSailRotation: 1,
    },
    dynamics: {
      aerodynamicAssumption:
        'Brown specifies neither dimensions nor rate. The displayed steady operating point uses a disclosed power coefficient at a representative historical 52-foot, 20-mile-per-hour, 20-rpm scale; it is a signed energy model rather than CFD or a claim about Brown’s pictured mill.',
      directObliqueAction:
        'At the top sail, negative-Z wind pressure on the positively weathered surface has a negative-X tangential component. Negative X is the positive tangential direction for positive-Z rotation there, so all four identically weathered sails add positive shaft torque.',
      markerContinuity:
        'White wind packets advance from the analytic integral of constant axial velocity and use getPointAt arc-length sampling on uninterrupted negative-Z paths, with smooth endpoint fades.',
      rigidRotor:
        'All four sail stocks, all four twisted surfaces, the hub, both visible indexes, and the windshaft are children of one rotor and therefore share exactly one angle and angular speed.',
      yawScope:
        'The tail member establishes how a common mill is held head-on to the wind. Wind-direction changes and cap yaw are intentionally locked because Brown’s movement illustrates sail rotation, not the orientation transient.',
    },
    fidelity: 'authored',
    flow: {
      direction: new THREE.Vector3(0, 0, -1),
      markerProgress,
      windCurves,
    },
    geometry,
    mechanism:
      'Four broad lattice sails are fixed ninety degrees apart to one hub and one nearly horizontal windshaft. Each sail surface is weathered in the same sense and twists continuously from seventeen degrees at its inner end to eight degrees at its tip. A head-on negative-Z wind therefore resolves pressure into the same positive tangential direction on every sail, producing counterclockwise rotation when viewed from in front (+Z). The fixed tower, cap bearings, and tail alignment do not rotate with the shaft.',
    motion: {
      rotationAxis: new THREE.Vector3(0, 0, 1),
      rotationSenseViewedFromFrontPositiveZ: 'counterclockwise',
      shaftAngularVelocityVector: new THREE.Vector3(
        0,
        0,
        shaftAngularVelocityRadianPerSecond,
      ),
      windDirection: new THREE.Vector3(0, 0, -1),
      windVelocityVectorMetrePerSecond: new THREE.Vector3(
        0,
        0,
        windVelocityZMetrePerSecond,
      ),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 485 HTML marks Animated unavailable and supplies only Brown’s engraving and one-sentence caption.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate485: {
        approximateHubCenterPixels: [171, 192],
        approximateSailTipPixels: [161, 13, 54, 202, 108, 389, 278, 282],
        approximateTailOutlinePixels: [332, 126, 508, 97, 397, 184],
        approximateTowerBoundsPixels: [193, 137, 391, 469],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device is a common wind-mill',
          'wind acts directly on the sails',
          'the sails are oblique',
          'the result is circular motion',
        ],
        engravingEvidence:
          'Brown’s perspective shows four broad lattice-faced trapezoidal sails at right angles on one projecting shaft and hub, mounted at the head of a tapered tower with a rearward tail member.',
        hauksbeeWhistonCorroboration:
          'Hauksbee and Whiston’s early-eighteenth-century experimental course, Plate V figure 2, states that wind blows parallel to the axis and that paired oblique sails agree in the same circular motion.',
        reconstructionDisclosure:
          'The four-sail topology, common shaft and hub, tapered tower, rearward alignment member, oblique surfaces, direct wind action, and circular output are source-grounded. The continuous 17-to-8-degree twist, exact dimensions, physical scale, speed, power coefficient, aerodynamic load, colors, particle paths, and timing are either historically representative or independently engineered and exposed.',
        sheltonCorroboration:
          'F. H. Shelton’s 1919 Windmills describes four as the usual number of arms, identifies the surface twist as the angle of weather, gives representative 17-degree inner and 8-degree outer angles, and describes the windshaft, bearings, and tail-beam alignment.',
        williamsburgCorroboration:
          'Thomas K. Ford’s account of the reconstructed Williamsburg mill records four arms fixed to one windshaft, usual counterclockwise rotation viewed from the front, and a representative 52-foot rotor turning about 20 rpm in a 20 mph wind.',
      },
      hauksbeeWhistonUrl:
        'https://www.gutenberg.org/files/44019/44019-h/44019-h.htm',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 485',
      sheltonUrl:
        'https://www.gutenberg.org/files/54075/54075-h/54075-h.htm',
      williamsburgUrl:
        'https://www.gutenberg.org/files/58036/58036-h/58036-h.htm',
    },
    stateAtTime,
    transmission: {
      angularSpeedEquation:
        'omega_z=-pitch_handedness*lambda*U_z/R; displayed U_z<0 and positive weathering give omega_z>0',
      powerEquation:
        'P_shaft=C_P*(rho*A*abs(U_z)^3/2); tau_z=P_shaft/omega_z; tau_load=-tau_z',
      rigidShaftConstraint:
        'theta_sail_1=theta_sail_2=theta_sail_3=theta_sail_4=theta_hub=theta_windshaft',
      surfaceEquation:
        'p(u,v)=(-v*c(u)/2, r(u), v*c(u)*tan(beta(u))/2), beta(0)=17deg, beta(1)=8deg',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.00, -2.10, -2.84),
    new THREE.Vector3(3.00, 3.23, 3.04),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(7.6, 4.4, 11.8);
  root.userData.groundFloorY = -2.10;
  correctWindRotorWorkingParts(root, 485);
  // Brown views the mill from its left front, the sails edge-on enough to
  // stand beside the tower, and draws a large oval tail vane trailing to the
  // right.
  {
    // Brown's tail is one long loop: narrow where it leaves the dome and
    // swelling to a round end, rising slightly as it trails away. The loop
    // springs straight from the cap, so no separate beam shows.
    const vane = root.userData.blocks.tailVane;
    const tailLength = 2.30, endRadius = 0.46, rootHalf = 0.05, rise = 0.14;
    const beta = Math.asin(endRadius / tailLength);
    const loop = [[0, rootHalf]];
    for (let i = 0; i <= 64; i += 1) {
      const angle = Math.PI / 2 + beta - (Math.PI + 2 * beta) * i / 64;
      loop.push([tailLength + endRadius * Math.cos(angle), endRadius * Math.sin(angle)]);
    }
    loop.push([0, -rootHalf]);
    const tilt = ([u, v]) => new THREE.Vector2(
      u * Math.cos(rise) - v * Math.sin(rise), u * Math.sin(rise) + v * Math.cos(rise));
    const loopShape = new THREE.Shape(loop.map(tilt));
    // Brown's outline encloses a vane sheet (the engraving leaves its face
    // white), so the loop is one filled board, not an open wire.
    vane.geometry.dispose();
    vane.geometry = new THREE.ExtrudeGeometry(loopShape, {
      bevelEnabled: false,
      curveSegments: 48,
      depth: 0.06,
    }).translate(0, 0, -0.03).rotateY(Math.PI / 2);
    vane.position.set(0, 1.36, -0.46);
    root.userData.blocks.tailRod.visible = false;
    // Fit the tower, swept sails and tail only (no wind arrows or beads).
    root.userData.cameraFitBounds.set(
      new THREE.Vector3(-2.15, -2.05, -4.25),
      new THREE.Vector3(2.15, 3.25, 1.55),
    );
    // Brown draws two small round-headed windows high on the tower, one near
    // the middle and one toward its right edge, and a round-headed door at
    // the foot right of centre, all set flush in the tapered wall.
    const towerRadiusAt = (y) => 0.72 + 0.30 * (0.95 - y) / 2.84;
    const taper = Math.atan2(0.30, 2.84);
    const arch = (width, height) => {
      const half = width / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-half, 0);
      shape.lineTo(half, 0);
      shape.lineTo(half, height - half);
      shape.absarc(0, height - half, half, 0, Math.PI, false);
      shape.lineTo(-half, 0);
      return new THREE.ExtrudeGeometry(shape, {
        bevelEnabled: false,
        curveSegments: 16,
        depth: 0.04,
      }).translate(0, 0, -0.025);
    };
    const setOpening = (mesh, geometry, azimuthDegrees, bottomY) => {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      const azimuth = THREE.MathUtils.degToRad(azimuthDegrees);
      const radius = towerRadiusAt(bottomY);
      mesh.position.set(Math.sin(azimuth) * radius, bottomY, Math.cos(azimuth) * radius);
      mesh.rotation.set(-taper, azimuth, 0, 'YXZ');
    };
    // Brown shows no whips running past the sail tips: end each stock at
    // its sail's tip bar.
    for (const { stock } of sails) {
      stock.geometry.dispose();
      stock.geometry = new THREE.BoxGeometry(0.115, tipRadiusSceneUnit, 0.105);
      stock.position.y = tipRadiusSceneUnit / 2;
      // One more timber lattice bar, in the sail frame's wood tone.
      stock.material = sailFrameMaterial;
    }
    {
      const { door, windows } = root.userData.blocks;
      setOpening(door, arch(0.34, 0.66), 14, -1.87);
      setOpening(windows[0], arch(0.15, 0.34), -12, -0.42);
      setOpening(windows[1], arch(0.15, 0.34), 38, -0.42);
    }
    // The tower door and windows face the viewer while the cap has turned the
    // windshaft toward the left front, so the four sails open out beside the
    // tower nearly face-on, as in the plate.
    const facing = THREE.MathUtils.degToRad(44);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), facing);
    const { door, windows } = root.userData.blocks;
    for (const opening of [door, ...windows]) {
      opening.position.applyQuaternion(yaw);
      opening.quaternion.premultiply(yaw);
    }
    // Brown looks almost level at the mill: the ground ellipse is flat.
    root.userData.cameraDirection.set(Math.sin(facing) * 10, 2.0, Math.cos(facing) * 10);
  }
  markShadows(root);
  for (const sail of sails) sail.panel.castShadow = false;
  for (const arrow of windArrows) {
    arrow.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    });
  }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCommonWindmillMovement(movement) {
  if (movement.id !== 485) return null;
  return commonWindmill(movement);
}
