import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredStampMovement as stamp} from '../src/simulation/authored-stamps.js';
import {createAuthoredTripHammerMovement as trip} from '../src/simulation/authored-trip-hammers.js';
import {surfacePoints,surfaceTriangles,solidSurface} from './helpers/solid-surface.mjs';
const meshes=o=>{const result=[];o.traverse(p=>{if(p.isMesh)result.push(p);});return result;};
function auditor(){
 const points=new Map(),triangles=new Map(),solids=new Map(),stats={};let queries=0;
 const check=(a,b,label,journal=false)=>{
  if(!points.has(a.geometry))points.set(a.geometry,surfacePoints(a.geometry));if(!solids.has(b.geometry))solids.set(b.geometry,solidSurface(b.geometry));
  const solid=solids.get(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld),p=new THREE.Vector3();
  const verify=p=>{const gap=solid.signedDistance(p,.05);assert.ok(Number.isFinite(gap));queries++;stats[label]=Math.min(stats[label]??.05,gap);assert.ok(gap>=-1e-5,`${label}: ${a.userData.role} cuts ${b.userData.role} by ${-gap}`);};
  for(const q of points.get(a.geometry))verify(p.copy(q).applyMatrix4(matrix));
  if(journal){if(!triangles.has(a.geometry))triangles.set(a.geometry,surfaceTriangles(a.geometry));for(const triangle of triangles.get(a.geometry)){
   const v=[triangle.a,triangle.b,triangle.c].map(p=>p.clone().applyMatrix4(matrix));
   for(const z of[solid.box.min.z+1e-6,(solid.box.min.z+solid.box.max.z)/2,solid.box.max.z-1e-6])for(let i=0;i<3;i++){const a=v[i],b=v[(i+1)%3],t=(z-a.z)/(b.z-a.z);if(t>=0&&t<=1)verify(p.copy(a).lerp(b,t));}
  }}
 };
 return{check,report:()=>({queries,minimumGaps:stats})};
}

test('351 corrected guides, strike, shaft passages and engaged involutes clear as finite solids',()=>{
 const m=stamp({id:351}),d=m.root.userData,b=d.blocks,g=d.geometry,audit=auditor();
 for(let i=0;i<=64;i++){
  m.update(4*(i/64-g.initialCyclePhase));m.root.updateMatrixWorld(true);
  for(const moving of[b.rackBar,b.lowerCollar,b.stampDie,b.topRodCap,...b.rackTeeth])for(const guide of b.guideAssemblies)for(const fixed of[guide.frontLip,guide.rearLip,guide.leftJaw])audit.check(moving,fixed,'guide');
  for(const moving of[b.stampDie,b.dieFace])audit.check(moving,b.workpiece,'strike');
  for(const target of[b.shaftBearing,b.pinionHub,b.gearBody])audit.check(b.inputShaft,target,'shaft passage',true);
 }
 for(let i=0;i<=128;i++){
  m.update(4*(g.engagementFraction*i/128-g.initialCyclePhase));m.root.updateMatrixWorld(true);for(const a of b.gearTeeth)for(const target of b.rackTeeth)audit.check(a,target,'engaged tooth');
 }
 console.log({id:351,...audit.report()});
});

test('351 has nearby upward-driving involute faces throughout the lift',()=>{
 const m=stamp({id:351}),d=m.root.userData,b=d.blocks,g=d.geometry,solid=solidSurface(b.rackTeeth[0].geometry),points=[];
 const outline=b.gearTeeth[0].geometry.userData.plate.polygons[0][0];
 for(let i=0;i<outline.length-1;i++){const a=new THREE.Vector2(...outline[i]),c=new THREE.Vector2(...outline[i+1]),v=c.clone().sub(a),normal=new THREE.Vector2(v.y,-v.x).normalize();for(const t of[0,.5,1])points.push({p:a.clone().lerp(c,t),normal});}
 let maximumGap=0;
 for(let i=0;i<=128;i++){
  m.update(4*(g.engagementFraction*i/128-g.initialCyclePhase));m.root.updateMatrixWorld(true);let closest=.1;
  for(const tooth of b.gearTeeth){const angle=b.pinion.rotation.z+tooth.rotation.z;for(const {p,normal}of points){if(normal.x*Math.sin(angle)+normal.y*Math.cos(angle)<.3)continue;
   const world=tooth.localToWorld(new THREE.Vector3(p.x,p.y,0));for(const rack of b.rackTeeth)closest=Math.min(closest,solid.distance(rack.worldToLocal(world.clone()),.1));
  }}
  maximumGap=Math.max(maximumGap,closest);assert.ok(closest<.002,`no useful lift flank at ${i}: ${closest}`);
 }
 console.log({id:351,maximumDrivingGap:maximumGap});
});

test('351 release follows the withdrawing final tooth and pickup lifts the resting rack without interpenetration',()=>{
 const m=stamp({id:351}),d=m.root.userData,b=d.blocks;assert.equal(d.reconstructionStatus,'partial');assert.match(d.reconstructionNote,/follows the withdrawing final tooth/);assert.match(d.reconstructionNote,/entering tooth lifts/);
 // The former imposed fall cut 0.11293 into this tooth at this phase.
 const solid=solidSurface(b.rackTeeth[2].geometry);let minimum=1;
 m.update(4*(.64453125-d.geometry.initialCyclePhase));m.root.updateMatrixWorld(true);
 for(const p of surfacePoints(b.gearTeeth[5].geometry)){const world=b.gearTeeth[5].localToWorld(p.clone());minimum=Math.min(minimum,solid.signedDistance(b.rackTeeth[2].worldToLocal(world),.2));}
 assert.ok(minimum>-1e-4,`withdrawal penetration ${-minimum}`);
 let worst=1,before=d.stateAtTime(0);
 for(let i=1;i<=2048;i++){const s=d.stateAtTime(4*i/2048);worst=Math.min(worst,d.stampCarriedContact.clearanceAt(s.driverAngle,s.rackDisplacement));assert.ok(Math.abs(s.rackDisplacement-before.rackDisplacement)<.06,`rack jump at ${i}`);before=s;}
 assert.ok(worst>0,`finite tooth clearance ${worst}`);
 console.log({id:351,withdrawalGap:minimum,cycleToothClearance:worst});
});

test('353 finite wipers, rounded helve, impact face, supports and journals clear through release and strike',()=>{
 const m=trip({id:353}),d=m.root.userData,b=d.blocks,g=d.geometry,audit=auditor(),phases=Array.from({length:129},(_,i)=>i/128);
 for(const phase of[g.contactStartPhase,g.contactEndPhase,g.impactPhase])for(const e of[-1e-6,0,1e-6])phases.push(phase+e);
 const moving=[b.camDisk,b.camHub,...b.wiperMeshes,b.helve,b.hammerHead,b.movingJournalBlock,b.movingPivotHub],fixed=[b.camPost,b.camPostCap,b.pivotPost,b.pivotBridge,b.rearCamBearing,b.frontPivotBearing,b.rearPivotBearing];
 for(const phase of phases){
  m.update((phase-g.initialCyclePhase)*g.lobeCyclePeriod);m.root.updateMatrixWorld(true);
  for(const a of[b.followerNose,b.helve])for(const target of[b.camDisk,...b.wiperMeshes])audit.check(a,target,'wiper');
  audit.check(b.hammerHead,b.anvilFace,'strike');audit.check(b.hammerHead,b.anvilBody,'anvil body');
  for(const a of moving)for(const target of fixed)audit.check(a,target,'fixed hardware');
  for(const shaft of meshes(b.inputShaft))for(const target of[b.camDisk,b.camHub,b.camPost,b.camPostCap,b.rearCamBearing])audit.check(shaft,target,'input passage',true);
  for(const shaft of meshes(b.hammerPivotShaft))for(const target of[b.helve,b.movingJournalBlock,b.movingPivotHub,b.pivotPost,b.pivotBridge,b.frontPivotBearing,b.rearPivotBearing])audit.check(shaft,target,'fulcrum passage',true);
 }
 console.log({id:353,...audit.report()});
});

test('353 working face supplies the lifting torque and its finite nose stays close',()=>{
 const m=trip({id:353}),d=m.root.userData,b=d.blocks,g=d.geometry,nose=solidSurface(b.followerNose.geometry);let minForce=Infinity,maxGap=0;
 for(let i=0;i<=256;i++){
  const phase=g.contactStartPhase+(g.contactEndPhase-g.contactStartPhase)*i/256;m.update((phase-g.initialCyclePhase)*g.lobeCyclePeriod);m.root.updateMatrixWorld(true);const s=d.kinematics;
  const torque=d.dynamics.momentOfInertia*s.hammerAngularAcceleration+d.dynamics.totalMass*d.dynamics.gravity*(s.centerOfMass.x-g.hammerPivot.x),normalForce=torque/s.effortTorqueSense;
  assert.ok(normalForce>0);assert.ok(s.effortTorqueSense<0);minForce=Math.min(minForce,normalForce);
  const p=s.camContactPoint.clone(),gap=nose.signedDistance(b.followerNose.worldToLocal(p),.01);maxGap=Math.max(maxGap,gap);assert.ok(gap>=-1e-5&&gap<.001);
 }
 console.log({id:353,minimumAssumedNormalForce:minForce,maximumNoseGap:maxGap});
});

for(const[id,create]of[[351,stamp],[353,trip]])test(`${id}: full-cycle bounds, stable buffers and readable timing`,()=>{
 const m=create({id}),d=m.root.userData,g=d.geometry,saved=[];m.root.traverse(o=>{if(o.geometry)saved.push([o,o.geometry,o.geometry.attributes.position.array]);for(const mat of[].concat(o.material??[]))assert.equal(mat.fog,false);});
 const period=g.cyclePeriod??g.driverFullTurnPeriod;
 for(let i=0;i<=16;i++){m.update(period*i/16);m.root.updateMatrixWorld(true);m.root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(!p)return;for(let j=0;j<p.count;j++)assert.ok(d.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld)),`outside bounds: ${o.userData.role}`);});}
 let count=0;m.root.traverse(o=>{if(o.geometry)count++;});assert.equal(count,saved.length);for(const[o,geom,array]of saved){assert.equal(o.geometry,geom);assert.equal(o.geometry.attributes.position.array,array);}assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,period);assert.match(d.reconstructionNote,/not.*solved/);
});

test('351 starts at the source raised pose and publishes the same phase as its rendered motion',()=>{
 const m=stamp({id:351}),d=m.root.userData;assert.ok(Math.abs(d.kinematics.rackDisplacement-d.geometry.rackStroke)<1e-12);
 for(const time of[0,.13,.7,2.1,4]){m.update(time);assert.equal(d.kinematics.rackDisplacement,d.stateAtTime(time).rackDisplacement);}
});

test('353 the visible rounded wear nose stands proud of the helve cap',()=>{
 const m=trip({id:353}),b=m.root.userData.blocks;m.root.updateMatrixWorld(true);
 const nose=new THREE.Box3().setFromObject(b.followerNose),helve=new THREE.Box3().setFromObject(b.helve);
 assert.ok(nose.max.z-helve.max.z>.019);assert.ok(nose.min.z<helve.min.z&&nose.max.z>helve.max.z);
});
