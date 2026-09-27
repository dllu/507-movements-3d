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

test('movement 387 is a tide-driven two-stringer ladder with seven independently suspended level treads', () => {
  const movement = catalog.movements[386];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 387);
  assert.equal(movement.number, '387');
  assert.equal(movement.category, 'Levers & linkages');
  assert.equal(
    movement.archetype,
    'tide-float-parallelogram-stringers-suspended-horizontal-tread-ladder',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /tide-driven-floating-end/);
  assert.match(data.mechanism, /two-rigid-stringers/);
  assert.match(data.mechanism, /parallel-handrails/);
  assert.match(data.mechanism, /seven-pivoted-and-rod-suspended/);
  assert.match(data.mechanism, /self-leveling-treads/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.deepEqual(degreesOfFreedom.inputs, [
    'vertical tide displacement of the floating ladder end',
  ]);
  assert.match(degreesOfFreedom.note, /horizontal float drift/);
  assert.match(degreesOfFreedom.note, /zero pitch/);

  for (const component of [
    blocks.fixedEndFrame,
    blocks.floatAssembly,
    ...blocks.lowerStringers,
    ...blocks.suspensionRods.flat(),
    ...blocks.treads,
    ...blocks.upperHandrails,
    blocks.water,
    blocks.wharf,
  ]) assert.equal(component.parent, model.root);
  // Brown draws no white rail indices; the source presentation detaches them.
  for (const index of blocks.railIndexes) assert.equal(index.parent, null);
  assert.equal(blocks.floatingEndFrame.parent, blocks.floatAssembly);
  for (const component of [
    ...blocks.floatingLowerPins,
    ...blocks.floatingUpperPins,
  ]) assert.equal(component.parent, blocks.floatingEndFrame);
  for (const component of [
    ...blocks.fixedLowerPins,
    ...blocks.fixedUpperPins,
  ]) assert.equal(component.parent, blocks.fixedEndFrame);
  assert.equal(blocks.lowerStringers.length, 2);
  assert.equal(blocks.upperHandrails.length, 2);
  assert.equal(blocks.treads.length, 7);
  assert.equal(blocks.suspensionRods.length, 7);
  assert.ok(blocks.suspensionRods.every((rods) => rods.length === 2));

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'fixed-masonry-wharf-and-guard-rail',
    'tide-following-floating-end-assembly',
    'floating-open-boat-hull',
    'boat-thwart-carrying-end-frame-posts',
    'rigid-lower-ladder-stringer',
    'parallel-upper-handrail-bar',
    'world-horizontal-pivoted-wharf-ladder-tread',
    'tread-rear-edge-stringer-pivot-axle',
    'tread-front-edge-suspension-axle',
    'constant-length-tread-suspension-rod',
    'moving-tide-water-level-reference',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => /^white-/.test(role)),
    'no undrawn white indices remain');
  disposeModel(model.root);
});

test('movement 387 preserves Brown and Keveney source evidence and discloses its 3D reconstruction', () => {
  const movement = catalog.movements[386];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate387;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_387.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /rise and fall of tide/);
  assert.match(movement.description, /pivoted at one edge/);
  assert.match(movement.description, /supported by rods/);
  assert.match(movement.description, /remain horizontal/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.deepEqual(sourceAnimation.sourceViewBox, [-20, -14, 28, 28]);
  assert.equal(sourceAnimation.sourceLadderLength, 17);
  assert.equal(sourceAnimation.sourceHandrailOffset, 8);
  assert.deepEqual(sourceAnimation.sourceEffectiveTideLevels, [0, -6]);
  assert.deepEqual(
    sourceAnimation.sourceSliderTranslations,
    [[-0.5, -9], [-0.5, -3]],
  );
  assert.deepEqual(
    sourceAnimation.sourceSliderLocalSegment,
    [[-20, 3], [-15, 3]],
  );
  assert.deepEqual(sourceAnimation.normalizedEventPhases, [
    0, 0.4, 0.5, 0.9, 1,
  ]);
  assert.deepEqual(sourceAnimation.sourceStepStations, [
    0,
    -2.428571,
    -4.857143,
    -7.285714,
    -9.714286,
    -12.142857,
    -14.571429,
  ]);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsMassesBuoyancyOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 12);
  assert.deepEqual(plate.highTideLowerPivotCentersPixels, {
    floating: [66, 191],
    wharf: [340, 198],
  });
  assert.deepEqual(plate.lowTideLowerPivotCentersPixels, {
    floating: [89, 480],
    wharf: [339, 415],
  });
  assert.equal(evidence.explicitInBrownDescription.length, 4);
  assert.match(evidence.officialAnimationEvidence, /17-unit/);
  assert.match(evidence.officialAnimationEvidence, /8-unit/);
  assert.match(evidence.officialAnimationEvidence, /seven stations/);
  assert.match(evidence.officialAnimationEvidence, /0 and -6/);
  assert.match(evidence.reconstructionDisclosure, /twin 3D rails/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 387 floating end follows the exact rigid-stringer circle through the full tide cycle', () => {
  const model = createMovementModel(catalog.movements[386]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, stateAtTime, timeline } = data;

  near(geometry.ladderLength,
    geometry.sourceLadderLength * geometry.sourceScale, 0,
    'scaled ladder length');
  near(geometry.handrailHeight,
    geometry.sourceHandrailHeight * geometry.sourceScale, 0,
    'scaled handrail height');
  near(geometry.maximumTideDrop,
    geometry.sourceMaximumTideDrop * geometry.sourceScale, 0,
    'scaled tide drop');
  near(geometry.treadSpacing,
    geometry.sourceStepSpacing * geometry.sourceScale, 0,
    'scaled tread spacing');
  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 4e-15, name);
  }

  for (let sample = -3600; sample <= 7200; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 3600);
    near(
      state.horizontalSpan ** 2 + state.tideDrop ** 2,
      geometry.ladderLength ** 2,
      1.5e-14,
      'float circular constraint',
    );
    near(
      state.dockLower.distanceTo(state.floatLower),
      geometry.ladderLength,
      2e-15,
      'lower stringer length',
    );
    near(state.floatLower.y,
      state.dockLower.y - state.tideDrop, 0,
      'prescribed vertical float position');
    near(state.floatLower.x,
      state.dockLower.x - state.horizontalSpan, 0,
      'dependent horizontal float drift');
    assert.ok(state.tideDrop >= -1e-15);
    assert.ok(state.tideDrop <= geometry.maximumTideDrop + 1e-15);
  }
  disposeModel(model.root);
});

test('movement 387 retains the official fall-dwell-rise-dwell timing with smooth reversals', () => {
  const model = createMovementModel(catalog.movements[386]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;
  const events = [
    [0, 'tide-falling-ladder-descending', 0],
    [timeline.events.lowDwellStarts, 'low-tide-dwell', 1],
    [timeline.events.ascendingStarts, 'tide-rising-ladder-ascending', 1],
    [timeline.events.highDwellStarts, 'high-tide-dwell', 0],
    [timeline.cycleDuration, 'tide-falling-ladder-descending', 0],
  ];
  for (const [time, stage, fraction] of events) {
    const state = stateAtTime(time);
    assert.equal(state.stage, stage);
    near(state.tideFraction, fraction, 2e-15, `${stage} fraction`);
    near(state.tideDropRate, 0, 3e-15, `${stage} velocity`);
    near(state.tideDropAcceleration, 0, 3e-15,
      `${stage} acceleration`);
  }

  const descendingMidpoint = stateAtTime(
    timeline.events.lowDwellStarts / 2,
  );
  const ascendingMidpoint = stateAtTime(
    (timeline.events.ascendingStarts + timeline.events.highDwellStarts) / 2,
  );
  near(descendingMidpoint.tideDrop,
    geometry.maximumTideDrop / 2, 2e-15,
    'descending midpoint drop');
  near(ascendingMidpoint.tideDrop,
    geometry.maximumTideDrop / 2, 2e-15,
    'ascending midpoint drop');
  near(descendingMidpoint.tideDropRate,
    -ascendingMidpoint.tideDropRate, 2e-15,
    'time-mirrored tide speed');
  near(descendingMidpoint.floatVelocity.x,
    -ascendingMidpoint.floatVelocity.x, 2e-15,
    'time-mirrored float drift speed');
  assert.ok(descendingMidpoint.ladderAngularSpeed > 0);
  assert.ok(ascendingMidpoint.ladderAngularSpeed < 0);
  disposeModel(model.root);
});

test('movement 387 upper handrails are exact translates of the equal lower stringers', () => {
  const model = createMovementModel(catalog.movements[386]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  const verticalOffset = new THREE.Vector3(0, geometry.handrailHeight, 0);

  assert.match(transmission.floatCircleLaw, /horizontalSpan\^2/);
  assert.match(transmission.endFrameLaw, /floatUpper=floatLower/);
  for (let sample = -2400; sample <= 4800; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 2400);
    vectorNear(
      state.dockUpper.clone().sub(state.dockLower),
      verticalOffset,
      8e-16,
      'fixed end-frame vertical offset',
    );
    vectorNear(
      state.floatUpper.clone().sub(state.floatLower),
      verticalOffset,
      8e-16,
      'floating end-frame vertical offset',
    );
    vectorNear(
      state.floatUpper.clone().sub(state.dockUpper),
      state.floatLower.clone().sub(state.dockLower),
      1.5e-15,
      'translated parallel rail vector',
    );
    near(state.dockUpper.distanceTo(state.floatUpper),
      geometry.ladderLength, 2e-15,
      'upper handrail length');
  }
  disposeModel(model.root);
});

test('movement 387 keeps every tread horizontal with constant support rods at every ladder inclination', () => {
  const model = createMovementModel(catalog.movements[386]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;

  assert.match(transmission.supportLaw, /constant length/);
  assert.match(transmission.treadLevelLaw, /pitch=0/);
  for (let sample = -1800; sample <= 3600; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 1800);
    assert.equal(state.stepStates.length, geometry.treadCount);
    for (const step of state.stepStates) {
      near(step.stringerDistance,
        step.index * geometry.treadSpacing, 1e-15,
        `tread ${step.index} station`);
      near(step.frontEdgeCenter.y, step.rearEdgeCenter.y, 0,
        `tread ${step.index} level edge heights`);
      near(step.pitchAngle, 0, 0,
        `tread ${step.index} pitch`);
      vectorNear(
        step.upperSupportCenter.clone().sub(step.rearEdgeCenter),
        new THREE.Vector3(0, geometry.handrailHeight, 0),
        8e-16,
        `tread ${step.index} upper-rail offset`,
      );
      for (const support of step.supports) {
        near(support.length, geometry.supportRodLength, 1e-15,
          `tread ${step.index} support length`);
        near(support.lower.y, support.upper.y - geometry.handrailHeight,
          8e-16, `tread ${step.index} support vertical component`);
        near(support.lower.x, support.upper.x - geometry.treadDepth,
          8e-16, `tread ${step.index} support horizontal component`);
      }
    }
  }

  const high = stateAtTime(0);
  for (const step of high.stepStates) {
    near(step.rearEdgeCenter.y, geometry.dockLower.y, 3e-16,
      `high-tide tread ${step.index} height`);
  }
  const low = stateAtTime(timeline.events.lowDwellStarts);
  for (let index = 1; index < low.stepStates.length; index += 1) {
    assert.ok(
      low.stepStates[index].rearEdgeCenter.y
        < low.stepStates[index - 1].rearEdgeCenter.y,
      `low-tide tread ${index} descends toward the float`,
    );
  }
  disposeModel(model.root);
});

test('movement 387 renderer binds all rail, tread, rod, float, and water states exactly', () => {
  const model = createMovementModel(catalog.movements[386]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime, timeline } = data;
  const times = [
    0,
    timeline.events.lowDwellStarts * 0.43,
    timeline.events.lowDwellStarts,
    timeline.events.ascendingStarts,
    (timeline.events.ascendingStarts + timeline.events.highDwellStarts) / 2,
    timeline.events.highDwellStarts,
    timeline.cycleDuration,
  ];

  for (const time of times) {
    model.update(time);
    const state = stateAtTime(time);
    vectorNear(blocks.floatAssembly.position, state.floatLower, 2e-15,
      'floating assembly position');
    near(blocks.water.position.y, state.waterLevel, 0,
      'animated water height');
    for (let index = 0; index < 2; index += 1) {
      const side = index === 0 ? -1 : 1;
      const expectedLowerStart = state.dockLower.clone();
      const expectedLowerEnd = state.floatLower.clone();
      const expectedUpperStart = state.dockUpper.clone();
      const expectedUpperEnd = state.floatUpper.clone();
      expectedLowerStart.z = side * geometry.railHalfWidth;
      expectedLowerEnd.z = side * geometry.railHalfWidth;
      expectedUpperStart.z = side * geometry.railHalfWidth;
      expectedUpperEnd.z = side * geometry.railHalfWidth;
      vectorNear(
        blocks.lowerStringers[index].userData.endpoints.start,
        expectedLowerStart,
        2e-15,
        `lower stringer ${index} start`,
      );
      vectorNear(
        blocks.lowerStringers[index].userData.endpoints.end,
        expectedLowerEnd,
        2e-15,
        `lower stringer ${index} end`,
      );
      vectorNear(
        blocks.upperHandrails[index].userData.endpoints.start,
        expectedUpperStart,
        2e-15,
        `upper handrail ${index} start`,
      );
      vectorNear(
        blocks.upperHandrails[index].userData.endpoints.end,
        expectedUpperEnd,
        2e-15,
        `upper handrail ${index} end`,
      );
    }
    for (let treadIndex = 0; treadIndex < geometry.treadCount;
      treadIndex += 1) {
      const step = state.stepStates[treadIndex];
      const tread = blocks.treads[treadIndex];
      vectorNear(tread.position, step.rearEdgeCenter, 2e-15,
        `tread ${treadIndex} rear pivot`);
      near(tread.rotation.x, 0, 0, `tread ${treadIndex} roll`);
      near(tread.rotation.y, 0, 0, `tread ${treadIndex} yaw`);
      near(tread.rotation.z, 0, 0, `tread ${treadIndex} pitch`);
      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const rod = blocks.suspensionRods[treadIndex][sideIndex];
        const support = step.supports[sideIndex];
        vectorNear(rod.userData.endpoints.start, support.upper, 2e-15,
          `tread ${treadIndex} rod ${sideIndex} upper end`);
        vectorNear(rod.userData.endpoints.end, support.lower, 2e-15,
          `tread ${treadIndex} rod ${sideIndex} lower end`);
      }
    }
    near(data.contacts.railPivots.lowerLengthResidual, 0, 2e-15,
      'runtime lower stringer closure');
    near(data.contacts.railPivots.upperLengthResidual, 0, 2e-15,
      'runtime upper handrail closure');
    for (const contact of data.contacts.treadSupports) {
      near(contact.pitchError, 0, 0,
        `runtime tread ${contact.treadIndex} level error`);
      for (const residual of contact.rodLengthResiduals) {
        near(residual, 0, 2e-15,
          `runtime tread ${contact.treadIndex} rod closure`);
      }
    }
  }
  disposeModel(model.root);
});

test('movement 387 closes one complete tide cycle before movement 507 remains authored', () => {
  const movement = catalog.movements[386];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleDuration);

  near(end.tideDrop, start.tideDrop, 0, 'cycle tide displacement');
  near(end.tideDropRate, start.tideDropRate, 0, 'cycle tide velocity');
  near(end.ladderInclination, start.ladderInclination, 0,
    'cycle ladder inclination');
  vectorNear(end.floatLower, start.floatLower, 0,
    'cycle floating lower pivot');
  vectorNear(end.floatUpper, start.floatUpper, 0,
    'cycle floating upper pivot');
  for (let index = 0; index < start.stepStates.length; index += 1) {
    vectorNear(
      end.stepStates[index].rearEdgeCenter,
      start.stepStates[index].rearEdgeCenter,
      0,
      `cycle tread ${index} rear edge`,
    );
  }

  model.update(0);
  const startFloat = data.blocks.floatAssembly.position.clone();
  model.update(timeline.cycleDuration);
  vectorNear(data.blocks.floatAssembly.position, startFloat, 0,
    'rendered cycle float closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, movement.archetype);
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 387 shows the tide as a shallow surface layer and the boat at Brown\'s length', () => {
  const model = createMovementModel(catalog.movements[386]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  for (const time of [0, data.timeline.events.lowDwellStarts]) {
    model.update(time);
    const state = stateAtTime(time);
    model.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(blocks.water);
    near(box.max.y, state.waterLevel, 1e-6, 'water surface');
    // Brown draws surface lines only: a shallow layer, not a block to the bed.
    const depth = box.max.y - box.min.y;
    assert.ok(depth < 0.4, `water layer depth ${depth}`);
    assert.ok(box.min.y > data.groundFloorY, 'water does not reach the bed');
    // The hull floats in the layer: its keel lies inside it.
    const hull = new THREE.Box3().setFromObject(blocks.floatAssembly.children.find(
      (child) => child.userData.role === 'floating-open-boat-hull'));
    assert.ok(hull.min.y < state.waterLevel && hull.min.y > box.min.y, 'keel lies within the surface layer');
  }
  const shape = blocks.floatAssembly.userData.hullShape;
  // Brown's boat is about 0.31 of the ladder's length.
  near((shape.stern - shape.bow) / geometry.ladderLength, 0.31, 0.02, 'boat length ratio');
});
