import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { correctGyroscopeParts } from './gyroscope-working-parts.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongX(radius, length, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 48) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusNormalToZ(
  majorRadius,
  tubeRadius,
  material,
  radialSegments = 14,
  tubularSegments = 112,
) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(
      majorRadius,
      tubeRadius,
      radialSegments,
      tubularSegments,
    ),
    material,
  );
}

function torusNormalToX(
  majorRadius,
  tubeRadius,
  material,
  radialSegments = 14,
  tubularSegments = 96,
) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(
      majorRadius,
      tubeRadius,
      radialSegments,
      tubularSegments,
    ),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function torusNormalToY(
  majorRadius,
  tubeRadius,
  material,
  radialSegments = 14,
  tubularSegments = 112,
) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(
      majorRadius,
      tubeRadius,
      radialSegments,
      tubularSegments,
    ),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function singleSupportSteadyPrecessionGyroscope(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const gravity = 9.81;

  // Proportions are measured from Brown's 525 px plate.  The ring and disk
  // share a horizontal diameter; the left-hand pintle lies outside the ring
  // and supports the complete moving assembly from one point.
  const sourceScale = 0.0117;
  const sourceSupportPivotRaster = new THREE.Vector2(109, 206);
  const sourceRotorCenterRaster = new THREE.Vector2(291, 205);
  const sourceRingLeftRaster = new THREE.Vector2(149, 204);
  const sourceRingRightRaster = new THREE.Vector2(452, 207);
  const sourceDiskTopRaster = new THREE.Vector2(291, 56);
  const sourceDiskBottomRaster = new THREE.Vector2(291, 345);
  const sourcePillarBaseRaster = new THREE.Vector2(110, 422);
  const sourceSupportToCenterPixels =
    sourceRotorCenterRaster.x - sourceSupportPivotRaster.x;
  const sourceDiskRadiusPixels =
    (sourceDiskBottomRaster.y - sourceDiskTopRaster.y) / 2;
  const sourceRingRadiusPixels =
    (sourceRingRightRaster.x - sourceRingLeftRaster.x) / 2;

  const supportToCenter = sourceSupportToCenterPixels * sourceScale;
  const ringRadius = sourceRingRadiusPixels * sourceScale;
  const diskRadius = sourceDiskRadiusPixels * sourceScale;
  const supportPivot = new THREE.Vector3(0, 1.22, 0);
  const ringTubeRadius = 0.13;
  const diskThickness = 0.34;
  const spindleRadius = 0.09;
  const spindleHalfLength = ringRadius + 0.38;
  const spindleLeftLength = ringRadius - 0.13;
  const bearingOffset = ringRadius - 0.16;
  const bearingOuterRadius = 0.22;
  const bearingLength = 0.34;
  const hubRadius = 0.27;
  const hubLength = diskThickness + 0.28;
  const pintleRadius = 0.095;
  const pintleLength = 0.3;

  // Masses are explicit so every rate can be audited.  Only the disk, hub,
  // spindle, and end knob spin about the rotor axis; every listed component
  // contributes to the gravity moment about the single support F.
  const physicalComponents = [
    {
      centerOffset: supportToCenter,
      mass: 3.1,
      name: 'metallic disk C',
      spinsWithRotor: true,
      spinInertia: 0.5 * 3.1 * diskRadius ** 2,
    },
    {
      centerOffset: supportToCenter,
      mass: 0.34,
      name: 'disk hub',
      spinsWithRotor: true,
      spinInertia: 0.5 * 0.34 * hubRadius ** 2,
    },
    {
      centerOffset: supportToCenter,
      mass: 0.26,
      name: 'spindle',
      spinsWithRotor: true,
      spinInertia: 0.5 * 0.26 * spindleRadius ** 2,
    },
    {
      centerOffset: supportToCenter + spindleHalfLength - 0.08,
      mass: 0.1,
      name: 'right spindle knob',
      spinsWithRotor: true,
      spinInertia: 0.5 * 0.1 * (spindleRadius * 1.42) ** 2,
    },
    {
      centerOffset: supportToCenter,
      mass: 0.86,
      name: 'horizontal ring A',
      spinsWithRotor: false,
      spinInertia: 0,
    },
    {
      centerOffset: supportToCenter - bearingOffset,
      mass: 0.22,
      name: 'left rotor bearing',
      spinsWithRotor: false,
      spinInertia: 0,
    },
    {
      centerOffset: supportToCenter + bearingOffset,
      mass: 0.22,
      name: 'right rotor bearing',
      spinsWithRotor: false,
      spinInertia: 0,
    },
    {
      centerOffset: (supportToCenter - ringRadius) * 0.52,
      mass: 0.17,
      name: 'curved neck and pintle F',
      spinsWithRotor: false,
      spinInertia: 0,
    },
  ];
  const totalMovingMass = physicalComponents.reduce(
    (sum, component) => sum + component.mass,
    0,
  );
  const firstMassMoment = physicalComponents.reduce(
    (sum, component) => sum + component.mass * component.centerOffset,
    0,
  );
  const centerOfMassOffset = firstMassMoment / totalMovingMass;
  const rotorSpinInertia = physicalComponents.reduce(
    (sum, component) => sum + component.spinInertia,
    0,
  );
  const gravityTorqueMagnitude = gravity * firstMassMoment;
  const spinTurnsPerPrecession = 12;
  const spinAngularSpeed = Math.sqrt(
    spinTurnsPerPrecession * gravityTorqueMagnitude / rotorSpinInertia,
  );
  const spinAngularMomentumMagnitude =
    rotorSpinInertia * spinAngularSpeed;
  const precessionAngularSpeed =
    gravityTorqueMagnitude / spinAngularMomentumMagnitude;
  const precessionCyclePeriod = fullTurn / precessionAngularSpeed;
  const spinCyclePeriod = fullTurn / spinAngularSpeed;
  const sourcePrecessionAngle = 0.08;
  const sourceSpinAngle = 0.42;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.2,
    roughness: 0.52,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.4,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.65,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.31,
    roughness: 0.4,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const baseFoot = cylinderAlongY(0.91, 0.24, frameMaterial, 72);
  baseFoot.position.set(supportPivot.x, -2.23, supportPivot.z);
  baseFoot.userData.role = 'fixed-wide-foot-of-pillar-G';

  const baseTier = cylinderAlongY(0.64, 0.27, frameMaterial, 64);
  baseTier.position.set(supportPivot.x, -2.02, supportPivot.z);
  baseTier.userData.role = 'fixed-upper-tier-of-pillar-base';

  const baseCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.64, 0.055, 10, 64),
    darkMaterial,
  );
  baseCollar.rotation.x = Math.PI / 2;
  baseCollar.position.set(supportPivot.x, -1.89, supportPivot.z);
  baseCollar.userData.role = 'fixed-outline-around-pillar-base';

  const pillarLength = 2.93;
  const pillarTopY = supportPivot.y - 0.24;
  const pillarBottomY = pillarTopY - pillarLength;
  const pillar = cylinderAlongY(0.16, pillarLength, frameMaterial, 48);
  pillar.position.set(
    supportPivot.x,
    (pillarTopY + pillarBottomY) / 2,
    supportPivot.z,
  );
  pillar.userData.role = 'fixed-upright-pillar-G';

  const pillarIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, pillarLength * 0.42, 0.025),
    indexMaterial,
  );
  pillarIndex.position.set(
    supportPivot.x + 0.164,
    pillar.position.y + 0.19,
    supportPivot.z,
  );
  pillarIndex.userData.role = 'vertical-index-showing-that-pillar-G-is-fixed';

  const supportCup = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 48, 24),
    frameMaterial,
  );
  supportCup.scale.y = 0.62;
  supportCup.position.set(
    supportPivot.x,
    supportPivot.y - 0.158,
    supportPivot.z,
  );
  supportCup.userData.role = 'fixed-bearing-cup-on-top-of-pillar-G';

  // The rim stays inside the sweep of the curved neck's lower end.
  const supportCupRim = torusNormalToY(
    0.155,
    0.04,
    darkMaterial,
    10,
    56,
  );
  supportCupRim.position.set(
    supportPivot.x,
    supportPivot.y - 0.03,
    supportPivot.z,
  );
  supportCupRim.userData.role = 'fixed-rim-of-pintle-bearing';

  const precessionAssembly = new THREE.Group();
  precessionAssembly.position.copy(supportPivot);
  precessionAssembly.userData.role =
    'complete-ring-and-rotor-precessing-about-vertical-pintle-F';

  const pintle = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pintleRadius,
      pintleRadius * 0.18,
      pintleLength,
      40,
    ),
    brassMaterial,
  );
  pintle.position.y = pintleLength / 2;
  pintle.userData.role =
    'moving-pointed-pintle-F-seated-on-the-top-bearing-G';
  precessionAssembly.add(pintle);

  const pintleCap = cylinderAlongY(
    pintleRadius * 1.55,
    0.08,
    darkMaterial,
    40,
  );
  pintleCap.position.y = pintleLength + 0.015;
  pintleCap.userData.role = 'upper-cap-of-moving-pintle-F';
  precessionAssembly.add(pintleCap);

  const neckEndX = supportToCenter - ringRadius;
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, pintleLength * 0.78, 0),
    new THREE.Vector3(neckEndX * 0.19, 0.34, 0),
    new THREE.Vector3(neckEndX * 0.58, 0.3, 0),
    new THREE.Vector3(neckEndX * 0.73, 0.09, 0),
    new THREE.Vector3(neckEndX, 0, 0),
  ]);
  const curvedNeck = new THREE.Mesh(
    new THREE.TubeGeometry(neckCurve, 48, 0.105, 12, false),
    drivenMaterial,
  );
  curvedNeck.userData.role =
    'curved-rigid-neck-joining-pintle-F-to-ring-A';
  precessionAssembly.add(curvedNeck);

  const ringBody = torusNormalToY(
    ringRadius,
    ringTubeRadius + 0.018,
    drivenMaterial,
    18,
    144,
  );
  ringBody.position.x = supportToCenter;
  ringBody.userData.role = 'horizontal-bearing-ring-A';
  precessionAssembly.add(ringBody);

  const ringOutline = new THREE.Group();
  ringOutline.position.x = supportToCenter;
  ringOutline.userData.role = 'two-dark-edge-lines-outlining-horizontal-ring-A';
  for (const side of [-1, 1]) {
    const edge = torusNormalToY(
      ringRadius + side * ringTubeRadius * 0.72,
      0.024,
      darkMaterial,
      8,
      144,
    );
    edge.position.y = ringTubeRadius * 0.69;
    edge.userData.role = 'dark-edge-line-on-horizontal-ring-A';
    edge.userData.side = side;
    ringOutline.add(edge);
  }
  precessionAssembly.add(ringOutline);

  const ringIndex = new THREE.Mesh(
    new THREE.SphereGeometry(ringTubeRadius * 0.72, 24, 14),
    indexMaterial,
  );
  ringIndex.position.set(
    supportToCenter,
    ringTubeRadius * 0.15,
    ringRadius,
  );
  ringIndex.userData.role = 'visible-index-fixed-to-precessing-ring-A';
  precessionAssembly.add(ringIndex);

  const bearingHousings = [-1, 1].map((side) => {
    const housing = cylinderAlongX(
      bearingOuterRadius,
      bearingLength,
      drivenMaterial,
      48,
    );
    housing.position.set(
      supportToCenter + side * bearingOffset,
      0,
      0,
    );
    housing.userData.role = 'fixed-in-ring-bearing-for-spindle-of-disk-C';
    housing.userData.side = side;
    precessionAssembly.add(housing);
    return housing;
  });

  const bearingRims = [-1, 1].map((side) => {
    const rim = torusNormalToX(
      spindleRadius + 0.035,
      0.035,
      darkMaterial,
      10,
      40,
    );
    rim.position.set(
      supportToCenter + side * (bearingOffset + bearingLength / 2 + 0.008),
      0,
      0,
    );
    rim.userData.role = 'visible-spindle-bearing-rim';
    rim.userData.side = side;
    precessionAssembly.add(rim);
    return rim;
  });

  const spinRotor = new THREE.Group();
  spinRotor.position.x = supportToCenter;
  spinRotor.userData.role =
    'metallic-disk-C-spindle-and-knob-spinning-in-ring-bearings';
  precessionAssembly.add(spinRotor);

  const spindle = cylinderAlongX(
    spindleRadius,
    spindleHalfLength + spindleLeftLength,
    darkMaterial,
    48,
  );
  spindle.position.x = (spindleHalfLength - spindleLeftLength) / 2;
  spindle.userData.role = 'spindle-of-metallic-disk-C';
  spinRotor.add(spindle);

  const diskBody = cylinderAlongX(
    diskRadius,
    diskThickness,
    driverMaterial,
    128,
  );
  diskBody.userData.role = 'rapidly-spinning-metallic-disk-C';
  spinRotor.add(diskBody);

  const diskRim = torusNormalToX(
    diskRadius - 0.035,
    0.052,
    darkMaterial,
    12,
    128,
  );
  diskRim.userData.role = 'dark-rim-of-metallic-disk-C';
  spinRotor.add(diskRim);

  const hub = cylinderAlongX(hubRadius, hubLength, brassMaterial, 56);
  hub.userData.role = 'hub-rigid-with-metallic-disk-C-and-spindle';
  spinRotor.add(hub);

  const faceRings = [-1, 1].map((side) => {
    const ring = torusNormalToX(
      diskRadius * 0.73,
      0.024,
      darkMaterial,
      8,
      96,
    );
    ring.position.x = side * (diskThickness / 2 + 0.014);
    ring.userData.role = 'concentric-face-line-on-spinning-disk-C';
    ring.userData.side = side;
    spinRotor.add(ring);
    return ring;
  });

  const spinIndexes = [];
  for (const side of [-1, 1]) {
    const radialLength = diskRadius * 0.62;
    const radialStart = hubRadius * 1.12;
    const radialMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, radialLength, 0.07),
      indexMaterial,
    );
    radialMarker.position.set(
      side * (diskThickness / 2 + 0.035),
      radialStart + radialLength / 2,
      0,
    );
    radialMarker.userData.role =
      'asymmetric-radial-index-showing-disk-spin-rate';
    radialMarker.userData.side = side;
    spinRotor.add(radialMarker);
    spinIndexes.push(radialMarker);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 24, 14),
      indexMaterial,
    );
    dot.position.set(
      side * (diskThickness / 2 + 0.055),
      -diskRadius * 0.57,
      diskRadius * 0.46,
    );
    dot.userData.role = 'off-axis-dot-showing-disk-spin-rate';
    dot.userData.side = side;
    spinRotor.add(dot);
    spinIndexes.push(dot);
  }

  const leftSpindleCap = cylinderAlongX(
    spindleRadius * 1.38,
    0.13,
    brassMaterial,
    40,
  );
  leftSpindleCap.position.x = -spindleHalfLength - 0.045;
  leftSpindleCap.userData.role = 'left-end-cap-of-spinning-spindle';
  spinRotor.add(leftSpindleCap);

  const rightSpindleKnob = cylinderAlongX(
    spindleRadius * 1.42,
    0.2,
    brassMaterial,
    40,
  );
  rightSpindleKnob.position.x = spindleHalfLength + 0.08;
  rightSpindleKnob.userData.role = 'right-hand-starting-knob-on-spindle';
  spinRotor.add(rightSpindleKnob);

  const knobBulb = new THREE.Mesh(
    new THREE.SphereGeometry(spindleRadius * 1.62, 32, 18),
    brassMaterial,
  );
  knobBulb.position.x = spindleHalfLength + 0.22;
  knobBulb.userData.role = 'outer-bulb-of-spindle-starting-knob';
  spinRotor.add(knobBulb);

  root.add(
    baseFoot,
    baseTier,
    baseCollar,
    pillar,
    pillarIndex,
    supportCup,
    supportCupRim,
    precessionAssembly,
  );

  const steadyPrecessionRateForSpin = (angularSpeed) => {
    if (angularSpeed === 0) return Number.POSITIVE_INFINITY;
    return gravityTorqueMagnitude / (rotorSpinInertia * angularSpeed);
  };

  const stateAtTime = (time) => {
    const precessionAngle = sourcePrecessionAngle
      + precessionAngularSpeed * time;
    const diskSpinAngle = sourceSpinAngle + spinAngularSpeed * time;
    const spinAxis = X_AXIS.clone().applyAxisAngle(
      Y_AXIS,
      precessionAngle,
    ).normalize();
    const precessionTangent = Y_AXIS.clone().cross(spinAxis).normalize();
    const diskCenter = supportPivot.clone().addScaledVector(
      spinAxis,
      supportToCenter,
    );
    const centerOfMass = supportPivot.clone().addScaledVector(
      spinAxis,
      centerOfMassOffset,
    );
    const centerVelocity = precessionTangent.clone().multiplyScalar(
      precessionAngularSpeed * supportToCenter,
    );
    const centerAcceleration = spinAxis.clone().multiplyScalar(
      -(precessionAngularSpeed ** 2) * supportToCenter,
    );
    const centerOfMassAcceleration = spinAxis.clone().multiplyScalar(
      -(precessionAngularSpeed ** 2) * centerOfMassOffset,
    );
    const gravityForce = new THREE.Vector3(
      0,
      -totalMovingMass * gravity,
      0,
    );
    const gravityLeverArm = spinAxis.clone().multiplyScalar(
      centerOfMassOffset,
    );
    const gravityTorque = gravityLeverArm.clone().cross(gravityForce);
    const spinAngularMomentum = spinAxis.clone().multiplyScalar(
      spinAngularMomentumMagnitude,
    );
    const spinAngularMomentumRate = Y_AXIS.clone()
      .multiplyScalar(precessionAngularSpeed)
      .cross(spinAngularMomentum);
    const gyroscopicBalanceError = gravityTorque.clone().sub(
      spinAngularMomentumRate,
    );
    const diskAngularVelocity = spinAxis.clone()
      .multiplyScalar(spinAngularSpeed)
      .addScaledVector(Y_AXIS, precessionAngularSpeed);
    const supportReaction = centerOfMassAcceleration.clone()
      .multiplyScalar(totalMovingMass)
      .sub(gravityForce);
    const bearingCenters = [-1, 1].map((side) => (
      supportPivot.clone().addScaledVector(
        spinAxis,
        supportToCenter + side * bearingOffset,
      )
    ));
    const spindleEndpoints = [-1, 1].map((side) => (
      diskCenter.clone().addScaledVector(spinAxis, side < 0 ? -spindleLeftLength : spindleHalfLength)
    ));
    return {
      bearingAxisError: bearingCenters[1].clone()
        .sub(bearingCenters[0])
        .normalize()
        .distanceTo(spinAxis),
      bearingCenters,
      centerAcceleration,
      centerOfMass,
      centerOfMassAcceleration,
      centerVelocity,
      diskAngularVelocity,
      diskCenter,
      diskSpinAngle,
      diskSpinTurns: (diskSpinAngle - sourceSpinAngle) / fullTurn,
      gravityForce,
      gravityLeverArm,
      gravityTorque,
      gyroscopicBalanceError,
      nutationAngle: 0,
      planePreservationError: Math.abs(spinAxis.dot(Y_AXIS)),
      precessionAngle,
      precessionAngularSpeed,
      precessionTangent,
      precessionTurns:
        (precessionAngle - sourcePrecessionAngle) / fullTurn,
      ringAngularVelocity: Y_AXIS.clone().multiplyScalar(
        precessionAngularSpeed,
      ),
      ringPlaneNormal: Y_AXIS.clone(),
      spinAngularMomentum,
      spinAngularMomentumRate,
      spinAngularSpeed,
      spinAxis,
      spindleEndpoints,
      supportPivot: supportPivot.clone(),
      supportReaction,
      tiltFromVertical: Math.PI / 2,
      torqueAngularMomentumOrthogonality: Math.abs(
        gravityTorque.dot(spinAngularMomentum),
      ),
    };
  };

  const contacts = {
    pintlePointSupport: {
      centerError: 0,
      contactPoint: supportPivot.clone(),
      regularPrecessionAxis: Y_AXIS.clone(),
      supportNormal: Y_AXIS.clone(),
    },
    rotorBearings: {
      axis: X_AXIS.clone(),
      axisError: 0,
      centers: [],
      spindleRadius,
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    precessionAssembly.rotation.set(0, state.precessionAngle, 0);
    spinRotor.rotation.set(state.diskSpinAngle, 0, 0);
    precessionAssembly.userData.angularSpeed = state.precessionAngularSpeed;
    spinRotor.userData.angularSpeed = state.spinAngularSpeed;
    contacts.pintlePointSupport.contactPoint.copy(state.supportPivot);
    contacts.rotorBearings.axis = state.spinAxis.clone();
    contacts.rotorBearings.axisError = state.bearingAxisError;
    contacts.rotorBearings.centers = state.bearingCenters.map(
      (center) => center.clone(),
    );
    root.userData.kinematics = state;
  };

  root.userData.archetype = 'single-support-steady-precession-gyroscope';
  root.userData.blocks = {
    baseCollar,
    baseFoot,
    baseTier,
    bearingHousings,
    bearingRims,
    curvedNeck,
    diskBody,
    diskRim,
    faceRings,
    hub,
    knobBulb,
    leftSpindleCap,
    pillar,
    pillarIndex,
    pintle,
    pintleCap,
    precessionAssembly,
    rightSpindleKnob,
    ringBody,
    ringIndex,
    ringOutline,
    spinIndexes,
    spinRotor,
    spindle,
    supportCup,
    supportCupRim,
  };
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.55, -2.48, -1.05),
    new THREE.Vector3(4.55, 3.15, 1.05),
  );
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one rapid rotor spin about the spindle axis through disk C',
    mechanism: 2,
    output:
      'one gravity-driven precession angle about vertical pintle F; the regular solution has zero nutation',
  };
  root.userData.dynamics = {
    centerOfMassOffset,
    firstMassMoment,
    gravity,
    gravityTorqueMagnitude,
    physicalComponents,
    precessionAngularSpeed,
    precessionCyclePeriod,
    rotorSpinInertia,
    spinAngularMomentumMagnitude,
    spinAngularSpeed,
    spinCyclePeriod,
    spinKineticEnergy: 0.5 * rotorSpinInertia * spinAngularSpeed ** 2,
    spinTurnsPerPrecession,
    steadyPrecessionRateForSpin,
    totalMovingMass,
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    bearingLength,
    bearingOffset,
    bearingOuterRadius,
    cyclePeriod: precessionCyclePeriod,
    diskRadius,
    diskThickness,
    fullTurn,
    hubLength,
    hubRadius,
    pintleLength,
    pintleRadius,
    precessionAngularSpeed,
    precessionCyclePeriod,
    ringRadius,
    ringTubeRadius,
    sourceDiskBottomRaster: sourceDiskBottomRaster.clone(),
    sourceDiskRadiusPixels,
    sourceDiskTopRaster: sourceDiskTopRaster.clone(),
    sourcePillarBaseRaster: sourcePillarBaseRaster.clone(),
    sourcePosePrecessionAngle: sourcePrecessionAngle,
    sourcePoseSpinAngle: sourceSpinAngle,
    sourceRingLeftRaster: sourceRingLeftRaster.clone(),
    sourceRingRadiusPixels,
    sourceRingRightRaster: sourceRingRightRaster.clone(),
    sourceRotorCenterRaster: sourceRotorCenterRaster.clone(),
    sourceScale,
    sourceSupportPivotRaster: sourceSupportPivotRaster.clone(),
    sourceSupportToCenterPixels,
    spindleHalfLength,
    spindleLeftLength,
    spindleRadius,
    spinAngularSpeed,
    spinCyclePeriod,
    supportPivot: supportPivot.clone(),
    supportToCenter,
  };
  root.userData.mechanism =
    'rapid-metallic-disk-C-spins-on-one-horizontal-spindle-in-bearings-in-ring-A-while-the-complete-offset-ring-and-rotor-turn-about-the-single-pointed-pintle-F-seated-on-pillar-G-at-the-steady-gravity-precession-rate-torque-divided-by-spin-angular-momentum-with-no-drop-or-nutation';
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    pageMarksAnimationUnavailable: true,
    sourcePrescribedTiming: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate355: {
      diskBottom: sourceDiskBottomRaster.clone(),
      diskTop: sourceDiskTopRaster.clone(),
      imageHeight: 525,
      imageWidth: 525,
      measurementUncertaintyPixels: 10,
      pillarBase: sourcePillarBaseRaster.clone(),
      ringLeft: sourceRingLeftRaster.clone(),
      ringRight: sourceRingRightRaster.clone(),
      rotorCenter: sourceRotorCenterRaster.clone(),
      supportPivotF: sourceSupportPivotRaster.clone(),
    },
    labels: {
      A: 'horizontal ring carrying both spindle bearings',
      C: 'rapidly spinning metallic disk',
      F: 'single pointed moving pintle at one side of ring A',
      G: 'fixed pillar with a top seat providing the point support',
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.steadyPrecessionRateForSpin = steadyPrecessionRateForSpin;
  root.userData.transmission = {
    angularMomentumDirection:
      'positive disk spin points from support F through disk C along the spindle',
    gravityTorque:
      'the offset center of mass and downward gravity produce a horizontal torque perpendicular to rotor angular momentum',
    precessionDirection:
      'positive spin gives positive precession about the upward vertical axis; reversing spin reverses precession',
    steadyPrecessionLaw:
      'Omega = tau/L = (M g l)/(I_spin omega_spin) for the horizontal zero-nutation regular-precession state',
    cyclePeriod: precessionCyclePeriod,
  };

  update(0);
  markShadows(root);
  correctGyroscopeParts(root, 355);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

function bohnenbergerThreeRingMachine(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Brown's plate supplies topology rather than a motion program.  These
  // raster measurements keep the three nested rings, spherical rotor, and
  // short pedestal in their depicted proportions without claiming precision
  // that the engraved line widths cannot support.
  const sourceScale = 0.0135;
  const sourceGimbalCenterRaster = new THREE.Vector2(263, 231);
  const sourceOuterTopRaster = new THREE.Vector2(263, 70);
  const sourceOuterBottomRaster = new THREE.Vector2(263, 392);
  const sourceOuterLeftRaster = new THREE.Vector2(101, 231);
  const sourceOuterRightRaster = new THREE.Vector2(425, 231);
  const sourceMiddleTopRaster = new THREE.Vector2(262, 95);
  const sourceMiddleBottomRaster = new THREE.Vector2(262, 390);
  const sourceInnerEndOneRaster = new THREE.Vector2(172, 163);
  const sourceInnerEndTwoRaster = new THREE.Vector2(363, 300);
  const sourceBallLeftRaster = new THREE.Vector2(181, 231);
  const sourceBallRightRaster = new THREE.Vector2(346, 231);
  const sourcePedestalFloorRaster = new THREE.Vector2(263, 487);
  const sourceOuterRadiusPixels =
    (sourceOuterBottomRaster.y - sourceOuterTopRaster.y) / 2;
  const sourceMiddleRadiusPixels =
    (sourceMiddleBottomRaster.y - sourceMiddleTopRaster.y) / 2;
  const sourceInnerRadiusPixels = 124;
  const sourceBallRadiusPixels =
    (sourceBallRightRaster.x - sourceBallLeftRaster.x) / 2;

  const outerRadius = sourceOuterRadiusPixels * sourceScale;
  const middleRadius = sourceMiddleRadiusPixels * sourceScale;
  const innerRadius = sourceInnerRadiusPixels * sourceScale;
  const ballRadius = sourceBallRadiusPixels * sourceScale;
  const outerTubeRadius = 0.13;
  const middleTubeRadius = 0.105;
  const innerTubeRadius = 0.09;
  const gimbalCenter = new THREE.Vector3(0, 1.13, 0);
  const middlePivotOffset = (outerRadius + middleRadius) / 2;
  const innerPivotOffset = (middleRadius + innerRadius) / 2;
  const rotorBearingOffset = innerRadius - 0.12;
  const rotorShaftRadius = 0.064;
  const rotorShaftHalfLength = innerRadius + 0.09;
  const bearingLength = 0.26;
  const bearingRadius = 0.17;
  const hubRadius = 0.22;
  const hubLength = ballRadius * 2 + 0.16;

  const alterationCyclePeriod = 6;
  const alterationRate = fullTurn / alterationCyclePeriod;
  const outerYawAmplitude = 0.72;
  const sourceOuterYaw = 0.08;
  const fixedMiddleWorldYaw = -1.02;
  const fixedInnerPitch = -0.64;
  const spinTurnsPerAlterationCycle = 18;
  const ballSpinAngularSpeed =
    spinTurnsPerAlterationCycle * fullTurn / alterationCyclePeriod;
  const sourceBallSpinAngle = 0.37;

  const ballMass = 3.4;
  const shaftMass = 0.18;
  const hubMass = 0.22;
  const ballSpinInertia = 2 * ballMass * ballRadius ** 2 / 5;
  const shaftSpinInertia = 0.5 * shaftMass * rotorShaftRadius ** 2;
  const hubSpinInertia = 0.5 * hubMass * hubRadius ** 2;
  const rotorSpinInertia =
    ballSpinInertia + shaftSpinInertia + hubSpinInertia;
  const spinAngularMomentumMagnitude =
    rotorSpinInertia * ballSpinAngularSpeed;
  const spinKineticEnergy =
    0.5 * rotorSpinInertia * ballSpinAngularSpeed ** 2;
  const referenceAxisSlewRate = THREE.MathUtils.degToRad(5);
  const transverseTorqueForReferenceSlew =
    spinAngularMomentumMagnitude * referenceAxisSlewRate;

  const fixedRotorAxis = new THREE.Vector3(0, 0, 1)
    .applyAxisAngle(X_AXIS, fixedInnerPitch)
    .applyAxisAngle(Y_AXIS, fixedMiddleWorldYaw)
    .normalize();

  const outerMaterial = matte(PALETTE.driven, {
    metalness: 0.2,
    roughness: 0.54,
  });
  const middleMaterial = matte(PALETTE.driver, {
    metalness: 0.19,
    roughness: 0.53,
  });
  const innerMaterial = matte(PALETTE.brass, {
    metalness: 0.3,
    roughness: 0.43,
  });
  const ballMaterial = matte(PALETTE.driven, {
    metalness: 0.31,
    roughness: 0.4,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.66,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const baseFoot = cylinderAlongY(0.94, 0.24, frameMaterial, 72);
  baseFoot.position.set(0, -2.49, 0);
  baseFoot.userData.role = 'fixed-wide-foot-of-Bohnenberger-pedestal';

  const baseTier = cylinderAlongY(0.68, 0.26, frameMaterial, 64);
  baseTier.position.set(0, -2.29, 0);
  baseTier.userData.role = 'fixed-upper-tier-of-Bohnenberger-pedestal';

  const baseOutline = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.052, 10, 64),
    darkMaterial,
  );
  baseOutline.rotation.x = Math.PI / 2;
  baseOutline.position.set(0, -2.16, 0);
  baseOutline.userData.role = 'dark-outline-of-pedestal-base';

  const outerBottomY = gimbalCenter.y - outerRadius;
  const supportColumnTopY = outerBottomY - 0.08;
  const supportColumnBottomY = -2.16;
  const supportColumn = cylinderAlongY(
    0.23,
    supportColumnTopY - supportColumnBottomY,
    frameMaterial,
    48,
  );
  supportColumn.position.set(
    0,
    (supportColumnTopY + supportColumnBottomY) / 2,
    0,
  );
  supportColumn.userData.role =
    'fixed-pedestal-column-supporting-outer-ring-A';

  const pedestalNeck = cylinderAlongY(0.35, 0.34, frameMaterial, 56);
  pedestalNeck.scale.set(1, 1, 0.82);
  pedestalNeck.position.set(0, supportColumnBottomY + 0.15, 0);
  pedestalNeck.userData.role = 'flared-neck-of-fixed-pedestal';

  const lowerYawBearing = torusNormalToY(
    0.23,
    0.055,
    darkMaterial,
    10,
    56,
  );
  lowerYawBearing.position.set(0, outerBottomY - 0.04, 0);
  lowerYawBearing.userData.role =
    'fixed-lower-seat-for-imposed-outer-ring-reorientation';

  const outerYawGroup = new THREE.Group();
  outerYawGroup.position.copy(gimbalCenter);
  outerYawGroup.userData.role =
    'externally-reoriented-outer-ring-A-about-its-supported-vertical-diameter';

  const outerRing = torusNormalToZ(
    outerRadius,
    outerTubeRadius,
    outerMaterial,
    18,
    160,
  );
  outerRing.userData.role = 'outer-ring-A';
  outerYawGroup.add(outerRing);

  const outerEdgeLines = [-1, 1].map((side) => {
    const edge = torusNormalToZ(
      outerRadius + side * outerTubeRadius * 0.7,
      0.023,
      darkMaterial,
      8,
      160,
    );
    edge.position.z = outerTubeRadius * 0.67;
    edge.userData.role = 'dark-edge-line-on-outer-ring-A';
    edge.userData.side = side;
    outerYawGroup.add(edge);
    return edge;
  });

  const lowerYawTrunnion = cylinderAlongY(
    0.12,
    0.36,
    innerMaterial,
    40,
  );
  lowerYawTrunnion.position.y = -outerRadius - 0.08;
  lowerYawTrunnion.userData.role =
    'vertical-bottom-trunnion-of-outer-ring-A';
  outerYawGroup.add(lowerYawTrunnion);

  const middleYawGroup = new THREE.Group();
  middleYawGroup.userData.role =
    'middle-ring-A1-free-on-the-vertical-diameter-pivots-of-A';
  outerYawGroup.add(middleYawGroup);

  const middleRing = torusNormalToZ(
    middleRadius,
    middleTubeRadius,
    middleMaterial,
    16,
    144,
  );
  middleRing.userData.role = 'middle-ring-A1';
  middleYawGroup.add(middleRing);

  const middleEdgeLines = [-1, 1].map((side) => {
    const edge = torusNormalToZ(
      middleRadius + side * middleTubeRadius * 0.69,
      0.021,
      darkMaterial,
      8,
      144,
    );
    edge.position.z = middleTubeRadius * 0.66;
    edge.userData.role = 'dark-edge-line-on-middle-ring-A1';
    edge.userData.side = side;
    middleYawGroup.add(edge);
    return edge;
  });

  const middlePivotBearings = [-1, 1].map((side) => {
    const bearing = cylinderAlongY(
      bearingRadius,
      bearingLength,
      outerMaterial,
      40,
    );
    bearing.position.y = side * middlePivotOffset;
    bearing.userData.role =
      'right-angle-pivot-bearing-between-rings-A-and-A1';
    bearing.userData.side = side;
    outerYawGroup.add(bearing);
    return bearing;
  });

  const middlePivotPins = [-1, 1].map((side) => {
    const pin = cylinderAlongY(
      0.075,
      bearingLength + 0.11,
      darkMaterial,
      36,
    );
    pin.position.y = side * middlePivotOffset;
    pin.userData.role = 'vertical-pivot-pin-rigid-with-middle-ring-A1';
    pin.userData.side = side;
    middleYawGroup.add(pin);
    return pin;
  });

  const innerPitchGroup = new THREE.Group();
  innerPitchGroup.userData.role =
    'smallest-ring-A2-on-the-perpendicular-diameter-pivots-of-A1';
  middleYawGroup.add(innerPitchGroup);

  const innerRing = torusNormalToY(
    innerRadius,
    innerTubeRadius,
    innerMaterial,
    16,
    132,
  );
  innerRing.userData.role = 'smallest-ring-A2';
  innerPitchGroup.add(innerRing);

  const innerEdgeLines = [-1, 1].map((side) => {
    const edge = torusNormalToY(
      innerRadius + side * innerTubeRadius * 0.68,
      0.019,
      darkMaterial,
      8,
      132,
    );
    edge.position.y = innerTubeRadius * 0.66;
    edge.userData.role = 'dark-edge-line-on-smallest-ring-A2';
    edge.userData.side = side;
    innerPitchGroup.add(edge);
    return edge;
  });

  const innerPivotBearings = [-1, 1].map((side) => {
    const bearing = cylinderAlongX(
      bearingRadius * 0.91,
      bearingLength,
      middleMaterial,
      40,
    );
    bearing.position.x = side * innerPivotOffset;
    bearing.userData.role =
      'horizontal-pivot-bearing-between-rings-A1-and-A2';
    bearing.userData.side = side;
    middleYawGroup.add(bearing);
    return bearing;
  });

  const innerPivotPins = [-1, 1].map((side) => {
    const pin = cylinderAlongX(
      0.068,
      bearingLength + 0.1,
      darkMaterial,
      36,
    );
    pin.position.x = side * innerPivotOffset;
    pin.userData.role = 'pivot-pin-rigid-with-smallest-ring-A2';
    pin.userData.side = side;
    innerPitchGroup.add(pin);
    return pin;
  });

  const rotorBearingHousings = [-1, 1].map((side) => {
    const housing = cylinderAlongZ(
      bearingRadius * 0.82,
      bearingLength,
      innerMaterial,
      40,
    );
    housing.position.z = side * rotorBearingOffset;
    housing.userData.role =
      'bearing-in-smallest-ring-A2-for-axis-of-heavy-ball-B';
    housing.userData.side = side;
    innerPitchGroup.add(housing);
    return housing;
  });

  const rotorBearingRims = [-1, 1].map((side) => {
    const rim = torusNormalToZ(
      rotorShaftRadius + 0.028,
      0.027,
      darkMaterial,
      8,
      36,
    );
    rim.position.z = side * (
      rotorBearingOffset + bearingLength / 2 + 0.008
    );
    rim.userData.role = 'visible-bearing-rim-for-heavy-ball-axis';
    rim.userData.side = side;
    innerPitchGroup.add(rim);
    return rim;
  });

  const ballSpinRotor = new THREE.Group();
  ballSpinRotor.userData.role =
    'heavy-ball-B-and-shaft-spinning-inside-smallest-ring-A2';
  innerPitchGroup.add(ballSpinRotor);

  const heavyBall = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 72, 48),
    ballMaterial,
  );
  heavyBall.userData.role = 'rapidly-rotating-heavy-ball-B';
  ballSpinRotor.add(heavyBall);

  const ballEquator = torusNormalToZ(
    ballRadius + 0.012,
    0.025,
    darkMaterial,
    8,
    112,
  );
  ballEquator.userData.role = 'equatorial-index-on-heavy-ball-B';
  ballSpinRotor.add(ballEquator);

  const rotorShaft = cylinderAlongZ(
    rotorShaftRadius,
    rotorShaftHalfLength * 2,
    darkMaterial,
    40,
  );
  rotorShaft.userData.role = 'spin-axis-shaft-of-heavy-ball-B';
  ballSpinRotor.add(rotorShaft);

  const rotorHub = cylinderAlongZ(
    hubRadius,
    hubLength,
    middleMaterial,
    48,
  );
  rotorHub.userData.role = 'hub-rigid-with-heavy-ball-B';
  ballSpinRotor.add(rotorHub);

  const ballSpinIndexes = [];
  for (const side of [-1, 1]) {
    const faceZ = side * (ballRadius * 0.9);
    const radialMarker = new THREE.Mesh(
      new THREE.BoxGeometry(ballRadius * 0.58, 0.065, 0.035),
      indexMaterial,
    );
    radialMarker.position.set(ballRadius * 0.39, 0, faceZ);
    radialMarker.rotation.y = side * 0.12;
    radialMarker.userData.role =
      'asymmetric-surface-index-showing-heavy-ball-spin';
    radialMarker.userData.side = side;
    ballSpinRotor.add(radialMarker);
    ballSpinIndexes.push(radialMarker);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 22, 14),
      indexMaterial,
    );
    dot.position.set(-ballRadius * 0.5, ballRadius * 0.38, faceZ * 0.82);
    dot.userData.role = 'off-axis-dot-showing-heavy-ball-spin';
    dot.userData.side = side;
    ballSpinRotor.add(dot);
    ballSpinIndexes.push(dot);
  }

  const shaftCaps = [-1, 1].map((side) => {
    const cap = cylinderAlongZ(
      rotorShaftRadius * 1.55,
      0.13,
      middleMaterial,
      36,
    );
    cap.position.z = side * (rotorShaftHalfLength + 0.04);
    cap.userData.role = 'outer-cap-on-heavy-ball-spin-shaft';
    cap.userData.side = side;
    ballSpinRotor.add(cap);
    return cap;
  });

  root.add(
    baseFoot,
    baseTier,
    baseOutline,
    pedestalNeck,
    supportColumn,
    lowerYawBearing,
    outerYawGroup,
  );

  const axisSlewRateForTransverseTorque = (torqueMagnitude) => (
    torqueMagnitude / spinAngularMomentumMagnitude
  );
  const angularImpulseForAxisDeflection = (deflectionAngle) => (
    2 * spinAngularMomentumMagnitude * Math.sin(deflectionAngle / 2)
  );

  const stateAtTime = (time) => {
    const cycleCoordinate = time / alterationCyclePeriod;
    const cyclePhase = THREE.MathUtils.euclideanModulo(cycleCoordinate, 1);
    const phaseAngle = cycleCoordinate * fullTurn;
    const outerYaw = sourceOuterYaw
      + outerYawAmplitude * Math.sin(phaseAngle);
    const outerYawAngularSpeed =
      outerYawAmplitude * alterationRate * Math.cos(phaseAngle);
    const outerYawAngularAcceleration =
      -outerYawAmplitude * alterationRate ** 2 * Math.sin(phaseAngle);
    const middleRelativeYaw = fixedMiddleWorldYaw - outerYaw;
    const middleRelativeAngularSpeed = -outerYawAngularSpeed;
    const ballSpinAngle = sourceBallSpinAngle + ballSpinAngularSpeed * time;

    const outerQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS,
      outerYaw,
    );
    const middleRelativeQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS,
      middleRelativeYaw,
    );
    const middleWorldQuaternion = outerQuaternion.clone().multiply(
      middleRelativeQuaternion,
    ).normalize();
    const innerRelativeQuaternion = new THREE.Quaternion().setFromAxisAngle(
      X_AXIS,
      fixedInnerPitch,
    );
    const innerWorldQuaternion = middleWorldQuaternion.clone().multiply(
      innerRelativeQuaternion,
    ).normalize();
    const rotorAxis = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(innerWorldQuaternion)
      .normalize();
    const middlePivotAxis = Y_AXIS.clone()
      .applyQuaternion(outerQuaternion)
      .normalize();
    const innerPivotAxis = X_AXIS.clone()
      .applyQuaternion(middleWorldQuaternion)
      .normalize();
    const outerBottomSupportPoint = gimbalCenter.clone().add(
      new THREE.Vector3(0, -outerRadius, 0).applyQuaternion(
        outerQuaternion,
      ),
    );
    const middlePivotCenters = [-1, 1].map((side) => (
      gimbalCenter.clone().addScaledVector(
        middlePivotAxis,
        side * middlePivotOffset,
      )
    ));
    const innerPivotCenters = [-1, 1].map((side) => (
      gimbalCenter.clone().addScaledVector(
        innerPivotAxis,
        side * innerPivotOffset,
      )
    ));
    const rotorBearingCenters = [-1, 1].map((side) => (
      gimbalCenter.clone().addScaledVector(
        rotorAxis,
        side * rotorBearingOffset,
      )
    ));
    const rotorShaftEndpoints = [-1, 1].map((side) => (
      gimbalCenter.clone().addScaledVector(
        rotorAxis,
        side * rotorShaftHalfLength,
      )
    ));
    const spinAngularMomentum = rotorAxis.clone().multiplyScalar(
      spinAngularMomentumMagnitude,
    );
    return {
      ballCenter: gimbalCenter.clone(),
      ballSpinAngle,
      ballSpinAngularSpeed,
      ballSpinTurns: (ballSpinAngle - sourceBallSpinAngle) / fullTurn,
      cycleCoordinate,
      cyclePhase,
      fixedRotorAxis: fixedRotorAxis.clone(),
      gimbalCenter: gimbalCenter.clone(),
      gimbalCompensationRateError:
        outerYawAngularSpeed + middleRelativeAngularSpeed,
      innerPitch: fixedInnerPitch,
      innerPivotAxis,
      innerPivotCenters,
      innerWorldQuaternion,
      middlePivotAxis,
      middlePivotCenters,
      middleRelativeAngularSpeed,
      middleRelativeYaw,
      middleWorldAngularSpeed: 0,
      middleWorldQuaternion,
      outerBottomSupportPoint,
      outerQuaternion,
      outerYaw,
      outerYawAngularAcceleration,
      outerYawAngularSpeed,
      rotorAxis,
      rotorAxisDriftRate: new THREE.Vector3(),
      rotorAxisError: rotorAxis.distanceTo(fixedRotorAxis),
      rotorBearingCenters,
      rotorShaftEndpoints,
      spinAngularMomentum,
      spinAngularMomentumRate: new THREE.Vector3(),
      supportPointError: outerBottomSupportPoint.distanceTo(
        new THREE.Vector3(0, outerBottomY, 0),
      ),
      yawCancellationError: THREE.MathUtils.euclideanModulo(
        outerYaw + middleRelativeYaw - fixedMiddleWorldYaw + Math.PI,
        fullTurn,
      ) - Math.PI,
    };
  };

  const contacts = {
    middleRingPivots: {
      axis: Y_AXIS.clone(),
      axisOrthogonalityError: 0,
      centers: [],
    },
    outerSupport: {
      axis: Y_AXIS.clone(),
      centerError: 0,
      point: new THREE.Vector3(0, outerBottomY, 0),
    },
    rotorBearings: {
      axis: fixedRotorAxis.clone(),
      axisOrthogonalityError: 0,
      centers: [],
    },
    smallestRingPivots: {
      axis: X_AXIS.clone(),
      axisOrthogonalityError: 0,
      centers: [],
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    outerYawGroup.rotation.set(0, state.outerYaw, 0);
    middleYawGroup.rotation.set(0, state.middleRelativeYaw, 0);
    innerPitchGroup.rotation.set(state.innerPitch, 0, 0);
    ballSpinRotor.rotation.set(0, 0, state.ballSpinAngle);
    outerYawGroup.userData.angularSpeed = state.outerYawAngularSpeed;
    middleYawGroup.userData.angularSpeed =
      state.middleRelativeAngularSpeed;
    innerPitchGroup.userData.angularSpeed = 0;
    ballSpinRotor.userData.angularSpeed = state.ballSpinAngularSpeed;

    contacts.outerSupport.centerError = state.supportPointError;
    contacts.middleRingPivots.axis = state.middlePivotAxis.clone();
    contacts.middleRingPivots.axisOrthogonalityError = Math.abs(
      state.middlePivotAxis.dot(state.innerPivotAxis),
    );
    contacts.middleRingPivots.centers = state.middlePivotCenters.map(
      (center) => center.clone(),
    );
    contacts.smallestRingPivots.axis = state.innerPivotAxis.clone();
    contacts.smallestRingPivots.axisOrthogonalityError = Math.abs(
      state.innerPivotAxis.dot(state.middlePivotAxis),
    );
    contacts.smallestRingPivots.centers = state.innerPivotCenters.map(
      (center) => center.clone(),
    );
    contacts.rotorBearings.axis = state.rotorAxis.clone();
    contacts.rotorBearings.axisOrthogonalityError = Math.abs(
      state.rotorAxis.dot(state.innerPivotAxis),
    );
    contacts.rotorBearings.centers = state.rotorBearingCenters.map(
      (center) => center.clone(),
    );
    root.userData.kinematics = state;
  };

  root.userData.archetype = 'three-ring-inertial-axis-gimbal';
  root.userData.blocks = {
    ballEquator,
    ballSpinIndexes,
    ballSpinRotor,
    baseFoot,
    baseOutline,
    baseTier,
    heavyBall,
    innerEdgeLines,
    innerPitchGroup,
    innerPivotBearings,
    innerPivotPins,
    innerRing,
    lowerYawBearing,
    lowerYawTrunnion,
    middleEdgeLines,
    middlePivotBearings,
    middlePivotPins,
    middleRing,
    middleYawGroup,
    outerEdgeLines,
    outerRing,
    outerYawGroup,
    pedestalNeck,
    rotorBearingHousings,
    rotorBearingRims,
    rotorHub,
    rotorShaft,
    shaftCaps,
    supportColumn,
  };
  root.userData.cameraDistanceScale = 0.98;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.85, -2.72, -2.15),
    new THREE.Vector3(2.85, 3.58, 2.15),
  );
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    externalDemonstrationInput:
      'the operator slowly reorients outer ring A about its supported vertical diameter',
    input: 'one rapid spin of heavy ball B about its shaft in ring A2',
    mechanism: 3,
    output:
      'two mutually perpendicular frictionless gimbal rotations preserve the inertial rotor-axis direction',
  };
  root.userData.dynamics = {
    angularImpulseForAxisDeflection,
    axisSlewRateForTransverseTorque,
    ballMass,
    ballSpinInertia,
    ballSpinAngularSpeed,
    hubMass,
    hubSpinInertia,
    referenceAxisSlewRate,
    rotorSpinInertia,
    shaftMass,
    shaftSpinInertia,
    spinAngularMomentumMagnitude,
    spinKineticEnergy,
    transverseTorqueForReferenceSlew,
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    alterationCyclePeriod,
    alterationRate,
    ballRadius,
    bearingLength,
    bearingRadius,
    cyclePeriod: alterationCyclePeriod,
    fixedInnerPitch,
    fixedMiddleWorldYaw,
    fixedRotorAxis: fixedRotorAxis.clone(),
    fullTurn,
    gimbalCenter: gimbalCenter.clone(),
    hubLength,
    hubRadius,
    innerPivotOffset,
    innerRadius,
    innerTubeRadius,
    middlePivotOffset,
    middleRadius,
    middleTubeRadius,
    outerBottomY,
    outerRadius,
    outerTubeRadius,
    outerYawAmplitude,
    rotorBearingOffset,
    rotorShaftHalfLength,
    rotorShaftRadius,
    sourceBallLeftRaster: sourceBallLeftRaster.clone(),
    sourceBallRadiusPixels,
    sourceBallRightRaster: sourceBallRightRaster.clone(),
    sourceBallSpinAngle,
    sourceGimbalCenterRaster: sourceGimbalCenterRaster.clone(),
    sourceInnerEndOneRaster: sourceInnerEndOneRaster.clone(),
    sourceInnerEndTwoRaster: sourceInnerEndTwoRaster.clone(),
    sourceInnerRadiusPixels,
    sourceMiddleBottomRaster: sourceMiddleBottomRaster.clone(),
    sourceMiddleRadiusPixels,
    sourceMiddleTopRaster: sourceMiddleTopRaster.clone(),
    sourceOuterBottomRaster: sourceOuterBottomRaster.clone(),
    sourceOuterLeftRaster: sourceOuterLeftRaster.clone(),
    sourceOuterRadiusPixels,
    sourceOuterRightRaster: sourceOuterRightRaster.clone(),
    sourceOuterTopRaster: sourceOuterTopRaster.clone(),
    sourceOuterYaw,
    sourcePedestalFloorRaster: sourcePedestalFloorRaster.clone(),
    sourceScale,
    spinTurnsPerAlterationCycle,
  };
  root.userData.mechanism =
    'Bohnenberger-heavy-ball-B-spins-about-its-shaft-in-bearings-in-smallest-ring-A2-which-pivots-about-a-perpendicular-diameter-in-middle-ring-A1-which-pivots-about-the-right-angle-vertical-diameter-in-outer-ring-A-while-ideal-gimbal-compensation-keeps-the-rotor-axis-fixed-as-A-is-reoriented';
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    pageMarksAnimationUnavailable: true,
    sourcePrescribedTiming: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate356: {
      ballLeft: sourceBallLeftRaster.clone(),
      ballRight: sourceBallRightRaster.clone(),
      gimbalCenter: sourceGimbalCenterRaster.clone(),
      imageHeight: 525,
      imageWidth: 525,
      innerEndOne: sourceInnerEndOneRaster.clone(),
      innerEndTwo: sourceInnerEndTwoRaster.clone(),
      measurementUncertaintyPixels: 11,
      middleBottom: sourceMiddleBottomRaster.clone(),
      middleTop: sourceMiddleTopRaster.clone(),
      outerBottom: sourceOuterBottomRaster.clone(),
      outerLeft: sourceOuterLeftRaster.clone(),
      outerRight: sourceOuterRightRaster.clone(),
      outerTop: sourceOuterTopRaster.clone(),
      pedestalFloor: sourcePedestalFloorRaster.clone(),
    },
    labels: {
      A: 'outer supported ring',
      A1: 'middle ring on the vertical diameter pivots of A',
      A2: 'smallest ring on pivots perpendicular to those of A1',
      B: 'heavy spherical rotor whose shaft runs in bearings in A2',
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    axisPreservation:
      'outer support yaw and equal opposite middle-ring relative yaw cancel exactly, while the perpendicular inner-ring angle remains fixed',
    bearingSequence:
      'A-to-A1 vertical pivots, A1-to-A2 perpendicular pivots, and A2-to-B shaft bearings form three consecutive right-angle axes',
    cyclePeriod: alterationCyclePeriod,
    demonstrationScope:
      'the source gives no motion schedule; the slow outer-ring handling motion is an explicit demonstration input, not a claimed motor',
    gyroscopicResistance:
      'a transverse torque changes the direction of spin angular momentum at angular rate torque divided by its magnitude',
  };

  update(0);
  markShadows(root);
  correctGyroscopeParts(root, 356);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredGyroscopeMovement(movement) {
  if (movement.id === 355) {
    return singleSupportSteadyPrecessionGyroscope(movement);
  }
  if (movement.id === 356) return bohnenbergerThreeRingMachine(movement);
  return null;
}
