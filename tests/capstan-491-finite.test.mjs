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
  assert.match(root.userData.dynamics.finiteContactResidual,/not dynamically solved/);
});

test('491 the pawl turns about the radial pin Brown draws, flat against the lower capstan', () => {
  // Brown shows the pawl in the plane of his elevation: its pin points at the
  // viewer (radially) and the pawl swings across the front of the capstan.
  for (const time of [0, 0.7, 2.3, 5.1]) {
    model.update(time); root.updateMatrixWorld(true);
    const pivot = b.pawlPivotAssembly.getWorldPosition(new THREE.Vector3());
    const radial = new THREE.Vector3(pivot.x, 0, pivot.z).normalize();
    const axis = new THREE.Vector3(0, 0, 1).transformDirection(b.pawl.matrixWorld);
    assert.ok(axis.dot(radial) > 1 - 1e-9, `pawl axis radial at ${time}`);
    const tip = b.pawlTip.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(tip.clone().sub(pivot).dot(radial)) < 1e-9, 'nose in the pawl plane');
    assert.ok(tip.y < pivot.y - 0.15, 'nose hangs down to the teeth');
  }
  model.update(0); root.updateMatrixWorld(true);
  const pivot = b.pawlPivotAssembly.getWorldPosition(new THREE.Vector3());
  const tip = b.pawlTip.getWorldPosition(new THREE.Vector3());
  // Pass 93: the pivot sits 15° round from the front so the seated nose meets
  // its radial tooth face nearly edge-on to Brown's line of sight.
  assert.ok(pivot.z > 1.05 && pivot.x < -0.25 && pivot.x > -0.35, 'pivot on the front of the lower capstan, just left of centre');
  const nose = Math.atan2(tip.z, tip.x) * 180 / Math.PI;
  assert.ok(nose > 84 && nose < 90, `seated nose near the line of sight (azimuth ${nose})`);
  assert.ok(tip.x > pivot.x + 0.3, 'nose hangs down to the right, toward recoil, as drawn');
});

test('491 finite pawl clears every tooth pose and its nose stays engaged over the working ramp', () => {
  const field = solidSurface(b.ratchet.geometry), points = surfacePoints(b.pawlBar.geometry);
  let minimum = Infinity, maximumWorkingGap = 0;
  // Every playback pose of a whole cycle: hauling, the recoil and the hold.
  for (let i = 0; i <= 2048; i++) {
    const time = g.operatingPeriod * i / 2048, state = root.userData.stateAtTime(time);
    model.update(time); root.updateMatrixWorld(true);
    const transform = b.ratchet.matrixWorld.clone().invert().multiply(b.pawlBar.matrixWorld);
    let gap = Infinity;
    for (const p of points) gap = Math.min(gap, field.signedDistance(p.clone().applyMatrix4(transform)));
    minimum = Math.min(minimum, gap);
    if (!state.pawlClosure.falling) maximumWorkingGap = Math.max(maximumWorkingGap, gap);
  }
  console.log('491 finite pawl clearance', {minimum, maximumWorkingGap});
  assert.ok(minimum > 0, `pawl into ratchet ${minimum}`);
  assert.ok(maximumWorkingGap < 0.002, 'working nose must remain in close engagement');
});

test('491 the moving pawl clears the lower capstan, its pin and pin head throughout the tooth cycle', () => {
  const pairs = [[b.pawlBar,b.lowerCollar,0.012], [b.pawlBar,b.barrelBody,0.05],
    [b.pawlBar,b.pawlPivotPin,0.004], [b.pawlBar,b.pawlPinHead,0.004]];
  for (const [moving,fixed,minimum] of pairs) {
    const field = solidSurface(fixed.geometry), points = surfacePoints(moving.geometry);
    let worst=Infinity;
    for (let i=0;i<=192;i++) {
      model.update(g.operatingPeriod*i/192); root.updateMatrixWorld(true);
      const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld);
      for (const p of points) worst=Math.min(worst,field.signedDistance(p.clone().applyMatrix4(transform)));
    }
    assert.ok(worst>minimum, `${moving.userData.role}/${fixed.userData.role}: ${worst}`);
  }
});

test('491 a reverse tooth-face force opposes recoil and seats the nose instead of lifting it', () => {
  // Hold the landed pose and turn the capstan backward until the nose meets
  // the preceding steep face.
  const u0 = g.pawlFreefallFraction + 0.02;
  const closure = root.userData.pawlClosureAtAzimuth(g.ratchetPhaseOffset + (g.pawlReleasePhase + u0)*g.ratchetToothPitch);
  const beta = closure.pawlPitchAngleRadian, field = solidSurface(b.ratchet.geometry), points = surfacePoints(b.pawlBar.geometry);
  const gapAt = u => {
    const angle = g.ratchetPhaseOffset + (g.pawlReleasePhase + u)*g.ratchetToothPitch - g.pawlPivotAzimuth;
    b.capstanRotor.rotation.y = -angle; b.pawl.rotation.z = beta; root.updateMatrixWorld(true);
    const transform = b.ratchet.matrixWorld.clone().invert().multiply(b.pawlBar.matrixWorld);
    let best = [Infinity];
    for (const p of points) { const q = p.clone().applyMatrix4(transform), d = field.signedDistance(q); if (d < best[0]) best = [d, q]; }
    return best;
  };
  let high = u0, low = u0;
  assert.ok(gapAt(high)[0] > 0);
  while (gapAt(low)[0] > 0) { high = low; low -= 0.01; assert.ok(low > u0 - 1, 'no face met'); }
  for (let i = 0; i < 40; i++) { const mid = (high+low)/2; if (gapAt(mid)[0] > 0) high = mid; else low = mid; }
  const [, contactLocal] = gapAt(high);
  const contact = contactLocal.applyMatrix4(b.ratchet.matrixWorld);
  assert.ok(u0 - high < 0.6, 'recoil is arrested within one tooth');
  // The steep face is radial and vertical; its normal points in +azimuth.
  const azimuth = Math.atan2(contact.z, contact.x);
  const normal = new THREE.Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth));
  assert.ok(contact.y < g.ratchetHighHeight && contact.y > g.ratchetLowHeight, 'contact on the steep face');
  const hinge = b.pawlPivotAssembly.getWorldPosition(new THREE.Vector3());
  const axis = new THREE.Vector3(0, 0, 1).transformDirection(b.pawl.matrixWorld);
  const hingeMoment = new THREE.Vector3().crossVectors(contact.clone().sub(hinge), normal).dot(axis);
  const driveMoment = new THREE.Vector3().crossVectors(contact, normal).y;
  console.log('491 reverse contact moments', {hingeMoment, driveMoment});
  assert.ok(hingeMoment < -0.05, 'reverse reaction must lower/seat the pawl');
  assert.ok(driveMoment < -1, 'reverse reaction must oppose recoil');
});

test('491 the finite crest release is periodic and continuous with a genuine airborne drop', () => {
  const start = g.ratchetPhaseOffset + g.pawlReleasePhase*g.ratchetToothPitch, fn = root.userData.pawlClosureAtAzimuth;
  let previous = fn(start), maximumStep = 0, maximumAir = 0;
  for (let i = 1; i <= 4096; i++) {
    const next = fn(start + i/4096*g.ratchetToothPitch);
    maximumStep = Math.max(maximumStep, Math.abs(next.pawlPitchAngleRadian - previous.pawlPitchAngleRadian));
    maximumAir = Math.max(maximumAir, next.airborneClearance); previous = next;
  }
  assert.ok(maximumStep < 0.006, `no pose jump: ${maximumStep}`);
  assert.ok(maximumAir > 0.01 && maximumAir < 0.20);
  assert.ok(Math.abs(fn(start-1e-9).pawlTipHeight - fn(start+1e-9).pawlTipHeight) < 1e-6);
});

test('491 held, the nose sits in the root against the tooth face, which stops any further recoil', () => {
  const field = solidSurface(b.ratchet.geometry), points = surfacePoints(b.pawlBar.geometry);
  const held = root.userData.stateAtTime(0);
  const gapAt = back => {
    b.capstanRotor.rotation.y = held.capstanRotationY + back; b.pawl.rotation.z = held.pawlClosure.pawlPitchAngleRadian;
    root.updateMatrixWorld(true);
    const transform = b.ratchet.matrixWorld.clone().invert().multiply(b.pawlBar.matrixWorld);
    let best = Infinity; for (const p of points) best = Math.min(best, field.signedDistance(p.clone().applyMatrix4(transform)));
    return best;
  };
  const seated = gapAt(0), backed = gapAt(0.004);
  console.log('491 held pawl', { seated, backedOff: backed });
  assert.ok(seated > 0 && seated < 0.002, `seated clear but touching ${seated}`);
  // Turning the capstan back a quarter of a degree drives the pawl into the face.
  assert.ok(backed < 0, `recoil blocked ${backed}`);
  model.update(0);
});
