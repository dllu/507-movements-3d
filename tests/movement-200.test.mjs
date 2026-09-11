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
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

function radialDistance(point, origin, axis) {
  const offset = point.clone().sub(origin);
  return offset.addScaledVector(axis, -offset.dot(axis)).length();
}

test('movement 200 is Brown\'s one compound driver and two independent loose coaxial bevel wheels', () => {
  const movement = catalog.movements[199];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnchors,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 200);
  assert.equal(movement.number, '200');
  assert.equal(movement.title, 'Coaxial Differential-Speed Bevel Gears');
  assert.equal(movement.category, 'Bevel gearing');
  assert.equal(
    movement.description,
    '200. A mode of obtaining two different speeds on the same shaft from one driving-wheel.',
  );
  assert.equal(
    movement.archetype,
    'compound-bevel-driver-coaxial-loose-differential-speed-wheels',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'one-rigid-two-section-bevel-driver-simultaneously-turns-two-loose-coaxial-wheels-at-opposite-unequal-speeds',
  );
  assert.equal(
    model.root.userData.variant,
    '24-tooth-rigid-driver-sections-with-48-tooth-upper-and-32-tooth-lower-loose-wheels',
  );

  assert.equal(blocks.compoundDriver.parent, model.root);
  assert.equal(blocks.upperDriverSection.parent, blocks.compoundDriver);
  assert.equal(blocks.lowerDriverSection.parent, blocks.compoundDriver);
  assert.equal(blocks.inputShaft.parent, blocks.compoundDriver);
  assert.equal(blocks.driverCoupling.parent, blocks.compoundDriver);
  assert.equal(
    blocks.driverCoupling.userData.keyedToBothDriverSections,
    true,
  );
  assert.equal(blocks.compoundDriver.userData.rigidSectionCount, 2);
  assert.deepEqual(
    blocks.compoundDriver.userData.sections,
    [blocks.upperDriverSection, blocks.lowerDriverSection],
  );
  assert.equal(blocks.inputShaft.userData.keyedToBothDriverSections, true);
  assert.equal(blocks.upperOutput.parent, model.root);
  assert.equal(blocks.lowerOutput.parent, model.root);
  assert.equal(blocks.upperOutput.userData.looseOnShaft, true);
  assert.equal(blocks.lowerOutput.userData.looseOnShaft, true);
  assert.equal(blocks.upperOutput.userData.looseOnCommonSpindle, true);
  assert.equal(blocks.lowerOutput.userData.looseOnCommonSpindle, true);
  assert.equal(
    blocks.lowerInwardIndexMarker.parent,
    blocks.lowerOutput.userData.rotor,
  );
  assert.equal(blocks.commonSpindle.userData.stationary, true);
  assert.equal(blocks.commonSpindle.userData.fixed, true);
  assert.equal(transmission.rigidDriverSectionCount, 2);
  assert.equal(transmission.looseOutputWheelCount, 2);
  assert.equal(transmission.simultaneousMeshCount, 2);
  assert.equal(transmission.stationaryCommonSpindle, true);

  let looseWheelCount = 0;
  let driverSectionCount = 0;
  let beltCount = 0;
  let clutchOrSelectorCount = 0;
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/loose-bevel-wheel/.test(role)) looseWheelCount += 1;
    if (/section-of-single-rigid-compound-bevel-driving-wheel/.test(role)) {
      driverSectionCount += 1;
    }
    if (/belt/i.test(role)) beltCount += 1;
    if (/clutch|selector/i.test(role)) clutchOrSelectorCount += 1;
  });
  assert.equal(looseWheelCount, 2);
  assert.equal(driverSectionCount, 2);
  assert.equal(beltCount, 0);
  assert.equal(clutchOrSelectorCount, 0);

  assert.deepEqual(sourceRaster.imageSize.toArray(), [525, 525]);
  assert.equal(sourceRaster.upperPitchRadius, 144);
  assert.equal(sourceRaster.lowerPitchRadius, 96);
  assert.equal(sourceRaster.pitchRadiusRatio, 1.5);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.deepEqual(
    sourceAnchors.spindleAxis.top.toArray(),
    [248, 81],
  );
  assert.deepEqual(
    sourceAnchors.spindleAxis.bottom.toArray(),
    [250, 457],
  );
  assert.deepEqual(
    sourceAnchors.upperPitchContact.toArray(),
    [394, 181],
  );
  assert.deepEqual(
    sourceAnchors.lowerPitchContact.toArray(),
    [346, 343],
  );
  disposeModel(model.root);
});

test('movement 200 preserves the 3:2 source proportion with two exact conjugate bevel pairs', () => {
  const model = createMovementModel(catalog.movements[199]);
  const { geometry, transmission } = model.root.userData;

  assert.equal(geometry.driverTeeth, 24);
  assert.equal(geometry.upperOutputTeeth, 48);
  assert.equal(geometry.lowerOutputTeeth, 32);
  near(
    geometry.driverPitchRadius,
    geometry.driverTeeth * geometry.pitchRadiusPerTooth,
    1e-15,
    'driver pitch radius follows the common module',
  );
  near(
    geometry.upperOutputPitchRadius,
    geometry.upperOutputTeeth * geometry.pitchRadiusPerTooth,
    1e-15,
    'upper pitch radius follows the common module',
  );
  near(
    geometry.lowerOutputPitchRadius,
    geometry.lowerOutputTeeth * geometry.pitchRadiusPerTooth,
    1e-15,
    'lower pitch radius follows the common module',
  );
  near(
    geometry.upperOutputPitchRadius / geometry.lowerOutputPitchRadius,
    1.5,
    1e-15,
    'modeled upper-to-lower pitch-radius ratio',
  );
  near(
    geometry.sourceRasterPitchRadii.upper
      / geometry.sourceRasterPitchRadii.lower,
    1.5,
    1e-15,
    'source-fitted upper-to-lower pitch-radius ratio',
  );
  near(
    geometry.upperDriverPitchConeAngle
      + geometry.upperOutputPitchConeAngle,
    Math.PI / 2,
    1e-15,
    'upper pitch cones complement at right-angle axes',
  );
  near(
    geometry.lowerDriverPitchConeAngle
      + geometry.lowerOutputPitchConeAngle,
    Math.PI / 2,
    1e-15,
    'lower pitch cones complement at right-angle axes',
  );
  assert.ok(geometry.driverSectionAxialGap > 0);
  assert.ok(
    geometry.lowerDriverOuterDistance
      < geometry.upperDriverInnerDistance,
  );

  near(
    geometry.upperContactPoint.dot(geometry.inputAxis),
    (geometry.upperDriverInnerDistance
      + geometry.upperDriverOuterDistance) / 2,
    1e-15,
    'upper contact axial station on driver section',
  );
  near(
    radialDistance(
      geometry.upperContactPoint,
      geometry.apex,
      geometry.inputAxis,
    ),
    geometry.upperContactRadius,
    1e-15,
    'upper driver pitch radius at contact',
  );
  near(
    geometry.upperContactPoint.dot(geometry.upperOutputAxis),
    geometry.upperOutputContactDistance,
    1e-15,
    'upper contact axial station on output wheel',
  );
  near(
    radialDistance(
      geometry.upperContactPoint,
      geometry.apex,
      geometry.upperOutputAxis,
    ),
    geometry.upperOutputContactRadius,
    1e-15,
    'upper output pitch radius at contact',
  );
  near(
    geometry.lowerContactPoint.dot(geometry.inputAxis),
    (geometry.lowerDriverInnerDistance
      + geometry.lowerDriverOuterDistance) / 2,
    1e-15,
    'lower contact axial station on driver section',
  );
  near(
    geometry.lowerContactPoint.dot(geometry.lowerOutputAxis),
    geometry.lowerOutputContactDistance,
    1e-15,
    'lower contact axial station on output wheel',
  );
  near(
    radialDistance(
      geometry.lowerContactPoint,
      geometry.apex,
      geometry.lowerOutputAxis,
    ),
    geometry.lowerOutputContactRadius,
    1e-15,
    'lower output pitch radius at contact',
  );
  near(
    geometry.upperDriverNormal.distanceTo(
      geometry.upperOutputNormal.clone().negate(),
    ),
    0,
    2e-15,
    'upper pitch-cone normals oppose',
  );
  near(
    geometry.lowerDriverNormal.distanceTo(
      geometry.lowerOutputNormal.clone().negate(),
    ),
    0,
    2e-15,
    'lower pitch-cone normals oppose',
  );

  near(transmission.inputToUpperLocalRatio, -0.5, 1e-15, 'upper local ratio');
  near(transmission.inputToLowerLocalRatio, -0.75, 1e-15, 'lower local ratio');
  near(transmission.inputToUpperPhysicalRatio, -0.5, 1e-15, 'upper physical ratio');
  near(transmission.inputToLowerPhysicalRatio, 0.75, 1e-15, 'lower physical ratio');
  near(
    transmission.lowerToUpperSpeedMagnitudeRatio,
    1.5,
    1e-15,
    'different output-speed magnitude ratio',
  );
  assert.ok(geometry.looseBoreRadius > geometry.commonSpindleRadius);
  disposeModel(model.root);
});

test('movement 200 keeps both meshes simultaneous, phase-locked, and slip-free through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[199]);
  const { canonicalTimes, stateAtTime, transmission } = model.root.userData;
  const reference = stateAtTime(0);
  const sampleCount = 32768;
  const sampledTimeSpan = transmission.inputCyclePeriod * 16;
  for (let index = 0; index <= sampleCount; index += 1) {
    const time = -sampledTimeSpan / 2
      + sampledTimeSpan * index / sampleCount;
    const state = stateAtTime(time);
    finiteStateNumbers(state);
    assert.equal(state.simultaneouslyDrivenLooseWheelCount, 2);
    assert.equal(state.spindleAngularSpeed, 0);
    assert.equal(state.oppositePhysicalDirections, true);
    near(
      state.upperOutputAngularSpeed / state.inputAngularSpeed,
      -0.5,
      2e-15,
      `upper ratio at sample ${index}`,
    );
    near(
      state.lowerOutputAngularSpeed / state.inputAngularSpeed,
      -0.75,
      2e-15,
      `lower local ratio at sample ${index}`,
    );
    near(
      state.lowerPhysicalAngularSpeed / state.inputAngularSpeed,
      0.75,
      2e-15,
      `lower physical ratio at sample ${index}`,
    );
    near(
      state.lowerToUpperSpeedMagnitudeRatio,
      1.5,
      2e-15,
      `speed split at sample ${index}`,
    );
    near(
      state.upperMesh.surfaceVelocityError,
      0,
      2e-15,
      `upper no-slip contact at sample ${index}`,
    );
    near(
      state.lowerMesh.surfaceVelocityError,
      0,
      2e-15,
      `lower no-slip contact at sample ${index}`,
    );
    near(
      state.upperMesh.meshPhaseError,
      0,
      2e-13,
      `upper tooth phase at sample ${index}`,
    );
    near(
      state.lowerMesh.meshPhaseError,
      0,
      2e-13,
      `lower tooth phase at sample ${index}`,
    );
    near(
      state.meshPhaseInvariants.upper,
      reference.meshPhaseInvariants.upper,
      2e-12,
      `upper mesh invariant at sample ${index}`,
    );
    near(
      state.meshPhaseInvariants.lower,
      reference.meshPhaseInvariants.lower,
      2e-12,
      `lower mesh invariant at sample ${index}`,
    );
  }

  const closure = stateAtTime(canonicalTimes.commonFourTurnPose);
  near(
    closure.inputAngle - reference.inputAngle,
    4 * FULL_TURN,
    2e-14,
    'four-turn driver closure',
  );
  near(
    closure.upperOutputAngle - reference.upperOutputAngle,
    -2 * FULL_TURN,
    2e-14,
    'upper wheel closure after two reverse turns',
  );
  near(
    closure.lowerOutputAngle - reference.lowerOutputAngle,
    -3 * FULL_TURN,
    2e-14,
    'lower wheel closure after three reverse local turns',
  );
  disposeModel(model.root);
});

test('movement 200 rendered transforms expose one rigid driver, two rates, and a stationary spindle', () => {
  const model = createMovementModel(catalog.movements[199]);
  const { blocks, canonicalTimes, geometry, stateAtTime } = model.root.userData;
  const times = [
    canonicalTimes.sourcePose,
    canonicalTimes.quarterInputTurn,
    canonicalTimes.oneInputTurn,
    canonicalTimes.commonFourTurnPose,
  ];

  for (const time of times) {
    const state = stateAtTime(time);
    model.update(time);
    near(
      blocks.upperDriverSection.userData.rotor.rotation.z,
      state.inputAngle,
      1e-14,
      `upper driver transform at time ${time}`,
    );
    near(
      blocks.lowerDriverSection.userData.rotor.rotation.z,
      state.inputAngle,
      1e-14,
      `lower driver transform at time ${time}`,
    );
    near(
      blocks.inputShaft.userData.rotor.rotation.z,
      state.inputAngle,
      1e-14,
      `input shaft transform at time ${time}`,
    );
    near(
      blocks.driverCoupling.userData.rotor.rotation.z,
      state.inputAngle,
      1e-14,
      `rigid driver coupling transform at time ${time}`,
    );
    near(
      blocks.upperOutput.userData.rotor.rotation.z,
      state.upperOutputAngle,
      1e-14,
      `upper loose-wheel transform at time ${time}`,
    );
    near(
      blocks.lowerOutput.userData.rotor.rotation.z,
      state.lowerOutputAngle,
      1e-14,
      `lower loose-wheel transform at time ${time}`,
    );
    near(
      blocks.commonSpindle.userData.rotor.rotation.z,
      0,
      1e-15,
      `stationary spindle transform at time ${time}`,
    );
    assert.equal(blocks.commonSpindle.userData.angularSpeed, 0);
    assert.equal(blocks.upperOutput.userData.angularSpeed, -0.54);
    assert.equal(blocks.lowerOutput.userData.angularSpeed, -0.81);
    vector3Near(
      blocks.upperContactMarker.position,
      geometry.upperContactPoint,
      1e-15,
      `upper fixed contact marker at time ${time}`,
    );
    vector3Near(
      blocks.lowerContactMarker.position,
      geometry.lowerContactPoint,
      1e-15,
      `lower fixed contact marker at time ${time}`,
    );
    near(
      model.root.userData.contacts.upperBevelMesh.surfaceVelocityError,
      0,
      2e-15,
      `rendered upper rolling contact at time ${time}`,
    );
    near(
      model.root.userData.contacts.lowerBevelMesh.surfaceVelocityError,
      0,
      2e-15,
      `rendered lower rolling contact at time ${time}`,
    );
  }

  vector3Near(
    blocks.upperDriverSection.userData.axis,
    X_AXIS,
    1e-15,
    'upper driver axis',
  );
  vector3Near(
    blocks.lowerDriverSection.userData.axis,
    X_AXIS,
    1e-15,
    'lower driver axis',
  );
  vector3Near(
    blocks.upperOutput.userData.axis,
    Y_AXIS,
    1e-15,
    'upper output local axis',
  );
  vector3Near(
    blocks.lowerOutput.userData.axis,
    Y_AXIS.clone().negate(),
    1e-15,
    'lower output opposed local axis',
  );
  assert.notEqual(
    blocks.upperOutput.userData.rotor,
    blocks.lowerOutput.userData.rotor,
  );
  assert.ok(blocks.upperDriverSection.userData.indicator.visible);
  assert.ok(blocks.lowerDriverSection.userData.indicator.visible);
  assert.ok(blocks.upperOutput.userData.indicator.visible);
  assert.ok(blocks.lowerOutput.userData.indicator.visible);
  assert.ok(blocks.lowerInwardIndexMarker.visible);
  disposeModel(model.root);
});

test('movement 200 fills a source-like 3D envelope and remains distinct as the queue advances through 204', () => {
  const model = createMovementModel(catalog.movements[199]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.compoundDriver,
      blocks.upperOutput,
      blocks.lowerOutput,
      blocks.commonSpindle,
      blocks.upperContactMarker,
      blocks.lowerContactMarker,
      blocks.baseRail,
      blocks.rearPost,
      blocks.upperBearingBridge,
      blocks.lowerBearingBridge,
      blocks.inputBearingPost,
      blocks.inputBearingBridge,
      blocks.upperSpindleBearing,
      blocks.lowerSpindleBearing,
      blocks.inputBearing,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 6.2);
  assert.ok(size.y > 4.8);
  assert.ok(size.z > 3.3);
  assert.ok(physicalBounds.min.x < -2.4);
  assert.ok(physicalBounds.max.x > 3.79);
  assert.ok(physicalBounds.min.z < -1.67);
  assert.ok(physicalBounds.max.z > 1.67);
  let visibleMeshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) visibleMeshCount += 1;
  });
  assert.ok(visibleMeshCount >= 165);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);

  const movement199 = createMovementModel(catalog.movements[198]);
  const movement201 = createMovementModel(catalog.movements[200]);
  const movement202 = createMovementModel(catalog.movements[201]);
  const movement203 = createMovementModel(catalog.movements[202]);
  const movement204 = createMovementModel(catalog.movements[203]);
  const movement205 = createMovementModel(catalog.movements[204]);
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement201.root.userData.fidelity, 'authored');
  assert.equal(movement202.root.userData.fidelity, 'authored');
  assert.equal(movement203.root.userData.fidelity, 'authored');
  assert.equal(movement204.root.userData.fidelity, 'authored');
  assert.equal(movement205.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement199.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement201.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement199.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement201.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement202.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement203.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement204.root.userData.archetype,
    model.root.userData.archetype,
  );
  disposeModel(movement199.root);
  disposeModel(movement201.root);
  disposeModel(movement202.root);
  disposeModel(movement203.root);
  disposeModel(movement204.root);
  disposeModel(movement205.root);
  disposeModel(model.root);
});
