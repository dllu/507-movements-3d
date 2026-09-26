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

test('movement 204 is one tangent pair of ruled hyperboloidal friction wheels on skew shafts', () => {
  const movement = catalog.movements[203];
  const model = createMovementModel(movement);
  const {
    blocks,
    sourceAnchors,
    sourceAnimation,
    sourceRaster,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 204);
  assert.equal(movement.number, '204');
  assert.equal(
    movement.title,
    'Hyperboloidal Friction Wheels for Skew Shafts',
  );
  assert.equal(movement.category, 'Friction drives');
  assert.equal(
    movement.description,
    '204. An illustration of the transmission of rotary motion from one shaft to another, arranged obliquely to it, by means of rolling contact.',
  );
  assert.equal(
    movement.archetype,
    'tangent-hyperboloids-skew-shaft-rolling-sliding-friction-drive',
  );
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  assert.equal(
    model.root.userData.mechanism,
    'equal-external-one-sheet-hyperboloidal-friction-axodes-on-nonparallel-nonintersecting-shafts',
  );
  assert.equal(
    model.root.userData.variant,
    'common-straight-generator-with-exact-transverse-rolling-and-unavoidable-uniform-longitudinal-sliding',
  );

  assert.equal(blocks.driver.parent, model.root);
  assert.equal(blocks.driven.parent, model.root);
  assert.equal(blocks.driverShaft.parent, model.root);
  assert.equal(blocks.drivenShaft.parent, model.root);
  assert.equal(blocks.driverBody.parent, blocks.driver.userData.rotor);
  assert.equal(blocks.drivenBody.parent, blocks.driven.userData.rotor);
  assert.equal(
    blocks.driverMaterialStripe.parent,
    blocks.driver.userData.rotor,
  );
  assert.equal(
    blocks.drivenMaterialStripe.parent,
    blocks.driven.userData.rotor,
  );
  assert.equal(blocks.driver.userData.hyperboloid, true);
  assert.equal(blocks.driven.userData.hyperboloid, true);
  assert.equal(blocks.driverBody.userData.nominalRuledHyperboloid, true);
  assert.equal(blocks.drivenBody.userData.nominalRuledHyperboloid, true);
  assert.equal(blocks.driverShaft.userData.keyedToHyperboloid, true);
  assert.equal(blocks.drivenShaft.userData.keyedToHyperboloid, true);
  assert.equal(blocks.contactMarkers.length, 9);
  assert.equal(blocks.bearingRings.length, 4);
  assert.equal(blocks.bearingPosts.length, 4);
  assert.equal(blocks.baseRails.length, 4);
  assert.equal(blocks.driverEndFaceIndexes.length, 2);
  assert.equal(blocks.drivenEndFaceIndexes.length, 2);
  assert.ok(blocks.driverMaterialStripe.userData.generator);
  assert.ok(blocks.drivenMaterialStripe.userData.generator);

  assert.equal(transmission.contactLineCount, 1);
  assert.equal(transmission.externalTangency, true);
  assert.equal(transmission.equalMagnitudeCounterRotation, true);
  assert.equal(transmission.transverseRollingWithoutSlip, true);
  assert.equal(transmission.longitudinalSliding, true);
  assert.equal(transmission.pureRollingAlongContactLine, false);
  assert.equal(sourceAnimation.available, false);
  assert.deepEqual(sourceRaster.imageSize.toArray(), [525, 525]);
  assert.equal(sourceRaster.sourceUrl, movement.sourceUrl);
  assert.deepEqual(sourceAnchors.topShaftAxis.left.toArray(), [20, 154]);
  assert.deepEqual(sourceAnchors.topShaftAxis.right.toArray(), [516, 202]);
  assert.deepEqual(sourceAnchors.bottomShaftAxis.left.toArray(), [18, 343]);
  assert.deepEqual(sourceAnchors.bottomShaftAxis.right.toArray(), [518, 275]);

  const roleCounts = {
    beltPulleyGearOrTooth: 0,
    commonContactLine: 0,
    contactMarker: 0,
    hyperboloid: 0,
    rotatingEndFaceIndex: 0,
    rotatingGeneratorStripe: 0,
  };
  model.root.traverse((object) => {
    const role = object.userData.role ?? '';
    if (/belt|pulley|gear|tooth/i.test(role)) {
      roleCounts.beltPulleyGearOrTooth += 1;
    }
    if (role === 'stationary-common-generator-and-instantaneous-screw-axis') {
      roleCounts.commonContactLine += 1;
    }
    if (role === 'point-on-common-hyperboloid-contact-generator') {
      roleCounts.contactMarker += 1;
    }
    if (object.userData.hyperboloid === true) roleCounts.hyperboloid += 1;
    if (/rotating-end-face-index$/.test(role)) {
      roleCounts.rotatingEndFaceIndex += 1;
    }
    if (/rotating-generator-index-stripe$/.test(role)) {
      roleCounts.rotatingGeneratorStripe += 1;
    }
  });
  assert.deepEqual(roleCounts, {
    beltPulleyGearOrTooth: 0,
    commonContactLine: 1,
    contactMarker: 9,
    hyperboloid: 2,
    rotatingEndFaceIndex: 4,
    rotatingGeneratorStripe: 2,
  });
  disposeModel(model.root);
});

test('movement 204 constructs two disjoint one-sheet hyperboloids around nonparallel, nonintersecting axes', () => {
  const model = createMovementModel(catalog.movements[203]);
  const { blocks, geometry, sourceRaster, transmission } = model.root.userData;
  const {
    axisOffset,
    axisSeparation,
    bodyHalfLength,
    contactHalfLength,
    contactLineDirection,
    contactLineOrigin,
    drivenAxis,
    drivenOrigin,
    driverAxis,
    driverOrigin,
    endRadius,
    generatorAngle,
    instantaneousScrewAxisPoint,
    radiusAtAxial,
    relativeAngularVelocityVector,
    relativeTwistConstant,
    relativeTwistPitch,
    shaftAngle,
    surfaceResidual,
    throatRadius,
  } = geometry;

  near(THREE.MathUtils.radToDeg(shaftAngle), 40, 1e-14, 'shaft angle');
  near(
    THREE.MathUtils.radToDeg(generatorAngle),
    20,
    1e-14,
    'generator angle',
  );
  near(driverAxis.length(), 1, 1e-15, 'driver axis unit length');
  near(drivenAxis.length(), 1, 1e-15, 'driven axis unit length');
  near(driverAxis.dot(drivenAxis), Math.cos(shaftAngle), 1e-15, 'axis dot product');
  near(driverAxis.clone().cross(drivenAxis).length(), Math.sin(shaftAngle), 1e-15, 'axes are nonparallel');
  vector3Near(
    axisSeparation,
    driverOrigin.clone().sub(drivenOrigin),
    1e-15,
    'shortest axis separation vector',
  );
  near(axisSeparation.length(), axisOffset, 1e-15, 'shaft-axis offset');
  near(axisSeparation.dot(driverAxis), 0, 1e-15, 'offset normal to driver axis');
  near(axisSeparation.dot(drivenAxis), 0, 1e-15, 'offset normal to driven axis');
  const axisCross = driverAxis.clone().cross(drivenAxis);
  const closestAxisDistance = Math.abs(
    drivenOrigin.clone().sub(driverOrigin).dot(axisCross),
  ) / axisCross.length();
  near(closestAxisDistance, axisOffset, 1e-15, 'positive skew-axis distance');

  vector3Near(contactLineOrigin, new THREE.Vector3(), 1e-15, 'contact-line origin');
  vector3Near(contactLineDirection, X_AXIS, 1e-15, 'common contact generator');
  vector3Near(
    contactLineDirection,
    driverAxis.clone().add(drivenAxis).normalize(),
    1e-15,
    'contact generator is the acute axis bisector',
  );
  near(
    driverAxis.angleTo(contactLineDirection),
    generatorAngle,
    1e-15,
    'driver axis-to-generator angle',
  );
  near(
    drivenAxis.angleTo(contactLineDirection),
    generatorAngle,
    1e-15,
    'driven axis-to-generator angle',
  );
  near(throatRadius, axisOffset / 2, 1e-15, 'symmetric throat radius');
  near(
    contactHalfLength,
    bodyHalfLength / Math.cos(generatorAngle),
    1e-15,
    'finite common-generator half length',
  );
  near(
    endRadius,
    Math.hypot(throatRadius, bodyHalfLength * Math.tan(generatorAngle)),
    1e-15,
    'hyperboloid end radius',
  );

  for (const wheel of [blocks.driver, blocks.driven]) {
    assert.equal(wheel.userData.profile.length, geometry.profileSampleCount + 1);
    wheel.userData.profile.forEach((sample, index) => {
      const axial = THREE.MathUtils.lerp(
        -bodyHalfLength,
        bodyHalfLength,
        index / geometry.profileSampleCount,
      );
      near(sample.y, axial, 1e-15, `profile axial sample ${index}`);
      near(sample.x, radiusAtAxial(axial), 1e-15, `profile radius ${index}`);
      assert.ok(sample.x >= throatRadius);
    });
    near(wheel.userData.profile[0].x, endRadius, 1e-15, 'negative-end radius');
    near(wheel.userData.profile.at(-1).x, endRadius, 1e-15, 'positive-end radius');
  }

  model.root.updateMatrixWorld(true);
  for (const [wheel, origin, axis] of [
    [blocks.driver, driverOrigin, driverAxis],
    [blocks.driven, drivenOrigin, drivenAxis],
  ]) {
    for (const endpoint of wheel.userData.generatorEndpoints) {
      const worldEndpoint = wheel.userData.rotor.localToWorld(endpoint.clone());
      near(
        Math.abs(surfaceResidual(worldEndpoint, origin, axis)),
        0,
        2e-15,
        'painted generator endpoint remains on its hyperboloid',
      );
      near(
        Math.abs(worldEndpoint.clone().sub(origin).dot(axis)),
        bodyHalfLength,
        2e-15,
        'painted generator reaches an end plane',
      );
    }
  }

  // For these symmetric bodies, F_driver + F_driven is a positive
  // quadratic away from y=z=0.  Therefore their solid interiors cannot
  // overlap; equality occurs only on the one common generator.
  const zCoefficient = 1 - Math.tan(generatorAngle) ** 2;
  assert.ok(zCoefficient > 0);
  for (let xIndex = -8; xIndex <= 8; xIndex += 1) {
    for (let yIndex = -8; yIndex <= 8; yIndex += 1) {
      for (let zIndex = -8; zIndex <= 8; zIndex += 1) {
        const point = new THREE.Vector3(
          xIndex * contactHalfLength / 8,
          yIndex * 1.5 / 8,
          zIndex * 1.5 / 8,
        );
        const driverResidual = surfaceResidual(point, driverOrigin, driverAxis);
        const drivenResidual = surfaceResidual(point, drivenOrigin, drivenAxis);
        near(
          driverResidual + drivenResidual,
          2 * (point.y ** 2 + zCoefficient * point.z ** 2),
          1e-14,
          'noninterpenetration residual identity',
        );
        assert.ok(driverResidual >= -1e-14 || drivenResidual >= -1e-14);
      }
    }
  }

  const expectedRelativeAngularVelocity = driverAxis.clone()
    .multiplyScalar(transmission.driverAngularSpeed)
    .addScaledVector(drivenAxis, -transmission.drivenAngularSpeed);
  vector3Near(
    relativeAngularVelocityVector,
    expectedRelativeAngularVelocity,
    1e-15,
    'relative angular velocity',
  );
  vector3Near(
    relativeAngularVelocityVector.clone().normalize(),
    contactLineDirection,
    1e-15,
    'relative angular velocity follows the common generator',
  );
  vector3Near(
    relativeTwistConstant,
    contactLineDirection.clone().multiplyScalar(
      transmission.nominalLongitudinalSlidingSpeed,
    ),
    1e-15,
    'relative twist translation',
  );
  vector3Near(
    instantaneousScrewAxisPoint,
    contactLineOrigin,
    1e-15,
    'instantaneous screw-axis point',
  );
  near(
    relativeTwistPitch,
    throatRadius * Math.tan(generatorAngle),
    1e-15,
    'relative screw pitch',
  );
  near(
    THREE.MathUtils.radToDeg(sourceRaster.projectedAxisAngle),
    13.272250698079088,
    1e-13,
    'source raster projected shaft angle',
  );
  disposeModel(model.root);
});

test('movement 204 nominal smooth axodes have exact tangency, transverse rolling, and uniform sliding at 32,769 points', () => {
  const model = createMovementModel(catalog.movements[203]);
  const {
    contactAtLineParameter,
    geometry,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  const maxima = {
    axial: 0,
    longitudinalVariation: 0,
    normalAlignment: 0,
    normalVelocity: 0,
    radial: 0,
    relativeOffGenerator: 0,
    surfaceResidual: 0,
    transverseRolling: 0,
    transverseVelocityMatch: 0,
  };
  const expectedRelativeVelocity = geometry.contactLineDirection.clone()
    .multiplyScalar(transmission.nominalLongitudinalSlidingSpeed);

  for (let index = 0; index <= sampleCount; index += 1) {
    const lineParameter = THREE.MathUtils.lerp(
      -geometry.contactHalfLength,
      geometry.contactHalfLength,
      index / sampleCount,
    );
    const contact = contactAtLineParameter(lineParameter);
    if (index % 2048 === 0) finiteStateNumbers(contact, `contact[${index}]`);
    const expectedPoint = geometry.contactLineOrigin.clone().addScaledVector(
      geometry.contactLineDirection,
      lineParameter,
    );
    vector3Near(contact.point, expectedPoint, 1e-15, `contact point ${index}`);
    const expectedAxial = lineParameter * Math.cos(geometry.generatorAngle);
    const expectedRadius = geometry.radiusAtAxial(expectedAxial);
    maxima.axial = Math.max(
      maxima.axial,
      Math.abs(contact.driverAxial - expectedAxial),
      Math.abs(contact.drivenAxial - expectedAxial),
    );
    maxima.radial = Math.max(
      maxima.radial,
      Math.abs(contact.driverRadialDistance - expectedRadius),
      Math.abs(contact.drivenRadialDistance - expectedRadius),
    );
    maxima.surfaceResidual = Math.max(
      maxima.surfaceResidual,
      Math.abs(contact.driverSurfaceResidual),
      Math.abs(contact.drivenSurfaceResidual),
    );
    maxima.normalAlignment = Math.max(
      maxima.normalAlignment,
      Math.abs(contact.driverNormal.dot(contact.drivenNormal) + 1),
      Math.abs(contact.driverNormal.dot(geometry.contactLineDirection)),
      Math.abs(contact.drivenNormal.dot(geometry.contactLineDirection)),
    );
    maxima.normalVelocity = Math.max(
      maxima.normalVelocity,
      contact.normalVelocityError,
    );
    maxima.transverseRolling = Math.max(
      maxima.transverseRolling,
      contact.transverseRollingError,
    );
    maxima.transverseVelocityMatch = Math.max(
      maxima.transverseVelocityMatch,
      contact.transverseVelocityMatchError,
      contact.driverTransverseVelocity.distanceTo(
        contact.drivenTransverseVelocity,
      ),
    );
    maxima.relativeOffGenerator = Math.max(
      maxima.relativeOffGenerator,
      contact.relativeVelocity.clone().cross(
        geometry.contactLineDirection,
      ).length(),
    );
    maxima.longitudinalVariation = Math.max(
      maxima.longitudinalVariation,
      contact.relativeVelocity.distanceTo(expectedRelativeVelocity),
      Math.abs(
        contact.longitudinalSlidingSpeed
          - transmission.nominalLongitudinalSlidingSpeed,
      ),
    );
    assert.ok(Math.abs(contact.driverAxial) <= geometry.bodyHalfLength + 1e-15);
    assert.ok(Math.abs(contact.drivenAxial) <= geometry.bodyHalfLength + 1e-15);
  }

  assert.ok(maxima.axial <= 1e-15, `maximum axial error ${maxima.axial}`);
  assert.ok(maxima.radial <= 5e-16, `maximum radial error ${maxima.radial}`);
  assert.ok(
    maxima.surfaceResidual <= 1.2e-15,
    `maximum surface residual ${maxima.surfaceResidual}`,
  );
  assert.ok(
    maxima.normalAlignment <= 7e-16,
    `maximum normal/tangent error ${maxima.normalAlignment}`,
  );
  assert.ok(
    maxima.normalVelocity <= 3e-16,
    `maximum normal velocity ${maxima.normalVelocity}`,
  );
  assert.equal(maxima.transverseRolling, 0);
  assert.equal(maxima.transverseVelocityMatch, 0);
  assert.equal(maxima.relativeOffGenerator, 0);
  assert.equal(maxima.longitudinalVariation, 0);
  assert.ok(transmission.nominalLongitudinalSlidingSpeed > 0.48);
  assert.ok(transmission.nominalLongitudinalSlidingSpeed < 0.481);
  disposeModel(model.root);
});

test('movement 204 keeps its exact 1-to-1 counterrotation and painted surface speeds through 32,769 states', () => {
  const model = createMovementModel(catalog.movements[203]);
  const {
    blocks,
    geometry,
    stateAtDriverAngle,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const sampleCount = 32768;
  const maxima = {
    angle: 0,
    normal: 0,
    pitch: 0,
    ratio: 0,
    sliding: 0,
    surface: 0,
    transverse: 0,
  };

  for (let index = 0; index <= sampleCount; index += 1) {
    const driverAngle = THREE.MathUtils.lerp(
      -FULL_TURN * 2,
      FULL_TURN * 2,
      index / sampleCount,
    );
    const inputAngularVelocity = transmission.driverAngularSpeed * (
      0.15 + 0.85 * Math.cos(driverAngle * 0.37)
    );
    const state = stateAtDriverAngle(driverAngle, inputAngularVelocity);
    if (index % 2048 === 0) finiteStateNumbers(state, `state[${index}]`);
    maxima.angle = Math.max(
      maxima.angle,
      Math.abs(state.drivenAngle + driverAngle),
    );
    maxima.ratio = Math.max(
      maxima.ratio,
      Math.abs(state.drivenAngularSpeed + inputAngularVelocity),
      state.drivenAngularVelocityVector.clone().addScaledVector(
        geometry.drivenAxis,
        inputAngularVelocity,
      ).length(),
      state.driverAngularVelocityVector.clone().addScaledVector(
        geometry.driverAxis,
        -inputAngularVelocity,
      ).length(),
    );
    maxima.surface = Math.max(maxima.surface, state.maximumSurfaceResidual);
    maxima.normal = Math.max(
      maxima.normal,
      state.maximumNormalAlignmentError,
      state.maximumNormalVelocityError,
    );
    maxima.transverse = Math.max(
      maxima.transverse,
      state.maximumTransverseRollingError,
    );
    const expectedSlidingSpeed = 2 * Math.abs(inputAngularVelocity)
      * geometry.throatRadius * Math.sin(geometry.generatorAngle);
    maxima.sliding = Math.max(
      maxima.sliding,
      Math.abs(state.longitudinalSlidingSpeed - expectedSlidingSpeed),
    );
    maxima.pitch = Math.max(
      maxima.pitch,
      Math.abs(state.relativeTwistPitch - geometry.relativeTwistPitch),
    );
  }
  assert.equal(maxima.angle, 0);
  assert.equal(maxima.ratio, 0);
  assert.ok(maxima.surface <= 4e-16, `maximum state surface residual ${maxima.surface}`);
  assert.ok(maxima.normal <= 3e-16, `maximum state normal error ${maxima.normal}`);
  assert.equal(maxima.transverse, 0);
  assert.ok(maxima.sliding <= 4e-16, `maximum sliding-rate error ${maxima.sliding}`);
  assert.equal(maxima.pitch, 0);

  const stoppedState = stateAtDriverAngle(1.37, 0);
  assert.equal(stoppedState.driverAngularSpeed, 0);
  assert.equal(stoppedState.drivenAngularSpeed, -0);
  assert.equal(stoppedState.longitudinalSlidingSpeed, 0);
  assert.equal(stoppedState.maximumTransverseRollingError, 0);

  const timeStep = 1e-5;
  const worldPointAt = (stripe, localPoint, time) => {
    model.update(time);
    model.root.updateMatrixWorld(true);
    return stripe.localToWorld(localPoint.clone());
  };
  for (const phase of [0.03, 0.19, 0.41, 0.68, 0.93]) {
    const time = phase * transmission.inputCyclePeriod;
    const state = stateAtTime(time);
    near(
      state.driverAngle,
      phase * FULL_TURN,
      2e-15,
      `driver time parameterization at phase ${phase}`,
    );
    for (const [name, wheel, stripe, axis, origin, angularSpeed] of [
      [
        'driver',
        blocks.driver,
        blocks.driverMaterialStripe,
        geometry.driverAxis,
        geometry.driverOrigin,
        transmission.driverAngularSpeed,
      ],
      [
        'driven',
        blocks.driven,
        blocks.drivenMaterialStripe,
        geometry.drivenAxis,
        geometry.drivenOrigin,
        transmission.drivenAngularSpeed,
      ],
    ]) {
      for (const [endpointIndex, localPoint] of wheel.userData.generatorEndpoints.entries()) {
        const previous = worldPointAt(stripe, localPoint, time - timeStep);
        const next = worldPointAt(stripe, localPoint, time + timeStep);
        const current = worldPointAt(stripe, localPoint, time);
        const numericalVelocity = next.clone().sub(previous)
          .multiplyScalar(1 / (2 * timeStep));
        const analyticVelocity = new THREE.Vector3().crossVectors(
          axis.clone().multiplyScalar(angularSpeed),
          current.clone().sub(origin),
        );
        vector3Near(
          numericalVelocity,
          analyticVelocity,
          1e-9,
          `${name} painted generator velocity ${endpointIndex} at phase ${phase}`,
        );
        near(
          Math.abs(geometry.surfaceResidual(current, origin, axis)),
          0,
          5e-15,
          `${name} painted generator stays on surface at phase ${phase}`,
        );
      }
    }
  }
  disposeModel(model.root);
});

test('movement 204 runtime keeps the contact generator fixed and remains distinct from authored movement 205', () => {
  const model = createMovementModel(catalog.movements[203]);
  const {
    blocks,
    canonicalTimes,
    contactAtLineParameter,
    geometry,
    stateAtTime,
    transmission,
  } = model.root.userData;
  const originalMarkerPositions = blocks.contactMarkers.map(
    (marker) => marker.position.clone(),
  );

  for (const time of [
    ...Object.values(canonicalTimes),
    transmission.inputCyclePeriod * 0.083,
    transmission.inputCyclePeriod * 0.337,
    transmission.inputCyclePeriod * 0.614,
    transmission.inputCyclePeriod * 1.783,
  ]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    near(
      blocks.driver.userData.rotor.rotation.z,
      state.driverAngle,
      1e-15,
      'runtime driver angle',
    );
    near(
      blocks.driverShaft.userData.rotor.rotation.z,
      state.driverAngle,
      1e-15,
      'runtime input-shaft angle',
    );
    near(
      blocks.driven.userData.rotor.rotation.z,
      state.drivenAngle,
      1e-15,
      'runtime driven angle',
    );
    near(
      blocks.drivenShaft.userData.rotor.rotation.z,
      state.drivenAngle,
      1e-15,
      'runtime output-shaft angle',
    );
    assert.equal(blocks.driver.userData.angularSpeed, state.driverAngularSpeed);
    assert.equal(blocks.driven.userData.angularSpeed, state.drivenAngularSpeed);
    assert.equal(model.root.userData.contacts.commonGenerator.length, 9);
    vector3Near(
      model.root.userData.contacts.instantaneousScrewAxis.direction,
      geometry.contactLineDirection,
      1e-15,
      'runtime instantaneous screw-axis direction',
    );
    state.contacts.forEach((contact, index) => {
      vector3Near(
        contact.point,
        blocks.contactMarkers[index].position,
        1e-15,
        `fixed contact marker ${index}`,
      );
      vector3Near(
        blocks.contactMarkers[index].position,
        originalMarkerPositions[index],
        1e-15,
        `contact marker ${index} does not orbit with either body`,
      );
      const independentlyEvaluated = contactAtLineParameter(
        contact.lineParameter,
      );
      vector3Near(
        contact.point,
        independentlyEvaluated.point,
        1e-15,
        `runtime contact ${index}`,
      );
    });
  }

  const indexWorldPosition = (object, time) => {
    model.update(time);
    model.root.updateMatrixWorld(true);
    return object.getWorldPosition(new THREE.Vector3());
  };
  for (const indexObject of [
    blocks.driverEndFaceIndexes[1],
    blocks.drivenEndFaceIndexes[0],
  ]) {
    const source = indexWorldPosition(indexObject, canonicalTimes.sourcePose);
    const quarter = indexWorldPosition(
      indexObject,
      canonicalTimes.quarterInputTurn,
    );
    const closure = indexWorldPosition(
      indexObject,
      canonicalTimes.oneInputTurn,
    );
    assert.ok(source.distanceTo(quarter) > 0.8, 'painted end-face index makes spin visible');
    vector3Near(closure, source, 2e-15, 'painted end-face index closes after one turn');
  }

  model.update(canonicalTimes.sourcePose);
  model.root.updateMatrixWorld(true);
  const physicalBounds = new THREE.Box3().setFromObject(model.root);
  const size = physicalBounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 7.1, 'rollers fill real width once the undrawn base is presented away');
  assert.ok(size.y > 3.7);
  assert.ok(size.z > 4.4);
  assert.ok(physicalBounds.min.x < -3.5);
  assert.ok(physicalBounds.max.x > 3.5);
  assert.ok(physicalBounds.min.y < -1.9);
  assert.ok(physicalBounds.max.y > 1.9);
  let visibleMeshCount = 0;
  model.root.traverse((object) => {
    if (object.isMesh && object.visible) visibleMeshCount += 1;
  });
  // The dark end-face rims Brown only inks are retired as hidden references.
  assert.ok(visibleMeshCount >= 16, 'the undrawn base, posts and painted end-face indices are presented away');
  // Brown looks square-on to the common generator, so the upper roller's
  // right end face and the lower roller's left end face both show and the
  // lower roller's near left end overlaps the upper one.
  assert.ok(Math.abs(model.cameraDirection.x) < 0.05 * model.cameraDirection.z);
  assert.ok(model.cameraDirection.y > 0);
  const { driverAxis, drivenAxis } = model.root.userData.geometry;
  const view = model.cameraDirection.clone().normalize();
  assert.ok(driverAxis.dot(view) > 0.25 && -drivenAxis.dot(view) > 0.25,
    'upper right and lower left end faces both face the viewer');

  const nextMovement = catalog.movements[204];
  const nextModel = createMovementModel(nextMovement);
  assert.equal(nextMovement.id, 205);
  assert.equal(nextMovement.fidelity, 'authored');
  assert.equal(nextModel.root.userData.fidelity, 'authored');
  assert.notEqual(nextModel.root.userData.archetype, model.root.userData.archetype);
  assert.notEqual(nextModel.root.userData.mechanism, model.root.userData.mechanism);
  disposeModel(nextModel.root);
  disposeModel(model.root);
});
