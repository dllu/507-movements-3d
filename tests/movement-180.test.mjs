import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  const actual2 = new THREE.Vector2(actual.x, actual.y);
  const expected2 = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actual2.distanceTo(expected2) <= tolerance,
    `${message}: expected ${expected2.toArray()}, received ${actual2.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

test('movement 180 wedges one upward-sliding board between one fixed side-piece and one pivoted eccentric jaw', () => {
  const movement = catalog.movements[179];
  const model = createMovementModel(movement);
  const {
    blocks,
    canonicalStates,
    closureLawAtCycleTime,
    geometry,
    modelPointToSourceRaster,
    sourcePointToModel,
    stateAtCycleTime,
    stateAtTime,
  } = model.root.userData;
  const {
    benchBase,
    fixedContactMarker,
    fixedScrewHeads,
    fixedScrewShafts,
    fixedScrewSlots,
    fixedScrews,
    fixedSideFaceWitness,
    fixedSideOutline,
    fixedSidePiece,
    jawContactAnchor,
    jawOutline,
    jawPivotAnchor,
    jawPlate,
    jawRotationIndex,
    jawScrew,
    jawScrewHead,
    jawScrewShaft,
    jawScrewSlot,
    jawWasher,
    movingContactMarker,
    pivotedJaw,
    workpiece,
    workpieceBody,
    workpieceInputIndex,
    workpieceLeadingEdgeAnchor,
    workpieceOutline,
    workpieceRightFaceAnchor,
  } = blocks;

  assert.equal(movement.id, 180);
  assert.equal(movement.number, '180');
  assert.equal(
    movement.title,
    'Single-Pivot Eccentric Bench Clamp with Fixed Side-Piece',
  );
  assert.equal(movement.category, 'Presses & clamps');
  assert.equal(
    movement.description,
    '180. This only differs from 174 in being composed of a single pivoted clamp operating in connection with a fixed side-piece.',
  );
  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_180.html');
  assert.equal(
    movement.archetype,
    'single-pivoted-eccentric-jaw-fixed-side-piece-self-energizing-bench-clamp',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'fixed-straight-side-piece-single-screw-pivoted-eccentric-jaw-upward-friction-self-clamping-board',
  );
  for (const fn of [
    closureLawAtCycleTime,
    modelPointToSourceRaster,
    sourcePointToModel,
    stateAtCycleTime,
    stateAtTime,
  ]) {
    assert.equal(typeof fn, 'function');
  }

  // The topology is deliberately asymmetric: exactly one fixed straight
  // side, exactly one rotating jaw, one large jaw screw, and two smaller
  // screws which remain fixed with the straight side-piece.
  for (const object of [
    benchBase,
    fixedContactMarker,
    fixedSideFaceWitness,
    fixedSideOutline,
    fixedSidePiece,
    jawContactAnchor,
    jawOutline,
    jawPivotAnchor,
    jawPlate,
    jawRotationIndex,
    jawScrew,
    jawScrewHead,
    jawScrewShaft,
    jawScrewSlot,
    jawWasher,
    movingContactMarker,
    pivotedJaw,
    workpiece,
    workpieceBody,
    workpieceInputIndex,
    workpieceLeadingEdgeAnchor,
    workpieceOutline,
    workpieceRightFaceAnchor,
  ]) {
    assert.ok(object?.isObject3D, `${object?.userData?.role ?? 'block'} is 3D`);
  }
  assert.equal(fixedScrews.length, 2);
  assert.equal(fixedScrewHeads.length, 2);
  assert.equal(fixedScrewShafts.length, 2);
  assert.equal(fixedScrewSlots.length, 2);
  assert.ok(fixedScrews.every(({ parent }) => parent === model.root));
  assert.equal(pivotedJaw.parent, model.root);
  assert.equal(fixedSidePiece.parent, model.root);
  assert.equal(workpiece.parent, model.root);
  assert.equal(jawScrew.parent, model.root);
  assert.equal(jawPlate.parent, pivotedJaw);
  assert.equal(jawContactAnchor.parent, pivotedJaw);
  assert.equal(jawPivotAnchor.parent, pivotedJaw);
  assert.equal(workpieceBody.parent, workpiece);
  assert.equal(workpieceLeadingEdgeAnchor.parent, workpiece);
  assert.equal(workpieceRightFaceAnchor.parent, workpiece);
  assert.equal(fixedContactMarker.parent, workpiece);
  assert.equal(geometry.axis.equals(new THREE.Vector3(0, 0, 1)), true);

  // Locks measured from the 525 px public-domain plate preserve the fixed
  // bar, board, jaw pivot, source contact, and three screw locations.
  assert.equal(geometry.sourceImageWidth, 525);
  assert.equal(geometry.sourceImageHeight, 525);
  near(geometry.sourceScale, 0.012, 0, 'source scale');
  assert.deepEqual(geometry.sourceOrigin.toArray(), [280, 452]);
  assert.equal(geometry.sourceFixedSideMinimumX, 160);
  assert.equal(geometry.sourceFixedSideMaximumX, 226);
  assert.equal(geometry.sourceFixedSideTop, 10);
  assert.equal(geometry.sourceFixedSideBottom, 515);
  assert.deepEqual(
    geometry.sourceFixedScrewCenters.map((point) => point.toArray()),
    [[192, 180], [192, 450]],
  );
  assert.equal(geometry.sourceWorkpieceLeft, 226);
  assert.equal(geometry.sourceWorkpieceRight, 280);
  assert.equal(geometry.sourceWorkpieceTop, 154);
  assert.equal(geometry.sourceWorkpieceBottom, 520);
  assert.deepEqual(geometry.sourceJawPivot.toArray(), [354, 300]);
  assert.deepEqual(geometry.sourceJawContact.toArray(), [280, 452]);
  assert.equal(geometry.sourcePivotHeadRadius, 29);
  assert.equal(geometry.sourceFixedHeadRadius, 15);
  assert.equal(geometry.sourceJawOutline.length, 53);
  assert.equal(
    geometry.sourceJawContactIndex,
    geometry.sourceJawOutline.findIndex(
      (point) => point.equals(geometry.sourceJawContact),
    ),
  );
  assert.equal(
    geometry.sourceJawOutline[geometry.sourceVisibleJawOutlineEndIndex]
      .equals(new THREE.Vector2(226, 94)),
    true,
  );
  assert.equal(geometry.sourceFixedSideOutline.length, 12);
  assert.equal(geometry.sourceWorkpieceOutline.length, 11);

  vector2Near(
    sourcePointToModel(geometry.sourceJawPivot),
    geometry.jawPivot,
    0,
    'source jaw pivot',
  );
  vector2Near(
    sourcePointToModel(geometry.sourceJawContact),
    new THREE.Vector2(geometry.workpieceRightX, 0),
    0,
    'source moving-jaw contact',
  );
  near(
    sourcePointToModel(new THREE.Vector2(226, 452)).x,
    geometry.fixedSideFaceX,
    0,
    'source fixed contact face',
  );
  for (const rasterPoint of [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(160, 10),
    new THREE.Vector2(226, 154),
    new THREE.Vector2(280, 452),
    new THREE.Vector2(354, 300),
    new THREE.Vector2(525, 525),
  ]) {
    vector2Near(
      modelPointToSourceRaster(sourcePointToModel(rasterPoint)),
      rasterPoint,
      6e-14,
      'source/model coordinate round trip',
    );
  }
  near(geometry.workpieceWidth, 54 * geometry.sourceScale, 1e-15,
    'source board width');
  near(
    geometry.fixedSideFaceX - geometry.fixedSideMinimumX,
    66 * geometry.sourceScale,
    1e-15,
    'source fixed-side width',
  );
  near(geometry.jawContactRadius, geometry.jawContactLocal.length(), 0,
    'source contact radius');

  // Brown's dotted upper tail is actually present, but it occupies a plane
  // beneath the fixed side-piece. The board overlaps both jaw depths so the
  // side contacts are genuinely three-dimensional.
  const benchTopZ = geometry.benchCenterZ + geometry.benchDepth / 2;
  const jawBottomZ = geometry.jawPlaneZ - geometry.jawDepth / 2;
  const jawTopZ = geometry.jawPlaneZ + geometry.jawDepth / 2;
  const boardBottomZ = geometry.workpieceCenterZ
    - geometry.workpieceDepth / 2;
  const boardTopZ = geometry.workpieceCenterZ
    + geometry.workpieceDepth / 2;
  const fixedBottomZ = geometry.fixedSideCenterZ
    - geometry.fixedSideDepth / 2;
  const fixedTopZ = geometry.fixedSideCenterZ
    + geometry.fixedSideDepth / 2;
  near(benchTopZ, jawBottomZ - 0.01, 1e-16,
    'moving jaw rests immediately above bench bed');
  assert.ok(boardBottomZ < jawTopZ && boardTopZ > jawBottomZ,
    'board depth overlaps moving jaw depth');
  assert.ok(boardBottomZ < fixedTopZ && boardTopZ > fixedBottomZ,
    'board depth overlaps fixed side depth');
  assert.ok(fixedBottomZ > jawTopZ,
    'fixed side visibly covers the dotted hidden tail without interpenetration');

  const sourceClosed = canonicalStates.sourceClosed;
  const releaseMidpoint = canonicalStates.releaseMidpoint;
  const fullyOpen = canonicalStates.fullyOpen;
  const insertionMidpoint = canonicalStates.insertionMidpoint;
  const relocked = canonicalStates.relocked;
  near(sourceClosed.jawAngle, 0, 0, 'source jaw angle');
  near(sourceClosed.workpieceTranslationY, 0, 0,
    'source board translation');
  near(sourceClosed.fixedSideContactGap, 0, 0,
    'source fixed-side contact');
  near(sourceClosed.movingJawContactGap, 0, 0,
    'source marked jaw contact');
  near(sourceClosed.minimumJawProfileGap, 0, 0,
    'source whole-profile contact');
  assert.equal(
    sourceClosed.minimumJawProfilePointIndex,
    geometry.sourceJawContactIndex,
  );
  assert.equal(sourceClosed.clamped, true);
  assert.equal(sourceClosed.movingJawCount, 1);
  assert.equal(sourceClosed.fixedSideCount, 1);
  assert.ok(sourceClosed.upwardInsertionFrictionTorque < 0,
    'upward friction produces clockwise closing torque');

  near(releaseMidpoint.clampClosure, 0.5, 2e-15,
    'release midpoint closure');
  near(releaseMidpoint.jawAngle, geometry.openJawAngle / 2, 4e-16,
    'release midpoint jaw angle');
  near(
    releaseMidpoint.workpieceTranslationY,
    -geometry.workpieceReleaseTravel / 2,
    4e-15,
    'release midpoint downward board travel',
  );
  assert.ok(releaseMidpoint.workpieceVelocityY < 0,
    'withdrawal moves board downward');
  assert.ok(releaseMidpoint.jawAngularVelocity > 0,
    'withdrawal opens jaw counterclockwise');
  assert.ok(releaseMidpoint.minimumJawProfileGap > 0);
  assert.equal(releaseMidpoint.clamped, false);

  near(fullyOpen.clampClosure, 0, 0, 'fully open closure');
  near(fullyOpen.jawAngle, geometry.openJawAngle, 0,
    'fully open jaw angle');
  near(
    fullyOpen.workpieceTranslationY,
    -geometry.workpieceReleaseTravel,
    0,
    'fully withdrawn board',
  );
  assert.ok(fullyOpen.minimumJawProfileGap > 0.20,
    'full jaw profile clears board when open');
  near(fullyOpen.jawAngularVelocity, 0, 0, 'open dwell jaw speed');
  near(fullyOpen.workpieceVelocityY, 0, 0, 'open dwell board speed');

  near(insertionMidpoint.clampClosure, 0.5, 9e-16,
    'insertion midpoint closure');
  assert.ok(insertionMidpoint.workpieceVelocityY > 0,
    'insertion pushes board upward');
  assert.ok(insertionMidpoint.jawAngularVelocity < 0,
    'upward insertion turns jaw clockwise');
  assert.ok(insertionMidpoint.upwardInsertionFrictionTorque < 0,
    'contact arm retains clockwise self-energizing sense');
  near(relocked.jawAngle, 0, 0, 'relocked source jaw angle');
  near(relocked.workpieceTranslationY, 0, 0,
    'relocked source board position');
  assert.equal(relocked.clamped, true);

  const expectedStages = new Set([
    'board-wedged-between-fixed-side-and-single-jaw',
    'downward-board-withdrawal-opens-single-jaw-counterclockwise',
    'single-jaw-open-beside-fixed-side-piece',
    'upward-board-push-turns-single-jaw-clockwise-and-clamps',
  ]);
  const encounteredStages = new Set();
  let minimumProfileGap = Infinity;
  let maximumProfileGap = -Infinity;
  let minimumJawAngle = Infinity;
  let maximumJawAngle = -Infinity;
  let minimumBoardTranslation = Infinity;
  let maximumBoardTranslation = -Infinity;

  // Audit every source profile point through 32,768 time subdivisions. No
  // point on the moving jaw may cross the board's right side, while the board
  // remains in sliding contact with the one straight fixed side.
  const sampleCount = 32768;
  for (let sample = 0; sample <= sampleCount; sample += 1) {
    const cycleTime = geometry.cyclePeriod * sample / sampleCount;
    const state = stateAtCycleTime(cycleTime);
    encounteredStages.add(state.stage);
    minimumProfileGap = Math.min(
      minimumProfileGap,
      state.minimumJawProfileGap,
    );
    maximumProfileGap = Math.max(
      maximumProfileGap,
      state.minimumJawProfileGap,
    );
    minimumJawAngle = Math.min(minimumJawAngle, state.jawAngle);
    maximumJawAngle = Math.max(maximumJawAngle, state.jawAngle);
    minimumBoardTranslation = Math.min(
      minimumBoardTranslation,
      state.workpieceTranslationY,
    );
    maximumBoardTranslation = Math.max(
      maximumBoardTranslation,
      state.workpieceTranslationY,
    );

    assert.ok(Number.isFinite(state.minimumJawProfileGap));
    assert.ok(state.minimumJawProfilePoint?.isVector2);
    assert.ok(state.minimumJawProfilePointIndex >= 0);
    assert.ok(state.minimumJawProfileGap >= -2e-15,
      'complete moving-jaw profile never penetrates board');
    near(state.fixedSideContactGap, 0, 0,
      'board remains on fixed straight side');
    near(state.boardGuideError, 0, 0,
      'board remains on one vertical translation axis');
    near(state.jawContactRadiusError, 0, 5e-16,
      'source lobe remains rigid about its screw pivot');
    near(
      state.jawAngle,
      geometry.openJawAngle * (1 - state.clampClosure),
      0,
      'single jaw follows closure coordinate',
    );
    near(
      state.workpieceTranslationY,
      -geometry.workpieceReleaseTravel * (1 - state.clampClosure),
      0,
      'board follows vertical closure coordinate',
    );
    assert.ok(state.jawAngle >= -1e-15);
    assert.ok(state.jawAngle <= geometry.openJawAngle + 1e-15);
    assert.ok(state.workpieceTranslationY <= 1e-15);
    assert.ok(
      state.workpieceTranslationY
        >= -geometry.workpieceReleaseTravel - 1e-15,
    );
    assert.equal(state.jawContactWithinBoardSpan, true);
    assert.equal(state.movingJawCount, 1);
    assert.equal(state.fixedSideCount, 1);
    near(state.screwRotation, 0, 0, 'all three screws remain fixed');
    assert.ok(state.upwardInsertionFrictionTorque < -0.58,
      'upward friction always has clockwise moment arm');
    if (state.clamped) {
      near(state.minimumJawProfileGap, 0, 2e-15,
        'closed moving jaw contacts board');
    } else {
      assert.ok(state.minimumJawProfileGap >= 0,
        'released moving jaw has nonnegative clearance');
    }
  }
  assert.deepEqual(encounteredStages, expectedStages);
  near(minimumProfileGap, 0, 0, 'minimum profile gap reaches contact');
  assert.ok(maximumProfileGap > 0.207 && maximumProfileGap < 0.208);
  near(minimumJawAngle, 0, 0, 'closed jaw limit');
  near(maximumJawAngle, geometry.openJawAngle, 0, 'open jaw limit');
  near(
    minimumBoardTranslation,
    -geometry.workpieceReleaseTravel,
    0,
    'downward board limit',
  );
  near(maximumBoardTranslation, 0, 0, 'inserted board limit');

  // Kinematic rates and accelerations are analytic, not frame-to-frame
  // estimates. Central differences verify them away from event boundaries.
  const derivativeStep = 1e-5;
  const boundaries = [
    geometry.closedHoldEnd,
    geometry.releaseEnd,
    geometry.openHoldEnd,
    geometry.insertionEnd,
  ];
  for (let sample = 1; sample < 4096; sample += 1) {
    const cycleTime = geometry.cyclePeriod * sample / 4096;
    if (boundaries.some(
      (boundary) => Math.abs(cycleTime - boundary) < derivativeStep * 3,
    )) continue;
    const before = stateAtCycleTime(cycleTime - derivativeStep);
    const state = stateAtCycleTime(cycleTime);
    const after = stateAtCycleTime(cycleTime + derivativeStep);
    near(
      (after.jawAngle - before.jawAngle) / (2 * derivativeStep),
      state.jawAngularVelocity,
      5e-9,
      'single-jaw angular derivative',
    );
    near(
      (after.workpieceTranslationY - before.workpieceTranslationY)
        / (2 * derivativeStep),
      state.workpieceVelocityY,
      5e-9,
      'board translation derivative',
    );
    vector3Near(
      after.jawContactPoint.clone().sub(before.jawContactPoint)
        .divideScalar(2 * derivativeStep),
      state.jawContactVelocity,
      5e-9,
      'jaw contact-point derivative',
    );
    near(
      (after.movingJawContactGap - before.movingJawContactGap)
        / (2 * derivativeStep),
      state.movingJawContactGapVelocity,
      5e-9,
      'moving contact gap derivative',
    );
    near(
      (after.jawAngularVelocity - before.jawAngularVelocity)
        / (2 * derivativeStep),
      state.jawAngularAcceleration,
      2e-8,
      'single-jaw angular acceleration',
    );
    near(
      (after.workpieceVelocityY - before.workpieceVelocityY)
        / (2 * derivativeStep),
      state.workpieceAccelerationY,
      2e-8,
      'board acceleration',
    );
  }

  // Quintic event easing makes both positions and rates continuous at all
  // four operating transitions and at the periodic cycle seam.
  const boundaryStep = 1e-8;
  for (const boundary of boundaries) {
    const before = stateAtCycleTime(boundary - boundaryStep);
    const after = stateAtCycleTime(boundary + boundaryStep);
    near(before.jawAngle, after.jawAngle, 2e-14,
      'jaw angle continuous at stage boundary');
    near(before.workpieceTranslationY, after.workpieceTranslationY, 8e-14,
      'board position continuous at stage boundary');
    assert.ok(Math.abs(before.jawAngularVelocity) < 2e-14);
    assert.ok(Math.abs(after.jawAngularVelocity) < 2e-14);
    assert.ok(Math.abs(before.workpieceVelocityY) < 8e-14);
    assert.ok(Math.abs(after.workpieceVelocityY) < 8e-14);
  }
  const nextCycle = stateAtTime(geometry.cyclePeriod);
  near(nextCycle.jawAngle, sourceClosed.jawAngle, 0,
    'cycle returns to source jaw angle');
  near(nextCycle.workpieceTranslationY, sourceClosed.workpieceTranslationY, 0,
    'cycle returns to source board position');
  assert.equal(nextCycle.completedCycles, 1);

  // Rendered transforms, anchors, and contacts follow the same solved state;
  // the bed, side-piece, and all three screw heads remain fixed.
  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const fixedBedMatrix = benchBase.matrixWorld.clone();
  const fixedSideMatrix = fixedSidePiece.matrixWorld.clone();
  const fixedJawScrewMatrix = jawScrew.matrixWorld.clone();
  const fixedSideScrewMatrices = fixedScrews.map(
    ({ matrixWorld }) => matrixWorld.clone(),
  );
  for (const cycleTime of [0, 2.4, 3.3, 3.95, 5.8, 7.0, 8.2]) {
    const state = stateAtCycleTime(cycleTime);
    model.update(cycleTime, 0.016);
    model.root.updateMatrixWorld(true);
    near(pivotedJaw.rotation.z, state.jawAngle, 2e-15,
      'rendered single-jaw angle');
    near(workpiece.position.y, state.workpieceTranslationY, 8e-15,
      'rendered board translation');
    vector2Near(worldPoint(jawPivotAnchor), geometry.jawPivot, 4e-16,
      'rendered fixed jaw pivot');
    vector2Near(worldPoint(jawContactAnchor), state.jawContactPoint, 1e-15,
      'rendered moving-jaw source contact');
    vector2Near(
      worldPoint(workpieceLeadingEdgeAnchor),
      new THREE.Vector2(
        (geometry.workpieceLeftX + geometry.workpieceRightX) / 2,
        geometry.workpieceTopY + state.workpieceTranslationY,
      ),
      1e-15,
      'rendered upward board leading edge',
    );
    vector2Near(
      worldPoint(workpieceRightFaceAnchor),
      new THREE.Vector2(
        geometry.workpieceRightX,
        state.workpieceTranslationY,
      ),
      1e-15,
      'rendered board face at jaw side',
    );
    assert.equal(movingContactMarker.visible, state.clamped);
    assert.ok(benchBase.matrixWorld.equals(fixedBedMatrix));
    assert.ok(fixedSidePiece.matrixWorld.equals(fixedSideMatrix));
    assert.ok(jawScrew.matrixWorld.equals(fixedJawScrewMatrix));
    fixedScrews.forEach((screw, index) => {
      assert.ok(screw.matrixWorld.equals(fixedSideScrewMatrices[index]));
    });
    near(model.root.userData.contacts.fixedSidePiece.gap,
      0, 0, 'rendered fixed-side sliding contact');
    near(
      model.root.userData.contacts.movingEccentricJaw.gap,
      state.minimumJawProfileGap,
      2e-15,
      'rendered whole-profile jaw clearance',
    );
    assert.equal(
      model.root.userData.contacts.movingEccentricJaw.withinBoardSpan,
      true,
    );
    near(model.root.userData.contacts.pivotScrews.fixedSideScrewRotation,
      0, 0, 'rendered fixed-side screws do not rotate');
    near(model.root.userData.contacts.pivotScrews.movingJawScrewRotation,
      0, 0, 'rendered jaw pivot screw does not rotate');
    near(model.root.userData.contacts.workpieceGuide.error,
      0, 0, 'rendered vertical workpiece guide');
  }

  model.update(0, 0.016);
  model.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 3.87,
    'fixed side, board, and complete eccentric jaw span source width');
  assert.ok(size.y > 6.47,
    'fixed side and jaw retain source height');
  assert.ok(size.z > 1.65,
    'bed, underlapping jaw, board, fixed side, screws, and markers have depth');
  assert.ok(bounds.min.z < -0.74);
  assert.ok(bounds.max.z > 0.90);
  near(model.root.userData.cameraDistanceScale, 1.18, 0,
    'source-complete camera scale');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  // The next sequential mechanism is now independently authored as 181.
  const movement179 = createMovementModel(catalog.movements[178]);
  const movement181 = createMovementModel(catalog.movements[180]);
  const movement182 = createMovementModel(catalog.movements[181]);
  assert.equal(movement179.root.userData.fidelity, 'authored');
  assert.equal(
    movement179.root.userData.mechanism,
    'liftable-gab-manual-valve-spindle-reversal-with-loose-eccentric-and-exact-half-turn-shaft-stop-takeup',
  );
  assert.equal(catalog.movements[180].fidelity, 'authored');
  assert.equal(movement181.root.userData.fidelity, 'authored');
  assert.equal(
    movement181.root.userData.mechanism,
    'ascending-piston-tappet-trips-lower-valve-handle-diagonal-catch-releases-upper-backweighted-handle-and-reverses-four-valves',
  );
  assert.notEqual(
    movement181.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.equal(catalog.movements[181].fidelity, 'authored');
  assert.equal(movement182.root.userData.fidelity, 'authored');
  assert.equal(
    movement182.root.userData.mechanism,
    'top-position-descending-piston-tappet-trips-upper-valve-handle-diagonal-catch-releases-lower-backweighted-handle-and-restores-four-valves',
  );

  disposeModel(movement179.root);
  disposeModel(movement181.root);
  disposeModel(movement182.root);
  disposeModel(model.root);
});
