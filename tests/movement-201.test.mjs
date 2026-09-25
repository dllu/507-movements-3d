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
  const actual2 = new THREE.Vector2(actual.x, actual.y);
  const expected2 = new THREE.Vector2(expected.x, expected.y);
  assert.ok(
    actual2.distanceTo(expected2) <= tolerance,
    `${message}: expected ${expected2.toArray()}, received ${actual2.toArray()}`,
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

test('movement 201 is Brown\'s eccentric gear, carried pinion, one open belt, rocker arm, and guided rod A', () => {
  const movement = catalog.movements[200];
  const model = createMovementModel(movement);
  const { blocks, sourceAnchors, sourceRaster, transmission } = model.root.userData;

  assert.equal(movement.id, 201);
  assert.equal(movement.number, '201');
  assert.equal(
    movement.title,
    'Eccentric Gear, Vibrating Arm, and Reciprocating Rod',
  );
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(
    movement.description,
    '201. A continual rotation of the pinion (obtained through the irregular shaped gear at the left) gives a variable vibrating movement to the horizontal arm, and a variable reciprocating movement to the rod, A.',
  );
  assert.equal(
    movement.archetype,
    'eccentric-gear-carried-pinion-belted-rocker-slotted-arm-reciprocating-rod',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'fixed-axis-eccentric-gear-rolls-eight-tooth-pinion-on-rocker-and-drives-one-open-belt-plus-slotted-rod-A',
  );
  assert.equal(
    model.root.userData.variant,
    'sixteen-to-eight-external-mesh-with-continuously-rotating-pinion-and-variable-rocker-output',
  );

  assert.equal(blocks.carrier.parent, model.root);
  assert.equal(blocks.pinion.parent, blocks.carrier);
  assert.equal(blocks.pinionShaft.parent, blocks.carrier);
  assert.equal(blocks.smallPulley.parent, blocks.carrier);
  assert.equal(blocks.largePulley.parent, blocks.carrier);
  assert.equal(blocks.belt.parent, blocks.carrier);
  assert.equal(blocks.eccentricGear.parent, model.root);
  assert.equal(blocks.inputShaft.parent, model.root);
  assert.equal(blocks.outputShaft.parent, model.root);
  assert.equal(blocks.rod.parent, model.root);
  assert.equal(blocks.rodGuide.parent, model.root);
  // Brown's letter A is caption lettering, not a part; presentation removes it.
  assert.equal(blocks.letterA.parent, null);
  assert.equal(blocks.carrierBody.parent, blocks.carrier);
  assert.equal(blocks.slotRails.length, 2);
  assert.equal(blocks.armJunctions.length, 2);
  assert.equal(blocks.letterStrokes.length, 3);
  assert.equal(blocks.eccentricGear.userData.fixedShaftCenter, true);
  assert.ok(blocks.eccentricGear.userData.eccentricOffset.length() > 0);
  assert.equal(blocks.pinion.userData.carriedCenter, true);
  assert.equal(blocks.pinion.userData.variableAngularSpeed, true);
  assert.equal(blocks.smallPulley.userData.commonShaftWithPinion, true);
  assert.equal(blocks.largePulley.userData.looseOnCarrierPivotShaft, true);
  assert.equal(
    blocks.largePulleyFaceIndex.parent,
    blocks.largePulley.userData.rotor,
  );
  assert.equal(blocks.pivotCollar.userData.looseOnOutputShaft, true);
  assert.equal(blocks.outputShaft.userData.stationary, true);
  assert.equal(blocks.rod.userData.fixedGuideX, model.root.userData.geometry.rodGuideX);
  assert.equal(blocks.letterA.userData.label, 'A');
  assert.equal(transmission.beltCount, 1);
  assert.equal(transmission.openBelt, true);
  assert.equal(transmission.pinionContinuallyRotates, true);

  let actualEccentricBoreCount = 0;
  let openBeltCount = 0;
  let rackCount = 0;
  let carriedPinionCount = 0;
  let rodACount = 0;
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (object.userData.actualEccentricBore) actualEccentricBoreCount += 1;
    if (role === 'single-open-belt-between-carried-and-pivot-pulleys') {
      openBeltCount += 1;
    }
    if (/rack-(?:frame|tooth)|rack-and-pinion|linear-rack/i.test(role)) {
      rackCount += 1;
    }
    if (role === 'eight-tooth-carried-circular-pinion') carriedPinionCount += 1;
    if (role === 'vertically-guided-reciprocating-rod-A') rodACount += 1;
  });
  assert.equal(actualEccentricBoreCount, 1);
  assert.equal(openBeltCount, 1);
  assert.equal(rackCount, 0);
  assert.equal(carriedPinionCount, 1);
  assert.equal(rodACount, 1);

  assert.deepEqual(sourceRaster.imageSize.toArray(), [525, 525]);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.deepEqual(sourceAnchors.driverShaftCenter.toArray(), [207, 65]);
  assert.deepEqual(sourceAnchors.driverPitchCenter.toArray(), [176, 86]);
  assert.deepEqual(sourceAnchors.pinionCenter.toArray(), [269, 74]);
  assert.deepEqual(sourceAnchors.carrierPivot.toArray(), [268, 360]);
  assert.deepEqual(sourceAnchors.rodPin.toArray(), [90, 361]);
  disposeModel(model.root);
});

test('movement 201 source pose and 16:8 pitch geometry reproduce the engraving anchors', () => {
  const model = createMovementModel(catalog.movements[200]);
  const {
    geometry,
    sourceAnchors,
    stateAtDriverAngle,
    transmission,
  } = model.root.userData;
  const sourceState = stateAtDriverAngle(0);

  assert.equal(geometry.driverTeeth, 16);
  assert.equal(geometry.pinionTeeth, 8);
  near(
    geometry.driverPitchRadius / geometry.pinionPitchRadius,
    2,
    1e-15,
    'sixteen-to-eight pitch-radius ratio',
  );
  near(
    geometry.driverPitchRadius,
    geometry.driverTeeth * geometry.module / 2,
    1e-15,
    'driver pitch radius follows common module',
  );
  near(
    geometry.pinionPitchRadius,
    geometry.pinionTeeth * geometry.module / 2,
    1e-15,
    'pinion pitch radius follows common module',
  );
  near(
    geometry.circularPitch,
    Math.PI * geometry.module,
    1e-15,
    'common circular pitch',
  );
  near(
    geometry.pitchCenterDistance,
    geometry.driverPitchRadius + geometry.pinionPitchRadius,
    1e-15,
    'externally meshing pitch circles are tangent',
  );
  near(
    transmission.driverToPinionNominalRatio,
    -2,
    1e-15,
    'nominal tooth-count ratio',
  );
  near(
    transmission.pulleyRatio,
    geometry.smallPulleyRadius / geometry.largePulleyRadius,
    1e-15,
    'open-belt pulley ratio',
  );

  vector2Near(
    sourceAnchors.modeledSourceDriverShaftCenter,
    geometry.driverShaftCenter,
    1e-15,
    'fixed driver shaft anchor',
  );
  vector2Near(
    sourceAnchors.modeledSourceDriverPitchCenter,
    sourceState.driverPitchCenter,
    1e-15,
    'source-pose eccentric pitch center',
  );
  vector2Near(
    sourceAnchors.modeledSourcePinionCenter,
    sourceState.pinionCenter,
    1e-15,
    'source-pose carried pinion center',
  );
  vector2Near(
    sourceState.driverPitchCenter,
    new THREE.Vector2(-1.242, 2.799),
    1e-15,
    'pixel-fitted eccentric pitch center',
  );
  vector2Near(
    sourceState.pinionCenter,
    new THREE.Vector2(0.0135, 2.961),
    2e-15,
    'pixel-fitted pinion center',
  );
  vector2Near(
    geometry.carrierPivot,
    new THREE.Vector2(0, -0.9),
    1e-15,
    'pixel-fitted lower pivot',
  );
  near(
    sourceState.rodY,
    sourceAnchors.modeledSourceRodPin.y,
    1e-15,
    'modeled rod pin source height',
  );
  near(
    sourceState.rodY,
    -0.9 + (360 - 361) * geometry.sourceScale,
    0.023,
    'rod pin is within two source pixels of engraving',
  );
  near(
    sourceState.driverPitchCenter.distanceTo(sourceState.pinionCenter),
    geometry.pitchCenterDistance,
    2e-15,
    'source-pose gear center distance',
  );
  near(
    sourceState.pinionCenter.distanceTo(geometry.carrierPivot),
    geometry.carrierLength,
    2e-15,
    'source-pose rocker length',
  );
  assert.ok(Math.abs(sourceState.carrierAngle - Math.PI / 2) < 0.004);
  assert.ok(geometry.driverEccentricOffset.length() > geometry.pinionPitchRadius);
  disposeModel(model.root);
});

test('movement 201 exactly closes its gear, rocker, belt, slot, and one-turn constraints at 32,769 input poses', () => {
  const model = createMovementModel(catalog.movements[200]);
  const {
    geometry,
    stateAtDriverAngle,
    transmission,
  } = model.root.userData;
  const sourceState = stateAtDriverAngle(0);
  let carrierAngleMinimum = Infinity;
  let carrierAngleMaximum = -Infinity;
  let pinionAngularSpeedMinimum = Infinity;
  let pinionAngularSpeedMaximum = -Infinity;
  let largePulleyAngularSpeedMinimum = Infinity;
  let rodYMinimum = Infinity;
  let rodYMaximum = -Infinity;
  const sampleCount = 32768;

  for (let index = 0; index <= sampleCount; index += 1) {
    const driverAngle = -index / sampleCount * FULL_TURN;
    const state = stateAtDriverAngle(
      driverAngle,
      transmission.inputAngularSpeed,
    );
    if (index % 1024 === 0) finiteStateNumbers(state);
    near(state.rockerLengthError, 0, 2e-15, 'fixed rocker length');
    near(state.gearCenterDistanceError, 0, 4e-15, 'tangent pitch circles');
    near(
      state.meshSurfaceVelocityError,
      0,
      4e-15,
      'external mesh no-slip velocity',
    );
    near(state.meshPhaseError, 0, 4e-13, 'external mesh tooth phase');
    near(
      state.meshCoordinate,
      sourceState.meshCoordinate,
      4e-13,
      'constant external mesh coordinate',
    );
    near(state.beltNoSlipError, 0, 5e-16, 'open-belt no-slip relation');
    near(state.rodGuideError, 0, 1e-15, 'rod remains in vertical guide');
    near(state.slotRangeError, 0, 1e-15, 'follower remains within slot');
    near(
      state.pinionCenterVelocity.clone().sub(
        state.driverPitchCenterVelocity,
      ).dot(state.contactNormal),
      0,
      2e-15,
      'gear-center relative velocity is tangent to center-distance circle',
    );
    near(
      state.pinionCenterVelocity.dot(
        state.pinionCenter.clone().sub(geometry.carrierPivot),
      ),
      0,
      3e-15,
      'pinion center velocity is tangent to fixed-length rocker circle',
    );
    assert.ok(state.driverAngularSpeed < 0, 'eccentric driver turns clockwise');
    assert.ok(state.pinionAngularSpeed > 0, 'pinion rotates continually counterclockwise');
    assert.ok(
      state.largePulleyAngularSpeed > 0,
      'open belt turns large pulley counterclockwise with pinion',
    );
    assert.ok(
      state.slotCoordinate >= geometry.slotMinimumRadius - 1e-14
        && state.slotCoordinate <= geometry.slotMaximumRadius + 1e-14,
      'rod roller lies inside finite arm slot',
    );
    carrierAngleMinimum = Math.min(carrierAngleMinimum, state.carrierAngle);
    carrierAngleMaximum = Math.max(carrierAngleMaximum, state.carrierAngle);
    pinionAngularSpeedMinimum = Math.min(
      pinionAngularSpeedMinimum,
      state.pinionAngularSpeed,
    );
    pinionAngularSpeedMaximum = Math.max(
      pinionAngularSpeedMaximum,
      state.pinionAngularSpeed,
    );
    largePulleyAngularSpeedMinimum = Math.min(
      largePulleyAngularSpeedMinimum,
      state.largePulleyAngularSpeed,
    );
    rodYMinimum = Math.min(rodYMinimum, state.rodY);
    rodYMaximum = Math.max(rodYMaximum, state.rodY);
  }

  assert.ok(carrierAngleMaximum - carrierAngleMinimum > 0.26);
  assert.ok(carrierAngleMaximum - carrierAngleMinimum < 0.27);
  assert.ok(carrierAngleMinimum > 1.32);
  assert.ok(carrierAngleMaximum < 1.60);
  assert.ok(pinionAngularSpeedMinimum > 0.72);
  assert.ok(pinionAngularSpeedMaximum > 2.95);
  assert.ok(pinionAngularSpeedMaximum / pinionAngularSpeedMinimum > 4);
  assert.ok(largePulleyAngularSpeedMinimum > 0.22);
  assert.ok(rodYMaximum - rodYMinimum > 0.64);
  assert.ok(rodYMaximum - rodYMinimum < 0.65);
  near(
    carrierAngleMinimum,
    transmission.sampledExtrema.carrierAngleMinimum,
    2e-7,
    'reported carrier minimum',
  );
  near(
    carrierAngleMaximum,
    transmission.sampledExtrema.carrierAngleMaximum,
    2e-7,
    'reported carrier maximum',
  );

  const afterOneClockwiseTurn = stateAtDriverAngle(-FULL_TURN);
  vector2Near(
    afterOneClockwiseTurn.driverPitchCenter,
    sourceState.driverPitchCenter,
    1e-15,
    'eccentric center returns after one input turn',
  );
  vector2Near(
    afterOneClockwiseTurn.pinionCenter,
    sourceState.pinionCenter,
    2e-15,
    'carried pinion center returns after one input turn',
  );
  near(
    afterOneClockwiseTurn.carrierAngle,
    sourceState.carrierAngle,
    5e-16,
    'rocker returns after one input turn',
  );
  near(
    afterOneClockwiseTurn.rodY,
    sourceState.rodY,
    1e-15,
    'rod returns after one input turn',
  );
  near(
    afterOneClockwiseTurn.pinionAngle - sourceState.pinionAngle,
    2 * FULL_TURN,
    8e-15,
    'eight-tooth pinion completes two turns per sixteen-tooth input cycle',
  );
  near(
    afterOneClockwiseTurn.beltDistance - sourceState.beltDistance,
    -geometry.smallPulleyRadius * 2 * FULL_TURN,
    4e-15,
    'belt travel follows two pinion turns relative to returned carrier',
  );
  disposeModel(model.root);
});

test('movement 201 analytic velocities match finite differences throughout the irregular cycle', () => {
  const model = createMovementModel(catalog.movements[200]);
  const { stateAtDriverAngle, transmission } = model.root.userData;
  const angularSpeed = transmission.inputAngularSpeed;
  const timeStep = 1e-6;

  for (let index = 0; index <= 256; index += 1) {
    const angle = -index / 256 * FULL_TURN;
    const state = stateAtDriverAngle(angle, angularSpeed);
    const previous = stateAtDriverAngle(
      angle - angularSpeed * timeStep,
      angularSpeed,
    );
    const next = stateAtDriverAngle(
      angle + angularSpeed * timeStep,
      angularSpeed,
    );
    const derivative = (key) => (next[key] - previous[key]) / (2 * timeStep);
    const vectorDerivative = (key) => next[key].clone()
      .sub(previous[key])
      .multiplyScalar(1 / (2 * timeStep));

    near(
      derivative('carrierAngle'),
      state.carrierAngularSpeed,
      2e-9,
      'carrier angular speed derivative',
    );
    near(
      derivative('contactAngle'),
      state.contactAngularSpeed,
      2e-9,
      'contact-normal angular speed derivative',
    );
    near(
      derivative('pinionAngle'),
      state.pinionAngularSpeed,
      7e-9,
      'pinion angular speed derivative',
    );
    near(
      derivative('largePulleyAngle'),
      state.largePulleyAngularSpeed,
      5e-9,
      'large pulley angular speed derivative',
    );
    near(
      derivative('beltDistance'),
      state.beltLinearSpeed,
      4e-9,
      'belt linear speed derivative',
    );
    near(
      derivative('rodY'),
      state.rodVelocity,
      3e-9,
      'rod linear speed derivative',
    );
    vector2Near(
      vectorDerivative('driverPitchCenter'),
      state.driverPitchCenterVelocity,
      2e-9,
      'eccentric pitch-center velocity derivative',
    );
    vector2Near(
      vectorDerivative('pinionCenter'),
      state.pinionCenterVelocity,
      3e-9,
      'carried pinion-center velocity derivative',
    );
  }
  disposeModel(model.root);
});

test('movement 201 runtime poses use one tangent-continuous belt and remain distinct as the queue advances through 204', () => {
  const model = createMovementModel(catalog.movements[200]);
  const {
    blocks,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const beltCurve = blocks.belt.userData.curve;
  assert.equal(beltCurve.curves.length, 4);
  assert.ok(blocks.belt.userData.length > 14);
  for (let index = 0; index < beltCurve.curves.length; index += 1) {
    const current = beltCurve.curves[index];
    const next = beltCurve.curves[(index + 1) % beltCurve.curves.length];
    vector3Near(
      current.getTangent(1),
      next.getTangent(0),
      2e-15,
      `belt tangent continuity at line/arc junction ${index}`,
    );
  }

  // The belt is a laid rope: its moving lay, not white markers, shows travel.
  const beltMarkers = blocks.belt.children.filter(
    (child) => child.userData.isFlowMarker === true,
  );
  assert.equal(beltMarkers.length, 0);
  assert.equal(blocks.belt.userData.mesh.geometry.type, 'LaidRopeGeometry');
  const times = [
    0,
    0.317,
    1.211,
    transmission.inputCyclePeriod * 0.63,
    transmission.inputCyclePeriod,
    transmission.inputCyclePeriod * 2.2,
  ];
  for (const time of times) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    const pinionWorld = blocks.pinion.getWorldPosition(new THREE.Vector3());
    const smallPulleyWorld = blocks.smallPulley.getWorldPosition(
      new THREE.Vector3(),
    );
    const largePulleyWorld = blocks.largePulley.getWorldPosition(
      new THREE.Vector3(),
    );
    const rodWorld = blocks.rod.getWorldPosition(new THREE.Vector3());
    const contactMarkerWorld = blocks.gearContactMarker.getWorldPosition(
      new THREE.Vector3(),
    );
    vector2Near(
      pinionWorld,
      state.pinionCenter,
      2e-15,
      'runtime pinion center follows exact rocker solution',
    );
    vector2Near(
      smallPulleyWorld,
      state.pinionCenter,
      2e-15,
      'small pulley shares pinion shaft center',
    );
    vector2Near(
      largePulleyWorld,
      geometry.carrierPivot,
      2e-15,
      'large pulley remains on fixed rocker pivot',
    );
    near(rodWorld.x, geometry.rodGuideX, 1e-15, 'runtime rod fixed guide x');
    near(rodWorld.y, state.rodY, 1e-15, 'runtime rod y');
    vector2Near(
      contactMarkerWorld,
      state.gearContactPoint,
      2e-15,
      'runtime gear contact marker',
    );
    near(
      blocks.carrier.rotation.z,
      state.carrierRotation,
      1e-15,
      'runtime carrier rotation',
    );
    near(
      blocks.eccentricGear.userData.rotor.rotation.z,
      state.driverAngle,
      1e-15,
      'runtime eccentric gear angle',
    );
    near(
      blocks.carrier.rotation.z
        + blocks.pinion.userData.rotor.rotation.z,
      state.pinionAngle,
      2e-15,
      'runtime physical pinion angle',
    );
    near(
      blocks.carrier.rotation.z
        + blocks.smallPulley.userData.rotor.rotation.z,
      state.pinionAngle,
      2e-15,
      'runtime small pulley is rigid with pinion',
    );
    near(
      blocks.carrier.rotation.z
        + blocks.largePulley.userData.rotor.rotation.z,
      state.largePulleyAngle,
      2e-15,
      'runtime physical large pulley angle',
    );
    near(
      blocks.belt.userData.mesh.geometry.userData.travel,
      state.beltDistance,
      1e-9,
      'the rope lay follows the exact arc-length belt position',
    );
  }

  const nextMovement = catalog.movements[201];
  const nextModel = createMovementModel(nextMovement);
  const movement203 = catalog.movements[202];
  const model203 = createMovementModel(movement203);
  const movement204 = catalog.movements[203];
  const model204 = createMovementModel(movement204);
  const movement205 = catalog.movements[204];
  const model205 = createMovementModel(movement205);
  assert.equal(nextMovement.id, 202);
  assert.equal(nextMovement.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.mechanism, model.root.userData.mechanism);
  assert.equal(movement203.id, 203);
  assert.equal(movement203.fidelity, 'authored');
  assert.equal(model203.root.userData.fidelity, 'authored');
  assert.equal(movement204.id, 204);
  assert.equal(movement204.fidelity, 'authored');
  assert.equal(model204.root.userData.fidelity, 'authored');
  assert.equal(movement205.id, 205);
  assert.equal(movement205.fidelity, 'authored');
  assert.equal(model205.root.userData.fidelity, 'authored');
  disposeModel(model205.root);
  disposeModel(model204.root);
  disposeModel(model203.root);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
