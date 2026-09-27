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
test('240 flat stops lie in the wheel plane and their own toes clear it and seat on retaining faces',()=>{
 const m=create({id:240}),d=m.root.userData,b=d.blocks,p=d.workingParts,a=audit();let maximumSeatedGap=0;
 const bodies=[b.hookGravityStopBody,b.straightGravityStopBody,b.springPawlStopBody];
 // No cross-pins: each toe is the rounded end of its flat plate.
 for(const nose of p.noses)assert.equal(nose.isMesh,undefined);
 const poses=[...Array.from({length:129},(_,i)=>i/128),...p.stops.flatMap((s,i)=>[(i+.24)/3,(i+.78)/3])];
 for(const q of poses){m.update((q-d.geometry.initialCycleCoordinate)*6);m.root.updateMatrixWorld(true);const s=d.kinematics,wheelBox=new THREE.Box3().setFromObject(b.wheelBody);
  for(let i=0;i<3;i++){const body=bodies[i],box=new THREE.Box3().setFromObject(body);assert.ok(box.min.z>wheelBox.min.z&&box.max.z<wheelBox.max.z,'stop inside the tooth band');
   const gap=a.check(body,b.wheelBody,'stop/wheel');a.check(b.wheelBody,body,'wheel/stop');
   if(s.pawls[i].engaged&&s.wheelDwelling){maximumSeatedGap=Math.max(maximumSeatedGap,gap);assert.ok(gap<.0015);}
   for(let j=0;j<3;j++)if(i!==j)a.check(body,bodies[j],'stop/stop');
  }
 }console.log({maximumSeatedGap,...a.report()});
});
test('240 each actual retaining face resists reverse rotation but needs closing preload',()=>{
 const m=create({id:240}),d=m.root.userData,b=d.blocks;let maximum=-Infinity;
 for(let i=0;i<3;i++){m.update(((i+.24)/3-d.geometry.initialCycleCoordinate)*6);m.root.updateMatrixWorld(true);const c=d.kinematics.pawls[i].finiteContact;
  const world=new THREE.Vector3(c.point.x,c.point.y,b.wheel.position.z),local=world.clone().applyMatrix4(b.wheelBody.matrixWorld.clone().invert()),point=new THREE.Vector3();let best=Infinity,normal;
  for(const t of surfaceTriangles(b.wheelBody.geometry)){const gap=t.closestPointToPoint(local,point).distanceTo(local);if(gap<best){best=gap;normal=t.getNormal(new THREE.Vector3());}}
  normal.transformDirection(b.wheelBody.matrixWorld);const moment=-world.x*normal.y+world.y*normal.x;assert.ok(best<1e-6);assert.ok(moment>1.4,`moment ${moment}`); // the steep faces meet a clockwise turn;  // Brown's 1.9-radius wheelassert.ok(c.openingMoment>0);maximum=Math.max(maximum,-moment);
 }assert.equal(d.dynamics.selfLocking,false);assert.equal(d.dynamics.forceValidated,false);console.log({leastRetainingMoment:maximum});
});
test('240 selection, free-run and drop stay continuous and clear across all three alternatives',()=>{
 const m=create({id:240}),d=m.root.userData;let previous,maxStep=0,minimum=Infinity;
 for(let i=0;i<=8192;i++){const s=d.stateAtCycleCoordinate(i/8192);for(let k=0;k<3;k++){const p=s.pawls[k];minimum=Math.min(minimum,p.finiteContact.normalClearance);assert.ok(p.finiteContact.normalClearance>.0003);
  if(previous){const step=Math.abs(p.angleDelta-previous.pawls[k].angleDelta);maxStep=Math.max(maxStep,step);assert.ok(step<.0075);}
 }previous=s;}console.log({minimumWorkingCircleGap:minimum,maxAngularStep:maxStep});
});
test('240 finite pivot and hub bores clear their actual shafts',()=>{
 const m=create({id:240}),d=m.root.userData,b=d.blocks,p=d.workingParts,a=audit(),shafts=[b.hookGravityStopPivot,b.straightGravityStopPivot,b.springPawlStopPivot],bodies=[b.hookGravityStopBody,b.straightGravityStopBody,b.springPawlStopBody];
 for(let i=0;i<=16;i++){m.update((i/16-d.geometry.initialCycleCoordinate)*6);m.root.updateMatrixWorld(true);shafts.forEach((s,j)=>{a.check(shaftMesh(s),p.collars[j],'stop collar',true);a.check(shaftMesh(s),bodies[j],'stop pivot',true);});a.check(shaftMesh(b.wheelShaft),b.wheel.userData.hub,'wheel hub',true);}
 console.log(a.report());
});
test('240 keeps stable scene buffers and source comparison display settings',()=>{
 const m=create({id:240}),d=m.root.userData,meshes=[];m.root.traverse(o=>{if(o.isMesh)meshes.push(o);});const buffers=meshes.map(o=>o.geometry.attributes.position.array);for(let i=0;i<=32;i++)m.update(i/32*6);
 meshes.forEach((o,i)=>{assert.equal(o.geometry.attributes.position.array,buffers[i]);assert.ok(o.castShadow);for(const mat of[].concat(o.material))assert.equal(mat.fog,false);});assert.equal(d.hideGround,true);assert.ok(m.cameraDirection.z>15);assert.ok(d.minimumDisplayCycleSeconds>=12);assert.equal(d.transmission.sourceIsComparisonPlate,true);
});
