import{applyDisplayTiming}from'../src/simulation/display-timing.js';
import test from'node:test';import assert from'node:assert/strict';import*as THREE from'three';
import{createAuthoredSteamHammerMovement as steam}from'../src/simulation/authored-steam-hammers.js';
import{createAuthoredAtmosphericHammerMovement as atmospheric}from'../src/simulation/authored-atmospheric-hammers.js';
import{createAuthoredCompressedAirHammerMovement as compressed}from'../src/simulation/authored-compressed-air-hammers.js';
import{surfacePoints,solidSurface}from'./helpers/solid-surface.mjs';
for(const[id,build]of[[470,steam],[471,atmospheric],[472,compressed]])test(`${id} finite piston passages, joints and striking contact`,()=>{
 const model=build({id}),r=model.root,d=r.userData,b=d.blocks,g=d.geometry;
 const shell=id===470?b.fixedCylinder:id===471?b.cylinderShell:b.hammerCylinderShell,piston=b.piston??b.hammerPiston,rod=b.pistonRod??b.hammerPistonRod;
 const pairs=[[piston,shell],[rod,shell],[b.hammerHead,shell],[b.hammerFace,b.anvilFace],...b.workingCaps.flatMap(cap=>[[piston,cap],[rod,cap],[b.hammerHead,cap]])];
 if(id===470)pairs.push([b.valveSpool,b.valveChest],[b.admissionPassage,b.fixedCylinder]);
 if(id===471)pairs.push([b.fixedDriveShaft,b.crankBearing],[b.fixedDriveShaft,b.crankDisk],[b.fixedDriveShaft,rod],[b.fixedDriveShaft,b.hammerHead],[b.crankPinVisual,b.connectingRod],[b.cylinderJointPin,b.connectingRod],[b.cylinderJointPin,b.cylinderDriveLug],[b.connectingRod,b.cylinderShell],[b.connectingRod,b.crankDisk]);
 if(id===472)pairs.push([b.pumpConnectingRod,b.pumpPiston],[b.pumpConnectingRod,b.pumpCrankArm],[b.pumpCrankPin,b.pumpConnectingRod],...b.pumpForks.flatMap(o=>[[b.pumpConnectingRod,o],[b.pumpWristPin,o]]),[b.pumpPiston,b.pumpShell],[b.pumpConnectingRod,b.pumpShell],[b.pumpWristPin,b.pumpConnectingRod],[b.driveShaft,b.drivePulley],[b.driveShaft,b.frictionWheel],[b.frictionWheel,b.frictionDisk],[b.slideValve,b.valveChest]);
 const data=pairs.map(([a,c])=>({a,c,points:surfacePoints(a.geometry),solid:solidSurface(c.geometry)}));let queries=0,minFaceGap=Infinity;
 const period=id===472?g.driveCycleDuration*2:g.cycleDuration;
 const times=Array.from({length:65},(_,i)=>period*i/64);times.push(id===470?g.impactPhase*g.cycleDuration:id===471?g.hammerImpactPhase*g.cycleDuration:g.hammerCycleDuration);
 for(const time of times){model.update(time);r.updateMatrixWorld(true);for(const{a,c,points,solid}of data){const tr=c.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const p of points){const q=p.clone().applyMatrix4(tr);queries++;if(solid.box.distanceToPoint(q)>.001)continue;const gap=solid.signedDistance(q,.02);assert.ok(gap>=-1e-5,`${id}: ${a.userData.role||a.id} cuts ${c.userData.role||c.id} at ${time}: ${gap}; ${q.toArray()}`);}}
 const face=new THREE.Box3().setFromObject(b.hammerFace),anvil=new THREE.Box3().setFromObject(b.anvilFace);minFaceGap=Math.min(minFaceGap,face.min.y-anvil.max.y);assert.ok(face.min.y>=anvil.max.y-1e-7);
 const head=new THREE.Box3().setFromObject(b.hammerHead),anvilBody=new THREE.Box3().setFromObject(b.anvil.children.find(o=>o!==b.anvilFace));assert.ok(Math.abs(head.min.y-face.max.y)<1e-7);assert.ok(Math.abs(anvilBody.max.y-anvil.min.y)<1e-7);}
 assert.ok(Math.abs(minFaceGap)<1e-7);assert.equal(d.hideGround,true);r.traverse(o=>{for(const m of o.material?[].concat(o.material):[])assert.equal(m.fog,false);});const snapshot=()=>{let a=[];r.traverse(o=>a.push([o,o.geometry]));return a;};const before=snapshot();for(let i=0;i<100;i++)model.update(period*i/100);assert.deepEqual(snapshot(),before);
 applyDisplayTiming(model,{id});assert.ok(d.animationTiming.displayCycleDuration>=d.minimumDisplayCycleSeconds);console.log({id,queries,minFaceGap});
});
