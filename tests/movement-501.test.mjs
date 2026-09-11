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
    '../src/simulation/authored-mercurial-barometers.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'open-reservoir-sealed-vacuum-long-leg-mercurial-barometer';

function movementModel() {
  const movement = catalog.movements[500];
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

test('movement 501 is one open-reservoir barometer with one sealed evacuated long leg', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 501);
  assert.equal(movement.number, '501');
  assert.equal(movement.title, 'Mercurial barometer. Longer leg of bent tube…');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.shortOpenRim.userData.openToAtmosphere, true);
  assert.equal(blocks.sealedLongCap.userData.hermeticallyClosed, true);
  assert.equal(blocks.menisci.length, 2);
  assert.equal(blocks.scaleTicks.length, 31);
  assert.deepEqual(
    blocks.scaleLabels.map((label) => label.userData.valueInches),
    [28, 29, 30, 31],
  );
  assert.equal(degreesOfFreedom.independentAtmosphericPressureInputs, 1);
  assert.equal(degreesOfFreedom.independentMercurySurfaceCoordinates, 0);
  assert.ok(geometry.innerTubeRadius < geometry.glassOuterRadius);
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.isGear) gears.push(object);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  assert.doesNotMatch(sourceText, /makeGear|makeSpurGear|makeRack/);
  disposeModel(model.root);
});

test('movement 501 records its unavailable animation and barometer evidence', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_501.html');
  assert.match(movement.description,
    /longer leg.*closed at top.*shorter one is open to the atmosphere.*pressure of air.*rises or falls/is);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_501\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /official page marks Animated unavailable.*5:1 reservoir\/tube area ratio.*29\.2-to-30\.8-inch.*reconstruction choices/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /optional float-and-dial.*not pictured.*not added/is);
  assert.match(sourceReference.metrologyCorroboration.report,
    /NBS Monograph 8.*Mercury Barometers and Manometers.*1960/);
  assert.match(sourceReference.metrologyCorroboration.detail,
    /P = rho g h.*upper surface is under vacuum.*standard mercury density/is);
  assert.match(sourceReference.metrologyCorroboration.url,
    /nvlpubs\.nist\.gov.*nbsmonograph8\.pdf/i);
  disposeModel(model.root);
});

test('movement 501 satisfies atmospheric pressure = mercury density times gravity times head', () => {
  const { model } = movementModel();
  const { geometry, hydrostatics, stateAtTime } = model.root.userData;

  assert.equal(hydrostatics.equation,
    'atmosphericPressurePascal = mercuryDensity * gravity * (longSurfaceY - reservoirSurfaceY) * sceneMetresPerUnit');
  for (let sample = 0; sample <= 1000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 1000);
    const expectedHead = (state.rightSurfaceY - state.leftSurfaceY)
      * hydrostatics.sceneMetresPerUnit;
    const expectedPressure = hydrostatics
      .mercuryDensityKilogramsPerCubicMetre
      * hydrostatics.standardGravityMetresPerSecondSquared
      * expectedHead;
    near(state.mercuryHeadMetres, expectedHead, 2e-16,
      `surface head ${sample}`);
    near(state.atmosphericPressurePascal, expectedPressure, 3e-11,
      `absolute pressure ${sample}`);
    near(state.absolutePressureResidualPascal, 0, 3e-11,
      `hydrostatic residual ${sample}`);
    assert.equal(state.torricellianVacuumPressurePascal, 0);
    near(state.readingInches,
      state.mercuryHeadMetres / hydrostatics.inchMetres,
      0, `inch conversion ${sample}`);
    assert.ok(state.longLegVacuumLengthScene > 0);
  }
  disposeModel(model.root);
});

test('movement 501 conserves mercury volume with the finite open reservoir correction', () => {
  const { model } = movementModel();
  const { geometry, hydrostatics, stateAtTime, transmission } =
    model.root.userData;
  const initial = stateAtTime(0);

  near(hydrostatics.reservoirAreaSceneSquared,
    hydrostatics.tubeAreaSceneSquared
      * hydrostatics.reservoirAreaRatio,
    2e-17, 'published area ratio');
  near(transmission.leftReservoirDropPerLongColumnRise,
    1 / hydrostatics.reservoirAreaRatio, 3e-17,
    'surface displacement ratio');
  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 1200);
    near(state.variableMercuryVolumeSceneCubed,
      initial.variableMercuryVolumeSceneCubed, 2e-16,
      `conserved mercury volume ${sample}`);
    near(state.variableMercuryVolumeSceneCubed,
      hydrostatics.variableMercuryVolumeSceneCubed, 2e-16,
      `published conserved volume ${sample}`);
    near(state.volumeChangeResidualSceneCubed, 0, 2e-18,
      `volume residual ${sample}`);
    near(state.leftSurfaceShift,
      -state.rightSurfaceShift
        * transmission.leftReservoirDropPerLongColumnRise,
      2e-16, `finite-reservoir motion ratio ${sample}`);
    assert.ok(state.leftSurfaceY > geometry.reservoirBottomY);
    assert.ok(state.rightSurfaceY < geometry.longLegTopY);
  }
  disposeModel(model.root);
});

test('movement 501 places every scale mark at its finite-reservoir calibrated height', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime, transmission } = model.root.userData;

  for (const tick of blocks.scaleTicks) {
    near(tick.position.y,
      transmission.rightSurfaceForReading(tick.userData.valueInches),
      0, `scale tick ${tick.userData.valueInches}`);
  }
  for (const label of blocks.scaleLabels) {
    near(label.position.y,
      transmission.rightSurfaceForReading(label.userData.valueInches),
      0, `scale label ${label.userData.valueInches}`);
  }
  const minimum = stateAtTime(0);
  const maximum = stateAtTime(geometry.cycleDuration / 2);
  near(minimum.readingInches, transmission.minimumReadingInches,
    4e-15, 'minimum reading');
  near(maximum.readingInches, transmission.maximumReadingInches,
    4e-15, 'maximum reading');
  near(minimum.rightSurfaceY,
    transmission.rightSurfaceForReading(minimum.readingInches),
    9e-16, 'minimum meniscus-scale agreement');
  near(maximum.rightSurfaceY,
    transmission.rightSurfaceForReading(maximum.readingInches),
    9e-16, 'maximum meniscus-scale agreement');
  disposeModel(model.root);
});

test('movement 501 renderer follows both free surfaces and the live index exactly', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (let sample = 0; sample <= 640; sample += 1) {
    const time = geometry.cycleDuration * sample / 640;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.longMercuryColumn.position.y,
      (geometry.bendTangentY - 0.025 + state.rightSurfaceY) / 2,
      0, `long-column center ${sample}`);
    near(blocks.longMercuryColumn.scale.y,
      state.rightSurfaceY - (geometry.bendTangentY - 0.025),
      3e-16, `long-column height ${sample}`);
    near(blocks.reservoirMercury.position.y,
      (geometry.reservoirBottomY + state.leftSurfaceY) / 2,
      0, `reservoir-column center ${sample}`);
    near(blocks.reservoirMercury.scale.y,
      state.leftSurfaceY - geometry.reservoirBottomY,
      3e-16, `reservoir-column height ${sample}`);
    near(blocks.menisci[0].position.y, state.leftSurfaceY, 0,
      `reservoir meniscus ${sample}`);
    near(blocks.menisci[1].position.y, state.rightSurfaceY, 0,
      `long-leg meniscus ${sample}`);
    near(blocks.liveReadingPointer.position.y, state.rightSurfaceY, 0,
      `live scale index ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 501 starts and closes at rest, fits every pose, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);
  const maximum = stateAtTime(geometry.cycleDuration / 2);
  const closure = stateAtTime(geometry.cycleDuration);

  near(initial.atmosphericPressureVelocityPascalPerSecond, 0, 0,
    'initial pressure velocity');
  near(maximum.atmosphericPressureVelocityPascalPerSecond, 0, 1e-11,
    'turnaround pressure velocity');
  near(closure.atmosphericPressureVelocityPascalPerSecond, 0, 0,
    'closure pressure velocity');
  near(closure.cyclePosition, initial.cyclePosition, 0,
    'cycle-position closure');
  near(closure.leftSurfaceY, initial.leftSurfaceY, 0,
    'reservoir-surface closure');
  near(closure.rightSurfaceY, initial.rightSurfaceY, 0,
    'long-surface closure');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 720; sample += 1) {
    model.update(geometry.cycleDuration * sample / 720);
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
