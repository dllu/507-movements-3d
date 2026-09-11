import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function wrappedAngle(angle) {
  const turns = angle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-11) return 0;
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function axialRotor(axis) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;
  root.add(rotor);
  return { root, rotor };
}

function cylinderAlongLocalZ({
  depth,
  material,
  radiusBottom,
  radiusTop = radiusBottom,
  radialSegments = 72,
}) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      depth,
      radialSegments,
      1,
      false,
    ),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusAroundAxis(radius, tube, axis, material, segments = 52) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
  torus.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  return torus;
}

function traversingRollerConeDrive(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.88);

  const coneLength = 3.3;
  const coneLargeRadius = 1.45;
  const coneSmallRadius = 0.52;
  const coneLargeEndX = -coneLength / 2;
  const coneSmallEndX = coneLength / 2;
  const radiusSlope = (
    coneSmallRadius - coneLargeRadius
  ) / coneLength;
  const meanContactRadius = (coneLargeRadius + coneSmallRadius) / 2;
  const coneTurnsPerTraverse = 4;
  const rollerTurnsPerTraverse = 5;
  const rollerPitchRadius = coneTurnsPerTraverse
    * meanContactRadius / rollerTurnsPerTraverse;
  const rollerWidth = 0.22;
  const rollerTreadTubeRadius = 0.045;
  const rollerBodyRadius = rollerPitchRadius - rollerTreadTubeRadius;
  const traverseAmplitude = 1.2;
  const sourceContactAxialPosition = 0.482;
  const sourceTraversePhase = Math.asin(
    sourceContactAxialPosition / traverseAmplitude,
  );
  const traversePeriod = 8;
  const traverseAngularFrequency = FULL_TURN / traversePeriod;
  const coneAngularSpeed = FULL_TURN
    * coneTurnsPerTraverse / traversePeriod;
  const coneGeneratorScale = Math.sqrt(1 + radiusSlope ** 2);
  const coneGeneratorAxis = new THREE.Vector3(
    1,
    radiusSlope,
    0,
  ).normalize();
  const coneSurfaceNormal = new THREE.Vector3(
    -radiusSlope,
    1,
    0,
  ).normalize();

  const coneRadiusAtAxialPosition = (axialPosition) => (
    coneLargeRadius
      + radiusSlope * (axialPosition - coneLargeEndX)
  );
  const contactPointAtAxialPosition = (axialPosition) => new THREE.Vector3(
    axialPosition,
    coneRadiusAtAxialPosition(axialPosition),
    0,
  );
  const rollerCenterAtAxialPosition = (axialPosition) => (
    contactPointAtAxialPosition(axialPosition).addScaledVector(
      coneSurfaceNormal,
      rollerPitchRadius,
    )
  );
  const guideOrigin = rollerCenterAtAxialPosition(0);

  const inputMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const rollerMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const coneAssembly = axialRotor(X_AXIS);
  const cone = coneAssembly.root;
  const coneRotor = coneAssembly.rotor;
  cone.userData.role = 'uniformly-rotating-conical-friction-drum';
  const coneBody = cylinderAlongLocalZ({
    depth: coneLength,
    material: inputMaterial,
    radiusBottom: coneLargeRadius,
    radiusTop: coneSmallRadius,
    radialSegments: 112,
  });
  coneBody.userData.role =
    'straight-generator-truncated-conical-friction-surface';
  coneRotor.add(coneBody);

  const coneFaceRims = [
    { radius: coneLargeRadius * 0.94, side: -1 },
    { radius: coneSmallRadius * 0.88, side: 1 },
  ].map(({ radius, side }) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.035, 9, 72),
      inkMaterial,
    );
    rim.position.z = side * (coneLength / 2 + 0.012);
    rim.userData.role = side < 0
      ? 'large-end-cone-face-rim'
      : 'small-end-cone-face-rim';
    coneRotor.add(rim);
    return rim;
  });
  const coneHub = cylinderAlongLocalZ({
    depth: coneLength + 0.24,
    material: inkMaterial,
    radiusBottom: 0.19,
    radialSegments: 36,
  });
  coneHub.userData.role = 'cone-drum-hub-rigid-with-input-shaft';
  coneRotor.add(coneHub);

  const coneIndices = [
    { radius: coneLargeRadius, side: -1 },
    { radius: coneSmallRadius, side: 1 },
  ].map(({ radius, side }) => {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.52, 0.055, 0.028),
      whiteMaterial,
    );
    index.position.set(
      radius * 0.38,
      0,
      side * (coneLength / 2 + 0.04),
    );
    index.userData.role = side < 0
      ? 'large-face-white-cone-speed-index'
      : 'small-face-white-cone-speed-index';
    coneRotor.add(index);
    return index;
  });

  const coneShaft = makeShaft({
    axis: X_AXIS,
    length: 5,
    radius: 0.075,
  });
  coneShaft.userData.role = 'constant-speed-horizontal-cone-input-shaft';

  const rollerAssembly = axialRotor(coneGeneratorAxis);
  const roller = rollerAssembly.root;
  const rollerRotor = rollerAssembly.rotor;
  roller.userData.role =
    'generator-axis-friction-roller-sliding-axially-on-straight-guide';
  const rollerBody = cylinderAlongLocalZ({
    depth: rollerWidth,
    material: rollerMaterial,
    radiusBottom: rollerBodyRadius,
    radialSegments: 72,
  });
  rollerBody.userData.role = 'thin-friction-roller-disk';
  rollerRotor.add(rollerBody);
  const rollerTread = new THREE.Mesh(
    new THREE.TorusGeometry(
      rollerBodyRadius,
      rollerTreadTubeRadius,
      10,
      88,
    ),
    inkMaterial,
  );
  rollerTread.userData.role = 'round-friction-tread-touching-cone';
  rollerRotor.add(rollerTread);
  const rollerHub = cylinderAlongLocalZ({
    depth: rollerWidth + 0.18,
    material: inkMaterial,
    radiusBottom: 0.16,
    radialSegments: 32,
  });
  rollerHub.userData.role = 'roller-hub-sliding-on-guide-shaft';
  rollerRotor.add(rollerHub);
  const rollerIndices = [-1, 1].map((side) => {
    const index = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      whiteMaterial,
    );
    index.position.set(
      rollerPitchRadius * 0.58,
      0,
      side * (rollerWidth / 2 + 0.05),
    );
    index.userData.role = side < 0
      ? 'rear-white-variable-roller-speed-index'
      : 'front-white-variable-roller-speed-index';
    rollerRotor.add(index);
    return index;
  });

  const rollerGuideLength = 5.5;
  const rollerGuide = makeShaft({
    axis: coneGeneratorAxis,
    color: PALETTE.ink,
    length: rollerGuideLength,
    radius: 0.057,
  });
  rollerGuide.position.copy(guideOrigin);
  rollerGuide.userData.role =
    'fixed-straight-generator-parallel-roller-traverse-guide';

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 18, 12),
    whiteMaterial,
  );
  contactMarker.userData.role = 'moving-no-slip-cone-roller-contact';

  const baseY = -2.08;
  const coneBearingXs = [-2.35, 2.35];
  const coneBearings = coneBearingXs.map((x, index) => {
    const bearing = torusAroundAxis(0.16, 0.038, X_AXIS, frameMaterial, 36);
    bearing.position.set(x, 0, 0);
    bearing.userData.role = index === 0
      ? 'fixed-large-end-cone-shaft-bearing'
      : 'fixed-small-end-cone-shaft-bearing';
    return bearing;
  });
  const coneBearingPosts = coneBearings.map((bearing, index) => {
    const post = makeBeam(
      new THREE.Vector3(bearing.position.x, baseY, -0.58),
      bearing.position,
      { color: PALETTE.frame, depth: 0.15, thickness: 0.13 },
    );
    post.userData.role = index === 0
      ? 'large-end-cone-bearing-standard'
      : 'small-end-cone-bearing-standard';
    return post;
  });

  const guideHalfVector = coneGeneratorAxis.clone().multiplyScalar(
    rollerGuideLength / 2 - 0.12,
  );
  const guideBearingCenters = [
    guideOrigin.clone().sub(guideHalfVector),
    guideOrigin.clone().add(guideHalfVector),
  ];
  const guideBearings = guideBearingCenters.map((center, index) => {
    const bearing = torusAroundAxis(
      0.13,
      0.032,
      coneGeneratorAxis,
      frameMaterial,
      34,
    );
    bearing.position.copy(center);
    bearing.userData.role = index === 0
      ? 'fixed-left-traverse-guide-bearing'
      : 'fixed-right-traverse-guide-bearing';
    return bearing;
  });
  const guideBearingPosts = guideBearings.map((bearing, index) => {
    const post = makeBeam(
      new THREE.Vector3(bearing.position.x, baseY, -0.82),
      bearing.position,
      { color: PALETTE.frame, depth: 0.13, thickness: 0.11 },
    );
    post.userData.role = index === 0
      ? 'left-traverse-guide-standard'
      : 'right-traverse-guide-standard';
    return post;
  });
  const baseRail = makeBeam(
    new THREE.Vector3(-2.7, baseY, -0.82),
    new THREE.Vector3(2.7, baseY, -0.82),
    { color: PALETTE.frame, depth: 0.24, thickness: 0.16 },
  );
  baseRail.userData.role = 'fixed-cone-drive-base-rail';

  root.add(
    cone,
    coneShaft,
    roller,
    rollerGuide,
    contactMarker,
    ...coneBearings,
    ...coneBearingPosts,
    ...guideBearings,
    ...guideBearingPosts,
    baseRail,
  );

  const stateAtTime = (time) => {
    const traversePhase = traverseAngularFrequency * time
      + sourceTraversePhase;
    const contactAxialPosition = traverseAmplitude * Math.sin(traversePhase);
    const contactAxialVelocity = traverseAmplitude
      * traverseAngularFrequency * Math.cos(traversePhase);
    const contactAxialAcceleration = -traverseAmplitude
      * traverseAngularFrequency ** 2 * Math.sin(traversePhase);
    const coneRadiusAtContact = coneRadiusAtAxialPosition(
      contactAxialPosition,
    );
    const coneRadiusRate = radiusSlope * contactAxialVelocity;
    const coneAngleUnwrapped = coneAngularSpeed * time;
    const integratedContactRadius = meanContactRadius * time
      + radiusSlope * traverseAmplitude * (
        Math.cos(sourceTraversePhase) - Math.cos(traversePhase)
      ) / traverseAngularFrequency;
    const rollerAngleUnwrapped = -coneAngularSpeed
      * integratedContactRadius / rollerPitchRadius;
    const rollerAngularSpeed = -coneAngularSpeed
      * coneRadiusAtContact / rollerPitchRadius;
    const rollerAngularAcceleration = -coneAngularSpeed
      * coneRadiusRate / rollerPitchRadius;
    const contactPoint = contactPointAtAxialPosition(contactAxialPosition);
    const rollerCenter = contactPoint.clone().addScaledVector(
      coneSurfaceNormal,
      rollerPitchRadius,
    );
    const guideCoordinate = contactAxialPosition * coneGeneratorScale;
    const guideVelocity = contactAxialVelocity * coneGeneratorScale;
    const rollerCenterVelocity = coneGeneratorAxis.clone().multiplyScalar(
      guideVelocity,
    );
    const coneContactTangentialSpeed = coneAngularSpeed
      * coneRadiusAtContact;
    const rollerContactTangentialSpeed = -rollerAngularSpeed
      * rollerPitchRadius;
    return {
      coneAngle: wrappedAngle(coneAngleUnwrapped),
      coneAngleUnwrapped,
      coneAngularSpeed,
      coneContactTangentialSpeed,
      coneRadiusAtContact,
      coneRadiusRate,
      contactAxialAcceleration,
      contactAxialPosition,
      contactAxialVelocity,
      contactPoint,
      guideCoordinate,
      guideVelocity,
      integratedContactRadius,
      noSlipTangentialError: rollerContactTangentialSpeed
        - coneContactTangentialSpeed,
      rollerAngle: wrappedAngle(rollerAngleUnwrapped),
      rollerAngleUnwrapped,
      rollerAngularAcceleration,
      rollerAngularSpeed,
      rollerCenter,
      rollerCenterVelocity,
      rollerContactTangentialSpeed,
      speedRatio: rollerAngularSpeed / coneAngularSpeed,
      time,
      traversePhase,
    };
  };

  root.userData.archetype =
    'uniform-conical-drum-driving-generator-aligned-axially-traversing-friction-roller';
  root.userData.mechanism =
    'constant-speed-conical-drum-friction-drives-one-generator-axis-roller-whose-smooth-lengthwise-traverse-varies-output-speed-in-direct-proportion-to-local-cone-radius';
  root.userData.blocks = {
    baseRail,
    cone,
    coneBearingPosts,
    coneBearings,
    coneBody,
    coneFaceRims,
    coneHub,
    coneIndices,
    coneRotor,
    coneShaft,
    contactMarker,
    guideBearingPosts,
    guideBearings,
    roller,
    rollerBody,
    rollerGuide,
    rollerHub,
    rollerIndices,
    rollerRotor,
    rollerTread,
  };
  root.userData.canonicalTimes = {
    cycleClosure: traversePeriod,
    firstLargeEndReversal:
      (Math.PI * 3 / 2 - sourceTraversePhase) / traverseAngularFrequency,
    firstSmallEndReversal:
      (Math.PI / 2 - sourceTraversePhase) / traverseAngularFrequency,
    sourcePose: 0,
  };
  root.userData.contactDefinition = {
    coneSurfaceNormal,
    contactPointAtAxialPosition,
    generatorAxis: coneGeneratorAxis,
    rollerCenterAtAxialPosition,
    rollingLaw:
      'roller-angular-speed=-cone-angular-speed*local-cone-radius/roller-pitch-radius',
  };
  root.userData.driveSchedule = {
    coneInput: 'source-required-uniform-continuous-rotation',
    purpose:
      'a smooth periodic guide traverse demonstrates the full source variable-speed range without teleporting',
    sourcePrescribesTraverseSchedule: false,
    traverse: 'sinusoidal-reciprocation-with-zero-speed-at-both-ends',
  };
  root.userData.geometry = {
    coneAxis: X_AXIS.clone(),
    coneGeneratorAxis,
    coneGeneratorScale,
    coneLargeEndX,
    coneLargeRadius,
    coneLength,
    coneSmallEndX,
    coneSmallRadius,
    coneSurfaceNormal,
    guideOrigin,
    meanContactRadius,
    radiusSlope,
    rollerBodyRadius,
    rollerGuideLength,
    rollerPitchRadius,
    rollerTreadTubeRadius,
    rollerWidth,
    sourceContactAxialPosition,
    traverseAmplitude,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement 265 page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate265: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one horizontal truncated cone, one thin edge-on friction roller, and one roller shaft parallel to the upper cone generator',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterConeLargeEnd: {
        bottom: 369,
        centerX: 75,
        centerY: 254,
        top: 139,
      },
      rasterConeSmallEnd: {
        bottom: 294,
        centerX: 335,
        centerY: 253,
        top: 212,
      },
      rasterContactPoint: { x: 243, y: 204 },
      rasterRollerCenter: { x: 260, y: 144 },
      rasterRollerShaftLine: {
        left: { x: 191, y: 126 },
        right: { x: 502, y: 202 },
      },
      rasterShaftEndpointsX: [13, 449],
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
    coneTurnsPerTraverse,
    demonstrationPeriod: traversePeriod,
    rollerTurnsPerTraverse,
    traverseAngularFrequency,
  };
  root.userData.transmission = {
    coneAngularSpeed,
    coneRadiusAtAxialPosition,
    maximumSpeedRatioMagnitude: coneRadiusAtAxialPosition(
      -traverseAmplitude,
    ) / rollerPitchRadius,
    minimumSpeedRatioMagnitude: coneRadiusAtAxialPosition(
      traverseAmplitude,
    ) / rollerPitchRadius,
    rollerAngularSpeedAtAxialPosition: (axialPosition) => (
      -coneAngularSpeed
        * coneRadiusAtAxialPosition(axialPosition) / rollerPitchRadius
    ),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(cone, state.coneAngle);
    setSpin(coneShaft, state.coneAngle);
    roller.position.copy(state.rollerCenter);
    setSpin(roller, state.rollerAngle);
    contactMarker.position.copy(state.contactPoint);
    cone.userData.angularSpeed = state.coneAngularSpeed;
    roller.userData.angularSpeed = state.rollerAngularSpeed;
    roller.userData.axialVelocity = state.guideVelocity;
    root.userData.contacts = {
      coneToTraversingRoller: {
        noSlipTangentialError: state.noSlipTangentialError,
        point: state.contactPoint,
        rollerCenter: state.rollerCenter,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(5.2, 3.8, 9.8),
  };
}

export function createAuthoredConeFrictionDriveMovement(movement) {
  if (movement.id !== 265) return null;
  const result = traversingRollerConeDrive(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
