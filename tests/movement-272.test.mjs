import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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
    geometry,
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
  assert.match(mechanism, /circumference-is-bevelled-parallel-to-the-rod/);
  assert.match(mechanism, /front-face-is-a-wavy-trough/);
  assert.match(mechanism, /domed-end-bears-on-the-wavy-chamfer-square-to-it/);
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
  // Brown draws only the two rod guides and a bare shaft: no base, posts,
  // shaft bearings, backing rail, brackets or riser.
  for (const name of ['shaftBearings', 'bearingPosts', 'baseRail', 'guideBackingRail', 'guideBrackets', 'guideRiser']) {
    assert.equal(blocks[name], undefined, `${name} is not drawn`);
  }

  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) =>
    role === 'solid-disk-with-bevelled-rim-and-wavy-trough-face').length, 1);
  // p93: Brown's output rod is one broad flat bar with a crowned end, run
  // in two square guide blocks; the shaft carries only the rear collar.
  assert.equal(roles.filter((role) =>
    role === 'flat-output-bar-with-crowned-end-bearing-on-disk-chamfer').length, 1);
  assert.equal(blocks.followerRod, blocks.contactShoe);
  assert.ok(geometry.rodWidth > geometry.rodDepth);
  assert.ok(geometry.rodWidth / (geometry.camBackX - geometry.faceProfile.centerX + geometry.troughDepth) > 0.25);
  assert.ok(geometry.shaftRadius >= 0.16);
  assert.equal(blocks.frontHub, undefined);
  assert.equal(roles.filter((role) =>
    role === 'fixed-square-guide-block-for-inclined-output-bar').length, 2);
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
  vectorNear(sourceState.contactPoint, geometry.sourceSurfacePoint, 1e-7,
    'source-pose point of contact');
  vectorNear(sourceState.shoeCenter, geometry.sourceShoeCenter, 1e-9,
    'source-pose shoe center');
  disposeModel(model.root);
});

test('movement 272 source pose bears square on the chamfer at the top and the rod rises and falls twice per turn', () => {
  const model = createMovementModel(catalog.movements[271]);
  const {
    chamferSectionAtAngle,
    faceXAtLocalY,
    geometry,
    stateAtDriverAngle,
    transmission,
  } = model.root.userData;
  const source = stateAtDriverAngle(0);
  const inner = stateAtDriverAngle(Math.PI / 2);
  const opposite = stateAtDriverAngle(Math.PI);

  // The rim cone is parallel to the inclined rod and the chamfer square to it.
  near(Math.tan(geometry.bevelAngle), -geometry.followerDirection.y
    / geometry.followerDirection.x, 1e-15, 'rim bevel parallels the rod');
  const top = chamferSectionAtAngle(0);
  const generator = new THREE.Vector3(top.outerX - top.innerX,
    top.outerRadius - top.innerRadius, 0).normalize();
  near(generator.dot(geometry.followerDirection), 0, 1e-12,
    'chamfer generator square to the rod at the top');
  near(top.outerRadius, geometry.camOuterRadius, 1e-12, 'peak at the drawn radius');
  near(top.innerX, faceXAtLocalY(top.innerRadius), 1e-12, 'chamfer starts on the face rim');
  near(geometry.sourceShoeCenter.distanceTo(geometry.sourceSurfacePoint),
    geometry.tipSphereRadius + geometry.contactClearance, 1e-15,
    'dome centre one radius plus running clearance off the chamfer');
  vectorNear(source.contactPoint, geometry.sourceSurfacePoint, 1e-7,
    'source contact mid-chamfer on the rod axis');
  near(source.displacement, 0, 1e-12, 'outer dead-center displacement');
  near(source.displacementSpeed, 0, 1e-9, 'outer dead-center speed');
  assert.equal(source.stage, 'rod-outer-dead-center');
  near(inner.displacement, -geometry.outputStroke, 1e-12,
    'inner dead center a quarter turn later');
  near(inner.displacementSpeed, 0, 1e-9, 'inner dead-center speed');
  assert.equal(inner.stage, 'rod-inner-dead-center');
  near(opposite.displacement, source.displacement, 1e-12,
    'second outer dead center half a turn later');
  assert.ok(geometry.outputStroke > 0.35 && geometry.outputStroke < 0.5);
  near(transmission.outputStroke, geometry.outputStroke, 0,
    'reported transmission stroke');
  assert.equal(transmission.strokesPerRevolution, 2);
  assert.ok(geometry.faceProfile.centerX < geometry.camBackX,
    'the trough never reaches the flat back face');
  disposeModel(model.root);
});

test('movement 272 renders a closed disk: trough face, chamfer, bevel cone and rear face', () => {
  const model = createMovementModel(catalog.movements[271]);
  const { blocks, chamferSectionAtAngle, faceXAtLocalY, geometry } = model.root.userData;
  // The rendered body splits its vertices at the creases; weld by position
  // to check the solid.
  const rendered = blocks.camBody.geometry;
  assert.equal(rendered.userData.closedSolid, true);
  const solid = new THREE.BufferGeometry();
  solid.setAttribute('position', rendered.getAttribute('position'));
  solid.setIndex(rendered.index);
  const body = mergeVertices(solid, 1e-6);
  const positions = body.getAttribute('position');
  assert.deepEqual([...undirectedEdgeHistogram(body).keys()], [2],
    'every body edge belongs to exactly two triangles');
  let front = 0;
  let back = 0;
  let peak = 0;
  let chamfer = 0;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const section = chamferSectionAtAngle(Math.atan2(z, y));
    if (Math.abs(x - geometry.camBackX) < 1e-6) {
      back += 1;
      assert.ok(Math.hypot(y, z) <= geometry.camBackRadius + 1e-6);
    } else if (Math.abs(x - section.outerX) < 2e-6
      && Math.abs(Math.hypot(y, z) - section.outerRadius) < 1e-5) {
      peak += 1;
    } else if (Math.hypot(y, z) > section.innerRadius + 1e-5) {
      // Intermediate chamfer rings lie on the straight generator.
      const t = (Math.hypot(y, z) - section.innerRadius)
        / (section.outerRadius - section.innerRadius);
      near(x, section.innerX + t * (section.outerX - section.innerX), 3e-6,
        `chamfer vertex ${index} on its generator`);
      chamfer += 1;
    } else {
      front += 1;
      near(x, faceXAtLocalY(y), 2e-6, `front vertex ${index} on trough`);
      assert.ok(Math.hypot(y, z) <= section.innerRadius + 1e-5);
    }
  }
  assert.ok(front > 3000 && back === geometry.camSegments + 1);
  assert.equal(peak, geometry.camSegments, 'one peak ring behind the wavy rim');
  assert.ok(chamfer >= geometry.camSegments, 'chamfer rings between rim and peak');
  assert.ok(geometry.chamferLength > 0.4, 'the chamfer is a band, not a knife edge');
  assert.ok(chamferSectionAtAngle(Math.PI / 2).outerRadius
    < chamferSectionAtAngle(0).outerRadius - 0.1,
  'the side rim is lower where the trough is shallow');
  assert.equal(blocks.bevelFace, undefined, 'no coincident working skin');
  assert.equal(blocks.frontWavyEdge, undefined, 'no dark edge tube on the wavy rim');
  assert.equal(blocks.rearEdge, undefined, 'no dark torus on the rear rim');
  disposeModel(model.root);
});

test('movement 272 keeps the rod end bearing square on the chamfer throughout a revolution', () => {
  const model = createMovementModel(catalog.movements[271]);
  const { geometry, stateAtDriverAngle } = model.root.userData;
  let minimum = Infinity;
  let maximum = -Infinity;
  let worstAngle = 0;
  const stages = new Set();
  for (let sample = 0; sample <= 1024; sample += 1) {
    const state = stateAtDriverAngle(FULL_TURN * sample / 1024);
    assert.ok(Number.isFinite(state.displacement));
    assert.ok(state.shoePlaneGap < 1e-9, `dome radius at ${sample}`);
    assert.ok(Math.abs(state.normalVelocityError) < 2e-5,
      `no separating velocity at ${sample}`);
    const offset = state.shoeCenter.clone().sub(geometry.sourceShoeCenter);
    assert.ok(new THREE.Vector3().crossVectors(offset,
      geometry.followerDirection).length() < 1e-15,
    `rod remains on the guide axis at ${sample}`);
    // Contact stays inside the chamfer (clear of both its edges) and on the
    // rod's end dome, with the chamfer nearly square to the rod.
    assert.ok(state.chamferContactAlong > 0.2
      && state.chamferContactAlong < geometry.chamferLength - 0.2,
    `contact on the chamfer at ${sample}: ${state.chamferContactAlong}`);
    assert.ok(state.contactAxisOffset < geometry.rodRadius,
      `contact on the rod end at ${sample}`);
    worstAngle = Math.max(worstAngle, state.contactAngleFromRodAxis);
    minimum = Math.min(minimum, state.displacement);
    maximum = Math.max(maximum, state.displacement);
    stages.add(state.stage);
  }
  assert.ok(worstAngle < 15 * Math.PI / 180,
    `chamfer normal within 15 degrees of the rod: ${worstAngle}`);
  near(maximum, 0, 1e-12, 'outer dead center');
  near(minimum, -geometry.outputStroke, 1e-9, 'inner dead center');
  assert.ok(stages.has('rod-moving-inward-toward-beveled-cam'));
  assert.ok(stages.has('rod-moving-outward-along-inclined-guides'));
  disposeModel(model.root);
});

test('movement 272 follower rates match finite differences and repeat every half turn', () => {
  const model = createMovementModel(catalog.movements[271]);
  const { stateAtDriverAngle, timeline } = model.root.userData;
  const angleStep = 1e-3;
  for (const angle of [0.17, 0.63, 1.21, 2.04, 2.71, 3.43, 4.18, 5.39]) {
    const before = stateAtDriverAngle(angle - angleStep);
    const state = stateAtDriverAngle(angle);
    const after = stateAtDriverAngle(angle + angleStep);
    near(state.displacementPerRadian,
      (after.displacement - before.displacement) / (2 * angleStep), 1e-6,
      `first derivative at angle ${angle}`);
    near(state.displacementSpeed,
      state.displacementPerRadian * timeline.driverAngularSpeed, 0,
      `time speed at angle ${angle}`);
    vectorNear(state.shoeVelocity,
      model.root.userData.geometry.followerDirection.clone()
        .multiplyScalar(state.displacementSpeed),
      0, `shoe velocity at angle ${angle}`);
    near(stateAtDriverAngle(angle + Math.PI).displacement, state.displacement,
      1e-12, `half-turn periodicity at ${angle}`);
  }
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
  ].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
  }));
  const camChildTransforms = [
    blocks.camBody,
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
  // Only Brown's two rod guides are fixed parts; the disk carries no dark
  // edge tubes. The plate has one collar, behind the disk; the bar and its
  // crowned end are one mesh.
  // The coincident working-band skin is gone: the rod bears on the body's
  // own chamfer.
  assert.equal(meshCount, 9);
  const size = new THREE.Box3().setFromObject(model.root)
    .getSize(new THREE.Vector3());
  assert.ok(size.x > 6.9);
  assert.ok(size.y > 5.8);
  assert.ok(size.z > 3.5, 'the side rim is lower where the trough is shallow');
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
  vectorNear(closure.contactPoint, start.contactPoint, 1e-12,
    'closed contact point');
  near(half.displacement, start.displacement, 1e-12,
    'half-cycle is the second outer dead center');
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
  vectorNear(blocks.contactMarker.position, sourceContact, 1e-12,
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
