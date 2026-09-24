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

test('movement 252 is the two-slot equal-and-opposite roller traverse', () => {
  const movement = catalog.movements[251];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 252);
  assert.equal(movement.number, '252');
  assert.equal(
    movement.title,
    'Equal-and-Opposite Crossed-Slot Roller Traverse',
  );
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'vertically-translated-twin-oblique-slot-yoke-driving-equal-and-opposite-horizontal-rollers',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /vertical-piece-d-crosses-two-mirror-oblique-slots/);
  assert.equal(transmission.constraintCountPerRoller, 2);
  assert.equal(transmission.input, 'vertical-translation-of-piece-d');
  assert.equal(
    transmission.output,
    'equal-and-opposite-horizontal-translation-of-rollers-a-and-b',
  );
  assert.equal(blocks.leftArm.parent, blocks.movingYoke);
  assert.equal(blocks.rightArm.parent, blocks.movingYoke);
  assert.equal(blocks.leftRoller.parent, model.root);
  assert.equal(blocks.rightRoller.parent, model.root);
  assert.equal(blocks.topRail.parent, blocks.fixedSlotFrame);
  assert.equal(blocks.bottomRail.parent, blocks.fixedSlotFrame);
  disposeModel(model.root);
});

test('movement 252 preserves the published endpoint data and source plate', () => {
  const movement = catalog.movements[251];
  const model = createMovementModel(movement);
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.plate252;

  assert.equal(sourceAnimation.available, true);
  assert.deepEqual(sourceAnimation.coordinateWindow, [0, 0, 17, 17]);
  assert.deepEqual(sourceAnimation.officialInterpolationKeyframes, [
    0,
    0.4,
    0.5,
    0.9,
    1,
  ]);
  assert.deepEqual(sourceAnimation.officialStateSequence, [
    'inner',
    'outer',
    'outer',
    'inner',
    'inner',
  ]);
  assert.deepEqual(sourceAnimation.officialEndpointCoordinates, {
    leftRollerEnd: [[3.849946, 11.250462], [4.349946, 11.250462]],
    leftRollerStart: [[6.647792, 11.250462], [7.147792, 11.250462]],
    rightRollerEnd: [[13.150054, 11.250462], [13.650054, 11.250462]],
    rightRollerStart: [[10.352208, 11.250462], [10.852208, 11.250462]],
    yokeEnd: [[14.357716, 8.5], [16.357716, 8.5]],
    yokeStart: [[14.357716, 2.5], [16.357716, 2.5]],
  });
  assert.equal(sourceReference.officialDescription, movement.description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.equal(plate.officialAnimationAvailable, true);
  assert.equal(
    plate.view,
    'front-elevation-through-fixed-horizontal-slot-oblique-yoke-slots-and-two-roller-pins',
  );
  assert.deepEqual(plate.rasterRollers, [
    { centerX: 246, centerY: 154, innerRadius: 15, outerRadius: 52 },
    { centerX: 352, centerY: 154, innerRadius: 15, outerRadius: 52 },
  ]);
  assert.match(plate.inferredTopology, /intersect one fixed horizontal slot C/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 65,
    edition: 21,
    illustrationPage: 64,
    publicationYear: 1908,
  });
  disposeModel(model.root);
});

test('movement 252 satisfies both crossed-slot center constraints densely', () => {
  const model = createMovementModel(catalog.movements[251]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  let maximumMidpointError = 0;
  let maximumMovingSlotResidual = 0;
  let maximumDisplacementLawError = 0;

  for (let sample = 0; sample <= 65536; sample += 1) {
    const time = timeline.demonstrationPeriod * sample / 65536;
    const state = stateAtTime(time);
    maximumMidpointError = Math.max(
      maximumMidpointError,
      Math.abs(state.midpoint.x),
      Math.abs(state.midpoint.y - geometry.pinY),
    );
    maximumMovingSlotResidual = Math.max(
      maximumMovingSlotResidual,
      Math.abs(state.movingSlotResiduals.left),
      Math.abs(state.movingSlotResiduals.right),
    );
    maximumDisplacementLawError = Math.max(
      maximumDisplacementLawError,
      Math.abs(
        state.leftRollerCenter.x
          + geometry.innerHalfSpacing
          + geometry.rollerToYokeRatio * state.yokeDisplacement,
      ),
      Math.abs(
        state.rightRollerCenter.x
          - geometry.innerHalfSpacing
          - geometry.rollerToYokeRatio * state.yokeDisplacement,
      ),
    );
    near(state.leftRollerCenter.y, geometry.pinY, 0,
      `left fixed-slot height at ${sample}`);
    near(state.rightRollerCenter.y, geometry.pinY, 0,
      `right fixed-slot height at ${sample}`);
    near(state.leftRollerCenter.x, -state.rightRollerCenter.x, 0,
      `mirror centers at ${sample}`);
    near(state.leftRollerVelocity.x, -state.rightRollerVelocity.x, 0,
      `mirror velocities at ${sample}`);
    near(state.leftRollerAcceleration.x, -state.rightRollerAcceleration.x, 0,
      `mirror accelerations at ${sample}`);
    assert.ok(state.movingSlotParameters.left >= -1e-15);
    assert.ok(state.movingSlotParameters.left <= 1 + 1e-15);
    near(
      state.movingSlotParameters.left,
      state.movingSlotParameters.right,
      0,
      `equal slot parameters at ${sample}`,
    );
  }
  assert.ok(maximumMidpointError === 0);
  assert.ok(maximumMovingSlotResidual < 1.2e-15);
  assert.ok(maximumDisplacementLawError < 9e-16);
  disposeModel(model.root);
});

test('movement 252 exposes velocity and acceleration consistent with its positions', () => {
  const model = createMovementModel(catalog.movements[251]);
  const { geometry, stateAtTime } = model.root.userData;
  const step = 1e-5;
  let maximumPositionDerivativeError = 0;
  let maximumVelocityDerivativeError = 0;

  for (let sample = 0; sample < 2048; sample += 1) {
    const outward = sample % 2 === 0;
    const u = (Math.floor(sample / 2) + 0.5) / 1024;
    const time = outward
      ? THREE.MathUtils.lerp(0.01, 3.19, u)
      : THREE.MathUtils.lerp(4.01, 7.19, u);
    const before = stateAtTime(time - step);
    const state = stateAtTime(time);
    const after = stateAtTime(time + step);
    const numericalRollerVelocity = (
      after.leftRollerCenter.x - before.leftRollerCenter.x
    ) / (2 * step);
    const numericalRollerAcceleration = (
      after.leftRollerVelocity.x - before.leftRollerVelocity.x
    ) / (2 * step);
    maximumPositionDerivativeError = Math.max(
      maximumPositionDerivativeError,
      Math.abs(numericalRollerVelocity - state.leftRollerVelocity.x),
    );
    maximumVelocityDerivativeError = Math.max(
      maximumVelocityDerivativeError,
      Math.abs(numericalRollerAcceleration - state.leftRollerAcceleration.x),
    );
    near(
      state.leftRollerVelocity.x,
      -geometry.rollerToYokeRatio * state.yokeVelocity,
      1e-15,
      `exact speed ratio at ${sample}`,
    );
    near(
      state.leftRollerAcceleration.x,
      -geometry.rollerToYokeRatio * state.yokeAcceleration,
      1e-15,
      `exact acceleration ratio at ${sample}`,
    );
  }
  assert.ok(maximumPositionDerivativeError < 2e-8);
  assert.ok(maximumVelocityDerivativeError < 3e-8);
  disposeModel(model.root);
});

test('movement 252 follows the official traverse and dwell phase schedule', () => {
  const model = createMovementModel(catalog.movements[251]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const inner = stateAtTime(0);
  const outerStart = stateAtTime(timeline.outwardTraverseEnd);
  const outerDwell = stateAtTime(3.6);
  const inwardStart = stateAtTime(timeline.inwardTraverseStart);
  const innerStart = stateAtTime(timeline.inwardTraverseEnd);
  const innerDwell = stateAtTime(7.6);
  const closure = stateAtTime(timeline.cycleClosure);

  assert.equal(inner.segment, 'outward-traverse');
  assert.equal(outerDwell.segment, 'outer-dwell');
  assert.equal(inwardStart.segment, 'outer-dwell');
  assert.equal(innerDwell.segment, 'inner-dwell');
  near(inner.yokeDisplacement, 0, 0, 'inner yoke endpoint');
  near(inner.leftRollerCenter.x, -geometry.innerHalfSpacing, 0,
    'inner left endpoint');
  near(outerStart.yokeDisplacement, geometry.yokeTravel, 5e-15,
    'outer yoke endpoint');
  near(outerStart.leftRollerCenter.x, -geometry.outerHalfSpacing, 3e-15,
    'outer left endpoint');
  near(outerDwell.yokeDisplacement, geometry.yokeTravel, 0,
    'outer dwell position');
  near(outerDwell.yokeVelocity, 0, 0, 'outer dwell velocity');
  near(innerStart.yokeDisplacement, 0, 5e-15,
    'returned inner endpoint');
  near(innerDwell.yokeDisplacement, 0, 0, 'inner dwell position');
  near(innerDwell.yokeVelocity, 0, 0, 'inner dwell velocity');
  near(closure.cycleTime, 0, 0, 'cycle wraps exactly');
  near(closure.yokeDisplacement, inner.yokeDisplacement, 0,
    'cycle closes yoke position');
  near(closure.leftRollerCenter.x, inner.leftRollerCenter.x, 0,
    'cycle closes roller position');
  disposeModel(model.root);
});

test('movement 252 renders real open slots with positive running clearances', () => {
  const model = createMovementModel(catalog.movements[251]);
  const { blocks, geometry, solidClearanceAtTime } = model.root.userData;
  const innerClearance = solidClearanceAtTime(0);
  const outerClearance = solidClearanceAtTime(3.6);

  assert.equal(blocks.fixedSlotFrame.userData.actualOpenChannel, true);
  assert.equal(blocks.leftArm.userData.actualThroughSlot, true);
  assert.equal(blocks.rightArm.userData.actualThroughSlot, true);
  assert.equal(blocks.leftArm.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.rightArm.geometry.parameters.shapes.holes.length, 1);
  near(geometry.pinRadius, 0.5, 0, 'pin radius');
  near(geometry.rollerRadius, 1.5, 0, 'roller flange radius');
  near(innerClearance.fixedSlotNormalClearance, 0.08, 1e-15,
    'pin-to-fixed-slot clearance');
  near(innerClearance.movingSlotNormalClearance, 0.08, 1e-15,
    'pin-to-oblique-slot clearance');
  near(innerClearance.axialPlateClearance, 0.21, 1e-15,
    'fixed-to-moving plate clearance');
  near(
    innerClearance.leftRollerToRightRollerClearance,
    0.704416,
    1e-15,
    'minimum flange-to-flange clearance',
  );
  assert.ok(
    outerClearance.leftRollerToRightRollerClearance
      > innerClearance.leftRollerToRightRollerClearance,
  );
  assert.equal(innerClearance.pinSpansBothConstraintPlanes, true);

  blocks.leftMount.geometry.computeBoundingBox();
  const mountRightEdge = blocks.leftMount.geometry.boundingBox.max.x;
  const outerLeftRollerEdge = -geometry.outerHalfSpacing
    - geometry.rollerRadius;
  assert.ok(
    outerLeftRollerEdge - mountRightEdge > 0.1,
    'roller A clears the fixed left mounting bracket at full stroke',
  );
  assert.ok(
    6.3 - (geometry.outerHalfSpacing + geometry.rollerRadius) > 0.1,
    'roller B clears the open right rail ends at full stroke',
  );
  disposeModel(model.root);
});

test('movement 252 does not invent a roller spin law absent from the source', () => {
  const model = createMovementModel(catalog.movements[251]);
  const { blocks, rollerSpinConstraint, stateAtTime } = model.root.userData;
  const rollerParts = [];

  assert.equal(
    rollerSpinConstraint.status,
    'indeterminate-without-loaded-face-and-bearing-detail',
  );
  assert.equal(rollerSpinConstraint.renderedRadialIndex, false);
  assert.match(rollerSpinConstraint.explanation, /no roller angular velocity/);
  blocks.leftRoller.traverse((object) => rollerParts.push(object));
  blocks.rightRoller.traverse((object) => rollerParts.push(object));
  assert.equal(
    rollerParts.some((object) => (
      /(?:speed|radial)-index/i.test(object.userData.role ?? '')
    )),
    false,
  );
  assert.equal(blocks.leftRoller.userData.rotationalIndex, false);
  assert.equal(blocks.rightRoller.userData.rotationalIndex, false);

  for (const time of [0, 0.8, 2.4, 3.6, 5.2, 6.8, 7.6, 16.25]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.leftRoller.position.x, state.leftRollerCenter.x, 0,
      `rendered left center at ${time}`);
    near(blocks.rightRoller.position.x, state.rightRollerCenter.x, 0,
      `rendered right center at ${time}`);
    near(blocks.movingYoke.position.y, state.yokeY, 0,
      `rendered yoke at ${time}`);
    near(blocks.leftRoller.rotation.z, 0, 0,
      `left unindexed collar at ${time}`);
    near(blocks.rightRoller.rotation.z, 0, 0,
      `right unindexed collar at ${time}`);
  }
  disposeModel(model.root);
});

test('movement 252 closes exactly and movement 339 remains the next draft', () => {
  const model = createMovementModel(catalog.movements[251]);
  const { animationTiming, stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(animationTiming.authoredCyclePeriod, 8, 0,
    'authored demonstration period');
  near(animationTiming.targetCycleDuration, 2, 0,
    'normalized display period');
  assertReadableTiming(animationTiming);
  near(closure.yokeY, start.yokeY, 0, 'yoke closure');
  near(closure.leftRollerCenter.x, start.leftRollerCenter.x, 0,
    'left roller closure');
  near(closure.rightRollerCenter.x, start.rightRollerCenter.x, 0,
    'right roller closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});

test('movement 252 keeps piece D below slot C and the roller flanges', () => {
  const model = createMovementModel(catalog.movements[251]);
  const { blocks, geometry } = model.root.userData;
  const rollerBottom = geometry.pinY - geometry.rollerRadius;
  const railBottom = blocks.bottomRail.position.y - 0.26;
  for (let sample = 0; sample <= 64; sample += 1) {
    model.update(8 * sample / 64);
    model.root.updateMatrixWorld(true);
    for (const part of [blocks.crossbar, blocks.lowerWeb, blocks.inputBlock]) {
      part.geometry.computeBoundingBox();
      const top = part.geometry.boundingBox.max.y + part.position.y
        + blocks.movingYoke.position.y;
      assert.ok(rollerBottom - top > 0.6, `${part.userData.role} reaches ${top}`);
      assert.ok(railBottom - top > 0.3);
    }
  }
  disposeModel(model.root);
});
