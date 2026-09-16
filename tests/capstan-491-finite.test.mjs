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

test('491 finite rounded nose clears every tooth pose and stays engaged over the working ramp', () => {
  const field = solidSurface(b.ratchet.geometry);
  let minimum = Infinity, maximumWorkingGap = 0;
  for (let i = 0; i <= 4096; i++) {
    const phase = i/4096, angle = g.ratchetPhaseOffset-g.pawlLeadAngle+phase*g.ratchetToothPitch;
    model.update(angle/g.operatingAngularSpeed); root.updateMatrixWorld(true);
    const center = b.pawlTip.getWorldPosition(new THREE.Vector3());
    const gap = field.signedDistance(center)-g.pawlTipRadius;
    minimum = Math.min(minimum,gap);
    if (phase >= 0.40) maximumWorkingGap = Math.max(maximumWorkingGap,gap);
  }
  console.log('491 finite nose clearance',{minimum,maximumWorkingGap});
  assert.ok(minimum > 0.00010);
  assert.ok(maximumWorkingGap < 0.00014, 'working nose must remain in close engagement');
});

test('491 the bored moving eye, bent arm and finite mounting cheeks clear throughout the tooth cycle', () => {
  const pairs = [[b.pawlBar,b.ratchet,0.033], [b.pawlBar,b.lowerCollar,0.028],
    [b.pawlBar,b.barrelBody,0.094], [b.pawlBar,b.pawlPivotPin,0.0048],
    ...b.pawlMountCheeks.map(c => [b.pawlBar,c,0.020])];
  for (const [moving,fixed,minimum] of pairs) {
    const field = solidSurface(fixed.geometry), points = surfacePoints(moving.geometry);
    let worst=Infinity;
    for (let i=0;i<=96;i++) {
      const angle=g.ratchetPhaseOffset+i/96*g.ratchetToothPitch;
      model.update(angle/g.operatingAngularSpeed); root.updateMatrixWorld(true);
      const transform=fixed.matrixWorld.clone().invert().multiply(moving.matrixWorld);
      for (const p of points) worst=Math.min(worst,field.signedDistance(p.clone().applyMatrix4(transform)));
    }
    assert.ok(worst>minimum, `${moving.userData.role}/${fixed.userData.role}: ${worst}`);
  }
});

test('491 a reverse tooth-face force opposes recoil and seats the leading nose instead of lifting it', () => {
  const initialAngle=g.ratchetPhaseOffset-g.pawlLeadAngle+0.4*g.ratchetToothPitch;
  const closure=root.userData.pawlClosureAtAzimuth(initialAngle);
  const radial=g.pawlPivotRadius+g.pawlLength*Math.cos(closure.pawlPitchAngleRadian);
  const delta=Math.asin(g.pawlTipRadius/Math.hypot(radial,g.pawlTipLead))-Math.atan2(g.pawlTipLead,radial);
  const blockedAngle=g.ratchetPhaseOffset+delta;
  b.capstanRotor.rotation.y=-blockedAngle;
  b.pawl.rotation.z=closure.pawlPitchAngleRadian; root.updateMatrixWorld(true);
  const center=b.pawlTip.getWorldPosition(new THREE.Vector3());
  const normal=new THREE.Vector3(-Math.sin(g.ratchetPhaseOffset),0,Math.cos(g.ratchetPhaseOffset));
  const contact=center.clone().addScaledVector(normal,-g.pawlTipRadius);
  const field=solidSurface(b.ratchet.geometry);
  assert.ok(field.distance(contact)<1e-7, 'contact lies on the real finite steep face');
  assert.ok(center.y<g.ratchetHighHeight-0.05 && center.y>g.ratchetLowHeight+0.05);
  const hinge=b.pawlPivotAssembly.getWorldPosition(new THREE.Vector3());
  const axis=new THREE.Vector3(-Math.sin(blockedAngle),0,Math.cos(blockedAngle));
  const hingeMoment=new THREE.Vector3().crossVectors(contact.clone().sub(hinge),normal).dot(axis);
  const driveMoment=new THREE.Vector3().crossVectors(contact,normal).y;
  console.log('491 reverse contact moments',{hingeMoment,driveMoment});
  assert.ok(hingeMoment < -0.005, 'reverse reaction must lower/seat the pawl');
  assert.ok(driveMoment < -1.4, 'reverse reaction must oppose recoil');
});

test('491 the finite crest release is periodic and continuous with a genuine airborne drop', () => {
  const start=g.ratchetPhaseOffset-g.pawlLeadAngle, fn=root.userData.pawlClosureAtAzimuth;
  let previous=fn(start), maximumStep=0, maximumAir=0;
  for (let i=1;i<=4096;i++) {
    const next=fn(start+i/4096*g.ratchetToothPitch);
    maximumStep=Math.max(maximumStep,Math.abs(next.pawlPitchAngleRadian-previous.pawlPitchAngleRadian));
    maximumAir=Math.max(maximumAir,next.airborneClearance);previous=next;
  }
  assert.ok(maximumStep<0.002, `no pose jump: ${maximumStep}`);
  assert.ok(maximumAir>0.01 && maximumAir<0.20);
  assert.ok(Math.abs(fn(start-1e-9).pawlTipHeight-fn(start+1e-9).pawlTipHeight)<1e-7);
});
