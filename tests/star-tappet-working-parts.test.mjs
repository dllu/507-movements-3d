import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
import {surfacePoints,surfaceTriangles,solidSurface} from './helpers/solid-surface.mjs';
function audit() {
  const points = new Map(), solids = new Map(), triangles = new Map(), minima = {};
  let queries = 0;
  const check = (a, b, label, journal = false, dynamic = false) => {
    if (dynamic || !points.has(a.geometry)) points.set(a.geometry, surfacePoints(a.geometry));
    if (!solids.has(b.geometry)) solids.set(b.geometry, solidSurface(b.geometry));
    const solid = solids.get(b.geometry), matrix = b.matrixWorld.clone().invert().multiply(a.matrixWorld);
    const verify = point => {
      const gap = solid.signedDistance(point, .1); queries++;
      assert.ok(Number.isFinite(gap)); minima[label] = Math.min(minima[label] ?? .1, gap);
      assert.ok(gap >= -1e-5, `${label}: ${a.userData.role} -> ${b.userData.role}: ${gap}`);
      return gap;
    };
    let minimum = .1;
    for (const point of points.get(a.geometry)) minimum = Math.min(minimum, verify(point.clone().applyMatrix4(matrix)));
    // A long shaft's ends can lie beyond a thin journal. Intersect its actual
    // triangle edges with the journal's interior slices as well as vertices.
    if (journal) {
      if (!triangles.has(a.geometry)) triangles.set(a.geometry, surfaceTriangles(a.geometry));
      for (const triangle of triangles.get(a.geometry)) {
        const vertices = [triangle.a, triangle.b, triangle.c].map(p => p.clone().applyMatrix4(matrix));
        for (const axis of ['x', 'y', 'z']) for (const coordinate of [solid.box.min[axis] + 1e-6, (solid.box.min[axis] + solid.box.max[axis]) / 2, solid.box.max[axis] - 1e-6]) {
          for (let j = 0; j < 3; j++) {
            const a = vertices[j], b = vertices[(j + 1) % 3], t = (coordinate - a[axis]) / (b[axis] - a[axis]);
            if (t >= 0 && t <= 1) verify(a.clone().lerp(b, t));
          }
        }
      }
    }
    return minimum;
  };
  return { check, report: () => ({ queries, minima }) };
}

const shaftMesh=g=>g.userData.rotor.children.find(o=>o.isMesh);
test('235 actual working noses occupy wheel depth and clear throughout drive, return and holding',()=>{
 const m=create({id:235}),d=m.root.userData,b=d.blocks,wheel=b.ratchet.userData.body,a=audit();let driveGap=0,holdGap=0;
 for(let i=0;i<=128;i++){m.update(i/128*4);m.root.updateMatrixWorld(true);const s=d.kinematics;
  for(const nose of[b.tappetNose,b.holdingClickNose]){const box=new THREE.Box3().setFromObject(nose);assert.ok(box.min.z<.15&&box.max.z>-.15);a.check(nose,wheel,'nose/wheel');a.check(wheel,nose,'wheel/nose');}
  const drive=a.check(b.tappetNose,wheel,'tappet proximity'),hold=a.check(b.holdingClickNose,wheel,'holding proximity');
  if(s.driveContact){driveGap=Math.max(driveGap,drive);assert.ok(drive<.0007);}
  if(s.wheelDwelling){holdGap=Math.max(holdGap,hold);assert.ok(hold<.0007);assert.ok(s.holdingTorque>0);}
  for(const body of[b.carrierBody,b.tappetBody,b.holdingClickBody])a.check(body,wheel,'body/wheel');
  for(const body of[b.carrierBody,b.holdingClickBody,b.ratchet.userData.hub])a.check(b.tappetNose,body,'tappet nose/hardware');
  for(const body of[b.carrierBody,b.tappetBody,b.ratchet.userData.hub])a.check(b.holdingClickNose,body,'holding nose/hardware');
  a.check(b.tappetNose,b.holdingClickNose,'nose/nose');
  a.check(b.tappetBody,b.carrierBody,'tappet/carrier');a.check(b.holdingClickBody,b.tappetBody,'holding/tappet');
 }
 console.log({driveGap,holdGap,...a.report()});
});
test('235 actual drive and seated holding surfaces transmit counterclockwise torque',()=>{
 const m=create({id:235}),d=m.root.userData,b=d.blocks;let minimum=Infinity;
 for(const q of[0,.04,.12,.2,.239,.3,.7]){m.update(q*4);m.root.updateMatrixWorld(true);const s=d.kinematics,c=s.driveContact??s.holdingClickState,world=new THREE.Vector3((c.point??c.profilePoint).x,(c.point??c.profilePoint).y,.05),local=world.clone().applyMatrix4(b.ratchet.userData.body.matrixWorld.clone().invert());let best=Infinity,normal;const p=new THREE.Vector3();
  for(const t of surfaceTriangles(b.ratchet.userData.body.geometry)){const gap=t.closestPointToPoint(local,p).distanceTo(local);if(gap<best){best=gap;normal=t.getNormal(new THREE.Vector3());}}
  normal.transformDirection(b.ratchet.userData.body.matrixWorld);const torque=-world.x*normal.y+world.y*normal.x;assert.ok(best<1e-6);assert.ok(torque>.1);minimum=Math.min(minimum,torque);
 }console.log({minimumCompressiveTorqueArm:minimum});
});
test('235 baked return and holding paths are continuous, finite and transfer to a seated click before dwell',()=>{
 const m=create({id:235}),d=m.root.userData;let previous,maxStep=0,min=Infinity;
 for(let i=0;i<=8192;i++){const s=d.stateAtCycleCoordinate(i/8192);min=Math.min(min,s.tappetClearance,s.holdingClickState.clearance);assert.ok(s.tappetClearance>.0003);assert.ok(s.holdingClickState.clearance>.0003);
  if(previous){const step=Math.max(Math.abs(s.tappetAngle-previous.tappetAngle),Math.abs(s.holdingClickAngle-previous.holdingClickAngle));maxStep=Math.max(maxStep,step);assert.ok(step<.003);}
  if(s.wheelDwelling){assert.equal(s.holdingClickDelta,0);assert.ok(s.holdingTorque>0);}
  previous=s;
 }console.log({minimumWorkingCircleGap:min,maxAngularStep:maxStep});assert.equal(d.dynamics.forceValidated,false);
});
test('235 actual carrier, tappet and holding journals clear finite pins',()=>{
 const m=create({id:235}),d=m.root.userData,b=d.blocks,a=audit();
 for(let i=0;i<=16;i++){m.update(i/16*4);m.root.updateMatrixWorld(true);
  for(const part of[b.carrierBody,b.carrierBearing])a.check(shaftMesh(b.carrierShaft),part,'carrier pivot',true);
  for(const part of[b.carrierBody,b.tappetBody,b.tappetHingeHub])a.check(d.workingParts.pin,part,'tappet hinge',true);
  for(const part of[b.holdingClickBody,b.holdingClickBearing])a.check(shaftMesh(b.holdingClickShaft),part,'holding pivot',true);
  a.check(shaftMesh(b.ratchetShaft),b.ratchet.userData.hub,'wheel hub',true);
 }console.log(a.report());
});
test('235 keeps stable rendered buffers, clear display settings and the six-tooth architecture',()=>{
 const m=create({id:235}),d=m.root.userData;const meshes=[];m.root.traverse(o=>{if(o.isMesh)meshes.push(o);});const buffers=meshes.map(o=>o.geometry.attributes.position.array);for(let i=0;i<=32;i++)m.update(i/32*4);
 meshes.forEach((o,i)=>{assert.equal(o.geometry.attributes.position.array,buffers[i]);assert.ok(o.castShadow);for(const mat of[].concat(o.material))assert.equal(mat.fog,false);});assert.equal(d.geometry.toothCount,6);assert.equal(d.hideGround,true);assert.ok(d.minimumDisplayCycleSeconds>=6);assert.ok(m.cameraDirection.z>15);
});
