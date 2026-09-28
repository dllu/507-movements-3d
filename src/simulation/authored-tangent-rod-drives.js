import * as THREE from 'three';
import { fitPistonGuide, boredJournal } from './piston-guide-parts.js';
import { capsule, circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function wrappedAngle(angle) {
  const turns = angle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-11) return 0;
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function crankTangentOscillatingRod(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.88);

  const crankCenter = new THREE.Vector2(2.6, 0);
  const guideCenter = new THREE.Vector2(-2.6, 0);
  const centerSeparation = crankCenter.distanceTo(guideCenter);
  const crankDiskRadius = 1;
  const crankRadius = 0.75;
  const crankDiskDepth = 0.28;
  const guideRollerRadius = 0.48;
  const guideRollerDepth = 0.3;
  const rodHalfWidth = 0.105;
  const effectiveGuideRadius = guideRollerRadius + rodHalfWidth;
  const rodLength = 7;
  const rodDepth = 0.2;
  const rodPlaneZ = 0.32;
  const sourceCrankAngle = THREE.MathUtils.degToRad(72);
  const demonstrationPeriod = 6;
  const inputAngularSpeed = FULL_TURN / demonstrationPeriod;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.57,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.6,
  });
  const guideMaterial = matte(PALETTE.accent, {
    metalness: 0.13,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.4 });

  const crankRotor = new THREE.Group();
  crankRotor.position.set(crankCenter.x, crankCenter.y, 0);
  crankRotor.userData.axis = new THREE.Vector3(0, 0, 1);
  crankRotor.userData.role = 'uniformly-rotating-input-crank-and-disk';
  const crankDisk = cylinderAlongZ(
    crankDiskRadius,
    crankDiskDepth,
    driverMaterial,
    64,
  );
  crankDisk.userData.role = 'source-proportioned-input-crank-disk';
  const crankShaft = cylinderAlongZ(0.2, 0.65, darkMaterial, 36);
  crankShaft.position.z = -0.135;
  crankShaft.userData.role = 'fixed-axis-input-crankshaft';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.18, 0.10),
    darkMaterial,
  );
  crankArm.position.set(crankRadius / 2, 0, 0.14);
  crankArm.userData.role = 'rigid-input-crank-arm';
  const crankPin = cylinderAlongZ(0.15, 0.48, darkMaterial, 32);
  crankPin.position.set(crankRadius, 0, 0.3);
  crankPin.userData.role = 'moving-crank-pin-hinged-to-rod';
  const crankPinCap = cylinderAlongZ(0.075, 0.025, whiteMaterial, 24);
  crankPinCap.position.set(crankRadius, 0, 0.555);
  crankPinCap.userData.role = 'white-crank-pin-rotation-index';
  const crankFaceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.065, 0.04),
    whiteMaterial,
  );
  crankFaceIndex.position.set(0.37, -0.28, crankDiskDepth / 2 + 0.035);
  crankFaceIndex.rotation.z = -0.32;
  crankFaceIndex.userData.role = 'white-input-disk-face-index';
  crankRotor.add(
    crankDisk,
    crankShaft,
    crankArm,
    crankPin,
    crankPinCap,
    crankFaceIndex,
  );

  const guideAssembly = new THREE.Group();
  guideAssembly.position.set(guideCenter.x, guideCenter.y, rodPlaneZ);
  guideAssembly.userData.role = 'fixed-center-guide-roller-bearing';
  const guideRotor = new THREE.Group();
  guideRotor.userData.axis = new THREE.Vector3(0, 0, 1);
  guideRotor.userData.role = 'passive-no-slip-guide-roller';
  const guideRoller = boredJournal(guideRollerRadius, 0.136,
    guideRollerDepth, guideMaterial);
  guideRoller.userData.role = 'fixed-center-rod-support-roller';
  const guideTread = new THREE.Mesh(
    new THREE.TorusGeometry(guideRollerRadius - 0.035, 0.035, 9, 64),
    darkMaterial,
  );
  guideTread.position.z = guideRollerDepth / 2 + 0.01;
  guideTread.userData.role = 'guide-roller-working-tread';
  // A dark face ring only outlined the roller edge; retired.
  guideTread.visible = false;
  guideTread.userData.retiredInkOutline = true;
  const guideIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.06, 0.045),
    whiteMaterial,
  );
  guideIndex.position.set(0.27, 0, guideRollerDepth / 2 + 0.045);
  guideIndex.userData.role = 'white-guide-roller-spin-index';
  guideRotor.add(guideRoller, guideTread, guideIndex);
  const guideAxle = cylinderAlongZ(0.13, 0.62, darkMaterial, 30);
  guideAxle.position.z = 0.02;
  guideAxle.userData.role = 'stationary-guide-roller-axle';
  const guideBearingFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.62, 0.34),
    frameMaterial,
  );
  guideBearingFoot.position.set(0, -0.78, -0.08);
  guideBearingFoot.userData.role = 'fixed-guide-roller-bearing-standard';
  guideAssembly.add(guideRotor, guideAxle, guideBearingFoot);

  const rod = new THREE.Group();
  rod.position.z = rodPlaneZ;
  rod.userData.role =
    'rigid-oscillating-rod-sliding-reciprocally-over-fixed-guide-roller';
  const rodBody = new THREE.Mesh(
    plate(clip.difference(clip.union(capsule([-rodLength, 0], [0, 0], rodHalfWidth, 32),
      poly(circle([0, 0], 0.215, 64))), poly(circle([0, 0], 0.156, 64))), -rodDepth / 2, rodDepth / 2),
    drivenMaterial,
  );

  // One extrusion: the body owns the crank-pin eye (r 0.215, bore 0.156) and
  // the straight lower working face. The separate dark eye journal and
  // lower-face strip shared the body's rim, bore and lower face and z-fought
  // (p88), so they are gone; Brown draws neither as a separate part.
  rodBody.userData.role = 'constant-length-tangent-oscillating-rod-body';
  rodBody.userData.includes = ['rod-eye-on-moving-crank-pin',
    'straight-lower-face-tangent-to-guide-roller'];
  const rodLeftEnd = cylinderAlongZ(
    rodHalfWidth,
    rodDepth,
    drivenMaterial,
    28,
  );
  rodLeftEnd.position.x = -rodLength;
  rodLeftEnd.userData.role = 'free-reciprocating-rod-end';
  const rodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.05, 0.045),
    whiteMaterial,
  );
  rodIndex.position.set(-rodLength + 0.5, 0, rodDepth / 2 + 0.045);
  rodIndex.userData.role = 'white-rigid-rod-reciprocation-index';
  rod.add(rodBody, rodLeftEnd, rodIndex);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    whiteMaterial,
  );
  contactMarker.position.z = rodPlaneZ + rodDepth / 2 + 0.07;
  contactMarker.userData.role = 'exact-moving-rod-guide-roller-contact';

  root.add(crankRotor, guideAssembly, rod, contactMarker);

  const tangentGeometryAtCrankAngle = (crankAngle) => {
    const crankPinPosition = crankCenter.clone().add(new THREE.Vector2(
      crankRadius * Math.cos(crankAngle),
      crankRadius * Math.sin(crankAngle),
    ));
    const guideToPin = crankPinPosition.clone().sub(guideCenter);
    const guideToPinDistance = guideToPin.length();
    const guideToPinAngle = Math.atan2(guideToPin.y, guideToPin.x);
    const tangentOffsetAngle = Math.asin(
      effectiveGuideRadius / guideToPinDistance,
    );
    const rodAngle = guideToPinAngle - tangentOffsetAngle;
    const rodAxis = new THREE.Vector2(
      Math.cos(rodAngle),
      Math.sin(rodAngle),
    );
    const rodNormal = new THREE.Vector2(-rodAxis.y, rodAxis.x);
    const tangentLength = Math.sqrt(
      guideToPinDistance ** 2 - effectiveGuideRadius ** 2,
    );
    const centerlineTangentPoint = guideCenter.clone().addScaledVector(
      rodNormal,
      effectiveGuideRadius,
    );
    const physicalContactPoint = guideCenter.clone().addScaledVector(
      rodNormal,
      guideRollerRadius,
    );
    return {
      centerlineTangentPoint,
      crankPinPosition,
      guideToPin,
      guideToPinAngle,
      guideToPinDistance,
      physicalContactPoint,
      rodAngle,
      rodAxis,
      rodNormal,
      tangentLength,
      tangentOffsetAngle,
    };
  };

  const sourceGeometry = tangentGeometryAtCrankAngle(sourceCrankAngle);

  const configurationAtCrankAngle = (
    crankAngle,
    crankAngularSpeed = inputAngularSpeed,
    crankAngularAcceleration = 0,
  ) => {
    const geometryState = tangentGeometryAtCrankAngle(crankAngle);
    const {
      crankPinPosition,
      guideToPin,
      guideToPinDistance,
      physicalContactPoint,
      rodAngle,
      rodAxis,
      rodNormal,
      tangentLength,
    } = geometryState;
    const cosine = Math.cos(crankAngle);
    const sine = Math.sin(crankAngle);
    const crankTangent = new THREE.Vector2(-sine, cosine);
    const crankRadial = new THREE.Vector2(cosine, sine);
    const crankPinVelocity = crankTangent.clone().multiplyScalar(
      crankRadius * crankAngularSpeed,
    );
    const crankPinAcceleration = crankTangent.clone().multiplyScalar(
      crankRadius * crankAngularAcceleration,
    ).addScaledVector(
      crankRadial,
      -crankRadius * crankAngularSpeed ** 2,
    );
    const distanceVelocity = guideToPin.dot(crankPinVelocity)
      / guideToPinDistance;
    const distanceAcceleration = (
      crankPinVelocity.lengthSq()
        + guideToPin.dot(crankPinAcceleration)
        - distanceVelocity ** 2
    ) / guideToPinDistance;
    const angleVelocityNumerator = cross2(
      guideToPin,
      crankPinVelocity,
    );
    const guideToPinAngleVelocity = angleVelocityNumerator
      / guideToPinDistance ** 2;
    const guideToPinAngleAcceleration = (
      cross2(guideToPin, crankPinAcceleration)
        / guideToPinDistance ** 2
      - 2 * angleVelocityNumerator
        * guideToPin.dot(crankPinVelocity)
        / guideToPinDistance ** 4
    );
    const tangentRatio = effectiveGuideRadius / guideToPinDistance;
    const tangentRatioVelocity = -effectiveGuideRadius
      * distanceVelocity / guideToPinDistance ** 2;
    const tangentRatioAcceleration = -effectiveGuideRadius
      * distanceAcceleration / guideToPinDistance ** 2
      + 2 * effectiveGuideRadius * distanceVelocity ** 2
        / guideToPinDistance ** 3;
    const tangentRoot = Math.sqrt(1 - tangentRatio ** 2);
    const tangentOffsetAngleVelocity = tangentRatioVelocity / tangentRoot;
    const tangentOffsetAngleAcceleration = tangentRatioAcceleration
      / tangentRoot
      + tangentRatio * tangentRatioVelocity ** 2 / tangentRoot ** 3;
    const rodAngularSpeed = guideToPinAngleVelocity
      - tangentOffsetAngleVelocity;
    const rodAngularAcceleration = guideToPinAngleAcceleration
      - tangentOffsetAngleAcceleration;
    const tangentLengthVelocity = guideToPinDistance * distanceVelocity
      / tangentLength;
    const tangentLengthAcceleration = (
      distanceVelocity ** 2
        + guideToPinDistance * distanceAcceleration
        - tangentLengthVelocity ** 2
    ) / tangentLength;
    const rodAxisVelocity = rodNormal.clone().multiplyScalar(rodAngularSpeed);
    const rodAxisAcceleration = rodNormal.clone()
      .multiplyScalar(rodAngularAcceleration)
      .addScaledVector(rodAxis, -(rodAngularSpeed ** 2));
    const freeEndPosition = crankPinPosition.clone().addScaledVector(
      rodAxis,
      -rodLength,
    );
    const freeEndVelocity = crankPinVelocity.clone().addScaledVector(
      rodAxisVelocity,
      -rodLength,
    );
    const freeEndAcceleration = crankPinAcceleration.clone().addScaledVector(
      rodAxisAcceleration,
      -rodLength,
    );
    const guideRollerAngleUnwrapped = rodAngle - sourceGeometry.rodAngle
      - (tangentLength - sourceGeometry.tangentLength) / guideRollerRadius;
    const guideRollerAngularSpeed = rodAngularSpeed
      - tangentLengthVelocity / guideRollerRadius;
    const guideRollerAngularAcceleration = rodAngularAcceleration
      - tangentLengthAcceleration / guideRollerRadius;
    const rodSurfaceTangentialSpeed = crankPinVelocity.dot(rodAxis)
      + rodHalfWidth * rodAngularSpeed;
    const guideSurfaceTangentialSpeed = -guideRollerAngularSpeed
      * guideRollerRadius;
    const physicalRodFacePoint = crankPinPosition.clone()
      .addScaledVector(rodAxis, -tangentLength)
      .addScaledVector(rodNormal, -rodHalfWidth);
    const contactPointVelocity = rodAxis.clone().multiplyScalar(
      -guideRollerRadius * rodAngularSpeed,
    );
    const contactPointAcceleration = rodAxis.clone().multiplyScalar(
      -guideRollerRadius * rodAngularAcceleration,
    ).addScaledVector(
      rodNormal,
      -guideRollerRadius * rodAngularSpeed ** 2,
    );
    return {
      centerlineTangentPoint: geometryState.centerlineTangentPoint,
      contactNormalDistanceFromRodCenterline:
        physicalContactPoint.clone().sub(crankPinPosition).dot(rodNormal),
      contactPointAcceleration,
      contactPointVelocity,
      crankAngle: wrappedAngle(crankAngle),
      crankAngleUnwrapped: crankAngle,
      crankAngularAcceleration,
      crankAngularSpeed,
      crankPinAcceleration,
      crankPinPosition,
      crankPinVelocity,
      freeEndAcceleration,
      freeEndPosition,
      freeEndVelocity,
      guideRollerAngle: wrappedAngle(guideRollerAngleUnwrapped),
      guideRollerAngleUnwrapped,
      guideRollerAngularAcceleration,
      guideRollerAngularSpeed,
      guideSurfaceTangentialSpeed,
      guideToPinDistance,
      noSlipTangentialError:
        rodSurfaceTangentialSpeed - guideSurfaceTangentialSpeed,
      physicalContactCoincidenceError:
        physicalRodFacePoint.distanceTo(physicalContactPoint),
      physicalContactPoint,
      physicalRodFacePoint,
      rodAngle,
      rodAngularAcceleration,
      rodAngularSpeed,
      rodAxis,
      rodAxisAcceleration,
      rodAxisVelocity,
      rodNormal,
      rodSlideAcceleration: tangentLengthAcceleration,
      rodSlideCoordinate:
        tangentLength - sourceGeometry.tangentLength,
      rodSlideVelocity: tangentLengthVelocity,
      rodSurfaceTangentialSpeed,
      tangentLength,
      tangentLengthAcceleration,
      tangentLengthVelocity,
    };
  };

  const stateAtTime = (time) => ({
    ...configurationAtCrankAngle(
      sourceCrankAngle + inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    ),
    time,
    timelinePhase: THREE.MathUtils.euclideanModulo(
      time,
      demonstrationPeriod,
    ),
  });

  const tangentLengthMinimum = Math.sqrt(
    (centerSeparation - crankRadius) ** 2 - effectiveGuideRadius ** 2,
  );
  const tangentLengthMaximum = Math.sqrt(
    (centerSeparation + crankRadius) ** 2 - effectiveGuideRadius ** 2,
  );
  const longitudinalStroke = tangentLengthMaximum - tangentLengthMinimum;
  const timeForCrankAngle = (targetAngle) => (
    THREE.MathUtils.euclideanModulo(
      targetAngle - sourceCrankAngle,
      FULL_TURN,
    ) / inputAngularSpeed
  );

  root.userData.archetype =
    'rotating-crank-pin-driving-fixed-roller-tangent-oscillating-reciprocating-rod';
  root.userData.mechanism =
    'a-uniform-crank-pin-carries-one-end-of-a-constant-length-rod-whose-straight-lower-face-remains-on-the-selected-upper-tangent-to-a-fixed-guide-roller-so-the-rod-oscillates-while-its-material-slides-reciprocally-over-the-roller';
  root.userData.blocks = {
    contactMarker,
    crankArm,
    crankDisk,
    crankFaceIndex,
    crankPin,
    crankPinCap,
    crankRotor,
    crankShaft,
    guideAssembly,
    guideAxle,
    guideBearingFoot,
    guideIndex,
    guideRoller,
    guideRotor,
    guideTread,
    rod,
    rodBody,
    rodIndex,
    rodLeftEnd,
  };
  root.userData.canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    farthestFromGuide: timeForCrankAngle(0),
    nearestToGuide: timeForCrankAngle(Math.PI),
    sourcePose: 0,
  };
  root.userData.contactDefinition = {
    effectiveCenterlineTangentRadius: effectiveGuideRadius,
    physicalContactRadius: guideRollerRadius,
    rodFaceOffset: rodHalfWidth,
    selectedBranch: 'upper-tangent-with-rod-above-fixed-guide-roller',
    tangentIdentity:
      'effective-centerline-radius=physical-roller-radius+rod-half-width',
  };
  root.userData.driveSchedule = {
    input: 'source-required-uniform-continuous-crank-rotation',
    purpose:
      'one full turn shows both longitudinal reversals and the complete oscillation without an invented pause or reversal',
    sourcePrescribesDirection: false,
  };
  root.userData.geometry = {
    centerSeparation,
    crankCenter: crankCenter.clone(),
    crankDiskDepth,
    crankDiskRadius,
    crankRadius,
    effectiveGuideRadius,
    guideCenter: guideCenter.clone(),
    guideRollerDepth,
    guideRollerRadius,
    longitudinalStroke,
    rodDepth,
    rodHalfWidth,
    rodLength,
    rodPlaneZ,
    sourceCrankAngle,
    sourceRodAngle: sourceGeometry.rodAngle,
    sourceTangentLength: sourceGeometry.tangentLength,
    tangentLengthMaximum,
    tangentLengthMinimum,
  };
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    referenceScope:
      'availability and qualitative topology only; all tangent, derivative, and roller-spin equations were derived independently from the public-domain engraving and description',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate268: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one right-hand crank disk and crank pin carry the eye of one long rigid rod whose lower straight face remains tangent above one fixed-center guide roller as the rod oscillates and slides',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: true,
      rasterCrankCenter: { x: 448, y: 260 },
      rasterCrankDiskRadius: 65,
      rasterCrankPinSource: { x: 463, y: 214 },
      rasterGuideCenter: { x: 113, y: 263 },
      rasterGuideRollerRadius: 31,
      rasterRodLeftEndSource: { x: 14, y: 228 },
      rasterRodThickness: 15,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 67,
      edition: 21,
      illustrationPage: 66,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    inputAngularSpeed,
  };
  root.userData.transmission = {
    configurationAtCrankAngle,
    guideRollerNoSlipLaw:
      'guide-roller-angle=rod-angle-tangent-length/roller-radius-plus-source-constant',
    longitudinalStroke,
    tangentLengthAtCrankAngle: (crankAngle) => (
      tangentGeometryAtCrankAngle(crankAngle).tangentLength
    ),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    crankRotor.rotation.z = state.crankAngle;
    rod.position.set(
      state.crankPinPosition.x,
      state.crankPinPosition.y,
      rodPlaneZ,
    );
    rod.rotation.z = state.rodAngle;
    guideRotor.rotation.z = state.guideRollerAngle;
    contactMarker.position.x = state.physicalContactPoint.x;
    contactMarker.position.y = state.physicalContactPoint.y;
    crankRotor.userData.angularSpeed = state.crankAngularSpeed;
    rod.userData.angularSpeed = state.rodAngularSpeed;
    rod.userData.slideVelocity = state.rodSlideVelocity;
    guideRotor.userData.angularSpeed = state.guideRollerAngularSpeed;
    root.userData.contacts = {
      rodOnGuideRoller: {
        coincidenceError: state.physicalContactCoincidenceError,
        noSlipTangentialError: state.noSlipTangentialError,
        point: state.physicalContactPoint.clone(),
      },
    };
    root.userData.kinematics = state;
  };
  // Brown draws the roller free on its axle with no standard, and no white
  // index marks or contact dot.
  guideBearingFoot.removeFromParent();
  for (const mark of [
    crankPinCap,
    crankFaceIndex,
    guideIndex,
    rodIndex,
    contactMarker,
  ]) mark.visible = false;
  update(0);
  fitPistonGuide(root, update, demonstrationPeriod);
  markShadows(root);
  return {
    root,
    update,
    // Plate 268 is a flat elevation.
    cameraDirection: new THREE.Vector3(0, 0, 1),
  };
}

export function createAuthoredTangentRodDriveMovement(movement) {
  if (movement.id !== 268) return null;
  const result = crankTangentOscillatingRod(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
