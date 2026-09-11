import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, depth, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cylinderAlongX(radius, depth, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
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

function lineTube(points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    closed,
    'centripetal',
  );
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.max(96, points.length * 3),
      radius,
      8,
      closed,
    ),
    material,
  );
}

function dashedBeam(start, end, dashCount, width, depth, material) {
  const group = new THREE.Group();
  const delta = end.clone().sub(start);
  for (let index = 0; index < dashCount; index += 1) {
    const u0 = (index + 0.12) / dashCount;
    const u1 = (index + 0.64) / dashCount;
    const dash = beamBetween(
      start.clone().addScaledVector(delta, u0),
      start.clone().addScaledVector(delta, u1),
      width,
      depth,
      material,
    );
    group.add(dash);
  }
  return group;
}

function makeWheel(
  radius,
  materials,
  role,
) {
  const rotor = new THREE.Group();
  rotor.userData.role = role;
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.095, 12, 64),
    materials.dark,
  );
  tire.userData.role = `${role}-road-tire`;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.77, 0.050, 10, 56),
    materials.frame,
  );
  rim.userData.role = `${role}-inner-rim`;
  const hub = cylinderAlongZ(radius * 0.16, 0.34, materials.accent, 32);
  hub.userData.role = `${role}-hub-on-transverse-axle`;
  rotor.add(tire, rim, hub);
  const spokes = Array.from({ length: 8 }, (_, index) => {
    const angle = FULL_TURN * index / 8;
    const spoke = beamBetween(
      new THREE.Vector3(
        radius * 0.13 * Math.cos(angle),
        radius * 0.13 * Math.sin(angle),
        0,
      ),
      new THREE.Vector3(
        radius * 0.73 * Math.cos(angle),
        radius * 0.73 * Math.sin(angle),
        0,
      ),
      0.055,
      0.12,
      materials.frame,
    );
    spoke.userData.role = `${role}-spoke-${index + 1}`;
    rotor.add(spoke);
    return spoke;
  });
  const rotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    materials.white,
  );
  rotationIndex.position.set(0, radius * 0.77, 0.14);
  rotationIndex.userData.role = `${role}-white-no-slip-rotation-index`;
  rotor.add(rotationIndex);
  return { hub, rim, rotationIndex, rotor, spokes, tire };
}

function selfRecordingLevel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8.0;
  const triangleBase = 4.0;
  const wheelRadius = triangleBase / FULL_TURN;
  const wheelCircumference = FULL_TURN * wheelRadius;
  const leftWheelCenter = new THREE.Vector2(-triangleBase / 2, 0);
  const rightWheelCenter = new THREE.Vector2(triangleBase / 2, 0);
  const constructionApex = new THREE.Vector2(0, 2.38);
  const pendulumPivot = new THREE.Vector2(0, 1.52);
  const pendulumBobRadius = 2.02;
  const pencilPendulumRadius = 1.52;
  const maximumGroundInclination = 0.205;
  const drumRadius = 0.49;
  const chartContactRadius = drumRadius + 0.018;
  const drumLength = 1.55;
  const drumCenter = new THREE.Vector3(0, 0, 0.23);
  const wheelToDrumRatio = 1;
  const chartTraceSamples = 360;
  const drumVerticalScaleOffset = 0;
  const drumAxialPaperOffset = 0;
  const groundDashSpacing = triangleBase / 8;
  const groundDisplayLength = triangleBase * 1.90;
  const geometry = {
    chartTraceSamples,
    chartContactRadius,
    constructionApex,
    cycleDuration,
    drumAxialPaperOffset,
    drumCenter,
    drumLength,
    drumRadius,
    drumVerticalScaleOffset,
    groundDashSpacing,
    groundDisplayLength,
    leftWheelCenter,
    maximumGroundInclination,
    pencilPendulumRadius,
    pendulumBobRadius,
    pendulumPivot,
    rightWheelCenter,
    triangleBase,
    wheelCircumference,
    wheelRadius,
    wheelToDrumRatio,
  };

  const frameMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });
  const paperMaterial = matte(0xe8e2cf, {
    metalness: 0,
    roughness: 0.91,
  });
  const terrainMaterial = matte(0x77766f, {
    metalness: 0.02,
    roughness: 0.92,
  });
  const traceMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.driver,
    linewidth: 2,
  });
  const materials = {
    accent: accentMaterial,
    dark: darkMaterial,
    frame: frameMaterial,
    white: whiteMaterial,
  };

  const terrain = new THREE.Group();
  terrain.userData.role =
    'moving-local-tangent-ground-demonstrating-one-base-length-of-travel';
  const groundBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      groundDisplayLength,
      0.16,
      0.48,
    ),
    terrainMaterial,
  );
  groundBeam.position.set(0, -wheelRadius - 0.08, -0.08);
  groundBeam.userData.role = 'instantaneous-straight-ground-tangent';
  terrain.add(groundBeam);
  const groundDashes = Array.from({ length: 16 }, (_, index) => {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.025, 0.025),
      whiteMaterial,
    );
    dash.position.set(
      -groundDisplayLength / 2 + index * groundDashSpacing,
      -wheelRadius + 0.015,
      0.18,
    );
    dash.userData.role = `ground-travel-index-${index + 1}`;
    terrain.add(dash);
    return dash;
  });
  root.add(terrain);

  const carriage = new THREE.Group();
  carriage.userData.role =
    'two-wheel-isosceles-frame-surveying-carriage';
  root.add(carriage);
  const leftWheel = makeWheel(
    wheelRadius,
    materials,
    'left-ground-driven-survey-wheel',
  );
  leftWheel.rotor.position.set(leftWheelCenter.x, leftWheelCenter.y, 0);
  carriage.add(leftWheel.rotor);
  const rightWheel = makeWheel(
    wheelRadius,
    materials,
    'right-no-slip-survey-wheel',
  );
  rightWheel.rotor.position.set(rightWheelCenter.x, rightWheelCenter.y, 0);
  carriage.add(rightWheel.rotor);

  const actualArchPoints = [
    new THREE.Vector3(leftWheelCenter.x, 0.05, 0.03),
    new THREE.Vector3(-1.72, 0.73, 0.03),
    new THREE.Vector3(-0.94, 1.25, 0.03),
    new THREE.Vector3(0, pendulumPivot.y, 0.03),
    new THREE.Vector3(0.94, 1.25, 0.03),
    new THREE.Vector3(1.72, 0.73, 0.03),
    new THREE.Vector3(rightWheelCenter.x, 0.05, 0.03),
  ];
  const archFrame = lineTube(actualArchPoints, 0.105, frameMaterial);
  archFrame.userData.role =
    'curved-carriage-frame-governed-by-isosceles-triangle';
  carriage.add(archFrame);
  const baseBracePoints = [
    new THREE.Vector3(leftWheelCenter.x, 0.07, -0.02),
    new THREE.Vector3(-1.35, -0.16, -0.02),
    new THREE.Vector3(0, -0.08, -0.02),
    new THREE.Vector3(1.35, -0.16, -0.02),
    new THREE.Vector3(rightWheelCenter.x, 0.07, -0.02),
  ];
  const baseBrace = lineTube(baseBracePoints, 0.075, frameMaterial);
  baseBrace.userData.role = 'lower-wheel-center-base-brace';
  carriage.add(baseBrace);
  const upperBrace = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.10, 0.16),
    frameMaterial,
  );
  upperBrace.position.set(0, 0.94, 0.02);
  upperBrace.userData.role = 'upper-horizontal-carriage-brace';
  carriage.add(upperBrace);

  const triangleConstruction = new THREE.Group();
  triangleConstruction.userData.role =
    'nonphysical-isosceles-governing-triangle-construction';
  const triangleLeft = dashedBeam(
    new THREE.Vector3(constructionApex.x, constructionApex.y, -0.08),
    new THREE.Vector3(leftWheelCenter.x, leftWheelCenter.y, -0.08),
    14,
    0.025,
    0.020,
    whiteMaterial,
  );
  const triangleRight = dashedBeam(
    new THREE.Vector3(constructionApex.x, constructionApex.y, -0.08),
    new THREE.Vector3(rightWheelCenter.x, rightWheelCenter.y, -0.08),
    14,
    0.025,
    0.020,
    whiteMaterial,
  );
  const triangleBaseWitness = dashedBeam(
    new THREE.Vector3(leftWheelCenter.x, 0, -0.08),
    new THREE.Vector3(rightWheelCenter.x, 0, -0.08),
    18,
    0.025,
    0.020,
    whiteMaterial,
  );
  triangleConstruction.add(
    triangleLeft,
    triangleRight,
    triangleBaseWitness,
  );
  carriage.add(triangleConstruction);

  const handle = new THREE.Group();
  handle.userData.role = 'left-hand-push-handle-fixed-to-carriage';
  const handleLower = beamBetween(
    new THREE.Vector3(-1.64, 0.77, -0.08),
    new THREE.Vector3(-3.20, 1.17, -0.08),
    0.095,
    0.18,
    frameMaterial,
  );
  const handleUpper = beamBetween(
    new THREE.Vector3(-1.50, 0.93, 0.13),
    new THREE.Vector3(-3.04, 1.34, 0.13),
    0.095,
    0.18,
    frameMaterial,
  );
  const handleGrip = cylinderAlongX(0.105, 0.58, darkMaterial, 30);
  handleGrip.position.set(-3.18, 1.26, 0.03);
  handle.add(handleLower, handleUpper, handleGrip);
  carriage.add(handle);

  const drumCarrier = new THREE.Group();
  drumCarrier.position.set(
    drumAxialPaperOffset,
    drumVerticalScaleOffset,
    0,
  );
  drumCarrier.userData.role =
    'vertically-and-horizontally-adjustable-chart-drum-carrier';
  carriage.add(drumCarrier);
  const drumShaft = cylinderAlongX(
    0.065,
    3.42,
    darkMaterial,
    24,
  );
  drumShaft.position.copy(drumCenter).setX(-0.30);
  drumShaft.userData.role =
    'horizontal-chart-drum-shaft-extending-to-left-bevel-drive';
  drumCarrier.add(drumShaft);
  const drumRotor = new THREE.Group();
  drumRotor.position.copy(drumCenter);
  drumRotor.userData.role =
    'wheel-geared-horizontal-axis-chart-drum-rotor';
  drumCarrier.add(drumRotor);
  const paperDrum = cylinderAlongX(
    drumRadius,
    drumLength,
    paperMaterial,
    72,
  );
  paperDrum.userData.role =
    'cylindrical-sectionally-ruled-recording-paper';
  drumRotor.add(paperDrum);
  const chartSectionRings = Array.from({ length: 13 }, (_, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(drumRadius + 0.006, 0.010, 6, 64),
      index % 3 === 0 ? darkMaterial : frameMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = THREE.MathUtils.lerp(
      -drumLength / 2 + 0.04,
      drumLength / 2 - 0.04,
      index / 12,
    );
    ring.userData.role = index % 3 === 0
      ? 'major-axial-paper-section-ruling'
      : 'minor-axial-paper-section-ruling';
    drumRotor.add(ring);
    return ring;
  });
  const chartGeneratorLines = Array.from({ length: 12 }, (_, index) => {
    const angle = FULL_TURN * index / 12;
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(drumLength - 0.06, 0.010, 0.010),
      index % 3 === 0 ? darkMaterial : frameMaterial,
    );
    line.position.set(
      0,
      (drumRadius + 0.008) * Math.sin(angle),
      (drumRadius + 0.008) * Math.cos(angle),
    );
    line.userData.role = index % 3 === 0
      ? 'major-circumferential-paper-section-ruling'
      : 'minor-circumferential-paper-section-ruling';
    drumRotor.add(line);
    return line;
  });
  const leftDrumCollar = cylinderAlongX(
    drumRadius * 0.72,
    0.12,
    darkMaterial,
    42,
  );
  leftDrumCollar.position.x = -drumLength / 2 - 0.07;
  const rightDrumCollar = cylinderAlongX(
    drumRadius * 0.72,
    0.12,
    darkMaterial,
    42,
  );
  rightDrumCollar.position.x = drumLength / 2 + 0.07;
  drumRotor.add(leftDrumCollar, rightDrumCollar);

  const verticalDrumGuide = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 1.10, 0.16),
    frameMaterial,
  );
  verticalDrumGuide.position.set(1.13, 0.24, 0.11);
  verticalDrumGuide.userData.role =
    'vertical-drum-scale-adjustment-guide';
  carriage.add(verticalDrumGuide);
  const verticalAdjustmentKnob = cylinderAlongZ(
    0.15,
    0.28,
    accentMaterial,
    30,
  );
  verticalAdjustmentKnob.position.set(1.13, 0.66, 0.24);
  verticalAdjustmentKnob.userData.role =
    'drum-vertical-scale-locking-knob';
  carriage.add(verticalAdjustmentKnob);
  const axialAdjustmentKnob = cylinderAlongX(
    0.14,
    0.26,
    accentMaterial,
    30,
  );
  axialAdjustmentKnob.position.set(1.18, 0, 0.23);
  axialAdjustmentKnob.userData.role =
    'drum-horizontal-paper-shift-locking-knob';
  carriage.add(axialAdjustmentKnob);

  const bevelDrive = new THREE.Group();
  bevelDrive.position.set(leftWheelCenter.x, 0, 0.23);
  bevelDrive.userData.role =
    'left-wheel-axis-member-of-one-to-one-right-angle-bevel-stage';
  const bevelDriveCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.34, 0.30, 28),
    driverMaterial,
  );
  bevelDriveCone.rotation.x = Math.PI / 2;
  bevelDriveCone.position.z = 0.17;
  const bevelDriveIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 14, 10),
    whiteMaterial,
  );
  bevelDriveIndex.position.set(0, 0.27, 0.30);
  bevelDriveIndex.userData.role = 'wheel-axis-bevel-speed-index';
  bevelDrive.add(bevelDriveCone, bevelDriveIndex);
  carriage.add(bevelDrive);
  const bevelDrum = new THREE.Group();
  bevelDrum.position.set(leftWheelCenter.x + 0.18, 0, 0.23);
  bevelDrum.userData.role =
    'horizontal-drum-axis-member-of-one-to-one-right-angle-bevel-stage';
  const bevelDrumCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.34, 0.30, 28),
    accentMaterial,
  );
  bevelDrumCone.rotation.z = Math.PI / 2;
  bevelDrumCone.position.x = 0.17;
  const bevelDrumIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 14, 10),
    whiteMaterial,
  );
  bevelDrumIndex.position.set(0.30, 0.27, 0);
  bevelDrumIndex.userData.role = 'drum-axis-bevel-speed-index';
  bevelDrum.add(bevelDrumCone, bevelDrumIndex);
  carriage.add(bevelDrum);

  const pendulum = new THREE.Group();
  pendulum.position.set(pendulumPivot.x, pendulumPivot.y, 0.76);
  pendulum.userData.role =
    'gravity-vertical-pendulum-relative-to-inclining-carriage';
  const pendulumRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, pendulumBobRadius, 0.095),
    darkMaterial,
  );
  pendulumRod.position.y = -pendulumBobRadius / 2;
  pendulumRod.userData.role = 'rigid-pendulum-rod';
  const pendulumBob = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.31, 0.25),
    driverMaterial,
  );
  pendulumBob.position.y = -pendulumBobRadius;
  pendulumBob.userData.role = 'gravity-pendulum-bob';
  const pencilCarrier = cylinderAlongZ(
    0.13,
    0.20,
    accentMaterial,
    30,
  );
  pencilCarrier.position.set(0, -pencilPendulumRadius, -0.02);
  pencilCarrier.userData.role =
    'pencil-carrier-fixed-on-pendulum-rod';
  pendulum.add(pendulumRod, pendulumBob, pencilCarrier);
  carriage.add(pendulum);
  const pendulumPivotAxle = cylinderAlongZ(
    0.16,
    0.42,
    darkMaterial,
    34,
  );
  pendulumPivotAxle.position.set(
    pendulumPivot.x,
    pendulumPivot.y,
    0.61,
  );
  pendulumPivotAxle.userData.role =
    'pendulum-pivot-on-carriage-perpendicular-bisector';
  carriage.add(pendulumPivotAxle);
  const pivotIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    whiteMaterial,
  );
  pivotIndex.position.set(
    pendulumPivot.x,
    pendulumPivot.y,
    0.86,
  );
  pivotIndex.userData.role = 'white-pendulum-axis-index';
  carriage.add(pivotIndex);

  const pencilStylus = new THREE.Group();
  pencilStylus.userData.role =
    'pendulum-pencil-maintaining-contact-with-chart-paper';
  const pencilBody = cylinderAlongZ(0.050, 1, darkMaterial, 24);
  pencilBody.userData.role = 'axial-pencil-stylus-to-drum';
  const pencilTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 16, 12),
    driverMaterial,
  );
  pencilTip.userData.role = 'pencil-tip-on-rotating-paper';
  pencilStylus.add(pencilBody, pencilTip);
  carriage.add(pencilStylus);

  const pitchAtPhase = (phase) => maximumGroundInclination
    * Math.sin(FULL_TURN * phase);
  const traceMaterialPointAtPhase = (phase) => {
    const pitch = pitchAtPhase(phase);
    const pencilX = -pencilPendulumRadius * Math.sin(pitch);
    const pencilY = pendulumPivot.y
      - pencilPendulumRadius * Math.cos(pitch);
    const radialY = pencilY - drumCenter.y;
    const contactAngle = Math.asin(radialY / chartContactRadius);
    const drumAngle = FULL_TURN * wheelToDrumRatio * phase;
    const materialAngle = contactAngle + drumAngle;
    return new THREE.Vector3(
      pencilX,
      chartContactRadius * Math.sin(materialAngle),
      chartContactRadius * Math.cos(materialAngle),
    );
  };
  const tracePointCount = chartTraceSamples + 2;
  const traceTemplate = new Float32Array(tracePointCount * 3);
  for (let index = 0; index < tracePointCount; index += 1) {
    const phase = Math.min(index / chartTraceSamples, 1);
    const point = traceMaterialPointAtPhase(phase);
    traceTemplate[index * 3] = point.x;
    traceTemplate[index * 3 + 1] = point.y;
    traceTemplate[index * 3 + 2] = point.z;
  }
  const tracePositions = new Float32Array(traceTemplate);
  const traceGeometry = new THREE.BufferGeometry();
  const tracePositionAttribute = new THREE.BufferAttribute(
    tracePositions,
    3,
  );
  tracePositionAttribute.setUsage(THREE.DynamicDrawUsage);
  traceGeometry.setAttribute('position', tracePositionAttribute);
  traceGeometry.setDrawRange(0, 1);
  const chartTrace = new THREE.Line(traceGeometry, traceMaterial);
  chartTrace.userData.role =
    'continuous-pencil-trace-progressively-inscribed-on-paper';
  drumRotor.add(chartTrace);

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const phaseAngle = FULL_TURN * cyclePhase;
    const angularFrequency = FULL_TURN / cycleDuration;
    const travelDistance = triangleBase * cyclePhase;
    const travelSpeed = triangleBase / cycleDuration;
    const groundInclination = maximumGroundInclination
      * Math.sin(phaseAngle);
    const groundInclinationSpeed = maximumGroundInclination
      * angularFrequency * Math.cos(phaseAngle);
    const groundInclinationAcceleration = -maximumGroundInclination
      * angularFrequency ** 2 * Math.sin(phaseAngle);
    const wheelAngle = -travelDistance / wheelRadius;
    const wheelAngularSpeed = -travelSpeed / wheelRadius;
    const drumAngle = -wheelToDrumRatio * wheelAngle;
    const drumAngularSpeed = -wheelToDrumRatio * wheelAngularSpeed;
    const pendulumRelativeAngle = -groundInclination;
    const pendulumWorldAngle = groundInclination
      + pendulumRelativeAngle;
    const pencilLocalX = -pencilPendulumRadius
      * Math.sin(groundInclination);
    const pencilLocalY = pendulumPivot.y
      - pencilPendulumRadius * Math.cos(groundInclination);
    const radialY = pencilLocalY - drumCenter.y;
    const radialZ = Math.sqrt(chartContactRadius ** 2 - radialY ** 2);
    const pencilContact = new THREE.Vector3(
      pencilLocalX,
      pencilLocalY,
      drumCenter.z + radialZ,
    );
    const pencilContactAngle = Math.atan2(radialY, radialZ);
    const pencilLocalXSpeed = -pencilPendulumRadius
      * Math.cos(groundInclination) * groundInclinationSpeed;
    const pencilLocalYSpeed = pencilPendulumRadius
      * Math.sin(groundInclination) * groundInclinationSpeed;
    const pencilLocalXAcceleration = pencilPendulumRadius * (
      Math.sin(groundInclination) * groundInclinationSpeed ** 2
      - Math.cos(groundInclination) * groundInclinationAcceleration
    );
    const pencilLocalYAcceleration = pencilPendulumRadius * (
      Math.cos(groundInclination) * groundInclinationSpeed ** 2
      + Math.sin(groundInclination) * groundInclinationAcceleration
    );
    const traceMaterialPoint = traceMaterialPointAtPhase(cyclePhase);
    const tracePointAfterDrumRotation = traceMaterialPoint.clone()
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), drumAngle)
      .add(drumCenter);
    return {
      cycleCoordinate,
      cyclePhase,
      drumAngle,
      drumAngularSpeed,
      groundInclination,
      groundInclinationAcceleration,
      groundInclinationSpeed,
      leftContactLocal: new THREE.Vector2(
        leftWheelCenter.x,
        -wheelRadius,
      ),
      noSlipResidual: travelDistance + wheelRadius * wheelAngle,
      pencilContact,
      pencilContactAngle,
      pencilContactRadialResidual:
        Math.hypot(radialY, radialZ) - chartContactRadius,
      pencilLocalAcceleration: new THREE.Vector2(
        pencilLocalXAcceleration,
        pencilLocalYAcceleration,
      ),
      pencilLocalPosition: new THREE.Vector2(
        pencilLocalX,
        pencilLocalY,
      ),
      pencilLocalVelocity: new THREE.Vector2(
        pencilLocalXSpeed,
        pencilLocalYSpeed,
      ),
      pendulumRelativeAngle,
      pendulumWorldAngle,
      rightContactLocal: new THREE.Vector2(
        rightWheelCenter.x,
        -wheelRadius,
      ),
      traceContactResidual: tracePointAfterDrumRotation.distanceTo(
        pencilContact,
      ),
      traceMaterialPoint,
      tracePointAfterDrumRotation,
      travelDistance,
      travelSpeed,
      wheelAngle,
      wheelAngularSpeed,
    };
  };

  const updateTrace = (cyclePhase) => {
    tracePositions.set(traceTemplate);
    const exactIndex = Math.floor(cyclePhase * chartTraceSamples);
    const exactPoint = traceMaterialPointAtPhase(cyclePhase);
    const writeIndex = Math.min(exactIndex + 1, tracePointCount - 1);
    tracePositions[writeIndex * 3] = exactPoint.x;
    tracePositions[writeIndex * 3 + 1] = exactPoint.y;
    tracePositions[writeIndex * 3 + 2] = exactPoint.z;
    tracePositionAttribute.needsUpdate = true;
    traceGeometry.setDrawRange(0, writeIndex + 1);
    return { drawCount: writeIndex + 1, endpointIndex: writeIndex };
  };
  const update = (time) => {
    const state = stateAtTime(time);
    carriage.rotation.z = state.groundInclination;
    terrain.rotation.z = state.groundInclination;
    leftWheel.rotor.rotation.z = state.wheelAngle;
    rightWheel.rotor.rotation.z = state.wheelAngle;
    bevelDrive.rotation.z = state.wheelAngle;
    drumRotor.rotation.x = state.drumAngle;
    bevelDrum.rotation.x = state.drumAngle;
    pendulum.rotation.z = state.pendulumRelativeAngle;
    const stylusOuterZ = 0.83;
    const stylusLength = stylusOuterZ - state.pencilContact.z;
    pencilStylus.position.set(
      state.pencilContact.x,
      state.pencilContact.y,
      (stylusOuterZ + state.pencilContact.z) / 2,
    );
    pencilBody.scale.y = stylusLength;
    pencilBody.position.z = 0;
    pencilTip.position.set(
      0,
      0,
      -stylusLength / 2,
    );
    const traceState = updateTrace(state.cyclePhase);
    for (let index = 0; index < groundDashes.length; index += 1) {
      const raw = -groundDisplayLength / 2
        + index * groundDashSpacing
        - state.travelDistance;
      groundDashes[index].position.x = positiveModulo(
        raw + groundDisplayLength / 2,
        groundDisplayLength,
      ) - groundDisplayLength / 2;
    }
    root.userData.contacts = {
      chartTraceToPencil: {
        active: true,
        materialPoint: state.traceMaterialPoint,
        radialResidual: state.pencilContactRadialResidual,
        spatialResidual: state.traceContactResidual,
      },
      leftWheelToGround: {
        active: true,
        localPoint: state.leftContactLocal,
        noSlipResidual: state.noSlipResidual,
      },
      pendulumPencilToPaper: {
        active: true,
        point: state.pencilContact,
        radialResidual: state.pencilContactRadialResidual,
      },
      rightWheelToGround: {
        active: true,
        localPoint: state.rightContactLocal,
        noSlipResidual: state.noSlipResidual,
      },
    };
    root.userData.traceState = traceState;
    root.userData.kinematics = state;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    archetype:
      'two-wheel-isosceles-survey-carriage-with-world-vertical-pendulum-wheel-geared-ruled-paper-drum-and-contact-pencil',
    blocks: {
      archFrame,
      axialAdjustmentKnob,
      baseBrace,
      bevelDrive,
      bevelDriveCone,
      bevelDrum,
      bevelDrumCone,
      carriage,
      chartGeneratorLines,
      chartSectionRings,
      chartTrace,
      drumCarrier,
      drumRotor,
      drumShaft,
      groundBeam,
      groundDashes,
      handle,
      leftWheel,
      paperDrum,
      pencilCarrier,
      pencilStylus,
      pencilTip,
      pendulum,
      pendulumBob,
      pendulumPivotAxle,
      pendulumRod,
      rightWheel,
      terrain,
      triangleConstruction,
      upperBrace,
      verticalAdjustmentKnob,
      verticalDrumGuide,
    },
    constraints: {
      drum:
        'A one-to-one ideal right-angle bevel stage reverses the ground-driven wheel rotation onto the horizontal drum shaft; this selected ratio is engineered because Brown gives no tooth counts.',
      frame:
        'The two wheel centers form the horizontal base of an isosceles governing triangle whose apex lies on their perpendicular bisector.',
      pendulum:
        'Quasi-static gravity keeps the pendulum world-vertical, so its carriage-relative angle is exactly the negative ground inclination.',
      recording:
        'The pendulum-carried pencil remains on the cylindrical chart/ink surface and coincides with the current endpoint of the progressively revealed material trace.',
      wheels:
        'Both equal wheels contact one instantaneous straight terrain tangent and roll without slip through one revolution per base-length of surface travel.',
    },
    degreesOfFreedom: {
      configurationCoordinates: [
        'vertical drum shift selecting record scale',
        'horizontal drum shift selecting unused paper',
      ],
      dependentCoordinates: [
        'equal wheel rotations from no-slip travel',
        'carriage inclination from local terrain tangent',
        'pendulum angle relative to carriage',
        'right-angle geared drum rotation',
        'pencil contact position on cylindrical paper',
      ],
      independentPrescribedInputs: 1,
      inputs: ['surface distance traveled by the carriage'],
      note:
        'Drum scale and paper offsets are locked configuration settings. The operating reconstruction has one travel input; terrain grade is a prescribed periodic function of that distance and all wheel, frame, pendulum, drum, and pencil coordinates follow.',
      operatingDegreesOfFreedom: 1,
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'equal rigid wheels with exact rolling and no slip',
        'rigid isosceles carriage on a locally straight terrain tangent',
        'quasi-static gravity pendulum with no oscillatory transient',
        'rigid ideal one-to-one bevel gears with no backlash',
        'massless frictionless pencil maintaining cylindrical chart contact; the visible ink radius is exaggerated 0.018 unit above the paper substrate',
        'periodic inclination demonstration and moving-ground display',
        'wheel load, terrain compliance, friction, inertia, damping, pencil drag, and ink thickness omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless spatial rolling, gravity, gearing, and recording kinematics',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'two equal ground wheels support a carriage governed by an isosceles triangle; their circumference equals the wheel-center base, a gravity pendulum indicates carriage inclination, one wheel turns a horizontal ruled-paper drum through right-angle gearing, and the pendulum pencil records its inclination profile on the moving paper',
    motion: {
      cycleDuration,
      sequence:
        'level -> rising tangent -> level crest -> falling tangent -> level, over exactly one base length and one wheel revolution',
      sourcePosePhase: 0,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 411 page marks Animated unavailable and provides only Brown’s engraving and description.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate411: {
        carriageArchApproximateBoundsPixels: [71, 187, 456, 391],
        chartDrumApproximateBoundsPixels: [184, 286, 358, 361],
        constructionApexApproximatePixels: [270, 29],
        imageHeight: 525,
        imageWidth: 525,
        leftWheelApproximateBoundsPixels: [14, 329, 137, 449],
        measurementUncertaintyPixels: 11,
        pendulumApproximateBoundsPixels: [252, 178, 293, 418],
        rightWheelApproximateBoundsPixels: [389, 330, 505, 449],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device is a self-recording level for surveyors',
          'its carriage shape is governed by an isosceles triangle with horizontal base',
          'each wheel circumference equals that triangle base',
          'the pendulum bisects the base on level ground',
          'the pendulum gravitates right or left on an inclination',
          'gearing from one carriage wheel rotates the drum',
          'the drum carries sectionally ruled paper',
          'the pendulum pencil traces a profile corresponding to traversed ground',
          'vertical drum shift selects scale',
          'horizontal drum shift avoids removing filled paper',
        ],
        engravingEvidence:
          'The plate shows two equal spoked wheels, a symmetric arched frame under a dotted isosceles construction, a central gravity pendulum and low bob, a horizontally oriented ruled-paper drum, a left-side right-angle drive, and push handles.',
        reconstructionDisclosure:
          'Brown fixes the topology, wheel-circumference/base equality, gravity indication, and wheel-driven chart but gives no dimensions, gear counts, paper scale, terrain function, timing, masses, or loads. The one-to-one bevel ratio, sinusoidal local inclination, quasi-static pendulum, drum offsets, colors, and progressive trace are independently engineered and explicitly exposed.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 411',
    },
    sourcePose: {
      drumAngle: sourceState.drumAngle,
      groundInclination: sourceState.groundInclination,
      pendulumWorldAngle: sourceState.pendulumWorldAngle,
      setting:
        'level terrain, horizontal wheel-center base, centered world-vertical pendulum, and horizontal ruled-paper drum, matching Brown’s plate',
      wheelAngle: sourceState.wheelAngle,
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    traceMaterialPointAtPhase,
    transmission: {
      baseCircumferenceRelation:
        'triangle base=wheel circumference=2*pi*wheel radius',
      drumRelation:
        'drum angle=-wheelToDrumRatio*wheel angle with selected ratio 1',
      noSlipRelation:
        'surface travel+wheel radius*wheel angle=0',
      pendulumRelation:
        'pendulum world angle=carriage inclination+relative pendulum angle=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.52, -1.04, -0.52),
    new THREE.Vector3(2.78, 2.58, 1.08),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(6.4, 3.5, 13.0);
  root.userData.groundFloorY = -1.04;
  markShadows(root);
  groundBeam.receiveShadow = true;
  triangleConstruction.traverse((object) => {
    object.castShadow = false;
  });
  chartTrace.castShadow = false;
  update(0);
  return { root, update };
}

export function createAuthoredSelfRecordingLevelMovement(movement) {
  if (movement.id !== 411) return null;
  return selfRecordingLevel(movement);
}
