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
    '../src/simulation/authored-siphon-pressure-gauges.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'equal-bore-open-atmosphere-mercury-u-tube-siphon-pressure-gauge';

function movementModel() {
  const movement = catalog.movements[497];
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

test('movement 498 is one equal-bore mercury U-tube with one connected leg and one open leg', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 498);
  assert.equal(movement.number, '498');
  assert.match(movement.title, /^Siphon pressure gauge/);
  assert.equal(movement.category, 'Pumps & pneumatics');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.glassLegs.length, 2);
  assert.equal(blocks.mercuryColumns.length, 2);
  assert.equal(blocks.menisci.length, 2);
  near(blocks.glassLegs[0].userData.crossSectionArea,
    blocks.glassLegs[1].userData.crossSectionArea, 0,
    'equal glass-leg bore areas');
  near(blocks.mercuryColumns[0].userData.crossSectionArea,
    blocks.mercuryColumns[1].userData.crossSectionArea, 0,
    'equal mercury-column areas');
  assert.equal(blocks.openLegRim.userData.openToAtmosphere, true);
  assert.equal(blocks.pressureConnection.userData.connectedLeg, 'left');
  assert.equal(blocks.scaleTicks.length, 7);
  assert.deepEqual(blocks.scaleTicks.map((tick) => tick.userData.value),
    [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(blocks.scaleNumerals.length, 7);
  assert.equal(degreesOfFreedom.independentPressureInputs, 1);
  assert.equal(degreesOfFreedom.independentMercurySurfaceCoordinates, 0);
  assert.ok(geometry.innerBoreRadius < geometry.glassOuterRadius);
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 498 records the unavailable source animation and the governing manometer evidence', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_498.html');
  assert.match(movement.description,
    /scale is marked, is open at top.*other leg connected with the steam-boiler.*depressed in that and raised in the other.*equilibrium/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_498\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /official page marks Animated unavailable.*equal bores.*eight-second smooth 0-to-4-to-0.*reconstruction choices/i);
  assert.match(sourceReference.metrologyCorroboration.report,
    /NBS Monograph 8.*Mercury Barometers and Manometers.*1960/);
  assert.match(sourceReference.metrologyCorroboration.detail,
    /p = rho g h.*mercury density at 20 degrees Celsius/i);
  assert.match(sourceReference.metrologyCorroboration.url,
    /nvlpubs\.nist\.gov.*nbsmonograph8\.pdf/i);
  disposeModel(model.root);
});

test('movement 498 conserves equal-bore mercury volume while its surfaces move equally and oppositely', () => {
  const { model } = movementModel();
  const { geometry, hydrostatics, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);

  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 1200);
    near(state.leftSurfaceY + state.rightSurfaceY,
      2 * geometry.datumY, 2e-15,
      `equal opposite surface displacement ${sample}`);
    near(geometry.datumY - state.leftSurfaceY,
      state.rightSurfaceY - geometry.datumY, 2e-15,
      `surface displacement magnitudes ${sample}`);
    near(state.totalStraightLegMercuryVolumeSceneCubed,
      initial.totalStraightLegMercuryVolumeSceneCubed, 6e-17,
      `straight-leg mercury volume ${sample}`);
    near(state.totalStraightLegMercuryVolumeSceneCubed,
      hydrostatics.totalStraightLegMercuryVolumeSceneCubed, 6e-17,
      `published conserved volume ${sample}`);
    assert.ok(state.leftSurfaceY > geometry.bendTangentY);
    assert.ok(state.rightSurfaceY < geometry.tubeTopY);
  }
  disposeModel(model.root);
});

test('movement 498 satisfies gauge pressure = mercury density times gravity times vertical head', () => {
  const { model } = movementModel();
  const { geometry, hydrostatics, stateAtTime, transmission } =
    model.root.userData;
  assert.equal(hydrostatics.equation,
    'gaugePressurePascal = mercuryDensity * gravity * verticalSurfaceDifferenceMetres');
  for (let sample = 0; sample <= 1000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 1000);
    const expectedHead = (state.rightSurfaceY - state.leftSurfaceY)
      * hydrostatics.sceneMetresPerUnit;
    const expectedPressure = hydrostatics
      .mercuryDensityKilogramsPerCubicMetre
      * hydrostatics.standardGravityMetresPerSecondSquared
      * expectedHead;
    near(state.mercuryHeadDifferenceMetres, expectedHead, 0,
      `head difference ${sample}`);
    near(state.gaugePressurePascal, expectedPressure, 0,
      `hydrostatic pressure ${sample}`);
    near(state.hydrostaticResidualPascal, 0, 0,
      `hydrostatic residual ${sample}`);
    near(state.leftAbsolutePressurePascal,
      state.atmosphericPressurePascal + state.gaugePressurePascal, 0,
      `connected-leg absolute pressure ${sample}`);
    near(state.rightAbsolutePressurePascal,
      state.atmosphericPressurePascal, 0,
      `open-leg atmospheric pressure ${sample}`);
  }
  const maximum = stateAtTime(geometry.cycleDuration / 2);
  near(maximum.scaleReading, 4, 0, 'maximum scale indication');
  near(maximum.gaugePressurePascal,
    transmission.maximumGaugePressurePascal, 0,
    'maximum published pressure');
  near(maximum.gaugePressurePascal, 99895.54892975392, 1e-8,
    'chosen reconstruction maximum pressure');
  near(transmission.pressureScalePascalPerDivision
    * maximum.scaleReading, maximum.gaugePressurePascal, 2e-11,
  'calibrated pressure divisions');
  disposeModel(model.root);
});

test('movement 498 renderer follows both free surfaces and the live scale index exactly', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  for (let sample = 0; sample <= 640; sample += 1) {
    const time = geometry.cycleDuration * sample / 640;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.mercuryColumns[0].position.y,
      (geometry.bendTangentY - 0.025 + state.leftSurfaceY) / 2,
      0, `left rendered column center ${sample}`);
    near(blocks.mercuryColumns[1].position.y,
      (geometry.bendTangentY - 0.025 + state.rightSurfaceY) / 2,
      0, `right rendered column center ${sample}`);
    near(blocks.mercuryColumns[0].scale.y,
      state.leftSurfaceY - (geometry.bendTangentY - 0.025),
      2e-16, `left rendered column height ${sample}`);
    near(blocks.mercuryColumns[1].scale.y,
      state.rightSurfaceY - (geometry.bendTangentY - 0.025),
      2e-16, `right rendered column height ${sample}`);
    near(blocks.menisci[0].position.y, state.leftSurfaceY, 0,
      `left meniscus ${sample}`);
    near(blocks.menisci[1].position.y, state.rightSurfaceY, 0,
      `right meniscus ${sample}`);
    near(blocks.readingPointer.position.y, state.rightSurfaceY, 0,
      `scale index ${sample}`);
    near(blocks.pressureCore.material.opacity,
      0.10 + 0.55 * state.pressureFraction, 0,
      `steam-pressure visibility ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 498 starts and closes at rest, fits every pose, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);
  const maximum = stateAtTime(geometry.cycleDuration / 2);
  const closure = stateAtTime(geometry.cycleDuration);

  near(initial.pressureFractionVelocity, 0, 0,
    'initial smooth pressure velocity');
  near(maximum.pressureFractionVelocity, 0, 6e-17,
    'turnaround smooth pressure velocity');
  near(closure.pressureFractionVelocity, 0, 0,
    'closure smooth pressure velocity');
  near(closure.cyclePosition, initial.cyclePosition, 0,
    'cycle-position closure');
  near(closure.leftSurfaceY, initial.leftSurfaceY, 0,
    'left-surface closure');
  near(closure.rightSurfaceY, initial.rightSurfaceY, 0,
    'right-surface closure');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 720; sample += 1) {
    model.update(geometry.cycleDuration * sample / 720);
    model.root.updateMatrixWorld(true);
    // Nothing is drawn beyond Brown's crop (no boiler); any part so marked
    // would be excluded from the fit.
    model.root.traverse((object) => {
      if (!object.isMesh) return;
      for (let parent = object; parent; parent = parent.parent) if (parent.userData.beyondPlateCrop) return;
      swept.union(new THREE.Box3().setFromObject(object));
    });
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
