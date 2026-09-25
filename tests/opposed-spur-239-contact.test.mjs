import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredGearMovement as create } from '../src/simulation/authored-gears.js';
import { solidSurface, surfacePoints, surfaceTriangles } from './helpers/solid-surface.mjs';
const make = () => create({id:239});
const at = (m, phase) => { m.update(phase * 4); m.root.updateMatrixWorld(true); return m.root.userData.kinematics; };
const cross = (a, b) => a.x * b.y - a.y * b.x;
function normalAt(mesh, world) {
  const p = world.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
  for (const t of surfaceTriangles(mesh.geometry)) {
    if (t.closestPointToPoint(p, new THREE.Vector3()).distanceTo(p) > 2e-7) continue;
    const n = t.getNormal(new THREE.Vector3()).transformDirection(mesh.matrixWorld);
    if (Math.abs(n.z) < 1e-8) return n;
  }
  throw new Error(`No actual contact face at ${world.toArray()}`);
}

test('239 both finite load lands oppose the intended wheel rotation over a nonzero face span', () => {
  const m = make(), d = m.root.userData, b = d.blocks;
  const moments = {};
  for (const side of ['left', 'right']) {
    const s = at(m, side === 'left' ? 0.5 : 0), metric = s.contact, stop = b[`${side}Stop`].userData.body;
    const tangent = metric.segment.outer.clone().sub(metric.segment.root).normalize();
    for (const along of [-0.004, 0, 0.014]) {
      const q = metric.nose.clone().addScaledVector(tangent, along), p = new THREE.Vector3(q.x, q.y, 0.1);
      const n = normalAt(b.gearBody, p), opposed = normalAt(stop, p);
      assert.ok(n.dot(opposed) < -0.99999999, `${side} real mating normals`);
      assert.ok(n.dot(new THREE.Vector3(metric.flankNormal.x, metric.flankNormal.y, 0)) > 0.99999999);
      const moment = -cross(q, n);
      assert.ok(side === 'left' ? moment > 2.2 : moment < -2.15);
      moments[side] = moment;
    }
    // Attempted overtravel enters actual wheel triangles at the load land.
    const contact = new THREE.Vector3(metric.nose.x, metric.nose.y, 0.1), wheelField = solidSurface(b.gearBody.geometry);
    b.gear.userData.rotor.rotation.z = s.wheelAngle + (side === 'left' ? -0.001 : 0.001);
    m.root.updateMatrixWorld(true);
    assert.ok(wheelField.signedDistance(contact.applyMatrix4(b.gearBody.matrixWorld.clone().invert())) < -0.0021);
  }
  console.log({ opposedActualFaceMoments: moments });
});

test('239 actual stop pockets clear the square-toothed wheel throughout the trapped sweep', () => {
  const m = make(), d = m.root.userData, b = d.blocks, wheel = b.gearBody, field = solidSurface(wheel.geometry);
  const parts = [b.leftStop.userData.body, b.rightStop.userData.body];
  const samples = parts.map(p => surfacePoints(p.geometry));
  let minimum = Infinity;
  for (let i = 0; i <= 64; i++) {
    at(m, i / 64);
    for (const [j, part] of parts.entries()) {
      const transform = wheel.matrixWorld.clone().invert().multiply(part.matrixWorld);
      for (const p of samples[j]) {
        const gap = field.signedDistance(p.clone().applyMatrix4(transform));
        minimum = Math.min(minimum, gap);
        assert.ok(gap > -2e-7, `${part.userData.role} phase ${i / 64}: ${gap}`);
      }
      const a = new THREE.Box3().setFromObject(part), z = new THREE.Box3().setFromObject(wheel);
      assert.ok(Math.min(a.max.z,z.max.z)-Math.max(a.min.z,z.min.z) > 0.1599);
    }
  }
  console.log({ minimumSelectedWorkingSurfaceClearance: minimum });
});

test('239 shaft bores and rear journals are real passages and connect to their supports', () => {
  const m = make(), d = m.root.userData, b = d.blocks, w = d.workingParts239;
  const pairs = [];
  for (const [i, side] of ['left', 'right'].entries()) {
    const pin = b[`${side}PivotShaft`].userData.rotor.children[0];
    pairs.push([pin,b[`${side}Stop`].userData.body,0.0048], [pin,b[`${side}Stop`].userData.hub,0.0048], [pin,w.journals[i],0.0028]);
  }
  const shaft = b.gearShaft.userData.rotor.children[0];
  pairs.push([shaft,b.gearBody,0.0028],[shaft,b.gearHub,0.0028],[shaft,w.journals[2],0.0028]);
  const cache = pairs.map(([pin,body,gap])=>({pin,body,gap,points:surfacePoints(pin.geometry),field:solidSurface(body.geometry)}));
  for (const phase of [0,0.27,0.5,0.69,1]) {
    at(m,phase);
    for (const {pin,body,gap,points,field} of cache) {
      const transform = body.matrixWorld.clone().invert().multiply(pin.matrixWorld);
      for(const p of points) assert.ok(field.signedDistance(p.clone().applyMatrix4(transform)) > gap, `${pin.userData.role}/${body.userData.role}`);
    }
  }
  for (const [i,journal] of w.journals.entries()) {
    const field = solidSurface(journal.geometry), box = new THREE.Box3().setFromObject(w.posts[i]);
    const p = new THREE.Vector3(journal.position.x,box.max.y,-0.32).applyMatrix4(journal.matrixWorld.clone().invert());
    assert.ok(field.signedDistance(p) < -0.015, 'post joins the solid underside of the journal');
    assert.ok(box.min.y < -3.3 && box.max.z < -0.22, 'post joins rail behind complete wheel');
  }
});

test('239 full gear and source pivots remain, and the prescribed free play is smooth and periodic', () => {
  const m = make(), d = m.root.userData, g = d.geometry;
  assert.equal(d.blocks.gear.userData.toothProfile,'source-square-straight-flank');
  assert.equal(d.blocks.gear.userData.teeth,18);
  assert.deepEqual(g.leftPivot.toArray(),[-3.152,1.264]); assert.deepEqual(g.rightPivot.toArray(),[4.384,1.76]);
  assert.ok(-g.clockwiseLimit/g.toothPitch > 0.24 && -g.clockwiseLimit/g.toothPitch < 0.25);
  for(const phase of [0,0.16,0.38,0.58,0.8,1]) {
    const a=d.stateAtCycleCoordinate(phase-1e-7),b=d.stateAtCycleCoordinate(phase+1e-7);
    assert.ok(Math.abs(a.wheelAngle-b.wheelAngle)<1e-10);
    assert.ok(Math.abs(a.wheelAngularSpeed-b.wheelAngularSpeed)<1e-10);
  }
  assert.match(d.reconstructionNote,/prescribed/); assert.match(d.reconstructionNote,/not dynamically solved/);
});

test('239 source-facing full-sweep bounds fit finite vertices and updates retain all buffers', () => {
  const m=make(),d=m.root.userData,meshes=[];m.root.traverse(o=>{if(o.isMesh)meshes.push([o,o.geometry]);}); const p=new THREE.Vector3();
  // Everything above Brown's broken line (y -0.72) stays in the plate crop;
  // the wheel itself is whole and simply runs off the view below.
  const brownBreakTop=-0.72;assert.equal(d.wheelBreak,undefined);
  for(let i=0;i<=16;i++) {
    at(m,i/16);
    for(const[o,g]of meshes) {
      assert.equal(o.geometry,g); assert.equal(o.material.fog,false);assert.equal(o.material.userData.worldBreakBelow,undefined);assert.equal(o.material.onBeforeCompile?.toString().includes('discard')??false,false);
      if(!o.visible)continue;
      for(let j=0;j<g.attributes.position.count;j++) {p.fromBufferAttribute(g.attributes.position,j).applyMatrix4(o.matrixWorld);assert.ok(d.sweptBounds.containsPoint(p),`${o.userData.role}: ${p.toArray()}`);if(p.y>brownBreakTop)assert.ok(d.cameraFitBounds.containsPoint(p),`drawn ${o.userData.role}: ${p.toArray()}`);}
    }
  }
  assert.equal(d.minimumDisplayCycleSeconds,6);assert.equal(d.hideGround,true);assert.equal(d.sourceAnimation.available,false);
});
