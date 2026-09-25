import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { applyDisplayTiming } from '../src/simulation/display-timing.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { assertReadableTiming } from './helpers/display-timing.mjs';
import { solidSurface } from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements[188];
const FULL_TURN = Math.PI * 2;

function withModel(body) {
  const model = createMovementModel(movement);
  try { return body(model, model.root.userData); } finally { disposeObject3D(model.root); }
}
const world2 = (object, local = new THREE.Vector3()) => {
  object.updateWorldMatrix(true, false);
  const p = local.clone().applyMatrix4(object.matrixWorld);
  return new THREE.Vector2(p.x, p.y);
};
const near2 = (a, b, tolerance, message) => assert.ok(a.distanceTo(b) <= tolerance,
  `${message}: ${a.toArray().map((v) => v.toFixed(4))} vs ${b.toArray().map((v) => v.toFixed(4))}`);

test('189 is the authored bell-crank hanger modification of 186', () => withModel((model, u) => {
  assert.equal(movement.id, 189);
  assert.equal(movement.title, 'Bell-Crank Hanger Gab Disengaging Gear');
  assert.match(movement.description, /modification of 186/);
  assert.equal(u.fidelity, 'authored');
  assert.equal(u.archetype, movement.archetype);
  assert.match(u.mechanism, /bell-crank.*hanging-link.*gab.*valve-pin/);
  assert.equal(u.hideGround, true);
  assert.equal(u.rigidBodies.length, 4);
  // Brown draws the stud eye only: the plain frame (columns, bearings and the
  // bracket carrying the stud) lies behind the moving parts or off the view.
  u.blocks.frame.traverse((object) => { if (object.isMesh) assert.equal(object.userData.runsPastCrop, true); });
  const frameBox = new THREE.Box3().setFromObject(u.blocks.frame);
  const movingBox = new THREE.Box3().setFromObject(u.blocks.rodBody);
  assert.ok(frameBox.max.z < movingBox.min.z, 'frame behind the rod');
  for (const [plate, pin] of u.jointChecks) {
    assert.ok(plate.isMesh && plate.geometry.userData.bores?.length > 0, `${plate.userData.role} has real bores`);
    assert.equal(pin.geometry.type, 'CylinderGeometry');
  }
}));

test('189 plate landmarks map onto the rendered bodies at the source pose', () => withModel((model, u) => {
  model.update(0);
  const b = u.blocks, g = u.geometry, raster = (p) => u.sourceRasterFromPoint(p);
  const expect = (point, [x, y], message) => near2(raster(point), new THREE.Vector2(x, y), 0.6, message);
  expect(world2(b.valveRocker), g.sourceRaster.valvePivot, 'valve rockshaft');
  expect(world2(b.valvePin), g.sourceRaster.gabPin, 'valve pin');
  expect(world2(b.eccentricRod), g.sourceRaster.gabPin, 'gab centre');
  expect(world2(b.bellCrank), g.sourceRaster.bellPivot, 'bell-crank pivot eye');
  expect(world2(b.crankPin), g.sourceRaster.crankPin, 'crank eye');
  expect(world2(b.rodHangerPin), g.sourceRaster.rodPin, 'rod hanger eye');
  expect(world2(b.bellCrank, new THREE.Vector3(g.handleTopLocal.x, g.handleTopLocal.y, 0)),
    g.sourceRaster.handleTop, 'top of the vertical operating rod');
  // The vertical rod is at x 395..408 on the plate, straight above the eye.
  b.bellCrankPlate.geometry.computeBoundingBox();
  const box = new THREE.Box3().setFromObject(b.bellCrankPlate);
  near2(raster(new THREE.Vector2(box.min.x, box.max.y)), new THREE.Vector2(380.5, 28), 1.5, 'bell crank left/top');
  const rodBox = new THREE.Box3().setFromObject(b.rodBody);
  near2(raster(new THREE.Vector2(rodBox.min.x, rodBox.max.y)), new THREE.Vector2(-300, 354), 1.5, 'rod (whole past Brown\'s break at x 14) and crown top');
  near2(raster(new THREE.Vector2(rodBox.max.x, rodBox.min.y)), new THREE.Vector2(521, 417), 1.5, 'rod tip and lower edge');
  const armBox = new THREE.Box3().setFromObject(b.valveArm);
  assert.ok(Math.abs(raster(new THREE.Vector2(0, armBox.min.y)).y - 436) < 1.5, 'disc below the gab reaches y 436');
  // Depth: valve lever behind the rod; hanger behind rod and crank eyes.
  const zRange = (o) => new THREE.Box3().setFromObject(o);
  assert.ok(zRange(b.valveArm).max.z < zRange(b.rodBody).min.z);
  assert.ok(zRange(b.hangerLink).max.z < zRange(b.rodBody).min.z);
  assert.ok(zRange(b.hangerLink).max.z < zRange(b.bellCrankPlate).min.z);
  assert.ok(Math.abs(zRange(b.valvePin).max.z - zRange(b.rodBody).max.z) < 1e-6, 'pin face flush with rod face');
}));

test('189 joints stay connected and the gab captures then clears the pin', () => withModel((model, u) => {
  const b = u.blocks, g = u.geometry;
  const hangerEnd = new THREE.Vector3(g.hangerLength, 0, 0);
  let engagedSamples = 0, clearSamples = 0;
  for (let i = 0; i <= 640; i++) {
    const time = g.cyclePeriod * i / 640;
    model.update(time);
    const s = u.kinematics;
    const crank = world2(b.crankPin), rodPin = world2(b.rodHangerPin);
    near2(world2(b.hangerLink), crank, 1e-9, `hanger upper eye on crank pin @${time}`);
    near2(world2(b.hangerLink, hangerEnd), rodPin, 1e-9, `hanger lower eye on rod pin @${time}`);
    assert.ok(Math.abs(crank.distanceTo(g.bellPivot) - g.crankLocal.length()) < 1e-9);
    // The strap end rides the eccentric sheave: exactly while the rod rocks
    // about it (released), and within the strap's running clearance while
    // the gab steers it (engaged).
    const eccentric = world2(b.eccentricRod, new THREE.Vector3(g.eccentricLocal.x, g.eccentricLocal.y, 0));
    const sheave = world2(b.eccentricSheave, new THREE.Vector3(0, g.eccentricThrow, 0));
    near2(eccentric, sheave, s.handleFraction === 0 ? 0.012 : 1e-9, `strap on sheave @${time}`);
    assert.ok(Math.abs(eccentric.y - sheave.y) < 1e-9, `strap level with sheave @${time}`);
    const pin = world2(b.valvePin);
    if (s.handleFraction === 0) {
      engagedSamples++;
      near2(world2(b.eccentricRod), pin, 1e-9, `gab seated on pin @${time}`);
      assert.ok(Math.abs(s.rocker - g.rockerAmplitude * Math.sin(FULL_TURN * s.eccentricTurns)) < 1e-12);
      assert.ok(Math.abs(s.pinInRod.x) + g.pinRadius < g.notchHalfWidth, 'pin inside the gab walls');
    }
    if (time >= g.liftWindow[1] && time <= g.lowerWindow[0]) {
      clearSamples++;
      assert.ok(s.pinClearanceBelowRod >= g.clearMargin - 1e-9, `gab held clear @${time}`);
      assert.ok(Math.abs(s.rocker) < 1e-12, 'valve lever rests while released');
    }
  }
  assert.ok(engagedSamples > 250 && clearSamples > 150);
  // During the free run the rod really sweeps back and forth over the pin.
  const xs = Array.from({ length: 97 }, (_, i) => u.stateAtTime(7.5 + 3 * i / 96).gab.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.4);
}));

test('189 rendered pins never enter the plates they join or pass', () => withModel((model, u) => {
  const checks = u.jointChecks.map(([plate, pin]) => ({ plate, pin, surface: solidSurface(plate.geometry) }));
  const frames = [...Array.from({ length: 49 }, (_, i) => u.geometry.cyclePeriod * i / 48),
    ...Array.from({ length: 33 }, (_, i) => 5 + 2 * i / 32)];
  for (const time of frames) {
    model.update(time);
    model.root.updateMatrixWorld(true);
    for (const { plate, pin, surface } of checks) {
      const transform = plate.matrixWorld.clone().invert().multiply(pin.matrixWorld);
      const { radiusTop: radius, height } = pin.geometry.parameters;
      for (let axial = 0; axial <= 6; axial++) for (let k = 0; k < 32; k++) {
        const theta = k * Math.PI / 16;
        const point = new THREE.Vector3(radius * Math.cos(theta), height * (axial / 6 - .5), radius * Math.sin(theta))
          .applyMatrix4(transform);
        assert.equal(surface.inside(point), false, `${pin.userData.role} enters ${plate.userData.role} @${time}`);
      }
    }
  }
}));

test('189 motion is smooth, closes on itself and plays at a natural pace', () => withModel((model, u) => {
  const g = u.geometry;
  assert.equal(g.cyclePeriod, 16);
  assert.equal(u.minimumDisplayCycleSeconds, 16);
  applyDisplayTiming(model, movement);
  assertReadableTiming(u.animationTiming);
  assert.ok(Math.abs(u.animationTiming.displayCycleDuration - 16) < 1e-9);
  // Eccentric never exceeds one turn per 2 s; four whole turns per cycle.
  const end = u.eccentricTurnsAt(16 - 1e-9);
  assert.ok(Math.abs(end.turns - g.eccentricTurnsPerCycle) < 1e-6);
  for (let i = 0; i <= 1600; i++) assert.ok(u.eccentricTurnsAt(16 * i / 1600).speed <= 0.5 + 1e-12);
  // Operator strokes each take 2 s and release/relatch at the same eccentric angle.
  assert.equal(g.liftWindow[1] - g.liftWindow[0], 2);
  assert.equal(g.lowerWindow[1] - g.lowerWindow[0], 2);
  const turnsFrac = (t) => THREE.MathUtils.euclideanModulo(u.eccentricTurnsAt(t).turns + 1e-9, 1);
  assert.ok(turnsFrac(g.liftWindow[0]) < 1e-6 && turnsFrac(g.lowerWindow[1]) < 1e-6);
  // Loop closure and the plate pose at t = 0.
  const a = u.stateAtTime(0), z = u.stateAtTime(16 - 1e-7);
  // (The free-hanging crank follows the running eccentric, so psi moves.)
  assert.ok(a.gab.distanceTo(z.gab) < 1e-6 && Math.abs(a.psi - z.psi) < 1e-7);
  assert.equal(a.stage, 'engaged-eccentric-rod-driving-valve-lever');
  assert.ok(a.gabEngaged && Math.abs(a.psi) < 1e-12 && Math.abs(a.rocker) < 1e-12);
  // Velocity continuity of every visible point path (no jumps or kinks).
  const dt = 1 / 480, track = (t) => {
    const s = u.stateAtTime(t);
    return [s.gab, s.crankPin, s.rodPin, s.handleTop, s.pin, s.eccentric];
  };
  let previous = null, maximumSpeed = 0, maximumJerkStep = 0;
  for (let i = 0; i <= 16 * 480; i++) {
    const t = i * dt, p0 = track(t - dt), p1 = track(t + dt);
    const v = p0.map((p, k) => p1[k].clone().sub(p).divideScalar(2 * dt));
    maximumSpeed = Math.max(maximumSpeed, ...v.map((w) => w.length()));
    if (previous) maximumJerkStep = Math.max(maximumJerkStep, ...v.map((w, k) => w.distanceTo(previous[k])));
    previous = v;
  }
  assert.ok(maximumSpeed < 3, `peak point speed ${maximumSpeed} units/s`);
  assert.ok(maximumJerkStep < 0.02, `velocity step ${maximumJerkStep} per 1/480 s`);
}));
