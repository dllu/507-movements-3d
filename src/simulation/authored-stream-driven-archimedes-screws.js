import * as THREE from 'three';
import { helicalThread, threadAngles } from './mujoco-screw/thread-geometry.js';
import { horizontalRing } from './horizontal-turbine-solids.js';
import { ring } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeHelicalRibbonGeometry({
  bottomCrossAngle,
  innerRadius,
  length,
  outerRadius,
  turns,
}) {
  const samples = turns * 56;
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const angle = bottomCrossAngle - FULL_TURN * turns * progress;
    const y = -length / 2 + length * progress;
    positions.push(
      innerRadius * Math.cos(angle),
      y,
      innerRadius * Math.sin(angle),
      outerRadius * Math.cos(angle),
      y,
      outerRadius * Math.sin(angle),
    );
    if (index < samples) {
      const first = index * 2;
      indices.push(
        first,
        first + 1,
        first + 2,
        first + 1,
        first + 3,
        first + 2,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function streamDrivenArchimedesScrew(movement) {
  const root = new THREE.Group();
  const shaftRevolutionDuration = 11;
  const inputAngularSpeed = FULL_TURN / shaftRevolutionDuration;
  const lowerEnd = new THREE.Vector3(1.72, -1.10, 0);
  const upperEnd = new THREE.Vector3(-1.72, 2.48, 0);
  const axisVector = upperEnd.clone().sub(lowerEnd);
  const screwLength = axisVector.length();
  const axisDirection = axisVector.clone().normalize();
  const assemblyCenter = lowerEnd.clone().add(upperEnd).multiplyScalar(0.5);
  const assemblyQuaternion = new THREE.Quaternion().setFromUnitVectors(
    Y_AXIS,
    axisDirection,
  );
  const assemblyQuaternionInverse = assemblyQuaternion.clone().invert();
  const casingRadius = 0.68;
  const centralShaftRadius = 0.14;
  const helixInnerRadius = 0.16;
  const helixOuterRadius = 0.60;
  const helixTurns = 5;
  const transportCycleDuration = shaftRevolutionDuration * helixTurns;
  const screwPitch = screwLength / helixTurns;
  const bottomCrossAngle = Math.PI;
  const waterPocketRadius = 0.38;
  const waterPocketCount = helixTurns;
  const waterPocketFadeFraction = 0.08;
  const wheelLocalY = -screwLength / 2 - 0.18;
  const waterWheelRadius = 1.34;
  const waterWheelPaddleCount = 8;
  const streamSurfaceY = -1.34;
  const streamVelocityZ = 1.34;
  const representativeStreamForce = 6.1;
  const streamDriveTorque = waterWheelRadius
    * representativeStreamForce;
  const dischargeTroughY = 1.82;
  const groundY = -3.05;

  const worldFromAssemblyLocal = (localPoint) => localPoint.clone()
    .applyQuaternion(assemblyQuaternion)
    .add(assemblyCenter);

  const localFromWorldDirection = (worldDirection) => worldDirection.clone()
    .applyQuaternion(assemblyQuaternionInverse);

  const projectedGravityLocal = localFromWorldDirection(
    new THREE.Vector3(0, -1, 0)
      .addScaledVector(axisDirection, axisDirection.y),
  ).normalize();
  const waterWheelCenter = worldFromAssemblyLocal(
    new THREE.Vector3(0, wheelLocalY, 0),
  );

  const waterPocketState = (
    markerIndex,
    inputRotation,
    shaftRevolutions,
  ) => {
    const axialCycles = THREE.MathUtils.euclideanModulo(
      shaftRevolutions + markerIndex,
      helixTurns,
    );
    const axialFraction = axialCycles / helixTurns;
    const localPosition = new THREE.Vector3(
      waterPocketRadius * Math.cos(bottomCrossAngle),
      -screwLength / 2 + screwLength * axialFraction,
      waterPocketRadius * Math.sin(bottomCrossAngle),
    );
    const bladeLocalAngle = bottomCrossAngle
      - FULL_TURN * helixTurns * axialFraction;
    const bladeWorldCrossAngle = bladeLocalAngle + inputRotation;
    const markerScale = smoothStep5(
      axialFraction / waterPocketFadeFraction,
    ) * smoothStep5(
      (1 - axialFraction) / waterPocketFadeFraction,
    );
    return {
      axialCycles,
      axialFraction,
      bladeLocalAngle,
      bladeWorldCrossAngle,
      localPosition,
      markerIndex,
      scale: markerScale,
      worldPosition: worldFromAssemblyLocal(localPosition),
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const transportAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN * helixTurns,
    );
    const inputRotation = THREE.MathUtils.euclideanModulo(
      transportAngle,
      FULL_TURN,
    );
    const shaftRevolutions = transportAngle / FULL_TURN;
    const waterPocketStates = Array.from(
      { length: waterPocketCount },
      (_, index) => waterPocketState(
        index,
        inputRotation,
        shaftRevolutions,
      ),
    );
    return {
      axialWaterAcceleration:
        screwPitch * inputAcceleration / FULL_TURN,
      axialWaterSpeed: screwPitch * inputSpeed / FULL_TURN,
      inputAcceleration,
      inputAngle,
      inputRotation,
      inputSpeed,
      phase: transportAngle / (FULL_TURN * helixTurns),
      rotorPhase: inputRotation / FULL_TURN,
      shaftRevolutions,
      screwAngle: inputRotation,
      screwAngularAcceleration: inputAcceleration,
      screwAngularSpeed: inputSpeed,
      streamDriveTorque,
      streamVelocityAtBottomDotWheelTangent:
        streamVelocityZ * inputSpeed * waterWheelRadius,
      waterPocketStates,
      waterWheelAngle: inputRotation,
      waterWheelAngularAcceleration: inputAcceleration,
      waterWheelAngularSpeed: inputSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(
      time,
      transportCycleDuration,
    );
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.43,
  });
  const screwMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.47,
    side: THREE.DoubleSide,
  });
  const wheelMaterial = matte(PALETTE.accent, {
    metalness: 0.16,
    roughness: 0.47,
  });
  const casingMaterial = matte(PALETTE.driven, {
    opacity: 0.23,
    roughness: 0.31,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.63,
    roughness: 0.25,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x8adbe7, {
    opacity: 0.70,
    roughness: 0.22,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const screwAssembly = new THREE.Group();
  screwAssembly.position.copy(assemblyCenter);
  screwAssembly.quaternion.copy(assemblyQuaternion);
  screwAssembly.userData.role =
    'fixed-oblique-axis-frame-for-stream-driven-screw';
  root.add(screwAssembly);
  const rotor = new THREE.Group();
  rotor.userData.role =
    'one-rigid-rotor-containing-wheel-shaft-and-helical-flight';
  screwAssembly.add(rotor);

  const centralShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(
      centralShaftRadius,
      centralShaftRadius,
      screwLength + 0.72,
      28,
    ),
    darkMaterial,
  );
  centralShaft.userData.role = 'continuous-oblique-wheel-and-screw-shaft';
  rotor.add(centralShaft);
  const helicalFlight = new THREE.Mesh(
    makeHelicalRibbonGeometry({
      bottomCrossAngle,
      innerRadius: helixInnerRadius,
      length: screwLength,
      outerRadius: helixOuterRadius,
      turns: helixTurns,
    }),
    screwMaterial,
  );
  const flightProfile = { inner: centralShaftRadius, outer: casingRadius-.04, low: -screwLength/2, high: screwLength/2, width: .035, lead: screwPitch/FULL_TURN, phase: -screwLength/2 + screwPitch/2 };
  helicalFlight.geometry.dispose();
  helicalFlight.geometry = helicalThread(flightProfile, threadAngles(flightProfile, 128)).rotateX(-Math.PI/2);
  helicalFlight.userData.role =
    'five-turn-helical-water-lifting-passage';
  rotor.add(helicalFlight);
  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(
      casingRadius,
      casingRadius,
      screwLength,
      48,
      1,
      true,
    ),
    casingMaterial,
  );
  casing.geometry.dispose();
  casing.geometry = horizontalRing(casingRadius-.04,casingRadius,-screwLength/2,screwLength/2);
  casing.userData.role = 'transparent-rotating-oblique-screw-casing';
  rotor.add(casing);
  const casingIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, screwLength * 0.92, 0.075),
    whiteMaterial,
  );
  casingIndex.position.x = casingRadius + 0.03;
  casingIndex.userData.role = 'visible-one-to-one-screw-rotation-index';
  rotor.add(casingIndex);
  const casingEndRings = [-1, 1].map((sign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(casingRadius, 0.055, 9, 48),
      darkMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sign * screwLength / 2;
    ring.userData.role =
      `${sign < 0 ? 'lower' : 'upper'}-screw-casing-ring`;
    rotor.add(ring);
    return ring;
  });

  const waterWheel = new THREE.Group();
  waterWheel.position.y = wheelLocalY;
  waterWheel.userData.role =
    'lower-stream-wheel-rigidly-fixed-to-screw-shaft';
  rotor.add(waterWheel);
  const wheelRims = [-0.18, 0.18].map((offset) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(waterWheelRadius, 0.075, 9, 64),
      darkMaterial,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = offset;
    rim.userData.role = 'lower-water-wheel-rim';
    waterWheel.add(rim);
    return rim;
  });
  const paddles = [];
  for (let index = 0; index < waterWheelPaddleCount; index += 1) {
    const angle = index * FULL_TURN / waterWheelPaddleCount;
    const paddleCarrier = new THREE.Group();
    paddleCarrier.rotation.y = angle;
    waterWheel.add(paddleCarrier);
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(waterWheelRadius * 1.65, 0.09, 0.09),
      darkMaterial,
    );
    spoke.position.x = waterWheelRadius * 0.42;
    paddleCarrier.add(spoke);
    const paddle = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.34, 0.68),
      wheelMaterial,
    );
    paddle.position.x = waterWheelRadius;
    paddle.userData.role = `stream-driven-lower-paddle-${index + 1}`;
    paddleCarrier.add(paddle);
    paddles.push(paddle);
  }

  const waterPockets = [];
  for (let index = 0; index < waterPocketCount; index += 1) {
    const pocket = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 18, 12),
      paleWaterMaterial,
    );
    pocket.userData.role =
      `gravity-low-water-pocket-advancing-one-pitch-per-revolution-${index + 1}`;
    screwAssembly.add(pocket);
    waterPockets.push(pocket);
  }

  const bearingLocalPositions = [
    new THREE.Vector3(0, -screwLength * 0.34, 0),
    new THREE.Vector3(0, screwLength * 0.34, 0),
  ];
  const bearings = bearingLocalPositions.map((localPosition, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(casingRadius + 0.11, 0.09, 10, 48),
      frameMaterial,
    );
    bearing.geometry.dispose();
    bearing.geometry = ring(casingRadius+.073,casingRadius+.20,-.09,.09);
    bearing.quaternion.setFromUnitVectors(Z_AXIS, axisDirection);
    bearing.position.copy(worldFromAssemblyLocal(localPosition));
    bearing.userData.role =
      `fixed-oblique-screw-bearing-${index + 1}`;
    root.add(bearing);
    return bearing;
  });
  const bearingSupports = bearings.map((bearing, index) => {
    const height = bearing.position.y - groundY;
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, height, 0.28),
      frameMaterial,
    );
    support.position.set(
      bearing.position.x,
      groundY + height / 2,
      index === 0 ? -1.82 : 1.82,
    );
    support.userData.role = `fixed-oblique-bearing-support-${index + 1}`;
    root.add(support);
    return support;
  });

  const bearingBridges = bearings.map((bearing, index) => {
    const sign = index === 0 ? -1 : 1;
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.98,24),frameMaterial);
    bridge.rotation.x = Math.PI/2;
    bridge.position.set(bearing.position.x,bearing.position.y,sign*1.33);
    bridge.userData.role = `finite-bearing-to-post-bridge-${index + 1}`;
    root.add(bridge);
    return bridge;
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.20, 0.24, 5.20),
    frameMaterial,
  );
  base.position.set(0, groundY + 0.12, 0);
  base.userData.role = 'fixed-archimedes-screw-base';
  root.add(base);
  const streamBed = new THREE.Mesh(
    new THREE.BoxGeometry(4.10, 0.22, 4.92),
    frameMaterial,
  );
  streamBed.position.set(lowerEnd.x + 0.20, groundY + 0.34, 0);
  streamBed.userData.role = 'fixed-stream-bed-around-lower-water-wheel';
  root.add(streamBed);
  const streamWater = new THREE.Mesh(
    new THREE.BoxGeometry(3.90, streamSurfaceY-groundY-.45, 4.70),
    waterMaterial,
  );
  streamWater.position.set(lowerEnd.x + 0.20, (streamSurfaceY+groundY+.45)/2, 0);
  streamWater.userData.role =
    'stream-immersing-lower-screw-inlet-and-driving-wheel';
  root.add(streamWater);
  const streamMarkers = [];
  for (let index = 0; index < 12; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `axial-driving-stream-marker-${index + 1}`;
    root.add(marker);
    streamMarkers.push(marker);
  }

  const dischargeTrough = new THREE.Group();
  dischargeTrough.position.set(upperEnd.x - 2.02, dischargeTroughY, 0);
  dischargeTrough.rotation.z = -0.05;
  dischargeTrough.userData.role =
    'fixed-upper-trough-receiving-continuous-screw-discharge';
  root.add(dischargeTrough);
  const troughBottom = new THREE.Mesh(
    new THREE.BoxGeometry(3.34, 0.14, 1.28),
    frameMaterial,
  );
  dischargeTrough.add(troughBottom);
  const troughSides = [-1, 1].map((sign) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(3.34, 0.38, 0.09),
      frameMaterial,
    );
    side.position.set(0, 0.18, sign * 0.59);
    dischargeTrough.add(side);
    return side;
  });
  const troughWater = new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 0.09, 1.06),
    waterMaterial,
  );
  troughWater.position.y = 0.11;
  troughWater.userData.role = 'raised-water-leaving-upper-trough';
  dischargeTrough.add(troughWater);
  const dischargeCurve = new THREE.CatmullRomCurve3([
    upperEnd.clone(),
    upperEnd.clone().add(new THREE.Vector3(-0.18, -0.18, 0)),
    new THREE.Vector3(upperEnd.x - 0.42, dischargeTroughY + 0.22, 0),
  ], false, 'centripetal');
  const upperDischarge = new THREE.Mesh(
    new THREE.TubeGeometry(dischargeCurve, 28, 0.10, 12, false),
    paleWaterMaterial,
  );
  upperDischarge.userData.role =
    'continuous-water-discharge-from-top-of-spiral-passage';
  root.add(upperDischarge);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.y = state.screwAngle;
    state.waterPocketStates.forEach((pocketState, index) => {
      waterPockets[index].position.copy(pocketState.localPosition);
      waterPockets[index].scale.setScalar(pocketState.scale);
      waterPockets[index].visible = pocketState.scale > 0.002;
    });
    const streamPhase = THREE.MathUtils.euclideanModulo(time / 0.96, 1);
    for (let index = 0; index < streamMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        streamPhase + index / streamMarkers.length,
        1,
      );
      streamMarkers[index].position.set(
        lowerEnd.x + 0.20,
        streamSurfaceY + 0.08,
        -2.20 + 4.40 * progress,
      );
      streamMarkers[index].scale.setScalar(
        Math.sqrt(Math.sin(Math.PI * progress)),
      );
    }
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    assemblyCenter: assemblyCenter.clone(),
    assemblyQuaternion: assemblyQuaternion.clone(),
    axisDirection: axisDirection.clone(),
    bottomCrossAngle,
    casingRadius,
    centralShaftRadius,
    dischargeTroughY,
    groundY,
    helixInnerRadius,
    helixOuterRadius,
    helixTurns,
    inputAngularSpeed,
    lowerEnd: lowerEnd.clone(),
    projectedGravityLocal: projectedGravityLocal.clone(),
    representativeStreamForce,
    shaftRevolutionDuration,
    screwLength,
    screwPitch,
    streamDriveTorque,
    streamSurfaceY,
    streamVelocityZ,
    transportCycleDuration,
    upperEnd: upperEnd.clone(),
    waterPocketCount,
    waterPocketFadeFraction,
    waterPocketRadius,
    waterWheelCenter: waterWheelCenter.clone(),
    waterWheelPaddleCount,
    waterWheelRadius,
    wheelLocalY,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: shaftRevolutionDuration,
      targetCycleDuration: shaftRevolutionDuration,
    },
    archetype:
      'stream-driven-inclined-archimedes-screw-with-one-to-one-lower-water-wheel-and-gravity-low-rising-pockets',
    blocks: {
      base,
      bearings,
      bearingSupports,
      bearingBridges,
      casing,
      casingEndRings,
      casingIndex,
      centralShaft,
      dischargeTrough,
      helicalFlight,
      paddles,
      rotor,
      screwAssembly,
      streamBed,
      streamMarkers,
      streamWater,
      troughBottom,
      troughSides,
      troughWater,
      upperDischarge,
      waterPockets,
      waterWheel,
      wheelRims,
    },
    degreesOfFreedom: {
      helicalFlightIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      screwAxisTranslationIndependent: false,
      waterPocketAxialMotionIndependent: false,
      waterWheelIndependent: false,
    },
    dynamics: {
      fluidCaptureLeakageSloshPressureViscosityPaddleHydrodynamicsBearingFrictionAndRotationalInertiaModeled:
        false,
      pocketTransport:
        'Five visible water packets remain on the gravity-low generator of the fixed oblique casing and advance axially by exactly one screw pitch per rotor revolution. Each packet fades to zero scale at the outlet before a new packet appears at the immersed inlet, representing continuous through-flow without a visible reset jump.',
      streamDrive:
        'A representative stream force in the positive local-z direction acts at the gravity-low paddle radius. Its moment about the oblique positive-y shaft is positive and agrees with the prescribed wheel and screw rotation; hydrodynamic speed equilibrium is not integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A lower paddle wheel, central shaft, transparent casing, and five-turn helical flight form one rigid rotor on one fixed oblique axis, so the drive wheel and screw rotate at exactly the same angle and speed. The supply stream partly immerses the lower inlet and acts on the lower wheel. For the reconstructed right-handed transport sense, each positive rotor revolution advances a gravity-low water pocket upward by one pitch through the spiral passage; successive pockets discharge continuously into the fixed upper trough.',
    motion: {
      inputAngularSpeed,
      materialStateCycleDuration: transportCycleDuration,
      motionType:
        'continuous-one-to-one-water-wheel-and-inclined-screw-rotation',
      screwRevolutionsPerCycle: 1,
      screwRevolutionsPerMaterialStateCycle: helixTurns,
      shaftRevolutionDuration,
      waterWheelRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 443 page provides Brown’s static engraving and caption; its Animated control is unavailable and the page contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      screwAngle: sourceState.screwAngle,
      waterPocketPositions: sourceState.waterPocketStates.map(
        ({ worldPosition }) => worldPosition.clone(),
      ),
      waterWheelAngle: sourceState.waterWheelAngle,
    },
    sourceReference: {
      brownPlate443: {
        approximateLowerWheelCenterPixels: [391, 367],
        approximateScrewLowerEndPixels: [354, 341],
        approximateScrewUpperEndPixels: [86, 75],
        approximateTubeRadiusPixels: 63,
        approximateUpperDischargePixels: [73, 117],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 22,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the apparatus applies Archimedes’s screw to raising water',
          'the supply stream is the motive power',
          'the wheel and spiral passage share one oblique shaft',
          'the spiral passage lower end is immersed',
          'the stream acts on the wheel at the lower end and produces rotation',
          'rotation conveys water continuously upward through the spiral passage and discharges it at the top',
        ],
        engravingEvidence:
          'Brown’s engraving shows one strongly inclined cylindrical screw body with an internal dotted helix, one coaxial paddle wheel at its lower immersed end, and water issuing from the upper end into a raised trough.',
        reconstructionDisclosure:
          'Brown gives no dimensions, screw diameter, pitch, turn count, handedness, inclination, wheel diameter or paddle count, stream direction or force, rotation speed, flow rate, bearing arrangement, losses, or timing. Those values, transparent casing, five gravity-low tracers, frame, colors, and eleven-second shaft revolution are independently engineered. The oblique one-shaft wheel-and-screw topology, lower immersion, stream drive, spiral upward transport, and continuous upper discharge are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 443',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      helicalPocketConstraint:
        'helixAngle(u)=bottomAngle-2*pi*turns*u; with u=(rotorRevolutions+integerPocketOffset)/turns, helixAngle+rotorAngle=bottomAngle modulo 2*pi while y rises by pitch per revolution.',
      oneToOneRigidShaft:
        'waterWheelAngle=screwAngle=inputRotation and all three rotating parts share the same rotor transform.',
      streamTorque:
        'In assembly coordinates the gravity-low contact is r=(-R,0,0) and stream force F=(0,0,+F), hence tau_y=r_z*F_x-r_x*F_z=R*F>0.',
      waterAdvance:
        'axialWaterSpeed=pitch*screwAngularSpeed/(2*pi) and axialWaterAcceleration=pitch*screwAngularAcceleration/(2*pi).',
    },
    update,
    waterPocketState,
    worldFromAssemblyLocal,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.52, groundY, -2.72),
    new THREE.Vector3(4.10, 3.48, 2.72),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(6.3, 4.8, 10.8);
  root.userData.groundFloorY = groundY;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = shaftRevolutionDuration;
  root.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) m.fog = false; });
  markShadows(root);
  base.receiveShadow = true;
  streamBed.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredStreamDrivenArchimedesScrewMovement(movement) {
  if (movement.id !== 443) return null;
  return streamDrivenArchimedesScrew(movement);
}
