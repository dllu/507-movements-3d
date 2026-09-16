import test from 'node:test';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {createAuthoredFreeEscapementMovement as create} from '../src/simulation/authored-free-escapements.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const models=[create({id:291}),create({id:313})];
function phases(g){return[...Array.from({length:1025},(_,i)=>i/1024),...Array.from({length:513},(_,i)=>g.impulseStartPhase+(g.impulseEndPhase-g.impulseStartPhase)*i/512),...Array.from({length:513},(_,i)=>(g.releasePhase??g.releaseStartPhase)+(g.relockPhase-(g.releasePhase??g.releaseStartPhase))*i/512)];}
function gapAt(a,b,points,field){const tr=b.matrixWorld.clone().invert().multiply(a.matrixWorld);let gap=Infinity;for(const p of points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.05)continue;gap=Math.min(gap,field.signedDistance(q));}return gap;}
test('313 finite impulse and locking faces retain full-cycle clearance and active proximity',()=>{
  const m=models[1],d=m.root.userData,b=d.blocks,g=d.geometry;
  for(const[name,target]of[['impulse',b.impulsePalletBody],['lock',b.lockingStoneT]]){
    const field=solidSurface(target.geometry),sources=b.escapeTeeth.map(a=>({a,points:surfacePoints(a.geometry)}));let min=Infinity,minActive=Infinity,maxActive=0;
    for(const phase of phases(g)){m.update(phase*g.balancePeriod);m.root.updateMatrixWorld(true);const s=d.stateAtTime(phase*g.balancePeriod),gap=Math.min(...sources.map(p=>gapAt(p.a,target,p.points,field)));min=Math.min(min,gap);if(name==='impulse'?s.impulseContactActive:(s.wheelLocked&&s.detentLift===0)){minActive=Math.min(minActive,gap);maxActive=Math.max(maxActive,gap);}}
    assert.ok(min>.00018,`${name} full-cycle gap ${min}`);assert.ok(minActive>.00018,`${name} active gap ${minActive}`);assert.ok(maxActive<.00022,`${name} working gap ${maxActive}`);
  }
  for(const phase of[g.impulseStartPhase,g.impulseEndPhase]){const s=d.contactGeometryAtPhase(phase),r=s.point.clone().sub(g.balanceCenter),n={x:-s.direction.y,y:s.direction.x};assert.ok(r.x*n.y-r.y*n.x>1.4,'one-sided face has the correct positive impulse moment');}
});
test('313 spokes overlap the bored hub and wheel rim, and the lock opposes clockwise torque',()=>{
  const m=models[1],d=m.root.userData,b=d.blocks,g=d.geometry;m.update(0);m.root.updateMatrixWorld(true);
  for(const spoke of b.wheelSpokes){
    for(const[target,r]of[[b.wheelHub,.225],[b.wheelRim,g.wheelRootRadius*.92-.04]]){
      const point=new THREE.Vector3(r,0,0).applyMatrix4(spoke.matrixWorld).applyMatrix4(target.matrixWorld.clone().invert());
      assert.ok(solidSurface(target.geometry).signedDistance(point)<-.01,`${spoke.userData.role} attaches to ${target.userData.role}`);
    }
  }
  const n=new THREE.Vector3(0,1,0).transformDirection(b.lockingStoneT.matrixWorld),r=g.lockingPoint.clone().sub(g.escapeWheelCenter);
  assert.ok(r.x*n.y-r.y*n.x>.4,'lock reaction resists clockwise wheel torque');
});
test('291 active impulse and lock faces are finite, with its free-return residual explicitly bounded',()=>{
  const m=models[0],d=m.root.userData,b=d.blocks,g=d.geometry,sources=surfacePoints(b.toothedDisk.geometry);
  let activeMin=Infinity,activeMax=0,returnMin=Infinity,lockMin=Infinity;
  const impulse=b.impulsePallet.userData.body,fi=solidSurface(impulse.geometry),fl=solidSurface(b.detentStopD.geometry);
  for(const phase of phases(g)){m.update(phase*g.balancePeriod);m.root.updateMatrixWorld(true);const s=d.stateAtTime(phase*g.balancePeriod),gap=gapAt(b.toothedDisk,impulse,sources,fi);returnMin=Math.min(returnMin,gap);lockMin=Math.min(lockMin,gapAt(b.toothedDisk,b.detentStopD,sources,fl));if(s.impulseContactActive){activeMin=Math.min(activeMin,gap);activeMax=Math.max(activeMax,gap);}}
  assert.ok(activeMin>0,`active impulse gap ${activeMin}`);assert.ok(activeMax<.0008);assert.ok(lockMin>.00018);
  assert.ok(returnMin>-.13,`queued free-return penetration ${returnMin}`); // Improvements are allowed.
});
test('291/313 arbors pass through bored hubs and reaching fixed journals',()=>{
  for(const m of models){const d=m.root.userData,b=d.blocks;m.update(0);m.root.updateMatrixWorld(true);
    const shaftPairs=[[b.wheelShaft,b.wheelHub],[b.wheelShaft,b.wheelBearing],[b.wheelShaft,b.wheelStandard],
      [b.balanceShaft,b.balanceHub??b.impulseRollerHub],[b.balanceShaft,b.balanceBearing],[b.balanceShaft,b.balanceStandard]];
    for(const[a,target]of shaftPairs){const gap=gapAt(a,target,surfacePoints(a.geometry),solidSurface(target.geometry));assert.ok(gap>.0015,`${target.userData.role} bore clearance ${gap}`);}
    // Both standards and actual journal meshes overlap the shaft axially.
    for(const[shaft,bearing]of[[b.wheelShaft,b.wheelBearing],[b.balanceShaft,b.balanceBearing]]){shaft.geometry.computeBoundingBox();bearing.geometry.computeBoundingBox();const a=shaft.geometry.boundingBox.clone().applyMatrix4(shaft.matrixWorld),c=bearing.geometry.boundingBox.clone().applyMatrix4(bearing.matrixWorld);assert.ok(Math.min(a.max.z,c.max.z)-Math.max(a.min.z,c.min.z)>.25);}
  }
});
test('free-escapement state/playback preserves scene identities, readable timing and clean framing',()=>{
  for(const m of models){const initial=[];m.root.traverse(o=>initial.push([o,o.geometry]));for(let i=0;i<32;i++){m.root.userData.stateAtTime(i*.17);m.update(i*.17);}const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,initial);assert.equal(m.root.userData.minimumDisplayCycleSeconds,4);assert.equal(m.root.userData.hideGround,true);assert.equal(m.root.userData.blocks.cameraEnvelope.visible,false);m.root.traverse(o=>{for(const material of[].concat(o.material??[]))assert.equal(material.fog,false);});}
});
