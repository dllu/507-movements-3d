import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {createAuthoredBilgeEjectorMovement as a}from'../src/simulation/authored-bilge-ejectors.js';
import {createAuthoredSteamSiphonPumpMovement as b}from'../src/simulation/authored-steam-siphon-pumps.js';
import {createAuthoredDiaphragmSteamTrapMovement as c}from'../src/simulation/authored-diaphragm-steam-traps.js';
import {createAuthoredExpansionSteamTrapMovement as e}from'../src/simulation/authored-expansion-steam-traps.js';
import {solidSurface,surfacePoints}from'./helpers/solid-surface.mjs';
for(const[id,create]of[[475,a],[476,b],[477,c],[478,e]])test(`${id} selected passage, valve and neighboring solid surfaces remain clear`,()=>{
const m=create({id}),d=m.root.userData,b=d.blocks,pairs=[];
if(id===475){for(const o of[b.steamPipeCore,b.steamJet,...b.waterStreams])for(const f of[b.chamber,b.suctionPipe,b.dischargePipe,b.nozzle,b.steamPipe])pairs.push([o,f]);}
if(id===476){assert.equal(solidSurface(b.suctionBranches[0].geometry).inside(new T.Vector3(1.62,.13,0)),true,'rear steam entry preserves the right branch side rail');for(const o of[b.steamCore,b.steamJet,...b.waterStreams])for(const f of[b.suctionBranches[0],b.forkBack,b.steamPipe])pairs.push([o,f]);}
if(id===477){for(const o of[b.valveStem,b.diaphragmRim,b.flexibleDiaphragm])for(const f of[b.annularSeat,b.bridgeCap,b.bridgeCrossbar,...b.bridgeLegs,b.inletPipeA,b.rearWall,...b.caseWalls])pairs.push([o,f]);for(const o of[b.workingFluidColumn,b.workingFluidReservoir])pairs.push([o,b.valveStem],[o,b.flexibleDiaphragm]);for(const o of b.condensateMarkers)for(const f of[b.annularSeat,b.inletPipeA,b.outletPipeB,b.valveStem,...b.caseWalls])pairs.push([o,f]);}
if(id===478){for(const o of[b.pipeShell,b.pipeFreeEndRim,b.valveFace,b.plungerRod,b.plungerContactPad])for(const f of[b.hollowSphereC,b.stuffingBody,b.leverStand,b.leverPivotPin])pairs.push([o,f]);pairs.push([b.plungerContactPad,b.plungerContactRoller],[b.plungerRod,b.plungerContactRoller],[b.stopTip,b.stopContactFace],[b.stopScrewB,b.stopContactFace],[b.screwThreadsB,b.stopContactFace],[b.pipeShell,b.valveFace],[b.pipeFreeEndRim,b.valveFace]);for(const o of[b.pipeWaterCore,b.outletWaterCore])pairs.push([o,b.hollowSphereC],[o,b.pipeShell]);for(const o of b.leverD.children)if(o.userData.role?.includes('arm'))pairs.push([o,b.leverPivotPin]);}
const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{o,p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});return cache.get(o);};let bad={};
const count=id<477?1:64;
for(let i=0;i<=count;i++){m.update(d.geometry.cycleDuration*i/count);m.root.updateMatrixWorld(true);for(const [aa,cc]of pairs){const a=get(aa),c=get(cc);if(a.o.scale.x===0||c.o.scale.x===0)continue;if(!new T.Box3().setFromObject(a.o).intersectsBox(new T.Box3().setFromObject(c.o)))continue;for(const [v,f]of[[a,c],[c,a]]){const tr=f.o.matrixWorld.clone().invert().multiply(v.o.matrixWorld);for(const p of v.p){const q=p.clone().applyMatrix4(tr);if(f.s.box.distanceToPoint(q)>.001)continue;const gap=f.s.signedDistance(q,.02),key=`${v.o.userData.role||v.o.id} / ${f.o.userData.role||f.o.id}`;if(gap<-.000002&&gap<(bad[key]?.gap||0))bad[key]={i,gap,p:q.toArray()};}}}}
disposeObject3D(m.root);assert.deepEqual(bad,{});});

for(const[id,create]of[[475,a],[476,b],[477,c],[478,e]])test(`${id} readable playback retains scene and GPU geometry identities`,()=>{
 const m=create({id}),d=m.root.userData;
 try{const snapshot=()=>{const out=[];m.root.traverse(o=>out.push([o,o.geometry]));return out;},before=snapshot();
  for(let i=0;i<129;i++)m.update(i*d.geometry.cycleDuration/128);assert.deepEqual(snapshot(),before);
  assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,d.geometry.cycleDuration);
  assert.match(d.workingPartsReview.residual,/prescribed/);
 }finally{disposeObject3D(m.root);}
});

test('477 finite hollow valve seats on the actual conical annulus and opens on cooling',()=>{
 const m=c({id:477}),d=m.root.userData,b=d.blocks;
 try{
  const valve=solidSurface(b.valveStem.geometry),seat=solidSurface(b.annularSeat.geometry),point=new T.Vector3(.60,1.35,0);
  assert.equal(seat.inside(new T.Vector3(.3,1.35,0)),false,'open central bore');
  assert.equal(seat.inside(new T.Vector3(.8,1.35,0)),true,'finite seat material with outward winding');
  const gap=t=>{m.update(t);m.root.updateMatrixWorld(true);return valve.signedDistance(b.valveStem.worldToLocal(point.clone()),1);};
  assert.ok(gap(0)>.10);assert.ok(Math.abs(gap(d.geometry.cycleDuration/2))<1e-6);assert.ok(gap(d.geometry.cycleDuration)>.10);
  assert.equal(valve.inside(new T.Vector3(0,2,0)),false,'valve contains the working liquid in a real hollow');
  assert.equal(valve.inside(new T.Vector3(.36,2,0)),true,'finite valve stem wall');
 }finally{disposeObject3D(m.root);}
});

test('478 stuffing bore passes the rod and the expanding pipe meets the finite valve face',()=>{
 const m=e({id:478}),d=m.root.userData,b=d.blocks;
 try{
  m.update(0);m.root.updateMatrixWorld(true);const post=new T.Box3().setFromObject(b.stopPost),base=new T.Box3().setFromObject(b.baseRight);assert.ok(Math.abs(post.min.y-base.max.y)<1e-6,'fixed stop post reaches the base');
  const stuffing=solidSurface(b.stuffingBody.geometry);assert.equal(stuffing.inside(new T.Vector3(0,0,0)),false);assert.equal(stuffing.inside(new T.Vector3(.20,0,0)),true);
  const face=solidSurface(b.valveFace.geometry),gap=t=>{m.update(t);m.root.updateMatrixWorld(true);const end=d.stateAtTime(t).pipeEndX;return face.signedDistance(b.valveFace.worldToLocal(new T.Vector3(end,d.geometry.pipeAxisY+.23,0)),1);};
  assert.ok(gap(0)>.28);assert.ok(Math.abs(gap(d.geometry.cycleDuration/2))<1e-6);
 }finally{disposeObject3D(m.root);}
});
