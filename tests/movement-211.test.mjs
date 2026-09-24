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

test('movement 211 is one partial-tooth driver, one locking pinion, one entry pin, and one rigid guide', () => {
  const movement = catalog.movements[210];
  const model = createMovementModel(movement);
  const { blocks, geometry, transmission } = model.root.userData;

  assert.equal(movement.id, 211);
  assert.equal(movement.number, '211');
  assert.equal(
    movement.title,
    'Pin-Guided Half-Toothed Wheel and Locking Pinion',
  );
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'half-toothed-thirty-two-position-driver-pin-guided-sixteen-position-locking-pinion',
  );
  assert.match(movement.description, /serves as a lock/);
  assert.match(movement.description, /pin upon the wheel strikes the guide-piece/);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'single-entry-pin-starts-an-eleven-tooth-five-to-two-index-before-a-concave-pinion-pocket-locks-on-the-plain-driver-rim',
  );

  vector3Near(blocks.driver.userData.axis, Z_AXIS, 0, 'driver axis');
  vector3Near(blocks.pinion.userData.axis, Z_AXIS, 0, 'pinion axis');
  vector3Near(blocks.driverShaft.userData.axis, Z_AXIS, 0,
    'input shaft axis');
  vector3Near(blocks.pinionShaft.userData.axis, Z_AXIS, 0,
    'output shaft axis');
  near(blocks.driver.position.distanceTo(blocks.pinion.position),
    geometry.centerDistance, 0, 'shaft center distance');
  assert.equal(blocks.driverBody.userData.partialGearBody, true);
  assert.equal(blocks.pinionBody.userData.partialGearBody, true);
  assert.equal(blocks.guidePiece.parent, blocks.pinion.userData.rotor);
  assert.equal(blocks.guidePiece.userData.rigidWithPinion, true);
  assert.equal(blocks.driverPin.parent, blocks.driver.userData.rotor);
  assert.equal(blocks.driverBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(blocks.pinionBody.geometry.parameters.shapes.holes.length, 1);
  assert.equal(geometry.driverEquivalentToothCount, 40);
  assert.equal(geometry.driverInstalledToothCount, 11);
  assert.equal(geometry.pinionEquivalentToothCount, 16);
  assert.equal(geometry.pinionInstalledToothCount, 12);
  assert.equal(geometry.pinionMissingToothCenterAngles.length, 4);
  assert.equal(transmission.indexingSpeedRatio, -2.5);
  assert.equal(transmission.activeInputFraction, 0.4);

  const roles = [];
  let driverBodyCount = 0;
  let pinionBodyCount = 0;
  let entryPinCount = 0;
  let guideBodyCount = 0;
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.role
      === 'forty-position-wheel-with-eleven-teeth-and-plain-locking-rim') {
      driverBodyCount += 1;
    }
    if (object.userData.role
      === 'sixteen-position-pinion-with-twelve-teeth-and-concave-lock-pocket') {
      pinionBodyCount += 1;
    }
    if (object.userData.role === 'single-entry-driving-pin') entryPinCount += 1;
    if (object.userData.role === 'curved-entry-guide-body') guideBodyCount += 1;
  });
  assert.equal(driverBodyCount, 1);
  assert.equal(pinionBodyCount, 1);
  assert.equal(entryPinCount, 1);
  assert.equal(guideBodyCount, 1);
  assert.equal(
    roles.some((role) => /belt|pulley|rack|worm|bevel/.test(role)),
    false,
    'no unrelated transmission family is invented',
  );
  disposeModel(model.root);
});

test('movement 211 keeps Brown\'s fine 40:16 teeth, lock pocket, epicycloidal guide, and source centers', () => {
  const model = createMovementModel(catalog.movements[210]);
  const {
    geometry,
    sourceAnchors,
    sourceAnimation,
    sourceRaster,
  } = model.root.userData;

  near(geometry.driverPitchRadius + geometry.pinionPitchRadius,
    geometry.centerDistance, 0, 'pitch radii sum to center distance');
  near(geometry.driverPitchRadius / geometry.pinionPitchRadius, 2.5, 1e-15,
    'active pitch-radius ratio');
  near(geometry.driverPitchAngle, Math.PI / 20, 0,
    '40-position driver pitch (Brown draws about 9 degrees)');
  near(geometry.pinionPitchAngle, Math.PI / 8, 0,
    '16-position pinion pitch');
  near(geometry.driverToothedStartAngle - geometry.driverToothedEndAngle,
    Math.PI * 0.55, 5e-15, 'eleven driver positions span 99 degrees');
  near(geometry.meshEndAngle - geometry.meshStartAngle,
    Math.PI * 0.55, 5e-15, 'regular mesh spans 99 input degrees');
  near(geometry.pinionLockRadius - geometry.driverPlainRadius,
    geometry.lockRadialClearance, 0, 'nested-rim radial clearance');
  near(geometry.lockRadialClearance, 0.02875, 1e-15,
    'official one-eighth-unit lock clearance at model scale');
  near(THREE.MathUtils.radToDeg(geometry.lockAngularPlay),
    0.5968337349738867, 1e-12, 'positive-lock angular play');
  const scale = geometry.constructionScale;
  near(geometry.driverToothOuterRadius / scale, 60 / 7 + 0.8 * 6 / 7 / 2, 1e-12,
    'stub tooth tips');
  assert.ok(geometry.driverPlainRadius > geometry.driverToothOuterRadius,
    'the plain rim stands just proud of the tooth tips');
  assert.ok(
    geometry.driverPlainRadius - geometry.driverToothOuterRadius
      < 0.03 * geometry.driverPlainRadius,
    'as drawn, the plain rim steps out only slightly beyond the tips',
  );

  assert.ok(geometry.driverOutlineRaw.length >= 200);
  assert.ok(geometry.pinionOutlineRaw.length >= 100);
  assert.ok(geometry.guideOutlineRaw.length >= 100);
  for (const point of geometry.driverOutlineRaw) {
    assert.ok(point.length() <= geometry.driverPlainRadius / scale + 1e-9,
      'no part of the wheel stands beyond its plain rim');
  }
  for (const point of geometry.driverToothedProfileRaw) {
    assert.ok(point.length() <= geometry.driverToothOuterRadius / scale + 1e-9);
    assert.ok(point.length() >= geometry.driverRootRadius / scale - 1e-9);
  }
  const firstPinionPoint = geometry.pinionToothedProfileRaw[0];
  const lastPinionPoint = geometry.pinionToothedProfileRaw.at(-1);
  near(firstPinionPoint.length(), geometry.pinionRootRadius / scale, 1e-12,
    'lower lock-pocket corner on the root circle');
  near(lastPinionPoint.length(), geometry.pinionRootRadius / scale, 1e-12,
    'upper lock-pocket corner on the root circle');
  near(firstPinionPoint.y, -lastPinionPoint.y, 1e-12,
    'lock pocket is symmetric about the line of centres');
  assert.ok(
    geometry.pinionOutlineRaw.at(-1).distanceTo(
      geometry.pinionToothedProfileRaw[0],
    ) < 0.2,
    'concave lock arc closes back to the lower corner',
  );
  near(geometry.guideOutlineRaw[0].x, 1.75, 0, 'guide root construction point');
  assert.ok(
    Math.max(...geometry.guideOutlineRaw.map(({ x }) => x)) > 4.71,
    'guide reaches out along the entry pin path',
  );
  for (let index = 1; index < geometry.driverToothCenterAngles.length; index += 1) {
    near(
      geometry.driverToothCenterAngles[index - 1]
        - geometry.driverToothCenterAngles[index],
      geometry.driverPitchAngle,
      3e-16,
      `driver tooth pitch ${index}`,
    );
  }
  for (let index = 1; index < geometry.pinionToothCenterAngles.length; index += 1) {
    near(
      geometry.pinionToothCenterAngles[index - 1]
        - geometry.pinionToothCenterAngles[index],
      geometry.pinionPitchAngle,
      6e-16,
      `pinion tooth pitch ${index}`,
    );
  }
  assert.deepEqual(
    geometry.pinionMissingToothCenterAngles.map((angle) => (
      THREE.MathUtils.radToDeg(angle)
    )),
    [-33.75, -11.25, 11.25, 33.75],
  );

  assert.equal(sourceRaster.width, 525);
  assert.equal(sourceRaster.height, 525);
  assert.equal(sourceRaster.sourceUrl, 'https://507movements.com/mm_211.html');
  vector2Near(sourceAnchors.modeledDriverCenter,
    sourceAnchors.driverCenter, 0, 'source driver center');
  vector2Near(sourceAnchors.modeledPinionCenter,
    sourceAnchors.pinionCenter, 2e-14, 'source pinion center');
  near(sourceRaster.fittedDriverPlainRadius, 173.3818932, 0,
    'Brown raster plain-rim fit');
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.constructionDiffersSlightlyFromBrown, true);
  assert.deepEqual(sourceAnimation.indexingCycleInterval, [0, 0.5]);
  assert.deepEqual(sourceAnimation.lockedDwellCycleInterval, [0.5, 1]);
  assert.match(sourceAnimation.note, /prevent tooth jamming/);
  disposeModel(model.root);
});

test('movement 211 preserves every mesh, guide clearance, and lock constraint through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[210]);
  const {
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  let previousPinionAngle = Infinity;
  let minimumGuideClearance = Infinity;
  let maximumMeshPhaseError = 0;
  let maximumMeshVelocityError = 0;
  let maximumPitchTangencyError = 0;
  let maximumLockConcentricityError = 0;
  let guideEngagedStates = 0;
  let lockArcStates = 0;
  let indexingStates = 0;
  let dwellStates = 0;
  const stages = new Map();

  for (let index = 0; index <= 32768; index += 1) {
    const time = transmission.inputPeriod * index / 32768;
    const state = stateAtTime(time);
    finiteStateNumbers(state, `state[${index}]`);
    stages.set(state.stage, (stages.get(state.stage) ?? 0) + 1);
    assert.ok(
      state.pinionAngle <= previousPinionAngle + 2e-15,
      `pinion never reverses at state ${index}`,
    );
    previousPinionAngle = state.pinionAngle;
    minimumGuideClearance = Math.min(
      minimumGuideClearance,
      state.driverPinGuide.clearance,
    );
    assert.ok(
      state.driverPinGuide.clearance
        >= geometry.minimumGuideClearance - 5e-12,
      `entry pin never penetrates guide at state ${index}`,
    );
    if (state.driverPinGuide.engaged) guideEngagedStates += 1;

    if (state.indexing) {
      indexingStates += 1;
      near(state.pinionAngularSpeed,
        transmission.indexingSpeedRatio * state.driverAngularSpeed,
        0, `active ratio at state ${index}`);
      near(state.outputTurns,
        -(state.completedInputTurns + state.phase * 2.5 / FULL_TURN),
        1e-15, `index progress at state ${index}`);
      assert.equal(state.lock.active, false);
    } else {
      dwellStates += 1;
      near(state.pinionAngularSpeed, 0, 0,
        `zero dwell speed at state ${index}`);
      near(state.outputTurns, -(state.completedInputTurns + 1), 0,
        `held output turn at state ${index}`);
      assert.equal(state.lock.active, true);
      maximumLockConcentricityError = Math.max(
        maximumLockConcentricityError,
        state.lock.concentricityError,
      );
      near(state.lock.radialClearance,
        geometry.lockRadialClearance, 0,
        `lock clearance at state ${index}`);
      near(state.lock.angularPlay,
        geometry.lockAngularPlay, 0,
        `lock play at state ${index}`);
      if (state.lock.plainRimOnConstructedArc) lockArcStates += 1;
    }

    if (state.gearMesh.active) {
      maximumMeshPhaseError = Math.max(
        maximumMeshPhaseError,
        state.gearMesh.phaseError,
      );
      maximumMeshVelocityError = Math.max(
        maximumMeshVelocityError,
        state.gearMesh.velocityError,
      );
      maximumPitchTangencyError = Math.max(
        maximumPitchTangencyError,
        Math.abs(state.gearMesh.pitchTangencyError),
      );
      assert.ok(state.gearMesh.activeDriverToothIndex >= 0);
      assert.ok(
        state.gearMesh.activeDriverToothIndex
          < geometry.driverInstalledToothCount,
      );
      assert.ok(state.gearMesh.nearestPinionToothIndex >= 0);
      assert.ok(
        state.gearMesh.nearestPinionToothIndex
          < geometry.pinionInstalledToothCount,
      );
    } else {
      assert.equal(state.gearMesh.phaseError, null);
      assert.equal(state.gearMesh.velocityError, null);
    }
  }

  assert.ok(maximumMeshPhaseError < 1.8e-15);
  assert.ok(maximumMeshVelocityError < 4.5e-16);
  assert.ok(maximumPitchTangencyError < 2.3e-16);
  assert.ok(maximumLockConcentricityError < 7e-16);
  assert.ok(minimumGuideClearance > 0,
    'the official anti-jam construction retains positive pin clearance');
  near(minimumGuideClearance, geometry.minimumGuideClearance, 5e-9,
    'sampled closest guide pass');
  assert.equal(guideEngagedStates, 1959);
  assert.equal(indexingStates, 13109);
  assert.equal(dwellStates, 19660);
  assert.ok(lockArcStates > dwellStates * 0.97,
    'the plain circular rim occupies essentially the full locked dwell');
  assert.deepEqual(Object.fromEntries(stages), {
    'entry-pin-and-guide-transfer': 2049,
    'eleven-tooth-indexing-mesh': 9012,
    'relocking-transition': 2048,
    'plain-rim-locked-dwell': 19660,
  });
  disposeModel(model.root);
});

test('movement 211 has the exact two-to-one index, intentional speed jumps, half-turn dwell, and one-turn closure', () => {
  const model = createMovementModel(catalog.movements[210]);
  const {
    canonicalTimes,
    geometry,
    pinionAngleAtDriverAngle,
    stateAtDriverAngle,
    stateAtTime,
    transmission,
  } = model.root.userData;

  const indexArc = FULL_TURN / 2.5;
  near(
    (geometry.meshEndAngle - geometry.meshStartAngle) * 2.5,
    Math.PI * 1.375,
    1e-14,
    'eleven regular driver teeth turn the pinion through 247.5 degrees',
  );
  near(
    FULL_TURN - (geometry.meshEndAngle - geometry.meshStartAngle) * 2.5,
    Math.PI * 0.625,
    1e-14,
    'the guide and the relocking transition supply the other five positions',
  );
  near(canonicalTimes.lockEntry, transmission.inputPeriod * 0.4, 1e-14,
    'lock begins after two fifths of an input turn');
  near(canonicalTimes.midDwell, transmission.inputPeriod * 0.7, 1e-14,
    'mid-dwell time');

  const angleStep = 0.000001;
  for (let index = 1; index < 4096; index += 1) {
    const angle = FULL_TURN * index / 4096;
    if (Math.abs(angle - indexArc) < 0.01) continue;
    const state = stateAtDriverAngle(angle);
    const previous = pinionAngleAtDriverAngle(angle - angleStep);
    const next = pinionAngleAtDriverAngle(angle + angleStep);
    near(
      (next - previous) / (2 * angleStep),
      state.indexing ? -2.5 : 0,
      3e-9,
      `piecewise angular ratio at sample ${index}`,
    );
  }

  const firstMesh = stateAtTime(canonicalTimes.firstRegularToothContact);
  const midIndex = stateAtTime(canonicalTimes.midIndex);
  const lastMesh = stateAtTime(canonicalTimes.lastRegularToothContact);
  const lockEntry = stateAtTime(canonicalTimes.lockEntry);
  const midDwell = stateAtTime(canonicalTimes.midDwell);
  assert.equal(firstMesh.stage, 'eleven-tooth-indexing-mesh');
  assert.equal(firstMesh.gearMesh.active, true);
  assert.equal(midIndex.stage, 'eleven-tooth-indexing-mesh');
  assert.equal(midIndex.gearMesh.active, true);
  assert.equal(lastMesh.stage, 'eleven-tooth-indexing-mesh');
  assert.equal(lastMesh.gearMesh.active, true);
  assert.equal(lockEntry.stage, 'plain-rim-locked-dwell');
  assert.equal(lockEntry.lock.active, true);
  assert.equal(midDwell.stage, 'plain-rim-locked-dwell');
  assert.equal(midDwell.lock.active, true);
  near(midIndex.pinionAngle, -Math.PI, 0, 'half output turn at mid-index');
  near(lockEntry.pinionAngle, -FULL_TURN, 0,
    'one complete output turn at lock entry');
  near(midDwell.pinionAngle, -FULL_TURN, 0,
    'pinion remains positively held through dwell');

  const boundaryStep = 0.0000001;
  const beforeLock = stateAtDriverAngle(indexArc - boundaryStep);
  const afterLock = stateAtDriverAngle(indexArc + boundaryStep);
  near(beforeLock.pinionAngularSpeed,
    transmission.indexingSpeedRatio * transmission.inputAngularSpeed,
    0, 'pre-lock output speed');
  near(afterLock.pinionAngularSpeed, 0, 0, 'locked output speed');
  near(beforeLock.pinionAngle, afterLock.pinionAngle,
    boundaryStep * 2.6, 'position remains continuous at lock impact');
  const beforeStrike = stateAtDriverAngle(FULL_TURN - boundaryStep);
  const afterStrike = stateAtDriverAngle(FULL_TURN + boundaryStep);
  near(beforeStrike.pinionAngularSpeed, 0, 0, 'pre-strike dwell speed');
  near(afterStrike.pinionAngularSpeed,
    transmission.indexingSpeedRatio * transmission.inputAngularSpeed,
    0, 'post-strike indexing speed');
  near(beforeStrike.pinionAngle, afterStrike.pinionAngle,
    boundaryStep * 2.6, 'position remains continuous at entry strike');

  const closestGuide = stateAtTime(canonicalTimes.closestGuidePass);
  near(closestGuide.phase, geometry.closestGuidePhase, 4e-16,
    'optimized closest guide phase');
  near(closestGuide.driverPinGuide.clearance,
    geometry.minimumGuideClearance, 1e-14,
    'optimized closest guide clearance');
  assert.equal(closestGuide.driverPinGuide.engaged, true);

  const source = stateAtTime(canonicalTimes.sourcePinStrike);
  const closure = stateAtTime(canonicalTimes.cycleClosure);
  near(closure.driverAngle - source.driverAngle, FULL_TURN, 0,
    'one input turn at cycle closure');
  near(closure.pinionAngle - source.pinionAngle, -FULL_TURN, 0,
    'one opposite output turn at cycle closure');
  near(closure.outputTurns - source.outputTurns, -1, 0,
    'one intermittent output revolution per input revolution');
  near(closure.driverPinGuide.clearance,
    source.driverPinGuide.clearance, 3e-16,
    'entry geometry closes');
  disposeModel(model.root);
});

test('movement 211 renders rigid indices and exact pin/guide/lock poses while 212–213 stay distinct and authored', () => {
  const model = createMovementModel(catalog.movements[210]);
  const {
    blocks,
    canonicalTimes,
    geometry,
    stateAtTime,
  } = model.root.userData;
  const renderedTimes = [
    canonicalTimes.sourcePinStrike,
    canonicalTimes.closestGuidePass,
    canonicalTimes.firstRegularToothContact,
    canonicalTimes.midIndex,
    canonicalTimes.lastRegularToothContact,
    canonicalTimes.lockEntry,
    canonicalTimes.midDwell,
    canonicalTimes.cycleClosure,
  ];
  const sweptBounds = new THREE.Box3();

  for (const time of renderedTimes) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.driver.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered driver angle');
    near(blocks.driverShaft.userData.rotor.rotation.z,
      state.driverAngle, 0, 'rendered input shaft angle');
    near(blocks.pinion.userData.rotor.rotation.z,
      state.pinionAngle, 0, 'rendered pinion angle');
    near(blocks.pinionShaft.userData.rotor.rotation.z,
      state.pinionAngle, 0, 'rendered output shaft angle');
    assert.equal(blocks.guidePiece.userData.angularSpeed,
      state.pinionAngularSpeed);
    near(
      radialDistanceToAxis(
        blocks.driverIndexTip.getWorldPosition(new THREE.Vector3()),
        new THREE.Vector3(geometry.driverCenter.x, geometry.driverCenter.y, 0),
        Z_AXIS,
      ),
      1.255,
      2e-15,
      'driver index anchor remains rigid',
    );
    const pinionWorldCenter = new THREE.Vector3(
      geometry.pinionCenter.x,
      geometry.pinionCenter.y,
      0,
    );
    near(
      radialDistanceToAxis(
        blocks.pinionIndexTip.getWorldPosition(new THREE.Vector3()),
        pinionWorldCenter,
        Z_AXIS,
      ),
      0.64,
      2e-15,
      'pinion index anchor remains rigid',
    );
    const renderedPinCenter = blocks.driverPin.getWorldPosition(
      new THREE.Vector3(),
    );
    vector2Near(
      new THREE.Vector2(renderedPinCenter.x, renderedPinCenter.y),
      state.driverPinGuide.pinCenter,
      8e-16,
      'single entry pin follows the driver rigidly',
    );
    sweptBounds.union(new THREE.Box3().setFromObject(model.root));
  }

  model.update(canonicalTimes.lockEntry);
  const pinionAtLockEntry = blocks.pinion.userData.rotor.rotation.z;
  model.update(canonicalTimes.midDwell);
  near(blocks.pinion.userData.rotor.rotation.z,
    pinionAtLockEntry, 0, 'pinion is visibly stationary through dwell');
  assert.equal(model.root.userData.contacts.lockingPocket.active, true);
  assert.equal(model.root.userData.contacts.toothedMesh, null);

  const sweptSize = sweptBounds.getSize(new THREE.Vector3());
  assert.ok(sweptSize.x > 6, 'two wheels fill the width');
  assert.ok(sweptSize.y > 4.4, 'partial wheel profiles sweep real height');
  assert.ok(sweptSize.z > 1.05, 'shafts, bodies, pin, and guide use real depth');
  assert.ok(sweptBounds.min.x < -3.7);
  assert.ok(sweptBounds.max.x > 2.2);
  assert.ok(sweptBounds.min.y < -2.2);
  assert.ok(sweptBounds.max.y > 2.2);
  let meshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    assert.doesNotMatch(object.userData.role ?? '', /frame|post|rail|foot|bearing|marker|radial-.*index|face-index/,
      'Brown draws no stand, bearings or painted indexes');
  });
  assert.equal(meshCount, 10);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 6, 'near-front elevation like the plate');

  const movement210 = createMovementModel(catalog.movements[209]);
  const movement212 = createMovementModel(catalog.movements[211]);
  const movement213 = createMovementModel(catalog.movements[212]);
  assert.equal(catalog.movements[209].id, 210);
  assert.equal(catalog.movements[209].fidelity, 'authored');
  assert.equal(movement210.root.userData.fidelity, 'authored');
  assert.notEqual(movement210.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[211].id, 212);
  assert.equal(catalog.movements[211].fidelity, 'authored');
  assert.equal(movement212.root.userData.fidelity, 'authored');
  assert.notEqual(movement212.root.userData.archetype,
    model.root.userData.archetype);
  assert.equal(catalog.movements[212].id, 213);
  assert.equal(catalog.movements[212].fidelity, 'authored');
  assert.equal(movement213.root.userData.fidelity, 'authored');
  disposeModel(movement210.root);
  disposeModel(movement212.root);
  disposeModel(movement213.root);
  disposeModel(model.root);
});
