import * as THREE from 'three';
import {sidePortedShell} from './hydraulic-force-parts.js';
import {
  circle,
  plate,
  poly,
  polygonClipping,
  sector,
} from './finite-plate-geometry.js';
import {
  horizontalPlate,
  horizontalRing,
  horizontalTurned,
} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {helicalThread, threadAngles} from './mujoco-screw/thread-geometry.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {fitPistonGuide} from './piston-guide-parts.js';
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

// Brown hatches the cut faces of his section with parallel 45-degree lines:
// notation for cut solid. The cut face is modelled as a plain solid face on
// the cut plane z = 0, facing +Z, a slightly darker shade of the part's own
// material, in front of the back half-shells. Presentation only: it adds no
// working surface.
function plainSectionFace(polygons, name, material) {
  const faceMaterial = matte(material.color.clone().multiplyScalar(0.88),
    { roughness: 0.7, metalness: 0.08 });
  faceMaterial.fog = false;
  const face = new THREE.Mesh(plate(polygons, 0, 0.004), faceMaterial);
  face.name = name;
  face.userData.presentationOnly = true;
  face.castShadow = false;
  face.receiveShadow = true;
  return face;
}
const rectangle = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1],
  [x0, y1]]);

// Brown's plate 467 is a sectional elevation of a narrow column. The hollow
// ram stands on a small hollow base only a little wider than the sliding
// cylinder, and the pump works inside the foot of the ram. Reading of the
// plate: the long hand lever is pinned at the upper eye to a plunger that
// passes through the gland (the two square blocks on the ram's left face)
// into an oblique barrel in the ram; its fulcrum is the lower eye, carried on
// a short swinging link from a lug at the base's upper-left corner (hidden
// behind the thumb-screw wing), so the plunger pin runs on a straight line.
// Positions are measured on the 525 px plate (ram centre x 275 px, ground
// 500 px); depths, the pump barrel's hidden end, check valves and all ratios
// are reconstruction choices.
const PLATE_UNITS_PER_PIXEL = 0.42 / 32.5;
const PLATE_RAM_CENTRE_PX = 275;
const PLATE_GROUND_PX = 500;
const JACK_GROUND_Y = -1.10;
function plateXY(px, py) {
  return new THREE.Vector2(
    (px - PLATE_RAM_CENTRE_PX) * PLATE_UNITS_PER_PIXEL,
    (PLATE_GROUND_PX - py) * PLATE_UNITS_PER_PIXEL + JACK_GROUND_Y,
  );
}

function robertsonJack(movement) {
  const root = new THREE.Group();
  const cycleDuration = 14;
  const operationEndPhase = 0.64;
  const loweringStartPhase = 0.70;
  const loweringEndPhase = 0.88;
  // The view opens in the hold after pumping: the cylinder raised as Brown
  // draws it and the plunger home in its barrel.
  const sourcePhase = 0.67;
  const pumpCycleCount = 12;
  const maximumStrokeAngle = pumpCycleCount * FULL_TURN;
  const groundY = JACK_GROUND_Y;

  // Linkage, measured on the plate.
  const plungerPinHome = plateXY(205, 355.5);
  const leverFulcrumHome = plateXY(150, 401);
  const swingLinkPivot = plateXY(195, 442);
  const glandCentre = plateXY(233, 400);
  const plungerAxis = glandCentre.clone().sub(plungerPinHome).normalize();
  const plungerNormal = new THREE.Vector2(-plungerAxis.y, plungerAxis.x);
  if (plungerNormal.x < 0) plungerNormal.negate();
  const leverShortArm = leverFulcrumHome.distanceTo(plungerPinHome);
  const swingLinkLength = leverFulcrumHome.distanceTo(swingLinkPivot);
  const leverHandleLength = 4.30;
  const leverBandDistance = 3.11;
  const leverZ = -0.75;
  const swingLinkZ = -0.50;
  const pumpStrokeLength = 0.32;
  const pumpPlungerRadius = 0.09;
  const plungerTipDistance = 0.94;
  const glandStart = 0.58;
  const barrelStart = 0.86;
  const barrelEnd = 1.02;
  const barrelCapEnd = 1.04;
  const barrelInnerRadius = pumpPlungerRadius + 0.004;
  const barrelOuterRadius = 0.125;
  const deliveryPortDistance = 0.975;

  const fixedRamRadius = 0.42;
  const fixedRamBoreRadius = 0.30;
  const baseLeftX = plateXY(207, 0).x;
  const baseRightX = plateXY(336, 0).x;
  const baseTopY = plateXY(0, 430).y;
  const baseWall = 0.16;
  const baseFloor = 0.17;
  const baseHalfDepth = 0.62;
  const baseTopHoleRadius = 0.37;
  const fixedRamBaseY = baseTopY;
  const fixedRamTopY = plateXY(0, 190).y;
  const fixedRamHeight = fixedRamTopY - fixedRamBaseY;
  const ramCapThickness = 0.14;
  const returnSeatY = -0.66;
  const pipeBottomY = returnSeatY + 0.20;

  const pumpPlungerArea = Math.PI * pumpPlungerRadius ** 2;
  const fixedRamArea = Math.PI * fixedRamRadius ** 2;
  const hydraulicAreaRatio = fixedRamArea / pumpPlungerArea;
  const maximumDeliveredVolume = pumpCycleCount
    * pumpPlungerArea * pumpStrokeLength;
  const maximumCylinderLift = maximumDeliveredVolume / fixedRamArea;

  // Moving cylinder as drawn (raised by the full lift).
  const drawnCylinderBottomY = plateXY(0, 355).y;
  const drawnBoreTopY = plateXY(0, 112.5).y;
  const drawnCapTopY = plateXY(0, 100).y;
  const drawnHeadTopY = plateXY(0, 55).y;
  const cylinderInnerRadius = fixedRamRadius + 0.004;
  const cylinderOuterRadius = plateXY(327.5, 0).x;
  const movingCylinderBottomY = drawnCylinderBottomY - maximumCylinderLift;
  const movingCylinderTopY = drawnBoreTopY - maximumCylinderLift;
  const movingCylinderHeight = movingCylinderTopY - movingCylinderBottomY;
  const initialPressureChamberHeight = movingCylinderTopY - fixedRamTopY;

  const cavity = {
    minX: baseLeftX + baseWall,
    maxX: baseRightX - baseWall,
    minY: groundY + baseFloor,
    maxY: baseTopY - baseWall,
    halfDepth: baseHalfDepth - baseWall,
  };
  const baseWaterCapacity = (cavity.maxX - cavity.minX)
    * (cavity.maxY - cavity.minY) * 2 * cavity.halfDepth;
  const baseInitialWaterVolume = 0.78 * baseWaterCapacity;

  const thumbScrewPitch = 0.045;
  const thumbScrewMaximumTurns = 1;
  const thumbScrewMaximumAngle = thumbScrewMaximumTurns * FULL_TURN;
  const thumbScrewMaximumRetreat = thumbScrewPitch
    * thumbScrewMaximumTurns;
  const thumbScrewClosedX = -0.66;

  const pointOnAxis = (distance, withdrawal = 0) => plungerPinHome.clone()
    .addScaledVector(plungerAxis, distance - withdrawal);

  const fulcrumForPin = (pin) => {
    const delta = swingLinkPivot.clone().sub(pin);
    const distance = delta.length();
    const along = (distance ** 2 + leverShortArm ** 2
      - swingLinkLength ** 2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, leverShortArm ** 2 - along ** 2));
    const unit = delta.divideScalar(distance);
    return pin.clone().addScaledVector(unit, along)
      .add(new THREE.Vector2(unit.y * height, -unit.x * height));
  };

  // The prescribed input is the plunger's withdrawal along its fixed axis;
  // the lever and swing link follow by exact closure.
  const pumpKinematics = (
    strokeAngle,
    strokeAngularVelocity = 0,
    strokeAngularAcceleration = 0,
  ) => {
    const half = pumpStrokeLength / 2;
    const withdrawal = half * (1 - Math.cos(strokeAngle));
    const pistonVelocity = half * Math.sin(strokeAngle)
      * strokeAngularVelocity;
    const pistonAcceleration = half * (
      Math.cos(strokeAngle) * strokeAngularVelocity ** 2
      + Math.sin(strokeAngle) * strokeAngularAcceleration
    );
    const pin2 = pointOnAxis(0, withdrawal);
    const fulcrum2 = fulcrumForPin(pin2);
    const tip2 = pointOnAxis(plungerTipDistance, withdrawal);
    const leverAngle = Math.atan2(pin2.y - fulcrum2.y, pin2.x - fulcrum2.x);
    const swingLinkAngle = Math.atan2(
      fulcrum2.y - swingLinkPivot.y,
      fulcrum2.x - swingLinkPivot.x,
    );
    return {
      leverAngle,
      leverFulcrum: new THREE.Vector3(fulcrum2.x, fulcrum2.y, 0),
      piston: new THREE.Vector3(tip2.x, tip2.y, 0),
      pistonAcceleration,
      pistonVelocity,
      plungerPin: new THREE.Vector3(pin2.x, pin2.y, 0),
      plungerWithdrawal: withdrawal,
      strokeAngle,
      strokeAngularAcceleration,
      strokeAngularVelocity,
      swingLinkAngle,
    };
  };

  const nominalPistonSpeed = pumpStrokeLength * 4.4;

  // Each turn of the stroke angle is one suction (withdrawal) half and one
  // delivery (return) half; only the returning plunger delivers.
  const deliveredLengthAtStrokeAngle = (unclampedStrokeAngle, pump) => {
    const strokeAngle = THREE.MathUtils.clamp(
      unclampedStrokeAngle,
      0,
      maximumStrokeAngle,
    );
    if (Math.abs(strokeAngle - maximumStrokeAngle) < 1e-10) {
      return pumpCycleCount * pumpStrokeLength;
    }
    const completedCycles = Math.floor(strokeAngle / FULL_TURN);
    const withinCycle = positiveModulo(strokeAngle, FULL_TURN);
    const currentDelivery = withinCycle >= Math.PI
      ? pumpStrokeLength - pump.plungerWithdrawal
      : 0;
    return completedCycles * pumpStrokeLength + currentDelivery;
  };

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, operationEndPhase, loweringStartPhase,
      loweringEndPhase].find((boundary) =>
      Math.abs(rawPhase - boundary) < 1e-12) ?? rawPhase;
    let strokeAngle = maximumStrokeAngle;
    let strokeAngularVelocity = 0;
    let strokeAngularAcceleration = 0;
    let loweringProgress = 0;
    let loweringProgressRate = 0;
    let screwOpenAmount = 0;
    let regime;
    if (phase < operationEndPhase) {
      const local = phase / operationEndPhase;
      const timeScale = operationEndPhase * cycleDuration;
      strokeAngle = maximumStrokeAngle * smootherStep(local);
      strokeAngularVelocity = maximumStrokeAngle
        * smootherStepDerivative(local) / timeScale;
      strokeAngularAcceleration = maximumStrokeAngle
        * smootherStepSecondDerivative(local) / timeScale ** 2;
      regime = 'lever-strokes-plunger-in-ram-and-raise-cylinder-and-claw';
    } else if (phase < loweringStartPhase) {
      regime = 'load-held-by-trapped-water-with-thumb-screw-seated';
    } else if (phase < loweringEndPhase) {
      const local = (phase - loweringStartPhase)
        / (loweringEndPhase - loweringStartPhase);
      const timeScale = (loweringEndPhase - loweringStartPhase)
        * cycleDuration;
      loweringProgress = smootherStep(local);
      loweringProgressRate = smootherStepDerivative(local) / timeScale;
      screwOpenAmount = loweringProgress;
      regime = 'thumb-screw-retracts-and-metered-return-lowers-moving-cylinder';
    } else {
      const local = (phase - loweringEndPhase) / (1 - loweringEndPhase);
      loweringProgress = 1;
      screwOpenAmount = 1 - smootherStep(local);
      regime = 'thumb-screw-reseats-after-cylinder-is-fully-lowered';
    }
    const pump = pumpKinematics(
      strokeAngle,
      strokeAngularVelocity,
      strokeAngularAcceleration,
    );
    const deliveredLength = deliveredLengthAtStrokeAngle(strokeAngle, pump);
    const cumulativeDeliveredVolume = pumpPlungerArea * deliveredLength;
    const retainedCylinderVolume = phase < loweringStartPhase
      ? cumulativeDeliveredVolume
      : maximumDeliveredVolume * (1 - loweringProgress);
    const cylinderLift = retainedCylinderVolume / fixedRamArea;
    const deliveryFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, -pump.pistonVelocity)
      : 0;
    const suctionFlowRate = phase < operationEndPhase
      ? pumpPlungerArea * Math.max(0, pump.pistonVelocity)
      : 0;
    const returnFlowRate = phase >= loweringStartPhase
      && phase < loweringEndPhase
      ? maximumDeliveredVolume * loweringProgressRate
      : 0;
    const cylinderVelocity = phase < operationEndPhase
      ? deliveryFlowRate / fixedRamArea
      : -returnFlowRate / fixedRamArea;
    const inletOpenAmount = smootherStep(
      Math.max(0, pump.pistonVelocity) / nominalPistonSpeed,
    );
    const deliveryOpenAmount = smootherStep(
      Math.max(0, -pump.pistonVelocity) / nominalPistonSpeed,
    );
    const thumbScrewAngle = thumbScrewMaximumAngle * screwOpenAmount;
    const thumbScrewRetreat = thumbScrewPitch
      * thumbScrewAngle / FULL_TURN;
    return {
      ...pump,
      baseWaterVolume: baseInitialWaterVolume - retainedCylinderVolume,
      cumulativeDeliveredVolume,
      cylinderLift,
      cylinderVelocity,
      deliveredLength,
      deliveryFlowRate,
      deliveryOpenAmount,
      inletOpenAmount,
      loweringProgress,
      loweringProgressRate,
      phase,
      pressureChamberHeight: initialPressureChamberHeight + cylinderLift,
      regime,
      retainedCylinderVolume,
      returnFlowRate,
      screwOpenAmount,
      suctionFlowRate,
      thumbScrewAngle,
      thumbScrewRetreat,
      volumeDisplacementResidual:
        retainedCylinderVolume - fixedRamArea * cylinderLift,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration
    + sourcePhase);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.48,
  });
  const fixedRamMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const leverMaterial = fixedRamMaterial.clone();
  const movingMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.52,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.45,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.44,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const mesh = (parent, geometry, material, role) => {
    const object = addRole(new THREE.Mesh(geometry, material), role);
    parent.add(object);
    return object;
  };

  const foundation = mesh(root,
    new THREE.BoxGeometry(2.6, 0.16, 1.6).translate(0, groundY - 0.08, 0),
    frameMaterial, 'fixed-ground-plate-under-robertson-jack');

  // Small hollow base: the reservoir.
  const hollowBase = addRole(new THREE.Group(),
    'fixed-hollow-water-reservoir-base-supporting-stationary-ram');
  root.add(hollowBase);
  const baseMidX = (baseLeftX + baseRightX) / 2;
  const baseWidth = baseRightX - baseLeftX;
  const sideY = (cavity.minY + cavity.maxY) / 2;
  const sideHeight = cavity.maxY - cavity.minY;
  // Brown sections the base, ram and cylinder through their axes: only the
  // back halves (z < 0) are built, and plain cut faces close the cut.
  const leftWall = plate(polygonClipping.difference(
    poly([[0, cavity.minY], [baseHalfDepth, cavity.minY],
      [baseHalfDepth, cavity.maxY], [0, cavity.maxY]]),
    poly(circle([0, returnSeatY], 0.10, 64)),
  ), -baseWall / 2, baseWall / 2).rotateY(Math.PI / 2)
    .translate(baseLeftX + baseWall / 2, 0, 0);
  const baseShell = mesh(hollowBase, mergePassageParts([
    leftWall,
    new THREE.BoxGeometry(baseWall, sideHeight, baseHalfDepth)
      .translate(baseRightX - baseWall / 2, sideY, -baseHalfDepth / 2),
    new THREE.BoxGeometry(baseWidth - 2 * baseWall, sideHeight, baseWall)
      .translate(baseMidX, sideY, -baseHalfDepth + baseWall / 2),
  ]), frameMaterial, 'sectioned-hollow-base-walls');
  const baseFloorPlate = mesh(hollowBase,
    new THREE.BoxGeometry(baseWidth, baseFloor, baseHalfDepth)
      .translate(baseMidX, groundY + baseFloor / 2, -baseHalfDepth / 2),
    frameMaterial, 'hollow-base-floor');
  const baseTopPlate = mesh(hollowBase, plate(polygonClipping.difference(
    poly([[baseLeftX, -baseHalfDepth], [baseRightX, -baseHalfDepth],
      [baseRightX, 0], [baseLeftX, 0]]),
    poly(circle([0, 0], baseTopHoleRadius, 96)),
  ), baseTopY - baseWall, baseTopY).rotateX(Math.PI / 2)
    .translate(0, 2 * baseTopY - baseWall, 0),
  frameMaterial, 'hollow-base-top-open-to-ram-bore');
  const baseWater = mesh(hollowBase,
    new THREE.BoxGeometry(cavity.maxX - cavity.minX - 0.02, 1,
      cavity.halfDepth - 0.01),
    waterMaterial, 'water-reservoir-inside-hollow-base');
  baseWater.position.set((cavity.minX + cavity.maxX) / 2, 0,
    -(cavity.halfDepth - 0.01) / 2);
  const baseSection = plainSectionFace(polygonClipping.union(
    rectangle(baseLeftX, groundY, baseRightX, cavity.minY),
    polygonClipping.difference(
      rectangle(baseLeftX, cavity.minY, baseLeftX + baseWall, cavity.maxY),
      rectangle(baseLeftX, returnSeatY - 0.10, baseLeftX + baseWall,
        returnSeatY + 0.10)),
    rectangle(baseRightX - baseWall, cavity.minY, baseRightX, cavity.maxY),
    rectangle(baseLeftX, cavity.maxY, -baseTopHoleRadius, baseTopY),
    rectangle(baseTopHoleRadius, cavity.maxY, baseRightX, baseTopY),
  ), 'cut-face-of-hollow-base', frameMaterial);
  hollowBase.add(baseSection);

  // Hollow ram with a window at its foot for the pump barrel.
  const fixedRam = addRole(new THREE.Group(),
    'stationary-hollow-ram-fixed-rigidly-to-base');
  root.add(fixedRam);
  const windowTopY = 0.30;
  const windowHalfAngle = 0.56;
  const fixedRamBody = mesh(fixedRam, mergePassageParts([
    horizontalPlate(sector(fixedRamBoreRadius, fixedRamRadius,
      0, Math.PI - windowHalfAngle), fixedRamBaseY, windowTopY),
    horizontalPlate(sector(fixedRamBoreRadius, fixedRamRadius, 0, Math.PI),
      windowTopY, fixedRamTopY - ramCapThickness),
    horizontalPlate(sector(0.105, fixedRamRadius, 0, Math.PI),
      fixedRamTopY - ramCapThickness, fixedRamTopY),
  ]), fixedRamMaterial, 'sectioned-hollow-ram-body-with-pump-window');
  const ramSection = plainSectionFace(polygonClipping.union(
    rectangle(fixedRamBoreRadius, fixedRamBaseY, fixedRamRadius,
      fixedRamTopY),
    rectangle(-fixedRamRadius, windowTopY, -fixedRamBoreRadius,
      fixedRamTopY),
    rectangle(-fixedRamRadius, fixedRamTopY - ramCapThickness, -0.105,
      fixedRamTopY),
    rectangle(0.105, fixedRamTopY - ramCapThickness, fixedRamRadius,
      fixedRamTopY),
  ), 'cut-face-of-ram', fixedRamMaterial);
  fixedRam.add(ramSection);
  const internalPipeWall = mesh(fixedRam,
    horizontalRing(0.077, 0.10, pipeBottomY, fixedRamTopY + 0.06),
    darkMaterial, 'finite-internal-pressure-pipe-wall');
  const internalPressurePipe = mesh(fixedRam,
    // Pass 88: its foot stands 0.005 above the return passage's end face.
    new THREE.CylinderGeometry(0.075, 0.075,
      fixedRamTopY + 0.06 - pipeBottomY - 0.005, 20)
      .translate(0, (fixedRamTopY + 0.06 + pipeBottomY + 0.005) / 2, 0),
    waterMaterial, 'water-pipe-running-up-inside-stationary-ram');

  // Pump barrel and gland on the oblique plunger axis (local y along it,
  // local x toward the pipe side).
  const pumpBarrel = addRole(new THREE.Group(),
    'oblique-pump-barrel-in-foot-of-ram');
  pumpBarrel.matrixAutoUpdate = false;
  pumpBarrel.matrix.makeBasis(
    new THREE.Vector3(plungerNormal.x, plungerNormal.y, 0),
    new THREE.Vector3(plungerAxis.x, plungerAxis.y, 0),
    new THREE.Vector3(0, 0, -1),
  ).setPosition(plungerPinHome.x, plungerPinHome.y, 0);
  root.add(pumpBarrel);
  const squareBore = (half, low, high) => horizontalPlate(
    polygonClipping.difference(
      poly([[-half, -half], [half, -half], [half, half], [-half, half]]),
      poly(circle([0, 0], barrelInnerRadius, 64)),
    ), low, high);
  const gland = mesh(pumpBarrel, mergePassageParts([
    squareBore(0.135, glandStart, glandStart + 0.08),
    squareBore(0.12, glandStart + 0.08, barrelStart),
  ]), frameMaterial, 'square-gland-and-packing-nut-on-ram');
  const pumpCylinder = mesh(pumpBarrel, sidePortedShell(
    barrelInnerRadius, barrelOuterRadius, barrelStart, barrelEnd,
    deliveryPortDistance, 0.035, 1, 0.90,
  ), frameMaterial, 'small-pump-barrel-inside-ram');
  const inletSeat = mesh(pumpBarrel,
    horizontalRing(0.03, barrelOuterRadius, barrelEnd, barrelCapEnd),
    frameMaterial, 'bored-pump-barrel-end-and-inlet-seat');
  const inletValve = mesh(pumpBarrel,
    new THREE.CylinderGeometry(0.06, 0.06, 0.02, 48),
    brassMaterial, 'functional-ram-bore-to-pump-inlet-check-disk');
  const portCentre = pointOnAxis(deliveryPortDistance);
  const feedCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(portCentre.x + plungerNormal.x * 0.10,
      portCentre.y + plungerNormal.y * 0.10, 0),
    new THREE.Vector3(portCentre.x + plungerNormal.x * 0.15,
      portCentre.y + plungerNormal.y * 0.15, 0),
    new THREE.Vector3(-0.101, portCentre.y + plungerNormal.y * 0.15 + 0.01, 0),
  ]);
  const feedPipe = mesh(root, curvedPipeWall(feedCurve, 0.015, 0.024, 32, 20),
    frameMaterial, 'finite-pump-to-internal-pipe-feed');
  const deliveryValveHome = feedCurve.getPoint(0.8);
  const deliveryValveDirection = feedCurve.getTangent(0.8);
  const deliveryValve = mesh(root, new THREE.SphereGeometry(0.012, 16, 10),
    brassMaterial, 'functional-pump-to-internal-ram-pipe-delivery-check-ball');

  // Plunger with its crosshead eye (Brown's upper eye).
  const plunger = addRole(new THREE.Group(),
    'plunger-and-upper-eye-on-straight-oblique-axis');
  root.add(plunger);
  const plungerEye = mesh(plunger,
    new THREE.CylinderGeometry(0.18, 0.18, 0.12, 64).rotateX(Math.PI / 2),
    brassMaterial, 'upper-eye-crosshead-on-plunger');
  const pumpPiston = mesh(plunger, new THREE.CylinderGeometry(
    pumpPlungerRadius, pumpPlungerRadius, plungerTipDistance - 0.07, 48)
    .translate(0, (plungerTipDistance + 0.07) / 2, 0)
    .applyMatrix4(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(plungerNormal.x, plungerNormal.y, 0),
      new THREE.Vector3(plungerAxis.x, plungerAxis.y, 0),
      new THREE.Vector3(0, 0, -1),
    )), darkMaterial, 'small-hand-pump-plunger');
  const plungerPin = mesh(plunger,
    new THREE.CylinderGeometry(0.06, 0.06, 0.90, 32).rotateX(Math.PI / 2)
      .translate(0, 0, -0.37),
    darkMaterial, 'upper-eye-pin-joining-lever-and-plunger');

  // Swing link carrying the lever's fulcrum (Brown's lower eye).
  const swingLink = addRole(new THREE.Group(),
    'swing-link-carrying-lever-fulcrum-from-base-lug');
  swingLink.position.set(swingLinkPivot.x, swingLinkPivot.y, 0);
  root.add(swingLink);
  const swingLinkBar = mesh(swingLink, boredPlanarLinkGeometry({
    length: swingLinkLength, width: 0.11, eyeRadius: 0.15,
    boreRadius: 0.064, depth: 0.08,
  }).translate(0, 0, swingLinkZ), darkMaterial, 'fixed-length-swing-link');
  const fulcrumPin = mesh(swingLink,
    new THREE.CylinderGeometry(0.06, 0.06, 0.38, 32).rotateX(Math.PI / 2)
      .translate(swingLinkLength, 0, -0.63),
    darkMaterial, 'lower-eye-fulcrum-pin');
  const baseLug = mesh(root, new THREE.BoxGeometry(0.25, 0.18, 0.12)
    .translate(baseLeftX - 0.125, swingLinkPivot.y, -0.36),
  frameMaterial, 'lug-on-base-carrying-swing-link');
  const swingLinkAxle = mesh(root,
    // Pass 88: the pin end stands 0.006 inside the lug's front face.
    new THREE.CylinderGeometry(0.06, 0.06, 0.274, 32).rotateX(Math.PI / 2)
      .translate(swingLinkPivot.x, swingLinkPivot.y, -0.443),
    darkMaterial, 'fixed-swing-link-pivot-pin');

  // Long straight lever behind the cylinder: fulcrum, plunger pin, handle.
  const pumpLever = addRole(new THREE.Group(),
    'hand-pump-lever-operating-from-side-of-jack');
  root.add(pumpLever);
  const leverShape = polygonClipping.difference(
    polygonClipping.union(
      // Pass 96: Brown's handle is a socket that widens from the fulcrum
      // eye to the ferrule (half-width 0.055 to 0.10), not a thin strap.
      poly([[-leverShortArm, -0.055], [0.19, -0.055], [leverBandDistance, -0.10],
        [leverBandDistance, 0.10], [0.19, 0.055], [-leverShortArm, 0.055]]),
      poly(circle([0, 0], 0.19, 64)),
      poly(circle([-leverShortArm, 0], 0.19, 64)),
    ),
    poly(circle([0, 0], 0.064, 64)),
    poly(circle([-leverShortArm, 0], 0.064, 64)),
  );
  const leverBar = mesh(pumpLever, plate(leverShape, leverZ - 0.05,
    leverZ + 0.05), leverMaterial, 'straight-hand-lever-with-two-eyes');
  // Pass 98: the ferrule (r 0.115) encloses the socket's end corners, which
  // lie 0.112 from the lever's axis (they stood 0.002 out of an r 0.11 band).
  const leverBand = mesh(pumpLever, new THREE.CylinderGeometry(0.115, 0.115,
    0.07, 48).rotateZ(Math.PI / 2).translate(leverBandDistance, 0, leverZ),
  darkMaterial, 'lever-ferrule-band');
  // Brown's turned grip: a spindle swelling from the ferrule and rounding
  // off at the end.
  const gripLength = leverHandleLength - leverBandDistance + 0.02;
  // Pass 98: one smooth turned profile (a centripetal spline through the old
  // stations, closed by a quarter-ellipse dome), not a polyline ending in a
  // blunt cone.
  const gripSpline = new THREE.CatmullRomCurve3([[0.10, 0], [0.125, 0.10], [0.15, 0.35], [0.155, 0.60],
    [0.14, 0.85], [0.11, 1.02], [0.085, gripLength - 0.09]].map(([r, y]) => new THREE.Vector3(r, y, 0)),
  false, 'centripetal');
  const gripDome = Array.from({ length: 10 }, (_, i) => {
    const t = (i + 1) * Math.PI / 20;
    return new THREE.Vector2(0.085 * Math.cos(t), gripLength - 0.09 + 0.09 * Math.sin(t));
  });
  gripDome[gripDome.length - 1].x = 0;
  const handle = mesh(pumpLever, new THREE.LatheGeometry([new THREE.Vector2(0, 0),
    ...gripSpline.getSpacedPoints(40).map(({ x, y }) => new THREE.Vector2(x, y)), ...gripDome], 40)
    .rotateZ(-Math.PI / 2)
    .translate(leverBandDistance + 0.035, 0, leverZ),
  darkMaterial, 'long-hand-grip-on-pump-lever');

  // Rising cylinder with Brown's cupped head and J-claw.
  const movingCylinder = addRole(new THREE.Group(),
    'moving-cylinder-top-saddle-and-side-claw-rigid-assembly');
  root.add(movingCylinder);
  const drop = -maximumCylinderLift;
  const cylinderShell = mesh(movingCylinder, horizontalPlate(sector(
    cylinderInnerRadius, cylinderOuterRadius, 0, Math.PI),
  movingCylinderBottomY, movingCylinderTopY,
  ), movingMaterial, 'outer-cylinder-sliding-around-fixed-ram');
  const halfDisc = (radius) => poly(Array.from({ length: 65 }, (_, i) => [
    radius * Math.cos(Math.PI * i / 64), radius * Math.sin(Math.PI * i / 64),
  ]));
  const cylinderTopCap = mesh(movingCylinder, horizontalPlate(
    halfDisc(cylinderOuterRadius), drawnBoreTopY + drop, drawnCapTopY + drop,
  ), movingMaterial, 'closed-moving-cylinder-cap-acted-on-by-water-pressure');
  const topSaddle = addRole(new THREE.Group(),
    'upper-saddle-attached-to-moving-cylinder');
  topSaddle.position.y = drop;
  movingCylinder.add(topSaddle);
  const headShape = new THREE.Shape();
  const flare = 0.92;
  headShape.moveTo(-cylinderOuterRadius, drawnCapTopY);
  headShape.lineTo(cylinderOuterRadius, drawnCapTopY);
  headShape.quadraticCurveTo(0.66, drawnHeadTopY - 0.20, flare,
    drawnHeadTopY - 0.03);
  headShape.lineTo(flare, drawnHeadTopY);
  headShape.lineTo(0.43, drawnHeadTopY);
  headShape.absarc(0, drawnHeadTopY + 0.08, 0.44, -0.184,
    -Math.PI + 0.184, true);
  headShape.lineTo(-flare, drawnHeadTopY);
  headShape.lineTo(-flare, drawnHeadTopY - 0.03);
  headShape.quadraticCurveTo(-0.66, drawnHeadTopY - 0.20,
    -cylinderOuterRadius, drawnCapTopY);
  const saddleHead = mesh(topSaddle, new THREE.ExtrudeGeometry(headShape, {
    depth: 0.5, bevelEnabled: false, curveSegments: 24,
  }).translate(0, 0, -0.5), movingMaterial,
  'cast-cupped-head-on-moving-cylinder');
  const sideClaw = addRole(new THREE.Group(),
    'right-side-lifting-claw-attached-to-moving-cylinder');
  sideClaw.position.y = drop;
  movingCylinder.add(sideClaw);
  const clawTop = plateXY(0, 285).y;
  const clawCentreX = plateXY(320, 0).x;
  const clawRadius = 66 * PLATE_UNITS_PER_PIXEL;
  const notchCentreX = plateXY(345, 0).x;
  const notchRadius = notchCentreX - cylinderOuterRadius;
  const hookShape = new THREE.Shape();
  hookShape.moveTo(0.55, clawTop);
  hookShape.lineTo(cylinderOuterRadius, clawTop);
  hookShape.absarc(notchCentreX, clawTop, notchRadius, Math.PI, 0, false);
  hookShape.lineTo(clawCentreX + clawRadius, clawTop);
  hookShape.absarc(clawCentreX, clawTop, clawRadius, 0, -Math.PI / 2, true);
  hookShape.lineTo(0.55, clawTop - clawRadius);
  hookShape.closePath();
  const clawHook = mesh(sideClaw, new THREE.ExtrudeGeometry(hookShape, {
    depth: 0.34, bevelEnabled: false, curveSegments: 24,
  }).translate(0, 0, -0.34), movingMaterial,
  'cast-J-claw-hook-on-moving-cylinder');
  const shapePolygon = (shape, dy) => poly(shape.getPoints(24)
    .map((point) => [point.x, point.y + dy]));
  const cylinderSection = plainSectionFace(polygonClipping.union(
    rectangle(cylinderInnerRadius, movingCylinderBottomY,
      cylinderOuterRadius, movingCylinderTopY),
    rectangle(-cylinderOuterRadius, movingCylinderBottomY,
      -cylinderInnerRadius, movingCylinderTopY),
    rectangle(-cylinderOuterRadius, drawnBoreTopY + drop,
      cylinderOuterRadius, drawnCapTopY + drop + 0.001),
    shapePolygon(headShape, drop),
    shapePolygon(hookShape, drop),
  ), 'cut-face-of-rising-cylinder-head-and-claw', movingMaterial);
  movingCylinder.add(cylinderSection);

  const chamberWaterGap = 0.005;
  const pressureChamber = mesh(root,
    new THREE.CylinderGeometry(fixedRamRadius * 0.95, fixedRamRadius * 0.95,
      1, 48, 1, false, Math.PI / 2, Math.PI),
    waterMaterial,
    'variable-water-chamber-between-fixed-ram-top-and-moving-cap');

  // Winged thumb screw through the base's left wall to the pipe's foot.
  const thumbScrew = addRole(new THREE.Group(),
    'threaded-thumb-screw-metering-return-at-bottom-of-ram-pipe');
  thumbScrew.position.set(thumbScrewClosedX, returnSeatY, 0);
  root.add(thumbScrew);
  const screwShaft = mesh(thumbScrew, new THREE.CylinderGeometry(0.075, 0.075,
    0.79, 48).rotateZ(Math.PI / 2).translate(-0.005, 0, 0),
  brassMaterial, 'thumb-screw-threaded-shaft');
  const thread = {
    inner: 0.075, outer: 0.095, low: -0.30, high: 0.30, width: 0.018,
    lead: thumbScrewPitch / (2 * Math.PI), phase: 0,
  };
  const screwThread = mesh(thumbScrew,
    helicalThread(thread, threadAngles(thread, 64)).rotateY(Math.PI / 2),
    darkMaterial, 'visible-four-turn-helical-thumb-screw-thread');
  const screwTip = mesh(thumbScrew, new THREE.ConeGeometry(0.105, 0.24, 64)
    .rotateZ(-Math.PI / 2).translate(0.51, 0, 0),
  brassMaterial, 'thumb-screw-conical-return-valve-tip');
  // Brown's flat butterfly wing: two rounded lobes above and below the
  // screw, notched between them like a heart laid on its side.
  const wingOutline = polygonClipping.union(
    poly(circle([-0.53, 0.105], 0.115, 64)),
    poly(circle([-0.53, -0.105], 0.115, 64)),
    poly([[-0.56, -0.07], [-0.37, -0.05], [-0.37, 0.05], [-0.56, 0.07]]),
  );
  const screwWing = mesh(thumbScrew, plate(wingOutline, -0.035, 0.035),
    fixedRamMaterial, 'thumb-screw-butterfly-wing');
  const screwWings = [screwWing];
  const returnSeat = mesh(root, horizontalTurned([[-0.20, 0.074375],
    [-0.20, 0.16], [-0.10, 0.16], [-0.10, 0.030625]]).rotateZ(-Math.PI / 2)
    .translate(0, returnSeatY, 0),
  frameMaterial, 'finite-conical-thumb-screw-return-seat');
  const returnPoints = [new THREE.Vector3(0, pipeBottomY, 0),
    new THREE.Vector3(0, returnSeatY + 0.10, 0)];
  for (let i = 1; i <= 24; i += 1) {
    const angle = Math.PI * i / 48;
    returnPoints.push(new THREE.Vector3(-0.10 + 0.10 * Math.cos(angle),
      returnSeatY + 0.10 - 0.10 * Math.sin(angle), 0));
  }
  const returnCurve = new THREE.CatmullRomCurve3(returnPoints);
  const returnPassage = mesh(root, curvedPipeWall(returnCurve, 0.065, 0.09,
    48, 24), frameMaterial,
  'return-passage-from-ram-pipe-valve-to-hollow-base');
  const returnWaterMaterial = waterMaterial.clone();
  const returnWater = mesh(root,
    new THREE.TubeGeometry(returnCurve, 48, 0.040, 10, false),
    returnWaterMaterial,
    'metered-return-water-through-open-thumb-screw-valve');

  const update = (time) => {
    const state = stateAtTime(time);
    plunger.position.copy(state.plungerPin);
    pumpLever.position.copy(state.plungerPin);
    pumpLever.rotation.z = state.leverAngle;
    swingLink.rotation.z = state.swingLinkAngle;
    inletValve.position.y = barrelEnd - 0.01 - 0.015 * state.inletOpenAmount;
    deliveryValve.position.copy(deliveryValveHome)
      .addScaledVector(deliveryValveDirection,
        0.004 * state.deliveryOpenAmount);
    movingCylinder.position.y = state.cylinderLift;
    // Pass 88: the water stands chamberWaterGap off the ram top and the
    // cap underside so neither face is coplanar with a solid one.
    pressureChamber.scale.y = state.pressureChamberHeight - 2 * chamberWaterGap;
    pressureChamber.position.set(
      0,
      fixedRamTopY + state.pressureChamberHeight / 2,
      0,
    );
    const baseWaterHeight = (cavity.maxY - cavity.minY - 0.02)
      * state.baseWaterVolume / baseWaterCapacity;
    baseWater.scale.y = baseWaterHeight;
    baseWater.position.y = cavity.minY + 0.01 + baseWaterHeight / 2;
    thumbScrew.rotation.x = state.thumbScrewAngle;
    thumbScrew.position.x = thumbScrewClosedX - state.thumbScrewRetreat;
    // The return passage stands full of water; the thumb-screw's retreat,
    // not water switching on, shows the metered return.
    returnWater.visible = true;
    returnWaterMaterial.opacity = 0.5;
  };

  const sourceState = stateAtPhase(sourcePhase);
  const geometry = {
    chamberWaterGap,
    baseInitialWaterVolume,
    baseWaterCapacity,
    cycleDuration,
    fixedRamArea,
    fixedRamBaseY,
    fixedRamHeight,
    fixedRamRadius,
    fixedRamTopY,
    glandStart,
    groundY,
    hydraulicAreaRatio,
    initialPressureChamberHeight,
    leverHandleLength,
    leverShortArm,
    loweringEndPhase,
    loweringStartPhase,
    maximumCylinderLift,
    maximumDeliveredVolume,
    maximumStrokeAngle,
    movingCylinderBottomY,
    movingCylinderHeight,
    movingCylinderTopY,
    nominalPistonSpeed,
    operationEndPhase,
    plungerAxis: plungerAxis.clone(),
    plungerPinHome: plungerPinHome.clone(),
    plungerTipDistance,
    pumpCycleCount,
    pumpPlungerArea,
    pumpPlungerRadius,
    pumpStrokeLength,
    returnSeatY,
    sourcePhase,
    swingLinkLength,
    swingLinkPivot: swingLinkPivot.clone(),
    thumbScrewClosedX,
    thumbScrewMaximumAngle,
    thumbScrewMaximumRetreat,
    thumbScrewMaximumTurns,
    thumbScrewPitch,
  };
  root.userData = {
    archetype:
      'robertson-hydrostatic-jack-with-fixed-hollow-ram-rising-cylinder-claw-internal-feed-and-thumb-screw-return',
    blocks: {
      baseFloorPlate,
      baseLug,
      baseSection,
      baseShell,
      baseTopPlate,
      baseWater,
      clawHook,
      cylinderSection,
      cylinderShell,
      cylinderTopCap,
      deliveryValve,
      feedPipe,
      fixedRam,
      fixedRamBody,
      foundation,
      fulcrumPin,
      gland,
      handle,
      hollowBase,
      inletSeat,
      inletValve,
      internalPipeWall,
      internalPressurePipe,
      leverBand,
      leverBar,
      movingCylinder,
      plunger,
      plungerEye,
      plungerPin,
      pressureChamber,
      pumpBarrel,
      pumpCylinder,
      pumpLever,
      pumpPiston,
      ramSection,
      returnPassage,
      returnSeat,
      returnWater,
      saddleHead,
      screwShaft,
      screwThread,
      screwTip,
      screwWings,
      sideClaw,
      swingLink,
      swingLinkAxle,
      swingLinkBar,
      thumbScrew,
      topSaddle,
    },
    degreesOfFreedom: {
      cylinderAndClawIndependent: false,
      fixedRamTranslates: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      thumbScrewReturnScheduledAfterPumping: true,
    },
    deliveredLengthAtStrokeAngle,
    dynamics: {
      compressibilitySealLeakageLoadMassFrictionValveImpactPipeLossesAndStructuralDeflectionModeled:
        false,
      loweringModel:
        'One full thumb-screw turn retracts the conical tip by one thread pitch while the trapped volume returns with a C2 metered profile. After lowering, the unloaded screw turns back onto its seat before the loop closes.',
      volumeModel:
        'Each return stroke of the small plunger adds A_pump times travel to the chamber above the stationary ram; the complete moving cylinder and claw assembly rises by that volume divided by fixed-ram area.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The central hollow ram is rigidly fixed to the small hollow base. The hand lever is pinned at its upper eye to a plunger working obliquely through a gland into a barrel in the foot of the ram, and its fulcrum (the lower eye) rides on a swing link from the base, so the plunger pin runs straight. The withdrawing plunger draws water from the base up the ram bore; the returning plunger delivers it into the pipe inside the ram and so beneath the closed cap of the outer cylinder. Pressure raises the cylinder, cupped head and claw as one rigid assembly. Turning the bottom thumb-screw off its seat meters the same water back into the base and gradually lowers the assembly.',
    motion: {
      cycleDuration,
      motionType:
        'twelve-volume-accumulating-plunger-strokes-hold-one-turn-threaded-metered-lowering-and-screw-reseat',
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
      cylinderLift: sourceState.cylinderLift,
      leverAngle: sourceState.leverAngle,
      phase: sourcePhase,
      pistonPosition: sourceState.piston.clone(),
      thumbScrewAngle: sourceState.thumbScrewAngle,
    },
    sourceReference: {
      brownPlate467: {
        approximateHollowBaseBoundsPixels: [209, 419, 131, 83],
        approximateMovingCylinderAndClawBoundsPixels: [204, 57, 185, 372],
        approximatePumpLinkageBoundsPixels: [130, 328, 113, 126],
        approximateThumbScrewBoundsPixels: [177, 438, 105, 44],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
        measuredLinkagePixels: {
          glandCentre: [233, 400],
          leverFulcrumLowerEye: [150, 401],
          plungerPinUpperEye: [205, 355.5],
          swingLinkBasePivot: [195, 442],
        },
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the ram is stationary upon a hollow base',
          'the cylinder and attached claw slide upon the ram',
          'the pump takes water from the hollow base',
          'water is forced through a pipe inside the ram into the cylinder',
          'a bottom thumb-screw valve lets water back to lower gradually',
        ],
        engravingEvidence:
          'Brown shows a narrow sectioned column: a small hollow base little wider than the cylinder, a central fixed hollow ram with an internal pipe, a tall outer sliding body carrying a cupped head and a J-claw, a long hand lever whose upper and lower eyes sit at the lower left with square gland blocks on the ram, and a winged horizontal return screw at the internal pipe foot.',
        reconstructionDisclosure:
          'Brown gives no dimensions, area ratio, stroke, pump count, thread pitch, screw turns, return coefficient, load or timing, and does not show the pump barrel. The reading of the lower-left linkage as a plunger pinned at the upper eye with a floating fulcrum on a swing link, the oblique barrel in the ram foot, a 4.67:1 ram/plunger radius ratio, twelve exact plunger strokes, one 0.045-pitch screw turn, C2 metered lowering and reseating, depths, colors and a 14-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 467',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      internalFeed:
        'hollow base reservoir -> ram bore -> inlet check -> oblique plunger barrel in ram foot -> delivery check -> pipe inside fixed ram -> variable chamber under moving cylinder cap',
      linkage:
        'lever fulcrum on swing link (|fulcrum-pivot| fixed), lever pinned to plunger at fixed short arm, plunger pin on a straight axis',
      movingMembers:
        'outer cylinder + cupped head + side claw share exactly one translation; fixed ram and base remain stationary',
      screw:
        'axial retreat=pitch*rotation/(2*pi); opening meters chamber water back to the hollow base',
      volume:
        'A_pump*sum(delivery return strokes)=A_fixed_ram*cylinder lift',
    },
    update,
    solidReview: {
      status: 'qualified-geometry',
      residual: 'Ideal hydraulic volume law and prescribed checks/return retained. Conical screw seat is geometric; passive valve forces, seals, leakage, pressure losses and load dynamics are not solved.',
    },
  };
  root.userData.groundFloorY = groundY;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  fitPistonGuide(root, update, cycleDuration);
  // Brown's section is a flat elevation.
  root.userData.cameraFov = 10;
  root.userData.cameraDirection = new THREE.Vector3(0, 0.3, 15);
  markShadows(root);
  foundation.receiveShadow = true;
  for (const object of [baseWater, internalPressurePipe, pressureChamber,
    returnWater]) object.castShadow = false;
  for (const section of [baseSection, ramSection, cylinderSection]) {
    section.castShadow = false;
  }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredRobertsonJackMovement(movement) {
  if (movement.id !== 467) return null;
  return robertsonJack(movement);
}
