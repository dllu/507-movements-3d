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
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vector2Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function vector3Near(actual, expected, tolerance, message) {
  assert.ok(
    actual.distanceTo(expected) <= tolerance,
    `${message}: expected ${expected.toArray()}, received ${actual.toArray()}`,
  );
}

function finiteStateNumbers(value, path = 'state') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} is finite`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (value.isVector2 || value.isVector3) {
    value.toArray().forEach((coordinate, index) => {
      assert.ok(Number.isFinite(coordinate), `${path}[${index}] is finite`);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    finiteStateNumbers(child, `${path}.${key}`);
  }
}

function radialDistanceToAxis(point, origin, axis) {
  const offset = point.clone().sub(origin);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
}

test('movement 209 is a focus-mounted mixed rolling and toothed pair with one passive guide fork', () => {
  const movement = catalog.movements[208];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnimation,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 209);
  assert.equal(movement.number, '209');
  assert.equal(
    movement.title,
    'Focal-Ellipse Rolling Pair with Toothed Continuation and Fork Guide',
  );
  assert.equal(movement.category, 'Friction drives');
  assert.equal(
    movement.description,
    '209. Represents a mode of obtaining motion from rolling contact. The teeth are for making the motion continuous, or it would cease at the point of contact shown in the figure. The forked catch is to guide the teeth into proper contact.',
  );
  assert.equal(
    movement.archetype,
    'focus-mounted-conjugate-elliptical-rolling-pair-partial-teeth-fork-guide',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'focal-ellipse-pair-rolls-on-eleven-pitch-smooth-arcs-and-meshes-through-fifteen-pitch-toothed-arcs',
  );
  assert.equal(
    model.root.userData.variant,
    'twenty-six-equal-pitch-mixed-surface-pair-with-passive-driven-rotor-entry-fork',
  );

  assert.equal(blocks.driver.parent, model.root);
  assert.equal(blocks.driven.parent, model.root);
  assert.equal(blocks.driverShaft.parent, model.root);
  assert.equal(blocks.drivenShaft.parent, model.root);
  assert.equal(blocks.fork.parent, blocks.driven.userData.rotor);
  assert.equal(blocks.fork.userData.rigidWithDrivenRotor, true);
  assert.equal(blocks.fork.userData.passiveGuide, true);
  assert.equal(blocks.forkTines.length, 2);
  assert.equal(blocks.driver.userData.toothMeshes.length, 15);
  assert.equal(blocks.driven.userData.toothMeshes.length, 15);
  assert.equal(blocks.driver.userData.installedToothCount, 15);
  assert.equal(blocks.driven.userData.installedToothCount, 15);
  assert.equal(blocks.driver.userData.smoothPitchCount, 11);
  assert.equal(blocks.driven.userData.smoothPitchCount, 11);
  vector3Near(blocks.driver.userData.axis, Z_AXIS, 0, 'driver axis');
  vector3Near(blocks.driven.userData.axis, Z_AXIS, 0, 'driven axis');
  vector3Near(blocks.driverShaft.userData.axis, Z_AXIS, 0, 'input shaft axis');
  vector3Near(blocks.drivenShaft.userData.axis, Z_AXIS, 0, 'output shaft axis');

  const counts = {
    beltsOrPulleys: 0,
    forks: 0,
    mixedBodies: 0,
    smoothTreads: 0,
    teeth: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/belt|pulley|rope|chain|sprocket/i.test(role)) {
      counts.beltsOrPulleys += 1;
    }
    if (role === 'forked-catch-guiding-entering-driver-tooth') {
      counts.forks += 1;
    }
    if (object.userData.mixedRollingAndToothedBody) counts.mixedBodies += 1;
    if (object.userData.functionalSmoothRollingTread) counts.smoothTreads += 1;
    if (object.userData.equalPitchPartialTooth) counts.teeth += 1;
  });
  assert.deepEqual(counts, {
    beltsOrPulleys: 0,
    forks: 1,
    mixedBodies: 2,
    smoothTreads: 2,
    teeth: 30,
  });

  assert.equal(transmission.direction, 'opposite');
  assert.equal(transmission.equivalentPitchCount, 26);
  assert.equal(transmission.installedToothCount, 15);
  assert.equal(transmission.smoothPitchCount, 11);
  assert.equal(transmission.oneInputTurnPerOutputTurn, true);
  assert.equal(transmission.variableSpeed, true);
  assert.equal(transmission.passiveForkTransmitsPower, false);
  assert.ok(transmission.inputAngularSpeed < 0);
  assert.equal(sourceAnimation.available, false);
  assert.match(sourceAnimation.reason, /unavailable/i);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.equal(sourceRaster.inferredEquivalentPitchCount, 26);
  assert.equal(sourceRaster.inferredInstalledTeethPerBody, 15);
  assert.equal(sourceRaster.inferredSmoothPitchCount, 11);
  assert.equal(sourceRaster.sourcePose,
    'fork-guided-smooth-to-tooth-entry-handoff');
  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  disposeModel(model.root);
});

test('movement 209 reconstructs one conjugate focal ellipse and fifteen-plus-eleven equal-pitch surfaces', () => {
  const model = createMovementModel(catalog.movements[208]);
  const {
    blocks,
    geometry,
    modelPointToSourceRaster,
    pitchArcAtParameter,
    profileAtParameter,
    profileParameterAtPitchArc,
    sourceAnchors,
    sourcePointToModel,
  } = model.root.userData;

  near(geometry.centerDistance, geometry.semiMajor * 2, 0,
    'focus separation is two semi-major axes');
  near(
    geometry.semiMinor,
    geometry.semiMajor * Math.sqrt(1 - geometry.eccentricity ** 2),
    0,
    'minor axis from fitted eccentricity',
  );
  near(geometry.focalDistance,
    geometry.semiMajor * geometry.eccentricity, 0, 'focal distance');
  near(geometry.semiLatusRectum,
    geometry.semiMinor ** 2 / geometry.semiMajor, 2e-16,
    'semi-latus rectum');
  near(geometry.circularPitch * 26, geometry.pitchPerimeter, 0,
    '26-position pitch perimeter');
  near(geometry.toothedArcLength, geometry.circularPitch * 15, 0,
    '15 toothed pitches');
  near(geometry.smoothArcLength, geometry.circularPitch * 11, 0,
    '11 smooth pitches');
  near(
    geometry.toothedArcLength + geometry.smoothArcLength,
    geometry.pitchPerimeter,
    9e-16,
    'mixed surfaces cover the full pitch curve',
  );

  const otherFocus = new THREE.Vector2(geometry.focalDistance * 2, 0);
  for (let index = 0; index <= 2048; index += 1) {
    const parameter = -FULL_TURN + FULL_TURN * 3 * index / 2048;
    const profile = profileAtParameter(parameter);
    near(
      profile.point.length() + profile.point.distanceTo(otherFocus),
      geometry.semiMajor * 2,
      3e-15,
      `ellipse focal-sum invariant ${index}`,
    );
    near(profile.tangent.length(), 1, 3e-16, `unit tangent ${index}`);
    near(profile.outwardNormal.length(), 1, 3e-16,
      `unit outward normal ${index}`);
    near(profile.tangent.dot(profile.outwardNormal), 0, 2e-16,
      `orthogonal profile frame ${index}`);
    const arc = pitchArcAtParameter(parameter);
    near(
      profileParameterAtPitchArc(arc),
      parameter,
      4e-8,
      `arc inversion ${index}`,
    );
  }

  const driverData = blocks.driver.userData.toothData;
  const drivenData = blocks.driven.userData.toothData;
  for (let index = 1; index < 15; index += 1) {
    near(
      THREE.MathUtils.euclideanModulo(
        driverData[index].pitchArc - driverData[index - 1].pitchArc,
        geometry.pitchPerimeter,
      ),
      geometry.circularPitch,
      2e-14,
      `driver tooth pitch ${index}`,
    );
    near(
      THREE.MathUtils.euclideanModulo(
        drivenData[index - 1].pitchArc - drivenData[index].pitchArc,
        geometry.pitchPerimeter,
      ),
      geometry.circularPitch,
      2e-14,
      `driven tooth pitch ${index}`,
    );
  }
  assert.ok(blocks.driver.userData.bodyProfile.some(({ toothed }) => toothed));
  assert.ok(blocks.driver.userData.bodyProfile.some(({ toothed }) => !toothed));
  assert.ok(blocks.driven.userData.bodyProfile.some(({ toothed }) => toothed));
  assert.ok(blocks.driven.userData.bodyProfile.some(({ toothed }) => !toothed));

  vector2Near(sourceAnchors.leftFocus, new THREE.Vector2(85.5, 260), 0,
    'engraved left focus');
  vector2Near(sourceAnchors.rightFocus, new THREE.Vector2(313, 263), 0,
    'engraved right focus');
  vector3Near(
    sourcePointToModel(sourceAnchors.leftFocus),
    geometry.driverCenter,
    3e-16,
    'left source focus maps to driver shaft',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.rightFocus),
    geometry.drivenCenter,
    3e-16,
    'right source focus maps to driven shaft',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.driverCenter),
    sourceAnchors.leftFocus,
    3e-14,
    'driver shaft maps back to source',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.drivenCenter),
    sourceAnchors.rightFocus,
    3e-14,
    'driven shaft maps back to source',
  );
  near(
    THREE.MathUtils.radToDeg(sourceAnchors.ellipseFits.driverMajorAxisAngle),
    11.244495,
    2e-6,
    'source driver major-axis fit',
  );
  near(
    THREE.MathUtils.radToDeg(sourceAnchors.ellipseFits.drivenMajorAxisAngle),
    -60.68621,
    2e-6,
    'source driven major-axis fit',
  );
  vector2Near(sourceAnchors.fork.junction, new THREE.Vector2(286, 232),
    3e-14, 'fork junction anchor');
  vector2Near(sourceAnchors.fork.tineTips[0], new THREE.Vector2(247, 232),
    3e-14, 'lower fork tine anchor');
  vector2Near(sourceAnchors.fork.tineTips[1], new THREE.Vector2(299, 181),
    3e-14, 'upper fork tine anchor');
  assert.ok(geometry.forkTipClearance > 0);
  near(
    geometry.forkMouthHalfWidth - geometry.circularPitch * 0.18,
    geometry.forkTipClearance,
    0,
    'guide throat clears the tooth tip',
  );

  const source = model.root.userData.stateAtTime(0);
  assert.equal(source.contactMode, 'fork-guided-entry-handoff');
  assert.equal(source.forkGuide.active, true);
  assert.equal(source.forkGuide.transmitsPower, false);
  assert.equal(source.forkGuide.guidedDriverToothIndex, 1);
  near(source.forkGuide.pitchPointDistance, 0, 3e-16,
    'fork mouth is centered on the entering source tooth');
  disposeModel(model.root);
});

test('movement 209 preserves conjugate contact and tooth continuity through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[208]);
  const {
    geometry,
    integratedRatioAt,
    stateAtDriverAngle,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  const modes = new Set();
  const driverTeeth = new Set();
  const drivenTeeth = new Set();
  let minimumRatio = Infinity;
  let maximumRatio = -Infinity;
  const maxima = {
    halfPitch: 0,
    pairing: 0,
    pitchPoint: 0,
    profileRadius: 0,
    radiusSum: 0,
    tangent: 0,
    velocity: 0,
  };

  for (let index = 0; index <= sampleCount; index += 1) {
    const driverAngle = geometry.sourceDriverAngle
      - FULL_TURN * index / sampleCount;
    const driverAngularSpeed = -(
      0.11 + 0.73 * (0.5 + 0.5 * Math.cos(index * 0.019))
    );
    const state = stateAtDriverAngle(driverAngle, driverAngularSpeed);
    if (index % 2048 === 0) finiteStateNumbers(state, `state[${index}]`);
    modes.add(state.contactMode);
    minimumRatio = Math.min(minimumRatio, state.instantaneousRatio);
    maximumRatio = Math.max(maximumRatio, state.instantaneousRatio);

    near(state.drivenAngle, -integratedRatioAt(driverAngle), 0,
      `integrated output angle ${index}`);
    near(
      state.drivenAngularSpeed,
      -driverAngularSpeed * state.instantaneousRatio,
      0,
      `instantaneous output rate ${index}`,
    );
    assert.ok(state.driverPitchRadius > 0);
    assert.ok(state.drivenPitchRadius > 0);
    assert.ok(state.contactPoint.x > geometry.driverCenter.x);
    assert.ok(state.contactPoint.x < geometry.drivenCenter.x);
    assert.ok(state.activeContactModeCount >= 1);
    assert.equal(
      state.activeContactModeCount,
      Number(state.toothedContactActive) + Number(state.smoothContactActive),
    );
    if (state.toothedContactActive) {
      driverTeeth.add(state.toothMesh.driverToothIndex);
      drivenTeeth.add(state.toothMesh.drivenToothIndex);
      maxima.halfPitch = Math.max(
        maxima.halfPitch,
        state.toothMesh.halfPitchPhaseError,
      );
    }
    if (state.forkGuide.active) {
      assert.equal(state.forkGuide.transmitsPower, false);
    }
    maxima.pairing = Math.max(
      maxima.pairing,
      Math.abs(state.pitchRollPairingError),
    );
    maxima.pitchPoint = Math.max(
      maxima.pitchPoint,
      state.driverPitchPointResidual,
      state.drivenPitchPointResidual,
    );
    maxima.profileRadius = Math.max(
      maxima.profileRadius,
      state.drivenProfileRadiusResidual,
    );
    maxima.radiusSum = Math.max(maxima.radiusSum, state.pitchRadiusSumError);
    maxima.tangent = Math.max(maxima.tangent, state.tangentAlignmentError);
    maxima.velocity = Math.max(maxima.velocity, state.surfaceVelocityError);
  }

  assert.deepEqual([...modes].sort(), [
    'fork-guided-entry-handoff',
    'smooth-rolling',
    'tooth-to-smooth-handoff',
    'toothed-continuation',
  ]);
  assert.deepEqual([...driverTeeth].sort((a, b) => a - b),
    Array.from({ length: 15 }, (_, index) => index));
  assert.deepEqual([...drivenTeeth].sort((a, b) => a - b),
    Array.from({ length: 15 }, (_, index) => index));
  near(minimumRatio,
    transmission.minimumInstantaneousSpeedMagnitudeRatio, 2e-8,
    'minimum variable-speed ratio');
  near(maximumRatio,
    transmission.maximumInstantaneousSpeedMagnitudeRatio, 2e-7,
    'maximum variable-speed ratio');
  assert.ok(maxima.pairing < 3.1e-8,
    `maximum paired pitch-arc error ${maxima.pairing}`);
  assert.ok(maxima.pitchPoint < 2.2e-15,
    `maximum common pitch-point error ${maxima.pitchPoint}`);
  assert.ok(maxima.profileRadius < 2.2e-15,
    `maximum conjugate radius error ${maxima.profileRadius}`);
  assert.ok(maxima.radiusSum < 5e-16,
    `maximum pitch-radius sum error ${maxima.radiusSum}`);
  assert.ok(maxima.tangent < 1.6e-15,
    `maximum common-tangent error ${maxima.tangent}`);
  assert.ok(maxima.velocity < 5e-16,
    `maximum no-slip surface velocity error ${maxima.velocity}`);
  assert.ok(maxima.halfPitch < 2e-16,
    `maximum half-pitch mesh phasing error ${maxima.halfPitch}`);
  disposeModel(model.root);
});

test('movement 209 has continuous analytic rates at both handoffs and closes after one turn', () => {
  const model = createMovementModel(catalog.movements[208]);
  const {
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const derivativeStep = 1e-5;
  for (let index = 0; index <= 512; index += 1) {
    const time = transmission.inputPeriod * index / 512;
    const before = stateAtTime(time - derivativeStep);
    const state = stateAtTime(time);
    const after = stateAtTime(time + derivativeStep);
    near(
      (after.driverAngle - before.driverAngle) / (2 * derivativeStep),
      state.driverAngularSpeed,
      8e-11,
      `driver finite-difference rate ${index}`,
    );
    near(
      (after.drivenAngle - before.drivenAngle) / (2 * derivativeStep),
      state.drivenAngularSpeed,
      7e-9,
      `driven finite-difference rate ${index}`,
    );
  }

  const handoffNames = ['sourceForkEntry', 'toothToSmoothHandoff'];
  for (const name of handoffNames) {
    const time = canonicalTimes[name];
    const before = stateAtTime(time - 1e-7);
    const state = stateAtTime(time);
    const after = stateAtTime(time + 1e-7);
    assert.equal(state.smoothContactActive, true, `${name} smooth contact`);
    assert.equal(state.toothedContactActive, true, `${name} tooth contact`);
    near(before.driverAngle, state.driverAngle, 4e-8,
      `${name} continuous input before`);
    near(after.driverAngle, state.driverAngle, 4e-8,
      `${name} continuous input after`);
    near(before.drivenAngle, state.drivenAngle, 2e-7,
      `${name} continuous output before`);
    near(after.drivenAngle, state.drivenAngle, 2e-7,
      `${name} continuous output after`);
    near(before.drivenAngularSpeed, state.drivenAngularSpeed, 8e-7,
      `${name} continuous rate before`);
    near(after.drivenAngularSpeed, state.drivenAngularSpeed, 8e-7,
      `${name} continuous rate after`);
  }

  assert.equal(
    stateAtTime(canonicalTimes.midToothedContinuation).contactMode,
    'toothed-continuation',
  );
  assert.equal(
    stateAtTime(canonicalTimes.midSmoothRolling).contactMode,
    'smooth-rolling',
  );
  const start = stateAtTime(0);
  const closure = stateAtTime(transmission.inputPeriod);
  near(closure.driverAngle - start.driverAngle, -FULL_TURN, 1e-15,
    'one clockwise input turn');
  near(closure.drivenAngle - start.drivenAngle, FULL_TURN, 1e-15,
    'one counterclockwise output turn');
  near(closure.rollDistance - start.rollDistance,
    geometry.pitchPerimeter, 5e-15, 'one full pitch-perimeter roll');
  near(closure.contactPoint.x, start.contactPoint.x, 2e-15,
    'contact point closes');
  near(closure.driverPitchRadius, start.driverPitchRadius, 2e-15,
    'driver pitch radius closes');
  near(closure.drivenPitchRadius, start.drivenPitchRadius, 2e-15,
    'driven pitch radius closes');
  assert.equal(closure.contactMode, 'fork-guided-entry-handoff');
  disposeModel(model.root);
});

test('movement 209 renders rigid indices while 210–213 are distinct and authored', () => {
  const model = createMovementModel(catalog.movements[208]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const renderedTimes = [
    canonicalTimes.sourceForkEntry,
    canonicalTimes.midToothedContinuation,
    canonicalTimes.toothToSmoothHandoff,
    canonicalTimes.midSmoothRolling,
    canonicalTimes.cycleClosure,
  ];

  for (const time of renderedTimes) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.driver.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered driver angle');
    near(blocks.driverShaft.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered input shaft angle');
    near(blocks.driven.userData.rotor.rotation.z,
      state.drivenAngle, 0, 'rendered driven angle');
    near(blocks.drivenShaft.userData.rotor.rotation.z,
      state.drivenAngle, 0, 'rendered output shaft angle');
    near(
      radialDistanceToAxis(
        blocks.driver.userData.indexTip.getWorldPosition(new THREE.Vector3()),
        geometry.driverCenter,
        Z_AXIS,
      ),
      0.78,
      3e-15,
      'driver white index is rigid with input rotor',
    );
    near(
      radialDistanceToAxis(
        blocks.driven.userData.indexTip.getWorldPosition(new THREE.Vector3()),
        geometry.drivenCenter,
        Z_AXIS,
      ),
      0.78,
      3e-15,
      'driven white index is rigid with output rotor',
    );
    const forkMouthWorld = blocks.forkMouthAnchor.getWorldPosition(
      new THREE.Vector3(),
    );
    vector2Near(
      new THREE.Vector2(forkMouthWorld.x, forkMouthWorld.y),
      state.forkGuide.mouthPoint,
      3e-15,
      'rendered guide mouth follows the driven rotor',
    );
    near(blocks.contactMarker.position.x,
      state.contactPoint.x, 0, 'rendered pitch contact x');
    near(blocks.contactMarker.position.y,
      state.contactPoint.y, 0, 'rendered pitch contact y');
  }

  model.update(canonicalTimes.sourceForkEntry);
  model.root.updateMatrixWorld(true);
  const bodyBounds = new THREE.Box3().setFromObject(model.root);
  const size = bodyBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 6.1, 'two noncircular bodies and base fill the width');
  assert.ok(size.y > 4, 'source-oriented profiles and lower frame fill height');
  // p104: the shafts end just proud of their hubs and the horn.
  assert.ok(size.z > 1.4, 'shafts, bodies, and front guide occupy real depth');
  assert.ok(bodyBounds.min.y < -2.7, 'fixed frame clears the moving profiles');
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y < 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement208 = createMovementModel(catalog.movements[207]);
  const movement210 = createMovementModel(catalog.movements[209]);
  const movement211 = createMovementModel(catalog.movements[210]);
  const movement212 = createMovementModel(catalog.movements[211]);
  const movement213 = createMovementModel(catalog.movements[212]);
  assert.equal(catalog.movements[207].id, 208);
  assert.equal(catalog.movements[207].fidelity, 'authored');
  assert.equal(movement208.root.userData.fidelity, 'authored');
  assert.notEqual(movement208.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[209].id, 210);
  assert.equal(catalog.movements[209].fidelity, 'authored');
  assert.equal(movement210.root.userData.fidelity, 'authored');
  assert.notEqual(movement210.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[210].id, 211);
  assert.equal(catalog.movements[210].fidelity, 'authored');
  assert.equal(movement211.root.userData.fidelity, 'authored');
  assert.notEqual(movement211.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[211].id, 212);
  assert.equal(catalog.movements[211].fidelity, 'authored');
  assert.equal(movement212.root.userData.fidelity, 'authored');
  assert.notEqual(movement212.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[212].id, 213);
  assert.equal(catalog.movements[212].fidelity, 'authored');
  assert.equal(movement213.root.userData.fidelity, 'authored');
  disposeModel(movement208.root);
  disposeModel(movement210.root);
  disposeModel(movement211.root);
  disposeModel(movement212.root);
  disposeModel(movement213.root);
  disposeModel(model.root);
});

test('movement 209 fork catches a pin on the entering driver tooth through the dead point', () => {
  const model = createMovementModel(catalog.movements[208]);
  const { blocks, transmission } = model.root.userData;
  try {
    const { forkPin, forkHorn, fork, driver } = blocks;
    assert.equal(forkPin.parent, driver.userData.rotor);
    const functional = fork.userData.functionalFork;
    assert.ok(functional.window[0] < 0 && functional.window[1] > 0,
      'the pin is in the fork at the source (dead-point) pose');
    const polygons = forkHorn.geometry.userData.plate.polygons;
    assert.equal(polygons.length, 1, 'one fork piece carried by the boss');
    const segments = [];
    for (const polygon of polygons) for (const ring of polygon) {
      for (let i = 0; i + 1 < ring.length; i += 1) segments.push([ring[i], ring[i + 1]]);
    }
    const inside = (x, y) => {
      let result = false;
      for (const polygon of polygons) for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
        }
      }
      return result;
    };
    const distance = (x, y) => Math.min(...segments.map(([[x1, y1], [x2, y2]]) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
    }));
    let engaged = 0;
    for (let i = 0; i <= 2048; i += 1) {
      model.update(transmission.inputPeriod * i / 2048);
      model.root.updateMatrixWorld(true);
      const local = forkHorn.worldToLocal(forkPin.getWorldPosition(new THREE.Vector3()));
      assert.ok(!inside(local.x, local.y), 'pin axis never inside the fork');
      const gap = distance(local.x, local.y) - functional.pinRadius;
      assert.ok(gap > 0.011, `pin clears the fork (${gap})`);
      if (model.root.userData.kinematics.forkGuide.pinEngaged) {
        engaged += 1;
        assert.ok(gap < 0.0125, `engaged pin bears on a horn (${gap})`);
      }
    }
    assert.ok(engaged > 150, 'the pin runs through the fork for a real interval');
  } finally {
    disposeModel(model.root);
  }
});
