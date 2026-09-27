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

test('movement 389 is an eccentric-strap lifting pawl, linear rack, and separate upper holding stop', () => {
  const movement = catalog.movements[388];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 389);
  assert.equal(movement.number, '389');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(
    movement.archetype,
    'eccentric-strap-lifting-pawl-linear-ratchet-rack-upper-holding-stop-jack',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /fixed-shaft-eccentric-disk/);
  assert.match(data.mechanism, /circular-strap-and-rigid-lifting-pawl/);
  assert.match(data.mechanism, /vertical-ratchet-rack/);
  assert.match(data.mechanism, /separate-upper-load-holding-stop-pawl/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.inputs[0], /eccentric-shaft angle/);
  assert.match(degreesOfFreedom.note, /one-pitch ratchet advance/);

  for (const component of [
    blocks.drivingNose,
    blocks.drivingPawl,
    blocks.eccentricRotor,
    blocks.eccentricShaftPin,
    blocks.frame,
    blocks.holdingPawl,
    blocks.rack,
  ]) assert.equal(component.parent, model.root);
  // Brown draws no white indices; the source presentation detaches them.
  for (const index of [
    blocks.driveContactMarker,
    blocks.stopContactMarker,
    blocks.eccentricIndex,
    blocks.rackLiftIndex,
    ...blocks.frameScaleTicks,
  ]) assert.equal(index.parent, null);
  assert.equal(blocks.eccentricDisk.parent, blocks.eccentricRotor);
  // Strap and curved lifting pawl are one forging.
  assert.equal(blocks.eccentricStrap, blocks.driveBody);
  assert.equal(blocks.driveBody.parent, blocks.drivingPawl);
  assert.equal(blocks.holdingPawlBody.parent, blocks.holdingPawl);
  assert.equal(blocks.holdingPivotPin.parent, blocks.holdingPawl);
  assert.equal(blocks.rackBody.parent, blocks.rack);
  assert.equal(blocks.rackSaddle.parent, blocks.rack);
  assert.equal(blocks.rackTeeth.length, 19);
  assert.equal(blocks.frameScaleTicks.length, 4);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  for (const role of [
    'vertically-guided-load-bearing-ratchet-rack',
    'one-way-vertical-rack-tooth',
    'jack-load-saddle',
    'fixed-cast-jack-frame-and-rack-guide',
    'continuously-rotating-eccentric-driver',
    'offset-eccentric-disk',
    'eccentric-strap-with-integral-curved-lifting-pawl',
    'rigid-eccentric-strap-lifting-pawl',
    'lifting-pawl-rack-working-nose',
    'upper-fixed-pivot-load-holding-stop-pawl',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 389 records that no official animation exists and separates evidence from reconstruction', () => {
  const movement = catalog.movements[388];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate389;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_389.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Lifting-jack/);
  assert.match(movement.description, /eccentric, pawl, and ratchet/);
  assert.match(movement.description, /upper pawl is a stop/);
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
  assert.equal(plate.measurementUncertaintyPixels, 3);
  assert.deepEqual(plate.eccentricShaftPixels, [287, 197]);
  assert.deepEqual(plate.eccentricOuterCenterPixels, [289, 211]);
  assert.equal(plate.eccentricOuterRadiusPixels, 35);
  assert.deepEqual(plate.drivePawlNosePixels, [243, 137.5]);
  assert.deepEqual(plate.holdingPawlPivotPixels, [276, 121]);
  assert.deepEqual(plate.holdingPawlNosePixels, [243, 91]);
  assert.equal(plate.rackToothPitchPixels, 16.4);
  assert.equal(plate.rackToothTipX, 255);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence, /vertically guided/);
  assert.match(evidence.engravingEvidence, /separately fixed-pivot/);
  assert.match(evidence.reconstructionDisclosure, /no official animation/);
  assert.match(evidence.reconstructionDisclosure, /independently engineered/);
  disposeModel(model.root);
});

test('movement 389 closes the rocking eccentric orbit, rigid strap pawl, and constructed ratchet stroke', () => {
  const model = createMovementModel(catalog.movements[388]);
  const data = model.root.userData;
  const { constraintResiduals, geometry, stateAtTime, timeline } = data;

  assert.ok(geometry.eccentricity > 0);
  assert.ok(geometry.engageFraction > 0 && geometry.engageFraction < 0.5);
  assert.ok(geometry.transferFraction > 0.5 && geometry.transferFraction < 1);
  near(geometry.followerHighY - geometry.followerLowY,
    geometry.toothPitch + geometry.seatingOvertravel + geometry.returnUndershoot, 1e-9, 'follower travel covers pitch, overtravel and undershoot');
  for (const [name, residual] of Object.entries(constraintResiduals)) {
    near(residual, 0, 1e-9, name);
  }
  // The strap never swings into the tooth tips.
  let minimumStrapClearance = Infinity;
  for (let sample = -3600; sample <= 7200; sample += 1) {
    const state = stateAtTime(timeline.cycleDuration * sample / 3600);
    vectorNear(
      state.camCenter,
      new THREE.Vector3(
        geometry.eccentricShaft.x + geometry.eccentricity * Math.sin(state.eccentricAngle),
        geometry.eccentricShaft.y - geometry.eccentricity * Math.cos(state.eccentricAngle),
        0,
      ),
      1e-12,
      'eccentric center orbit',
    );
    assert.ok(state.eccentricAngle >= geometry.rockStart - 1e-12 && state.eccentricAngle <= geometry.rockEnd + 1e-12);
    near(state.camCenter.distanceTo(geometry.eccentricShaft), geometry.eccentricity, 1e-12, 'constant eccentricity');
    near(state.drivePawlLength, geometry.drivePawlLength, 1e-12, 'rigid strap pawl length');
    assert.ok(state.driveClearance >= 0);
    minimumStrapClearance = Math.min(minimumStrapClearance,
      state.camCenter.x - geometry.eccentricStrapRadius - geometry.rootX - geometry.toothDepth);
  }
  assert.ok(minimumStrapClearance > 0.02, `strap clears the teeth: ${minimumStrapClearance}`);
  disposeModel(model.root);
});

test('movement 389 advances exactly one rack tooth on each of three eccentric strokes', () => {
  const model = createMovementModel(catalog.movements[388]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline } = data;

  for (let strokeIndex = 0; strokeIndex < geometry.liftStrokeCount; strokeIndex += 1) {
    const at = (u) => stateAtTime((strokeIndex + u) * timeline.strokeDuration);
    const start = at(0), peak = at(0.5), returnMiddle = at((geometry.transferFraction + 1) / 2), strokeEnd = at(1 - 1e-9);
    near(start.rackDisplacement, strokeIndex * geometry.toothPitch, 1e-12, `stroke ${strokeIndex} starts on stored pitch`);
    near(peak.rackDisplacement, (strokeIndex + 1) * geometry.toothPitch + geometry.seatingOvertravel, 1e-9,
      `stroke ${strokeIndex} power overtravel before seating`);
    near(returnMiddle.rackDisplacement, (strokeIndex + 1) * geometry.toothPitch, 1e-12, `stroke ${strokeIndex} rack held through return`);
    near(strokeEnd.rackDisplacement, (strokeIndex + 1) * geometry.toothPitch, 1e-12, `stroke ${strokeIndex} retained output`);
    assert.equal(peak.drivingEngaged, true);
    near(peak.drivingContactError, 0, 1e-12, `stroke ${strokeIndex} drive contact closure`);
    assert.equal(returnMiddle.drivingEngaged, false);
    assert.ok(returnMiddle.driveClearance > 0);
    assert.equal(returnMiddle.holdingEngaged, true);
    near(returnMiddle.holdingContactError, 0, 1e-12, `stroke ${strokeIndex} upper stop closure`);
    near(returnMiddle.holdingToothSeatY, geometry.stopSeatY, 1e-12, `stroke ${strokeIndex} next stop tooth at fixed seat`);
  }
  disposeModel(model.root);
});

test('movement 389 power contact is exact while the upper stop ratchets and then alone holds return load', () => {
  const model = createMovementModel(catalog.movements[388]);
  const data = model.root.userData;
  const { geometry, stateAtTime, timeline, transmission } = data;

  assert.match(transmission.driveFollowerLaw, /camCenter/);
  assert.match(transmission.holdingLaw, /alone prevents rack descent/);
  assert.match(transmission.indexingLaw, /exactly one additional pitch/);
  for (let strokeIndex = 0; strokeIndex < geometry.liftStrokeCount; strokeIndex += 1) {
    for (let sample = 1; sample < 2000; sample += 1) {
      const u = geometry.engageFraction + (0.5 - geometry.engageFraction) * sample / 2000;
      const state = stateAtTime((strokeIndex + u) * timeline.strokeDuration);
      assert.equal(state.drivingEngaged, true);
      near(state.driveClearance, 0, 0, 'driving nose seated laterally');
      near(state.drivingContactError, 0, 1e-12, 'driving nose on moving material tooth seat');
      near(state.driveNose.x, geometry.rackFaceX, 0, 'driving nose in the root');
      assert.ok(state.rackSpeed >= -1e-9);
      assert.ok(state.holdingAngle <= geometry.holdingBaseAngle + 1e-15);
    }
    for (let sample = 1; sample < 1000; sample += 1) {
      const u = geometry.transferFraction + (1 - geometry.transferFraction) * sample / 1000;
      const state = stateAtTime((strokeIndex + u) * timeline.strokeDuration);
      assert.equal(state.drivingEngaged, false);
      assert.equal(state.holdingEngaged, true);
      near(state.rackSpeed, 0, 0, 'held rack return speed');
      near(state.holdingContactError, 0, 1e-12, 'upper holding contact closure');
      assert.ok(state.driveClearance >= 0);
    }
  }
  disposeModel(model.root);
});

test('movement 389 lowers the rack by the lifting strokes reversed, never dropping it', () => {
  const model = createMovementModel(catalog.movements[388]);
  const data = model.root.userData;
  const { geometry, crankStateAtTime: stateAtTime, timeline, transmission } = data;
  const raised = stateAtTime(timeline.events.resetStarts);
  const lowered = stateAtTime(timeline.events.bottomDwellStarts);

  assert.match(timeline.note, /lowering strokes/);
  assert.match(transmission.resetLaw, /rocks the eccentric the other way/);
  near(timeline.resetDuration, timeline.operatingDuration, 0, 'lowering takes as long as lifting');
  near(raised.rackDisplacement,
    geometry.liftStrokeCount * geometry.toothPitch, 0,
    'raised lowering boundary');
  near(raised.rackSpeed, 0, 0, 'raised lowering boundary speed');
  // Every lowering pose mirrors a lifting pose, with speeds reversed.
  for (let sample = 1; sample < 400; sample += 1) {
    const offset = timeline.resetDuration * sample / 400;
    const down = stateAtTime(timeline.events.resetStarts + offset);
    const up = stateAtTime(timeline.operatingDuration - offset);
    near(down.rackDisplacement, up.rackDisplacement, 1e-12, 'mirrored rack');
    near(down.rackSpeed, -up.rackSpeed, 1e-12, 'reversed rack speed');
    near(down.eccentricAngle, up.eccentricAngle, 1e-12, 'mirrored eccentric');
    near(down.holdingAngle, up.holdingAngle, 1e-12, 'mirrored stop pawl');
    assert.equal(down.drivingEngaged || down.holdingEngaged
      || down.stage.includes('overtravel'), true, 'the rack is always carried by a pawl');
  }
  near(lowered.rackDisplacement, 0, 0, 'lower boundary');
  near(lowered.rackSpeed, 0, 0, 'lower boundary speed');
  disposeModel(model.root);
});

test('movement 389 renderer binds rack, eccentric, strap, both pawls, and contact states exactly', () => {
  const model = createMovementModel(catalog.movements[388]);
  const data = model.root.userData;
  const { blocks, stateAtTime, timeline } = data;
  const times = [
    0,
    timeline.strokeDuration * 0.23,
    timeline.strokeDuration * 0.78,
    timeline.strokeDuration * 1.31,
    timeline.events.raisedDwellStarts,
    timeline.events.resetStarts + timeline.resetDuration / 2,
    timeline.events.bottomDwellStarts,
    timeline.cycleDuration,
  ];

  for (const time of times) {
    model.update(time);
    const state = stateAtTime(time);
    near(blocks.rack.position.y, state.rackDisplacement, 0,
      'rendered rack position');
    near(blocks.eccentricRotor.rotation.z, state.eccentricRotorAngle, 0,
      'rendered eccentric rotation');
    vectorNear(
      new THREE.Vector3(
        blocks.drivingPawl.position.x,
        blocks.drivingPawl.position.y,
        0,
      ),
      state.camCenter,
      0,
      'rendered strap center',
    );
    vectorNear(blocks.drivingPawl.userData.endpoints.start,
      state.camCenter, 0, 'rendered driving-pawl strap end');
    vectorNear(blocks.drivingPawl.userData.endpoints.end,
      state.driveNose, 0, 'rendered driving-pawl nose end');
    near(blocks.drivingNose.position.x, state.driveNose.x, 0,
      'rendered drive nose x');
    near(blocks.drivingNose.position.y, state.driveNose.y, 0,
      'rendered drive nose y');
    near(blocks.holdingPawl.rotation.z, state.holdingAngle, 0,
      'rendered holding-pawl angle');
    assert.equal(blocks.driveContactMarker.visible, state.drivingEngaged);
    assert.equal(blocks.stopContactMarker.visible, state.holdingEngaged);
    assert.equal(data.contacts.drivingPawlToRack.active,
      state.drivingEngaged);
    assert.equal(data.contacts.upperStopToRack.active,
      state.holdingEngaged);
    assert.equal(data.contacts.drivingPawlToRack.contactError,
      state.drivingContactError);
    assert.equal(data.contacts.upperStopToRack.contactError,
      state.holdingContactError);
  }
  disposeModel(model.root);
});

test('movement 389 closes its disclosed demonstration before movement 507 remains authored', () => {
  const movement = catalog.movements[388];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { stateAtTime, timeline } = data;
  const start = stateAtTime(0);
  const end = stateAtTime(timeline.cycleDuration);

  near(end.rackDisplacement, start.rackDisplacement, 0,
    'cycle rack height');
  near(end.rackSpeed, start.rackSpeed, 0, 'cycle rack speed');
  near(end.eccentricRotorAngle, start.eccentricRotorAngle, 0,
    'cycle eccentric orientation');
  vectorNear(end.camCenter, start.camCenter, 0,
    'cycle strap center');
  vectorNear(end.driveNose, start.driveNose, 0,
    'cycle driving nose');
  near(end.holdingAngle, start.holdingAngle, 0,
    'cycle holding-pawl angle');

  model.update(0);
  const startRack = data.blocks.rack.position.y;
  const startRotor = data.blocks.eccentricRotor.rotation.z;
  model.update(timeline.cycleDuration);
  near(data.blocks.rack.position.y, startRack, 0,
    'rendered rack cycle closure');
  near(data.blocks.eccentricRotor.rotation.z, startRotor, 0,
    'rendered eccentric cycle closure');

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

test('movement 389 stop seats on Brown\'s tooth, three pitches above the lifting nose, in its own lane behind the strap', () => {
  const model = createMovementModel(catalog.movements[388]);
  const { blocks, geometry } = model.root.userData;
  assert.equal(geometry.stopBaseToothIndex, 3);
  near(geometry.stopSeatY - geometry.driveReferenceY, 3 * geometry.toothPitch, 1e-9, 'stop seat three pitches above');
  const zRange = (object) => {
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    return [box.min.z, box.max.z];
  };
  const [, stopFront] = zRange(blocks.holdingPawlBody);
  const [strapBack] = zRange(blocks.eccentricStrap);
  assert.ok(stopFront < strapBack - 0.03, `stop front ${stopFront} behind strap back ${strapBack}`);
  const pin = blocks.holdingPawl.children.find((child) => child.userData.role === 'upper-stop-pawl-fixed-pivot-pin');
  near(zRange(pin)[1], stopFront, 1e-6, 'stop pin ends flush with the stop face');
  const rackTeeth = zRange(blocks.rack);
  assert.ok(rackTeeth[0] <= zRange(blocks.holdingPawlBody)[0] + 1e-9, 'teeth span the stop lane');
  disposeModel(model.root);
});
