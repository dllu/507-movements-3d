import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));

const ARCHETYPE =
  'pivoted-bell-hammer-with-preloaded-under-lever-return-leaf-spring-and-clear-ring-dwell';

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function sameAngle(actual, expected, tolerance, message) {
  near(Math.sin(actual), Math.sin(expected), tolerance, `${message} sine`);
  near(Math.cos(actual), Math.cos(expected), tolerance, `${message} cosine`);
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

test('movement 420 is one pivoted external hammer, one under-lever return spring, and one separately supported bell', () => {
  const movement = catalog.movements[419];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 420);
  assert.equal(movement.number, '420');
  assert.equal(movement.category, 'Springs & balances');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.archetype, ARCHETYPE);
  assert.equal(data.fidelity, 'authored');
  assert.match(data.mechanism, /rigid external hammer pivots/);
  assert.match(data.mechanism, /preloaded leaf spring under/);
  assert.match(data.mechanism, /cord goes slack and the hammer falls by its own weight/);
  assert.match(data.mechanism, /immediately lifts it back/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.operatingDegreesOfFreedom, 1);
  assert.equal(degreesOfFreedom.hammerAngleIndependent, false);
  assert.equal(degreesOfFreedom.springDeflectionIndependent, false);
  assert.equal(degreesOfFreedom.bellStructuralModesRepresented, 1);
  assert.equal(blocks.hammer.parent, model.root);
  assert.equal(blocks.returnLeafSpring.parent, model.root);
  assert.equal(blocks.springContactPad.parent, model.root);
  assert.equal(blocks.bellBody.parent, blocks.bellPivot);
  assert.equal(blocks.bellPivot.parent, model.root);
  // Brown draws no post, arm or hanger for the bell; none is presented.
  assert.equal(blocks.fixedBellSupport.parent, null);

  const roles = [];
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.equal(blocks.returnLeafSpring.children.length, 24);
  for (const role of [
    'pivoted-external-bell-hammer',
    'fixed-bearing-at-hammer-pivot',
    'rigid-hammer-arm',
    'abstract-actuating-tail-of-hammer',
    'rectangular-hammer-head',
    'rounded-bell-contact-face',
    'preloaded-under-lever-return-leaf-spring',
    'sliding-contact-of-leaf-spring-under-hammer',
    'fixed-mounted-struck-bell',
    'reinforced-lip-at-hammer-contact-height',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 420 records Brown’s hammer, lower spring, post-strike clearance, and unavailable-animation boundary', () => {
  const movement = catalog.movements[419];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate420;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_420.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /hammer for striking bells/);
  assert.match(movement.description, /Spring below the hammer raises it/);
  assert.match(movement.description, /out of contact with the bell after striking/);
  assert.match(movement.description, /prevents it from interfering with the vibration/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason, /marks Animated unavailable/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsSpringRateOrLoads,
    false,
  );
  assert.equal(dynamics.actuatorAndImpactContactForceHistoryModeled, false);
  assert.match(dynamics.bellResponse, /legibility cue.*elastic shell solution/);
  assert.match(dynamics.hammerMotion, /taut cord fixes the lever angle while the hand pulls/);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.hammerPivotApproximateCenterPixels, [161, 327]);
  assert.deepEqual(plate.returnSpringApproximateBoundsPixels,
    [167, 260, 254, 370]);
  assert.equal(evidence.explicitInBrownDescription.length, 5);
  assert.match(evidence.engravingEvidence,
    /external rectangular-headed hammer.*curved leaf spring/);
  assert.match(evidence.reconstructionDisclosure,
    /no actuator.*spring characteristic.*impact speed/);
  disposeModel(model.root);
});

test('movement 420 cord only pulls: taut while the hand hauls the head up, slack once released', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousHandY = Infinity;
  for (let sample = 0; sample <= 40000; sample += 1) {
    const time = geometry.cycleDuration * sample / 40000;
    const state = stateAtTime(time);
    // Never stretched past its length.
    assert.ok(state.cordSpan <= geometry.pullCordLength + 1e-12, `cord stretched at ${time}`);
    // The lever leaves its rest angle upward only while the cord is taut.
    if (time < geometry.releaseTime && state.hammerAngle > geometry.restAngle + 1e-9) {
      assert.equal(state.cordTaut, true, `taut while lifting at ${time}`);
    }
    if (time > geometry.releaseTime + 0.02 || time < geometry.pullStart) {
      assert.equal(state.cordTaut, false, `slack when free at ${time}`);
    }
    // While pulling the hand only moves down.
    if (time >= geometry.pullStart && time <= geometry.releaseTime) {
      assert.ok(state.handPosition.y <= previousHandY + 1e-12);
      previousHandY = state.handPosition.y;
    }
  }
  near(stateAtTime(geometry.releaseTime - 1e-6).hammerAngle, geometry.liftAngle, 1e-9, 'lifted at release');
  assert.ok(geometry.liftAngle > geometry.restAngle);
  disposeModel(model.root);
});

test('movement 420 released hammer falls by weight to one exact contact pose and is lifted straight off', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  let previousAngle = Infinity;
  for (let sample = 0; sample <= 2000; sample += 1) {
    const time = geometry.releaseTime + geometry.fallDuration * sample / 2000;
    const state = stateAtTime(time);
    assert.ok(state.hammerAngle <= previousAngle + 1e-15, 'falls monotonically');
    previousAngle = state.hammerAngle;
  }
  const strike = stateAtTime(geometry.strikeTime);
  near(strike.hammerAngle, geometry.strikeAngle, 1e-15, 'strike angle');
  vectorNear(strike.hammerHeadCenter, geometry.strikeHeadCenter, 5e-15, 'strike head center');
  near(strike.contactClearance, 0, 1e-13, 'exact bell contact');
  assert.equal(strike.isImpact, true);
  assert.ok(stateAtTime(geometry.strikeTime - 1e-3).hammerAngularSpeed < -1, 'falling fast into the lip');
  assert.ok(stateAtTime(geometry.strikeTime + 0.03).hammerAngle > geometry.strikeAngle, 'spring lifts it off at once');
  disposeModel(model.root);
});

test('movement 420 hammer never penetrates the bell and touches it only at the strike', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  let minimumClearance = Infinity;
  let minimumTime = 0;
  let clearSamples = 0;
  const sampleCount = 100000;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const time = geometry.cycleDuration * sample / sampleCount;
    const state = stateAtTime(time);
    if (state.contactClearance < minimumClearance) {
      minimumClearance = state.contactClearance;
      minimumTime = time;
    }
    if (state.hammerClearOfBell) clearSamples += 1;
    assert.ok(state.contactClearance >= -1e-13);
  }
  near(minimumTime, geometry.strikeTime, 1e-4, 'unique closest-approach time');
  near(minimumClearance, 0, 1e-13, 'minimum clearance');
  assert.ok(clearSamples / sampleCount > 0.999);
  disposeModel(model.root);
});

test('movement 420 leaf spring holds the hammer at rest, is left behind when it is lifted, and is compressed by the strike', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  const rest = stateAtTime(0);
  const lifted = stateAtTime(geometry.releaseTime - 0.01);
  const strike = stateAtTime(geometry.strikeTime);
  near(rest.springCompression, geometry.springPreload, 1e-15, 'rest preload');
  assert.equal(rest.springOnLever, true);
  assert.ok(geometry.springFreeAngle > geometry.restAngle && geometry.springFreeAngle < geometry.liftAngle);
  assert.equal(lifted.springOnLever, false);
  near(lifted.springCompression, 0, 0, 'spring at free length when lever lifts off');
  assert.ok(lifted.springContact.y > lifted.springTip.y, 'lever clear above the spring tip');
  assert.ok(strike.springCompression > rest.springCompression * 5);
  assert.ok(strike.returnSpringTorque > rest.returnSpringTorque * 5);
  for (let sample = 0; sample <= 4000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 4000);
    assert.ok(state.springCompression >= 0);
    near(state.springElasticEnergy, 0.5 * geometry.springStiffness * state.springCompression ** 2, 0, 'spring energy');
  }
  disposeModel(model.root);
});

test('movement 420 hammer head obeys one rigid lever angle', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  for (let sample = 0; sample <= 20000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 20000);
    const headRadial = state.hammerHeadCenter.clone().sub(geometry.pivot);
    near(headRadial.length(), geometry.hammerArmLength, 5e-15, 'rigid head radius');
    near(Math.atan2(headRadial.y, headRadial.x), state.hammerAngle, 1e-14, 'head angle');
    near(state.hammerHeadVelocity.dot(headRadial), 0, 1e-12, 'head velocity tangent to orbit');
  }
  disposeModel(model.root);
});

test('movement 420 bell rings only after impact while the hammer rests clear', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumBellAngle = 0;
  for (let sample = 0; sample <= 80000; sample += 1) {
    const time = geometry.cycleDuration * sample / 80000;
    const state = stateAtTime(time);
    maximumBellAngle = Math.max(maximumBellAngle, Math.abs(state.bellAngle));
    if (time <= geometry.strikeTime
      || time >= geometry.strikeTime + geometry.ringDuration) {
      near(state.bellAngle, 0, 0, 'bell outside finite ring window');
    }
    if (time > geometry.strikeTime + 0.02) assert.equal(state.hammerClearOfBell, true);
  }
  assert.ok(maximumBellAngle > THREE.MathUtils.degToRad(1.1));
  assert.ok(maximumBellAngle <= geometry.bellVibrationAmplitude + 1e-16);
  disposeModel(model.root);
});

test('movement 420 update binds hammer, cord, hand, leaf spring and bell to one state and closes its loop', () => {
  const model = createMovementModel(catalog.movements[419]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  for (const time of [0, 0.55, 1.1, 1.5, 1.7, 1.89, 2.2, 3.15, 4.38]) {
    model.update(time);
    const state = stateAtTime(time);
    sameAngle(blocks.hammer.rotation.z, state.hammerAngle, 0, 'hammer update');
    sameAngle(blocks.bellPivot.rotation.z, state.bellAngle, 0, 'bell update');
    vectorNear(blocks.springContactPad.position, state.springTip, 0, 'spring tip update');
    vectorNear(blocks.pullHand.position, state.handPosition, 0, 'hand update');
    assert.equal(blocks.returnLeafSpring.children.length, 24);
  }
  const source = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration - 1e-9);
  near(closure.hammerAngle, source.hammerAngle, 1e-12, 'hammer cycle closure');
  vectorNear(closure.handPosition, source.handPosition, 1e-9, 'hand cycle closure');
  near(closure.bellAngle, source.bellAngle, 0, 'bell cycle closure');
  disposeModel(model.root);
});

test('movement 507 remains the next authored frontier and does not reuse movement 420 bell-hammer geometry', () => {
  const movement420 = catalog.movements[419];
  const movement507 = catalog.movements[506];
  const model420 = createMovementModel(movement420);
  const model507 = createMovementModel(movement507);

  assert.equal(movement420.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype, ARCHETYPE);
  disposeModel(model420.root);
  disposeModel(model507.root);
});
