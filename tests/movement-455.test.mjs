import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { createMovementModel } from '../src/simulation/registry.js';
import { oldRotaryPumpSections } from '../src/simulation/authored-old-rotary-pumps.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements[454];
const model = createMovementModel(movement);
const data = model.root.userData;
const { blocks, geometry: g } = data;
const FULL_TURN = Math.PI * 2;

const inside = (p, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
const insideMulti = (p, multi) => multi.some(([outer, ...holes]) => inside(p, outer) && !holes.some(h => inside(p, h)));
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const areaOf = multi => multi.reduce((sum, [outer, ...holes]) => {
  const ringArea = ring => Math.abs(ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2);
  return sum + ringArea(outer) - holes.reduce((h, ring) => h + ringArea(ring), 0);
}, 0);

test('455 is one casing with its abutment, a two-valve mutilated drum and two round ports', () => {
  assert.equal(movement.id, 455);
  assert.equal(data.archetype, movement.archetype);
  assert.equal(blocks.rotor.parent, model.root);
  assert.equal(blocks.valves.length, 2);
  for (const [i, valve] of blocks.valves.entries()) {
    assert.equal(valve.carrier.parent, blocks.rotor);
    assert.equal(valve.hinge.parent, valve.carrier);
    assert.equal(valve.carrier.rotation.z, i * Math.PI);
  }
  const roles = [];
  model.root.traverse(o => o.userData.role && roles.push(o.userData.role));
  for (const role of ['fixed-outer-cylinder-with-abutment-and-port-pipes', 'mutilated-hollow-drum-with-two-chordal-flats',
    'segment-valve-1-with-drum-radius-arc-back', 'segment-valve-2-with-drum-radius-arc-back',
    'water-filling-annulus-between-drum-and-casing', 'water-rising-in-lower-entrance-pipe', 'water-leaving-by-upper-exit-pipe'])
    assert.ok(roles.includes(role), role);
  assert.ok(!roles.some(r => /foundation|foot|index|hexagon/.test(r)), 'no undrawn base, feet, index or hexagonal rotor');
});

test('455 folded valves close the mutilated drum into a perfect cylinder', () => {
  const { valve, recess } = oldRotaryPumpSections();
  const drum = blocks.rotorBody.geometry.userData.plate.polygons;
  const valves = [0, Math.PI].map(a => valve.map(p => rot(p, a)));
  // The valve back is an arc of the drum radius.
  const back = valve.filter(p => Math.hypot(...p) > g.rotorRadius - 1e-9);
  assert.ok(back.length > 60, 'valve back sampled on the drum circle');
  for (const p of back) assert.ok(Math.abs(Math.hypot(...p) - g.rotorRadius) < 1e-9);
  // Just inside the drum circle every direction is metal (drum or folded
  // valve), just outside none is: the closed rotor is a whole cylinder,
  // except the small relief groove (under 4 degrees) that clears each
  // valve heel's swing just ahead of its knuckle, and a hairline at each
  // valve's free edge.
  let leaks = 0;
  for (let i = 0; i < 3600; i += 1) {
    const a = i * FULL_TURN / 3600;
    const offset = h => THREE.MathUtils.euclideanModulo(a - h + Math.PI, FULL_TURN) - Math.PI;
    const near = [0, Math.PI].some(h => offset(h) > -0.07 && offset(h) < 0.01) || [g.flatSpan, Math.PI + g.flatSpan].some(h => Math.abs(offset(h)) < 0.02);
    const within = [(g.rotorRadius - 0.01) * Math.cos(a), (g.rotorRadius - 0.01) * Math.sin(a)];
    const beyond = [(g.rotorRadius + 0.002) * Math.cos(a), (g.rotorRadius + 0.002) * Math.sin(a)];
    const metal = insideMulti(within, drum) || valves.some(v => inside(within, v));
    assert.ok(!insideMulti(beyond, drum) && !valves.some(v => inside(beyond, v)), `nothing proud of the cylinder at ${i}`);
    if (!metal) { leaks += 1; assert.ok(near, `closed cylinder whole at ${(a * 180 / Math.PI).toFixed(1)} degrees`); }
  }
  assert.ok(leaks < 70, `groove and hairlines only: ${leaks}`);
  // The recess is exactly the valve plus running clearance.
  assert.ok(valve.every(p => inside(p, recess) || Math.hypot(...p) >= g.rotorRadius - 1e-9));
});

test('455 valves stay inside the chamber, bear on the bore away from the abutment, and one always seals', () => {
  const { valve } = oldRotaryPumpSections();
  const pivot = g.pivot;
  let previous = null;
  for (let i = 0; i <= 3600; i += 1) {
    const state = data.stateAtTime(g.cycleDuration * i / 3600);
    const sealing = state.valves.filter(v => Math.abs(v.tipRadius - (g.casingInnerRadius - g.tipClearance)) < 1e-6);
    assert.ok(sealing.length >= 1, `a valve bears on the bore at ${i}`);
    for (const v of state.valves) {
      assert.ok(v.open >= 0 && v.open <= g.maximumOpen + 1e-12);
      const world = valve.map(p => rot(rot([p[0] - pivot[0], p[1] - pivot[1]], -v.open).map((x, k) => x + pivot[k]), v.hingeAngle));
      for (const p of world) {
        assert.ok(Math.hypot(...p) <= g.casingInnerRadius - g.tipClearance + 1e-9, `inside bore at ${i}`);
        assert.ok(!inside(p, g.abutmentRing), `clear of abutment at ${i}`);
      }
      assert.ok(!inside(g.abutmentCorner, world), `abutment corner outside valve at ${i}`);
      if (previous) assert.ok(Math.abs(v.open - previous[v.index]) < 0.02, `continuous opening at ${i}`);
    }
    previous = state.valves.map(v => v.open);
  }
  const a = data.stateAtTime(0), b = data.stateAtTime(g.cycleDuration);
  for (const k of [0, 1]) assert.ok(Math.abs(a.valves[k].open - b.valves[k].open) < 1e-9, 'seamless loop');
  // Each valve is folded home while its recess passes the abutment corner.
  const cornerAngle = Math.atan2(g.abutmentCorner[1], g.abutmentCorner[0]);
  for (let i = 0; i < 720; i += 1) {
    const state = data.stateAtTime(g.cycleDuration * i / 720);
    for (const v of state.valves) {
      const behind = THREE.MathUtils.euclideanModulo(cornerAngle - v.hingeAngle, FULL_TURN);
      if (behind > 0.12 && behind < g.flatSpan - 0.12) assert.ok(v.open < THREE.MathUtils.degToRad(12), `valve folded past the corner at ${i}`);
    }
  }
});

test('455 water in the chamber is conserved: recess water plus the valve inside it fills the recess', () => {
  const { recessInDrum, valve } = oldRotaryPumpSections();
  const pivot = g.pivot;
  const recessArea = areaOf(recessInDrum);
  for (let i = 0; i < 240; i += 1) {
    const time = g.cycleDuration * i / 240;
    model.update(time);
    const state = data.stateAtTime(time);
    for (const [k, water] of blocks.pocketWater.entries()) {
      const open = state.valves[k].open;
      const moved = valve.map(p => rot([p[0] - pivot[0], p[1] - pivot[1]], -open).map((x, j) => x + pivot[j]));
      const valveInside = areaOf(polygonClipping.intersection([[[...moved, moved[0]]]], recessInDrum));
      // Water area from the front cap of the in-place buffer.
      const P = water.geometry.attributes.position.array, count = water.geometry.drawRange.count;
      let waterArea = 0;
      for (let t = 0; t < Math.min(count, P.length / 3); t += 3) {
        if (Math.abs(P[3 * t + 2] - P[3 * t + 5]) > 1e-9 || Math.abs(P[3 * t + 2] - P[3 * t + 8]) > 1e-9) continue;
        if (P[3 * t + 2] < 0) continue;
        waterArea += Math.abs((P[3 * t + 3] - P[3 * t]) * (P[3 * t + 7] - P[3 * t + 1]) - (P[3 * t + 6] - P[3 * t]) * (P[3 * t + 4] - P[3 * t + 1])) / 2;
      }
      assert.ok(Math.abs(waterArea + valveInside - recessArea) < 0.02 * recessArea,
        `recess ${k} at ${i}: water ${waterArea} + valve ${valveInside} vs ${recessArea}`);
    }
  }
});

test('455 only the drum and its valves move', () => {
  const fixed = [blocks.casing, blocks.rearCover, blocks.annulusWater];
  const before = fixed.map(b => b.matrixWorld.clone());
  for (const phase of [0.1, 0.37, 0.8]) {
    model.update(g.cycleDuration * phase);
    model.root.updateMatrixWorld(true);
    fixed.forEach((b, k) => assert.ok(b.matrixWorld.equals(before[k])));
    assert.ok(Math.abs(blocks.rotor.rotation.z - data.stateAtTime(g.cycleDuration * phase).rotorAngle) < 1e-12);
  }
  assert.ok(data.stateAtTime(0).rotorAngularSpeed < 0, 'clockwise, entrance round the left to the exit');
});

test('455 the drum web stays (it carries the drum on the shaft) and takes the rear cover’s plain finish, so the bore reads blank as on the plate', () => {
  assert.equal(blocks.rotorRearWeb.parent, blocks.rotor);
  assert.equal(blocks.rotorRearWeb.material, blocks.rearCover.material);
  assert.notEqual(blocks.rotorBody.material, blocks.rearCover.material);
  const web = new THREE.Box3().setFromObject(blocks.rotorRearWeb), shaft = new THREE.Box3().setFromObject(blocks.shaft);
  assert.ok(shaft.max.z >= web.min.z - 1e-9, 'shaft reaches the web hub');
});
