import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredDuplexEscapementMovement as create} from '../src/simulation/authored-duplex-escapements.js';
import {surfacePoints,solidSurface,surfaceTriangles} from './helpers/solid-surface.mjs';
const make=()=>create({id:293});
test('293: finite teeth, notched roller, all crown pins and stepped pallet clear over two cycles',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,w=d.workingDuplex293;
 const pairs=[...b.lockingToothMeshes.map(t=>[t,b.lockingRoller]),...b.impulsePins.flatMap(p=>[b.impulsePalletBody,b.impulsePalletArm,w.neck,b.rollerHub].map(q=>[p,q])),[b.wheelShaft,b.impulsePalletArm],[b.rollerHub,b.impulsePalletArm]];
 const points=new Map(),solids=new Map();for(const pair of pairs)for(const o of pair){if(!points.has(o.geometry))points.set(o.geometry,surfacePoints(o.geometry));if(!solids.has(o.geometry))solids.set(o.geometry,solidSurface(o.geometry));}
 const phases=[...Array.from({length:129},(_,i)=>(i+.317)/129),...Array.from({length:65},(_,i)=>.295+.036*i/64),.7766162109375,...w.bake.samples.slice(0,-1).map((a,i)=>a[0]*.37+w.bake.samples[i+1][0]*.63)];let min=.01,count=0;const p=new THREE.Vector3();
 for(const phase of phases){for(const cycle of[0,1]){
  m.update((phase-w.nominalPhaseOffset+cycle)*4);m.root.updateMatrixWorld(true);
  for(const[a,b]of pairs){const boxA=new THREE.Box3().setFromObject(a).expandByScalar(.01),boxB=new THREE.Box3().setFromObject(b);if(!boxA.intersectsBox(boxB))continue;
   for(const[source,target]of[[a,b],[b,a]]){const mat=target.matrixWorld.clone().invert().multiply(source.matrixWorld);for(const v of points.get(source.geometry)){p.copy(v).applyMatrix4(mat);const gap=solids.get(target.geometry).signedDistance(p,.01);count++;min=Math.min(min,gap);assert.ok(gap>=-2e-6,`${phase} cycle ${cycle}: ${source.userData.role} into ${target.userData.role}: ${gap}`);}}
  }
 }}console.log({duplex293Queries:count,min});
});
test('293: actual finite impulse face normals resist clockwise wheel and assist counterclockwise balance',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,triangles=surfaceTriangles(b.impulsePalletBody.geometry);let minWheel=Infinity,minBalance=Infinity,maxGap=0,maxNormalSpeed=0;
 for(const phase of[.305,.31,.315,.32]){m.update((phase-.30)*4);m.root.updateMatrixWorld(true);const pin=b.impulsePins[0],pc=pin.getWorldPosition(new THREE.Vector3());pc.z=.64;let best=Infinity,result;
  for(const tri of triangles){const t=new THREE.Triangle(...[tri.a,tri.b,tri.c].map(v=>v.clone().applyMatrix4(b.impulsePalletBody.matrixWorld))),p=t.closestPointToPoint(pc,new THREE.Vector3()),distance=p.distanceTo(pc);if(distance<best){best=distance;result={p,n:t.getNormal(new THREE.Vector3())};}}
  const {p,n}=result,wr=p.clone().sub(new THREE.Vector3(d.geometry.wheelCenter.x,d.geometry.wheelCenter.y,.64)),br=p.clone().sub(new THREE.Vector3(d.geometry.balanceCenter.x,d.geometry.balanceCenter.y,.64));
  const wheel=wr.x*n.y-wr.y*n.x,balance=-(br.x*n.y-br.y*n.x);minWheel=Math.min(minWheel,wheel);minBalance=Math.min(minBalance,balance);maxGap=Math.max(maxGap,best-.105);const state=d.stateAtTime((phase-.30)*4),relative=new THREE.Vector3(-wr.y,wr.x,0).multiplyScalar(state.wheelAngularSpeed).sub(new THREE.Vector3(-br.y,br.x,0).multiplyScalar(state.balanceAngularSpeed));maxNormalSpeed=Math.max(maxNormalSpeed,Math.abs(relative.dot(n)));
  assert.ok(wheel>1&&balance>1,`wrong actual normal ${phase}: ${wheel}, ${balance}`);assert.ok(best-.105<.001,`missing impulse ${phase}: ${best-.105}`);
 }assert.ok(maxNormalSpeed<.035,`finite face velocity mismatch ${maxNormalSpeed}`);console.log({minWheel,minBalance,maxGap,maxNormalSpeed});
});
test('293: side lock has useful actual resisting normal and the pallet has finite connected stock',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,w=d.workingDuplex293;m.update((.03-.30)*4);m.root.updateMatrixWorld(true);
 const tip=b.lockingToothMeshes[0],pc=new THREE.Vector3(w.bake.toothRadius,0,0).applyMatrix4(tip.matrixWorld);let best=Infinity,result;
 for(const tri of surfaceTriangles(b.lockingRoller.geometry)){const t=new THREE.Triangle(...[tri.a,tri.b,tri.c].map(v=>v.clone().applyMatrix4(b.lockingRoller.matrixWorld))),p=t.closestPointToPoint(pc,new THREE.Vector3()),dist=p.distanceTo(pc);if(dist<best){best=dist;result={p,n:t.getNormal(new THREE.Vector3())};}}
 const r=pc.clone().sub(new THREE.Vector3(d.geometry.wheelCenter.x,d.geometry.wheelCenter.y,0)),moment=r.x*result.n.y-r.y*result.n.x;assert.ok(moment>1,`radial/nonlocking reaction ${moment}`);assert.ok(best<.001);
 for(const[a,c]of[[b.impulsePalletBody,w.neck],[w.neck,b.impulsePalletArm]]){const surface=solidSurface(c.geometry),matrix=c.matrixWorld.clone().invert().multiply(a.matrixWorld);const overlap=Math.min(...surfacePoints(a.geometry).map(v=>surface.signedDistance(v.clone().applyMatrix4(matrix),.1)));assert.ok(overlap<-.005,`detached ${a.userData.role} / ${c.userData.role}: ${overlap}`);}
 console.log({restMoment:moment,restGap:best});
});
test('293: every interpolation segment is finite and full cycle advances one tooth without allocation',()=>{
 const m=make(),d=m.root.userData,w=d.workingDuplex293,rows=w.bake.samples,saved=[];m.root.traverse(o=>{if(o.geometry)saved.push([o,o.geometry,o.geometry.attributes.position.array]);});
 for(let i=0;i<rows.length-1;i++){const t=(rows[i][0]*.37+rows[i+1][0]*.63-.30)*4,s=d.stateAtTime(t),n=d.stateAtTime(t+4);assert.ok(Number.isFinite(s.wheelAngle));assert.ok(Math.abs(n.wheelAngle-s.wheelAngle+w.bake.pitch)<1e-12);}
 for(let i=0;i<65;i++)m.update(i/8);for(const[o,g,p]of saved){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,p);}
 assert.match(d.reconstructionNote,/prescribed/);assert.match(d.reconstructionNote,/raised/);assert.equal(d.minimumDisplayCycleSeconds,6);
});
