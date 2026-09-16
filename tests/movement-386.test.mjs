import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

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

test('movement 386 is two complementary side pieces with four double-pivoted rounds that close into one hollow pole', () => {
  const movement = catalog.movements[385];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 386);
  assert.equal(movement.number, '386');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(
    movement.archetype,
    'parallel-rounds-translating-half-shells-folding-library-ladder',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /two-parallel-complementary-hollow-side-pieces/);
  assert.match(data.mechanism, /four-equal-double-pivoted-rounds/);
  assert.match(data.mechanism, /open-ladder-to-closed-round-pole/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(degreesOfFreedom.inputs.length, 1);
  assert.match(degreesOfFreedom.note, /all four equal pivoted rounds/);
  assert.match(degreesOfFreedom.note, /one translational degree of freedom/);

  for (const component of [
    blocks.leftSidePiece,
    blocks.poleSectionGuide,
    blocks.rightSidePiece,
    ...blocks.roundIndexes,
    ...blocks.rounds,
  ]) assert.equal(component.parent, model.root);
  for (const component of [
    blocks.leftEndFillShell,
    blocks.leftEndIndex,
    blocks.leftShell,
    ...blocks.leftPivotIndexes,
    ...blocks.leftPivotPins,
  ]) assert.equal(component.parent, blocks.leftSidePiece);
  for (const component of [
    blocks.rightEndFillShell,
    blocks.rightEndIndex,
    blocks.rightShell,
    ...blocks.rightPivotIndexes,
    ...blocks.rightPivotPins,
  ]) assert.equal(component.parent, blocks.rightSidePiece);
  assert.equal(blocks.rounds.length, 4);
  assert.equal(blocks.roundIndexes.length, 4);
  assert.equal(blocks.leftPivotPins.length, 4);
  assert.equal(blocks.rightPivotPins.length, 4);
  assert.equal(blocks.leftPivotIndexes.length, 4);
  assert.equal(blocks.rightPivotIndexes.length, 4);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'left-hollow-semicylindrical-ladder-side-piece',
    'right-hollow-semicylindrical-ladder-side-piece',
    'left-half-of-closed-round-pole-shell',
    'right-half-of-closed-round-pole-shell',
    'left-lower-complement-forming-full-pole-end',
    'right-upper-complement-forming-full-pole-end',
    'pivoted-ladder-round-folding-into-pole',
    'round-pivot-pin-through-side-piece',
    'closed-round-pole-cross-section-reference-ring',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 386 preserves Brown\'s three depicted states, four rounds, measured plate, and official terminal offset ratio', () => {
  const movement = catalog.movements[385];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate386;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_386.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Folding library ladder/);
  assert.match(movement.description, /open, partly open, and closed/);
  assert.match(movement.description, /rounds are pivoted to the side-pieces/);
  assert.match(movement.description, /form a round pole when closed/);
  assert.match(movement.description, /rounds shutting up inside/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.deepEqual(sourceAnimation.sourceViewBox, [-38, -38, 76, 76]);
  assert.deepEqual(sourceAnimation.sourceOpenHalfOffset.toArray(), [7, 0]);
  assert.deepEqual(
    sourceAnimation.sourceClosedHalfOffset.toArray(),
    [1, 6.928203],
  );
  assert.deepEqual(
    sourceAnimation.normalizedEventPhases,
    [0, 0.4, 0.5, 0.9, 1],
  );
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLatchOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(
    plate.openLadderRailCentersPixels,
    { leftX: 49, rightX: 158 },
  );
  assert.deepEqual(plate.openRoundPivotYPixels, [136, 252, 370, 486]);
  assert.deepEqual(
    plate.partlyFoldedRailCentersPixels,
    { leftX: 253, rightX: 355 },
  );
  assert.deepEqual(
    plate.closedPoleExtentPixels,
    { maximumX: 493, minimumX: 432 },
  );
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.officialAnimationEvidence, /\(7,0\)/);
  assert.match(evidence.officialAnimationEvidence, /\(1,6\.928203\)/);
  assert.match(evidence.reconstructionDisclosure, /four engraved rounds/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 386 scales the official constant-length fold triangle exactly', () => {
  const model = createMovementModel(catalog.movements[385]);
  const data = model.root.userData;
  const { geometry, transmission } = data;

  near(geometry.roundLength,
    geometry.sourceRoundLength * geometry.sourceScale, 0,
    'scaled round length');
  near(geometry.closedHorizontalGap,
    geometry.sourceClosedHorizontalOffset * geometry.sourceScale, 0,
    'scaled closed horizontal gap');
  near(geometry.closedVerticalOffset,
    geometry.sourceClosedVerticalOffset * geometry.sourceScale, 0,
    'scaled closed vertical offset');
  near(geometry.sourceClosedVerticalOffset,
    Math.sqrt(
      geometry.sourceRoundLength ** 2
        - geometry.sourceClosedHorizontalOffset ** 2,
    ), 0, 'official Pythagorean terminal offset');
  near(Math.hypot(
    geometry.closedHorizontalGap,
    geometry.closedVerticalOffset,
  ), geometry.roundLength, 3e-16, 'scaled terminal round closure');
  near(geometry.closedFoldAngle,
    Math.atan2(
      geometry.closedVerticalOffset,
      geometry.closedHorizontalGap,
    ), 0, 'terminal fold angle');
  near(geometry.pivotPitch,
    geometry.closedVerticalOffset, 0,
    'one closed vertical offset equals one round pitch');
  assert.match(transmission.foldLaw, /cos/);
  assert.match(transmission.foldLaw, /sin/);
  assert.match(transmission.closureLaw, /roundLength/);
  disposeModel(model.root);
});

test('movement 386 retains the official fold-dwell-unfold-dwell phases with smooth boundaries', () => {
  const model = createMovementModel(catalog.movements[385]);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const events = [
    [0, 'folding-rounds-into-side-pieces', 0],
    [timeline.events.foldedDwellStarts, 'closed-round-pole-dwell', 1],
    [timeline.events.unfoldingStarts, 'unfolding-rounds-to-ladder', 1],
    [timeline.events.openDwellStarts, 'open-ladder-dwell', 0],
    [timeline.cycleDuration, 'folding-rounds-into-side-pieces', 0],
  ];
  for (const [time, stage, fraction] of events) {
    const state = stateAtTime(time);
    assert.equal(state.stage, stage);
    near(state.closedFraction, fraction, 0, `${stage} fraction`);
    near(state.foldAngularSpeed, 0, 3e-15, `${stage} speed`);
    near(state.foldAngularAcceleration, 0, 3e-15,
      `${stage} acceleration`);
  }
  for (const time of [0.4, 1.1, 2, 2.9, 3.6]) {
    const folding = stateAtTime(time);
    const unfolding = stateAtTime(9 - time);
    near(unfolding.foldAngle, folding.foldAngle, 4e-15,
      'time-mirrored fold pose');
    near(unfolding.foldAngularSpeed, -folding.foldAngularSpeed, 5e-15,
      'time-mirrored fold rate');
    near(unfolding.foldAngularAcceleration,
      folding.foldAngularAcceleration, 9e-15,
      'time-mirrored fold acceleration');
  }
  disposeModel(model.root);
});

test('movement 386 all four rounds remain equal and parallel while the side pieces translate without rotating', () => {
  const model = createMovementModel(catalog.movements[385]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;

  for (let sample = -1800; sample <= 3600; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 1800);
    near(state.horizontalOffset ** 2 + state.verticalOffset ** 2,
      geometry.roundLength ** 2, 9e-16,
      'constant-length center offset');
    vectorNear(
      state.rightCenter.clone().sub(state.leftCenter),
      new THREE.Vector3(
        state.horizontalOffset,
        state.verticalOffset,
        0,
      ),
      6e-16,
      'side-piece relative translation vector',
    );
    assert.equal(state.roundStates.length, geometry.roundCount);
    const commonDirection = state.roundStates[0].rightPivot.clone()
      .sub(state.roundStates[0].leftPivot).normalize();
    for (const round of state.roundStates) {
      near(round.length, geometry.roundLength, 2e-15,
        `round ${round.index} length`);
      vectorNear(
        round.rightPivot.clone().sub(round.leftPivot).normalize(),
        commonDirection,
        2e-15,
        `round ${round.index} parallel direction`,
      );
      near(round.angle, state.foldAngle, 0,
        `round ${round.index} fold angle`);
      near(round.angularSpeed, state.foldAngularSpeed, 0,
        `round ${round.index} angular speed`);
      near(round.leftPivot.y - state.leftCenter.y,
        geometry.pivotOffsets[round.index], 5e-16,
        `left pivot ${round.index} offset`);
      near(round.rightPivot.y - state.rightCenter.y,
        geometry.pivotOffsets[round.index], 5e-16,
        `right pivot ${round.index} offset`);
    }
  }
  disposeModel(model.root);
});

test('movement 386 open pose is a usable ladder and closed pose nests every round within one full-section round pole', () => {
  const model = createMovementModel(catalog.movements[385]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline, transmission } = data;
  const open = stateAtTime(0);
  const closed = stateAtTime(timeline.events.foldedDwellStarts);

  near(open.horizontalOffset, geometry.roundLength, 0,
    'open rail spacing equals round length');
  near(open.verticalOffset, 0, 0, 'open rails have no axial offset');
  near(open.leftCenter.y, open.rightCenter.y, 0,
    'open side pieces align vertically');
  for (const round of open.roundStates) {
    near(round.leftPivot.y, round.rightPivot.y, 0,
      `open round ${round.index} is horizontal`);
  }

  near(closed.horizontalOffset,
    geometry.closedHorizontalGap, 2e-16,
    'closed shell-pivot gap');
  near(closed.verticalOffset,
    geometry.pivotPitch, 3e-16,
    'closed axial shift is one pivot pitch');
  near(closed.leftShellAxisX, closed.rightShellAxisX, 2e-16,
    'two half-shell axes coincide');
  near(closed.leftCenter.x + blocks.leftShell.position.x,
    0, 1e-16, 'left shell closes on pole axis');
  near(closed.rightCenter.x + blocks.rightShell.position.x,
    0, 1e-16, 'right shell closes on pole axis');
  near(closed.leftCenter.x + blocks.leftEndFillShell.position.x,
    0, 1e-16, 'lower complementary shell closes on pole axis');
  near(closed.rightCenter.x + blocks.rightEndFillShell.position.x,
    0, 1e-16, 'upper complementary shell closes on pole axis');
  assert.ok(closed.maximumRoundRadialEnvelope
    < geometry.shellInnerRadius,
  'rounds and pivot eyes fit within hollow pole bore');
  for (let index = 0; index < closed.roundStates.length - 1; index += 1) {
    near(closed.roundStates[index].rightPivot.y,
      closed.roundStates[index + 1].leftPivot.y, 8e-16,
      'successive folded rounds line up axially inside pole');
  }

  const leftMainMinimumY = closed.leftCenter.y
    - geometry.sidePieceLength / 2;
  const rightMainMinimumY = closed.rightCenter.y
    - geometry.sidePieceLength / 2;
  const leftFullEndMaximumY = leftMainMinimumY
    + geometry.closedVerticalOffset;
  near(leftFullEndMaximumY, rightMainMinimumY, 5e-16,
    'full lower end meets two-shell overlap without gap');
  const rightMainMaximumY = closed.rightCenter.y
    + geometry.sidePieceLength / 2;
  const leftMainMaximumY = closed.leftCenter.y
    + geometry.sidePieceLength / 2;
  near(rightMainMaximumY - geometry.closedVerticalOffset,
    leftMainMaximumY, 1e-15,
    'two-shell overlap meets full upper end without gap');
  assert.match(transmission.closedNestingLaw, /common round-pole bore/);
  disposeModel(model.root);
});

test('movement 386 renderer binds both translating side pieces, all round endpoints, indexes, and closed-pole cue exactly', () => {
  const model = createMovementModel(catalog.movements[385]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;

  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = timeline.cycleDuration * 2 * frame / 1200;
    const expected = stateAtTime(time);
    model.update(time, 0.016);
    vectorNear(blocks.leftSidePiece.position,
      expected.leftCenter, 0, 'rendered left side-piece center');
    vectorNear(blocks.rightSidePiece.position,
      expected.rightCenter, 0, 'rendered right side-piece center');
    near(blocks.leftSidePiece.rotation.x, 0, 0,
      'left side piece never pitches');
    near(blocks.leftSidePiece.rotation.y, 0, 0,
      'left side piece never yaws');
    near(blocks.leftSidePiece.rotation.z, 0, 0,
      'left side piece never rolls');
    near(blocks.rightSidePiece.rotation.x, 0, 0,
      'right side piece never pitches');
    near(blocks.rightSidePiece.rotation.y, 0, 0,
      'right side piece never yaws');
    near(blocks.rightSidePiece.rotation.z, 0, 0,
      'right side piece never rolls');
    for (let index = 0; index < expected.roundStates.length; index += 1) {
      const round = expected.roundStates[index];
      vectorNear(blocks.rounds[index].userData.endpoints.start,
        round.leftPivot, 0, `rendered round ${index} left pivot`);
      vectorNear(blocks.rounds[index].userData.endpoints.end,
        round.rightPivot, 0, `rendered round ${index} right pivot`);
      vectorNear(blocks.roundIndexes[index].position,
        round.midpoint, 0, `rendered round ${index} midpoint index`);
      near(data.contacts.roundPivots[index].lengthResidual,
        0, 1e-15, `runtime round ${index} closure`);
    }
    assert.equal(blocks.poleSectionGuide.visible,
      expected.closedFraction > 0.985);
    near(data.contacts.closedPoleShellSeam.separation,
      Math.abs(expected.rightShellAxisX - expected.leftShellAxisX),
      0, 'runtime shell-axis separation');
  }
  disposeModel(model.root);
});

test('movement 386 closes one full fold-and-unfold cycle before movement 507 remains authored', () => {
  const movement = catalog.movements[385];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.cycleDuration);

  near(closure.closedFraction, start.closedFraction, 0,
    'fold fraction closes');
  near(closure.foldAngle, start.foldAngle, 0, 'fold angle closes');
  vectorNear(closure.leftCenter, start.leftCenter, 0,
    'left side piece closes');
  vectorNear(closure.rightCenter, start.rightCenter, 0,
    'right side piece closes');
  vectorNear(closure.leftCenterVelocity,
    start.leftCenterVelocity, 0, 'velocity closes');
  for (let index = 0; index < start.roundStates.length; index += 1) {
    vectorNear(closure.roundStates[index].leftPivot,
      start.roundStates[index].leftPivot, 0,
      `round ${index} left pose closes`);
    vectorNear(closure.roundStates[index].rightPivot,
      start.roundStates[index].rightPivot, 0,
      `round ${index} right pose closes`);
  }
  assert.equal(data.animationTiming.authoredCyclePeriod,
    timeline.cycleDuration);
  assert.equal(data.animationTiming.targetCycleDuration, 2);
  assertReadableTiming(data.animationTiming);
  assert.ok(data.cameraFitBounds instanceof THREE.Box3);
  assert.equal(data.cameraDistanceScale, 1.02);
  assert.ok(Number.isFinite(data.groundFloorY));
  for (const residual of Object.values(data.constraintResiduals)) {
    near(residual, 0, 2e-16, 'static constraint residual');
  }

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model.root);
  disposeModel(model507.root);
});
