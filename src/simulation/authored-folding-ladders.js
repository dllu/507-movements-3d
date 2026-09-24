import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {foldingRod} from './folding-joint-parts.js';
import {boredJournal, fitPistonGuide} from './piston-guide-parts.js';

const FULL_TURN = Math.PI * 2;

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

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function halfAnnularRailGeometry({
  innerRadius,
  length,
  outerRadius,
  side,
}) {
  const points = [];
  const arcSegments = 32;
  if (side < 0) {
    for (let index = 0; index <= arcSegments; index += 1) {
      const angle = Math.PI / 2 + Math.PI * index / arcSegments;
      points.push(new THREE.Vector2(
        outerRadius * Math.cos(angle),
        outerRadius * Math.sin(angle),
      ));
    }
    for (let index = 0; index <= arcSegments; index += 1) {
      const angle = Math.PI * 3 / 2 - Math.PI * index / arcSegments;
      points.push(new THREE.Vector2(
        innerRadius * Math.cos(angle),
        innerRadius * Math.sin(angle),
      ));
    }
  } else {
    for (let index = 0; index <= arcSegments; index += 1) {
      const angle = Math.PI / 2 - Math.PI * index / arcSegments;
      points.push(new THREE.Vector2(
        outerRadius * Math.cos(angle),
        outerRadius * Math.sin(angle),
      ));
    }
    for (let index = 0; index <= arcSegments; index += 1) {
      const angle = -Math.PI / 2 + Math.PI * index / arcSegments;
      points.push(new THREE.Vector2(
        innerRadius * Math.cos(angle),
        innerRadius * Math.sin(angle),
      ));
    }
  }

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].x, points[index].y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    bevelSegments: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    curveSegments: 1,
    depth: length,
    steps: 1,
  });
  geometry.translate(0, 0, -length / 2);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function makeHalfTubeSidePiece({
  closedHalfGap,
  endFillLength,
  innerRadius,
  length,
  material,
  outerRadius,
  pivotOffsets,
  pinMaterial,
  side,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = side < 0
    ? 'left-hollow-semicylindrical-ladder-side-piece'
    : 'right-hollow-semicylindrical-ladder-side-piece';

  const shell = new THREE.Mesh(
    halfAnnularRailGeometry({
      innerRadius,
      length,
      outerRadius,
      side,
    }),
    material,
  );
  shell.position.x = -side * closedHalfGap;
  shell.userData.role = side < 0
    ? 'left-half-of-closed-round-pole-shell'
    : 'right-half-of-closed-round-pole-shell';
  group.add(shell);

  const endFillShell = new THREE.Mesh(
    halfAnnularRailGeometry({
      innerRadius,
      length: endFillLength,
      outerRadius,
      side: -side,
    }),
    material,
  );
  endFillShell.position.set(
    -side * closedHalfGap,
    side * (length - endFillLength) / 2,
    0,
  );
  endFillShell.userData.role = side < 0
    ? 'left-lower-complement-forming-full-pole-end'
    : 'right-upper-complement-forming-full-pole-end';
  group.add(endFillShell);

  const pivotPins = [];
  const pivotIndexes = [];
  for (let index = 0; index < pivotOffsets.length; index += 1) {
    const pin = cylinderAlongZ(0.060, 0.35, pinMaterial, 28);
    pin.position.y = pivotOffsets[index];
    pin.userData.role = 'round-pivot-pin-through-side-piece';
    pin.userData.roundIndex = index;
    group.add(pin);
    pivotPins.push(pin);
    // Internal clevis cheeks attach to the shell, leaving the rotating eye
    // between them; the axle remains inside the pole cavity at closure.
    for (const z of [-0.14, 0.14]) {
      const cheek = boredJournal(0.114, 0.064, 0.05, material);
      cheek.position.set(0, pivotOffsets[index], z);
      cheek.userData.role = 'bored-internal-round-pivot-cheek';
      group.add(cheek);
    }

    const pivotIndex = new THREE.Mesh(
      new THREE.CircleGeometry(0.048, 20),
      whiteMaterial,
    );
    pivotIndex.position.set(
      0,
      pivotOffsets[index],
      outerRadius * 1.075,
    );
    pivotIndex.userData.role = 'white-round-pivot-index';
    pivotIndex.userData.roundIndex = index;
    group.add(pivotIndex);
    pivotIndexes.push(pivotIndex);
  }

  const endIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.54, 0.055),
    whiteMaterial,
  );
  endIndex.position.set(
    side * (outerRadius - closedHalfGap + .025),
    length / 2 - 0.44,
    0,
  );
  endIndex.userData.role = 'white-side-piece-translation-index';
  group.add(endIndex);

  group.userData.endIndex = endIndex;
  group.userData.endFillShell = endFillShell;
  group.userData.pivotIndexes = pivotIndexes;
  group.userData.pivotPins = pivotPins;
  group.userData.shell = shell;
  return group;
}

function foldingLibraryLadder(movement) {
  const root = new THREE.Group();

  // The official schematic uses a 14-unit round and a closed center offset
  // of (2, 13.856406), whose magnitude remains 14.  The reconstruction uses
  // that exact ratio at a smaller scale while following the four rounds in
  // Brown's public-domain engraving.
  const sourceRoundLength = 14;
  const sourceClosedHorizontalOffset = 2;
  const sourceClosedVerticalOffset = Math.sqrt(
    sourceRoundLength ** 2 - sourceClosedHorizontalOffset ** 2,
  );
  const sourceScale = 0.12;
  const roundLength = sourceRoundLength * sourceScale;
  const closedHorizontalGap = sourceClosedHorizontalOffset * sourceScale;
  const closedVerticalOffset = sourceClosedVerticalOffset * sourceScale;
  const closedFoldAngle = Math.atan2(
    closedVerticalOffset,
    closedHorizontalGap,
  );
  const roundCount = 4;
  const pivotPitch = closedVerticalOffset;
  const pivotOffsets = Array.from(
    { length: roundCount },
    (_, index) => (index - (roundCount - 1) / 2) * pivotPitch,
  );
  // Full end complements need one fold-offset beyond the outermost round.
  const sidePieceLength = 2 * (pivotOffsets.at(-1) + closedVerticalOffset + .15);
  const sidePieceCenterY = 3.52;
  const closedHalfGap = closedHorizontalGap / 2;
  // Each full-pole end complement is one fold-offset long less a 0.07
  // relief: the opposite half-shell rises past it only after their arcs have
  // separated horizontally, so the closing halves never cut the complements.
  const endFillLength = closedVerticalOffset - 0.07;
  const shellOuterRadius = 0.36;
  const shellInnerRadius = 0.26;
  // Brown draws the rounds as broad slats; 0.19 still folds inside the pole bore.
  const roundThickness = 0.19;
  const roundDepth = 0.105;
  const roundJointRadius = 0.099;
  const cycleDuration = 10;
  const foldingEndPhase = 0.40;
  const foldedDwellEndPhase = 0.50;
  const unfoldingEndPhase = 0.90;

  const sideMaterial = matte(PALETTE.driven, {
    metalness: 0.08,
    roughness: 0.68,
  });
  const roundMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.64,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.49,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.46,
  });

  const leftSidePiece = makeHalfTubeSidePiece({
    closedHalfGap,
    endFillLength: endFillLength,
    innerRadius: shellInnerRadius,
    length: sidePieceLength,
    material: sideMaterial,
    outerRadius: shellOuterRadius,
    pivotOffsets,
    pinMaterial,
    side: -1,
    whiteMaterial,
  });
  root.add(leftSidePiece);

  const rightSidePiece = makeHalfTubeSidePiece({
    closedHalfGap,
    endFillLength: endFillLength,
    innerRadius: shellInnerRadius,
    length: sidePieceLength,
    material: sideMaterial,
    outerRadius: shellOuterRadius,
    pivotOffsets,
    pinMaterial,
    side: 1,
    whiteMaterial,
  });
  root.add(rightSidePiece);

  const rounds = [];
  const roundIndexes = [];
  for (let index = 0; index < roundCount; index += 1) {
    const round = foldingRod({length: roundLength, width: roundThickness,
      depth: roundDepth, bore: 0.064, material: roundMaterial,
      role: 'pivoted-ladder-round-folding-into-pole'});
    round.userData.role = 'pivoted-ladder-round-folding-into-pole';
    round.userData.roundIndex = index;
    root.add(round);
    rounds.push(round);

    const roundIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 16, 10),
      whiteMaterial,
    );
    roundIndex.userData.role = 'white-round-midpoint-motion-index';
    roundIndex.userData.roundIndex = index;
    root.add(roundIndex);
    roundIndexes.push(roundIndex);
  }

  const poleSectionGuide = new THREE.Mesh(
    new THREE.TorusGeometry(shellOuterRadius + 0.035, 0.012, 6, 48),
    brassMaterial,
  );
  poleSectionGuide.rotation.x = Math.PI / 2;
  poleSectionGuide.position.set(
    0,
    sidePieceCenterY,
    0,
  );
  poleSectionGuide.userData.role =
    'closed-round-pole-cross-section-reference-ring';
  poleSectionGuide.visible = false;
  root.add(poleSectionGuide);

  const foldSegmentDuration = foldingEndPhase * cycleDuration;
  const unfoldSegmentDuration = (
    unfoldingEndPhase - foldedDwellEndPhase
  ) * cycleDuration;

  const scheduleAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const phase = wrappedTime / cycleDuration;
    if (phase < foldingEndPhase) {
      const smooth = quinticState(phase / foldingEndPhase);
      return {
        acceleration: smooth.acceleration / foldSegmentDuration ** 2,
        fraction: smooth.value,
        rate: smooth.rate / foldSegmentDuration,
        stage: 'folding-rounds-into-side-pieces',
      };
    }
    if (phase < foldedDwellEndPhase) {
      return {
        acceleration: 0,
        fraction: 1,
        rate: 0,
        stage: 'closed-round-pole-dwell',
      };
    }
    if (phase < unfoldingEndPhase) {
      const local = (
        phase - foldedDwellEndPhase
      ) / (unfoldingEndPhase - foldedDwellEndPhase);
      const smooth = quinticState(local);
      return {
        acceleration: -smooth.acceleration / unfoldSegmentDuration ** 2,
        fraction: 1 - smooth.value,
        rate: -smooth.rate / unfoldSegmentDuration,
        stage: 'unfolding-rounds-to-ladder',
      };
    }
    return {
      acceleration: 0,
      fraction: 0,
      rate: 0,
      stage: 'open-ladder-dwell',
    };
  };

  const stateAtTime = (time) => {
    const schedule = scheduleAtTime(time);
    const foldAngle = closedFoldAngle * schedule.fraction;
    const foldAngularSpeed = closedFoldAngle * schedule.rate;
    const foldAngularAcceleration = closedFoldAngle
      * schedule.acceleration;
    const horizontalOffset = roundLength * Math.cos(foldAngle);
    const verticalOffset = roundLength * Math.sin(foldAngle);
    const horizontalOffsetRate = -roundLength
      * Math.sin(foldAngle) * foldAngularSpeed;
    const verticalOffsetRate = roundLength
      * Math.cos(foldAngle) * foldAngularSpeed;
    const leftCenter = new THREE.Vector3(
      -horizontalOffset / 2,
      sidePieceCenterY - verticalOffset / 2,
      0,
    );
    const rightCenter = new THREE.Vector3(
      horizontalOffset / 2,
      sidePieceCenterY + verticalOffset / 2,
      0,
    );
    const leftCenterVelocity = new THREE.Vector3(
      -horizontalOffsetRate / 2,
      -verticalOffsetRate / 2,
      0,
    );
    const rightCenterVelocity = new THREE.Vector3(
      horizontalOffsetRate / 2,
      verticalOffsetRate / 2,
      0,
    );
    const roundStates = pivotOffsets.map((pivotOffset, index) => {
      const leftPivot = leftCenter.clone();
      leftPivot.y += pivotOffset;
      const rightPivot = rightCenter.clone();
      rightPivot.y += pivotOffset;
      const midpoint = leftPivot.clone().add(rightPivot)
        .multiplyScalar(0.5);
      return {
        angle: foldAngle,
        angularSpeed: foldAngularSpeed,
        index,
        leftPivot,
        length: leftPivot.distanceTo(rightPivot),
        midpoint,
        pivotOffset,
        rightPivot,
      };
    });
    const leftShellAxisX = leftCenter.x + closedHalfGap;
    const rightShellAxisX = rightCenter.x - closedHalfGap;
    const maximumRoundRadialEnvelope = Math.hypot(
      horizontalOffset / 2 + roundJointRadius,
      roundDepth / 2,
    );
    return {
      closedFraction: schedule.fraction,
      foldAngle,
      foldAngularAcceleration,
      foldAngularSpeed,
      horizontalOffset,
      horizontalOffsetRate,
      leftCenter,
      leftCenterVelocity,
      leftShellAxisX,
      maximumRoundRadialEnvelope,
      rightCenter,
      rightCenterVelocity,
      rightShellAxisX,
      roundStates,
      stage: schedule.stage,
      verticalOffset,
      verticalOffsetRate,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    leftSidePiece.position.copy(state.leftCenter);
    rightSidePiece.position.copy(state.rightCenter);
    for (let index = 0; index < roundCount; index += 1) {
      const roundState = state.roundStates[index];
      rounds[index].userData.setEndpoints(
        roundState.leftPivot,
        roundState.rightPivot,
      );
      rounds[index].userData.endpoints = {
        end: roundState.rightPivot.clone(),
        start: roundState.leftPivot.clone(),
      };
      roundIndexes[index].position.copy(roundState.midpoint);
    }
    poleSectionGuide.visible = state.closedFraction > 0.985;
    poleSectionGuide.position.y = (
      state.leftCenter.y + state.rightCenter.y
    ) / 2;
    leftSidePiece.userData.velocity = state.leftCenterVelocity;
    rightSidePiece.userData.velocity = state.rightCenterVelocity;
    root.userData.contacts = {
      closedPoleShellSeam: {
        active: state.closedFraction > 0.999999,
        leftShellAxisX: state.leftShellAxisX,
        rightShellAxisX: state.rightShellAxisX,
        separation: Math.abs(
          state.rightShellAxisX - state.leftShellAxisX,
        ),
      },
      roundPivots: state.roundStates.map((roundState) => ({
        left: roundState.leftPivot,
        lengthResidual: roundState.length - roundLength,
        right: roundState.rightPivot,
      })),
    };
    root.userData.kinematics = state;
  };

  const openState = stateAtTime(0);
  const closedState = stateAtTime(foldingEndPhase * cycleDuration);
  root.userData = {
    archetype:
      'parallel-rounds-translating-half-shells-folding-library-ladder',
    blocks: {
      leftEndIndex: leftSidePiece.userData.endIndex,
      leftEndFillShell: leftSidePiece.userData.endFillShell,
      leftPivotIndexes: leftSidePiece.userData.pivotIndexes,
      leftPivotPins: leftSidePiece.userData.pivotPins,
      leftShell: leftSidePiece.userData.shell,
      leftSidePiece,
      poleSectionGuide,
      rightEndIndex: rightSidePiece.userData.endIndex,
      rightEndFillShell: rightSidePiece.userData.endFillShell,
      rightPivotIndexes: rightSidePiece.userData.pivotIndexes,
      rightPivotPins: rightSidePiece.userData.pivotPins,
      rightShell: rightSidePiece.userData.shell,
      rightSidePiece,
      roundIndexes,
      rounds,
    },
    constraintResiduals: {
      closedOffsetLength: Math.hypot(
        closedHorizontalGap,
        closedVerticalOffset,
      ) - roundLength,
      closedShellAxisCoincidence: closedState.rightShellAxisX
        - closedState.leftShellAxisX,
      closedVerticalOffsetEqualsPivotPitch:
        closedVerticalOffset - pivotPitch,
      openOffsetLength: openState.leftCenter.distanceTo(
        openState.rightCenter,
      ) - roundLength,
      roundEnvelopeInsidePoleAtClosure:
        Math.max(0, closedState.maximumRoundRadialEnvelope
          - shellInnerRadius),
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: [
        'relative side-piece center-offset angle, driven from horizontal open-ladder position to the near-vertical nested-pole position',
      ],
      note:
        'all four equal pivoted rounds remain mutually parallel and constrain the two nonrotating side pieces to one translational degree of freedom',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'both side pieces remain straight, parallel, and nonrotating',
        'all four rounds are equal rigid links with frictionless end pivots',
        'the complementary semicylindrical side pieces are represented as constant-section hollow shells',
        'folding is kinematically prescribed without mass, gravity, latch, hand force, or joint friction',
        'absolute scale, four-round choice, shell section, duration, easing, colors, and camera are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLatchOrForces: false,
      treatment:
        'exact one-degree-of-freedom parallel-link closure with a source-ratio terminal offset and smooth reciprocal demonstration',
    },
    fidelity: 'authored',
    geometry: {
      closedFoldAngle,
      closedHorizontalGap,
      closedVerticalOffset,
      pivotOffsets,
      pivotPitch,
      roundCount,
      roundDepth,
      roundJointRadius,
      roundLength,
      roundThickness,
      shellInnerRadius,
      shellOuterRadius,
      sidePieceCenterY,
      sidePieceLength,
      sourceClosedHorizontalOffset,
      sourceClosedVerticalOffset,
      sourceRoundLength,
      sourceScale,
    },
    mechanism:
      'two-parallel-complementary-hollow-side-pieces-four-equal-double-pivoted-rounds-open-ladder-to-closed-round-pole',
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      normalizedEventPhases: [
        0,
        foldingEndPhase,
        foldedDwellEndPhase,
        unfoldingEndPhase,
        1,
      ],
      sourceClosedHalfOffset: new THREE.Vector2(1, 6.928203),
      sourceOpenHalfOffset: new THREE.Vector2(7, 0),
      sourcePrescribedAbsoluteTiming: false,
      sourceViewBox: [-38, -38, 76, 76],
    },
    sourceReference: {
      brownPlate386: {
        closedPoleExtentPixels: {
          maximumX: 493,
          minimumX: 432,
        },
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
        openLadderRailCentersPixels: {
          leftX: 49,
          rightX: 158,
        },
        openRoundPivotYPixels: [136, 252, 370, 486],
        partlyFoldedRailCentersPixels: {
          leftX: 253,
          rightX: 355,
        },
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the library ladder is shown open, partly open, and closed',
          'each round is pivoted to both side pieces',
          'the side pieces fit together into a round pole when closed',
          'the rounds shut inside the closed side pieces',
        ],
        officialAnimationEvidence:
          'the official schematic moves a half-offset from (7,0) to (1,6.928203), preserving a 14-unit round length, and uses normalized phase boundaries 0, 0.4, 0.5, and 0.9',
        reconstructionDisclosure:
          'Brown\'s four engraved rounds are retained; hollow semicircular rail sections, 0.12 scale, absolute duration, quintic easing, depth, materials, and camera are independently engineered rather than copied from the proprietary canvas',
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
        foldedDwellStarts: foldingEndPhase * cycleDuration,
        foldingStarts: 0,
        openDwellStarts: unfoldingEndPhase * cycleDuration,
        unfoldingStarts: foldedDwellEndPhase * cycleDuration,
      },
      normalizedEventPhases: [
        0,
        foldingEndPhase,
        foldedDwellEndPhase,
        unfoldingEndPhase,
        1,
      ],
      note:
        'official event proportions are retained while quintic easing supplies zero velocity and acceleration at every motion/dwell boundary',
    },
    transmission: {
      closureLaw:
        'horizontalOffset^2 + verticalOffset^2 = roundLength^2 for every one of the four parallel rounds',
      closedNestingLaw:
        'verticalOffset equals one pivot pitch while horizontalOffset equals the complementary shell-pivot gap, so rounds line up inside one common round-pole bore',
      foldLaw:
        'horizontalOffset=L*cos(alpha), verticalOffset=L*sin(alpha)',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.52, -1.24, -0.62),
    new THREE.Vector3(1.52, 8.46, 0.62),
  );
  fitPistonGuide(root, update, cycleDuration);
  root.userData.groundFloorY = -0.82;
  markShadows(root);
  poleSectionGuide.castShadow = false;
  poleSectionGuide.receiveShadow = false;
  return {
    cameraDirection: new THREE.Vector3(2.5, 1.6, 10),
    root,
    update,
  };
}

export function createAuthoredFoldingLadderMovement(movement) {
  if (movement.id !== 386) return null;
  return foldingLibraryLadder(movement);
}
