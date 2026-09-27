import { assertReadableTiming } from './helpers/display-timing.mjs';
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

test('movement 369 contains two opposed cycloidal cheeks, one wrapping cord, a bob, and the source-shown cycloidal trajectory', () => {
  const movement = catalog.movements[368];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 369);
  assert.equal(movement.number, '369');
  assert.equal(movement.category, 'Springs & balances');
  assert.equal(
    movement.archetype,
    'huygens-cycloidal-cheeks-isochronous-cord-pendulum',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /one-flexible-inextensible-cord/);
  assert.match(data.mechanism, /two-opposed-cycloidal-cheeks/);
  assert.match(data.mechanism, /inverted-cycloidal-path/);
  assert.equal(degreesOfFreedom.independentDynamicCoordinates, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 2);
  assert.match(degreesOfFreedom.coordinate, /signed arc distance/);
  assert.match(degreesOfFreedom.note, /active side from that one coordinate/);

  // Crossbar, posts, bracing and both cheeks are one flat extrusion with
  // two triangular holes per bracket (Brown draws no line between them).
  assert.equal(blocks.cheekPlates.length, 1);
  assert.equal(blocks.cheekPlates[0], blocks.frameCasting);
  {
    const polygons = blocks.frameCasting.geometry.userData.plate.polygons;
    assert.equal(polygons.length, 1, 'one piece');
    assert.equal(polygons[0].length - 1, 4, 'four triangular holes');
    const box = new THREE.Box3().setFromObject(blocks.frameCasting);
    assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6, 'symmetric');
  }
  assert.ok(!blocks.suspensionBoss.visible, 'no undrawn cusp boss');
  assert.equal(blocks.cheekContactRails.length, 2);
  assert.equal(blocks.pathDashes, undefined, 'Brown\'s dotted bob path is notation, not drawn');
  // One continuous three-strand laid rope in place of 66 cylinder segments.
  assert.equal(blocks.cord.children.length, 1);
  assert.equal(blocks.cord.userData.mesh.geometry.userData.crossSection, 'laid-rope');
  assert.ok(blocks.cheekContactRails.every(({ visible }) => !visible),
    'the cheek edge lines are ink notation, not drawn parts');
  for (const component of [
    ...blocks.cheekPlates,
    ...blocks.cheekContactRails,
    blocks.suspensionBoss,
    blocks.cord,
    blocks.contactBead,
    blocks.bob,
  ]) assert.equal(component.parent, model.root);
  assert.equal(blocks.bobSphere.parent, blocks.bob);
  assert.equal(blocks.bobIndex.parent, blocks.bob);

  const roles = [];
  const toothedObjects = [];
  const beltObjects = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (Number.isInteger(object.userData.teeth)) toothedObjects.push(object);
    if (object.userData.isBelt || object.userData.mechanismBelt
      || object.userData.selectorBelt) beltObjects.push(object);
  });
  for (const role of [
    'fixed-one-piece-frame-with-bracing-and-cycloidal-cheek-contact-surfaces',
    'left-cycloidal-cheek-exact-cord-contact-edge',
    'right-cycloidal-cheek-exact-cord-contact-edge',
    'central-cusp-anchor-of-inextensible-pendulum-cord',
    'massless-inextensible-cord-wrapping-on-one-cycloidal-cheek',
    'moving-tangency-point-between-cord-and-active-cheek',
    'cycloidal-path-pendulum-bob',
  ]) assert.ok(roles.includes(role), role);
  assert.ok(!roles.includes('dashed-reference-of-bob-cycloidal-path'));
  assert.equal(toothedObjects.length, 0);
  assert.equal(beltObjects.length, 0);
  disposeModel(model.root);
});

test('movement 369 records Brown\'s equal-time claim, unavailable animation, and every source-visible pendulum feature', () => {
  const movement = catalog.movements[368];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate369;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_369.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /Cycloidal surfaces/);
  assert.match(movement.description, /pendulum to move in cycloidal curve/);
  assert.match(movement.description, /isochronous or equal-timed/);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.pageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedTiming, false);
  assert.equal(data.dynamics.sourceSpecifiesDimensionsMassGravityOrAmplitude,
    false);
  assert.equal(data.dynamics.idealizations.length, 4);
  assert.match(data.dynamics.treatment, /ideal Huygens cycloidal pendulum/);
  assert.match(data.dynamics.treatment, /engineered radius/);

  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 8);
  assert.deepEqual(plate.centralCusp.toArray(), [273, 145]);
  assert.deepEqual(plate.centerBob.toArray(), [273, 499]);
  assert.deepEqual(plate.leftExtremeBob.toArray(), [34, 397]);
  assert.deepEqual(plate.rightExtremeBob.toArray(), [509, 384]);
  assert.deepEqual(plate.leftCheekOuterEnd.toArray(), [5, 321]);
  assert.deepEqual(plate.rightCheekOuterEnd.toArray(), [520, 316]);
  assert.deepEqual(plate.topBeamLeft.toArray(), [164, 120]);
  assert.deepEqual(plate.topBeamRight.toArray(), [404, 120]);
  assert.equal(evidence.explicitInBrownDescription.length, 3);
  assert.match(evidence.engravingEvidence, /two opposed curved cheeks/);
  assert.match(evidence.engravingEvidence, /tangent to either cheek/);
  assert.match(evidence.engravingEvidence, /dotted symmetric bob trajectory/);
  assert.match(evidence.reconstructionDisclosure, /cycloid radius/);
  assert.match(evidence.reconstructionDisclosure, /no numerical values/);
  assert.match(evidence.reconstructionDisclosure, /no canvas animation/);
  disposeModel(model.root);
});

test('movement 369 cheek is the exact cycloidal evolute whose tangent cord is normal to the bob cycloid', () => {
  const model = createMovementModel(catalog.movements[368]);
  const data = model.root.userData;
  const { curves, geometry, kinematics } = data;
  const a = geometry.cycloidRadius;

  vectorNear(
    kinematics.cheekPointAtParameter(0),
    geometry.cuspPoint,
    0,
    'both cheeks meet at central cusp',
  );
  vectorNear(
    kinematics.bobPointAtParameter(0),
    new THREE.Vector3(0, geometry.lowestBobY, geometry.mechanismPlaneZ),
    0,
    'bob cycloid has its vertex below cusp',
  );
  for (let sample = -700; sample <= 700; sample += 1) {
    const theta = geometry.oscillationAmplitude * sample / 700;
    const bob = kinematics.bobPointAtParameter(theta);
    const contact = kinematics.cheekPointAtParameter(theta);
    near(bob.x, a * (theta + Math.sin(theta)), 0,
      'bob cycloid x coordinate');
    near(bob.y, geometry.lowestBobY + a * (1 - Math.cos(theta)), 0,
      'bob cycloid y coordinate');
    near(contact.x, a * (theta - Math.sin(theta)), 0,
      'cheek evolute x coordinate');
    near(contact.y,
      geometry.lowestBobY + a * (3 + Math.cos(theta)), 0,
      'cheek evolute y coordinate');
    const halfTheta = theta / 2;
    const cordDirection = new THREE.Vector3(
      Math.sin(halfTheta),
      -Math.cos(halfTheta),
      0,
    );
    const bobTangent = new THREE.Vector3(
      Math.cos(halfTheta),
      Math.sin(halfTheta),
      0,
    );
    near(cordDirection.dot(bobTangent), 0, 2e-16,
      'cord normal to bob path');
    vectorNear(
      bob.clone().sub(contact),
      cordDirection.clone().multiplyScalar(
        kinematics.freeCordLengthAtParameter(theta),
      ),
      1.2e-15,
      'free cord reaches bob from cheek tangency',
    );
    if (Math.abs(theta) > 1e-5) {
      const cheekDerivative = new THREE.Vector3(
        a * (1 - Math.cos(theta)),
        -a * Math.sin(theta),
        0,
      ).normalize();
      near(Math.abs(cheekDerivative.dot(cordDirection)), 1, 8e-12,
        'free cord collinear with cheek tangent');
    }
  }

  const leftEnd = curves.cheekCurves.left.getPoint(1);
  const rightEnd = curves.cheekCurves.right.getPoint(1);
  near(leftEnd.x, -rightEnd.x, 0, 'symmetric cheek x extents');
  near(leftEnd.y, rightEnd.y, 0, 'symmetric cheek y extents');
  disposeModel(model.root);
});

test('movement 369 wrapped and free cord portions exchange length exactly while the active tangency moves on only the swing-side cheek', () => {
  const model = createMovementModel(catalog.movements[368]);
  const data = model.root.userData;
  const { geometry, kinematics, stateAtTime } = data;
  let previousWrappedLength = 0;

  for (let sample = 0; sample <= 900; sample += 1) {
    const theta = geometry.oscillationAmplitude * sample / 900;
    for (const signedTheta of sample === 0 ? [0] : [-theta, theta]) {
      const wrapped = kinematics.wrappedCordLengthAtParameter(signedTheta);
      const free = kinematics.freeCordLengthAtParameter(signedTheta);
      near(wrapped + free, geometry.totalCordLength, 5e-16,
        'constant analytical cord length');
      assert.ok(wrapped >= previousWrappedLength - 2e-15);
      const bob = kinematics.bobPointAtParameter(signedTheta);
      const contact = kinematics.cheekPointAtParameter(signedTheta);
      near(bob.distanceTo(contact), free, 9e-16,
        'free-span geometric length');
    }
    previousWrappedLength =
      kinematics.wrappedCordLengthAtParameter(theta);
  }

  const quarter = stateAtTime(geometry.isochronousPeriod / 4);
  const half = stateAtTime(geometry.isochronousPeriod / 2);
  const threeQuarter = stateAtTime(3 * geometry.isochronousPeriod / 4);
  assert.equal(quarter.activeCheek, 'right');
  assert.equal(half.activeCheek, 'cusp');
  assert.equal(threeQuarter.activeCheek, 'left');
  near(quarter.theta, geometry.oscillationAmplitude, 2e-16,
    'right extreme parameter');
  near(threeQuarter.theta, -geometry.oscillationAmplitude, 2e-16,
    'left extreme parameter');
  near(half.wrappedCordLength, 0, 0, 'center has no wrapped cord');
  near(quarter.totalCordLength, geometry.totalCordLength, 5e-16,
    'right extreme cord length');
  near(threeQuarter.totalCordLength, geometry.totalCordLength, 5e-16,
    'left extreme cord length');
  assert.match(data.transmission.cordLaw, /their sum is exactly 4a/);
  disposeModel(model.root);
});

test('movement 369 signed bob distance and gravitational height satisfy the exact quadratic tautochrone relation', () => {
  const model = createMovementModel(catalog.movements[368]);
  const data = model.root.userData;
  const { geometry, kinematics, stateAtTime } = data;
  const a = geometry.cycloidRadius;

  for (let sample = -1000; sample <= 1000; sample += 1) {
    const theta = geometry.oscillationAmplitude * sample / 1000;
    const arcCoordinate =
      kinematics.signedArcCoordinateAtParameter(theta);
    near(
      kinematics.parameterAtSignedArcCoordinate(arcCoordinate),
      theta,
      5e-16,
      'arc-coordinate inverse',
    );
    const bob = kinematics.bobPointAtParameter(theta);
    near(
      bob.y - geometry.lowestBobY,
      arcCoordinate ** 2 / (8 * a),
      7e-16,
      'quadratic height law',
    );
  }

  for (let sample = 0; sample <= 1200; sample += 1) {
    const state = stateAtTime(
      geometry.isochronousPeriod * 2 * sample / 1200,
    );
    near(state.bobVelocity.length(), Math.abs(state.arcVelocity),
      9e-16, 'bob speed equals arc-coordinate speed');
    near(state.potentialHeight,
      kinematics.potentialHeightAtArcCoordinate(state.arcCoordinate),
      7e-16, 'state quadratic potential height');
  }
  assert.match(data.transmission.energyLaw, /potential exactly quadratic/);
  disposeModel(model.root);
});

test('movement 369 ideal oscillation period and extreme-to-bottom time are independent of release amplitude', () => {
  const model = createMovementModel(catalog.movements[368]);
  const data = model.root.userData;
  const { geometry, tautochrone } = data;
  const expectedPeriod = 4 * Math.PI * Math.sqrt(
    geometry.cycloidRadius / geometry.gravity,
  );

  near(geometry.isochronousPeriod, expectedPeriod, 5e-16,
    'Huygens cycloidal period');
  near(tautochrone.angularFrequency,
    Math.sqrt(geometry.gravity / (4 * geometry.cycloidRadius)),
    0, 'natural angular frequency');
  near(tautochrone.timeFromRestAtEitherExtremeToBottom,
    expectedPeriod / 4, 2e-16, 'common fall time');
  for (const degrees of [10, 30, 60, 100, 140]) {
    const amplitude = THREE.MathUtils.degToRad(degrees);
    near(tautochrone.periodForAmplitude(amplitude), expectedPeriod,
      5e-16, `period at ${degrees} degrees`);
    const released = tautochrone.releasedFromRestStateAtTime(0, amplitude);
    const bottom = tautochrone.releasedFromRestStateAtTime(
      expectedPeriod / 4,
      amplitude,
    );
    const opposite = tautochrone.releasedFromRestStateAtTime(
      expectedPeriod / 2,
      amplitude,
    );
    const closure = tautochrone.releasedFromRestStateAtTime(
      expectedPeriod,
      amplitude,
    );
    near(released.theta, amplitude, 4e-16,
      `release amplitude ${degrees}`);
    near(released.arcVelocity, 0, 0,
      `release at rest ${degrees}`);
    near(bottom.theta, 0, 0,
      `same quarter-period bottom crossing ${degrees}`);
    near(bottom.bobPoint.y, geometry.lowestBobY, 0,
      `bottom height ${degrees}`);
    near(opposite.theta, -amplitude, 4e-16,
      `opposite extreme ${degrees}`);
    near(closure.theta, released.theta, 0,
      `release-state closure ${degrees}`);
  }
  assert.throws(() => tautochrone.periodForAmplitude(Math.PI), RangeError);
  assert.match(tautochrone.equation, /gravity\/\(4\*cycloid radius\)/);
  assert.match(data.transmission.isochronousLaw,
    /amplitude-independent/);
  disposeModel(model.root);
});

test('movement 369 harmonic acceleration, analytic bob velocity, and total mechanical energy remain exact throughout the cycle', () => {
  const model = createMovementModel(catalog.movements[368]);
  const data = model.root.userData;
  const { geometry, stateAtTime, tautochrone } = data;
  let minimumEnergy = Infinity;
  let maximumEnergy = -Infinity;
  let maximumHarmonicResidual = 0;

  for (const amplitude of [
    THREE.MathUtils.degToRad(30),
    geometry.oscillationAmplitude,
    THREE.MathUtils.degToRad(140),
  ]) {
    minimumEnergy = Infinity;
    maximumEnergy = -Infinity;
    for (let sample = 0; sample <= 1200; sample += 1) {
      const state = tautochrone.stateAtTimeForAmplitude(
        geometry.isochronousPeriod * sample / 1200,
        amplitude,
      );
      maximumHarmonicResidual = Math.max(
        maximumHarmonicResidual,
        Math.abs(
          state.arcAcceleration
            + geometry.gravity / (4 * geometry.cycloidRadius)
              * state.arcCoordinate,
        ),
      );
      minimumEnergy = Math.min(minimumEnergy,
        state.totalMechanicalEnergy);
      maximumEnergy = Math.max(maximumEnergy,
        state.totalMechanicalEnergy);
    }
    assert.ok(maximumEnergy - minimumEnergy < 1.6e-14);
  }
  assert.ok(maximumHarmonicResidual < 2e-15);

  const h = 1e-5;
  for (const phase of [0.08, 0.18, 0.33, 0.58, 0.83]) {
    const time = geometry.isochronousPeriod * phase;
    const before = stateAtTime(time - h);
    const state = stateAtTime(time);
    const after = stateAtTime(time + h);
    near(
      (after.arcCoordinate - before.arcCoordinate) / (2 * h),
      state.arcVelocity,
      1.2e-9,
      'analytic arc velocity',
    );
    const numericBobVelocity = after.bobPoint.clone()
      .sub(before.bobPoint)
      .multiplyScalar(1 / (2 * h));
    vectorNear(numericBobVelocity, state.bobVelocity, 1.8e-9,
      'analytic Cartesian bob velocity');
  }
  disposeModel(model.root);
});

test('movement 369 renderer keeps constant cable topology, smooth cheek contact, exact constraints, and finite 3D transforms over 1,200 frames', () => {
  const model = createMovementModel(catalog.movements[368]);
  const data = model.root.userData;
  const { animationTiming, blocks, geometry } = data;
  let largestBobStep = 0;
  let largestContactStep = 0;
  let maximumCordError = 0;
  let maximumPathError = 0;
  let previousBob = null;
  let previousContact = null;
  const stages = new Set();

  assert.equal(animationTiming.authoredCyclePeriod,
    geometry.isochronousPeriod);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  for (let frame = 0; frame <= 1200; frame += 1) {
    const time = geometry.isochronousPeriod * frame / 1200;
    model.update(time);
    const state = data.currentState;
    stages.add(state.stage);
    vectorNear(blocks.bob.position, state.bobPoint, 0,
      'rendered bob position');
    vectorNear(blocks.contactBead.position, state.contactPoint, 0,
      'rendered cheek contact');
    assert.equal(blocks.cord.children.length, 1);
    assert.ok(blocks.cord.children.every(({ visible }) => visible));
    maximumCordError = Math.max(
      maximumCordError,
      Math.abs(data.constraints.cord.lengthError),
    );
    maximumPathError = Math.max(
      maximumPathError,
      Math.abs(
        data.constraints.cycloidalPath.arcCoordinate
          - data.constraints.cycloidalPath.arcCoordinateFromParameter,
      ),
      Math.abs(
        data.constraints.cycloidalPath.potentialHeight
          - data.constraints.cycloidalPath.potentialHeightFromArc,
      ),
    );
    near(data.constraints.tangency.collinearityError, 0, 0,
      'rendered tangent junction');
    if (previousBob !== null) {
      largestBobStep = Math.max(
        largestBobStep,
        blocks.bob.position.distanceTo(previousBob),
      );
      largestContactStep = Math.max(
        largestContactStep,
        blocks.contactBead.position.distanceTo(previousContact),
      );
    }
    previousBob = blocks.bob.position.clone();
    previousContact = blocks.contactBead.position.clone();
    if (frame % 100 === 0) {
      model.root.updateMatrixWorld(true);
      model.root.traverse((object) => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      });
    }
  }
  assert.ok(maximumCordError < 5e-16);
  assert.ok(maximumPathError < 8e-16);
  assert.ok(largestBobStep < 0.0133);
  assert.ok(largestContactStep < 0.0062);
  assert.equal(stages.size, 4);
  disposeModel(model.root);
});

test('movement 369 closes its cycloidal position, velocity, cord split, and energy exactly before movement 507', () => {
  const movement369 = catalog.movements[368];
  const movement507 = catalog.movements[506];
  const model369 = createMovementModel(movement369);
  const data = model369.root.userData;
  const { geometry, stateAtTime } = data;
  const start = stateAtTime(0);
  const closure = stateAtTime(geometry.isochronousPeriod);

  near(closure.theta, start.theta, 0, 'parameter closure');
  near(closure.thetaRate, start.thetaRate, 0,
    'parameter-rate closure');
  near(closure.arcCoordinate, start.arcCoordinate, 0,
    'arc-coordinate closure');
  near(closure.arcVelocity, start.arcVelocity, 0,
    'arc-velocity closure');
  near(closure.freeCordLength, start.freeCordLength, 0,
    'free-cord closure');
  near(closure.wrappedCordLength, start.wrappedCordLength, 0,
    'wrapped-cord closure');
  near(closure.totalMechanicalEnergy, start.totalMechanicalEnergy, 0,
    'energy closure');
  vectorNear(closure.bobPoint, start.bobPoint, 0,
    'bob closure');
  vectorNear(closure.contactPoint, start.contactPoint, 0,
    'contact closure');

  const model507 = createMovementModel(movement507);
  assert.equal(movement369.id, 369);
  assert.equal(movement369.fidelity, 'authored');
  assert.equal(model369.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model369.root);
});
