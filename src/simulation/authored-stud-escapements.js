import * as THREE from 'three';
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

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
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
    const epsilon = 1e-6;
    const center = studCenterLocal(side, palletAngle, mode);
    const tangent = studCenterLocal(
      side,
      palletAngle + epsilon,
      mode,
    ).sub(studCenterLocal(
      side,
      palletAngle - epsilon,
      mode,
    )).normalize();
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x);
    if (outwardNormal.dot(center) < 0) outwardNormal.multiplyScalar(-1);
    return { center, outwardNormal, tangent };
  };
  const palletFaceLocalPoint = (side, palletAngle, mode) => {
    const frame = centerFrameLocal(side, palletAngle, mode);
    return frame.center.clone().addScaledVector(
      frame.outwardNormal,
      -studRadius,
    );
  };
  const palletFaceFrame = (side, palletAngle, mode) => {
    const epsilon = 1e-6;
    const centerFrame = centerFrameLocal(side, palletAngle, mode);
    const point = centerFrame.center.clone().addScaledVector(
      centerFrame.outwardNormal,
      -studRadius,
    );
    const before = palletFaceLocalPoint(
      side,
      palletAngle - epsilon,
      mode,
    );
    const after = palletFaceLocalPoint(
      side,
      palletAngle + epsilon,
      mode,
    );
    return {
      ...centerFrame,
      point,
      tangent: after.sub(before).normalize(),
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
    const stud = cylinderAlongZ(
      studRadius,
      studLength,
      driverMaterial,
      22,
    );
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
    const innerPath = workingPath.map((point) => point.clone()
      .addScaledVector(point.clone().normalize(), -bodyThickness));
    const body = new THREE.Mesh(
      centeredExtrusion(polygonShape([
        ...workingPath,
        ...innerPath.reverse(),
      ]), palletDepth, 0.006),
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
      .multiplyScalar(lockPoints[0].length() - 0.32)
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
        -bodyThickness * 0.55,
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
              - (lockStudCenter.distanceTo(palletPivot) - studRadius)
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
    contactMarker.visible = state.contactActive;
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
  return {
    cameraDirection: new THREE.Vector3(6.1, 4.3, 13.8),
    root,
    update,
  };
}

function lePautePinWheelEscapement(movement) {
  const root = new THREE.Group();

  // Brown's plate compares the original half-round A pin with the improved
  // B pin, whose unused half and part of its underside are cut away. Unlike
  // movement 292, every pin projects from one face of one wheel and both
  // pallet bits work in that same plane. A pin is held on the higher outer
  // pallet, passes to the lower inner pallet on the following beat, and the
  // succeeding pin then reaches the outer pallet. The generated resting
  // faces are circular about the pallet arbor, giving true deadbeat locks.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(190, 333);
  const sourceRasterWheelOuterRadius = 171;
  const sourceRasterWheelBounds = Object.freeze({
    bottom: 506,
    left: 19,
    right: 385,
    top: 164,
  });
  const sourceRasterPalletPivot = new THREE.Vector2(359, 83);
  const sourceRasterOuterPalletTip = new THREE.Vector2(331, 353);
  const sourceRasterInnerPalletTip = new THREE.Vector2(311, 336);
  const sourceRasterLegacyPinA = new THREE.Vector2(47, 318);
  const sourceRasterPreferredPinB = new THREE.Vector2(321, 429);
  const sourceRasterHubBoltCircleRadius = 31;
  const sourceRasterDirection = 'clockwise, corroborated by the period construction drawing';
  const sourceScale = 3 / sourceRasterWheelOuterRadius;
  const wheelCenter = new THREE.Vector2(0, 0);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const palletPivot = sourcePointToModel(sourceRasterPalletPivot);

  const direction = -1;
  const pinCount = 30;
  const pinPitch = FULL_TURN / pinCount;
  const halfPinPitch = pinPitch / 2;
  const wheelOuterRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelInnerRadius = 2.14;
  const pinOrbitRadius = 2.72;
  const wheelDepth = 0.34;
  const pinLength = 0.66;
  const palletDepth = 0.24;
  const workingPlaneZ = wheelDepth / 2 + pinLength * 0.64;

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
  const lockingAmplitudeFraction = 0.42;
  const releaseAmplitudeFraction = 0.06;
  const landingHalfPhase = Math.asin(lockingAmplitudeFraction) / Math.PI;
  const impulseStartHalfPhase = 1 - landingHalfPhase;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const impulsePalletSpan = (
    lockingAmplitudeFraction - releaseAmplitudeFraction
  ) * palletAmplitude;
  const impulseAdvance = THREE.MathUtils.degToRad(4);
  const freeDropAdvance = halfPinPitch - impulseAdvance;
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
        - side * palletAngle
    ) / impulsePalletSpan
  );
  const impulseMotion = (progress) => progress ** 3 * (
    10 + progress * (-15 + 6 * progress)
  );
  const impulseMotionDerivative = (progress) => (
    30 * progress ** 2 * (1 - progress) ** 2
  );
  const impulseMotionSecondDerivative = (progress) => (
    60 * progress * (1 - progress) * (1 - 2 * progress)
  );
  const impulseWheelDeltaAtPalletAngle = (side, palletAngle) => (
    direction * impulseAdvance * impulseMotion(
      impulseProgressAtPalletAngle(side, palletAngle),
    )
  );
  const impulseWheelSlopeAtPalletAngle = (side, palletAngle) => {
    const progress = impulseProgressAtPalletAngle(side, palletAngle);
    return -direction * side * impulseAdvance
      * impulseMotionDerivative(progress) / impulsePalletSpan;
  };
  const impulsePinCenter = (side, palletAngle) => {
    const angle = lockReferenceAngleForSide(side)
      + impulseWheelDeltaAtPalletAngle(side, palletAngle);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(angle) * pinOrbitRadius,
      Math.sin(angle) * pinOrbitRadius,
    ));
  };
  const pinCenterLocal = (side, palletAngle, mode) => {
    const center = mode === 'lock'
      ? lockPinCenterForSide(side)
      : impulsePinCenter(side, palletAngle);
    return rotate2(center.clone().sub(palletPivot), -palletAngle);
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
    const outwardNormal = new THREE.Vector2(-tangent.y, tangent.x);
    if (outwardNormal.dot(center) < 0) outwardNormal.multiplyScalar(-1);
    return { center, outwardNormal, tangent };
  };
  const palletFaceLocalPoint = (side, palletAngle, mode) => {
    const frame = centerFrameLocal(side, palletAngle, mode);
    return frame.center.clone().addScaledVector(
      frame.outwardNormal,
      pinRadius,
    );
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
  const impulseFacePoints = (side, pointCount = 37) => Array.from(
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
  const indexMaterial = matte(PALETTE.white, { roughness: 0.41 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'clockwise-thirty-pin-single-face-Le-Paute-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'clockwise-stepping-pin-wheel-rotor';
  escapeWheel.add(wheelRotor);
  const wheelRim = new THREE.Mesh(
    centeredExtrusion(
      annularShape(wheelOuterRadius, wheelInnerRadius),
      wheelDepth,
      0.008,
    ),
    wheelMaterial,
  );
  wheelRim.userData.role = 'source-annular-pin-wheel-rim';
  wheelRotor.add(wheelRim);

  const spokeMeshes = [];
  for (let spokeIndex = 0; spokeIndex < 5; spokeIndex += 1) {
    const angle = Math.PI + spokeIndex * FULL_TURN / 5;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.22, wheelDepth * 0.82),
      wheelMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * 1.06,
      Math.sin(angle) * 1.06,
      0,
    );
    spoke.rotation.z = angle;
    spoke.userData.index = spokeIndex;
    spoke.userData.role = 'five-arm-pin-wheel-spoke';
    spokeMeshes.push(spoke);
    wheelRotor.add(spoke);
  }
  const wheelHub = cylinderAlongZ(0.43, 0.78, darkMaterial, 38);
  wheelHub.userData.role = 'pin-wheel-central-arbor-hub';
  wheelRotor.add(wheelHub);
  const wheelShaft = cylinderAlongZ(0.13, 1.45, darkMaterial, 34);
  wheelShaft.userData.role = 'fixed-pin-wheel-arbor';
  escapeWheel.add(wheelShaft);

  const legacyPinShape = () => {
    const shape = new THREE.Shape();
    for (let index = 0; index <= 18; index += 1) {
      const angle = Math.PI + index * Math.PI / 18;
      const point = new THREE.Vector2(
        Math.cos(angle) * pinRadius,
        Math.sin(angle) * pinRadius,
      );
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    }
    shape.closePath();
    return shape;
  };
  const preferredPinShape = () => {
    const shape = new THREE.Shape();
    for (let index = 0; index <= 14; index += 1) {
      const angle = -index * (Math.PI / 2) / 14;
      const point = new THREE.Vector2(
        Math.cos(angle) * pinRadius,
        Math.sin(angle) * pinRadius,
      );
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    }
    shape.lineTo(-pinRadius * 0.54, -pinRadius * 0.54);
    shape.lineTo(-pinRadius * 0.78, 0);
    shape.closePath();
    return shape;
  };
  const sourcePoseWheelAngle = wheelAngleAtHalfLanding(0);
  const pinProfileForIndex = (pinIndex) => (
    Math.cos(pinIndex * pinPitch + sourcePoseWheelAngle) >= 0
      ? 'preferred-B'
      : 'legacy-A'
  );
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
      wheelDepth / 2 + pinLength / 2,
    );
    pinGroup.rotation.z = angle;
    pinGroup.userData.index = pinIndex;
    pinGroup.userData.profile = profile;
    pinGroup.userData.replaceable = true;
    pinGroup.userData.role = profile === 'preferred-B'
      ? 'replaceable-preferred-flattened-B-pin'
      : 'replaceable-legacy-half-round-A-pin';
    const body = new THREE.Mesh(
      centeredExtrusion(
        profile === 'preferred-B'
          ? preferredPinShape()
          : legacyPinShape(),
        pinLength,
        0.004,
      ),
      profile === 'preferred-B'
        ? preferredPinMaterial
        : legacyPinMaterial,
    );
    body.userData.role = profile === 'preferred-B'
      ? 'preferred-B-quarter-arc-working-body'
      : 'legacy-A-semicircular-working-body';
    const rivet = cylinderAlongZ(
      pinRadius * 0.42,
      pinLength + 0.15,
      darkMaterial,
      18,
    );
    rivet.userData.role = 'replaceable-pin-rivet-stem';
    pinGroup.add(body, rivet);
    pinMeshes.push(pinGroup);
    if (profile === 'preferred-B') preferredPins.push(pinGroup);
    else legacyPins.push(pinGroup);
    wheelRotor.add(pinGroup);
  }

  const hubBoltMeshes = [];
  const hubBoltRadius = sourceRasterHubBoltCircleRadius * sourceScale;
  for (let boltIndex = 0; boltIndex < 8; boltIndex += 1) {
    const angle = boltIndex * FULL_TURN / 8;
    const bolt = cylinderAlongZ(0.075, 0.52, frameMaterial, 18);
    bolt.position.set(
      Math.cos(angle) * hubBoltRadius,
      Math.sin(angle) * hubBoltRadius,
      0.29,
    );
    bolt.userData.index = boltIndex;
    bolt.userData.role = 'source-hub-bolt';
    hubBoltMeshes.push(bolt);
    wheelRotor.add(bolt);
  }
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 18, 12),
    indexMaterial,
  );
  wheelIndex.position.set(
    -1.52,
    0,
    wheelDepth / 2 + 0.10,
  );
  wheelIndex.userData.role = 'white-index-on-pin-wheel-spoke';
  wheelRotor.add(wheelIndex);

  const palletAssembly = new THREE.Group();
  palletAssembly.position.set(palletPivot.x, palletPivot.y, 0);
  palletAssembly.userData.axis = Z_AXIS.clone();
  palletAssembly.userData.role =
    'pendulum-rocked-same-plane-inner-and-outer-pallet-assembly';

  const makePallet = (side) => {
    const palletName = palletNameForSide(side);
    const lockPoints = lockFacePoints(side);
    const impulsePoints = impulseFacePoints(side);
    const workingPath = [
      ...lockPoints.slice().reverse(),
      ...impulsePoints.slice(1),
    ];
    const bodyThickness = 0.30;
    const backPath = workingPath.map((point) => point.clone()
      .addScaledVector(point.clone().normalize(), bodyThickness));
    const body = new THREE.Mesh(
      centeredExtrusion(polygonShape([
        ...workingPath,
        ...backPath.reverse(),
      ]), palletDepth, 0.006),
      palletMaterial,
    );
    body.position.z = workingPlaneZ;
    body.userData.role = `${palletName}-pallet-working-block`;
    const lockEdge = edgeTube(
      lockPoints,
      workingPlaneZ + palletDepth / 2 + 0.014,
      0.041,
      indexMaterial,
      `${palletName}-pallet-concentric-resting-face`,
    );
    const impulseEdge = edgeTube(
      impulsePoints,
      workingPlaneZ + palletDepth / 2 + 0.020,
      0.054,
      preferredPinMaterial,
      `${palletName}-pallet-downward-impulse-face`,
    );
    const workingMidpoint = lockPoints[Math.floor(
      lockPoints.length / 2,
    )].clone();
    const pinFrontZ = wheelDepth / 2 + pinLength;
    const armPlaneZ = side > 0
      ? workingPlaneZ
      : pinFrontZ + 0.20;
    const waypoint = new THREE.Vector3(
      side > 0 ? 0.70 : -0.70,
      side > 0 ? -3.63 : -3.52,
      armPlaneZ,
    );
    const arm = beamBetween(
      new THREE.Vector3(0, -0.12, armPlaneZ),
      waypoint,
      0.25,
      palletDepth,
      palletMaterial,
    );
    arm.userData.role = `${palletName}-pallet-arm-from-upper-arbor`;
    const bridge = beamBetween(
      waypoint,
      new THREE.Vector3(
        workingMidpoint.x,
        workingMidpoint.y + 0.20,
        armPlaneZ,
      ),
      0.25,
      palletDepth,
      palletMaterial,
    );
    bridge.userData.role = `${palletName}-arm-to-working-bit-bridge`;
    const offsetPost = cylinderAlongZ(
      0.08,
      Math.abs(armPlaneZ - workingPlaneZ) + palletDepth,
      palletMaterial,
      22,
    );
    offsetPost.position.set(
      workingMidpoint.x,
      workingMidpoint.y + 0.20,
      (armPlaneZ + workingPlaneZ) / 2,
    );
    offsetPost.userData.role = side > 0
      ? 'outer-pallet-short-axial-attachment'
      : 'inner-pallet-forward-offset-to-clear-pin-row';
    const group = new THREE.Group();
    group.userData.role = `${palletName}-complete-pin-wheel-pallet`;
    group.userData.side = side;
    group.add(arm, bridge, offsetPost, body, lockEdge, impulseEdge);
    return {
      arm,
      body,
      bridge,
      group,
      impulseEdge,
      impulsePoints,
      lockEdge,
      lockPoints,
      offsetPost,
    };
  };
  const outerPallet = makePallet(1);
  const innerPallet = makePallet(-1);
  const palletPivotHub = cylinderAlongZ(0.31, 2.24, darkMaterial, 38);
  palletPivotHub.userData.role = 'common-pin-wheel-pallet-arbor';
  const palletIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.09, 0.27),
    indexMaterial,
  );
  palletIndex.position.set(0, 0.43, workingPlaneZ + 0.07);
  palletIndex.userData.role = 'white-index-on-pin-wheel-pallet-arbor';
  palletAssembly.add(
    outerPallet.group,
    innerPallet.group,
    palletPivotHub,
    palletIndex,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 18, 13),
    indexMaterial,
  );
  const contactMarkerZ = wheelDepth / 2 + pinLength + 0.30;
  contactMarker.userData.role = 'white-active-pin-wheel-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-two-arbor-pin-wheel-clock-frame';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.075, 10, 40),
    frameMaterial,
  );
  wheelBearing.position.set(0, 0, -0.47);
  wheelBearing.userData.role = 'fixed-pin-wheel-arbor-bearing';
  const palletBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.085, 10, 42),
    frameMaterial,
  );
  palletBearing.position.set(palletPivot.x, palletPivot.y, -0.42);
  palletBearing.userData.role = 'fixed-upper-pallet-arbor-bearing';
  const palletSupportDisk = cylinderAlongZ(
    0.64,
    0.18,
    frameMaterial,
    48,
  );
  palletSupportDisk.position.set(palletPivot.x, palletPivot.y, -0.59);
  palletSupportDisk.userData.role =
    'source-round-three-screw-upper-bearing-plate';
  const palletSupportBolts = [];
  for (let boltIndex = 0; boltIndex < 3; boltIndex += 1) {
    const angle = Math.PI / 2 + boltIndex * FULL_TURN / 3;
    const bolt = cylinderAlongZ(0.075, 0.16, darkMaterial, 18);
    bolt.position.set(
      palletPivot.x + Math.cos(angle) * 0.39,
      palletPivot.y + Math.sin(angle) * 0.39,
      -0.45,
    );
    bolt.userData.index = boltIndex;
    bolt.userData.role = 'upper-bearing-plate-screw';
    palletSupportBolts.push(bolt);
  }
  const rightStandard = beamBetween(
    new THREE.Vector3(palletPivot.x + 0.78, -0.76, -0.66),
    new THREE.Vector3(palletPivot.x + 0.78, palletPivot.y, -0.66),
    0.24,
    0.30,
    frameMaterial,
  );
  rightStandard.userData.role = 'source-right-pallet-frame-standard';
  const topBracket = beamBetween(
    new THREE.Vector3(palletPivot.x - 0.10, palletPivot.y, -0.66),
    new THREE.Vector3(palletPivot.x + 0.78, palletPivot.y, -0.66),
    0.24,
    0.30,
    frameMaterial,
  );
  topBracket.userData.role = 'source-upper-pallet-bearing-bracket';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 0.23, 0.78),
    frameMaterial,
  );
  base.position.set(0.30, -3.62, -0.65);
  base.userData.role = 'pin-wheel-clock-frame-base';
  fixedFrame.add(
    wheelBearing,
    palletSupportDisk,
    ...palletSupportBolts,
    palletBearing,
    rightStandard,
    topBracket,
    base,
  );
  root.add(
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
  const impulseReleaseWheelSpeed = direction * impulseAdvance
    * impulseMotionDerivative(1) * releaseProgressRate;
  const impulseReleaseWheelAcceleration = direction * impulseAdvance * (
    impulseMotionSecondDerivative(1) * releaseProgressRate ** 2
      + impulseMotionDerivative(1) * releaseProgressAcceleration
  );
  const freeDropAngularAcceleration = 2 * (
    direction * freeDropAdvance
      - impulseReleaseWheelSpeed * dropDuration
  ) / dropDuration ** 2;
  const freeDropLandingWheelSpeed = impulseReleaseWheelSpeed
    + freeDropAngularAcceleration * dropDuration;
  const landingImpactVelocityChange = -freeDropLandingWheelSpeed;

  const baseStateAtTime = (time) => {
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
      stage = Math.abs(halfPhase - 0.5) <= eventTolerance
        ? `${palletNameForSide(side)}-maximum-deadbeat-lock`
        : `${palletNameForSide(side)}-concentric-deadbeat-lock`;
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
        + direction * impulseAdvance * impulseMotion(impulseProgress);
      wheelAngularSpeed = direction * impulseAdvance
        * impulseMotionDerivative(impulseProgress) * progressRate;
      wheelAngularAcceleration = direction * impulseAdvance * (
        impulseMotionSecondDerivative(impulseProgress) * progressRate ** 2
          + impulseMotionDerivative(impulseProgress)
            * progressAcceleration
      );
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
      wheelAngle = wheelAngleAtHalfLanding(dropStartHalfBeat)
        + direction * impulseAdvance
        + impulseReleaseWheelSpeed * elapsedDropTime
        + 0.5 * freeDropAngularAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = impulseReleaseWheelSpeed
        + freeDropAngularAcceleration * elapsedDropTime;
      wheelAngularAcceleration = freeDropAngularAcceleration;
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
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      ).normalize();
      const pinMaterialVelocity = crossZ(
        pinSurfacePoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(
        expectedPoint.clone().sub(palletPivot),
      ).multiplyScalar(palletAngularSpeed);
      const relativeVelocity = pinMaterialVelocity.clone()
        .sub(palletMaterialVelocity);
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
        pinMaterialVelocity,
        pinProfile: pinProfileForIndex(activePinIndex),
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
      activePinProfile: pinProfileForIndex(activePinIndex),
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
    contactMarker.visible = state.contactActive;
    if (state.contactActive) {
      contactMarker.position.set(
        state.contact.expectedPoint.x,
        state.contact.expectedPoint.y,
        contactMarkerZ,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        activePallet: `${state.palletName}-pallet`,
        activePinIndex: state.activePinIndex,
        activePinProfile: state.activePinProfile,
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
  root.userData.archetype = movement.archetype;
  root.userData.mechanism =
    'one clockwise wheel carries thirty replaceable single-plane pins: Brown’s legacy half-round A form on the comparison half and the preferred undercut B form on the other; a common upper arbor rocks adjacent higher-outer and lower-inner pallets whose concentric resting arcs hold the wheel dead and whose two working faces both receive downward impulse';
  root.userData.presentation = 'front elevation with shallow axial reveal';
  root.userData.transmission = {
    deadbeat: 'wheel speed and acceleration are exactly zero while a pin rests on either concentric pallet face',
    direction: 'clockwise; every pin moves downward through both adjacent pallet levels',
    halfBeatAdvance: halfPinPitch,
    impulse: 'both pallet impulses act downward, the defining steady-action advantage of Le Paute’s layout',
    oscillationAdvance: pinPitch,
    pinCount,
    preferredPinForm: 'B: upper half removed and underside relieved to leave a short circular working arc',
    recoil: 'none',
  };
  root.userData.blocks = {
    base,
    contactMarker,
    escapeWheel,
    fixedFrame,
    hubBoltMeshes,
    innerPallet: innerPallet.group,
    innerPalletArm: innerPallet.arm,
    innerPalletBody: innerPallet.body,
    innerPalletOffsetPost: innerPallet.offsetPost,
    legacyPins,
    outerPallet: outerPallet.group,
    outerPalletArm: outerPallet.arm,
    outerPalletBody: outerPallet.body,
    outerPalletOffsetPost: outerPallet.offsetPost,
    palletAssembly,
    palletBearing,
    palletIndex,
    palletPivotHub,
    palletSupportBolts,
    palletSupportDisk,
    pinMeshes,
    preferredPins,
    rightStandard,
    spokeMeshes,
    topBracket,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRim,
    wheelRotor,
    wheelShaft,
  };
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.55, -3.82, -1.0),
    new THREE.Vector3(4.15, 5.02, 1.25),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    direction,
    dropDuration,
    eventPeriod: pendulumPeriod,
    freeDropAdvance,
    freeDropAngularAcceleration,
    freeDropLandingWheelSpeed,
    halfBeatDuration,
    halfPinPitch,
    impulseAdvance,
    impulsePalletSpan,
    impulseReleaseWheelAcceleration,
    impulseReleaseWheelSpeed,
    impulseStartHalfPhase,
    innerLockReferenceAngle,
    landingHalfPhase,
    landingImpactVelocityChange,
    legacyPinWorkingArc: Math.PI,
    lockingAmplitudeFraction,
    meanPalletRadius,
    outerLockReferenceAngle,
    palletAmplitude,
    palletDepth,
    palletPivot: palletPivot.clone(),
    pendulumPeriod,
    pinCount,
    pinLength,
    pinOrbitRadius,
    pinPitch,
    pinRadius,
    preferredPinWorkingArc: Math.PI / 2,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourcePendulumTotalSwing,
    sourcePinAngularDiameter,
    sourceScale,
    sourceTimeOffset,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
    wheelInnerRadius,
    wheelOuterRadius,
    workingPlaneZ,
    contactMarkerZ,
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
  root.userData.palletFaceFrame = palletFaceFrame;
  root.userData.palletFaceLocalPoint = palletFaceLocalPoint;
  root.userData.palletProfiles = {
    inner: {
      impulseConcentricRadiusRange: radiusRange(
        innerPallet.impulsePoints,
      ),
      impulseDirection: 'downward',
      impulsePoints: innerPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(innerPallet.lockPoints),
      lockPoints: innerPallet.lockPoints,
      position: 'lower pallet, inside the wheel pitch line',
      side: -1,
    },
    outer: {
      impulseConcentricRadiusRange: radiusRange(
        outerPallet.impulsePoints,
      ),
      impulseDirection: 'downward',
      impulsePoints: outerPallet.impulsePoints,
      lockConcentricRadiusRange: radiusRange(outerPallet.lockPoints),
      lockPoints: outerPallet.lockPoints,
      position: 'higher pallet, outside the wheel pitch line',
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
      workingArcRadians: Math.PI / 2,
    },
  };
  root.userData.pinProfileForIndex = pinProfileForIndex;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    reason: 'The official Movement 304 page marks Animated unavailable and serves Brown’s static comparison plate.',
    referenceScope: 'Brown fixes one pin wheel, the adjacent two-pallet upper-arbor layout, replaceable A/B pins, and their two cross-sections. The period construction reference supplies the clockwise direction, thirty-pin count, same-plane pallet offset, four-degree swing, concentric rests, and downward action on both pallets.',
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
      inferredTopology: 'one annular wheel with replaceable axial pins in a single working plane; one upper arbor carries a higher outer pallet and a lower inner pallet immediately beside the right rim',
      measurementUncertaintyPixels: 8,
      modeledPinCount: pinCount,
      officialAnimationAvailable: false,
      rasterHubBoltCircleRadius: sourceRasterHubBoltCircleRadius,
      rasterInnerPalletTip: sourceRasterInnerPalletTip.clone(),
      rasterLegacyPinA: sourceRasterLegacyPinA.clone(),
      rasterOuterPalletTip: sourceRasterOuterPalletTip.clone(),
      rasterPalletPivot: sourceRasterPalletPivot.clone(),
      rasterPreferredPinB: sourceRasterPreferredPinB.clone(),
      rasterWheelBounds: sourceRasterWheelBounds,
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
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
  for (const object of [contactMarker, palletIndex, wheelIndex]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(1.8, 1.2, 14.2),
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
