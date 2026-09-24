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

test('movement 390 is one rocking sector, exactly two distinct bands, two loose pawl pulleys, and two fast ratchets', () => {
  const movement = catalog.movements[389];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 390);
  assert.equal(movement.number, '390');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.archetype,
    'rocking-semicircular-sector-open-and-crossed-anchored-bands-dual-loose-pulley-ratchet-flywheel-rectifier',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-fulcrumed-semicircular-piece-A/);
  assert.match(data.mechanism, /C-open-and-D-crossed/);
  assert.match(data.mechanism, /two-coaxial-loose-pulley-pawl-carriers/);
  assert.match(data.mechanism, /two-ratchets-fast/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /semicircular piece A/);
  assert.match(degreesOfFreedom.note, /equal and opposite/);

  for (const component of [
    blocks.crossedBand,
    blocks.crossedCarrier,
    blocks.flywheelRotor,
    blocks.openBand,
    blocks.openCarrier,
    blocks.pivotPin,
    blocks.rockingSector,
  ]) assert.ok(component.parent === model.root, `${component.userData.role} parent`);
  assert.ok(blocks.frame.parent === null, 'source presentation removes frame');
  assert.ok(blocks.crossedRatchet.parent === blocks.flywheelRotor, 'blocks.crossedRatchet parent');
  assert.ok(blocks.openRatchet.parent === blocks.flywheelRotor, 'blocks.openRatchet parent');
  assert.ok(blocks.flywheelRim.parent === blocks.flywheelRotor, 'blocks.flywheelRim parent');
  // Brown draws no white indices or band markers; the presentation detaches them.
  assert.ok(blocks.flywheelIndex.parent === null, 'flywheel index removed');
  assert.ok(blocks.crossedPawl.parent === blocks.crossedCarrier, 'blocks.crossedPawl parent');
  assert.ok(blocks.openPawl.parent === blocks.openCarrier, 'blocks.openPawl parent');
  assert.ok(blocks.sectorArc.parent === blocks.rockingSector, 'blocks.sectorArc parent');
  assert.ok(blocks.topLever.parent === blocks.rockingSector, 'blocks.topLever parent');
  assert.equal(blocks.anchorKnots.length, 4);
  assert.equal(blocks.openBandMarkers.length, 6);
  assert.equal(blocks.crossedBandMarkers.length, 6);
  for (const marker of [...blocks.openBandMarkers, ...blocks.crossedBandMarkers]) {
    assert.ok(marker.parent === null, 'band marker removed');
  }

  const belts = [];
  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.role) roles.push(object.userData.role);
  });
  assert.deepEqual(belts, [blocks.openBand, blocks.crossedBand]);
  assert.equal(blocks.openBand.userData.closed, false);
  assert.equal(blocks.crossedBand.userData.closed, false);
  assert.notEqual(
    data.geometry.openPlaneZ,
    data.geometry.crossedPlaneZ,
  );
  for (const role of [
    'fulcrumed-semicircular-piece-A-and-lever',
    'one-open-uncrossed-band-C',
    'one-crossed-band-D-with-axial-crossover',
    'open-band-C-loose-pulley-carrier',
    'crossed-band-D-loose-pulley-carrier',
    'open-band-ratchet-wheel-fast-on-flywheel-shaft',
    'crossed-band-ratchet-wheel-fast-on-flywheel-shaft',
    'continuous-one-direction-flywheel-B-shaft',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => /^white-/.test(role)), 'no white indices remain');
  disposeModel(model.root);
});

test('movement 390 preserves Brown topology while explicitly recording unavailable source animation', () => {
  const movement = catalog.movements[389];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate390;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_390.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /oscillating into rotary motion/);
  assert.match(movement.description, /Band, C, is open/);
  assert.match(movement.description, /band, D, crossed/i);
  assert.match(movement.description, /pulleys, loose on the shaft/);
  assert.match(movement.description, /continuous rotary motion/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /no canvas animation/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(dynamics.idealizations.length, 5);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 9);
  assert.deepEqual(plate.fulcrumAPixels, [253, 94]);
  assert.deepEqual(plate.flywheelCenterPixels, [260, 329]);
  assert.equal(plate.flywheelOuterRadiusPixels, 132);
  assert.deepEqual(plate.openBandLabelPixels, [346, 294]);
  assert.deepEqual(plate.crossedBandLabelPixels, [231, 258]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence, /two superposed band paths/);
  assert.match(evidence.reconstructionDisclosure, /no official animation/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 390 keeps both compensated anchored bands exactly constant length with smooth pulley tangencies', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, stateAtTime, timeline,
    transmission } = data;

  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 4e-16, name);
  }
  assert.match(transmission.bandLengthLaw, /base\+alpha/);
  assert.match(transmission.bandLengthLaw, /sum is constant/);
  for (let sample = -3600; sample <= 7200; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 3600);
    near(state.openCurve.getLength(), geometry.openBandLength, 2e-15,
      'open band constant length');
    near(state.crossedCurve.getLength(), geometry.crossedBandLength,
      2e-15, 'crossed band constant length');
    near(
      state.openCurve.userData.firstWrapAngle
        + state.openCurve.userData.secondWrapAngle,
      2 * geometry.upperBaseWrap,
      3e-16,
      'open compensated upper wraps',
    );
    near(
      state.crossedCurve.userData.firstWrapAngle
        + state.crossedCurve.userData.secondWrapAngle,
      2 * geometry.upperBaseWrap,
      3e-16,
      'crossed compensated upper wraps',
    );
    assert.ok(state.openCurve.userData.firstWrapAngle > 0);
    assert.ok(state.openCurve.userData.secondWrapAngle > 0);
    for (const dot of [
      ...state.openCurve.userData.joinTangentDots,
      ...state.crossedCurve.userData.joinTangentDots,
    ]) near(dot, 1, 3e-15, 'band segment tangent continuity');
  }
  disposeModel(model.root);
});

test('movement 390 crossed spans have opposite axial lifts while open spans remain planar', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;

  for (const phase of [0, 0.13, 0.25, 0.49, 0.75, 0.93]) {
    const state = stateAtTime(timeline.cycleDuration * phase);
    const openFirstSpan = state.openCurve.curves[1];
    const openSecondSpan = state.openCurve.curves[3];
    const crossedFirstSpan = state.crossedCurve.curves[1];
    const crossedSecondSpan = state.crossedCurve.curves[3];
    near(openFirstSpan.getPoint(0.5).z, geometry.openPlaneZ, 0,
      'open first span remains planar');
    near(openSecondSpan.getPoint(0.5).z, geometry.openPlaneZ, 0,
      'open second span remains planar');
    assert.ok(crossedFirstSpan.getPoint(0.5).z
      > geometry.crossedPlaneZ);
    assert.ok(crossedSecondSpan.getPoint(0.5).z
      < geometry.crossedPlaneZ);
    near(
      crossedFirstSpan.getPoint(0.5).z - geometry.crossedPlaneZ,
      geometry.crossedPlaneZ - crossedSecondSpan.getPoint(0.5).z,
      3e-16,
      'opposed equal crossover lifts',
    );
  }
  disposeModel(model.root);
});

test('movement 390 open and crossed loose pulleys obey exact equal-magnitude opposite direction ratios', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;

  assert.match(transmission.beltDirectionLaw, /theta_C/);
  assert.match(transmission.beltDirectionLaw, /theta_D/);
  for (let sample = -7200; sample <= 14400; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 7200);
    near(state.openPulleyAngle,
      geometry.pulleyRatio * state.rockerAngle, 0,
      'open pulley angle ratio');
    near(state.crossedPulleyAngle,
      -geometry.pulleyRatio * state.rockerAngle, 0,
      'crossed pulley angle ratio');
    near(state.openPulleyAngle + state.crossedPulleyAngle, 0, 0,
      'opposed loose-pulley angles');
    near(state.openPulleyAngularSpeed,
      geometry.pulleyRatio * state.rockerAngularSpeed, 0,
      'open pulley speed ratio');
    near(state.crossedPulleyAngularSpeed,
      -geometry.pulleyRatio * state.rockerAngularSpeed, 0,
      'crossed pulley speed ratio');
    near(state.openBandMaterialTravel,
      geometry.sectorRadius * state.rockerAngle, 0,
      'open material payout');
    near(state.crossedBandMaterialTravel,
      -geometry.sectorRadius * state.rockerAngle, 0,
      'crossed material payout');
  }
  disposeModel(model.root);
});

test('movement 390 takes up finite pawl overtravel and rectifies one oscillation into one positive flywheel turn', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;
  assert.match(transmission.outputLaw, /abs/);
  assert.match(transmission.pawlLaw, /positive angular speed/);
  near(geometry.outputAdvancePerCycle, Math.PI * 2, 0,
    'one-turn output closure');

  let previousAngle = -Infinity;
  for (let sample = 0; sample < 20000; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 20000);
    assert.ok(state.flywheelAngle >= previousAngle - 2e-15);
    assert.ok(state.flywheelAngularSpeed >= 0);
    near(state.flywheelAngularSpeed,
      state.openPawl.active || state.crossedPawl.active
        ? geometry.pulleyRatio * Math.abs(state.rockerAngularSpeed) : 0, 2e-15,
      'engaged speed or finite take-up dwell');
    if (state.openPawl.active) {
      near(state.openPawl.contactError, 0, 2e-15,
        'open driving pawl tooth closure');
    }
    if (state.crossedPawl.active) {
      near(state.crossedPawl.contactError, 0, 2e-15,
        'crossed driving pawl tooth closure');
    }
    previousAngle = state.flywheelAngle;
  }

  for (const [event, active] of [
    [timeline.events.crossedPawlTakesDrive, 'crossedPawl'],
    [timeline.events.openPawlRetakesDrive, 'openPawl'],
  ]) {
    const before = stateAtTime(event - 1e-7);
    const after = stateAtTime(event + 1e-7);
    assert.equal(before.flywheelAngularSpeed, 0, 'output waits for physical take-up');
    assert.equal(after[active].active, true);
    near(after[active].contactError, 0, 2e-15, 'new pawl locks at its tooth phase');
    near(before.flywheelAngle, after.flywheelAngle, 1e-6, 'pickup position is continuous');
  }
  assert.ok(timeline.events.crossedPawlTakesDrive > timeline.events.crossedCarrierReverses);
  assert.ok(timeline.events.openPawlRetakesDrive > timeline.events.openCarrierReverses);
  disposeModel(model.root);
});

test('movement 390 renderer binds both belt curves and markers, both carriers, both pawls, and flywheel exactly', () => {
  const model = createMovementModel(catalog.movements[389]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;
  const times = [
    0,
    timeline.cycleDuration * 0.11,
    timeline.cycleDuration * 0.25,
    timeline.cycleDuration * 0.42,
    timeline.cycleDuration * 0.68,
    timeline.cycleDuration * 0.75,
    timeline.cycleDuration * 0.91,
    timeline.cycleDuration,
  ];

  for (const time of times) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(blocks.rockingSector.rotation.z, state.rockerAngle, 0,
      'rendered sector angle');
    near(blocks.openCarrier.rotation.z, state.openPulleyAngle, 0,
      'rendered open carrier angle');
    near(blocks.crossedCarrier.rotation.z, state.crossedPulleyAngle, 0,
      'rendered crossed carrier angle');
    near(blocks.flywheelRotor.rotation.z, state.flywheelAngle, 0,
      'rendered flywheel angle');
    assert.equal(blocks.openPawlContactIndex.visible,
      state.openPawl.active);
    assert.equal(blocks.crossedPawlContactIndex.visible,
      state.crossedPawl.active);
    assert.equal(data.contacts.openPawlToFastRatchet.active,
      state.openPawl.active);
    assert.equal(data.contacts.crossedPawlToFastRatchet.active,
      state.crossedPawl.active);
    near(blocks.openBand.userData.length,
      state.openCurve.getLength(), 0,
      'rendered open curve length');
    near(blocks.crossedBand.userData.length,
      state.crossedCurve.getLength(), 0,
      'rendered crossed curve length');

    const openAnchorWorld = blocks.anchorKnots[0].getWorldPosition(
      new THREE.Vector3(),
    );
    const openOtherWorld = blocks.anchorKnots[1].getWorldPosition(
      new THREE.Vector3(),
    );
    const crossedAnchorWorld = blocks.anchorKnots[2].getWorldPosition(
      new THREE.Vector3(),
    );
    const crossedOtherWorld = blocks.anchorKnots[3].getWorldPosition(
      new THREE.Vector3(),
    );
    vectorNear(state.openCurve.getPointAt(0), openAnchorWorld, 8e-16,
      'open band first fixed end');
    vectorNear(state.openCurve.getPointAt(1), openOtherWorld, 8e-16,
      'open band second fixed end');
    vectorNear(state.crossedCurve.getPointAt(0), crossedAnchorWorld,
      8e-16, 'crossed band first fixed end');
    vectorNear(state.crossedCurve.getPointAt(1), crossedOtherWorld,
      8e-16, 'crossed band second fixed end');

    for (let index = 0; index < blocks.openBandMarkers.length;
      index += 1) {
      const basePhase = (index + 1)
        / (blocks.openBandMarkers.length + 1);
      const phase = THREE.MathUtils.clamp(
        state.openBandMaterialTravel / state.openCurve.getLength()
          + basePhase,
        0,
        1,
      );
      vectorNear(blocks.openBandMarkers[index].position,
        state.openCurve.getPointAt(phase), 4e-15,
        `open band material marker ${index}`);
    }
  }
  disposeModel(model.root);
});

test('movement 390 closes one full oscillation and positive output turn before movement 507 remains authored', () => {
  const movement = catalog.movements[389];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleDuration);

  near(end.rockerAngle, start.rockerAngle, 0,
    'cycle rocker angle');
  near(end.openPulleyAngle, start.openPulleyAngle, 0,
    'cycle open carrier angle');
  near(end.crossedPulleyAngle, start.crossedPulleyAngle, 0,
    'cycle crossed carrier angle');
  near(end.flywheelAngle, start.flywheelAngle, 0,
    'represented flywheel orientation');
  near(end.openCurve.getLength(), start.openCurve.getLength(), 0,
    'cycle open band geometry');
  near(end.crossedCurve.getLength(), start.crossedCurve.getLength(), 0,
    'cycle crossed band geometry');

  model.update(0);
  const startFlywheel = data.blocks.flywheelRotor.rotation.z;
  model.update(timeline.cycleDuration);
  near(data.blocks.flywheelRotor.rotation.z, startFlywheel, 0,
    'rendered flywheel cycle closure');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, movement.archetype);
  disposeModel(model507.root);
  disposeModel(model.root);
});
