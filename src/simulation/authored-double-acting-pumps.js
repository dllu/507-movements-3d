import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function horizontalRing(radius, tubeRadius, material) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 48),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function setVerticalExtent(mesh, bottom, top) {
  const height = Math.max(0.001, top - bottom);
  mesh.position.y = (bottom + top) / 2;
  mesh.scale.y = height;
  mesh.visible = top > bottom;
}

function positiveC2Lobe(value) {
  return Math.max(0, value) ** 3;
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 16, false),
    material,
  ), role);
  tube.userData.curve = curve;
  return tube;
}

function doubleActingPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4.9;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const pistonCenterY = 0.22;
  const pistonAmplitude = 0.72;
  const pistonThickness = 0.24;
  const pistonRadius = 0.79;
  const chamberWaterRadius = 0.72;
  const chamberArea = Math.PI * chamberWaterRadius ** 2;
  const lowerChamberEndY = -1.48;
  const upperChamberEndY = 1.91;
  const rodLength = 3.20;
  const stuffingBoxY = 2.14;
  const maximumValveLift = 0.16;
  const valveSeats = Object.freeze({
    lowerDischarge3: new THREE.Vector3(-1.18, -1.12, 0),
    lowerSuction2: new THREE.Vector3(1.18, -1.12, 0),
    upperDischarge4: new THREE.Vector3(-1.18, 1.57, 0),
    upperSuction1: new THREE.Vector3(1.18, 1.57, 0),
  });
  const groundY = -2.62;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const sine = Math.sin(cycleAngle);
    const cosine = Math.cos(cycleAngle);
    const strokeCosine = Math.abs(cosine) < 1e-12 ? 0 : cosine;
    const pistonY = pistonCenterY - pistonAmplitude * sine;
    const pistonVelocity = -pistonAmplitude * strokeCosine * inputSpeed;
    const pistonAcceleration = pistonAmplitude * (
      sine * inputSpeed ** 2 - cosine * inputAcceleration
    );
    const pistonBottomY = pistonY - pistonThickness / 2;
    const pistonTopY = pistonY + pistonThickness / 2;
    const downstrokeOpen = positiveC2Lobe(strokeCosine);
    const upstrokeOpen = positiveC2Lobe(-strokeCosine);
    const downstrokeFlow = chamberArea * Math.max(0, -pistonVelocity);
    const upstrokeFlow = chamberArea * Math.max(0, pistonVelocity);
    const upperSuctionFlowRate = downstrokeFlow;
    const lowerDischargeFlowRate = downstrokeFlow;
    const lowerSuctionFlowRate = upstrokeFlow;
    const upperDischargeFlowRate = upstrokeFlow;
    const upperChamberWaterVolume = chamberArea
      * (upperChamberEndY - pistonTopY);
    const upperChamberWaterVolumeRate = -chamberArea * pistonVelocity;
    const lowerChamberWaterVolume = chamberArea
      * (pistonBottomY - lowerChamberEndY);
    const lowerChamberWaterVolumeRate = chamberArea * pistonVelocity;
    let mode;
    if (Math.abs(cosine) < 1e-12) {
      mode = sine > 0
        ? 'bottom-dead-center-all-four-checks-seated'
        : 'top-dead-center-all-four-checks-seated';
    } else if (cosine > 0) {
      mode = 'piston-down-upper-suction-1-and-lower-discharge-3-open';
    } else {
      mode = 'piston-up-lower-suction-2-and-upper-discharge-4-open';
    }
    return {
      chamberArea,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      lowerChamberWaterVolume,
      lowerChamberWaterVolumeRate,
      lowerDischarge3Lift: maximumValveLift * downstrokeOpen,
      lowerDischarge3Open: downstrokeOpen,
      lowerDischargeFlowRate,
      lowerSuction2Lift: maximumValveLift * upstrokeOpen,
      lowerSuction2Open: upstrokeOpen,
      lowerSuctionFlowRate,
      mode,
      phase,
      pistonAcceleration,
      pistonBottomY,
      pistonTopY,
      pistonVelocity,
      pistonY,
      rodBottomY: pistonTopY,
      rodTopY: pistonTopY + rodLength,
      totalDischargeFlowRate:
        lowerDischargeFlowRate + upperDischargeFlowRate,
      totalSuctionFlowRate: lowerSuctionFlowRate + upperSuctionFlowRate,
      upperChamberWaterVolume,
      upperChamberWaterVolumeRate,
      upperDischarge4Lift: maximumValveLift * upstrokeOpen,
      upperDischarge4Open: upstrokeOpen,
      upperDischargeFlowRate,
      upperSuction1Lift: maximumValveLift * downstrokeOpen,
      upperSuction1Open: downstrokeOpen,
      upperSuctionFlowRate,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const suctionValveMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const dischargeValveMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.27,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.72,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.16, 3.3),
    frameMaterial,
  ), 'fixed-double-acting-pump-foundation');
  base.position.set(0, groundY + 0.08, 0);
  root.add(base);

  const barrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.00, 1.00, 3.72, 64, 1, true),
    shellMaterial,
  ), 'closed-double-acting-cylinder');
  barrel.position.y = 0.22;
  root.add(barrel);
  const lowerCover = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.99, 0.99, 0.14, 56),
    frameMaterial,
  ), 'fixed-closed-lower-cylinder-end');
  lowerCover.position.y = -1.64;
  root.add(lowerCover);
  const upperCover = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.99, 0.99, 0.14, 56),
    frameMaterial,
  ), 'fixed-closed-upper-cylinder-end');
  upperCover.position.y = 2.08;
  root.add(upperCover);
  for (const y of [-1.57, 2.01]) {
    const rim = horizontalRing(1.00, 0.075, darkMaterial);
    rim.position.y = y;
    root.add(rim);
  }
  const barrelRails = addRole(new THREE.Group(),
    'fixed-cutaway-double-acting-cylinder-outline');
  for (const x of [-0.73, 0.73]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 3.55, 0.11),
      frameMaterial,
    );
    rail.position.set(x, 0.22, -0.76);
    barrelRails.add(rail);
  }
  root.add(barrelRails);

  const stuffingBox = addRole(new THREE.Group(),
    'fixed-stuffing-box-at-upper-cylinder-end');
  stuffingBox.position.y = stuffingBoxY;
  root.add(stuffingBox);
  const stuffingBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 0.42, 36),
    suctionValveMaterial,
  );
  stuffingBody.position.y = 0.18;
  stuffingBox.add(stuffingBody);
  const stuffingBore = horizontalRing(0.14, 0.045, darkMaterial);
  stuffingBore.position.y = 0.39;
  stuffingBox.add(stuffingBore);

  const piston = addRole(new THREE.Group(),
    'solid-double-acting-piston-separating-upper-and-lower-chambers');
  root.add(piston);
  const pistonBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pistonRadius,
      pistonRadius,
      pistonThickness,
      52,
    ),
    pistonMaterial,
  );
  piston.add(pistonBody);
  for (const y of [-pistonThickness / 2, pistonThickness / 2]) {
    const rim = horizontalRing(pistonRadius, 0.05, darkMaterial);
    rim.position.y = y;
    piston.add(rim);
  }
  const pistonRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, rodLength, 20),
    darkMaterial,
  ), 'piston-rod-sliding-through-one-end-stuffing-box');
  root.add(pistonRod);
  const rodTopMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 12),
    whiteMaterial,
  );
  root.add(rodTopMarker);

  const lowerWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      chamberWaterRadius,
      chamberWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'water-in-lower-double-acting-chamber');
  root.add(lowerWater);
  const upperWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      chamberWaterRadius,
      chamberWaterRadius,
      1,
      48,
    ),
    waterMaterial,
  ), 'water-in-upper-double-acting-chamber');
  root.add(upperWater);

  const suctionManifold = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 4.65, 36, 1, true),
    shellMaterial,
  ), 'common-suction-pipe-A-feeding-two-inlet-checks');
  suctionManifold.position.set(2.02, -0.18, 0);
  root.add(suctionManifold);
  const suctionManifoldWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 4.63, 32),
    waterMaterial,
  );
  suctionManifoldWater.position.copy(suctionManifold.position);
  root.add(suctionManifoldWater);
  const suctionMouth = horizontalRing(0.31, 0.05, darkMaterial);
  suctionMouth.position.set(2.02, -2.50, 0);
  root.add(suctionMouth);

  const dischargeManifold = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 4.80, 36, 1, true),
    shellMaterial,
  ), 'common-discharge-pipe-B-receiving-two-outlet-checks');
  dischargeManifold.position.set(-2.02, 0.48, 0);
  root.add(dischargeManifold);
  const dischargeManifoldWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 4.78, 32),
    waterMaterial,
  );
  dischargeManifoldWater.position.copy(dischargeManifold.position);
  root.add(dischargeManifoldWater);
  const dischargeMouth = horizontalRing(0.31, 0.05, darkMaterial);
  dischargeMouth.position.set(-2.02, 2.88, 0);
  root.add(dischargeMouth);

  const upperSuctionBranch = makeTube([
    new THREE.Vector3(2.02, 1.78, 0),
    new THREE.Vector3(1.60, 1.79, 0),
    new THREE.Vector3(1.18, 1.57, 0),
    new THREE.Vector3(0.86, 1.47, 0),
  ], 0.25, shellMaterial,
  'upper-suction-branch-through-valve-1');
  root.add(upperSuctionBranch);
  const lowerSuctionBranch = makeTube([
    new THREE.Vector3(2.02, -1.31, 0),
    new THREE.Vector3(1.58, -1.32, 0),
    new THREE.Vector3(1.18, -1.12, 0),
    new THREE.Vector3(0.86, -1.03, 0),
  ], 0.25, shellMaterial,
  'lower-suction-branch-through-valve-2');
  root.add(lowerSuctionBranch);
  const lowerDischargeBranch = makeTube([
    new THREE.Vector3(-0.86, -1.03, 0),
    new THREE.Vector3(-1.18, -1.12, 0),
    new THREE.Vector3(-1.58, -1.32, 0),
    new THREE.Vector3(-2.02, -1.31, 0),
  ], 0.25, shellMaterial,
  'lower-discharge-branch-through-valve-3');
  root.add(lowerDischargeBranch);
  const upperDischargeBranch = makeTube([
    new THREE.Vector3(-0.86, 1.47, 0),
    new THREE.Vector3(-1.18, 1.57, 0),
    new THREE.Vector3(-1.60, 1.79, 0),
    new THREE.Vector3(-2.02, 1.78, 0),
  ], 0.25, shellMaterial,
  'upper-discharge-branch-through-valve-4');
  root.add(upperDischargeBranch);

  const branchWaters = [
    [upperSuctionBranch, 'water-through-upper-suction-valve-1'],
    [lowerSuctionBranch, 'water-through-lower-suction-valve-2'],
    [lowerDischargeBranch, 'water-through-lower-discharge-valve-3'],
    [upperDischargeBranch, 'water-through-upper-discharge-valve-4'],
  ].map(([branch, role]) => {
    const water = addRole(new THREE.Mesh(
      new THREE.TubeGeometry(branch.userData.curve, 72, 0.16, 14, false),
      waterMaterial,
    ), role);
    root.add(water);
    return water;
  });

  const valveBodyMaterial = shellMaterial.clone();
  valveBodyMaterial.opacity = 0.38;
  const makeValve = (name, material, role) => {
    const position = valveSeats[name];
    const group = addRole(new THREE.Group(), role);
    group.position.copy(position);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.40, 0.40, 0.42, 36, 1, true),
      valveBodyMaterial,
    );
    group.add(body);
    const seat = horizontalRing(0.31, 0.055, darkMaterial);
    seat.position.y = -0.11;
    group.add(seat);
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.30, 0.08, 34),
      material,
    );
    disk.position.y = -0.04;
    group.add(disk);
    group.userData.disk = disk;
    root.add(group);
    return group;
  };
  const upperSuctionValve1 = makeValve(
    'upperSuction1',
    suctionValveMaterial,
    'number-1-upper-suction-check',
  );
  const lowerSuctionValve2 = makeValve(
    'lowerSuction2',
    suctionValveMaterial,
    'number-2-lower-suction-check',
  );
  const lowerDischargeValve3 = makeValve(
    'lowerDischarge3',
    dischargeValveMaterial,
    'number-3-lower-discharge-check',
  );
  const upperDischargeValve4 = makeValve(
    'upperDischarge4',
    dischargeValveMaterial,
    'number-4-upper-discharge-check',
  );

  const branchDefinitions = [
    [upperSuctionBranch.userData.curve, 'upperSuctionFlowRate'],
    [lowerSuctionBranch.userData.curve, 'lowerSuctionFlowRate'],
    [lowerDischargeBranch.userData.curve, 'lowerDischargeFlowRate'],
    [upperDischargeBranch.userData.curve, 'upperDischargeFlowRate'],
  ];
  const flowMarkerGroups = branchDefinitions.map(([curve, flowKey], branch) => {
    return Array.from({ length: 3 }, (_, index) => {
      const marker = addRole(new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 10),
        whiteMaterial,
      ), 'double-acting-port-flow-tracer');
      marker.userData = { branch, curve, flowKey, index };
      root.add(marker);
      return marker;
    });
  });

  const update = (time) => {
    const state = stateAtTime(time);
    piston.position.y = state.pistonY;
    pistonRod.position.y = (state.rodBottomY + state.rodTopY) / 2;
    rodTopMarker.position.set(0, state.rodTopY, 0);
    setVerticalExtent(
      lowerWater,
      lowerChamberEndY,
      state.pistonBottomY - 0.04,
    );
    setVerticalExtent(
      upperWater,
      state.pistonTopY + 0.04,
      upperChamberEndY,
    );
    upperSuctionValve1.userData.disk.position.y = -0.04
      + state.upperSuction1Lift;
    lowerSuctionValve2.userData.disk.position.y = -0.04
      + state.lowerSuction2Lift;
    lowerDischargeValve3.userData.disk.position.y = -0.04
      + state.lowerDischarge3Lift;
    upperDischargeValve4.userData.disk.position.y = -0.04
      + state.upperDischarge4Lift;
    flowMarkerGroups.flat().forEach((marker) => {
      const { curve, flowKey, index } = marker.userData;
      const flow = state[flowKey];
      const travel = THREE.MathUtils.euclideanModulo(
        index / 3 + state.phase * 2,
        1,
      );
      marker.position.copy(curve.getPoint(travel));
      marker.position.z = 0.21;
      marker.visible = flow > 0.002;
    });
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    chamberArea,
    chamberWaterRadius,
    cycleDuration,
    groundY,
    inputAngularSpeed,
    lowerChamberEndY,
    maximumValveLift,
    pistonAmplitude,
    pistonCenterY,
    pistonRadius,
    pistonThickness,
    rodLength,
    stuffingBoxY,
    upperChamberEndY,
    valveSeats,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'closed-double-acting-pump-with-stuffing-box-four-numbered-checks-opposite-chamber-suction-and-discharge',
    blocks: {
      barrel,
      barrelRails,
      base,
      branchWaters,
      dischargeManifold,
      dischargeManifoldWater,
      flowMarkerGroups,
      lowerCover,
      lowerDischargeBranch,
      lowerDischargeValve3,
      lowerSuctionBranch,
      lowerSuctionValve2,
      lowerWater,
      piston,
      pistonBody,
      pistonRod,
      rodTopMarker,
      stuffingBox,
      suctionManifold,
      suctionManifoldWater,
      upperCover,
      upperDischargeBranch,
      upperDischargeValve4,
      upperSuctionBranch,
      upperSuctionValve1,
      upperWater,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      lowerDischarge3Independent: false,
      lowerSuction2Independent: false,
      operatingDegreesOfFreedom: 1,
      upperDischarge4Independent: false,
      upperSuction1Independent: false,
    },
    dynamics: {
      fullPressureWaveValveImpactLeakageRodAreaDifferenceCavitationAndDriveForceModeled:
        false,
      checkValveModel:
        'Each stroke pair uses a C2 cubic velocity lobe. Valves 1 and 3 share the downstroke lobe; valves 2 and 4 share the disjoint upstroke lobe; all four seat at dead center.',
      flowModel:
        'Both closed cylinder chambers are treated as primed and incompressible with equal effective areas. Rod displacement, pressure losses and leakage are neglected, so one suction and the opposite discharge have exactly equal flow on every moving stroke.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The solid piston divides a cylinder closed at both ends, and its rod slides through a stuffing box in the upper cover. On the depicted downstroke, upper suction valve 1 admits water while lower discharge valve 3 sends the displaced lower-chamber water into common pipe B; lower suction 2 and upper discharge 4 remain shut. On the upstroke, lower suction 2 admits water while upper discharge 4 sends the upper-chamber displacement to B; valves 1 and 3 shut. Thus common suction pipe A and common discharge pipe B serve opposite ends alternately.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'closed-double-acting-piston-with-alternating-diagonal-pairs-of-four-check-valves',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 452 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      lowerDischarge3Open: sourceState.lowerDischarge3Open,
      lowerSuction2Open: sourceState.lowerSuction2Open,
      mode: sourceState.mode,
      pistonVelocity: sourceState.pistonVelocity,
      upperDischarge4Open: sourceState.upperDischarge4Open,
      upperSuction1Open: sourceState.upperSuction1Open,
    },
    sourceReference: {
      brownPlate452: {
        approximateDischargePipeBCenterPixels: [112, 197],
        approximateLowerDischarge3Pixels: [191, 446],
        approximateLowerSuction2Pixels: [341, 446],
        approximatePistonCenterPixels: [279, 281],
        approximateSuctionPipeACenterPixels: [415, 309],
        approximateUpperDischarge4Pixels: [195, 120],
        approximateUpperSuction1Pixels: [350, 126],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the pump is double acting',
          'the cylinder is closed at each end',
          'the piston rod passes through a stuffing box at one end',
          'four openings have two suction and two discharge valves',
          'A is the common suction pipe and B the common discharge pipe',
          'downstroke opens upper suction 1 and lower discharge 3',
          'upstroke opens lower suction 2 and upper discharge 4',
        ],
        engravingEvidence:
          'Brown’s section shows a central closed vertical cylinder and solid piston, a rod through the top packing, right suction manifold A, left discharge manifold B, and the four checks in their numbered upper-right, lower-right, lower-left and upper-left positions. Its arrow depicts the piston moving downward.',
        reconstructionDisclosure:
          'Brown gives no bore, stroke, rod area, valve lift, manifold size, water source level, pressure, losses, leakage, drive, or timing. Those values, equal effective chamber areas, sinusoidal stroke, C2 check lobes, transparent cutaway, colors, tracers, and 4.9-second cycle are independently engineered. The two closed ends, stuffing box, four numbered ports, common A/B pipes, and diagonal stroke-pair sequence are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 452',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      downstrokePair:
        'upperSuction1=lowerDischarge3=max(cos(phi),0)^3.',
      massBalance:
        'dV_upper/dt=Q_upper_suction-Q_upper_discharge and dV_lower/dt=Q_lower_suction-Q_lower_discharge exactly. Total suction equals total discharge=A*|v_piston|.',
      upstrokePair:
        'lowerSuction2=upperDischarge4=max(-cos(phi),0)^3.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.42, groundY, -1.72),
    new THREE.Vector3(2.42, 4.08, 1.72),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(6.0, 4.7, 10.4);
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

export function createAuthoredDoubleActingPumpMovement(movement) {
  if (movement.id !== 452) return null;
  return doubleActingPump(movement);
}
