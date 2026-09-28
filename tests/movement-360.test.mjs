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
  // Brown hatches both cords: shared laid rope, no painted markers.
  for (const cord of [blocks.driveCord, blocks.counterweightCord]) {
    assert.equal(cord.userData.markers.length, 0);
    assert.equal(cord.userData.crossSection, 'laid-rope');
  }

  const roles = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
  });
  for (const role of [
    'externally-vibrated-double-sector-beam',
    'rocking-beam-double-sector-plate',
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
  // Brown's twenty-tooth ratchet advances seven teeth per beam cycle.
  near(states[4].flywheelAngle - states[0].flywheelAngle, Math.PI * .7, 2e-12,
    'seven teeth after one beam cycle');
  near(states[8].flywheelAngle - states[0].flywheelAngle, Math.PI * 1.4, 2e-12,
    'continuous fourteen-tooth output over the demonstration');
  near(
    dynamics.flywheelAdvancePerBeamCycle,
    Math.PI * .7,
    2e-12,
    'flywheel advance per beam cycle',
  );
  near(dynamics.flywheelAdvancePerCycle, FULL_TURN * .7, 2e-12,
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

test('movement 360 opens on Brown\'s level beam', () => {
  const model = createMovementModel(catalog.movements[359]);
  model.update(0);
  assert.ok(Math.abs(model.root.userData.blocks.rockingBeam.rotation.z) < 1e-9);
});

test('movement 360 renderer binds both cord ends and all rotating bodies to their proper carriers', () => {
  const model = createMovementModel(catalog.movements[359]);
  const data = model.root.userData;
  const { blocks, geometry } = data;
  let pawlBaseRotation;

  for (const time of [0, 0.73, 1.5, 2.86, 3, 4.5, 5.99,
    6, 7.5, 9, 10.5, 11.7]) {
    // Display time runs displayTimeOffset ahead of the physical timeline, so
    // time 0 shows Brown's level beam.
    const expected = data.stateAtTime(time + data.timeline.displayTimeOffset);
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
        expected.counterweightCord.z,
      ),
      3e-12,
      `counterweight tail at ${time}`,
    );

    for (const cord of [blocks.driveCord, blocks.counterweightCord]) {
      near(cord.userData.length, cord.userData.materialLength, 2e-12,
        `material cord length at ${time}`);
      // Both ends are tied: the lay keeps its material coordinate.
      assert.equal(cord.children.at(-1).geometry.userData.travel, 0);
      const positions = cord.children.at(-1).geometry.attributes.position;
      for (const value of positions.array) assert.ok(Number.isFinite(value));
    }
  }
  disposeModel(model.root);
});

test('movement 360 cord material points remain continuous for 1,200 rendered frames and close exactly', () => {
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
    // Fixed material points on the laid cords (formerly marker spheres).
    const positions = [
      ...[1, 2, 3, 4, 5, 6, 7].map((i) => blocks.driveCord.userData.curve.getPointAt(i / 8)),
      ...[1, 2, 3, 4].map((i) => blocks.counterweightCord.userData.curve.getPointAt(i / 5)),
    ];
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

test('movement 360 (pass 92): the upright has a round top concentric with the beam pivot pin', () => {
  const model = createMovementModel(catalog.movements[359]);
  try {
    model.root.updateMatrixWorld(true);
    let post = null;
    model.root.traverse((o) => { if (o.userData.role === 'beam-pivot-upright') post = o; });
    assert.ok(post?.isMesh, 'upright is one mesh');
    const pin = model.root.userData.blocks.beamPivotPin;
    const axis = pin.getWorldPosition(new THREE.Vector3());
    const pinRadius = pin.geometry.parameters.radiusTop;
    const p = post.geometry.attributes.position, v = new THREE.Vector3();
    let top = 0;
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(post.matrixWorld);
      if (v.y > axis.y + 1e-9) top = Math.max(top, Math.hypot(v.x - axis.x, v.y - axis.y));
    }
    assert.ok(top > 1.4 * pinRadius && top < 0.16, `round top radius ${top} about the ${pinRadius} pin`);
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i).applyMatrix4(post.matrixWorld);
      if (v.y > axis.y + 1e-9) near(Math.hypot(v.x - axis.x, v.y - axis.y), top, 1e-6, 'top is an arc about the pin');
    }
  } finally {
    disposeModel(model.root);
  }
});

test('movement 360 carries the pawl eye on a round drum boss concentric with its pin', () => {
  const model = createMovementModel(catalog.movements[359]);
  const { blocks } = model.root.userData;
  const boss = blocks.pawlPivotBoss;
  assert.ok(boss, 'pawl pivot boss exists');
  assert.equal(boss.parent, blocks.looseDrum, 'boss is rigid with the drum');
  for (let sample = 0; sample <= 48; sample += 1) {
    model.update(12 * sample / 48);
    model.root.updateMatrixWorld(true);
    const pin = blocks.pawlHinge.getWorldPosition(new THREE.Vector3());
    const bossBox = new THREE.Box3().setFromObject(boss);
    const pawlBox = new THREE.Box3().setFromObject(blocks.pawlArm);
    // The pawl's back face lies just in front of the boss face.
    assert.ok(pawlBox.min.z - bossBox.max.z > 0.005 && pawlBox.min.z - bossBox.max.z < 0.02);
    const local = blocks.looseDrum.worldToLocal(pin.clone());
    // The eye (r 0.0575) lies wholly on the boss (r 0.10) round the pin.
    assert.ok(Math.hypot(local.x, local.y) < 0.595 - 0.0575, 'eye inside the rim bore');
    assert.ok(bossBox.containsPoint(pin.clone().setZ((bossBox.min.z + bossBox.max.z) / 2)), 'pin passes through the boss');
  }
  disposeModel(model.root);
});

test('movement 360 (pass 94): the pawl falls from each passed tip over several frames, never in one', async () => {
  const { drumPawl } = await import('../src/simulation/oscillating-drum-pawl-data.js');
  const { drumContact } = await import('../src/simulation/oscillating-drum-contact.js');
  const model = createMovementModel(catalog.movements[359]);
  const data = model.root.userData;
  const { fall } = drumPawl;
  assert.equal(fall.lifts.length, Math.round(drumContact.period / fall.dt) + 1);
  assert.equal(fall.lifts[0], 0, 'seated at capture');
  assert.equal(fall.lifts.at(-1), 0, 'seated again at the next capture');
  assert.equal(data.dynamics.pawlReturnAcceleration, fall.returnAcceleration);
  // At 60 frames per second of physical time no frame moves the pawl more
  // than 0.1 rad; the least-clearance table used to snap 0.2 rad in one.
  let largest = 0;
  for (let i = 0; i < 6 * 60 * 4; i++) {
    const t = i / 240;
    largest = Math.max(largest, Math.abs(data.stateAtTime(t + 1 / 60).pawlLift - data.stateAtTime(t).pawlLift));
  }
  assert.ok(largest < 0.1, `largest per-frame lift change ${largest}`);
  // Seven tips pass per oscillation; each fall from the tip takes at least 0.06 s.
  const falls = [];
  let start = null;
  for (let i = 1; i < fall.lifts.length; i++) {
    const falling = fall.lifts[i] < fall.lifts[i - 1] - 2e-3;
    if (falling && start === null) start = i - 1;
    if (!falling && start !== null) { falls.push({ duration: (i - 1 - start) * fall.dt, drop: fall.lifts[start] - fall.lifts[i - 1] }); start = null; }
  }
  const tipFalls = falls.filter((f) => f.drop > 0.1);
  assert.equal(tipFalls.length, 7);
  for (const f of tipFalls) assert.ok(f.duration >= 0.06, `fall of ${f.drop} took ${f.duration} s`);
  disposeModel(model.root);
});
