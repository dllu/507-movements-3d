import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { boredRollGeometry, boredBlockGeometry, finishProcessPresentation } from './textile-planer-working-parts.js';
import { plate, poly } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeFaceIndexes({
  radius,
  rollerWidth,
  rotor,
  whiteMaterial,
}) {
  const indexes = [];
  for (const side of [-1, 1]) {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.48, 0.065, 0.035),
      whiteMaterial,
    );
    index.position.set(
      radius * 0.50,
      0,
      side * (rollerWidth / 2 + 0.024),
    );
    index.userData.role = 'white-roller-face-spin-index';
    index.userData.side = side;
    rotor.add(index);
    indexes.push(index);
  }
  return indexes;
}

function makeSmoothSupportingRoller({
  material,
  pinMaterial,
  radius,
  rollerWidth,
  whiteMaterial,
}) {
  const root = new THREE.Group();
  root.userData.role = 'smooth-lower-supporting-feed-roller';
  const rotor = new THREE.Group();
  root.add(rotor);

  const drum = cylinderAlongZ(radius, rollerWidth, material, 64);
  drum.geometry.dispose();
  drum.geometry = boredRollGeometry(radius, rollerWidth, 0.162, 192);
  drum.userData.role = 'smooth-cylindrical-workpiece-support-surface';
  rotor.add(drum);

  // Pass 101: the shaft ends 0.05 proud of the roller's front face (Brown's
  // section shows it cut flush there), so no long stub points at the camera;
  // behind, it still runs 0.43 into its bearing block.
  const shaft = cylinderAlongZ(0.16, rollerWidth + 0.48, pinMaterial, 28);
  shaft.position.z = -0.19;
  shaft.userData.role = 'lower-roller-shaft';
  rotor.add(shaft);

  const faceIndexes = makeFaceIndexes({
    radius,
    rollerWidth,
    rotor,
    whiteMaterial,
  });
  root.userData.drum = drum;
  root.userData.faceIndexes = faceIndexes;
  root.userData.rotor = rotor;
  root.userData.shaft = shaft;
  return markShadows(root);
}

// Brown's feed tooth (pass 67): a broad, shallow tooth filling its whole
// pitch. Slightly concave flanks rise from the valley circle to a short
// rounded crown, so the teeth are about a tenth of the roller's radius deep
// and several times as broad as they are high. The crown's outermost point
// lies exactly on the tip radius used by the bite calculation.
function bluntFeedToothGeometry(root, valley, tip, pitch, width) {
  const points = [[root * Math.cos(pitch / 2), -root * Math.sin(pitch / 2)]];
  const crownHalf = pitch * 0.1, crownDrop = (tip - valley) * 0.1;
  const flankTop = tip - crownDrop;
  // Leading flank: concave quarter-ellipse from the valley to the crown.
  for (let i = 0; i <= 14; i += 1) {
    const u = i / 14;
    const angle = -pitch / 2 + u * (pitch / 2 - crownHalf);
    const radius = valley + (flankTop - valley) * u ** 1.6;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  // Rounded crown.
  for (let i = 1; i < 10; i += 1) {
    const v = -1 + 2 * i / 10;
    const angle = v * crownHalf;
    const radius = tip - crownDrop * v * v;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  for (let i = 14; i >= 0; i -= 1) {
    const u = i / 14;
    const angle = pitch / 2 - u * (pitch / 2 - crownHalf);
    const radius = valley + (flankTop - valley) * u ** 1.6;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  points.push([root * Math.cos(pitch / 2), root * Math.sin(pitch / 2)]);
  return plate(poly(points), -width / 2, width / 2);
}

function makeToothedFeedRoller({
  material,
  pinMaterial,
  pitchRadius,
  rollerWidth,
  rootRadius,
  toothCount,
  toothTipRadius,
  whiteMaterial,
}) {
  const root = new THREE.Group();
  root.userData.role = 'toothed-upper-woodworth-feed-roller';
  const rotor = new THREE.Group();
  root.add(rotor);

  // The body runs out to the tooth valleys.
  const valleyRadius = rootRadius;
  const core = cylinderAlongZ(valleyRadius, rollerWidth, material, 64);
  core.geometry.dispose();
  core.geometry = boredRollGeometry(valleyRadius, rollerWidth, 0.152, 160);
  core.userData.role = 'toothed-feed-roller-root-cylinder';
  rotor.add(core);

  // Brown's inner circle on the roller face (about 0.74 of the tip radius) is
  // the edge of a shallow raised hub boss on each face, chamfered so that its
  // rim reads in the face-on view as a circle.
  const bossRadius = toothTipRadius * 0.74;
  const bosses = [];
  for (const side of [-1, 1]) {
    const face = rollerWidth / 2;
    const profile = [
      { radial: bossRadius, axial: face - 0.01 },
      { radial: bossRadius, axial: face + 0.014 },
      { radial: bossRadius - 0.035, axial: face + 0.045 },
    ].map(({ radial, axial }) => ({ radial, axial: side * axial }));
    const boss = new THREE.Mesh(
      boredLatheGeometry(side > 0 ? profile : profile.reverse(), 0.152, 128),
      material,
    );
    boss.rotation.x = Math.PI / 2;
    boss.userData.role = 'toothed-feed-roller-raised-hub-boss';
    boss.userData.side = side;
    rotor.add(boss);
    bosses.push(boss);
  }

  const toothPitch = FULL_TURN / toothCount;
  const teeth = [];
  for (let index = 0; index < toothCount; index += 1) {
    const baseAngle = -Math.PI / 2 + index * toothPitch;
    const tooth = new THREE.Mesh(
      bluntFeedToothGeometry(valleyRadius - 0.03, valleyRadius, toothTipRadius, toothPitch, rollerWidth * 0.96),
      material,
    );
    tooth.rotation.z = baseAngle;
    tooth.userData.baseAngle = baseAngle;
    tooth.userData.role = 'radial-work-gripping-feed-tooth';
    tooth.userData.toothIndex = index;
    rotor.add(tooth);
    teeth.push(tooth);
  }

  // Pass 101: the shaft ends 0.05 proud of the roller's front face (Brown's
  // section shows it cut flush there), so no long stub points at the camera;
  // behind, it still runs 0.43 into its bearing block.
  const shaft = cylinderAlongZ(0.15, rollerWidth + 0.48, pinMaterial, 28);
  shaft.position.z = -0.19;
  shaft.userData.role = 'upper-roller-shaft';
  rotor.add(shaft);

  const faceIndexes = makeFaceIndexes({
    radius: rootRadius,
    rollerWidth,
    rotor,
    whiteMaterial,
  });
  root.userData.bosses = bosses;
  root.userData.core = core;
  root.userData.faceIndexes = faceIndexes;
  root.userData.rotor = rotor;
  root.userData.shaft = shaft;
  root.userData.teeth = teeth;
  return markShadows(root);
}

function makeRollerFrame({
  lowerCenter,
  material,
  rollerWidth,
  upperCenter,
}) {
  const group = new THREE.Group();
  group.userData.role = 'fixed-planer-feed-roller-bearing-frame';
  const bearingBlocks = [];
  const bearingRings = [];
  const standards = [];
  const arms = [];
  const bearingZ = rollerWidth / 2 + 0.20;

  // Brown's view is a section through the shafts, so no near bearings are
  // built. The far bearings are deep bored bosses on one upright standing on
  // a foot directly behind the rollers, clear of the shaft ends and hidden
  // behind the rollers in Brown's view. (The shafts overhang these bearings.)
  const rearStandardZ = -(bearingZ + 0.325);
  const standard = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, upperCenter.y + 1.71, 0.14),
    material,
  );
  standard.position.set(0, (upperCenter.y - 1.21) / 2, rearStandardZ);
  standard.userData.role = 'fixed-planer-feed-frame-standard';
  group.add(standard);
  standards.push(standard);
  for (const center of [lowerCenter, upperCenter]) {
    const bore = center.y === lowerCenter.y ? 0.164 : 0.154;
    const block = new THREE.Mesh(
      boredBlockGeometry(0.48, 0.48, 0.355, bore),
      material,
    );
    block.position.set(0, center.y, -bearingZ - 0.0775);
    block.userData.role = 'roller-shaft-bearing-block';
    group.add(block);
    bearingBlocks.push(block);
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.10, 0.24, 0.70),
    material,
  );
  base.position.set(0, -1.58, rearStandardZ + 0.20);
  base.userData.role = 'planer-feed-frame-base';
  group.add(base);

  group.userData.arms = arms;
  group.userData.base = base;
  group.userData.bearingBlocks = bearingBlocks;
  group.userData.bearingRings = bearingRings;
  group.userData.standards = standards;
  return markShadows(group);
}

function makePeriodicWorkpiece({
  boardCenterY,
  markerPitch,
  material,
  thickness,
  width,
  whiteMaterial,
  workpieceLength,
}) {
  const group = new THREE.Group();
  group.userData.role = 'continuously-fed-planer-workpiece-material-frame';

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(workpieceLength, thickness, width),
    material,
  );
  board.position.y = boardCenterY;
  board.userData.role = 'wood-plank-between-feed-rollers';
  group.add(board);

  const markers = [];
  const markerCount = Math.ceil(workpieceLength / markerPitch) + 5;
  for (let index = -markerCount; index <= markerCount; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.025, width * 0.64),
      whiteMaterial,
    );
    marker.position.set(
      index * markerPitch,
      boardCenterY + thickness / 2 + 0.014,
      0,
    );
    marker.userData.materialStation = index * markerPitch;
    marker.userData.role = 'white-fed-workpiece-material-index';
    group.add(marker);
    markers.push(marker);
  }
  group.userData.board = board;
  group.userData.markers = markers;
  return markShadows(group);
}

function woodworthPlanerFeed(movement) {
  const root = new THREE.Group();

  // The official canvas puts the lower center at y=0, its smooth contact at
  // y=4, the plank faces at y=4 and y=5, and the toothed-roller center at
  // y=9.  Thus both working radii are exactly 4 and must turn at equal and
  // opposite angular speeds for no-slip feed.
  const sourceWorkingRadius = 4;
  const sourcePlankThickness = 1;
  const sourceCenterDistance = 9;
  // Brown's teeth are shallow: their valleys lie at about 0.89 of the tip
  // radius (measured on the plate: tips 67.5 px, valleys 60 px).
  const sourceUpperRootRadius = 3.7;
  const sourceToothCount = 20;
  const sourceScale = 0.32;
  const workingRadius = sourceWorkingRadius * sourceScale;
  const plankThickness = sourcePlankThickness * sourceScale;
  const centerDistance = sourceCenterDistance * sourceScale;
  const upperRootRadius = sourceUpperRootRadius * sourceScale;
  const toothCount = sourceToothCount;
  const toothPitch = FULL_TURN / toothCount;
  const toothTipRadius = workingRadius + 0.05;
  const rollerWidth = 1.42;
  const plankWidth = 0.94;
  const lowerCenter = new THREE.Vector3(0, 0, 0);
  const upperCenter = new THREE.Vector3(0, centerDistance, 0);
  const boardBottomY = workingRadius;
  const boardTopY = boardBottomY + plankThickness;
  const boardCenterY = (boardBottomY + boardTopY) / 2;
  const cycleDuration = 6.4;
  const angularSpeed = FULL_TURN / cycleDuration;
  const feedSpeed = workingRadius * angularSpeed;
  const feedTravelPerCycle = FULL_TURN * workingRadius;
  const markerRepeatsPerCycle = 5;
  const markerPitch = feedTravelPerCycle / markerRepeatsPerCycle;
  const workpieceLength = 10.2;

  const upperMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const lowerMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.56,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const boardMaterial = matte(PALETTE.brass, {
    metalness: 0.02,
    roughness: 0.73,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.43,
  });

  const lowerRoller = makeSmoothSupportingRoller({
    material: lowerMaterial,
    pinMaterial,
    radius: workingRadius,
    rollerWidth,
    whiteMaterial,
  });
  lowerRoller.position.copy(lowerCenter);
  root.add(lowerRoller);

  const upperRoller = makeToothedFeedRoller({
    material: upperMaterial,
    pinMaterial,
    pitchRadius: workingRadius,
    rollerWidth,
    rootRadius: upperRootRadius,
    toothCount,
    toothTipRadius,
    whiteMaterial,
  });
  upperRoller.position.copy(upperCenter);
  root.add(upperRoller);

  const workpiece = makePeriodicWorkpiece({
    boardCenterY,
    markerPitch,
    material: boardMaterial,
    thickness: plankThickness,
    whiteMaterial,
    width: plankWidth,
    workpieceLength,
  });
  root.add(workpiece);

  const frame = makeRollerFrame({
    lowerCenter,
    material: frameMaterial,
    rollerWidth,
    upperCenter,
  });
  root.add(frame);

  const lowerContactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 16, 10),
    whiteMaterial,
  );
  lowerContactIndex.position.set(0, boardBottomY, rollerWidth / 2 + 0.055);
  lowerContactIndex.userData.role = 'white-lower-no-slip-contact-index';
  root.add(lowerContactIndex);

  const upperContactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 16, 10),
    whiteMaterial,
  );
  upperContactIndex.position.set(0, boardTopY, rollerWidth / 2 + 0.055);
  upperContactIndex.userData.role = 'white-upper-pitch-contact-index';
  root.add(upperContactIndex);

  const stateAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const phase = wrappedTime / cycleDuration;
    const upperAngle = FULL_TURN * phase;
    const lowerAngle = -upperAngle;
    const feedDisplacement = workingRadius * upperAngle;
    const workpieceOffset = feedDisplacement - feedTravelPerCycle / 2;
    const activeToothIndex = positiveModulo(
      -Math.round(upperAngle / toothPitch),
      toothCount,
    );
    const activeToothAngle = -Math.PI / 2
      + activeToothIndex * toothPitch + upperAngle;
    const toothAngleFromNip = Math.atan2(
      Math.sin(activeToothAngle + Math.PI / 2),
      Math.cos(activeToothAngle + Math.PI / 2),
    );
    const activeToothTip = upperCenter.clone().add(
      new THREE.Vector3(
        toothTipRadius * Math.sin(toothAngleFromNip),
        -toothTipRadius * Math.cos(toothAngleFromNip),
        0,
      ),
    );
    const toothBiteDepth = boardTopY - activeToothTip.y;
    const lowerContact = new THREE.Vector3(0, boardBottomY, 0);
    const upperPitchContact = new THREE.Vector3(0, boardTopY, 0);
    const feedVelocity = new THREE.Vector3(feedSpeed, 0, 0);
    return {
      activeToothAngle,
      activeToothIndex,
      activeToothTip,
      boardBottomY,
      boardTopY,
      feedDisplacement,
      feedSpeed,
      feedVelocity,
      lowerAngle,
      lowerAngularSpeed: -angularSpeed,
      lowerContact,
      lowerSurfaceVelocity: feedVelocity.clone(),
      phase,
      toothAngleFromNip,
      toothBiteDepth,
      upperAngle,
      upperAngularSpeed: angularSpeed,
      upperPitchContact,
      upperPitchSurfaceVelocity: feedVelocity.clone(),
      workpieceOffset,
    };
  };

  // Brown hatches the plank's face: engraving notation, not modelled. The
  // front face instead carries faint lengthwise wood grain, a slightly darker
  // shade of the plank, in short irregular streaks that travel with the fed
  // stock (pitch divides the per-cycle feed, so the cycle closes seamlessly)
  // and are clipped at the ends of the observation window.
  const grainPitch = feedTravelPerCycle / 40;
  const grainMaxLength = 4.5 * grainPitch;
  const grainBottomY = boardBottomY + 0.035;
  const grainTopY = boardTopY - 0.035;
  const grainZ = plankWidth / 2 + 0.002;
  const grainCount = Math.ceil((workpieceLength + grainMaxLength) / grainPitch) + 2;
  const grainPositions = new Float32Array(grainCount * 4 * 3);
  const grainIndices = [];
  for (let index = 0; index < grainCount; index += 1) {
    const v = index * 4;
    grainIndices.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  const grainGeometry = new THREE.BufferGeometry();
  const grainAttribute = new THREE.BufferAttribute(grainPositions, 3);
  grainAttribute.setUsage(THREE.DynamicDrawUsage);
  grainGeometry.setAttribute('position', grainAttribute);
  grainGeometry.setAttribute('normal', new THREE.BufferAttribute(
    new Float32Array(grainCount * 4 * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  grainGeometry.setIndex(grainIndices);
  const plankGrain = new THREE.Mesh(grainGeometry, matte(
    new THREE.Color(PALETTE.brass).multiplyScalar(0.84), { roughness: 0.8, side: THREE.DoubleSide }));
  plankGrain.userData.role = 'plank-front-face-wood-grain-moving-with-feed';
  plankGrain.castShadow = false;
  plankGrain.receiveShadow = false;
  root.add(plankGrain);
  const halfWindow = workpieceLength / 2;
  const clampX = (x) => THREE.MathUtils.clamp(x, -halfWindow, halfWindow);
  // Irregular heights, lengths and weights, repeating once per cycle's feed,
  // make the travel unambiguous.
  const grainStationsPerCycle = 40;
  const unit = (j, a, b) => 0.5 + 0.5 * Math.sin(a * j + b * Math.sin(1.7 * j + 0.4));
  const grainJitter = Array.from({length: grainStationsPerCycle}, (_, j) => ({
    shift: 0.32 * grainPitch * Math.sin(2.3 * j + 0.7 * Math.sin(5.1 * j)),
    y: grainBottomY + (grainTopY - grainBottomY) * unit(j, 7.31, 2.1),
    length: grainMaxLength * (0.35 + 0.65 * unit(j, 3.17, 1.3)),
    half: 0.004 + 0.004 * unit(j, 5.93, 0.8),
  }));
  const updateGrain = (offset) => {
    const firstStation = Math.floor((-halfWindow - grainMaxLength - offset) / grainPitch) - 1;
    for (let index = 0; index < grainCount; index += 1) {
      const station = firstStation + index;
      const jitter = grainJitter[positiveModulo(station, grainStationsPerCycle)];
      const x = station * grainPitch + jitter.shift + offset;
      const {y, length, half} = jitter;
      const corners = [
        [x, y - half], [x + length, y - half],
        [x + length, y + half], [x, y + half],
      ];
      corners.forEach(([cx, cy], corner) => {
        const offsetIndex = (index * 4 + corner) * 3;
        grainPositions[offsetIndex] = clampX(cx);
        grainPositions[offsetIndex + 1] = cy;
        grainPositions[offsetIndex + 2] = grainZ;
      });
    }
    grainAttribute.needsUpdate = true;
    grainGeometry.computeBoundingSphere();
    grainGeometry.computeBoundingBox();
  };

  const update = (time) => {
    const state = stateAtTime(time);
    updateGrain(state.workpieceOffset);
    upperRoller.userData.rotor.rotation.z = state.upperAngle;
    lowerRoller.userData.rotor.rotation.z = state.lowerAngle;
    workpiece.position.x = state.workpieceOffset;
    // The plank is a fixed observation window of long stock. Material indexes
    // translate at the prescribed feed speed and disappear only at its edges.
    workpiece.userData.board.position.x = -state.workpieceOffset;
    for (const marker of workpiece.userData.markers) {
      const edgeDistance = workpieceLength / 2 - Math.abs(marker.position.x + state.workpieceOffset);
      marker.visible = edgeDistance > 0;
      marker.scale.x = THREE.MathUtils.clamp(edgeDistance / 0.0275, 0, 1);
    }
    workpiece.userData.materialVelocity = state.feedVelocity.clone();
    root.userData.contacts = {
      lowerSmoothNip: {
        boardPoint: state.lowerContact.clone(),
        normalGap: state.boardBottomY
          - (lowerCenter.y + workingRadius),
        rollerPoint: state.lowerContact.clone(),
        slipVelocity: state.lowerSurfaceVelocity.x - state.feedSpeed,
      },
      upperToothedNip: {
        activeToothIndex: state.activeToothIndex,
        pitchPoint: state.upperPitchContact.clone(),
        pitchSlipVelocity:
          state.upperPitchSurfaceVelocity.x - state.feedSpeed,
        toothBiteDepth: state.toothBiteDepth,
        toothTip: state.activeToothTip.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const sourceToothCenterRadius = Math.hypot(0.740058, 4.672543);
  root.userData = {
    archetype:
      'equal-working-radius-toothed-upper-feed-and-smooth-lower-support-roller-planer-nip',
    blocks: {
      frame,
      frameArms: frame.userData.arms,
      frameBearingBlocks: frame.userData.bearingBlocks,
      frameBearingRings: frame.userData.bearingRings,
      lowerContactIndex,
      lowerFaceIndexes: lowerRoller.userData.faceIndexes,
      lowerRoller,
      lowerRotor: lowerRoller.userData.rotor,
      upperContactIndex,
      upperFaceIndexes: upperRoller.userData.faceIndexes,
      upperRoller,
      upperRotor: upperRoller.userData.rotor,
      upperTeeth: upperRoller.userData.teeth,
      workpiece,
      workpieceBoard: workpiece.userData.board,
      workpieceIndexes: workpiece.userData.markers,
    },
    constraintResiduals: {
      centerStack:
        workingRadius + plankThickness + workingRadius - centerDistance,
      lowerBoardContact: boardBottomY - (lowerCenter.y + workingRadius),
      noSlipSpeed: workingRadius * angularSpeed - feedSpeed,
      sourceCenterStack:
        sourceWorkingRadius * 2 + sourcePlankThickness
          - sourceCenterDistance,
      upperBoardPitchContact:
        upperCenter.y - workingRadius - boardTopY,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: ['constant angular coordinate of the toothed upper feed roller'],
      note:
        'the plank feed and smooth lower-roller rotation are constrained by equal 4-unit working radii and zero slip at both faces of the nip',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'both roller axes are fixed, parallel, and frictionless',
        'the upper tooth tips grip the wood while its 4-unit pitch circle defines mean feed speed',
        'mean feed is prescribed without slip on the smooth lower roller; the upper points intentionally indent the wood, whose deformation and local tip slip are not solved',
        'the source does not specify torque, bearing load, timber properties, tooth penetration compliance, inertia, or absolute speed',
        'absolute scale and period, slight tooth bite, axial widths, repeated long-stock representation, frame, materials, and camera are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      treatment:
        'exact equal-pitch-radius no-slip feed kinematics with a periodic long-stock visualization and explicit tooth engagement',
    },
    fidelity: 'authored',
    geometry: {
      boardBottomY,
      boardCenterY,
      boardTopY,
      centerDistance,
      lowerCenter: lowerCenter.clone(),
      markerPitch,
      markerRepeatsPerCycle,
      plankThickness,
      plankWidth,
      rollerWidth,
      sourceCenterDistance,
      sourcePlankThickness,
      sourceScale,
      sourceToothCenterRadius,
      sourceToothCount,
      sourceUpperRootRadius,
      sourceWorkingRadius,
      toothCount,
      toothPitch,
      toothTipRadius,
      upperCenter: upperCenter.clone(),
      upperRootRadius,
      workingRadius,
      workpieceLength,
    },
    mechanism:
      'woodworth-planer-one-toothed-upper-feed-roller-one-smooth-lower-support-roller-rigid-plank-equal-opposed-no-slip-working-speeds',
    sourceAnimation: {
      available: true,
      lowerRotationTurnsPerCycle: -1,
      officialCanvasModelPresent: true,
      sourceLowerCenter: [0, 0],
      sourceLowerRadius: 4,
      sourcePlankFacesY: [4, 5],
      sourcePrescribedAbsoluteTiming: false,
      sourceToothArcCount: 20,
      sourceToothArcRadius: 1,
      sourceToothCenterRadius,
      sourceUpperCenter: [0, 9],
      sourceUpperRootRadius: 3,
      sourceViewBox: [-12.5, -8, 25, 25],
      upperRotationTurnsPerCycle: 1,
    },
    sourceReference: {
      brownPlate388: {
        feedArrowPixels: {
          end: [184, 310],
          start: [83, 310],
        },
        imageHeight: 525,
        imageWidth: 525,
        lowerRollerCenterPixels: [263, 366],
        lowerRollerRadiusPixels: 69,
        measurementUncertaintyPixels: 6,
        plankFacesYPixels: [272, 297],
        upperRootRadiusPixels: 51,
        upperRollerCenterPixels: [263, 202],
        upperToothTipRadiusPixels: 69,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is the feed motion of Woodworth\'s planing machine',
          'the lower supporting roller is smooth',
          'the top feed roller is toothed',
        ],
        officialAnimationEvidence:
          'the official canvas places a 4-unit smooth roller below plank faces y=4 and y=5, a 20-tooth roller centered at y=9 with a 3-unit root, and commands exactly +1 and -1 turn per cycle',
        reconstructionDisclosure:
          'source centers, working radius ratio, plank thickness, tooth count, and opposed rotations are retained; the physically implied plank translation, tooth solids and slight bite, long-stock tiling, absolute period and scale, axial stack, bearings, materials, indexes, and camera are independently engineered rather than copied from the proprietary canvas',
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
        oneOpposedRollerRevolution: cycleDuration,
        start: 0,
      },
      note:
        'one source-normalized revolution is displayed at a chosen constant rate; repeated material indexes make the no-slip feed continuous across the visual cycle boundary',
    },
    transmission: {
      angularRatio:
        'lowerAngularSpeed/upperAngularSpeed=-workingRadius/workingRadius=-1',
      feedLaw:
        'feedSpeed=workingRadius*upperAngularSpeed=-workingRadius*lowerAngularSpeed',
      nipStackLaw:
        'centerDistance=lowerWorkingRadius+plankThickness+upperWorkingRadius=9 source units',
      toothEngagementLaw:
        'the nearest of 20 upper teeth maintains a small positive bite while the 4-unit pitch point is the no-slip velocity reference',
    },
  };

  lowerContactIndex.visible = false;
  upperContactIndex.visible = false;
  finishProcessPresentation(root, cycleDuration, 'The two rollers turn at equal opposite rates, as in the official animation. Mean feed follows their equal working radii. Pointed upper teeth indent the wood by 0.034–0.050 model units; this illustrates compliant gripping, not rigid nonpenetration or a validated traction force. The plank is a fixed window of continuously moving long stock.');
  root.userData.workingInterfaces = { stockObservationLength: workpieceLength, upperToothMaximumRadius: toothTipRadius, prescribedWoodIndentation: true, rigidContactValidated: false };
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.55, -1.84, -1.62),
    new THREE.Vector3(5.55, 4.43, 1.62),
  );
  root.userData.cameraDistanceScale = 1;
  root.userData.groundFloorY = -1.69;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.1, 0.08, 16),
    root,
    update,
  };
}

export function createAuthoredPlanerFeedMovement(movement) {
  if (movement.id !== 388) return null;
  return woodworthPlanerFeed(movement);
}
