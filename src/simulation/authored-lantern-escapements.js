import * as THREE from 'three';
import { correctLanternWorkingParts } from './lantern-working-parts.js';
import { installLanternFinitePlayback297 } from './lantern-finite-playback-parts.js';
import { ring } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function angleNear(angle, reference) {
  let result = angle;
  while (result - reference > Math.PI) result -= FULL_TURN;
  while (result - reference < -Math.PI) result += FULL_TURN;
  return result;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (x - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (2 * x ** 2 - 3 * x + 1);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
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
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(points[0].x, points[0].y, z),
    new THREE.Vector3(points[1].x, points[1].y, z),
  );
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, radius, 8, false),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function lanternWheelEscapement(movement) {
  const root = new THREE.Group();

  // Brown shows eight circular trundle ends between two lantern-wheel plates.
  // The single rocking arm A carries both oblique pallets.  A trundle remains
  // against one pallet while the arm travels outward (recoil) and returns
  // (direct impulse); it then drops to the other pallet.  The two pallet spans
  // differ, so the two free drops are unequal but add to exactly one trundle
  // pitch per complete oscillation.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterWheelCenter = new THREE.Vector2(272, 315);
  const sourceRasterWheelOuterRadius = 190;
  const sourceRasterTrundleOrbitRadius = 151;
  const sourceRasterTrundleRadius = 22;
  const sourceRasterArmPivotA = new THREE.Vector2(385, 76);
  const sourceRasterPalletB = new THREE.Vector2(405, 203);
  const sourceRasterPalletC = new THREE.Vector2(355, 270);
  const sourceRasterDirectionArrow = new THREE.Vector2(145, 264);
  const sourceRasterTrundleCenters = [
    new THREE.Vector2(258, 157),
    new THREE.Vector2(157, 226),
    new THREE.Vector2(113, 316),
    new THREE.Vector2(163, 423),
    new THREE.Vector2(289, 462),
    new THREE.Vector2(382, 413),
    new THREE.Vector2(424, 306),
    new THREE.Vector2(369, 195),
  ];
  const sourcePalletBLongAxisDegrees = 46;
  const sourcePalletCLongAxisDegrees = -28;
  const sourceScale = 3 / sourceRasterWheelOuterRadius;
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterWheelCenter.x) * sourceScale,
    (sourceRasterWheelCenter.y - y) * sourceScale,
  );
  const wheelCenter = sourcePointToModel(sourceRasterWheelCenter);
  const armPivot = sourcePointToModel(sourceRasterArmPivotA);

  const trundleCount = 8;
  const trundlePitch = FULL_TURN / trundleCount;
  const halfTrundlePitch = trundlePitch / 2;
  const trundleOrbitRadius = sourceRasterTrundleOrbitRadius * sourceScale;
  const trundleRadius = sourceRasterTrundleRadius * sourceScale;
  const wheelOuterRadius = sourceRasterWheelOuterRadius * sourceScale;
  const wheelInnerRadius = 2.67;
  const sidePlateDepth = 0.16;
  const sidePlateOffset = 0.70;
  const trundleLength = 1.62;
  const palletDepth = 0.28;
  const palletPlaneZ = 0.72;
  const palletBodyWidth = 0.30;

  const armPeriod = 4;
  const halfBeatDuration = armPeriod / 2;
  const armAmplitude = THREE.MathUtils.degToRad(6);
  const landingHalfPhase = 0.12;
  const releaseHalfPhase = 1 - landingHalfPhase;
  const dropHalfPhaseDuration = 2 * landingHalfPhase;
  const dropDuration = dropHalfPhaseDuration * halfBeatDuration;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const palletNameForSide = (side) => (side > 0 ? 'B' : 'C');
  const trundleOrdinalForHalfBeat = (halfBeatIndex) => (
    -Math.ceil(halfBeatIndex / 2)
  );
  const trundleIndexForHalfBeat = (halfBeatIndex) => positiveModulo(
    trundleOrdinalForHalfBeat(halfBeatIndex),
    trundleCount,
  );

  const makePalletProfile = (
    name,
    sourceCenter,
    longAxisDegrees,
    referencePinDegrees,
    side,
  ) => {
    const tangent = new THREE.Vector2(
      Math.cos(THREE.MathUtils.degToRad(longAxisDegrees)),
      Math.sin(THREE.MathUtils.degToRad(longAxisDegrees)),
    );
    const normal = crossZ(tangent);
    const sourceCenterWorld = sourcePointToModel(sourceCenter);
    const referencePinAngle = THREE.MathUtils.degToRad(
      referencePinDegrees,
    );
    const referencePinCenter = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(referencePinAngle) * trundleOrbitRadius,
      Math.sin(referencePinAngle) * trundleOrbitRadius,
    ));
    const signedDistance = normal.dot(
      referencePinCenter.clone().sub(sourceCenterWorld),
    );
    const facePointWorld = sourceCenterWorld.clone().addScaledVector(
      normal,
      signedDistance - trundleRadius,
    );
    return {
      facePointLocal: facePointWorld.clone().sub(armPivot),
      facePointWorld,
      longAxisDegrees,
      name,
      normal,
      referencePinAngle,
      referencePinDegrees,
      side,
      sourceCenterWorld,
      tangent,
    };
  };
  const palletProfiles = {
    B: makePalletProfile(
      'B',
      sourceRasterPalletB,
      sourcePalletBLongAxisDegrees,
      42,
      1,
    ),
    C: makePalletProfile(
      'C',
      sourceRasterPalletC,
      sourcePalletCLongAxisDegrees,
      18,
      -1,
    ),
  };

  const contactPinAngle = (profile, armAngle) => {
    const facePoint = armPivot.clone().add(
      rotate2(profile.facePointLocal, armAngle),
    );
    const normal = rotate2(profile.normal, armAngle);
    const cosineArgument = THREE.MathUtils.clamp(
      (
        trundleRadius
          + normal.dot(facePoint.clone().sub(wheelCenter))
      ) / trundleOrbitRadius,
      -1,
      1,
    );
    const normalAngle = Math.atan2(normal.y, normal.x);
    const offset = Math.acos(cosineArgument);
    const first = angleNear(
      normalAngle + offset,
      profile.referencePinAngle,
    );
    const second = angleNear(
      normalAngle - offset,
      profile.referencePinAngle,
    );
    return Math.abs(first - profile.referencePinAngle)
      <= Math.abs(second - profile.referencePinAngle)
      ? first
      : second;
  };
  const contactPinAngleDerivatives = (profile, armAngle) => {
    const epsilon = 1e-5;
    const center = contactPinAngle(profile, armAngle);
    const before = angleNear(
      contactPinAngle(profile, armAngle - epsilon),
      center,
    );
    const after = angleNear(
      contactPinAngle(profile, armAngle + epsilon),
      center,
    );
    return {
      first: (after - before) / (2 * epsilon),
      second: (after - 2 * center + before) / epsilon ** 2,
    };
  };
  const palletFaceFrame = (profile, armAngle, pinAngle = null) => {
    const facePoint = armPivot.clone().add(
      rotate2(profile.facePointLocal, armAngle),
    );
    const tangent = rotate2(profile.tangent, armAngle);
    const normal = rotate2(profile.normal, armAngle);
    const resolvedPinAngle = pinAngle ?? contactPinAngle(
      profile,
      armAngle,
    );
    const pinCenter = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(resolvedPinAngle) * trundleOrbitRadius,
      Math.sin(resolvedPinAngle) * trundleOrbitRadius,
    ));
    const projection = tangent.dot(pinCenter.clone().sub(facePoint));
    const point = facePoint.clone().addScaledVector(tangent, projection);
    return {
      facePoint,
      normal,
      pinCenter,
      point,
      projection,
      tangent,
    };
  };
  const armStateAtHalfPhase = (side, halfPhase) => {
    const argument = Math.PI * halfPhase;
    const angularFrequency = Math.PI / halfBeatDuration;
    return {
      angle: side * armAmplitude * Math.sin(argument),
      angularAcceleration: -side * armAmplitude
        * angularFrequency ** 2 * Math.sin(argument),
      angularSpeed: side * armAmplitude
        * angularFrequency * Math.cos(argument),
    };
  };
  const contactWheelState = (halfBeatIndex, halfPhase) => {
    const side = sideForHalfBeat(halfBeatIndex);
    const profile = palletProfiles[palletNameForSide(side)];
    const arm = armStateAtHalfPhase(side, halfPhase);
    const derivatives = contactPinAngleDerivatives(profile, arm.angle);
    const pinAngle = contactPinAngle(profile, arm.angle);
    return {
      arm,
      derivatives,
      pinAngle,
      profile,
      side,
      wheelAngle: pinAngle
        - trundleOrdinalForHalfBeat(halfBeatIndex) * trundlePitch,
      wheelAngularAcceleration: derivatives.second
          * arm.angularSpeed ** 2
        + derivatives.first * arm.angularAcceleration,
      wheelAngularSpeed: derivatives.first * arm.angularSpeed,
    };
  };

  for (const profile of Object.values(palletProfiles)) {
    const projections = [];
    for (let index = 0; index <= 160; index += 1) {
      const halfPhase = THREE.MathUtils.lerp(
        landingHalfPhase,
        releaseHalfPhase,
        index / 160,
      );
      const arm = armStateAtHalfPhase(profile.side, halfPhase);
      projections.push(palletFaceFrame(profile, arm.angle).projection);
    }
    const workingMargin = 0.12;
    profile.workingRange = [
      Math.min(...projections) - workingMargin,
      Math.max(...projections) + workingMargin,
    ];
    profile.workingFaceLocalPoints = profile.workingRange.map(
      (distance) => profile.facePointLocal.clone().addScaledVector(
        profile.tangent,
        distance,
      ),
    );
  }

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.17,
    roughness: 0.51,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.55,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.13,
    roughness: 0.47,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const lanternWheel = new THREE.Group();
  lanternWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  lanternWheel.userData.axis = Z_AXIS.clone();
  lanternWheel.userData.role =
    'counter-clockwise-eight-trundle-lantern-escape-wheel';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role = 'intermittent-lantern-wheel-rotor';
  lanternWheel.add(wheelRotor);

  const sidePlates = [];
  const sidePlateSpokes = [];
  for (const axialSign of [-1, 1]) {
    const axialName = axialSign > 0 ? 'front' : 'rear';
    const plate = new THREE.Mesh(
      centeredExtrusion(
        annularShape(wheelOuterRadius, wheelInnerRadius),
        sidePlateDepth,
        0.008,
      ),
      driverMaterial,
    );
    plate.position.z = axialSign * sidePlateOffset;
    plate.userData.axialSide = axialName;
    plate.userData.role = `${axialName}-lantern-wheel-end-ring`;
    sidePlates.push(plate);
    wheelRotor.add(plate);

    for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
      const angle = Math.PI / 4 + spokeIndex * Math.PI / 2;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(2.42, 0.16, sidePlateDepth * 0.82),
        driverMaterial,
      );
      spoke.position.set(
        Math.cos(angle) * 1.22,
        Math.sin(angle) * 1.22,
        axialSign * sidePlateOffset,
      );
      spoke.rotation.z = angle;
      spoke.userData.axialSide = axialName;
      spoke.userData.role = `${axialName}-lantern-wheel-spoke`;
      sidePlateSpokes.push(spoke);
      wheelRotor.add(spoke);
    }
  }

  const wheelHubs = [-1, 1].map((axialSign) => {
    const hub = cylinderAlongZ(0.47, 0.30, darkMaterial, 38);
    hub.position.z = axialSign * sidePlateOffset;
    hub.userData.role = axialSign > 0
      ? 'front-lantern-wheel-hub'
      : 'rear-lantern-wheel-hub';
    wheelRotor.add(hub);
    return hub;
  });
  const wheelShaft = cylinderAlongZ(0.16, 2.08, darkMaterial, 34);
  wheelShaft.userData.role = 'lantern-wheel-arbor';
  wheelRotor.add(wheelShaft);

  const trundles = [];
  for (let index = 0; index < trundleCount; index += 1) {
    const angle = index * trundlePitch;
    const trundle = cylinderAlongZ(
      trundleRadius,
      trundleLength,
      driverMaterial,
      28,
    );
    trundle.position.set(
      Math.cos(angle) * trundleOrbitRadius,
      Math.sin(angle) * trundleOrbitRadius,
      0,
    );
    trundle.userData.axis = Z_AXIS.clone();
    trundle.userData.index = index;
    trundle.userData.role = 'axial-cylindrical-lantern-trundle';
    trundles.push(trundle);
    wheelRotor.add(trundle);
  }
  const wheelIndex = new THREE.Mesh(
    new THREE.TorusGeometry(trundleRadius * 1.04, 0.052, 10, 34),
    whiteMaterial,
  );
  wheelIndex.position.set(trundleOrbitRadius, 0, trundleLength / 2 + 0.015);
  wheelIndex.userData.role = 'white-index-ring-on-lantern-trundle-zero';
  wheelRotor.add(wheelIndex);
  const rimIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 18, 14),
    whiteMaterial,
  );
  rimIndex.position.set(
    Math.cos(THREE.MathUtils.degToRad(220)) * 2.84,
    Math.sin(THREE.MathUtils.degToRad(220)) * 2.84,
    sidePlateOffset + sidePlateDepth / 2 + 0.06,
  );
  rimIndex.userData.role = 'white-counter-clockwise-wheel-index';
  wheelRotor.add(rimIndex);

  const armAssembly = new THREE.Group();
  armAssembly.position.set(armPivot.x, armPivot.y, 0);
  armAssembly.userData.axis = Z_AXIS.clone();
  armAssembly.userData.role = 'single-rocking-arm-A-carrying-B-and-C';
  const armA = beamBetween(
    new THREE.Vector3(0, 0.42, palletPlaneZ),
    new THREE.Vector3(-1.02, -3.62, palletPlaneZ),
    0.22,
    palletDepth * 0.82,
    drivenMaterial,
  );
  armA.userData.role = 'one-piece-rocking-arm-A';
  armAssembly.add(armA);

  const makePallet = (profile) => {
    const [first, second] = profile.workingFaceLocalPoints;
    const innerSecond = second.clone().addScaledVector(
      profile.normal,
      -palletBodyWidth,
    );
    const innerFirst = first.clone().addScaledVector(
      profile.normal,
      -palletBodyWidth,
    );
    const body = new THREE.Mesh(
      centeredExtrusion(
        polygonShape([first, second, innerSecond, innerFirst]),
        palletDepth,
        0.008,
      ),
      drivenMaterial,
    );
    body.position.z = palletPlaneZ;
    body.userData.sourceName = profile.name;
    body.userData.role = `angled-pallet-${profile.name}-on-arm-A`;
    const face = edgeTube(
      [first, second],
      palletPlaneZ + palletDepth / 2 + 0.016,
      0.050,
      accentMaterial,
      `working-face-of-lantern-pallet-${profile.name}`,
    );
    const bodyCenter = first.clone().add(second).multiplyScalar(0.5)
      .addScaledVector(profile.normal, -palletBodyWidth / 2);
    const armDirection = new THREE.Vector2(-1.02, -3.62).normalize();
    const armAttach = armDirection.multiplyScalar(
      Math.max(0.55, bodyCenter.dot(armDirection)),
    );
    const bridge = beamBetween(
      new THREE.Vector3(armAttach.x, armAttach.y, palletPlaneZ),
      new THREE.Vector3(bodyCenter.x, bodyCenter.y, palletPlaneZ),
      0.19,
      palletDepth * 0.78,
      drivenMaterial,
    );
    bridge.userData.role = `rigid-mount-from-arm-A-to-pallet-${profile.name}`;
    const labelMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 16, 12),
      whiteMaterial,
    );
    labelMarker.position.set(
      bodyCenter.x,
      bodyCenter.y,
      palletPlaneZ + palletDepth / 2 + 0.12,
    );
    labelMarker.userData.role =
      `white-source-label-marker-for-pallet-${profile.name}`;
    const group = new THREE.Group();
    group.userData.sourceName = profile.name;
    group.userData.role = `complete-lantern-pallet-${profile.name}`;
    group.add(body, bridge, face, labelMarker);
    armAssembly.add(group);
    return {
      body,
      bridge,
      face,
      group,
      labelMarker,
    };
  };
  const palletB = makePallet(palletProfiles.B);
  const palletC = makePallet(palletProfiles.C);
  const armHub = cylinderAlongZ(0.34, 1.86, darkMaterial, 38);
  armHub.userData.role = 'rocking-arm-A-pivot-hub';
  armAssembly.add(armHub);
  const armIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.085, 0.20),
    whiteMaterial,
  );
  armIndex.position.set(0, 0.49, palletPlaneZ + 0.20);
  armIndex.userData.role = 'white-index-on-rocking-arm-A';
  armAssembly.add(armIndex);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 18, 14),
    whiteMaterial,
  );
  contactMarker.userData.role = 'one-white-active-trundle-contact-marker';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-two-arbor-lantern-escapement-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.24, 0.92),
    frameMaterial,
  );
  base.position.set(0.25, -3.84, -1.02);
  base.userData.role = 'fixed-lantern-escapement-base';
  const standard = beamBetween(
    new THREE.Vector3(3.65, -3.72, -1.03),
    new THREE.Vector3(armPivot.x, armPivot.y + 0.62, -1.03),
    0.23,
    0.28,
    frameMaterial,
  );
  standard.userData.role = 'fixed-rear-standard-for-arm-A';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.08, 10, 42),
    frameMaterial,
  );
  wheelBearing.position.set(0, 0, -0.98);
  wheelBearing.userData.role = 'fixed-lantern-wheel-bearing';
  const armBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.37, 0.08, 10, 42),
    frameMaterial,
  );
  armBearing.position.set(armPivot.x, armPivot.y, -0.98);
  armBearing.userData.role = 'fixed-rocking-arm-bearing-A';
  fixedFrame.add(base, standard, wheelBearing, armBearing);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.3, 9.8, 3.6),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.15, 0.18, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-complete-lantern-wheel-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    lanternWheel,
    armAssembly,
    contactMarker,
  );

  const dropState = (startHalfBeatIndex, elapsedTime) => {
    const start = contactWheelState(
      startHalfBeatIndex,
      releaseHalfPhase,
    );
    const end = contactWheelState(
      startHalfBeatIndex + 1,
      landingHalfPhase,
    );
    const progress = THREE.MathUtils.clamp(
      elapsedTime / dropDuration,
      0,
      1,
    );
    const progressSpeed = smootherStepDerivative(progress) / dropDuration;
    const progressAcceleration = smootherStepSecondDerivative(progress)
      / dropDuration ** 2;
    const advance = end.wheelAngle - start.wheelAngle;
    return {
      advance,
      end,
      progress,
      start,
      wheelAngle: start.wheelAngle + advance * smootherStep(progress),
      wheelAngularAcceleration: advance * progressAcceleration,
      wheelAngularSpeed: advance * progressSpeed,
    };
  };

  const stateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const arm = armStateAtHalfPhase(side, halfPhase);
    const eventTolerance = 1e-12;
    const contactActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase <= releaseHalfPhase + eventTolerance;
    let wheelAngle;
    let wheelAngularAcceleration;
    let wheelAngularSpeed;
    let activeHalfBeatIndex = halfBeatIndex;
    let dropProgress = null;
    let stage;
    if (contactActive) {
      const contactState = contactWheelState(halfBeatIndex, halfPhase);
      wheelAngle = contactState.wheelAngle;
      wheelAngularAcceleration = contactState.wheelAngularAcceleration;
      wheelAngularSpeed = contactState.wheelAngularSpeed;
      stage = halfPhase < 0.5
        ? `pallet-${palletNameForSide(side)}-recoil`
        : `pallet-${palletNameForSide(side)}-return-impulse`;
    } else {
      const earlyDrop = halfPhase < landingHalfPhase;
      const startHalfBeatIndex = earlyDrop
        ? halfBeatIndex - 1
        : halfBeatIndex;
      const startCoordinate = startHalfBeatIndex + releaseHalfPhase;
      const elapsedTime = (
        halfBeatCoordinate - startCoordinate
      ) * halfBeatDuration;
      const drop = dropState(startHalfBeatIndex, elapsedTime);
      wheelAngle = drop.wheelAngle;
      wheelAngularAcceleration = drop.wheelAngularAcceleration;
      wheelAngularSpeed = drop.wheelAngularSpeed;
      dropProgress = drop.progress;
      activeHalfBeatIndex = startHalfBeatIndex + 1;
      stage = `free-drop-to-pallet-${palletNameForSide(
        sideForHalfBeat(activeHalfBeatIndex),
      )}`;
    }

    const activeSide = contactActive
      ? side
      : sideForHalfBeat(activeHalfBeatIndex);
    const activePalletName = palletNameForSide(activeSide);
    const activeTrundleIndex = trundleIndexForHalfBeat(
      activeHalfBeatIndex,
    );
    const activeTrundleAngle = wheelAngle
      + activeTrundleIndex * trundlePitch;
    const activeTrundleCenter = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(activeTrundleAngle) * trundleOrbitRadius,
      Math.sin(activeTrundleAngle) * trundleOrbitRadius,
    ));
    let contact = null;
    if (contactActive) {
      const profile = palletProfiles[activePalletName];
      const pinAngle = contactPinAngle(profile, arm.angle);
      const face = palletFaceFrame(profile, arm.angle, pinAngle);
      const trundleSurfacePoint = activeTrundleCenter.clone()
        .addScaledVector(face.normal, -trundleRadius);
      const trundleMaterialVelocity = crossZ(
        trundleSurfacePoint.clone().sub(wheelCenter),
      ).multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(
        face.point.clone().sub(armPivot),
      ).multiplyScalar(arm.angularSpeed);
      const relativeVelocity = trundleMaterialVelocity.clone()
        .sub(palletMaterialVelocity);
      contact = {
        activePallet: activePalletName,
        activeTrundleIndex,
        expectedPoint: face.point,
        faceNormal: face.normal,
        faceTangent: face.tangent,
        mode: halfPhase < 0.5
          ? 'frictional-recoil'
          : 'direct-return-impulse',
        normalVelocityError: relativeVelocity.dot(face.normal),
        palletMaterialVelocity,
        pointError: trundleSurfacePoint.distanceTo(face.point),
        relativeSlipSpeed: relativeVelocity.dot(face.tangent),
        trundleMaterialVelocity,
        trundleSurfacePoint,
      };
    }
    const cycleIndex = Math.floor(time / armPeriod);
    const cyclePhase = time / armPeriod - cycleIndex;
    return {
      activeHalfBeatIndex,
      activePalletName,
      activeSide,
      activeTrundleAngle,
      activeTrundleCenter,
      activeTrundleIndex,
      armAngle: arm.angle,
      armAngularAcceleration: arm.angularAcceleration,
      armAngularSpeed: arm.angularSpeed,
      contact,
      contactActive,
      contactMode: contact?.mode ?? null,
      cycleIndex,
      cyclePhase,
      dropProgress,
      halfBeatIndex,
      halfPhase,
      stage,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(phase * armPeriod);
  const canonicalTimes = {
    dropToB: 0,
    palletBLanding: landingHalfPhase * halfBeatDuration,
    palletBMaximumRecoil: halfBeatDuration / 2,
    palletBReturnImpulse: 0.70 * halfBeatDuration,
    palletBRelease: releaseHalfPhase * halfBeatDuration,
    dropToC: halfBeatDuration,
    palletCLanding: halfBeatDuration
      + landingHalfPhase * halfBeatDuration,
    palletCMaximumRecoil: halfBeatDuration * 1.5,
    palletCReturnImpulse: halfBeatDuration
      + 0.70 * halfBeatDuration,
    palletCRelease: halfBeatDuration
      + releaseHalfPhase * halfBeatDuration,
    oneArmOscillation: armPeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    armAssembly.rotation.z = state.armAngle;
    armAssembly.userData.angularAcceleration =
      state.armAngularAcceleration;
    armAssembly.userData.angularSpeed = state.armAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    contactMarker.visible = state.contactActive;
    if (state.contactActive) {
      contactMarker.position.set(
        state.contact.expectedPoint.x,
        state.contact.expectedPoint.y,
        palletPlaneZ + palletDepth / 2 + 0.13,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        activePallet: state.activePalletName,
        activeTrundleIndex: state.activeTrundleIndex,
        mode: state.contactMode,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activeTrundleIndex: state.activeTrundleIndex,
        dropProgress: state.dropProgress,
        mode: null,
        normalVelocityError: null,
        pointError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  const evenDrop = dropState(0, dropDuration);
  const oddDrop = dropState(1, dropDuration);
  root.userData.archetype =
    'eight-trundle-single-arm-two-pallet-lantern-wheel-escapement';
  root.userData.mechanism =
    'one counter-clockwise eight-trundle lantern cage is controlled by one rocking arm A carrying exactly two oblique pallets B and C; one cylindrical trundle contacts one pallet at a time, recoils while the arm travels outward, returns impulse through the same face, and then drops to the other pallet';
  root.userData.transmission = {
    activeContactsAtOnce: 1,
    armOscillationAdvance: trundlePitch,
    averageHalfBeatAdvance: halfTrundlePitch,
    direction: 'counter-clockwise, matching Brown’s downward arrow at the left rim',
    evenToOddDropAdvance: evenDrop.advance,
    oddToEvenDropAdvance: oddDrop.advance,
    palletCount: 2,
    recoil: 'each active trundle moves briefly clockwise during the outward arm travel and returns counter-clockwise while directly impulsing that pallet',
    trundleCount,
  };
  root.userData.blocks = {
    armA,
    armAssembly,
    armBearing,
    armHub,
    armIndex,
    base,
    cameraEnvelope,
    contactMarker,
    fixedFrame,
    lanternWheel,
    palletB: palletB.group,
    palletBBody: palletB.body,
    palletBFace: palletB.face,
    palletC: palletC.group,
    palletCBody: palletC.body,
    palletCFace: palletC.face,
    rimIndex,
    sidePlates,
    sidePlateSpokes,
    standard,
    trundles,
    wheelBearing,
    wheelHubs,
    wheelIndex,
    wheelRotor,
    wheelShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contactPinAngle = contactPinAngle;
  root.userData.contactPinAngleDerivatives = contactPinAngleDerivatives;
  root.userData.dropState = dropState;
  root.userData.geometry = {
    armAmplitude,
    armPeriod,
    armPivot: armPivot.clone(),
    dropDuration,
    dropHalfPhaseDuration,
    halfBeatDuration,
    halfTrundlePitch,
    landingHalfPhase,
    palletBodyWidth,
    palletDepth,
    palletPlaneZ,
    releaseHalfPhase,
    sidePlateDepth,
    sidePlateOffset,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    trundleCount,
    trundleLength,
    trundleOrbitRadius,
    trundlePitch,
    trundleRadius,
    wheelCenter: wheelCenter.clone(),
    wheelInnerRadius,
    wheelOuterRadius,
  };
  root.userData.palletFaceFrame = palletFaceFrame;
  root.userData.palletProfiles = palletProfiles;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official movement 297 page supplies Brown’s static eight-position lantern wheel, counter-clockwise arrow, arm A, and pallets B and C. The plate gives no timing, lift, drop, or depth dimensions, so those are reconstructed while preserving the shown topology, angular layout, single-contact alternation, and one-pitch-per-oscillation closure.',
    sourceUrl: 'https://507movements.com/mm_297.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate297: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one counter-clockwise cage wheel with eight axial round trundles and one pivoted arm A carrying the two angled pallets B and C',
      measurementUncertaintyPixels: 8,
      rasterArmPivotA: sourceRasterArmPivotA.clone(),
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterPalletB: sourceRasterPalletB.clone(),
      rasterPalletBLongAxisDegrees: sourcePalletBLongAxisDegrees,
      rasterPalletC: sourceRasterPalletC.clone(),
      rasterPalletCLongAxisDegrees: sourcePalletCLongAxisDegrees,
      rasterTrundleCenters: sourceRasterTrundleCenters.map(
        (point) => point.clone(),
      ),
      rasterTrundleOrbitRadius: sourceRasterTrundleOrbitRadius,
      rasterTrundleRadius: sourceRasterTrundleRadius,
      rasterWheelCenter: sourceRasterWheelCenter.clone(),
      rasterWheelOuterRadius: sourceRasterWheelOuterRadius,
      visibleTrundleCount: trundleCount,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
    periodReference: {
      description: 'an old-fashioned escapement in which the escape wheel is a lantern wheel and two plates set at angles are carried by one rocking arm',
      entry: 107,
      publicationYear: 1904,
      source: 'Scientific American Reference Book',
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: armPeriod,
    schedule: [
      'trundle-lands-on-pallet-B',
      'B-recoil-then-direct-return-impulse',
      'counter-clockwise-free-drop-to-C',
      'trundle-lands-on-pallet-C',
      'C-recoil-then-direct-return-impulse',
      'counter-clockwise-free-drop-to-B',
    ],
  };
  root.userData.trundleIndexForHalfBeat = trundleIndexForHalfBeat;

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
    armIndex,
    cameraEnvelope,
    contactMarker,
    palletB.labelMarker,
    palletC.labelMarker,
    rimIndex,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  correctLanternWorkingParts(root, update);
  const finiteUpdate = installLanternFinitePlayback297(root);
  // Brown draws the wheel as a plain disc pierced by the eight pins, with a
  // hub ring and no spokes: make both end plates solid bored discs.
  const blocks = root.userData.blocks;
  for (const endPlate of blocks.sidePlates) {
    endPlate.geometry.dispose();
    endPlate.geometry = ring(0.166, wheelOuterRadius,
      -sidePlateDepth / 2, sidePlateDepth / 2, 192);
    endPlate.userData.role = endPlate.userData.role.replace('end-ring', 'plain-disc');
  }
  for (const spoke of blocks.sidePlateSpokes) {
    spoke.removeFromParent();
    spoke.geometry.dispose();
  }
  blocks.sidePlateSpokes = [];
  const workingPairs = root.userData.lanternWorkingParts.pairs;
  root.userData.lanternWorkingParts.pairs = workingPairs.filter(
    ([a, b]) => a.parent && b.parent,
  );
  // The pin ends read as separate circles on the plate's plain disc.
  const pinMaterial = matte(PALETTE.white, { metalness: 0.22, roughness: 0.45 });
  pinMaterial.fog = false;
  for (const trundle of blocks.trundles) trundle.material = pinMaterial;
  // Neither the index marks nor a contact marker appear on the plate.
  blocks.wheelIndex.visible = false;
  blocks.rimIndex.visible = false;
  // Brown dashes arm A and its pivot only because the plate hides them; the
  // model shows the real arm, hub, arbor and pallet mounts, which the plain
  // disc covers from the front and which appear when the view is turned.
  const plainDiscUpdate = (time) => {
    finiteUpdate(time);
    blocks.contactMarker.visible = false;
  };
  plainDiscUpdate(0);
  root.userData.reconstructionNote = 'The eight-trundle wheel has plain bored end discs, as drawn, and bored supports. '
    + (root.userData.reconstructionNote ?? '').replace(/^The eight-trundle wheel has connected end rings, spokes and bored supports\. /, '');
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update: plainDiscUpdate,
  };
}

export function createAuthoredLanternEscapementMovement(movement) {
  if (movement.id !== 297) return null;
  return lanternWheelEscapement(movement);
}
