import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 359 is one cord, one sliding crossbar, and one common drill rotor', () => {
  const movement = catalog.movements[358];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 359);
  assert.equal(movement.number, '359');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(movement.archetype, 'single-cord-flywheel-pump-drill');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.equal(degreesOfFreedom.mechanism, 1);
  assert.match(degreesOfFreedom.input, /transverse crossbar/);
  assert.match(degreesOfFreedom.output, /spindle, flywheel, socket, and drill/);
  assert.match(data.mechanism, /single-cord-reciprocating-pump-drill/);

  assert.equal(blocks.spindle.parent, blocks.spindleRotor);
  assert.equal(blocks.flywheel.parent, blocks.spindleRotor);
  assert.equal(blocks.drillSocket.parent, blocks.spindleRotor);
  assert.equal(blocks.drillBit.parent, blocks.spindleRotor);
  assert.equal(blocks.crossbar.parent, model.root);
  assert.equal(blocks.singleCord.parent, model.root);
  assert.equal(blocks.singleCord.userData.branches, blocks.cordBranches);
  assert.match(blocks.singleCord.userData.materialTopology, /one cord/);
  assert.match(blocks.singleCord.userData.materialTopology, /midpoint/);
  assert.equal(blocks.cordBranches.length, 2);
  assert.notEqual(blocks.cordBranches[0], blocks.cordBranches[1]);
  blocks.cordBranches.forEach((branch) => {
    assert.equal(branch.parent, blocks.singleCord);
    assert.equal(branch.userData.closed, false);
    // Brown hatches the cord: the shared laid rope, no painted markers.
    assert.equal(branch.userData.markers.length, 0);
    assert.equal(branch.userData.crossSection, 'laid-rope');
    assert.equal(branch.userData.materialLength, data.geometry.branchLength);
  });

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'one-cord-with-two-pump-drill-branches',
    'hand-pumped-transverse-sliding-crossbar',
    'loose-crossbar-guide-hole-around-spindle',
    'cord-wound-vertical-drill-spindle',
    'heavy-momentum-flywheel-fixed-to-spindle',
    'source-labeled-drill-socket-E',
    'bidirectionally-cutting-drill-point-G',
  ]) assert.ok(roles.includes(role), role);
  // Brown draws no white rotation indices on the fly or the drill.
  assert.ok(!roles.some((role) => /^white-/.test(role)));
  disposeModel(model.root);
});

test('movement 359 records the Brown, Fuller, and Lanz-Betancourt evidence without inventing source timing', () => {
  const movement = catalog.movements[358];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const brown = sourceReference.brownPlate359;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_359.html');
  assert.match(movement.description, /Primitive drilling apparatus/);
  assert.match(movement.description, /wind upon the spindle alternately/);
  assert.match(movement.description, /heavy disk or fly-wheel/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.match(data.timeline.note, /Brown supplies no timing/);
  assert.match(data.timeline.note, /display cycle/);

  assert.equal(brown.imageWidth, 525);
  assert.equal(brown.imageHeight, 525);
  assert.equal(brown.measurementUncertaintyPixels, 7);
  assert.deepEqual(brown.spindleTop.toArray(), [259, 23]);
  assert.deepEqual(brown.spindleBottom.toArray(), [259, 475]);
  assert.deepEqual(brown.anchor.toArray(), [259, 184]);
  assert.deepEqual(brown.crossbarLeft.toArray(), [70, 259]);
  assert.deepEqual(brown.crossbarRight.toArray(), [453, 259]);
  assert.deepEqual(brown.flywheelLeft.toArray(), [47, 354]);
  assert.deepEqual(brown.flywheelRight.toArray(), [474, 354]);
  assert.deepEqual(brown.drillPoint.toArray(), [258, 507]);

  const fuller = sourceReference.fullerAnalyticalTable;
  assert.equal(fuller.movementNumber, 47);
  assert.equal(fuller.publicationYear, 1834);
  assert.match(fuller.publication, /Fuller/);
  assert.match(fuller.use, /direct predecessor/);
  assert.match(fuller.use, /alternate drill revolution/);

  const lanz = sourceReference.lanzBetancourt;
  assert.equal(lanz.publicationYear, 1820);
  assert.equal(lanz.page, 143);
  assert.equal(lanz.figure, 'plate 9, figure F17');
  assert.deepEqual(lanz.labels, {
    A: 'spindle or stem',
    BB: 'cord or band',
    CC: 'crosspiece',
    D: 'fly',
    E: 'socket',
    F: 'drill',
    G: 'cutting point',
  });
  assert.match(lanz.use, /alternate rectilinear crosspiece motion/);
  assert.match(lanz.use, /alternate circular drill motion/);
  disposeModel(model.root);
});

test('movement 359 keeps both halves of its one cord inextensible and obeys cylindrical no-slip take-up', () => {
  const model = createMovementModel(catalog.movements[358]);
  const data = model.root.userData;
  const { geometry, stateAtSpindleAngle } = data;
  let previousPositiveBarY = -Infinity;

  for (let index = 0; index <= 80; index += 1) {
    const angle = -geometry.maximumWindingAngle
      + 2 * geometry.maximumWindingAngle * index / 80;
    const state = stateAtSpindleAngle(angle);
    near(state.leftCord.branchLength, geometry.branchLength, 1e-12,
      'left material length');
    near(state.rightCord.branchLength, geometry.branchLength, 1e-12,
      'right material length');
    near(
      state.leftCord.connectorLength
        + state.leftCord.helixLength
        + state.leftCord.freeLength,
      geometry.branchLength,
      2e-12,
      'left piecewise length sum',
    );
    near(
      state.rightCord.connectorLength
        + state.rightCord.helixLength
        + state.rightCord.freeLength,
      geometry.branchLength,
      2e-12,
      'right piecewise length sum',
    );
    near(
      state.leftCord.circumferentialWrap,
      geometry.spindleRadius * Math.abs(angle),
      2e-12,
      'left no-slip take-up',
    );
    near(
      state.rightCord.circumferentialWrap,
      geometry.spindleRadius * Math.abs(angle),
      2e-12,
      'right no-slip take-up',
    );
    near(state.leftCord.barY, state.rightCord.barY, 2e-12,
      'level crossbar');
    near(state.barY, stateAtSpindleAngle(-angle).barY, 2e-12,
      'opposite winding symmetry');
    assert.ok(state.leftCord.freeLength > 0);
    assert.ok(state.rightCord.freeLength > 0);

    if (angle >= 0) {
      assert.ok(state.barY >= previousPositiveBarY - 1e-11);
      previousPositiveBarY = state.barY;
    }
  }

  const unwound = stateAtSpindleAngle(0);
  const wound = stateAtSpindleAngle(geometry.maximumWindingAngle);
  near(unwound.barY, geometry.crossbarLowY, 2e-12,
    'unwound bar height');
  near(wound.barY, geometry.crossbarHighY, 2e-12,
    'fully wound bar height');
  near(unwound.leftCord.helixLength, 0, 1e-12,
    'unwound helix length');
  near(wound.windingTurns, geometry.maximumWindingTurns, 1e-12,
    'maximum turns');
  assert.equal(unwound.windingHandedness, 'fully unwound');
  assert.equal(
    stateAtSpindleAngle(-geometry.maximumWindingAngle).windingHandedness,
    'negative-handed winding',
  );
  assert.equal(wound.windingHandedness, 'positive-handed winding');
  disposeModel(model.root);
});

test('movement 359 carries flywheel momentum through each unwound midpoint and reverses only when rewound', () => {
  const model = createMovementModel(catalog.movements[358]);
  const data = model.root.userData;
  const { cyclePeriod, crossbarHighY, crossbarLowY, maximumWindingAngle } =
    data.geometry;
  const times = [0, cyclePeriod / 4, cyclePeriod / 2,
    cyclePeriod * 3 / 4, cyclePeriod];
  const states = times.map(data.stateAtTime);

  near(states[0].spindleAngle, -maximumWindingAngle, 1e-12,
    'first wound extreme');
  near(states[1].spindleAngle, 0, 3e-15, 'first unwound midpoint');
  near(states[2].spindleAngle, maximumWindingAngle, 1e-12,
    'opposite wound extreme');
  near(states[3].spindleAngle, 0, 4e-15, 'second unwound midpoint');
  near(states[4].spindleAngle, states[0].spindleAngle, 1e-12,
    'cycle angle closure');
  near(states[0].barY, crossbarHighY, 2e-12, 'first high bar');
  near(states[1].barY, crossbarLowY, 2e-12, 'first low bar');
  near(states[2].barY, crossbarHighY, 2e-12, 'opposite high bar');
  near(states[3].barY, crossbarLowY, 2e-12, 'second low bar');
  near(states[4].barY, states[0].barY, 2e-12, 'bar closure');

  assert.equal(states[0].atDirectionReversal, true);
  assert.equal(states[1].atUnwoundMidpoint, true);
  assert.equal(states[2].atDirectionReversal, true);
  assert.equal(states[3].atUnwoundMidpoint, true);
  near(states[0].spindleAngularSpeed, 0, 1e-12,
    'speed at first wound reversal');
  assert.ok(states[1].spindleAngularSpeed > 0);
  near(states[2].spindleAngularSpeed, 0, 2e-15,
    'speed at opposite wound reversal');
  assert.ok(states[3].spindleAngularSpeed < 0);
  assert.ok(data.stateAtTime(cyclePeriod / 4 - 0.01).spindleAngularSpeed > 0);
  assert.ok(data.stateAtTime(cyclePeriod / 4 + 0.01).spindleAngularSpeed > 0);
  assert.ok(data.stateAtTime(cyclePeriod * 3 / 4 - 0.01)
    .spindleAngularSpeed < 0);
  assert.ok(data.stateAtTime(cyclePeriod * 3 / 4 + 0.01)
    .spindleAngularSpeed < 0);
  assert.match(states[0].stage, /hand-powered downstroke/);
  assert.match(states[1].stage, /flywheel-powered rewind/);
  assert.match(states[2].stage, /hand-powered downstroke/);
  assert.match(states[3].stage, /flywheel-powered rewind/);
  assert.match(data.transmission.flywheelPhaseLaw, /greatest.*fully unwound/);
  assert.match(data.transmission.outputSense, /opposite directions/);
  disposeModel(model.root);
});

test('movement 359 renderer keeps rotor, crossbar, cord ends, and the anchored rope lay synchronized', () => {
  const model = createMovementModel(catalog.movements[358]);
  const data = model.root.userData;
  const { blocks, geometry } = data;

  for (const time of [0, 0.73, 1.99, 2, 2.01, 3.41, 4, 5.77, 6, 7.42]) {
    const expected = data.stateAtTime(time);
    model.update(time);
    near(blocks.spindleRotor.rotation.y, expected.spindleAngle, 2e-12,
      `rotor angle at ${time}`);
    near(blocks.crossbar.position.y, expected.barY, 2e-12,
      `bar height at ${time}`);
    assert.equal(data.currentState.stage, expected.stage);

    for (const [index, key] of ['leftCord', 'rightCord'].entries()) {
      const branch = blocks.cordBranches[index];
      const expectedCord = expected[key];
      near(branch.userData.length, geometry.branchLength, 2e-12,
        `branch length at ${time}`);
      vectorNear(branch.userData.curve.getPointAt(0), expectedCord.eyePoint,
        2e-12, `eye attachment at ${time}`);
      vectorNear(branch.userData.curve.getPointAt(1), expectedCord.handlePoint,
        2e-12, `bar attachment at ${time}`);
      // Both ends are tied: the lay keeps its material coordinate.
      assert.equal(branch.children.at(-1).geometry.userData.travel, 0);
      const positions = branch.children.at(-1).geometry.attributes.position;
      for (const value of positions.array) assert.ok(Number.isFinite(value));
    }
  }
  disposeModel(model.root);
});

test('movement 359 cord material points remain continuous through free-to-wrapped transitions over 1,200 rendered frames', () => {
  const model = createMovementModel(catalog.movements[358]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const initialPositions = [];
  let previousPositions = null;
  let maximumStep = 0;
  let maximumLengthError = 0;

  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.cyclePeriod * frame / 1200;
    model.update(time);
    const positions = blocks.cordBranches.flatMap(
      (branch) => [1, 2, 3, 4].map(
        (index) => branch.userData.curve.getPointAt(index / 5),
      ),
    );
    if (frame === 0) {
      positions.forEach((position) => initialPositions.push(position.clone()));
    }
    if (previousPositions) {
      positions.forEach((position, index) => {
        maximumStep = Math.max(
          maximumStep,
          position.distanceTo(previousPositions[index]),
        );
      });
    }
    previousPositions = positions;
    blocks.cordBranches.forEach((branch) => {
      maximumLengthError = Math.max(
        maximumLengthError,
        Math.abs(branch.userData.length - geometry.branchLength),
      );
    });
  }

  assert.ok(maximumStep < 0.024, `maximum marker step ${maximumStep}`);
  assert.ok(maximumLengthError < 2e-12,
    `maximum cord-length error ${maximumLengthError}`);
  previousPositions.forEach((position, index) => {
    vectorNear(position, initialPositions[index], 2e-11,
      `marker ${index} cycle closure`);
  });

  for (const midpoint of [geometry.cyclePeriod / 4,
    geometry.cyclePeriod * 3 / 4]) {
    model.update(midpoint - 1e-6);
    const before = blocks.cordBranches.flatMap(
      (branch) => [1, 2, 3, 4].map(
        (index) => branch.userData.curve.getPointAt(index / 5),
      ),
    );
    model.update(midpoint + 1e-6);
    const after = blocks.cordBranches.flatMap(
      (branch) => [1, 2, 3, 4].map(
        (index) => branch.userData.curve.getPointAt(index / 5),
      ),
    );
    after.forEach((position, index) => {
      assert.ok(position.distanceTo(before[index]) < 0.001);
    });
  }
  disposeModel(model.root);
});

test('movement 359 is reviewed while movement 507 remains the next authored draft', () => {
  const movement359 = catalog.movements[358];
  const movement507 = catalog.movements[506];
  assert.equal(movement359.id, 359);
  assert.equal(movement359.fidelity, 'authored');
  assert.equal(movement359.archetype, 'single-cord-flywheel-pump-drill');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
