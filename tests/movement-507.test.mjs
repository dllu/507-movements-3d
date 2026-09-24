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
  'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary';
const FULL_TURN = Math.PI * 2;

function movementModel() {
  const movement = catalog.movements[506];
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

test('movement 507 has fixed shaft m-p, three rigid compounds, carrier input, and slow C output', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, transmission } = model.root.userData;

  assert.equal(movement.id, 507);
  assert.equal(movement.number, '507');
  assert.match(movement.title, /very slow motion/);
  assert.equal(movement.category, 'Epicyclic trains');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(transmission.selectedConfiguration,
    'carrier-input-C-very-slow-output');
  assert.equal(blocks.fixedShaftMP.userData.fixed, true);
  assert.deepEqual(blocks.fixedShaftMP.userData.sourceLabels, ['m', 'p']);
  assert.equal(blocks.longSleeveDE.userData.rigidAssembly, 'D-E');
  assert.equal(blocks.longSleeveDE.userData.looseOnFixedShaft, 'm-p');
  assert.equal(blocks.gearD.parent, blocks.longSleeveDE);
  assert.equal(blocks.gearE.parent, blocks.longSleeveDE);
  assert.equal(blocks.shortSleeveAH.userData.rigidAssembly, 'A-H');
  assert.equal(blocks.shortSleeveAH.userData.fittedUpon,
    'long-sleeve-D-E');
  assert.equal(blocks.gearA.parent, blocks.shortSleeveAH);
  assert.equal(blocks.gearH.parent, blocks.shortSleeveAH);
  assert.equal(blocks.planetCompoundFG.userData.rigidAssembly, 'F-G');
  assert.equal(blocks.planetCompoundFG.userData.carriedBy, 'm-n');
  assert.equal(blocks.planetCompoundFG.userData.freeOnStud, 'n');
  assert.equal(blocks.planetCompoundFG.parent, blocks.carrierMN);
  assert.equal(blocks.gearF.parent, blocks.planetCompoundFG);
  assert.equal(blocks.gearG.parent, blocks.planetCompoundFG);
  assert.equal(blocks.carrierMN.userData.input, true);
  assert.equal(blocks.outputCAssembly.userData.output, true);
  assert.equal(blocks.gearC.userData.output, true);
  assert.equal(blocks.gearC.parent, blocks.outputCAssembly);
  assert.equal(blocks.outputShaftA.parent, blocks.outputCAssembly);
  // Brown draws no white index on C; the source presentation removes it.
  assert.equal(blocks.outputIndex.parent, null);
  assert.deepEqual(Object.keys(blocks.labels).sort(),
    ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'a', 'm', 'n', 'p']);
  assert.equal(degreesOfFreedom.independentCarrierInputs, 1);
  assert.equal(degreesOfFreedom.dependentSlowOutputCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentLongSleeveCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentShortSleeveCoordinates, 1);
  assert.equal(degreesOfFreedom.dependentPlanetCompoundCoordinates, 1);
  assert.equal(degreesOfFreedom.stationaryShaftCoordinates, 0);

  const gears = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isGear) gears.push(object);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.equal(gears.length, 7);
  assert.deepEqual(
    gears.map(({ userData }) => userData.sourceLabel).sort(),
    ['A', 'C', 'D', 'E', 'F', 'G', 'H'],
  );
  assert.equal(blocks.crownTeeth.length, 100);
  assert.ok(blocks.crownTeeth.every(
    ({ userData }) => userData.bevelTooth,
  ));
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 507 records Brown’s exact counts, ratio claim, and unavailable animation', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_507.html');
  assert.match(movement.description,
    /m is a fixed shaft.*long sleeve.*wheel, D.*wheel, E.*shorter one.*wheels, A and H/is);
  assert.match(movement.description,
    /wheel, C, gears with both D and A.*arm, m, n.*united wheels, F and G/is);
  assert.match(movement.description,
    /A have 10 teeth, C 100, D 10, E 61, F 49, G 41, and H 51.*25,000 revolutions/is);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_507\.png$/);
  assert.match(sourceReference.reconstructionDisclosure,
    /explicitly supplies A=10, C=100, D=10, E=61, F=49, G=41, H=51/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /carrier m\/n driven at 0\.60 rad\/s.*wheel C as the very-slow output/is);
  assert.match(sourceReference.reconstructionDisclosure,
    /61\+49 and 51\+41 differ.*layer-specific modules.*exact carrier-pin spacing/is);
  assert.match(sourceReference.engineeringCorroboration.report,
    /NASA SP-8100.*Dynamics of Planetary Gear Trains.*1984/);
  disposeModel(model.root);
});

test('movement 507 uses exact 100-to-10 opposed bevel geometry and contact kinematics', () => {
  const { model } = movementModel();
  const { geometry, meshes, stateAtTime, transmission } = model.root.userData;
  const bevelMeshes = meshes.filter(({ type }) => type === 'bevel');

  assert.deepEqual(bevelMeshes.map(({ first, second }) =>
    `${first}-${second}`), ['C-A', 'C-D']);
  near(geometry.bevelPitchRadii.A,
    transmission.teeth.A * geometry.bevelModule / 2, 0,
    'A bevel pitch radius');
  near(geometry.bevelPitchRadii.C,
    transmission.teeth.C * geometry.bevelModule / 2, 0,
    'C bevel pitch radius');
  near(geometry.bevelPitchRadii.D,
    transmission.teeth.D * geometry.bevelModule / 2, 0,
    'D bevel pitch radius');
  for (const mesh of bevelMeshes) {
    near(mesh.axesAngle, Math.PI / 2, 0,
      `${mesh.first}-${mesh.second} orthogonal axes`);
    vectorNear(mesh.pitchConeApex, new THREE.Vector3(), 0,
      `${mesh.first}-${mesh.second} common apex`);
  }
  for (let sample = 0; sample <= 1800; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 1800,
    );
    near(state.shortSleeveAngularSpeed,
      -10 * state.slowOutputAngularSpeed, 0,
      `C-A ratio ${sample}`);
    near(state.longSleeveAngularSpeed,
      10 * state.slowOutputAngularSpeed, 0,
      `C-D ratio ${sample}`);
    for (const [label, residual] of Object.entries(
      state.bevelPitchApexResiduals,
    )) {
      near(residual, 0, 2e-16, `${label} bevel apex ${sample}`);
    }
    near(state.pitchVelocityResiduals.CA, 0, 2e-19,
      `C-A pitch velocity ${sample}`);
    near(state.pitchVelocityResiduals.CD, 0, 2e-19,
      `C-D pitch velocity ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 507 gives both spur layers one exact carrier spacing with their own modules', () => {
  const { model } = movementModel();
  const { geometry, meshes, stateAtTime, transmission } = model.root.userData;
  const spurMeshes = meshes.filter(({ type }) => type === 'external-spur');

  assert.equal(spurMeshes.length, 2);
  assert.deepEqual(spurMeshes.map(({ first, second }) =>
    `${first}-${second}`), ['E-F', 'H-G']);
  assert.notEqual(geometry.layerModules.EF, geometry.layerModules.GH);
  for (const mesh of spurMeshes) {
    near(mesh.firstPitchRadius,
      mesh.teeth[0] * mesh.module / 2, 0,
      `${mesh.first} module relation`);
    near(mesh.secondPitchRadius,
      mesh.teeth[1] * mesh.module / 2, 0,
      `${mesh.second} module relation`);
    near(mesh.firstPitchRadius + mesh.secondPitchRadius,
      geometry.carrierPinSpacing, 4e-16,
      `${mesh.first}-${mesh.second} center distance`);
    near(mesh.centerDistance, geometry.carrierPinSpacing, 0,
      `${mesh.first}-${mesh.second} published spacing`);
  }
  for (let sample = 0; sample <= 1800; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 20 * sample / 1800,
    );
    near(state.planetCenter.length(), geometry.carrierPinSpacing,
      5e-16, `planet-stud orbit ${sample}`);
    near(state.contactPositionResiduals.EF, 0, 7e-16,
      `E-F position ${sample}`);
    near(state.contactPositionResiduals.HG, 0, 7e-16,
      `H-G position ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 507 derives Brown’s 25,000 ratio from the 2501-to-2499 product difference', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;

  assert.equal(transmission.upperProduct, 61 * 41);
  assert.equal(transmission.upperProduct, 2501);
  assert.equal(transmission.lowerProduct, 51 * 49);
  assert.equal(transmission.lowerProduct, 2499);
  assert.equal(transmission.productDifference, 2);
  assert.equal(transmission.bevelMultiplier, 10);
  assert.equal(transmission.carrierToSlowOutputRatio, 25000);
  near(transmission.slowOutputToCarrierRatio, 1 / 25000, 0,
    'C/carrier ratio');
  near(transmission.shortSleeveToCarrierRatio, -1 / 2500, 0,
    'A-H/carrier ratio');
  near(transmission.longSleeveToCarrierRatio, 1 / 2500, 0,
    'D-E/carrier ratio');
  near(transmission.planetCompoundToCarrierRatio, 5611 / 2500,
    5e-16, 'F-G/carrier ratio');
  for (let sample = 0; sample <= 3000; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 40 * sample / 3000,
    );
    near(state.carrierAngularSpeed,
      25000 * state.slowOutputAngularSpeed, 0,
      `25,000 ratio ${sample}`);
    near(state.aggregateEquationResidual, 0, 2e-13,
      `product-difference equation ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 507 satisfies every mesh phase and has zero spur pitch slip', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  // Pitch-line speeds scale with the arm n-m; allow about one rounding step
  // at that magnitude.
  const pitchTolerance = 1.05 * Number.EPSILON * geometry.carrierPinSpacing;

  assert.match(transmission.aggregateCarrierLaw,
    /NE \* NG.*omegaDE - omegaCarrier.*NH \* NF.*omegaAH - omegaCarrier/);
  for (let sample = 0; sample <= 3600; sample += 1) {
    const state = stateAtTime(
      transmission.nominalCarrierPeriod * 40 * sample / 3600,
    );
    for (const [pair, residual] of Object.entries(
      state.meshRateResiduals,
    )) {
      near(residual, 0, 8e-15, `${pair} mesh rate ${sample}`);
    }
    for (const [pair, residual] of Object.entries(
      state.meshPhaseResiduals,
    )) {
      near(residual, 0, 2e-11, `${pair} tooth phase ${sample}`);
    }
    near(state.pitchVelocityResiduals.EF, 0, pitchTolerance,
      `E-F pitch velocity ${sample}`);
    near(state.pitchVelocityResiduals.HG, 0, pitchTolerance,
      `H-G pitch velocity ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 507 renderer preserves the sleeves and compound planet exactly', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime, transmission } = model.root.userData;
  // Planet centres lie on the arm n-m; their rounding scales with its length.
  const planetTolerance = 2.75 * Number.EPSILON * geometry.carrierPinSpacing;

  for (let sample = 0; sample <= 900; sample += 1) {
    const time = transmission.nominalCarrierPeriod * 5 * sample / 900;
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.outputCAssembly.rotation.x,
      state.slowOutputAngle, 0, `C output angle ${sample}`);
    near(blocks.shortSleeveAH.rotation.y,
      state.shortSleeveAngle, 0, `A-H sleeve angle ${sample}`);
    near(blocks.longSleeveDE.rotation.y,
      state.longSleeveAngle, 0, `D-E sleeve angle ${sample}`);
    near(blocks.carrierMN.rotation.y,
      state.carrierAngle, 0, `carrier angle ${sample}`);
    near(blocks.planetCompoundFG.rotation.y,
      state.planetCompoundLocalAngle, 0,
      `F-G carrier-local angle ${sample}`);
    model.root.updateMatrixWorld(true);
    vectorNear(blocks.gearC.getWorldPosition(new THREE.Vector3()),
      state.bevelCenters.C, 3e-16, `C center ${sample}`);
    vectorNear(blocks.gearA.getWorldPosition(new THREE.Vector3()),
      state.bevelCenters.A, 3e-16, `A center ${sample}`);
    vectorNear(blocks.gearD.getWorldPosition(new THREE.Vector3()),
      state.bevelCenters.D, 3e-16, `D center ${sample}`);
    vectorNear(blocks.gearF.getWorldPosition(new THREE.Vector3()),
      state.planetCenter.clone().addScaledVector(
        new THREE.Vector3(0, 1, 0),
        geometry.layerY.EF,
      ),
      planetTolerance,
      `F center ${sample}`,
    );
    vectorNear(blocks.gearG.getWorldPosition(new THREE.Vector3()),
      state.planetCenter.clone().addScaledVector(
        new THREE.Vector3(0, 1, 0),
        geometry.layerY.GH,
      ),
      planetTolerance,
      `G center ${sample}`,
    );
  }
  disposeModel(model.root);
});

test('movement 507 is continuous, fits every carrier pose, and completes the authored catalog', () => {
  const { model } = movementModel();
  const { stateAtTime, transmission } = model.root.userData;
  const carrierPeriod = transmission.nominalCarrierPeriod;
  const outputPeriod = transmission.nominalSlowOutputPeriod;
  const initial = stateAtTime(0);
  const oneCarrierTurn = stateAtTime(carrierPeriod);
  const oneOutputTurn = stateAtTime(outputPeriod);
  const before = stateAtTime(carrierPeriod - 1e-8);
  const after = stateAtTime(carrierPeriod + 1e-8);

  assert.equal(transmission.continuousUnwrappedRotation, true);
  near(oneCarrierTurn.carrierAngle - initial.carrierAngle,
    FULL_TURN, 0, 'one carrier turn');
  near(oneCarrierTurn.slowOutputAngle - initial.slowOutputAngle,
    FULL_TURN / 25000, 6e-20, 'C advances 1/25,000 turn');
  near(oneCarrierTurn.shortSleeveAngle - initial.shortSleeveAngle,
    -FULL_TURN / 2500, 6e-19, 'A-H slow reverse advance');
  near(oneCarrierTurn.longSleeveAngle - initial.longSleeveAngle,
    FULL_TURN / 2500, 6e-19, 'D-E slow forward advance');
  near(oneCarrierTurn.planetCompoundAbsoluteAngle
    - initial.planetCompoundAbsoluteAngle,
  5611 * FULL_TURN / 2500, 4e-15, 'F-G absolute advance');
  near(oneOutputTurn.slowOutputAngle - initial.slowOutputAngle,
    FULL_TURN, 9e-16, 'one complete slow C turn');
  near(oneOutputTurn.carrierAngle - initial.carrierAngle,
    25000 * FULL_TURN, 3e-11, '25,000 carrier turns');
  near(after.carrierAngle - before.carrierAngle,
    2e-8 * transmission.carrierAngularSpeed, 2e-15,
    'no carrier reset');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 1080; sample += 1) {
    model.update(carrierPeriod * sample / 1080);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));

  assert.equal(catalog.movements.length, 507);
  assert.equal(catalog.movements.at(-1).id, 507);
  assert.equal(catalog.movements.at(-1).archetype, ARCHETYPE);
  assert.ok(catalog.movements.every(
    ({ fidelity }) => fidelity === 'authored',
  ));
  disposeModel(model.root);
});
