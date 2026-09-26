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
const QUARTER_TURN = Math.PI / 2;
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
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 223 is four sector pairs on four planes and two fixed shafts', () => {
  const movement = catalog.movements[222];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    sourceAnimation,
  } = model.root.userData;

  assert.equal(movement.id, 223);
  assert.equal(movement.number, '223');
  assert.equal(movement.title, 'Four-Plane Variable-Ratio Sector Gears');
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'four-plane-stepped-sector-gears-variable-circular-motion',
  );
  assert.equal(archetype, movement.archetype);
  assert.equal(
    mechanism,
    'four-quarter-driver-sectors-mesh-with-four-separate-output-sectors',
  );
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.cyclesPerMinute, 15);
  assert.equal(sourceAnimation.sourceUrl, movement.sourceUrl);

  assert.equal(blocks.driverSectors.length, 4);
  assert.equal(blocks.outputSectors.length, 4);
  assert.equal(blocks.contactMarkers.length, 4);
  assert.equal(blocks.driverAssembly.parent, model.root);
  assert.equal(blocks.outputAssembly.parent, model.root);
  assert.equal(blocks.driverShaft.parent, model.root);
  assert.equal(blocks.outputShaft.parent, model.root);
  assert.ok(blocks.driverAssembly.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  assert.ok(blocks.outputAssembly.userData.axis.distanceTo(Z_AXIS) < 1e-12);
  blocks.driverSectors.forEach((sector, index) => {
    assert.equal(sector.parent, blocks.driverAssembly.userData.rotor);
    assert.equal(
      blocks.outputSectors[index].parent,
      blocks.outputAssembly.userData.rotor,
    );
    near(
      sector.position.z,
      blocks.outputSectors[index].position.z,
      0,
      `pair ${index} shares one axial plane`,
    );
  });
  const inventedStationaryParts = [];
  model.root.traverse((object) => {
    if (/guide|support-frame|base-rail/i.test(object.userData.role ?? '')) {
      inventedStationaryParts.push(object);
    }
  });
  assert.deepEqual(inventedStationaryParts, []);
  disposeModel(model.root);
});

test('movement 223 preserves the source radii, sectors, and tooth systems', () => {
  const model = createMovementModel(catalog.movements[222]);
  const { geometry, sourceReference } = model.root.userData;
  const pairs = geometry.pairDefinitions;

  assert.deepEqual(
    pairs.map((pair) => pair.driverPitchRadius),
    [1, 1.6, 2.8, 1.6],
  );
  assert.deepEqual(
    pairs.map((pair) => pair.outputPitchRadius),
    [3, 2.4, 1.2, 2.4],
  );
  assert.deepEqual(
    pairs.map((pair) => pair.driverEquivalentTeeth),
    [24, 40, 56, 40],
  );
  assert.deepEqual(
    pairs.map((pair) => pair.outputEquivalentTeeth),
    [72, 60, 24, 60],
  );
  assert.deepEqual(
    pairs.map((pair) => pair.driverInstalledTeeth),
    [7, 11, 15, 11],
  );
  assert.deepEqual(
    pairs.map((pair) => pair.outputInstalledTeeth),
    [6, 10, 14, 10],
  );
  assert.deepEqual(geometry.outputKeyAngles, [
    0,
    -Math.PI / 6,
    -Math.PI / 2,
    -5 * Math.PI / 3,
    -FULL_TURN,
  ]);
  pairs.forEach((pair, index) => {
    near(
      pair.driverPitchRadius + pair.outputPitchRadius,
      geometry.centerDistance,
      5e-16,
      `pair ${index} pitch radii span the fixed centers`,
    );
    near(
      pair.driverModule,
      pair.outputModule,
      2e-17,
      `pair ${index} has one circular pitch`,
    );
    near(
      pair.driverSectorEnd - pair.driverSectorStart,
      QUARTER_TURN,
      2e-16,
      `driver sector ${index} covers one quarter`,
    );
  });
  const expectedOutputSweeps = [
    Math.PI / 6,
    Math.PI / 3,
    7 * Math.PI / 6,
    Math.PI / 3,
  ];
  pairs.forEach((pair, index) => near(
    pair.outputSectorEnd - pair.outputSectorStart,
    expectedOutputSweeps[index],
    5e-16,
    `output sector ${index} has the conjugate sweep`,
  ));
  assert.deepEqual(
    sourceReference.plate223.inferredDriverInstalledTeeth,
    [7, 11, 15, 11],
  );
  assert.deepEqual(
    sourceReference.plate223.inferredOutputInstalledTeeth,
    [6, 10, 14, 10],
  );
  near(
    sourceReference.plate223.rasterDriverCenter.distanceTo(
      sourceReference.plate223.rasterOutputCenter,
    ),
    250.00799987200408,
    1e-10,
    'engraving shaft spacing',
  );
  disposeModel(model.root);
});

test('movement 223 rolls exactly through 32,769 states and closes in one turn', () => {
  const model = createMovementModel(catalog.movements[222]);
  const { stateAtDriverTravel, transmission } = model.root.userData;
  const encountered = new Set();
  let maximumCenterError = 0;
  let maximumNoSlipError = 0;
  let maximumPhaseError = 0;
  for (let index = 0; index <= 32768; index += 1) {
    const state = stateAtDriverTravel(index / 32768 * FULL_TURN);
    encountered.add(state.activePairIndex);
    maximumCenterError = Math.max(
      maximumCenterError,
      state.contactCenterError,
    );
    maximumNoSlipError = Math.max(maximumNoSlipError, state.noSlipError);
    maximumPhaseError = Math.max(maximumPhaseError, state.meshPhaseError);
    near(
      state.driverSurfaceVelocity.x,
      state.outputSurfaceVelocity.x,
      5e-16,
      `state ${index} tangential surface velocity`,
    );
    near(state.driverSurfaceVelocity.y, 0, 0, `state ${index} driver y`);
    near(state.outputSurfaceVelocity.y, 0, 0, `state ${index} output y`);
  }
  assert.deepEqual([...encountered], [0, 1, 2, 3]);
  assert.ok(maximumCenterError < 2.3e-16);
  assert.ok(maximumNoSlipError < 4.5e-16);
  assert.ok(maximumPhaseError < 1.5e-13);

  const source = stateAtDriverTravel(0);
  const closure = stateAtDriverTravel(FULL_TURN);
  near(closure.driverAngle - source.driverAngle, FULL_TURN, 0,
    'one input turn');
  near(closure.outputAngle - source.outputAngle, -FULL_TURN, 0,
    'one reverse output turn');
  assert.equal(transmission.outputTurnsPerDriverTurn, -1);
  const expectedRatios = [
    -1 / 3,
    -2 / 3,
    -7 / 3,
    -2 / 3,
  ];
  transmission.outputSpeedRatioSequence.forEach((ratio, index) => near(
    ratio,
    expectedRatios[index],
    Number.EPSILON,
    `speed interval ${index}`,
  ));
  disposeModel(model.root);
});

test('movement 223 uses true involutes and relieved changeover teeth', () => {
  const model = createMovementModel(catalog.movements[222]);
  const { blocks, geometry, transmission } = model.root.userData;

  blocks.driverSectors.forEach((driverSector, index) => {
    const outputSector = blocks.outputSectors[index];
    near(driverSector.userData.pressureAngle, THREE.MathUtils.degToRad(20),
      1e-15, `driver ${index} pressure angle`);
    near(outputSector.userData.pressureAngle, THREE.MathUtils.degToRad(20),
      1e-15, `output ${index} pressure angle`);
    assert.equal(driverSector.userData.transitionTeeth.length, 2);
    assert.equal(outputSector.userData.transitionTeeth.length, 0);
    assert.equal(
      driverSector.userData.workingTeeth.length,
      driverSector.userData.installedTeeth - 2,
    );
    assert.equal(
      outputSector.userData.workingTeeth.length,
      outputSector.userData.installedTeeth,
    );
    for (const tooth of [
      ...driverSector.userData.workingTeeth,
      ...outputSector.userData.workingTeeth,
    ]) {
      assert.equal(tooth.userData.toothProfile, 'true-involute');
      assert.equal(tooth.userData.transitionRelieved, false);
    }
    for (const tooth of driverSector.userData.transitionTeeth) {
      assert.equal(
        tooth.userData.toothProfile,
        'true-involute-transition-relieved',
      );
      assert.equal(tooth.userData.transitionRelieved, true);
      assert.ok(tooth.userData.outerRadius < tooth.userData.pitchRadius);
    }
    near(
      driverSector.userData.module,
      outputSector.userData.module,
      2e-17,
      `plane ${index} modules`,
    );
  });
  for (let index = 1; index < geometry.planeZs.length; index += 1) {
    assert.ok(
      geometry.planeZs[index] - geometry.planeZs[index - 1]
        > geometry.sectorDepth,
      `planes ${index - 1} and ${index} have positive axial clearance`,
    );
  }
  assert.equal(transmission.historicalTransitionInterferenceRemoved, true);
  assert.match(transmission.transitionMethod, /offline-swept-sector-end-relief-with-prescribed-speed-jumps/);
  disposeModel(model.root);
});

test('movement 223 has the exact four speed intervals and continuous poses', () => {
  const model = createMovementModel(catalog.movements[222]);
  const { geometry, stateAtDriverTravel } = model.root.userData;
  const expectedRatios = [-1 / 3, -2 / 3, -7 / 3, -2 / 3];
  const h = 1e-6;
  expectedRatios.forEach((expectedRatio, pairIndex) => {
    const midpoint = (pairIndex + 0.5) * QUARTER_TURN;
    const state = stateAtDriverTravel(midpoint);
    assert.equal(state.activePairIndex, pairIndex);
    near(state.outputPerDriverAngle, expectedRatio, Number.EPSILON,
      `pair ${pairIndex} analytic speed`);
    const finiteRate = (
      stateAtDriverTravel(midpoint + h).outputAngle
      - stateAtDriverTravel(midpoint - h).outputAngle
    ) / (2 * h);
    near(finiteRate, expectedRatio, 5e-10,
      `pair ${pairIndex} finite speed`);
    assert.equal(state.transitionReliefActive, false);
    near(state.meshPhaseSum, 0.5, 1.5e-14,
      `pair ${pairIndex} half-pitch mesh phase`);
  });

  for (let boundary = 1; boundary < 4; boundary += 1) {
    const angle = boundary * QUARTER_TURN;
    const exact = stateAtDriverTravel(angle);
    const before = stateAtDriverTravel(angle - 1e-9);
    const after = stateAtDriverTravel(angle + 1e-9);
    near(exact.outputAngle, geometry.outputKeyAngles[boundary], 2e-15,
      `boundary ${boundary} source angle`);
    assert.ok(Math.abs(before.outputAngle - exact.outputAngle) < 3e-9);
    assert.ok(Math.abs(after.outputAngle - exact.outputAngle) < 3e-9);
    assert.equal(exact.transitionReliefActive, true);
    assert.notEqual(before.outputPerDriverAngle, after.outputPerDriverAngle);
  }
  disposeModel(model.root);
});

test('movement 223 runtime binds both shafts while 262 remains authored', () => {
  const model = createMovementModel(catalog.movements[222]);
  const {
    blocks,
    canonicalTimes,
    stateAtTime,
  } = model.root.userData;
  for (const time of [
    0,
    canonicalTimes.firstSpeedChange / 2,
    canonicalTimes.firstSpeedChange,
    canonicalTimes.secondSpeedChange,
    canonicalTimes.thirdSpeedChange,
    canonicalTimes.cycleClosure,
  ]) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.driverAssembly.userData.rotor.rotation.z, state.driverAngle,
      1e-12, `time ${time} driver transform`);
    near(blocks.outputAssembly.userData.rotor.rotation.z, state.outputAngle,
      1e-12, `time ${time} output transform`);
    near(blocks.driverAssembly.userData.angularSpeed,
      state.driverAngularSpeed, 0, `time ${time} driver speed`);
    near(blocks.outputAssembly.userData.angularSpeed,
      state.outputAngularSpeed, 0, `time ${time} output speed`);
    assert.equal(
      blocks.contactMarkers.filter((marker) => marker.userData.active).length,
      1,
    );
    assert.equal(blocks.contactMarkers[state.activePairIndex].userData.active, true);
    assert.ok(blocks.contactMarkers.every((marker) => !marker.visible),
      'undrawn contact markers stay hidden');
  }
  const bounds = new THREE.Box3().setFromObject(model.root);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 5.3);
  assert.ok(size.y > 8.1);
  // Four sector planes, Brown's front hub collar and shaft ends flush with it.
  assert.ok(size.z > 1.7);
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 110);
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

test('movement 223 carries Brown’s front hub collar on both arbors and closes the sector seams', () => {
  const model = createMovementModel(catalog.movements[222]);
  const { blocks, geometry } = model.root.userData;
  const frontFace = geometry.planeZs.at(-1) + geometry.sectorDepth / 2;
  assert.equal(blocks.hubCollars.length, 2);
  for (const [collar, assembly] of [
    [blocks.hubCollars[0], blocks.driverAssembly],
    [blocks.hubCollars[1], blocks.outputAssembly],
  ]) {
    assert.equal(collar.parent, assembly.userData.rotor);
    collar.geometry.computeBoundingBox();
    const box = collar.geometry.boundingBox;
    near(box.max.x, 0.5, 1e-6, 'collar radius');
    near(collar.position.z - (box.max.y - box.min.y) / 2, frontFace, 1e-6,
      'collar seated on the front sector face');
  }
  const laps = [];
  model.root.traverse((object) => {
    if (/web-lap-behind-front-sector$/.test(object.userData.role ?? '')) laps.push(object);
  });
  assert.ok(laps.length >= 6, 'every abutting pair of planes is lapped');
  for (const lap of laps) {
    const sector = lap.parent;
    lap.geometry.computeBoundingBox();
    const radius = Math.max(...[...Array(lap.geometry.attributes.position.count).keys()]
      .map((i) => Math.hypot(lap.geometry.attributes.position.getX(i), lap.geometry.attributes.position.getY(i))));
    assert.ok(radius < sector.userData.rootRadius, 'lap stays inside its own root circle');
  }
  disposeModel(model.root);
});
