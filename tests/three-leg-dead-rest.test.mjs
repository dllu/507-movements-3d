import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredThreeLeggedEscapementMovement as create} from '../src/simulation/authored-three-legged-escapements.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const model=create({id:307}),d=model.root.userData,b=d.blocks,g=d.geometry;
const cache=new Map();
function data(o){if(!cache.has(o.geometry))cache.set(o.geometry,{solid:solidSurface(o.geometry),points:surfacePoints(o.geometry),triangles:surfaceTriangles(o.geometry)});return cache.get(o.geometry);}
function clearance(a,c){let min=Infinity;for(const[x,y]of[[a,c],[c,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),field=data(y).solid;for(const p of data(x).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.005)continue;min=Math.min(min,field.signedDistance(q,.2));}}return min;}
function closest(mesh,world){const p=mesh.worldToLocal(world.clone());let result={distance:Infinity};for(const tri of data(mesh).triangles){const q=tri.closestPointToPoint(p,new T.Vector3()),distance=q.distanceTo(p);if(distance<result.distance)result={distance,point:q,normal:tri.getNormal(new T.Vector3())};}result.point=mesh.localToWorld(result.point);result.normal.transformDirection(mesh.matrixWorld);return result;}
function update(t){model.update(t);model.root.updateMatrixWorld(true);}

test('307 both finite concentric rests clear all three teeth and their real mounting stock',()=>{
 let count=0,worst=Infinity;
 const times=Array.from({length:65},(_,i)=>4*i/64);
 for(const half of[0,1])for(const p of[g.releaseHalfPhase-1e-7,g.landingHalfPhase+1e-7])times.push((half+p)*2);
 for(const t of times){const s=d.stateAtTime(t);if(s.contactKind!=='dead-lock')continue;update(t);
  for(const tooth of b.longToothMeshes)for(const stop of[b.stopD,b.stopE,...b.deadStopMounts]){const gap=clearance(tooth,stop);worst=Math.min(worst,gap);assert.ok(gap>-2e-6,`${t} ${tooth.userData.index}/${stop.userData.role}: ${gap}`);}count++;
 }
 assert.ok(count>45);console.log({restPoses:count,minimumRestSolidGap:worst});
});
test('307 actual rest surfaces support the tooth corner, resist wheel torque and exert negligible pendulum torque',()=>{
 let count=0,maxGap=0,minTorque=Infinity,maxPalletTorque=0;
 for(let i=0;i<129;i++){const t=4*i/128,s=d.stateAtTime(t);if(s.contactKind!=='dead-lock')continue;update(t);
  const side=s.halfPhase<g.releaseHalfPhase?s.startingLockSide:s.landingLockSide,stop=side==='D-left'?b.stopD:b.stopE;
  const tip=new T.Vector3(s.activePoint.x,s.activePoint.y,g.lockPlaneZ),hit=closest(stop,tip),force=hit.normal;
  assert.ok(hit.distance>.00049&&hit.distance<.000502,`actual gap ${hit.distance}`);maxGap=Math.max(maxGap,hit.distance);
  const wheelArm=hit.point.clone().sub(new T.Vector3(g.wheelCenter.x,g.wheelCenter.y,g.lockPlaneZ)),moment=wheelArm.x*force.y-wheelArm.y*force.x;
  assert.ok(moment>1.6,'normal resists clockwise wheel');minTorque=Math.min(minTorque,moment);
  const palletArm=hit.point.clone().sub(new T.Vector3(g.palletPivot.x,g.palletPivot.y,g.lockPlaneZ)),pMoment=palletArm.x*force.y-palletArm.y*force.x;
  assert.ok(Math.abs(pMoment)<.0015,'rest reaction is concentric with pendulum pivot');maxPalletTorque=Math.max(maxPalletTorque,Math.abs(pMoment));
  const tooth=b.longToothMeshes[s.activeIndex],localForce=force.clone().transformDirection(tooth.matrixWorld.clone().invert()),outward=localForce.negate();
  const vertices=tooth.geometry.userData.plate.polygons[0][0],corner=vertices.findIndex(p=>Math.abs(p[0]-g.longToothRadius)<1e-8),p=vertices[corner];
  assert.ok(corner>=0);for(const j of[corner-1,corner+1]){const q=vertices[j];assert.ok((q[0]-p[0])*outward.x+(q[1]-p[1])*outward.y<-.008,'opposed rest normal lies inside actual finite wheel corner normal cone');}count++;
 }
 console.log({restNormalSamples:count,maximumRestGap:maxGap,minimumResistingMoment:minTorque,maximumConcentricMoment:maxPalletTorque});
});
test('307 stop mounts overlap both the actual plate and both actual rest bodies',()=>{
 update(0);
 for(const [i,stop]of[b.stopD,b.stopE].entries()){
  const mount=b.deadStopMounts[i],outline=mount.geometry.userData.plate.polygons[0][0],p=new T.Vector3();
  for(const q of outline)p.add(new T.Vector3(q[0],q[1],0));p.divideScalar(outline.length);
  for(const[z,target]of[[g.palletDepth/2-.006,b.plate],[g.lockPlaneZ-.074,stop]]){p.z=z;const world=mount.localToWorld(p.clone());assert.ok(data(mount).solid.inside(mount.worldToLocal(world.clone())));assert.ok(data(target).solid.inside(target.worldToLocal(world.clone())),'finite attachment stock');}
 }
});
test('306/307 working-law defects remain explicit, with concrete finite witnesses',()=>{
 const m306=create({id:306});m306.update(.92);m306.root.updateMatrixWorld(true);
 const d306=m306.root.userData,b306=d306.blocks;let penetration306=Infinity;
 assert.ok(b306.toothTips.every(marker=>marker.visible===false),'nominal floating tip markers suppressed');
 for(const tooth of b306.legMeshes)penetration306=Math.min(penetration306,clearance(tooth,b306.plate));
 assert.ok(penetration306<-.01,`306 retained collision witness ${penetration306}`);
 update(.89);const stopGap=Math.min(...b.longToothMeshes.flatMap(tooth=>[b.stopD,b.stopE].map(stop=>clearance(tooth,stop))));
 update(.96);const pinGap=Math.min(...b.impulsePins.flatMap(pin=>[b.palletA,b.palletB].map(pallet=>clearance(pin,pallet))));
 assert.ok(stopGap<-.001,'release is explicitly unresolved');assert.ok(pinGap<-.001,'inner impulse is explicitly unresolved');
 assert.match(d.reconstructionNote,/still intersect/);assert.match(d306.reconstructionNote,/still intersect/);
 console.log({remaining306PlateGapAt092:penetration306,remaining307StopGapAt089:stopGap,remaining307PinGapAt096:pinGap});
});
test('307 preserves continuous prescribed motion, fixed buffers, source-facing camera, shadows and fog settings',()=>{
 const before=[];model.root.traverse(o=>before.push([o,o.geometry,o.geometry?.attributes.position.array]));
 for(const half of[0,1])for(const p of[0,g.releaseHalfPhase,g.impulseEndHalfPhase,g.landingHalfPhase,1]){const a=d.stateAtTime(2*(half+p)-1e-8),c=d.stateAtTime(2*(half+p)+1e-8);assert.ok(Math.abs(a.wheelAngle-c.wheelAngle)<1e-6);assert.ok(Math.abs(a.palletAngle-c.palletAngle)<1e-6);}
 for(let i=0;i<=32;i++)update(i/8);const after=[];model.root.traverse(o=>after.push([o,o.geometry,o.geometry?.attributes.position.array]));assert.deepEqual(before,after);
 assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,6);assert.ok(model.cameraDirection.z>10);
 for(const mesh of[b.stopD,b.stopE,...b.deadStopMounts,...b.longToothMeshes]){assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);assert.equal(mesh.material.fog,false);}
});
