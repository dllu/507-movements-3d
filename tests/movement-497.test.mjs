import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const sourceText = await readFile(
  new URL(
    '../src/simulation/authored-fan-blowers.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'three-backward-curved-blade-centrifugal-fan-in-double-inlet-volute';

function movementModel() {
  const movement = catalog.movements[496];
  return { model: createMovementModel(movement), movement };
}

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

test('movement 497 is one three-vane impeller inside a fixed double-inlet volute', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 497);
  assert.equal(movement.number, '497');
  assert.match(movement.title, /^Fan-blower/);
  assert.equal(movement.category, 'Presses & clamps');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(geometry.bladeCount, 3);
  assert.equal(blocks.blades.length, 3);
  assert.ok(blocks.blades.every((blade) => blade.parent === blocks.impeller));
  assert.equal(blocks.hub.parent, blocks.impeller);
  assert.equal(blocks.shaft.parent, blocks.impeller);
  assert.equal(blocks.frontPlate.parent, model.root);
  assert.equal(blocks.rearPlate.parent, model.root);
  assert.equal(blocks.voluteWall.parent, model.root);
  assert.equal(blocks.frontPlate.userData.fixed, true);
  assert.equal(blocks.rearPlate.userData.fixed, true);
  assert.equal(blocks.voluteWall.userData.fixed, true);
  assert.equal(blocks.inletRims.length, 2);
  assert.ok(blocks.inletRims.every((rim) => rim.userData.fixed));
  // p100: the spout's mouth flange is part of the housing wall's extrusion.
  assert.equal(blocks.outletLips.length, 0);
  assert.equal(blocks.arms.length, 3);
  assert.ok(blocks.arms.every((arm, index) => arm.parent === blocks.impeller && arm.rotation.z === blocks.blades[index].rotation.z));
  assert.equal(degreesOfFreedom.independentShaftInputs, 1);
  assert.equal(degreesOfFreedom.independentBladeCoordinates, 0);
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 497 captures the exact official canvas topology, direction, and 15-cpm timing', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_497.html');
  assert.match(movement.description,
    /casing has circular openings in its sides.*revolution of the shaft and attached fan-blades.*air is drawn in at the center.*forced out under pressure through the spout/s);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.durationSeconds, 4);
  assert.deepEqual(sourceAnimation.sourceBounds, [-9, -9, 18, 18]);
  assert.match(sourceAnimation.rotatingDefinition,
    /three-blade group add_rot.*\[0,0\].*cyclePos/);
  assert.match(sourceAnimation.staticDefinition,
    /casing group.*side-opening circles.*volute.*right spout/);
  assert.equal(sourceAnimation.rotationDirection, 'counterclockwise');
  assert.match(sourceReference.reconstructionDisclosure,
    /impeller count.*counterclockwise direction.*fixed volute.*double side inlets.*15-cpm.*explicit in the official canvas/i);
  assert.match(sourceReference.historicalCorroboration.title,
    /The Fan.*Centrifugal and Axial Fans.*1916/);
  assert.match(sourceReference.historicalCorroboration.url,
    /archive\.org\/details\/fanincludingtheo00innerich/);
  assert.equal(sourceReference.modernTerminologyCheck.standard,
    'ANSI/AMCA Standard 99-16');
  assert.match(sourceReference.modernTerminologyCheck.detail,
    /air essentially axially.*discharging.*perpendicular.*one or two inlets.*scroll casing/i);
  disposeModel(model.root);
});

test('movement 497 holds the three curved blades rigidly 120 degrees apart', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime, transmission } =
    model.root.userData;
  assert.equal(transmission.rotorTurnsPerCycle, 1);
  assert.equal(transmission.shaftToImpellerRatio, 1);
  near(transmission.rotorAngularSpeed, Math.PI / 2, 0,
    'official 15-cpm angular speed');
  for (let index = 0; index < blocks.blades.length; index += 1) {
    near(blocks.blades[index].rotation.z,
      index * Math.PI * 2 / 3, 0,
      `installed blade spacing ${index}`);
  }
  for (let sample = 0; sample <= 800; sample += 1) {
    const time = geometry.cycleDuration * sample / 800;
    const state = stateAtTime(time);
    const expected = sample === 800
      ? 0
      : Math.PI * 2 * sample / 800;
    near(state.rotorAngle, expected, 2e-15,
      `official wrapped rotor position ${sample}`);
    assert.equal(state.rotationDirection,
      'counterclockwise-viewed-from-front-positive-z');
    model.update(time);
    near(blocks.impeller.rotation.z, state.rotorAngle, 0,
      `impeller renderer angle ${sample}`);
    near(blocks.impeller.userData.angularSpeed,
      transmission.rotorAngularSpeed, 0,
      `impeller published speed ${sample}`);
    near(blocks.shaft.userData.angularSpeed,
      transmission.rotorAngularSpeed, 0,
      `shaft published speed ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 497 airflow enters axially, turns radially, and exits the open spout', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;

  assert.equal(blocks.airflowCurves.length, 6);
  assert.equal(blocks.airflowParticles.length, 24);
  for (let index = 0; index < blocks.airflowCurves.length; index += 1) {
    const curve = blocks.airflowCurves[index];
    const start = curve.getPointAt(0);
    const centerTurn = curve.getPointAt(0.19);
    const radialFlow = curve.getPointAt(0.62);
    const end = curve.getPointAt(1);
    assert.ok(Math.abs(start.z) > geometry.casingDepth / 2,
      `curve ${index} starts outside a side inlet`);
    assert.ok(Math.abs(centerTurn.z) < Math.abs(start.z),
      `curve ${index} moves axially inward`);
    assert.ok(radialFlow.clone().setZ(0).length()
      > centerTurn.clone().setZ(0).length(),
    `curve ${index} turns radially outward`);
    assert.ok(end.x > geometry.outletBounds.right,
      `curve ${index} leaves beyond the spout`);
    assert.ok(end.y < geometry.outletBounds.top);
    assert.ok(end.y > geometry.outletBounds.bottom);

    const stepLengths = [];
    let previous = curve.getPointAt(0);
    for (let sample = 1; sample <= 240; sample += 1) {
      const point = curve.getPointAt(sample / 240);
      stepLengths.push(point.distanceTo(previous));
      previous = point;
    }
    const minimum = Math.min(...stepLengths);
    const maximum = Math.max(...stepLengths);
    assert.ok(maximum / minimum < 1.42,
      `curve ${index} is sampled by arc length without segment jumps`);
  }
  assert.match(model.root.userData.flow.direction,
    /axial-in.*both-circular-side-openings.*radial-outward.*tangential-out.*spout/);
  disposeModel(model.root);
});

test('movement 497 airflow particles follow those arc-length curves without visible reset jumps', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime, transmission } =
    model.root.userData;
  assert.equal(transmission.flowCyclesPerRotorCycle, 2);
  assert.equal(transmission.flowCyclesPerSecond, 0.5);
  for (let sample = 0; sample <= 640; sample += 1) {
    const time = geometry.cycleDuration * sample / 640;
    const state = stateAtTime(time);
    model.update(time);
    state.particleStates.forEach((particleState, index) => {
      const particle = blocks.airflowParticles[index];
      const curve = blocks.airflowCurves[particleState.curveIndex];
      vectorNear(particleState.position,
        curve.getPointAt(particleState.progress), 0,
        `particle source position ${sample}/${index}`);
      near(particleState.visibilityScale,
        Math.sin(Math.PI * particleState.progress), 0,
        `particle reset fade ${sample}/${index}`);
      assert.ok(particleState.visibilityScale >= 0);
      assert.ok(particleState.visibilityScale <= 1);
      vectorNear(particle.position, particleState.position, 0,
        `particle renderer position ${sample}/${index}`);
      near(particle.scale.x, particleState.visibilityScale, 0,
        `particle renderer fade ${sample}/${index}`);
    });
  }
  const initial = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  initial.particleStates.forEach((particle, index) => {
    near(closure.particleStates[index].progress, particle.progress, 1e-15,
      `particle phase cycle closure ${index}`);
    vectorNear(closure.particleStates[index].position, particle.position,
      2e-14, `particle position cycle closure ${index}`);
  });
  disposeModel(model.root);
});

test('movement 497 closes exactly, fits every pose, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);
  const closure = stateAtTime(4);
  near(closure.rotorAngle, initial.rotorAngle, 0,
    'wrapped impeller cycle closure');
  near(closure.cyclePosition, initial.cyclePosition, 0,
    'official cycle-position closure');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 720; sample += 1) {
    model.update(4 * sample / 720);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));
  assert.ok(swept.min.x < -geometry.impellerOuterRadius);
  // p100: the mouth flange ends the spout at outletBounds.right.
  assert.ok(swept.max.x >= geometry.outletBounds.right - 1e-6);

  const next = catalog.movements[506];
  const nextModel = createMovementModel(next);
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.match(next.title, /very slow motion/);
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, ARCHETYPE);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});

test('movement 497 housing is a circle concentric with the fan at a small uniform tip clearance', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  const wall = blocks.voluteWall.userData.mesh.geometry.attributes.position;
  let arcVertices = 0;
  for (let i = 0; i < wall.count; i += 1) {
    const x = wall.getX(i), y = wall.getY(i), r = Math.hypot(x, y);
    // Everywhere except the spout, the wall lies on the two circles.
    if (x > 0 && y < geometry.outletBounds.top + 0.4) continue;
    assert.ok(Math.abs(r - geometry.housingInnerRadius) < 2e-4 || Math.abs(r - geometry.housingOuterRadius) < 2e-4,
      `wall vertex off the circles at ${x}, ${y}`);
    arcVertices += 1;
  }
  assert.ok(arcVertices > 1000);
  let tip = 0;
  const blade = blocks.blades[0].geometry.attributes.position;
  for (let i = 0; i < blade.count; i += 1) tip = Math.max(tip, Math.hypot(blade.getX(i), blade.getY(i)));
  assert.ok(Math.abs(tip - geometry.impellerOuterRadius) < 1e-3);
  assert.ok(Math.abs(geometry.housingInnerRadius - tip - geometry.tipClearance) < 1e-3);
  assert.ok(geometry.tipClearance <= 0.06);
  disposeModel(model.root);
});
