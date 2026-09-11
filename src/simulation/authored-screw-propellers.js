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

function axialArrow({ direction, length, material, position, role }) {
  const group = addRole(new THREE.Group(), role);
  group.position.copy(position);
  const sign = Math.sign(direction) || 1;
  const shaft = cylinderBetween(
    new THREE.Vector3(-sign * length * 0.43, 0, 0),
    new THREE.Vector3(sign * length * 0.24, 0, 0),
    0.037,
    material,
    `${role}-shaft`,
    12,
  );
  const head = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.13, length * 0.30, 18),
    material,
  ), `${role}-head`);
  head.rotation.z = -sign * Math.PI / 2;
  head.position.x = sign * length * 0.39;
  group.add(shaft, head);
  return group;
}

function smoothstep01(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function screwPropeller(movement) {
  const root = new THREE.Group();
  const bladeCount = 2;
  const radialSegments = 44;
  const chordSegments = 10;
  const rootRadiusSceneUnit = 0.42;
  const tipRadiusSceneUnit = 2.28;
  const screwPitchSceneUnitPerTurn = 3.75;
  const helicalLeadCoefficientSceneUnit =
    screwPitchSceneUnitPerTurn / FULL_TURN;

  const physicalDiameterMetre = 3.60;
  const physicalRadiusMetre = physicalDiameterMetre / 2;
  const physicalScrewPitchMetrePerTurn = 3.75;
  const waterDensityKilogramPerCubicMetre = 1000;
  const shaftSpeedRevolutionPerMinute = 90;
  const shaftSpeedRevolutionPerSecond =
    shaftSpeedRevolutionPerMinute / 60;
  const angularVelocityX = FULL_TURN * shaftSpeedRevolutionPerSecond;
  const cycleDuration = 1 / shaftSpeedRevolutionPerSecond;
  const advanceCoefficient = 0.75;
  const advanceVelocityXMetrePerSecond = advanceCoefficient
    * shaftSpeedRevolutionPerSecond
    * physicalDiameterMetre;
  const idealScrewAdvanceVelocityXMetrePerSecond =
    physicalScrewPitchMetrePerTurn * shaftSpeedRevolutionPerSecond;
  const axialSlipFraction = 1
    - advanceVelocityXMetrePerSecond
      / idealScrewAdvanceVelocityXMetrePerSecond;
  const thrustCoefficient = 0.18;
  const torqueCoefficient = 0.03;
  const thrustXNewton = thrustCoefficient
    * waterDensityKilogramPerCubicMetre
    * shaftSpeedRevolutionPerSecond ** 2
    * physicalDiameterMetre ** 4;
  const resistingWaterTorqueXNewtonMetre = -torqueCoefficient
    * waterDensityKilogramPerCubicMetre
    * shaftSpeedRevolutionPerSecond ** 2
    * physicalDiameterMetre ** 5;
  const engineDriveTorqueXNewtonMetre =
    -resistingWaterTorqueXNewtonMetre;
  const shaftInputPowerWatt =
    engineDriveTorqueXNewtonMetre * angularVelocityX;
  const usefulPropulsivePowerWatt =
    thrustXNewton * advanceVelocityXMetrePerSecond;
  const wakeAndSlipPowerWatt =
    shaftInputPowerWatt - usefulPropulsivePowerWatt;
  const openWaterEfficiency =
    usefulPropulsivePowerWatt / shaftInputPowerWatt;

  const halfChordAngleAt = (radialFraction) => {
    const shoulder = Math.sin(Math.PI * radialFraction) ** 0.72;
    return 0.16 + 0.30 * shoulder + 0.07 * radialFraction;
  };
  const bladeSurfacePointScene = (radialFraction, chordFraction) => {
    const radius = THREE.MathUtils.lerp(
      rootRadiusSceneUnit,
      tipRadiusSceneUnit,
      radialFraction,
    );
    const helicalAngle = chordFraction
      * halfChordAngleAt(radialFraction);
    return new THREE.Vector3(
      helicalLeadCoefficientSceneUnit * helicalAngle,
      radius * Math.cos(helicalAngle),
      radius * Math.sin(helicalAngle),
    );
  };
  const pitchAngleAtRadius = (radiusMetre) => Math.atan(
    physicalScrewPitchMetrePerTurn / (FULL_TURN * radiusMetre),
  );
  const helicalAdvanceForRotation = (angleRadian) =>
    physicalScrewPitchMetrePerTurn * angleRadian / FULL_TURN;

  const positions = [];
  const indices = [];
  for (let radialIndex = 0; radialIndex <= radialSegments;
    radialIndex += 1) {
    const radialFraction = radialIndex / radialSegments;
    for (let chordIndex = 0; chordIndex <= chordSegments;
      chordIndex += 1) {
      const chordFraction = -1 + 2 * chordIndex / chordSegments;
      positions.push(...bladeSurfacePointScene(
        radialFraction,
        chordFraction,
      ).toArray());
    }
  }
  const rowLength = chordSegments + 1;
  for (let radialIndex = 0; radialIndex < radialSegments;
    radialIndex += 1) {
    for (let chordIndex = 0; chordIndex < chordSegments;
      chordIndex += 1) {
      const base = radialIndex * rowLength + chordIndex;
      indices.push(
        base,
        base + rowLength,
        base + rowLength + 1,
        base,
        base + rowLength + 1,
        base + 1,
      );
    }
  }
  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  bladeGeometry.setIndex(indices);
  bladeGeometry.computeVertexNormals();
  bladeGeometry.computeBoundingBox();
  bladeGeometry.computeBoundingSphere();
  bladeGeometry.userData = {
    chordSegments,
    helicalLeadCoefficientSceneUnit,
    radialSegments,
    rootRadiusSceneUnit,
    screwPitchSceneUnitPerTurn,
    tipRadiusSceneUnit,
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const rotorAngleRadian = angularVelocityX * time;
    return {
      advanceVelocityXMetrePerSecond,
      angularVelocityX,
      cycleTime,
      engineDriveTorqueXNewtonMetre,
      idealFixedNutAdvanceXMetre:
        helicalAdvanceForRotation(rotorAngleRadian),
      idealScrewAdvanceVelocityXMetrePerSecond,
      netShaftTorqueXNewtonMetre:
        engineDriveTorqueXNewtonMetre
        + resistingWaterTorqueXNewtonMetre,
      phase: cycleTime / cycleDuration,
      resistingWaterTorqueXNewtonMetre,
      rotorAngleRadian,
      shaftInputPowerWatt,
      thrustXNewton,
      usefulPropulsivePowerWatt,
      wakeAndSlipPowerWatt,
      wakeMarkerTravelTurns: time / cycleDuration,
    };
  };

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.38,
  });
  const bladeMaterial = matte(PALETTE.driver, {
    metalness: 0.26,
    opacity: 0.94,
    roughness: 0.40,
    side: THREE.DoubleSide,
    transparent: true,
  });
  bladeMaterial.depthWrite = false;
  const hubMaterial = matte(PALETTE.driven, {
    metalness: 0.34,
    roughness: 0.36,
  });
  const supportMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.55,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.19,
    roughness: 0.28,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const wakeMaterial = matte(PALETTE.fluid, {
    opacity: 0.49,
    roughness: 0.24,
    transparent: true,
  });
  wakeMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.96,
    roughness: 0.16,
    transparent: true,
  });
  markerMaterial.depthWrite = false;
  const thrustMaterial = matte(PALETTE.accent, {
    metalness: 0.10,
    roughness: 0.45,
  });

  const rotor = addRole(new THREE.Group(),
    'single-rigid-two-blade-screw-propeller-rotor');
  rotor.position.set(0.30, 0.12, 0);
  root.add(rotor);
  const shaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 5.85, 28),
    darkMaterial,
  ), 'single-rotating-propeller-shaft');
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.x = -0.16;
  rotor.add(shaft);
  const hub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 1.08, 40),
    hubMaterial,
  ), 'single-hub-fixing-two-helicoid-blades-to-shaft');
  hub.rotation.z = -Math.PI / 2;
  rotor.add(hub);
  const nose = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 36, 20),
    hubMaterial,
  ), 'rounded-positive-x-propeller-hub-nose');
  nose.scale.x = 0.92;
  nose.position.x = 0.48;
  rotor.add(nose);

  const bladeAssemblies = [];
  for (let index = 0; index < bladeCount; index += 1) {
    const assembly = addRole(new THREE.Group(),
      `rigid-helicoid-blade-assembly-${index + 1}`);
    assembly.rotation.x = index * Math.PI;
    const blade = addRole(new THREE.Mesh(
      bladeGeometry,
      bladeMaterial,
    ), `constant-lead-helicoid-blade-surface-${index + 1}`);
    assembly.add(blade);

    const perimeter = [];
    for (const chordFraction of [-1, 1]) {
      const points = Array.from(
        { length: radialSegments + 1 },
        (_, radialIndex) => bladeSurfacePointScene(
          radialIndex / radialSegments,
          chordFraction,
        ),
      );
      const curve = new THREE.CatmullRomCurve3(
        points,
        false,
        'centripetal',
      );
      const edge = addRole(new THREE.Mesh(
        new THREE.TubeGeometry(curve, radialSegments, 0.027, 8, false),
        darkMaterial,
      ), `${chordFraction < 0 ? 'leading' : 'trailing'}-helical-edge-blade-${index + 1}`);
      assembly.add(edge);
      perimeter.push(edge);
    }
    for (const radialFraction of [0, 1]) {
      const points = Array.from(
        { length: chordSegments + 1 },
        (_, chordIndex) => bladeSurfacePointScene(
          radialFraction,
          -1 + 2 * chordIndex / chordSegments,
        ),
      );
      const curve = new THREE.CatmullRomCurve3(
        points,
        false,
        'centripetal',
      );
      const edge = addRole(new THREE.Mesh(
        new THREE.TubeGeometry(curve, chordSegments * 2, 0.027, 8, false),
        darkMaterial,
      ), `${radialFraction === 0 ? 'root' : 'tip'}-helical-edge-blade-${index + 1}`);
      assembly.add(edge);
      perimeter.push(edge);
    }
    rotor.add(assembly);
    bladeAssemblies.push({ assembly, blade, perimeter });
  }
  const bladeIndexMarker = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.080, 18, 12),
    markerMaterial,
  ), 'white-index-fixed-to-first-helicoid-blade');
  bladeIndexMarker.position.copy(bladeSurfacePointScene(0.78, 0.66));
  bladeAssemblies[0].assembly.add(bladeIndexMarker);
  const shaftIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.07, 0.055),
    markerMaterial,
  ), 'white-rotation-index-fixed-to-shaft');
  shaftIndex.position.set(-1.68, 0.19, 0);
  rotor.add(shaftIndex);

  const bearingX = [-2.05, 2.10];
  const bearings = [];
  const pedestals = [];
  for (let index = 0; index < bearingX.length; index += 1) {
    const x = bearingX[index];
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.075, 12, 40),
      darkMaterial,
    ), `fixed-propeller-shaft-bearing-${index + 1}`);
    bearing.rotation.y = Math.PI / 2;
    bearing.position.set(x + rotor.position.x, rotor.position.y, 0);
    root.add(bearing);
    bearings.push(bearing);
    const pedestal = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 1.28, 0.62),
      supportMaterial,
    ), `fixed-bearing-pedestal-${index + 1}`);
    pedestal.position.set(x + rotor.position.x, -0.70, 0);
    root.add(pedestal);
    pedestals.push(pedestal);
  }
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(5.45, 0.18, 1.35),
    supportMaterial,
  ), 'fixed-propeller-demonstration-base');
  base.position.set(0.20, -1.43, 0);
  root.add(base);

  const waterVolume = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.7, 5.55, 5.55),
    waterMaterial,
  ), 'fixed-water-volume-around-screw-propeller');
  waterVolume.position.set(-0.50, 0.03, 0);
  root.add(waterVolume);

  const wakeCurves = [];
  const wakeMarkerSets = [];
  const wakePathSpecifications = [
    [0.58, 0],
    [0.92, Math.PI / 2],
    [1.28, Math.PI],
    [1.62, 3 * Math.PI / 2],
  ];
  const wakeMarkersPerPath = 4;
  for (let pathIndex = 0; pathIndex < wakePathSpecifications.length;
    pathIndex += 1) {
    const [radius, initialAngle] = wakePathSpecifications[pathIndex];
    const points = Array.from({ length: 61 }, (_, pointIndex) => {
      const progress = pointIndex / 60;
      const x = THREE.MathUtils.lerp(3.65, -4.25, progress);
      const downstreamFraction = smoothstep01((progress - 0.46) / 0.54);
      const angle = initialAngle + downstreamFraction * FULL_TURN * 1.15;
      const contractedRadius = radius * (1 - 0.13 * downstreamFraction);
      return new THREE.Vector3(
        x,
        0.12 + contractedRadius * Math.cos(angle),
        contractedRadius * Math.sin(angle),
      );
    });
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    wakeCurves.push(curve);
    const path = addRole(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 100, 0.016, 7, false),
      wakeMaterial,
    ), `fixed-axial-helical-wake-path-${pathIndex + 1}`);
    path.castShadow = false;
    root.add(path);
    const markers = Array.from(
      { length: wakeMarkersPerPath },
      (_, markerIndex) => {
        const marker = addRole(new THREE.Mesh(
          new THREE.SphereGeometry(0.066, 16, 11),
          markerMaterial,
        ), `negative-x-wake-marker-${pathIndex + 1}-${markerIndex + 1}`);
        root.add(marker);
        return marker;
      },
    );
    wakeMarkerSets.push(markers);
  }
  const wakeMarkerProgress = (turns, pathIndex, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / wakeMarkersPerPath
        + pathIndex / (wakePathSpecifications.length * wakeMarkersPerPath),
      1,
    );

  const forwardThrustArrow = axialArrow({
    direction: 1,
    length: 1.34,
    material: thrustMaterial,
    position: new THREE.Vector3(2.95, 2.62, 1.78),
    role: 'fixed-positive-x-vessel-thrust-arrow',
  });
  const backwardWakeArrow = axialArrow({
    direction: -1,
    length: 1.26,
    material: wakeMaterial,
    position: new THREE.Vector3(-3.25, -2.22, 1.72),
    role: 'fixed-negative-x-accelerated-water-arrow',
  });
  root.add(forwardThrustArrow, backwardWakeArrow);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.x = state.rotorAngleRadian;
    for (let pathIndex = 0; pathIndex < wakeMarkerSets.length;
      pathIndex += 1) {
      for (let markerIndex = 0;
        markerIndex < wakeMarkerSets[pathIndex].length;
        markerIndex += 1) {
        const progress = wakeMarkerProgress(
          state.wakeMarkerTravelTurns,
          pathIndex,
          markerIndex,
        );
        const marker = wakeMarkerSets[pathIndex][markerIndex];
        marker.position.copy(wakeCurves[pathIndex].getPointAt(progress));
        marker.scale.setScalar(Math.sin(Math.PI * progress) ** 0.52);
      }
    }
  };

  const geometry = {
    advanceCoefficient,
    advanceVelocityXMetrePerSecond,
    angularVelocityX,
    axialSlipFraction,
    bladeCount,
    chordSegments,
    cycleDuration,
    engineDriveTorqueXNewtonMetre,
    helicalLeadCoefficientSceneUnit,
    idealScrewAdvanceVelocityXMetrePerSecond,
    openWaterEfficiency,
    physicalDiameterMetre,
    physicalRadiusMetre,
    physicalScrewPitchMetrePerTurn,
    radialSegments,
    resistingWaterTorqueXNewtonMetre,
    rootRadiusSceneUnit,
    screwPitchSceneUnitPerTurn,
    shaftInputPowerWatt,
    shaftSpeedRevolutionPerMinute,
    shaftSpeedRevolutionPerSecond,
    thrustCoefficient,
    thrustXNewton,
    tipRadiusSceneUnit,
    torqueCoefficient,
    usefulPropulsivePowerWatt,
    wakeAndSlipPowerWatt,
    waterDensityKilogramPerCubicMetre,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'two-blade-constant-lead-helicoid-screw-propeller-producing-axial-thrust',
    bladeSurfacePointScene,
    blocks: {
      backwardWakeArrow,
      base,
      bearings,
      bladeAssemblies,
      bladeIndexMarker,
      forwardThrustArrow,
      hub,
      nose,
      pedestals,
      rotor,
      shaft,
      shaftIndex,
      waterVolume,
      wakeMarkerSets,
    },
    degreesOfFreedom: {
      independentOperatingCoordinates: 1,
      rigidShaftAndBladeRotation: 1,
    },
    dynamics: {
      coefficientDisclosure:
        'Brown supplies no scale or performance data. Diameter, pitch, 90 rpm, J=0.75, K_T=0.18, and K_Q=0.03 are a disclosed representative operating point, not measurements of the engraved propeller.',
      ittcOpenWaterModel:
        'The reduced-order balance uses the ITTC open-water definitions J=V_A/(nD), K_T=T/(rho*n^2*D^4), K_Q=Q/(rho*n^2*D^5), and eta_0=J*K_T/(2*pi*K_Q).',
      markerContinuity:
        'White water packets advance from a continuous time integral and use getPointAt arc-length sampling on uninterrupted axial-to-helical wake curves, with smooth endpoint fades.',
      reactionPair:
        'Positive-X shaft rotation of the displayed right-hand helicoid corresponds to positive-X ideal screw advance. The propeller accelerates water aft toward negative X and receives positive-X vessel thrust.',
    },
    fidelity: 'authored',
    flow: {
      acceleratedWaterDirection: new THREE.Vector3(-1, 0, 0),
      vesselThrustDirection: new THREE.Vector3(1, 0, 0),
      wakeCurves,
      wakeMarkerProgress,
    },
    geometry,
    halfChordAngleAt,
    helicalAdvanceForRotation,
    mechanism:
      'Two opposite broad blades and one shaft rotate as a single rigid body about the X axis. Every point of either blade lies on the same constant-lead helicoid x=(pitch/2pi)*phi, so a full turn advances the corresponding ideal screw by exactly one pitch and the local blade angle decreases with radius as atan(pitch/(2pi*r)). In water, finite slip replaces the literal nut constraint: shaft torque produces positive-X thrust while the accelerated wake travels negative X.',
    motion: {
      acceleratedWaterDirection: new THREE.Vector3(-1, 0, 0),
      rotationAxis: new THREE.Vector3(1, 0, 0),
      rotationSenseViewedFromPositiveX: 'counterclockwise',
      shaftAngularVelocityVector:
        new THREE.Vector3(angularVelocityX, 0, 0),
      vesselThrustDirection: new THREE.Vector3(1, 0, 0),
    },
    pitchAngleAtRadius,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 488 page supplies Brown’s engraving and caption but no canvas model or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate488: {
        approximateBladeTipPixels: [210, 29, 250, 489],
        approximateHubCenterPixels: [252, 263],
        approximateShaftExtentPixels: [96, 418],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device is a screw propeller',
          'its blades are sections of a screw-thread',
          'rotation in water acts analogously to a screw working in a nut',
          'the resulting vessel motion is parallel to the shaft axis',
        ],
        engravingEvidence:
          'Brown’s oblique view shows two opposite broad swept blades merging into one cylindrical hub on one continuous transverse shaft; the changing face angle is visible from root to tip.',
        ittcCorroboration:
          'The ITTC open-water procedure defines advance coefficient, thrust coefficient, torque coefficient, and open-water efficiency using propeller advance speed, rate, diameter, thrust, torque, and water density.',
        reconstructionDisclosure:
          'The two-blade topology, common hub and shaft, screw-thread interpretation, axial result, and root-to-tip twist are source-grounded. Exact planform, constant pitch, handedness, direction, supports, physical scale, speed, open-water coefficients, water volume, wake contraction and swirl, colors, and timing are independently engineered and exposed.',
      },
      ittcOpenWaterProcedureUrl:
        'https://ittc.info/media/1838/75-02-03-021.pdf',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 488',
    },
    stateAtTime,
    transmission: {
      bladeSurfaceEquation:
        'x=(P/2pi)*phi; y=r*cos(phi); z=r*sin(phi), on each finite blade patch',
      fixedNutAnalogy:
        'advance_x=P*theta/(2pi), hence one positive turn corresponds to one positive-X pitch',
      localPitchAngleEquation:
        'beta(r)=atan(P/(2*pi*r))',
      openWaterEquations:
        'J=V_A/(nD); T=K_T*rho*n^2*D^4; Q=K_Q*rho*n^2*D^5; eta_0=J*K_T/(2*pi*K_Q)',
      shaftBalance:
        'tau_engine,x+tau_water,x=0 at prescribed uniform omega_x; P_shaft=2*pi*n*Q',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.88, -2.92, -2.92),
    new THREE.Vector3(4.02, 2.96, 2.92),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(9.6, 5.2, 10.8);
  root.userData.groundFloorY = -2.92;
  markShadows(root);
  waterVolume.castShadow = false;
  bladeAssemblies.forEach(({ blade }) => {
    blade.castShadow = false;
  });
  wakeMarkerSets.flat().forEach((marker) => {
    marker.castShadow = false;
  });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredScrewPropellerMovement(movement) {
  if (movement.id !== 488) return null;
  return screwPropeller(movement);
}
