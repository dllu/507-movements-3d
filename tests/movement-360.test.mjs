import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
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

test('movement 360 separates the loose oscillating drum from the shaft-fast ratchet and flywheel', () => {
  const movement = catalog.movements[359];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 360);
  assert.equal(movement.number, '360');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'oscillating-loose-drum-flywheel-ratchet',
  );
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /oscillating-cord-drum/);
  assert.match(data.mechanism, /drum-mounted-pawl/);
  assert.match(data.mechanism, /shaft-fixed-ratchet/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.match(degreesOfFreedom.input, /rocking beam/);
  assert.match(degreesOfFreedom.note, /prescribed periodic capture\/coast history/);

  assert.equal(blocks.looseDrum.parent, model.root);
  assert.equal(blocks.flywheelRotor.parent, model.root);
  assert.notEqual(blocks.looseDrum, blocks.flywheelRotor);
  assert.equal(blocks.drumBody.parent, blocks.looseDrum);
  // Brown draws no white indices; the source presentation detaches them.
  assert.equal(blocks.drumIndex.parent, null);
  assert.equal(blocks.pawlHinge.parent, blocks.looseDrum);
  assert.equal(blocks.pawlArm.parent, blocks.pawlHinge);
  assert.equal(blocks.pawlTip.parent, blocks.pawlHinge);
  assert.equal(blocks.ratchetWheel.parent, blocks.flywheelRotor);
  assert.equal(blocks.flywheelRim.parent, blocks.flywheelRotor);
  assert.equal(blocks.flywheelIndex.parent, null);
  assert.equal(blocks.rockingBeam.parent, model.root);
  assert.equal(blocks.driveCord.parent, model.root);
  assert.equal(blocks.counterweightCord.parent, model.root);
  assert.equal(blocks.driveCord.userData.closed, false);
  assert.equal(blocks.counterweightCord.userData.closed, false);
  assert.equal(blocks.driveCord.userData.markers.length, 7);
  assert.equal(blocks.counterweightCord.userData.markers.length, 4);

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'externally-vibrated-double-sector-beam',
    'right-circular-cord-sector-on-rocking-beam',
    'cord-drum-loose-on-flywheel-shaft',
    'pawl-pivot-rigidly-carried-by-loose-drum',
    'ratchet-wheel-fast-on-flywheel-shaft',
    'heavy-continuously-rotating-flywheel-rim',
    'one-inextensible-beam-to-drum-drive-cord',
    'hanging-balance-weight-on-left-cord',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.some((role) => role.startsWith('white-')),
    'Brown draws no white indices');
  disposeModel(model.root);
});

test('movement 360 records exactly what Brown fixes and marks its absent source timing', () => {
  const movement = catalog.movements[359];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate360;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_360.html');
  assert.match(movement.description, /Continuous rotary motion from oscillating/);
  assert.match(movement.description, /working loose on fly-wheel shaft/);
  assert.match(movement.description, /pawl being attached to drum/);
  assert.match(movement.description, /ratchet-wheel fast on shaft/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesInertiaOrLoad, false);
  assert.match(data.timeline.note, /Brown supplies no angle, inertia, load, or timing/);
  assert.match(data.timeline.note, /does not claim.*speed ratio/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.beamPivot.toArray(), [210, 114]);
  assert.deepEqual(plate.leftCordTangent.toArray(), [29, 113]);
  assert.deepEqual(plate.rightCordTangent.toArray(), [388, 160]);
  assert.deepEqual(plate.drumCenter.toArray(), [328, 307]);
  assert.deepEqual(plate.pawlPivot.toArray(), [303, 247]);
  assert.deepEqual(plate.ratchetCenter.toArray(), [328, 315]);
  assert.deepEqual(plate.flywheelCenter.toArray(), [326, 308]);
  assert.deepEqual(plate.flywheelRight.toArray(), [504, 308]);
  assert.deepEqual(plate.flywheelBottom.toArray(), [326, 484]);

  const evidence = sourceReference.constructionEvidence;
  assert.deepEqual(evidence.explicitInBrownDescription, [
    'beam vibrates',
    'cord is attached to drum',
    'drum is loose on flywheel shaft',
    'pawl is attached to drum',
    'ratchet wheel is fast on shaft',
  ]);
  assert.match(evidence.inference, /one rotor/);
  assert.match(evidence.inference, /distinct oscillating carrier/);
  disposeModel(model.root);
});

test('movement 360 exchanges exact arc length between its circular beam sector and loose drum', () => {
  const model = createMovementModel(catalog.movements[359]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;

  for (let index = 0; index <= 160; index += 1) {
    const time = geometry.cyclePeriod * index / 160;
    const state = stateAtTime(time);
    near(
      geometry.sectorRadius * state.beamAngle,
      geometry.drumRadius * state.drumAngle,
      3e-13,
      `angle no-slip law at ${time}`,
    );
    near(
      geometry.sectorRadius * state.beamAngularSpeed,
      geometry.drumRadius * state.drumAngularSpeed,
      3e-13,
      `velocity no-slip law at ${time}`,
    );
    near(state.drumAngle, geometry.drumRatio * state.beamAngle,
      3e-13, `drum ratio at ${time}`);
    near(
      state.driveCord.sectorArcLength
        + state.driveCord.verticalLength
        + state.driveCord.drumArcLength,
      geometry.driveCordLength,
      1e-12,
      `working cord sum at ${time}`,
    );
    near(state.driveCord.totalLength, geometry.driveCordLength, 1e-12,
      `working cord length at ${time}`);
    near(
      state.counterweightCord.sectorArcLength
        + state.counterweightCord.verticalLength,
      geometry.counterweightCordLength,
      1e-12,
      `counterweight cord sum at ${time}`,
    );
    near(
      state.counterweightCord.totalLength,
      geometry.counterweightCordLength,
      1e-12,
      `counterweight cord length at ${time}`,
    );
  }

  for (const angle of [-geometry.beamAmplitude, -0.1, 0, 0.1,
    geometry.beamAmplitude]) {
    const drive = data.cordGeometry.driveCordAtBeamAngle(angle);
    const counter = data.cordGeometry.counterweightCordAtBeamAngle(angle);
    near(drive.totalLength, geometry.driveCordLength, 1e-12,
      `direct drive-cord query ${angle}`);
    near(counter.totalLength, geometry.counterweightCordLength, 1e-12,
      `direct counterweight-cord query ${angle}`);
  }
  assert.match(data.transmission.driveCordLaw, /constant/);
  assert.match(data.transmission.counterweightCordLaw, /constant/);
  assert.match(data.transmission.looseDrumLaw,
    /sectorRadius \* beamAngle = drumRadius \* drumAngle/);
  disposeModel(model.root);
});

test('movement 360 reverses the loose drum twice per beam cycle while its flywheel remains positive', () => {
  const model = createMovementModel(catalog.movements[359]);
  const data = model.root.userData;
  const { dynamics, geometry, stateAtTime, timeline } = data;
  const beamPeriod = geometry.beamOscillationPeriod;
  const states = [0, beamPeriod / 4, beamPeriod / 2,
    beamPeriod * 3 / 4, beamPeriod, beamPeriod * 5 / 4,
    beamPeriod * 3 / 2, beamPeriod * 7 / 4, geometry.cyclePeriod]
    .map(stateAtTime);

  near(states[0].beamAngle, -geometry.beamAmplitude, 1e-12,
    'first beam extreme');
  near(states[1].beamAngle, 0, 3e-15, 'first sector midpoint');
  near(states[2].beamAngle, geometry.beamAmplitude, 1e-12,
    'opposite beam extreme');
  near(states[3].beamAngle, 0, 3e-15, 'first return midpoint');
  near(states[4].beamAngle, -geometry.beamAmplitude, 1e-12,
    'second-cycle beam extreme');
  assert.ok(states[1].drumAngularSpeed > 0);
  assert.ok(states[3].drumAngularSpeed < 0);
  assert.ok(states[5].drumAngularSpeed > 0);
  assert.ok(states[7].drumAngularSpeed < 0);
  states.forEach((state) => {
    assert.ok(state.flywheelAngularSpeed > 0);
    assert.equal(state.flywheelDirection, 'positive continuous rotation');
  });
  near(states[4].flywheelAngle - states[0].flywheelAngle, Math.PI * .75, 2e-12,
    'six teeth after one beam cycle');
  near(states[8].flywheelAngle - states[0].flywheelAngle, Math.PI * 1.5, 2e-12,
    'continuous twelve-tooth output over the demonstration');
  near(
    dynamics.flywheelAdvancePerBeamCycle,
    Math.PI * .75,
    2e-12,
    'flywheel advance per beam cycle',
  );
  near(dynamics.flywheelAdvancePerCycle, FULL_TURN * .75, 2e-12,
    'flywheel advance per demonstration');
  assert.equal(states[1].carrierCatching, true);
  assert.match(states[1].pawlMode, /driving locked/);
  assert.equal(states[3].carrierCatching, false);
  assert.match(states[3].pawlMode, /overrunning/);
  assert.deepEqual(timeline.driveStrokeMidpoints, [1.5, 7.5]);
  assert.deepEqual(timeline.oppositeDrumReversals, [3, 9]);
  assert.deepEqual(timeline.returnStrokeMidpoints, [4.5, 10.5]);
  assert.match(data.transmission.ratchetLaw, /only in the positive sense/);
  assert.match(data.transmission.shaftLaw, /never follow the drum reversal/);

  let previousAngle = -Infinity;
  for (let index = 0; index < 600; index += 1) {
    const state = stateAtTime(geometry.cyclePeriod * index / 600);
    assert.ok(state.flywheelAngle >= previousAngle - 1e-12);
    previousAngle = state.flywheelAngle;
  }
  disposeModel(model.root);
});

test('movement 360 renderer binds both cord ends and all rotating bodies to their proper carriers', () => {
  const model = createMovementModel(catalog.movements[359]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  let pawlBaseRotation;

  for (const time of [0, 0.73, 1.5, 2.86, 3, 4.5, 5.99,
    6, 7.5, 9, 10.5, 11.7]) {
    const expected = data.stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.rockingBeam.rotation.z, expected.beamAngle, 2e-12,
      `beam angle at ${time}`);
    near(blocks.looseDrum.rotation.z, expected.drumAngle, 2e-12,
      `loose drum angle at ${time}`);
    near(blocks.flywheelRotor.rotation.z, expected.flywheelAngle, 2e-12,
      `flywheel angle at ${time}`);
    near(blocks.counterweight.position.y, expected.counterweightCenterY,
      2e-12, `counterweight at ${time}`);
    const currentPawlBase = blocks.pawlHinge.rotation.z + expected.pawlLift;
    pawlBaseRotation ??= currentPawlBase;
    near(currentPawlBase, pawlBaseRotation, 2e-12,
      `pawl carrier rest angle at ${time}`);
    assert.equal(data.currentState.pawlMode, expected.pawlMode);

    const driveCurve = blocks.driveCord.userData.curve;
    vectorNear(
      driveCurve.getPointAt(0),
      blocks.rightCordKnot.getWorldPosition(new THREE.Vector3()),
      3e-12,
      `right-sector cord end at ${time}`,
    );
    vectorNear(
      driveCurve.getPointAt(1),
      blocks.drumCordKnot.getWorldPosition(new THREE.Vector3()),
      3e-12,
      `loose-drum cord end at ${time}`,
    );
    const counterCurve = blocks.counterweightCord.userData.curve;
    vectorNear(
      counterCurve.getPointAt(0),
      blocks.leftCordKnot.getWorldPosition(new THREE.Vector3()),
      3e-12,
      `left-sector cord end at ${time}`,
    );
    vectorNear(
      counterCurve.getPointAt(1),
      new THREE.Vector3(
        expected.counterweightCord.tangentX,
        expected.counterweightCord.tailY,
        geometry.cordZ,
      ),
      3e-12,
      `counterweight tail at ${time}`,
    );

    for (const cord of [blocks.driveCord, blocks.counterweightCord]) {
      near(cord.userData.length, cord.userData.materialLength, 2e-12,
        `material cord length at ${time}`);
      const divisor = cord.userData.markers.length + 1;
      cord.userData.markers.forEach((marker, index) => {
        vectorNear(
          marker.position,
          cord.userData.curve.getPointAt((index + 1) / divisor),
          2e-12,
          `fixed marker ${index} at ${time}`,
        );
      });
      const positions = cord.children.at(-1).geometry.attributes.position;
      for (const value of positions.array) assert.ok(Number.isFinite(value));
    }
  }
  disposeModel(model.root);
});

test('movement 360 cord markers remain continuous for 1,200 rendered frames and close exactly', () => {
  const model = createMovementModel(catalog.movements[359]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  const initialPositions = [];
  let previousPositions = null;
  let maximumStep = 0;
  let maximumLengthError = 0;
  let drivingFrames = 0;
  let overrunningFrames = 0;

  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.cyclePeriod * frame / 1200;
    model.update(time);
    if (data.currentState.pawlMode.startsWith('driving')) drivingFrames += 1;
    else overrunningFrames += 1;
    const positions = [
      ...blocks.driveCord.userData.markers,
      ...blocks.counterweightCord.userData.markers,
    ].map((marker) => marker.position.clone());
    if (frame === 0) {
      positions.forEach((position) => initialPositions.push(position.clone()));
    }
    if (previousPositions) {
      positions.forEach((position, index) => {
        maximumStep = Math.max(
          maximumStep,
          position.distanceTo(previousPositions[index]),
        );
      });
    }
    previousPositions = positions;
    for (const cord of [blocks.driveCord, blocks.counterweightCord]) {
      maximumLengthError = Math.max(
        maximumLengthError,
        Math.abs(cord.userData.length - cord.userData.materialLength),
      );
    }
  }

  assert.ok(drivingFrames > 0);
  assert.ok(overrunningFrames > 0);
  assert.ok(maximumStep < 0.007, `maximum marker step ${maximumStep}`);
  assert.ok(maximumLengthError < 2e-12,
    `maximum cord-length error ${maximumLengthError}`);
  previousPositions.forEach((position, index) => {
    vectorNear(position, initialPositions[index], 2e-11,
      `marker ${index} cycle closure`);
  });
  disposeModel(model.root);
});

test('movement 360 is reviewed while movement 507 remains the next authored draft', () => {
  const movement360 = catalog.movements[359];
  const movement507 = catalog.movements[506];
  assert.equal(movement360.id, 360);
  assert.equal(movement360.fidelity, 'authored');
  assert.equal(
    movement360.archetype,
    'oscillating-loose-drum-flywheel-ratchet',
  );
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
});
