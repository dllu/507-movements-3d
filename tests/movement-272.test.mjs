import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
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

function undirectedEdgeHistogram(geometry) {
  const edgeUses = new Map();
  const indices = geometry.index.array;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = [
      indices[offset],
      indices[offset + 1],
      indices[offset + 2],
    ];
    for (let edge = 0; edge < 3; edge += 1) {
      const first = triangle[edge];
      const second = triangle[(edge + 1) % 3];
      const key = first < second
        ? `${first}:${second}`
        : `${second}:${first}`;
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
    }
  }
  const histogram = new Map();
  for (const uses of edgeUses.values()) {
    histogram.set(uses, (histogram.get(uses) ?? 0) + 1);
  }
  return histogram;
}

test('movement 272 is one beveled disk cam driving one inclined sliding rod', () => {
  const movement = catalog.movements[271];
  const model = createMovementModel(movement);
  const {
    archetype,
    blocks,
    fidelity,
    mechanism,
    transmission,
  } = model.root.userData;

  assert.equal(movement.id, 272);
  assert.equal(movement.number, '272');
  assert.equal(movement.title,
    'Beveled Disk Cam and Inclined Sliding Rod');
  assert.equal(movement.category, 'Cams & followers');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(
    archetype,
    'horizontal-shaft-wavy-beveled-disk-cam-driving-inclined-guided-rod',
  );
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one-horizontal-shaft-rotates-one-circular-disk/);
  assert.match(mechanism, /oblique-bevel/);
  assert.match(mechanism, /one-gravity-preloaded-rod/);
  assert.match(mechanism, /two-fixed-inclined-guides/);
  assert.equal(transmission.inputMotion,
    'continuous-rotation-about-one-fixed-horizontal-axis');
  assert.equal(transmission.followerMotion,
    'reciprocating-rectilinear-along-one-fixed-inclined-axis');
  assert.equal(transmission.preload, 'gravity-maintained-unilateral-contact');

  assert.equal(blocks.camAssembly.parent, model.root);
  assert.equal(blocks.camRotor.parent, blocks.camAssembly);
  for (const part of [
    blocks.camBody,
    blocks.bevelFace,
    blocks.frontWavyEdge,
    blocks.rearEdge,
    blocks.shaft,
    blocks.hub,
    blocks.rotationIndex,
  ]) {
    assert.equal(part.parent, blocks.camRotor);
  }
  assert.equal(blocks.follower.parent, model.root);
  assert.equal(blocks.contactShoe.parent, blocks.follower);
  assert.equal(blocks.followerRod.parent, blocks.follower);
  assert.equal(blocks.translationIndex.parent, blocks.follower);
  assert.equal(blocks.followerGuides.length, 2);
  assert.ok(blocks.followerGuides.every((guide) => guide.parent === model.root));
  assert.equal(blocks.shaftBearings.length, 2);
  assert.ok(blocks.shaftBearings.every((bearing) => bearing.parent === model.root));

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'solid-circular-disk-with-oblique-front-face').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'straight-output-rod-sliding-only-along-its-axis').length, 1);
  assert.equal(roles.filter((role) =>
    role === 'fixed-split-bearing-for-inclined-output-rod').length, 2);
  assert.equal(roles.filter((role) => /gear|belt|pulley/.test(role)).length, 0);
  disposeModel(model.root);
});

test('movement 272 records the unavailable animation and measured source plate', () => {
  const model = createMovementModel(catalog.movements[271]);
  const {
    geometry,
    sourceAnimation,
    sourceReference,
    stateAtDriverAngle,
  } = model.root.userData;
  const plate = sourceReference.plate272;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /animation unavailable/);
  assert.match(sourceAnimation.reason, /reconstructed/);
  assert.equal(sourceReference.officialDescription,
    catalog.movements[271].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 7);
  assert.equal(plate.officialAnimationAvailable, false);
  assert.deepEqual(plate.rasterCam, {
    center: { x: 337, y: 344 },
    lowerFrontEdge: { x: 270, y: 451 },
    outerRadius: 140,
    upperFrontEdge: { x: 292, y: 205 },
  });
  assert.deepEqual(plate.rasterFollower, {
    contact: { x: 292, y: 209 },
    farEnd: { x: 70, y: 57 },
    guideStations: [
      { x: 119, y: 105 },
      { x: 237, y: 188 },
    ],
  });
  assert.deepEqual(plate.rasterShaft, {
    axisY: 344,
    leftEndX: 157,
    rightEndX: 490,
  });
  assert.match(plate.inferredTopology, /one horizontal shaft/);
  assert.match(plate.inferredTopology, /one inclined sliding rod/);
  assert.match(plate.inferredPreload, /gravity/);
  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 69,
    edition: 21,
    illustrationPage: 68,
    publicationYear: 1908,
  });

  const rasterDirection = new THREE.Vector3(
    plate.rasterFollower.farEnd.x - plate.rasterFollower.contact.x,
    plate.rasterFollower.contact.y - plate.rasterFollower.farEnd.y,
    0,
  ).normalize();
  near(
    THREE.MathUtils.radToDeg(
      Math.acos(rasterDirection.dot(geometry.followerDirection)),
    ),
    1.43983526066571,
    2e-14,
    'modeled rod inclination versus the measured raster',
  );
  assert.equal(
    plate.rasterShaft.axisY,
    plate.rasterCam.center.y,
    'engraved shaft passes through the cam center',
  );
  const sourceState = stateAtDriverAngle(0);
  vectorNear(sourceState.contactPoint, geometry.sourceSurfacePoint, 0,
    'source-pose point of contact');
  vectorNear(sourceState.shoeCenter, geometry.sourceShoeCenter, 0,
    'source-pose shoe center');
  disposeModel(model.root);
});

test('movement 272 source pose and dead centers follow the oblique bevel exactly', () => {
  const model = createMovementModel(catalog.movements[271]);
  const {
    geometry,
    stateAtDriverAngle,
    transmission,
  } = model.root.userData;
  const source = stateAtDriverAngle(0);
  const opposite = stateAtDriverAngle(Math.PI);
  const normal = new THREE.Vector3(
    -1,
    geometry.bevelTiltCoefficient,
    0,
  ).normalize();

  near(geometry.bevelAngle, Math.atan(0.18), 0, 'bevel angle');
  near(THREE.MathUtils.radToDeg(geometry.bevelAngle),
    10.203973721731684, 2e-14, 'bevel angle in degrees');
  near(
    geometry.sourceSurfacePoint.x
      - geometry.bevelTiltCoefficient * geometry.sourceSurfacePoint.y,
    geometry.camFrontX,
    2e-16,
    'source point lies on the front bevel plane',
  );
  vectorNear(
    geometry.sourceShoeCenter,
    geometry.sourceSurfacePoint.clone().addScaledVector(
      normal,
      geometry.shoeRadius,
    ),
    2e-16,
    'rounded shoe center is one radius outside the bevel',
  );
  near(source.displacement, 0, 0, 'inner dead-center displacement');
  near(source.displacementSpeed, 0, 0, 'inner dead-center speed');
  assert.equal(source.atDeadCenter, true);
  assert.equal(source.stage, 'rod-inner-dead-center');
  near(opposite.displacement, 0.7486551197153658, 1e-15,
    'outer dead-center displacement');
  near(opposite.displacementSpeed, 0, 5e-17,
    'outer dead-center speed');
  assert.equal(opposite.atDeadCenter, true);
  assert.equal(opposite.stage, 'rod-outer-dead-center');
  near(geometry.outputStroke,
    opposite.displacement - source.displacement, 0,
    'full follower stroke');
  near(transmission.outputStroke, geometry.outputStroke, 0,
    'reported transmission stroke');
  assert.ok(source.contactRadius > geometry.bevelInnerRadius);
  assert.ok(opposite.contactRadius < geometry.camOuterRadius);
  assert.ok(geometry.camFrontX
    + geometry.bevelTiltCoefficient * geometry.camOuterRadius
    < geometry.camBackX,
  'the sloped front never crosses the flat back face');
  disposeModel(model.root);
});

test('movement 272 renders a closed wedge disk and a continuous annular bevel', () => {
  const model = createMovementModel(catalog.movements[271]);
  const { blocks, geometry } = model.root.userData;
  const body = blocks.camBody.geometry;
  const bevel = blocks.bevelFace.geometry;
  const bodyPositions = body.getAttribute('position');
  const bevelPositions = bevel.getAttribute('position');

  assert.equal(body.userData.closedSolid, true);
  assert.equal(bodyPositions.count, 2 + 2 * geometry.camSegments);
  assert.equal(body.index.count / 3, 4 * geometry.camSegments);
  assert.deepEqual(
    [...undirectedEdgeHistogram(body).entries()],
    [[2, 6 * geometry.camSegments]],
    'every body edge belongs to exactly two triangles',
  );
  near(bodyPositions.getX(0), geometry.camFrontX, 1e-7,
    'front center x');
  near(bodyPositions.getX(1), geometry.camBackX, 1e-7,
    'back center x');
  for (let index = 0; index < geometry.camSegments; index += 1) {
    const frontIndex = 2 + index;
    const backIndex = 2 + geometry.camSegments + index;
    near(
      bodyPositions.getX(frontIndex)
        - geometry.bevelTiltCoefficient * bodyPositions.getY(frontIndex),
      geometry.camFrontX,
      2e-7,
      `front ring plane at vertex ${index}`,
    );
    near(bodyPositions.getX(backIndex), geometry.camBackX, 2e-8,
      `flat rear face at vertex ${index}`);
    near(
      Math.hypot(
        bodyPositions.getY(frontIndex),
        bodyPositions.getZ(frontIndex),
      ),
      geometry.camOuterRadius,
      2e-7,
      `front boundary radius at vertex ${index}`,
    );
  }

  assert.equal(bevelPositions.count, 2 * geometry.camSegments);
  assert.equal(bevel.index.count / 3, 2 * geometry.camSegments);
  const offsetPlaneValue = -geometry.bevelSurfaceOffset
    * geometry.planeNormalMagnitude;
  for (let index = 0; index < bevelPositions.count; index += 1) {
    near(
      bevelPositions.getX(index)
        - geometry.bevelTiltCoefficient * bevelPositions.getY(index)
        - geometry.camFrontX,
      offsetPlaneValue,
      2e-7,
      `visible bevel offset at vertex ${index}`,
    );
  }
  assert.equal(blocks.frontWavyEdge.geometry.parameters.closed, true);
  assert.equal(blocks.frontWavyEdge.geometry.parameters.tubularSegments,
    2 * geometry.camSegments);
  assert.equal(blocks.rearEdge.geometry.type, 'TorusGeometry');
  disposeModel(model.root);
});

test('movement 272 maintains exact shoe contact throughout a full revolution', () => {
  const model = createMovementModel(catalog.movements[271]);
  const {
    geometry,
    stateAtDriverAngle,
  } = model.root.userData;
  let minimumDenominatorMagnitude = Infinity;
  let minimumInnerClearance = Infinity;
  let minimumOuterClearance = Infinity;
  let minimumDisplacement = Infinity;
  let maximumDisplacement = -Infinity;
  let maximumNormalVelocityError = 0;
  const stages = new Set();

  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtDriverAngle(FULL_TURN * sample / 16384);
    assert.ok(Number.isFinite(state.displacement));
    assert.ok(state.denominator < 0);
    assert.ok(state.bevelPlaneError < 8e-16,
      `bevel plane at sample ${sample}`);
    assert.ok(state.shoePlaneGap < 5e-16,
      `shoe offset plane at sample ${sample}`);
    assert.ok(Math.abs(state.normalVelocityError) < 4e-16,
      `zero separating velocity at sample ${sample}`);
    near(state.shoeCenter.distanceTo(state.contactPoint),
      geometry.shoeRadius, 5e-16,
      `rounded shoe radius at sample ${sample}`);
    near(
      Math.hypot(state.localContactPoint.y, state.localContactPoint.z),
      state.contactRadius,
      3e-16,
      `local contact radius at sample ${sample}`,
    );
    const centerlineOffset = state.shoeCenter.clone()
      .sub(geometry.sourceShoeCenter);
    assert.ok(
      new THREE.Vector3().crossVectors(
        centerlineOffset,
        geometry.followerDirection,
      ).length() < 3e-16,
      `shoe remains on one guide axis at sample ${sample}`,
    );
    assert.ok(state.contactRadiusInnerClearance >= 0.099999999999999,
      `inner annulus clearance at sample ${sample}`);
    assert.ok(state.contactRadiusOuterClearance >= 0.05018,
      `outer annulus clearance at sample ${sample}`);
    minimumDenominatorMagnitude = Math.min(
      minimumDenominatorMagnitude,
      Math.abs(state.denominator),
    );
    minimumInnerClearance = Math.min(
      minimumInnerClearance,
      state.contactRadiusInnerClearance,
    );
    minimumOuterClearance = Math.min(
      minimumOuterClearance,
      state.contactRadiusOuterClearance,
    );
    minimumDisplacement = Math.min(minimumDisplacement, state.displacement);
    maximumDisplacement = Math.max(maximumDisplacement, state.displacement);
    maximumNormalVelocityError = Math.max(
      maximumNormalVelocityError,
      Math.abs(state.normalVelocityError),
    );
    stages.add(state.stage);
  }
  assert.ok(minimumDenominatorMagnitude > 0.741);
  near(minimumInnerClearance, 0.1, 2e-15,
    'minimum inner annulus clearance');
  near(minimumOuterClearance, 0.050185772466182055, 2e-15,
    'minimum outer annulus clearance');
  near(minimumDisplacement, 0, 0, 'minimum follower displacement');
  near(maximumDisplacement, geometry.outputStroke, 2e-15,
    'maximum follower displacement');
  assert.ok(maximumNormalVelocityError < 4e-16);
  assert.deepEqual(stages, new Set([
    'rod-inner-dead-center',
    'rod-moving-inward-toward-beveled-cam',
    'rod-outer-dead-center',
    'rod-moving-outward-along-inclined-guides',
  ]));
  disposeModel(model.root);
});

test('movement 272 analytic follower rates are smooth and match finite differences', () => {
  const model = createMovementModel(catalog.movements[271]);
  const {
    stateAtDriverAngle,
    timeline,
  } = model.root.userData;
  const angleStep = 1e-5;

  for (const angle of [0.17, 0.63, 1.21, 2.04, 2.71, 3.43, 4.18, 5.39]) {
    const before = stateAtDriverAngle(angle - angleStep);
    const state = stateAtDriverAngle(angle);
    const after = stateAtDriverAngle(angle + angleStep);
    const finiteFirst = (after.displacement - before.displacement)
      / (2 * angleStep);
    const finiteSecond = (after.displacement
      - 2 * state.displacement
      + before.displacement) / angleStep ** 2;
    near(state.displacementPerRadian, finiteFirst, 5e-11,
      `first derivative at angle ${angle}`);
    near(state.displacementSecondPerRadian, finiteSecond, 9e-6,
      `second derivative at angle ${angle}`);
    near(state.displacementSpeed,
      state.displacementPerRadian * timeline.driverAngularSpeed,
      0, `time speed at angle ${angle}`);
    near(state.displacementAcceleration,
      state.displacementSecondPerRadian * timeline.driverAngularSpeed ** 2,
      0, `time acceleration at angle ${angle}`);
    vectorNear(state.shoeVelocity,
      model.root.userData.geometry.followerDirection.clone()
        .multiplyScalar(state.displacementSpeed),
      0, `shoe velocity at angle ${angle}`);
  }

  const firstQuarter = stateAtDriverAngle(Math.PI / 2);
  const secondQuarter = stateAtDriverAngle(3 * Math.PI / 2);
  assert.ok(firstQuarter.displacementSpeed < 0);
  assert.equal(firstQuarter.stage, 'rod-moving-inward-toward-beveled-cam');
  assert.ok(secondQuarter.displacementSpeed > 0);
  assert.equal(secondQuarter.stage,
    'rod-moving-outward-along-inclined-guides');
  near(stateAtDriverAngle(0).displacementSpeed, 0, 0,
    'inner dead-center speed');
  near(stateAtDriverAngle(Math.PI).displacementSpeed, 0, 5e-17,
    'outer dead-center speed');
  const seamBefore = stateAtDriverAngle(-1e-7);
  const seamAfter = stateAtDriverAngle(FULL_TURN - 1e-7);
  near(seamBefore.displacement, seamAfter.displacement, 2e-16,
    'periodic displacement across angle seam');
  near(seamBefore.displacementSpeed, seamAfter.displacementSpeed, 2e-16,
    'periodic speed across angle seam');
  disposeModel(model.root);
});

test('movement 272 renderer binds one rigid rotor and one fixed-axis follower', () => {
  const model = createMovementModel(catalog.movements[271]);
  const {
    blocks,
    geometry,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const fixedParts = [
    ...blocks.followerGuides,
    ...blocks.guideBrackets,
    ...blocks.shaftBearings,
    ...blocks.bearingPosts,
    blocks.guideBackingRail,
    blocks.baseRail,
  ].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));
  const camChildTransforms = [
    blocks.camBody,
    blocks.bevelFace,
    blocks.frontWavyEdge,
    blocks.rearEdge,
    blocks.shaft,
    blocks.hub,
    blocks.rotationIndex,
  ].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));
  const guideAxis = Z_AXIS.clone().applyQuaternion(
    blocks.followerGuides[0].quaternion,
  );
  vectorNear(guideAxis, geometry.followerDirection, 3e-16,
    'first guide axis');
  vectorNear(
    Z_AXIS.clone().applyQuaternion(blocks.followerGuides[1].quaternion),
    geometry.followerDirection,
    3e-16,
    'second guide axis',
  );
  vectorNear(
    Y_AXIS.clone().applyQuaternion(blocks.follower.quaternion),
    geometry.followerDirection,
    2e-16,
    'rod axis',
  );
  assert.ok(
    geometry.translationIndexDistance
      - geometry.guideDistances.at(-1)
      > geometry.guideLength / 2,
    'the translating index stays visibly beyond the outer guide',
  );
  vectorNear(blocks.camAssembly.userData.axis, X_AXIS, 0,
    'horizontal cam axis');

  for (const time of [0, 0.37, 1.28, 2.93, timeline.cyclePeriod]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.camRotor.rotation.x, state.driverAngle, 0,
      `rendered cam angle at ${time}`);
    vectorNear(blocks.follower.position, state.shoeCenter, 0,
      `rendered rod translation at ${time}`);
    vectorNear(blocks.contactShoe.getWorldPosition(new THREE.Vector3()),
      state.shoeCenter, 2e-16, `rendered shoe center at ${time}`);
    vectorNear(blocks.contactMarker.position, state.contactPoint, 0,
      `rendered contact marker at ${time}`);
    near(blocks.shaft.userData.angularSpeed,
      timeline.driverAngularSpeed, 0, `shaft speed at ${time}`);
    near(blocks.follower.userData.speed,
      state.displacementSpeed, 0, `rod speed at ${time}`);
    near(model.root.userData.contacts.bevelToFollowerShoe.shoePlaneGap,
      state.shoePlaneGap, 0, `runtime shoe gap at ${time}`);
    near(
      model.root.userData.contacts.bevelToFollowerShoe.normalVelocityError,
      state.normalVelocityError,
      0,
      `runtime normal velocity at ${time}`,
    );
    assert.equal(model.root.userData.contacts.followerGuides.length, 2);
    assert.equal(model.root.userData.contacts.shaftBearings.length, 2);
    for (const fixed of fixedParts) {
      vectorNear(fixed.object.position, fixed.position, 0,
        `fixed position at ${time}`);
      assert.ok(fixed.object.quaternion.equals(fixed.quaternion),
        `fixed orientation at ${time}`);
    }
    for (const child of camChildTransforms) {
      vectorNear(child.object.position, child.position, 0,
        `rigid cam-child position at ${time}`);
      assert.ok(child.object.quaternion.equals(child.quaternion),
        `rigid cam-child orientation at ${time}`);
    }
  }

  let meshCount = 0;
  model.root.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.equal(meshCount, 33);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  assert.ok(size.x > 7);
  assert.ok(size.y > 6.5);
  assert.ok(size.z > 4.1);
  assert.ok(model.cameraDirection.z > model.cameraDirection.x);
  assert.ok(model.cameraDirection.x < 0, 'default view exposes the working bevel and shoe');
  disposeModel(model.root);
});

test('movement 272 closes one exact revolution and leaves movement 507 authored', () => {
  const movement = catalog.movements[271];
  const model = createMovementModel(movement);
  const {
    animationTiming,
    blocks,
    stateAtTime,
    timeline,
  } = model.root.userData;
  const start = stateAtTime(0);
  const half = stateAtTime(timeline.cyclePeriod / 2);
  const closure = stateAtTime(timeline.cyclePeriod);

  near(timeline.cyclePeriod, FULL_TURN / 0.82, 0,
    'one input revolution period');
  near(timeline.driverAngularSpeed, -0.82, 0,
    'clockwise source rotation');
  near(closure.driverAngle - start.driverAngle, -FULL_TURN, 0,
    'one clockwise input turn');
  near(closure.inputRevolutions - start.inputRevolutions, -1, 0,
    'one signed input revolution');
  near(closure.displacement, start.displacement, 0,
    'closed rod displacement');
  near(closure.displacementSpeed, start.displacementSpeed, 6e-17,
    'closed rod speed');
  vectorNear(closure.shoeCenter, start.shoeCenter, 0,
    'closed shoe center');
  vectorNear(closure.contactPoint, start.contactPoint, 6e-18,
    'closed contact point');
  near(half.displacement, model.root.userData.geometry.outputStroke, 1e-15,
    'half-cycle outer dead center');
  assert.equal(half.stage, 'rod-outer-dead-center');
  near(animationTiming.authoredCyclePeriod, timeline.cyclePeriod, 0,
    'authored cycle period');
  near(animationTiming.targetCycleDuration, 2, 0,
    'display cycle duration');
  assertReadableTiming(animationTiming);

  model.update(0);
  const sourceShoe = blocks.follower.position.clone();
  const sourceContact = blocks.contactMarker.position.clone();
  model.update(timeline.cyclePeriod);
  vectorNear(blocks.follower.position, sourceShoe, 0,
    'rendered shoe closure');
  vectorNear(blocks.contactMarker.position, sourceContact, 6e-18,
    'rendered contact closure');

  const movement507 = catalog.movements[506];
  const model289 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model289.root.userData.fidelity, 'authored');
  disposeModel(model289.root);
  disposeModel(model.root);
});
