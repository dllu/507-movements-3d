import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
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
  // Brown's forks are chunky flat Ys: each is one flat plate (0.18 wide in
  // its axial-radial plane, 0.2 thick tangentially) with rounded ends. The
  // prong centres are drawn in so the whole fork (0.68 across) keeps the
  // engraved forks' axial width (50-60 px of the 410 px body height).
  const forkHalfSpread = 0.25;
  const forkBarRadius = 0.09;
  const forkPlateThickness = 0.2;
  // The chain seat sits in the outer part of the fork, where the chunkier
  // prongs still leave a centred link more than 0.1 of half-width.
  const chainSeatRadius = 2.985;
  const chainSeatProgress =
    (chainSeatRadius - forkJunctionRadius)
    / (forkTipRadius - forkJunctionRadius);
  // A horizontal section through a sloping round prong is wider than its
  // radius. Use the actual cylinder surface, not a centerline subtraction.
  const prongSlope = forkHalfSpread / (forkTipRadius - forkJunctionRadius);
  const chainSeatHalfGap = forkHalfSpread * chainSeatProgress
    - forkBarRadius * Math.sqrt(1 + prongSlope ** 2);
  const maximumReferenceLinkHalfWidth = chainSeatHalfGap;
  const shaftRadius = 0.33;
  const shaftLength = 4.25;
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
  const replaceWithBore = (mesh, radius, depth) => {
    mesh.geometry.dispose();
    mesh.geometry = boredLatheGeometry([
      { radial: radius, axial: -depth / 2 },
      { radial: radius, axial: depth / 2 },
    ], shaftRadius + .005, 96);
  };
  replaceWithBore(wheelBody, wheelBodyRadius, wheelWidth);
  sprocketRotor.add(wheelBody);

  const sideRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(wheelBodyRadius - .025, 0.025, 8, 96),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (wheelWidth / 2 - .025);
    rim.userData.role =
      `sprocket-${side < 0 ? 'left' : 'right'}-side-rim`;
    // The engraving's edge lines are the drum boundary, not separate hoops.
    // Coincident dark tubes produced speckles along the actual drum edge.
    rim.visible = false;
    sprocketRotor.add(rim);
    return rim;
  });

  const hub = makeAxialCylinder({
    depth: wheelWidth + 0.44,
    material: darkMaterial,
    radius: 0.69,
    role: 'sprocket-wheel-rigid-hub',
    segments: 48,
  });
  replaceWithBore(hub, .69, wheelWidth + .44);
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
    new THREE.CircleGeometry(0.045, 24),
    whiteMaterial,
  );
  shaftIndex.rotation.y = Math.PI / 2;
  shaftIndex.position.set(shaftLength / 2 + 0.0005, 0.18, 0);
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
    const flatY = new THREE.Mesh(
      plate(clip.union(
        capsule([rootPoint.x, rootPoint.y], [junctionPoint.x, junctionPoint.y], forkBarRadius, 32),
        capsule([junctionPoint.x, junctionPoint.y], [leftTip.x, leftTip.y], forkBarRadius, 32),
        capsule([junctionPoint.x, junctionPoint.y], [rightTip.x, rightTip.y], forkBarRadius, 32),
      ), -forkPlateThickness / 2, forkPlateThickness / 2),
      wheelMaterial,
    );
    flatY.userData.role = `fork-${index + 1}-chunky-flat-y-fork`;
    fork.add(flatY);

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
  root.userData.cameraDistanceScale = 0.90;
  root.userData.cameraFov = 8;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 5;
  root.userData.reconstructionNote = 'A source-proportioned fork sprocket with a real shaft bore. Ten forks and the nominal pitch radius are inferred; the source specifies no chain shape or route. Rotation is prescribed and the reported seat gap describes the finite prongs, not validated chain engagement or load transfer.';
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
  root.traverse(object => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let sample = 0; sample <= 40; sample++) {
    update(cyclePeriod * sample / 40); root.updateMatrixWorld(true);
    root.traverseVisible(object => {
      const positions = object.geometry?.attributes.position;
      if (positions) for (let i = 0; i < positions.count; i++) {
        bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
      }
    });
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(.08);
  update(0);
  markShadows(root);
  shaftIndex.castShadow = false; shaftIndex.receiveShadow = false;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(0, 0, 15),
  };
}

export function createAuthoredSprocketMovement(movement) {
  if (movement.id !== 254) return null;
  const result = tenForkChainSprocket(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
