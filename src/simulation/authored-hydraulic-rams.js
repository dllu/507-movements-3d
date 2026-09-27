import * as THREE from 'three';
import {horizontalRing,horizontalPlate} from './horizontal-turbine-solids.js';
import {poly,circle,plate,polygonClipping} from './finite-plate-geometry.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {waterFountainGeometry, waterJetMaterial, waterVolumeMaterial} from './water-volume.js';
import {WaterStream, ballisticPath, guidedPath, joinPaths} from './water-stream.js';
import {latheSectionGeometry, sectionMeshInPlace} from './cutaway-section.js';

// Water in the back half of a sphere of radius R (section plane z = 0) up
// to a level y: curved wall, level surface and the flat cut face. Fixed
// vertex count, rewritten in place by setLevel.
function sectionedSphereWater(R, material, SEG = 32, PROFILE = 32) {
  const tris = SEG * PROFILE * 2 + SEG + 2 * PROFILE + 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris * 9), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tris * 9), 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  const P = geometry.attributes.position.array;
  const ring = [], cut = [];
  mesh.setLevel = (level) => {
    const y = THREE.MathUtils.clamp(level, -R + 1e-4, R - 1e-4);
    const stop = Math.acos(-y / R);
    let k = 0;
    const put = (a, b, c) => { for (const v of [a, b, c]) { P[k++] = v[0]; P[k++] = v[1]; P[k++] = v[2]; } };
    const at = (j, i) => {
      const t = stop * j / PROFILE, r = R * Math.sin(t), h = -R * Math.cos(t);
      const phi = Math.PI / 2 + Math.PI * i / SEG;
      return [r * Math.sin(phi), h, r * Math.cos(phi)];
    };
    for (let j = 0; j < PROFILE; j += 1) for (let i = 0; i < SEG; i += 1) {
      const a = at(j, i), b = at(j + 1, i), c = at(j + 1, i + 1), d = at(j, i + 1);
      put(a, c, b); put(a, d, c);
    }
    ring.length = 0;
    for (let i = 0; i <= SEG; i += 1) ring.push(at(PROFILE, i));
    const centre = [0, ring[0][1], 0];
    for (let i = 0; i < SEG; i += 1) put(centre, ring[i], ring[i + 1]);
    cut.length = 0;
    for (let j = 0; j <= PROFILE; j += 1) cut.push(at(j, 0));
    for (let j = PROFILE; j >= 0; j -= 1) cut.push(at(j, SEG));
    const middle = [0, (-R + y) / 2, 0];
    for (let q = 0; q < cut.length - 1; q += 1) put(middle, cut[q], cut[q + 1]);
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };
  mesh.setLevel(0);
  return mesh;
}

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

  // Brown draws the head vessel in section: its near wall is cut away so the
  // supply water shows. The whole ram stands in the open lower tank, also in
  // section (floor, end walls and back wall), whose water is drawn behind it.
  const lowerTank = new THREE.Group();
  lowerTank.userData.role = 'fixed-sectioned-lower-tank-holding-the-ram';
  root.add(lowerTank);
  const tankFloorTop = -1.62;
  const tankTop = -0.45;
  const tankWaterLevel = -0.66;
  const tankParts = [
    [[-3.45, 2.68], [tankFloorTop - 0.10, tankFloorTop], [-1.0, 0.9]],
    [[-3.45, -3.35], [tankFloorTop, tankTop], [-1.0, 0.9]],
    [[2.58, 2.68], [tankFloorTop, tankTop], [-1.0, 0.9]],
    [[-3.35, 2.58], [tankFloorTop, tankTop], [-1.0, -0.9]],
  ].map(([[x0, x1], [y0, y1], [z0, z1]]) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0),
      frameMaterial);
    part.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    part.userData.role = 'fixed-sectioned-lower-tank-wall';
    lowerTank.add(part);
    return part;
  });
  const tankWater = new THREE.Mesh(
    new THREE.BoxGeometry(5.93, tankWaterLevel - tankFloorTop, 0.46),
    waterMaterial,
  );
  tankWater.position.set(-0.385, (tankWaterLevel + tankFloorTop) / 2, -0.66);
  tankWater.userData.role = 'tail-water-standing-in-lower-tank-behind-the-ram';
  root.add(tankWater);

  const drivePathPoints = [
    new THREE.Vector3(-3.05, 1.08, 0),
    new THREE.Vector3(-3.05, -1.16, 0),
    new THREE.Vector3(-1.25, -1.35, 0),
    new THREE.Vector3(-0.37, -1.35, 0),
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

  // The waste efflux is drawn leaving past the lifted disk's rim, clear of
  // the valve stem, disk and seat ring it used to pass through.
  const wasteOutletPath = [
    new THREE.Vector3(2.05, -0.96, 0),
    new THREE.Vector3(2.22, -0.84, 0),
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
  // Its own material: fading the intermittent efflux must not fade the head
  // box and tank water that share the common water material.
  wasteWater.material = waterMaterial.clone();
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
  // The water column fills the riser to its mouth; the jet continues above.
  outputWater.geometry.dispose();
  outputWater.geometry = new THREE.CylinderGeometry(0.105, 0.105, 2.12, 22);
  outputWater.position.set(chamberCenter.x, 1.86, 0);
  outputWater.userData.role =
    'continuous-uniform-upward-efflux-from-air-cushion';
  root.add(outputWater);
  // Brown's jet: a solid column rising well above the nozzle that breaks into
  // a plume falling away on every side. One translucent water column and a
  // thin falling crown thinning into spray at its rim, not a bundle of
  // streamline tubes and droplets.
  const jetBaseY = 2.90, jetTopY = 4.05;
  const fountainTop = new THREE.Mesh(
    waterFountainGeometry({
      nozzleY: jetBaseY - 0.02, apexY: jetTopY, columnRadius: 0.1,
      crownRadius: 0.55, fallY: 2.75, crownThickness: 0.035, fadeStart: 0.78,
    }).translate(chamberCenter.x, 0, 0),
    waterJetMaterial({ color: 0x8bdae6, opacity: 0.5 }),
  );
  fountainTop.renderOrder = 2;
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
      lowerTank,
      tankParts,
      tankWater,
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
  // Pass 69 water review. The air vessel's water is a spherical segment of
  // the globe (it used to be a cylinder poking out through the globe), its
  // level set from the mass-balanced water volume; the neck, riser and drive
  // pipe run full; air is not drawn. The supply trough keeps the head box
  // topped up, and the tail water fills the sectioned tank round the ram.
  const liveWater = [];
  {
    const R = chamberRadius - 0.04;
    const vesselWater = sectionedSphereWater(R, waterVolumeMaterial({opacity: 0.42}));
    vesselWater.userData.role = 'water-in-globular-air-vessel-below-the-air';
    vesselWater.position.copy(chamberCenter);
    root.add(vesselWater);
    const sphereVolume = 4 / 3 * Math.PI * R ** 3;
    const setVesselLevel = (fraction) => {
      // Height h of the spherical segment holding `fraction` of the vessel.
      let h = 2 * R * fraction;
      for (let i = 0; i < 30; i += 1) {
        const f = Math.PI * h * h * (3 * R - h) / 3 - fraction * sphereVolume;
        h = THREE.MathUtils.clamp(h - f / (Math.PI * h * (2 * R - h)), 1e-4, 2 * R - 1e-4);
      }
      vesselWater.setLevel(-R + h);
    };
    // Brown draws the vessel in section: its back half, cut on the plane of
    // the drawing like the tank and head box.
    airChamberShell.geometry.dispose();
    const neckR = 0.30, riserR = 0.17, outer = chamberRadius, inner = chamberRadius - 0.04;
    const arcPoints = (r, from, to) => Array.from({length: 49}, (_, i) => {
      const y = from + (to - from) * i / 48;
      return [Math.sqrt(Math.max(0, r * r - y * y)), y];
    });
    const bottomOuter = -Math.sqrt(outer ** 2 - neckR ** 2), topOuter = Math.sqrt(outer ** 2 - riserR ** 2);
    const bottomInner = -Math.sqrt(inner ** 2 - neckR ** 2), topInner = Math.sqrt(inner ** 2 - riserR ** 2);
    const angle = (r, y) => Math.asin(y / r);
    const shellProfile = [
      ...Array.from({length: 65}, (_, i) => {
        const a = angle(outer, bottomOuter) + (angle(outer, topOuter) - angle(outer, bottomOuter)) * i / 64;
        return [outer * Math.cos(a), outer * Math.sin(a)];
      }),
      ...Array.from({length: 65}, (_, i) => {
        const a = angle(inner, topInner) + (angle(inner, bottomInner) - angle(inner, topInner)) * i / 64;
        return [inner * Math.cos(a), inner * Math.sin(a)];
      }),
    ];
    void arcPoints;
    airChamberShell.geometry = latheSectionGeometry(shellProfile, {segments: 64});
    airChamberShell.material = [frameMaterial, frameMaterial];
    airChamberShell.userData.role = 'globular-air-vessel-drawn-in-section';
    // Brown's ram body: the drive pipe runs into a closed box under the
    // vessel. Its top is pierced under the neck (delivery check) and under
    // the waste valve's seat, so the current really reaches both valves.
    const bodyX0 = -0.40, bodyX1 = 1.95, bodyY0 = -1.62, bodyY1 = -1.077, bodyZ = 0.37, t = 0.07;
    const topPlate = polygonClipping.difference(
      poly([[bodyX0, -bodyZ], [bodyX1, -bodyZ], [bodyX1, bodyZ], [bodyX0, bodyZ]]),
      poly(circle([chamberCenter.x, 0], 0.26, 96)), poly(circle([1.58, 0], 0.235, 96)));
    const leftWall = polygonClipping.difference(
      poly([[-bodyZ, bodyY0], [bodyZ, bodyY0], [bodyZ, bodyY1], [-bodyZ, bodyY1]]),
      poly(circle([0, -1.35], 0.14, 64)));
    const leftGeometry = plate(leftWall, bodyX0, bodyX0 + t);
    leftGeometry.rotateY(Math.PI / 2);
    const ramBody = new THREE.Mesh(mergePassageParts([
      horizontalPlate(topPlate, bodyY1 - t, bodyY1),
      horizontalPlate(poly([[bodyX0, -bodyZ], [bodyX1, -bodyZ], [bodyX1, bodyZ], [bodyX0, bodyZ]]), bodyY0, bodyY0 + t),
      new THREE.BoxGeometry(bodyX1 - bodyX0 - 2 * t, bodyY1 - bodyY0 - 2 * t, t).translate((bodyX0 + bodyX1) / 2, (bodyY0 + bodyY1) / 2, -bodyZ + t / 2),
      new THREE.BoxGeometry(bodyX1 - bodyX0 - 2 * t, bodyY1 - bodyY0 - 2 * t, t).translate((bodyX0 + bodyX1) / 2, (bodyY0 + bodyY1) / 2, bodyZ - t / 2),
      leftGeometry,
      new THREE.BoxGeometry(t, bodyY1 - bodyY0 - 2 * t, 2 * bodyZ).translate(bodyX1 - t / 2, (bodyY0 + bodyY1) / 2, 0),
    ]), darkMaterial);
    ramBody.userData.role = 'fixed-ram-body-box-under-delivery-and-waste-valves';
    root.add(ramBody);
    wasteBody.removeFromParent();
    wasteOutlet.removeFromParent();
    // The neck rises from the body's top to the vessel, drawn in section
    // like the vessel so the delivery check inside it shows.
    chamberNeck.geometry.dispose();
    chamberNeck.geometry = latheSectionGeometry([[.26, bodyY1], [.30, bodyY1], [.30, -0.44], [.26, -0.44]], {segments: 48});
    chamberNeck.position.set(chamberCenter.x, 0, 0);
    deliverySeat.geometry.dispose();
    deliverySeat.geometry = horizontalRing(.17, .258, -.06, 0);
    const neckWater = new THREE.Mesh(latheSectionGeometry([[0, bodyY1], [.255, bodyY1], [.255, -0.46], [0, -0.46]], {segments: 48}),
      waterVolumeMaterial({opacity: 0.4}));
    neckWater.position.set(chamberCenter.x, 0, 0);
    neckWater.userData.role = 'water-filling-neck-under-and-over-delivery-check';
    neckWater.renderOrder = 1;
    root.add(neckWater);
    // Pass 70: Brown's shapes. The head box's bottom runs down in a filleted
    // shoulder into the drive pipe, which falls straight, turns on one round
    // elbow and runs level into the ram body (it used to sag like a hose).
    // The neck stands on a flange and the waste seat on a raised collar.
    const pipeX = reservoir.position.x, pipeY = -1.35, elbowR = 0.45, shoulderTop = reservoir.position.y - 0.07, shoulderLow = shoulderTop - 0.30;
    const drivePath = new THREE.CurvePath();
    drivePath.add(new THREE.LineCurve3(new THREE.Vector3(pipeX, shoulderLow, 0), new THREE.Vector3(pipeX, pipeY + elbowR, 0)));
    class DriveElbow extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const a = Math.PI / 2 * t;
        return target.set(pipeX + elbowR - elbowR * Math.cos(a), pipeY + elbowR - elbowR * Math.sin(a), 0);
      }
    }
    drivePath.add(new DriveElbow());
    drivePath.add(new THREE.LineCurve3(new THREE.Vector3(pipeX + elbowR, pipeY, 0), new THREE.Vector3(bodyX0, pipeY, 0)));
    drivePipe.geometry.dispose();
    drivePipe.geometry = curvedPipeWall(drivePath, .14, .19, 160, 32);
    drivePipe.userData.curve = drivePath;
    const fillet = Array.from({length: 17}, (_, i) => {
      const a = Math.PI / 2 * i / 16;
      return [shoulderLow + 0.26 * Math.sin(a), 0.45 - 0.26 * Math.cos(a)];
    });
    const shoulder = new THREE.Mesh(latheSectionGeometry([[shoulderLow, .14], [shoulderTop, .14], [shoulderTop, .45],
      ...fillet.reverse()].map(([y, r]) => [r, y]), {segments: 64, phiStart: 0, phiLength: Math.PI * 2}), frameMaterial);
    shoulder.position.x = pipeX;
    shoulder.userData.role = 'fixed-filleted-shoulder-of-head-box-into-drive-pipe';
    root.add(shoulder);
    const neckFlange = new THREE.Mesh(latheSectionGeometry([[.30, bodyY1], [.44, bodyY1], [.44, bodyY1 + .07], [.30, bodyY1 + .07]], {segments: 64}), darkMaterial);
    neckFlange.position.x = chamberCenter.x;
    neckFlange.userData.role = 'fixed-flange-joining-neck-to-ram-body';
    root.add(neckFlange);
    const wasteCollar = new THREE.Mesh(latheSectionGeometry([[.34, bodyY1], [.50, bodyY1], [.34, bodyY1 + .10]], {segments: 64, phiStart: 0, phiLength: Math.PI * 2}), darkMaterial);
    wasteCollar.position.x = 1.58;
    wasteCollar.userData.role = 'fixed-raised-collar-round-waste-seat';
    root.add(wasteCollar);
    // Brown draws the ram body, drive pipe and riser in section too: cut
    // them on the drawing plane so the current inside them shows.
    // The head box and tank are cut on the same plane (their walls and water
    // used to run on in front of it with no front wall to hold the water).
    for (const mesh of [ramBody, drivePipe, shoulder, wasteCollar, wasteSeat, outputPipe, ...tankParts, reservoirBottom, ...reservoirWalls]) sectionMeshInPlace(mesh, root);
    const bodyWater = new THREE.Mesh(new THREE.BoxGeometry(bodyX1 - bodyX0 - 2 * t, bodyY1 - bodyY0 - 2 * t, bodyZ - t)
      .translate((bodyX0 + bodyX1) / 2, (bodyY0 + bodyY1) / 2, -(bodyZ - t) / 2), waterVolumeMaterial({opacity: 0.4}));
    bodyWater.userData.role = 'water-filling-ram-body';
    bodyWater.renderOrder = 1;
    root.add(bodyWater);
    root.userData.blocks.bodyWater = bodyWater;
    root.userData.blocks.shoulder = shoulder;
    root.userData.blocks.neckFlange = neckFlange;
    root.userData.blocks.wasteCollar = wasteCollar;
    const flow = {cyclePeriod: cycleDuration, streakRate: 1, opacity: 0.36, radialSegments: 16};
    const riserWater = new WaterStream(guidedPath([new THREE.Vector3(chamberCenter.x, -0.20, 0),
      new THREE.Vector3(chamberCenter.x, jetBaseY, 0)], {speed: 1, samples: 6}), {...flow, width: .12, thickness: .12});
    riserWater.userData.role = 'water-driven-up-riser-by-air-cushion';
    root.add(riserWater);
    const streamPath = new THREE.CurvePath();
    streamPath.add(new THREE.LineCurve3(new THREE.Vector3(pipeX, reservoir.position.y + 0.07, 0), new THREE.Vector3(pipeX, shoulderLow, 0)));
    for (const piece of drivePath.curves) streamPath.add(piece);
    const driveStream = new WaterStream(guidedPath(streamPath, {speed: 1, samples: 64}),
      {...flow, width: .135, thickness: .135});
    driveStream.userData.role = 'water-current-in-drive-pipe';
    // Cut on the drawing plane with the pipes that carry them.
    const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    for (const stream of [driveStream, riserWater]) stream.material.clippingPlanes = [sectionPlane];
    reservoirWater.material = reservoirWater.material.clone();
    reservoirWater.material.clippingPlanes = [sectionPlane];reservoirWater.material.side = THREE.DoubleSide;
    root.userData.localClippingEnabled = true;
    root.add(driveStream);
    // Head supply: Brown's trough pours into the head box from the left.
    const chute = new THREE.Group();
    chute.userData.role = 'fixed-supply-trough-pouring-into-head-box';
    const slope = Math.atan2(0.30, 0.95);
    // Pass 70: one U-section channel whose sides are cut back obliquely at
    // the mouth, as Brown draws the spout end, instead of three loose boxes.
    {
      const side = poly([[-0.5, -0.025], [0.5, -0.025], [0.5, 0.02], [0.36, 0.16], [-0.5, 0.16]]);
      const part = new THREE.Mesh(mergePassageParts([
        new THREE.BoxGeometry(1.0, 0.05, 0.36),
        plate(side, 0.18, 0.22), plate(side, -0.22, -0.18),
      ]), frameMaterial);
      part.userData.role = 'fixed-u-section-supply-trough';
      chute.add(part);
    }
    chute.rotation.z = -slope;
    chute.position.set(-3.86, 2.50, 0);
    root.add(chute);
    const lip = new THREE.Vector3(-3.86 + 0.5 * Math.cos(slope), 2.50 - 0.5 * Math.sin(slope) + .06, 0);
    const along = guidedPath([new THREE.Vector3(-3.86 - 0.5 * Math.cos(slope), 2.50 + 0.5 * Math.sin(slope) + .06, 0), lip], {speed: 0.9, samples: 8});
    const velocity = new THREE.Vector3(Math.cos(slope), -Math.sin(slope), 0).multiplyScalar(0.9);
    const surface = reservoir.position.y + reservoirWater.position.y + 0.32;
    const pour = ballisticPath({origin: lip, velocity, endY: surface - 0.05, samples: 16});
    const supply = new WaterStream(joinPaths(along, pour), {...flow, width: .16, thickness: .05,
      widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.2, foam: {start: 0.85, amount: 0.3}});
    supply.userData.role = 'supply-water-pouring-from-trough-into-head-box';
    root.add(supply);
    // Waste efflux: leaves under the lifted disk into the tail water, its
    // section following the valve opening.
    // It spills up past the lifted disk's rim and mixes into the tail water.
    const efflux = new WaterStream(guidedPath([new THREE.Vector3(1.90, -1.10, 0), new THREE.Vector3(1.98, -0.95, 0),
      new THREE.Vector3(2.10, -0.82, 0)], {speed: 1, samples: 12}),
      {...flow, opacity: 0.26, width: .08, thickness: .08, fadeOut: 0.6});
    efflux.userData.role = 'waste-efflux-into-tail-water-while-valve-open';
    root.add(efflux);
    wasteWater.removeFromParent();
    // Retired: the air cushion volume (air is not drawn), the cylinder that
    // stood in for the vessel water, and the old riser and drive columns.
    for (const retired of [compressedAir, outputWater, driveWater, chamberWater]) retired.removeFromParent();
    tankWater.geometry.dispose();
    // Pass 70: it is cut on the drawing plane like the tank, and stops at the
    // ram body and the sectioned neck, so it no longer tints their insides
    // (the neck's own water shows there alone).
    {
      const tankRect = poly([[-3.35, tankFloorTop], [2.58, tankFloorTop], [2.58, tankWaterLevel], [-3.35, tankWaterLevel]]);
      const around = polygonClipping.difference(tankRect,
        poly([[bodyX0, tankFloorTop - 1], [bodyX1, tankFloorTop - 1], [bodyX1, bodyY1], [bodyX0, bodyY1]]),
        poly([[chamberCenter.x - .30, bodyY1 - .01], [chamberCenter.x + .30, bodyY1 - .01], [chamberCenter.x + .30, tankWaterLevel + 1], [chamberCenter.x - .30, tankWaterLevel + 1]]));
      // Like the tank itself it is cut on the drawing plane (z = 0).
      tankWater.geometry = mergePassageParts([plate(tankRect, -0.9, -bodyZ), plate(around, -bodyZ, 0)]);
    }
    tankWater.position.set(0, 0, 0);
    tankWater.material = waterVolumeMaterial({opacity: 0.3});
    tankWater.renderOrder = 1;
    tankWater.userData.role = 'tail-water-filling-sectioned-lower-tank';
    liveWater.push(riserWater, driveStream, supply, efflux, vesselWater, neckWater, tankWater);
    // Streaks in the drive pipe advance with the drive current: surging while
    // the waste valve is open, checked when it shuts (seamless each cycle).
    const TRAVEL = 480, travel = new Float64Array(TRAVEL + 1);
    for (let i = 1; i <= TRAVEL; i += 1) travel[i] = travel[i - 1] + driveFlowSpeedAtPhase((i - 0.5) / TRAVEL);
    const driveTravel = (time) => {
      const cycles = Math.floor(time / cycleDuration), u = (time / cycleDuration - cycles) * TRAVEL;
      const i = Math.min(TRAVEL - 1, Math.floor(u));
      const f = travel[i] + (travel[i + 1] - travel[i]) * (u - i);
      return cycleDuration * (cycles + f / travel[TRAVEL]);
    };
    const base = update;
    const fill = (time) => {
      base(time);
      const state = stateAtTime(time);
      setVesselLevel(state.chamberWaterVolume / chamberTotalInternalVolume);
      riserWater.update(time);
      supply.update(time);
      driveStream.update(driveTravel(time));
      efflux.update(time);
      efflux.setFlow(Math.max(1e-3, state.wasteValveOpen));
      efflux.material.opacity = 0.26 * THREE.MathUtils.smoothstep(state.wasteValveOpen, 0, 0.2);
      efflux.visible = efflux.material.opacity > 0;
    };
    root.userData.update = fill;
    root.userData.blocks.vesselWater = vesselWater;
    root.userData.blocks.airChamberShell = airChamberShell;
    root.userData.blocks.ramBody = ramBody;
    root.userData.blocks.neckWater = neckWater;
    root.userData.blocks.riserWater = riserWater;
    root.userData.blocks.supply = supply;
    root.userData.blocks.efflux = efflux;
    root.userData.blocks.chute = chute;
  }
  const liveUpdate = root.userData.update;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.40, groundY, -1.92),
    new THREE.Vector3(4.08, 4.10, 1.92),
  );
  root.userData.cameraDistanceScale = 1.10;
  root.userData.cameraDirection = new THREE.Vector3(5.9, 4.5, 11.6);
  root.userData.groundFloorY = groundY;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite pipe bores and valve seats; valve timing, pressure, chamber contents and all water markers remain prescribed fluid illustrations. Pipe junction sealing and water-hammer dynamics are not validated.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds=cycleDuration;
  markShadows(root);
  base.receiveShadow = true;
  root.traverse(object => { if (object.material?.transparent) { object.castShadow = false; object.receiveShadow = false; } });
  liveUpdate(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update: liveUpdate,
  };
}

export function createAuthoredHydraulicRamMovement(movement) {
  if (movement.id !== 444) return null;
  return hydraulicRam(movement);
}
