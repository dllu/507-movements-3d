import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

function audit(model,pairs,steps=64) {
  const objects=new Map();
  for(const pair of pairs)for(const object of pair)if(!objects.has(object))objects.set(object,{points:surfacePoints(object.geometry),field:solidSurface(object.geometry)});
  const rows=pairs.map(([a,b])=>({a,b,min:Infinity,maxNear:0,worst:null}));
  const d=model.root.userData;
  for(let i=0;i<=steps;i++) {
    const time=d.transmission.cyclePeriod*i/steps;model.update(time);model.root.updateMatrixWorld(true);
    for(const row of rows) {
      let nearest=Infinity;
      for(const [a,b]of [[row.a,row.b],[row.b,row.a]]) {
        const tr=b.matrixWorld.clone().invert().multiply(a.matrixWorld),field=objects.get(b).field;
        for(const point of objects.get(a).points) {
          const q=point.clone().applyMatrix4(tr);
          if(field.box.distanceToPoint(q)>.08)continue;
          nearest=Math.min(nearest,field.signedDistance(q));
        }
      }
      if(nearest<row.min){row.min=nearest;row.worst={phase:i/steps,branch:d.stateAtTime(time).branch};}
      if(Number.isFinite(nearest))row.maxNear=Math.max(row.maxNear,nearest);
    }
  }
  return rows;
}
for(const id of [192,193,194]) {
 const model=createAuthoredGearMovement({id}),d=model.root.userData,b=d.blocks;
 test(`${id} actual finite blind guide captures its collar and retains the connected floor`,t=>{
   const rows=audit(model,[[b.guideFollower,b.guideGrooveOuter],[b.guideFollower,b.guideGrooveRecess],[b.guideFollower,b.wheelBody]],32);
   for(const row of rows)assert.ok(row.min>.0018,`${id} guide gap ${row.min}`);
   for(const row of rows.slice(0,2))assert.ok(row.maxNear<.0023,`${id} close working wall ${row.maxNear}`);
   assert.ok(rows[2].min>.0299 && rows[2].min<.0301,'collar engages channel depth but clears floor');
   t.diagnostic(JSON.stringify(rows.map(r=>({min:r.min,max:r.maxNear,worst:r.worst}))));
   assert.ok(d.geometry.guidePerimeter>0);
 });
 test(`${id} pinion, journal and front-side input clear the wheel face and guide floor`,t=>{
   const gear=b.pinion.userData.rotor.children[0],hub=b.pinion.userData.rotor.children[1],shaft=b.pinionShaft.userData.rotor.children[0];
   const pairs=[[shaft,b.guideFollower],[shaft,b.wheelBody],[gear,b.guideGrooveOuter],[gear,b.guideGrooveRecess],[hub,b.guideGrooveOuter],[hub,b.guideGrooveRecess]];
   if(b.pitchGroove)pairs.push([gear,b.pitchGroove]);
   const rows=audit(model,pairs,32);
   for(const row of rows)assert.ok(row.min>0,`${id} interface ${row.a.userData.role}/${row.b.userData.role}: ${row.min}`);
   assert.ok(rows[0].min>.0008 && rows[0].min<.0012,'running journal remains supported');
   assert.ok(rows[1].min>.0599);
   assert.ok(b.fixedUniversalCross.position.z>1 && b.rearInputShaft.position.z>1.5);
   t.diagnostic(JSON.stringify(rows.map(r=>({min:r.min,max:r.maxNear}))));
 });
 if(id!==194)test(`${id} generated complementary tooth cavity clears and remains engaged through both finite reversals`,t=>{
   const gear=b.pinion.userData.rotor.children[0];
   const [row]=audit(model,[[gear,b.toothLand]],64);
   t.diagnostic(JSON.stringify({min:row.min,max:row.maxNear,worst:row.worst}));
   assert.ok(row.min>0,`finite tooth penetration ${row.min}`);
   assert.ok(row.maxNear<.003,`finite tooth working gap ${row.maxNear}`);
   assert.equal(b.mangleToothObjects.length,0,'obsolete box teeth are replaced, not overlaid');
 });
 // 194's finite pin-profile regression lives in radial-pin-mangle-contact.test.mjs.
 test(`${id} retains source motion, geometry identities, readable period and swept framing`,()=>{
   const before=[];model.root.traverse(o=>before.push([o,o.geometry]));
   const point=new THREE.Vector3();
   for(let i=0;i<=64;i++){
     const time=d.transmission.cyclePeriod*i/64;d.stateAtTime(time);model.update(time);model.root.updateMatrixWorld(true);
     model.root.traverseVisible(object=>{
       // The jointed pinion drive and its frame stand outside the framed wheel.
       const positions=object.geometry?.attributes.position;if(!positions||object.userData.runsPastCrop)return;
       for(let j=0;j<positions.count;j++)assert.ok(d.cameraFitBounds.containsPoint(point.fromBufferAttribute(positions,j).applyMatrix4(object.matrixWorld)), 'actual visible swept vertex stays framed');
     });
   }
   // 192's disc is widened to 270 source px so the working pinion stays on its face.
   const halfWidth=id===192?2.3:2.1;
   assert.ok(d.cameraFitBounds.max.x<halfWidth && d.cameraFitBounds.min.x> -halfWidth,'avoid inflated rotated wheel boxes');
   const after=[];model.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
   assert.equal(d.minimumDisplayCycleSeconds,d.transmission.cyclePeriod);
   assert.equal(d.sourceAnimation.officialCanvasModelPresent,false);
   assert.equal(d.hideGround,true);model.root.traverse(o=>{for(const material of [].concat(o.material??[]))assert.equal(material.fog,false);if(o.isMesh)assert.equal(o.castShadow,true);});
 });
}
