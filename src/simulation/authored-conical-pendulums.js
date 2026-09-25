import { correctConicalJournals } from './pendulum-journal-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const DOWN = new THREE.Vector3(0, -1, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongY(radius, length, material, segments = 36) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function torusAroundY(majorRadius, tubeRadius, material, segments = 64) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 10, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function conicalPendulum(movement) {
  const root = new THREE.Group();

  // Brown's perspective plate is not a dimensioned orthographic drawing.
  // Its suspension point and spindle centerline differ by only seven pixels,
  // so the working model idealizes them as the same vertical axis. That is
  // the necessary geometry for the crank wrist to carry the lower end of a
  // fixed-length pendulum around a true right circular cone.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterTopHangerCenter = new THREE.Vector2(261, 31);
  const sourceRasterTopSuspension = new THREE.Vector2(263, 56);
  const sourceRasterRigidRodStart = new THREE.Vector2(269, 82);
  const sourceRasterBobCenter = new THREE.Vector2(326, 310);
  const sourceRasterBobAxialExtent = 67;
  const sourceRasterBobHalfWidth = 26;
  const sourceRasterLowerJoint = new THREE.Vector2(344, 378);
  const sourceRasterSpindleAxisAtArm = new THREE.Vector2(256, 393);
  const sourceRasterArmOuterTip = new THREE.Vector2(376, 367);
  const sourceRasterUpperBearingCenter = new THREE.Vector2(256, 421);
  const sourceRasterDriveCollarCenter = new THREE.Vector2(258, 461);
  const sourceRasterFootCenter = new THREE.Vector2(258, 505);

  const topAnchor = new THREE.Vector3(0, 4.70, 0);
  const crankPlaneY = -3.10;
  const verticalDrop = topAnchor.y - crankPlaneY;
  const sourceScale = verticalDrop / (
    sourceRasterLowerJoint.y - sourceRasterTopSuspension.y
  );
  const crankRadius = (
    sourceRasterLowerJoint.x - sourceRasterSpindleAxisAtArm.x
  ) * sourceScale;
  const rodLength = Math.hypot(verticalDrop, crankRadius);
  const coneHalfAngle = Math.atan2(crankRadius, verticalDrop);
  const bobDistanceFromTop = rodLength * (
    sourceRasterBobCenter.y - sourceRasterTopSuspension.y
  ) / (
    sourceRasterLowerJoint.y - sourceRasterTopSuspension.y
  );
  const flexureLength = (
    sourceRasterRigidRodStart.y - sourceRasterTopSuspension.y
  ) * sourceScale / Math.cos(coneHalfAngle);
  const bobLength = sourceRasterBobAxialExtent * sourceScale
    / Math.cos(coneHalfAngle);
  const bobRadius = sourceRasterBobHalfWidth * sourceScale;
  const lowerPinProjection = 0.38;

  const cyclePeriod = 4;
  const spindleAngularSpeed = FULL_TURN / cyclePeriod;
  const sourcePhaseAngle = 0;
  const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
    Z_AXIS,
    coneHalfAngle,
  );

  const stateAtTime = (time) => {
    const unwrappedSpindleAngle = sourcePhaseAngle
      + spindleAngularSpeed * time;
    const spindleAngle = positiveModulo(unwrappedSpindleAngle, FULL_TURN);
    const cosine = Math.cos(spindleAngle);
    const sine = Math.sin(spindleAngle);
    const wristCenter = new THREE.Vector3(
      crankRadius * cosine,
      crankPlaneY,
      -crankRadius * sine,
    );
    const wristVelocity = new THREE.Vector3(
      -crankRadius * spindleAngularSpeed * sine,
      0,
      -crankRadius * spindleAngularSpeed * cosine,
    );
    const wristAcceleration = new THREE.Vector3(
      -crankRadius * spindleAngularSpeed ** 2 * cosine,
      0,
      crankRadius * spindleAngularSpeed ** 2 * sine,
    );
    const pendulumDirection = wristCenter.clone().sub(topAnchor)
      .multiplyScalar(1 / rodLength);
    const pendulumDirectionVelocity = wristVelocity.clone()
      .multiplyScalar(1 / rodLength);
    const pendulumDirectionAcceleration = wristAcceleration.clone()
      .multiplyScalar(1 / rodLength);
    const spinQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Y_AXIS,
      spindleAngle,
    );
    const pendulumQuaternion = spinQuaternion.multiply(tiltQuaternion);
    const quaternionDirection = DOWN.clone().applyQuaternion(
      pendulumQuaternion,
    );
    const bobCenter = topAnchor.clone().addScaledVector(
      pendulumDirection,
      bobDistanceFromTop,
    );
    const bobVelocity = wristVelocity.clone().multiplyScalar(
      bobDistanceFromTop / rodLength,
    );
    const bobAcceleration = wristAcceleration.clone().multiplyScalar(
      bobDistanceFromTop / rodLength,
    );
    const flexureEnd = topAnchor.clone().addScaledVector(
      pendulumDirection,
      flexureLength,
    );
    const crankWristCenter = wristCenter.clone();
    const pendulumLowerJoint = topAnchor.clone().addScaledVector(
      pendulumDirection,
      rodLength,
    );
    const lowerJointError = crankWristCenter.distanceTo(
      pendulumLowerJoint,
    );

    return {
      bobAcceleration,
      bobCenter,
      bobVelocity,
      crankWristCenter,
      cycleIndex: Math.floor(
        (unwrappedSpindleAngle - sourcePhaseAngle) / FULL_TURN,
      ),
      cyclePhase: spindleAngle / FULL_TURN,
      flexureEnd,
      horizontalRadius: Math.hypot(wristCenter.x, wristCenter.z),
      lowerJointContact: {
        crankPoint: crankWristCenter.clone(),
        mode: 'crank-wrist-carries-pendulum-lower-end-without-slip',
        pendulumPoint: pendulumLowerJoint.clone(),
        pointError: lowerJointError,
      },
      lowerJointError,
      pendulumDirection,
      pendulumDirectionAcceleration,
      pendulumDirectionVelocity,
      pendulumLowerJoint,
      pendulumQuaternion,
      quaternionDirection,
      rodLength: pendulumLowerJoint.distanceTo(topAnchor),
      spindleAngle,
      spindleAngularAcceleration: 0,
      spindleAngularSpeed,
      unwrappedSpindleAngle,
      verticalDrop: topAnchor.y - wristCenter.y,
      wristAcceleration,
      wristCenter,
      wristVelocity,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.65,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.70,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.48,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.54,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-upper-suspension-and-lower-spindle-bearings';

  const hangerPlate = new THREE.Mesh(
    new THREE.BoxGeometry(2.30, 0.28, 1.36),
    frameMaterial,
  );
  hangerPlate.position.set(0, 5.08, 0);
  hangerPlate.userData.role = 'fixed-ceiling-hanger-plate';
  const hangerBoss = cylinderAlongY(0.30, 0.52, darkMaterial, 40);
  hangerBoss.position.set(0, 4.85, 0);
  hangerBoss.userData.role = 'fixed-flexure-suspension-boss';
  const hangerSocket = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 30, 20),
    darkMaterial,
  );
  hangerSocket.position.copy(topAnchor);
  hangerSocket.userData.role = 'fixed-top-flexure-point';
  const hangerBolts = [-0.80, 0.80].map((x) => {
    const bolt = cylinderAlongY(0.095, 0.42, darkMaterial, 24);
    bolt.position.set(x, 4.91, 0);
    bolt.userData.role = 'fixed-hanger-fastener';
    return bolt;
  });

  const bearingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 0.30, 1.72),
    frameMaterial,
  );
  bearingPlate.position.set(0, -3.88, 0);
  bearingPlate.userData.role = 'fixed-upper-spindle-bearing-bridge';
  const upperBearing = cylinderAlongY(0.48, 0.50, darkMaterial, 44);
  upperBearing.position.set(0, -3.79, 0);
  upperBearing.userData.role = 'fixed-upper-spindle-bearing';
  const lowerBearing = cylinderAlongY(0.43, 0.66, darkMaterial, 44);
  lowerBearing.position.set(0, -4.90, 0);
  lowerBearing.userData.role = 'fixed-lower-spindle-bearing';
  const bearingPosts = [-1.28, 1.28].map((x) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.58, 0.42),
      frameMaterial,
    );
    post.position.set(x, -4.52, 0);
    post.userData.role = 'fixed-bearing-bridge-post';
    return post;
  });
  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.32, 2.08),
    frameMaterial,
  );
  foot.position.set(0, -5.48, 0);
  foot.userData.role = 'fixed-spindle-foot';
  fixedFrame.add(
    hangerPlate,
    hangerBoss,
    hangerSocket,
    ...hangerBolts,
    bearingPlate,
    upperBearing,
    lowerBearing,
    ...bearingPosts,
    foot,
  );

  const spindleRotor = new THREE.Group();
  spindleRotor.position.set(0, crankPlaneY, 0);
  spindleRotor.userData.axis = Y_AXIS.clone();
  spindleRotor.userData.role = 'vertical-driving-spindle-and-crank-rotor';

  const spindle = cylinderAlongY(0.16, 2.36, driverMaterial, 40);
  spindle.position.y = -1.12;
  spindle.userData.role = 'vertical-rotating-driving-spindle';
  const crankHub = cylinderAlongY(0.40, 0.42, darkMaterial, 40);
  crankHub.userData.role = 'rotating-crank-hub';
  const crankArm = makeBeam(
    new THREE.Vector3(-0.62, 0, 0),
    new THREE.Vector3(crankRadius, 0, 0),
    {
      color: PALETTE.driver,
      depth: 0.30,
      thickness: 0.22,
    },
  );
  crankArm.userData.role = 'single-horizontal-radius-crank-arm';
  const armIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.25, 0.33),
    whiteMaterial,
  );
  armIndex.position.set(crankRadius * 0.48, 0.015, 0);
  armIndex.userData.role = 'white-crank-rotation-index';
  const wristPin = cylinderAlongY(0.17, 0.72, darkMaterial, 32);
  wristPin.position.set(crankRadius, 0, 0);
  wristPin.userData.role = 'crank-wrist-pin-at-fixed-radius';
  const jointMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.225, 28, 18),
    whiteMaterial,
  );
  jointMarker.position.set(crankRadius, 0, 0);
  jointMarker.userData.role = 'white-coincident-lower-joint-marker';
  const driveCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.50, 0.52, 40),
    brassMaterial,
  );
  driveCollar.position.y = -1.43;
  driveCollar.userData.role = 'rotating-conical-drive-collar';
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.56, 0.055),
    whiteMaterial,
  );
  shaftIndex.position.set(0.17, -0.76, 0);
  shaftIndex.userData.role = 'white-spindle-rotation-index';
  spindleRotor.add(
    spindle,
    crankHub,
    crankArm,
    armIndex,
    wristPin,
    jointMarker,
    driveCollar,
    shaftIndex,
  );

  const pendulumCarrier = new THREE.Group();
  pendulumCarrier.position.copy(topAnchor);
  pendulumCarrier.userData.axis = Y_AXIS.clone();
  pendulumCarrier.userData.role = 'constant-angle-conical-pendulum-carrier';

  const flexureWire = cylinderAlongY(0.048, flexureLength, darkMaterial, 20);
  flexureWire.position.y = -flexureLength / 2;
  flexureWire.userData.role = 'thin-round-flexure-suspension-wire';
  const rigidRodLength = rodLength - flexureLength + lowerPinProjection;
  const rigidRod = cylinderAlongY(0.085, rigidRodLength, drivenMaterial, 28);
  rigidRod.position.y = -flexureLength - rigidRodLength / 2;
  rigidRod.userData.role = 'rigid-pendulum-rod-describing-cone';
  const bob = cylinderAlongY(bobRadius, bobLength, drivenMaterial, 48);
  bob.position.y = -bobDistanceFromTop;
  bob.userData.role = 'cylindrical-conical-pendulum-bob';
  const bobIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, bobLength * 0.66, 0.045),
    whiteMaterial,
  );
  bobIndex.position.set(0, -bobDistanceFromTop, bobRadius * 0.99);
  bobIndex.userData.role = 'white-pendulum-orientation-index';
  const lowerSocket = new THREE.Mesh(
    new THREE.SphereGeometry(0.285, 30, 20),
    drivenMaterial,
  );
  lowerSocket.position.y = -rodLength;
  lowerSocket.userData.role = 'pendulum-lower-end-crank-socket';
  const lowerPinTail = cylinderAlongY(
    0.075,
    lowerPinProjection,
    darkMaterial,
    24,
  );
  lowerPinTail.position.y = -rodLength - lowerPinProjection / 2;
  lowerPinTail.userData.role = 'pendulum-pin-projection-below-crank-arm';
  pendulumCarrier.add(
    flexureWire,
    rigidRod,
    bob,
    bobIndex,
    lowerSocket,
    lowerPinTail,
  );

  const wristOrbit = torusAroundY(
    crankRadius,
    0.018,
    matte(PALETTE.muted, {
      opacity: 0.32,
      roughness: 1,
      transparent: true,
    }),
    96,
  );
  wristOrbit.position.y = crankPlaneY;
  wristOrbit.userData.nonPhysicalReference = true;
  wristOrbit.userData.role = 'nonphysical-wrist-orbit-reference-circle';

  root.add(fixedFrame, spindleRotor, pendulumCarrier, wristOrbit);

  const update = (time) => {
    const state = stateAtTime(time);
    spindleRotor.rotation.y = state.spindleAngle;
    pendulumCarrier.quaternion.copy(state.pendulumQuaternion);
    root.userData.contacts = {
      lowerJoint: state.lowerJointContact,
    };
    root.userData.renderState = state;
  };

  const sourcePlatePointToIdealFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterSpindleAxisAtArm.x) * sourceScale,
    topAnchor.y - (
      point.y - sourceRasterTopSuspension.y
    ) * sourceScale,
    0,
  );

  root.userData.archetype =
    'vertical-spindle-crank-driven-constant-angle-conical-pendulum';
  root.userData.blocks = {
    armIndex,
    bearingPlate,
    bob,
    bobIndex,
    crankArm,
    crankHub,
    driveCollar,
    fixedFrame,
    flexureWire,
    foot,
    hangerBoss,
    hangerPlate,
    hangerSocket,
    jointMarker,
    lowerPinTail,
    lowerSocket,
    pendulumCarrier,
    rigidRod,
    shaftIndex,
    spindle,
    spindleRotor,
    wristOrbit,
    wristPin,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.20, -5.92, -3.00),
    new THREE.Vector3(3.20, 5.76, 3.00),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    front: cyclePeriod * 0.75,
    left: cyclePeriod * 0.50,
    rear: cyclePeriod * 0.25,
    sourcePose: 0,
  };
  root.userData.constraints = {
    constantConeHalfAngle: coneHalfAngle,
    constantRodLength: rodLength,
    fixedHorizontalCrankRadius: crankRadius,
    fixedTopSuspension: topAnchor.clone(),
    lowerJointCoincidentForAllTime: true,
    spindleAxisCollinearWithConeAxis: true,
  };
  root.userData.geometry = {
    bobDistanceFromTop,
    bobLength,
    bobRadius,
    coneHalfAngle,
    crankPlaneY,
    crankRadius,
    cyclePeriod,
    flexureLength,
    lowerPinProjection,
    rodLength,
    sourceImageHeight,
    sourceImageWidth,
    sourcePhaseAngle,
    sourceScale,
    spindleAngularSpeed,
    topAnchor: topAnchor.clone(),
    verticalDrop,
  };
  root.userData.groundFloorY = -5.68;
  root.userData.mechanism =
    'a single horizontal crank on a vertical spindle carries the lower end of a fixed-length pendulum around a circle while a thin round top wire flexes, so the rod describes one constant-angle cone per spindle turn';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the fixed top hanger, thin round suspension wire, long rod and cylindrical bob, lower-end crank connection, vertical spindle, bearing bridge, and drive collar. The static perspective plate does not dimension depth or operating speed.',
    sourceUrl: 'https://507movements.com/mm_315.html',
  };
  root.userData.sourcePlatePointToIdealFront =
    sourcePlatePointToIdealFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate315: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one fixed top flexure, one rigid pendulum rod and bob, one lower crank wrist, one horizontal radius arm, and one coaxial vertical driving spindle',
      measurementUncertaintyPixels: 10,
      perspectiveIdealization: 'the seven-pixel top-hanger/spindle offset and the projected slope of the horizontal crank arm are treated as perspective distortion; the working cone axis is exactly vertical',
      rasterArmOuterTip: sourceRasterArmOuterTip.clone(),
      rasterBobAxialExtent: sourceRasterBobAxialExtent,
      rasterBobCenter: sourceRasterBobCenter.clone(),
      rasterBobHalfWidth: sourceRasterBobHalfWidth,
      rasterDriveCollarCenter: sourceRasterDriveCollarCenter.clone(),
      rasterFootCenter: sourceRasterFootCenter.clone(),
      rasterLowerJoint: sourceRasterLowerJoint.clone(),
      rasterRigidRodStart: sourceRasterRigidRodStart.clone(),
      rasterSpindleAxisAtArm: sourceRasterSpindleAxisAtArm.clone(),
      rasterTopHangerCenter: sourceRasterTopHangerCenter.clone(),
      rasterTopSuspension: sourceRasterTopSuspension.clone(),
      rasterUpperBearingCenter: sourceRasterUpperBearingCenter.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: cyclePeriod,
    schedule: [
      'vertical-spindle-turns-uniformly',
      'single-radius-arm-carries-lower-wrist-on-horizontal-circle',
      'fixed-length-pendulum-maintains-constant-cone-angle',
      'thin-round-top-wire-flexes-about-fixed-suspension',
      'pendulum-and-spindle-complete-one-revolution-together',
    ],
  };
  root.userData.transmission = {
    angularVelocityRatio: 1,
    crankWristOrbitRadius: crankRadius,
    direction: 'pendulum azimuth follows the vertical spindle one-to-one',
    input: 'uniformly rotating vertical spindle',
    lowerConnection: 'coincident crank wrist and pendulum lower-end socket',
    output: 'constant-angle conical revolution of pendulum rod and bob',
    pendulumRevolutionsPerSpindleTurn: 1,
    spindleTurnsPerPendulumRevolution: 1,
  };

  correctConicalJournals(root);
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
  wristOrbit.castShadow = false;
  wristOrbit.receiveShadow = false;
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(1.5, 1, 16),
    root,
    update,
  };
}

export function createAuthoredConicalPendulumMovement(movement) {
  if (movement.id !== 315) return null;
  return conicalPendulum(movement);
}
