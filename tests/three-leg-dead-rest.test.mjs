import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredThreeLeggedEscapementMovement as create} from '../src/simulation/authored-three-legged-escapements.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';

// Finite-solid checks of the 306/307 contact-selected wheel laws: every event
// comes from the rendered faces, so the rendered solids must touch at the
// working point and clear everywhere else.
const m306=create({id:306}),m307=create({id:307});
const cache=new Map();
function data(o){if(!cache.has(o.geometry))cache.set(o.geometry,{solid:solidSurface(o.geometry),points:surfacePoints(o.geometry),triangles:surfaceTriangles(o.geometry)});return cache.get(o.geometry);}
function clearance(a,c){let min=Infinity;for(const[x,y]of[[a,c],[c,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),field=data(y).solid;for(const p of data(x).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.005)continue;min=Math.min(min,field.signedDistance(q,.2));}}return min;}
function closest(mesh,world){const p=mesh.worldToLocal(world.clone());let result={distance:Infinity};for(const tri of data(mesh).triangles){const q=tri.closestPointToPoint(p,new T.Vector3()),distance=q.distanceTo(p);if(distance<result.distance)result={distance,point:q,normal:tri.getNormal(new T.Vector3())};}result.point=mesh.localToWorld(result.point);result.normal.transformDirection(mesh.matrixWorld);return result;}
const at=(m,t)=>{m.update(t);m.root.updateMatrixWorld(true);};

test('306 bent legs clear the stepped opening at every phase and touch only their working faces',()=>{
 const d=m306.root.userData,b=d.blocks;let worst=Infinity,maxGap=0,count=0;
 for(let i=0;i<=256;i++){const t=4*i/256;at(m306,t);
  for(const leg of b.legMeshes){const gap=clearance(leg,b.plate);worst=Math.min(worst,gap);assert.ok(gap>-2e-6,`t=${t} leg ${leg.userData.index}: ${gap}`);}
  const s=d.stateAtTime(t);if(!s.contactPoint)continue;
  const hit=closest(b.plate,new T.Vector3(s.contactPoint.x,s.contactPoint.y,b.plate.getWorldPosition(new T.Vector3()).z));
  assert.ok(hit.distance<2e-5,`t=${t} ${s.activeFace} working tip is on the rendered face (${hit.distance})`);maxGap=Math.max(maxGap,hit.distance);count++;
 }
 assert.ok(count>200);console.log({phases:257,minimumLegPlateGap:worst,maximumWorkingTipGap:maxGap});
});

test('306 negative control: turning a resting wheel 1.5 degrees further drives its tip into the rest step',()=>{
 const d=m306.root.userData,b=d.blocks,t=1;assert.equal(d.stateAtTime(t).contactKind,'half-dead-rest');
 at(m306,t);b.wheelRotor.rotation.z-=T.MathUtils.degToRad(1.5);m306.root.updateMatrixWorld(true);
 const gap=Math.min(...b.legMeshes.map(leg=>clearance(leg,b.plate)));assert.ok(gap<-.005,`control penetration ${gap}`);
});

test('306 half-dead rests recoil slightly and the rest reaction resists the clockwise wheel',()=>{
 const d=m306.root.userData,b=d.blocks,g=d.geometry;let maxRecoil=0,count=0;
 for(let i=0;i<=128;i++){const t=4*i/128,s=d.stateAtTime(t);if(s.contactKind!=='half-dead-rest')continue;at(m306,t);
  maxRecoil=Math.max(maxRecoil,Math.abs(s.recoil));
  const hit=closest(b.plate,new T.Vector3(s.contactPoint.x,s.contactPoint.y,b.plate.getWorldPosition(new T.Vector3()).z));
  const force=hit.normal.clone(),arm=hit.point.clone().sub(new T.Vector3(g.wheelCenter.x,g.wheelCenter.y,hit.point.z));
  assert.ok(arm.x*force.y-arm.y*force.x>.5,'rest normal opposes clockwise wheel torque');count++;
 }
 assert.ok(count>40);assert.ok(maxRecoil>T.MathUtils.degToRad(.2)&&maxRecoil<T.MathUtils.degToRad(3),`half-dead recoil ${maxRecoil}`);
 console.log({restSamples:count,maximumRecoilDegrees:T.MathUtils.radToDeg(maxRecoil)});
});

test('307 long teeth, pins, stops, pallets and plate clear each other at every phase; working points touch',()=>{
 const d=m307.root.userData,b=d.blocks;let worst=Infinity,maxGap=0,count=0;
 const fixed=[b.stopD,b.stopE,b.palletA,b.palletB,b.plate];
 for(let i=0;i<=256;i++){const t=4*i/256;at(m307,t);
  for(const moving of[...b.longToothMeshes,...b.impulsePins,b.wheelHub])for(const part of fixed){const gap=clearance(moving,part);worst=Math.min(worst,gap);assert.ok(gap>-2e-6,`t=${t} ${moving.userData.role}/${part.userData.role}: ${gap}`);}
  const s=d.stateAtTime(t);if(!s.contactPoint)continue;
  const part={A:b.palletA,B:b.palletB,D:b.stopD,E:b.stopE}[s.activeSide],z=s.activeSystem==='outer-lock'?d.geometry.lockPlaneZ:0;
  const hit=closest(part,new T.Vector3(s.contactPoint.x,s.contactPoint.y,z));
  assert.ok(hit.distance<2e-5,`t=${t} ${s.activeFace} working point on the rendered face (${hit.distance})`);maxGap=Math.max(maxGap,hit.distance);count++;
 }
 assert.ok(count>200);console.log({phases:257,minimumSolidGap:worst,maximumWorkingGap:maxGap});
});

test('307 D and E hold the wheel dead: stationary wheel, constant pivot radius, reaction through the pivot',()=>{
 const d=m307.root.userData,b=d.blocks,g=d.geometry;let count=0,maxPendulumMoment=0;
 for(let i=0;i<=128;i++){const t=4*i/128,s=d.stateAtTime(t);if(s.contactKind!=='dead-lock')continue;at(m307,t);
  assert.ok(Math.abs(s.wheelAngularSpeed)<1e-9,'no recoil while locked');
  const radius=s.activeSide==='D'?g.deadStopRadius:g.deadStopRadiusE;assert.ok(Math.abs(s.activePoint.distanceTo(g.palletPivot)-radius)<1e-12);
  const stop=s.activeSide==='D'?b.stopD:b.stopE,hit=closest(stop,new T.Vector3(s.contactPoint.x,s.contactPoint.y,g.lockPlaneZ)),force=hit.normal.clone();
  const arm=hit.point.clone().sub(new T.Vector3(g.wheelCenter.x,g.wheelCenter.y,hit.point.z));assert.ok(arm.x*force.y-arm.y*force.x>1,'stop normal opposes clockwise wheel torque');
  const pArm=hit.point.clone().sub(new T.Vector3(g.palletPivot.x,g.palletPivot.y,hit.point.z)),pm=Math.abs(pArm.x*force.y-pArm.y*force.x);maxPendulumMoment=Math.max(maxPendulumMoment,pm);assert.ok(pm<.02,`near-zero pendulum moment ${pm}`);count++;
 }
 assert.ok(count>40);console.log({lockSamples:count,maximumPendulumMoment:maxPendulumMoment});
});

test('307 negative control: advancing a locked wheel one degree drives the tooth into its stop',()=>{
 const d=m307.root.userData,b=d.blocks;assert.equal(d.stateAtTime(0).contactKind,'dead-lock');
 at(m307,0);b.wheelRotor.rotation.z-=T.MathUtils.degToRad(1);m307.root.updateMatrixWorld(true);
 const gap=Math.min(...b.longToothMeshes.map(tooth=>clearance(tooth,b.stopD)));assert.ok(gap<-.005,`control penetration ${gap}`);
});

test('306/307 motion is continuous, buffers are fixed and parts keep shadows without fog',()=>{
 for(const m of[m306,m307]){const d=m.root.userData,origin=d.lawTimeOrigin??0;
  const times=d.beatEvents.flatMap((e,parity)=>[e.impulseEnd,e.landing,e.restRelease,e.contact,0].map(x=>x+parity*d.geometry.halfBeatDuration-origin));
  for(const t of times){const a=d.stateAtTime(t-1e-9),c=d.stateAtTime(t+1e-9);assert.ok(Math.abs(a.wheelAngle-c.wheelAngle)<1e-6,`wheel continuous at ${t}`);assert.ok(Math.abs(a.palletAngle-c.palletAngle)<1e-6);}
  for(let k=-2;k<=6;k++){const a=d.stateAtTime(k*2),c=d.stateAtTime(k*2+2);assert.ok(Math.abs(c.wheelAngle-a.wheelAngle+Math.PI/3)<1e-12,'sixty clockwise degrees per beat');}
  const before=[];m.root.traverse(o=>before.push([o,o.geometry,o.geometry?.attributes.position.array]));
  for(let i=0;i<=32;i++)at(m,i/8);const after=[];m.root.traverse(o=>after.push([o,o.geometry,o.geometry?.attributes.position.array]));assert.deepEqual(before,after);
  assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,6);assert.ok(m.cameraDirection.z>10);
  m.root.traverse(o=>{if(o.isMesh&&o.visible&&!/contact/.test(o.userData.role??'')){assert.equal(o.material.fog,false);}});
 }
 assert.match(m306.root.userData.reconstructionNote,/finite faces/);assert.match(m307.root.userData.reconstructionNote,/finite faces/);
});
