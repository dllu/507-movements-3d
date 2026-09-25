import * as THREE from 'three';
import {correctMarineRotor} from './marine-rotor-working-parts.js';
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

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
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

function horizontalArrow({ direction, length, material, position, role }) {
  const group = addRole(new THREE.Group(), role);
  group.position.copy(position);
  const sign = Math.sign(direction) || 1;
  const shaftLength = length * 0.72;
  const shaft = cylinderBetween(
    new THREE.Vector3(-sign * length * 0.43, 0, 0),
    new THREE.Vector3(sign * (shaftLength - length * 0.43), 0, 0),
    0.038,
    material,
    `${role}-shaft`,
    12,
  );
  const head = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.13, length * 0.28, 18),
    material,
  ), `${role}-head`);
  head.rotation.z = -sign * Math.PI / 2;
  head.position.x = sign * length * 0.43;
  group.add(shaft, head);
  return group;
}

function commonPaddleWheel(movement) {
  const root = new THREE.Group();
  const paddleCount = 8;
  const officialCyclesPerMinute = 15;
  const cycleDuration = 60 / officialCyclesPerMinute;
  const angularVelocityZ = -FULL_TURN / cycleDuration;

  // Brown's official vector reconstruction uses radii 2.5, 9, 10, and 13.
  // Scaling all of them by one factor preserves those visible proportions.
  const sceneScale = 3.35 / 13;
  const hubRadiusSceneUnit = 2.5 * sceneScale;
  const rimInnerRadiusSceneUnit = 9 * sceneScale;
  const rimOuterRadiusSceneUnit = 10 * sceneScale;
  const rimPitchRadiusSceneUnit = 9.5 * sceneScale;
  const paddleInnerRadiusSceneUnit = 10 * sceneScale;
  const paddleOuterRadiusSceneUnit = 13 * sceneScale;
  const paddleRadialLengthSceneUnit = 3 * sceneScale;
  const paddleTangentialThicknessSceneUnit = sceneScale;
  const paddleAxialWidthSceneUnit = 1.72;
  const wheelFaceOffsetSceneUnit = 0.61;
  const waterlineYSceneUnit = -0.66;

  // A disclosed representative scale is used only for the reduced-order
  // hydrodynamic explanation; Brown gives no dimensions or operating point.
  const physicalPaddleInnerRadiusMetre = 2.40;
  const physicalPaddleOuterRadiusMetre = 3.12;
  const physicalPaddleWidthMetre = 1.80;
  const physicalWaterlineYMetre = -0.64;
  const vesselSpeedXMetrePerSecond = 2.50;
  const ambientWaterVelocityXMetrePerSecond = -vesselSpeedXMetrePerSecond;
  const waterDensityKilogramPerCubicMetre = 1000;
  const normalDragCoefficient = 1.15;

  const paddleImmersionAtAngle = (angleRadian) => {
    const sine = Math.sin(angleRadian);
    if (sine >= 0) {
      return {
        immersedAreaSquareMetre: 0,
        immersedFraction: 0,
        immersedRadialCentroidMetre: physicalPaddleOuterRadiusMetre,
        submergedInnerRadiusMetre: physicalPaddleOuterRadiusMetre,
      };
    }
    const waterlineCrossingRadius = physicalWaterlineYMetre / sine;
    const submergedInnerRadiusMetre = THREE.MathUtils.clamp(
      waterlineCrossingRadius,
      physicalPaddleInnerRadiusMetre,
      physicalPaddleOuterRadiusMetre,
    );
    const immersedRadialLengthMetre = Math.max(
      0,
      physicalPaddleOuterRadiusMetre - submergedInnerRadiusMetre,
    );
    const immersedFraction = immersedRadialLengthMetre
      / (physicalPaddleOuterRadiusMetre - physicalPaddleInnerRadiusMetre);
    return {
      immersedAreaSquareMetre:
        immersedRadialLengthMetre * physicalPaddleWidthMetre,
      immersedFraction,
      immersedRadialCentroidMetre:
        (submergedInnerRadiusMetre + physicalPaddleOuterRadiusMetre) / 2,
      submergedInnerRadiusMetre,
    };
  };

  const paddleHydrodynamicsAtAngle = (angleRadian) => {
    const immersion = paddleImmersionAtAngle(angleRadian);
    const radius = immersion.immersedRadialCentroidMetre;
    const position = new THREE.Vector2(
      radius * Math.cos(angleRadian),
      radius * Math.sin(angleRadian),
    );
    const outwardTangent = new THREE.Vector2(
      -Math.sin(angleRadian),
      Math.cos(angleRadian),
    );
    const paddleVelocity = new THREE.Vector2(
      -angularVelocityZ * position.y,
      angularVelocityZ * position.x,
    );
    const relativeVelocity = paddleVelocity.clone().sub(
      new THREE.Vector2(ambientWaterVelocityXMetrePerSecond, 0),
    );
    const normalRelativeSpeed = relativeVelocity.dot(outwardTangent);
    const forceScale = -0.5
      * waterDensityKilogramPerCubicMetre
      * normalDragCoefficient
      * immersion.immersedAreaSquareMetre
      * Math.abs(normalRelativeSpeed)
      * normalRelativeSpeed;
    const waterForceOnPaddle = outwardTangent.clone().multiplyScalar(
      forceScale,
    );
    const hydrodynamicLoadTorqueZNewtonMetre =
      position.x * waterForceOnPaddle.y
      - position.y * waterForceOnPaddle.x;
    return {
      ...immersion,
      angleRadian,
      hydrodynamicLoadTorqueZNewtonMetre,
      normalRelativeSpeedMetrePerSecond: normalRelativeSpeed,
      paddleVelocityMetrePerSecond: paddleVelocity,
      positionMetre: position,
      relativeVelocityMetrePerSecond: relativeVelocity,
      waterForceOnPaddleNewton: waterForceOnPaddle,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const rotorAngleRadian = angularVelocityZ * time;
    const paddleStates = Array.from({ length: paddleCount }, (_, index) => {
      const angleRadian = rotorAngleRadian + index * FULL_TURN / paddleCount;
      return {
        index,
        ...paddleHydrodynamicsAtAngle(angleRadian),
      };
    });
    const thrustXNewton = paddleStates.reduce(
      (sum, state) => sum + state.waterForceOnPaddleNewton.x,
      0,
    );
    const hydrodynamicLoadTorqueZNewtonMetre = paddleStates.reduce(
      (sum, state) => sum + state.hydrodynamicLoadTorqueZNewtonMetre,
      0,
    );
    const engineDriveTorqueZNewtonMetre =
      -hydrodynamicLoadTorqueZNewtonMetre;
    const shaftInputPowerWatt =
      engineDriveTorqueZNewtonMetre * angularVelocityZ;
    const usefulPropulsivePowerWatt = thrustXNewton
      * vesselSpeedXMetrePerSecond;
    const wakeAndSlipPowerWatt = shaftInputPowerWatt
      - usefulPropulsivePowerWatt;
    return {
      angularVelocityZ,
      cycleTime,
      engineDriveTorqueZNewtonMetre,
      hydrodynamicLoadTorqueZNewtonMetre,
      netShaftTorqueZNewtonMetre:
        engineDriveTorqueZNewtonMetre
        + hydrodynamicLoadTorqueZNewtonMetre,
      paddleStates,
      phase: cycleTime / cycleDuration,
      rotorAngleRadian,
      shaftInputPowerWatt,
      thrustXNewton,
      usefulPropulsivePowerWatt,
      wakeAndSlipPowerWatt,
      wakeMarkerTravelTurns: time / cycleDuration,
    };
  };

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.42,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const paddleMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.58,
  });
  const supportMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.27,
    roughness: 0.28,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const flowMaterial = matte(PALETTE.fluid, {
    opacity: 0.53,
    roughness: 0.22,
    transparent: true,
  });
  flowMaterial.depthWrite = false;
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.95,
    roughness: 0.18,
    transparent: true,
  });
  markerMaterial.depthWrite = false;
  const thrustMaterial = matte(PALETTE.accent, {
    metalness: 0.08,
    roughness: 0.46,
  });

  const rotor = addRole(new THREE.Group(),
    'single-rigid-eight-paddle-wheel-rotor');
  rotor.position.y = 0.22;
  root.add(rotor);

  const shaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 4.00, 28),
    darkMaterial,
  ), 'single-transverse-paddle-wheel-shaft');
  shaft.rotation.x = Math.PI / 2;
  rotor.add(shaft);

  const hub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      hubRadiusSceneUnit,
      hubRadiusSceneUnit,
      1.58,
      42,
    ),
    wheelMaterial,
  ), 'single-hub-locking-wheel-to-transverse-shaft');
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);

  const rims = [-wheelFaceOffsetSceneUnit, wheelFaceOffsetSceneUnit].map(
    (z, faceIndex) => {
      const rim = addRole(new THREE.Mesh(
        new THREE.TorusGeometry(
          rimPitchRadiusSceneUnit,
          (rimOuterRadiusSceneUnit - rimInnerRadiusSceneUnit) / 2,
          12,
          72,
        ),
        wheelMaterial,
      ), `rigid-wheel-rim-face-${faceIndex + 1}`);
      rim.position.z = z;
      rotor.add(rim);
      return rim;
    },
  );

  const spokeAssemblies = [];
  const paddles = [];
  for (let index = 0; index < paddleCount; index += 1) {
    const assembly = addRole(new THREE.Group(),
      `rigid-radial-paddle-assembly-${index + 1}`);
    assembly.rotation.z = index * FULL_TURN / paddleCount;
    const spokeLength = rimInnerRadiusSceneUnit - hubRadiusSceneUnit;
    const spokes = [-wheelFaceOffsetSceneUnit, wheelFaceOffsetSceneUnit].map(
      (z, faceIndex) => {
        const spoke = addRole(new THREE.Mesh(
          new THREE.BoxGeometry(spokeLength, 0.105, 0.105),
          wheelMaterial,
        ), `radial-spoke-${index + 1}-face-${faceIndex + 1}`);
        spoke.position.set(
          hubRadiusSceneUnit + spokeLength / 2,
          0,
          z,
        );
        assembly.add(spoke);
        return spoke;
      },
    );
    const paddle = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        paddleRadialLengthSceneUnit,
        paddleTangentialThicknessSceneUnit,
        paddleAxialWidthSceneUnit,
      ),
      paddleMaterial,
    ), `fixed-radial-paddle-bucket-${index + 1}`);
    paddle.position.x = (
      paddleInnerRadiusSceneUnit + paddleOuterRadiusSceneUnit
    ) / 2;
    assembly.add(paddle);
    const paddleEdge = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        paddleRadialLengthSceneUnit + 0.045,
        0.045,
        paddleAxialWidthSceneUnit + 0.07,
      ),
      darkMaterial,
    ), `outer-stiffening-edge-of-paddle-${index + 1}`);
    paddleEdge.position.copy(paddle.position);
    paddleEdge.position.y = paddleTangentialThicknessSceneUnit / 2 + 0.025;
    assembly.add(paddleEdge);
    // Brown draws each paddle as one plain board; the dark edge was ink.
    paddleEdge.visible = false;
    paddleEdge.userData.retiredInkOutline = true;
    rotor.add(assembly);
    spokeAssemblies.push({ assembly, paddle, paddleEdge, spokes });
    paddles.push(paddle);
  }

  const shaftIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.09, 0.045),
    markerMaterial,
  ), 'white-shaft-rotation-index');
  shaftIndex.position.set(0.38, 0, wheelFaceOffsetSceneUnit + 0.15);
  rotor.add(shaftIndex);
  const paddleIndex = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    markerMaterial,
  ), 'white-index-fixed-to-first-paddle');
  paddleIndex.position.set(paddleOuterRadiusSceneUnit - 0.18, 0, 0.90);
  spokeAssemblies[0].assembly.add(paddleIndex);

  const bearingCenters = [-1.32, 1.32];
  const bearings = [];
  const supportLegs = [];
  for (let index = 0; index < bearingCenters.length; index += 1) {
    const z = bearingCenters[index];
    const bearing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.075, 12, 40),
      darkMaterial,
    ), `fixed-transverse-shaft-bearing-${index + 1}`);
    bearing.position.set(0, rotor.position.y, z);
    root.add(bearing);
    bearings.push(bearing);
    for (const side of [-1, 1]) {
      const leg = cylinderBetween(
        new THREE.Vector3(side * 1.18, -2.92, z),
        new THREE.Vector3(0, -0.06, z),
        0.075,
        supportMaterial,
        `fixed-bearing-A-frame-${index + 1}-leg-${side < 0 ? 'left' : 'right'}`,
        16,
      );
      root.add(leg);
      supportLegs.push(leg);
    }
  }
  const baseRails = bearingCenters.map((z, index) => {
    const rail = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(3.10, 0.13, 0.18),
      supportMaterial,
    ), `fixed-bearing-base-rail-${index + 1}`);
    rail.position.set(0, -2.96, z);
    root.add(rail);
    return rail;
  });

  const waterVolume = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 2.42, 4.4),
    waterMaterial,
  ), 'fixed-water-volume-intersecting-lower-paddles');
  waterVolume.position.set(0, waterlineYSceneUnit - 1.21, 0);
  root.add(waterVolume);
  const waterSurface = addRole(new THREE.Mesh(
    new THREE.PlaneGeometry(9.0, 4.4, 1, 1),
    waterMaterial,
  ), 'fixed-waterline-plane');
  waterSurface.rotation.x = -Math.PI / 2;
  waterSurface.position.y = waterlineYSceneUnit;
  root.add(waterSurface);

  const wakeCurves = [];
  const wakeMarkerSets = [];
  const wakeOffsets = [
    [-1.02, -1.32],
    [-0.48, -1.92],
    [0.00, -2.38],
    [0.48, -1.92],
    [1.02, -1.32],
  ];
  const wakeMarkersPerPath = 4;
  for (let pathIndex = 0; pathIndex < wakeOffsets.length;
    pathIndex += 1) {
    const [z, y] = wakeOffsets[pathIndex];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(4.05, y, z),
      new THREE.Vector3(2.35, y + 0.05, z),
      new THREE.Vector3(0.15, y - 0.04, z),
      new THREE.Vector3(-2.30, y + 0.06, z),
      new THREE.Vector3(-4.05, y, z),
    ], false, 'centripetal');
    wakeCurves.push(curve);
    const line = addRole(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.018, 7, false),
      flowMaterial,
    ), `fixed-backward-water-path-${pathIndex + 1}`);
    line.castShadow = false;
    root.add(line);
    const markers = Array.from(
      { length: wakeMarkersPerPath },
      (_, markerIndex) => {
        const marker = addRole(new THREE.Mesh(
          new THREE.SphereGeometry(0.070, 16, 11),
          markerMaterial,
        ), `backward-water-marker-${pathIndex + 1}-${markerIndex + 1}`);
        root.add(marker);
        return marker;
      },
    );
    wakeMarkerSets.push(markers);
  }
  const wakeMarkerProgress = (turns, pathIndex, markerIndex) =>
    THREE.MathUtils.euclideanModulo(
      turns + markerIndex / wakeMarkersPerPath
        + pathIndex / (wakeOffsets.length * wakeMarkersPerPath),
      1,
    );

  const backwardWaterArrow = horizontalArrow({
    direction: -1,
    length: 1.22,
    material: flowMaterial,
    position: new THREE.Vector3(-3.20, -0.98, 1.48),
    role: 'fixed-negative-x-backward-water-direction-arrow',
  });
  const forwardVesselArrow = horizontalArrow({
    direction: 1,
    length: 1.38,
    material: thrustMaterial,
    position: new THREE.Vector3(2.86, 3.12, 0.92),
    role: 'fixed-positive-x-forward-vessel-thrust-arrow',
  });
  root.add(backwardWaterArrow, forwardVesselArrow);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngleRadian;
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
    angularVelocityZ,
    cycleDuration,
    hubRadiusSceneUnit,
    normalDragCoefficient,
    officialCyclesPerMinute,
    paddleAxialWidthSceneUnit,
    paddleCount,
    paddleInnerRadiusSceneUnit,
    paddleOuterRadiusSceneUnit,
    paddleRadialLengthSceneUnit,
    paddleTangentialThicknessSceneUnit,
    physicalPaddleInnerRadiusMetre,
    physicalPaddleOuterRadiusMetre,
    physicalPaddleWidthMetre,
    physicalWaterlineYMetre,
    rimInnerRadiusSceneUnit,
    rimOuterRadiusSceneUnit,
    rimPitchRadiusSceneUnit,
    sceneScale,
    vesselSpeedXMetrePerSecond,
    waterDensityKilogramPerCubicMetre,
    waterlineYSceneUnit,
    wheelFaceOffsetSceneUnit,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'eight-fixed-radial-paddles-on-one-rigid-transverse-vessel-wheel',
    blocks: {
      backwardWaterArrow,
      baseRails,
      bearings,
      forwardVesselArrow,
      hub,
      paddleIndex,
      paddles,
      rims,
      rotor,
      shaft,
      shaftIndex,
      spokeAssemblies,
      supportLegs,
      waterSurface,
      waterVolume,
      wakeMarkerSets,
    },
    degreesOfFreedom: {
      independentOperatingCoordinates: 1,
      paddleHinges: 0,
      rigidWheelRotation: 1,
    },
    dynamics: {
      hydrodynamicAssumption:
        'Each submerged portion is represented by normal quadratic drag on a flat radial paddle. It is a disclosed reduced-order force model, not CFD; the shaft speed, dimensions, vessel speed, density, and drag coefficient are representative because Brown supplies none.',
      markerContinuity:
        'White wake packets use a continuous time integral and getPointAt arc-length sampling along uninterrupted positive-X to negative-X paths, with smooth endpoint fades.',
      powerBalance:
        'At prescribed uniform speed, tau_engine=-tau_water at every instant; P_input=tau_engine*omega, useful propulsive power=T_x*V_vessel, and the remainder is wake and slip power.',
      reactionPair:
        'Clockwise bottom-paddle motion is negative X. Each immersed face presses water backward in negative X; water exerts positive-X thrust on the paddle and an equal opposite force is imparted to the wake.',
    },
    fidelity: 'authored',
    flow: {
      backwardWaterDirection: new THREE.Vector3(-1, 0, 0),
      forwardVesselDirection: new THREE.Vector3(1, 0, 0),
      wakeCurves,
      wakeMarkerProgress,
    },
    geometry,
    mechanism:
      'Eight identical fixed radial paddle boards, eight paired spokes, two rims, the hub, and the transverse shaft form one rigid rotor. Clockwise rotation viewed from positive Z carries the lower paddles backward through the water. Their broad faces accelerate water toward negative X, and the equal reaction thrust propels the vessel toward positive X. Unlike the feathering wheel in movement 489, movement 487 has no paddle pivots, cranks, eccentric, or belts.',
    motion: {
      ambientWaterVelocityVectorMetrePerSecond:
        new THREE.Vector3(ambientWaterVelocityXMetrePerSecond, 0, 0),
      rotationAxis: new THREE.Vector3(0, 0, 1),
      rotationSenseViewedFromPositiveZ: 'clockwise',
      shaftAngularVelocityVector:
        new THREE.Vector3(0, 0, angularVelocityZ),
      vesselVelocityVectorMetrePerSecond:
        new THREE.Vector3(vesselSpeedXMetrePerSecond, 0, 0),
    },
    paddleHydrodynamicsAtAngle,
    paddleImmersionAtAngle,
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      officialCyclePeriodSecond: cycleDuration,
      officialCyclesPerMinute,
      officialRigidRotationMultiplier: 1,
      sourcePrescribedAbsoluteTiming: true,
    },
    sourceReference: {
      brownPlate487: {
        approximateHubCenterPixels: [264, 257],
        approximateOuterPaddleRadiusPixels: 200,
        approximateRimOuterRadiusPixels: 154,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 5,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device is a common paddle-wheel for propelling vessels',
          'wheel revolution makes the buckets press backward against water',
          'the reaction produces forward vessel movement',
        ],
        engravingEvidence:
          'Brown’s face elevation shows one circular wheel and central shaft, eight equally spaced radial arms, a continuous annular rim, and eight short rectangular paddle boards extending beyond that rim.',
        officialAnimationEvidence:
          'The official canvas model rotates the complete eight-paddle outline as one body at 15 cycles per minute. Its normalized vector radii are 2.5 for the hub, 9 and 10 for the annular rim, and 13 at each paddle tip.',
        reconstructionDisclosure:
          'The single rigid shaft, hub, annular wheel, eight paired radial spokes, eight fixed radial paddles, backward water action, and forward reaction are source-grounded. Axial breadth, supports, waterline, physical scale, hydrodynamic coefficients, flow paths, colors, and the selected clockwise propulsion direction are independently engineered and exposed; Brown does not prescribe a direction or dimensions.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 487',
    },
    stateAtTime,
    transmission: {
      hydrodynamicForceEquation:
        'F_water_on_paddle=-0.5*rho*C_D*A_sub*abs(v_n)*v_n*n_tangent',
      rigidConstraint:
        'theta_shaft=theta_hub=theta_rim_1=theta_rim_2=theta_spoke_i=theta_paddle_i; theta_paddle_i=theta_shaft+2*pi*i/8',
      thrustAndTorqueEquation:
        'T_x=sum(F_i,x); tau_water,z=sum(r_i,x*F_i,y-r_i,y*F_i,x); tau_engine,z=-tau_water,z',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.52, -3.46, -2.24),
    new THREE.Vector3(4.52, 3.89, 2.24),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(7.8, 4.7, 11.8);
  root.userData.groundFloorY = -3.46;
  correctMarineRotor(root,487);
  markShadows(root);
  waterVolume.castShadow = false;
  waterSurface.castShadow = false;
  wakeMarkerSets.flat().forEach((marker) => {
    marker.castShadow = false;
  });
  root.traverse(object => { if(object.material?.transparent) { object.castShadow=false; object.receiveShadow=false; } });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCommonPaddleWheelMovement(movement) {
  if (movement.id !== 487) return null;
  return commonPaddleWheel(movement);
}
