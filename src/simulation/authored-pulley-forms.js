import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import { creaseIndexedNormals } from './crease-normals.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedAngle(unwrappedAngle) {
  const turns = unwrappedAngle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-12) return 0;
  return positiveModulo(unwrappedAngle, FULL_TURN);
}

function makeAxialCylinder({
  depth,
  material,
  radius,
  boreRadius = 0,
  role,
  segments = 84,
}) {
  const cylinder = new THREE.Mesh(
    boreRadius > 0
      ? boredLatheGeometry([{ axial: -depth / 2, radial: radius },
        { axial: depth / 2, radial: radius }], boreRadius, segments)
      : new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    X_AXIS,
  );
  cylinder.userData.axis = X_AXIS.clone();
  cylinder.userData.role = role;
  return cylinder;
}

function makeAxialLathe({
  material,
  profile,
  boreRadius,
  role,
  segments = 112,
}) {
  const geometry = boredLatheGeometry(
    profile.filter(({ radial }) => radial > 0), boreRadius, segments,
  );
  const lathe = new THREE.Mesh(geometry, material);
  lathe.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    X_AXIS,
  );
  lathe.userData.axis = X_AXIS.clone();
  lathe.userData.role = role;
  return lathe;
}

function makeAxialNotchedVBody({
  grooveDepth,
  grooveHalfWidth,
  boreRadius,
  material,
  notchAngularWidth,
  notchCount,
  notchDepth,
  outerRadius,
  pulleyHalfWidth,
  role,
}) {
  const grooveRootRadius = outerRadius - grooveDepth;
  const notchAngularPitch = FULL_TURN / notchCount;
  const notchAngularHalfWidth = notchAngularWidth / 2;
  const angularSegments = notchCount * 8;
  const flankSegments = 24;
  const leftFlank = Array.from({ length: flankSegments + 1 }, (_, index) => (
    -grooveHalfWidth + grooveHalfWidth * index / flankSegments
  ));
  const rightFlank = Array.from({ length: flankSegments }, (_, index) => (
    grooveHalfWidth * (index + 1) / flankSegments
  ));
  const axialSamples = [
    -pulleyHalfWidth,
    ...leftFlank,
    ...rightFlank,
    pulleyHalfWidth,
  ];

  const baseVRadiusAtAxial = (axial) => {
    if (Math.abs(axial) >= grooveHalfWidth) return outerRadius;
    return grooveRootRadius
      + grooveDepth * Math.abs(axial) / grooveHalfWidth;
  };
  const nearestNotchAngularOffset = (angle) => (
    positiveModulo(angle + notchAngularPitch / 2, notchAngularPitch)
      - notchAngularPitch / 2
  );
  const notchDepthAtAngle = (angle) => {
    const offset = nearestNotchAngularOffset(angle);
    if (Math.abs(offset) >= notchAngularHalfWidth) return 0;
    return notchDepth * 0.5 * (
      1 + Math.cos(Math.PI * offset / notchAngularHalfWidth)
    );
  };
  const axialNotchEnvelope = (axial) => {
    if (Math.abs(axial) >= grooveHalfWidth - 1e-12) return 0;
    return Math.pow(
      Math.cos(Math.PI * Math.abs(axial) / (2 * grooveHalfWidth)),
      0.2,
    );
  };
  const surfaceRadiusAt = (axial, angle) => (
    baseVRadiusAtAxial(axial)
      - notchDepthAtAngle(angle) * axialNotchEnvelope(axial)
  );

  const positions = [];
  const indices = [];
  const rowLength = angularSegments + 1;
  axialSamples.forEach((axial) => {
    for (let angularIndex = 0; angularIndex <= angularSegments;
      angularIndex += 1) {
      const angle = FULL_TURN * angularIndex / angularSegments;
      const radial = surfaceRadiusAt(axial, angle);
      positions.push(
        axial,
        radial * Math.cos(angle),
        radial * Math.sin(angle),
      );
    }
  });
  for (let axialIndex = 0; axialIndex < axialSamples.length - 1;
    axialIndex += 1) {
    for (let angularIndex = 0; angularIndex < angularSegments;
      angularIndex += 1) {
      const lowerLeft = axialIndex * rowLength + angularIndex;
      const lowerRight = lowerLeft + 1;
      const upperLeft = lowerLeft + rowLength;
      const upperRight = upperLeft + 1;
      indices.push(
        lowerLeft,
        lowerRight,
        upperLeft,
        lowerRight,
        upperRight,
        upperLeft,
      );
    }
  }

  // Close both faces with annuli and join their inner rings to a through-bore.
  // Each cap has its own vertices so its normal stays perpendicular to the shaft.
  const boreRings = [];
  [-1, 1].forEach((side) => {
    const axial = side * pulleyHalfWidth;
    const ringStart = positions.length / 3;
    for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex += 1) {
      const angle = FULL_TURN * angularIndex / angularSegments;
      for (const radial of [boreRadius, outerRadius]) {
        positions.push(axial, radial * Math.cos(angle), radial * Math.sin(angle));
      }
    }
    for (let angularIndex = 0; angularIndex < angularSegments; angularIndex += 1) {
      const inner = ringStart + 2 * angularIndex, outer = inner + 1;
      const nextInner = inner + 2, nextOuter = inner + 3;
      const faces = [inner, outer, nextOuter, inner, nextOuter, nextInner];
      if (side < 0) faces.reverse();
      indices.push(...faces);
    }
    const boreStart = positions.length / 3;
    for (let angularIndex = 0; angularIndex <= angularSegments; angularIndex += 1) {
      const angle = FULL_TURN * angularIndex / angularSegments;
      positions.push(axial, boreRadius * Math.cos(angle), boreRadius * Math.sin(angle));
    }
    boreRings.push(boreStart);
  });
  for (let i = 0; i < angularSegments; i += 1) {
    const a = boreRings[0] + i, b = boreRings[1] + i;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  creaseIndexedNormals(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.boreRadius = boreRadius;
  const body = new THREE.Mesh(geometry, material);
  body.userData.axialSamples = axialSamples;
  body.userData.baseVRadiusAtAxial = baseVRadiusAtAxial;
  body.userData.nearestNotchAngularOffset = nearestNotchAngularOffset;
  body.userData.notchDepthAtAngle = notchDepthAtAngle;
  body.userData.role = role;
  body.userData.surfaceRadiusAt = surfaceRadiusAt;
  return body;
}

function flangedFlatBeltPulley(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.9);

  const treadRadius = 2.32;
  const treadWidth = 0.85;
  const flangeRadius = 2.65;
  const flangeThickness = 0.26;
  const flangeCenterOffset = treadWidth / 2 + flangeThickness / 2;
  const flangeInnerFaceOffset = treadWidth / 2;
  const flangeOuterFaceOffset = treadWidth / 2 + flangeThickness;
  const flangeHeightAboveTread = flangeRadius - treadRadius;
  const hubRadius = 0.74;
  const hubWidth = 2.02;
  const shaftRadius = 0.38;
  const shaftLength = 4.46;
  const beltEdgeRunningClearance = 0.05;
  const maximumCompatibleBeltWidth =
    treadWidth - 2 * beltEdgeRunningClearance;
  const maximumCompatibleBeltThickness = flangeHeightAboveTread * 0.72;
  const angularSpeed = FULL_TURN / 4.5;
  const cyclePeriod = FULL_TURN / angularSpeed;

  const pulleyMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.53,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const pulleyRotor = new THREE.Group();
  pulleyRotor.userData.axis = X_AXIS.clone();
  pulleyRotor.userData.rigidMember = true;
  pulleyRotor.userData.role = 'flanged-flat-belt-pulley-and-shaft-rotor';
  root.add(pulleyRotor);

  const tread = makeAxialCylinder({
    depth: treadWidth,
    material: pulleyMaterial,
    radius: treadRadius,
    boreRadius: hubRadius + 0.008,
    role: 'straight-cylindrical-flat-belt-working-tread',
  });
  tread.userData.axialHalfWidth = treadWidth / 2;
  tread.userData.workingRadius = treadRadius;
  pulleyRotor.add(tread);

  const flanges = [-1, 1].map((side) => {
    const flange = makeAxialCylinder({
      depth: flangeThickness,
      material: pulleyMaterial,
      radius: flangeRadius,
      boreRadius: hubRadius + 0.008,
      role: `${side < 0 ? 'left' : 'right'}-belt-retaining-flange`,
      segments: 96,
    });
    flange.position.x = side * flangeCenterOffset;
    flange.userData.innerFaceX = side * flangeInnerFaceOffset;
    flange.userData.outerFaceX = side * flangeOuterFaceOffset;
    flange.userData.radialHeightAboveTread = flangeHeightAboveTread;
    pulleyRotor.add(flange);
    return flange;
  });

  const flangeRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(flangeRadius - 0.085, 0.055, 12, 104),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (flangeOuterFaceOffset + 0.025);
    rim.userData.role =
      `${side < 0 ? 'left' : 'right'}-flange-dark-outer-rim`;
    // Drawn face edge only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    pulleyRotor.add(rim);
    return rim;
  });

  const hub = makeAxialCylinder({
    depth: hubWidth,
    material: darkMaterial,
    radius: hubRadius,
    boreRadius: shaftRadius + 0.008,
    role: 'flanged-pulley-hub',
    segments: 52,
  });
  pulleyRotor.add(hub);

  const shaft = makeAxialCylinder({
    depth: shaftLength,
    material: darkMaterial,
    radius: shaftRadius,
    role: 'horizontal-flanged-pulley-shaft',
    segments: 44,
  });
  pulleyRotor.add(shaft);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.14, 0.92),
    whiteMaterial,
  );
  faceIndex.position.set(
    flangeOuterFaceOffset + 0.06,
    0,
    flangeRadius * 0.61,
  );
  faceIndex.userData.role = 'white-flange-face-speed-index';
  pulleyRotor.add(faceIndex);

  const treadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(treadWidth * 0.7, 0.075, 0.12),
    whiteMaterial,
  );
  treadIndex.position.set(0, treadRadius + 0.025, 0);
  treadIndex.userData.role = 'white-tread-speed-index';
  pulleyRotor.add(treadIndex);

  const stateAtTime = (time) => {
    const unwrappedPulleyAngle = angularSpeed * time;
    return {
      compatibleBeltLinearSpeed: angularSpeed * treadRadius,
      hubAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngularSpeed: angularSpeed,
      shaftAngle: wrappedAngle(unwrappedPulleyAngle),
      shaftAngularSpeed: angularSpeed,
      unwrappedPulleyAngle,
    };
  };

  root.userData.archetype =
    'straight-tread-double-flanged-flat-belt-pulley-rigid-on-horizontal-shaft';
  root.userData.beltDefinition = {
    exactBeltRouteSpecifiedBySource: false,
    matePulleySpecifiedBySource: false,
    renderedBelt: false,
    status: 'pulley-interface-only-because-belt-path-is-under-specified',
  };
  root.userData.blocks = {
    faceIndex,
    flangeRims,
    flanges,
    hub,
    pulleyRotor,
    shaft,
    tread,
    treadIndex,
  };
  root.userData.cameraDistanceScale = 0.9;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.35, -2.75, -2.75),
    new THREE.Vector3(3.35, 2.75, 2.75),
  );
  root.userData.geometry = {
    beltEdgeRunningClearance,
    flangeCenterOffset,
    flangeHeightAboveTread,
    flangeInnerFaceOffset,
    flangeOuterFaceOffset,
    flangeRadius,
    flangeThickness,
    hubRadius,
    hubWidth,
    maximumCompatibleBeltThickness,
    maximumCompatibleBeltWidth,
    shaftLength,
    shaftRadius,
    treadRadius,
    treadWidth,
  };
  root.userData.mechanism =
    'one-straight-working-tread-is-bounded-by-two-larger-radius-flanges-and-turns-rigidly-with-its-horizontal-shaft';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate255: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one straight cylindrical tread between two thin larger-radius retaining flanges on one horizontal shaft',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterFlangeBounds: {
        bottom: 465,
        left: 211,
        right: 321,
        top: 49,
      },
      rasterHubBounds: {
        bottom: 320,
        left: 190,
        right: 342,
        top: 203,
      },
      rasterShaftBounds: {
        bottom: 296,
        left: 98,
        right: 448,
        top: 231,
      },
      rasterTreadBounds: {
        bottom: 440,
        left: 233,
        right: 300,
        top: 75,
      },
      view:
        'edge-elevation-along-wheel-plane-showing-straight-tread-two-flanges-hub-and-shaft',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 65,
      edition: 21,
      illustrationPage: 64,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleClosure: cyclePeriod,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    angularSpeed,
    compatibleBeltSpeedLaw: 'v=omega-times-straight-tread-radius',
    potentialBeltLinearSpeed: angularSpeed * treadRadius,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pulleyRotor.rotation.x = state.pulleyAngle;
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(3.5, 2.7, 10.5),
  };
}

function plainFlatBeltPulley(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.94);

  const treadRadius = 2.65;
  const treadWidth = 1.36;
  const treadHalfWidth = treadWidth / 2;
  const hubRadius = 0.72;
  const hubWidth = 1.86;
  const shaftRadius = 0.36;
  const shaftLength = 4.65;
  const angularSpeed = FULL_TURN / 4.8;
  const cyclePeriod = FULL_TURN / angularSpeed;

  const pulleyMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.53,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const pulleyRotor = new THREE.Group();
  pulleyRotor.userData.axis = X_AXIS.clone();
  pulleyRotor.userData.rigidMember = true;
  pulleyRotor.userData.role = 'plain-flat-belt-pulley-and-shaft-rotor';
  root.add(pulleyRotor);

  const tread = makeAxialCylinder({
    depth: treadWidth,
    material: pulleyMaterial,
    radius: treadRadius,
    boreRadius: hubRadius + 0.008,
    role: 'plain-straight-cylindrical-flat-belt-working-tread',
    segments: 104,
  });
  tread.userData.axialHalfWidth = treadHalfWidth;
  tread.userData.profile = 'straight-cylindrical';
  tread.userData.workingRadius = treadRadius;
  pulleyRotor.add(tread);

  const faceRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(treadRadius - 0.085, 0.055, 12, 112),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (treadHalfWidth + 0.025);
    rim.userData.role =
      `${side < 0 ? 'left' : 'right'}-plain-pulley-face-rim`;
    // Drawn face edge only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    pulleyRotor.add(rim);
    return rim;
  });

  const hub = makeAxialCylinder({
    depth: hubWidth,
    material: darkMaterial,
    radius: hubRadius,
    boreRadius: shaftRadius + 0.008,
    role: 'plain-pulley-hub',
    segments: 52,
  });
  pulleyRotor.add(hub);

  const shaft = makeAxialCylinder({
    depth: shaftLength,
    material: darkMaterial,
    radius: shaftRadius,
    role: 'horizontal-plain-pulley-shaft',
    segments: 44,
  });
  pulleyRotor.add(shaft);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.055,
      0.14,
      treadRadius - hubRadius - 0.24,
    ),
    whiteMaterial,
  );
  faceIndex.position.set(
    treadHalfWidth + 0.085,
    0,
    (hubRadius + treadRadius) / 2,
  );
  faceIndex.userData.role = 'white-plain-pulley-face-speed-index';
  pulleyRotor.add(faceIndex);

  const treadIndex = new THREE.Mesh(
    new THREE.BoxGeometry(treadWidth * 0.76, 0.078, 0.13),
    whiteMaterial,
  );
  treadIndex.position.set(0, treadRadius + 0.026, 0);
  treadIndex.userData.role = 'white-plain-pulley-tread-speed-index';
  pulleyRotor.add(treadIndex);

  const stateAtTime = (time) => {
    const unwrappedPulleyAngle = angularSpeed * time;
    return {
      compatibleBeltLinearSpeed: angularSpeed * treadRadius,
      hubAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngularSpeed: angularSpeed,
      shaftAngle: wrappedAngle(unwrappedPulleyAngle),
      shaftAngularSpeed: angularSpeed,
      unwrappedPulleyAngle,
    };
  };

  root.userData.archetype =
    'straight-tread-flangeless-flat-belt-pulley-rigid-on-horizontal-shaft';
  root.userData.beltDefinition = {
    exactBeltRouteSpecifiedBySource: false,
    lateralGuidanceSpecifiedBySource: false,
    matePulleySpecifiedBySource: false,
    renderedBelt: false,
    status: 'pulley-interface-only-because-belt-path-is-under-specified',
  };
  root.userData.blocks = {
    faceIndex,
    faceRims,
    hub,
    pulleyRotor,
    shaft,
    tread,
    treadIndex,
  };
  root.userData.cameraDistanceScale = 0.9;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.5, -2.77, -2.77),
    new THREE.Vector3(2.5, 2.77, 2.77),
  );
  root.userData.geometry = {
    flangeCount: 0,
    hubRadius,
    hubWidth,
    shaftLength,
    shaftRadius,
    treadHalfWidth,
    treadProfile: 'straight-cylindrical-as-drawn',
    treadRadius,
    treadWidth,
  };
  root.userData.mechanism =
    'one-flangeless-straight-working-tread-turns-rigidly-with-its-hub-and-horizontal-shaft';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate256: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one straight cylindrical flangeless working tread with a wider hub rigid on one horizontal shaft',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterHubBounds: {
        bottom: 322,
        left: 200,
        right: 349,
        top: 207,
      },
      rasterPulleyBounds: {
        bottom: 473,
        left: 219,
        right: 328,
        top: 49,
      },
      rasterShaftBounds: {
        bottom: 293,
        left: 87,
        right: 459,
        top: 235,
      },
      view:
        'edge-elevation-along-wheel-plane-showing-a-plain-wide-rim-hub-and-shaft',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 65,
      edition: 21,
      illustrationPage: 64,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleClosure: cyclePeriod,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    angularSpeed,
    compatibleBeltSpeedLaw: 'v=omega-times-straight-tread-radius',
    demonstrationAngularSpeedSpecifiedBySource: false,
    potentialBeltLinearSpeed: angularSpeed * treadRadius,
    speedRatioSpecifiedBySource: false,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pulleyRotor.rotation.x = state.pulleyAngle;
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(3.9, 2.7, 10.2),
  };
}

function concaveGroovedRoundBandPulley(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.94);

  const outerRadius = 2.62;
  const pulleyWidth = 1.35;
  const pulleyHalfWidth = pulleyWidth / 2;
  const grooveHalfWidth = 0.43;
  const grooveDepth = 0.43;
  const grooveRootRadius = outerRadius - grooveDepth;
  const grooveArcRadius = grooveDepth;
  const rimLandWidth = pulleyHalfWidth - grooveHalfWidth;
  const hubRadius = 0.74;
  const hubWidth = 1.88;
  const shaftRadius = 0.368;
  const shaftLength = 4.73;
  const angularSpeed = FULL_TURN / 5;
  const cyclePeriod = FULL_TURN / angularSpeed;

  const pulleyMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.53,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const pulleyRotor = new THREE.Group();
  pulleyRotor.userData.axis = X_AXIS.clone();
  pulleyRotor.userData.rigidMember = true;
  pulleyRotor.userData.role =
    'concave-grooved-round-band-pulley-and-shaft-rotor';
  root.add(pulleyRotor);

  const grooveProfile = Array.from({ length: 65 }, (_, index) => {
    const axial = -grooveHalfWidth
      + 2 * grooveHalfWidth * index / 64;
    const radial = outerRadius - Math.sqrt(Math.max(
      0,
      grooveArcRadius ** 2 - axial ** 2,
    ));
    return { axial, radial };
  });
  const solidProfile = [
    { axial: -pulleyHalfWidth, radial: 0 },
    { axial: -pulleyHalfWidth, radial: outerRadius },
    { axial: -grooveHalfWidth, radial: outerRadius },
    ...grooveProfile,
    { axial: grooveHalfWidth, radial: outerRadius },
    { axial: pulleyHalfWidth, radial: outerRadius },
    { axial: pulleyHalfWidth, radial: 0 },
  ];
  const pulleyBody = makeAxialLathe({
    material: pulleyMaterial,
    profile: solidProfile,
    boreRadius: hubRadius + 0.008,
    role: 'true-round-bottom-concave-grooved-pulley-body',
  });
  pulleyBody.userData.grooveProfile = grooveProfile;
  pulleyBody.userData.workingRootRadius = grooveRootRadius;
  pulleyRotor.add(pulleyBody);

  const faceRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(outerRadius - 0.085, 0.055, 12, 112),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (pulleyHalfWidth + 0.025);
    rim.userData.role =
      `${side < 0 ? 'left' : 'right'}-concave-pulley-face-rim`;
    // Drawn face edge only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    pulleyRotor.add(rim);
    return rim;
  });

  const hub = makeAxialCylinder({
    depth: hubWidth,
    material: darkMaterial,
    radius: hubRadius,
    boreRadius: shaftRadius + 0.008,
    role: 'concave-pulley-hub',
    segments: 52,
  });
  pulleyRotor.add(hub);

  const shaft = makeAxialCylinder({
    depth: shaftLength,
    material: darkMaterial,
    radius: shaftRadius,
    role: 'horizontal-concave-pulley-shaft',
    segments: 44,
  });
  pulleyRotor.add(shaft);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.055,
      0.14,
      outerRadius - hubRadius - 0.24,
    ),
    whiteMaterial,
  );
  faceIndex.position.set(
    pulleyHalfWidth + 0.085,
    0,
    (hubRadius + outerRadius) / 2,
  );
  faceIndex.userData.role = 'white-concave-pulley-face-speed-index';
  pulleyRotor.add(faceIndex);

  const rimIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rimLandWidth * 0.62, 0.078, 0.13),
    whiteMaterial,
  );
  rimIndex.position.set(
    -(grooveHalfWidth + rimLandWidth / 2),
    outerRadius + 0.026,
    0,
  );
  rimIndex.userData.role = 'white-concave-pulley-rim-speed-index';
  pulleyRotor.add(rimIndex);

  const effectivePitchRadiusForBandRadius = (bandRadius) => {
    if (!(bandRadius > 0 && bandRadius < grooveArcRadius)) return null;
    return grooveRootRadius + bandRadius;
  };
  const potentialBandLinearSpeedForRadius = (bandRadius) => {
    const pitchRadius = effectivePitchRadiusForBandRadius(bandRadius);
    return pitchRadius === null ? null : angularSpeed * pitchRadius;
  };
  const stateAtTime = (time) => {
    const unwrappedPulleyAngle = angularSpeed * time;
    return {
      hubAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngularSpeed: angularSpeed,
      shaftAngle: wrappedAngle(unwrappedPulleyAngle),
      shaftAngularSpeed: angularSpeed,
      unwrappedPulleyAngle,
    };
  };

  root.userData.archetype =
    'single-round-bottom-concave-groove-pulley-rigid-on-horizontal-shaft';
  root.userData.bandDefinition = {
    exactBandRouteSpecifiedBySource: false,
    matePulleySpecifiedBySource: false,
    renderedBand: false,
    roundBandRadiusSpecifiedBySource: false,
    status: 'pulley-interface-only-because-band-path-is-under-specified',
  };
  root.userData.blocks = {
    faceIndex,
    faceRims,
    hub,
    pulleyBody,
    pulleyRotor,
    rimIndex,
    shaft,
  };
  root.userData.cameraDistanceScale = 0.9;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.48, -2.75, -2.75),
    new THREE.Vector3(2.48, 2.75, 2.75),
  );
  root.userData.geometry = {
    grooveArcRadius,
    grooveDepth,
    grooveHalfWidth,
    grooveProfile,
    grooveRootRadius,
    hubRadius,
    hubWidth,
    outerRadius,
    pulleyHalfWidth,
    pulleyWidth,
    rimLandWidth,
    shaftLength,
    shaftRadius,
  };
  root.userData.mechanism =
    'one-semicircular-round-bottom-groove-is-revolved-about-and-turns-rigidly-with-the-horizontal-shaft';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate257: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one round-bottom circumferential groove centered between two equal rim lands on one shaft',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterGrooveBounds: {
        bottomRoot: 432,
        left: 239,
        right: 304,
        topRoot: 88,
      },
      rasterHubBounds: {
        bottom: 324,
        left: 196,
        right: 344,
        top: 208,
      },
      rasterPulleyBounds: {
        bottom: 466,
        left: 218,
        right: 324,
        top: 53,
      },
      rasterShaftBounds: {
        bottom: 296,
        left: 87,
        right: 460,
        top: 238,
      },
      view:
        'edge-elevation-exposing-the-concave-circumferential-groove-profile',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 65,
      edition: 21,
      illustrationPage: 64,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleClosure: cyclePeriod,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    admissibleBandRadiusUpperBound: grooveArcRadius,
    angularSpeed,
    demonstrationAngularSpeedSpecifiedBySource: false,
    effectivePitchRadiusForBandRadius,
    potentialBandLinearSpeedForRadius,
    potentialNoSlipLaw:
      'v=omega-times-(groove-root-radius-plus-round-band-radius)',
    speedRatioSpecifiedBySource: false,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pulleyRotor.rotation.x = state.pulleyAngle;
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(4, 2.6, 10.2),
  };
}

function smoothVGroovedRoundBandPulley(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.94);

  const outerRadius = 2.62;
  const pulleyWidth = 1.41;
  const pulleyHalfWidth = pulleyWidth / 2;
  const grooveHalfWidth = 0.435;
  const grooveDepth = 0.74;
  const grooveRootRadius = outerRadius - grooveDepth;
  const grooveHalfAngle = Math.atan(grooveHalfWidth / grooveDepth);
  const grooveIncludedAngle = 2 * grooveHalfAngle;
  const rimLandWidth = pulleyHalfWidth - grooveHalfWidth;
  const hubRadius = 0.78;
  const hubWidth = 1.96;
  const shaftRadius = 0.4;
  const shaftLength = 4.73;
  const angularSpeed = FULL_TURN / 5.2;
  const cyclePeriod = FULL_TURN / angularSpeed;
  const maximumFullySeatedBandRadius = grooveDepth / (
    1 + 1 / Math.sin(grooveHalfAngle)
  );

  const pulleyMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.53,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const pulleyRotor = new THREE.Group();
  pulleyRotor.userData.axis = X_AXIS.clone();
  pulleyRotor.userData.rigidMember = true;
  pulleyRotor.userData.role =
    'smooth-v-grooved-round-band-pulley-and-shaft-rotor';
  root.add(pulleyRotor);

  const grooveProfile = [
    { axial: -grooveHalfWidth, radial: outerRadius },
    { axial: 0, radial: grooveRootRadius },
    { axial: grooveHalfWidth, radial: outerRadius },
  ];
  const solidProfile = [
    { axial: -pulleyHalfWidth, radial: 0 },
    { axial: -pulleyHalfWidth, radial: outerRadius },
    { axial: -grooveHalfWidth, radial: outerRadius },
    ...grooveProfile,
    { axial: grooveHalfWidth, radial: outerRadius },
    { axial: pulleyHalfWidth, radial: outerRadius },
    { axial: pulleyHalfWidth, radial: 0 },
  ];
  const pulleyBody = makeAxialLathe({
    material: pulleyMaterial,
    profile: solidProfile,
    boreRadius: hubRadius + 0.008,
    role: 'true-smooth-v-grooved-pulley-body',
  });
  pulleyBody.userData.grooveProfile = grooveProfile;
  pulleyBody.userData.workingRootRadius = grooveRootRadius;
  pulleyRotor.add(pulleyBody);

  const faceRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(outerRadius - 0.085, 0.055, 12, 112),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (pulleyHalfWidth + 0.025);
    rim.userData.role = `${side < 0 ? 'left' : 'right'}-v-pulley-face-rim`;
    // Drawn face edge only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    pulleyRotor.add(rim);
    return rim;
  });

  const hub = makeAxialCylinder({
    depth: hubWidth,
    material: darkMaterial,
    radius: hubRadius,
    boreRadius: shaftRadius + 0.008,
    role: 'smooth-v-pulley-hub',
    segments: 52,
  });
  pulleyRotor.add(hub);

  const shaft = makeAxialCylinder({
    depth: shaftLength,
    material: darkMaterial,
    radius: shaftRadius,
    role: 'horizontal-smooth-v-pulley-shaft',
    segments: 44,
  });
  pulleyRotor.add(shaft);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.055,
      0.14,
      outerRadius - hubRadius - 0.24,
    ),
    whiteMaterial,
  );
  faceIndex.position.set(
    pulleyHalfWidth + 0.085,
    0,
    (hubRadius + outerRadius) / 2,
  );
  faceIndex.userData.role = 'white-smooth-v-pulley-face-speed-index';
  pulleyRotor.add(faceIndex);

  const rimIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rimLandWidth * 0.62, 0.078, 0.13),
    whiteMaterial,
  );
  rimIndex.position.set(
    -(grooveHalfWidth + rimLandWidth / 2),
    outerRadius + 0.026,
    0,
  );
  rimIndex.userData.role = 'white-smooth-v-pulley-rim-speed-index';
  pulleyRotor.add(rimIndex);

  const effectivePitchRadiusForBandRadius = (bandRadius) => {
    if (!(bandRadius > 0 && bandRadius <= maximumFullySeatedBandRadius)) {
      return null;
    }
    return grooveRootRadius + bandRadius / Math.sin(grooveHalfAngle);
  };
  const potentialBandLinearSpeedForRadius = (bandRadius) => {
    const pitchRadius = effectivePitchRadiusForBandRadius(bandRadius);
    return pitchRadius === null ? null : angularSpeed * pitchRadius;
  };
  const stateAtTime = (time) => {
    const unwrappedPulleyAngle = angularSpeed * time;
    return {
      hubAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngularSpeed: angularSpeed,
      shaftAngle: wrappedAngle(unwrappedPulleyAngle),
      shaftAngularSpeed: angularSpeed,
      unwrappedPulleyAngle,
    };
  };

  root.userData.archetype =
    'smooth-sixty-degree-v-groove-round-band-pulley-rigid-on-horizontal-shaft';
  root.userData.bandDefinition = {
    exactBandRouteSpecifiedBySource: false,
    grooveSurface: 'smooth',
    matePulleySpecifiedBySource: false,
    renderedBand: false,
    roundBandRadiusSpecifiedBySource: false,
    status: 'pulley-interface-only-because-band-path-is-under-specified',
  };
  root.userData.blocks = {
    faceIndex,
    faceRims,
    hub,
    pulleyBody,
    pulleyRotor,
    rimIndex,
    shaft,
  };
  root.userData.cameraDistanceScale = 0.9;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.48, -2.75, -2.75),
    new THREE.Vector3(2.48, 2.75, 2.75),
  );
  root.userData.geometry = {
    grooveDepth,
    grooveHalfAngle,
    grooveHalfWidth,
    grooveIncludedAngle,
    grooveProfile,
    grooveRootRadius,
    hubRadius,
    hubWidth,
    maximumFullySeatedBandRadius,
    outerRadius,
    pulleyHalfWidth,
    pulleyWidth,
    rimLandWidth,
    shaftLength,
    shaftRadius,
  };
  root.userData.mechanism =
    'one-smooth-two-flank-v-groove-is-revolved-about-and-turns-rigidly-with-the-horizontal-shaft';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate258: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one smooth symmetric v-groove centered between two equal rim lands on one shaft',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterGrooveBounds: {
        bottomRoot: 420,
        left: 231,
        right: 298,
        topRoot: 130,
      },
      rasterHubBounds: {
        bottom: 335,
        left: 189,
        right: 340,
        top: 215,
      },
      rasterPulleyBounds: {
        bottom: 471,
        left: 210,
        right: 319,
        top: 67,
      },
      rasterShaftBounds: {
        bottom: 305,
        left: 83,
        right: 448,
        top: 243,
      },
      view:
        'edge-elevation-exposing-two-straight-smooth-v-groove-flanks',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 65,
      edition: 21,
      illustrationPage: 64,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleClosure: cyclePeriod,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    angularSpeed,
    demonstrationAngularSpeedSpecifiedBySource: false,
    effectivePitchRadiusForBandRadius,
    potentialBandLinearSpeedForRadius,
    potentialNoSlipLaw:
      'v=omega-times-(groove-root-radius+band-radius/sin(groove-half-angle))',
    speedRatioSpecifiedBySource: false,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pulleyRotor.rotation.x = state.pulleyAngle;
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(4, 2.6, 10.2),
  };
}

function notchedVGroovedRoundBandPulley(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.94);

  const outerRadius = 2.62;
  const pulleyWidth = 1.33;
  const pulleyHalfWidth = pulleyWidth / 2;
  const grooveHalfWidth = 0.39;
  const grooveDepth = 0.72;
  const grooveRootRadius = outerRadius - grooveDepth;
  const grooveHalfAngle = Math.atan(grooveHalfWidth / grooveDepth);
  const grooveIncludedAngle = 2 * grooveHalfAngle;
  const rimLandWidth = pulleyHalfWidth - grooveHalfWidth;
  const hubRadius = 0.735;
  const hubWidth = 1.83;
  const shaftRadius = 0.365;
  const shaftLength = 4.56;
  const notchCount = 48;
  const notchAngularPitch = FULL_TURN / notchCount;
  const notchAngularWidth = notchAngularPitch * 0.38;
  const notchDepth = 0.105;
  const angularSpeed = FULL_TURN / 5.4;
  const cyclePeriod = FULL_TURN / angularSpeed;
  const maximumFullySeatedBandRadius = grooveDepth / (
    1 + 1 / Math.sin(grooveHalfAngle)
  );

  const pulleyMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.53,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const pulleyRotor = new THREE.Group();
  pulleyRotor.userData.axis = X_AXIS.clone();
  pulleyRotor.userData.rigidMember = true;
  pulleyRotor.userData.role =
    'notched-v-grooved-round-band-pulley-and-shaft-rotor';
  root.add(pulleyRotor);

  const pulleyBody = makeAxialNotchedVBody({
    boreRadius: hubRadius + 0.008,
    grooveDepth,
    grooveHalfWidth,
    material: pulleyMaterial,
    notchAngularWidth,
    notchCount,
    notchDepth,
    outerRadius,
    pulleyHalfWidth,
    role: 'true-periodically-notched-v-grooved-pulley-body',
  });
  pulleyRotor.add(pulleyBody);

  const notchContrastMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.ink,
    transparent: true,
    opacity: 0.88,
  });
  const notchContrastLines = new THREE.Group();
  notchContrastLines.userData.role =
    'nonworking-notch-bottom-contrast-indicators';
  for (let notchIndex = 0; notchIndex < notchCount; notchIndex += 1) {
    const angle = notchIndex * notchAngularPitch;
    const points = Array.from({ length: 33 }, (_, index) => {
      const axial = -grooveHalfWidth * 0.96
        + grooveHalfWidth * 1.92 * index / 32;
      const radial = pulleyBody.userData.surfaceRadiusAt(axial, angle) + 0.008;
      return new THREE.Vector3(
        axial,
        radial * Math.cos(angle),
        radial * Math.sin(angle),
      );
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      notchContrastMaterial,
    );
    line.userData.notchIndex = notchIndex;
    line.userData.role = 'notch-bottom-contrast-line';
    notchContrastLines.add(line);
  }
  // Notch bottoms are real cut geometry; the ink contrast lines were only
  // drawn edges and are retired.
  notchContrastLines.visible = false;
  notchContrastLines.userData.retiredInkOutline = true;
  pulleyRotor.add(notchContrastLines);

  const faceRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(outerRadius - 0.085, 0.055, 12, 112),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (pulleyHalfWidth + 0.025);
    rim.userData.role =
      `${side < 0 ? 'left' : 'right'}-notched-v-pulley-face-rim`;
    // Drawn face edge only: hidden reference, not a dark rim.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    pulleyRotor.add(rim);
    return rim;
  });

  const hub = makeAxialCylinder({
    depth: hubWidth,
    material: darkMaterial,
    radius: hubRadius,
    boreRadius: shaftRadius + 0.008,
    role: 'notched-v-pulley-hub',
    segments: 52,
  });
  pulleyRotor.add(hub);

  const shaft = makeAxialCylinder({
    depth: shaftLength,
    material: darkMaterial,
    radius: shaftRadius,
    role: 'horizontal-notched-v-pulley-shaft',
    segments: 44,
  });
  pulleyRotor.add(shaft);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.055,
      0.14,
      outerRadius - hubRadius - 0.24,
    ),
    whiteMaterial,
  );
  faceIndex.position.set(
    pulleyHalfWidth + 0.085,
    0,
    (hubRadius + outerRadius) / 2,
  );
  faceIndex.userData.role = 'white-notched-v-pulley-face-speed-index';
  pulleyRotor.add(faceIndex);

  const rimIndex = new THREE.Mesh(
    new THREE.BoxGeometry(rimLandWidth * 0.62, 0.078, 0.13),
    whiteMaterial,
  );
  rimIndex.position.set(
    -(grooveHalfWidth + rimLandWidth / 2),
    outerRadius + 0.026,
    0,
  );
  rimIndex.userData.role = 'white-notched-v-pulley-rim-speed-index';
  pulleyRotor.add(rimIndex);

  const smoothLandPitchRadiusForBandRadius = (bandRadius) => {
    if (!(bandRadius > 0 && bandRadius <= maximumFullySeatedBandRadius)) {
      return null;
    }
    return grooveRootRadius + bandRadius / Math.sin(grooveHalfAngle);
  };
  const potentialBandLinearSpeedForRadius = (bandRadius) => {
    const pitchRadius = smoothLandPitchRadiusForBandRadius(bandRadius);
    return pitchRadius === null ? null : angularSpeed * pitchRadius;
  };
  const stateAtTime = (time) => {
    const unwrappedPulleyAngle = angularSpeed * time;
    return {
      hubAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngle: wrappedAngle(unwrappedPulleyAngle),
      pulleyAngularSpeed: angularSpeed,
      shaftAngle: wrappedAngle(unwrappedPulleyAngle),
      shaftAngularSpeed: angularSpeed,
      unwrappedPulleyAngle,
    };
  };

  root.userData.archetype =
    'periodically-notched-v-groove-round-band-pulley-rigid-on-horizontal-shaft';
  root.userData.bandDefinition = {
    adhesionIncreaseSpecifiedQualitativelyBySource: true,
    adhesionIncreaseValueSpecifiedBySource: false,
    bandElasticitySpecifiedBySource: false,
    exactBandRouteSpecifiedBySource: false,
    grooveSurface: 'periodically-notched',
    matePulleySpecifiedBySource: false,
    renderedBand: false,
    roundBandRadiusSpecifiedBySource: false,
    status: 'notched-pulley-interface-only-with-no-invented-band-drive',
  };
  root.userData.blocks = {
    faceIndex,
    faceRims,
    hub,
    notchContrastLines,
    pulleyBody,
    pulleyRotor,
    rimIndex,
    shaft,
  };
  root.userData.cameraDistanceScale = 0.9;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.43, -2.75, -2.75),
    new THREE.Vector3(2.43, 2.75, 2.75),
  );
  root.userData.geometry = {
    grooveDepth,
    grooveHalfAngle,
    grooveHalfWidth,
    grooveIncludedAngle,
    grooveRootRadius,
    hubRadius,
    hubWidth,
    maximumFullySeatedBandRadius,
    notchAngularPitch,
    notchAngularWidth,
    notchCount,
    notchDepth,
    notchPitchAtOuterRadius: outerRadius * notchAngularPitch,
    outerRadius,
    pulleyHalfWidth,
    pulleyWidth,
    rimLandWidth,
    shaftLength,
    shaftRadius,
  };
  root.userData.mechanism =
    'equal-pitch-transverse-notches-indent-both-flanks-of-one-v-groove-that-turns-rigidly-with-the-horizontal-shaft';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate259: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one v-groove with equal-angle transverse chevron notches repeated around the circumference',
      measurementUncertaintyPixels: 5,
      modeledNotchCount: notchCount,
      notchCountSpecifiedBySource: false,
      officialAnimationAvailable: false,
      rasterGrooveBounds: {
        bottomRoot: 418,
        left: 244,
        right: 306,
        topRoot: 123,
      },
      rasterHubBounds: {
        bottom: 329,
        left: 202,
        right: 345,
        top: 214,
      },
      rasterPulleyBounds: {
        bottom: 474,
        left: 222,
        right: 326,
        top: 64,
      },
      rasterShaftBounds: {
        bottom: 299,
        left: 94,
        right: 451,
        top: 242,
      },
      view:
        'edge-elevation-showing-projected-chevron-notches-crowding-near-the-rim-extrema',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 65,
      edition: 21,
      illustrationPage: 64,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleClosure: cyclePeriod,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    angularSpeed,
    demonstrationAngularSpeedSpecifiedBySource: false,
    potentialBandLinearSpeedForRadius,
    potentialNoSlipLandLaw:
      'v=omega-times-(groove-root-radius+band-radius/sin(groove-half-angle))',
    smoothLandPitchRadiusForBandRadius,
    speedRatioSpecifiedBySource: false,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pulleyRotor.rotation.x = state.pulleyAngle;
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(4, 2.6, 10.2),
  };
}

export function createAuthoredPulleyFormMovement(movement) {
  let result = null;
  if (movement.id === 255) result = flangedFlatBeltPulley(movement);
  if (movement.id === 256) result = plainFlatBeltPulley(movement);
  if (movement.id === 257) result = concaveGroovedRoundBandPulley(movement);
  if (movement.id === 258) result = smoothVGroovedRoundBandPulley(movement);
  if (movement.id === 259) result = notchedVGroovedRoundBandPulley(movement);
  if (!result) return null;
  result.root.userData.fidelity = 'authored';
  result.root.userData.hideGround = true;
  const { blocks, geometry } = result.root.userData;
  // Brown draws plain ink outlines and no painted speed indices; drop the
  // indices so only the drawn pulley, hub and shaft remain.
  for (const key of ['faceIndex', 'treadIndex', 'rimIndex']) {
    const entry = blocks[key];
    if (!entry) continue;
    for (const mesh of Array.isArray(entry) ? entry : [entry]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    delete blocks[key];
  }
  result.root.userData.removedUndrawnDecorations = ['white face and rim/tread speed indices'];
  result.root.traverse((object) => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) material.fog = false;
    }
  });
  // The engraving is a true edge elevation: the groove reads from the rim
  // silhouette and both hub collars show symmetrically, as Brown draws them.
  // A narrow field keeps the near rim from swelling in perspective and hiding
  // the hub collars that Brown draws standing proud of both faces.
  result.cameraDirection.set(0, 0, 1);
  result.root.userData.cameraFov = 8;
  result.root.updateMatrixWorld(true);
  const fitBounds = new THREE.Box3().setFromObject(result.root, true);
  const radius = Math.max(Math.abs(fitBounds.min.y), Math.abs(fitBounds.max.y),
    Math.abs(fitBounds.min.z), Math.abs(fitBounds.max.z)) + 0.01;
  fitBounds.min.y = fitBounds.min.z = -radius;
  fitBounds.max.y = fitBounds.max.z = radius;
  result.root.userData.cameraFitBounds = fitBounds;
  result.root.userData.reconstruction = {
    throughBores: true,
    fitClearance: 0.008,
    rigidAssembly: true,
    motion: 'scripted constant rotation; no band route or friction transfer is specified',
    notchCount259: '48 evenly spaced notches inferred from the visible front half',
  };
  return result;
}
