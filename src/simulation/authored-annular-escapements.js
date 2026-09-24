import * as THREE from 'three';
import { correctAnnularStudEscapement } from './annular-stud-working-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 34) {
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

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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

function makeProfiledPallet(facePoints, {
  depth,
  role,
  thickness,
}) {
  const innerPoints = facePoints.map((point) => point.clone()
    .addScaledVector(point.clone().normalize(), thickness));
  const body = new THREE.Mesh(
    centeredExtrusion(polygonShape([
      ...facePoints,
      ...innerPoints.reverse(),
    ]), depth, 0.006),
    matte(PALETTE.accent, { metalness: 0.18, roughness: 0.50 }),
  );
  body.userData.role = role;
  const curve = new THREE.CatmullRomCurve3(
    facePoints.map((point) => new THREE.Vector3(
      point.x,
      point.y,
      depth / 2 + 0.014,
    )),
    false,
    'centripetal',
  );
  const workingEdge = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 52, 0.048, 8, false),
    matte(PALETTE.white, { metalness: 0.12, roughness: 0.42 }),
  );
  workingEdge.userData.role = `${role}-visible-working-edge`;
  const root = new THREE.Group();
  root.add(body, workingEdge);
  root.userData.body = body;
  root.userData.facePoints = facePoints;
  root.userData.workingEdge = workingEdge;
  return root;
}

function annularPendulumEscapement(movement) {
  const root = new THREE.Group();

  // Brown supplies only the plate and the sentence "Another kind of pendulum
  // escapement"; the official page explicitly has no animation. The plate
  // fixes a seven-tooth clockwise wheel D, opposed inward pallets A/B, and a
  // rigid annular pendulum C-K suspended above the wheel. Contact timing is an
  // independent reconstruction consistent with those visible constraints.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.018;
  const sourceRasterSuspensionPivot = new THREE.Vector2(260, 51);
  const sourceRasterWheelCenterD = new THREE.Vector2(260, 279);
  const sourceRasterAnnulusCenter = new THREE.Vector2(260, 280);
  const sourceRasterRightPalletA = new THREE.Vector2(329, 278);
  const sourceRasterLeftPalletB = new THREE.Vector2(191, 280);
  const sourceRasterUpperRodC = new THREE.Vector2(260, 104);
  const sourceRasterLowerRodK = new THREE.Vector2(260, 411);
  const sourceRasterDirectionArrow = new THREE.Vector2(286, 243);
  const sourceRasterAnnulusOuterRadius = 124;
  const sourceRasterAnnulusInnerRadius = 102;
  const sourceRasterWheelTipRadius = 91;
  const sourceCountedToothCount = 7;
  const suspensionPivot = new THREE.Vector2(0, 3.78);
  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    suspensionPivot.x + (x - sourceRasterSuspensionPivot.x) * sourceScale,
    suspensionPivot.y
      + (sourceRasterSuspensionPivot.y - y) * sourceScale,
  );
  const wheelCenter = sourcePointToModel(sourceRasterWheelCenterD);
  const pendulumCenterLocal = sourcePointToModel(sourceRasterAnnulusCenter)
    .sub(suspensionPivot);

  const toothCount = sourceCountedToothCount;
  const toothPitch = FULL_TURN / toothCount;
  const halfToothPitch = toothPitch / 2;
  const toothRootRadius = 1.32;
  // The back leaves the point just inside it so the tip stays a clear hook.
  const toothBackRadius = 1.56;
  const frontRootLag = 0.31;
  const toothTipRadius = sourceRasterWheelTipRadius * sourceScale;
  const wheelDepth = 0.38;
  const annulusMajorRadius = (
    sourceRasterAnnulusOuterRadius + sourceRasterAnnulusInnerRadius
  ) * sourceScale / 2;
  const annulusTubeRadius = (
    sourceRasterAnnulusOuterRadius - sourceRasterAnnulusInnerRadius
  ) * sourceScale / 2;
  const annulusInnerRadius = annulusMajorRadius - annulusTubeRadius;
  const pendulumDepth = 0.43;

  const pendulumPeriod = 4;
  const halfBeatDuration = pendulumPeriod / 2;
  const pendulumAmplitude = THREE.MathUtils.degToRad(2.3);
  const landingAmplitudeFraction = 0.48;
  const releaseAmplitudeFraction = 0.08;
  const landingHalfPhase = Math.asin(landingAmplitudeFraction) / Math.PI;
  const releaseHalfPhase = 1
    - Math.asin(releaseAmplitudeFraction) / Math.PI;
  const maximumRecoilAngle = THREE.MathUtils.degToRad(2);
  const contactWheelSlope = maximumRecoilAngle / (
    (1 - landingAmplitudeFraction) * pendulumAmplitude
  );
  const contactAdvancePastLanding = contactWheelSlope
    * (landingAmplitudeFraction - releaseAmplitudeFraction)
    * pendulumAmplitude;
  const freeDropAdvance = halfToothPitch - contactAdvancePastLanding;
  const dropDuration = (
    1 - releaseHalfPhase + landingHalfPhase
  ) * halfBeatDuration;

  const sideForHalfBeat = (halfBeatIndex) => (
    positiveModulo(halfBeatIndex, 2) === 0 ? 1 : -1
  );
  const activeToothIndexForHalfBeat = (halfBeatIndex) => {
    const oscillationIndex = Math.floor(halfBeatIndex / 2);
    return sideForHalfBeat(halfBeatIndex) > 0
      ? positiveModulo(oscillationIndex, toothCount)
      : positiveModulo(4 + oscillationIndex, toothCount);
  };
  const contactReferenceAngleForSide = (side) => (
    side > 0 ? 0 : Math.PI
  );
  // The analytic contact point must use the same angular offset as the
  // pointed vertex authored into each broad ratchet tooth below.
  const toothLeanAngle = toothPitch * 0.37;
  const initialWheelLandingAngle = toothLeanAngle;
  const wheelAngleAtHalfLanding = (halfBeatIndex) => (
    initialWheelLandingAngle - halfBeatIndex * halfToothPitch
  );
  const contactWheelDeltaAtPendulumAngle = (side, angle) => (
    contactWheelSlope * (
      -side * angle
        - landingAmplitudeFraction * pendulumAmplitude
    )
  );
  const contactToothAngleAtPendulumAngle = (side, angle) => (
    contactReferenceAngleForSide(side)
      + contactWheelDeltaAtPendulumAngle(side, angle)
  );
  const contactPointAtPendulumAngle = (side, angle) => {
    const toothAngle = contactToothAngleAtPendulumAngle(side, angle);
    return wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(toothAngle) * toothTipRadius,
      Math.sin(toothAngle) * toothTipRadius,
    ));
  };
  const palletLocalContactPoint = (side, angle) => rotate2(
    contactPointAtPendulumAngle(side, angle).sub(suspensionPivot),
    -angle,
  );
  const palletFacePoints = (side, pointCount = 45) => Array.from(
    { length: pointCount },
    (_, index) => {
      const magnitude = THREE.MathUtils.lerp(
        releaseAmplitudeFraction * pendulumAmplitude,
        pendulumAmplitude,
        index / (pointCount - 1),
      );
      return palletLocalContactPoint(side, -side * magnitude);
    },
  );
  const pendulumCenterAtAngle = (angle) => suspensionPivot.clone().add(
    rotate2(pendulumCenterLocal, angle),
  );
  const annulusWheelClearanceAtAngle = (angle) => (
    annulusInnerRadius - toothTipRadius
      - pendulumCenterAtAngle(angle).distanceTo(wheelCenter)
  );

  const contactReleasePendulumSpeed = -pendulumAmplitude * Math.PI
    * Math.cos(Math.PI * releaseHalfPhase) / halfBeatDuration;
  const contactReleaseWheelSpeed = -contactWheelSlope
    * Math.abs(contactReleasePendulumSpeed);
  const freeDropAngularAcceleration = 2 * (
    -freeDropAdvance - contactReleaseWheelSpeed * dropDuration
  ) / dropDuration ** 2;
  const freeDropLandingWheelSpeed = contactReleaseWheelSpeed
    + freeDropAngularAcceleration * dropDuration;
  const contactLandingPendulumSpeed = pendulumAmplitude * Math.PI
    * Math.cos(Math.PI * landingHalfPhase) / halfBeatDuration;
  const contactLandingWheelSpeed = contactWheelSlope
    * contactLandingPendulumSpeed;
  const landingImpactVelocityChange = contactLandingWheelSpeed
    - freeDropLandingWheelSpeed;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const escapeWheel = new THREE.Group();
  escapeWheel.position.set(wheelCenter.x, wheelCenter.y, 0);
  escapeWheel.userData.axis = Z_AXIS.clone();
  escapeWheel.userData.role =
    'fixed-axis-clockwise-seven-tooth-escape-wheel-D';
  const wheelRotor = new THREE.Group();
  wheelRotor.userData.role =
    'clockwise-stepping-and-recoiling-seven-tooth-rotor';
  escapeWheel.add(wheelRotor);
  const wheelShape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const centerAngle = toothIndex * toothPitch;
    // Brown's points hook forward: the front flank's root trails the tip, so
    // the working faces, which run inward from the tip at full recoil, never
    // cut into the tooth behind it.
    const outlinePoints = [
      new THREE.Vector2(
        Math.cos(centerAngle - toothPitch * frontRootLag) * toothRootRadius,
        Math.sin(centerAngle - toothPitch * frontRootLag) * toothRootRadius,
      ),
      new THREE.Vector2(
        Math.cos(centerAngle - toothPitch * 0.37) * toothTipRadius,
        Math.sin(centerAngle - toothPitch * 0.37) * toothTipRadius,
      ),
      // Brown's teeth are hooked ratchet teeth whose curved backs fall
      // from each point to the next root, not a flat crown with a spike.
      ...Array.from({ length: 16 }, (_, sample) => {
        const along = (sample + 1) / 16;
        const angle = THREE.MathUtils.lerp(
          centerAngle - toothPitch * 0.37,
          centerAngle + toothPitch * 0.49,
          along,
        );
        const radius = toothRootRadius
          + (toothBackRadius - toothRootRadius) * (1 - along) ** 1.35;
        return new THREE.Vector2(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        );
      }),
    ];
    for (const point of outlinePoints) {
      if (toothIndex === 0 && point === outlinePoints[0]) {
        wheelShape.moveTo(point.x, point.y);
      } else {
        wheelShape.lineTo(point.x, point.y);
      }
    }
  }
  wheelShape.closePath();
  const sevenToothDisk = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth, 0.008),
    driverMaterial,
  );
  sevenToothDisk.userData.role =
    'seven-source-counted-broad-ratchet-teeth-E-through-H';
  wheelRotor.add(sevenToothDisk);
  const wheelHub = cylinderAlongZ(0.27, 0.76, darkMaterial, 36);
  wheelHub.userData.role = 'escape-wheel-arbor-D';
  wheelRotor.add(wheelHub);
  const wheelShaft = cylinderAlongZ(0.12, 1.30, darkMaterial, 32);
  wheelShaft.userData.role = 'fixed-seven-tooth-wheel-shaft';
  escapeWheel.add(wheelShaft);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 16, 12),
    indexMaterial,
  );
  wheelIndex.position.set(
    Math.cos(-toothLeanAngle) * 0.82,
    Math.sin(-toothLeanAngle) * 0.82,
    wheelDepth / 2 + 0.08,
  );
  wheelIndex.userData.role = 'white-index-on-seven-tooth-wheel';
  wheelRotor.add(wheelIndex);

  const annularPendulum = new THREE.Group();
  annularPendulum.position.set(
    suspensionPivot.x,
    suspensionPivot.y,
    0.24,
  );
  annularPendulum.userData.axis = Z_AXIS.clone();
  annularPendulum.userData.role =
    'rigid-suspended-annular-pendulum-C-K-with-pallets-A-B';
  const annulus = new THREE.Mesh(
    new THREE.TorusGeometry(
      annulusMajorRadius,
      annulusTubeRadius,
      14,
      88,
    ),
    drivenMaterial,
  );
  annulus.position.set(
    pendulumCenterLocal.x,
    pendulumCenterLocal.y,
    0,
  );
  annulus.userData.role = 'annular-pendulum-frame-around-wheel-D';
  const upperRod = beamBetween(
    new THREE.Vector3(0, -0.08, 0),
    new THREE.Vector3(
      pendulumCenterLocal.x,
      pendulumCenterLocal.y + annulusMajorRadius,
      0,
    ),
    0.18,
    pendulumDepth,
    drivenMaterial,
  );
  upperRod.userData.role = 'upper-pendulum-rod-C';
  const lowerRodEnd = new THREE.Vector3(
    sourcePointToModel(new THREE.Vector2(260, 500)).x
      - suspensionPivot.x,
    sourcePointToModel(new THREE.Vector2(260, 500)).y
      - suspensionPivot.y,
    0,
  );
  const lowerRod = beamBetween(
    new THREE.Vector3(
      pendulumCenterLocal.x,
      pendulumCenterLocal.y - annulusMajorRadius,
      0,
    ),
    lowerRodEnd,
    0.18,
    pendulumDepth,
    drivenMaterial,
  );
  lowerRod.userData.role = 'lower-pendulum-rod-K';
  const rightFacePoints = palletFacePoints(1);
  const leftFacePoints = palletFacePoints(-1);
  const rightPallet = makeProfiledPallet(rightFacePoints, {
    depth: pendulumDepth + 0.05,
    role: 'right-inward-pallet-A-nonconcentric-recoil-face',
    thickness: 0.22,
  });
  const leftPallet = makeProfiledPallet(leftFacePoints, {
    depth: pendulumDepth + 0.05,
    role: 'left-inward-pallet-B-nonconcentric-recoil-face',
    thickness: 0.22,
  });
  const averagePoint = (points) => points.reduce(
    (sum, point) => sum.add(point),
    new THREE.Vector2(),
  ).multiplyScalar(1 / points.length);
  const rightFaceCenter = averagePoint(rightFacePoints);
  const leftFaceCenter = averagePoint(leftFacePoints);
  const rightConnector = beamBetween(
    new THREE.Vector3(
      pendulumCenterLocal.x + annulusInnerRadius,
      pendulumCenterLocal.y,
      -0.01,
    ),
    new THREE.Vector3(
      rightFaceCenter.x + 0.10,
      rightFaceCenter.y,
      -0.01,
    ),
    0.19,
    pendulumDepth * 0.88,
    drivenMaterial,
  );
  rightConnector.userData.role = 'rigid-carrier-to-right-pallet-A';
  const leftConnector = beamBetween(
    new THREE.Vector3(
      pendulumCenterLocal.x - annulusInnerRadius,
      pendulumCenterLocal.y,
      -0.01,
    ),
    new THREE.Vector3(
      leftFaceCenter.x - 0.10,
      leftFaceCenter.y,
      -0.01,
    ),
    0.19,
    pendulumDepth * 0.88,
    drivenMaterial,
  );
  leftConnector.userData.role = 'rigid-carrier-to-left-pallet-B';
  const suspensionHub = cylinderAlongZ(0.22, 0.88, darkMaterial, 34);
  suspensionHub.userData.role = 'fixed-pendulum-suspension-pivot';
  const pendulumIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.09, 0.30),
    indexMaterial,
  );
  pendulumIndex.position.copy(lowerRodEnd).add(new THREE.Vector3(0, 0.35, 0));
  pendulumIndex.userData.role = 'white-index-on-pendulum-rod-K';
  annularPendulum.add(
    annulus,
    upperRod,
    lowerRod,
    rightConnector,
    leftConnector,
    rightPallet,
    leftPallet,
    suspensionHub,
    pendulumIndex,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 18, 14),
    indexMaterial,
  );
  contactMarker.position.z = 0.63;
  contactMarker.userData.role =
    'white-marker-on-active-annular-pendulum-contact';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-support-for-suspension-and-wheel-arbor-D';
  const rearStandard = beamBetween(
    new THREE.Vector3(0, lowerRodEnd.y - 0.70, -0.95),
    new THREE.Vector3(0, suspensionPivot.y + 0.82, -0.95),
    0.21,
    0.24,
    frameMaterial,
  );
  rearStandard.userData.role = 'rear-clock-frame-standard';
  const suspensionBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.075, 10, 42),
    frameMaterial,
  );
  suspensionBearing.position.set(
    suspensionPivot.x,
    suspensionPivot.y,
    -0.62,
  );
  suspensionBearing.userData.role = 'fixed-upper-suspension-bearing';
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.075, 10, 42),
    frameMaterial,
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, -0.62);
  wheelBearing.userData.role = 'fixed-wheel-D-bearing';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.24, 0.82),
    frameMaterial,
  );
  base.position.set(0, lowerRodEnd.y - 0.82, -0.70);
  base.userData.role = 'fixed-annular-escapement-frame-base';
  fixedFrame.add(rearStandard, suspensionBearing, wheelBearing, base);

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 11.5, 2.8),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.y = -0.10;
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-seven-tooth-annular-escapement';

  root.add(
    cameraEnvelope,
    fixedFrame,
    escapeWheel,
    annularPendulum,
    contactMarker,
  );

  const stateAtTime = (time) => {
    const halfBeatCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfBeatCoordinate);
    const halfPhase = halfBeatCoordinate - halfBeatIndex;
    const side = sideForHalfBeat(halfBeatIndex);
    const pendulumAngle = -side * pendulumAmplitude
      * Math.sin(Math.PI * halfPhase);
    const pendulumAngularSpeed = -side * pendulumAmplitude * Math.PI
      * Math.cos(Math.PI * halfPhase) / halfBeatDuration;
    const pendulumAngularAcceleration = side * pendulumAmplitude
      * Math.PI ** 2 * Math.sin(Math.PI * halfPhase)
      / halfBeatDuration ** 2;
    const eventTolerance = 1e-12;
    const contactActive = halfPhase >= landingHalfPhase - eventTolerance
      && halfPhase <= releaseHalfPhase + eventTolerance;
    let wheelAngle;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    let activeHalfBeatIndex = halfBeatIndex;
    let stage;
    let dropProgress = null;
    if (contactActive) {
      wheelAngle = wheelAngleAtHalfLanding(halfBeatIndex)
        + contactWheelDeltaAtPendulumAngle(side, pendulumAngle);
      wheelAngularSpeed = -side * contactWheelSlope
        * pendulumAngularSpeed;
      wheelAngularAcceleration = -side * contactWheelSlope
        * pendulumAngularAcceleration;
      stage = Math.abs(halfPhase - 0.5) <= eventTolerance
        ? side > 0
          ? 'right-pallet-A-maximum-recoil-turnaround'
          : 'left-pallet-B-maximum-recoil-turnaround'
        : halfPhase < 0.5
          ? side > 0
            ? 'right-pallet-A-outbound-recoil'
            : 'left-pallet-B-outbound-recoil'
          : side > 0
            ? 'right-pallet-A-return-impulse'
            : 'left-pallet-B-return-impulse';
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
      const dropStartWheelAngle = wheelAngleAtHalfLanding(
        dropStartHalfBeat,
      ) - contactAdvancePastLanding;
      wheelAngle = dropStartWheelAngle
        + contactReleaseWheelSpeed * elapsedDropTime
        + 0.5 * freeDropAngularAcceleration * elapsedDropTime ** 2;
      wheelAngularSpeed = contactReleaseWheelSpeed
        + freeDropAngularAcceleration * elapsedDropTime;
      wheelAngularAcceleration = freeDropAngularAcceleration;
      activeHalfBeatIndex = dropEndHalfBeat;
      stage = sideForHalfBeat(dropEndHalfBeat) > 0
        ? 'clockwise-free-drop-to-right-pallet-A'
        : 'clockwise-free-drop-to-left-pallet-B';
    }
    const activeSide = contactActive
      ? side
      : sideForHalfBeat(activeHalfBeatIndex);
    const activeToothIndex = activeToothIndexForHalfBeat(
      activeHalfBeatIndex,
    );
    const activeToothAngle = wheelAngle
      + activeToothIndex * toothPitch - toothLeanAngle;
    const activeToothPoint = wheelCenter.clone().add(new THREE.Vector2(
      Math.cos(activeToothAngle) * toothTipRadius,
      Math.sin(activeToothAngle) * toothTipRadius,
    ));
    let contact = null;
    if (contactActive) {
      const expectedPoint = contactPointAtPendulumAngle(
        side,
        pendulumAngle,
      );
      const localPoint = palletLocalContactPoint(side, pendulumAngle);
      const wheelRadiusVector = activeToothPoint.clone().sub(wheelCenter);
      const pendulumRadiusVector = activeToothPoint.clone()
        .sub(suspensionPivot);
      const toothVelocity = crossZ(wheelRadiusVector)
        .multiplyScalar(wheelAngularSpeed);
      const palletMaterialVelocity = crossZ(pendulumRadiusVector)
        .multiplyScalar(pendulumAngularSpeed);
      const toothAngleDerivativeByPendulum = -side
        * contactWheelSlope;
      const faceTangentWorld = crossZ(wheelRadiusVector)
        .multiplyScalar(toothAngleDerivativeByPendulum)
        .sub(crossZ(pendulumRadiusVector));
      const faceTangent = faceTangentWorld.clone().normalize();
      const faceNormal = new THREE.Vector2(
        -faceTangent.y,
        faceTangent.x,
      );
      const relativeVelocity = toothVelocity.clone()
        .sub(palletMaterialVelocity);
      contact = {
        expectedPoint,
        faceNormal,
        faceTangent,
        localPoint,
        normalVelocityError: relativeVelocity.dot(faceNormal),
        palletMaterialVelocity,
        pointError: activeToothPoint.distanceTo(expectedPoint),
        relativeSlipSpeed: relativeVelocity.dot(faceTangent),
        side,
        toothVelocity,
      };
    }
    const cycleIndex = Math.floor(time / pendulumPeriod);
    const cyclePhase = time / pendulumPeriod - cycleIndex;
    return {
      activeHalfBeatIndex,
      activeSide,
      activeToothAngle,
      activeToothIndex,
      activeToothPoint,
      annulusCenter: pendulumCenterAtAngle(pendulumAngle),
      annulusWheelClearance: annulusWheelClearanceAtAngle(pendulumAngle),
      contact,
      contactActive,
      cycleIndex,
      cyclePhase,
      dropProgress,
      halfBeatIndex,
      halfPhase,
      pendulumAngle,
      pendulumAngularAcceleration,
      pendulumAngularSpeed,
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
    oneToothClockwise: pendulumPeriod,
    rightLanding: landingHalfPhase * halfBeatDuration,
    rightMaximumRecoil: halfBeatDuration / 2,
    rightRelease: releaseHalfPhase * halfBeatDuration,
    leftLanding: halfBeatDuration
      + landingHalfPhase * halfBeatDuration,
    leftMaximumRecoil: halfBeatDuration * 1.5,
    leftRelease: halfBeatDuration
      + releaseHalfPhase * halfBeatDuration,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    annularPendulum.rotation.z = state.pendulumAngle;
    annularPendulum.userData.angularAcceleration =
      state.pendulumAngularAcceleration;
    annularPendulum.userData.angularSpeed = state.pendulumAngularSpeed;
    wheelRotor.rotation.z = state.wheelAngle;
    wheelRotor.userData.angularAcceleration =
      state.wheelAngularAcceleration;
    wheelRotor.userData.angularSpeed = state.wheelAngularSpeed;
    contactMarker.visible = state.contactActive;
    if (state.contactActive) {
      contactMarker.position.set(
        state.activeToothPoint.x,
        state.activeToothPoint.y,
        0.64,
      );
    }
    root.userData.contacts = state.contactActive
      ? {
        activePallet: state.activeSide > 0 ? 'right-A' : 'left-B',
        activeToothIndex: state.activeToothIndex,
        normalVelocityError: state.contact.normalVelocityError,
        pointError: state.contact.pointError,
        relativeSlipSpeed: state.contact.relativeSlipSpeed,
      }
      : {
        activePallet: null,
        activeToothIndex: state.activeToothIndex,
        dropProgress: state.dropProgress,
        normalVelocityError: null,
        pointError: null,
        relativeSlipSpeed: null,
      };
    root.userData.kinematics = state;
  };

  const radiusRange = (points) => {
    const radii = points.map((point) => point.length());
    return Math.max(...radii) - Math.min(...radii);
  };
  root.userData.archetype =
    'seven-tooth-clockwise-annular-pendulum-recoil-escapement';
  root.userData.mechanism =
    'a rigid annular pendulum C-K swings about its upper suspension around fixed-arbor seven-tooth wheel D; opposed inward pallets A and B alternately engage diametrically opposite sides, recoil the wheel on the outbound swing, return clockwise while giving impulse, and release it for a half-pitch drop';
  root.userData.transmission = {
    direction: 'seven-tooth escape wheel D advances clockwise',
    halfBeatAdvance: -halfToothPitch,
    impulse: 'the returning annular pendulum and tooth remain in sliding contact before release',
    oscillationAdvance: -toothPitch,
    recoil: 'wheel speed becomes counterclockwise during each outbound contact',
    toothCount,
  };
  root.userData.blocks = {
    annularPendulum,
    annulus,
    base,
    cameraEnvelope,
    contactMarker,
    escapeWheel,
    fixedFrame,
    leftConnector,
    leftPallet,
    lowerRod,
    pendulumIndex,
    rearStandard,
    rightConnector,
    rightPallet,
    sevenToothDisk,
    suspensionBearing,
    suspensionHub,
    upperRod,
    wheelBearing,
    wheelHub,
    wheelIndex,
    wheelRotor,
    wheelShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contactPointAtPendulumAngle =
    contactPointAtPendulumAngle;
  root.userData.geometry = {
    annulusInnerRadius,
    annulusMajorRadius,
    annulusTubeRadius,
    contactAdvancePastLanding,
    contactLandingWheelSpeed,
    contactReleaseWheelSpeed,
    contactWheelSlope,
    dropDuration,
    eventPeriod: pendulumPeriod,
    freeDropAdvance,
    freeDropAngularAcceleration,
    freeDropLandingWheelSpeed,
    halfBeatDuration,
    halfToothPitch,
    landingAmplitudeFraction,
    landingHalfPhase,
    landingImpactVelocityChange,
    maximumRecoilAngle,
    pendulumAmplitude,
    pendulumCenterLocal: pendulumCenterLocal.clone(),
    pendulumDepth,
    pendulumPeriod,
    releaseAmplitudeFraction,
    releaseHalfPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    suspensionPivot: suspensionPivot.clone(),
    toothCount,
    toothBackRadius,
    toothLeanAngle,
    toothProfileTipOffset: -toothPitch * 0.37,
    toothPitch,
    toothRootRadius,
    toothTipRadius,
    wheelCenter: wheelCenter.clone(),
    wheelDepth,
  };
  root.userData.annulusWheelClearanceAtAngle =
    annulusWheelClearanceAtAngle;
  root.userData.palletFacePoints = palletFacePoints;
  root.userData.palletLocalContactPoint = palletLocalContactPoint;
  root.userData.palletProfiles = {
    leftB: {
      concentricRadiusRange: radiusRange(leftFacePoints),
      points: leftFacePoints,
      side: -1,
      sourceLabel: 'B',
    },
    rightA: {
      concentricRadiusRange: radiusRange(rightFacePoints),
      points: rightFacePoints,
      side: 1,
      sourceLabel: 'A',
    },
  };
  root.userData.pendulumCenterAtAngle = pendulumCenterAtAngle;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'The official page provides only Brown’s static plate and one-sentence caption, with its Animated tab unavailable. The seven-tooth count, clockwise direction, fixed wheel arbor, suspended C-K annulus, and opposed A/B pallets are plate-observed; contact and drop timing are independently reconstructed.',
    sourceUrl: 'https://507movements.com/mm_290.html',
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate290: {
      countedToothCount: sourceCountedToothCount,
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'seven broad ratchet teeth rotate clockwise about fixed arbor D inside an annular pendulum C-K suspended above; opposed inward pallets A and B are rigid with the annulus',
      measurementUncertaintyPixels: 7,
      rasterAnnulusCenter: sourceRasterAnnulusCenter.clone(),
      rasterAnnulusInnerRadius: sourceRasterAnnulusInnerRadius,
      rasterAnnulusOuterRadius: sourceRasterAnnulusOuterRadius,
      rasterDirectionArrow: sourceRasterDirectionArrow.clone(),
      rasterLeftPalletB: sourceRasterLeftPalletB.clone(),
      rasterLowerRodK: sourceRasterLowerRodK.clone(),
      rasterRightPalletA: sourceRasterRightPalletA.clone(),
      rasterSuspensionPivot: sourceRasterSuspensionPivot.clone(),
      rasterUpperRodC: sourceRasterUpperRodC.clone(),
      rasterWheelCenterD: sourceRasterWheelCenterD.clone(),
      rasterWheelTipRadius: sourceRasterWheelTipRadius,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 77,
      edition: 21,
      illustrationPage: 76,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: pendulumPeriod,
    schedule: [
      'right-A-landing-and-recoil',
      'right-A-return-impulse-and-release',
      'clockwise-drop-to-left-B',
      'left-B-landing-and-recoil',
      'left-B-return-impulse-and-release',
      'clockwise-drop-to-right-A',
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
    pendulumIndex,
    wheelIndex,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  root.userData.fidelity = 'authored';
  correctAnnularStudEscapement(root, 290, update);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredAnnularEscapementMovement(movement) {
  if (movement.id !== 290) return null;
  return annularPendulumEscapement(movement);
}
