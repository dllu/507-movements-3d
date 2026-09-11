import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

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

function transformLocalPoint(localPoint, pivot, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector3(
    pivot.x + localPoint.x * cosine - localPoint.y * sine,
    pivot.y + localPoint.x * sine + localPoint.y * cosine,
    localPoint.z,
  );
}

function tippingWaterMeter(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const pivot = new THREE.Vector3(0, 0.34, 0);
  const maximumTiltAngle = THREE.MathUtils.degToRad(14);
  const troughHalfLength = 2.34;
  const troughWidth = 1.46;
  const floorLocalY = 0.18;
  const floorThickness = 0.16;
  const floorTopLocalY = floorLocalY + floorThickness / 2;
  const sideWallHeight = 0.72;
  const sideWallThickness = 0.12;
  const dividerHeight = 0.84;
  const dividerTopLocalY = floorTopLocalY + dividerHeight;
  const compartmentWaterCenterX = 1.12;
  const maximumWaterDepth = 0.43;
  const compartmentCapacity = 0.004;
  const fullWaterMass = 1.40;
  const gravity = 9.81;
  const rightFillEndPhase = 0.38;
  const rightTipEndPhase = 0.50;
  const leftFillEndPhase = 0.88;
  const leftTipEndPhase = 1;
  const tippingPhaseDuration = rightTipEndPhase - rightFillEndPhase;
  const inletFlowRate = compartmentCapacity
    / (cycleDuration * rightFillEndPhase);
  const groundY = -2.05;
  const streamX = pivot.x;
  const streamOutletY = 2.72;
  const streamBottomY = 1.08;
  const drainFlowDerivativeMaximum = 1.875;
  const leftWaterCenterLocal = new THREE.Vector3(
    -compartmentWaterCenterX,
    floorTopLocalY,
    0,
  );
  const rightWaterCenterLocal = new THREE.Vector3(
    compartmentWaterCenterX,
    floorTopLocalY,
    0,
  );
  const dividerTopLocal = new THREE.Vector3(0, dividerTopLocalY, 0);
  const leftOutletLocal = new THREE.Vector3(
    -troughHalfLength,
    floorTopLocalY + 0.04,
    0,
  );
  const rightOutletLocal = new THREE.Vector3(
    troughHalfLength,
    floorTopLocalY + 0.04,
    0,
  );

  const troughAngleKinematicsAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < rightFillEndPhase) {
      return { first: 0, second: 0, value: maximumTiltAngle };
    }
    if (phase < rightTipEndPhase) {
      return segmentKinematics(
        phase,
        rightFillEndPhase,
        rightTipEndPhase,
        maximumTiltAngle,
        -maximumTiltAngle,
      );
    }
    if (phase < leftFillEndPhase) {
      return { first: 0, second: 0, value: -maximumTiltAngle };
    }
    return segmentKinematics(
      phase,
      leftFillEndPhase,
      leftTipEndPhase,
      -maximumTiltAngle,
      maximumTiltAngle,
    );
  };

  const waterStateAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < rightFillEndPhase) {
      return {
        leftDrainFlow: 0,
        leftFill: 0,
        mode: 'right-compartment-filling-on-left-stop',
        rightDrainFlow: 0,
        rightFill: phase / rightFillEndPhase,
        stopContact: 'left',
      };
    }
    if (phase < rightTipEndPhase) {
      const progress = (phase - rightFillEndPhase)
        / tippingPhaseDuration;
      return {
        leftDrainFlow: 0,
        leftFill: 0,
        mode: 'right-compartment-descending-and-emptying',
        rightDrainFlow:
          smoothStep5First(progress) / drainFlowDerivativeMaximum,
        rightFill: 1 - smoothStep5(progress),
        stopContact: 'none',
      };
    }
    if (phase < leftFillEndPhase) {
      return {
        leftDrainFlow: 0,
        leftFill: (phase - rightTipEndPhase)
          / (leftFillEndPhase - rightTipEndPhase),
        mode: 'left-compartment-filling-on-right-stop',
        rightDrainFlow: 0,
        rightFill: 0,
        stopContact: 'right',
      };
    }
    const progress = (phase - leftFillEndPhase)
      / (leftTipEndPhase - leftFillEndPhase);
    return {
      leftDrainFlow:
        smoothStep5First(progress) / drainFlowDerivativeMaximum,
      leftFill: 1 - smoothStep5(progress),
      mode: 'left-compartment-descending-and-emptying',
      rightDrainFlow: 0,
      rightFill: 0,
      stopContact: 'none',
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    const angleKinematics = troughAngleKinematicsAtPhase(phase);
    const waterState = waterStateAtPhase(phase);
    const troughAngle = angleKinematics.value;
    const troughAngularSpeed = angleKinematics.first * phaseSpeed;
    const troughAngularAcceleration = angleKinematics.second
      * phaseSpeed ** 2
      + angleKinematics.first * phaseAcceleration;
    const leftWaterCenter = transformLocalPoint(
      leftWaterCenterLocal,
      pivot,
      troughAngle,
    );
    const rightWaterCenter = transformLocalPoint(
      rightWaterCenterLocal,
      pivot,
      troughAngle,
    );
    const leftWaterMass = fullWaterMass * waterState.leftFill;
    const rightWaterMass = fullWaterMass * waterState.rightFill;
    const waterTorqueAboutPivot = -gravity * (
      leftWaterMass * (leftWaterCenter.x - pivot.x)
      + rightWaterMass * (rightWaterCenter.x - pivot.x)
    );
    const dividerTop = transformLocalPoint(
      dividerTopLocal,
      pivot,
      troughAngle,
    );
    const streamOffsetFromDivider = streamX - dividerTop.x;
    let streamTargetSide = 'divider-transition';
    if (streamOffsetFromDivider > 1e-12) streamTargetSide = 'right';
    if (streamOffsetFromDivider < -1e-12) streamTargetSide = 'left';
    return {
      ...waterState,
      dividerTop,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      inletFlowRate,
      leftOutletPoint: transformLocalPoint(
        leftOutletLocal,
        pivot,
        troughAngle,
      ),
      leftWaterCenter,
      leftWaterMass,
      storedWaterVolume:
        compartmentCapacity * (waterState.leftFill + waterState.rightFill),
      phase,
      phaseAcceleration,
      phaseSpeed,
      rightOutletPoint: transformLocalPoint(
        rightOutletLocal,
        pivot,
        troughAngle,
      ),
      rightWaterCenter,
      rightWaterMass,
      streamOffsetFromDivider,
      streamTargetSide,
      troughAngle,
      troughAngularAcceleration,
      troughAngularSpeed,
      waterTorqueAboutPivot,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
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
    metalness: 0.32,
    roughness: 0.44,
  });
  const troughMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.50,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.68,
    roughness: 0.29,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x8ad9e4, {
    opacity: 0.64,
    roughness: 0.25,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const trough = new THREE.Group();
  trough.position.copy(pivot);
  trough.userData.role =
    'one-rigid-trough-rocking-about-one-fixed-transverse-axis';
  root.add(trough);

  const makeCompartment = (side) => {
    const sign = side === 'left' ? -1 : 1;
    const compartment = new THREE.Group();
    compartment.position.x = sign * troughHalfLength / 2;
    compartment.userData.role =
      `${side}-equal-half-of-transversely-divided-trough`;
    compartment.userData.capacity = compartmentCapacity;
    trough.add(compartment);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(
        troughHalfLength,
        floorThickness,
        troughWidth,
      ),
      troughMaterial,
    );
    floor.position.y = floorLocalY;
    floor.userData.role = `${side}-compartment-floor`;
    compartment.add(floor);
    const sideWalls = [-1, 1].map((zSign) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(
          troughHalfLength,
          sideWallHeight,
          sideWallThickness,
        ),
        troughMaterial,
      );
      wall.position.set(
        0,
        floorTopLocalY + sideWallHeight / 2,
        zSign * (troughWidth - sideWallThickness) / 2,
      );
      wall.userData.role =
        `${side}-compartment-${zSign < 0 ? 'rear' : 'front'}-side-wall`;
      compartment.add(wall);
      return wall;
    });
    return { compartment, floor, sideWalls };
  };

  const leftHalf = makeCompartment('left');
  const rightHalf = makeCompartment('right');
  const centralDivider = new THREE.Mesh(
    new THREE.BoxGeometry(
      sideWallThickness,
      dividerHeight,
      troughWidth - sideWallThickness,
    ),
    troughMaterial,
  );
  centralDivider.position.y = floorTopLocalY + dividerHeight / 2;
  centralDivider.userData.role =
    'single-transverse-divider-forming-two-equal-compartments';
  trough.add(centralDivider);

  const underBrace = new THREE.Mesh(
    new THREE.BoxGeometry(3.22, 0.18, 0.42),
    darkMaterial,
  );
  underBrace.position.y = floorLocalY - 0.17;
  underBrace.userData.role = 'rigid-trough-underframe-centered-on-axis';
  trough.add(underBrace);
  const angleIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.08, 0.11),
    whiteMaterial,
  );
  angleIndicator.position.set(0.46, -0.03, troughWidth / 2 + 0.06);
  angleIndicator.userData.role = 'visible-trough-angle-index';
  trough.add(angleIndicator);

  const leftWater = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    waterMaterial,
  );
  leftWater.userData.role =
    'left-variable-water-load-with-horizontal-free-surface';
  trough.add(leftWater);
  const rightWater = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    waterMaterial,
  );
  rightWater.userData.role =
    'right-variable-water-load-with-horizontal-free-surface';
  trough.add(rightWater);

  const axle = cylinderAlongZ(0.20, 2.38, darkMaterial, 36);
  axle.position.copy(pivot);
  axle.userData.role = 'single-fixed-transverse-trough-axis';
  root.add(axle);
  const bearingRings = [-1, 1].map((sign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.075, 10, 36),
      frameMaterial,
    );
    ring.position.set(pivot.x, pivot.y, sign * 0.92);
    ring.userData.role = `fixed-${sign < 0 ? 'rear' : 'front'}-axis-bearing`;
    root.add(ring);
    return ring;
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.70, 0.25, 2.74),
    frameMaterial,
  );
  base.position.set(0, groundY + 0.125, 0);
  base.userData.role = 'fixed-water-meter-base';
  root.add(base);
  const supportPosts = [-1, 1].map((zSign) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 2.22, 0.30),
      frameMaterial,
    );
    post.position.set(0, -0.78, zSign * 0.92);
    post.userData.role =
      `fixed-${zSign < 0 ? 'rear' : 'front'}-pivot-standard`;
    root.add(post);
    return post;
  });
  const braces = [];
  for (const z of [-0.92, 0.92]) {
    for (const x of [-1.92, 1.92]) {
      const brace = beamBetween(
        new THREE.Vector3(x, groundY + 0.31, z),
        new THREE.Vector3(0, pivot.y - 0.20, z),
        0.18,
        0.22,
        frameMaterial,
      );
      brace.userData.role = 'fixed-diagonal-axis-frame-brace';
      root.add(brace);
      braces.push(brace);
    }
  }

  const lowFloorLocalY = floorLocalY - floorThickness / 2;
  const leftStopContact = transformLocalPoint(
    new THREE.Vector3(-1.70, lowFloorLocalY, 0),
    pivot,
    maximumTiltAngle,
  );
  const rightStopContact = transformLocalPoint(
    new THREE.Vector3(1.70, lowFloorLocalY, 0),
    pivot,
    -maximumTiltAngle,
  );
  const makeStop = (side, contact) => {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.18, 0.64),
      darkMaterial,
    );
    pad.position.set(contact.x, contact.y - 0.09, 0);
    pad.userData.role = `fixed-${side}-trough-travel-stop`;
    root.add(pad);
    return pad;
  };
  const leftStop = makeStop('left', leftStopContact);
  const rightStop = makeStop('right', rightStopContact);

  const flumeLength = 3.72;
  const flumeAngle = 0.35;
  const flumeDirection = new THREE.Vector3(
    Math.cos(flumeAngle),
    Math.sin(flumeAngle),
    0,
  );
  const flumeOutlet = new THREE.Vector3(streamX, streamOutletY, 0);
  const flumeCenter = flumeOutlet.clone().addScaledVector(
    flumeDirection,
    flumeLength / 2,
  );
  const flume = new THREE.Group();
  flume.position.copy(flumeCenter);
  flume.rotation.z = flumeAngle;
  flume.userData.role = 'fixed-flume-providing-continuous-fall';
  root.add(flume);
  const flumeBottom = new THREE.Mesh(
    new THREE.BoxGeometry(flumeLength, 0.16, 1.04),
    frameMaterial,
  );
  flumeBottom.userData.role = 'fixed-inlet-flume-bottom';
  flume.add(flumeBottom);
  const flumeRails = [-1, 1].map((sign) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(flumeLength, 0.38, 0.10),
      frameMaterial,
    );
    rail.position.set(0, 0.19, sign * 0.47);
    rail.userData.role = 'fixed-inlet-flume-side';
    flume.add(rail);
    return rail;
  });

  const fallingWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 1, 20),
    waterMaterial,
  );
  fallingWater.position.set(
    streamX,
    (streamOutletY + streamBottomY) / 2,
    0,
  );
  fallingWater.scale.y = streamOutletY - streamBottomY;
  fallingWater.userData.role =
    'fixed-location-continuous-water-fall-over-moving-divider';
  root.add(fallingWater);
  const streamMarkers = [];
  for (let index = 0; index < 8; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `continuous-inlet-flow-marker-${index + 1}`;
    root.add(marker);
    streamMarkers.push(marker);
  }

  const makeSpill = (side) => {
    const spill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.085, 1, 16),
      paleWaterMaterial,
    );
    spill.userData.role = `${side}-outer-end-emptying-stream`;
    root.add(spill);
    return spill;
  };
  const leftSpill = makeSpill('left');
  const rightSpill = makeSpill('right');

  const updateWater = (water, side, fill, angle) => {
    const waterDepth = maximumWaterDepth * fill;
    water.visible = fill > 0.002;
    water.position.set(
      side * compartmentWaterCenterX,
      floorTopLocalY + waterDepth / 2,
      0,
    );
    water.rotation.z = -angle;
    water.scale.set(
      troughHalfLength - 0.28,
      Math.max(waterDepth, 0.001),
      troughWidth - 0.30,
    );
  };

  const updateSpill = (spill, outlet, flow) => {
    const streamLength = Math.max(0.10, outlet.y - groundY - 0.08);
    spill.visible = flow > 0.002;
    spill.position.set(outlet.x, outlet.y - streamLength / 2, 0);
    const widthScale = 0.36 + 0.64 * flow;
    spill.scale.set(widthScale, streamLength, widthScale);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    trough.rotation.z = state.troughAngle;
    updateWater(leftWater, -1, state.leftFill, state.troughAngle);
    updateWater(rightWater, 1, state.rightFill, state.troughAngle);
    updateSpill(leftSpill, state.leftOutletPoint, state.leftDrainFlow);
    updateSpill(rightSpill, state.rightOutletPoint, state.rightDrainFlow);
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 0.72, 1);
    for (let index = 0; index < streamMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + index / streamMarkers.length,
        1,
      );
      streamMarkers[index].position.set(
        streamX,
        streamOutletY
          + (streamBottomY - streamOutletY) * progress,
        0.18,
      );
      streamMarkers[index].scale.setScalar(
        Math.sqrt(Math.sin(Math.PI * progress)),
      );
    }
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    compartmentCapacity,
    compartmentWaterCenterX,
    cycleDuration,
    dividerHeight,
    dividerTopLocal: dividerTopLocal.clone(),
    floorLocalY,
    floorThickness,
    floorTopLocalY,
    fullWaterMass,
    gravity,
    groundY,
    inletFlowRate,
    leftFillEndPhase,
    leftStopContact: leftStopContact.clone(),
    leftTipEndPhase,
    maximumTiltAngle,
    maximumWaterDepth,
    pivot: pivot.clone(),
    rightFillEndPhase,
    rightStopContact: rightStopContact.clone(),
    rightTipEndPhase,
    sideWallHeight,
    streamBottomY,
    streamOutletY,
    streamX,
    tippingPhaseDuration,
    troughHalfLength,
    troughWidth,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'tipping-water-meter-with-equally-divided-pivoted-trough-alternately-filling-and-emptying',
    blocks: {
      angleIndicator,
      axle,
      base,
      bearingRings,
      braces,
      centralDivider,
      fallingWater,
      flume,
      flumeBottom,
      flumeRails,
      leftCompartment: leftHalf.compartment,
      leftFloor: leftHalf.floor,
      leftSideWalls: leftHalf.sideWalls,
      leftSpill,
      leftStop,
      leftWater,
      rightCompartment: rightHalf.compartment,
      rightFloor: rightHalf.floor,
      rightSideWalls: rightHalf.sideWalls,
      rightSpill,
      rightStop,
      rightWater,
      streamMarkers,
      supportPosts,
      trough,
      underBrace,
    },
    degreesOfFreedom: {
      compartmentFillsIndependent: false,
      dividerIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pivotTranslationIndependent: false,
      troughHalvesIndependent: false,
    },
    dynamics: {
      fluidImpactSplashViscosityFreeSurfaceSloshDryTroughInertiaBearingFrictionStopImpactAndThresholdInstabilityModeled:
        false,
      phaseSchedule:
        'The two constant-flow filling dwells and the two rapid quintic zero-velocity, zero-acceleration tipping strokes are an independently engineered explanatory schedule. The water load in the descending half is smoothly removed during each stroke; threshold and impact dynamics are not integrated.',
      waterSurfaceTreatment:
        'Each visible water load is counter-rotated inside the rigid trough so its free surface remains horizontal in world space while its center follows the rocking compartment.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rigid trough is divided transversely into two equal open-ended compartments and rocks about one fixed axis in the frame beneath it. At either travel stop the raised inner half lies under the continuous fall and fills. Its increasing off-center water load supplies torque toward that side; at the tipping threshold the loaded side descends, discharges through its outer end, and carries the opposite half beneath the same fixed stream. The opposite fill and tip repeats, so each half-cycle meters one equal compartment volume.',
    metering: {
      compartmentCapacity,
      equalVolumePerTip: compartmentCapacity,
      tipsPerCycle: 2,
      volumePerCycle: 2 * compartmentCapacity,
    },
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType: 'alternating-fill-tip-empty-tip-back',
      troughAngleMaximum: maximumTiltAngle,
      troughAngleMinimum: -maximumTiltAngle,
      troughNetRevolutionsPerCycle: 0,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 440 page supplies Brown’s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      leftFill: sourceState.leftFill,
      stopContact: sourceState.stopContact,
      rightFill: sourceState.rightFill,
      streamTargetSide: sourceState.streamTargetSide,
      troughAngle: sourceState.troughAngle,
    },
    sourceReference: {
      brownPlate440: {
        approximateCentralDividerPixels: [273, 264],
        approximateFrameBaseLeftPixels: [52, 500],
        approximateFrameBaseRightPixels: [405, 500],
        approximateIncomingStreamImpactPixels: [280, 244],
        approximateLeftDischargePixels: [17, 411],
        approximatePivotPixels: [209, 301],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one trough divided transversely into equal parts',
          'the divided trough is supported on an axis by a frame beneath',
          'falling water fills one side and vibrates the trough on its axis',
          'the filling side delivers its water while the opposite side is brought under the stream',
          'the alternating apparatus has been used as a water meter',
        ],
        engravingEvidence:
          'Brown’s engraving shows one long two-ended trough, a high transverse center division, one axle in a standard below it, a fixed elevated inlet flume, and water discharging from the lowered outer end.',
        reconstructionDisclosure:
          'Brown gives no dimensions, tilt limits, compartment capacity, flow rate, mass, center of gravity, tipping threshold, stop geometry, bearing friction, impact law, or timing. Those quantities, the symmetric stops, colors, free-surface rendering, flow tracers, and six-second cycle are independently engineered. The equal two-part rigid trough, single fixed axis, alternating fill-tip-discharge sequence, continuous fall, and equal-volume metering principle are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 440',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      fixedAxis:
        'The rigid trough transform is Rz(theta) about one fixed pivot; neither compartment has an independent pose.',
      gravityTorque:
        'tau_z=-g*(m_left*x_left+m_right*x_right), measured from the fixed pivot; a right-side load gives clockwise torque and a left-side load gives counterclockwise torque.',
      streamSelection:
        'The fixed stream is centered over the moving divider. Positive tilt shifts the divider top left of the stream so the right half receives it; negative tilt shifts the divider top right so the left half receives it.',
      symmetricStroke:
        'theta alternates between equal limits +14 degrees and -14 degrees, with exact zero speed and acceleration at both stops.',
    },
    troughAngleKinematicsAtPhase,
    update,
    waterStateAtPhase,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.10, groundY, -1.72),
    new THREE.Vector3(4.00, 4.12, 1.72),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(6.1, 7.2, 10.8);
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

export function createAuthoredTippingWaterMeterMovement(movement) {
  if (movement.id !== 440) return null;
  return tippingWaterMeter(movement);
}
