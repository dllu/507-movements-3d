import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
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

function rolesOf(root) {
  const roles = [];
  root.traverse((object) => roles.push(object.userData.role ?? ''));
  return roles;
}

test('movement 277 builds only the plate’s hammer, pivoted dog a, spring c with its block, and ratchet b', () => {
  const movement = catalog.movements[276];
  const model = createMovementModel(movement);
  const { archetype, blocks, fidelity, mechanism, transmission } =
    model.root.userData;

  assert.equal(movement.id, 277);
  assert.equal(movement.number, '277');
  assert.equal(movement.title, 'Colt Hammer-Driven Cylinder Indexing Ratchet');
  assert.equal(movement.category, 'Ratchets & intermittent motion');
  assert.equal(movement.fidelity, 'authored');
  assert.equal(fidelity, 'authored');
  assert.equal(archetype, 'hammer-carried-spring-dog-six-step-cylinder-ratchet');
  assert.equal(archetype, movement.archetype);
  assert.match(mechanism, /one pivoted hammer and tumbler/);
  assert.match(mechanism, /one rigid bored dog a on a pin/);
  assert.match(mechanism, /spring c presses that dog/);
  assert.match(mechanism, /six-tooth face ratchet b/);
  assert.match(mechanism, /rides back over the next tooth/);
  assert.equal(transmission.ratchetTeeth, 6);
  near(transmission.cylinderStepPerCock, FULL_TURN / 6, 0, 'one-chamber step');

  assert.ok(blocks.cylinder.parent === model.root, 'cylinder parent');
  assert.ok(blocks.cylinderRotor.parent === blocks.cylinder, 'cylinderRotor parent');
  assert.ok(blocks.cylinderBody.parent === blocks.cylinderRotor, 'cylinder body on the rotor');
  assert.ok(blocks.ratchet.parent === blocks.cylinderRotor, 'ratchet turns with the cylinder');
  assert.ok(blocks.hammerRotor.parent === blocks.hammer, 'hammerRotor parent');
  assert.ok(blocks.hammerBody.parent === blocks.hammerRotor, 'hammerBody parent');
  assert.ok(blocks.dogPivotPin.parent === blocks.hammerRotor, 'dog pin fixed in the tumbler');
  assert.ok(blocks.dogPinHead.parent === blocks.hammerRotor, 'dog pin head fixed in the tumbler');
  assert.ok(blocks.dog.parent === model.root, 'dog parent');
  assert.ok(blocks.dogBody.parent === blocks.dog, 'rigid dog body');
  assert.ok(blocks.spring.parent === blocks.springPivot, 'spring leaf parent');
  assert.ok(blocks.springAnchorBlock.parent === model.root, 'fixed hatched block');
  vectorNear(blocks.cylinder.userData.axis, X_AXIS, 0, 'cylinder axis');
  vectorNear(blocks.cylinderRotor.userData.axis, X_AXIS, 0, 'cylinder rotor axis');
  vectorNear(blocks.hammer.userData.axis, Z_AXIS, 0, 'hammer axis');
  vectorNear(blocks.dog.userData.axis, Z_AXIS, 0, 'dog axis parallel to the hammer axis');
  vectorNear(blocks.springPivot.userData.axis, Z_AXIS, 0, 'spring root axis');

  const roles = rolesOf(model.root);
  assert.equal(roles.filter((role) => role === 'six-tooth-face-ratchet-b').length, 1);
  assert.equal(roles.filter((role) => role === 'bored-planar-dog-a-lever').length, 1);
  assert.equal(roles.filter((role) => role === 'leaf-spring-c-holding-dog-to-ratchet').length, 1);
  assert.equal(roles.filter((role) => role === 'fixed-spring-c-block-on-lock-plate').length, 1);
  // The only undrawn support is one lock plate (with its lug for the
  // cylinder arbor) carrying the tumbler arbor, spring c's block, the
  // mainspring root and the cylinder arbor.
  assert.equal(roles.filter((role) => role === 'undrawn-lock-plate-carrying-arbor-and-springs').length, 1);
  assert.equal(roles.filter((role) => role === 'lock-plate-lug-carrying-cylinder-arbor').length, 1);
  assert.equal(blocks.lockPlate.parent, model.root);
  assert.equal(blocks.arborLug.parent, model.root);
  // Otherwise Brown draws no lock, base, posts, bearings or index markers.
  const otherRoles = roles.filter((role) => role !== 'undrawn-lock-plate-carrying-arbor-and-springs'
    && role !== 'lock-plate-lug-carrying-cylinder-arbor'
    && role !== 'fixed-spring-c-block-on-lock-plate');
  for (const pattern of [/(?:^|-)lock(?:-|$)/, /base/, /post/, /bearing/, /white/, /index-marker|-index$/, /belt|pulley/]) {
    assert.equal(otherRoles.filter((role) => pattern.test(role)).length, 0, `${pattern} absent`);
  }
  assert.equal(model.root.userData.sourcePresentation.removedRoles.length, 0);
  disposeModel(model.root);
});

test('movement 277 records Brown’s plate, unavailable animation, and Colt patent evidence', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { sourceAnimation, sourcePointToModel, sourceReference } =
    model.root.userData;
  const plate = sourceReference.plate277;

  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.independentlyReconstructed, true);
  assert.match(sourceAnimation.reason, /official Movement 277 page marks its animation unavailable/);
  assert.match(sourceAnimation.reason, /Colt patent USX9430/);
  assert.equal(sourceReference.officialDescription, catalog.movements[276].description);
  assert.equal(plate.imageWidth, 525);
  assert.equal(plate.imageHeight, 525);
  assert.equal(plate.measurementUncertaintyPixels, 5);
  assert.deepEqual(plate.rasterCylinderFrontTop, { x: 7, y: 98 });
  assert.deepEqual(plate.rasterCylinderRearTop, { x: 112, y: 98 });
  assert.deepEqual(plate.rasterCylinderFrontBottom, { x: 7, y: 469 });
  assert.deepEqual(plate.rasterCylinderRearBottom, { x: 112, y: 469 });
  assert.deepEqual(plate.rasterDogPivot, { x: 212, y: 389 });
  assert.deepEqual(plate.rasterHammerPivot, { x: 301, y: 394 });
  assert.match(plate.inferredTopology, /one pivoted dog a/);
  assert.match(plate.inferredTopology, /no cylinder lock is drawn/);
  assert.match(sourceReference.reconstruction, /undrawn detent/);
  vectorNear(sourcePointToModel(plate.rasterHammerPivot), new THREE.Vector2(0, 0), 0,
    'source hammer pivot');
  for (const [key, error] of Object.entries(plate.sourceIdealizationPixelErrors)) {
    assert.ok(error <= plate.measurementUncertaintyPixels, `${key} remains inside source uncertainty`);
  }
  near(plate.sourceIdealizationPixelErrors.dogPivot, 0, 1e-9, 'dog pivot at the plate’s eye');

  assert.deepEqual(sourceReference.primaryScan, {
    archiveIdentifier: 'fivehundredseven00browiala',
    descriptionPage: 71,
    edition: 21,
    illustrationPage: 70,
    publicationYear: 1908,
  });
  assert.equal(sourceReference.primaryPatent.patentNumber, 'USX9430');
  assert.equal(sourceReference.primaryPatent.patentDate, '1836-02-25');
  assert.equal(sourceReference.primaryPatent.title, 'Revolving Gun');
  assert.equal(sourceReference.primaryPatent.url, 'https://patents.google.com/patent/USX9430/en');
  assert.match(sourceReference.primaryPatent.evidence, /next chamber aligns/);
  disposeModel(model.root);
});

test('movement 277 dog a is one rigid bored plate turning on a smaller pin in the tumbler', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { blocks, geometry, stateAtTime } = model.root.userData;
  assert.ok(geometry.pinRadius < geometry.boreRadius, 'running clearance in the dog bore');
  assert.ok(geometry.boreRadius - geometry.pinRadius <= 0.012, 'small running clearance');

  // The dog plate has exactly one hole: the circular bore centred on its pivot.
  const { polygons, low, high } = blocks.dogBody.geometry.userData.plate;
  assert.equal(polygons.length, 1);
  assert.equal(polygons[0].length, 2, 'outer outline plus one bore');
  const bore = polygons[0][1];
  for (const [x, y] of bore) near(Math.hypot(x, y), geometry.boreRadius, 1e-6, 'bore radius');
  near(high - low, geometry.dogThickness, 1e-12, 'dog thickness');

  const restVertices = blocks.dogBody.geometry.attributes.position.array.slice();
  const pinAxis = new THREE.Vector3();
  const pinCenter = new THREE.Vector3();
  const hammerFront = geometry.hammerZ + 0.28;
  for (const time of [0, 0.9, 1.3, 1.8, 2.3, 2.9, 3.3, 3.5, 3.9]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const state = stateAtTime(time);
    // The dog centre sits on the pin axis, which stays parallel to Z.
    blocks.dogPivotPin.getWorldPosition(pinCenter);
    pinAxis.set(0, 1, 0).applyQuaternion(
      blocks.dogPivotPin.getWorldQuaternion(new THREE.Quaternion()),
    );
    near(Math.abs(pinAxis.dot(Z_AXIS)), 1, 1e-12, `pin axis at ${time}`);
    near(Math.hypot(pinCenter.x - blocks.dog.position.x, pinCenter.y - blocks.dog.position.y),
      0, 1e-12, `dog pivot on the pin axis at ${time}`);
    vectorNear(new THREE.Vector3(blocks.dog.position.x, blocks.dog.position.y, 0),
      state.dogBase.clone().setZ(0), 1e-12, `dog base at ${time}`);
    near(blocks.dog.rotation.z, state.hammerAngle + state.dogAngle, 1e-12, `dog angle at ${time}`);
  }
  assert.deepEqual(blocks.dogBody.geometry.attributes.position.array, restVertices,
    'dog outline never deforms');
  // The dog sits axially between the tumbler face and the pin head.
  const pinHeadBack = blocks.dogPinHead.position.z + geometry.hammerZ - 0.015;
  assert.ok(low - hammerFront >= 0.015, 'axial gap to the tumbler');
  assert.ok(pinHeadBack - high >= 0.008, 'axial gap to the pin head');
  disposeModel(model.root);
});

test('movement 277 advances exactly one 60-degree step per cock and holds the cylinder while the dog resets', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { geometry, stateAtTime, timeline } = model.root.userData;
  const samples = 8192;
  let previous = stateAtTime(0);
  let maximumReverse = 0;
  let maximumCylinderStep = 0;
  let maximumDogStep = 0;
  let maximumSpringStep = 0;
  let movedOutsideDrive = 0;
  for (let index = 1; index <= samples; index += 1) {
    const state = stateAtTime(timeline.inputCyclePeriod * index / samples);
    // The cylinder only turns forward (negative X rotation) and only while
    // the hammer is drawn back or held at full cock.
    const step = state.cylinderAngle - previous.cylinderAngle;
    maximumReverse = Math.max(maximumReverse, step);
    maximumCylinderStep = Math.max(maximumCylinderStep, Math.abs(step));
    if (!(state.normalizedCycle > geometry.cockStart
      && state.normalizedCycle <= geometry.fallStart)) {
      movedOutsideDrive = Math.max(movedOutsideDrive, Math.abs(step));
    }
    maximumDogStep = Math.max(maximumDogStep, Math.abs(state.dogAngle - previous.dogAngle));
    maximumSpringStep = Math.max(maximumSpringStep,
      Math.abs(state.springAngle - previous.springAngle));
    previous = state;
  }
  assert.ok(maximumReverse <= 1e-12, `cylinder never turns back (${maximumReverse})`);
  assert.ok(movedOutsideDrive <= 1e-12, `cylinder held during rest and reset (${movedOutsideDrive})`);
  // Continuity: no jumps between 1/8192-cycle samples.
  assert.ok(maximumCylinderStep < 0.004, `cylinder continuity ${maximumCylinderStep}`);
  assert.ok(maximumDogStep < 0.01, `dog continuity ${maximumDogStep}`);
  assert.ok(maximumSpringStep < 0.01, `spring continuity ${maximumSpringStep}`);

  const start = stateAtTime(0);
  near(stateAtTime(timeline.inputCyclePeriod).cylinderAngle - start.cylinderAngle,
    -geometry.ratchetPitch, 1e-12, 'one exact cylinder step');
  near(stateAtTime(geometry.cockEnd * timeline.inputCyclePeriod).cylinderAngle,
    -geometry.ratchetPitch, 1e-9, 'indexed at full cock');
  near(geometry.cycleClosureErrors.cylinderStep, 0, 1e-8, 'solved cycle closes on one pitch');
  near(geometry.cycleClosureErrors.dog, 0, 1e-8, 'solved dog closes');
  near(geometry.cycleClosureErrors.spring, 0, 1e-8, 'solved spring closes');
  for (let index = 0; index <= geometry.ratchetTeeth; index += 1) {
    near(stateAtTime(index * timeline.inputCyclePeriod).cylinderAngle,
      -index * geometry.ratchetPitch, 1e-12, `indexed chamber ${index}`);
  }
  near(stateAtTime(timeline.fullCylinderPeriod).cylinderAngle, -FULL_TURN, 1e-12,
    'six cocking strokes make one cylinder turn');
  disposeModel(model.root);
});

test('movement 277 hook drives a radial tooth face, rides back over the next tooth and reseats with finite clearance', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { geometry, stateAtTime, timeline, transmission } = model.root.userData;
  const { dogRatchet, springDog } = transmission.clearanceFunctions;
  const samples = 2048;
  let minimumDog = Infinity;
  let minimumSpring = Infinity;
  let maximumDrivingGap = 0;
  let maximumLift = 0;
  let maximumSpringGap = 0;
  for (let index = 0; index <= samples; index += 1) {
    const time = timeline.inputCyclePeriod * index / samples;
    const state = stateAtTime(time);
    const dogClearance = dogRatchet(state);
    const springClearance = springDog(state);
    minimumDog = Math.min(minimumDog, dogClearance);
    minimumSpring = Math.min(minimumSpring, springClearance);
    maximumSpringGap = Math.max(maximumSpringGap, springClearance);
    const after = stateAtTime(time + 1e-4);
    if (after.cylinderAngle < state.cylinderAngle - 1e-9) {
      // While the cylinder turns, the hook is in contact with the ratchet.
      maximumDrivingGap = Math.max(maximumDrivingGap, dogClearance);
    }
    if (state.resetting) {
      maximumLift = Math.max(maximumLift, state.dogTip.x - geometry.ratchetLandX);
    }
  }
  // The stored poses keep the solver clearance; linear interpolation between
  // table samples cuts the crest corner as the hook drops by about 0.004.
  assert.ok(minimumDog > 0.0008, `dog clears the ratchet by ${minimumDog}`);
  assert.ok(minimumSpring > 0.002, `spring clears the dog by ${minimumSpring}`);
  assert.ok(maximumDrivingGap < 0.007, `hook bears on the tooth while driving (${maximumDrivingGap})`);
  assert.ok(maximumSpringGap < 0.007, `spring c always bears on the dog (${maximumSpringGap})`);
  assert.ok(maximumLift > geometry.ratchetToothDepth * 0.9,
    `hook rides up over a tooth back on the fall (${maximumLift})`);

  // At rest the hook is seated on the land behind a tooth, held by spring c.
  const rest = stateAtTime(0);
  near(rest.dogTip.x, geometry.ratchetLandX + geometry.clearance, 1e-9, 'seated hook');
  near(dogRatchet(rest), geometry.clearance, 1e-6, 'rest contact clearance');
  assert.equal(stateAtTime(0.34 * geometry.inputCyclePeriod).driving, true);
  assert.equal(stateAtTime(0.75 * geometry.inputCyclePeriod).resetting, true);
  assert.match(transmission.stepLaw, /radial tooth face/);
  assert.match(transmission.resetLaw, /cylinder is held/);
  disposeModel(model.root);
});

test('movement 277 update binds the hammer, cylinder, dog and spring and keeps readable timing', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { animationTiming, blocks, cameraFitBounds, geometry, stateAtTime } =
    model.root.userData;
  assert.equal(animationTiming.authoredCyclePeriod, 4);
  assert.equal(animationTiming.targetCycleDuration, 2);
  assertReadableTiming(animationTiming);
  assert.ok(cameraFitBounds.max.x >= 4.56);
  vectorNear(model.cameraDirection, new THREE.Vector3(-0.12, 0.05, 1), 1e-12,
    'side-elevation source camera');

  const springRoot = blocks.springPivot.position.clone();
  for (const time of [0, 1.1, 2.08, 3.04, 3.4, 4, 24]) {
    const expected = stateAtTime(time);
    model.update(time);
    near(blocks.hammerRotor.rotation.z, expected.hammerAngle, 0, `rendered hammer at ${time}`);
    near(blocks.cylinderRotor.rotation.x, expected.cylinderAngle, 0, `rendered cylinder at ${time}`);
    near(blocks.dog.rotation.z, expected.hammerAngle + expected.dogAngle, 0,
      `rendered dog at ${time}`);
    near(blocks.springPivot.rotation.z, expected.springAngle, 0, `rendered spring at ${time}`);
    vectorNear(blocks.springPivot.position, springRoot, 0, `fixed spring root at ${time}`);
    vectorNear(model.root.userData.contacts.dogRatchet.contactPoint, expected.dogTip, 0,
      `contact point at ${time}`);
  }
  near(geometry.springRoot[0], springRoot.x, 0, 'spring root recorded');
  disposeModel(model.root);
});

test('movement 277 closes after six cocks while movement 507 remains authored', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { stateAtTime, timeline } = model.root.userData;
  const start = stateAtTime(0);
  const closure = stateAtTime(timeline.fullCylinderPeriod);
  near(closure.cylinderAngle - start.cylinderAngle, -FULL_TURN, 1e-12, 'full cylinder turn');
  near(closure.hammerAngle, start.hammerAngle, 0, 'hammer pose closure');
  near(closure.dogAngle, start.dogAngle, 1e-12, 'dog pose closure');
  near(closure.springAngle, start.springAngle, 1e-12, 'spring pose closure');
  vectorNear(closure.dogTip, start.dogTip, 1e-12, 'dog tip closure');
  assert.equal(closure.indexNumber, 6);

  model.update(0);
  const sourceHammer = model.root.userData.blocks.hammerRotor.quaternion.clone();
  model.update(timeline.fullCylinderPeriod);
  near(model.root.userData.blocks.hammerRotor.quaternion.angleTo(sourceHammer), 0, 0,
    'rendered hammer closes');
  near(model.root.userData.blocks.cylinderRotor.rotation.x, -FULL_TURN, 1e-12,
    'rendered cylinder accumulates one physical turn');

  const movement507 = catalog.movements[506];
  const model507 = createMovementModel(movement507);
  assert.equal(movement507.id, 507);
  assert.equal(movement507.fidelity, 'authored');
  assert.equal(model507.root.userData.fidelity, 'authored');
  disposeModel(model507.root);
  disposeModel(model.root);
});

test('movement 277 hammer draws Brown\'s stirrup link down against the mainspring, and both leaves bend at constant section', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { blocks, geometry } = model.root.userData;
  assert.equal(blocks.stirrup.parent, model.root);
  assert.equal(blocks.hammerStirrupPin.parent, blocks.hammerRotor, 'the link hangs on a pin in the hammer');
  const pinWorld = () => blocks.hammerStirrupPin.getWorldPosition(new THREE.Vector3());
  const tipWorld = () => new THREE.Vector3(geometry.stirrupLength, 0, 0).applyMatrix4(blocks.stirrup.matrixWorld);
  const restTip = [];
  for (const time of [0, 0.8, 1.2, 1.6, 2.2, 2.8, 3.4]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const pin = pinWorld();
    const tip = tipWorld();
    near(Math.hypot(tip.x - pin.x, tip.y - pin.y), geometry.stirrupLength, 1e-9, `rigid stirrup at ${time}`);
    // The link's eye is the mainspring's tip.
    const bend = model.root.userData.kinematics.mainspringBend;
    assert.ok(bend >= 0 && bend < 0.6, `leaf bend ${bend}`);
    if (time === 0) restTip.push(tip.clone());
  }
  model.update(geometry.inputCyclePeriod * 0.55);
  model.root.updateMatrixWorld(true);
  assert.ok(tipWorld().y < restTip[0].y - 0.4, 'cocking draws the stirrup and the mainspring tip down');
  // Constant section: every bent top-face vertex keeps its rest distance to
  // its neighbours across the leaf (no triangle spans the bend).
  for (const mesh of [blocks.spring, blocks.mainspring]) {
    const position = mesh.geometry.attributes.position;
    model.update(0);
    const rest = Float32Array.from(position.array);
    model.update(geometry.inputCyclePeriod * 0.5);
    let worst = 0;
    for (let index = 0; index < position.count; index += 3) {
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const i = index + a;
        const j = index + b;
        const restLength = Math.hypot(rest[i * 3] - rest[j * 3], rest[i * 3 + 1] - rest[j * 3 + 1]);
        const length = Math.hypot(position.getX(i) - position.getX(j), position.getY(i) - position.getY(j));
        worst = Math.max(worst, Math.abs(length - restLength));
      }
    }
    assert.ok(worst < 0.01, `${mesh.userData.role} edges keep their length (${worst})`);
  }
  disposeModel(model.root);
});

// Brown's stirrup link and mainspring at the lower right have gone missing
// in earlier passes; this pins them down as working, visible parts.
test('movement 277 keeps Brown\'s stirrup link, pinned in the hammer and in the mainspring eye, visible past a small lock plate', () => {
  const model = createMovementModel(catalog.movements[276]);
  const { blocks, geometry } = model.root.userData;
  const { stirrup, stirrupBody, hammerStirrupPin, hammerRotor, mainspring, lockPlate } = blocks;
  for (const part of [stirrup, stirrupBody, hammerStirrupPin, mainspring]) {
    assert.ok(part, 'the stirrup, its hammer pin and the mainspring exist');
    for (let node = part; node; node = node.parent) assert.equal(node.visible, true, `${part.userData.role} is shown`);
  }
  assert.equal(stirrupBody.parent, stirrup);
  assert.equal(hammerStirrupPin.parent, hammerRotor, 'one end is pinned in the hammer');
  // The mainspring's eye: rest vertices of the eye's bore round (length, 0).
  const position = mainspring.geometry.attributes.position;
  model.update(0);
  const eye = [];
  for (let index = 0; index < position.count; index += 1) {
    const radius = Math.hypot(position.getX(index) - geometry.mainspringLength, position.getY(index));
    if (radius > 0.08 && radius < 0.11) eye.push(index);
  }
  assert.ok(eye.length > 50, 'the mainspring ends in a bored eye');
  const eyeCentre = () => {
    const centre = new THREE.Vector3();
    for (const index of eye) centre.add(new THREE.Vector3().fromBufferAttribute(position, index));
    return centre.divideScalar(eye.length).applyMatrix4(mainspring.matrixWorld);
  };
  for (const time of [0, 0.7, 1.4, geometry.inputCyclePeriod * 0.55, 2.9]) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    const hammerEnd = new THREE.Vector3(0, 0, 0).applyMatrix4(stirrup.matrixWorld);
    const pin = hammerStirrupPin.getWorldPosition(new THREE.Vector3());
    near(Math.hypot(hammerEnd.x - pin.x, hammerEnd.y - pin.y), 0, 1e-9, `link on the hammer pin at ${time}`);
    const springEnd = new THREE.Vector3(geometry.stirrupLength, 0, 0).applyMatrix4(stirrup.matrixWorld);
    const centre = eyeCentre();
    near(Math.hypot(springEnd.x - centre.x, springEnd.y - centre.y), 0, 0.005, `link in the mainspring eye at ${time}`);
  }
  // At rest the link's upper part shows in front (Brown draws it beside the
  // hammer), and from behind it is not hidden by the lock plate.
  model.update(0);
  model.root.updateMatrixWorld(true);
  const onLink = new THREE.Vector3(0.8 * geometry.stirrupLength, 0, 0).applyMatrix4(stirrup.matrixWorld);
  const front = new THREE.Raycaster(new THREE.Vector3(onLink.x, onLink.y, 20), new THREE.Vector3(0, 0, -1));
  assert.equal(front.intersectObject(model.root, true)[0]?.object, stirrupBody, 'the link shows from the front');
  const back = new THREE.Raycaster(new THREE.Vector3(onLink.x, onLink.y, -20), new THREE.Vector3(0, 0, 1));
  assert.notEqual(back.intersectObject(model.root, true)[0]?.object, lockPlate, 'the lock plate does not cover the link');
  // The lock plate is a small frame piece, not a backdrop.
  lockPlate.geometry.computeBoundingBox();
  let area = 0;
  const p = lockPlate.geometry.attributes.position, n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const idx = lockPlate.geometry.index;
  for (let t = 0; t < (idx ? idx.count : p.count) / 3; t += 1) {
    const v = (k) => (idx ? idx.getX(3 * t + k) : 3 * t + k);
    a.fromBufferAttribute(p, v(0)); b.fromBufferAttribute(p, v(1)); c.fromBufferAttribute(p, v(2));
    n.subVectors(b, a).cross(c.clone().sub(a));
    if (n.z > 0) area += n.length() / 2;
  }
  assert.ok(area < 3, `lock plate face area ${area.toFixed(2)} stays small`);
  disposeModel(model.root);
});
