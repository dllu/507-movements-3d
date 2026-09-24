import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {applyDisplayTiming} from '../src/simulation/display-timing.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from './helpers/solid-surface.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements[185];
const build = () => createMovementModel(movement);
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${message}: expected ${expected} +/- ${tolerance}, received ${actual}`);
const world = (object, local = new THREE.Vector3()) => object.localToWorld(local.clone());

test('186 is Brown\'s spring-handle gab disengager, authored at a natural pace', () => {
  assert.equal(movement.id, 186);
  assert.match(movement.description, /spring handle below until it catches in the notch, a/);
  const model = build();
  try {
    const d = model.root.userData;
    assert.equal(d.fidelity, 'authored');
    assert.match(d.mechanism, /notch-a/);
    assert.equal(d.hideGround, true);
    assert.equal(d.geometry.cyclePeriod, 15.4);
    assert.equal(d.animationTiming.authoredCyclePeriod, 15.4);
    assert.equal(d.minimumDisplayCycleSeconds, 15.4);
    const timed = build();
    applyDisplayTiming(timed, movement);
    near(timed.root.userData.animationTiming.displayCycleDuration, 15.4, 1e-9, 'plays in real time');
    disposeObject3D(timed.root);
    // Three eccentric turns of at least two seconds each, then deliberate operator actions.
    const {timeline} = d.geometry;
    assert.ok((timeline.run - timeline.ramp) / timeline.turns >= 2, 'eccentric turn takes >= 2 s at cruise');
    for (const key of ['pull', 'lower']) {
      const [a, b] = timeline[key];
      assert.ok(b - a >= 1.5 && b - a <= 2.5, `${key} takes 1.5-2.5 s`);
    }
    // No frame: Brown draws only the rocker, rod, lever and spring handle.
    const roles = [];
    model.root.traverse((o) => o.isMesh && roles.push(o.userData.role));
    assert.ok(!roles.some((r) => /frame|bracket|base|post|ledge|shoulder/.test(r ?? '')), roles.join());
    assert.ok(d.geometry.strapWidth >= 13 * d.geometry.sourceUnitsPerPixel, 'Brown\'s broad strap');
    assert.equal(d.rigidBodies.length, 4);
    assert.ok(d.jointChecks.length >= 9);
    for (const [, pin] of d.jointChecks) assert.equal(pin.geometry.type, 'CylinderGeometry');
  } finally { disposeObject3D(model.root); }
});

test('186 t=0 places the parts on Brown\'s plate landmarks', () => {
  const model = build();
  try {
    model.update(0);
    model.root.updateMatrixWorld(true);
    const d = model.root.userData, b = d.blocks, s = d.geometry.sourceUnitsPerPixel;
    const raster = (object) => { const p = world(object); return d.sourceRasterFromPoint(p.x, p.y); };
    const expectRaster = (p, x, y, tol, label) => { near(p.x, x, tol, `${label} x`); near(p.y, y, tol, `${label} y`); };
    expectRaster(raster(b.valveRocker), 260, 62, 1e-6, 'rockshaft');
    expectRaster(raster(b.valvePin), 270, 250, 1e-6, 'valve pin in gab');
    expectRaster(raster(b.pinC), 341, 242, 1e-6, 'lever pivot c');
    expectRaster(raster(b.camLever), 341, 242, 1e-6, 'lever turns about c');
    const k = d.stateAtTime(0);
    assert.equal(k.stage, 'engaged-running');
    assert.equal(k.lift, 0);
    assert.equal(k.leverAngle, 0);
    assert.equal(k.rockerAngle, 0);
    // Rocker spans Brown's broad tapered arm; rod runs from the broken end at x 25.
    const rockerBox = new THREE.Box3().setFromObject(b.valveArm);
    near(rockerBox.max.y, d.sourcePointFromRaster(0, 11).y, 2 * s, 'rocker boss top');
    const rodBox = new THREE.Box3().setFromObject(b.rodBody);
    near(rodBox.min.x, d.sourcePointFromRaster(23, 0).x, 1 * s, 'rod broken end');
    near(rodBox.max.y, d.sourcePointFromRaster(0, 197).y, 1 * s, 'rod crown top');
    near(rodBox.min.y, d.sourcePointFromRaster(0, 269).y, 1e-6, 'rod lower edge');
    // Spring loop reaches Brown's loop bottom and its free end lies at notch a.
    const strap = d.strapPointsWorld(k).map((p) => d.sourceRasterFromPoint(p.x, p.y));
    const bottom = strap.reduce((a, p) => (p.y > a.y ? p : a));
    expectRaster(bottom, 455, 490, 8, 'loop bottom');
    expectRaster(strap.at(-1), 476, d.geometry.tipRestY, 1e-6, 'free end under notch a');
    near(d.geometry.tipRestY, 320, 1, 'free end height');
    const leverBox = new THREE.Box3().setFromObject(b.leverBody);
    near(d.sourceRasterFromPoint(leverBox.max.x, 0).x, 497, 1, 'drop outer edge');
    near(d.sourceRasterFromPoint(0, leverBox.max.y).y, 145, 1.5, 'claw knuckle');
  } finally { disposeObject3D(model.root); }
});

test('186 joints stay connected and the gab really captures and clears the pin', () => {
  const model = build();
  try {
    const d = model.root.userData, b = d.blocks, g = d.geometry;
    const junction = new THREE.Vector3(...g.strapJunction, g.layers.strapFront);
    let maxLift = 0, maxTheta = 0, restLength = 0;
    const rest = d.strapPointsWorld(d.stateAtTime(0));
    for (let j = 1; j < rest.length; j++) restLength += rest[j].distanceTo(rest[j - 1]);
    for (let i = 0; i <= 616; i++) {
      const t = g.cyclePeriod * i / 616;
      const k = model.update(t);
      model.root.updateMatrixWorld(true);
      // Pin c shared by rod and lever; valve pin carried by the rocker.
      const cOnRod = world(b.eccentricRod, new THREE.Vector3(...g.pivotC, 0));
      assert.ok(cOnRod.distanceTo(world(b.camLever)) < 1e-9, `c separates at ${t}`);
      assert.ok(world(b.eccentricRod, new THREE.Vector3(...g.pivotC, b.pinC.position.z)).distanceTo(world(b.pinC)) < 1e-9);
      const pinFromShaft = world(b.valvePin).sub(world(b.valveRocker));
      near(Math.hypot(pinFromShaft.x, pinFromShaft.y), Math.hypot(g.shaft[0], g.shaft[1]), 1e-9, 'rocker arm length');
      // Strap root stays on the riveted blade; the whole strap keeps its length within 4 %.
      const points = d.strapPointsWorld(k);
      assert.ok(points[0].distanceTo(world(b.eccentricRod, junction)) < 1e-9, `strap leaves its blade at ${t}`);
      let length = 0;
      for (let j = 1; j < points.length; j++) length += points[j].distanceTo(points[j - 1]);
      assert.ok(Math.abs(length / restLength - 1) < 0.04, `strap length ${length} at ${t}`);
      // Gab: captured (pin centred in the slot) whenever not lifted; lifted only by the claw.
      const pinInRod = b.eccentricRod.worldToLocal(world(b.valvePin));
      if (k.lift === 0) {
        assert.ok(Math.hypot(pinInRod.x, pinInRod.y) < 1e-9, `pin leaves the gab while engaged at ${t}`);
        assert.equal(k.gabCaptured, true);
      } else {
        near(k.footClearance, g.contactGap, 1e-6, `claw foot rides the pin at ${t}`);
        assert.ok(k.footContactX > g.footX[0] + 2 * g.sourceUnitsPerPixel && k.footContactX < g.footX[1],
          `claw contact stays on the foot at ${t}`);
        assert.equal(k.rockerAngle, 0, 'the eccentric is stopped while the gab is lifted');
      }
      if (k.stage === 'latched-disengaged') {
        assert.equal(k.latched, true);
        assert.ok(k.gabBottomClearance > 2 * g.sourceUnitsPerPixel && k.gabBottomClearance < 6 * g.sourceUnitsPerPixel,
          `gab clears the pin by a small margin, got ${k.gabBottomClearance}`);
        assert.equal(k.gabClear, true);
      }
      // The loop is a stiff handle: past the bar it keeps its rest shape in the
      // lever frame, shifted only a few px along the drop's flat (the tongue's
      // end alone flexes into notch a).
      const leverInv = b.camLever.matrixWorld.clone().invert();
      const rest = g.strapRestPoints, n = rest.length;
      let shift = null;
      for (let j = g.barBendIndex; j < n - 7; j++) {
        const local = points[j].clone().applyMatrix4(leverInv);
        const dx = local.x - (rest[j][0] - g.pivotC[0]), dy = local.y - (rest[j][1] - g.pivotC[1]);
        shift ??= dx;
        near(dx, shift, 1e-6, `loop stays rigid (x) at ${t}`);
        near(dy, 0, 1e-6, `loop stays rigid (y) at ${t}`);
      }
      assert.ok(shift > -1e-9 && shift < 8 * g.sourceUnitsPerPixel, `tongue slide ${shift / g.sourceUnitsPerPixel} px at ${t}`);
      // The bar bends smoothly: no radius tighter than 1.5 strap widths.
      for (let j = 2; j < g.barBendIndex + 2; j++) {
        const u = points[j - 1].clone().sub(points[j - 2]), v = points[j].clone().sub(points[j - 1]);
        u.z = 0; v.z = 0;
        const curvature = u.angleTo(v) / ((u.length() + v.length()) / 2);
        assert.ok(curvature < 1 / (1.5 * g.strapWidth), `bar kinks at ${t}: radius ${1 / curvature}`);
      }
      maxLift = Math.max(maxLift, k.lift);
      maxTheta = Math.max(maxTheta, k.leverAngle);
    }
    // Lift just clears the 38 px pin; the lever turns no more than the claw geometry requires.
    assert.ok(maxLift < 46 * g.sourceUnitsPerPixel, `lift ${maxLift}`);
    assert.ok(maxTheta < 0.56, `lever angle ${maxTheta}`);
    assert.equal(g.rockerAmplitude, 0.07);
  } finally { disposeObject3D(model.root); }
});

test('186 stage sequence: run, stop, pull, snap into a, hold, release, lower', () => {
  const model = build();
  try {
    const d = model.root.userData;
    const order = [];
    for (let i = 0; i < 1540; i++) {
      const {stage} = d.stateAtTime(i / 100);
      if (order.at(-1) !== stage) order.push(stage);
    }
    assert.deepEqual(order, ['engaged-running', 'engaged-stopped', 'pulling-handle-lifting-rod',
      'spring-end-snapping-into-notch-a', 'latched-disengaged', 'releasing-spring-end-from-notch-a',
      'lowering-rod-onto-pin', 'engaged-stopped']);
    const a = d.stateAtTime(0), z = d.stateAtTime(d.geometry.cyclePeriod - 1e-9);
    near(z.lift, a.lift, 1e-9, 'lift loops');
    near(z.leverAngle, a.leverAngle, 1e-9, 'lever loops');
    near(Math.sin(z.eccentricAngle), Math.sin(a.eccentricAngle), 1e-6, 'eccentric loops');
  } finally { disposeObject3D(model.root); }
});

test('186 motion is smooth (continuous velocities, no jumps)', () => {
  const model = build();
  try {
    const d = model.root.userData, P = d.geometry.cyclePeriod, h = 0.002;
    const keys = ['lift', 'leverAngle', 'rockerAngle', 'eccentricAngle'];
    const at = (t) => d.stateAtTime(THREE.MathUtils.euclideanModulo(t, P));
    const peak = Object.fromEntries(keys.map((k) => [k, 0]));
    for (let t = 0; t < P; t += h) {
      const [a, b, c] = [at(t - h), at(t), at(t + h)];
      for (const k of keys) {
        // The eccentric angle is reported modulo whole turns; unwrap its differences.
        const wrap = (v) => (k === 'eccentricAngle' ? Math.atan2(Math.sin(v), Math.cos(v)) : v);
        const [x0, x1, x2] = [0, wrap(b[k] - a[k]), wrap(b[k] - a[k]) + wrap(c[k] - b[k])];
        // A bounded second difference means the velocity has no step.
        assert.ok(Math.abs(x2 - 2 * x1 + x0) < 40 * h * h, `${k} jerks at ${t}: ${x2 - 2 * x1 + x0}`);
        peak[k] = Math.max(peak[k], Math.abs(x2 - x0) / (2 * h));
      }
      assert.ok(Math.abs(b.tipOffsetPx[0] - a.tipOffsetPx[0]) < 0.2 && Math.abs(b.tipOffsetPx[1] - a.tipOffsetPx[1]) < 0.2);
    }
    assert.ok(peak.eccentricAngle <= Math.PI + 1e-6, 'eccentric at most half a turn per second');
    assert.ok(peak.leverAngle < 0.6, `lever peak ${peak.leverAngle} rad/s`);
    assert.ok(peak.lift < 0.7, `rod lift peak ${peak.lift} units/s`);
  } finally { disposeObject3D(model.root); }
});

test('186 solids: pins run in real bores, claw and spring end touch without overlapping', () => {
  const model = build();
  try {
    const d = model.root.userData, b = d.blocks;
    const checks = d.jointChecks.map(([plate, pin]) => ({plate, pin, surface: solidSurface(plate.geometry)}));
    const lever = solidSurface(b.leverBody.geometry);
    const pinSurface = (pin) => {
      const {radiusTop: r, height} = pin.geometry.parameters, points = [];
      for (let a = 0; a <= 8; a++) for (let j = 0; j < 32; j++) {
        const th = j * Math.PI / 16;
        points.push(new THREE.Vector3(r * Math.cos(th), height * (a / 8 - 0.5), r * Math.sin(th)));
      }
      return points;
    };
    let tipTouch = Infinity;
    for (let frame = 0; frame <= 48; frame++) {
      const t = d.geometry.cyclePeriod * frame / 48;
      const k = model.update(t);
      model.root.updateMatrixWorld(true);
      for (const {plate, pin, surface} of checks) {
        const m = plate.matrixWorld.clone().invert().multiply(pin.matrixWorld);
        for (const p of pinSurface(pin)) {
          assert.equal(surface.inside(p.clone().applyMatrix4(m)), false, `${pin.userData.role} in ${plate.userData.role} at ${t}`);
        }
      }
      // Valve pin against the lever (claw foot contact).
      const m = b.leverBody.matrixWorld.clone().invert().multiply(b.valvePin.matrixWorld);
      for (const p of pinSurface(b.valvePin)) assert.equal(lever.inside(p.applyMatrix4(m)), false, `claw bites the pin at ${t}`);
      // Spring strap never enters the lever; its free end bears on the drop.
      const inv = b.leverBody.matrixWorld.clone().invert();
      const pos = b.springStrap.geometry.attributes.position;
      let nearest = Infinity;
      for (let i = 0; i < pos.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(b.springStrap.matrixWorld).applyMatrix4(inv);
        assert.equal(lever.inside(p), false, `strap enters the lever at ${t}`);
        nearest = Math.min(nearest, lever.distance(p, 0.05));
      }
      if (k.stage !== 'engaged-running' || t === 0) tipTouch = Math.min(tipTouch, nearest);
      assert.ok(nearest < 0.005, `spring end loses the drop at ${t} (${nearest})`);
    }
    assert.ok(tipTouch < 0.003);
  } finally { disposeObject3D(model.root); }
});
