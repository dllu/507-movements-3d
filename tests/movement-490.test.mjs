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
  new URL('../src/simulation/authored-rope-steering.js', import.meta.url),
  'utf8',
);

const ARCHETYPE =
  'single-wound-steering-rope-over-two-guide-sheaves-driving-a-rudder-tiller';

function movementModel() {
  const movement = catalog.movements[489];
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

test('movement 490 has exactly one steering rope, one barrel, two guides, and one tiller', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom } = model.root.userData;

  assert.equal(movement.id, 490);
  assert.equal(movement.number, '490');
  assert.equal(movement.category, 'Ropes, belts & pulleys');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.barrel.parent, blocks.wheelAndBarrel);
  assert.equal(blocks.handwheelRim.parent, blocks.wheelAndBarrel);
  assert.equal(blocks.handwheelSpokes.length, 8);
  assert.equal(blocks.upperGuide.rotating.parent, blocks.upperGuide.fixed);
  assert.equal(blocks.lowerGuide.rotating.parent, blocks.lowerGuide.fixed);
  assert.equal(blocks.tillerBar.parent, blocks.tiller);
  assert.equal(blocks.rudderHead.parent, blocks.tiller);
  assert.equal(degreesOfFreedom.independentOperatingCoordinates, 1);
  assert.equal(degreesOfFreedom.ropeBranchesIndependent, 0);
  assert.equal(
    degreesOfFreedom.tillerRotationConstrainedByDifferentialRopeLength,
    1,
  );

  const ropes = [];
  const beltObjects = [];
  model.root.traverse((object) => {
    if (object.userData.isSingleContinuousRope) ropes.push(object);
    if (object.userData.isBelt) beltObjects.push(object);
  });
  assert.deepEqual(ropes, [blocks.rope]);
  assert.deepEqual(beltObjects, []);
  assert.equal(blocks.rope.userData.isSingleContinuousRope, true);
  assert.equal(blocks.rope.userData.isBelt, false);
  disposeModel(model.root);
});

test('movement 490 records Brown, unavailable animation, and historical rope practice', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;
  const evidence = sourceReference.constructionEvidence;
  const plate = sourceReference.brownPlate490;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_490.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description,
    /Ordinary steering apparatus\. Plan view.*hand-wheel.*barrel.*one end.*wound on.*other let off.*tiller/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.equal(sourceAnimation.officialPageMarksAnimationUnavailable, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.reason,
    /no animation library or canvas model.*Animated unavailable/s);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.approximateBarrelCenterPixels, [180, 280]);
  assert.deepEqual(plate.approximateGuideCentersPixels,
    [218, 122, 218, 431]);
  assert.deepEqual(plate.approximateRudderCenterPixels, [464, 282]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.engravingEvidence,
    /one handwheel and coaxial grooved barrel.*exactly two guide pulleys.*one tiller lever.*square-keyed rudder head/s);
  assert.match(evidence.ballantyneCorroboration,
    /tiller.*lever moving the rudder.*ropes and pulleys.*drum of the steering wheel/s);
  assert.match(evidence.imperialEncyclopaediaCorroboration,
    /five turns.*middle turn was nailed/s);
  assert.match(evidence.reconstructionDisclosure,
    /five-turn helical display.*independently engineered.*middle fastening.*not separately imposed/s);
  disposeModel(model.root);
});

test('movement 490 rope leaves barrel and both guide sheaves at exact tangent contacts', () => {
  const { model } = movementModel();
  const {
    branchRoutesAtTillerAngle,
    geometry,
    ropeConstruction,
  } = model.root.userData;

  const checkFixedTangent = (drumContact, guideContact, guideCenter,
    label) => {
    near(drumContact.y, geometry.drumCenter.y, 0, `${label} front generator`);
    near(geometry.upperRopePlaneZ, geometry.drumRadius, 0, `${label} barrel radius`);
    near(guideContact.distanceTo(guideCenter),
      geometry.guideRadius, 2e-16, `${label} guide radius`);
    const span = guideContact.clone().sub(drumContact);
    // The X-axis barrel radius points along Z at both exit points;
    // the free span lies in XY and is tangent to that cylinder.
    near(span.dot(guideContact.clone().sub(guideCenter)),
      0, 3e-16, `${label} guide tangency`);
  };
  checkFixedTangent(
    ropeConstruction.upperDrumContact,
    ropeConstruction.upperFixedGuideContact,
    geometry.upperGuideCenter,
    'upper',
  );
  checkFixedTangent(
    ropeConstruction.lowerDrumContact,
    ropeConstruction.lowerFixedGuideContact,
    geometry.lowerGuideCenter,
    'lower',
  );

  for (const angle of [-geometry.maximumTillerAngle, -0.19, 0, 0.23,
    geometry.maximumTillerAngle]) {
    const routes = branchRoutesAtTillerAngle(angle);
    for (const [label, route, center] of [
      ['upper', routes.upper, geometry.upperGuideCenter],
      ['lower', routes.lower, geometry.lowerGuideCenter],
    ]) {
      near(route.attachmentGuideContact.distanceTo(center),
        geometry.guideRadius, 3e-16,
        `${label} moving contact radius at ${angle}`);
      const attachmentSpan = route.attachmentGuideContact.clone()
        .sub(route.attachment);
      near(attachmentSpan.dot(
        route.attachmentGuideContact.clone().sub(center),
      ), 0, 1e-15, `${label} moving tangency at ${angle}`);
    }
  }
  near(geometry.visibleWrapCount,
    geometry.helicalAngleSpan / (Math.PI * 2), 0,
    'visible wrap count');
  assert.equal(geometry.visibleWrapCount, 5);
  disposeModel(model.root);
});

test('movement 490 tiller angle solves the differential branch-length constraint', () => {
  const { model } = movementModel();
  const {
    branchRoutesAtTillerAngle,
    geometry,
    solveTillerAngleForDifferential,
    stateAtTime,
    transmission,
  } = model.root.userData;

  let previousDifference = Infinity;
  for (let sample = 0; sample <= 400; sample += 1) {
    const angle = THREE.MathUtils.lerp(
      -geometry.maximumTillerAngle,
      geometry.maximumTillerAngle,
      sample / 400,
    );
    const difference = branchRoutesAtTillerAngle(angle).differentialLength;
    assert.ok(difference < previousDifference,
      `differential length monotonic at ${sample}`);
    near(solveTillerAngleForDifferential(difference), angle, 8e-15,
      `inverse rope solution ${sample}`);
    previousDifference = difference;
  }
  for (let sample = 0; sample <= 720; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 720);
    assert.ok(Math.abs(state.tillerAngleRadian)
      <= geometry.maximumTillerAngle + 1e-15);
    near(state.differentialLength, state.targetDifferentialLength,
      2e-14, `driven differential closure ${sample}`);
    near(state.differentialLength - geometry.neutralDifferentialLength,
      2 * state.ropeDisplacement, 2e-14,
      `wind-one-pay-out-other closure ${sample}`);
  }
  assert.match(transmission.differentialConstraint,
    /L_lower\(delta\)-L_upper\(delta\)=DeltaL_0\+2\*r_barrel\*theta_barrel/s);
  disposeModel(model.root);
});

test('movement 490 handwheel, barrel, guide sheaves, and tiller rates share one rope speed', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const epsilon = 1e-5;

  for (const time of [0.21, 0.77, 1.39, 2.61, 3.52, 4.33, 5.74,
    7.19]) {
    const state = stateAtTime(time);
    near(state.handwheelAngleRadian, state.barrelAngleRadian, 0,
      `coaxial driver ${time}`);
    near(state.ropeSpeed,
      geometry.drumRadius * state.barrelAngularVelocityRadianPerSecond,
      0, `barrel no slip ${time}`);
    near(Math.abs(state.upperGuideAngularVelocityRadianPerSecond),
      Math.abs(state.ropeSpeed) / geometry.guideRadius,
      1e-15, `upper guide ratio ${time}`);
    near(Math.abs(state.lowerGuideAngularVelocityRadianPerSecond),
      Math.abs(state.ropeSpeed) / geometry.guideRadius,
      1e-15, `lower guide ratio ${time}`);
    const tillerFiniteDifference = (
      stateAtTime(time + epsilon).tillerAngleRadian
      - stateAtTime(time - epsilon).tillerAngleRadian
    ) / (2 * epsilon);
    near(state.tillerAngularVelocityRadianPerSecond,
      tillerFiniteDifference, 2e-6,
      `implicit tiller rate ${time}`);
  }
  assert.match(transmission.guideNoSlip,
    /abs\(omega_guide\)=abs\(v_rope\)\/r_guide.*v_rope=r_barrel\*omega_barrel/s);
  assert.match(transmission.tillerRate,
    /delta_dot=2\*r_barrel\*theta_dot\/\(d\(L_lower-L_upper\)\/d\(delta\)\)/s);
  assert.match(transmission.wheelBarrelConstraint,
    /theta_handwheel=theta_barrel/s);
  disposeModel(model.root);
});

test('movement 490 is one uninterrupted curve from one tiller end through all wraps to the other', () => {
  const { model } = movementModel();
  const { blocks, dynamics, geometry, ropeConstruction, ropePathState } =
    model.root.userData;
  assert.ok(ropePathState.curve instanceof THREE.CatmullRomCurve3);
  assert.ok(ropePathState.points.length > 200);
  assert.ok(ropePathState.pathLength > 0);
  assert.equal(blocks.rope.geometry.type, 'LaidRopeGeometry');
  const first = ropePathState.points[0];
  const last = ropePathState.points.at(-1);
  near(first.z, geometry.upperRopePlaneZ, 0, 'upper rope plane');
  near(last.z, geometry.lowerRopePlaneZ, 0, 'lower rope plane');
  vectorNear(ropeConstruction.helicalPoints[0], new THREE.Vector3(
    geometry.upperDrumContact.x,
    geometry.upperDrumContact.y,
    geometry.upperRopePlaneZ,
  ), 0, 'upper helix junction');
  vectorNear(ropeConstruction.helicalPoints.at(-1), new THREE.Vector3(
    geometry.lowerDrumContact.x,
    geometry.lowerDrumContact.y,
    geometry.lowerRopePlaneZ,
  ), 0, 'lower helix junction');
  for (let index = 1; index < ropePathState.points.length; index += 1) {
    assert.ok(ropePathState.points[index].distanceTo(
      ropePathState.points[index - 1],
    ) > 0, `duplicate/disconnected sample ${index}`);
  }
  assert.match(dynamics.continuity,
    /exactly one Curve3 centerline and one laid-rope mesh.*upper guide.*barrel helix.*lower guide/s);
  assert.match(dynamics.historicalSlackDisclosure,
    /drawn taut and straight in every span.*taken as rope stretch.*does not solve tension, friction or axial creep/s);
  assert.ok(geometry.maximumTautStretch / geometry.freeRopeLength < 0.02,
    'the taut rope never needs more than two percent stretch');
  disposeModel(model.root);
});

test('movement 490 renderer follows the solved driver, guides, tiller, and moving rope ends', () => {
  const { model } = movementModel();
  const { blocks, geometry, ropePathState, stateAtTime } =
    model.root.userData;

  for (const time of [0, 0.67, 1.41, 2, 3.17, 4.52, 6, 7.31, 8]) {
    const state = stateAtTime(time);
    model.update(time);
    near(blocks.wheelAndBarrel.rotation.x, state.barrelAngleRadian, 0,
      `rendered wheel ${time}`);
    near(blocks.upperGuide.rotating.rotation.z,
      state.upperGuideAngleRadian, 0, `rendered upper guide ${time}`);
    near(blocks.lowerGuide.rotating.rotation.z,
      state.lowerGuideAngleRadian, 0, `rendered lower guide ${time}`);
    near(blocks.tiller.rotation.z, state.tillerAngleRadian, 0,
      `rendered tiller ${time}`);
    const upperEnd = state.routes.upper.attachment;
    const lowerEnd = state.routes.lower.attachment;
    vectorNear(ropePathState.points[0], new THREE.Vector3(
      upperEnd.x,
      upperEnd.y,
      geometry.upperRopePlaneZ,
    ), 0, `upper tiller end ${time}`);
    vectorNear(ropePathState.points.at(-1), new THREE.Vector3(
      lowerEnd.x,
      lowerEnd.y,
      geometry.lowerRopePlaneZ,
    ), 0, `lower tiller end ${time}`);
  }
  disposeModel(model.root);
});

test('movement 490 laid-rope lay travels smoothly with the drum payout, without markers', () => {
  const { model } = movementModel();
  const { blocks, dynamics, stateAtTime } = model.root.userData;
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.filter((role) => /material-marker/.test(role)).length, 0,
    'laid rope carries no painted flow markers');
  for (const time of [0, 0.37, 1.29, 2.44, 4.61, 6.83]) {
    model.update(time);
    assert.equal(blocks.rope.geometry.type, 'LaidRopeGeometry');
    assert.equal(blocks.rope.geometry.userData.travel,
      stateAtTime(time).ropeDisplacement, `lay travel at ${time}`);
  }
  model.update(0.7100);
  const positions = blocks.rope.geometry.attributes.position;
  const before = Array.from({ length: 64 }, (_, index) =>
    new THREE.Vector3().fromBufferAttribute(positions,
      Math.floor(index * positions.count / 64)));
  model.update(0.7101);
  before.forEach((point, index) => {
    const step = point.distanceTo(new THREE.Vector3().fromBufferAttribute(
      positions, Math.floor(index * positions.count / 64)));
    assert.ok(step < 0.01, `smooth lay step ${index}: ${step}`);
  });
  assert.match(sourceText,
    /updateRopeGeometry\(state\.routes, state\.ropeDisplacement\)/);
  assert.match(dynamics.layTravel,
    /signed analytic drum payout.*arc length.*free spans, guide arcs, and barrel turns.*without painted markers/s);
  disposeModel(model.root);
});

test('movement 490 fixed frame stays fixed, fits all helm angles, and leaves spinning movement 507 next', () => {
  const { model } = movementModel();
  const { blocks, geometry } = model.root.userData;
  // Brown draws no deck, posts or pedestals: none is built.
  assert.equal(blocks.deck, undefined);
  assert.equal(blocks.wheelPedestals, undefined);
  const fixedObjects = [
    blocks.fixedShaft,
    ...blocks.shaftBearings,
    blocks.upperGuide.fixed,
    blocks.lowerGuide.fixed,
  ];
  model.root.updateMatrixWorld(true);
  const matrices = fixedObjects.map((object) => object.matrixWorld.clone());
  const union = new THREE.Box3();
  for (let sample = 0; sample <= 240; sample += 1) {
    model.update(geometry.cycleDuration * sample / 240);
    model.root.updateMatrixWorld(true);
    union.union(new THREE.Box3().setFromObject(model.root, true));
  }
  fixedObjects.forEach((object, index) => {
    assert.ok(object.matrixWorld.equals(matrices[index]),
      `fixed object ${index} moved`);
  });
  assert.ok(model.root.userData.cameraFitBounds.containsBox(union));
  assert.ok(model.root.userData.cameraDistanceScale >= 1);

  const next = catalog.movements[506];
  assert.equal(next.id, 507);
  assert.equal(next.number, '507');
  assert.equal(next.archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(next.fidelity, 'authored');
  disposeModel(model.root);
});

test('movement 490 rope is taut: every free span is a straight line at every helm angle', () => {
  const { model } = movementModel();
  const { geometry, ropePathState } = model.root.userData;
  for (const time of [0, 1.1, 2, 3.3, 4, 5.7, 6, 7.4]) {
    model.update(time);
    const state = model.root.userData.stateAtTime(time);
    for (const route of [state.routes.upper, state.routes.lower]) {
      const start = route.points[0], end = route.points[1];
      const line = new THREE.Line3(start, end), closest = new THREE.Vector3();
      // Sample the rendered centreline near the span and require collinearity.
      for (let i = 0; i <= 400; i += 1) {
        const p = ropePathState.curve.getPointAt(i / 400);
        const t = line.closestPointToPointParameter(p, false);
        if (t < 0.02 || t > 0.98) continue;
        line.at(t, closest);
        if (closest.distanceTo(p) > 0.2) continue;
        assert.ok(closest.distanceTo(p) < 2e-3, `span sag ${closest.distanceTo(p)} at ${time}`);
      }
    }
  }
  assert.ok(geometry.maximumTautStretch > 0);
  disposeModel(model.root);
});
