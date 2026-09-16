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
  'ferguson-paradox-fixed-20-carried-compound-20-loose-21-20-19-output-stack';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[503];
  return { model: createMovementModel(movement), movement };
}

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

test('movement 504 is fixed A, one rigid thick B, carrier C-D, and loose E-F-G on pin N', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, transmission } = model.root.userData;

  assert.equal(movement.id, 504);
  assert.equal(movement.number, '504');
  assert.match(movement.title, /Ferguson’s mechanical paradox/);
  assert.equal(movement.category, 'Epicyclic trains');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.fixedA.userData.sourceLabel, 'A');
  assert.equal(blocks.fixedA.userData.fixed, true);
  assert.equal(blocks.carrierCD.userData.input, true);
  assert.equal(blocks.intermediateRows.length, 4);
  assert.ok(blocks.intermediateRows.every(
    (row) => row.userData.rigidAssembly === 'thick-wheel-B',
  ));
  assert.equal(blocks.intermediateSleeve.userData.rigidAssembly,
    'thick-wheel-B');
  assert.deepEqual(Object.keys(blocks.outputs), ['E', 'F', 'G']);
  assert.deepEqual(transmission.outputTeeth, { E: 21, F: 20, G: 19 });
  for (const label of ['E', 'F', 'G']) {
    assert.equal(blocks.outputs[label].userData.commonLoosePin, 'N');
    assert.equal(blocks.outputs[label].userData.sourceLabel, label);
    assert.equal(blocks.outputs[label].parent, blocks.carrierCD);
    assert.equal(blocks.outputIndices[label].parent,
      blocks.outputs[label].userData.rotor);
  }
  assert.deepEqual(Object.keys(blocks.labels).sort(),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'M', 'N']);
  assert.equal(degreesOfFreedom.independentCarrierInputs, 1);
  assert.equal(degreesOfFreedom.dependentIntermediateCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentOutputCoordinates, 3);
  const gears = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isGear) gears.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.equal(gears.length, 8);
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 504 records Brown, the unavailable animation, and the equal-diameter historical caveat', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_504.html');
  assert.match(movement.description,
    /wheel, A, is fixed.*arm, C, D.*thick wheel, B.*three loose wheels, E, F, G.*A to have twenty teeth.*F twenty.*E twenty-one.*G nineteen/is);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_504\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /A=20.*F=20.*E=21.*G=19.*one rigid thick intermediate B/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /continuous 20-tooth profile.*common base pitch.*Adjusted output tooth thicknesses.*center distances identical.*pitch contact slip-free/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /Output E is above F.*above G.*A aligned to F/is);
  assert.match(
    sourceReference.historicalConstructionCorroboration.report,
    /Practical Mechanics.*A Mechanical Paradox.*1947/,
  );
  assert.match(
    sourceReference.historicalConstructionCorroboration.detail,
    /equal-diameter output blanks.*theoretically imperfect/is,
  );
  assert.match(sourceReference.engineeringCorroboration.report,
    /NASA SP-8100.*Dynamics of Planetary Gear Trains.*1984/);
  disposeModel(model.root);
});

test('movement 504 makes every displayed branch an exact same-center working-pitch mesh', () => {
  const { model } = movementModel();
  const { geometry, meshes, stateAtTime, transmission } = model.root.userData;

  assert.equal(transmission.exactSteppedWorkingBands, false);
  assert.equal(transmission.constantIntermediateProfile, true);
  assert.equal(meshes.length, 4);
  assert.deepEqual(meshes.map(({ first, second }) => `${first}-${second}`),
    ['A-B-input-row', 'B-E-row-E', 'B-F-row-F', 'B-G-row-G']);
  for (const mesh of meshes) {
    near(mesh.centerDistance,
      mesh.firstPitchRadius + mesh.secondPitchRadius,
      4e-16, `${mesh.first}-${mesh.second} center distance`);
    near(mesh.firstPitchRadius,
      mesh.teeth[0] * mesh.module / 2,
      2e-16, `${mesh.first} module relation`);
    near(mesh.secondPitchRadius,
      mesh.teeth[1] * mesh.module / 2,
      2e-16, `${mesh.second} module relation`);
    near(mesh.centerDistance, geometry.carrierPinSpacing, 0,
      `${mesh.first}-${mesh.second} common center spacing`);
  }
  assert.notEqual(geometry.outputWorkingGeometry.E.module,
    geometry.outputWorkingGeometry.F.module);
  assert.notEqual(geometry.outputWorkingGeometry.F.module,
    geometry.outputWorkingGeometry.G.module);
  for (let sample = 0; sample <= 1440; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * sample / 1440,
    );
    near(state.intermediateCenter.length(), geometry.carrierPinSpacing,
      4e-16, `pin M radius ${sample}`);
    near(state.outputCenter.length(), 2 * geometry.carrierPinSpacing,
      8e-16, `pin N radius ${sample}`);
    for (const residual of Object.values(state.contactPositionResiduals)) {
      near(residual, 0, 5e-16, `contact position ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 504 produces the exact stationary, forward, and reverse paradox rates', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const expectedRatios = {
    E: 1 / 21,
    F: 0,
    G: -1 / 19,
  };

  near(transmission.intermediateAbsoluteRatio, 2, 0,
    'B absolute/carrier ratio');
  for (const label of ['E', 'F', 'G']) {
    near(transmission.outputAbsoluteRatios[label], expectedRatios[label],
      8e-17, `${label} published paradox ratio`);
  }
  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 3000,
    );
    near(state.intermediateAbsoluteAngularSpeed,
      2 * state.carrierAngularSpeed, 0,
      `thick B speed ${sample}`);
    for (const label of ['E', 'F', 'G']) {
      near(state.outputs[label].absoluteAngularSpeed,
        expectedRatios[label] * state.carrierAngularSpeed,
        8e-17, `${label} angular speed ${sample}`);
      near(state.outputs[label].absoluteRatio,
        expectedRatios[label], 8e-17,
        `${label} angular ratio ${sample}`);
    }
    near(state.outputs.F.absoluteAngle, 0, 0,
      `F remains world-stationary ${sample}`);
    for (const residual of Object.values(state.meshPhaseResiduals)) {
      near(residual, 0, 2e-11, `tooth phase ${sample}`);
    }
  }
  assert.ok(stateAtTime(1).outputs.E.absoluteAngularSpeed > 0);
  assert.equal(stateAtTime(1).outputs.F.absoluteAngularSpeed, 0);
  assert.ok(stateAtTime(1).outputs.G.absoluteAngularSpeed < 0);
  disposeModel(model.root);
});

test('movement 504 has zero pitch slip at A-B and all three B-output contacts', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 3000,
    );
    for (const [branch, residual] of Object.entries(
      state.pitchVelocityResiduals,
    )) {
      near(residual, 0, 7e-16,
        `${branch} pitch velocity ${sample}`);
    }
  }
  disposeModel(model.root);
});

test('movement 504 renderer binds all rigid B rows and keeps F world-parallel', () => {
  const { model } = movementModel();
  const { blocks, stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 720; sample += 1) {
    const time = transmission.nominalCarrierPeriod * 4 * sample / 720;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.carrierCD.rotation.y, state.carrierAngle, 0,
      `carrier angle ${sample}`);
    const expectedIntermediateLocal = state.intermediateAbsoluteAngle
      - state.carrierAngle;
    for (const row of blocks.intermediateRows) {
      near(row.userData.rotor.rotation.z,
        expectedIntermediateLocal, 0,
        `rigid B row ${sample}`);
    }
    for (const label of ['E', 'F', 'G']) {
      near(blocks.outputs[label].userData.rotor.rotation.z,
        state.outputs[label].localAngle, 0,
        `${label} local render angle ${sample}`);
    }
    near(blocks.outputs.F.userData.rotor.rotation.z,
      -state.carrierAngle, 0,
      `F counterrotation exactly cancels carrier ${sample}`);
    assert.equal(blocks.intermediateSleeve.parent, blocks.carrierCD);
    assert.equal(blocks.outputPin.parent, blocks.carrierCD);
  }
  disposeModel(model.root);
});

test('movement 504 runs continuously, fits the full carrier orbit, and leaves annular train 505 next', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const period = transmission.nominalCarrierPeriod;
  const initial = stateAtTime(0);
  const oneTurn = stateAtTime(period);
  const before = stateAtTime(period - 1e-8);
  const after = stateAtTime(period + 1e-8);

  assert.equal(transmission.continuousUnwrappedRotation, true);
  near(oneTurn.carrierAngle - initial.carrierAngle, FULL_TURN, 0,
    'one carrier turn');
  near(oneTurn.intermediateAbsoluteAngle
    - initial.intermediateAbsoluteAngle, 2 * FULL_TURN, 0,
  'two thick-B turns');
  near(oneTurn.outputs.E.absoluteAngle - initial.outputs.E.absoluteAngle,
    FULL_TURN / 21, 2e-15, 'E slow forward turn');
  near(oneTurn.outputs.F.absoluteAngle - initial.outputs.F.absoluteAngle,
    0, 0, 'F stationary through carrier turn');
  near(oneTurn.outputs.G.absoluteAngle - initial.outputs.G.absoluteAngle,
    -FULL_TURN / 19, 2e-15, 'G slow reverse turn');
  near(after.carrierAngle - before.carrierAngle,
    2e-8 * transmission.carrierAngularSpeed, 2e-15,
    'no carrier reset');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 1080; sample += 1) {
    model.update(period * sample / 1080);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
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
