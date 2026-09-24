import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  makeShaft,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

import { correctSpinningFanParts } from './spinning-fan-working-parts.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function cylinderBetween(
  start,
  end,
  startRadius,
  endRadius,
  material,
  role,
  sides = 20,
) {
  const direction = end.clone().sub(start);
  const mesh = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      endRadius,
      startRadius,
      direction.length(),
      sides,
    ),
    material,
  ), role);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    Y_AXIS,
    direction.clone().normalize(),
  );
  return mesh;
}

function tubeThrough(points, radius, material, role, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, radius, 10, false),
    material,
  ), role);
  tube.userData.centerline = curve;
  return tube;
}

function makeFlutedRoll({
  center,
  color,
  length,
  radius,
  role,
}) {
  const roll = addRole(new THREE.Group(), role);
  roll.position.copy(center);
  const material = matte(color, { metalness: 0.2, roughness: 0.5 });
  const body = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 48),
    material,
  ), `${role}-body`);
  body.rotation.x = Math.PI / 2;
  roll.add(body);
  const ribMaterial = matte(color, { metalness: 0.23, roughness: 0.45 });
  const ribs = [];
  // Brown sections A and B as plain smooth rolls; no flutes are drawn.
  const fluteCount = 0;
  for (let index = 0; index < fluteCount; index += 1) {
    const angle = index / fluteCount * Math.PI * 2;
    const rib = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.10, length * 0.96),
      ribMaterial,
    ), `${role}-flute-${index + 1}`);
    rib.position.set(
      Math.cos(angle) * radius * 0.925,
      Math.sin(angle) * radius * 0.925,
      0,
    );
    rib.rotation.z = angle;
    ribs.push(rib);
    roll.add(rib);
  }
  const axle = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: length + 0.48,
    radius: 0.065,
  });
  axle.userData.role = `${role}-axle`;
  roll.add(axle);
  const index = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.72, 0.055, length + 0.04),
    matte(PALETTE.white, { roughness: 0.43 }),
  ), `${role}-visible-index`);
  index.position.x = radius * 0.5;
  roll.add(index);
  roll.userData.axis = Z_AXIS.clone();
  roll.userData.body = body;
  roll.userData.radius = radius;
  roll.userData.ribs = ribs;
  return roll;
}

function throstleDrawingAndTwisting(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const cycleDuration = 6;
  // Plate proportions: equal A and B rolls about 0.45 of the flyer width,
  // their centres 1.85 roll diameters apart.
  const rollRadius = 0.40;
  const rollLength = 1.55;
  const nipY = 2.4;
  const backCenterX = -1.36;
  const frontCenterX = 0.12;
  const backTurnsPerCycle = 1;
  const frontTurnsPerCycle = 2;
  const flyerTurnsPerCycle = 6;
  const bobbinTurnsPerCycle = 4;
  const backAngularSpeed = fullTurn * backTurnsPerCycle / cycleDuration;
  const frontAngularSpeed = fullTurn * frontTurnsPerCycle / cycleDuration;
  const flyerAngularSpeed = fullTurn * flyerTurnsPerCycle / cycleDuration;
  const bobbinAngularSpeed = fullTurn * bobbinTurnsPerCycle / cycleDuration;
  const flyerBobbinRelativeAngularSpeed =
    flyerAngularSpeed - bobbinAngularSpeed;
  const windingRadius = rollRadius;
  const backDeliverySpeed = rollRadius * backAngularSpeed;
  const frontDeliverySpeed = rollRadius * frontAngularSpeed;
  const windingTakeUpSpeed =
    windingRadius * flyerBobbinRelativeAngularSpeed;
  const draftRatio = frontDeliverySpeed / backDeliverySpeed;
  const rollCenters = {
    backBottom: new THREE.Vector3(
      backCenterX,
      nipY - rollRadius - 0.030,
      0,
    ),
    backTop: new THREE.Vector3(
      backCenterX,
      nipY + rollRadius + 0.030,
      0,
    ),
    frontBottom: new THREE.Vector3(
      frontCenterX,
      nipY - rollRadius - 0.030,
      0,
    ),
    frontTop: new THREE.Vector3(
      frontCenterX,
      nipY + rollRadius + 0.030,
      0,
    ),
  };

  const backTopRoll = makeFlutedRoll({
    center: rollCenters.backTop,
    color: PALETTE.accent,
    length: rollLength,
    radius: rollRadius,
    role: 'upper-back-drawing-roll-A',
  });
  const backBottomRoll = makeFlutedRoll({
    center: rollCenters.backBottom,
    color: PALETTE.accent,
    length: rollLength,
    radius: rollRadius,
    role: 'lower-back-drawing-roll-A',
  });
  const frontTopRoll = makeFlutedRoll({
    center: rollCenters.frontTop,
    color: PALETTE.driver,
    length: rollLength,
    radius: rollRadius,
    role: 'upper-front-drawing-roll-B',
  });
  const frontBottomRoll = makeFlutedRoll({
    center: rollCenters.frontBottom,
    color: PALETTE.driver,
    length: rollLength,
    radius: rollRadius,
    role: 'lower-front-drawing-roll-B',
  });
  const drawingRolls = [
    backTopRoll,
    backBottomRoll,
    frontTopRoll,
    frontBottomRoll,
  ];

  const fiberMaterial = matte(PALETTE.brass, {
    metalness: 0.0,
    roughness: 0.92,
  });
  const inputFiberStart = new THREE.Vector3(-2.90, nipY, 0);
  const backNip = new THREE.Vector3(backCenterX, nipY, 0);
  const frontNip = new THREE.Vector3(frontCenterX, nipY, 0);
  const inputSliver = cylinderBetween(
    inputFiberStart,
    backNip,
    0.115,
    0.115,
    fiberMaterial,
    'thick-roving-entering-back-rolls-A',
  );
  const draftedFiber = cylinderBetween(
    backNip,
    frontNip,
    0.11,
    0.046,
    fiberMaterial,
    'roving-attenuated-between-slower-A-and-faster-B',
  );

  const spindleOrigin = new THREE.Vector3(0.42, -0.62, 0);
  const topGuideLocal = new THREE.Vector3(0, 1.46, 0);
  const flyerEyeLocal = new THREE.Vector3(0.86, -0.66, 0);
  const windingContactLocal = new THREE.Vector3(
    windingRadius,
    -0.24,
    0,
  );
  const topGuide = spindleOrigin.clone().add(topGuideLocal);

  const flyerAssembly = addRole(
    new THREE.Group(),
    'rotating-throstle-flyer-and-spindle',
  );
  flyerAssembly.position.copy(spindleOrigin);
  const flyerMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.45,
  });
  // Brown's flyer is a close inverted U: a low arch just over the bobbin,
  // parallel legs beside the package and a small eye at each foot.
  const flyerArmPoints = (side) => [
    new THREE.Vector3(0, 1.24, 0),
    new THREE.Vector3(side * 0.42, 1.18, 0),
    new THREE.Vector3(side * 0.76, 0.96, 0),
    new THREE.Vector3(side * 0.86, 0.55, 0),
    new THREE.Vector3(side * 0.86, -0.40, 0),
    new THREE.Vector3(side * 0.86, flyerEyeLocal.y + 0.12, 0),
  ];
  const leftArm = tubeThrough(flyerArmPoints(-1), 0.075, flyerMaterial,
    'left-arm-of-rotating-throstle-flyer');
  const rightArm = tubeThrough(flyerArmPoints(1), 0.075, flyerMaterial,
    'yarn-guiding-arm-of-rotating-throstle-flyer');
  const spindle = makeShaft({
    axis: Y_AXIS,
    color: PALETTE.ink,
    length: 3.55,
    radius: 0.065,
  });
  spindle.userData.role = 'vertical-spindle-fast-with-flyer';
  const whorl = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.18, 38),
    flyerMaterial,
  ), 'driving-whorl-on-flyer-spindle');
  whorl.position.y = -1.55;
  const flyerTopEye = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.035, 10, 32),
    matte(PALETTE.ink, { metalness: 0.26, roughness: 0.43 }),
  ), 'central-yarn-eye-above-flyer');
  flyerTopEye.rotation.x = Math.PI / 2;
  flyerTopEye.position.copy(topGuideLocal);
  const flyerArmEye = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.032, 10, 30),
    matte(PALETTE.ink, { metalness: 0.26, roughness: 0.43 }),
  ), 'yarn-eye-at-end-of-flyer-arm');
  flyerArmEye.position.copy(flyerEyeLocal);
  const flyerLeftFootEye = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.032, 10, 30),
    flyerArmEye.material,
  ), 'eye-at-foot-of-left-flyer-arm');
  flyerLeftFootEye.position.set(-flyerEyeLocal.x, flyerEyeLocal.y, 0);
  flyerAssembly.add(
    flyerLeftFootEye,
    leftArm,
    rightArm,
    spindle,
    whorl,
    flyerTopEye,
    flyerArmEye,
  );

  const bobbinAssembly = addRole(
    new THREE.Group(),
    'slower-yarn-dragged-bobbin-with-wound-package',
  );
  bobbinAssembly.position.copy(spindleOrigin);
  const bobbinMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const bobbinBarrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 1.42, 42),
    bobbinMaterial,
  ), 'wooden-bobbin-barrel');
  bobbinBarrel.position.y = -0.18;
  const bobbinFlanges = [-0.91, 0.55].map((y, index) => {
    const flange = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.49, 0.11, 42),
      bobbinMaterial,
    ), `bobbin-end-disc-${index + 1}`);
    flange.position.y = y;
    return flange;
  });
  const wrapPoints = [];
  const wrapTurns = 12;
  const wrapSamples = wrapTurns * 18;
  for (let sample = 0; sample <= wrapSamples; sample += 1) {
    const fraction = sample / wrapSamples;
    const angle = fullTurn * wrapTurns * fraction;
    wrapPoints.push(new THREE.Vector3(
      Math.cos(angle) * windingRadius,
      THREE.MathUtils.lerp(-0.78, 0.42, fraction),
      -Math.sin(angle) * windingRadius,
    ));
  }
  const woundYarn = tubeThrough(
    wrapPoints,
    0.026,
    fiberMaterial,
    'visible-helical-yarn-package-on-bobbin',
    wrapSamples,
  );
  bobbinAssembly.add(bobbinBarrel, ...bobbinFlanges, woundYarn);

  const liveYarn = makeDynamicCable({
    color: PALETTE.brass,
    maxSegments: 36,
    radius: 0.026,
  });
  liveYarn.userData.role =
    'continuous-yarn-from-front-rolls-through-flyer-eye-to-bobbin';
  liveYarn.userData.isYarn = true;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.1,
    roughness: 0.72,
  });
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.0, 0.22, 2.7),
    frameMaterial,
  ), 'fixed-throstle-bed');
  base.position.set(-0.25, -2.03, 0);
  base.userData.fixed = true;
  const rollStandX = [-2.62, 0.7];
  const rollStandMembers = [];
  for (const x of rollStandX) {
    for (const z of [-0.93, 0.93]) {
      const post = makeBeam(
        new THREE.Vector3(x, -1.9, z),
        new THREE.Vector3(x, 3.23, z),
        { color: PALETTE.frame, thickness: 0.14, depth: 0.15 },
      );
      post.userData.fixed = true;
      post.userData.role = 'fixed-drawing-roll-bearing-standard';
      rollStandMembers.push(post);
    }
  }
  const rollBearingMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.45,
  });
  const rollBearings = [];
  for (const center of Object.values(rollCenters)) {
    for (const z of [-0.84, 0.84]) {
      const bearing = addRole(new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.045, 9, 30),
        rollBearingMaterial,
      ), 'fixed-bearing-for-drawing-roll');
      bearing.position.set(center.x, center.y, z);
      bearing.userData.fixed = true;
      rollBearings.push(bearing);
    }
  }
  const spindleBearing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.06, 10, 36),
    rollBearingMaterial,
  ), 'fixed-lower-spindle-bearing');
  spindleBearing.rotation.x = Math.PI / 2;
  spindleBearing.position.copy(spindleOrigin).add(new THREE.Vector3(0, -1.68, 0));
  spindleBearing.userData.fixed = true;

  root.add(
    base,
    ...rollStandMembers,
    ...rollBearings,
    spindleBearing,
    ...drawingRolls,
    inputSliver,
    draftedFiber,
    flyerAssembly,
    bobbinAssembly,
    liveYarn,
  );

  // The yarn leaves the B nip, follows the right side of the lower B roll,
  // drops to the top eye, leaves the slotted neck, runs beside the right
  // flyer leg, threads its foot eye and winds on at the package.
  const lowerFrontRollCenter = rollCenters.frontBottom;
  const yarnWrapRadius = rollRadius + 0.058;
  const yarnWrapPoints = [0, 1, 2, 3].map((index) => {
    const angle = index * Math.PI / 6;
    return new THREE.Vector3(
      lowerFrontRollCenter.x + yarnWrapRadius * Math.sin(angle),
      lowerFrontRollCenter.y + yarnWrapRadius * Math.cos(angle),
      0,
    );
  });
  yarnWrapPoints[0] = frontNip.clone();
  const sourceYarnCurve = (angle, eye, contact) => {
    const rotate = (x, y, z) => new THREE.Vector3(x, y, z)
      .applyAxisAngle(Y_AXIS, angle).add(spindleOrigin);
    return new THREE.CatmullRomCurve3([
      ...yarnWrapPoints,
      new THREE.Vector3(0.52, 1.30, 0),
      new THREE.Vector3(topGuide.x, topGuide.y + 0.16, 0),
      topGuide.clone(),
      rotate(0, 1.37, 0), rotate(0.22, 1.37, 0),
      rotate(0.46, 1.30, 0.15), rotate(0.80, 1.00, 0.16),
      rotate(0.88, 0.55, 0.16), rotate(0.88, -0.40, 0.16),
      rotate(flyerEyeLocal.x, flyerEyeLocal.y, 0.15), eye,
      rotate(flyerEyeLocal.x - 0.03, flyerEyeLocal.y + 0.05, -0.13),
      contact,
    ], false, 'centripetal');
  };

  const stateAtTime = (time) => {
    const backRollAngle = backAngularSpeed * time;
    const frontRollAngle = frontAngularSpeed * time;
    const flyerAngle = flyerAngularSpeed * time;
    const bobbinAngle = bobbinAngularSpeed * time;
    const relativeWindingAngle = flyerAngle - bobbinAngle;
    const flyerEye = spindleOrigin.clone().add(
      flyerEyeLocal.clone().applyAxisAngle(Y_AXIS, flyerAngle),
    );
    const windingContact = spindleOrigin.clone().add(
      windingContactLocal.clone().applyAxisAngle(Y_AXIS, flyerAngle),
    );
    const liveYarnCurve = sourceYarnCurve(flyerAngle, flyerEye,
      windingContact);
    const backMaterialVelocity = X_AXIS.clone().multiplyScalar(
      backDeliverySpeed,
    );
    const frontMaterialVelocity = X_AXIS.clone().multiplyScalar(
      frontDeliverySpeed,
    );
    return {
      backBottomRollAngle: -backRollAngle,
      backDeliverySpeed,
      backBottomNipVelocity: backMaterialVelocity.clone(),
      backRollAngle,
      backTopRollAngle: backRollAngle,
      backTopNipVelocity: backMaterialVelocity.clone(),
      bobbinAngle,
      bobbinAngularSpeed,
      draftRatio,
      flyerAngle,
      flyerAngularSpeed,
      flyerBobbinRelativeAngularSpeed,
      flyerEye,
      frontBottomRollAngle: -frontRollAngle,
      frontDeliverySpeed,
      frontBottomNipVelocity: frontMaterialVelocity.clone(),
      frontRollAngle,
      frontTopRollAngle: frontRollAngle,
      frontTopNipVelocity: frontMaterialVelocity.clone(),
      liveYarnCurve,
      liveYarnPoints: liveYarnCurve.getSpacedPoints(36),
      relativeWindingAngle,
      windingContact,
      windingContactAngleInBobbinFrame: relativeWindingAngle,
      windingSpeedClosureError: windingTakeUpSpeed - frontDeliverySpeed,
      windingTakeUpSpeed,
    };
  };

  const initial = stateAtTime(0);
  const closure = stateAtTime(cycleDuration);
  root.userData.archetype =
    'differential-drawing-rolls-feeding-flyer-around-slower-bobbin';
  root.userData.mechanism =
    'slower-opposed-A-rolls-feed-roving-to-faster-opposed-B-rolls-then-throstle-flyer-twists-and-winds-on-differentially-slower-bobbin';
  root.userData.blocks = {
    backBottomRoll,
    backRollsA: [backTopRoll, backBottomRoll],
    backTopRoll,
    base,
    bobbinAssembly,
    bobbinBarrel,
    bobbinFlanges,
    draftedFiber,
    drawingRolls,
    flyerArmEye,
    flyerLeftFootEye,
    flyerArms: [leftArm, rightArm],
    flyerAssembly,
    flyerTopEye,
    frontBottomRoll,
    frontRollsB: [frontTopRoll, frontBottomRoll],
    frontTopRoll,
    inputSliver,
    liveYarn,
    rollBearings,
    rollStandMembers,
    spindle,
    spindleBearing,
    whorl,
    woundYarn,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.3, -2.2, -1.65),
    new THREE.Vector3(3.9, 3.55, 1.65),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cycleDuration,
    halfCycle: cycleDuration / 2,
    quarterCycle: cycleDuration / 4,
    sourcePose: 0,
  };
  root.userData.degreesOfFreedom = {
    independentDriveInputs: 1,
    independentBobbinCoordinates: 0,
    independentFlyerCoordinates: 0,
    independentRollCoordinates: 0,
  };
  root.userData.geometry = {
    backCenterX,
    backNip,
    cycleDuration,
    flyerEyeLocal,
    frontCenterX,
    frontNip,
    inputFiberStart,
    nipY,
    rollCenters,
    rollLength,
    rollRadius,
    spindleOrigin,
    topGuide,
    topGuideLocal,
    windingContactLocal,
    windingRadius,
  };
  root.userData.groundFloorY = -2.14;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 496 page marks Animated unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    historicalCorroboration: {
      detail:
        'Ure describes the throstle as drawing roving into slender thread while rotating the spindle or flyer, guiding yarn through a flyer eye, and using bobbin drag plus flyer motion to wind it.',
      pages: [97, 98, 99, 100, 101],
      title:
        'The Cotton Manufacture of Great Britain, Vol. II (Andrew Ure, 1836)',
      url:
        'https://archive.org/details/cottonmanufactur02urea/page/n119/mode/2up',
    },
    officialDescription: movement.description,
    officialEngraving: {
      labels: {
        backDrawingRolls: 'A',
        frontDrawingRolls: 'B',
      },
      sourceUrl: movement.sourceUrl,
    },
    reconstructionDisclosure:
      'The official animation is unavailable and Brown gives no numerical ratios. The model chooses exact 1:2 A-to-B roller turns and 6:4 flyer-to-bobbin turns while enforcing equal front delivery and differential take-up speed.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    backAngularSpeed,
    backDeliverySpeed,
    backTurnsPerCycle,
    bobbinAngularSpeed,
    bobbinTurnsPerCycle,
    draftRatio,
    flyerAngularSpeed,
    flyerBobbinRelativeAngularSpeed,
    flyerTurnsPerCycle,
    frontAngularSpeed,
    frontDeliverySpeed,
    frontTurnsPerCycle,
    topAndBottomRollsCounterrotate: true,
    verifiedBackTurns: (
      closure.backTopRollAngle - initial.backTopRollAngle
    ) / fullTurn,
    verifiedBobbinTurns: (
      closure.bobbinAngle - initial.bobbinAngle
    ) / fullTurn,
    verifiedFlyerTurns: (
      closure.flyerAngle - initial.flyerAngle
    ) / fullTurn,
    verifiedFrontTurns: (
      closure.frontTopRollAngle - initial.frontTopRollAngle
    ) / fullTurn,
    verifiedRelativeWindingTurns: (
      closure.relativeWindingAngle - initial.relativeWindingAngle
    ) / fullTurn,
    windingSpeedClosureError:
      windingTakeUpSpeed - frontDeliverySpeed,
    windingTakeUpSpeed,
  };
  root.userData.cameraDistanceScale = 1.03;

  const update = (time) => {
    const state = stateAtTime(time);
    backTopRoll.rotation.z = state.backTopRollAngle;
    backBottomRoll.rotation.z = state.backBottomRollAngle;
    frontTopRoll.rotation.z = state.frontTopRollAngle;
    frontBottomRoll.rotation.z = state.frontBottomRollAngle;
    flyerAssembly.rotation.y = state.flyerAngle;
    bobbinAssembly.rotation.y = state.bobbinAngle;
    liveYarn.userData.setPoints(state.liveYarnPoints);
    backTopRoll.userData.angularSpeed = backAngularSpeed;
    backBottomRoll.userData.angularSpeed = -backAngularSpeed;
    frontTopRoll.userData.angularSpeed = frontAngularSpeed;
    frontBottomRoll.userData.angularSpeed = -frontAngularSpeed;
    flyerAssembly.userData.angularSpeed = flyerAngularSpeed;
    bobbinAssembly.userData.angularSpeed = bobbinAngularSpeed;
    root.userData.contacts = {
      backNip: {
        materialSpeed: backDeliverySpeed,
        point: backNip,
        rollSurfaceSpeedError: 0,
      },
      frontNip: {
        materialSpeed: frontDeliverySpeed,
        point: frontNip,
        rollSurfaceSpeedError: 0,
      },
      windingContact: {
        differentialSurfaceSpeed: windingTakeUpSpeed,
        feedSpeed: frontDeliverySpeed,
        point: state.windingContact,
        speedClosureError: state.windingSpeedClosureError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  markShadows(root);
  correctSpinningFanParts(root, 496);
  fitThrostleToPlate(root);
  return {
    root,
    update,
    cameraDirection: root.userData.cameraDirection,
  };
}

// Applied after the finite working-parts correction: keep its bored bearings,
// neck and spindle, but restore smooth full-radius rolls, Brown's close
// inverted-U flyer leg and a barrel inside the winding radius.
function fitThrostleToPlate(root) {
  const b = root.userData.blocks;
  const g = root.userData.geometry;
  const bored = (radius, bore, height) => boredLatheGeometry([
    { radial: radius, axial: -height / 2 },
    { radial: radius, axial: height / 2 },
  ], bore, 64);
  const swap = (mesh, geometry) => {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
  };
  for (const roll of b.drawingRolls) {
    swap(roll.userData.body, bored(g.rollRadius, 0.069, g.rollLength));
    for (const rib of roll.userData.ribs) {
      rib.removeFromParent();
      rib.geometry.dispose();
    }
    roll.userData.ribs = [];
  }
  swap(b.flyerArms[1], new THREE.TubeGeometry(
    b.flyerArms[1].userData.centerline, 64, 0.075, 10, false));
  // Wound yarn centreline lies on the winding radius; the barrel sits just
  // inside the yarn.
  swap(b.bobbinBarrel, bored(g.windingRadius - 0.03, 0.069, 1.42));
  b.spindleBearing.position.y = g.spindleOrigin.y - 1.75;
  // Brown's spindle runs well below the bobbin: through the rail bearing to a
  // small grooved whorl and down to its footstep.
  const spindleBottomLocal = -3.0;
  const spindleTopLocal = 1.19;
  const shaft = b.spindle.userData.rotor.children[0];
  swap(shaft, new THREE.CylinderGeometry(0.065, 0.065,
    spindleTopLocal - spindleBottomLocal, 32));
  b.spindle.position.y = (spindleTopLocal + spindleBottomLocal) / 2;
  swap(b.whorl, boredLatheGeometry([
    { radial: 0.26, axial: -0.10 }, { radial: 0.15, axial: 0 },
    { radial: 0.26, axial: 0.10 },
  ], 0.067, 64));
  b.whorl.position.y = -2.40;
  const footstep = new THREE.Mesh(bored(0.17, 0.069, 0.22),
    b.spindleBearing.material);
  footstep.position.set(g.spindleOrigin.x, g.spindleOrigin.y + spindleBottomLocal - 0.03,
    g.spindleOrigin.z);
  footstep.userData.role = 'fixed-footstep-bearing-under-spindle';
  footstep.userData.fixed = true;
  const footstepFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 48),
    b.spindleBearing.material);
  footstepFloor.position.copy(footstep.position);
  footstepFloor.position.y -= 0.135;
  footstepFloor.userData.role = 'fixed-footstep-bearing-under-spindle';
  footstepFloor.userData.fixed = true;
  root.add(footstep, footstepFloor);
  b.footstep = footstep;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.0, g.spindleOrigin.y + spindleBottomLocal - 0.25, -1.1),
    new THREE.Vector3(1.45, g.nipY + 2 * g.rollRadius + 0.3, 1.1),
  );
  root.userData.groundFloorY = g.spindleOrigin.y + spindleBottomLocal - 0.2;
  // Brown's plate is a plain side elevation along the roll axes; a long lens
  // keeps the rolls end-on as the section circles he draws.
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 1);
  root.userData.cameraFov = 14;
}

export function createAuthoredThrostleSpinningMovement(movement) {
  if (movement.id !== 496) return null;
  return throstleDrawingAndTwisting(movement);
}
