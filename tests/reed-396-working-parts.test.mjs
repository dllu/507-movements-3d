import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredReedEscapementMovement as make} from '../src/simulation/authored-reed-escapements.js';
import {reed396ContactBake as bake} from '../src/simulation/baked/reed-396-contact.js';
import {reed396Profiles,reed396Pose,reed396Obstacles,reed396Contact} from '../src/simulation/reed-396-contact.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
function audit(){const cache=new Map();let minimum=Infinity,queries=0;const get=m=>{if(!cache.has(m.geometry))cache.set(m.geometry,{points:surfacePoints(m.geometry),solid:solidSurface(m.geometry)});return cache.get(m.geometry)};const one=(a,b)=>{const mat=b.matrixWorld.clone().invert().multiply(a.matrixWorld);let min=Infinity;for(const p of get(a).points){const gap=get(b).solid.signedDistance(p.clone().applyMatrix4(mat),.15);queries++;min=Math.min(min,gap)}minimum=Math.min(minimum,min);return min};return{both:(a,b)=>Math.min(one(a,b),one(b,a)),one,report:()=>({minimum,queries})};}
test('396 actual pallet solids, necks and bored journals clear at shifted poses and a later tooth cycle',()=>{
 const m=make({id:396}),d=m.root.userData,b=d.blocks,p=d.workingParts396,x=audit(),rim=b.escapeWheel.userData.toothedRim;
 const times=[...Array.from({length:129},(_,i)=>8*(i+.371)/129),...Array.from({length:17},(_,i)=>3.064+i*.00113)];
 for(const t of times){m.update(t);m.root.updateMatrixWorld(true);for(const pallet of[b.palletF,b.palletG,b.chronometerPalletJ,...p.palletNecks,p.directBridge])assert.ok(x.both(pallet,rim)>-2e-5,`${pallet.userData.role}@${t}`);for(const {boss,shaft}of p.bearingParts)assert.ok(x.both(boss,shaft)>-2e-6,`journal@${t}`);}
 console.log(x.report());
});
test('396 interpolation stays in the finite admissible region between bake knots',()=>{
 const m=make({id:396}),d=m.root.userData,p=reed396Profiles();let min=Infinity,maxJump=0;
 for(let i=0;i<bake.samples.length-1;i++){for(const offset of[.211,.739]){const t=bake.times[i]+offset*(bake.times[i+1]-bake.times[i]),s=d.stateAtTime(t),c=reed396Contact(s.wheelAngle,reed396Obstacles(s,p.pallets),p.teeth);min=Math.min(min,c.gap);assert.ok(c.gap> -2e-6,`${t}: ${c.gap}`);assert.ok(s.wheelAngularSpeed<=1e-10);}maxJump=Math.max(maxJump,Math.abs(bake.samples[i+1][0]-bake.samples[i][0]));}
 assert.ok(maxJump<.001);console.log({offKnotMinimum:min,maxKnotStep:maxJump});
});
test('396 actual finite contact normals resist the wheel and assist G and J; F remains explicitly unqualified as a pure detent',()=>{
 const p=reed396Profiles(),m=make({id:396}),d=m.root.userData,stats={G:{count:0,minWheel:Infinity,minPower:Infinity},J:{count:0,minWheel:Infinity,minPower:Infinity}};
 for(let i=1;i<bake.samples.length-1;i++){const t=bake.times[i],s=d.stateAtTime(t);if(!s.impulseActive)continue;const c=reed396Contact(s.wheelAngle,reed396Obstacles(s,p.pallets),p.teeth),[x,y]=c.point,[nx,ny]=c.normal,name=s.finiteContactPallet,center=name==='J'?-2.34:2.18,torque=-((x-center)*ny-y*nx),speed=name==='J'?s.balanceAngularSpeed:s.leverAngularSpeed,st=stats[name];assert.ok(Math.abs(c.gap)<2e-7);assert.ok(x*ny-y*nx>.5);assert.ok(torque*speed>=-1e-10);st.count++;st.minWheel=Math.min(st.minWheel,x*ny-y*nx);st.minPower=Math.min(st.minPower,torque*speed);}
 assert.ok(stats.G.count>50);assert.ok(stats.J.count>=5);assert.equal(d.dynamics.detentOnlyFQualified,false);assert.equal(d.dynamics.forkContactSolved,false);assert.match(d.reconstructionNote,/detent-only.*unresolved/);console.log(stats);
});
test('396 the anchor and pallet j are single plates in the wheel plane; webs and spokes join their rims',()=>{
 const m=make({id:396}),d=m.root.userData,b=d.blocks,p=d.workingParts396,x=audit();m.update(0);m.root.updateMatrixWorld(true);
 // No hidden necks, pins or cross-pieces: g, f and h are one extruded plate.
 assert.equal(b.palletF,b.palletG);assert.equal(p.palletNecks.length,0);
 assert.equal(b.lever.children.filter(o=>/pallet|crosspiece|depth-attachment/.test(o.userData.role??'')&&!/^white/.test(o.userData.role)).length,1);
 const anchor=b.palletG.geometry.userData.plate;assert.equal(anchor.polygons.length,1);assert.deepEqual([anchor.low,anchor.high],[-.08,.08]);
 const j=b.chronometerPalletJ.geometry.userData.plate;assert.equal(j.polygons.length,1);
 // The anchor is bored for staff c and the staff passes through it.
 assert.ok(x.both(b.palletG,b.lever.userData.pivotHub)>-1e-6);
 for(const web of p.webs){assert.ok(x.both(web,b.escapeWheel.userData.toothedRim)<1e-6);assert.ok(x.both(web,b.escapeWheel.userData.hub)<1e-6);}
 for(const spoke of b.balance.children.filter(o=>o.userData.role==='balance-wheel-B-spoke'))assert.ok(x.both(spoke,b.balance.userData.rim)<1e-6);
 for(const {boss,post}of p.bearingParts)assert.ok(x.both(boss,post)<1e-6);
});
test('396 roller pin i stays in the slot of fork e and never cuts it',()=>{
 const m=make({id:396}),d=m.root.userData,b=d.blocks,x=audit(),fork=b.lever.userData.forkProngs[0];let engaged=0,minGap=Infinity;
 for(let i=0;i<=1600;i++){const t=4*i/1600;m.update(t);m.root.updateMatrixWorld(true);const s=d.stateAtTime(t);
  const gap=x.both(b.rollerPin,fork);minGap=Math.min(minGap,gap);assert.ok(gap>-1e-5,`pin into fork at ${t}: ${gap}`);
  if(s.forkEngaged){engaged++;const local=b.lever.worldToLocal(b.rollerPin.getWorldPosition(new THREE.Vector3()));assert.ok(Math.abs(local.y)<1e-6,`pin on slot centre at ${t}`);}
 }
 assert.ok(engaged>200);console.log({engaged,minGap});
});
test('396 one-tooth indexing, finite contact metadata and retained buffers survive repeated cycles',()=>{
 const m=make({id:396}),d=m.root.userData,objects=[];m.root.traverse(o=>{if(o.isMesh)objects.push([o,o.geometry.attributes.position.array])});
 for(let i=0;i<129;i++){const t=8*i/128+.017,s=d.stateAtTime(t),next=d.stateAtTime(t+4);assert.ok(Math.abs(next.wheelAngle-s.wheelAngle+Math.PI/6)<1e-12);m.update(t);assert.equal(d.blocks.escapeWheel.rotation.z,s.wheelAngle);assert.equal(d.contacts.wheelLock.active,s.stableLock);assert.equal(d.contacts.leverImpulseG.active,s.leverImpulseActive);assert.equal(d.contacts.directChronometerImpulseJ.active,s.directImpulseActive);}
 for(const [o,array]of objects){assert.equal(o.geometry.attributes.position.array,array);assert.equal(o.castShadow,true);for(const mat of [].concat(o.material))assert.equal(mat.fog,false);}
 assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,6);assert.ok(m.cameraDirection.z>15);assert.equal(d.workingParts396.webs.length,0);
 for(const t of [0,4,8]){const l=d.stateAtTime(t-1e-9),r=d.stateAtTime(t+1e-9);assert.ok(Math.abs(l.wheelAngle-r.wheelAngle)<1e-10);}
});
