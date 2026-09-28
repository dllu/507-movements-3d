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
    '../src/simulation/authored-diaphragm-pressure-gauges.js',
    import.meta.url,
  ),
  'utf8',
);

const ARCHETYPE =
  'corrugated-circular-diaphragm-spatial-link-sector-pinion-pressure-gauge';

function movementModel() {
  const movement = catalog.movements[499];
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

test('movement 500 is a rim-fixed corrugated disk A driving sector e and one pointer pinion', () => {
  const { model, movement } = movementModel();
  const { blocks, degreesOfFreedom, geometry } = model.root.userData;

  assert.equal(movement.id, 500);
  assert.equal(movement.number, '500');
  assert.equal(movement.title, 'Pressure gauge now most commonly used');
  assert.equal(movement.category, 'Rack & pinion');
  assert.equal(movement.archetype, ARCHETYPE);
  assert.equal(movement.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, ARCHETYPE);
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(blocks.diaphragm.userData.sourceLabel, 'A');
  assert.equal(blocks.diaphragm.userData.corrugationCount, 4);
  assert.equal(blocks.diaphragm.userData.radius,
    geometry.diaphragmRadius);
  assert.equal(blocks.sectorTeeth.length, 5);
  // Brown's dial is graduated all round: 60 graduations, every fifth long,
  // centred on the pointer spindle, which sits on the dial axis.
  assert.equal(blocks.scaleTicks.length, 60);
  assert.equal(blocks.scaleTicks.filter((tick) => tick.userData.major).length, 12);
  near(geometry.pinionCenter.x, 0, 1e-15, 'pointer spindle on dial axis x');
  near(geometry.pinionCenter.y, 0, 1e-15, 'pointer spindle on dial axis y');
  for (const tick of blocks.scaleTicks) {
    assert.ok(tick.geometry.parameters.width <= 0.032, 'fine cut graduation, not a marker block');
    near(Math.hypot(tick.position.x, tick.position.y) > 2.6 ? 1 : 0, 1, 0, 'graduation lies in the scale band');
  }
  assert.equal(blocks.connectingRod.parent, model.root);
  assert.equal(blocks.sector.parent, model.root);
  assert.equal(blocks.pinion.parent, model.root);
  assert.equal(blocks.pointer.parent, model.root);
  assert.equal(blocks.pointerCounterweight.parent, blocks.pointer);
  assert.equal(degreesOfFreedom.independentPressureInputs, 1);
  assert.equal(degreesOfFreedom.independentDiaphragmCoordinates, 0);
  assert.equal(degreesOfFreedom.independentSectorCoordinates, 0);
  assert.equal(degreesOfFreedom.independentPointerCoordinates, 0);
  const belts = [];
  model.root.traverse((object) => {
    if (object.userData.isBelt) belts.push(object);
  });
  assert.deepEqual(belts, []);
  assert.doesNotMatch(sourceText, /makeMovingBelt|makeDynamicMovingBelt/);
  disposeModel(model.root);
});

test('movement 500 records the unavailable official animation and Schaffer diaphragm evidence', () => {
  const { model, movement } = movementModel();
  const { sourceAnimation, sourceReference } = model.root.userData;

  assert.equal(movement.sourceUrl, 'https://507movements.com/mm_500.html');
  assert.match(movement.description,
    /Face view and section.*fluid.*acts upon a circular metal disk, A, generally corrugated.*deflection.*toothed sector, e.*pinion on the spindle of the pointer/s);
  assert.equal(sourceAnimation.available, false);
  assert.equal(sourceAnimation.officialCanvasModelPresent, false);
  assert.match(sourceReference.officialEngraving,
    /engravings\/mm_500\.png$/);
  assert.match(sourceReference.historicalEngineeringCorroboration.paper,
    /Collacott.*Design and Production of Pressure Gauges.*Institute of Marine Engineers.*1945/i);
  assert.match(sourceReference.historicalEngineeringCorroboration.detail,
    /rim-secured corrugated disc.*radially stiff and axially flexible.*corrugation unwrapping.*disc, plunger, movement, and pointer/i);
  assert.match(sourceReference.historicalEngineeringCorroboration.url,
    /library\.imarest\.org.*7\.pdf/);
  assert.match(sourceReference.reconstructionDisclosure,
    /official page marks Animated unavailable.*31:8 pitch ratio.*graduated all round.*explicit reconstruction choices/i);
  disposeModel(model.root);
});

test('movement 500 diaphragm center moves only axially while every clamped rim vertex stays fixed', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  for (let sample = 0; sample <= 500; sample += 1) {
    const time = geometry.cycleDuration * sample / 500;
    const state = stateAtTime(time);
    model.update(time);
    near(state.centerPoint.x, 0, 0,
      `center x guide ${sample}`);
    near(state.centerPoint.y, 0, 0,
      `center y guide ${sample}`);
    near(state.centerPoint.z,
      geometry.diaphragmBaseZ + state.centerDeflection, 0,
      `center axial travel ${sample}`);
    near(blocks.diaphragm.userData.centerZ, state.centerPoint.z,
      2e-8, `rendered center surface ${sample}`);
    near(blocks.diaphragmBoss.position.z,
      state.centerPoint.z + 0.085, 0,
      `rendered moving boss ${sample}`);
    const positions = blocks.diaphragm.geometry
      .getAttribute('position');
    for (const rimIndex of blocks.diaphragm.userData.rimIndices) {
      near(positions.getZ(rimIndex), geometry.diaphragmBaseZ,
        2e-8, `fixed clamped rim ${sample}/${rimIndex}`);
    }
    near(blocks.diaphragm.userData.corrugationScale,
      1 - 0.26 * state.pressureFraction, 0,
      `corrugation unwrapping scale ${sample}`);
  }
  const maximum = stateAtTime(geometry.cycleDuration / 2);
  near(maximum.centerDeflection, geometry.maximumCenterDeflection, 0,
    'maximum axial deflection');
  disposeModel(model.root);
});

test('movement 500 exact spatial rod converts axial diaphragm travel into sector rotation', () => {
  const { model } = movementModel();
  const { geometry, linkage, stateAtTime } = model.root.userData;
  let previousSectorAngle = 0;
  for (let sample = 0; sample <= 800; sample += 1) {
    const time = geometry.cycleDuration * 0.5 * sample / 800;
    const state = stateAtTime(time);
    near(state.centerPoint.distanceTo(state.sectorInputPin),
      linkage.connectingRodLength, 1.2e-15,
      `constant spatial-link length ${sample}`);
    near(state.spatialLinkLengthResidual, 0, 1.2e-15,
      `spatial-link closure residual ${sample}`);
    near(state.spatialLinkVelocityResidual, 0, 3e-17,
      `spatial-link velocity closure ${sample}`);
    assert.ok(state.sectorAngle >= previousSectorAngle - 3e-15,
      `sector follows increasing pressure ${sample}`);
    previousSectorAngle = state.sectorAngle;
  }
  const initial = stateAtTime(0);
  const maximum = stateAtTime(geometry.cycleDuration / 2);
  near(initial.sectorAngle, 0, 0, 'zero-pressure sector angle');
  near(maximum.sectorAngle, geometry.maximumSectorAngle, 0,
    'maximum-pressure sector angle');
  assert.ok(maximum.sectorAngle > 0.94);
  assert.ok(maximum.sectorAngle < 0.96);
  disposeModel(model.root);
});

test('movement 500 sector and pinion satisfy the external pitch equation and carry the pointer', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  near(transmission.gearRatio, 3.875, 5e-16,
    '31:8 gear ratio');
  assert.equal(transmission.sectorEquivalentTeeth, 31);
  assert.equal(transmission.pinionTeeth, 8);
  const sweep = geometry.maximumSectorAngle * transmission.gearRatio;
  assert.ok(sweep > THREE.MathUtils.degToRad(200) && sweep < THREE.MathUtils.degToRad(220),
    `pointer sweeps about 210 degrees of the full dial (${sweep})`);
  near(geometry.pointerZeroAngle, Math.PI / 2 + sweep / 2, 1e-15,
    'sweep centred on the top of the dial');
  assert.equal(transmission.pointerTurnsWithPinion, true);
  for (let sample = 0; sample <= 900; sample += 1) {
    const state = stateAtTime(geometry.cycleDuration * sample / 900);
    near(state.pinionAngle,
      -state.sectorAngle * transmission.gearRatio, 0,
      `pinion displacement ${sample}`);
    near(state.pinionAngularVelocity,
      -state.sectorAngularVelocity * transmission.gearRatio, 0,
      `pinion speed ${sample}`);
    near(state.pointerAngle, geometry.pointerZeroAngle + state.pinionAngle, 0,
      `pointer keyed to pinion ${sample}`);
    near(state.gearPitchVelocityResidual, 0, 3e-17,
      `no-slip pitch speed ${sample}`);
    near(state.scaleReading,
      geometry.maximumScaleReading * state.pressureFraction, 0,
      `pressure-proportional scale ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 500 renderer follows the diaphragm, exact rod, sector, pinion, and pointer', () => {
  const { model } = movementModel();
  const { blocks, geometry, stateAtTime } = model.root.userData;
  for (let sample = 0; sample <= 320; sample += 1) {
    const time = geometry.cycleDuration * sample / 320;
    const state = stateAtTime(time);
    model.update(time);
    vectorNear(blocks.connectingRod.children[1].position,
      state.centerPoint, 0,
      `rendered spatial-link start ${sample}`);
    vectorNear(blocks.connectingRod.children[2].position,
      state.sectorInputPin, 0,
      `rendered spatial-link end ${sample}`);
    near(blocks.sector.rotation.z, state.sectorAngle, 0,
      `rendered sector ${sample}`);
    near(blocks.pinion.userData.rotor.rotation.z, state.pinionAngle, 0,
      `rendered pinion ${sample}`);
    near(blocks.pointer.rotation.z, state.pointerAngle, 0,
      `rendered pointer ${sample}`);
    near(blocks.pressureFill.material.opacity,
      0.10 + 0.48 * state.pressureFraction, 0,
      `rendered chamber pressure ${sample}`);
    near(blocks.inletPressureCore.material.opacity,
      0.10 + 0.48 * state.pressureFraction, 0,
      `rendered inlet pressure ${sample}`);
  }
  disposeModel(model.root);
});

test('movement 500 is one gauge: no separate section copy, the case drum see-through', () => {
  const { model } = movementModel();
  const { blocks } = model.root.userData;
  assert.equal(blocks.sectionView, undefined);
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.ok(!roles.some((role) => /-in-section$|^brown-section-view/.test(role)), 'no section copy');
  let drum = null;
  model.root.traverse((object) => { if (object.userData.role === 'whole-round-gauge-case-drum') drum = object; });
  assert.ok(drum && drum.userData.seeThrough, 'case drum is see-through');
  for (const part of [blocks.diaphragm, blocks.sector, blocks.pinion, blocks.pointer, blocks.connectingRod]) {
    assert.equal(part.visible, true);
  }
  disposeModel(model.root);
});

test('movement 500 closes smoothly, fits all poses, and leaves movement 507 next', () => {
  const { model } = movementModel();
  const { geometry, stateAtTime, transmission } = model.root.userData;
  const initial = stateAtTime(0);
  const turnaround = stateAtTime(geometry.cycleDuration / 2);
  const closure = stateAtTime(geometry.cycleDuration);
  near(initial.pressureFractionVelocity, 0, 0,
    'initial pressure velocity');
  near(turnaround.pressureFractionVelocity, 0, 6e-17,
    'turnaround pressure velocity');
  near(closure.pressureFractionVelocity, 0, 0,
    'closure pressure velocity');
  near(closure.cyclePosition, initial.cyclePosition, 0,
    'cycle-position closure');
  near(closure.centerDeflection, initial.centerDeflection, 0,
    'diaphragm closure');
  near(closure.sectorAngle, initial.sectorAngle, 0,
    'sector closure');
  near(closure.pointerAngle, initial.pointerAngle, 0,
    'pointer closure');
  near(turnaround.gaugePressurePascal,
    transmission.maximumDemonstrationPressurePascal, 0,
    'maximum demonstration pressure');

  const swept = new THREE.Box3();
  for (let sample = 0; sample <= 360; sample += 1) {
    model.update(geometry.cycleDuration * sample / 360);
    model.root.updateMatrixWorld(true);
    swept.union(new THREE.Box3().setFromObject(model.root));
  }
  assert.ok(model.root.userData.cameraFitBounds.containsBox(swept));
  assert.ok(Number.isFinite(swept.min.x));
  assert.ok(Number.isFinite(swept.max.z));

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
