import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

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
    } else if (object.material) {
      materials.add(object.material);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

test('movement 271 is one translating ratchet bar driven by two alternating pawls', () => {
  const movement = catalog.movements[270];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
  } = model.root.userData;

  assert.equal(movement.id, 271);
  assert.equal(movement.number, '271');
  assert.equal(movement.title,
    'Alternating-Pawl Nearly Continuous Ratchet Bar');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'opposed-lever-pivots-alternating-pawls-nearly-continuous-left-moving-ratchet-bar',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one-vibrating-three-pin-lever/);
  assert.match(mechanism, /long-upper-pawl-pulls/);
  assert.match(mechanism, /short-lower-pawl-pulls/);
  assert.match(mechanism, /one-pitch/);
  assert.equal(blocks.rack.parent, model.root);
  assert.equal(blocks.rackBody.parent, blocks.rack);
  assert.equal(blocks.rackTeeth.parent, blocks.rack);
  assert.ok(blocks.rackIndexes.every((index) => index.parent === blocks.rack));
  assert.equal(blocks.lever.parent, model.root);
  assert.equal(blocks.leverRotor.parent, blocks.lever);
  assert.equal(blocks.leverBody.parent, blocks.leverRotor);
  assert.ok(blocks.leverPins.every((pin) => pin.parent === blocks.leverRotor));
  assert.equal(blocks.leverPins.length, 3);
  assert.equal(blocks.fixedFulcrum.parent, model.root);
  assert.equal(blocks.longPawl.parent, model.root);
  assert.equal(blocks.shortPawl.parent, model.root);
  assert.notEqual(blocks.longPawl, blocks.shortPawl);

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => /alternating-pull-pawl$/.test(role)).length, 2);
  assert.equal(roles.filter((role) => role === 'left-moving-asymmetric-ratchet-bar').length, 1);
  assert.equal(roles.filter((role) => role === 'fixed-middle-fulcrum-pin').length, 1);
  assert.equal(roles.filter((role) => /belt|pulley|ratchet-wheel/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 271 records the unavailable animation and measured engraving topology', () => {
  const model = createMovementModel(catalog.movements[270]);
  const {
    geometry,
    sourceAnimation,
    sourceReference,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const plate = sourceReference.plate271;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /animation unavailable/);
  assert.match(sourceAnimation.reason, /inferred/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[270].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 6);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterFulcrum, { x: 432, y: 246 });
  assert.deepEqual(plate.rasterHandleEnd, { x: 516, y: 181 });
  assert.deepEqual(plate.rasterLongPawl, {
    anchor: { x: 417, y: 228 },
    nose: { x: 202, y: 284 },
  });
  assert.deepEqual(plate.rasterShortPawl, {
    anchor: { x: 440, y: 267 },
    nose: { x: 286, y: 284 },
  });
  assert.deepEqual(plate.rasterRack, {
    approximateToothCount: 18,
    pitchPixels: 14,
    rootY: 300,
    tipY: 284,
  });
  assert.match(plate.inferredTopology, /fixed middle fulcrum/);
  assert.match(plate.inferredTopology, /long upper pawl/);
  assert.match(plate.inferredTopology, /short lower pawl/);
  assert.match(plate.inferredDirection, /leftward rack travel/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 69,
    edition: 21,
    illustrationPage: 68,
    publicationYear: 1908,
  });

  const sourcePoint = ({ x, y }) => new THREE.Vector2(
    (x - plate.rasterFulcrum.x) * plate.sourceScale,
    (plate.rasterFulcrum.y - y) * plate.sourceScale,
  );
  const sourceState = stateAtCycleCoordinate(0.5);
  vectorNear(sourceState.longAnchor,
    sourcePoint(plate.rasterLongPawl.anchor), 3e-16,
    'source long-pawl anchor');
  vectorNear(sourceState.longTip,
    sourcePoint(plate.rasterLongPawl.nose), 3e-15,
    'source long-pawl nose');
  vectorNear(sourceState.shortTip,
    sourcePoint(plate.rasterShortPawl.nose), 3e-15,
    'source short-pawl nose');
  assert.ok(
    sourceState.shortAnchor.distanceTo(
      sourcePoint(plate.rasterShortPawl.anchor),
    ) / plate.sourceScale < plate.measurementUncertaintyPixels,
    'pitch closure adjustment remains inside the measured uncertainty',
  );
  vectorNear(
    geometry.handleEndLocal.clone().rotateAround(
      new THREE.Vector2(),
      geometry.leverAmplitude,
    ),
    sourcePoint(plate.rasterHandleEnd),
    3e-16,
    'source handle end',
  );
  disposeModel(model.root);
});

test('movement 271 reconstructs one regular asymmetric rack and exact tooth registrations', () => {
  const model = createMovementModel(catalog.movements[270]);
  const {
    blocks,
    geometry,
    sourceReference,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;
  const plate = sourceReference.plate271;
  const faces = blocks.rackTeeth.userData.driveFaces;

  near(geometry.rackPitch,
    plate.rasterRack.pitchPixels * plate.sourceScale, 0,
    'rack pitch');
  near(geometry.toothHeight,
    (plate.rasterRack.rootY - plate.rasterRack.tipY) * plate.sourceScale,
    2e-16, 'rack tooth height');
  assert.equal(blocks.rackTeeth.userData.profile,
    'rising-return-ramp-and-vertical-left-pulling-face');
  assert.equal(faces.length, 31);
  assert.equal(faces[0].faceIndex, -13);
  assert.equal(faces.at(-1).faceIndex, 17);
  for (let index = 0; index < faces.length; index += 1) {
    const face = faces[index];
    near(face.root.x,
      geometry.baseFace + face.faceIndex * geometry.rackPitch,
      0, `drive face ${face.faceIndex} x`);
    near(face.root.y, geometry.toothRootY, 0,
      `drive face ${face.faceIndex} root`);
    near(face.tip.y, geometry.toothTipY, 0,
      `drive face ${face.faceIndex} tip`);
    if (index > 0) {
      near(face.root.x - faces[index - 1].root.x,
        geometry.rackPitch, 7e-16,
        `drive face ${face.faceIndex} pitch`);
    }
  }
  assert.equal(geometry.shortFaceOffset, 6);
  near(
    geometry.shortStartTipX - geometry.longEndTipX,
    geometry.shortFaceOffset * geometry.rackPitch,
    2e-16,
    'source-pose pawl separation is six pitches',
  );
  near(
    geometry.longStartTipX - geometry.longEndTipX,
    geometry.rackPitch,
    3e-16,
    'long-pawl drive advances one pitch',
  );
  near(
    geometry.shortStartTipX - geometry.shortEndTipX,
    geometry.rackPitch,
    3e-16,
    'short-pawl drive advances one pitch',
  );
  near(stateAtCycleCoordinate(0).barDisplacement, 0, 0,
    'cycle start bar position');
  near(stateAtCycleCoordinate(0.5).barDisplacement,
    -geometry.rackPitch, 3e-16, 'first handoff bar position');
  near(stateAtCycleCoordinate(1).barDisplacement,
    -2 * geometry.rackPitch, 0, 'cycle end bar position');
  assert.equal(transmission.advancePerHalfStroke, geometry.rackPitch);
  assert.equal(transmission.advancePerLeverVibration, 2 * geometry.rackPitch);
  assert.equal(transmission.toothPitchesPerLeverVibration, 2);
  assert.equal(transmission.periodicRenderWrap, 2 * geometry.rackPitch);
  for (let index = 1; index < blocks.rackIndexes.length; index += 1) {
    near(
      blocks.rackIndexes[index].position.x
        - blocks.rackIndexes[index - 1].position.x,
      2 * geometry.rackPitch,
      1e-15,
      `periodic bar index spacing ${index}`,
    );
  }
  disposeModel(model.root);
});

test('movement 271 keeps both pawls rigid on opposite lever sides', () => {
  const model = createMovementModel(catalog.movements[270]);
  const {
    geometry,
    stateAtCycleCoordinate,
  } = model.root.userData;
  const source = stateAtCycleCoordinate(0.5);
  const start = stateAtCycleCoordinate(0);
  const end = stateAtCycleCoordinate(1);

  near(THREE.MathUtils.radToDeg(geometry.leverAmplitude),
    16.900170160832563, 2e-14, 'lever amplitude');
  assert.ok(geometry.longAnchorLocal.y > 0,
    'long-pawl pin lies above the fulcrum');
  assert.ok(geometry.shortAnchorLocal.y < 0,
    'short-pawl pin lies below the fulcrum');
  assert.ok(start.longAnchor.x > source.longAnchor.x,
    'long-pawl anchor travels left during its drive');
  assert.ok(end.shortAnchor.x < source.shortAnchor.x,
    'short-pawl anchor travels left during its drive');
  near(start.longAnchor.length(), geometry.longAnchorLocal.length(),
    2e-16, 'long anchor radius at start');
  near(source.longAnchor.length(), geometry.longAnchorLocal.length(),
    2e-16, 'long anchor radius at source');
  near(end.shortAnchor.length(), geometry.shortAnchorLocal.length(),
    2e-16, 'short anchor radius at end');
  near(source.shortAnchor.length(), geometry.shortAnchorLocal.length(),
    2e-16, 'short anchor radius at source');

  for (let sample = 0; sample <= 2400; sample += 1) {
    const state = stateAtCycleCoordinate(sample / 2400);
    near(state.longAnchor.distanceTo(state.longTip),
      geometry.longPawlLength, 1.4e-15,
      `long pawl length at sample ${sample}`);
    near(state.shortAnchor.distanceTo(state.shortTip),
      geometry.shortPawlLength, 1.4e-15,
      `short pawl length at sample ${sample}`);
    assert.ok(state.longPawlLengthError < 9e-16);
    assert.ok(state.shortPawlLengthError < 9e-16);
  }
  disposeModel(model.root);
});

test('movement 271 exhaustively advances left on alternating half-strokes without a dwell interval', () => {
  const model = createMovementModel(catalog.movements[270]);
  const {
    geometry,
    stateAtCycleCoordinate,
    transmission,
  } = model.root.userData;
  let previous = stateAtCycleCoordinate(0);
  let maximumStep = 0;
  let minimumInteriorResetClearance = Infinity;
  const activePawls = new Set();
  const stages = new Set();

  for (let sample = 1; sample <= 12000; sample += 1) {
    const coordinate = sample / 12000;
    const state = stateAtCycleCoordinate(coordinate);
    const step = state.barDisplacement - previous.barDisplacement;
    maximumStep = Math.max(maximumStep, step);
    assert.ok(step <= 2e-15,
      `bar never reverses at sample ${sample}`);
    assert.ok(state.barSpeed <= 3e-15,
      `bar velocity stays leftward at sample ${sample}`);
    assert.equal(state.longDriving, !state.shortDriving);
    assert.equal(state.drivingContactCount, 1);
    assert.ok(state.activePawlContactError < 2e-15);
    assert.ok(state.activePawlLengthError < 9e-16);
    assert.equal(state.activePawl,
      state.longDriving ? 'long-upper' : 'short-lower');
    assert.equal(state.activeFaceIndex,
      state.longDriving
        ? state.cycleIndex * 2
        : 6 + state.cycleIndex * 2);
    activePawls.add(state.activePawl);
    stages.add(state.stage);
    if (!state.longDriving) {
      assert.ok(state.longResetClearance >= -2e-16);
      if (state.longResetFraction > 0 && state.longResetFraction < 1) {
        minimumInteriorResetClearance = Math.min(
          minimumInteriorResetClearance,
          state.longResetClearance,
        );
      }
    }
    if (!state.shortDriving) {
      assert.ok(state.shortResetClearance >= -2e-16);
      if (state.shortResetFraction > 0 && state.shortResetFraction < 1) {
        minimumInteriorResetClearance = Math.min(
          minimumInteriorResetClearance,
          state.shortResetClearance,
        );
      }
    }
    previous = state;
  }
  assert.ok(maximumStep <= 2e-15);
  assert.ok(minimumInteriorResetClearance > 0);
  assert.deepEqual(activePawls,
    new Set(['long-upper', 'short-lower']));
  assert.deepEqual(stages, new Set([
    'long-upper-pawl-pulls-left-short-lower-pawl-resets',
    'short-lower-pawl-pulls-left-long-upper-pawl-resets',
  ]));
  assert.equal(transmission.dwellIntervalsPerCycle, 0);
  assert.equal(transmission.instantaneousHandoffsPerCycle, 2);
  assert.deepEqual(transmission.driveSequence, [
    'long-upper-pawl-pulls-left',
    'short-lower-pawl-pulls-left',
  ]);
  near(stateAtCycleCoordinate(0).barSpeed, 0, 2e-17,
    'first handoff instantaneous speed');
  near(stateAtCycleCoordinate(0.5).barSpeed, 0, 2e-17,
    'second handoff instantaneous speed');
  assert.ok(stateAtCycleCoordinate(0.25).barSpeed < -0.15);
  assert.ok(stateAtCycleCoordinate(0.75).barSpeed < -0.15);
  near(-stateAtCycleCoordinate(1).barDisplacement,
    2 * geometry.rackPitch, 0, 'full-vibration advance');
  disposeModel(model.root);
});

test('movement 271 analytic lever, bar, pawl, and tip rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[270]);
  const {
    stateAtCycleCoordinate,
    timeline,
  } = model.root.userData;
  const timeStep = 1e-5;
  const coordinateStep = timeStep * timeline.cyclesPerSecond;

  for (const coordinate of [0.09, 0.21, 0.37, 0.63, 0.79, 0.91]) {
    const before = stateAtCycleCoordinate(coordinate - coordinateStep);
    const state = stateAtCycleCoordinate(coordinate);
    const after = stateAtCycleCoordinate(coordinate + coordinateStep);
    const derivative = (key) => (
      (after[key] - before[key]) / (2 * timeStep)
    );
    const vectorDerivative = (key) => after[key].clone()
      .sub(before[key]).multiplyScalar(1 / (2 * timeStep));

    near(derivative('leverAngle'), state.leverAngularSpeed, 2e-11,
      `lever speed at ${coordinate}`);
    near(derivative('barDisplacement'), state.barSpeed, 4e-11,
      `bar speed at ${coordinate}`);
    near(
      (after.barSpeed - before.barSpeed) / (2 * timeStep),
      state.barAcceleration,
      3e-9,
      `bar acceleration at ${coordinate}`,
    );
    vectorNear(vectorDerivative('longAnchor'), state.longAnchorVelocity,
      3e-11, `long-anchor velocity at ${coordinate}`);
    vectorNear(vectorDerivative('shortAnchor'), state.shortAnchorVelocity,
      3e-11, `short-anchor velocity at ${coordinate}`);
    vectorNear(vectorDerivative('longTip'), state.longTipVelocity,
      5e-10, `long-tip velocity at ${coordinate}`);
    vectorNear(vectorDerivative('shortTip'), state.shortTipVelocity,
      5e-10, `short-tip velocity at ${coordinate}`);
    near(derivative('longPawlAngle'), state.longPawlAngularSpeed, 2e-10,
      `long-pawl speed at ${coordinate}`);
    near(derivative('shortPawlAngle'), state.shortPawlAngularSpeed, 2e-10,
      `short-pawl speed at ${coordinate}`);
  }

  for (const boundary of [0, 0.5, 1]) {
    const before = stateAtCycleCoordinate(boundary - 1e-8);
    const at = stateAtCycleCoordinate(boundary);
    const after = stateAtCycleCoordinate(boundary + 1e-8);
    near(before.barDisplacement, at.barDisplacement, 2e-15,
      `bar position before handoff ${boundary}`);
    near(after.barDisplacement, at.barDisplacement, 2e-15,
      `bar position after handoff ${boundary}`);
    near(at.barSpeed, 0, 3e-17,
      `zero-speed handoff ${boundary}`);
    assert.equal(at.instantaneousDwell, true);
  }
  disposeModel(model.root);
});

test('movement 271 renderer binds the rack, lever, alternating contacts, and periodic indexes', () => {
  const model = createMovementModel(catalog.movements[270]);
  const {
    blocks,
    cameraFitBounds,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const phases = [0, 0.18, 0.49, 0.5, 0.72, 0.99, 1.25];

  assert.ok(cameraFitBounds.isBox3);
  assert.ok(cameraFitBounds.min.x < -6);
  assert.ok(cameraFitBounds.max.x > 1.5);
  for (const phase of phases) {
    const time = (phase - timeline.sourceCyclePhase)
      / timeline.cyclesPerSecond;
    const state = stateAtTime(time);
    model.update(time, 0.016);
    near(blocks.rack.position.x, state.renderedBarDisplacement, 0,
      `rendered rack at phase ${phase}`);
    near(blocks.leverRotor.rotation.z, state.leverAngle, 0,
      `rendered lever at phase ${phase}`);
    near(blocks.longPawl.position.x, state.longAnchor.x, 0,
      `long-pawl anchor x at phase ${phase}`);
    near(blocks.longPawl.position.y, state.longAnchor.y, 0,
      `long-pawl anchor y at phase ${phase}`);
    near(blocks.longPawl.rotation.z, state.longPawlAngle, 0,
      `long-pawl angle at phase ${phase}`);
    near(blocks.shortPawl.position.x, state.shortAnchor.x, 0,
      `short-pawl anchor x at phase ${phase}`);
    near(blocks.shortPawl.position.y, state.shortAnchor.y, 0,
      `short-pawl anchor y at phase ${phase}`);
    near(blocks.shortPawl.rotation.z, state.shortPawlAngle, 0,
      `short-pawl angle at phase ${phase}`);
    assert.equal(blocks.longContactMarker.visible, state.longDriving);
    assert.equal(blocks.shortContactMarker.visible, state.shortDriving);
    assert.equal(
      model.root.userData.contacts.activePawlToRatchetBar.pawl,
      state.activePawl,
    );
    assert.equal(
      model.root.userData.contacts.activePawlToRatchetBar.faceIndex,
      state.activeFaceIndex,
    );
    assert.equal(
      model.root.userData.contacts.activePawlToRatchetBar
        .simultaneousDriving,
      false,
    );
    model.root.updateMatrixWorld(true);
    const longNose = blocks.longPawl.userData.nose.getWorldPosition(
      new THREE.Vector3(),
    );
    const shortNose = blocks.shortPawl.userData.nose.getWorldPosition(
      new THREE.Vector3(),
    );
    vectorNear(new THREE.Vector2(longNose.x, longNose.y),
      state.longTip, 1.3e-15, `rendered long nose at phase ${phase}`);
    vectorNear(new THREE.Vector2(shortNose.x, shortNose.y),
      state.shortTip, 1e-15, `rendered short nose at phase ${phase}`);
  }
  assert.equal(model.cameraDirection.z > model.cameraDirection.x, true);
  assert.equal(model.cameraDirection.z > model.cameraDirection.y, true);
  disposeModel(model.root);
});

test('movement 271 closes visibly after two pitches and leaves movement 507 authored', () => {
  const movement = catalog.movements[270];
  const model = createMovementModel(movement);
  const {
    animationTiming,
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const source = stateAtTime(0);
  const closure = stateAtTime(timeline.demonstrationPeriod);

  near(closure.barDisplacement - source.barDisplacement,
    -2 * geometry.rackPitch, 5e-16,
    'physical bar advance over one vibration');
  near(closure.renderedBarDisplacement,
    source.renderedBarDisplacement, 5e-16,
    'periodic rendered bar closure');
  near(closure.leverAngle, source.leverAngle, 3e-16,
    'lever closure');
  vectorNear(closure.longAnchor, source.longAnchor, 3e-16,
    'long-anchor closure');
  vectorNear(closure.shortAnchor, source.shortAnchor, 3e-16,
    'short-anchor closure');
  vectorNear(closure.longTip, source.longTip, 3e-15,
    'long-tip closure');
  vectorNear(closure.shortTip, source.shortTip, 3e-15,
    'short-tip closure');
  assert.equal(closure.activeFaceIndex, source.activeFaceIndex + 2);
  assert.equal(timeline.demonstrationPeriod, 5);
  assert.equal(animationTiming.authoredCyclePeriod, 5);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);

  model.update(0, 0.016);
  const sourceTransforms = {
    lever: blocks.leverRotor.rotation.z,
    long: blocks.longPawl.rotation.z,
    rack: blocks.rack.position.x,
    short: blocks.shortPawl.rotation.z,
  };
  model.update(timeline.demonstrationPeriod, 0.016);
  near(blocks.leverRotor.rotation.z, sourceTransforms.lever, 3e-16,
    'rendered lever closure');
  near(blocks.longPawl.rotation.z, sourceTransforms.long, 3e-16,
    'rendered long-pawl closure');
  near(blocks.shortPawl.rotation.z, sourceTransforms.short, 3e-16,
    'rendered short-pawl closure');
  near(blocks.rack.position.x, sourceTransforms.rack, 5e-16,
    'rendered rack closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
