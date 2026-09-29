import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

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

test('movement 403 is one rigid three-rule cyclograph on two fixed chord-end guide pins', () => {
  const movement = catalog.movements[402];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { blocks, degreesOfFreedom } = data;

  assert.equal(movement.id, 403);
  assert.equal(movement.number, '403');
  assert.equal(movement.category, 'Miscellaneous mechanisms');
  assert.equal(movement.archetype,
    'three-rigid-rule-cyclograph-guided-by-two-fixed-chord-end-pins-with-pencil-intersection-tracing-constant-angle-circle');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(data.fidelity, 'authored');
  assert.equal(data.archetype, movement.archetype);
  assert.match(data.mechanism, /two straight sloping rules/);
  assert.match(data.mechanism, /one transverse third-rule brace/);
  assert.match(data.mechanism, /one fixed pin at each chord end/);
  assert.equal(degreesOfFreedom.independentPrescribedInputs, 1);
  assert.equal(degreesOfFreedom.storedEnergyStates, 0);
  assert.equal(data.transmission.planarRigidBodyCoordinates, 3);
  assert.equal(data.transmission.constraintCount, 2);
  assert.equal(data.transmission.remainingDegreesOfFreedom, 1);
  assert.equal(blocks.carriage.parent, model.root);
  assert.equal(blocks.leftRule.rule.parent, blocks.carriage);
  assert.equal(blocks.rightRule.rule.parent, blocks.carriage);
  assert.equal(blocks.brace.parent, blocks.carriage);
  assert.equal(blocks.bracePins.length, 2);
  assert.equal(blocks.guidePins.length, 2);
  assert.equal(blocks.pencil.parent, model.root);

  const roles = [];
  const belts = [];
  const gears = [];
  model.root.traverse((object) => {
    if (object.userData.role) roles.push(object.userData.role);
    if (object.userData.isBelt) belts.push(object);
    if (object.userData.teeth) gears.push(object);
  });
  assert.deepEqual(belts, []);
  assert.deepEqual(gears, []);
  for (const role of [
    'single-rigid-three-rule-cyclograph-carriage',
    'left-sloping-rule-guided-by-left-chord-pin',
    'right-sloping-rule-guided-by-right-chord-pin',
    'third-straight-rule-fastened-across-as-brace',
    'left-fixed-chord-end-guide-pin',
    'right-fixed-chord-end-guide-pin',
    'pencil-at-angle-of-crossing-rule-edges',
  ]) assert.ok(roles.includes(role), role);
  disposeModel(model.root);
});

test('movement 403 records Brown’s plate, written construction, and official visual animation scope', () => {
  const movement = catalog.movements[402];
  const model = createMovementModel(movement);
  const data = model.root.userData;
  const { dynamics, sourceAnimation, sourceReference } = data;
  const plate = sourceReference.brownPlate403;
  const evidence = sourceReference.constructionEvidence;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_403.html');
  assert.equal(sourceReference.officialPage, movement.sourceUrl);
  assert.match(movement.description, /composed of three straight rules/);
  assert.match(movement.description, /another rule across them.*brace/);
  assert.match(movement.description, /pin or point at each end of chord/);
  assert.match(movement.description, /pencil in the angle/);
  assert.equal(sourceAnimation.available, true);
  assert.equal(sourceAnimation.officialCanvasModelPresent, true);
  assert.equal(sourceAnimation.usedAsVisualReferenceOnly, true);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.equal(sourceAnimation.sourcePrescribedAbsoluteTiming, false);
  assert.match(sourceAnimation.visualEvidence, /two green chord-end pins fixed/);
  assert.match(sourceAnimation.visualEvidence, /three-rule assembly moves/);
  assert.equal(
    dynamics.sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces,
    false,
  );
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.deepEqual(plate.leftChordEndApproximatePixels, [90, 350]);
  assert.deepEqual(plate.rightChordEndApproximatePixels, [462, 350]);
  assert.deepEqual(plate.apexApproximatePixels, [278, 237]);
  assert.deepEqual(plate.braceApproximateEndpointsPixels,
    [72, 351, 480, 351]);
  assert.equal(evidence.explicitInBrownDescription.length, 6);
  assert.match(evidence.geometricInference, /point-on-line constraints/);
  assert.match(evidence.geometricInference, /rather than copied/);
  assert.match(evidence.reconstructionDisclosure,
    /independently synthesized/);
  disposeModel(model.root);
});

test('movement 403 derives the unique target circle and constant rule angle from chord and versed sine', () => {
  const model = createMovementModel(catalog.movements[402]);
  const data = model.root.userData;
  const { geometry, sourcePose, stateAtTime } = data;
  const expectedCenterY = (
    geometry.sagitta ** 2 - geometry.chordHalf ** 2
  ) / (2 * geometry.sagitta);
  const expectedRadius = (
    geometry.sagitta ** 2 + geometry.chordHalf ** 2
  ) / (2 * geometry.sagitta);

  near(geometry.circleCenter.x, 0, 0, 'circle center lies on bisector');
  near(geometry.circleCenter.y, expectedCenterY, 0,
    'circle center from sagitta');
  near(geometry.circleRadius, expectedRadius, 0,
    'circle radius from sagitta');
  near(geometry.leftGuidePin.distanceTo(geometry.circleCenter),
    geometry.circleRadius, 5e-16, 'left chord endpoint on circle');
  near(geometry.rightGuidePin.distanceTo(geometry.circleCenter),
    geometry.circleRadius, 5e-16, 'right chord endpoint on circle');
  near(geometry.circleCenter.y + geometry.circleRadius,
    geometry.sagitta, 5e-16, 'versed-sine apex on circle');
  near(geometry.includedRuleAngle,
    2 * Math.atan(geometry.chordHalf / geometry.sagitta), 0,
    'constant included angle');
  const source = stateAtTime(0);
  near(source.pencilPoint.x, 0, 1e-15, 'source pencil centered');
  near(source.pencilPoint.y, geometry.sagitta, 6e-16,
    'source pencil at versed-sine apex');
  near(sourcePose.pencilPoint.distanceTo(source.pencilPoint), 0, 0,
    'stored source pose');
  near(sourcePose.cyclePhase, geometry.sourcePhaseOffset, 0,
    'source law phase');
  disposeModel(model.root);
});

test('movement 403 satisfies both guide edges, the target circle, and constant-angle locus throughout the stroke', () => {
  const model = createMovementModel(catalog.movements[402]);
  const data = model.root.userData;
  const { geometry, stateAtTime } = data;
  let maximumCircleError = 0;
  let maximumLeftError = 0;
  let maximumRightError = 0;
  let maximumAngleError = 0;
  let minimumGuideCoordinate = Infinity;
  let maximumGuideCoordinate = -Infinity;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 50000,
    );
    maximumCircleError = Math.max(maximumCircleError,
      Math.abs(state.circleConstraintResidual));
    maximumLeftError = Math.max(maximumLeftError,
      Math.abs(state.leftGuideConstraintResidual));
    maximumRightError = Math.max(maximumRightError,
      Math.abs(state.rightGuideConstraintResidual));
    maximumAngleError = Math.max(maximumAngleError,
      Math.abs(state.includedAngleResidual));
    for (const contact of [
      state.leftContactLocal,
      state.rightContactLocal,
    ]) {
      minimumGuideCoordinate = Math.min(minimumGuideCoordinate, contact.x);
      maximumGuideCoordinate = Math.max(maximumGuideCoordinate, contact.x);
      assert.ok(contact.x >= geometry.ruleLengthMin - 1e-15);
      assert.ok(contact.x <= geometry.ruleLengthMax + 1e-15);
    }
  }
  assert.ok(maximumCircleError < 4.5e-16);
  assert.ok(maximumLeftError < 1.5e-15);
  assert.ok(maximumRightError < 2.8e-14);
  assert.ok(maximumAngleError < 5.4e-15);
  assert.ok(minimumGuideCoordinate > 0.176 - 1e-5);
  assert.ok(maximumGuideCoordinate < 5.513);
  disposeModel(model.root);
});

test('movement 403 has zero normal sliding velocity at both fixed guide pins', () => {
  const model = createMovementModel(catalog.movements[402]);
  const { geometry, stateAtTime } = model.root.userData;
  let maximumLeftVelocityError = 0;
  let maximumRightVelocityError = 0;

  for (let sample = -50000; sample <= 100000; sample += 1) {
    const state = stateAtTime(
      geometry.cycleDuration * sample / 50000,
    );
    maximumLeftVelocityError = Math.max(
      maximumLeftVelocityError,
      Math.abs(state.leftNormalVelocityError),
    );
    maximumRightVelocityError = Math.max(
      maximumRightVelocityError,
      Math.abs(state.rightNormalVelocityError),
    );
  }
  assert.ok(maximumLeftVelocityError < 1.8e-15);
  assert.ok(maximumRightVelocityError < 4.7e-14);
  disposeModel(model.root);
});

test('movement 403 analytic pencil and carriage rates match finite differences', () => {
  const model = createMovementModel(catalog.movements[402]);
  const { geometry, stateAtTime } = model.root.userData;
  const velocityEpsilon = 2e-6;
  const accelerationEpsilon = 2e-5;

  for (const cycleCoordinate of [
    0,
    0.08,
    0.18,
    0.34,
    0.48,
    0.58,
    0.68,
    0.84,
    0.97,
  ]) {
    const time = geometry.cycleDuration * cycleCoordinate;
    const before = stateAtTime(time - velocityEpsilon);
    const state = stateAtTime(time);
    const after = stateAtTime(time + velocityEpsilon);
    const finiteVelocity = after.pencilPoint.clone()
      .sub(before.pencilPoint)
      .multiplyScalar(1 / (2 * velocityEpsilon));
    near(state.pencilVelocity.distanceTo(finiteVelocity), 0, 1.2e-9,
      'analytic pencil velocity');
    const finiteCarriageSpeed = (
      after.carriageAngle - before.carriageAngle
    ) / (2 * velocityEpsilon);
    near(state.carriageAngularSpeed, finiteCarriageSpeed, 5e-10,
      'analytic carriage angular speed');

    const beforeAcceleration = stateAtTime(time - accelerationEpsilon);
    const afterAcceleration = stateAtTime(time + accelerationEpsilon);
    const finiteCarriageAcceleration = (
      afterAcceleration.carriageAngularSpeed
      - beforeAcceleration.carriageAngularSpeed
    ) / (2 * accelerationEpsilon);
    near(state.carriageAngularAcceleration,
      finiteCarriageAcceleration, 2e-8,
      'analytic carriage angular acceleration');
  }
  disposeModel(model.root);
});

test('movement 403 reverses smoothly short of each singular chord endpoint and closes its cycle', () => {
  const model = createMovementModel(catalog.movements[402]);
  const data = model.root.userData;
  const { geometry, motion, stateAtTime } = data;
  const at = (cycleCoordinate) => stateAtTime(
    geometry.cycleDuration * cycleCoordinate,
  );

  assert.equal(at(0).travel.direction, 'left-to-right-tracing-stroke');
  assert.equal(at(0.40).travel.direction,
    'right-to-left-return-stroke');
  assert.equal(at(0.90).travel.direction,
    'left-to-right-tracing-stroke');
  assert.match(motion.sequence, /reverse with zero speed and acceleration/);
  for (const cycleCoordinate of [0.25, 0.75]) {
    const state = at(cycleCoordinate);
    near(state.pencilSpeed, 0, 2e-15, 'zero-speed reversal');
    near(state.traceAngularAcceleration, 0, 2e-15,
      'zero-acceleration reversal');
  }
  for (const cycleCoordinate of [-2.2, -0.4, 0, 0.23, 0.61, 2.8]) {
    const start = at(cycleCoordinate);
    const end = at(cycleCoordinate + 1);
    near(end.pencilPoint.distanceTo(start.pencilPoint), 0, 8e-15,
      'pencil cycle closure');
    near(end.pencilVelocity.distanceTo(start.pencilVelocity), 0, 2e-14,
      'pencil velocity cycle closure');
    near(end.carriageAngle, start.carriageAngle, 5e-15,
      'carriage cycle closure');
  }
  disposeModel(model.root);
});

test('movement 403 update moves one rigid carriage while both guide pins and drawing remain fixed', () => {
  const model = createMovementModel(catalog.movements[402]);
  const data = model.root.userData;
  const { blocks, geometry, stateAtTime } = data;
  const leftPinPosition = blocks.guidePins[0].assembly.position.clone();
  const rightPinPosition = blocks.guidePins[1].assembly.position.clone();
  const arcPosition = blocks.describedArc.position.clone();

  for (const cycleCoordinate of [0, 0.12, 0.25, 0.42, 0.60, 0.75, 0.92]) {
    const time = geometry.cycleDuration * cycleCoordinate;
    const expected = stateAtTime(time);
    model.update(time, 0);
    near(blocks.carriage.position.x, expected.pencilPoint.x, 0,
      'rendered carriage x');
    near(blocks.carriage.position.y, expected.pencilPoint.y, 0,
      'rendered carriage y');
    near(blocks.carriage.rotation.z, expected.carriageAngle, 0,
      'rendered carriage angle');
    near(blocks.pencil.position.x, expected.pencilPoint.x, 0,
      'rendered pencil x');
    near(blocks.pencil.position.y, expected.pencilPoint.y, 0,
      'rendered pencil y');
    assert.ok(blocks.guidePins[0].assembly.position.equals(leftPinPosition));
    assert.ok(blocks.guidePins[1].assembly.position.equals(rightPinPosition));
    assert.ok(blocks.describedArc.position.equals(arcPosition));
    near(data.contacts.leftPinToLeftRuleEdge.normalPositionError,
      expected.leftGuideConstraintResidual, 0,
      'reported left guide closure');
    near(data.contacts.rightPinToRightRuleEdge.normalPositionError,
      expected.rightGuideConstraintResidual, 0,
      'reported right guide closure');
    near(data.contacts.pencilToTargetCircle.radialError,
      expected.circleConstraintResidual, 0,
      'reported circle closure');
  }
  disposeModel(model.root);
});

test('movement 507 remains the next authored review frontier', () => {
  const movement403 = catalog.movements[402];
  const movement507 = catalog.movements[506];
  const model403 = createMovementModel(movement403);
  const model507 = createMovementModel(movement507);

  assert.equal(movement403.id, 403);
  assert.equal(movement403.fidelity, 'authored');
  assert.equal(model403.root.userData.fidelity, 'authored');
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(catalog.movements[506].archetype, 'carrier-driven-25000-to-1-slow-bevel-output-compound-planetary');
  assert.equal(model507.root.userData.fidelity, 'authored');
  assert.notEqual(model507.root.userData.archetype,
    model403.root.userData.archetype);
  disposeModel(model403.root);
  disposeModel(model507.root);
});

function p89Box(model, role) {
  const found = [];
  model.root.traverse((object) => { if (object.isMesh && object.userData.role === role) found.push(object); });
  assert.ok(found.length > 0, role);
  return found.map((mesh) => new THREE.Box3().setFromObject(mesh));
}

test('403 brace fastener 1 ends 0.01 inside the left rule, not flush in its back face', () => {
  const model = createMovementModel(catalog.movements[402]);
  model.update(0); model.root.updateMatrixWorld(true);
  const [rule] = p89Box(model, 'left-sloping-rule-guided-by-left-chord-pin-straight-rigid-body');
  const [pin] = p89Box(model, 'fixed-brace-fastener-1');
  assert.ok(Math.abs(pin.min.z - (rule.min.z + 0.01)) < 1e-6, `${pin.min.z} ${rule.min.z}`);
});

test('movement 403 rules are Brown’s broad laths and lie on each other where they cross (pass 90)', () => {
  const model = createMovementModel(catalog.movements[402]);
  const { geometry } = model.root.userData;
  assert.ok(geometry.ruleWidth / (geometry.ruleLengthMax - geometry.ruleLengthMin) > 0.05);
  let leftBody, rightBody;
  model.root.traverse((o) => {
    if (o.userData.role === 'left-sloping-rule-guided-by-left-chord-pin-straight-rigid-body') leftBody = o;
    if (o.userData.role === 'right-sloping-rule-guided-by-right-chord-pin-straight-rigid-body') rightBody = o;
  });
  model.root.updateMatrixWorld(true);
  const lb = new THREE.Box3().setFromObject(leftBody), rb = new THREE.Box3().setFromObject(rightBody);
  assert.ok(rb.min.z >= lb.max.z - 1e-9, 'right rule rests on the left rule');
  disposeModel(model.root);
});

test('movement 403 crossing fastening is centred on both rules where they cross (pass 92)', () => {
  const model = createMovementModel(catalog.movements[402]);
  const find = (role) => {
    let found;
    model.root.traverse((o) => { if (o.userData.role === role) found = o; });
    return found;
  };
  const fastener = find('fastened-crossing-of-the-two-sloping-rules');
  const rules = [
    find('left-sloping-rule-guided-by-left-chord-pin-straight-rigid-body'),
    find('right-sloping-rule-guided-by-right-chord-pin-straight-rigid-body'),
  ];
  const { radiusTop, height } = fastener.geometry.parameters;
  for (const time of [0, 1.7, 4.4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const centre = new THREE.Vector3().setFromMatrixPosition(fastener.matrixWorld);
    const axis = new THREE.Vector3(0, 1, 0).transformDirection(fastener.matrixWorld);
    near(Math.abs(axis.z), 1, 1e-9, 'fastening normal to the rules');
    for (const rule of rules) {
      const { width, height: ruleWidth, depth } = rule.geometry.parameters;
      const local = centre.clone().applyMatrix4(rule.matrixWorld.clone().invert());
      near(local.y, 0, 1e-9, `${rule.userData.role}: on the centreline`);
      assert.ok(ruleWidth / 2 >= 2 * radiusTop, 'margin of at least one radius each side');
      assert.ok(Math.abs(local.x) + 3 * radiusTop < width / 2, 'well inside the rule length');
      assert.ok(height / 2 > Math.abs(local.z) + depth / 2, 'passes through the rule');
    }
  }
  // Brown's rules run on past the crossing (tails about a sixth of each rule).
  const [left] = rules;
  const tail = new THREE.Vector3().setFromMatrixPosition(fastener.matrixWorld)
    .applyMatrix4(left.matrixWorld.clone().invert()).x + left.geometry.parameters.width / 2;
  assert.ok(tail > 1.2, `tail past the crossing ${tail}`);
});

// p105: Brown lays the rules inside the angle, so the traced arc shows at
// his apex pose; the arc is an ink ribbon on the board that the pencil draws.
function inkPoints(mesh) {
  const position = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;
  const { start, count } = mesh.geometry.drawRange;
  const used = new Set();
  for (let i = start; i < Math.min(index.count, start + count); i += 1) used.add(index.getX(i));
  return [...used].map((i) => new THREE.Vector3().fromBufferAttribute(position, i));
}

test('movement 403 rules lie inside the angle, so the whole traced arc shows at the apex pose (p105)', () => {
  const model = createMovementModel(catalog.movements[402]);
  const { blocks, geometry } = model.root.userData;
  model.update(0);
  model.root.updateMatrixWorld(true);
  const points = inkPoints(blocks.describedArc);
  assert.ok(points.length > 400, `${points.length} ink vertices at t = 0`);
  const spanAngle = (p) => Math.atan2(p.y - geometry.circleCenter.y, p.x - geometry.circleCenter.x);
  const angles = points.map(spanAngle);
  near(Math.max(...angles), geometry.traceStartAngle, 1e-6, 'ink reaches the left end of the stroke');
  near(Math.min(...angles), geometry.traceEndAngle, 1e-6, 'ink reaches the right end of the stroke');
  for (const rule of [blocks.leftRule, blocks.rightRule]) {
    const { width, height } = rule.body.geometry.parameters;
    let covered = 0;
    for (const point of points) {
      const local = rule.body.worldToLocal(point.clone());
      if (Math.abs(local.x) < width / 2 && Math.abs(local.y) < height / 2) covered += 1;
    }
    // Only the tails beyond the pencil cross the arc, as on the plate.
    assert.ok(covered / points.length < 0.2, `${rule.rule.userData.role} covers ${covered}/${points.length}`);
  }
  // Brown's apex pose: the chord mid-point lies between the two rules, clear.
  for (const rule of [blocks.leftRule, blocks.rightRule]) {
    const local = rule.body.worldToLocal(new THREE.Vector3(0, geometry.sagitta / 2, 0));
    const { height } = rule.body.geometry.parameters;
    assert.ok(Math.abs(local.y) > height / 2, 'triangle interior open');
    // The arc apex side of the pencil is outside both rule bodies.
    const outer = rule.body.worldToLocal(new THREE.Vector3(0, geometry.sagitta + 0.2, 0));
    assert.ok(Math.abs(outer.y) > height / 2 || Math.abs(outer.x) > rule.body.geometry.parameters.width / 2);
  }
  disposeModel(model.root);
});

test('movement 403 ink is drawn right to left, retraced, and wiped at the right end; the loop closes (p105)', () => {
  const model = createMovementModel(catalog.movements[402]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  const period = geometry.cycleDuration;
  const timeAt = (cyclePhase) => (cyclePhase - geometry.sourcePhaseOffset) * period;
  const segments = () => blocks.describedArc.geometry.drawRange.count / 6;
  model.update(timeAt(0.25));
  const whole = segments();
  assert.equal(whole, 240);
  assert.equal(blocks.describedArc.material.opacity, 1);
  // Drawing stroke: the ink ends under the pencil.
  let previous = 0;
  for (const phase of [0.52, 0.6, 0.75, 0.9, 0.99]) {
    model.update(timeAt(phase));
    const state = stateAtTime(timeAt(phase));
    assert.equal(state.travel.direction, 'right-to-left-return-stroke');
    const points = inkPoints(blocks.describedArc);
    const tip = points.reduce((best, p) => (Math.atan2(p.y - geometry.circleCenter.y, p.x - geometry.circleCenter.x)
      > Math.atan2(best.y - geometry.circleCenter.y, best.x - geometry.circleCenter.x) ? p : best));
    const tipAngle = Math.atan2(tip.y - geometry.circleCenter.y, tip.x - geometry.circleCenter.x);
    near(tipAngle, state.traceAngle, 1e-6, `ink ends at the pencil at ${phase}`);
    assert.ok(segments() >= previous);
    previous = segments();
  }
  // Retrace keeps the whole arc; the wipe fades it only while the pencil rests.
  model.update(timeAt(0.1));
  assert.equal(segments(), whole);
  const [wipeStart, wipeEnd] = geometry.inkWipeWindow;
  let lastOpacity = 1;
  for (let phase = wipeStart; phase < wipeEnd; phase += 0.01) {
    model.update(timeAt(phase));
    const state = stateAtTime(timeAt(phase));
    assert.ok(state.travel.value > 0.98, 'pencil has all but stopped at the right end');
    assert.ok(blocks.describedArc.material.opacity <= lastOpacity + 1e-12);
    lastOpacity = blocks.describedArc.material.opacity;
  }
  model.update(timeAt(0.5 + 1e-6));
  assert.ok(segments() <= 1);
  // Loop closure of the ink.
  model.update(0);
  const a = inkPoints(blocks.describedArc).length;
  model.update(period);
  assert.equal(inkPoints(blocks.describedArc).length, a);
  assert.equal(blocks.describedArc.material.opacity, 1);
  disposeModel(model.root);
});

test('movement 403 ink and chord lie on the board under the pencil point; the stroke stops where the far pin clears the other tail (p105)', () => {
  const model = createMovementModel(catalog.movements[402]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  model.update(0);
  model.root.updateMatrixWorld(true);
  const ink = new THREE.Box3().setFromObject(blocks.describedArc);
  near(ink.min.z, geometry.boardTop + 0.0015, 1e-6, 'ink just above the board');
  near(ink.max.z, ink.min.z, 1e-6, 'flat ink');
  const tipZ = blocks.pencilTip.localToWorld(new THREE.Vector3(0, blocks.pencilTip.geometry.parameters.height / 2, 0)).z;
  assert.ok(tipZ > ink.max.z && tipZ - ink.max.z < 0.001, `pencil point ${tipZ} on the ink ${ink.max.z}`);
  let board;
  model.root.traverse((o) => { if (o.userData.role === 'fixed-drawing-board-under-pins-and-traced-curve') board = o; });
  near(new THREE.Box3().setFromObject(board).max.z, geometry.boardTop, 1e-6, 'board top');
  // Brown's laid-down chord is kept (the versed sine he does not draw is not).
  assert.equal(blocks.chordLine.parent, model.root);
  assert.equal(blocks.versedSineLine, undefined);
  const chord = new THREE.Box3().setFromObject(blocks.chordLine);
  near(chord.max.x, geometry.chordHalf - 0.16, 1e-6, 'chord stops at the washer');
  // Stroke ends: the nearer pin stands where the far pin clears the other tail.
  let nearest = Infinity;
  for (let i = 0; i <= 6000; i += 1) {
    const s = stateAtTime(geometry.cycleDuration * i / 6000);
    nearest = Math.min(nearest, s.leftContactLocal.x, s.rightContactLocal.x);
  }
  const need = (geometry.ruleWidth + 2 * geometry.guideRadius) / Math.sin(geometry.includedRuleAngle);
  assert.ok(nearest > need && nearest < need + 0.03, `nearest pin ${nearest} vs ${need}`);
  disposeModel(model.root);
});
