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
    '../src/simulation/authored-epicyclic-trains.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'dual-bevel-input-compounds-drive-compound-bevel-differential-carrier-output';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[505];
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

test('movement 506 has Brown’s original four rigid assemblies and one carrier output', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, transmission } = model.root.userData;

  assert.equal(movement.id, 506);
  assert.equal(movement.number, '506');
  assert.match(movement.title, /neither the first nor last wheel is fixed/);
  assert.equal(movement.category, 'Epicyclic trains');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(transmission.selectedConfiguration,
    'original-rigid-b-c-rigid-f-g');
  assert.equal(blocks.driverAH.userData.input, true);
  assert.equal(blocks.driverAH.userData.rigidAssembly, 'A-a-h');
  assert.equal(blocks.gearA.parent, blocks.driverAH);
  assert.equal(blocks.gearH.parent, blocks.driverAH);
  assert.equal(blocks.gearB.parent, blocks.lowerBC);
  assert.equal(blocks.gearC.parent, blocks.lowerBC);
  assert.equal(blocks.lowerBC.userData.rigidAssembly, 'b-c');
  assert.equal(blocks.lowerBC.userData.looseOnShaft, 'm-n');
  assert.equal(blocks.gearF.parent, blocks.upperFG);
  assert.equal(blocks.gearG.parent, blocks.upperFG);
  assert.equal(blocks.upperFG.userData.rigidAssembly, 'f-g');
  assert.equal(blocks.upperFG.userData.looseOnShaft, 'm-n');
  assert.equal(blocks.planetCompoundDE.parent, blocks.carrierKL);
  assert.equal(blocks.gearD.parent, blocks.planetCompoundDE);
  assert.equal(blocks.gearE.parent, blocks.planetCompoundDE);
  assert.equal(blocks.planetCompoundDE.userData.rigidAssembly, 'd-e');
  assert.equal(blocks.planetCompoundDE.userData.freeOnCarrierArm, 'k-l');
  assert.equal(blocks.carrierKL.userData.aggregateOutput, true);
  assert.equal(blocks.carrierKL.userData.rigidAssembly, 'k-l-m-n');
  assert.notEqual(blocks.gearG.parent, blocks.carrierKL);
  assert.deepEqual(Object.keys(blocks.labels).sort(),
    ['A', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k', 'l', 'm', 'n']);
  assert.equal(degreesOfFreedom.independentDriverInputs, 1);
  assert.equal(degreesOfFreedom.dependentLowerCompoundCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentUpperCompoundCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentPlanetCompoundCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentCarrierCoordinates, 1);

  const gears = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isGear) gears.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.equal(gears.length, 8);
  assert.deepEqual(
    gears.map(({ userData }) => userData.sourceLabel).sort(),
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
  );
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 506 records the unavailable animation and isolates the original mode', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_506.html');
  assert.match(movement.description,
    /shaft to which is firmly secured the train-bearing arm, k, l.*wheels, d, e, secured together.*wheels, b and c, are united.*wheels, f and g, are also secured together/is);
  assert.match(movement.description,
    /shaft, A.*two wheels, a and h.*first of which gears with the wheel, b.*wheel, h, drives the wheel, g.*aggregate motion of the arm, k, l/is);
  assert.match(movement.description,
    /may be modified.*g and f to be disunited.*g to be fixed to the shaft/is);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_506\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /supplies no tooth counts, pitch geometry, speed, or timing/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /original configuration only.*a=20, b=40, c=24, d=16, e=12, f=20, g=32, h=24/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /modified configuration.*documented but not superimposed/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /four common-apex pitch constraints.*zero-slip contacts are exact/is);
  assert.match(sourceReference.engineeringCorroboration.report,
    /NASA SP-8100.*Dynamics of Planetary Gear Trains.*1984/);
  disposeModel(model.root);
});

test('movement 506 gives every bevel wheel an exact count, pitch radius, and common mesh apex', () => {
  const { model } = movementModel();
  const { geometry, meshes, stateAtTime, transmission } = model.root.userData;
  const expectedTeeth = {
    a: 20,
    b: 40,
    c: 24,
    d: 16,
    e: 12,
    f: 20,
    g: 32,
    h: 24,
  };

  assert.deepEqual(transmission.teeth, expectedTeeth);
  for (const [label, count] of Object.entries(expectedTeeth)) {
    near(geometry.pitchRadii[label], count * geometry.module / 2, 0,
      `${label} pitch radius`);
  }
  assert.deepEqual(meshes.map(({ first, second }) => `${first}-${second}`),
    ['a-b', 'h-g', 'c-d', 'e-f']);
  for (const mesh of meshes) {
    near(mesh.axesAngle, Math.PI / 2, 0,
      `${mesh.first}-${mesh.second} orthogonal axes`);
    vectorNear(mesh.pitchConeApex, new THREE.Vector3(), 0,
      `${mesh.first}-${mesh.second} local apex`);
  }
  for (let sample = 0; sample <= 1440; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * sample / 1440,
    );
    for (const [label, residual] of Object.entries(
      state.pitchConeApexResiduals,
    )) {
      near(residual, 0, 4e-16, `${label} pitch apex ${sample}`);
    }
    near(state.gearCenters.d.clone().sub(geometry.differentialApex)
      .length(), geometry.pitchRadii.c, 4e-16,
    `d carried center ${sample}`);
    near(state.gearCenters.e.clone().sub(geometry.differentialApex)
      .length(), geometry.pitchRadii.f, 4e-16,
    `e carried center ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 506 derives both end speeds and the weighted carrier aggregate from one driver', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  near(transmission.lowerBCSignedRatio, -1 / 2, 0,
    'a-b drives b-c in reverse');
  near(transmission.upperFGSignedRatio, 3 / 4, 0,
    'h-g drives f-g forward');
  near(transmission.carrierToDriverRatio, 3 / 19, 8e-17,
    'weighted aggregate carrier ratio');
  near(transmission.planetCompoundToDriverRatio, -75 / 76, 2e-16,
    'd-e spin ratio');
  assert.equal(transmission.lowerAggregateWeight, 24 * 12);
  assert.equal(transmission.upperAggregateWeight, 20 * 16);
  assert.equal(transmission.aggregateWeight, 608);
  assert.ok(transmission.lowerBCAngularSpeed < 0);
  assert.ok(transmission.upperFGAngularSpeed > 0);
  assert.ok(transmission.carrierAngularSpeed > 0);
  assert.ok(transmission.planetCompoundAngularSpeed < 0);

  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 3000,
    );
    near(state.lowerBCAngularSpeed,
      -state.driverAngularSpeed / 2, 0, `lower b-c rate ${sample}`);
    near(state.upperFGAngularSpeed,
      3 * state.driverAngularSpeed / 4, 0,
      `upper f-g rate ${sample}`);
    near(state.carrierAngularSpeed,
      3 * state.driverAngularSpeed / 19, 8e-17,
      `carrier rate ${sample}`);
    near(state.planetCompoundAngularSpeed,
      -75 * state.driverAngularSpeed / 76, 3e-16,
      `planet compound rate ${sample}`);
    near(state.aggregateEquationResidual, 0, 4e-14,
      `weighted aggregate ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 506 satisfies all four signed mesh-rate and tooth-phase equations', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  assert.match(transmission.aggregateCarrierLaw,
    /Nc \* Ne.*omegaBC - omegaCarrier.*Nf \* Nd.*omegaFG - omegaCarrier/);
  for (let sample = 0; sample <= 3600; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 24 * sample / 3600,
    );
    for (const [pair, residual] of Object.entries(
      state.meshRateResiduals,
    )) {
      near(residual, 0, 2e-15, `${pair} mesh rate ${sample}`);
    }
    for (const [pair, residual] of Object.entries(
      state.meshPhaseResiduals,
    )) {
      near(residual, 0, 1e-11, `${pair} tooth phase ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 506 matches 3D pitch-point velocity at all four bevel contacts', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 3000,
    );
    for (const [pair, residual] of Object.entries(
      state.pitchVelocityResiduals,
    )) {
      near(residual, 0, 5e-16, `${pair} pitch velocity ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 506 renderer keeps each compound rigid and places d-e on the rotating carrier', () => {
  const { model } = movementModel();
  const { blocks, stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 900; sample += 1) {
    const time = transmission.nominalCarrierPeriod * 4 * sample / 900;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.driverAH.rotation.x, state.driverAngle, 0,
      `rigid A-a-h angle ${sample}`);
    near(blocks.lowerBC.rotation.y, state.lowerBCAngle, 0,
      `rigid b-c angle ${sample}`);
    near(blocks.upperFG.rotation.y, state.upperFGAngle, 0,
      `rigid f-g angle ${sample}`);
    near(blocks.carrierKL.rotation.y, state.carrierAngle, 0,
      `rigid k-l-m-n angle ${sample}`);
    near(blocks.planetCompoundDE.rotation.x,
      state.planetCompoundAngle, 0, `rigid d-e angle ${sample}`);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.gearD.getWorldPosition(new THREE.Vector3()),
      state.gearCenters.d, 8e-16, `d world center ${sample}`);
    vectorNear(blocks.gearE.getWorldPosition(new THREE.Vector3()),
      state.gearCenters.e, 8e-16, `e world center ${sample}`);
    vectorNear(blocks.gearC.getWorldPosition(new THREE.Vector3()),
      state.gearCenters.c, 3e-16, `c world center ${sample}`);
    vectorNear(blocks.gearF.getWorldPosition(new THREE.Vector3()),
      state.gearCenters.f, 3e-16, `f world center ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 506 is continuous, fits every carrier pose, and leaves 507 next', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const period = transmission.nominalCarrierPeriod;
  const initial = stateAtTime(0);
  const oneTurn = stateAtTime(period);
  const before = stateAtTime(period - 1e-8);
  const after = stateAtTime(period + 1e-8);

  assert.equal(transmission.continuousUnwrappedRotation, true);
  near(oneTurn.carrierAngle - initial.carrierAngle, FULL_TURN, 0,
    'one aggregate carrier turn');
  near(oneTurn.driverAngle - initial.driverAngle,
    19 * FULL_TURN / 3, 2e-14, 'driver remains unwrapped after subtracting the source mounting phase');
  near(oneTurn.planetCompoundAngle - initial.planetCompoundAngle,
    -25 * FULL_TURN / 4, 2e-14, 'd-e remains unwrapped');
  near(after.carrierAngle - before.carrierAngle,
    2e-8 * transmission.carrierAngularSpeed, 2e-15,
    'no carrier reset');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 1080; sample += 1) {
    model.update(period * sample / 1080);
    model.root.updateMatrixWorld(true);
    // Rotating local AABBs overestimate the circular gear envelope. Compare
    // the fitted bounds with actual vertices, as the viewport review does.
    swept.union(new THREE.Box3().setFromObject(model.root, true));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));

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
