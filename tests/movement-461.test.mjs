import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'rigid-serpentine-swinging-gutter-with-bottom-scoop-top-outlet-and-one-way-flap-boxes';
const FULL_TURN = Math.PI * 2;

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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 461 is one rigid six-stage serpentine gutter with bottom scoop, top outlet, and eleven flap-valved elbow boxes', () => {
  const movement = catalog.movements[460];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom, geometry } = data;

  assert.equal(movement.id, 461);
  assert.equal(movement.number, '461');
  assert.equal(movement.title, 'Flap-valved swinging gutter water lift');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.swingingGutter.parent, model.root);
  assert.equal(blocks.bottomScoop.parent, blocks.swingingGutter);
  assert.equal(blocks.outletMouth.parent, blocks.swingingGutter);
  assert.equal(blocks.branchAssemblies.length, 13);
  assert.equal(blocks.waterSlugs.length, 13);
  assert.equal(blocks.valveBoxes.length, 11);
  assert.equal(blocks.flaps.length, 11);
  assert.ok(blocks.branchAssemblies.every(({ floor, rails }) =>
    floor.parent === blocks.swingingGutter
      && rails.every((rail) => rail.parent === blocks.swingingGutter)));
  assert.ok(blocks.waterSlugs.every((slug) =>
    slug.parent === blocks.swingingGutter));
  assert.ok(blocks.valveBoxes.every((box) =>
    box.parent === blocks.swingingGutter));
  assert.ok(blocks.flaps.every(({ flap, mount }) =>
    mount.parent === blocks.swingingGutter && flap.parent === mount));
  assert.equal(blocks.pivotAxle.parent, model.root);
  assert.equal(blocks.support.parent, model.root);
  assert.equal(geometry.rowLevels.length, 6);
  assert.equal(geometry.valveCount, 11);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.swingingAssemblyIsRigid, true);
  assert.equal(degreesOfFreedom.branchMotionIndependent, false);
  assert.equal(degreesOfFreedom.flapOpeningIndependent, false);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.equal(roles.filter((role) =>
    role === 'one-rigid-serpentine-swinging-gutter-pendulum').length, 1);
  assert.equal(roles.filter((role) =>
    /intermediate-elbow-box-with-one-way-flap/.test(role)).length, 11);
  assert.equal(roles.filter((role) =>
    /one-way-flap-valve/.test(role)).length, 11);
  assert.equal(roles.filter((role) =>
    /forward-water-slug-in-conduit-branch/.test(role)).length, 13);
  disposeModel(model.root);
});

test('movement 461 source record preserves the scoop, open outlet, flap boxes, and two-branch elbows without invented timing', () => {
  const movement = catalog.movements[460];
  const model = createMovementModel(movement);
  const { dynamics, sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate461;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_461.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /swinging gutters.*raising water/);
  assert.match(movement.description, /pendulous motions/);
  assert.match(movement.description, /Terminations at bottom are scoops/);
  assert.match(movement.description, /at top open pipes/);
  assert.match(movement.description, /boxes \(and flap valve\)/);
  assert.match(movement.description, /connected with two branches of pipe/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /six near-horizontal branches.*parallel diagonal risers.*boxed elbows.*lower-left termination.*upper-left pipe.*central pendulum axis/);
  assert.match(evidence.reconstructionDisclosure,
    /no branch dimensions, valve count in prose.*six horizontal stages and eleven intermediate elbows.*independently engineered/);
  assert.match(dynamics.swingModel,
    /one rigid pendulum.*sinusoidal 12-degree swing.*continuous velocity and acceleration/);
  assert.match(dynamics.flowModel,
    /alternates the two interleaved flap sets.*upstream point toward its downstream point/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.horizontalBranchCount, 6);
  assert.deepEqual(plate.approximateBottomScoopPixels, [190, 405]);
  assert.deepEqual(plate.approximateCentralPivotPixels, [257, 282]);
  assert.deepEqual(plate.approximateTopOutletPixels, [94, 126]);
  assert.deepEqual(plate.approximateTopRightElbowPixels, [307, 126]);
  disposeModel(model.root);
});

test('movement 461 path is a single continuous bottom-to-top conduit with every valve box at an intermediate elbow', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { blocks, geometry } = model.root.userData;
  const { localPathPoints, segmentLengths } = geometry;

  assert.equal(localPathPoints.length, 14);
  assert.equal(segmentLengths.length, localPathPoints.length - 1);
  assert.equal(geometry.junctionLocalPoints.length, 11);
  vectorNear(blocks.bottomScoop.position, localPathPoints[0], 0,
    'bottom termination is first path point');
  vectorNear(blocks.outletMouth.position, localPathPoints.at(-1), 0,
    'top termination is last path point');
  let summedLength = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    near(segmentLengths[index],
      localPathPoints[index].distanceTo(localPathPoints[index + 1]), 0,
    `branch length ${index}`);
    summedLength += segmentLengths[index];
    vectorNear(blocks.branchAssemblies[index].start,
      localPathPoints[index], 0, `branch ${index} start`);
    vectorNear(blocks.branchAssemblies[index].end,
      localPathPoints[index + 1], 0, `branch ${index} end`);
  }
  near(summedLength, geometry.totalConduitLength, 0,
    'total continuous conduit length');
  for (let index = 0; index < geometry.valveCount; index += 1) {
    vectorNear(blocks.valveBoxes[index].position,
      localPathPoints[index + 1], 0, `valve box ${index} at elbow`);
  }
  assert.ok(localPathPoints[0].y < geometry.rowLevels[0]);
  assert.ok(localPathPoints.at(-1).y === geometry.rowLevels.at(-1));
  assert.ok(localPathPoints.at(-1).x < localPathPoints.at(-2).x);
  disposeModel(model.root);
});

test('movement 461 source pose is the neutral rigid lattice with its scoop immersed and top outlet elevated', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { geometry, sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(0);

  near(sourcePose.swingAngle, 0, 0, 'neutral source swing');
  assert.equal(sourcePose.activeValveSet,
    'all-flaps-seated-at-neutral-crossing');
  vectorNear(sourcePose.bottomScoop, source.bottomScoop, 0,
    'source bottom scoop');
  vectorNear(sourcePose.outlet, source.outlet, 0, 'source outlet');
  near(source.bottomScoopImmersion,
    geometry.reservoirSurfaceY - source.bottomScoop.y, 0,
  'source scoop immersion');
  assert.ok(source.bottomScoopImmersion > 0);
  assert.ok(source.outlet.y - source.bottomScoop.y > 4.9);
  assert.ok(source.swingAngularSpeed > 0,
    'neutral position is crossed with pendulum speed');
  assert.ok(source.valveOpenAmounts.every((amount) => amount === 0));
  disposeModel(model.root);
});

test('movement 461 applies one rigid rotation to every path point and preserves every branch length', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  for (let sample = 0; sample < 16000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 16000);
    for (let index = 0; index < geometry.localPathPoints.length;
      index += 1) {
      const expected = geometry.localPathPoints[index].clone()
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), state.swingAngle)
        .add(geometry.gutterPivot);
      vectorNear(state.worldPathPoints[index], expected, 0,
        `rigid path point ${index} at ${sample}`);
      if (index < geometry.segmentLengths.length) {
        near(state.worldPathPoints[index].distanceTo(
          state.worldPathPoints[index + 1]),
        geometry.segmentLengths[index], 2e-15,
        `rigid branch ${index} at ${sample}`);
      }
    }
  }
  disposeModel(model.root);
});

test('movement 461 analytic rigid-body point velocities and accelerations match finite differences', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const step = 1e-6;
  for (const angle of [0.34, 1.18, 2.77, 4.13, 5.62]) {
    const before = stateAtInputAngle(angle - step);
    const state = stateAtInputAngle(angle);
    const after = stateAtInputAngle(angle + step);
    const scale = geometry.inputAngularSpeed / (2 * step);
    for (const index of [0, 3, 7, 13]) {
      const numericVelocity = after.worldPathPoints[index].clone()
        .sub(before.worldPathPoints[index]).multiplyScalar(scale);
      const numericAcceleration = after.pointVelocities[index].clone()
        .sub(before.pointVelocities[index]).multiplyScalar(scale);
      vectorNear(state.pointVelocities[index], numericVelocity, 5e-10,
        `point ${index} velocity at ${angle}`);
      vectorNear(state.pointAccelerations[index], numericAcceleration, 5e-10,
        `point ${index} acceleration at ${angle}`);
    }
    const numericSwingSpeed = (after.swingAngle - before.swingAngle) * scale;
    const numericSwingAcceleration = (after.swingAngularSpeed
      - before.swingAngularSpeed) * scale;
    near(state.swingAngularSpeed, numericSwingSpeed, 4e-11,
      `swing speed at ${angle}`);
    near(state.swingAngularAcceleration, numericSwingAcceleration, 1e-10,
      `swing acceleration at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 461 alternating flap sets open only forward on opposite pendulum half-cycles', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { geometry, stateAtInputAngle } = model.root.userData;
  const positive = stateAtInputAngle(Math.PI / 2);
  const negative = stateAtInputAngle(Math.PI * 1.5);
  const neutralA = stateAtInputAngle(0);
  const neutralB = stateAtInputAngle(Math.PI);

  assert.equal(positive.activeValveSet, 'even-elbow-flaps-forward-open');
  near(positive.evenValveOpenAmount, 1, 0, 'even valves fully open');
  near(positive.oddValveOpenAmount, 0, 0, 'odd valves seated');
  assert.equal(negative.activeValveSet, 'odd-elbow-flaps-forward-open');
  near(negative.evenValveOpenAmount, 0, 0, 'even valves seated');
  near(negative.oddValveOpenAmount, 1, 0, 'odd valves fully open');
  for (const neutral of [neutralA, neutralB]) {
    assert.equal(neutral.activeValveSet,
      'all-flaps-seated-at-neutral-crossing');
    assert.ok(neutral.valveOpenAmounts.every((amount) => amount === 0));
    assert.ok(neutral.flapAngles.every((angle) => angle === 0));
  }
  for (let sample = 0; sample < 12000; sample += 1) {
    const state = stateAtInputAngle(FULL_TURN * sample / 12000);
    assert.ok(!(state.evenValveOpenAmount > 0
      && state.oddValveOpenAmount > 0));
    state.valveOpenAmounts.forEach((amount, index) => {
      assert.ok(amount >= 0 && amount <= 1);
      assert.ok(state.flapAngles[index] >= 0,
        `valve ${index} never opens backward at ${sample}`);
      near(Math.abs(state.flapAngles[index]),
        geometry.maximumFlapAngle * amount, 2e-16,
      `valve ${index} angle at ${sample}`);
    });
  }
  disposeModel(model.root);
});

test('movement 461 valve seating is C2 at neutral crossings and full opening is stationary at swing extremes', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { stateAtInputAngle } = model.root.userData;
  for (const angle of [0, Math.PI, FULL_TURN]) {
    const state = stateAtInputAngle(angle);
    near(state.evenValveOpenRate, 0, 0, `even rate at ${angle}`);
    near(state.oddValveOpenRate, 0, 0, `odd rate at ${angle}`);
    near(state.evenValveOpenAcceleration, 0, 0,
      `even acceleration at ${angle}`);
    near(state.oddValveOpenAcceleration, 0, 0,
      `odd acceleration at ${angle}`);
  }
  for (const angle of [Math.PI / 2, Math.PI * 1.5]) {
    const state = stateAtInputAngle(angle);
    near(state.evenValveOpenRate, 0, 2e-31,
      `even extreme rate at ${angle}`);
    near(state.oddValveOpenRate, 0, 2e-31,
      `odd extreme rate at ${angle}`);
    near(state.evenValveOpenAcceleration, 0, 2e-15,
      `even extreme acceleration at ${angle}`);
    near(state.oddValveOpenAcceleration, 0, 2e-15,
      `odd extreme acceleration at ${angle}`);
  }
  const epsilon = 1e-8;
  for (const angle of [0, Math.PI, FULL_TURN]) {
    const before = stateAtInputAngle(angle - epsilon);
    const after = stateAtInputAngle(angle + epsilon);
    near(after.evenValveOpenRate, before.evenValveOpenRate, 2e-12,
      `even C1 at ${angle}`);
    near(after.oddValveOpenRate, before.oddValveOpenRate, 2e-12,
      `odd C1 at ${angle}`);
    near(after.evenValveOpenAcceleration,
      before.evenValveOpenAcceleration, 1e-6,
    `even C2 at ${angle}`);
    near(after.oddValveOpenAcceleration,
      before.oddValveOpenAcceleration, 1e-6,
    `odd C2 at ${angle}`);
  }
  disposeModel(model.root);
});

test('movement 461 water slugs always grow from the upstream endpoint and the top outlet pulses only on its transfer half-cycle', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  for (const phase of [0, 0.125, 0.25, 0.5, 0.625, 0.75, 1]) {
    const time = geometry.cycleDuration * phase;
    const state = stateAtTime(time);
    update(time);
    near(blocks.swingingGutter.rotation.z, state.swingAngle, 0,
      `gutter swing at ${phase}`);
    for (let index = 0; index < blocks.waterSlugs.length; index += 1) {
      const slug = blocks.waterSlugs[index];
      const start = geometry.localPathPoints[index];
      const end = geometry.localPathPoints[index + 1];
      const direction = end.clone().sub(start).normalize();
      const half = direction.clone().multiplyScalar(slug.scale.x / 2);
      const renderedStart = slug.position.clone().sub(half);
      const renderedEnd = slug.position.clone().add(half);
      renderedStart.z = 0;
      renderedEnd.z = 0;
      vectorNear(renderedStart, start, 8e-16,
        `upstream anchor segment ${index} at ${phase}`);
      vectorNear(renderedEnd,
        start.clone().lerp(end, state.segmentFillFractions[index]), 9e-16,
      `forward fill segment ${index} at ${phase}`);
    }
    blocks.flaps.forEach(({ flap }, index) => near(
      flap.rotation.z,
      state.flapAngles[index],
      0,
      `flap ${index} renderer at ${phase}`,
    ));
    assert.ok(blocks.dischargeJets.every((jet) =>
      jet.visible === (state.outletDischargeFraction > 1e-4)));
  }
  disposeModel(model.root);
});

test('movement 461 renderer leaves the pivot and support fixed and closes exactly after one swing cycle', () => {
  const model = createMovementModel(catalog.movements[460]);
  const { blocks, geometry, stateAtTime, update } = model.root.userData;
  const fixedBlocks = [blocks.base, blocks.pivotAxle, blocks.reservoir,
    blocks.reservoirOpening, blocks.reservoirRim, blocks.support];
  const fixedPositions = fixedBlocks.map((block) => block.position.clone());

  for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
    update(geometry.cycleDuration * phase);
    fixedBlocks.forEach((block, index) => vectorNear(
      block.position,
      fixedPositions[index],
      0,
      `fixed apparatus at ${phase}`,
    ));
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  near(closure.swingAngle, source.swingAngle, 0, 'swing cycle closure');
  near(closure.swingAngularSpeed, source.swingAngularSpeed, 0,
    'swing-speed closure');
  assert.deepEqual(closure.valveOpenAmounts, source.valveOpenAmounts);
  closure.worldPathPoints.forEach((point, index) => vectorNear(
    point,
    source.worldPathPoints[index],
    0,
    `path closure ${index}`,
  ));
  disposeModel(model.root);
});

test('movement 461 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement461 = catalog.movements[460];
  const movement507 = catalog.movements[506];
  const model461 = createMovementModel(movement461);
  const model507 = createMovementModel(movement507);
  model461.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model461.root);

  for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z]) assert.ok(Number.isFinite(value));
  assert.ok(bounds.max.x > bounds.min.x);
  assert.ok(bounds.max.y > bounds.min.y);
  assert.ok(bounds.max.z > bounds.min.z);
  assert.equal(movement461.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model461.root);
  disposeModel(model507.root);
});
