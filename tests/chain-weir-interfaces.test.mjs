import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createAuthoredChainPumpMovement as chain}from'../src/simulation/authored-chain-pumps.js';
import {createAuthoredSelfActingWeirMovement as weir}from'../src/simulation/authored-self-acting-weirs.js';
import {surfacePoints,solidSurface}from'./helpers/solid-surface.mjs';
for(const[id,build]of[[462,chain],[463,weir]])test(`${id} finite working interfaces over a full cycle`,()=>{
 const m=build({id}),r=m.root,b=r.userData.blocks,g=r.userData.geometry,pairs=[];
 if(id===462){for(const w of[b.topWheel,b.bottomWheel]){pairs.push([w.axle,w.hub],[w.axle,w.bearing]);for(const part of w.workingParts)pairs.push([part,b.cylinder]);for(const{disk}of b.carriers)if(disk)for(const part of[w.hub,...w.workingParts])pairs.push([disk,part]);for(const carrier of b.carriers)for(const part of w.workingParts)pairs.push([carrier.crossShaft,part]);}
 for(const{disk}of b.carriers)if(disk)for(const part of[b.cylinder,...b.dischargeTrough.children.filter(o=>o!==b.dischargeWater)])pairs.push([disk,part]);for(const carrier of b.carriers)pairs.push([carrier.crossShaft,b.cylinder]);
 }else{for(const[p,a]of[[b.upperBody,b.upperPivotAssembly],[b.lowerBody,b.lowerPivotAssembly]]){pairs.push([a.axle,p]);for(const bearing of a.bearings)pairs.push([a.axle,bearing]);}
 pairs.push([b.upperBody,b.lowerBody],[b.upperContactEdge,b.lowerBody],...b.upperReinforcements.map(o=>[o,b.lowerBody]),...b.lowerReinforcements.map(o=>[o,b.upperBody]),[b.notchFlow,b.upperBody],...b.upperShoulders.map(o=>[b.notchFlow,o]));}
 const points=new Map(),surfaces=new Map();for(const[a,c]of pairs){if(!points.has(a))points.set(a,surfacePoints(a.geometry));if(!surfaces.has(c))surfaces.set(c,solidSurface(c.geometry));}
 if(id===462)for(const carrier of b.carriers)for(const y of[-.275,.275])for(let j=0;j<128;j++)points.get(carrier.crossShaft).push(new THREE.Vector3(.04*Math.cos(j*Math.PI/64),y,.04*Math.sin(j*Math.PI/64)));
 let queries=0;for(let i=0;i<=64;i++){m.update(g.cycleDuration*(i+.371)/64);r.updateMatrixWorld(true);for(const[a,c]of pairs){if(!a.visible||!c.visible)continue;if(a.geometry.userData.deforming)points.set(a,surfacePoints(a.geometry));const tr=c.matrixWorld.clone().invert().multiply(a.matrixWorld),s=surfaces.get(c);for(const p of points.get(a)){const q=p.clone().applyMatrix4(tr);queries++;if(s.box.distanceToPoint(q)>.001)continue;const d=s.signedDistance(q,.01);assert.ok(d>=-1e-5,`${id} ${a.userData.role||a.id} vs ${c.userData.role||c.id}, i${i}, d${d}, q${q.toArray()}`);}}}
 console.log({id,queries});assert.equal(r.userData.hideGround,true);r.traverse(o=>{for(const mat of o.material?[].concat(o.material):[])assert.equal(mat.fog,false);});
 const ids=()=>{let a=[];r.traverse(o=>a.push([o,o.geometry]));return a;};const before=ids();for(let i=0;i<100;i++)m.update(i/100*g.cycleDuration);assert.deepEqual(ids(),before);
});

test('462 swept pockets retain a small finite working gap to the actual carrier shafts',()=>{
 const m=chain({id:462}),d=m.root.userData,b=d.blocks,g=d.geometry;
 assert.equal(g.pitchRadius,.62);assert.equal(g.carrierCount,24);assert.equal(g.wheelPocketCount,8);
 let minimum=Infinity,maximum=0;
 for(const[wheel,segment]of[[b.topWheel,'upper-wheel-semicircle'],[b.bottomWheel,'lower-wheel-semicircle']]){
  const rim=wheel.workingParts.find(o=>o.userData.role==='swept-cross-shaft-pocket-rim'),solid=solidSurface(rim.geometry);
  for(let i=0;i<=32;i++){m.update(g.cycleDuration*i/32);m.root.updateMatrixWorld(true);let gap=Infinity;
   for(const state of d.stateAtTime(g.cycleDuration*i/32).carrierStates.filter(s=>s.segment===segment)){
    const shaft=b.carriers[state.index].crossShaft,tr=rim.matrixWorld.clone().invert().multiply(shaft.matrixWorld);
    for(const y of[-.275,.275])for(let j=0;j<128;j++)gap=Math.min(gap,solid.distance(new THREE.Vector3(.04*Math.cos(j*Math.PI/64),y,.04*Math.sin(j*Math.PI/64)).applyMatrix4(tr),gap));
   }
   minimum=Math.min(minimum,gap);maximum=Math.max(maximum,gap);
  }
 }
 assert.ok(minimum>.003);assert.ok(maximum<.005);console.log({driveGapMin:minimum,driveGapMax:maximum});
});
