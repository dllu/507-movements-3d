import * as THREE from 'three';
import {horizontalRing,horizontalPlate} from './horizontal-turbine-solids.js';
import {poly,circle,polygonClipping} from './finite-plate-geometry.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
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

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, radius, 12, false),
    material,
  );
  tube.userData.role = role;
  tube.userData.curve = curve;
  return tube;
}

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(
    clamped ** 3 * (clamped * (clamped * 6 - 15) + 10),
    0,
    1,
  );
}

function smoothStep5Integral(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 6 - 3 * clamped ** 5 + 2.5 * clamped ** 4;
}

function segmentValue(phase, startPhase, endPhase, startValue, endValue) {
  if (phase <= startPhase) return startValue;
  if (phase >= endPhase) return endValue;
  const progress = (phase - startPhase) / (endPhase - startPhase);
  return THREE.MathUtils.lerp(
    startValue,
    endValue,
    smoothStep5(progress),
  );
}

function symmetricQuinticBump(progressValue) {
  const progress = THREE.MathUtils.clamp(progressValue, 0, 1);
  if (progress <= 0.5) return smoothStep5(2 * progress);
  return smoothStep5(2 * (1 - progress));
}

function symmetricQuinticBumpIntegral(progressValue) {
  const progress = THREE.MathUtils.clamp(progressValue, 0, 1);
  if (progress <= 0.5) {
    return 0.5 * smoothStep5Integral(2 * progress);
  }
  return 0.5 - 0.5 * smoothStep5Integral(2 * (1 - progress));
}

function hydraulicRam(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4.8;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const wasteCloseStartPhase = 0.42;
  const wasteCloseEndPhase = 0.48;
  const deliveryStartPhase = 0.50;
  const deliveryPeakPhase = 0.64;
  const deliveryEndPhase = 0.78;
  const wasteReopenStartPhase = 0.82;
  const wasteReopenEndPhase = 0.90;
  const deliveryDurationPhase = deliveryEndPhase - deliveryStartPhase;
  const nominalOutputFlowRate = 0.015;
  const chamberSourceWaterVolume = 0.42;
  const chamberTotalInternalVolume = 1.20;
  const sourceAirPressure = 1.16;
  const sourceAirVolume = chamberTotalInternalVolume
    - chamberSourceWaterVolume;
  const wasteValveMaximumLift = 0.29;
  const deliveryValveMaximumLift = 0.20;
  const chamberCenter = new THREE.Vector3(0.10, 0.70, 0);
  const chamberRadius = 1.18;
  const chamberWaterBottomY = -0.37;
  const groundY = -2.02;

  const wasteValveOpenAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < wasteCloseStartPhase) return 1;
    if (phase < wasteCloseEndPhase) {
      return 1 - smoothStep5(
        (phase - wasteCloseStartPhase)
          / (wasteCloseEndPhase - wasteCloseStartPhase),
      );
    }
    if (phase < wasteReopenStartPhase) return 0;
    if (phase < wasteReopenEndPhase) {
      return smoothStep5(
        (phase - wasteReopenStartPhase)
          / (wasteReopenEndPhase - wasteReopenStartPhase),
      );
    }
    return 1;
  };

  const deliveryValveOpenAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase <= deliveryStartPhase || phase >= deliveryEndPhase) return 0;
    return symmetricQuinticBump(
      (phase - deliveryStartPhase) / deliveryDurationPhase,
    );
  };

  const chamberInletFlowAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase <= deliveryStartPhase || phase >= deliveryEndPhase) return 0;
    const progress = (phase - deliveryStartPhase)
      / deliveryDurationPhase;
    return 2 * nominalOutputFlowRate / deliveryDurationPhase
      * symmetricQuinticBump(progress);
  };

  const cumulativeInletIntegralOverPhase = (phaseValue) => {
    const phase = THREE.MathUtils.clamp(phaseValue, 0, 1);
    if (phase <= deliveryStartPhase) return 0;
    if (phase >= deliveryEndPhase) return nominalOutputFlowRate;
    const progress = (phase - deliveryStartPhase)
      / deliveryDurationPhase;
    return 2 * nominalOutputFlowRate
      * symmetricQuinticBumpIntegral(progress);
  };

  const chamberWaterVolumeAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    return chamberSourceWaterVolume + cycleDuration * (
      cumulativeInletIntegralOverPhase(phase)
      - nominalOutputFlowRate * phase
    );
  };

  const pressurePulseAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < wasteCloseStartPhase) return 0;
    if (phase < deliveryStartPhase) {
      return segmentValue(
        phase,
        wasteCloseStartPhase,
        deliveryStartPhase,
        0,
        1,
      );
    }
    if (phase < deliveryPeakPhase) {
      return segmentValue(
        phase,
        deliveryStartPhase,
        deliveryPeakPhase,
        1,
        0.70,
      );
    }
    if (phase < deliveryEndPhase) {
      return segmentValue(
        phase,
        deliveryPeakPhase,
        deliveryEndPhase,
        0.70,
        0.25,
      );
    }
    if (phase < wasteReopenStartPhase) {
      return segmentValue(
        phase,
        deliveryEndPhase,
        wasteReopenStartPhase,
        0.25,
        0,
      );
    }
    return 0;
  };

  const driveFlowSpeedAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < wasteCloseStartPhase) {
      return segmentValue(phase, 0, wasteCloseStartPhase, 0.25, 1);
    }
    if (phase < deliveryStartPhase) {
      return segmentValue(
        phase,
        wasteCloseStartPhase,
        deliveryStartPhase,
        1,
        0.48,
      );
    }
    if (phase < deliveryEndPhase) {
      return segmentValue(
        phase,
        deliveryStartPhase,
        deliveryEndPhase,
        0.48,
        0.18,
      );
    }
    if (phase < wasteReopenEndPhase) return 0.18;
    return segmentValue(
      phase,
      wasteReopenEndPhase,
      1,
      0.18,
      0.25,
    );
  };

  const modeAtPhase = (phase) => {
    if (phase < wasteCloseStartPhase) {
      return 'waste-valve-open-drive-flow-accelerating';
    }
    if (phase < wasteCloseEndPhase) {
      return 'waste-valve-closing-water-hammer-rising';
    }
    if (phase < deliveryStartPhase) {
      return 'both-valves-closed-pressure-peak';
    }
    if (phase < deliveryPeakPhase) {
      return 'delivery-check-opening-air-chamber-charging';
    }
    if (phase < deliveryEndPhase) {
      return 'delivery-check-closing-air-chamber-charging';
    }
    if (phase < wasteReopenStartPhase) {
      return 'both-valves-closed-equilibrium-restoring';
    }
    if (phase < wasteReopenEndPhase) {
      return 'weighted-waste-valve-reopening';
    }
    return 'waste-valve-open-reset-flow';
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
    const wasteValveOpen = wasteValveOpenAtPhase(phase);
    const deliveryValveOpen = deliveryValveOpenAtPhase(phase);
    const chamberInletFlowRate = chamberInletFlowAtPhase(phase);
    const chamberWaterVolume = chamberWaterVolumeAtPhase(phase);
    const chamberAirVolume = chamberTotalInternalVolume
      - chamberWaterVolume;
    const chamberAirPressure = sourceAirPressure * sourceAirVolume
      / chamberAirVolume;
    const chamberVolumeDerivativePerPhase = cycleDuration * (
      chamberInletFlowRate - nominalOutputFlowRate
    );
    const chamberWaterVolumeRate = chamberVolumeDerivativePerPhase
      * phaseSpeed;
    const chamberWaterHeight = 0.80
      + 4 * (chamberWaterVolume - chamberSourceWaterVolume);
    const driveFlowSpeed = driveFlowSpeedAtPhase(phase);
    return {
      chamberAirPressure,
      chamberAirVolume,
      chamberInletFlowRate,
      chamberVolumeDerivativePerPhase,
      chamberWaterHeight,
      chamberWaterVolume,
      chamberWaterVolumeRate,
      deliveryValveLift: deliveryValveMaximumLift * deliveryValveOpen,
      deliveryValveOpen,
      driveFlowSpeed,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      mode: modeAtPhase(phase),
      outputFlowRate: nominalOutputFlowRate,
      phase,
      phaseSpeed,
      pressurePulse: pressurePulseAtPhase(phase),
      wasteEffluxFlow: wasteValveOpen * driveFlowSpeed,
      wasteValveLift: wasteValveMaximumLift * wasteValveOpen,
      wasteValveOpen,
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
    metalness: 0.33,
    roughness: 0.44,
  });
  const valveMaterial = matte(PALETTE.driver, {
    metalness: 0.19,
    roughness: 0.45,
  });
  const chamberMaterial = matte(PALETTE.driven, {
    opacity: 0.25,
    roughness: 0.31,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.64,
    roughness: 0.26,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x8bdae6, {
    opacity: 0.70,
    roughness: 0.22,
    transparent: true,
  });
  const airMaterial = matte(PALETTE.accent, {
    opacity: 0.14,
    roughness: 0.55,
    transparent: true,
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.90, 0.23, 3.64),
    frameMaterial,
  );
  base.position.set(0, groundY + 0.115, 0);
  base.userData.role = 'fixed-hydraulic-ram-base';
  root.add(base);

  const reservoir = new THREE.Group();
  reservoir.position.set(-3.05, 1.15, 0);
  reservoir.userData.role = 'fixed-low-head-supply-reservoir';
  root.add(reservoir);
  const reservoirBottom = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.14, 1.52),
    frameMaterial,
  );
  reservoirBottom.geometry.dispose();reservoirBottom.geometry=horizontalPlate(polygonClipping.difference(poly([[-.74,-.76],[.74,-.76],[.74,.76],[-.74,.76]]),poly(circle([0,0],.15,128))),-.07,.07);
  reservoir.add(reservoirBottom);
  const reservoirWalls = [];
  for (const [x, z, width, depth] of [
    [-0.70, 0, 0.12, 1.52],
    [0.70, 0, 0.12, 1.52],
    [0, -0.70, 1.48, 0.12],
    [0, 0.70, 1.48, 0.12],
  ]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1.18, depth),
      frameMaterial,
    );
    wall.position.set(x, 0.52, z);
    reservoir.add(wall);
    reservoirWalls.push(wall);
  }
  const reservoirWater = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.64, 1.24),
    waterMaterial,
  );
  reservoirWater.position.y = 0.36;
  reservoirWater.userData.role = 'small-head-supply-water';
  reservoir.add(reservoirWater);

  const drivePathPoints = [
    new THREE.Vector3(-3.05, 1.08, 0),
    new THREE.Vector3(-3.05, -1.16, 0),
    new THREE.Vector3(-1.25, -1.35, 0),
    new THREE.Vector3(1.30, -1.35, 0),
  ];
  const drivePipe = makeTube(
    drivePathPoints,
    0.19,
    darkMaterial,
    'fixed-drive-pipe-from-small-head-reservoir',
  );
  drivePipe.geometry.dispose();drivePipe.geometry=curvedPipeWall(drivePipe.userData.curve,.14,.19,96);
  root.add(drivePipe);
  const driveWater = makeTube(
    drivePathPoints,
    0.125,
    waterMaterial,
    'water-current-accelerating-through-drive-pipe',
  );
  root.add(driveWater);

  const chamberNeckPath = [
    new THREE.Vector3(chamberCenter.x, -1.34, 0),
    new THREE.Vector3(chamberCenter.x, -0.68, 0),
    new THREE.Vector3(chamberCenter.x, -0.38, 0),
  ];
  const chamberNeck = makeTube(
    chamberNeckPath,
    0.18,
    darkMaterial,
    'delivery-branch-leading-through-check-valve-to-air-chamber',
  );
  chamberNeck.geometry.dispose();chamberNeck.geometry=curvedPipeWall(chamberNeck.userData.curve,.26,.30,48);
  root.add(chamberNeck);

  const airChamberShell = new THREE.Mesh(
    new THREE.SphereGeometry(chamberRadius, 48, 32),
    chamberMaterial,
  );
  airChamberShell.position.copy(chamberCenter);
  airChamberShell.userData.role =
    'globular-air-chamber-smoothing-intermittent-delivery';
  root.add(airChamberShell);
  const chamberWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.94, 0.94, 1, 40),
    waterMaterial,
  );
  chamberWater.userData.role = 'pulsed-water-volume-in-air-chamber';
  root.add(chamberWater);
  const compressedAir = new THREE.Mesh(
    new THREE.SphereGeometry(chamberRadius * 0.86, 40, 28),
    airMaterial,
  );
  compressedAir.position.copy(chamberCenter);
  compressedAir.userData.role =
    'elastic-compressed-air-cushion-maintaining-uniform-efflux';
  root.add(compressedAir);

  const deliveryValve = new THREE.Group();
  deliveryValve.position.set(chamberCenter.x, -0.70, 0);
  deliveryValve.userData.role =
    'left-delivery-check-valve-opening-only-after-waste-closure';
  root.add(deliveryValve);
  const deliverySeat = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.055, 10, 32),
    darkMaterial,
  );
  deliverySeat.geometry.dispose();deliverySeat.geometry=horizontalRing(.17,.30,-.06,0);
  deliverySeat.rotation.set(0,0,0);
  deliveryValve.add(deliverySeat);
  const deliveryDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.08, 28),
    valveMaterial,
  );
  deliveryDisk.userData.role = 'lifting-delivery-check-disk';
  deliveryValve.add(deliveryDisk);

  const wasteValve = new THREE.Group();
  wasteValve.position.set(1.58, -1.15, 0);
  wasteValve.userData.role =
    'right-weight-held-open-waste-impulse-valve';
  root.add(wasteValve);
  const wasteSection=polygonClipping.difference(polygonClipping.difference(poly(circle([0,0],.34)),poly(circle([0,0],.285))),poly([[-.4,-.16],[-.23,-.16],[-.23,.16],[-.4,.16]]));
  const wasteBody=new THREE.Mesh(mergePassageParts([horizontalRing(.285,.34,-1.57,-1.49),horizontalPlate(wasteSection,-1.49,-1.21),horizontalRing(.285,.34,-1.21,-1.15)]),darkMaterial);wasteBody.position.x=1.58;wasteBody.userData.role='ported-waste-valve-body';root.add(wasteBody);
  const wasteSeat = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.06, 10, 34),
    darkMaterial,
  );
  wasteSeat.geometry.dispose();wasteSeat.geometry=horizontalRing(.235,.34,0,.07);
  wasteSeat.rotation.set(0,0,0);
  wasteValve.add(wasteSeat);
  const wasteDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.27, 0.09, 30),
    valveMaterial,
  );
  wasteDisk.userData.role = 'weighted-waste-valve-disk';
  wasteValve.add(wasteDisk);
  const wasteStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.88, 16),
    darkMaterial,
  );
  wasteStem.position.y = 0.39;
  wasteValve.add(wasteStem);
  const wasteLever = new THREE.Group();
  wasteLever.position.set(1.58, -.12, 0);
  wasteLever.userData.role =
    'weight-or-spring-equivalent-reopening-waste-valve';
  root.add(wasteLever);
  const leverBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 0.10, 0.12),
    darkMaterial,
  );
  leverBar.geometry.dispose();leverBar.geometry=new THREE.CylinderGeometry(.055,.055,.28,24);leverBar.position.set(0,-.20,0);
  wasteLever.add(leverBar);
  const leverWeight = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 16),
    valveMaterial,
  );
  leverWeight.position.x = 0;
  leverWeight.userData.role = 'waste-valve-reopening-weight';
  wasteLever.add(leverWeight);

  const wasteOutletPath = [
    new THREE.Vector3(1.58, -1.12, 0),
    new THREE.Vector3(1.82, -0.82, 0),
    new THREE.Vector3(2.50, -0.82, 0),
  ];
  const wasteOutlet = makeTube(
    wasteOutletPath,
    0.17,
    darkMaterial,
    'right-hand-waste-water-outlet',
  );
  wasteOutlet.geometry.dispose();wasteOutlet.geometry=horizontalRing(.235,.36,-1.15,-1.08);wasteOutlet.position.x=1.58;
  root.add(wasteOutlet);
  const wasteWater = makeTube(
    wasteOutletPath,
    0.105,
    waterMaterial,
    'intermittent-waste-efflux-while-right-valve-open',
  );
  root.add(wasteWater);

  const outputPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 2.46, 28),
    darkMaterial,
  );
  outputPipe.geometry.dispose();outputPipe.geometry=horizontalRing(.125,.17,-.20,2.90);
  outputPipe.position.set(chamberCenter.x,0,0);
  outputPipe.userData.role = 'high-level-delivery-riser';
  root.add(outputPipe);
  const outputWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 2.84, 22),
    paleWaterMaterial,
  );
  outputWater.position.set(chamberCenter.x, 2.22, 0);
  outputWater.userData.role =
    'continuous-uniform-upward-efflux-from-air-cushion';
  root.add(outputWater);
  const fountainTop = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.07, 10, 48, Math.PI),
    paleWaterMaterial,
  );
  fountainTop.position.set(chamberCenter.x, 3.62, 0);
  fountainTop.rotation.z = Math.PI;
  fountainTop.userData.role = 'continuous-high-level-water-jet-crown';
  root.add(fountainTop);

  const driveMarkers = [];
  for (let index = 0; index < 11; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `drive-pipe-flow-marker-${index + 1}`;
    root.add(marker);
    driveMarkers.push(marker);
  }
  const chargeMarkers = [];
  for (let index = 0; index < 5; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `air-chamber-charge-marker-${index + 1}`;
    root.add(marker);
    chargeMarkers.push(marker);
  }
  const outputMarkers = [];
  for (let index = 0; index < 8; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `uniform-output-flow-marker-${index + 1}`;
    root.add(marker);
    outputMarkers.push(marker);
  }

  const update = (time) => {
    const state = stateAtTime(time);
    wasteDisk.position.y = -.045 - state.wasteValveLift;
    wasteStem.position.y = .345 - state.wasteValveLift;
    wasteLever.position.y = -.12 - state.wasteValveLift;
    deliveryDisk.position.y = .04 + state.deliveryValveLift;
    wasteWater.visible = state.wasteValveOpen > 0.01;
    wasteWater.material.opacity = 0.12 + 0.52 * state.wasteValveOpen;
    const waterHeight = state.chamberWaterHeight;
    chamberWater.position.set(
      chamberCenter.x,
      chamberWaterBottomY + waterHeight / 2,
      chamberCenter.z,
    );
    chamberWater.scale.y = waterHeight;
    compressedAir.scale.setScalar(
      Math.cbrt(state.chamberAirVolume / sourceAirVolume),
    );

    const drivePhase = THREE.MathUtils.euclideanModulo(
      time * (0.24 + 0.76 * state.driveFlowSpeed),
      1,
    );
    driveMarkers.forEach((marker, index) => {
      const progress = THREE.MathUtils.euclideanModulo(
        drivePhase + index / driveMarkers.length,
        1,
      );
      marker.position.copy(drivePipe.userData.curve.getPoint(progress));
      marker.position.z = 0.17;
      marker.scale.setScalar(Math.sqrt(Math.sin(Math.PI * progress)));
    });
    chargeMarkers.forEach((marker, index) => {
      const progress = THREE.MathUtils.euclideanModulo(
        time * 1.7 + index / chargeMarkers.length,
        1,
      );
      marker.position.copy(chamberNeck.userData.curve.getPoint(progress));
      marker.position.z = 0.18;
      marker.visible = state.deliveryValveOpen > 0.01;
      marker.scale.setScalar(
        state.deliveryValveOpen
          * Math.sqrt(Math.sin(Math.PI * progress)),
      );
    });
    outputMarkers.forEach((marker, index) => {
      const progress = THREE.MathUtils.euclideanModulo(
        time * 0.72 + index / outputMarkers.length,
        1,
      );
      marker.position.set(
        chamberCenter.x,
        1.16 + 2.50 * progress,
        0.16,
      );
      marker.scale.setScalar(Math.sqrt(Math.sin(Math.PI * progress)));
    });
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    chamberCenter: chamberCenter.clone(),
    chamberRadius,
    chamberSourceWaterVolume,
    chamberTotalInternalVolume,
    chamberWaterBottomY,
    cycleDuration,
    deliveryDurationPhase,
    deliveryEndPhase,
    deliveryPeakPhase,
    deliveryStartPhase,
    deliveryValveMaximumLift,
    groundY,
    inputAngularSpeed,
    nominalOutputFlowRate,
    sourceAirPressure,
    sourceAirVolume,
    wasteCloseEndPhase,
    wasteCloseStartPhase,
    wasteReopenEndPhase,
    wasteReopenStartPhase,
    wasteValveMaximumLift,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: cycleDuration,
    },
    archetype:
      'montgolfier-hydraulic-ram-with-weighted-waste-valve-delivery-check-valve-air-chamber-and-steady-high-level-efflux',
    blocks: {
      wasteBody,
      airChamberShell,
      base,
      chamberNeck,
      chamberWater,
      chargeMarkers,
      compressedAir,
      deliveryDisk,
      deliverySeat,
      deliveryValve,
      driveMarkers,
      drivePipe,
      driveWater,
      fountainTop,
      leverBar,
      leverWeight,
      outputMarkers,
      outputPipe,
      outputWater,
      reservoir,
      reservoirBottom,
      reservoirWalls,
      reservoirWater,
      wasteDisk,
      wasteLever,
      wasteOutlet,
      wasteSeat,
      wasteStem,
      wasteValve,
      wasteWater,
    },
    chamberInletFlowAtPhase,
    chamberWaterVolumeAtPhase,
    degreesOfFreedom: {
      airPressureIndependent: false,
      deliveryValveIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      outputFlowIndependent: false,
      wasteValveIndependent: false,
    },
    deliveryValveOpenAtPhase,
    dynamics: {
      airCompressionModel:
        'The chamber uses an isothermal p*V constant relation. Its pulsed inlet integrates exactly to the constant outlet volume over each cycle, so chamber water volume and air pressure close without drift.',
      flowSchedule:
        'The demonstration prescribes a quintic weighted-waste closure, a no-overlap pressure dwell, a compact C2 delivery-check pulse, an equilibrium dwell, and a quintic waste reopening. Water-hammer wave propagation is represented by a pressure envelope rather than solved.',
      fullUnsteadyPipeFlowValveImpactSpringDynamicsAirHeatTransferCavitationLeakageFrictionAndStructuralElasticityModeled:
        false,
      uniformEfflux:
        'Output flow is constant through the entire stroke; the air-chamber water inventory supplies it between intermittent delivery pulses.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The small-head reservoir feeds the drive pipe toward the right-hand weighted waste valve. With that valve open, water escapes and accelerates. Flow pressure then overcomes the weight and closes the waste valve; only after closure does the left delivery check lift, admitting a pulse into the globular air chamber. As pressure equilibrates the delivery check shuts before the weighted waste valve reopens. The trapped air compresses during each pulse and expands between pulses, maintaining a continuous high-level outlet while the two lower valves alternate without an open overlap.',
    metering: {
      deliveredVolumePerStroke: nominalOutputFlowRate * cycleDuration,
      nominalOutputFlowRate,
      strokesPerCycle: 1,
    },
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'waste-close-delivery-open-delivery-close-waste-reopen-hydraulic-cycle',
    },
    pressurePulseAtPhase,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 444 page supplies Brown’s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      chamberAirPressure: sourceState.chamberAirPressure,
      chamberWaterVolume: sourceState.chamberWaterVolume,
      deliveryValveOpen: sourceState.deliveryValveOpen,
      outputFlowRate: sourceState.outputFlowRate,
      wasteValveOpen: sourceState.wasteValveOpen,
    },
    sourceReference: {
      brownPlate444: {
        approximateAirChamberCenterPixels: [317, 228],
        approximateDeliveryValvePixels: [283, 397],
        approximateReservoirCenterPixels: [84, 159],
        approximateWasteValvePixels: [394, 391],
        approximateWaterJetTopPixels: [316, 10],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 20,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a small fall of water provides a high-level jet or supply',
          'the right-hand valve is normally held open by a weight or spring',
          'flow escapes through that valve until pressure closes it',
          'current momentum then opens the other valve and throws water into a globular air chamber',
          'on equilibrium the right valve opens and the left valve shuts',
          'alternate valve action admits water on every stroke',
          'air elasticity gives uniformity to the efflux',
        ],
        engravingEvidence:
          'Brown’s engraving shows a left elevated supply reservoir feeding a bottom drive pipe, a small left delivery valve beneath a large globular air chamber, a weighted right waste valve, and a continuous vertical jet from the chamber.',
        reconstructionDisclosure:
          'Brown gives no dimensions, head, pipe area or length, valve lifts, weights, spring rate, flow rate, pressure, air volume, chamber volume, loss coefficients, wave speed, output height, or timing. Those values, compact quintic phase schedule, isothermal air relation, mass-balanced inlet pulse, frame, colors, and 4.8-second cycle are independently engineered. The two-valve order, weighted normally open waste valve, momentum-opened delivery check, globular air chamber, intermittent charging, and air-smoothed high-level efflux are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 444',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      airCushion:
        'p_air*V_air=p_source*V_source with V_air=V_chamber_total-V_water.',
      massBalance:
        'dV_water/dt=Q_delivery-Q_output at nominal cycle speed, and the compact delivery pulse integrates to Q_output*cycleDuration exactly.',
      valveInterlock:
        'deliveryValveOpen is nonzero only from phase 0.50 to 0.78, while wasteValveOpen is exactly zero from phase 0.48 to 0.82.',
    },
    update,
    wasteValveOpenAtPhase,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.08, groundY, -1.92),
    new THREE.Vector3(4.08, 4.10, 1.92),
  );
  root.userData.cameraDistanceScale = 1.10;
  root.userData.cameraDirection = new THREE.Vector3(5.9, 4.5, 11.6);
  root.userData.groundFloorY = groundY;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite pipe bores and valve seats; valve timing, pressure, chamber contents and all water markers remain prescribed fluid illustrations. Pipe junction sealing and water-hammer dynamics are not validated.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredHydraulicRamMovement(movement) {
  if (movement.id !== 444) return null;
  return hydraulicRam(movement);
}
