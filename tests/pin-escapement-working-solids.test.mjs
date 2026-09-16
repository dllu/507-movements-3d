import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredSinglePinEscapementMovement as single} from '../src/simulation/authored-single-pin-escapements.js';
import {createAuthoredThreeLeggedEscapementMovement as three} from '../src/simulation/authored-three-legged-escapements.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
const models=[305,306,307].map(id=>(id===305?single:three)({id}));
const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),solid:solidSurface(o.geometry),triangles:surfaceTriangles(o.geometry)});return cache.get(o);};
const role=(root,name)=>{let found;root.traverse(o=>{if(o.userData.role===name)found=o;});return found;};
function clearance(a,c){let min=Infinity;for(const[x,y]of[[a,c],[c,a]]){const tr=y.matrixWorld.clone().invert().multiply(x.matrixWorld),field=get(y).solid;for(const p of get(x).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.003)continue;min=Math.min(min,field.signedDistance(q,.15));}}return min;}
function insideWorld(o,p){return get(o).solid.inside(o.worldToLocal(p.clone()));}

test('305 finite upright faces touch the pin and transfer positive impulse to the pendulum',()=>{
 const m=models[0],d=m.root.userData,b=d.blocks;let count=0,worst=0;
 for(let i=0;i<=1024;i++){const t=4*i/1024,s=d.stateAtTime(t);if(s.contactKind!=='upright-impulse')continue;m.update(t);m.root.updateMatrixWorld(true);const face=s.impulseSide==='upper'?b.upperPallet:b.lowerPallet,center=b.rubyPin.getWorldPosition(new T.Vector3()),q=face.worldToLocal(center.clone());let best=Infinity,closest;
  for(const tri of get(face).triangles){const p=tri.closestPointToPoint(q,new T.Vector3()),dist=q.distanceTo(p);if(dist<best){best=dist;closest=p;}}
  const gap=best-d.geometry.pinRadius;assert.ok(Math.abs(gap)<2e-6,`finite face gap ${gap}`);worst=Math.max(worst,Math.abs(gap));
  const force=closest.clone().sub(q).normalize().transformDirection(face.matrixWorld),arm=center.clone().sub(new T.Vector3(d.geometry.palletPivot.x,d.geometry.palletPivot.y,center.z)),torque=arm.x*force.y-arm.y*force.x;
  assert.ok(torque*s.pendulumAngularSpeed>0,'actual face normal supplies positive pendulum work');count++;
 }
 assert.ok(count>100);console.log({finite305ImpulseSamples:count,maximumImpulseGap:worst});
});
test('305 pin, arbor, bored disk and suspension clear their independent neighbours throughout playback',()=>{
 const m=models[0],b=m.root.userData.blocks;const pairs=[[b.rubyPin,b.diskHub],[b.diskHub,b.upperPallet],[b.diskHub,b.lowerPallet],[b.diskHub,b.disk],[b.diskHub,role(m.root,'fixed-single-pin-disc-arbor')],[b.pivotRing,role(m.root,'fixed-pendulum-pivot')],[b.pinCarrier,b.upperPallet],[b.pinCarrier,b.lowerPallet],[b.disk,b.upperPallet],[b.disk,b.lowerPallet]];
 for(let i=0;i<=128;i++){m.update(i/32);m.root.updateMatrixWorld(true);for(const[a,c]of pairs)assert.ok(clearance(a,c)>-2e-6,`${i}: ${a.userData.role}/${c.userData.role}`);}
});
test('306/307 have bored moving hubs and connected pin/arbor supports',()=>{
 const [m306,m307]=models.slice(1),b306=m306.root.userData.blocks,b307=m307.root.userData.blocks;
 for(let i=0;i<=64;i++){m306.update(i/16);m307.update(i/16);m306.root.updateMatrixWorld(true);m307.root.updateMatrixWorld(true);
  for(const[a,c]of[[b306.fixedArbor,b306.wheelHub],[b306.fixedArbor,b306.arborSupport],...b306.screwMeshes.map(s=>[s,b306.plate]),[role(m307.root,'three-leg-wheel-arbor'),b307.wheelHub],[role(m307.root,'pendulum-pallet-pivot'),b307.pivotEye],[role(m307.root,'pendulum-pallet-pivot'),b307.plate],[b307.impulsePinCarrier,b307.plate],[b307.impulsePinCarrier,b307.palletA],[b307.impulsePinCarrier,b307.palletB]])assert.ok(clearance(a,c)>-2e-6,`${a.userData.role}/${c.userData.role}`);
 }
 m307.update(0);m307.root.updateMatrixWorld(true);for(const pin of b307.impulsePins){const point=pin.getWorldPosition(new T.Vector3());point.z=-.14;assert.ok(insideWorld(pin,point)&&insideWorld(b307.impulsePinCarrier,point),'rear pin has a finite carrier connection');}
 const bridge=role(m306.root,'rear-frame-cross-bridge'),point=new T.Vector3(0,1.36,-.47);assert.ok(insideWorld(bridge,point)&&insideWorld(b306.arborSupport,point),'arbor support meets the frame bridge');
});
test('305 pin carrier and pallet stand-offs have finite attachment overlap',()=>{
 const m=models[0],d=m.root.userData,b=d.blocks;m.update(0);m.root.updateMatrixWorld(true);
 const point=b.wheelRotor.localToWorld(new T.Vector3(d.geometry.pinOrbitRadius,0,.15));assert.ok(insideWorld(b.rubyPin,point)&&insideWorld(b.pinCarrier,point));
 for(const [i,side]of[1,-1].entries()){const mount=b.palletMounts[i],pallet=side>0?b.upperPallet:b.lowerPallet;
  for(const[z,part]of[[.15,b.plate],[.20,pallet]]){const p=b.palletAssembly.localToWorld(new T.Vector3(side*.877,-d.geometry.centerDistance+side*.30,z));assert.ok(insideWorld(mount,p)&&insideWorld(part,p),'stand-off joins the outer plate and raised pallet');}
 }
});
test('contact residuals are measured separately from the finite impulse qualification',()=>{
 const m=models[0],d=m.root.userData,b=d.blocks;let minimum=0,restGap=0;
 for(let i=0;i<=2048;i++){const t=i/512,s=d.stateAtTime(t);m.update(t);m.root.updateMatrixWorld(true);const center=b.rubyPin.getWorldPosition(new T.Vector3());let gap=Infinity;for(const face of[b.upperPallet,b.lowerPallet])gap=Math.min(gap,get(face).solid.distance(face.worldToLocal(center.clone()))-d.geometry.pinRadius);minimum=Math.min(minimum,gap);if(s.contactKind==='dead-rest')restGap=Math.max(restGap,gap);}
 assert.ok(minimum>-.0007,'handoff is bounded and must not be confused with impulse qualification');assert.ok(restGap<.010);console.log({releaseCornerGap:minimum,maximumPrescribedRestGap:restGap});
 for(const model of models){assert.match(model.root.userData.workingPartsReview.qualification,/prescribed|Prescribed/);assert.equal(model.root.userData.minimumDisplayCycleSeconds,6);assert.equal(model.root.userData.hideGround,true);model.update(1);assert.equal(model.root.userData.blocks.contactMarker.visible,false);}
});
test('family playback retains scene objects and geometry buffers',()=>{
 for(const m of models){const a=[];m.root.traverse(o=>a.push([o,o.geometry]));for(let i=0;i<=64;i++)m.update(i/16);const c=[];m.root.traverse(o=>c.push([o,o.geometry]));assert.deepEqual(a,c);}
});
