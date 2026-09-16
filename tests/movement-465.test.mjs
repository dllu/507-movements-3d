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
  'human-worked-balance-beam-driving-two-reciprocal-single-acting-pumps-with-alternating-check-valves';
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

function movementModel() {
  const movement = catalog.movements[464];
  return { model: createMovementModel(movement), movement };
}

test('movement 465 is one human-worked balance beam driving exactly two single-acting pumps into a common outlet', () => {
  const { model, movement } = movementModel();
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 465);
  assert.equal(movement.number, '465');
  assert.equal(movement.title, 'Reciprocal human-worked balance pumps');
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.equal(blocks.beam.parent, model.root);
  assert.equal(blocks.beamAxle.parent, model.root);
  assert.equal(blocks.pumpAssemblies.length, 2);
  assert.equal(blocks.attachmentPins.length, 2);
  assert.equal(blocks.endWeights.length, 2);
  assert.equal(blocks.treadPads.length, 2);
  assert.equal(blocks.commonOutlet.parent, model.root);
  assert.equal(blocks.reservoir.parent, model.root);
  assert.ok(blocks.pumpAssemblies.every(({ crosshead, cylinder,
    deliveryValve, inletValve, piston, pistonRod, pitman }) =>
    crosshead.parent === model.root
      && cylinder.parent === model.root
      && deliveryValve.parent === model.root
      && inletValve.parent === model.root
      && piston.parent === model.root
      && pistonRod.parent === model.root
      && pitman.parent === model.root));
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.beamIsSolePrescribedInput, true);
  assert.equal(degreesOfFreedom.pumpSlidersIndependent, false);
  disposeModel(model.root);
});

test('movement 465 source record preserves the person, one beam, reciprocal pair, and unavailable animation without invented timing', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const plate = sourceReference.brownPlate465;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_465.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.equal(sourceReference.plate, 'Brown 1868, Movement 465');
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.equal(sourceAnimation.sourcePrescribedNormalizedTiming, false);
  assert.deepEqual(plate.approximateBalanceBeamEndpointsPixels,
    [[72, 165], [433, 306]]);
  assert.deepEqual(plate.approximateCylinderCentersPixels,
    [[230, 382], [292, 382]]);
  assert.deepEqual(plate.approximateRockingPivotPixels, [300, 249]);
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('pair of balance pumps')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('works reciprocally')));
  assert.ok(evidence.explicitInBrownDescription.some((claim) =>
    claim.includes('person presses alternately')));
  assert.match(evidence.engravingEvidence, /ball-ended beam/i);
  assert.match(evidence.reconstructionDisclosure, /no beam length/i);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/i);
  disposeModel(model.root);
});

test('movement 465 both pitmans retain exact length while their crossheads remain on fixed vertical slider axes', () => {
  const { model } = movementModel();
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample <= 160; sample += 1) {
    const angle = FULL_TURN * sample / 160;
    const state = stateAtInputAngle(angle);
    state.pumps.forEach((pump, index) => {
      near(pump.crosshead.x, pump.sliderX, 1e-12,
        `pump ${index} slider x at ${angle}`);
      near(pump.piston.x, pump.sliderX, 1e-12,
        `pump ${index} piston x at ${angle}`);
      near(pump.beamPin.distanceTo(pump.crosshead),
        geometry.pitmanLength, 2e-12,
        `pump ${index} pitman closure at ${angle}`);
      near(pump.crosshead.y - pump.piston.y,
        geometry.pistonRodOffset, 1e-12,
        `pump ${index} rigid piston rod at ${angle}`);
      assert.ok(Math.abs(pump.horizontalOffset) < geometry.pitmanLength);
      assert.ok(pump.piston.y > geometry.cylinderBottomY);
      assert.ok(pump.piston.y < geometry.cylinderTopY);
    });
  }
  disposeModel(model.root);
});

test('movement 465 beam pins are one rigid symmetric pair and rock through the prescribed amplitude', () => {
  const { model } = movementModel();
  const { geometry, stateAtInputAngle } = model.root.userData;

  for (const angle of [0, 0.37, Math.PI / 2, 2.81,
    3 * Math.PI / 2, 5.71]) {
    const state = stateAtInputAngle(angle);
    const leftRadius = state.pumps[0].beamPin.clone().sub(geometry.beamPivot);
    const rightRadius = state.pumps[1].beamPin.clone().sub(geometry.beamPivot);
    near(leftRadius.length(), geometry.attachmentRadius, 1e-12,
      `left attachment radius at ${angle}`);
    near(rightRadius.length(), geometry.attachmentRadius, 1e-12,
      `right attachment radius at ${angle}`);
    vectorNear(leftRadius, rightRadius.clone().negate(), 1e-12,
      `opposed beam pins at ${angle}`);
    near(state.beamAngle,
      geometry.beamAmplitude * Math.sin(state.cycleAngle), 1e-12,
      `harmonic beam angle at ${angle}`);
  }
  near(stateAtInputAngle(Math.PI / 2).beamAngle,
    geometry.beamAmplitude, 1e-12, 'positive beam extreme');
  near(stateAtInputAngle(3 * Math.PI / 2).beamAngle,
    -geometry.beamAmplitude, 1e-12, 'negative beam extreme');
  disposeModel(model.root);
});

test('movement 465 piston velocities and accelerations match finite differences of the exact linkage', () => {
  const { model } = movementModel();
  const { stateAtInputAngle } = model.root.userData;
  const inputSpeed = 1.31;
  const timeStep = 1e-4;

  for (const angle of [0.21, 0.84, 2.24, 3.37, 4.16, 5.48]) {
    const center = stateAtInputAngle(angle, inputSpeed);
    const before = stateAtInputAngle(
      angle - inputSpeed * timeStep,
      inputSpeed,
    );
    const after = stateAtInputAngle(
      angle + inputSpeed * timeStep,
      inputSpeed,
    );
    center.pumps.forEach((pump, index) => {
      const numericalVelocity = (
        after.pumps[index].piston.y - before.pumps[index].piston.y
      ) / (2 * timeStep);
      const numericalAcceleration = (
        after.pumps[index].piston.y
        - 2 * pump.piston.y
        + before.pumps[index].piston.y
      ) / timeStep ** 2;
      near(numericalVelocity, pump.pistonVelocity, 2e-8,
        `pump ${index} velocity at ${angle}`);
      near(numericalAcceleration, pump.pistonAcceleration, 3e-7,
        `pump ${index} acceleration at ${angle}`);
    });
  }
  disposeModel(model.root);
});

test('movement 465 pistons always travel in opposite directions and alternate the operator’s downward side', () => {
  const { model } = movementModel();
  const { stateAtInputAngle } = model.root.userData;

  for (let sample = 0; sample < 160; sample += 1) {
    const angle = FULL_TURN * (sample + 0.5) / 160;
    const state = stateAtInputAngle(angle);
    const [left, right] = state.pumps;
    assert.ok(left.pistonVelocity * right.pistonVelocity < 0,
      `opposed piston directions at ${angle}`);
    if (state.beamAngularVelocity > 0) {
      assert.equal(state.activePressSide, 'left-end-pressed-down');
      assert.ok(state.leftPressAmount > 0);
      near(state.rightPressAmount, 0, 1e-12, 'right pressure inactive');
    } else {
      assert.equal(state.activePressSide, 'right-end-pressed-down');
      assert.ok(state.rightPressAmount > 0);
      near(state.leftPressAmount, 0, 1e-12, 'left pressure inactive');
    }
  }
  for (const reversal of [Math.PI / 2, 3 * Math.PI / 2]) {
    const state = stateAtInputAngle(reversal);
    assert.equal(state.activePressSide, 'neither-at-beam-reversal');
    near(state.leftPressAmount, 0, 1e-12, 'left pad unpressed');
    near(state.rightPressAmount, 0, 1e-12, 'right pad unpressed');
  }
  disposeModel(model.root);
});

test('movement 465 each ideal check valve follows its own piston and both checks seat smoothly at reversals', () => {
  const { model } = movementModel();
  const { stateAtInputAngle, transmission } = model.root.userData;

  for (let sample = 0; sample < 200; sample += 1) {
    const angle = FULL_TURN * (sample + 0.37) / 200;
    const state = stateAtInputAngle(angle);
    state.pumps.forEach((pump, index) => {
      assert.ok(!(pump.inletOpenAmount > 1e-12
        && pump.deliveryOpenAmount > 1e-12),
      `pump ${index} checks cannot open together at ${angle}`);
      if (pump.pistonVelocity > 0) {
        assert.ok(pump.inletOpenAmount > 0);
        near(pump.deliveryOpenAmount, 0, 1e-12,
          `pump ${index} delivery seated on suction`);
      } else {
        assert.ok(pump.deliveryOpenAmount > 0);
        near(pump.inletOpenAmount, 0, 1e-12,
          `pump ${index} inlet seated on delivery`);
      }
    });
  }
  const epsilon = 1e-4;
  for (const reversal of [Math.PI / 2, 3 * Math.PI / 2]) {
    const center = stateAtInputAngle(reversal);
    center.pumps.forEach((pump, index) => {
      near(pump.inletOpenAmount, 0, 1e-12,
        `pump ${index} inlet seated at reversal`);
      near(pump.deliveryOpenAmount, 0, 1e-12,
        `pump ${index} delivery seated at reversal`);
      for (const nearby of [
        stateAtInputAngle(reversal - epsilon).pumps[index],
        stateAtInputAngle(reversal + epsilon).pumps[index],
      ]) {
        assert.ok(nearby.inletOpenAmount + nearby.deliveryOpenAmount < 1e-9,
          `pump ${index} C2 valve seating near reversal`);
      }
    });
  }
  assert.match(transmission.valves, /piston rising: inlet open/);
  assert.match(transmission.valves, /reversal: both seated/);
  disposeModel(model.root);
});

test('movement 465 renderer maps beam, sliders, pistons, pitmans, valves, and water routes to analytic state', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const fixedAxle = blocks.beamAxle.position.clone();

  for (const phase of [0, 0.13, 0.25, 0.48, 0.73, 0.91]) {
    const time = phase * geometry.cycleDuration;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.beam.rotation.z, state.beamAngle, 1e-12,
      `rendered beam at phase ${phase}`);
    blocks.pumpAssemblies.forEach((assembly, index) => {
      const pump = state.pumps[index];
      vectorNear(assembly.crosshead.position, pump.crosshead, 1e-12,
        `crosshead ${index} at phase ${phase}`);
      vectorNear(assembly.piston.position, pump.piston, 1e-12,
        `piston ${index} at phase ${phase}`);
      near(assembly.pitman.scale.y, geometry.pitmanLength, 1e-12,
        `pitman ${index} render length at phase ${phase}`);
      near(assembly.pistonRod.scale.y, geometry.pistonRodOffset-.20, 1e-12,
        `piston rod ${index} render length at phase ${phase}`);
      near(assembly.inletValve.position.y,
        geometry.cylinderBottomY + 0.12
          + 0.075 * pump.inletOpenAmount,
        1e-12, `inlet check ${index} at phase ${phase}`);
      near(assembly.deliveryValve.position.y,
        -.65
          + 0.075 * pump.deliveryOpenAmount,
        1e-12, `delivery check ${index} at phase ${phase}`);
      assert.equal(assembly.inletWater.visible,
        pump.inletOpenAmount > 1e-4);
      assert.equal(assembly.deliveryWater.visible,
        pump.deliveryOpenAmount > 1e-4);
    });
    assert.equal(blocks.commonOutletWater.visible,
      state.totalDeliveryOpenAmount > 1e-4);
    vectorNear(blocks.beamAxle.position, fixedAxle, 0,
      'central beam axle remains fixed');
  }
  disposeModel(model.root);
});

test('movement 465 source pose preserves the engraved diagonal beam and both closed kinematic chains', () => {
  const { model } = movementModel();
  const { sourcePose, stateAtInputAngle } = model.root.userData;
  const source = stateAtInputAngle(-Math.PI / 4);

  near(sourcePose.beamAngle, source.beamAngle, 1e-12,
    'source diagonal beam angle');
  assert.ok(sourcePose.beamAngle < 0);
  assert.equal(sourcePose.activePressSide, source.activePressSide);
  sourcePose.crossheadPositions.forEach((position, index) =>
    vectorNear(position, source.pumps[index].crosshead, 1e-12,
      `source crosshead ${index}`));
  sourcePose.pistonPositions.forEach((position, index) =>
    vectorNear(position, source.pumps[index].piston, 1e-12,
      `source piston ${index}`));
  disposeModel(model.root);
});

test('movement 465 closes exactly after one rocking cycle', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);

  near(closure.phase, source.phase, 1e-12, 'cycle phase closure');
  near(closure.beamAngle, source.beamAngle, 1e-12,
    'beam closure');
  closure.pumps.forEach((pump, index) => {
    vectorNear(pump.crosshead, source.pumps[index].crosshead, 1e-12,
      `crosshead ${index} closure`);
    vectorNear(pump.piston, source.pumps[index].piston, 1e-12,
      `piston ${index} closure`);
    near(pump.inletOpenAmount, source.pumps[index].inletOpenAmount,
      1e-12, `inlet ${index} closure`);
    near(pump.deliveryOpenAmount, source.pumps[index].deliveryOpenAmount,
      1e-12, `delivery ${index} closure`);
  });
  model.update(geometry.cycleDuration);
  near(blocks.beam.rotation.z, 0, 1e-12, 'rendered beam closure');
  disposeModel(model.root);
});

test('movement 465 has finite render bounds and movement 507 remains the next authored frontier', () => {
  const movement465 = catalog.movements[464];
  const movement507 = catalog.movements[506];
  const model465 = createMovementModel(movement465);
  const model507 = createMovementModel(movement507);
  const fitBounds = model465.root.userData.cameraFitBounds;

  for (const phase of [0, 0.25, 0.75]) {
    model465.update(phase * model465.root.userData.geometry.cycleDuration);
    model465.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model465.root);
    for (const value of [bounds.min.x, bounds.min.y, bounds.min.z,
      bounds.max.x, bounds.max.y, bounds.max.z]) {
      assert.ok(Number.isFinite(value));
    }
    assert.ok(bounds.max.x > bounds.min.x);
    assert.ok(bounds.max.y > bounds.min.y);
    assert.ok(bounds.max.z > bounds.min.z);
    assert.ok(fitBounds.min.x <= bounds.min.x);
    assert.ok(fitBounds.min.y <= bounds.min.y);
    assert.ok(fitBounds.min.z <= bounds.min.z);
    assert.ok(fitBounds.max.x >= bounds.max.x);
    assert.ok(fitBounds.max.y >= bounds.max.y);
    assert.ok(fitBounds.max.z >= bounds.max.z);
  }
  assert.equal(movement465.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(movement507.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model465.root);
  disposeModel(model507.root);
});
