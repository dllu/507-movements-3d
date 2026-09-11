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
  'fixed-annulus-36-driven-carrier-single-planet-11-output-sun-14';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[504];
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

test('movement 505 is one C-fixed, D-input, A-output planetary train', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, meshes, transmission } =
    model.root.userData;

  assert.equal(movement.id, 505);
  assert.equal(movement.number, '505');
  assert.match(movement.title, /Another simple form of the epicyclic train/);
  assert.equal(movement.category, 'Epicyclic trains');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(transmission.selectedConfiguration,
    'C-fixed-D-input-A-output');
  assert.equal(transmission.fixedMember, 'C');
  assert.equal(blocks.fixedRingC.userData.fixed, true);
  assert.equal(blocks.fixedRingC.userData.sourceLabel, 'C');
  assert.equal(blocks.carrierD.userData.input, true);
  assert.equal(blocks.planetB.userData.freeOnCarrierPin, true);
  assert.equal(blocks.planetB.userData.carriedBy, 'D');
  assert.equal(blocks.planetB.parent, blocks.carrierD);
  assert.equal(blocks.sunA.userData.output, true);
  assert.equal(blocks.sunOutputShaft.parent, blocks.sunA.userData.rotor);
  assert.equal(blocks.sunOutputIndex.parent, blocks.sunA.userData.rotor);
  assert.deepEqual(Object.keys(blocks.labels).sort(), ['A', 'B', 'C', 'D']);
  assert.deepEqual(meshes.map(({ first, second }) => `${first}-${second}`),
    ['A-B', 'B-C']);
  assert.deepEqual(blocks.contactMarkers.map(
    ({ userData }) => userData.pair,
  ), ['A-B-external', 'B-C-internal']);
  assert.equal(degreesOfFreedom.independentCarrierInputs, 1);
  assert.equal(degreesOfFreedom.dependentPlanetCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentSunCoordinates, 1);
  assert.equal(degreesOfFreedom.stationaryAnnulusCoordinates, 0);

  const gears = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isGear) gears.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.equal(gears.length, 3);
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 505 records the source animation and chooses only Brown’s C-fixed mode', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_505.html');
  assert.match(movement.description,
    /arm, D, carries a pinion, B.*spur-wheel, A.*annular wheel, C.*Either of the wheels, A, C, may be stationary/is);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.usedAsMotionValidationOnly, true);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_505\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /A=14, B=11, C=36 teeth/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /one mechanically closed configuration only: C fixed, D driven, A output/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /alternative A-fixed configuration.*not instantiated simultaneously/is);
  assert.deepEqual(
    sourceReference.engineeringCorroboration.reports,
    [
      'KHK Technical Information, Internal Gears',
      'NASA SP-8100, Dynamics of Planetary Gear Trains (1984)',
    ],
  );
  disposeModel(model.root);
});

test('movement 505 closes its exact 14-11-36 tooth geometry at both contacts', () => {
  const { model } = movementModel();
  const { geometry, meshes, stateAtTime, transmission } = model.root.userData;

  assert.equal(transmission.sunTeeth, 14);
  assert.equal(transmission.planetTeeth, 11);
  assert.equal(transmission.ringTeeth, 36);
  assert.equal(transmission.ringTeeth,
    transmission.sunTeeth + 2 * transmission.planetTeeth);
  assert.equal(transmission.toothClosureEquation,
    'ringTeeth = sunTeeth + 2 * planetTeeth');
  near(geometry.sunPitchRadius,
    transmission.sunTeeth * geometry.module / 2, 0,
    'sun pitch radius');
  near(geometry.planetPitchRadius,
    transmission.planetTeeth * geometry.module / 2, 0,
    'planet pitch radius');
  near(geometry.ringPitchRadius,
    transmission.ringTeeth * geometry.module / 2, 0,
    'ring pitch radius');
  near(geometry.planetCenterRadius,
    geometry.sunPitchRadius + geometry.planetPitchRadius, 0,
    'external center distance');
  near(geometry.planetCenterRadius,
    geometry.ringPitchRadius - geometry.planetPitchRadius, 3e-16,
    'internal center distance');
  assert.equal(meshes[0].internal, false);
  assert.equal(meshes[1].internal, true);
  assert.deepEqual(meshes[0].teeth, [14, 11]);
  assert.deepEqual(meshes[1].teeth, [11, 36]);

  for (let sample = 0; sample <= 1440; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * sample / 1440,
    );
    near(state.planetCenter.length(), geometry.planetCenterRadius,
      4e-16, `planet orbit radius ${sample}`);
    near(state.contactPositionResiduals.AB, 0, 4e-16,
      `A-B contact position ${sample}`);
    near(state.contactPositionResiduals.BC, 0, 6e-16,
      `B-C contact position ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 505 satisfies Willis and both signed mesh-rate equations', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  near(transmission.sunAbsoluteRatio, 25 / 7, 0,
    'sun/carrier absolute ratio');
  near(transmission.planetAbsoluteRatio, -25 / 11, 0,
    'planet/carrier absolute ratio');
  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 3000,
    );
    near(state.ringAbsoluteAngularSpeed, 0, 0,
      `fixed ring ${sample}`);
    near(state.sunAbsoluteAngularSpeed,
      transmission.sunAbsoluteRatio * state.carrierAngularSpeed,
      0, `sun rate ${sample}`);
    near(state.planetAbsoluteAngularSpeed,
      transmission.planetAbsoluteRatio * state.carrierAngularSpeed,
      0, `planet rate ${sample}`);
    near(state.willisResidual, 0, 3e-15,
      `Willis equation ${sample}`);
    near(
      14 * (state.sunAbsoluteAngularSpeed - state.carrierAngularSpeed)
        + 11 * (
          state.planetAbsoluteAngularSpeed - state.carrierAngularSpeed
        ),
      0,
      3e-15,
      `external A-B rate ${sample}`,
    );
    near(
      11 * (
        state.planetAbsoluteAngularSpeed - state.carrierAngularSpeed
      ) - 36 * (
        state.ringAbsoluteAngularSpeed - state.carrierAngularSpeed
      ),
      0,
      3e-15,
      `internal B-C rate ${sample}`,
    );
    near(state.meshPhaseResiduals.AB, 0, 2e-12,
      `A-B tooth phase ${sample}`);
    near(state.meshPhaseResiduals.BC, 0, 2e-12,
      `B-C tooth phase ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 505 has zero pitch slip at both moving contacts', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 3000,
    );
    near(state.velocityResiduals.AB, 0, 7e-16,
      `A-B pitch velocity ${sample}`);
    near(state.velocityResiduals.BC, 0, 7e-16,
      `B-C pitch velocity ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 505 renderer preserves all world and carrier-local angles', () => {
  const { model } = movementModel();
  const { blocks, stateAtTime, transmission } = model.root.userData;

  for (let sample = 0; sample <= 720; sample += 1) {
    const time = transmission.nominalCarrierPeriod * 4 * sample / 720;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.carrierD.rotation.z, state.carrierAngle, 0,
      `carrier D angle ${sample}`);
    near(blocks.sunA.userData.rotor.rotation.z,
      state.sunAbsoluteAngle, 0, `sun A angle ${sample}`);
    near(blocks.planetB.userData.rotor.rotation.z,
      state.planetLocalAngle, 0, `planet B local angle ${sample}`);
    near(blocks.fixedRingC.userData.rotor.rotation.z,
      state.ringAbsoluteAngle, 0, `fixed ring C angle ${sample}`);
    assert.equal(blocks.sunOutputShaft.parent, blocks.sunA.userData.rotor);
    assert.equal(blocks.planetB.parent, blocks.carrierD);
    model.root.updateMatrixWorld(true);
    near(
      blocks.planetB.getWorldPosition(new THREE.Vector3())
        .distanceTo(state.planetCenter),
      0,
      7e-16,
      `planet B world center ${sample}`,
    );
  }
  disposeModel(model.root);
});

test('movement 505 runs continuously, fits its orbit, and leaves 506 next', () => {
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
  near(oneTurn.sunAbsoluteAngle - initial.sunAbsoluteAngle,
    25 * FULL_TURN / 7, 8e-15, 'sun turns continuously');
  near(oneTurn.planetAbsoluteAngle - initial.planetAbsoluteAngle,
    -25 * FULL_TURN / 11, 8e-15, 'planet turns continuously');
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
