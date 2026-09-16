import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredAlternatingWeightedRackMovement as create} from '../src/simulation/authored-alternating-weighted-racks.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const m=create({id:391}),d=m.root.userData,b=d.blocks;
const find=role=>{let result;m.root.traverse(o=>{if(o.userData.role===role)result=o});return result};
const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{points:surfacePoints(o.geometry),solid:solidSurface(o.geometry)});return cache.get(o);};
function gap(a,c){const field=get(c).solid,tr=c.matrixWorld.clone().invert().multiply(a.matrixWorld);let minimum=Infinity;
 for(const p of get(a).points){const q=p.clone().applyMatrix4(tr);if(field.box.distanceToPoint(q)>.03)continue;minimum=Math.min(minimum,field.signedDistance(q,.08));}
 return minimum;
}
const clear=(a,c)=>Math.min(gap(a,c),gap(c,a));
test('391 both full-sized racks, weights and arms clear the pinion through strokes and both handoffs',()=>{
 const wheel=b.outputGear.userData.wheel;
 let minimum=Infinity,workingMaximum=0;
 for(let i=0;i<=256;i++){
  m.update(i/32);m.root.updateMatrixWorld(true);const state=d.stateAtTime(i/32);let working=Infinity;
  for(const rack of[b.leftRack,b.rightRack]){
   for(const part of[...rack.userData.teeth,rack.userData.body,rack.userData.weight,...rack.userData.weightArm.children])minimum=Math.min(minimum,clear(part,wheel));
   if((rack.userData.side<0?state.leftRack:state.rightRack).engaged)for(const tooth of rack.userData.teeth)working=Math.min(working,gap(tooth,wheel));
  }
  if(Number.isFinite(working))workingMaximum=Math.max(workingMaximum,working);
 }
 assert.ok(minimum>.0008,`minimum finite solid clearance ${minimum}`);
 assert.ok(workingMaximum<.004,`active flank proximity retained ${workingMaximum}`);
});
test('391 guide pins, bored pivots, weights and lowered input interfaces remain clear',()=>{
 const pairs=[];
 for(const [rack,guide]of[[b.leftRack,b.leftGuide],[b.rightRack,b.rightGuide]]){
  pairs.push([rack.userData.guidePin,guide.userData.casting],[rack.userData.pivotBore,rack.userData.pivotBoss],[rack.userData.pivotBore,rack.userData.body],[rack.userData.weight,b.crossheadBeam],[rack.userData.pivotBoss,b.crossheadBeam]);
  for(const o of rack.userData.weightArm.children)pairs.push([o,b.crossheadBeam]);
 }
 pairs.push([b.pistonRod,find('fixed-machine-bed')],[b.pistonRod,find('fixed-piston-rod-guide-collar')],[b.outputGear.userData.shaft,find('fixed-output-shaft-bearing-standard')]);
 for(let i=0;i<=64;i++){m.update(i/8);m.root.updateMatrixWorld(true);for(const[a,c]of pairs)assert.ok(clear(a,c)>-2e-6,`${i}: ${a.userData.role}/${c.userData.role}`);}
});
test('391 changes the plain lower lever arm while preserving working tooth dimensions and phase',()=>{
 assert.equal(d.geometry.rackRootExtension,.60);assert.equal(d.finiteInterfaceReview.toothProfile.addendum,.065);
 assert.equal(b.leftRack.userData.teeth.length,17);assert.equal(b.rightRack.userData.teeth.length,17);assert.equal(d.geometry.pinionToothCount,20);
 assert.ok(Math.abs(d.geometry.crossheadLowY+b.leftRack.userData.teeth[0].position.y-(-2.76+.24))<1e-12);
 assert.ok(d.geometry.crossheadHighY<-1.39,'upper pivot remains well below the pinion');
 assert.ok(get(b.outputGear.userData.wheel).solid.inside(new T.Vector3(.30,0,0)),'pinion is a finite solid');
});
test('391 input rod remains inside its fixed guide and pivot pins span the crosshead and rack eyes',()=>{
 const guide=find('fixed-piston-rod-guide-collar');
 for(const time of[0,3.36,4,7.36,8]){
  m.update(time);m.root.updateMatrixWorld(true);const rod=new T.Box3().setFromObject(b.pistonRod),guideBox=new T.Box3().setFromObject(guide);
  assert.ok(rod.min.y<guideBox.min.y&&rod.max.y>guideBox.max.y,'rod spans both guide faces');
  const beam=new T.Box3().setFromObject(b.crossheadBeam);
  for(const rack of[b.leftRack,b.rightRack]){const pin=new T.Box3().setFromObject(rack.userData.pivotBore),boss=new T.Box3().setFromObject(rack.userData.pivotBoss);assert.ok(pin.min.z<beam.min.z&&pin.max.z>boss.max.z);}
 }
});
test('391 handoff positions and rates are continuous, with the prescribed dwell selection disclosed',()=>{
 for(const t of[0,3.36,4,7.36,8]){const before=d.stateAtTime(t-1e-7),after=d.stateAtTime(t+1e-7);for(const key of['crossheadY','crossheadVelocity','outputAngle','outputAngularSpeed'])assert.ok(Math.abs(after[key]-before[key])<1e-6,`${key} at ${t}`);for(const rack of['leftRack','rightRack']){assert.ok(Math.abs(after[rack].rackAngle-before[rack].rackAngle)<1e-6);assert.ok(after[rack].guidePin.distanceTo(before[rack].guidePin)<1e-6);}}
 assert.match(d.finiteInterfaceReview.qualification,/dwells.*prescribed.*not a passive force solution/);
});
test('391 playback retains scene objects and geometry buffers',()=>{
 const before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<65;i++)m.update(i/8);const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
});
test('391 output stays unbounded across repeated piston cycles and its face mark closes after five',()=>{
 for(let cycle=-3;cycle<=7;cycle++){
  const t=8*cycle,a=d.stateAtTime(t-1e-7),c=d.stateAtTime(t+1e-7);assert.ok(Math.abs(c.outputAngle-a.outputAngle)<1e-6,'no output-index jump at piston reset');
  assert.ok(Math.abs(d.stateAtTime(t+8).outputAngle-d.stateAtTime(t).outputAngle+.8*2*Math.PI)<2e-14);
 }
 const a=d.stateAtTime(1.23),c=d.stateAtTime(41.23);assert.ok(Math.abs(c.outputAngle-a.outputAngle+4*2*Math.PI)<2e-14);assert.ok(Math.abs(c.crossheadY-a.crossheadY)<2e-14);
 for(const t of[3.36,4]){const a=d.stateAtTime(t-1e-6),b=d.stateAtTime(t),c=d.stateAtTime(t+1e-6);assert.ok(Math.abs((c.elbowAssist.leverAngle-a.elbowAssist.leverAngle)/2e-6)<1e-5,'prescribed lever returns with zero endpoint speed');}
});
