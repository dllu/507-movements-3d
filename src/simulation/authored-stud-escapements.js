import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { correctAnnularStudEscapement } from './annular-stud-working-parts.js';
import { capsule, plate, polygonClipping } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 30) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function boredCylinderAlongZ(radius, length, boreRadius, material, segments = 30) {
  const cylinder = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -length / 2, radial: radius },
      { axial: length / 2, radial: radius },
    ], boreRadius, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 10,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function crossZ(point) {
  return new THREE.Vector2(-point.y, point.x);
}

function polygonShape(points) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function annularShape(outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(opening);
  return shape;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function edgeTube(points, z, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
    false,
    'centripetal',
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 54, radius, 8, false),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function studEscapement(movement) {
  const root = new THREE.Group();

  // Brown's plate is a projected view of a large annular escape wheel. The
  // small triangular marks alternate between studs fixed to the front and
  // rear faces. Both pallets rock about F, but one occupies each axial plane.
  // Their stop faces are circular about F, so rocking the pendulum cannot
  // move a locked stud; the adjoining generated inclines provide impulse.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.015;
  const sourceRasterPalletPivotF = new THREE.Vector2(226, 62);
  const sourceRasterWheelCenter = new THREE.Vector2(177, 478);
  const sourceRasterWorkingRegion = new THREE.Vector2(390, 379);
  const sourceRasterFrontPalletB = new THREE.Vector2(489, 344);
  const sourceRasterRearPalletEnd = new THREE.Vector2(363, 357);
  const sourceRasterDirectionArrow = new THREE.Vector2(473, 447);
  const sourceRasterWheelOuterRadius = 236;
  const sourceRasterVisibleStudCount = 13;
  const palletPivot = new THREE.Vector2(0, 3.8);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    palletPivot.x + (x - sourceRasterPalletPivotF.x) * sourceScale,
    palletPivot.y + (sourceRasterPalletPivotF.y - y) * sourceScale,
  );
  const wheelCenter = sourcePointToModel(sourceRasterWheelCenter);

  const studCount = 48;
  const studPitch = FULL_TURN / studCount;
  const studOrbitRadius = 3.42;
  const studRadius = 0.105;
  const studLength = 0.70;
  const wheelOuterRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelInnerRadius = 2.93;
  const wheelDepth = 0.30;
  const palletDepth = 0.20;
  const frontPlaneZ = 0.63;
  const rearPlaneZ = -0.63;
  const lockReferenceAngle = THREE.MathUtils.degToRad(25.2);

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const palletAmplitude = THREE.MathUtils.degToRad(5.4);
  const lockingAmplitudeFraction = 0.34;
  const releaseAmplitudeFraction = 0.07;
  const landingHalfPhase = Math.asin(lockingAmplitudeFraction) / Math.PI;
  const impulseStartHalfPhase = 1 - landingHalfPhase;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const impulsePalletSpan = (
    lockingAmplitudeFraction - releaseAmplitudeFraction
  ) * palletAmplitude;
  const impulseAdvance = studPitch * 0.24;
  const freeDropAdvance = studPitch - impulseAdvance;
  const dropDuration = (
    1 - releaseHalfPhase + landingHalfPhase
  ) * halfBeatDuration;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const planeNameForSide = (side) => (side > 0 ? 'front' : 'rear');
  const planeZForSide = (side) => (side > 0 ? frontPlaneZ : rearPlaneZ);
  const activeStudIndexForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, studCount)
  );
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    lockReferenceAngle - halfBeatIndex * studPitch
  );
  const lockStudCenter = wheelCenter.clone().add(new THREE.Vector2(
    Math.cos(lockReferenceAngle) * studOrbitRadius,
    Math.sin(lockReferenceAngle) * studOrbitRadius,
  ));
  const impulseProgressAtPalletAngle = (side, palletAngle) => (
    (
      lockingAmplitudeFraction * palletAmplitude
        - side * palletAngle
    ) / impulsePalletSpan
  );
  const impulseWheelDeltaAtPalletAngle = (side, palletAngle) => {
    const progress = impulseProgressAtPalletAngle(side, palletAngle);
    return impulseAdvance * progress ** 2;
  };
  const impulseWheelSlopeAtPalletAngle = (side, palletAngle) => {
    const progress = impulseProgressAtPalletAngle(side, palletAngle);
    return side * 2 * impulseAdvance * progress / impulsePalletSpan;
  };
  const impulseStudCenter = (side, palletAngle) => {
    const angle = lockReferenceAngle
      - impulseWheelDeltaAtPalletAngle(side, palletAngle);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * studOrbitRadius,
      Math.sin(angle) * studOrbitRadius,
    ));
  };
  const studCenterLocal = (side, palletAngle, mode) => {
    const center = mode === 'lock'
      ? lockStudCenter
      : impulseStudCenter(side, palletAngle);
    return rotate2(center.clone().sub(palletPivot), -palletAngle);
  };
  const centerFrameLocal = (side, palletAngle, mode) => {
    if (
      mode === 'impulse'
      && Math.abs(impulseProgressAtPalletAngle(side, palletAngle)) < 1e-10
    ) {
      return centerFrameLocal(side, palletAngle, 'lock');
    }
    const center = studCenterLocal(side, palletAngle, mode);
    const worldCenter = mode === 'lock' ? lockStudCenter : impulseStudCenter(side, palletAngle);
    const wheelSlope = mode === 'lock' ? 0 : impulseWheelSlopeAtPalletAngle(side, palletAngle);
    const tangent = rotate2(crossZ(worldCenter.clone().sub(wheelCenter))
      .multiplyScalar(wheelSlope).sub(crossZ(worldCenter.clone().sub(palletPivot))), -palletAngle).normalize();
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x);
    if (outwardNormal.dot(center) < 0) outwardNormal.multiplyScalar(-1);
    return { center, outwardNormal, tangent };
  };
  const palletFaceLocalPoint = (side, palletAngle, mode) => {
    const frame = centerFrameLocal(side, palletAngle, mode);
    return frame.center.clone().addScaledVector(
      frame.outwardNormal,
      studRadius,
    );
  };
  const palletFaceFrame = (side, palletAngle, mode) => {
    const centerFrame = centerFrameLocal(side, palletAngle, mode);
    const point = centerFrame.center.clone().addScaledVector(
      centerFrame.outwardNormal,
      studRadius,
    );
    return {
      ...centerFrame,
      point,
      tangent: centerFrame.tangent,
    };
  };
  const lockFacePoints = (side, pointCount = 49) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * palletAmplitude,
        palletAmplitude,
        index / (pointCount - 1),
      );
      return palletFaceLocalPoint(side, side * magnitude, 'lock');
    },
  );
  const impulseFacePoints = (side, pointCount = 31) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * palletAmplitude,
        releaseAmplitudeFraction * palletAmplitude,
        index / (pointCount - 1),
      );
      return palletFaceLocalPoint(side, side * magnitude, 'impulse');
    },
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.55,
  });
  const impulseMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.48,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-forty-eight-position-stud-escape-wheel-A';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-stepping-stud-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const wheelRim = new THREE.Mesh(
    centeredExtrusion(
      annularShape(wheelOuterRadius, wheelInnerRadius),
      wheelDepth,
      0.008,
    ),
    driverMaterial,
  );
  wheelRim.userData.role = 'annular-large-clock-stud-wheel-rim';
  wheelRotor.add(wheelRim);

  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
    const angle = Math.PI / 4 + spokeIndex * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2.85, 0.25, wheelDepth * 0.84),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 1.43,
      Math.sin(angle) * 1.43,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `stud-wheel-spoke-${spokeIndex + 1}`;
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.42, 0.78, darkMaterial, 38);
  wheelHub.userData.role = 'stud-wheel-arbor-hub';
  wheelRotor.add(wheelHub);
  const wheelShaft = cylinderAlongZ(0.14, 1.62, darkMaterial, 34);
  wheelShaft.userData.role = 'fixed-axis-stud-wheel-shaft';
  escapeWheel.add(wheelShaft);

  const studMeshes = [];
  const frontStuds = [];
  const rearStuds = [];
  for (let studIndex = 0; studIndex < studCount; studIndex += 1) {
    const angle = studIndex * studPitch;
    const front = studIndex % 2 === 0;
    const axialSign = front ? 1 : -1;
    // Brown draws the studs as small triangles on the rim face. Each is a
    // triangular prism inscribed in the stud circle the pallet faces were
    // generated for, its apex leading in the clockwise direction of travel.
    const studShape = new THREE.Shape(Array.from({ length: 3 }, (_, k) => {
      const vertexAngle = -Math.PI / 2 + k * FULL_TURN / 3;
      return new THREE.Vector2(
        Math.cos(vertexAngle) * studRadius,
        Math.sin(vertexAngle) * studRadius,
      );
    }));
    const stud = new THREE.Mesh(
      new THREE.ExtrudeGeometry(studShape, {
        bevelEnabled: false,
        depth: studLength,
      }).translate(0, 0, -studLength / 2),
      driverMaterial,
    );
    stud.rotation.z = angle;
    stud.position.set(
      Math.cos(angle) * studOrbitRadius,
      Math.sin(angle) * studOrbitRadius,
      axialSign * (wheelDepth / 2 + studLength / 2 - 0.035),
    );
    stud.userData.axialPlane = front ? 'front' : 'rear';
    stud.userData.index = studIndex;
    stud.userData.role = front
      ? 'front-face-escape-wheel-stud'
      : 'rear-face-escape-wheel-stud';
    studMeshes.push(stud);
    if (front) frontStuds.push(stud);
    else rearStuds.push(stud);
    wheelRotor.add(stud);
  }
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 18, 14),
    indexMaterial,
  );
  wheelIndex.position.set(
    studOrbitRadius,
    0,
    wheelDepth / 2 + studLength + 0.015,
  );
  wheelIndex.userData.role = 'white-index-on-front-stud-zero';
  wheelRotor.add(wheelIndex);

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role =
    'pendulum-rocked-front-and-rear-stud-pallet-assembly-at-F';

  const lockMaterial = indexMaterial;
  const makePallet = (side) => {
    const planeName = planeNameForSide(side);
    const planeZ = planeZForSide(side);
    const lockPoints = lockFacePoints(side);
    const impulsePoints = impulseFacePoints(side);
    const workingPath = [
      ...lockPoints.slice().reverse(),
      ...impulsePoints.slice(1),
    ];
    const bodyThickness = 0.28;
    const backingPath = workingPath.map((point) => point.clone()
      .addScaledVector(point.clone().normalize(), bodyThickness));
    const body = new THREE.Mesh(
      centeredExtrusion(polygonShape([
        ...workingPath,
        ...backingPath.reverse(),
      ]), palletDepth, 0),
      drivenMaterial,
    );
    body.position.z = planeZ;
    body.userData.role = `${planeName}-pallet-working-block`;

    const lockEdge = edgeTube(
      lockPoints,
      planeZ + palletDepth / 2 + 0.012,
      0.040,
      lockMaterial,
      `${planeName}-pallet-concentric-stop-face`,
    );
    const impulseEdge = edgeTube(
      impulsePoints,
      planeZ + palletDepth / 2 + 0.018,
      0.052,
      impulseMaterial,
      `${planeName}-pallet-inclined-impulse-face`,
    );
    const radialDirection = lockPoints[0].clone().normalize();
    const transverse = crossZ(radialDirection);
    const armEnd2 = radialDirection
      .multiplyScalar(lockPoints[0].length() + 0.14)
      .addScaledVector(transverse, side * 0.40);
    const arm = beamBetween(
      new THREE.Vector3(0, 0, planeZ),
      new THREE.Vector3(armEnd2.x, armEnd2.y, planeZ),
      0.27,
      palletDepth,
      drivenMaterial,
    );
    arm.userData.role = `${planeName}-pallet-long-arm-from-F`;
    const bridgePoint = lockPoints[Math.floor(lockPoints.length / 2)]
      .clone()
      .addScaledVector(
        lockPoints[Math.floor(lockPoints.length / 2)].clone().normalize(),
        bodyThickness * 0.55,
      );
    const bridge = beamBetween(
      new THREE.Vector3(armEnd2.x, armEnd2.y, planeZ),
      new THREE.Vector3(bridgePoint.x, bridgePoint.y, planeZ),
      0.25,
      palletDepth,
      drivenMaterial,
    );
    bridge.userData.role = `${planeName}-arm-to-working-pallet-bridge`;
    const group = new THREE.Group();
    group.userData.axialPlane = planeName;
    group.userData.role = `${planeName}-complete-stud-pallet`;
    group.add(arm, bridge, body, lockEdge, impulseEdge);
    return {
      arm,
      body,
      bridge,
      group,
      impulseEdge,
      impulsePoints,
      lockEdge,
      lockPoints,
    };
  };
  const frontPallet = makePallet(1);
  const rearPallet = makePallet(-1);
  const palletPivotHub = cylinderAlongZ(0.30, 1.62, darkMaterial, 38);
  palletPivotHub.userData.role = 'common-pallet-and-pendulum-arbor-F';
  const pivotIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.09, 0.28),
    indexMaterial,
  );
  pivotIndex.position.set(0, 0.47, 0.88);
  pivotIndex.userData.role = 'white-index-on-pallet-arbor-F';
  palletAssembly.add(
    rearPallet.group,
    frontPallet.group,
    palletPivotHub,
    pivotIndex,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 14),
    indexMaterial,
  );
  contactMarker.userData.role = 'white-marker-on-active-stud-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-large-clock-two-arbor-frame';
  const rearStandard = beamBetween(
    new THREE.Vector3(
      wheelCenter.x,
      wheelCenter.y - wheelOuterRadius - 0.72,
      -1.06,
    ),
    new THREE.Vector3(palletPivot.x, palletPivot.y + 0.82, -1.06),
    0.23,
    0.25,
    frameMaterial,
  );
  rearStandard.userData.role = 'fixed-rear-clock-plate-standard';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.08, 10, 42),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, -0.83);
  wheelBearing.userData.role = 'fixed-stud-wheel-arbor-bearing';
  const palletBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.37, 0.08, 10, 42),
    frameMaterial,
  );
  palletBearing.position.set(palletPivot.x, palletPivot.y, -0.83);
  palletBearing.userData.role = 'fixed-pallet-arbor-bearing-F';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.25, 0.88),
    frameMaterial,
  );
  base.position.set(
    0,
    wheelCenter.y - wheelOuterRadius - 0.88,
    -0.86,
  );
  base.userData.role = 'fixed-large-clock-frame-base';
  fixedFrame.add(rearStandard, wheelBearing, palletBearing, base);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(10.3, 12.6, 3.5),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, -0.50, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-complete-large-clock-stud-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    palletAssembly,
    contactMarker,
  );

  const impulseReleasePalletSpeed = palletAmplitude * Math.PI
    * Math.cos(Math.PI * releaseHalfPhase) / halfBeatDuration;
  const impulseReleasePalletAcceleration = -palletAmplitude * Math.PI ** 2
    * Math.sin(Math.PI * releaseHalfPhase) / halfBeatDuration ** 2;
  const releaseProgressRate = -impulseReleasePalletSpeed
    / impulsePalletSpan;
  const releaseProgressAcceleration = -impulseReleasePalletAcceleration
    / impulsePalletSpan;
  const impulseReleaseWheelSpeed = -2 * impulseAdvance
    * releaseProgressRate;
  const impulseReleaseWheelAcceleration = -2 * impulseAdvance * (
    releaseProgressRate ** 2 + releaseProgressAcceleration
  );
  const freeDropAngularAcceleration = 2 * (
    -freeDropAdvance - impulseReleaseWheelSpeed * dropDuration
  ) / dropDuration ** 2;
  const freeDropLandingWheelSpeed = impulseReleaseWheelSpeed
    + freeDropAngularAcceleration * dropDuration;
  const landingImpactVelocityChange = -freeDropLandingWheelSpeed;

  const stateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const palletAngle = side * palletAmplitude
      * Math.sin(Math.PI * halfPhase);
    const palletAngularSpeed = side * palletAmplitude * Math.PI
      * Math.cos(Math.PI * halfPhase) / halfBeatDuration;
    const palletAngularAcceleration = -side * palletAmplitude * Math.PI ** 2
      * Math.sin(Math.PI * halfPhase) / halfBeatDuration ** 2;
    const eventTolerance = 1e-12;
    const lockActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase < impulseStartHalfPhase - eventTolerance;
    const impulseActive = halfPhase >= (
      impulseStartHalfPhase - eventTolerance
    ) && halfPhase <= releaseHalfPhase + eventTolerance;
    const contactActive = lockActive || impulseActive;
    let wheelAngle;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    let activeHalfBeatIndex = halfBeatIndex;
    let stage;
    let dropProgress = null;
    let impulseProgress = null;
    if (lockActive) {
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex);
      wheelAngularSpeed = 0;
      wheelAngularAcceleration = 0;
      stage = side > 0
        ? 'front-pallet-concentric-deadbeat-lock'
        : 'rear-pallet-concentric-deadbeat-lock';
    } else if (impulseActive) {
      impulseProgress = THREE.MathUtils.clamp(
        impulseProgressAtPalletAngle(side, palletAngle),
        0,
        1,
      );
      const progressRate = -side * palletAngularSpeed
        / impulsePalletSpan;
      const progressAcceleration = -side * palletAngularAcceleration
        / impulsePalletSpan;
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex)
        - impulseAdvance * impulseProgress ** 2;
      wheelAngularSpeed = -2 * impulseAdvance
        * impulseProgress * progressRate;
      wheelAngularAcceleration = -2 * impulseAdvance * (
        progressRate ** 2
          + impulseProgress * progressAcceleration
      );
      stage = side > 0
        ? 'front-pallet-incline-impulse'
        : 'rear-pallet-incline-impulse';
    } else {
      const earlyDrop = halfPhase < landingHalfPhase;
      const dropStartHalfBeat = earlyDrop
        ? halfBeatIndex - 1
        : halfBeatIndex;
      const dropEndHalfBeat = dropStartHalfBeat + 1;
      const dropStartCoordinate = dropStartHalfBeat + releaseHalfPhase;
      const currentCoordinate = halfBeatIndex + halfPhase;
      const elapsedDropTime = (
        currentCoordinate - dropStartCoordinate
      ) * halfBeatDuration;
      dropProgress = elapsedDropTime / dropDuration;
      wheelAngle = wheelAngleAtHalfLanding(dropStartHalfBeat)
        - impulseAdvance
        + impulseReleaseWheelSpeed * elapsedDropTime
        + 0.5 * freeDropAngularAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = impulseReleaseWheelSpeed
        + freeDropAngularAcceleration * elapsedDropTime;
      wheelAngularAcceleration = freeDropAngularAcceleration;
      activeHalfBeatIndex = dropEndHalfBeat;
      stage = sideForHalfBeat(dropEndHalfBeat) > 0
        ? 'clockwise-free-drop-to-front-pallet'
        : 'clockwise-free-drop-to-rear-pallet';
    }

    const activeSide = contactActive
      ? side
      : sideForHalfBeat(activeHalfBeatIndex);
    const activeStudIndex = activeStudIndexForHalfBeat(
      activeHalfBeatIndex,
    );
    const activeStudAngle = wheelAngle + activeStudIndex * studPitch;
    const activeStudCenter = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(activeStudAngle) * studOrbitRadius,
      Math.sin(activeStudAngle) * studOrbitRadius,
    ));
    let contact = null;
    if (contactActive) {
      const mode = lockActive ? 'lock' : 'impulse';
      const faceFrame = palletFaceFrame(activeSide, palletAngle, mode);
      const expectedPoint = palletPivot.clone().add(
        rotate2(faceFrame.point, palletAngle),
      );
      const pinOffsetWorld = rotate2(
        faceFrame.point.clone().sub(faceFrame.center),
        palletAngle,
      );
      const studSurfacePoint = activeStudCenter.clone().add(pinOffsetWorld);
      const faceTangent = rotate2(faceFrame.tangent, palletAngle);
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      ).normalize();
      const studMaterialVelocity = crossZ(
        studSurfacePoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(
        expectedPoint.clone().sub(palletPivot),
      ).multiplyScalar(palletAngularSpeed);
      const relativeVelocity = studMaterialVelocity.clone()
        .sub(palletMaterialVelocity);
      contact = {
        axialPlane: planeNameForSide(activeSide),
        concentricRadiusError: lockActive
          ? Math.abs(
            faceFrame.point.length()
              - (lockStudCenter.distanceTo(palletPivot) + studRadius)
          )
          : null,
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: faceFrame.point,
        mode: lockActive ? 'concentric-stop' : 'inclined-impulse',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        pointError: studSurfacePoint.distanceTo(expectedPoint),
        radialClearanceError: activeStudCenter.distanceTo(studSurfacePoint)
          - studRadius,
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        studMaterialVelocity,
        studSurfacePoint,
      };
    }
    const cycleIndex = Math.floor(time / pendulumPeriod);
    const cyclePhase = time / pendulumPeriod - cycleIndex;
    return {
      activeHalfBeatIndex,
      activeSide,
      activeStudAngle,
      activeStudCenter,
      activeStudIndex,
      activeStudPlane: planeNameForSide(activeSide),
      contact,
      contactActive,
      contactMode: contact?.mode ?? null,
      cycleIndex,
      cyclePhase,
      dropProgress,
      halfBeatIndex,
      halfPhase,
      impulseProgress,
      palletAngle,
      palletAngularAcceleration,
      palletAngularSpeed,
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const canonicalTimes = {
    frontLanding: landingHalfPhase * halfBeatDuration,
    frontMaximumLock: halfBeatDuration / 2,
    frontImpulseStart: impulseStartHalfPhase * halfBeatDuration,
    frontRelease: releaseHalfPhase * halfBeatDuration,
    rearLanding: halfBeatDuration
      + landingHalfPhase * halfBeatDuration,
    rearMaximumLock: halfBeatDuration * 1.5,
    rearImpulseStart: halfBeatDuration
      + impulseStartHalfPhase * halfBeatDuration,
    rearRelease: halfBeatDuration
      + releaseHalfPhase * halfBeatDuration,
    oneOscillation: pendulumPeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.palletAngle;
    palletAssembly.userData.angularAcceleration =
      state.palletAngularAcceleration;
    palletAssembly.userData.angularSpeed = state.palletAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    // Brown draws no contact marker; keep its position as data only.
    contactMarker.visible = false;
    if (state.contactActive) {
      contactMarker.position.set(
        state.contact.expectedPoint.x,
        state.contact.expectedPoint.y,
        planeZForSide(state.activeSide) + palletDepth / 2 + 0.10,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        activePallet: `${state.activeStudPlane}-pallet`,
        activeStudIndex: state.activeStudIndex,
        axialPlane: state.contact.axialPlane,
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        radialClearanceError: state.contact.radialClearanceError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activeStudIndex: state.activeStudIndex,
        axialPlane: state.activeStudPlane,
        dropProgress: state.dropProgress,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        radialClearanceError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  const radiusRange = (points) => {
    const radii = points.map((point) => point.length());
    return Math.max(...radii) - Math.min(...radii);
  };
  root.userData.archetype =
    'forty-eight-alternating-front-rear-stud-deadbeat-escapement';
  root.userData.mechanism =
    'one large annular escape wheel carries 48 equally spaced studs alternating between its front and back faces; one common pendulum arbor F rocks a front pallet B and a rear pallet, whose stop faces are exact arcs about F and whose adjoining inclines alternately receive a stud and impulse the pendulum';
  root.userData.transmission = {
    deadbeat: 'wheel speed and acceleration are exactly zero while either stud rests on its concentric stop face',
    direction: 'escape wheel advances clockwise, matching Brown’s downward arrow at the right rim',
    frontStudCount: studCount / 2,
    halfBeatAdvance: studPitch,
    impulse: 'the front and rear inclined pallet planes alternately receive impulse from their matching axial stud rows',
    oscillationAdvance: 2 * studPitch,
    rearStudCount: studCount / 2,
    recoil: 'none',
    studCount,
  };
  root.userData.blocks = {
    base,
    cameraEnvelope,
    contactMarker,
    escapeWheel,
    fixedFrame,
    frontPallet: frontPallet.group,
    frontPalletArm: frontPallet.arm,
    frontPalletBody: frontPallet.body,
    frontStuds,
    palletAssembly,
    palletBearing,
    palletPivotHub,
    pivotIndex,
    rearPallet: rearPallet.group,
    rearPalletArm: rearPallet.arm,
    rearPalletBody: rearPallet.body,
    rearStandard,
    rearStuds,
    spokeMeshes,
    studMeshes,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRim,
    wheelRotor,
    wheelShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    dropDuration,
    eventPeriod: pendulumPeriod,
    freeDropAdvance,
    freeDropAngularAcceleration,
    freeDropLandingWheelSpeed,
    frontPlaneZ,
    halfBeatDuration,
    impulseAdvance,
    impulsePalletSpan,
    impulseReleaseWheelAcceleration,
    impulseReleaseWheelSpeed,
    impulseStartHalfPhase,
    landingHalfPhase,
    landingImpactVelocityChange,
    lockReferenceAngle,
    lockingAmplitudeFraction,
    palletAmplitude,
    palletDepth,
    palletPivot: palletPivot.clone(),
    pendulumPeriod,
    rearPlaneZ,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    studCount,
    studLength,
    studOrbitRadius,
    studPitch,
    studRadius,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelOuterRadius,
  };
  root.userData.impulseFacePoints = impulseFacePoints;
  root.userData.impulseProgressAtPalletAngle =
    impulseProgressAtPalletAngle;
  root.userData.impulseStudCenter = impulseStudCenter;
  root.userData.impulseWheelDeltaAtPalletAngle =
    impulseWheelDeltaAtPalletAngle;
  root.userData.impulseWheelSlopeAtPalletAngle =
    impulseWheelSlopeAtPalletAngle;
  root.userData.lockFacePoints = lockFacePoints;
  root.userData.lockStudCenter = lockStudCenter.clone();
  root.userData.palletFaceFrame = palletFaceFrame;
  root.userData.palletFaceLocalPoint = palletFaceLocalPoint;
  root.userData.palletProfiles = {
    front: {
      axialPlane: 'front',
      impulseConcentricRadiusRange: radiusRange(
        frontPallet.impulsePoints,
      ),
      impulsePoints: frontPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(frontPallet.lockPoints),
      lockPoints: frontPallet.lockPoints,
      sourceName: 'B',
    },
    rear: {
      axialPlane: 'rear',
      impulseConcentricRadiusRange: radiusRange(
        rearPallet.impulsePoints,
      ),
      impulsePoints: rearPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(rearPallet.lockPoints),
      lockPoints: rearPallet.lockPoints,
      sourceName: 'unlettered rear pallet',
    },
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official movement 292 page supplies Brown’s static plate and description. The alternating axial stud planes, clockwise arrow, common pallet arbor F, concentric dead-beat stops, and adjoining impulse inclines are reconstructed directly; timing and elastic impact durations are not specified by the plate.',
    sourceUrl: 'https://507movements.com/mm_292.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate292: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'a large clockwise annular wheel A carries equally spaced alternate front/rear studs; a common arbor F carries front pallet B and an unlettered rear pallet with concentric stop arcs and inclined impulse planes',
      measurementUncertaintyPixels: 9,
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterFrontPalletB: sourceRasterFrontPalletB.clone(),
      rasterPalletPivotF: sourceRasterPalletPivotF.clone(),
      rasterRearPalletEnd: sourceRasterRearPalletEnd.clone(),
      rasterVisibleStudCount: sourceRasterVisibleStudCount,
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelOuterRadius: sourceRasterWheelOuterRadius,
      rasterWorkingRegion: sourceRasterWorkingRegion.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
    corroboratingEdition: {
      author: 'Gardner D. Hiscox',
      entry: 1157,
      wording: 'Alternate studs are set on front and back of the escapement wheel; concentric stop-faces give dead-beat action and inclined planes give alternate impulse.',
      work: 'Mechanical Movements, Powers, Devices, and Appliances',
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'front-stud-lands-on-front-concentric-stop',
      'front-pallet-incline-impulse-and-release',
      'clockwise-drop-to-rear-stud-and-pallet',
      'rear-stud-lands-on-rear-concentric-stop',
      'rear-pallet-incline-impulse-and-release',
      'clockwise-drop-to-front-stud-and-pallet',
    ],
  };
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;

  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    contactMarker,
    pivotIndex,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  correctAnnularStudEscapement(root, 292, update);
  // Brown draws two distinct arms from F: G drops steeply behind the wheel
  // to the rear pallet at R, while H runs out to B in front of the wheel and
  // turns back to the front pallet. Route each arm that way, ending on its
  // existing bridge to the working block.
  const armKnees = {
    front: sourcePointToModel(sourceRasterFrontPalletB).sub(palletPivot),
    rear: sourcePointToModel(new THREE.Vector2(340, 338)).sub(palletPivot),
  };
  for (const [group, planeName] of [[frontPallet.group, 'front'], [rearPallet.group, 'rear']]) {
    const arm = group.children.find((o) => o.userData.role.endsWith('long-arm-from-F'));
    const bridge = group.children.find((o) => o.userData.role.endsWith('arm-to-working-pallet-bridge'));
    const length = bridge.geometry.parameters.width;
    const bridgeStart = [
      bridge.position.x - Math.cos(bridge.rotation.z) * length / 2,
      bridge.position.y - Math.sin(bridge.rotation.z) * length / 2,
    ];
    const knee = armKnees[planeName].toArray();
    const outline = polygonClipping.union(
      capsule([0, 0], knee, 0.2, 24),
      capsule(knee, bridgeStart, 0.16, 24),
    );
    const z = arm.position.z;
    arm.geometry.dispose();
    arm.geometry = plate(outline, -palletDepth / 2, palletDepth / 2);
    arm.position.set(0, 0, z);
    arm.rotation.set(0, 0, 0);
    arm.userData.role = `${planeName}-pallet-arm-${planeName === 'front' ? 'H-via-B' : 'G'}-long-arm-from-F`;
  }
  // The generated working faces are offset curves of the prescribed stud
  // paths; at the lock-to-impulse handoff that offset forms a small cusp the
  // stud cuts. Relieve each block by exactly the sampled stud discs that
  // reach it, leaving a simple outline that clears every sampled pose.
  const reliefRadius = (studRadius + 0.0002) / Math.cos(Math.PI / 48);
  for (const [pallet, side] of [[frontPallet, 1], [rearPallet, -1]]) {
    const outline = pallet.body.geometry.parameters.shapes.getPoints()
      .map((point) => [point.x, point.y]);
    const reliefs = [];
    const reliefCenters = [];
    const reach = studRadius + 0.001;
    const bodyMin = [Math.min(...outline.map((p) => p[0])) - reach, Math.min(...outline.map((p) => p[1])) - reach];
    const bodyMax = [Math.max(...outline.map((p) => p[0])) + reach, Math.max(...outline.map((p) => p[1])) + reach];
    const bodyPolygon = [[[...outline, outline[0]]]];
    const sampleCount = 4096;
    for (let i = 0; i <= sampleCount; i += 1) {
      const state = root.userData.stateAtTime(pendulumPeriod * i / sampleCount);
      for (let n = side > 0 ? 0 : 1; n < studCount; n += 2) {
        const angle = state.wheelAngle + n * studPitch;
        const local = rotate2(wheelCenter.clone().add(new THREE.Vector2(
          Math.cos(angle) * studOrbitRadius,
          Math.sin(angle) * studOrbitRadius,
        )).sub(palletPivot), -state.palletAngle);
        if (local.x < bodyMin[0] || local.x > bodyMax[0]
          || local.y < bodyMin[1] || local.y > bodyMax[1]) continue;
        let inside = false;
        let distance = Infinity;
        for (let a = 0, b = outline.length - 1; a < outline.length; b = a, a += 1) {
          const [ax, ay] = outline[b];
          const [bx, by] = outline[a];
          if ((by > local.y) !== (ay > local.y)
            && local.x < (ax - bx) * (local.y - by) / (ay - by) + bx) inside = !inside;
          const dx = bx - ax;
          const dy = by - ay;
          const lengthSquared = dx * dx + dy * dy;
          const t = lengthSquared > 0
            ? THREE.MathUtils.clamp(((local.x - ax) * dx + (local.y - ay) * dy) / lengthSquared, 0, 1)
            : 0;
          distance = Math.min(distance, Math.hypot(local.x - ax - t * dx, local.y - ay - t * dy));
        }
        if ((inside ? -distance : distance) < studRadius + 0.0002
          && !reliefCenters.some((center) => center.distanceTo(local) < 0.004)) {
          reliefCenters.push(local);
          reliefs.push(Array.from({ length: 48 }, (_, k) => [
            local.x + reliefRadius * Math.cos(k * FULL_TURN / 48),
            local.y + reliefRadius * Math.sin(k * FULL_TURN / 48),
          ]));
        }
      }
    }
    if (reliefs.length === 0) continue;
    const relieved = polygonClipping.difference(
      bodyPolygon,
      ...reliefs.map((ring) => [[...ring, ring[0]]]),
    );
    const largest = relieved.reduce((best, polygon) => (
      Math.abs(THREE.ShapeUtils.area(polygon[0].map(([x, y]) => new THREE.Vector2(x, y))))
        > Math.abs(THREE.ShapeUtils.area(best[0].map(([x, y]) => new THREE.Vector2(x, y)))) ? polygon : best
    ));
    const ring = largest[0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
    pallet.body.geometry.dispose();
    pallet.body.geometry = centeredExtrusion(polygonShape(ring), palletDepth, 0);
    pallet.body.userData.handoffReliefDiscs = reliefs.length;
  }
  root.userData.reconstructionNote = 'Two arms hang from F as drawn: G behind the wheel to the rear pallet and H in front, out to B and back to the front pallet. The outward-backed pallets oppose clockwise stud motion; their lock/impulse handoff cusp is relieved by the sampled stud discs, so the prescribed handoff clears. Timing, impact and energy remain prescribed rather than passive dynamics.';
  // Neither index mark appears on Brown's plate.
  wheelIndex.visible = false;
  pivotIndex.visible = false;
  const armBounds = new THREE.Box3();
  const armPoint = new THREE.Vector3();
  for (let i = 0; i <= 32; i += 1) {
    update(pendulumPeriod * i / 32);
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      const positions = object.geometry?.attributes.position;
      if (!positions) return;
      for (let j = 0; j < positions.count; j += 1) {
        armBounds.expandByPoint(armPoint.fromBufferAttribute(positions, j).applyMatrix4(object.matrixWorld));
      }
    });
  }
  root.userData.cameraFitBounds = armBounds.expandByScalar(0.15);
  // Brown's 292 is a close-up: F at the top, the pallets and the upper-right
  // rim arc, the hub at the bottom edge; the rest of the wheel runs off the
  // plate. Frame about the plate's extent (source pixels 10..530 x 20..520 at
  // 0.015 per pixel about F, B's swing kept inside) rather than the whole wheel.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(palletPivot.x - 3.24, palletPivot.y - 6.87, -1.9),
    new THREE.Vector3(palletPivot.x + 4.6, palletPivot.y + 0.63, 1.2),
  );
  root.userData.cameraFitCropsSource = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

function lePautePinConvexHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1])
    - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2
      && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2
      && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function lePautePinSegmentDistance(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? THREE.MathUtils.clamp(
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared,
      0,
      1,
    )
    : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

function lePautePinPointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Signed distance from a point to a polygon-clipping multipolygon:
// negative inside material, positive outside.
function lePautePinSignedDistance(point, multiPolygon) {
  let distance = Infinity;
  let inside = false;
  for (const polygon of multiPolygon) {
    polygon.forEach((ring, ringIndex) => {
      for (let index = 0; index + 1 < ring.length; index += 1) {
        distance = Math.min(distance,
          lePautePinSegmentDistance(point, ring[index], ring[index + 1]));
      }
      if (lePautePinPointInRing(point, ring)) {
        inside = ringIndex === 0 ? true : false;
      }
    });
  }
  return inside ? -distance : distance;
}

function lePautePinWheelEscapement(movement) {
  const root = new THREE.Group();

  // Brown's plate compares the original half-round A pin with the improved
  // B pin, whose unused upper half is cut away and whose underside is
  // relieved to a short circular working arc. Every pin projects from one
  // face of one wheel and both pallet bits work in that same plane. A broad
  // plate hangs from the round collet on the pallet arbor in front of the pin
  // ends; its right leg carries the higher outer pallet (tip pointing left,
  // outside the pin circle) and its left leg the lower inner pallet (tip
  // pointing right, inside the pin circle). A pin is held on the outer
  // pallet, passes to the inner pallet on the following beat, and the
  // succeeding pin then reaches the outer pallet. Resting faces are circular
  // about the pallet arbor (true deadbeat); every other pallet surface is the
  // backing region with the finite swept pin outlines removed.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(190, 333);
  const sourceRasterWheelOuterRadius = 171;
  const sourceRasterWheelInnerRadius = 129;
  const sourceRasterPinOrbitRadius = 149;
  const sourceRasterWheelBounds = Object.freeze({
    bottom: 506,
    left: 19,
    right: 385,
    top: 164,
  });
  const sourceRasterPalletPivot = new THREE.Vector2(359, 101);
  const sourceRasterColletRadius = 72;
  const sourceRasterOuterPalletTip = new THREE.Vector2(352, 352);
  const sourceRasterInnerPalletTip = new THREE.Vector2(340, 386);
  const sourceRasterLegacyPinA = new THREE.Vector2(47, 318);
  const sourceRasterPreferredPinB = new THREE.Vector2(321, 429);
  const sourceRasterHubBoltCircleRadius = 31;
  const sourceRasterHubRadius = 45;
  const sourceRasterDirection = 'clockwise, corroborated by the period construction drawing';
  const sourceScale = 3 / sourceRasterWheelOuterRadius;
  const wheelCenter = new THREE.Vector2(0, 0);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const palletPivot = sourcePointToModel(sourceRasterPalletPivot);

  const direction = -1;
  // Positive pallet angles swing the pallet feet to the right. The outer
  // pallet comes from the right, so it locks while the feet swing left.
  const palletSense = -1;
  const pinCount = 30;
  const pinPitch = FULL_TURN / pinCount;
  const halfPinPitch = pinPitch / 2;
  const wheelOuterRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelInnerRadius = sourceRasterWheelInnerRadius * sourceScale;
  const pinOrbitRadius = sourceRasterPinOrbitRadius * sourceScale;
  const wheelDepth = 0.34;
  const pinLength = 0.66;
  const palletDepth = 0.24;
  const workingPlaneZ = wheelDepth / 2 + pinLength * 0.64;
  const pinFrontZ = wheelDepth / 2 + pinLength;
  const plateClearance = 0.05;
  const plateBackZ = pinFrontZ + plateClearance;
  const plateThickness = 0.10;
  const plateFrontZ = plateBackZ + plateThickness;
  const workingClearance = 0.003;

  const outerLockReferenceAngle = THREE.MathUtils.degToRad(3);
  const innerLockReferenceAngle = -outerLockReferenceAngle;
  const meanPalletRadius = (
    palletPivot.distanceTo(wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(outerLockReferenceAngle) * pinOrbitRadius,
      Math.sin(outerLockReferenceAngle) * pinOrbitRadius,
    )))
      + palletPivot.distanceTo(wheelCenter.clone().add(new THREE.Vector2(
        Math.cos(innerLockReferenceAngle) * pinOrbitRadius,
        Math.sin(innerLockReferenceAngle) * pinOrbitRadius,
      )))
  ) / 2;
  const sourcePendulumTotalSwing = THREE.MathUtils.degToRad(4);
  const palletAmplitude = sourcePendulumTotalSwing / 2;
  const sourcePinAngularDiameter = THREE.MathUtils.degToRad(4);
  const pinRadius = meanPalletRadius
    * Math.sin(sourcePinAngularDiameter / 2);

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  // Pallet amplitude fractions: the pin lands on the resting face at the
  // landing fraction; the resting face ends at the rounded pallet tip,
  // reached as the returning pallet passes the unlocking fraction; the pin
  // rolls over that tip (the lift is on the pin) and leaves it at release.
  // With Goodrich's proportions the tip travel over the whole swing only
  // equals the pin diameter, so most of the swing is lift and the drop is
  // what remains of the half pitch.
  const landingAmplitudeFraction = 0.86;
  const lockingAmplitudeFraction = 0.80;
  const releaseAmplitudeFraction = 0.02;
  const tipRoundingRadius = 0.012;
  const landingHalfPhase = Math.asin(landingAmplitudeFraction) / Math.PI;
  const impulseStartHalfPhase = 1
    - Math.asin(lockingAmplitudeFraction) / Math.PI;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const impulsePalletSpan = (
    lockingAmplitudeFraction - releaseAmplitudeFraction
  ) * palletAmplitude;
  const dropDuration = (
    1 - releaseHalfPhase + landingHalfPhase
  ) * halfBeatDuration;
  const sourceTimeOffset = halfBeatDuration / 2;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const palletNameForSide = (side) => (
    side > 0 ? 'higher-outer' : 'lower-inner'
  );
  const lockReferenceAngleForSide = (side) => (
    side > 0 ? outerLockReferenceAngle : innerLockReferenceAngle
  );
  const activePinSequenceForHalfBeat = (halfBeatIndex) => (
    Math.floor(halfBeatIndex / 2)
  );
  const activePinIndexForHalfBeat = (halfBeatIndex) => positiveModulo(
    activePinSequenceForHalfBeat(halfBeatIndex),
    pinCount,
  );
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    lockReferenceAngleForSide(sideForHalfBeat(halfBeatIndex))
      - activePinSequenceForHalfBeat(halfBeatIndex) * pinPitch
  );
  const lockPinCenterForSide = (side) => {
    const angle = lockReferenceAngleForSide(side);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
    ));
  };
  const impulseProgressAtPalletAngle = (side, palletAngle) => (
    (
      lockingAmplitudeFraction * palletAmplitude
        - palletSense * side * palletAngle
    ) / impulsePalletSpan
  );
  const normalSenseForSide = (side) => {
    const palletAngle = palletSense * side * palletAmplitude;
    const worldCenter = lockPinCenterForSide(side);
    const center = rotate2(worldCenter.clone().sub(palletPivot), -palletAngle);
    const tangent = rotate2(
      crossZ(worldCenter.clone().sub(palletPivot)).multiplyScalar(-1),
      -palletAngle,
    );
    return new THREE.Vector2(-tangent.y, tangent.x).dot(center) > 0 ? 1 : -1;
  };
  const lockFrameLocal = (side, palletAngle) => {
    const worldCenter = lockPinCenterForSide(side);
    const center = rotate2(worldCenter.clone().sub(palletPivot), -palletAngle);
    const tangent = rotate2(
      crossZ(worldCenter.clone().sub(palletPivot)).multiplyScalar(-1),
      -palletAngle,
    ).normalize();
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x)
      .multiplyScalar(normalSenseForSide(side));
    return { center, outwardNormal, tangent };
  };
  // Centre of the small rounding at each pallet tip, in the pallet frame:
  // the resting arc ends where the pin sits when unlocking begins.
  const tipCenterCache = new Map();
  const tipCenterLocal = (side) => {
    if (!tipCenterCache.has(side)) {
      const frame = lockFrameLocal(
        side,
        palletSense * side * lockingAmplitudeFraction * palletAmplitude,
      );
      tipCenterCache.set(side, frame.center.clone().addScaledVector(
        frame.outwardNormal,
        pinRadius + tipRoundingRadius,
      ));
    }
    return tipCenterCache.get(side).clone();
  };
  const rollRadius = pinRadius + tipRoundingRadius;
  // While the pin rolls over the tip its centre stays rollRadius from the
  // tip centre and on the pin circle: a closed-form circle intersection,
  // with exact first and second derivatives by implicit differentiation.
  const rollingSolution = (side, palletAngle) => {
    const tipRelative = rotate2(tipCenterLocal(side), palletAngle);
    const tip = tipRelative.clone().add(palletPivot);
    const distance = tip.length();
    const along = (
      pinOrbitRadius ** 2 - rollRadius ** 2 + distance ** 2
    ) / (2 * distance);
    const across = Math.sqrt(Math.max(0, pinOrbitRadius ** 2 - along ** 2));
    const angle = Math.atan2(tip.y, tip.x) + Math.atan2(across, along);
    const pin = new THREE.Vector2(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
    );
    const pinRate = crossZ(pin);
    const tipRate = crossZ(tipRelative);
    const offset = pin.clone().sub(tip);
    const numerator = offset.dot(tipRate);
    const denominator = offset.dot(pinRate);
    const slope = numerator / denominator;
    const offsetRate = pinRate.clone().multiplyScalar(slope).sub(tipRate);
    const numeratorRate = offsetRate.dot(tipRate)
      - offset.dot(tipRelative);
    const denominatorRate = offsetRate.dot(pinRate)
      - offset.dot(pin) * slope;
    const curvature = (
      numeratorRate * denominator - numerator * denominatorRate
    ) / denominator ** 2;
    return { angle, curvature, slope };
  };
  const impulseWheelDeltaAtPalletAngle = (side, palletAngle) => (
    rollingSolution(side, palletAngle).angle
      - lockReferenceAngleForSide(side)
  );
  const impulseWheelSlopeAtPalletAngle = (side, palletAngle) => (
    rollingSolution(side, palletAngle).slope
  );
  const impulsePinCenter = (side, palletAngle) => {
    const angle = rollingSolution(side, palletAngle).angle;
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
    ));
  };
  const centerFrameLocal = (side, palletAngle, mode) => {
    const worldCenter = mode === 'lock'
      ? lockPinCenterForSide(side)
      : impulsePinCenter(side, palletAngle);
    const center = rotate2(
      worldCenter.clone().sub(palletPivot),
      -palletAngle,
    );
    const wheelSlope = mode === 'lock'
      ? 0
      : impulseWheelSlopeAtPalletAngle(side, palletAngle);
    const centerDerivativeWorld = crossZ(
      worldCenter.clone().sub(wheelCenter),
    ).multiplyScalar(wheelSlope).sub(crossZ(
      worldCenter.clone().sub(palletPivot),
    ));
    const tangent = rotate2(
      centerDerivativeWorld,
      -palletAngle,
    ).normalize();
    // The normal keeps one rotation sense from the tangent for each pallet,
    // fixed where the concentric rest makes "away from the arbor"
    // unambiguous; a per-point sign test flips on steep impulse faces.
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x)
      .multiplyScalar(normalSenseForSide(side));
    return { center, outwardNormal, tangent };
  };
  const palletFaceFrame = (side, palletAngle, mode) => {
    const centerFrame = centerFrameLocal(side, palletAngle, mode);
    const point = centerFrame.center.clone().addScaledVector(
      centerFrame.outwardNormal,
      pinRadius,
    );
    return {
      ...centerFrame,
      point,
    };
  };
  const palletFaceLocalPoint = (side, palletAngle, mode) => (
    palletFaceFrame(side, palletAngle, mode).point
  );
  const lockFacePoints = (side, pointCount = 49) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * palletAmplitude,
        palletAmplitude,
        index / (pointCount - 1),
      );
      return palletFaceLocalPoint(
        side,
        palletSense * side * magnitude,
        'lock',
      );
    },
  );
  const impulseFacePoints = (side, pointCount = 37) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        lockingAmplitudeFraction * palletAmplitude,
        releaseAmplitudeFraction * palletAmplitude,
        index / (pointCount - 1),
      );
      return palletFaceLocalPoint(
        side,
        palletSense * side * magnitude,
        'impulse',
      );
    },
  );

  // Release state and constant-acceleration drop for each pallet; the
  // drop takes the wheel through the rest of the half pitch.
  const releaseCache = new Map();
  const releaseForSide = (side) => {
    if (!releaseCache.has(side)) {
      const swing = palletSense * side;
      const releaseAngle = swing * releaseAmplitudeFraction * palletAmplitude;
      const palletSpeed = swing * palletAmplitude * Math.PI
        * Math.cos(Math.PI * releaseHalfPhase) / halfBeatDuration;
      const palletAcceleration = -swing * palletAmplitude * Math.PI ** 2
        * Math.sin(Math.PI * releaseHalfPhase) / halfBeatDuration ** 2;
      const solution = rollingSolution(side, releaseAngle);
      const impulseAdvance = Math.abs(
        solution.angle - lockReferenceAngleForSide(side),
      );
      const freeDropAdvance = halfPinPitch - impulseAdvance;
      const wheelSpeed = solution.slope * palletSpeed;
      const wheelAcceleration = solution.curvature * palletSpeed ** 2
        + solution.slope * palletAcceleration;
      const dropAcceleration = 2 * (
        direction * freeDropAdvance - wheelSpeed * dropDuration
      ) / dropDuration ** 2;
      releaseCache.set(side, {
        dropAcceleration,
        freeDropAdvance,
        impulseAdvance,
        landingWheelSpeed: wheelSpeed + dropAcceleration * dropDuration,
        wheelAcceleration,
        wheelSpeed,
      });
    }
    return releaseCache.get(side);
  };

  const pinProfileForWheelPosition = (pinIndex, wheelAngle) => (
    Math.cos(pinIndex * pinPitch + wheelAngle) >= 0
      ? 'preferred-B'
      : 'legacy-A'
  );
  let pinProfileForIndex = null;

  const baseStateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const swing = palletSense * side;
    const palletAngle = swing * palletAmplitude
      * Math.sin(Math.PI * halfPhase);
    const palletAngularSpeed = swing * palletAmplitude * Math.PI
      * Math.cos(Math.PI * halfPhase) / halfBeatDuration;
    const palletAngularAcceleration = -swing * palletAmplitude * Math.PI ** 2
      * Math.sin(Math.PI * halfPhase) / halfBeatDuration ** 2;
    const eventTolerance = 1e-12;
    const lockActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase < impulseStartHalfPhase - eventTolerance;
    const impulseActive = halfPhase >= (
      impulseStartHalfPhase - eventTolerance
    ) && halfPhase <= releaseHalfPhase + eventTolerance;
    const contactActive = lockActive || impulseActive;
    let wheelAngle;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    let activeHalfBeatIndex = halfBeatIndex;
    let stage;
    let dropProgress = null;
    let impulseProgress = null;
    if (lockActive) {
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex);
      wheelAngularSpeed = 0;
      wheelAngularAcceleration = 0;
      stage = Math.abs(halfPhase - 0.5) <= eventTolerance
        ? `${palletNameForSide(side)}-maximum-deadbeat-lock`
        : `${palletNameForSide(side)}-concentric-deadbeat-lock`;
    } else if (impulseActive) {
      impulseProgress = THREE.MathUtils.clamp(
        impulseProgressAtPalletAngle(side, palletAngle),
        0,
        1,
      );
      const rolling = rollingSolution(side, palletAngle);
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex)
        + rolling.angle - lockReferenceAngleForSide(side);
      wheelAngularSpeed = rolling.slope * palletAngularSpeed;
      wheelAngularAcceleration = rolling.curvature * palletAngularSpeed ** 2
        + rolling.slope * palletAngularAcceleration;
      stage = `${palletNameForSide(side)}-downward-impulse`;
    } else {
      const earlyDrop = halfPhase < landingHalfPhase;
      const dropStartHalfBeat = earlyDrop
        ? halfBeatIndex - 1
        : halfBeatIndex;
      const dropEndHalfBeat = dropStartHalfBeat + 1;
      const dropStartCoordinate = dropStartHalfBeat + releaseHalfPhase;
      const currentCoordinate = halfBeatIndex + halfPhase;
      const elapsedDropTime = (
        currentCoordinate - dropStartCoordinate
      ) * halfBeatDuration;
      dropProgress = elapsedDropTime / dropDuration;
      const release = releaseForSide(sideForHalfBeat(dropStartHalfBeat));
      wheelAngle = wheelAngleAtHalfLanding(dropStartHalfBeat)
        + direction * release.impulseAdvance
        + release.wheelSpeed * elapsedDropTime
        + 0.5 * release.dropAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = release.wheelSpeed
        + release.dropAcceleration * elapsedDropTime;
      wheelAngularAcceleration = release.dropAcceleration;
      activeHalfBeatIndex = dropEndHalfBeat;
      stage = `clockwise-free-drop-to-${palletNameForSide(
        sideForHalfBeat(dropEndHalfBeat),
      )}-pallet`;
    }

    const activeSide = contactActive
      ? side
      : sideForHalfBeat(activeHalfBeatIndex);
    const activePinIndex = activePinIndexForHalfBeat(activeHalfBeatIndex);
    const activePinAngle = wheelAngle + activePinIndex * pinPitch;
    const activePinCenter = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(activePinAngle) * pinOrbitRadius,
      Math.sin(activePinAngle) * pinOrbitRadius,
    ));
    let contact = null;
    if (contactActive) {
      const mode = lockActive ? 'lock' : 'impulse';
      const faceFrame = palletFaceFrame(activeSide, palletAngle, mode);
      const expectedPoint = palletPivot.clone().add(
        rotate2(faceFrame.point, palletAngle),
      );
      const pinOffsetWorld = rotate2(
        faceFrame.point.clone().sub(faceFrame.center),
        palletAngle,
      );
      const pinSurfacePoint = activePinCenter.clone().add(pinOffsetWorld);
      const faceTangent = rotate2(faceFrame.tangent, palletAngle);
      // Unit normal from the pin into the pallet material: the direction
      // in which the pin presses the pallet.
      const faceNormal = rotate2(faceFrame.outwardNormal, palletAngle)
        .normalize();
      const pinMaterialVelocity = crossZ(
        pinSurfacePoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(
        expectedPoint.clone().sub(palletPivot),
      ).multiplyScalar(palletAngularSpeed);
      const relativeVelocity = pinMaterialVelocity.clone()
        .sub(palletMaterialVelocity);
      const pinLocalOffset = rotate2(pinOffsetWorld, -activePinAngle);
      contact = {
        concentricRadiusError: lockActive
          ? Math.abs(
            faceFrame.point.length()
              - (lockPinCenterForSide(activeSide)
                .distanceTo(palletPivot) + pinRadius)
          )
          : null,
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint: faceFrame.point,
        mode: lockActive ? 'concentric-rest' : 'downward-impulse',
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        palletName: palletNameForSide(activeSide),
        pinContactAngle: Math.atan2(pinLocalOffset.y, pinLocalOffset.x),
        pinMaterialVelocity,
        pinProfile: pinProfileForIndex?.(activePinIndex) ?? null,
        pinSurfacePoint,
        pointError: pinSurfacePoint.distanceTo(expectedPoint),
        radialClearanceError: activePinCenter.distanceTo(pinSurfacePoint)
          - pinRadius,
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
      };
    }
    return {
      activeHalfBeatIndex,
      activePinAngle,
      activePinCenter,
      activePinIndex,
      activePinProfile: pinProfileForIndex?.(activePinIndex) ?? null,
      activeSide,
      contact,
      contactActive,
      contactMode: contact?.mode ?? null,
      dropProgress,
      halfBeatIndex,
      halfPhase,
      impulseProgress,
      lockActive,
      palletAngle,
      palletAngularAcceleration,
      palletAngularSpeed,
      palletName: palletNameForSide(activeSide),
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const sourceBaseState = baseStateAtTime(sourceTimeOffset);
  const sourcePoseWheelAngle = sourceBaseState.wheelAngle;
  pinProfileForIndex = (pinIndex) => pinProfileForWheelPosition(
    pinIndex,
    sourcePoseWheelAngle,
  );

  // Every pin surface point that ever touches a pallet, in the pin's own
  // frame (x radial outward, y along the counter-clockwise tangent). The B
  // pin keeps exactly this arc plus a small margin; the A pin keeps the
  // whole leading half.
  const contactAngleSamples = [];
  for (let sample = 0; sample < 1600; sample += 1) {
    const state = baseStateAtTime(sample / 1600 * pendulumPeriod);
    if (state.contactActive) {
      contactAngleSamples.push(state.contact.pinContactAngle);
    }
  }
  const preferredArcMargin = THREE.MathUtils.degToRad(6);
  const preferredArcStart = Math.min(...contactAngleSamples)
    - preferredArcMargin;
  const preferredArcEnd = Math.max(...contactAngleSamples)
    + preferredArcMargin;

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.54,
  });
  const legacyPinMaterial = matte(PALETTE.driver, {
    metalness: 0.29,
    roughness: 0.43,
  });
  const preferredPinMaterial = matte(PALETTE.accent, {
    metalness: 0.22,
    roughness: 0.46,
  });
  const palletMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });

  // Escape wheel: rim, five broad spokes and a hub with eight bolt heads.
  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-thirty-pin-single-face-Le-Paute-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-stepping-pin-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const rimCircle = (radius) => Array.from({ length: 240 }, (_, index) => [
    Math.cos(index * FULL_TURN / 240) * radius,
    Math.sin(index * FULL_TURN / 240) * radius,
  ]);
  const rimOuter = rimCircle(wheelOuterRadius);
  const rimInner = rimCircle(wheelInnerRadius).reverse();
  const wheelRim = new THREE.Mesh(
    plate(
      [[[...rimOuter, rimOuter[0]], [...rimInner, rimInner[0]]]],
      -wheelDepth / 2,
      wheelDepth / 2,
    ),
    wheelMaterial,
  );
  wheelRim.userData.role = 'source-annular-pin-wheel-rim';
  wheelRotor.add(wheelRim);

  const hubRadius = sourceRasterHubRadius * sourceScale;
  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 5; spokeIndex += 1) {
    const angle = Math.PI + spokeIndex * FULL_TURN / 5;
    const innerEnd = hubRadius - 0.10;
    const outerEnd = wheelInnerRadius + 0.10;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(outerEnd - innerEnd, 0.34, wheelDepth * 0.82),
      wheelMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * (innerEnd + outerEnd) / 2,
      Math.sin(angle) * (innerEnd + outerEnd) / 2,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.index = spokeIndex;
    spoke.userData.role = 'five-arm-pin-wheel-spoke';
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelArborRadius = 0.12;
  const wheelHub = new THREE.Mesh(
    boredLatheGeometry([
      { axial: -0.22, radial: hubRadius },
      { axial: 0.22, radial: hubRadius },
      { axial: 0.22, radial: 0.30 },
      { axial: 0.33, radial: 0.30 },
    ], wheelArborRadius + 0.015, 48),
    wheelMaterial,
  );
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.userData.role = 'pin-wheel-hub-with-central-boss';
  wheelRotor.add(wheelHub);
  const hubBoltMeshes = [];
  const hubBoltRadius = sourceRasterHubBoltCircleRadius * sourceScale;
  for (let boltIndex = 0; boltIndex < 8; boltIndex += 1) {
    const angle = Math.PI / 8 + boltIndex * FULL_TURN / 8;
    const bolt = cylinderAlongZ(0.075, 0.08, darkMaterial, 18);
    bolt.position.set(
      Math.cos(angle) * hubBoltRadius,
      Math.sin(angle) * hubBoltRadius,
      0.22,
    );
    bolt.userData.index = boltIndex;
    bolt.userData.role = 'source-hub-bolt';
    hubBoltMeshes.push(bolt);
    wheelRotor.add(bolt);
  }

  // Pins, drawn in each pin's frame (x radial outward, y along the
  // counter-clockwise tangent; the leading, working side is -y).
  const arcPoints = (radius, start, end, count) => Array.from(
    { length: count + 1 },
    (_, index) => {
      const angle = THREE.MathUtils.lerp(start, end, index / count);
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    },
  );
  const legacyPinOutline = () => arcPoints(pinRadius, Math.PI, FULL_TURN, 24);
  const preferredPinOutline = () => arcPoints(
    pinRadius,
    preferredArcStart,
    preferredArcEnd,
    18,
  );
  const outlineShape = (points) => polygonShape(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const preferredMidAngle = (preferredArcStart + preferredArcEnd) / 2;
  const preferredChordDepth = pinRadius
    * Math.cos((preferredArcEnd - preferredArcStart) / 2);
  const rivetOffsetRadius = (pinRadius + preferredChordDepth) / 2;
  const rivetRadius = Math.min(
    0.4 * (pinRadius - preferredChordDepth),
    0.32 * pinRadius,
  );
  const rivetBackZ = -wheelDepth / 2 - 0.05;
  const rivetFrontZ = wheelDepth / 2 + 0.03;
  const pinGroupZ = wheelDepth / 2 + pinLength / 2;
  const pinMeshes = [];
  const legacyPins = [];
  const preferredPins = [];
  for (let pinIndex = 0; pinIndex < pinCount; pinIndex += 1) {
    const angle = pinIndex * pinPitch;
    const profile = pinProfileForIndex(pinIndex);
    const pinGroup = new THREE.Group();
    pinGroup.position.set(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
      pinGroupZ,
    );
    pinGroup.rotation.z = angle;
    pinGroup.userData.index = pinIndex;
    pinGroup.userData.profile = profile;
    pinGroup.userData.replaceable = true;
    pinGroup.userData.role = profile === 'preferred-B'
      ? 'replaceable-preferred-relieved-B-pin'
      : 'replaceable-legacy-half-round-A-pin';
    const body = new THREE.Mesh(
      centeredExtrusion(
        outlineShape(profile === 'preferred-B'
          ? preferredPinOutline()
          : legacyPinOutline()),
        pinLength,
        0,
      ),
      profile === 'preferred-B'
        ? preferredPinMaterial
        : legacyPinMaterial,
    );
    body.userData.role = profile === 'preferred-B'
      ? 'preferred-B-relieved-arc-working-body'
      : 'legacy-A-semicircular-working-body';
    // The replaceable stem passes through the rim and is secured behind it.
    const rivet = cylinderAlongZ(
      rivetRadius,
      rivetFrontZ - rivetBackZ,
      darkMaterial,
      18,
    );
    rivet.position.set(
      Math.cos(preferredMidAngle) * rivetOffsetRadius,
      Math.sin(preferredMidAngle) * rivetOffsetRadius,
      (rivetFrontZ + rivetBackZ) / 2 - pinGroupZ,
    );
    rivet.userData.role = 'replaceable-pin-rivet-stem';
    pinGroup.add(body, rivet);
    pinMeshes.push(pinGroup);
    if (profile === 'preferred-B') preferredPins.push(pinGroup);
    else legacyPins.push(pinGroup);
    wheelRotor.add(pinGroup);
  }

  // Finite pallet bits. Each backing region is bounded by the concentric
  // resting arc, the generated impulse face and a generous body; every
  // position any pin (A outline, which contains B) occupies during a whole
  // cycle, dilated by a small working clearance, is then removed.
  const carvingOutline = [
    ...arcPoints(pinRadius + workingClearance, Math.PI, FULL_TURN, 20),
    [pinRadius + workingClearance, workingClearance],
    [-(pinRadius + workingClearance), workingClearance],
  ];
  const sweepTimes = new Set();
  const sweepSamples = 1440;
  for (let sample = 0; sample <= sweepSamples; sample += 1) {
    sweepTimes.add(sample / sweepSamples * pendulumPeriod);
  }
  for (let halfBeat = 0; halfBeat < 2; halfBeat += 1) {
    for (const phase of [
      landingHalfPhase,
      impulseStartHalfPhase,
      releaseHalfPhase,
    ]) sweepTimes.add((halfBeat + phase) * halfBeatDuration);
  }
  const sweepStates = [...sweepTimes].sort((a, b) => a - b)
    .map((time) => baseStateAtTime(time));
  const pinOutlineInPalletFrame = (state, pinIndex) => {
    const pinAngle = state.wheelAngle + pinIndex * pinPitch;
    return carvingOutline.map(([x, y]) => {
      const world = rotate2(
        new THREE.Vector2(x + pinOrbitRadius, y),
        pinAngle,
      ).add(wheelCenter).sub(palletPivot);
      const local = rotate2(world, -state.palletAngle);
      return [local.x, local.y];
    });
  };
  // Consecutive sampled pin outlines are merged into short convex chunks
  // (at most sweepChunkLength of travel); a chunk hull over-covers the true
  // sweep only by its tiny sagitta, never cutting into the convex side the
  // working faces lie on.
  const sweepChunkLength = 0.02;
  const snap = (value) => Math.round(value * 1e7) / 1e7;
  const sweptPinHulls = (bounds) => {
    const hulls = [];
    const flush = (chunk) => {
      if (chunk.length < 2) return;
      const hull = lePautePinConvexHull(chunk.flat())
        .map(([x, y]) => [snap(x), snap(y)]);
      const inside = hull.some(([x, y]) => x > bounds.minX
        && x < bounds.maxX && y > bounds.minY && y < bounds.maxY);
      if (inside) hulls.push([[...hull, hull[0]]]);
    };
    for (let pinIndex = 0; pinIndex < pinCount; pinIndex += 1) {
      let chunk = [];
      for (const state of sweepStates) {
        const pinAngle = positiveModulo(
          state.wheelAngle + pinIndex * pinPitch + Math.PI,
          FULL_TURN,
        ) - Math.PI;
        if (Math.abs(pinAngle) > THREE.MathUtils.degToRad(45)) {
          flush(chunk);
          chunk = [];
          continue;
        }
        const outline = pinOutlineInPalletFrame(state, pinIndex);
        if (chunk.length > 0) {
          const start = chunk[0];
          const travel = Math.max(...[0, 10, 20].map((index) => Math.hypot(
            outline[index][0] - start[index][0],
            outline[index][1] - start[index][1],
          )));
          if (travel > sweepChunkLength) {
            const last = chunk.at(-1);
            flush(chunk);
            chunk = [last];
          }
        }
        chunk.push(outline);
      }
      flush(chunk);
    }
    return hulls;
  };
  const toPair = (point) => [point.x, point.y];
  const backingDepth = 0.30;
  const backingUndercut = 0.16;
  const makeBacking = (side) => {
    const lock = lockFacePoints(side, 49);
    const impulse = impulseFacePoints(side, 37);
    const restRadius = lock[0].length();
    const angleOf = (point) => Math.atan2(point.y, point.x);
    const junctionAngle = angleOf(lock[0]);
    const farSign = Math.sign(angleOf(lock.at(-1)) - junctionAngle);
    const farAngle = junctionAngle + farSign * 0.20;
    const polarPoint = (radius, angle) => [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    ];
    const release = impulse.at(-1);
    // Pallet frame x runs toward the far (body) side for the outer pallet
    // and away from it for the inner one.
    const bodyX = farSign > 0 ? 1 : -1;
    const ring = [
      ...impulse.slice().reverse().map(toPair),
      ...Array.from({ length: 61 }, (_, index) => polarPoint(
        restRadius,
        THREE.MathUtils.lerp(junctionAngle, farAngle, index / 60),
      )).slice(1),
      polarPoint(restRadius + backingDepth, farAngle),
      [release.x + bodyX * backingUndercut, release.y - backingDepth + 0.04],
    ];
    const signedArea = ring.reduce((sum, point, index) => {
      const next = ring[(index + 1) % ring.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0);
    if (signedArea < 0) ring.reverse();
    return { impulse, lock, polygon: [[[...ring, ring[0]]]] };
  };
  const carvePallet = (side) => {
    const backing = makeBacking(side);
    const ring = backing.polygon[0][0];
    const bounds = {
      maxX: Math.max(...ring.map(([x]) => x)),
      maxY: Math.max(...ring.map(([, y]) => y)),
      minX: Math.min(...ring.map(([x]) => x)),
      minY: Math.min(...ring.map(([, y]) => y)),
    };
    const hulls = sweptPinHulls(bounds);
    const carved = polygonClipping.difference(backing.polygon, ...hulls);
    // Keep only the piece carrying the working faces.
    const junction = toPair(backing.lock[0]);
    const kept = carved.slice().sort((a, b) => (
      lePautePinSignedDistance(junction, [a])
        - lePautePinSignedDistance(junction, [b])
    ))[0];
    return { ...backing, carved: [kept] };
  };

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role =
    'pendulum-rocked-broad-plate-with-inner-and-outer-pallets';

  const bitBackZ = workingPlaneZ - palletDepth / 2;
  const makePallet = (side) => {
    const palletName = palletNameForSide(side);
    const carved = carvePallet(side);
    const body = new THREE.Mesh(
      plate(carved.carved, bitBackZ, plateBackZ + 0.01),
      palletMaterial,
    );
    body.userData.role = `${palletName}-pallet-working-bit`;
    const group = new THREE.Group();
    group.userData.role = `${palletName}-finite-pin-wheel-pallet`;
    group.userData.side = side;
    group.add(body);
    return {
      body,
      carved: carved.carved,
      group,
      impulsePoints: carved.impulse,
      lockPoints: carved.lock,
    };
  };
  const outerPallet = makePallet(1);
  const innerPallet = makePallet(-1);

  // Brown's broad plate: a rectangle as wide as the round collet, hanging
  // in front of the pin ends, opened between a left leg (carrying the inner
  // pallet) and a right leg (carrying the outer pallet).
  const sourceToLocal = (x, y) => {
    const point = sourcePointToModel({ x, y }).sub(palletPivot);
    return [point.x, point.y];
  };
  const colletRadius = sourceRasterColletRadius * sourceScale;
  const colletOutline = arcPoints(colletRadius, 0, FULL_TURN, 96).slice(0, -1);
  const PLATE_LEGS = {
    left: [
      [287, 101], [345, 101], [345, 172], [318, 345],
      [283, 345],
    ],
    right: [
      [373, 101], [431, 101], [421, 352], [392, 352],
      [390, 335], [373, 172],
    ],
  };
  // Each leg's foot is the hull of its pallet bit and the leg's lower
  // corners, so the plate outline ends in the bit as Brown draws it.
  const legFoot = (pallet, corners) => {
    const hull = lePautePinConvexHull([
      ...pallet.carved[0][0],
      ...corners.map(([x, y]) => sourceToLocal(x, y)),
    ]);
    return [[...hull, hull[0]]];
  };
  const plateOutline = polygonClipping.union(
    [[[...colletOutline, colletOutline[0]]]],
    ...Object.values(PLATE_LEGS).map((points) => {
      const ring = points.map(([x, y]) => sourceToLocal(x, y));
      return [[...ring, ring[0]]];
    }),
    legFoot(innerPallet, [[283, 345], [318, 345]]),
    legFoot(outerPallet, [[392, 352], [421, 352], [421, 335]]),
  );
  const broadPlate = new THREE.Mesh(
    plate(plateOutline, plateBackZ, plateFrontZ),
    palletMaterial,
  );
  broadPlate.userData.role = 'source-broad-pallet-plate-in-front-of-pins';

  const colletZ = plateFrontZ + 0.04;
  const collet = boredCylinderAlongZ(colletRadius, 0.08, 0.13, palletMaterial, 72);
  collet.position.z = colletZ;
  collet.userData.role = 'source-round-collet-on-pallet-arbor';
  const colletRing = boredCylinderAlongZ(0.40, 0.06, 0.13, palletMaterial, 48);
  colletRing.position.z = colletZ + 0.07;
  colletRing.userData.role = 'source-collet-center-ring';
  const palletPivotHub = cylinderAlongZ(0.10, colletZ + 0.06 + 0.72, darkMaterial, 30);
  palletPivotHub.position.z = (colletZ + 0.06 - 0.72) / 2;
  palletPivotHub.userData.role = 'common-pin-wheel-pallet-arbor';
  const colletScrews = [];
  for (const [index, sourceX, slot] of [[0, 313, 1.05], [1, 405, 1.45]]) {
    const [x, y] = sourceToLocal(sourceX, 101);
    const screw = new THREE.Group();
    screw.position.set(x, y, colletZ + 0.07);
    const head = cylinderAlongZ(0.21, 0.06, frameMaterial, 30);
    const slotMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.05, 0.02),
      darkMaterial,
    );
    slotMesh.position.z = 0.035;
    slotMesh.rotation.z = slot;
    screw.add(head, slotMesh);
    screw.userData.index = index;
    screw.userData.role = 'source-collet-screw';
    colletScrews.push(screw);
  }
  const sidePlateRing = [[381, 241], [421, 241], [421, 346], [381, 346]]
    .map(([x, y]) => sourceToLocal(x, y));
  const sidePlate = new THREE.Mesh(
    plate([[[...sidePlateRing, sidePlateRing[0]]]], plateFrontZ, plateFrontZ + 0.05),
    palletMaterial,
  );
  sidePlate.userData.role = 'source-small-screwed-side-plate';
  const sidePlateScrews = [264, 305].map((sourceY, index) => {
    const [x, y] = sourceToLocal(402, sourceY);
    const screw = cylinderAlongZ(0.07, 0.04, darkMaterial, 18);
    screw.position.set(x, y, plateFrontZ + 0.07);
    screw.userData.index = index;
    screw.userData.role = 'source-side-plate-screw';
    return screw;
  });
  palletAssembly.add(
    outerPallet.group,
    innerPallet.group,
    broadPlate,
    collet,
    colletRing,
    palletPivotHub,
    ...colletScrews,
    sidePlate,
    ...sidePlateScrews,
  );

  // Fixed arbors behind the moving parts; no frame is drawn by Brown.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-pin-wheel-and-pallet-arbor-bearings';
  const wheelShaft = cylinderAlongZ(wheelArborRadius, 0.33 + 0.70, darkMaterial, 30);
  wheelShaft.position.z = (0.30 - 0.73) / 2;
  wheelShaft.userData.role = 'fixed-pin-wheel-arbor';
  const wheelBearing = cylinderAlongZ(0.30, 0.16, frameMaterial, 36);
  wheelBearing.position.z = -0.58;
  wheelBearing.userData.role = 'fixed-pin-wheel-arbor-rear-bearing';
  const palletBearing = boredCylinderAlongZ(0.30, 0.16, 0.115, frameMaterial, 36);
  palletBearing.position.set(palletPivot.x, palletPivot.y, -0.58);
  palletBearing.userData.role = 'fixed-pallet-arbor-rear-bearing';
  fixedFrame.add(wheelShaft, wheelBearing, palletBearing);
  root.add(fixedFrame, escapeWheel, palletAssembly);

  const stateAtTime = (time) => {
    const state = baseStateAtTime(time + sourceTimeOffset);
    const cycleCoordinate = time / pendulumPeriod;
    return {
      ...state,
      cycleIndex: Math.floor(cycleCoordinate),
      cyclePhase: positiveModulo(cycleCoordinate, 1),
      pinsAdvanced: (
        sourceBaseState.wheelAngle - state.wheelAngle
      ) / pinPitch,
      sourcePose: Math.abs(positiveModulo(cycleCoordinate, 1)) < 1e-12,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * pendulumPeriod,
  );
  const timeFromBase = (baseTime) => positiveModulo(
    baseTime - sourceTimeOffset,
    pendulumPeriod,
  );
  const canonicalTimes = {
    cycleClosure: pendulumPeriod,
    innerImpulseStart: timeFromBase(
      halfBeatDuration + impulseStartHalfPhase * halfBeatDuration,
    ),
    innerLanding: timeFromBase(
      halfBeatDuration + landingHalfPhase * halfBeatDuration,
    ),
    innerMaximumLock: timeFromBase(halfBeatDuration * 1.5),
    innerRelease: timeFromBase(
      halfBeatDuration + releaseHalfPhase * halfBeatDuration,
    ),
    outerImpulseStart: timeFromBase(
      impulseStartHalfPhase * halfBeatDuration,
    ),
    outerLanding: timeFromBase(landingHalfPhase * halfBeatDuration),
    outerMaximumLock: 0,
    outerRelease: timeFromBase(releaseHalfPhase * halfBeatDuration),
    sourcePose: 0,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    palletAssembly.rotation.z = state.palletAngle;
    palletAssembly.userData.angularAcceleration =
      state.palletAngularAcceleration;
    palletAssembly.userData.angularSpeed = state.palletAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = state.contactActive
      ? {
        activePallet: `${state.palletName}-pallet`,
        activePinIndex: state.activePinIndex,
        activePinProfile: state.activePinProfile,
        expectedPoint: state.contact.expectedPoint.clone(),
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        radialClearanceError: state.contact.radialClearanceError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activePinIndex: state.activePinIndex,
        activePinProfile: state.activePinProfile,
        dropProgress: state.dropProgress,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        radialClearanceError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  const radiusRange = (points) => {
    const radii = points.map((point) => point.length());
    return Math.max(...radii) - Math.min(...radii);
  };
  // Signed distance (pallet frame) from a point to the finished pallet
  // material: negative inside, positive in the clear.
  const palletMaterialDistance = (side, localPoint) => (
    lePautePinSignedDistance(
      toPair(localPoint),
      side > 0 ? outerPallet.carved : innerPallet.carved,
    )
  );
  root.userData.archetype = movement.archetype;
  root.userData.mechanism =
    'one clockwise wheel carries thirty replaceable single-plane pins: Brown’s legacy half-round A form on the comparison half and the preferred undercut B form on the other; a broad plate hung from the round collet on the pallet arbor carries adjacent higher-outer and lower-inner pallets whose concentric resting arcs hold the wheel dead and whose two working faces both receive downward impulse';
  root.userData.presentation = 'flat front elevation matching Brown’s plate';
  root.userData.transmission = {
    deadbeat: 'wheel speed and acceleration are exactly zero while a pin rests on either concentric pallet face',
    direction: 'clockwise; every pin moves downward through both adjacent pallet levels',
    halfBeatAdvance: halfPinPitch,
    impulse: 'both pallet impulses act downward, the defining steady-action advantage of Le Paute’s layout',
    oscillationAdvance: pinPitch,
    pinCount,
    preferredPinForm: 'B: upper half removed and underside relieved to leave only the circular arc the pallets actually touch',
    recoil: 'none',
  };
  root.userData.blocks = {
    broadPlate,
    collet,
    colletRing,
    colletScrews,
    escapeWheel,
    fixedFrame,
    hubBoltMeshes,
    innerPallet: innerPallet.group,
    innerPalletBody: innerPallet.body,
    legacyPins,
    outerPallet: outerPallet.group,
    outerPalletBody: outerPallet.body,
    palletAssembly,
    palletBearing,
    palletPivotHub,
    pinMeshes,
    preferredPins,
    sidePlate,
    sidePlateScrews,
    spokeMeshes,
    wheelBearing,
    wheelHub,
    wheelRim,
    wheelRotor,
    wheelShaft,
  };
  root.userData.hideGround = true;
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 1;
  // Brown's square plate, 525 pixels on a side, framed as drawn.
  const plateCorner = sourcePointToModel({ x: 0, y: sourceImageHeight });
  const plateOpposite = sourcePointToModel({ x: sourceImageWidth, y: 0 });
  const plateInset = 0.3;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(plateCorner.x + plateInset, plateCorner.y + plateInset, -0.8),
    new THREE.Vector3(plateOpposite.x - plateInset, plateOpposite.y - plateInset, 1.2),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    bitBackZ,
    colletRadius,
    direction,
    dropDuration,
    eventPeriod: pendulumPeriod,
    halfBeatDuration,
    halfPinPitch,
    impulsePalletSpan,
    impulseStartHalfPhase,
    innerLockReferenceAngle,
    innerRelease: { ...releaseForSide(-1) },
    landingAmplitudeFraction,
    landingHalfPhase,
    legacyPinWorkingArc: Math.PI,
    lockingAmplitudeFraction,
    meanPalletRadius,
    outerLockReferenceAngle,
    outerRelease: { ...releaseForSide(1) },
    palletAmplitude,
    palletDepth,
    palletPivot: palletPivot.clone(),
    palletSense,
    pendulumPeriod,
    pinCount,
    pinFrontZ,
    pinLength,
    pinOrbitRadius,
    pinPitch,
    pinRadius,
    plateBackZ,
    plateFrontZ,
    preferredArcEnd,
    preferredArcStart,
    preferredPinWorkingArc: preferredArcEnd - preferredArcStart,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    rollRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourcePendulumTotalSwing,
    sourcePinAngularDiameter,
    sourceScale,
    sourceTimeOffset,
    tipRoundingRadius,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelOuterRadius,
    workingClearance,
    workingPlaneZ,
  };
  root.userData.impulseFacePoints = impulseFacePoints;
  root.userData.impulsePinCenter = impulsePinCenter;
  root.userData.impulseProgressAtPalletAngle =
    impulseProgressAtPalletAngle;
  root.userData.impulseWheelDeltaAtPalletAngle =
    impulseWheelDeltaAtPalletAngle;
  root.userData.impulseWheelSlopeAtPalletAngle =
    impulseWheelSlopeAtPalletAngle;
  root.userData.lockFacePoints = lockFacePoints;
  root.userData.lockPinCenterForSide = lockPinCenterForSide;
  root.userData.releaseForSide = releaseForSide;
  root.userData.rollingSolution = rollingSolution;
  root.userData.tipCenterLocal = tipCenterLocal;
  root.userData.palletFaceFrame = palletFaceFrame;
  root.userData.palletFaceLocalPoint = palletFaceLocalPoint;
  root.userData.palletMaterialDistance = palletMaterialDistance;
  root.userData.palletProfiles = {
    inner: {
      finiteOutline: innerPallet.carved,
      impulseConcentricRadiusRange: radiusRange(
        innerPallet.impulsePoints,
      ),
      impulseDirection: 'downward',
      impulsePoints: innerPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(innerPallet.lockPoints),
      lockPoints: innerPallet.lockPoints,
      position: 'lower pallet on the left leg, reaching out from inside the pin circle',
      side: -1,
    },
    outer: {
      finiteOutline: outerPallet.carved,
      impulseConcentricRadiusRange: radiusRange(
        outerPallet.impulsePoints,
      ),
      impulseDirection: 'downward',
      impulsePoints: outerPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(outerPallet.lockPoints),
      lockPoints: outerPallet.lockPoints,
      position: 'higher pallet on the right leg, reaching in from outside the pin circle',
      side: 1,
    },
  };
  root.userData.pinProfiles = {
    legacyA: {
      count: legacyPins.length,
      profile: 'one-half circular cylinder retained; inactive upper half removed',
      sourceLabel: 'A',
      workingArcRadians: Math.PI,
    },
    preferredB: {
      count: preferredPins.length,
      profile: 'upper half removed and underside additionally relieved',
      sourceLabel: 'B',
      workingArcRadians: preferredArcEnd - preferredArcStart,
    },
  };
  root.userData.pinProfileForIndex = pinProfileForIndex;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 304 page marks Animated unavailable and serves Brown’s static comparison plate.',
    referenceScope: 'Brown fixes one pin wheel, the broad pallet plate hung from a round collet with its two pallet bits, replaceable A/B pins, and their two cross-sections. The period construction reference supplies the clockwise direction, thirty-pin count, same-plane pallet offset, four-degree swing, concentric rests, and downward action on both pallets.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    constructionReference: {
      author: 'Ward L. Goodrich',
      chapter: 'IX — Le Paute’s Pin Wheel Escapement',
      details: 'Thirty pins at twelve-degree spacing for a seconds pendulum; a four-degree pallet swing fixes pin diameter; the inner arm is offset to clear the pins; both hardened pallets lie in the same plane; the improved large-clock pin is also relieved on its underside.',
      figures: [39, 40],
      publicationYear: 1905,
      title: 'The Modern Clock',
      url: 'https://www.gutenberg.org/files/61494/61494-h/61494-h.htm',
    },
    officialDescription: movement.description,
    plate304: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one annular wheel with replaceable axial pins in a single working plane; a broad plate hung from the round collet on the upper pallet arbor lies in front of the pin ends, its left leg carrying the lower inner pallet and its right leg the higher outer pallet',
      measurementUncertaintyPixels: 8,
      modeledPinCount: pinCount,
      officialAnimationAvailable: false,
      rasterColletRadius: sourceRasterColletRadius,
      rasterHubBoltCircleRadius: sourceRasterHubBoltCircleRadius,
      rasterInnerPalletTip: sourceRasterInnerPalletTip.clone(),
      rasterLegacyPinA: sourceRasterLegacyPinA.clone(),
      rasterOuterPalletTip: sourceRasterOuterPalletTip.clone(),
      rasterPalletPivot: sourceRasterPalletPivot.clone(),
      rasterPinOrbitRadius: sourceRasterPinOrbitRadius,
      rasterPreferredPinB: sourceRasterPreferredPinB.clone(),
      rasterWheelBounds: sourceRasterWheelBounds,
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelInnerRadius: sourceRasterWheelInnerRadius,
      rasterWheelOuterRadius: sourceRasterWheelOuterRadius,
      sourceDirection: sourceRasterDirection,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.reconstructionNote = 'The pallet schedule (concentric rests, four degrees of impulse, two of drop) is prescribed kinematics; the finite pallet bits are the backing regions with every swept pin position removed, so pins touch only the working faces. Brown draws the two pallets farther apart than one half pitch; the thirty-pin construction keeps them one half pitch apart.';
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'higher-outer-concentric-rest',
      'higher-outer-downward-impulse',
      'two-degree-drop-to-lower-inner-pallet',
      'lower-inner-concentric-rest',
      'lower-inner-downward-impulse',
      'two-degree-drop-to-succeeding-pin-at-higher-outer-pallet',
    ],
  };
  root.userData.wheelAngleAtHalfLanding = wheelAngleAtHalfLanding;

  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(0.05, 0.05, 1),
    root,
    update,
  };
}

export function createAuthoredStudEscapementMovement(movement) {
  switch (movement.id) {
    case 292: return studEscapement(movement);
    case 304: return lePautePinWheelEscapement(movement);
    default: return null;
  }
}
