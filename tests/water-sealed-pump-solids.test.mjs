import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredWaterSealedAirPumpMovement} from '../src/simulation/authored-water-sealed-air-pumps.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const create=()=>createAuthoredWaterSealedAirPumpMovement({id:473});
test('473 crossed levers, finite bores, bell and water clear their working neighbors',()=>{
 const m=create(),d=m.root.userData,b=d.blocks,pairs=[];
 for(const lever of[b.leftLever,b.rightLever])for(const fixed of [...b.leverPivots,...b.fixedFrame.children])pairs.push([lever,fixed]);
 for(const pin of b.leverPivots)pairs.push([pin,b.crosshead]);
 for(const bell of [b.bellShell,b.bellRim,b.bellRoof])for(const fixed of[b.tubShell,b.tubBottom,b.inletPipe,b.lowerInletValveSeat,b.lowerInletValveDisk])pairs.push([bell,fixed]);
 for(const water of[b.outerWater,b.innerWater,b.underRimWater])for(const wall of[b.bellShell,b.bellRoof,b.bellRim,b.tubShell,b.tubBottom,b.inletPipe])pairs.push([water,wall]);
 pairs.push([b.upperOutletPipe,b.bellRoof],[b.inletPipe,b.foundation],[b.inletPipe,b.tubBottom],[b.lowerInletValveDisk,b.lowerInletValveSeat],[b.upperOutletValveDisk,b.upperOutletValveSeat]);
 const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),surface:solidSurface(o.geometry)});return cache.get(o);};
 const bad={};
 try{for(let i=0;i<=32;i++){
  const t=d.geometry.cycleDuration*i/32;m.update(t);m.root.updateMatrixWorld(true);const s=d.stateAtTime(t);
  assert.ok(s.leftInnerEnd.x>0&&s.rightInnerEnd.x<0,'lever inner ends cross the center');
  assert.ok(s.leftBellLug.x<0&&s.rightBellLug.x>0,'suspension ropes cross back to opposite lugs');
  for(const[a,c]of pairs){const tr=c.matrixWorld.clone().invert().multiply(a.matrixWorld),surface=get(c).surface;for(const p of get(a).points){const q=p.clone().applyMatrix4(tr);if(surface.box.distanceToPoint(q)>.0001)continue;const gap=surface.signedDistance(q,.03);if(gap< -2e-6){const key=`${a.userData.role||a.id}/${c.userData.role||c.id}`;bad[key]=Math.min(bad[key]??0,gap);}}}
 }assert.deepEqual(bad,{});}finally{disposeObject3D(m.root);}
});
test('473 finite check lift stays continuous through pressure events and reversals',()=>{
 const m=create(),d=m.root.userData;try{
 let previous=d.valveLiftAtPhase(0),maxJump=0,lowerMax=0,upperMax=0;
 for(let i=1;i<=10000;i++){const lift=d.valveLiftAtPhase(i/10000),s=d.gasStateAtPhase(i/10000);for(const key of['lower','upper']){assert.ok(lift[key]>=0&&lift[key]<=1);maxJump=Math.max(maxJump,Math.abs(lift[key]-previous[key]));}
 if(lift.lower>1e-9)assert.equal(s.lowerInletValveOpen,true);if(lift.upper>1e-9)assert.equal(s.upperOutletValveOpen,true);
 lowerMax=Math.max(lowerMax,lift.lower);upperMax=Math.max(upperMax,lift.upper);previous=lift;
 }assert.ok(maxJump<.008);assert.equal(lowerMax,1);assert.equal(upperMax,1);assert.deepEqual(d.valveLiftAtPhase(0),d.valveLiftAtPhase(1));
 }finally{disposeObject3D(m.root);}
});
test('473 playback keeps geometry buffers and readable cycle timing',()=>{
 const m=create(),d=m.root.userData,storage=[];try{
 m.root.traverse(o=>{if(o.geometry)storage.push([o,o.geometry,o.geometry.attributes.position.array]);});
 for(let i=0;i<100;i++)m.update(i*.113);
 for(const[o,g,a]of storage){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}
 assert.equal(d.minimumDisplayCycleSeconds,4);assert.equal(d.hideGround,true);
 }finally{disposeObject3D(m.root);}
});
