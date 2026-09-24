import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

import {foldingRod} from './folding-joint-parts.js';
import {fitPistonGuide} from './piston-guide-parts.js';

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeEndFrame({
  handrailHeight,
  material,
  pinMaterial,
  railHalfWidth,
  role,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = role;
  const posts = [];
  const lowerPins = [];
  const upperPins = [];
  const caps = [];

  for (const side of [-1, 1]) {
    const z = side * railHalfWidth;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, handrailHeight, 0.18),
      material,
    );
    post.position.set(0, handrailHeight / 2, z - Math.sign(z) * 0.22);
    post.userData.role = `${role}-vertical-post`;
    group.add(post);
    posts.push(post);

    const lowerPin = cylinderAlongZ(0.13, 0.64, pinMaterial);
    lowerPin.position.set(0, 0, z);
    lowerPin.userData.role = `${role}-lower-stringer-pivot`;
    group.add(lowerPin);
    lowerPins.push(lowerPin);

    const upperPin = cylinderAlongZ(0.13, 0.64, pinMaterial);
    upperPin.position.set(0, handrailHeight, z);
    upperPin.userData.role = `${role}-upper-handrail-pivot`;
    group.add(upperPin);
    upperPins.push(upperPin);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 20, 14),
      whiteMaterial,
    );
    cap.position.set(0, handrailHeight + 0.16, z - Math.sign(z) * .22);
    cap.userData.role = `${role}-white-post-cap`;
    group.add(cap);
    caps.push(cap);
  }

  const topCrossbar = cylinderAlongZ(
    0.075,
    railHalfWidth * 2 + 0.18,
    material,
  );
  topCrossbar.position.y = handrailHeight;
  topCrossbar.userData.role = `${role}-top-crossbar`;
  group.add(topCrossbar);

  group.userData.caps = caps;
  group.userData.lowerPins = lowerPins;
  group.userData.posts = posts;
  group.userData.topCrossbar = topCrossbar;
  group.userData.upperPins = upperPins;
  return markShadows(group);
}

function makeTread({
  boardMaterial,
  pinMaterial,
  railHalfWidth,
  treadDepth,
  treadThickness,
  treadWidth,
  whiteMaterial,
  index,
}) {
  const group = new THREE.Group();
  group.userData.role = 'world-horizontal-pivoted-wharf-ladder-tread';
  group.userData.treadIndex = index;

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(treadDepth, treadThickness, treadWidth),
    boardMaterial,
  );
  board.position.set(-treadDepth / 2, 0, 0);
  board.userData.role = 'level-tread-board-pivoted-at-rear-edge';
  group.add(board);

  const rearAxle = cylinderAlongZ(
    0.085,
    railHalfWidth * 2 + 0.31,
    pinMaterial,
    24,
  );
  rearAxle.userData.role = 'tread-rear-edge-stringer-pivot-axle';
  group.add(rearAxle);

  const frontEdge = cylinderAlongZ(
    0.055,
    railHalfWidth * 2 + 0.64,
    pinMaterial,
    20,
  );
  frontEdge.position.x = -treadDepth;
  frontEdge.userData.role = 'tread-front-edge-suspension-axle';
  group.add(frontEdge);

  const levelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(treadDepth * 0.55, 0.025, 0.075),
    whiteMaterial,
  );
  levelIndex.position.set(-treadDepth * 0.50, treadThickness / 2 + 0.014, 0);
  levelIndex.userData.role = 'white-horizontal-tread-level-index';
  group.add(levelIndex);

  group.userData.board = board;
  group.userData.frontEdge = frontEdge;
  group.userData.levelIndex = levelIndex;
  group.userData.rearAxle = rearAxle;
  return markShadows(group);
}

function makeWharf({
  dockLower,
  handrailHeight,
  material,
  railHalfWidth,
}) {
  const group = new THREE.Group();
  group.position.copy(dockLower);
  group.userData.role = 'fixed-masonry-wharf-and-guard-rail';

  const wallHeight = 2.9;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, wallHeight, railHalfWidth * 2 + 1.2),
    material,
  );
  wall.position.set(1.63, -wallHeight / 2 + 0.08, 0);
  wall.userData.role = 'fixed-wharf-wall';
  group.add(wall);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 0.22, railHalfWidth * 2 + 1.5),
    material,
  );
  deck.position.set(1.755, -0.04, 0);
  deck.userData.role = 'fixed-wharf-deck';
  group.add(deck);

  const farPostMaterial = matte(PALETTE.frame, {
    metalness: 0.08,
    roughness: 0.72,
  });
  for (const side of [-1, 1]) {
    const farPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, handrailHeight, 0.16),
      farPostMaterial,
    );
    farPost.position.set(2.35, handrailHeight / 2, side * railHalfWidth);
    farPost.userData.role = 'fixed-wharf-outer-guard-post';
    group.add(farPost);

    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.13, 0.13),
      farPostMaterial,
    );
    guard.position.set(1.175, handrailHeight, side * railHalfWidth);
    guard.userData.role = 'fixed-wharf-horizontal-guard-rail';
    group.add(guard);

    for (const diagonalSign of [-1, 1]) {
      const brace = makeDynamicLink({
        color: PALETTE.frame,
        depth: 0.09,
        jointRadius: 0.001,
        thickness: 0.09,
      });
      const start = new THREE.Vector3(
        0.34,
        diagonalSign < 0 ? 0.22 : handrailHeight - 0.22,
        side * railHalfWidth,
      );
      const end = new THREE.Vector3(
        2.12,
        diagonalSign < 0 ? handrailHeight - 0.22 : 0.22,
        side * railHalfWidth,
      );
      brace.userData.setEndpoints(start, end);
      brace.userData.role = 'fixed-wharf-cross-brace';
      group.add(brace);
    }
  }

  return markShadows(group);
}

function makeFloatAssembly({
  endFrame,
  floatMaterial,
  railHalfWidth,
}) {
  const group = new THREE.Group();
  group.userData.role = 'tide-following-floating-end-assembly';
  group.add(endFrame);

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.32, railHalfWidth * 2 + 0.68),
    floatMaterial,
  );
  hull.position.set(-0.34, -0.40, 0);
  hull.rotation.z = -0.05;
  hull.userData.role = 'floating-pontoon-hull';
  group.add(hull);

  const keel = cylinderAlongZ(
    0.24,
    railHalfWidth * 2 + 0.42,
    floatMaterial,
    28,
  );
  keel.position.set(-0.34, -0.56, 0);
  keel.userData.role = 'floating-pontoon-rounded-keel';
  group.add(keel);

  return markShadows(group);
}

function selfAdjustingWharfLadder(movement) {
  const root = new THREE.Group();

  // Keveney's official schematic supplies a 17-unit stringer, an 8-unit
  // vertical handrail offset, seven treads at 17/7 spacing, and a tide
  // slider whose effective level moves from 0 to -6.  Only their common
  // scale is changed here.
  const sourceLadderLength = 17;
  const sourceHandrailHeight = 8;
  const sourceMaximumTideDrop = 6;
  const sourceStepSpacing = sourceLadderLength / 7;
  const sourceScale = 0.32;
  const ladderLength = sourceLadderLength * sourceScale;
  const handrailHeight = sourceHandrailHeight * sourceScale;
  const maximumTideDrop = sourceMaximumTideDrop * sourceScale;
  const treadCount = 7;
  const treadSpacing = sourceStepSpacing * sourceScale;
  const treadDepth = 1.95 * sourceScale;
  const treadThickness = 0.105;
  const railHalfWidth = 0.69;
  const treadWidth = railHalfWidth * 2 - 0.20;
  const supportRodLength = Math.hypot(handrailHeight, treadDepth);
  const dockLower = new THREE.Vector3(2.72, 1.58, 0);
  const cycleDuration = 10;
  const descendingEndPhase = 0.40;
  const lowDwellEndPhase = 0.50;
  const ascendingEndPhase = 0.90;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.68,
  });
  const boardMaterial = matte(PALETTE.brass, {
    metalness: 0.07,
    roughness: 0.66,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const floatMaterial = matte(PALETTE.driven, {
    metalness: 0.06,
    roughness: 0.64,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.44,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.36,
    transparent: true,
  });

  const wharf = makeWharf({
    dockLower,
    handrailHeight,
    material: frameMaterial,
    railHalfWidth,
  });
  root.add(wharf);

  const fixedEndFrame = makeEndFrame({
    handrailHeight,
    material: frameMaterial,
    pinMaterial,
    railHalfWidth,
    role: 'fixed-wharf-end-frame',
    whiteMaterial,
  });
  fixedEndFrame.position.copy(dockLower);
  root.add(fixedEndFrame);

  const floatingEndFrame = makeEndFrame({
    handrailHeight,
    material: floatMaterial,
    pinMaterial,
    railHalfWidth,
    role: 'floating-vertical-end-frame',
    whiteMaterial,
  });
  const floatAssembly = makeFloatAssembly({
    endFrame: floatingEndFrame,
    floatMaterial,
    railHalfWidth,
  });
  root.add(floatAssembly);

  const water = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.035, railHalfWidth * 2 + 2.8),
    waterMaterial,
  );
  water.position.x = dockLower.x - 3.45;
  water.userData.role = 'moving-tide-water-level-reference';
  water.castShadow = false;
  water.receiveShadow = true;
  root.add(water);

  const lowerStringers = [];
  const upperHandrails = [];
  const railIndexes = [];
  for (const side of [-1, 1]) {
    const lowerStringer = foldingRod({length: ladderLength, width: .20,
      depth: .17, bore: .134, material: matte(PALETTE.driver),
      role: 'rigid-lower-ladder-stringer', planeZ: 0});
    lowerStringer.userData.role = 'rigid-lower-ladder-stringer';
    lowerStringer.userData.side = side;
    root.add(lowerStringer);
    lowerStringers.push(lowerStringer);
    for (let i = 1; i < treadCount; i++) lowerStringer.userData.addPinEye(i * treadSpacing, .089);

    const upperHandrail = foldingRod({length: ladderLength, width: .16,
      depth: .15, bore: .134, material: matte(PALETTE.driven),
      role: 'parallel-upper-handrail-bar', planeZ: 0});
    upperHandrail.userData.role = 'parallel-upper-handrail-bar';
    upperHandrail.userData.side = side;
    root.add(upperHandrail);
    upperHandrails.push(upperHandrail);
    for (let i = 1; i < treadCount; i++) upperHandrail.userData.addPinEye(i * treadSpacing, .059);
    for (let i = 0; i < treadCount; i++) {
      const pin = cylinderAlongZ(i === 0 ? .13 : .055, .66, pinMaterial);
      pin.position.set(i * treadSpacing, 0, side * .05);
      pin.userData.role = 'upper-suspension-pivot-pin';
      upperHandrail.add(pin);
    }

    const railIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      whiteMaterial,
    );
    railIndex.userData.role = 'white-equal-rail-midpoint-index';
    railIndex.userData.side = side;
    root.add(railIndex);
    railIndexes.push(railIndex);
  }

  const treads = [];
  const suspensionRods = [];
  for (let index = 0; index < treadCount; index += 1) {
    const tread = makeTread({
      boardMaterial,
      index,
      pinMaterial,
      railHalfWidth,
      treadDepth,
      treadThickness,
      treadWidth,
      whiteMaterial,
    });
    root.add(tread);
    treads.push(tread);

    const rodsForTread = [];
    for (const side of [-1, 1]) {
      const rod = foldingRod({length: supportRodLength, width: .07,
        depth: .07, bore: .059, material: pinMaterial,
        role: 'constant-length-tread-suspension-rod', planeZ: side * .24});
      rod.userData.role = 'constant-length-tread-suspension-rod';
      rod.userData.side = side;
      rod.userData.treadIndex = index;
      if (index === 0) {
        // Main handrail pivot is larger than intermediate suspension pins.
        rod.userData.addPinEye(0, .134, .169);
      }
      root.add(rod);
      rodsForTread.push(rod);
    }
    suspensionRods.push(rodsForTread);
  }

  const descendingDuration = descendingEndPhase * cycleDuration;
  const ascendingDuration = (
    ascendingEndPhase - lowDwellEndPhase
  ) * cycleDuration;

  const scheduleAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const phase = wrappedTime / cycleDuration;
    if (phase < descendingEndPhase) {
      const smooth = quinticState(phase / descendingEndPhase);
      return {
        acceleration: smooth.acceleration / descendingDuration ** 2,
        fraction: smooth.value,
        rate: smooth.rate / descendingDuration,
        stage: 'tide-falling-ladder-descending',
      };
    }
    if (phase < lowDwellEndPhase) {
      return {
        acceleration: 0,
        fraction: 1,
        rate: 0,
        stage: 'low-tide-dwell',
      };
    }
    if (phase < ascendingEndPhase) {
      const local = (
        phase - lowDwellEndPhase
      ) / (ascendingEndPhase - lowDwellEndPhase);
      const smooth = quinticState(local);
      return {
        acceleration: -smooth.acceleration / ascendingDuration ** 2,
        fraction: 1 - smooth.value,
        rate: -smooth.rate / ascendingDuration,
        stage: 'tide-rising-ladder-ascending',
      };
    }
    return {
      acceleration: 0,
      fraction: 0,
      rate: 0,
      stage: 'high-tide-dwell',
    };
  };

  const stateAtTime = (time) => {
    const schedule = scheduleAtTime(time);
    const tideDrop = maximumTideDrop * schedule.fraction;
    const tideDropRate = maximumTideDrop * schedule.rate;
    const tideDropAcceleration = maximumTideDrop
      * schedule.acceleration;
    const horizontalSpan = Math.sqrt(
      ladderLength ** 2 - tideDrop ** 2,
    );
    const horizontalSpanRate = -tideDrop * tideDropRate
      / horizontalSpan;
    const floatLower = new THREE.Vector3(
      dockLower.x - horizontalSpan,
      dockLower.y - tideDrop,
      0,
    );
    const floatVelocity = new THREE.Vector3(
      -horizontalSpanRate,
      -tideDropRate,
      0,
    );
    const floatHorizontalAcceleration = (
      (tideDropRate ** 2 + tideDrop * tideDropAcceleration)
        / horizontalSpan
      + tideDrop ** 2 * tideDropRate ** 2
        / horizontalSpan ** 3
    );
    const floatAcceleration = new THREE.Vector3(
      floatHorizontalAcceleration,
      -tideDropAcceleration,
      0,
    );
    const ladderInclination = Math.asin(tideDrop / ladderLength);
    const ladderAngularSpeed = tideDropRate / horizontalSpan;
    const ladderAngularAcceleration = tideDropAcceleration
      / horizontalSpan
      + tideDrop * tideDropRate ** 2 / horizontalSpan ** 3;
    const dockUpper = dockLower.clone().add(
      new THREE.Vector3(0, handrailHeight, 0),
    );
    const floatUpper = floatLower.clone().add(
      new THREE.Vector3(0, handrailHeight, 0),
    );
    const stepStates = [];
    for (let index = 0; index < treadCount; index += 1) {
      const stringerFraction = index / treadCount;
      const rearEdgeCenter = dockLower.clone().lerp(
        floatLower,
        stringerFraction,
      );
      const frontEdgeCenter = rearEdgeCenter.clone().add(
        new THREE.Vector3(-treadDepth, 0, 0),
      );
      const upperSupportCenter = rearEdgeCenter.clone().add(
        new THREE.Vector3(0, handrailHeight, 0),
      );
      const rearEdgeVelocity = floatVelocity.clone()
        .multiplyScalar(stringerFraction);
      const supports = [-1, 1].map((side) => {
        const upper = upperSupportCenter.clone();
        upper.z = side * railHalfWidth;
        const lower = frontEdgeCenter.clone();
        lower.z = side * railHalfWidth;
        return {
          length: upper.distanceTo(lower),
          lower,
          side,
          upper,
        };
      });
      stepStates.push({
        frontEdgeCenter,
        index,
        pitchAngle: 0,
        rearEdgeCenter,
        rearEdgeVelocity,
        stringerDistance: stringerFraction * ladderLength,
        stringerFraction,
        supports,
        upperSupportCenter,
      });
    }
    return {
      dockLower: dockLower.clone(),
      dockUpper,
      floatAcceleration,
      floatLower,
      floatUpper,
      floatVelocity,
      horizontalSpan,
      horizontalSpanRate,
      ladderAngularAcceleration,
      ladderAngularSpeed,
      ladderInclination,
      stage: schedule.stage,
      stepStates,
      tideDrop,
      tideDropAcceleration,
      tideDropRate,
      tideFraction: schedule.fraction,
      waterLevel: floatLower.y - 0.47,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    floatAssembly.position.copy(state.floatLower);
    water.position.y = state.waterLevel;

    for (let index = 0; index < 2; index += 1) {
      const side = index === 0 ? -1 : 1;
      const dockLowerSide = state.dockLower.clone();
      const floatLowerSide = state.floatLower.clone();
      const dockUpperSide = state.dockUpper.clone();
      const floatUpperSide = state.floatUpper.clone();
      dockLowerSide.z = side * railHalfWidth;
      floatLowerSide.z = side * railHalfWidth;
      dockUpperSide.z = side * railHalfWidth;
      floatUpperSide.z = side * railHalfWidth;
      lowerStringers[index].userData.setEndpoints(
        dockLowerSide,
        floatLowerSide,
      );
      upperHandrails[index].userData.setEndpoints(
        dockUpperSide,
        floatUpperSide,
      );
      lowerStringers[index].userData.endpoints = {
        end: floatLowerSide.clone(),
        start: dockLowerSide.clone(),
      };
      upperHandrails[index].userData.endpoints = {
        end: floatUpperSide.clone(),
        start: dockUpperSide.clone(),
      };
      railIndexes[index].position.copy(dockUpperSide)
        .add(floatUpperSide).multiplyScalar(0.5);
    }

    for (let index = 0; index < treadCount; index += 1) {
      const stepState = state.stepStates[index];
      treads[index].position.copy(stepState.rearEdgeCenter);
      treads[index].rotation.set(0, 0, 0);
      treads[index].userData.pitchAngle = 0;
      treads[index].userData.rearEdgeVelocity =
        stepState.rearEdgeVelocity.clone();
      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const support = stepState.supports[sideIndex];
        suspensionRods[index][sideIndex].userData.setEndpoints(
          support.upper,
          support.lower,
        );
        suspensionRods[index][sideIndex].userData.endpoints = {
          end: support.lower.clone(),
          start: support.upper.clone(),
        };
      }
    }

    root.userData.contacts = {
      railPivots: {
        lowerLengthResidual: state.dockLower.distanceTo(
          state.floatLower,
        ) - ladderLength,
        upperLengthResidual: state.dockUpper.distanceTo(
          state.floatUpper,
        ) - ladderLength,
      },
      treadSupports: state.stepStates.map((stepState) => ({
        pitchError: stepState.pitchAngle,
        rodLengthResiduals: stepState.supports.map(
          (support) => support.length - supportRodLength,
        ),
        treadIndex: stepState.index,
      })),
    };
    root.userData.kinematics = state;
  };

  const highState = stateAtTime(0);
  const lowState = stateAtTime(descendingEndPhase * cycleDuration);
  root.userData = {
    archetype:
      'tide-float-parallelogram-stringers-suspended-horizontal-tread-ladder',
    blocks: {
      fixedEndFrame,
      fixedLowerPins: fixedEndFrame.userData.lowerPins,
      fixedUpperPins: fixedEndFrame.userData.upperPins,
      floatAssembly,
      floatingEndFrame,
      floatingLowerPins: floatingEndFrame.userData.lowerPins,
      floatingUpperPins: floatingEndFrame.userData.upperPins,
      lowerStringers,
      railIndexes,
      suspensionRods,
      treads,
      upperHandrails,
      water,
      wharf,
    },
    constraintResiduals: {
      highLowerRailLength: highState.dockLower.distanceTo(
        highState.floatLower,
      ) - ladderLength,
      highUpperRailLength: highState.dockUpper.distanceTo(
        highState.floatUpper,
      ) - ladderLength,
      lowCircleClosure: lowState.horizontalSpan ** 2
        + lowState.tideDrop ** 2 - ladderLength ** 2,
      lowLowerRailLength: lowState.dockLower.distanceTo(
        lowState.floatLower,
      ) - ladderLength,
      lowUpperRailLength: lowState.dockUpper.distanceTo(
        lowState.floatUpper,
      ) - ladderLength,
      supportRodLength: lowState.stepStates[3].supports[0].length
        - supportRodLength,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: [
        'vertical tide displacement of the floating ladder end',
      ],
      note:
        'the rigid stringers determine horizontal float drift; equal translated handrails form a parallelogram, and each suspended tread consequently has zero pitch',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'the wharf pivots are fixed and the floating end frame remains vertical',
        'both lower stringers and both upper handrails are rigid and equal',
        'the tide is a prescribed vertical input while the float drifts freely to satisfy the rigid-stringer circle constraint',
        'all pivots are frictionless and the seven treads, rods, float, and rails are massless for kinematic demonstration',
        'absolute scale, board width and thickness, float and wharf construction, duration, easing, colors, and camera are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsMassesBuoyancyOrForces:
        false,
      treatment:
        'exact one-degree-of-freedom tide-driven parallelogram ladder with analytically level suspended treads',
    },
    fidelity: 'authored',
    geometry: {
      dockLower: dockLower.clone(),
      handrailHeight,
      ladderLength,
      maximumTideDrop,
      railHalfWidth,
      sourceHandrailHeight,
      sourceLadderLength,
      sourceMaximumTideDrop,
      sourceScale,
      sourceStepSpacing,
      supportRodLength,
      treadCount,
      treadDepth,
      treadSpacing,
      treadThickness,
      treadWidth,
    },
    mechanism:
      'tide-driven-floating-end-two-rigid-stringers-parallel-handrails-seven-pivoted-and-rod-suspended-self-leveling-treads',
    sourceAnimation: {
      available: true,
      normalizedEventPhases: [
        0,
        descendingEndPhase,
        lowDwellEndPhase,
        ascendingEndPhase,
        1,
      ],
      officialCanvasModelPresent: true,
      sourceEffectiveTideLevels: [0, -6],
      sourceHandrailOffset: 8,
      sourceLadderLength: 17,
      sourcePrescribedAbsoluteTiming: false,
      sourceSliderLocalSegment: [[-20, 3], [-15, 3]],
      sourceSliderTranslations: [[-0.5, -9], [-0.5, -3]],
      sourceStepStations: [
        0,
        -2.428571,
        -4.857143,
        -7.285714,
        -9.714286,
        -12.142857,
        -14.571429,
      ],
      sourceViewBox: [-20, -14, 28, 28],
    },
    sourceReference: {
      brownPlate387: {
        highTideLowerPivotCentersPixels: {
          floating: [66, 191],
          wharf: [340, 198],
        },
        highTideUpperPivotCentersPixels: {
          floating: [66, 68],
          wharf: [340, 69],
        },
        imageHeight: 525,
        imageWidth: 525,
        lowTideLowerPivotCentersPixels: {
          floating: [89, 480],
          wharf: [339, 415],
        },
        lowTideUpperPivotCentersPixels: {
          floating: [89, 387],
          wharf: [338, 328],
        },
        measurementUncertaintyPixels: 12,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the ladder serves wharfs subject to rise and fall of tide',
          'each tread is pivoted at one edge into the wooden string pieces',
          'the other tread edge is supported by rods suspended from the handrail bars',
          'the treads remain horizontal at every ladder position',
        ],
        officialAnimationEvidence:
          'the official canvas defines a 17-unit circular connecting rod, an 8-unit upper-rail offset, seven stations at 17/7 spacing, effective tide levels 0 and -6, and normalized phase boundaries 0, 0.4, 0.5, and 0.9',
        reconstructionDisclosure:
          'the source ratios and seven stations are retained; twin 3D rails, tread width, pontoon, wharf, absolute scale and duration, quintic easing, materials, water plane, and camera are independently engineered rather than copied from the proprietary canvas',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        ascendingStarts: lowDwellEndPhase * cycleDuration,
        descendingStarts: 0,
        highDwellStarts: ascendingEndPhase * cycleDuration,
        lowDwellStarts: descendingEndPhase * cycleDuration,
      },
      normalizedEventPhases: [
        0,
        descendingEndPhase,
        lowDwellEndPhase,
        ascendingEndPhase,
        1,
      ],
      note:
        'official phase proportions are retained while quintic easing gives zero velocity and acceleration at all motion/dwell boundaries',
    },
    transmission: {
      endFrameLaw:
        'floatUpper=floatLower+(0,H,0) and dockUpper=dockLower+(0,H,0), so the upper and lower rails are equal translated links',
      floatCircleLaw:
        'horizontalSpan^2+tideDrop^2=ladderLength^2',
      supportLaw:
        'each support joins rearPivot+(0,H) to rearPivot+(-treadDepth,0), giving constant length sqrt(H^2+treadDepth^2)',
      treadLevelLaw:
        'every rigid tread is translated to its lower-stringer pivot without rotation, so pitch=0 independently of ladder inclination',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.72, -1.18, -2.12),
    new THREE.Vector3(5.78, 4.46, 2.12),
  );
  fitPistonGuide(root, update, cycleDuration);
  root.userData.groundFloorY = -1.06;
  markShadows(root);
  water.castShadow = false;
  water.receiveShadow = true;
  return {
    cameraDirection: new THREE.Vector3(0.3, 0.25, 12),
    root,
    update,
  };
}

export function createAuthoredTideLadderMovement(movement) {
  if (movement.id !== 387) return null;
  return selfAdjustingWharfLadder(movement);
}
