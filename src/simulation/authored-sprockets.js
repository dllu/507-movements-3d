import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

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
  axis = X_AXIS,
  depth,
  material,
  radius,
  role,
  segments = 72,
}) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    axis.clone().normalize(),
  );
  cylinder.userData.axis = axis.clone().normalize();
  cylinder.userData.role = role;
  return cylinder;
}

function makeBarBetween(start, end, radius, material, role) {
  const direction = end.clone().sub(start);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 18),
    material,
  );
  bar.position.copy(start).add(end).multiplyScalar(0.5);
  bar.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  bar.userData.end = end.clone();
  bar.userData.role = role;
  bar.userData.start = start.clone();
  return bar;
}

function tenForkChainSprocket(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.86);

  // Brown's edge elevation exposes six pockets over the visible near half,
  // including the top and bottom profiles. That is the projection of ten
  // equal pockets around the complete circumference. The link itself and its
  // route are not specified, so the model preserves the wheel and its pitch
  // interface without inventing an unsupported chain train.
  const toothCount = 10;
  const toothStep = FULL_TURN / toothCount;
  const wheelBodyRadius = 2.45;
  const wheelWidth = 1.16;
  const forkRootRadius = 2.32;
  const forkJunctionRadius = 2.68;
  const forkTipRadius = 3.03;
  const forkHalfSpread = 0.45;
  const forkBarRadius = 0.11;
  const chainSeatRadius = 2.92;
  const chainSeatProgress =
    (chainSeatRadius - forkJunctionRadius)
    / (forkTipRadius - forkJunctionRadius);
  const chainSeatHalfGap = forkHalfSpread * chainSeatProgress - forkBarRadius;
  const maximumReferenceLinkHalfWidth = chainSeatHalfGap;
  const shaftRadius = 0.28;
  const shaftLength = 7.6;
  const pitchRadius = chainSeatRadius;
  const chainPitch = 2 * pitchRadius * Math.sin(toothStep / 2);
  const angularSpeed = FULL_TURN / 5;
  const cyclePeriod = FULL_TURN / angularSpeed;

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.45,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const sprocketRotor = new THREE.Group();
  sprocketRotor.userData.axis = X_AXIS.clone();
  sprocketRotor.userData.rigidMember = true;
  sprocketRotor.userData.role = 'ten-fork-chain-sprocket-and-shaft-rotor';
  root.add(sprocketRotor);

  const wheelBody = makeAxialCylinder({
    depth: wheelWidth,
    material: wheelMaterial,
    radius: wheelBodyRadius,
    role: 'broad-edge-profile-sprocket-wheel-body',
  });
  sprocketRotor.add(wheelBody);

  const sideRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelBodyRadius, 0.09, 12, 96),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (wheelWidth / 2 + 0.025);
    rim.userData.role =
      `sprocket-${side < 0 ? 'left' : 'right'}-side-rim`;
    sprocketRotor.add(rim);
    return rim;
  });

  const hub = makeAxialCylinder({
    depth: wheelWidth + 0.38,
    material: darkMaterial,
    radius: 0.58,
    role: 'sprocket-wheel-rigid-hub',
    segments: 48,
  });
  sprocketRotor.add(hub);

  const shaft = makeAxialCylinder({
    depth: shaftLength,
    material: darkMaterial,
    radius: shaftRadius,
    role: 'horizontal-sprocket-shaft',
    segments: 40,
  });
  sprocketRotor.add(shaft);

  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.68, 0.12),
    whiteMaterial,
  );
  shaftIndex.position.set(shaftLength / 2 + 0.035, 0.36, 0);
  shaftIndex.userData.role = 'white-shaft-end-speed-index';
  sprocketRotor.add(shaftIndex);

  const forks = [];
  const forkGeometry = [];
  for (let index = 0; index < toothCount; index += 1) {
    const angle = index * toothStep;
    const fork = new THREE.Group();
    fork.rotation.x = angle;
    fork.userData.index = index;
    fork.userData.pocketAngleAtSource = angle;
    fork.userData.rigidlyFixedToWheel = true;
    fork.userData.role = `bifurcated-chain-fork-${index + 1}`;

    const rootPoint = new THREE.Vector3(0, forkRootRadius, 0);
    const junctionPoint = new THREE.Vector3(0, forkJunctionRadius, 0);
    const leftTip = new THREE.Vector3(
      -forkHalfSpread,
      forkTipRadius,
      0,
    );
    const rightTip = new THREE.Vector3(
      forkHalfSpread,
      forkTipRadius,
      0,
    );
    const stem = makeBarBetween(
      rootPoint,
      junctionPoint,
      forkBarRadius,
      wheelMaterial,
      `fork-${index + 1}-radial-stem`,
    );
    const leftProng = makeBarBetween(
      junctionPoint,
      leftTip,
      forkBarRadius,
      wheelMaterial,
      `fork-${index + 1}-left-axial-prong`,
    );
    const rightProng = makeBarBetween(
      junctionPoint,
      rightTip,
      forkBarRadius,
      wheelMaterial,
      `fork-${index + 1}-right-axial-prong`,
    );
    fork.add(stem, leftProng, rightProng);

    for (const [name, point] of [
      ['junction', junctionPoint],
      ['left-tip', leftTip],
      ['right-tip', rightTip],
    ]) {
      const joint = new THREE.Mesh(
        new THREE.SphereGeometry(forkBarRadius, 22, 14),
        wheelMaterial,
      );
      joint.position.copy(point);
      joint.userData.role = `fork-${index + 1}-${name}-rounded-end`;
      fork.add(joint);
    }

    if (index === 0) {
      const pocketIndex = new THREE.Mesh(
        new THREE.SphereGeometry(forkBarRadius * 0.48, 18, 12),
        whiteMaterial,
      );
      pocketIndex.position.set(
        forkHalfSpread,
        forkTipRadius,
        forkBarRadius * 0.86,
      );
      pocketIndex.userData.role = 'white-one-pocket-per-turn-index';
      fork.add(pocketIndex);
    }

    forkGeometry.push({
      angle,
      junctionPoint: junctionPoint.clone(),
      leftTip: leftTip.clone(),
      rightTip: rightTip.clone(),
      rootPoint: rootPoint.clone(),
    });
    forks.push(fork);
    sprocketRotor.add(fork);
  }

  const stateAtTime = (time) => {
    const unwrappedSprocketAngle = angularSpeed * time;
    const sprocketAngle = wrappedAngle(unwrappedSprocketAngle);
    const chainPitchCoordinate = unwrappedSprocketAngle / toothStep;
    return {
      chainAdvance: chainPitchCoordinate * chainPitch,
      chainLinearSpeed: angularSpeed * chainPitch / toothStep,
      chainPitchCoordinate,
      forkPocketAngles: Array.from(
        { length: toothCount },
        (_, index) => sprocketAngle + index * toothStep,
      ),
      shaftAngle: sprocketAngle,
      shaftAngularSpeed: angularSpeed,
      sprocketAngle,
      sprocketAngularSpeed: angularSpeed,
      unwrappedSprocketAngle,
    };
  };

  root.userData.archetype =
    'ten-fork-edge-profile-chain-sprocket-rigid-on-horizontal-shaft';
  root.userData.blocks = {
    forks,
    hub,
    shaft,
    shaftIndex,
    sideRims,
    sprocketRotor,
    wheelBody,
  };
  root.userData.cameraDistanceScale = 0.92;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.45, -3.1, -3.1),
    new THREE.Vector3(3.45, 3.1, 3.1),
  );
  root.userData.chainDefinition = {
    exactLinkFormSpecifiedBySource: false,
    exactRouteSpecifiedBySource: false,
    renderedChain: false,
    status: 'wheel-interface-only-because-chain-is-under-specified',
  };
  root.userData.geometry = {
    chainPitch,
    chainSeatHalfGap,
    chainSeatProgress,
    chainSeatRadius,
    forkBarRadius,
    forkGeometry,
    forkHalfSpread,
    forkJunctionRadius,
    forkRootRadius,
    forkTipRadius,
    maximumReferenceLinkHalfWidth,
    pitchRadius,
    shaftLength,
    shaftRadius,
    toothCount,
    toothStep,
    wheelBodyRadius,
    wheelWidth,
  };
  root.userData.mechanism =
    'ten-bifurcated-circumferential-pockets-turn-rigidly-with-one-horizontal-shaft-and-advance-one-compatible-chain-pitch-per-pocket';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate254: {
      imageHeight: 525,
      imageWidth: 525,
      inferredToothCount: 10,
      inferredTopology:
        'six fork profiles visible over the projected near semicircle imply ten equal bifurcated pockets around one broad wheel',
      measurementUncertaintyPixels: 5,
      officialAnimationAvailable: false,
      rasterForkProfiles: [
        { bottom: 65, left: 242, right: 294, top: 17 },
        { bottom: 144, left: 244, right: 294, top: 84 },
        { bottom: 226, left: 242, right: 294, top: 176 },
        { bottom: 337, left: 243, right: 296, top: 283 },
        { bottom: 439, left: 241, right: 297, top: 382 },
        { bottom: 510, left: 240, right: 300, top: 459 },
      ],
      rasterShaftBounds: {
        bottom: 328,
        left: 89,
        right: 444,
        top: 211,
      },
      rasterWheelBodyBounds: {
        bottom: 471,
        left: 219,
        right: 317,
        top: 61,
      },
      view:
        'edge-elevation-along-wheel-plane-showing-broad-rim-shaft-and-bifurcated-pockets',
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
    chainAdvancePerSprocketTurn: toothCount * chainPitch,
    chainPitch,
    chainPitchesPerTurn: toothCount,
    pitchLaw: 'one-fork-pocket-step-advances-one-compatible-chain-pitch',
    toothCount,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    sprocketRotor.rotation.x = state.sprocketAngle;
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(3.7, 2.8, 10.5),
  };
}

export function createAuthoredSprocketMovement(movement) {
  if (movement.id !== 254) return null;
  const result = tenForkChainSprocket(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
