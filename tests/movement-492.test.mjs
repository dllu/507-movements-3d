import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(
  new URL('../src/data/movements.json', import.meta.url),
  'utf8',
));
const sourceText = await readFile(
  new URL(
    '../src/simulation/authored-boat-detachers.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'paired-eye-lever-boat-detachers-with-hinged-load-tongues';

function movementModel() {
  const movement = catalog.movements[491];
  return { model: createMovementModel(movement), movement };
}

function near(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function vectorNear(actual, expected, tolerance, message) {
  near(actual.distanceTo(expected), 0, tolerance, message);
}

function cableEndpoints(cable) {
  const visible = cable.children.filter((segment) => segment.visible);
  assert.ok(visible.length > 0, `${cable.userData.role} has segments`);
  cable.updateWorldMatrix(true, true);
  return {
    end: new THREE.Vector3(0, 0.5, 0)
      .applyMatrix4(visible.at(-1).matrixWorld),
    start: new THREE.Vector3(0, -0.5, 0)
      .applyMatrix4(visible[0].matrixWorld),
  };
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

test('movement 492 has one eye-lever detacher at each boat end and no belt', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 492);
  assert.equal(movement.number, '492');
  assert.equal(movement.title, 'Boat-detaching hook (Brown & Level’s)');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.units.length, 2);
  assert.deepEqual(
    blocks.units.map(({ unitZ }) => unitZ),
    geometry.unitZPositions,
  );
  assert.equal(blocks.releaseCords.length, 2);
  assert.equal(degreesOfFreedom.independentReleaseInputs, 1);
  assert.equal(degreesOfFreedom.leverCoordinatesPerUnit, 1);
  assert.equal(degreesOfFreedom.tongueCoordinatesPerUnit, 1);
  assert.equal(degreesOfFreedom.tackleHookFreeAfterReleasePerUnit, 1);
  assert.equal(degreesOfFreedom.unitsCommandedSynchronously, true);

  for (const unit of blocks.units) {
    assert.equal(unit.standard.parent, unit.unit);
    assert.equal(unit.lever.parent, unit.unit);
    assert.equal(unit.tongue.parent, unit.unit);
    assert.notEqual(unit.lever, unit.tongue);
    assert.equal(unit.upperEye.parent, unit.lever);
    assert.equal(unit.lowerEye.parent, unit.lever);
    assert.equal(unit.lockingStud.parent, unit.tongue);
    assert.equal(unit.tonguePivotPin.parent, unit.unit);
    assert.equal(unit.leverPivotPin.parent, unit.unit);
    assert.equal(unit.tackleHookAssembly.parent, unit.unit);
    assert.equal(unit.tackleHook.parent, unit.tackleHookAssembly);
    assert.equal(unit.fallRope.parent, unit.unit);
    assert.notEqual(unit.tackleHookAssembly, unit.tongue);
  }
  assert.equal(blocks.pullBar.parent, model.root);
  assert.equal(blocks.pullBarGrip.parent, model.root);
  assert.ok(blocks.releaseCords.every(
    (cord) => cord.parent === model.root && cord.userData.isReleaseRope,
  ));

  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeBelt|beltPath|pulley/i);
  disposeModel(model.root);
});

test('movement 492 records Brown, unavailable animation, and period detaching-hook evidence', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate492;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_492.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /upright standard is secured to the boat.*tongue hinged to its upper end.*eye in the level.*fulcrum at the middle.*each end of the boat.*hooks of the tackles hook into the tongues.*rope attached to the lower end of each lever.*detaches the boat/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /no canvas model or animation library.*Animated unavailable/s);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateTongueHingePixels, [247, 151]);
  assert.deepEqual(plate.approximateLeverFulcrumPixels, [248, 239]);
  assert.deepEqual(plate.approximateLowerRopeEyePixels, [368, 422]);
  assert.deepEqual(plate.approximateTackleHookBoundsPixels,
    [181, 34, 284, 217]);
  assert.equal(evidence.explicitInBrownDescription.length, 9);
  assert.match(evidence.engravingEvidence,
    /threaded standard with two hinge centers.*upper hinged tongue.*tackle hook around its load nose.*separate bent lever.*middle fulcrum.*lower rope eye/s);
  assert.match(evidence.britishPatentNotice,
    /British application 3228.*7 December 1866.*detaching hook.*Samuel Brown and Leon Level/s);
  assert.match(evidence.frankLeslieCorroboration,
    /24 February 1866.*one oarsman amidships.*instantly disconnected.*two davits/s);
  assert.match(evidence.relatedPatentScope,
    /companion equal-fall lowering brake rather than this hook.*paired tackle falls.*one operator/s);
  assert.match(evidence.reconstructionDisclosure,
    /only one locked elevation.*exact eye clearance.*common pull bar.*didactic reset.*independently engineered/s);
  disposeModel(model.root);
});

test('movement 492 lever eye clears the locked tongue stud at the exact chord angle', () => {
  const { model } = movementModel();
  const {
    geometry,
    leverEyeCenterAtAngle,
    stateAtTime,
    tongueStudCenterAtAngle,
    transmission,
  } = model.root.userData;
  const radius = geometry.upperEyeVector.length();

  vectorNear(
    leverEyeCenterAtAngle(0),
    geometry.lockedStudCenter,
    0,
    'locked eye and tongue stud are concentric',
  );
  vectorNear(
    tongueStudCenterAtAngle(0),
    geometry.lockedStudCenter,
    0,
    'locked tongue carries the same stud center',
  );
  near(
    geometry.eyeClearDistance,
    geometry.upperEyeInnerRadius + geometry.tongueStudRadius,
    0,
    'clearance distance is the sum of eye and stud radii',
  );

  for (let sample = 0; sample <= 300; sample += 1) {
    const angle = geometry.leverReleaseAngle * sample / 300;
    const centerDistance = leverEyeCenterAtAngle(angle)
      .distanceTo(geometry.lockedStudCenter);
    near(
      centerDistance,
      2 * radius * Math.sin(angle / 2),
      5e-16,
      `eye-center chord at sample ${sample}`,
    );
  }
  near(
    leverEyeCenterAtAngle(geometry.leverEyeClearAngle)
      .distanceTo(geometry.lockedStudCenter),
    geometry.eyeClearDistance,
    3e-16,
    'exact tangent-clear angle',
  );
  assert.ok(
    leverEyeCenterAtAngle(geometry.leverEyeClearAngle - 1e-7)
      .distanceTo(geometry.lockedStudCenter)
      < geometry.eyeClearDistance,
  );
  assert.ok(
    leverEyeCenterAtAngle(geometry.leverEyeClearAngle + 1e-7)
      .distanceTo(geometry.lockedStudCenter)
      > geometry.eyeClearDistance,
  );

  for (let sample = 0; sample <= 4000; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 4000);
    if (state.tongueProgress > 1e-12) {
      assert.ok(
        state.leverAngleRadian >= geometry.leverEyeClearAngle,
        `tongue cannot move through a captured eye at sample ${sample}`,
      );
      assert.ok(state.currentStudClearance >= 0);
    }
    if (state.hookProgress > 1e-12) {
      assert.ok(state.tongueProgress > 0.98);
      assert.ok(state.tongueToTackleSeparation > 0.72);
    }
  }
  assert.match(transmission.releaseCondition,
    /distance\(center_eye,center_stud\)>=r_eye_inner\+r_stud/);
  disposeModel(model.root);
});

test('movement 492 renders two synchronous rigid levers and tongues about separate fixed pivots', () => {
  const { model } = movementModel();
  const {
    blocks,
    geometry,
    leverEyeCenterAtAngle,
    leverRopeEyeCenterAtAngle,
    stateAtTime,
    tongueNoseCenterAtAngle,
    tongueStudCenterAtAngle,
  } = model.root.userData;

  model.update(0);
  model.root.updateMatrixWorld(true);
  const fixedObjects = blocks.units.flatMap((unit) => [
    unit.standard,
    unit.tonguePivotPin,
    unit.leverPivotPin,
  ]);
  const fixedMatrices = fixedObjects.map(
    (object) => object.matrixWorld.clone(),
  );

  for (const time of [0, 1.37, 2.41, 3, 3.83, 4.8, 5.8, 7.62,
    8.4, 9.17, 10]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    blocks.units.forEach((unit) => {
      near(unit.lever.rotation.z, state.leverAngleRadian, 0,
        `rendered lever angle for unit ${unit.unitIndex + 1} at ${time}`);
      near(unit.tongue.rotation.z, state.tongueAngleRadian, 0,
        `rendered tongue angle for unit ${unit.unitIndex + 1} at ${time}`);
      near(unit.tackleHookAssembly.position.y, state.tackleLift, 0,
        `rendered tackle lift for unit ${unit.unitIndex + 1} at ${time}`);

      const global = (point, z) => new THREE.Vector3(
        geometry.unitCenterX + point.x,
        point.y,
        unit.unitZ + z,
      );
      vectorNear(
        unit.upperEye.getWorldPosition(new THREE.Vector3()),
        global(leverEyeCenterAtAngle(state.leverAngleRadian),
          geometry.mechanismPlaneZ),
        8e-16,
        `upper eye rigid closure at ${time}`,
      );
      vectorNear(
        unit.lowerEye.getWorldPosition(new THREE.Vector3()),
        global(leverRopeEyeCenterAtAngle(state.leverAngleRadian),
          geometry.mechanismPlaneZ),
        8e-16,
        `lower eye rigid closure at ${time}`,
      );
      vectorNear(
        unit.lockingStud.getWorldPosition(new THREE.Vector3()),
        global(tongueStudCenterAtAngle(state.tongueAngleRadian),
          geometry.mechanismPlaneZ),
        8e-16,
        `tongue stud rigid closure at ${time}`,
      );
      vectorNear(
        unit.tongueNoseMarker.getWorldPosition(new THREE.Vector3()),
        global(tongueNoseCenterAtAngle(state.tongueAngleRadian),
          geometry.tonguePlaneZ),
        8e-16,
        `tongue nose rigid closure at ${time}`,
      );
      vectorNear(
        unit.tackleThroatMarker.getWorldPosition(new THREE.Vector3()),
        global(state.tackleThroatCenter, geometry.tacklePlaneZ),
        8e-16,
        `tackle throat translation at ${time}`,
      );
    });
    fixedObjects.forEach((object, index) => {
      assert.ok(object.matrixWorld.equals(fixedMatrices[index]),
        `fixed support ${index} moved at ${time}`);
    });
  }
  disposeModel(model.root);
});

test('movement 492 preserves the load path until pull, then releases in the source order', () => {
  const { model } = movementModel();
  const { dynamics, geometry, stateAtTime, transmission } =
    model.root.userData;
  const locked = stateAtTime(0);
  const eyeOpen = stateAtTime(3);
  const tongueOpen = stateAtTime(4.8);
  const tackleAway = stateAtTime(5.8);
  const tackleReturned = stateAtTime(7);
  const tongueReturned = stateAtTime(8.4);
  const reset = stateAtTime(9.6);

  near(locked.leverAngleRadian, 0, 0, 'initial lever angle');
  near(locked.tongueAngleRadian, 0, 0, 'initial tongue angle');
  near(locked.tackleLift, 0, 0, 'initial tackle lift');
  near(locked.tongueToTackleSeparation, 0, 0,
    'tackle initially bears on tongue');
  assert.ok(locked.currentStudClearance < 0);

  near(eyeOpen.leverAngleRadian, geometry.leverReleaseAngle, 0,
    'lever eye first rotates open');
  near(eyeOpen.tongueAngleRadian, 0, 0,
    'tongue waits for eye clearance');
  near(eyeOpen.tackleLift, 0, 0,
    'tackle waits for tongue release');
  assert.ok(eyeOpen.currentStudClearance > 0);

  near(tongueOpen.tongueAngleRadian, geometry.tongueReleaseAngle, 0,
    'tongue then swings free');
  assert.ok(tongueOpen.tongueToTackleSeparation > 0.72);
  near(tackleAway.tackleLift, geometry.tackleHookLift, 0,
    'unloaded tackle finally departs');

  near(tackleReturned.tackleLift, 0, 0,
    'didactic reset returns tackle first');
  near(tackleReturned.tongueAngleRadian,
    geometry.tongueReleaseAngle, 0,
    'tongue remains open while tackle returns');
  near(tongueReturned.tongueAngleRadian, 0, 0,
    'reset reseats tongue second');
  near(tongueReturned.leverAngleRadian,
    geometry.leverReleaseAngle, 0,
    'eye remains open until tongue is seated');
  near(reset.leverAngleRadian, 0, 0,
    'lever eye relocks last');
  assert.ok(reset.currentStudClearance < 0);

  assert.match(dynamics.loadPath,
    /tackle hook bears on its hinged tongue.*locking stud lies inside.*lever reacts at the middle fulcrum.*standard transfers the load to the boat deck.*removes only the lock/s);
  assert.match(dynamics.didacticResetDisclosure,
    /first half.*working release.*second half.*reset.*not a claim of automatic reattachment/s);
  assert.equal(transmission.resetOrder,
    'working release: lever then tongue then tackle; didactic reset: tackle then tongue then lever');
  disposeModel(model.root);
});

test('movement 492 release ropes remain attached to both lower eyes and one common pull bar', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;

  for (const time of [0, 1.9, 3, 5.8, 8.4, 9.17, 10]) {
    const state = stateAtTime(time);
    model.update(time);
    model.root.updateMatrixWorld(true);
    near(blocks.pullBar.position.x, state.pullBarX, 0,
      `common pull bar at ${time}`);
    near(blocks.pullBarGrip.position.x, state.pullBarX, 0,
      `common pull grip at ${time}`);

    blocks.units.forEach((unit, index) => {
      const release = cableEndpoints(blocks.releaseCords[index]);
      vectorNear(
        release.start,
        new THREE.Vector3(
          geometry.unitCenterX + state.ropeEyeCenter.x,
          state.ropeEyeCenter.y,
          unit.unitZ + geometry.mechanismPlaneZ,
        ),
        2e-14,
        `release rope starts at lower eye ${index + 1} at ${time}`,
      );
      vectorNear(
        release.end,
        new THREE.Vector3(
          state.pullBarX,
          geometry.pullBarHeight,
          unit.unitZ,
        ),
        2e-14,
        `release rope ends at common bar ${index + 1} at ${time}`,
      );

      const fall = cableEndpoints(unit.fallRope);
      vectorNear(
        fall.start,
        new THREE.Vector3(
          geometry.unitCenterX - 0.73,
          3.88,
          unit.unitZ + geometry.tacklePlaneZ,
        ),
        2e-14,
        `tackle fall fixed end ${index + 1} at ${time}`,
      );
      vectorNear(
        fall.end,
        new THREE.Vector3(
          geometry.unitCenterX - 0.73,
          2.98 + state.tackleLift,
          unit.unitZ + geometry.tacklePlaneZ,
        ),
        2e-14,
        `tackle fall follows hook ${index + 1} at ${time}`,
      );
    });
  }
  assert.match(model.root.userData.dynamics.synchronization,
    /same scalar release coordinate.*Two distinct release ropes.*one visibly disclosed reconstructed pull bar.*one operator amidships/s);
  disposeModel(model.root);
});

test('movement 492 closes smoothly, remains in finite bounds, and leaves movement 507 as the frontier', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime } = model.root.userData;
  const initial = stateAtTime(0);
  const closure = stateAtTime(geometry.cycleDuration);
  for (const key of [
    'leverAngleRadian',
    'tongueAngleRadian',
    'tackleLift',
    'pullBarX',
    'lockedStudClearance',
    'currentStudClearance',
    'tongueToTackleSeparation',
  ]) {
    near(closure[key], initial[key], 0, `${key} exact cycle closure`);
  }
  vectorNear(closure.upperEyeCenter, initial.upperEyeCenter, 0,
    'upper-eye exact cycle closure');
  vectorNear(closure.ropeEyeCenter, initial.ropeEyeCenter, 0,
    'rope-eye exact cycle closure');
  vectorNear(closure.tongueStudCenter, initial.tongueStudCenter, 0,
    'stud exact cycle closure');

  const derivativeTolerance = 3e-6;
  const step = 1e-4;
  for (const [key, boundaries] of [
    ['leverProgress', [1.2, 3, 8.4, 9.6]],
    ['tongueProgress', [3, 4.8, 7, 8.4]],
    ['hookProgress', [4.6, 5.8, 6.2, 7]],
  ]) {
    for (const boundary of boundaries) {
      const center = stateAtTime(boundary)[key];
      const leftSlope = (center - stateAtTime(boundary - step)[key])
        / step;
      const rightSlope = (stateAtTime(boundary + step)[key] - center)
        / step;
      near(leftSlope, rightSlope, derivativeTolerance,
        `${key} C1 boundary at ${boundary}`);
    }
  }

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 480; sample += 1) {
    model.update(geometry.cycleDuration * sample / 480);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);
  assert.ok(model.root.userData.groundFloorY <= swept.min.y);

  const next = catalog.movements[506];
  const nextModel = createMovementModel(next);
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.match(next.title, /very slow motion/);
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, ARCHETYPE);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
