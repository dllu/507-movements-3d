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

function worldPoint(object) {
  return object.getWorldPosition(new THREE.Vector3());
}

function transformedOutline(points, angle, center) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return points.map((point) => new THREE.Vector2(
    point.x * cosine - point.y * sine + center.x,
    point.x * sine + point.y * cosine + center.y,
  ));
}

function pointInsidePolygon(point, polygon) {
  let inside = false;
  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    if (
      (current.y > point.y) !== (previous.y > point.y)
      && point.x < (previous.x - current.x) * (point.y - current.y)
        / (previous.y - current.y) + current.x
    ) inside = !inside;
  }
  return inside;
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

test('movement 191 matches Brown\'s one fixed-center pair of complementary scroll gears', () => {
  const movement = catalog.movements[190];
  const model = createMovementModel(movement);
  const {
    blocks,
    geometry,
    modelPointToSourceRaster,
    sourceAnchors,
    sourcePointToModel,
    stateAtProgress,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 191);
  assert.equal(movement.number, '191');
  assert.equal(movement.title, 'Progressive-Speed Scroll Gears');
  assert.equal(movement.category, 'Toothed gearing');
  assert.equal(
    movement.description,
    '191. Scroll-gears for obtaining a gradually increasing speed.',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(
    movement.archetype,
    'fixed-center-conjugate-scroll-gears-progressive-speed-increase-seam-reset',
  );
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'fixed-center-conjugate-single-turn-scroll-gears-constant-driver-progressively-accelerating-output-with-radial-seam-reset',
  );

  assert.equal(geometry.teethPerGear, 36);
  assert.equal(blocks.driverTeeth.length, 36);
  assert.equal(blocks.drivenTeeth.length, 36);
  assert.equal(blocks.driver.parent, model.root);
  assert.equal(blocks.driven.parent, model.root);
  assert.equal(blocks.driverRotor.parent, blocks.driver);
  assert.equal(blocks.drivenRotor.parent, blocks.driven);
  assert.equal(blocks.driverBody.parent, blocks.driverRotor);
  assert.equal(blocks.drivenBody.parent, blocks.drivenRotor);
  // Brown draws no seam outline; source presentation removes the ink seams.
  assert.equal(blocks.driverRadialSeam.parent, null);
  assert.equal(blocks.drivenRadialSeam.parent, null);
  blocks.driverTeeth.forEach((tooth) => {
    assert.equal(tooth.parent, blocks.driverRotor);
    assert.equal(tooth.userData.role, 'upper-scroll-gear-tooth');
  });
  blocks.drivenTeeth.forEach((tooth) => {
    assert.equal(tooth.parent, blocks.drivenRotor);
    assert.equal(tooth.userData.role, 'lower-scroll-gear-tooth');
  });
  assert.equal(blocks.driverBearing.userData.fixed, true);
  assert.equal(blocks.drivenBearing.userData.fixed, true);
  assert.equal(transmission.ratioResetIsIntentional, true);

  vector3Near(
    sourcePointToModel(sourceAnchors.upperCenter),
    geometry.upperCenter,
    1e-12,
    'upper source center maps to the upper fixed shaft',
  );
  vector3Near(
    sourcePointToModel(sourceAnchors.lowerCenter),
    geometry.lowerCenter,
    1e-12,
    'lower source center maps to the lower fixed shaft',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.upperCenter),
    sourceAnchors.upperCenter,
    1e-12,
    'upper shaft maps back to Brown\'s raster',
  );
  vector2Near(
    modelPointToSourceRaster(geometry.lowerCenter),
    sourceAnchors.lowerCenter,
    1e-12,
    'lower shaft maps back to Brown\'s raster',
  );
  const sourceState = stateAtProgress(0);
  vector3Near(
    sourcePointToModel(sourceAnchors.initialPitchContact),
    sourceState.contactPoint,
    1e-12,
    'the illustrated seam contact is source anchored',
  );
  near(
    sourceState.driverPitchRadius,
    geometry.minimumDriverRadius,
    1e-12,
    'the upper source-pose driver is at its smallest radius',
  );
  near(
    sourceState.drivenPitchRadius,
    geometry.maximumDrivenRadius,
    1e-12,
    'the lower source-pose output is at its largest radius',
  );

  let scrollGearCount = 0;
  const forbiddenRoles = [];
  model.root.traverse((object) => {
    if (object.userData.role?.endsWith('scroll-gear')) scrollGearCount += 1;
    if (/belt|pulley|cam|spring/i.test(object.userData.role ?? '')) {
      forbiddenRoles.push(object.userData.role);
    }
  });
  assert.equal(scrollGearCount, 2);
  assert.deepEqual(forbiddenRoles, []);
  disposeModel(model.root);
});

test('movement 191 preserves conjugate contact and progressively increases output speed over 32,769 states', () => {
  const model = createMovementModel(catalog.movements[190]);
  const {
    geometry,
    speedRatioDerivativeAtPhi,
    stateAtProgress,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const sampleCount = 32769;
  let maximumCenterError = 0;
  let maximumContactError = 0;
  let maximumRadiusError = 0;
  let maximumTangencyError = 0;
  let maximumVelocityError = 0;
  let previousOutputSpeed = -Infinity;
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / (sampleCount - 1);
    const state = stateAtProgress(progress);
    finiteStateNumbers(state, `state[${index}]`);
    maximumCenterError = Math.max(maximumCenterError, state.centerDistanceError);
    maximumContactError = Math.max(maximumContactError, state.contactPointError);
    maximumRadiusError = Math.max(
      maximumRadiusError,
      state.contactRadiusSumError,
    );
    maximumTangencyError = Math.max(
      maximumTangencyError,
      state.pitchTangentError,
    );
    maximumVelocityError = Math.max(
      maximumVelocityError,
      state.pitchLineSpeedError,
    );
    near(
      state.inputAngle,
      progress * FULL_TURN,
      2e-12,
      `constant-speed input angle at sample ${index}`,
    );
    near(
      state.inputAngularSpeed,
      transmission.driverAngularSpeed,
      1e-15,
      `constant input angular speed at sample ${index}`,
    );
    near(
      state.instantaneousSpeedRatio,
      state.driverPitchRadius / state.drivenPitchRadius,
      2e-14,
      `pitch-radius speed ratio at sample ${index}`,
    );
    near(
      state.outputAngularSpeed,
      state.inputAngularSpeed * state.instantaneousSpeedRatio,
      2e-14,
      `output speed law at sample ${index}`,
    );
    near(
      state.outputAngularAcceleration,
      state.inputAngularSpeed * state.inputAngularSpeed
        * speedRatioDerivativeAtPhi(state.localInputAngle),
      2e-14,
      `output acceleration law at sample ${index}`,
    );
    assert.ok(
      Math.abs(state.outputAngularSpeed) >= previousOutputSpeed - 2e-14,
      `output speed is monotone at sample ${index}`,
    );
    previousOutputSpeed = Math.abs(state.outputAngularSpeed);
    near(state.contactPoint.x, 0, 2e-12, `centerline contact ${index}`);
    near(
      state.contactPoint.y,
      geometry.upperCenter.y - state.driverPitchRadius,
      2e-12,
      `moving pitch contact height ${index}`,
    );
  }
  assert.ok(maximumCenterError < 1e-14);
  assert.ok(maximumContactError < 8e-14);
  assert.ok(maximumRadiusError < 1e-14);
  assert.ok(maximumTangencyError < 8e-14);
  assert.ok(maximumVelocityError < 8e-14);

  const start = stateAtProgress(0);
  const beforeReset = stateAtProgress(1);
  const afterReset = stateAtTime(transmission.cyclePeriod);
  near(
    transmission.minimumOutputSpeedRatio,
    0.436 / 0.564,
    2e-14,
    'minimum ratio follows Brown-proportioned starting radii',
  );
  assert.ok(transmission.maximumOutputSpeedRatio > 1.267);
  assert.ok(transmission.maximumOutputSpeedRatio < 1.268);
  assert.ok(
    transmission.maximumOutputSpeedRatio
      / transmission.minimumOutputSpeedRatio > 1.63,
  );
  near(
    transmission.outputRevolutionsPerInputRevolution,
    1,
    2e-14,
    'the conjugate lower scroll closes after one turn',
  );
  near(beforeReset.inputAngle, FULL_TURN, 2e-14, 'driver turn closure');
  near(beforeReset.driverAngle, -FULL_TURN, 2e-14, 'upper driver turns clockwise');
  near(beforeReset.outputAngle, FULL_TURN, 2e-14, 'output turn closure');
  near(afterReset.inputAngle, beforeReset.inputAngle, 2e-14, 'input is continuous');
  near(afterReset.outputAngle, beforeReset.outputAngle, 2e-14, 'output is continuous');
  near(
    beforeReset.instantaneousSpeedRatio,
    transmission.maximumOutputSpeedRatio,
    2e-14,
    'ratio reaches its maximum immediately before the seam',
  );
  near(
    afterReset.instantaneousSpeedRatio,
    transmission.minimumOutputSpeedRatio,
    2e-14,
    'radial seam intentionally resets the speed ratio',
  );
  assert.ok(
    Math.abs(beforeReset.outputAngularSpeed)
      > Math.abs(afterReset.outputAngularSpeed) * 1.63,
  );
  assert.equal(afterReset.seamReset, true);
  assert.ok(start.contactPoint.y > beforeReset.contactPoint.y);
  disposeModel(model.root);
});

test('movement 191 uses equal pitch-arc tooth spacing and a permanent half-pitch mesh phase', () => {
  const model = createMovementModel(catalog.movements[190]);
  const {
    blocks,
    driverPitchDerivativeAtPhi,
    drivenPitchDerivativeAtPhi,
    geometry,
    phiAtPitchArcLength,
    pitchArcLengthAtPhi,
    stateAtProgress,
  } = model.root.userData;
  const driverToothData = blocks.driver.userData.toothData;
  const drivenToothData = blocks.driven.userData.toothData;
  assert.equal(driverToothData.length, geometry.teethPerGear);
  assert.equal(drivenToothData.length, geometry.teethPerGear);
  near(
    geometry.pitchPerimeter,
    geometry.circularPitch * geometry.teethPerGear,
    2e-13,
    '36 equal circular pitches close each scroll',
  );

  for (const [role, toothData] of [
    ['driver', driverToothData],
    ['driven', drivenToothData],
  ]) {
    const sorted = [...toothData].sort((left, right) => (
      left.pitchArc - right.pitchArc
    ));
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];
      const next = sorted[(index + 1) % sorted.length];
      const gap = THREE.MathUtils.euclideanModulo(
        next.pitchArc - current.pitchArc,
        geometry.pitchPerimeter,
      );
      near(
        gap,
        geometry.circularPitch,
        4e-13,
        `${role} equal tooth pitch ${index}`,
      );
      near(
        pitchArcLengthAtPhi(current.phi),
        current.pitchArc,
        4e-13,
        `${role} tooth arc inversion ${index}`,
      );
      near(
        phiAtPitchArcLength(current.pitchArc),
        current.phi,
        4e-13,
        `${role} tooth parameter inversion ${index}`,
      );
      near(current.normal.length(), 1, 2e-14, `${role} tooth normal ${index}`);
      near(current.tangent.length(), 1, 2e-14, `${role} tooth tangent ${index}`);
      near(
        current.normal.dot(current.tangent),
        0,
        2e-14,
        `${role} tooth frame orthogonality ${index}`,
      );
      near(
        current.tipCenter.clone().sub(current.pitchPoint).dot(current.normal),
        geometry.addendum,
        2e-14,
        `${role} tooth addendum ${index}`,
      );
      near(
        current.pitchPoint.clone().sub(current.rootCenter).dot(current.normal),
        geometry.dedendum,
        2e-14,
        `${role} tooth root remains attached ${index}`,
      );
    }
  }
  // The rendered scrolls are hobbed by one rack: each step carries a whole
  // tooth on its long side and a relieved notch floor on its short side.
  assert.equal(
    blocks.driverBody.geometry.userData.toothProfile,
    'offline-rack-hobbed-conjugate-scroll',
  );
  assert.equal(
    blocks.drivenBody.geometry.userData.toothProfile,
    'offline-rack-hobbed-conjugate-scroll',
  );

  let maximumDerivativeLengthError = 0;
  let maximumPhaseError = 0;
  for (let index = 0; index <= 8192; index += 1) {
    const progress = index / 8192;
    const phi = progress * FULL_TURN;
    const driverDerivativeLength = driverPitchDerivativeAtPhi(phi).length();
    const drivenDerivativeLength = drivenPitchDerivativeAtPhi(phi).length();
    maximumDerivativeLengthError = Math.max(
      maximumDerivativeLengthError,
      Math.abs(driverDerivativeLength - drivenDerivativeLength),
    );
    const state = stateAtProgress(progress);
    maximumPhaseError = Math.max(
      maximumPhaseError,
      Math.abs(state.toothPhaseSeparation - geometry.circularPitch / 2),
    );
    near(
      state.driverContactArc,
      state.drivenContactArc,
      1e-14,
      `equal rolling arc at sample ${index}`,
    );
  }
  assert.ok(maximumDerivativeLengthError < 3e-14);
  assert.ok(maximumPhaseError < 3e-14);

  // Rendered hobbed contours: no vertex near the contact enters the mate.
  const renderedOutline = (body) => body.geometry.userData.outline
    .map(([x, y]) => new THREE.Vector2(x, y));
  const driverBodyOutline = renderedOutline(blocks.driverBody);
  const drivenBodyOutline = renderedOutline(blocks.drivenBody);
  for (let index = 0; index <= 128; index += 1) {
    const state = stateAtProgress((index + 0.37) / 129);
    const driverWorldOutline = transformedOutline(
      driverBodyOutline,
      state.driverAngle,
      geometry.upperCenter,
    );
    const drivenWorldOutline = transformedOutline(
      drivenBodyOutline,
      state.outputAngle,
      geometry.lowerCenter,
    );
    const contact = new THREE.Vector2(state.contactPoint.x, state.contactPoint.y);
    for (const [points, other] of [
      [driverWorldOutline, drivenWorldOutline],
      [drivenWorldOutline, driverWorldOutline],
    ]) {
      for (const point of points) {
        if (point.distanceTo(contact) > 0.9) continue;
        assert.equal(
          pointInsidePolygon(point, other),
          false,
          `rendered scroll bodies remain disjoint at sample ${index}`,
        );
      }
    }
  }
  disposeModel(model.root);
});

test('movement 191 rendered transforms expose constant input, accelerating output, and moving contact', () => {
  const model = createMovementModel(catalog.movements[190]);
  const {
    blocks,
    canonicalStates,
    canonicalTimes,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const times = [
    canonicalTimes.sourcePose,
    canonicalTimes.quarterTurn,
    canonicalTimes.halfTurn,
    canonicalTimes.threeQuarterTurn,
    canonicalTimes.immediatelyBeforeReset,
  ];
  const outputQuarterIncrements = [];
  const contactHeights = [];
  let previousState = null;
  let driverIndexStart = null;
  let drivenIndexStart = null;
  const toothCentre = (tooth) => {
    tooth.geometry.computeBoundingBox();
    return tooth.geometry.boundingBox.getCenter(new THREE.Vector3())
      .applyMatrix4(tooth.matrixWorld);
  };
  for (const [index, time] of times.entries()) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    finiteStateNumbers(model.root.userData.kinematics, `rendered[${index}]`);
    near(
      blocks.driverRotor.rotation.z,
      state.driverAngle,
      2e-14,
      `rendered driver angle ${index}`,
    );
    near(
      blocks.drivenRotor.rotation.z,
      state.outputAngle,
      2e-14,
      `rendered output angle ${index}`,
    );
    near(
      blocks.driverShaft.userData.rotor.rotation.z,
      state.driverAngle,
      2e-14,
      `rendered input shaft angle ${index}`,
    );
    near(
      blocks.drivenShaft.userData.rotor.rotation.z,
      state.outputAngle,
      2e-14,
      `rendered output shaft angle ${index}`,
    );
    vector2Near(
      worldPoint(blocks.contactMarker),
      state.contactPoint,
      2e-12,
      `rendered moving contact marker ${index}`,
    );
    near(
      blocks.driver.userData.angularSpeed,
      transmission.driverAngularSpeed,
      1e-15,
      `rendered constant input speed ${index}`,
    );
    near(
      blocks.driven.userData.angularSpeed,
      state.outputAngularSpeed,
      2e-14,
      `rendered variable output speed ${index}`,
    );
    contactHeights.push(state.contactPoint.y);
    if (previousState && index < 4) {
      outputQuarterIncrements.push(Math.abs(
        state.outputAngle - previousState.outputAngle,
      ));
    }
    if (index === 0) {
      // The white face indices are not drawn; a tooth on each rotor tracks turn.
      driverIndexStart = toothCentre(blocks.driverTeeth[0]);
      drivenIndexStart = toothCentre(blocks.drivenTeeth[0]);
    }
    previousState = state;
  }
  assert.ok(outputQuarterIncrements[1] > outputQuarterIncrements[0]);
  assert.ok(outputQuarterIncrements[2] > outputQuarterIncrements[1]);
  for (let index = 1; index < contactHeights.length; index += 1) {
    // The upper driver's radius grows, so the contact moves down.
    assert.ok(contactHeights[index] < contactHeights[index - 1]);
  }

  model.update(canonicalTimes.halfTurn);
  model.root.updateMatrixWorld(true);
  assert.ok(toothCentre(blocks.driverTeeth[0]).distanceTo(driverIndexStart) > 1.5);
  assert.ok(toothCentre(blocks.drivenTeeth[0]).distanceTo(drivenIndexStart) > 1.2);
  assert.equal(blocks.driverFaceIndex.parent, null);
  assert.equal(blocks.drivenFaceIndex.parent, null);
  near(
    canonicalStates.sourcePose.driverPitchRadius,
    geometry.minimumDriverRadius,
    1e-12,
    'source canonical state uses the small upper driver radius',
  );
  assert.ok(
    canonicalStates.immediatelyBeforeReset.instantaneousSpeedRatio
      > canonicalStates.threeQuarterTurn.instantaneousSpeedRatio,
  );
  assert.equal(canonicalStates.immediatelyAfterReset.seamReset, true);
  disposeModel(model.root);
});

test('movement 191 remains distinct as the sequential review queue advances through 200', () => {
  const model = createMovementModel(catalog.movements[190]);
  const { blocks, canonicalTimes } = model.root.userData;
  const physicalBounds = new THREE.Box3();
  for (const time of Object.values(canonicalTimes)) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const object of [
      blocks.driver,
      blocks.driven,
      blocks.driverShaft,
      blocks.drivenShaft,
      blocks.driverBearing,
      blocks.drivenBearing,
      blocks.framePost,
      blocks.frameFoot,
    ]) physicalBounds.expandByObject(object);
  }
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4.05);
  assert.ok(size.y > 7.1);
  // The shafts stop just proud of the bosses, as Brown's hatched sections;
  // with the undrawn seam outlines removed they set the full 1.0 depth.
  assert.ok(size.z > 0.99);
  assert.ok(physicalBounds.min.z < -0.69);
  assert.ok(physicalBounds.max.z > 0.25);
  let meshCount = 0;
  let scrollToothCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
    if (/scroll-gear-tooth/.test(object.userData.role ?? '')) {
      scrollToothCount += 1;
    }
  });
  // 20 seam-outline and index meshes are removed as undrawn.
  assert.ok(meshCount >= 80);
  assert.equal(scrollToothCount, 72);
  assert.ok(model.cameraDirection.x > 0);
  assert.ok(model.cameraDirection.y > 0);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x * 1.9);

  const movement190 = createMovementModel(catalog.movements[189]);
  const movement192 = createMovementModel(catalog.movements[191]);
  const movement193 = createMovementModel(catalog.movements[192]);
  const movement194 = createMovementModel(catalog.movements[193]);
  const movement195 = createMovementModel(catalog.movements[194]);
  const movement196 = createMovementModel(catalog.movements[195]);
  const movement197 = createMovementModel(catalog.movements[196]);
  const movement198 = createMovementModel(catalog.movements[197]);
  const movement199 = createMovementModel(catalog.movements[198]);
  const movement200 = createMovementModel(catalog.movements[199]);
  assert.equal(movement190.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(movement192.root.userData.fidelity, 'authored');
  assert.equal(movement193.root.userData.fidelity, 'authored');
  assert.equal(movement194.root.userData.fidelity, 'authored');
  assert.equal(movement195.root.userData.fidelity, 'authored');
  assert.equal(movement196.root.userData.fidelity, 'authored');
  assert.equal(movement197.root.userData.fidelity, 'authored');
  assert.equal(movement198.root.userData.fidelity, 'authored');
  assert.equal(movement199.root.userData.fidelity, 'authored');
  assert.equal(movement200.root.userData.fidelity, 'authored');
  assert.notEqual(
    movement190.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement192.root.userData.mechanism,
    model.root.userData.mechanism,
  );
  assert.notEqual(
    movement193.root.userData.mechanism,
    movement192.root.userData.mechanism,
  );
  assert.notEqual(
    movement194.root.userData.mechanism,
    movement193.root.userData.mechanism,
  );
  assert.notEqual(
    movement190.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement192.root.userData.archetype,
    model.root.userData.archetype,
  );
  assert.notEqual(
    movement193.root.userData.archetype,
    movement192.root.userData.archetype,
  );
  assert.notEqual(
    movement194.root.userData.archetype,
    movement193.root.userData.archetype,
  );
  disposeModel(movement190.root);
  disposeModel(movement192.root);
  disposeModel(movement193.root);
  disposeModel(movement194.root);
  disposeModel(movement195.root);
  disposeModel(movement196.root);
  disposeModel(movement197.root);
  disposeModel(movement198.root);
  disposeModel(movement199.root);
  disposeModel(movement200.root);
  disposeModel(model.root);
});

test('movement 191 seam step is Brown\'s shallow shoulder, about 0.13 of the centre distance', () => {
  const model = createMovementModel(catalog.movements[190]);
  const g = model.root.userData.geometry;
  const step = (g.maximumDriverRadius - g.minimumDriverRadius) / g.centerDistance;
  assert.ok(step > 0.12 && step < 0.14, `step ${step}`);
  // Roughly two tooth depths, not a long spike.
  assert.ok(g.maximumDriverRadius - g.minimumDriverRadius < 2.5 * (g.addendum + g.dedendum));
  disposeModel(model.root);
});

test('movement 191 step tooth is full-width and flat-topped on a straight radial wall (p96)', () => {
  const model = createMovementModel(catalog.movements[190]);
  const { blocks, geometry: g } = model.root.userData;
  for (const body of [blocks.drivenBody, blocks.driverBody]) {
    const outline = body.geometry.userData.outline;
    const radius = (p) => Math.hypot(p[0], p[1]);
    const tip = Math.max(...outline.map(radius));
    // The wall: points hugging the seam ray (|x| < 0.004 in the baked frame,
    // whose seam lies on the y axis) over most of the step height.
    const wall = outline.filter((p) => Math.abs(p[0]) < 0.004 && radius(p) > tip - 0.6);
    const span = Math.max(...wall.map(radius)) - Math.min(...wall.map(radius));
    assert.ok(span > 0.38, `straight wall spans ${span}`);
    // The step tooth: its top (within 0.006 of the tip) starts inside the
    // 0.05 corner fillet and is over a quarter pitch wide; 0.05 below the
    // tip the wall is still straight (the old hobbed chamfer was 0.02 in).
    const top = outline.filter((p) => radius(p) > tip - 0.006 && Math.abs(p[0]) < 0.2);
    const xs = top.map((p) => Math.abs(p[0]));
    assert.ok(Math.min(...xs) < 0.035, `top starts ${Math.min(...xs)}`);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 0.28 * g.circularPitch, `top width ${Math.max(...xs) - Math.min(...xs)}`);
    const shoulder = outline.filter((p) => Math.abs(radius(p) - (tip - 0.05)) < 0.004 && Math.abs(p[0]) < 0.05);
    assert.ok(shoulder.length > 0 && Math.min(...shoulder.map((p) => Math.abs(p[0]))) < 0.006, 'square shoulder');
  }
  disposeModel(model.root);
});
