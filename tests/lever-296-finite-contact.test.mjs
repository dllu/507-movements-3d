import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredLeverEscapementMovement as create} from '../src/simulation/authored-lever-escapements.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const make=()=>create({id:296});
const triangleWorld=(t,m)=>new THREE.Triangle(...[t.a,t.b,t.c].map(v=>v.clone().applyMatrix4(m)));
test('296: finite wheel/pallets, fork pin, banks and stepped connections clear at full-cycle off-grid poses',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,w=d.workingLever296;
 const working=[...b.palletBlocks,...w.necks,...w.bridges,b.anchorBody,b.forkLever,...b.forkTines,d.escapementInterfaces.leverEnd];
 const pairs=[...b.wheelTeeth.flatMap(t=>working.map(a=>[t,a])),...working.map(a=>[b.wheelRim,a]),...b.forkTines.map(t=>[b.impulsePin,t]),[b.impulsePin,b.forkLever],[b.impulsePin,b.anchorBody],...b.bankingPins.flatMap(pin=>[b.forkLever,...b.forkTines,b.anchorBody].map(o=>[pin,o])),[d.escapementInterfaces.arbor,b.anchorBody],[d.escapementInterfaces.arbor,b.forkLever]];
 const points=new Map(),solids=new Map();for(const pair of pairs)for(const o of pair){if(!points.has(o.geometry))points.set(o.geometry,surfacePoints(o.geometry));if(!solids.has(o.geometry))solids.set(o.geometry,solidSurface(o.geometry));}
 const phases=[...Array.from({length:129},(_,i)=>(i+.371)/129),...Array.from({length:129},(_,i)=>.208+.084*i/128),...Array.from({length:129},(_,i)=>.708+.084*i/128),.25,.75];let min=.01,count=0;const point=new THREE.Vector3();
 for(const phase of phases){m.update((phase-.25)*4);m.root.updateMatrixWorld(true);
  for(const[a,b]of pairs){const box=new THREE.Box3().setFromObject(a).expandByScalar(.01);if(!box.intersectsBox(new THREE.Box3().setFromObject(b)))continue;
   for(const[source,target]of[[a,b],[b,a]]){const mat=target.matrixWorld.clone().invert().multiply(source.matrixWorld);for(const q of points.get(source.geometry)){point.copy(q).applyMatrix4(mat);const gap=solids.get(target.geometry).signedDistance(point,.01);min=Math.min(min,gap);count++;assert.ok(gap>=-2e-6,`${phase}: ${source.userData.role} into ${target.userData.role}: ${gap}`);}}
  }
 }console.log({lever296Queries:count,min});
});
test('296: actual impulse faces resist wheel and drive opposite lever strokes; lock remains close',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,p=d.workingLever296.parts;let minWheel=Infinity,minLever=Infinity,maxGap=0;
 for(const phase of[.1,.23,.248,.254,.26,.267,.275,.6,.73,.748,.754,.76,.767,.775].flatMap(v=>[v,v+1])){
  m.update((phase-.25)*4);m.root.updateMatrixWorld(true);const s=d.stateAtTime((phase-.25)*4),index=s.activeToothIndex,tip=new THREE.Vector3(p.tipRadius,0,0).applyMatrix4(b.wheelTeeth[index].matrixWorld),pallet=b.palletBlocks[s.side>0?0:1];let best=Infinity,contact;
  for(const tri of surfaceTriangles(pallet.geometry)){const t=triangleWorld(tri,pallet.matrixWorld),q=t.closestPointToPoint(tip,new THREE.Vector3()),dist=q.distanceTo(tip);if(dist<best){best=dist;contact={q,n:t.getNormal(new THREE.Vector3())};}}
  const {q,n}=contact,wr=q.clone().sub(new THREE.Vector3(...p.wheelCenter,0)),lr=q.clone().sub(new THREE.Vector3(...p.palletPivot,0)),wheel=wr.x*n.y-wr.y*n.x,lever=-(lr.x*n.y-lr.y*n.x);
  // The pallet reaction must also fit the real hooked tooth's corner normal cone.
  const tooth=b.wheelTeeth[index],edges=[[p.tooth[1],p.tooth[2]],[p.tooth[2],p.tooth[3]]],normals=edges.map(([a,z])=>new THREE.Vector3(z[1]-a[1],a[0]-z[0],0).transformDirection(tooth.matrixWorld));
  const [a,z]=normals,det=a.x*z.y-a.y*z.x,ca=(-n.x*z.y+n.y*z.x)/det,cz=(-a.x*n.y+a.y*n.x)/det;
  assert.ok(ca>=-1e-5&&cz>=-1e-5,`${phase} reaction outside actual tooth corner cone: ${ca},${cz}`);
  minWheel=Math.min(minWheel,wheel);maxGap=Math.max(maxGap,best);assert.ok(wheel>.45,`${phase} wheel normal ${wheel}`);assert.ok(best<.001,`${phase} missing face ${best}`);
  if(s.stage==='pallet-impulse'){const useful=-s.side*lever;minLever=Math.min(minLever,useful);assert.ok(useful>1,`${phase} wrong lever impulse ${lever}`);}else assert.ok(Math.abs(lever)<.01,`${phase} nonconcentric lock ${lever}`);
 }console.log({minWheel,minLever,maxGap});
});
test('296: finite fork corners give continuous entry/transfer/exit and correctly directed balance impulse',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,p=d.workingLever296.parts;let minMoment=Infinity;
 for(let i=0;i<=2048;i++){const t=i*4/2048,s=d.stateAtTime(t);if(!s.pinContactActive)continue;assert.ok(Math.abs(s.pinContact.radiusError)<1e-12);if(s.stage==='pallet-impulse'){
   const arm=s.pinContact.point.clone().sub(d.geometry.balanceCenter),n=s.pinContact.normal,moment=arm.x*n.y-arm.y*n.x;minMoment=Math.min(minMoment,s.side*moment);assert.ok(s.side*moment>.15);}
 }
 for(const half of[0,1])for(const u of[gEngage(),.5,1-gEngage()]){const t=(half+u)*2-1,eps=1e-7,a=d.stateAtTime(t-eps),z=d.stateAtTime(t+eps);assert.ok(Math.abs(a.forkAngle-z.forkAngle)<2e-6,'fork teleport');assert.ok(Math.abs(a.wheelAngle-z.wheelAngle)<2e-6,'wheel teleport');}
 function gEngage(){return Math.acos(p.engagementAngle/p.balanceAmplitude)/Math.PI;}
 console.log({minimumAssistingBalanceMoment:minMoment});
});
test('296: physical necks/bridges and bank supports attach, shafts are bored, updates retain buffers',()=>{
 const m=make(),d=m.root.userData,b=d.blocks,w=d.workingLever296;m.root.updateMatrixWorld(true);
 for(let i=0;i<2;i++)for(const[a,c]of[[b.palletBlocks[i],w.necks[i]],[w.necks[i],w.bridges[i]],[w.bridges[i],b.anchorBody],[b.bankingPins[i],w.bankSupports[i]]]){const surface=solidSurface(c.geometry),mat=c.matrixWorld.clone().invert().multiply(a.matrixWorld),overlap=Math.min(...surfacePoints(a.geometry).map(v=>surface.signedDistance(v.clone().applyMatrix4(mat),.05)));assert.ok(overlap<-.003,`${a.userData.role} detached from ${c.userData.role}: ${overlap}`);}
 const saved=[];m.root.traverse(o=>{if(o.geometry)saved.push([o,o.geometry,o.geometry.attributes.position.array]);});for(let i=0;i<65;i++)m.update(i/8);for(const[o,g,array]of saved){assert.equal(o.geometry,g);assert.equal(o.geometry.attributes.position.array,array);}
 assert.equal(d.minimumDisplayCycleSeconds,6);assert.match(d.reconstructionNote,/prescribed/);
});
