import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements[238];
const model = createMovementModel(movement);
const d = model.root.userData, g = d.geometry, b = d.blocks;

test('239 is one spur gear held by two separately pivoted flat stops', () => {
  assert.equal(movement.id, 239);
  assert.equal(d.archetype, movement.archetype);
  assert.equal(d.fidelity, 'authored');
  assert.equal(b.gear.userData.teeth, 18);
  assert.equal(d.transmission.separatelyPivotedStopCount, 2);
  assert.equal(d.transmission.fullRotationPermittedWhileStopsSeated, false);
  // Each stop is one extrusion of one outline plus its round boss; no
  // markers, index bars, pads or lands.
  for (const side of ['left', 'right']) {
    const stop = b[`${side}Stop`];
    assert.deepEqual(stop.children.map(o => o.userData.role), [`${side}-source-shaped-stop-body`, `${side}-stop-pivot-boss`]);
    const plate = stop.userData.body.geometry.userData.plate;
    assert.equal(plate.low, -0.15); assert.equal(plate.high, 0.15);
    assert.equal(plate.polygons.length, 1, 'one piece');
    assert.equal(plate.polygons[0].length, 2, 'outline and pivot bore only');
  }
  let markers = 0; model.root.traverse(o => { if (/marker|index/.test(o.userData.role ?? '')) markers++; });
  assert.equal(markers, 0);
});

test('239 stop noses are Brown\'s wedges: working edge on the flank, point near the root, sturdy arm', () => {
  const designs = d.workingParts239.designs;
  for (const side of ['left', 'right']) {
    const s = g.stops[side], design = designs[side];
    // The working edge lies on the held flank (at that stop's limit) from the
    // point to above the tooth tips.
    const u = design.face.outer.clone().sub(design.face.root).normalize();
    for (const p of [design.nose, design.top]) assert.ok(Math.abs(p.clone().sub(design.face.root).cross(u)) < 1e-9);
    assert.ok(design.top.length() > g.gearOuterRadius + 0.2);
    assert.ok(design.nose.length() < g.gearRootRadius + 0.1, `${side} nose reaches the root`);
    // Blunt point: a flat heel, and the wedge widens to at least 0.3 by the
    // tooth tips.
    assert.ok(design.heel.distanceTo(design.nose) > 0.05);
    assert.ok(design.top.distanceTo(design.back) > 0.3, `${side} wedge width ${design.top.distanceTo(design.back)}`);
    // The arm is nowhere thinner than 0.3: every point of its lower edge
    // (wedge back to boss) is that far from the upper edge.
    const upperEdge = design.upper, lowerEdge = design.lower;
    let thinnest = Infinity;
    for (const p of lowerEdge) for (let i = 0; i + 1 < upperEdge.length; i++) {
      const a = upperEdge[i], e = upperEdge[i + 1].clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(e) / e.lengthSq(), 0, 1);
      thinnest = Math.min(thinnest, a.clone().addScaledVector(e, t).distanceTo(p));
    }
    assert.ok(thinnest > 0.3, `${side} arm ${thinnest}`);
  }
});

test('239 play: left seats at the counter-clockwise end, right at the clockwise end', () => {
  const s0 = d.stateAtTime(0), s5 = d.stateAtTime(g.cyclePeriod * 0.5);
  assert.equal(s0.activeStop, 'left'); assert.equal(s0.wheelAngle, g.counterclockwiseLimit);
  assert.equal(s5.activeStop, 'right'); assert.equal(s5.wheelAngle, g.clockwiseLimit);
  assert.ok(Math.abs(s0.leftClearance) < 1e-12 && s0.rightClearance > 0.1);
  assert.ok(Math.abs(s5.rightClearance) < 1e-12 && s5.leftClearance > 0.1);
  for (let i = 0; i <= 200; i++) {
    const s = d.stateAtTime(g.cyclePeriod * i / 200);
    assert.ok(s.leftClearance > -1e-12 && s.rightClearance > -1e-12);
    model.update(g.cyclePeriod * i / 200);
    assert.equal(b.gear.userData.rotor.rotation.z, s.wheelAngle);
  }
  assertReadableTiming(d.animationTiming);
});
