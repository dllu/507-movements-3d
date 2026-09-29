import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {cutFaceMaterial, latheSectionGeometry} from './cutaway-section.js';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {makeCurveTubeBuffer} from './curve-tube-buffer.js';
import {circle, plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';
import {waterVolumeMaterial} from './water-volume.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

// Movement 466, rebuilt in pass 73 on Brown's plate. Every dimension below
// is measured on the 525-pixel engraving (px, py) and mapped uniformly:
// x=(px-262)/72, y=(280-py)/72. Brown sections the ram cylinder, the hollow
// ram, the pump barrel with its suction pipe and rose, the valve chest and
// the cistern on the mid-plane; the lathe parts keep their back halves
// (z<=0) with plain cut faces. The press frame, bowl, platen, bales, plunger,
// crosshead, hand lever, swing link and the weighted valve are whole.

const FULL_TURN = Math.PI * 2;
const S = 1 / 72;
const X = (px) => (px - 262) * S;
const Y = (py) => (280 - py) * S;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

// Plate profile [r px, py] to lathe profile [r, y].
const lathe = (profile) => profile.map(([r, py]) => [r * S, Y(py)]);
// Quarter arc from angle a0 to a1 (radians, 0 = +r) about (cr, cpy) in px.
const arc = (cr, cpy, radius, a0, a1, count = 12) => Array.from({length: count + 1}, (_, i) => {
  const a = a0 + (a1 - a0) * i / count;
  return [cr + radius * Math.cos(a), cpy - radius * Math.sin(a)];
});
const rect = (x0, y0, x1, y1) => poly([[X(x0), Y(y1)], [X(x1), Y(y1)], [X(x1), Y(y0)], [X(x0), Y(y0)]]);

// Back-half lathe split into horizontal bands; a band may leave a port open
// towards +x (side 1) or -x (side -1) by trimming its sweep by `delta`.
// Pass 109: 160 segments per turn (80 over the half), so the large flanged
// ram casting reads round in rear and oblique views (32 steps faceted).
function sectionedLathe(profile, material, cutMaterial, bands = []) {
  const group = new THREE.Group();
  const polygon = poly(lathe(profile));
  let cuts = [-1e3, ...bands.flatMap(({low, high}) => [low, high]), 1e3];
  for (let i = 0; i + 1 < cuts.length; i += 1) {
    const [y0, y1] = [cuts[i], cuts[i + 1]].sort((a, b) => a - b);
    const band = bands.find(({low, high}) => Math.abs(Math.min(low, high) - y0) < 1e-9 && Math.abs(Math.max(low, high) - y1) < 1e-9);
    const strip = poly([[0, y0], [10, y0], [10, y1], [0, y1]]);
    for (const piece of clip.intersection(polygon, strip)) {
      const ring = piece[0].slice(0, -1);
      if (ring.length < 3) continue;
      const options = band
        ? band.side > 0
          ? {phiStart: Math.PI / 2 + band.delta, phiLength: Math.PI - band.delta, segments: 160}
          : {phiStart: Math.PI / 2, phiLength: Math.PI - band.delta, segments: 160}
        : {segments: 160};
      const mesh = new THREE.Mesh(latheSectionGeometry(ring, options), [material, cutMaterial]);
      group.add(mesh);
    }
  }
  return group;
}

// Water whose section changes with a moving part: the lathe is rebuilt from
// a profile with a fixed point count and copied into the same buffers.
function dynamicLatheWater(profileAt, material, role) {
  const options = {segments: 48};
  const geometry = latheSectionGeometry(profileAt(0), options);
  const mesh = addRole(new THREE.Mesh(geometry, material), role);
  mesh.userData.setValue = (value) => {
    const next = latheSectionGeometry(profileAt(value), options);
    for (const name of ['position', 'normal']) {
      geometry.attributes[name].array.set(next.attributes[name].array);
      geometry.attributes[name].needsUpdate = true;
    }
    geometry.index.array.set(next.index.array);
    geometry.index.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    next.dispose();
  };
  return mesh;
}

function hydrostaticPress(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12.5;
  const operationEndPhase = 0.76;
  const reliefStartPhase = 0.84;
  const pumpCycleCount = 12;
  const maximumStrokeAngle = pumpCycleCount * FULL_TURN;
  // Pump (plate): barrel axis px 366; the plunger's crosshead pin R at
  // (366, 155); the lever's fulcrum E at (315, 142.5) rides on a swing link
  // whose foot is pinned in the T lug at (324.5, 265.5) on the valve chest.
  const pumpSliderX = X(366);
  const crossheadPin = new THREE.Vector2(pumpSliderX, Y(155));
  const leverFulcrum = new THREE.Vector2(X(315), Y(142.5));
  const swingLinkFoot = new THREE.Vector2(X(324.5), Y(265.5));
  const pumpLeverPinRadius = crossheadPin.distanceTo(leverFulcrum);
  const pumpLeverRestAngle = Math.atan2(crossheadPin.y - leverFulcrum.y, crossheadPin.x - leverFulcrum.x);
  const swingLinkLength = leverFulcrum.distanceTo(swingLinkFoot);
  const pumpLeverAmplitude = THREE.MathUtils.degToRad(12);
  const handleLength = Math.hypot(502 - 315, 195 - 142.5) * S;
  const pumpPlungerRadius = 6 * S;
  // Plunger tip below the crosshead pin (Brown: tip at py 330 mid-stroke).
  const pumpPistonRodOffset = (330 - 155) * S;
  const ramRadius = 24 * S;
  const diameterRatio = ramRadius / pumpPlungerRadius;
  const pumpPlungerArea = Math.PI * pumpPlungerRadius ** 2;
  const ramArea = Math.PI * ramRadius ** 2;
  const areaRatio = ramArea / pumpPlungerArea;
  const nominalInputForce = 120;
  const idealRamForce = nominalInputForce * areaRatio;
  const idealHydraulicPressure = nominalInputForce / pumpPlungerArea;
  const ramAxisX = X(138.75);
  const ramCylinderBottomY = Y(482);
  const ramCylinderTopY = Y(292);
  const ramCylinderHeight = ramCylinderTopY - ramCylinderBottomY;
  const initialPlatenY = Y(244);
  const fixedHeadUndersideY = Y(152);
  // The bales stand on the platen, on each other and against the head plate.
  const initialLoadHeight = fixedHeadUndersideY - initialPlatenY;
  const pumpCylinderBottomY = Y(352);
  const pumpCylinderTopY = Y(227);
  const groundY = Y(502);
  const brownExamplePumpDiameter = 1;
  const brownExampleRamDiameter = 30;
  const brownExampleForceRatio = (
    brownExampleRamDiameter / brownExamplePumpDiameter
  ) ** 2;

  // Lever angle theta = rest - A sin(stroke): stroke 0 is Brown's pose, the
  // lever on its plate slope at mid-stroke going down (delivery), so the rest,
  // hold and let-down poses all show the plate. The rod pin R stays on the
  // barrel axis; the fulcrum E = R - L1 (cos, sin) theta lies on the swing
  // link's circle about its foot P, so E.y = P.y + sqrt(Ls^2 - dx^2).
  const pumpKinematics = (
    strokeAngle,
    strokeAngularVelocity = 0,
    strokeAngularAcceleration = 0,
  ) => {
    const leverAngle = pumpLeverRestAngle - pumpLeverAmplitude * Math.sin(strokeAngle);
    const leverAngularVelocity = -pumpLeverAmplitude
      * Math.cos(strokeAngle) * strokeAngularVelocity;
    const leverAngularAcceleration = pumpLeverAmplitude * (
      Math.sin(strokeAngle) * strokeAngularVelocity ** 2
      - Math.cos(strokeAngle) * strokeAngularAcceleration
    );
    const L1 = pumpLeverPinRadius, w = leverAngularVelocity, alpha = leverAngularAcceleration;
    const cosine = Math.cos(leverAngle), sine = Math.sin(leverAngle);
    const dx = pumpSliderX - L1 * cosine - swingLinkFoot.x;
    const dx1 = L1 * sine * w;
    const dx2 = L1 * (cosine * w ** 2 + sine * alpha);
    const h = Math.sqrt(swingLinkLength ** 2 - dx ** 2);
    const h1 = -dx * dx1 / h;
    const h2 = -(dx1 ** 2 + dx * dx2) / h - (dx * dx1) ** 2 / h ** 3;
    const fulcrum = new THREE.Vector3(swingLinkFoot.x + dx, swingLinkFoot.y + h, 0);
    const crosshead = new THREE.Vector3(pumpSliderX, fulcrum.y + L1 * sine, 0);
    const pistonVelocity = h1 + L1 * cosine * w;
    const pistonAcceleration = h2 + L1 * (-sine * w ** 2 + cosine * alpha);
    const piston = new THREE.Vector3(pumpSliderX, crosshead.y - pumpPistonRodOffset, 0);
    return {
      crosshead,
      fulcrum,
      leverAngle,
      leverAngularAcceleration,
      leverAngularVelocity,
      leverPin: crosshead.clone(),
      piston,
      pistonAcceleration,
      pistonVelocity,
      strokeAngle,
      strokeAngularAcceleration,
      strokeAngularVelocity,
      swingLinkAngle: Math.atan2(h, dx),
    };
  };

  // Top of stroke at 3pi/2, bottom at pi/2; stroke 0 is mid-downstroke.
  const topPumpState = pumpKinematics(1.5 * Math.PI);
  const bottomPumpState = pumpKinematics(0.5 * Math.PI);
  const restPumpState = pumpKinematics(0);
  const pumpStrokeLength = topPumpState.piston.y
    - bottomPumpState.piston.y;
  const maximumDeliveredVolume = pumpCycleCount
    * pumpPlungerArea * pumpStrokeLength;
  const maximumRamLift = maximumDeliveredVolume / ramArea;
  const nominalPistonSpeed = pumpStrokeLength * 4.2;
  // Downward travel counted from the top of the first stroke (angle -pi/2),
  // less the half stroke already made at Brown's rest pose.
  const restDelivery = topPumpState.piston.y - restPumpState.piston.y;

  const deliveredLengthAtStrokeAngle = (unclampedStrokeAngle, pump) => {
    const strokeAngle = THREE.MathUtils.clamp(
      unclampedStrokeAngle,
      0,
      maximumStrokeAngle,
    );
    if (Math.abs(strokeAngle - maximumStrokeAngle) < 1e-10) {
      return pumpCycleCount * pumpStrokeLength;
    }
    const fromTop = strokeAngle + 0.5 * Math.PI;
    const completedCycles = Math.floor(fromTop / FULL_TURN);
    const withinCycle = positiveModulo(fromTop, FULL_TURN);
    const currentDelivery = withinCycle <= Math.PI
      ? topPumpState.piston.y - pump.piston.y
      : pumpStrokeLength;
    return completedCycles * pumpStrokeLength + currentDelivery - restDelivery;
  };

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, operationEndPhase, reliefStartPhase].find(
      (boundary) => Math.abs(rawPhase - boundary) < 1e-12,
    ) ?? rawPhase;
    let strokeAngle = maximumStrokeAngle;
    let strokeAngularVelocity = 0;
    let strokeAngularAcceleration = 0;
    let reliefProgress = 0;
    let reliefProgressRate = 0;
    let regime;
    if (phase < operationEndPhase) {
      const local = phase / operationEndPhase;
      const timeScale = operationEndPhase * cycleDuration;
      strokeAngle = maximumStrokeAngle * smootherStep(local);
      strokeAngularVelocity = maximumStrokeAngle
        * smootherStepDerivative(local) / timeScale;
      strokeAngularAcceleration = maximumStrokeAngle
        * smootherStepSecondDerivative(local) / timeScale ** 2;
      regime = 'physical-hand-pumping-and-stepwise-ram-rise';
    } else if (phase < reliefStartPhase) {
      regime = 'press-held-at-full-lift-with-all-pump-checks-seated';
    } else {
      const local = (phase - reliefStartPhase) / (1 - reliefStartPhase);
      const timeScale = (1 - reliefStartPhase) * cycleDuration;
      reliefProgress = smootherStep(local);
      reliefProgressRate = smootherStepDerivative(local) / timeScale;
      regime = 'modeled-relief-valve-return-lowers-ram-to-reservoir';
    }
    const pump = pumpKinematics(
      strokeAngle,
      strokeAngularVelocity,
      strokeAngularAcceleration,
    );
    const deliveredLength = deliveredLengthAtStrokeAngle(strokeAngle, pump);
    const cumulativeDeliveredVolume = pumpPlungerArea * deliveredLength;
    const retainedPressVolume = phase < reliefStartPhase
      ? cumulativeDeliveredVolume
      : maximumDeliveredVolume * (1 - reliefProgress);
    const ramLift = retainedPressVolume / ramArea;
    const deliveryFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, -pump.pistonVelocity)
      : 0;
    const suctionFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, pump.pistonVelocity)
      : 0;
    const reliefReturnFlowRate = phase >= reliefStartPhase
      ? maximumDeliveredVolume * reliefProgressRate
      : 0;
    const ramVelocity = phase < operationEndPhase
      ? deliveryFlowRate / ramArea
      : -reliefReturnFlowRate / ramArea;
    const inletOpenAmount = smootherStep(
      Math.max(0, pump.pistonVelocity) / nominalPistonSpeed,
    );
    const deliveryOpenAmount = smootherStep(
      Math.max(0, -pump.pistonVelocity) / nominalPistonSpeed,
    );
    return {
      ...pump,
      cumulativeDeliveredVolume,
      deliveredLength,
      deliveryFlowRate,
      deliveryOpenAmount,
      idealHydraulicPressure,
      idealRamForce,
      inletOpenAmount,
      loadCompression: ramLift,
      phase,
      ramLift,
      ramVelocity,
      regime,
      reliefOpenAmount: reliefProgress,
      reliefProgress,
      reliefProgressRate,
      reliefReturnFlowRate,
      reservoirVolumeChange: -retainedPressVolume,
      retainedPressVolume,
      suctionFlowRate,
      volumeDisplacementResidual:
        retainedPressVolume - ramArea * ramLift,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const ironMaterial = matte(PALETTE.frame, {metalness: 0.18, roughness: 0.64});
  const ironCut = cutFaceMaterial(ironMaterial);
  const darkMaterial = matte(PALETTE.ink, {metalness: 0.25, roughness: 0.48});
  const cordMaterial = matte(PALETTE.rope, {roughness: 0.78});
  const pumpMaterial = matte(PALETTE.driver, {metalness: 0.13, roughness: 0.55});
  const pumpCut = cutFaceMaterial(pumpMaterial);
  const ramMaterial = matte(PALETTE.driven, {metalness: 0.14, roughness: 0.53});
  const ramCut = cutFaceMaterial(ramMaterial);
  const brassMaterial = matte(PALETTE.brass, {metalness: 0.20, roughness: 0.46});
  const loadMaterial = matte(PALETTE.accent, {roughness: 0.80});
  const waterMaterial = waterVolumeMaterial({opacity: 0.34});
  const boxFaces = [ironMaterial, ironMaterial, ironMaterial, ironMaterial, ironCut, ironMaterial];
  const box = (x0, py0, x1, py1, z0, z1, material = ironMaterial) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(X(x1) - X(x0), Y(py0) - Y(py1), z1 - z0), material);
    mesh.position.set((X(x0) + X(x1)) / 2, (Y(py0) + Y(py1)) / 2, (z0 + z1) / 2);
    return mesh;
  };
  const zPin = (radius, z0, z1, material = darkMaterial) => new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, z1 - z0, 32).rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2), material);
  const pinRadius = 3.4 * S, boreRadius = 3.7 * S;

  // --- Press frame: domed head with its follower plate, two columns. ---
  const pressFrame = addRole(new THREE.Group(), 'fixed-two-column-frame-reacting-large-ram-force');
  root.add(pressFrame);
  const fixedHead = addRole(box(32, 97, 243, 137, -0.62, 0.62), 'fixed-upper-press-head');
  pressFrame.add(fixedHead);
  const dome = addRole(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 16, 0, FULL_TURN, 0, Math.PI / 2), ironMaterial), 'fixed-domed-crown-of-press-head');
  dome.scale.set(87.5 * S, 40 * S, 0.60);
  dome.position.set(ramAxisX, Y(97), 0);
  pressFrame.add(dome);
  const headPlate = addRole(box(72, 137, 206, 152, -0.56, 0.56), 'fixed-follower-plate-under-press-head');
  pressFrame.add(headPlate);
  const columns = [59.75, 217.75].map((px) => {
    const column = addRole(new THREE.Mesh(new THREE.CylinderGeometry(6 * S, 6 * S, Y(137) - Y(312), 32), ironMaterial), 'fixed-press-column');
    column.position.set(X(px), (Y(137) + Y(312)) / 2, 0);
    pressFrame.add(column);
    return column;
  });

  // --- Ram cylinder: thick, deep, flanged casting, sectioned. The pressure
  // pipe enters its side at py 394 through a port in the wall. ---
  const ramCylinderProfile = [
    // p93: the two round fillets take 24 steps (3.75 degrees) instead of 6,
    // so they read as arcs, not 15-degree bands.
    // p109: Brown's flange underside is one straight chamfer from the wall
    // to the flange's lower corner (the old 3-facet polyline shaded as
    // 20-degree facets round the casting).
    [0, 502], [43, 502], ...arc(43, 494, 8, -Math.PI / 2, 0, 24).slice(1), [51, 385],
    [112, 350], [112, 312], [63, 312], [63, 292], [25, 292],
    [25, 335], [32.5, 335], [32.5, 474], ...arc(24.5, 474, 8, 0, -Math.PI / 2, 24).slice(1), [0, 482],
  ];
  const ramCylinder = addRole(sectionedLathe(ramCylinderProfile, ironMaterial, ironCut,
    [{low: Y(399), high: Y(389), side: 1, delta: Math.asin(5 / 32.5)}]), 'large-water-filled-ram-cylinder');
  ramCylinder.position.x = ramAxisX;
  for (const part of ramCylinder.children) part.userData.role = 'sectioned-ram-cylinder-casting';
  root.add(ramCylinder);

  // --- Ram assembly: hollow ram (sectioned), fluted bowl, platen. ---
  const ramAssembly = addRole(new THREE.Group(), 'large-solid-ram-and-moving-lower-platen');
  root.add(ramAssembly);
  const ramProfile = [
    [11.25, 287], [24, 287], [24, 451], ...arc(0, 451, 24, 0, -Math.PI / 2, 48).slice(1),
    [0, 460], ...arc(0, 449, 11, -Math.PI / 2, 0, 30).slice(1), [11.25, 449],
  ];
  const ramBody = addRole(new THREE.Mesh(latheSectionGeometry(lathe(ramProfile), {segments: 160}), [ramMaterial, ramCut]), 'large-solid-ram-body');
  ramBody.position.x = ramAxisX;
  ramAssembly.add(ramBody);
  const bowl = addRole(new THREE.Mesh(new THREE.LatheGeometry(
    lathe([[0, 286.7], [24, 286.7], [38, 281], [50, 272], [55, 262], [55, 256.3], [0, 256.3]]).map(([r, y]) => new THREE.Vector2(r, y)), 128), ramMaterial), 'large-solid-ram-piston');
  bowl.position.x = ramAxisX;
  ramAssembly.add(bowl);
  const movingPlaten = addRole(box(70.75, 244, 206.75, 256, -0.55, 0.55, ramMaterial), 'moving-lower-press-platen');
  ramAssembly.add(movingPlaten);

  // --- Four bales between the platen and the head plate. ---
  const compressibleLoad = addRole(new THREE.Group(), 'load-compressed-between-moving-platen-and-fixed-head');
  root.add(compressibleLoad);
  const baleWidth = (195 - 83) * S / 2, baleHeight = initialLoadHeight / 2;
  for (const i of [0, 1]) for (const j of [0, 1]) {
    const bale = new THREE.Mesh(new RoundedBoxGeometry(baleWidth, baleHeight, 0.9, 4, 0.09), loadMaterial);
    bale.position.set(X(83) + baleWidth * (i + 0.5) - ramAxisX, -baleHeight * (j + 0.5), 0);
    bale.userData.role = 'cotton-bale-under-compression';
    compressibleLoad.add(bale);
  }

  // --- Pressure pipe: from the cylinder port along py 394, up the riser at
  // px 289 into the valve chest. ---
  const pipePath = new THREE.CurvePath();
  const pipeStart = new THREE.Vector3(ramAxisX + 51 * S, Y(394), 0);
  const elbowCorner = new THREE.Vector3(X(289), Y(394), 0);
  pipePath.add(new THREE.LineCurve3(pipeStart, elbowCorner.clone().add(new THREE.Vector3(-14 * S, 0, 0))));
  pipePath.add(new THREE.QuadraticBezierCurve3(elbowCorner.clone().add(new THREE.Vector3(-14 * S, 0, 0)), elbowCorner, elbowCorner.clone().add(new THREE.Vector3(0, 14 * S, 0))));
  pipePath.add(new THREE.LineCurve3(elbowCorner.clone().add(new THREE.Vector3(0, 14 * S, 0)), new THREE.Vector3(X(289), Y(320), 0)));
  const pressurePipe = addRole(new THREE.Mesh(curvedPipeWall(pipePath, 5 * S, 9 * S, 128, 24), ironMaterial), 'small-pressure-pipe-from-pump-to-large-ram-cylinder');
  root.add(pressurePipe);
  const pressureWaterPath = new THREE.CurvePath();
  pressureWaterPath.add(new THREE.LineCurve3(new THREE.Vector3(ramAxisX + 32.5 * S, Y(394), 0), pipeStart));
  for (const curve of pipePath.curves) pressureWaterPath.add(curve);
  const pressureWater = addRole(new THREE.Mesh(new THREE.TubeGeometry(pressureWaterPath, 160, 4.8 * S, 16, false), waterMaterial), 'pressurized-water-column-linking-small-and-large-cylinders');
  root.add(pressureWater);

  // --- Valve chest on the cistern's left wall (sectioned). Front slab:
  // riser with the delivery seat, the channel to the barrel, the safety
  // port and its chamber. Back slab: the chamber's discharge down into the
  // cistern, behind the channel. ---
  const chestFront = clip.difference(rect(267, 272, 345.3, 320),
    rect(284, 304, 294, 320.5), rect(286, 302, 292, 304.5), rect(284, 296, 348.5, 302.5),
    rect(302, 289.5, 308, 296.5), rect(297, 280, 313, 290), rect(302.3, 271.5, 307.7, 280.5));
  const chestBack = clip.difference(rect(267, 272, 345.3, 320),
    rect(297, 280, 313, 290), rect(302.3, 271.5, 307.7, 280.5), rect(312.5, 281, 336, 287), rect(330, 286.5, 336, 320.5));
  const valveChest = addRole(new THREE.Group(), 'finite-delivery-check-chamber');
  const chestFrontMesh = new THREE.Mesh(plate(chestFront, -0.125, 0), ironMaterial);
  const chestBackMesh = new THREE.Mesh(plate(chestBack, -0.28, -0.125), ironMaterial);
  chestFrontMesh.userData.role = 'sectioned-valve-chest-front-layer';
  chestBackMesh.userData.role = 'sectioned-valve-chest-rear-layer';
  valveChest.add(chestFrontMesh, chestBackMesh);
  root.add(valveChest);
  const chestWater = addRole(new THREE.Mesh(plate(clip.union(rect(284.4, 304.4, 293.6, 320), rect(286.4, 302, 291.6, 304.4),
    rect(284.4, 296.4, 355, 302.1), rect(302.4, 290, 307.6, 296.4)), -0.121, -0.004), waterMaterial), 'water-filling-valve-chest-channels');
  root.add(chestWater);
  const deliveryValve = addRole(new THREE.Mesh(new THREE.CylinderGeometry(4.6 * S, 4.6 * S, 2 * S, 32), brassMaterial),
    'functional-small-pump-pressure-delivery-check-disk');
  deliveryValve.position.set(X(289), Y(305.6), 0);
  root.add(deliveryValve);
  // Dead-weight safety valve: disc on the port, spindle, top flange ("I")
  // and Brown's ball weight resting on it. The same valve is lifted to let
  // the ram down; the water leaves through the rear discharge.
  const safetyValve = addRole(new THREE.Group(), 'weighted-safety-valve-with-ball-weight');
  const safetyDisc = new THREE.Mesh(new THREE.CylinderGeometry(6 * S, 6 * S, 3 * S, 32), brassMaterial);
  // Measured up from the port's top edge (py 290), where the disc seats.
  safetyDisc.position.y = 1.5 * S;
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * S, 2.2 * S, 21 * S, 16), brassMaterial);
  spindle.position.y = 13.5 * S;
  const spindleHead = new THREE.Mesh(new THREE.CylinderGeometry(5 * S, 5 * S, 2 * S, 24), brassMaterial);
  spindleHead.position.y = 25 * S;
  const ballWeight = addRole(new THREE.Mesh(new THREE.SphereGeometry(11.5 * S, 40, 24), darkMaterial), 'ball-weight-loading-safety-valve');
  ballWeight.position.y = 26 * S + 11.5 * S;
  for (const [part, role] of [[safetyDisc, 'safety-valve-disc-on-its-port'], [spindle, 'safety-valve-spindle'], [spindleHead, 'safety-valve-spindle-head']]) part.userData.role = role;
  safetyValve.add(safetyDisc, spindle, spindleHead, ballWeight);
  safetyValve.position.set(X(305), Y(290), 0);
  root.add(safetyValve);
  const releaseWater = addRole(new THREE.Mesh(plate(clip.union(rect(297.4, 280.4, 312.6, 289.6), rect(312, 281.4, 335.6, 286.6), rect(330.4, 286, 335.6, 320)), -0.276, -0.129),
    waterMaterial.clone()), 'water-escaping-through-lifted-safety-valve');
  root.add(releaseWater);

  // --- T lug on the chest top, swing link and the hand lever. ---
  const lug = addRole(new THREE.Mesh(plate(clip.difference(clip.union(rect(312, 261, 337, 269.5), rect(320, 269, 329, 272.2)),
    poly(circle([swingLinkFoot.x, swingLinkFoot.y], boreRadius, 32))), -0.20, -0.12), ironMaterial), 'fixed-t-lug-carrying-swing-link-pin');
  root.add(lug);
  const lugPin = addRole(zPin(pinRadius, -0.21, -0.05), 'fixed-swing-link-pin-in-t-lug');
  lugPin.position.set(swingLinkFoot.x, swingLinkFoot.y, 0);
  root.add(lugPin);
  const linkShape = clip.difference(clip.union(poly(circle([0, 0], 6.5 * S, 48)), poly(circle([swingLinkLength, 0], 6.5 * S, 48)),
    poly([[0, -2.6 * S], [swingLinkLength, -2.6 * S], [swingLinkLength, 2.6 * S], [0, 2.6 * S]])),
  poly(circle([0, 0], boreRadius, 32)), poly(circle([swingLinkLength, 0], boreRadius, 32)));
  const swingLink = addRole(new THREE.Mesh(plate(linkShape, -0.11, -0.06), darkMaterial), 'swing-link-carrying-lever-fulcrum');
  swingLink.position.set(swingLinkFoot.x, swingLinkFoot.y, 0);
  root.add(swingLink);

  const pumpLever = addRole(new THREE.Group(), 'human-operated-hand-lever');
  root.add(pumpLever);
  const L1 = pumpLeverPinRadius, grip = handleLength - 42 * S;
  const leverOutline = clip.difference(clip.union(
    poly(circle([0, 0], 9 * S, 48)), poly(circle([L1, 0], 9 * S, 48)),
    poly([[0, -4 * S], [L1, -4 * S], [grip, -3 * S], [grip, 3 * S], [L1, 4 * S], [0, 4 * S]]),
    poly([[grip - 4 * S, -3 * S], [grip + 8 * S, -6 * S], [handleLength - 5 * S, -5 * S], [handleLength - 5 * S, 5 * S], [grip + 8 * S, 6 * S], [grip - 4 * S, 3 * S]]),
    poly(circle([handleLength - 5 * S, 0], 5 * S, 32))),
  poly(circle([0, 0], boreRadius, 32)), poly(circle([L1, 0], boreRadius, 32)));
  const leverBar = addRole(new THREE.Mesh(plate(leverOutline, -0.05, 0.05), pumpMaterial), 'hand-lever-flat-bar-with-turned-grip');
  pumpLever.add(leverBar);
  const leverAxle = addRole(zPin(pinRadius, -0.12, 0.085), 'fulcrum-pin-joining-lever-and-swing-link');
  pumpLever.add(leverAxle);

  // --- Brown's thin line from the lever's end pin down to the ball: a cord
  // looped on the fulcrum pin in front of the lever and tied into the ball.
  // It carries no load; its length is the longest pin-to-ball span while
  // pumping, so it is just taut there, and it bows slightly when shorter.
  // The slack bows toward the viewer (out of the plate), so the front view
  // keeps Brown's straight line; the tie point on the ball is chosen so the
  // pin's swing changes the span as little as the ball allows.
  const cordRadius = 0.8 * S, cordZ = 0.068;
  const cordLoopRadius = pinRadius + cordRadius;
  const cordLoop = addRole(new THREE.Mesh(new THREE.TorusGeometry(cordLoopRadius, cordRadius, 10, 40), cordMaterial), 'cord-loop-on-fulcrum-pin');
  cordLoop.position.z = cordZ;
  root.add(cordLoop);
  const ballRadius = 11.5 * S, ballRestCenter = new THREE.Vector2(X(305), Y(290) + 26 * S + ballRadius);
  const ballSectionRadius = Math.sqrt(ballRadius ** 2 - cordZ ** 2);
  const cordSpan = (fulcrum, tie) => {
    const direction = new THREE.Vector2(tie.x - fulcrum.x, tie.y - fulcrum.y).normalize();
    return new THREE.Vector2(fulcrum.x, fulcrum.y).addScaledVector(direction, cordLoopRadius).distanceTo(tie);
  };
  const cordSamples = Array.from({length: 73}, (_, i) => pumpKinematics(FULL_TURN * i / 72).fulcrum);
  let cordTieAngle = 0, cordSpread = Infinity;
  for (let i = 0; i <= 90; i += 1) {
    const angle = THREE.MathUtils.degToRad(i * 0.5);
    const tie = ballRestCenter.clone().add(new THREE.Vector2(Math.sin(angle), Math.cos(angle)).multiplyScalar(ballSectionRadius));
    const spans = cordSamples.map((fulcrum) => cordSpan(fulcrum, tie));
    const spread = Math.max(...spans) - Math.min(...spans);
    if (spread < cordSpread) [cordSpread, cordTieAngle] = [spread, angle];
  }
  const cordTieOffset = new THREE.Vector2(Math.sin(cordTieAngle), Math.cos(cordTieAngle)).multiplyScalar(ballSectionRadius);
  const cordLength = Math.max(...cordSamples.map((fulcrum) => cordSpan(fulcrum, ballRestCenter.clone().add(cordTieOffset))));
  const cordTube = makeCurveTubeBuffer({segments: 32, sides: 8, radius: cordRadius});
  const ballCord = addRole(new THREE.Mesh(cordTube.geometry, cordMaterial), 'thin-cord-from-lever-end-pin-to-ball-weight');
  root.add(ballCord);
  const cordCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  const updateCord = (fulcrum, ballLift) => {
    const tie = ballRestCenter.clone().add(cordTieOffset);
    tie.y += ballLift;
    const direction = new THREE.Vector2(tie.x - fulcrum.x, tie.y - fulcrum.y).normalize();
    const top = new THREE.Vector2(fulcrum.x, fulcrum.y).addScaledVector(direction, cordLoopRadius);
    const chord = top.distanceTo(tie);
    // Parabolic bow of sag h keeps the arc length: L = d + 8h^2/(3d).
    const sag = Math.sqrt(Math.max(0, 3 * chord * (cordLength - chord) / 8));
    cordLoop.position.x = fulcrum.x;
    cordLoop.position.y = fulcrum.y;
    cordCurve.v0.set(top.x, top.y, cordZ);
    cordCurve.v2.set(tie.x, tie.y, cordZ);
    cordCurve.v1.set((top.x + tie.x) / 2, (top.y + tie.y) / 2, cordZ + 2 * sag);
    cordCurve.updateArcLengths();
    cordTube.update(cordCurve);
    return {chord, sag};
  };

  // --- Plunger, crosshead (with a mortise the lever passes through) and pin. ---
  // Pass 109: the plunger and its crosshead are turned steel, so the
  // orange hand lever reads against the crosshead it passes through.
  const steelMaterial = matte(PALETTE.muted, {metalness: 0.32, roughness: 0.42});
  const pumpCrosshead = addRole(new THREE.Group(), 'small-pump-vertical-crosshead');
  root.add(pumpCrosshead);
  const half = 13 * S, slot = 12 * S, slotZ = 0.07;
  for (const [y0, y1, z0, z1] of [[slot, 105 * S, -half, half], [-42 * S, -slot, -half, half], [-slot, slot, slotZ, half], [-slot, slot, -half, -slotZ]]) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(2 * half, y1 - y0, z1 - z0), steelMaterial);
    piece.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2);
    piece.userData.role = 'crosshead-block';
    pumpCrosshead.add(piece);
  }
  const crossheadPinMesh = addRole(zPin(pinRadius, -half - 0.01, half + 0.01), 'crosshead-pin-through-lever');
  pumpCrosshead.add(crossheadPinMesh);
  const pumpPiston = addRole(new THREE.Group(), 'small-pump-plunger');
  root.add(pumpPiston);
  const plungerLength = pumpPistonRodOffset - 42 * S;
  const plunger = new THREE.Mesh(new THREE.CapsuleGeometry(pumpPlungerRadius, plungerLength - pumpPlungerRadius, 8, 32), steelMaterial);
  plunger.position.y = (plungerLength - pumpPlungerRadius) / 2 + pumpPlungerRadius;
  plunger.userData.role = 'plunger-rod';
  pumpPiston.add(plunger);
  const pumpPistonRod = plunger;

  // --- Pump barrel with stuffing box, suction chamber, pipe and rose (sectioned). ---
  const barrelProfile = [
    [6.3, 212], [30, 212], [30, 222], [21, 227], [21, 346], [14, 354], [14, 386], [9, 390], [9, 425],
    [18, 438], [18, 452], [0, 482], [0, 476], [14, 452], [14, 440], [5.5, 429], [5.5, 384], [4, 384],
    [4, 380], [7, 380], [7, 354], [8, 352], [8, 227], [6.3, 227],
  ];
  const pumpCylinder = addRole(sectionedLathe(barrelProfile, ironMaterial, ironCut,
    [{low: Y(303), high: Y(295.5), side: -1, delta: THREE.MathUtils.degToRad(55)}]), 'small-hand-pump-cylinder');
  pumpCylinder.position.x = pumpSliderX;
  for (const part of pumpCylinder.children) part.userData.role = 'sectioned-pump-barrel';
  root.add(pumpCylinder);
  const inletValve = addRole(new THREE.Mesh(new THREE.CylinderGeometry(6.2 * S, 6.2 * S, 2 * S, 32), brassMaterial),
    'functional-small-pump-reservoir-inlet-check-disk');
  inletValve.position.set(pumpSliderX, Y(379), 0);
  root.add(inletValve);
  const barrelWater = dynamicLatheWater((tipY) => [
    // Pass 88: the column's foot stands 0.006 above the seat, off the
    // closed inlet disk's underside.
    [0, Y(380) + 0.006], [7 * S, Y(380) + 0.006], [7 * S, Y(354)], [8 * S, Y(352)], [8 * S, Y(227)], [pumpPlungerRadius + 0.002, Y(227)],
    ...Array.from({length: 13}, (_, i) => {
      const a = Math.PI / 2 * i / 12;
      return [(pumpPlungerRadius + 0.002) * Math.cos(a), tipY + pumpPlungerRadius - (pumpPlungerRadius + 0.002) * Math.sin(a)];
    }),
  ], waterMaterial, 'water-in-pump-barrel-under-plunger');
  barrelWater.position.x = pumpSliderX;
  root.add(barrelWater);
  const inletWater = addRole(new THREE.Mesh(latheSectionGeometry(lathe([[0, 380.5], [4, 380.5], [4, 384], [5.5, 384], [5.5, 429], [14, 440], [14, 452], [0, 476]]), {segments: 48}), waterMaterial),
    'active-reservoir-water-entering-small-pump-on-suction-stroke');
  inletWater.position.x = pumpSliderX;
  root.add(inletWater);

  // --- Cistern (sectioned) and its water. ---
  const pumpReservoir = addRole(new THREE.Group(), 'open-water-reservoir-feeding-small-hand-pump');
  root.add(pumpReservoir);
  const cisternBack = -0.75;
  for (const [x0, y0, x1, y1, role] of [[312, 320, 322, 492, 'fixed-lower-wall-of-pump-cistern'], [467, 320, 477, 492, 'fixed-lower-wall-of-pump-cistern'],
    [477, 320, 484, 326, 'fixed-rim-of-pump-cistern'], [322, 482, 467, 492, 'fixed-floor-of-pump-cistern']]) {
    const wall = box(x0, y0, x1, y1, cisternBack - 0.14, 0, boxFaces);
    wall.userData.role = role;
    pumpReservoir.add(wall);
  }
  const backWall = box(322, 320, 467, 482, cisternBack - 0.14, cisternBack);
  backWall.userData.role = 'fixed-back-wall-of-pump-cistern';
  pumpReservoir.add(backWall);
  const waterTop = Y(400), waterBottom = Y(482);
  // Pass 88: the cistern water stands `gap` off the cistern's walls, floor
  // and back, and is the water round the pump's foot only: its mid-plane
  // face is notched and its surface bored for the barrel, and a back-half
  // surface of revolution `gap` outside the barrel's outer profile closes it
  // there. It no longer runs through the barrel's section and its bore (the
  // water inside the barrel is the inlet water), so no face lies on the
  // barrel's cut face or the inlet water's.
  const reservoirWaterGeometry = (level) => {
    const gap = 0.006, steps = 32, bottom = waterBottom + gap;
    const x0 = X(322) + gap, x1 = X(467) - gap, z0 = cisternBack + gap;
    const outer = [[9, 390], [9, 425], [18, 438], [18, 452], [0, 482]].map(([r, py]) => [r * S, Y(py)]);
    const radiusAt = (y) => {
      for (let i = 0; i + 1 < outer.length; i += 1) {
        const [ra, ya] = outer[i], [rb, yb] = outer[i + 1];
        if (y <= ya + 1e-12 && y >= yb - 1e-12) return (ya === yb ? Math.max(ra, rb) : ra + (rb - ra) * (y - ya) / (yb - ya)) + gap;
      }
      return gap;
    };
    const levels = [level, ...outer.map(([, y]) => y).filter((y) => y < level - 1e-9 && y > bottom + 1e-9), bottom];
    const positions = [], normals = [];
    const push = (points, normal) => {for (const q of points) {positions.push(...q);normals.push(...normal);}};
    const halfCircle = (radius) => Array.from({length: steps + 1}, (_, k) => {
      const phi = Math.PI / 2 + Math.PI * k / steps;
      return [pumpSliderX + radius * Math.sin(phi), radius * Math.cos(phi)];
    });
    // Barrel side: open back-half bands between the profile levels.
    for (let i = 0; i + 1 < levels.length; i += 1) {
      const a = halfCircle(radiusAt(levels[i])), b = halfCircle(radiusAt(levels[i + 1]));
      for (let k = 0; k < steps; k += 1) {
        const phi = Math.PI / 2 + Math.PI * (k + 0.5) / steps, n = [-Math.sin(phi), 0, -Math.cos(phi)];
        const p = (c, y) => [c[0], y, c[1]];
        push([p(a[k], levels[i]), p(b[k], levels[i + 1]), p(b[k + 1], levels[i + 1]),
          p(a[k], levels[i]), p(b[k + 1], levels[i + 1]), p(a[k + 1], levels[i])], n);
      }
    }
    const fill = (polygons, map, normal) => {
      for (const [outerRing, ...holes] of polygons) {
        const ring = (r) => r.slice(0, -1).map(([u, v]) => new THREE.Vector2(u, v));
        const contour = ring(outerRing), hs = holes.map(ring), all = [...contour, ...hs.flat()];
        for (const t of THREE.ShapeUtils.triangulateShape(contour, hs)) push(t.map((i) => map(all[i])), normal);
      }
    };
    const plan = poly([[x0, z0], [x1, z0], [x1, 0], [x0, 0]]);
    const bore = (radius) => poly(halfCircle(radius));
    fill(clip.difference(plan, bore(radiusAt(level))), (v) => [v.x, level, v.y], [0, 1, 0]);
    fill(clip.difference(plan, bore(radiusAt(bottom))), (v) => [v.x, bottom, v.y], [0, -1, 0]);
    const notch = poly([...levels.map((y) => [pumpSliderX + radiusAt(y), y]), ...levels.slice().reverse().map((y) => [pumpSliderX - radiusAt(y), y]),
      [pumpSliderX - radiusAt(level), level + 1], [pumpSliderX + radiusAt(level), level + 1]].reverse());
    fill(clip.difference(poly([[x0, bottom], [x1, bottom], [x1, level], [x0, level]]), notch), (v) => [v.x, v.y, 0], [0, 0, 1]);
    push([[x0, bottom, z0], [x1, level, z0], [x1, bottom, z0], [x0, bottom, z0], [x0, level, z0], [x1, level, z0]], [0, 0, -1]);
    for (const [x, sign] of [[x0, -1], [x1, 1]]) push([[x, bottom, z0], [x, bottom, 0], [x, level, 0], [x, bottom, z0], [x, level, 0], [x, level, z0]], [sign, 0, 0]);
    // Orient each triangle to its normal.
    for (let t = 0; t < positions.length; t += 9) {
      const v = (k) => new THREE.Vector3(positions[t + 3 * k], positions[t + 3 * k + 1], positions[t + 3 * k + 2]);
      const face = new THREE.Vector3().subVectors(v(1), v(0)).cross(new THREE.Vector3().subVectors(v(2), v(0)));
      if (face.dot(new THREE.Vector3(normals[t], normals[t + 1], normals[t + 2])) < 0) {
        for (let k = 0; k < 3; k += 1) [positions[t + 3 + k], positions[t + 6 + k]] = [positions[t + 6 + k], positions[t + 3 + k]];
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
  };
  const reservoirWater = addRole(new THREE.Mesh(reservoirWaterGeometry(waterTop), waterMaterial), 'hand-pump-reservoir-water');
  reservoirWater.userData.level = waterTop;
  pumpReservoir.add(reservoirWater);
  const cisternArea = (X(467) - X(322)) * 2 * -cisternBack;
  const returnStream = addRole(new THREE.Mesh(new THREE.CylinderGeometry(2.4 * S, 2.8 * S, 1, 16, 1, true).translate(0, -0.5, 0), waterMaterial.clone()),
    'release-water-returning-into-the-cistern');
  returnStream.position.set(X(333), Y(320), -0.2);
  root.add(returnStream);

  // --- Press water: bore and ram gap, growing under the rising ram. ---
  const ramCylinderWater = dynamicLatheWater((lift) => {
    const shift = lift / S;
    return lathe([
      [24.02, 335], [32.3, 335], [32.3, 474], ...arc(24.5, 474, 7.8, 0, -Math.PI / 2, 24).slice(1), [0, 481.8],
      ...arc(0, 451 - shift, 24.02, -Math.PI / 2, 0, 48),
    ]);
  }, waterMaterial, 'pressurized-water-under-large-solid-ram');
  ramCylinderWater.position.x = ramAxisX;
  root.add(ramCylinderWater);

  const maximumReliefFlowRate = maximumDeliveredVolume / ((1 - reliefStartPhase) * cycleDuration) * 1.875;
  const safetyValveRestY = Y(290);
  const levelAt = (state) => waterTop - state.retainedPressVolume / cisternArea;
  let lastCord = null;
  const update = (time) => {
    const state = stateAtTime(time);
    pumpLever.position.copy(state.fulcrum);
    pumpLever.rotation.z = state.leverAngle;
    swingLink.rotation.z = state.swingLinkAngle;
    pumpCrosshead.position.copy(state.crosshead);
    pumpPiston.position.copy(state.piston);
    barrelWater.userData.setValue(state.piston.y);
    inletValve.position.y = Y(379) + 3.5 * S * state.inletOpenAmount;
    deliveryValve.position.y = Y(305.6) - 1.4 * S * state.deliveryOpenAmount;
    ramAssembly.position.y = state.ramLift;
    ramCylinderWater.userData.setValue(state.ramLift);
    const loadHeight = initialLoadHeight - state.loadCompression;
    compressibleLoad.scale.y = loadHeight / initialLoadHeight;
    compressibleLoad.position.set(ramAxisX, fixedHeadUndersideY, 0);
    // The ball-weighted valve is lifted to let the ram down; the water runs
    // out through the rear discharge into the cistern, whose level gives up
    // exactly the water held under the ram and recovers it.
    const flow = THREE.MathUtils.clamp(state.reliefReturnFlowRate / maximumReliefFlowRate, 0, 1);
    safetyValve.position.y = safetyValveRestY + 3 * S * flow;
    lastCord = updateCord(state.fulcrum, safetyValve.position.y - safetyValveRestY);
    const level = levelAt(state);
    if (Math.abs(level - reservoirWater.userData.level) > 1e-7) {
      // The level stays in the barrel's straight 9 px stretch, so the
      // surface keeps its layout and is copied into the same buffers.
      const next = reservoirWaterGeometry(level), current = reservoirWater.geometry;
      if (next.attributes.position.count !== current.attributes.position.count) throw new Error('466 cistern water layout changed');
      for (const name of ['position', 'normal']) {
        current.attributes[name].array.set(next.attributes[name].array);
        current.attributes[name].needsUpdate = true;
      }
      current.computeBoundingBox();
      current.computeBoundingSphere();
      next.dispose();
      reservoirWater.userData.level = level;
    }
    releaseWater.visible = returnStream.visible = flow > 1e-4;
    releaseWater.material.opacity = returnStream.material.opacity = 0.34 * Math.min(1, flow * 4);
    returnStream.scale.y = Y(320) - level;
  };

  const sourceState = stateAtPhase(0);
  const geometry = {
    areaRatio,
    brownExampleForceRatio,
    brownExamplePumpDiameter,
    brownExampleRamDiameter,
    cordLength,
    cordSpreadWhilePumping: cordSpread,
    cordTieAngle,
    cycleDuration,
    diameterRatio,
    fixedHeadUndersideY,
    groundY,
    handleLength,
    idealHydraulicPressure,
    idealRamForce,
    initialLoadHeight,
    initialPlatenY,
    maximumDeliveredVolume,
    maximumRamLift,
    maximumStrokeAngle,
    nominalInputForce,
    nominalPistonSpeed,
    operationEndPhase,
    pumpCycleCount,
    pumpCylinderBottomY,
    pumpCylinderTopY,
    pumpLeverAmplitude,
    pumpLeverPinRadius,
    pumpLeverRestAngle,
    pumpPistonRodOffset,
    pumpPlungerArea,
    pumpPlungerRadius,
    pumpSliderX,
    pumpStrokeLength,
    ramArea,
    ramAxisX,
    ramCylinderBottomY,
    ramCylinderHeight,
    ramCylinderTopY,
    ramRadius,
    reliefStartPhase,
    reservoirSurfaceY: waterTop,
    swingLinkFoot: swingLinkFoot.clone(),
    swingLinkLength,
  };
  root.userData = {
    archetype:
      'hand-pumped-hydrostatic-press-with-pascal-area-force-ratio-volume-displacement-and-relief-return',
    blocks: {
      ballCord,
      ballWeight,
      cordLoop,
      columns,
      compressibleLoad,
      crossheadPin: crossheadPinMesh,
      deliveryValve,
      dome,
      fixedHead,
      headPlate,
      inletValve,
      inletWater,
      leverAxle,
      leverBar,
      lug,
      lugPin,
      movingPlaten,
      pressFrame,
      pressurePipe,
      pressureWater,
      pumpCrosshead,
      pumpCylinder,
      pumpLever,
      pumpPiston,
      pumpPistonRod,
      pumpReservoir,
      ramAssembly,
      ramBody,
      ramCylinder,
      ramCylinderWater,
      ramPiston: bowl,
      ramRod: ramBody,
      barrelWater,
      chestWater,
      releaseWater,
      reservoirWater,
      returnStream,
      safetyValve,
      swingLink,
      valveChest,
    },
    cisternArea,
    cordState: () => lastCord,
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pumpAndRamIndependent: false,
      reliefReturnScheduledAfterPumping: true,
    },
    dynamics: {
      compressibilityPipeExpansionSealLeakageValveImpactFrictionStructuralDeflectionAndLoadConstitutiveLawModeled:
        false,
      forceModel:
        'Ideal Pascal pressure is uniform: p=F_pump/A_pump and F_ram=p*A_ram. The plate’s 4:1 ram-to-plunger diameter ratio gives exactly 16:1 force multiplication; Brown’s textual 1:30 example gives 900:1.',
      resetModel:
        'After twelve complete physical pump strokes and a hold, the ball-weighted valve is lifted: the displaced water returns through its rear discharge into the cistern and the ram comes down with a C2 profile.',
      volumeModel:
        'Every downward plunger increment displaces A_pump times travel into the large cylinder, whose ram rises by that volume divided by A_ram. Suction strokes refill the barrel without raising the ram; the cistern level falls by the water held under the ram.',
    },
    deliveredLengthAtStrokeAngle,
    fidelity: 'authored',
    geometry,
    mechanism:
      'A hand lever pinned through the plunger’s crosshead rocks on a fulcrum carried by a swing link from the T lug on the valve chest. Upstrokes open the suction check at the foot of the barrel; downstrokes open the delivery check in the chest and force water through the small pipe under the hollow ram. Uniform hydraulic pressure multiplies force by the area ratio while the ram travel is reduced by the same ratio. The ball-weighted safety valve on the chest limits the pressure and is lifted to let the ram down.',
    motion: {
      cycleDuration,
      motionType:
        'twelve exact lever-pump strokes with volume-accumulating slow ram rise, hold and C2 let-down',
    },
    pumpKinematics,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      leverAngle: sourceState.leverAngle,
      pistonPosition: sourceState.piston.clone(),
      ramLift: sourceState.ramLift,
      retainedPressVolume: sourceState.retainedPressVolume,
    },
    sourceReference: {
      brownPlate466: {
        pixelToModel: 'x=(px-262)/72, y=(280-py)/72',
        ramAxisPixels: 138.75,
        pumpAxisPixels: 366,
        leverFulcrumPixels: [315, 142.5],
        crossheadPinPixels: [366, 155],
        swingLinkFootPixels: [324.5, 265.5],
        ballWeightPixels: [303.5, 252.5],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 4,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a pump forces water through a small pipe into the ram cylinder',
          'water pressure beneath the solid ram raises it',
          'force gain is proportional to piston areas or squared diameters',
          'a one-inch pump and thirty-inch ram give nine-hundred-fold force',
        ],
        engravingEvidence:
          'Brown sections a deep flanged ram cylinder with a hollow round-ended ram under a fluted bowl, platen and four bales, a domed head on two columns, a small pipe to a valve chest on the cistern wall carrying a ball weight and a T, a tall pump barrel with stuffing box, suction chamber, suction pipe and pointed rose standing in the cistern, and a hand lever pinned through the plunger’s crosshead.',
        reconstructionDisclosure:
          'Brown gives no check-valve positions inside the chest, lever closure, stroke count, speed, load stiffness or timing. The plate’s 4:1 diameter ratio, the swing link from the T lug to the lever end, the chest passages, the dead-weight safety valve used for let-down, twelve strokes, ideal Pascal and volume relations, colors and a 12.5-second cycle are independently engineered; Brown’s 1:30 example is retained separately and exactly. Brown’s thin line from the lever end to the ball is read as a light cord looped on the fulcrum pin and tied into the ball; Brown does not say what it is for, so it carries no load, is just taut while pumping and bows when the ball is lifted to let the ram down.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 466',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      force:
        'F_ram/F_pump=A_ram/A_pump=(D_ram/D_pump)^2',
      leverLinkage:
        'The plunger crosshead stays on the barrel axis; the lever is pinned through it and its fulcrum rides a swing link of fixed length from the T lug, so the closure is exact.',
      volume:
        'A_pump*sum(delivery downstrokes)=A_ram*ram lift',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(X(22), Y(506), -1.6),
    new THREE.Vector3(X(512), Y(30), 0.9),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(0, 0.03, 1);
  root.userData.cameraFov = 10;
  root.userData.groundFloorY = groundY;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.userData.solidReview = {
    status: 'qualified-geometry',
    residual: 'Ideal Pascal area/volume laws and prescribed checks/load compression remain; valve sealing, fluid pressure losses and force equilibrium are not dynamically solved.',
  };
  markShadows(root);
  for (const object of [ramCylinderWater, reservoirWater, pressureWater, inletWater, barrelWater, chestWater, releaseWater, returnStream]) {
    object.castShadow = false;
    object.receiveShadow = false;
    object.renderOrder = 1;
  }
  root.traverse((object) => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredHydrostaticPressMovement(movement) {
  if (movement.id !== 466) return null;
  return hydrostaticPress(movement);
}
