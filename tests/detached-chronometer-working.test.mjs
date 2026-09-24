import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredLeverChronometerMovement as chronometer} from '../src/simulation/authored-lever-chronometers.js';
import {surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
for(const[id,create]of[[314,chronometer]])test(`${id}: corrected finite contacts and journal interfaces clear for a full cycle`,()=>{
 const m=create({id}),d=m.root.userData,g=d.geometry,p=d.detachedChronometerParts,pairs=[...p.pairs,...p.workingPairs],points=new Map(),solids=new Map();
 for(const[a,b]of pairs){if(!points.has(a.geometry))points.set(a.geometry,surfacePoints(a.geometry));if(!solids.has(b.geometry))solids.set(b.geometry,solidSurface(b.geometry));}
 const phases=Array.from({length:129},(_,i)=>i/128);
 for(const key of id===308?['unlockStartPhase','impulseStartPhase','detentReturnStartPhase','detentRelockPhase','impulseEndPhase']:['pinEngagementHalfPhase','pinDisengagementHalfPhase'])for(const eps of[-1e-5,0,1e-5]){const phase=g[key]*(id===308?1:.5);phases.push(phase+eps);if(id===314)phases.push(.5+phase+eps);}
 const point=new THREE.Vector3();let min=.005,count=0;
 for(const phase of phases){m.update((g.pendulumPeriod??g.balancePeriod)*phase);m.root.updateMatrixWorld(true);for(const[a,b]of pairs){const matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const v of points.get(a.geometry)){point.copy(v).applyMatrix4(matrix);const gap=solids.get(b.geometry).signedDistance(point,.005);min=Math.min(min,gap);count++;assert.ok(gap>=-1e-5,`${id} phase${phase}: ${a.userData.role} cuts ${b.userData.role} by ${-gap}`);}}}
 console.log({id,count,min});
});
test('314 banking corner reaches each real pin without the former bevel penetration',()=>{
 const m=chronometer({id:314}),d=m.root.userData,b=d.blocks,g=d.geometry;
 for(const[phase,name,index]of[[0,'left',0],[.35,'right',1]]){
  m.update(phase*g.balancePeriod);m.root.updateMatrixWorld(true);const point=g.bankingContactPoints[name],world=new THREE.Vector3(point.x,point.y,g.leverPlaneZ),local=b.bankingPins[index].worldToLocal(world.clone()),gap=solidSurface(b.bankingPins[index].geometry).signedDistance(local,.01);assert.ok(gap>=-1e-5&&gap<.0015,`${name} contact gap ${gap}`);
 }
});
for(const[id,create]of[[314,chronometer]])test(`${id}: timing, material flags and geometry buffers remain stable`,()=>{
 const m=create({id}),d=m.root.userData,saved=[];m.root.traverse(o=>{if(o.geometry)saved.push([o,o.geometry,o.geometry.attributes.position.array]);for(const mat of[].concat(o.material??[]))assert.equal(mat.fog,false);});for(let i=0;i<=16;i++)m.update((d.geometry.pendulumPeriod??d.geometry.balancePeriod)*i/16);let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,saved.length);for(const[o,g,a]of saved){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,a);}assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,4);assert.match(d.reconstructionNote,/prescribed|unvalidated/);
});
