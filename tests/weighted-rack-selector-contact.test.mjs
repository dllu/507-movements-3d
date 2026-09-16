import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredAlternatingWeightedRackMovement as create} from '../src/simulation/authored-alternating-weighted-racks.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const m=create({id:391}),d=m.root.userData,b=d.blocks,cache=new Map();
function data(o){if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),solid:solidSurface(o.geometry)});return cache.get(o);}
function clearance(a,c){let min=Infinity;for(const[x,y]of[[a,c],[c,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),field=data(y).solid;for(const p of data(x).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.003)continue;min=Math.min(min,field.signedDistance(q,.04));}}return min;}
const triangles=surfaceTriangles(b.elbowCam.geometry);
function meshContact(){const world=b.elbowRoller.getWorldPosition(new T.Vector3()),p=b.elbowCam.worldToLocal(world.clone());let distance=Infinity,closest;for(const tri of triangles){const q=tri.closestPointToPoint(p,new T.Vector3()),value=q.distanceTo(p);if(value<distance){distance=value;closest=q;}}
 return{gap:distance-d.selectorContactReview.rollerRadius,force:p.clone().sub(closest).normalize().transformDirection(b.elbowCam.matrixWorld),world};}

test('391 actual selector, lug, guide pin, bored bearings and stop remain separated over a full cycle',()=>{
 const pairs=[[b.elbowCam,b.elbowRoller],[b.elbowCam,b.rightRack.userData.guidePin],[b.elbowCam,b.elbowLug],[b.elbowCam,b.rightRack.userData.body],[b.elbowCam,b.elbowRestStop],[b.elbowCam,b.elbowLever.children[1]],[b.elbowRoller,b.elbowRollerAxle],[b.elbowLug,b.elbowRollerAxle],[b.elbowLug,b.elbowRoller],[b.elbowSpringStud,b.elbowRoller],[b.elbowRestStop,b.elbowRoller],[b.elbowBracket,b.elbowRestStop],[b.elbowBracket,b.elbowLever.children[1]],[b.elbowBracket,b.springAnchorBoss]];
 for(let i=0;i<=256;i++){m.update(i/32);m.root.updateMatrixWorld(true);for(const[a,c]of pairs)assert.ok(clearance(a,c)>-2e-6,`${i}: ${a.userData.role}/${c.userData.role}`);}
});
test('391 actual working face exerts outward rack torque and balances positive spring tension during assist',()=>{
 let count=0,maxGap=0,minRackTorque=Infinity,maxRackTorque=-Infinity;
 for(let i=0;i<=128;i++){const time=3.36+.64*i/128,state=d.stateAtTime(time);if(!state.elbowAssist.active)continue;m.update(time);m.root.updateMatrixWorld(true);const hit=meshContact(),arm=hit.world.clone().sub(new T.Vector3(state.rightRack.pivot.x,state.rightRack.pivot.y,hit.world.z)),torque=arm.x*hit.force.y-arm.y*hit.force.x;
  assert.ok(hit.gap>=-2e-6&&hit.gap<.00003,`finite contact gap ${hit.gap}`);assert.ok(torque<-2.8,`outward clockwise rack torque ${torque}`);
  const ca=Math.cos(state.elbowAssist.leverAngle),sa=Math.sin(state.elbowAssist.leverAngle),attachment=new T.Vector3(-.02*ca+.62*sa,-.02*sa-.62*ca,0),springDirection=b.springAnchorBoss.position.clone().sub(b.elbowLever.position).sub(attachment).normalize(),springTorque=attachment.x*springDirection.y-attachment.y*springDirection.x;
  const pivotArm=hit.world.clone().sub(b.elbowLever.position),camReaction=-(pivotArm.x*hit.force.y-pivotArm.y*hit.force.x);
  assert.ok(springTorque>0&&camReaction<0,'positive spring tension requires a compressive contact reaction');
  assert.ok(state.rightRack.angularSpeed<1e-9,'source spring assists outward selection');
  count++;maxGap=Math.max(maxGap,hit.gap);minRackTorque=Math.min(minRackTorque,torque);maxRackTorque=Math.max(maxRackTorque,torque);
 }
 assert.ok(count>40&&count<65,'assist is a proper subset of the upper crossover');
 console.log({selectorAssistSamples:count,maxGap,minRackTorque,maxRackTorque});
});
test('391 rounded approach loads the spring before outward assist, then the real stop accepts the lever',()=>{
 const loading=d.stateAtTime(2.8),assist=d.stateAtTime(3.5),released=d.stateAtTime(3.8);
 assert.ok(loading.elbowAssist.loading&&!loading.elbowAssist.active&&loading.rightRack.engaged);
 assert.ok(assist.elbowAssist.active&&!assist.elbowAssist.loading);
 assert.ok(!released.elbowAssist.contact&&released.elbowAssist.gap>.2);
 assert.equal(released.elbowAssist.leverAngle,d.selectorContactReview.restAngle);
 m.update(0);m.root.updateMatrixWorld(true);
 const stop=b.elbowCam.worldToLocal(b.elbowRestStop.getWorldPosition(new T.Vector3()));stop.z=.30; // Sample the long pin at the cam's working depth.
 let nearest=Infinity;for(const tri of triangles)nearest=Math.min(nearest,tri.closestPointToPoint(stop,new T.Vector3()).distanceTo(stop));
 assert.ok(Math.abs(nearest-.065)<.00003,'finite stop actually touches the stem');
});
test('391 selector contact entry and release are continuous and playback retains buffers',()=>{
 let prior=d.stateAtTime(0),maximumStep=0;for(let i=1;i<=8192;i++){const next=d.stateAtTime(i/1024);maximumStep=Math.max(maximumStep,Math.abs(next.elbowAssist.leverAngle-prior.elbowAssist.leverAngle));assert.ok(next.elbowAssist.gap>-1e-8);prior=next;}
 assert.ok(maximumStep<.0024,`no branch jump: ${maximumStep}`);
 for(const [a,c]of[[2,2.8],[3.5,3.8]]){let lo=a,hi=c;const first=d.stateAtTime(lo).elbowAssist.contact;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(d.stateAtTime(mid).elbowAssist.contact===first)lo=mid;else hi=mid;}assert.ok(Math.abs(d.stateAtTime(hi+1e-7).elbowAssist.leverAngle-d.stateAtTime(lo-1e-7).elbowAssist.leverAngle)<1e-6);}
 const before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<=256;i++)m.update(i/32);const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
 assert.match(d.selectorContactReview.qualification,/passive branch dynamics remain prescribed/);
});
