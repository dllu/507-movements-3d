import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredCapstanMovement } from '../src/simulation/authored-capstans.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const model = createAuthoredCapstanMovement({ id: 491 });
const { root } = model, { blocks: b, geometry: g, cableRoute } = root.userData;
function gap(source, target, points = surfacePoints(source.geometry)) {
  const field = solidSurface(target.geometry);
  const transform = target.matrixWorld.clone().invert().multiply(source.matrixWorld);
  return Math.min(...points.map(p => field.signedDistance(p.clone().applyMatrix4(transform))));
}

test('491 stationary spindle has finite clearance through the rotating bores and below the through bar', () => {
  root.updateMatrixWorld(true);
  for (const part of [b.barrelBody, b.lowerCollar, b.drumHead]) {
    assert.ok(gap(b.fixedSpindle, part) > 0.0096, part.userData.role);
  }
  assert.ok(gap(b.fixedSpindle, b.handSpike) > 0.0799);
  assert.ok(gap(b.handSpike, b.drumHead) > 0.0198);
  for (const rim of b.socketMarkers) assert.ok(gap(b.handSpike, rim) > 0.0198);
});

test('491 unused sockets are open radial passages with finite blind rear walls', () => {
  const field = solidSurface(b.drumHead.geometry);
  for (let i = 0; i < 8; i++) {
    const a = i*Math.PI/4;
    for (let r = 0.9; r < 1.31; r += 0.025) {
      assert.ok(field.signedDistance(new THREE.Vector3(r*Math.cos(a),0.02,r*Math.sin(a))) > 0.039);
    }
    if (i%4) {
      const origin = new THREE.Vector3(0.90*Math.cos(a),1.29,0.90*Math.sin(a));
      const ray = new THREE.Raycaster(origin,new THREE.Vector3(-Math.cos(a),0,-Math.sin(a)));
      const hits = ray.intersectObject(b.drumHead);
      assert.ok(hits.length && Math.abs(hits[0].distance-0.04) < 1e-6, `blind socket ${i}`);
    }
  }
});

test('491 three rope turns do not intersect neighboring turns and rest on the barrel waist', () => {
  const curve = cableRoute.curve;
  const point = angle => curve.getPoint((curve.freeSpanLength+g.barrelRadius*angle)/curve.parameterLength);
  let minimum = Infinity;
  // Search offsets near a full revolution, including nearest points at slightly
  // different azimuths, rather than checking only nominal axial pitch.
  for (let a = 0; a <= 4*Math.PI; a += 0.025) {
    for (let d = -0.03; d <= 0.03; d += 0.002) {
      const next = a+2*Math.PI+d;
      if (next > g.wrapAngle) continue;
      minimum = Math.min(minimum, point(a).distanceTo(point(next))-2*g.ropeRadius);
    }
  }
  assert.ok(minimum > 0.026, `neighboring cable clearance ${minimum}`);
  const field = solidSurface(b.barrelBody.geometry);
  const cablePoints = surfacePoints(b.cable.geometry);
  let worst = Infinity;
  for (const p of cablePoints) worst = Math.min(worst, field.signedDistance(p));
  assert.ok(worst > -0.00001, `cable/barrel minimum ${worst}`);
  assert.ok(field.distance(new THREE.Vector3(0.64, 0, 0)) < 1e-6);
});

test('491 pure state queries and repeated updates retain geometry identities and display duration', () => {
  const before = []; root.traverse(o => before.push([o,o.geometry]));
  for (let i = 0; i < 500; i++) { root.userData.stateAtTime(i/31); model.update(i/31); }
  const after = []; root.traverse(o => after.push([o,o.geometry]));
  assert.deepEqual(after,before);
  assert.equal(root.userData.minimumDisplayCycleSeconds,8);
  assert.equal(root.userData.hideGround,true);
  root.traverse(o => { for (const material of o.material ? [].concat(o.material) : []) assert.equal(material.fog,false); });
  assert.match(root.userData.dynamics.finiteContactResidual,/not a validated contact solution/);
});

test('491 existing finite pawl residual stays bounded and is not certified by its ideal point test', () => {
  const field = solidSurface(b.ratchet.geometry), points = surfacePoints(b.pawlTip.geometry);
  let worst = { gap: Infinity };
  for (let i = 0; i <= 128; i++) {
    const phase = i/128;
    const angle = g.ratchetPhaseOffset+phase*g.ratchetToothPitch;
    model.update(angle/g.operatingAngularSpeed); root.updateMatrixWorld(true);
    const transform = b.ratchet.matrixWorld.clone().invert().multiply(b.pawlTip.matrixWorld);
    for (const p of points) {
      const distance = field.signedDistance(p.clone().applyMatrix4(transform));
      if (distance < worst.gap) worst = { gap: distance, toothPhase: phase };
    }
  }
  console.log('491 finite pawl residual',JSON.stringify(worst));
  assert.ok(worst.gap > -0.15, JSON.stringify(worst));
});
