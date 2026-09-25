import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredMangleWheelMovement as mangle} from '../src/simulation/authored-mangle-wheels.js';
import {createAuthoredParsonsRackMovement as parsons} from '../src/simulation/authored-parsons-racks.js';
import {solidSurface,surfacePoints,surfaceTriangles} from './helpers/solid-surface.mjs';
function audit(){const fields=new Map(),points=new Map();return(a,b,journal=false)=>{
 if(!fields.has(b.geometry))fields.set(b.geometry,solidSurface(b.geometry));if(!points.has(a.geometry))points.set(a.geometry,surfacePoints(a.geometry));
 const f=fields.get(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);let min=.2;
 const inspect=p=>{const gap=f.signedDistance(p,.2);assert.ok(Number.isFinite(gap));min=Math.min(min,gap);};
 for(const p of points.get(a.geometry))inspect(p.clone().applyMatrix4(matrix));
 if(journal)for(const t of surfaceTriangles(a.geometry)){const v=[t.a,t.b,t.c].map(p=>p.clone().applyMatrix4(matrix));for(const axis of['x','y','z'])for(const q of[f.box.min[axis]+1e-6,(f.box.min[axis]+f.box.max[axis])/2,f.box.max[axis]-1e-6])for(let i=0;i<3;i++){const p=v[i],n=v[(i+1)%3],u=(q-p[axis])/(n[axis]-p[axis]);if(u>=0&&u<=1)inspect(p.clone().lerp(n,u));}}
 return min;
};}

test('371 rotating shafts and translating guide rails clear actual bored support surfaces',()=>{
 const m=mangle({id:371}),d=m.root.userData,b=d.blocks,check=audit();let minimum=Infinity;
 for(let i=0;i<=16;i++){m.update(d.geometry.mechanismCyclePeriod*i/16);m.root.updateMatrixWorld(true);
  for(const p of[b.carrierCollar,b.carrierBridge])minimum=Math.min(minimum,check(b.inputShaft,p,true));
  for(const p of[b.fixedBearing,b.bearingPost,b.wheelHub,b.wheelWeb])minimum=Math.min(minimum,check(b.outputShaft,p,true));
  for(let j=0;j<2;j++)minimum=Math.min(minimum,check(b.guideRails[j],b.guideShoes[j],true));
 }assert.ok(minimum>.0038);console.log({mangleJournalClearance:minimum});
 m.update(0);m.root.updateMatrixWorld(true);
 const sample=new THREE.Vector3(1.335,0,0),web=solidSurface(b.wheelWeb.geometry),rim=solidSurface(b.wheelBody.geometry);
 assert.ok(web.signedDistance(sample.clone().applyMatrix4(b.wheelWeb.matrixWorld.clone().invert()))<-.001);
 assert.ok(rim.signedDistance(sample.clone().applyMatrix4(b.wheelBody.matrixWorld.clone().invert()))<-.001,'the finite web reaches the rim');
 const source=d.stateAtTime(0);assert.equal(source.branch,'rear-face-tooth-run');assert.ok(Math.sin(source.wheelAngle+Math.PI)<0,'source opening is below the shaft');
});

test('394 input rod remains in its slotted guide and its collar clears the complete transverse reversal',()=>{
 const m=parsons({id:394}),d=m.root.userData,b=d.blocks,r=b.rackCarrier.userData,check=audit();let rod=Infinity,collar=Infinity;
 for(const phase of[...Array.from({length:33},(_,i)=>i/32),.44,.94]){m.update(phase*8);m.root.updateMatrixWorld(true);rod=Math.min(rod,check(r.inputRod,b.rodGuide,true));collar=Math.min(collar,check(r.pistonHead,b.rodGuide));
  const rodBounds=new THREE.Box3().setFromObject(r.inputRod),guideBounds=new THREE.Box3().setFromObject(b.rodGuide);assert.ok(rodBounds.min.x<guideBounds.min.x&&rodBounds.max.x>guideBounds.max.x,'rod spans the whole journal at every pose');
 }assert.ok(rod>.0048);assert.ok(collar>.03);console.log({parsonsRodGap:rod,parsonsCollarGap:collar});
});

test('394 finite guide mouths retain working flange surfaces without inverted-arc interference',()=>{
 const m=parsons({id:394}),d=m.root.userData,b=d.blocks,o=b.outputRotor.userData,check=audit();let min=Infinity,maxWorking=0,pinion=Infinity;
 for(const phase of[...Array.from({length:33},(_,i)=>i/32),.40,.44,.48,.90,.94,.98]){m.update(phase*8);m.root.updateMatrixWorld(true);
  for(const wall of[...b.finiteGuideWalls,...b.guideAttachments]){
   for(const flange of[o.largeFlange,o.smallFlange])min=Math.min(min,check(flange,wall));
   pinion=Math.min(pinion,check(o.pinion,wall));
  }
  const s=d.kinematics;if(s.largeFlangeActive)maxWorking=Math.max(maxWorking,check(o.largeFlange,b.largeGroove.userData.workingWall));if(s.smallFlangeActive)maxWorking=Math.max(maxWorking,check(o.smallFlange,b.smallGroove.userData.workingWall));
 }
 assert.ok(min>0);assert.ok(maxWorking<.002);assert.ok(pinion>.02);console.log({finiteGuideMinimum:min,maximumWorkingGuideGap:maxWorking,pinionGuideGap:pinion});
 assert.match(d.reconstructionNote,/normal alone supplies no shaft torque/);
 // A circular flange's normal reaction passes through its shaft. Rotation
 // transfer therefore requires the explicitly disclosed friction assumption.
 for(const groove of[b.largeGroove,b.smallGroove]){
  const wall=groove.userData.workingWall,triangles=surfaceTriangles(wall.geometry),target=new THREE.Vector3(groove===b.largeGroove?wall.userData.innerRadius:-wall.userData.innerRadius,0,groove===b.largeGroove?d.geometry.largePlaneZ:d.geometry.smallPlaneZ),near=new THREE.Vector3();let best=Infinity,normal;
  for(const t of triangles){const distance=t.closestPointToPoint(target,near).distanceTo(target);if(distance<best){best=distance;normal=t.getNormal(new THREE.Vector3());}}
  assert.ok(best<1e-7);assert.ok(Math.abs(normal.x)>.999);assert.ok(Math.abs(normal.y)<.01);
 }
});

test('371 and 394 retain bounded explicit tooth-contact residuals instead of certifying pitch laws',()=>{
 for(const[id,create,limit]of[[371,mangle,.080],[394,parsons,.10]]){
  const m=create({id}),d=m.root.userData,b=d.blocks,check=audit();let min=Infinity;
  for(let i=0;i<=16;i++){m.update((d.geometry.mechanismCyclePeriod??8)*i/16);m.root.updateMatrixWorld(true);
   const pinion=id===371?b.pinion.userData.rotor.children[0]:b.outputRotor.userData.pinion;
   const targets=id===371?[b.wheelBody,...b.frontFaceTeeth,...b.rearFaceTeeth]:b.rackCarrier.userData.teeth;
   for(const target of targets)min=Math.min(min,check(pinion,target));
  }assert.ok(min>=-limit);assert.match(d.reconstructionNote,/unqualified/);console.log({id,remainingToothClearance:min});
 }
});

test('reversing transmission views fit complete cycles and keep stable geometry and readable timing',()=>{
 for(const[id,create,cycle,minimum]of[[371,mangle,27,3],[394,parsons,8,8]]){
  const m=create({id}),d=m.root.userData,objects=[];m.root.traverse(o=>objects.push([o,o.geometry]));assert.equal(d.hideGround,true);assert.ok(d.minimumDisplayCycleSeconds>=minimum);assert.ok(m.cameraDirection.z>14);
  const p=new THREE.Vector3();for(let i=0;i<=32;i++){m.update(cycle*i/32);m.root.updateMatrixWorld(true);m.root.traverseVisible(o=>{if(!o.isMesh)return;for(const material of[].concat(o.material))assert.equal(material.fog,false);assert.ok(o.castShadow);const a=o.geometry.attributes.position;for(let j=0;j<a.count;j+=7)assert.ok(d.cameraFitBounds.containsPoint(p.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld)));});}
  const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,objects);
 }
});
