import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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
    } else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 224 is one slotted wheel controlling six radial pulley arms', () => {
  const movement = catalog.movements[223];
  const model = createMovementModel(movement);
  const { archetype, blocks, fidelity, mechanism, sourceAnimation } =
    model.root.userData;

  assert.equal(movement.id, 224);
  assert.equal(movement.number, '224');
  assert.equal(movement.title, 'Six-Arm Spiral-Slot Expanding Pulley');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'six-arm-spiral-slot-expanding-pulley');
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'pinion-d-rotates-slotted-wheel-c-to-slide-six-pulley-arms-radially',
  );
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /unavailable/);
  assert.equal(blocks.guides.length, 6);
  assert.equal(blocks.sliders.length, 6);
  assert.equal(blocks.studs.length, 6);
  assert.equal(blocks.rimSegments.length, 6);
  assert.equal(blocks.slotPlate.userData.cutThroughSlotCount, 6);
  assert.ok(blocks.wheelGear.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  assert.ok(blocks.pinion.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  blocks.guides.forEach((guide) => assert.equal(guide.parent, model.root));
  blocks.sliders.forEach((slider) => assert.equal(slider.parent, model.root));
  disposeModel(model.root);
});

test('movement 224 preserves the plate counts, proportions, and gear pitch', () => {
  const model = createMovementModel(catalog.movements[223]);
  const { geometry, sourceReference, transmission } = model.root.userData;
  assert.equal(geometry.armCount, 6);
  assert.equal(geometry.wheelTeeth, 32);
  assert.equal(geometry.pinionTeeth, 10);
  near(
    geometry.wheelPitchRadius + geometry.pinionPitchRadius,
    geometry.gearCenterDistance,
    0,
    'common-pitch center distance',
  );
  near(
    2 * geometry.wheelPitchRadius / geometry.wheelTeeth,
    geometry.module,
    0,
    'wheel module',
  );
  near(
    2 * geometry.pinionPitchRadius / geometry.pinionTeeth,
    geometry.module,
    2e-17,
    'pinion module',
  );
  assert.equal(transmission.pinionToWheelRatio, -3.2);
  assert.deepEqual(
    sourceReference.plate224.rasterMainCenter.toArray(),
    [263, 263],
  );
  assert.deepEqual(
    sourceReference.plate224.rasterPinionCenter.toArray(),
    [263, 118],
  );
  assert.equal(sourceReference.plate224.inferredArmCount, 6);
  assert.equal(sourceReference.plate224.inferredWheelTeeth, 32);
  assert.equal(sourceReference.plate224.inferredPinionTeeth, 10);
  disposeModel(model.root);
});

test('movement 224 keeps every stud in its slot and radial guide for 32,769 states', () => {
  const model = createMovementModel(catalog.movements[223]);
  const { stateAtPhase } = model.root.userData;
  let maximumAngularResidual = 0;
  let maximumRadialResidual = 0;
  let maximumGuideResidual = 0;
  let maximumGearNoSlipError = 0;
  let maximumMeshPhaseError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtPhase(index / 32768 * FULL_TURN, 1);
    maximumGearNoSlipError = Math.max(
      maximumGearNoSlipError,
      state.gearNoSlipError,
    );
    maximumMeshPhaseError = Math.max(
      maximumMeshPhaseError,
      state.meshPhaseError,
    );
    near(
      state.wheelSurfaceSpeed,
      state.pinionSurfaceSpeed,
      4e-16,
      `gear surface speed ${index}`,
    );
    state.slotStates.forEach((slot) => {
      maximumAngularResidual = Math.max(
        maximumAngularResidual,
        Math.abs(slot.angularResidual),
      );
      maximumRadialResidual = Math.max(
        maximumRadialResidual,
        Math.abs(slot.radialResidual),
      );
      maximumGuideResidual = Math.max(
        maximumGuideResidual,
        slot.guideResidual,
      );
    });
  }
  assert.ok(maximumAngularResidual < 1e-15);
  assert.ok(maximumRadialResidual < 1e-15);
  assert.ok(maximumGuideResidual < 1.2e-16);
  assert.ok(maximumGearNoSlipError < 4e-16);
  assert.ok(maximumMeshPhaseError < 1.8e-15);
  disposeModel(model.root);
});

test('movement 224 has real cut-through slots and collision-free endpoint margins', () => {
  const model = createMovementModel(catalog.movements[223]);
  const { blocks, geometry } = model.root.userData;
  assert.equal(blocks.slotPlate.geometry.parameters.shapes.holes.length, 7);
  assert.equal(geometry.slotPaths.length, 6);
  assert.ok(geometry.slotHalfWidth > geometry.studRadius);
  assert.ok(geometry.slotEndArcClearance > 0.018);
  assert.ok(
    geometry.adjustmentAmplitude < geometry.slotSweep / 2,
    'stud centers stop before both slot ends',
  );
  const plateCenterZ = blocks.wheelGear.position.z
    + blocks.slotPlate.position.z;
  const plateHalfDepth = blocks.slotPlate.userData.raisedDepth / 2;
  assert.ok(Math.abs(blocks.slotPlate.userData.raisedDepth - 0.04) < 1e-9);
  // The raised face sits on the gear's front face; it no longer shares the
  // gear's slot walls through its depth (p88 coincident-face fix).
  assert.ok(Math.abs(plateCenterZ - plateHalfDepth - (blocks.wheelGear.position.z + 0.11)) < 1e-9);
  const studBottomZ = geometry.studCenterZ - geometry.studLength / 2;
  const studTopZ = geometry.studCenterZ + geometry.studLength / 2;
  assert.ok(studBottomZ < plateCenterZ + plateHalfDepth);
  assert.ok(studTopZ > plateCenterZ - plateHalfDepth);
  blocks.wheelGear.traverse((object) => {
    if (object.userData.toothProfile) {
      assert.equal(object.userData.toothProfile, 'true-involute');
    }
  });
  assert.equal(blocks.wheelGear.userData.toothProfile, 'true-involute');
  assert.equal(blocks.pinion.userData.toothProfile, 'true-involute');
  disposeModel(model.root);
});

test('movement 224 expands symmetrically with exact analytic rates', () => {
  const model = createMovementModel(catalog.movements[223]);
  const { canonicalTimes, stateAtPhase, stateAtTime, transmission } =
    model.root.userData;
  const contracted = stateAtTime(canonicalTimes.contracted);
  const expanded = stateAtTime(canonicalTimes.expanded);
  assert.ok(expanded.pulleyRadius > contracted.pulleyRadius);
  near(
    expanded.pulleyRadius - contracted.pulleyRadius,
    transmission.radialTravel,
    Number.EPSILON * 2,
    'full radial adjustment',
  );
  near(contracted.radialSpeed, 0, 5e-17, 'contracted endpoint dwell');
  near(expanded.radialSpeed, 0, 1.5e-16, 'expanded endpoint dwell');
  for (const phase of [0.2, 1.1, 2.3, 4.2, 5.7]) {
    const h = 1e-6;
    const state = stateAtPhase(phase, 1);
    const finiteRadialRate = (
      stateAtPhase(phase + h).studRadius
      - stateAtPhase(phase - h).studRadius
    ) / (2 * h);
    near(finiteRadialRate, state.radialSpeed, 1e-9,
      `phase ${phase} stud rate`);
    near(
      state.pinionAngularSpeed,
      -3.2 * state.wheelAngularSpeed,
      2e-16,
      `phase ${phase} gear rate`,
    );
    const radii = state.slotStates.map((slot) => slot.stud.length());
    assert.ok(Math.max(...radii) - Math.min(...radii) < 5e-16);
  }
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  const source = stateAtTime(0);
  near(closure.wheelAngle, source.wheelAngle, 1e-16, 'wheel closure');
  near(closure.studRadius, source.studRadius, 2e-16, 'pulley closure');
  disposeModel(model.root);
});

test('movement 224 runtime binds all six slides while 262 stays authored', () => {
  const model = createMovementModel(catalog.movements[223]);
  const { blocks, canonicalTimes, stateAtTime } = model.root.userData;
  for (const time of [
    0,
    canonicalTimes.contracted,
    canonicalTimes.expanded,
    canonicalTimes.cycleClosure,
  ]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.wheelGear.userData.rotor.rotation.z, state.wheelAngle, 1e-12,
      `time ${time} wheel transform`);
    near(blocks.pinion.userData.rotor.rotation.z, state.pinionAngle, 1e-12,
      `time ${time} pinion transform`);
    blocks.studs.forEach((stud, index) => {
      const world = stud.getWorldPosition(new THREE.Vector3());
      near(world.x, state.slotStates[index].stud.x, 2e-12,
        `time ${time} stud ${index} x`);
      near(world.y, state.slotStates[index].stud.y, 2e-12,
        `time ${time} stud ${index} y`);
    });
  }
  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(meshCount >= 35);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement507 = createMovementModel(catalog.movements[506]);
  assert.equal(catalog.movements[506].id, 507);
  assert.equal(catalog.movements[506].fidelity, 'authored');
  assert.equal(movement507.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement507.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement507.root);
  disposeModel(model.root);
});

test('movement 224 click e holds pinion d: one flat plate that seats, ratchets and lifts', async () => {
  const { polygonClipping } = await import('../src/simulation/finite-plate-geometry.js');
  const bakedTable = (await import('../src/simulation/generated-expanding-pulley-click.js')).default;
  const model = createMovementModel(catalog.movements[223]);
  const { blocks, canonicalTimes, geometry: g, stateAtPhase, stateAtTime, transmission } = model.root.userData;
  // One extrusion in d's plane, bored for its pin; no other click parts.
  let meshes = 0;
  blocks.click.traverse((object) => { if (object.isMesh) meshes += 1; });
  assert.equal(meshes, 1);
  assert.equal(blocks.clickPlate.geometry.type, 'ExtrudeGeometry');
  assert.equal(blocks.clickPlate.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.click.position.z, blocks.pinion.position.z);
  assert.equal(transmission.holdingClick, 'e-on-pinion-d');
  // The baked resting table is the offline solve of the current geometry.
  const fresh = model.root.userData.computeClickRestTable();
  assert.equal(bakedTable.length, fresh.length);
  fresh.forEach((value, index) => near(bakedTable[index], value, 1e-6, `rest ${index}`));

  const area = (polygons) => Math.abs(polygons.flat().reduce((sum, ring) => {
    for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return sum;
  }, 0) / 2);
  const stages = new Set();
  let ratchetLow = 0;
  for (let index = 0; index <= 1200; index += 1) {
    const state = stateAtPhase(index / 1200 * FULL_TURN, 1);
    stages.add(state.stage);
    const pinion = g.pinionOutline.map(([x, y]) => [
      x * Math.cos(state.pinionAngle) - y * Math.sin(state.pinionAngle),
      x * Math.sin(state.pinionAngle) + y * Math.cos(state.pinionAngle) + g.gearCenterDistance,
    ]);
    const c = Math.cos(state.clickAngle), s = Math.sin(state.clickAngle);
    const click = g.clickOutline.map((p) => [g.clickPivot.x + c * p.x - s * p.y, g.clickPivot.y + s * p.x + c * p.y]);
    assert.ok(area(polygonClipping.intersection([[...pinion, pinion[0]]], [[...click, click[0]]])) < 2e-7,
      `click cuts d at ${index}`);
    if (state.stage === 'expanding-click-ratchets') ratchetLow = Math.min(ratchetLow, state.clickAngle);
    if (state.stage === 'contracting-click-held-clear') assert.ok(state.clickAngle < Math.min(...g.clickRestTable) - 0.05);
  }
  for (const stage of ['contracted-hold', 'expanding-click-ratchets', 'belt-tension-slips-back-onto-click',
    'expanded-hold', 'click-lifted', 'contracting-click-held-clear', 'click-lowered']) assert.ok(stages.has(stage), stage);
  // The click rides up over each tooth while d is wound forward.
  assert.ok(ratchetLow < -0.15);
  // At both holds the click is seated in a tooth space and d's tooth bears on
  // its working face: any further belt-driven (clockwise) turn of d cuts it.
  for (const time of [canonicalTimes.contracted, canonicalTimes.expanded]) {
    const state = stateAtTime(time);
    assert.equal(state.clickSeated, true);
    assert.ok(Math.abs(state.clickAngle - g.clickSeatAngle) < 1e-12);
    assert.ok(state.clickAngle > Math.max(...g.clickRestTable) - 0.012, 'click drops into the root');
    assert.equal(model.root.userData.clickOverlaps(state.pinionAngle, state.clickAngle + 0.0004), false);
    assert.equal(model.root.userData.clickOverlaps(state.pinionAngle - 0.006, state.clickAngle), true);
  }
  // The holds are exactly three teeth apart, reached by overshooting and
  // slipping back by the click's two-sided clearance.
  near(stateAtTime(canonicalTimes.expanded).pinionAngle - stateAtTime(canonicalTimes.contracted).pinionAngle,
    3 * FULL_TURN / 10, 1e-12, 'three-tooth stroke');
  let peak = -Infinity;
  for (let index = 0; index <= 400; index += 1) peak = Math.max(peak, stateAtPhase(index / 400 * FULL_TURN, 1).pinionAngle);
  near(peak - stateAtTime(canonicalTimes.expanded).pinionAngle, 2 * g.clickAngularClearance, 1e-6, 'slip-back');
  disposeModel(model.root);
});
