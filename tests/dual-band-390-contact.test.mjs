import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredDualBandRatchetMovement as create} from '../src/simulation/authored-dual-band-ratchets.js';
import {dualBandPawlDimensions as d, dualBandSeatPhase, toe390Contact, pawl390Angle,dualBandToothPitch} from '../src/simulation/dual-band-pawl-contact.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const model=create({id:390}),data=model.root.userData,b=data.blocks;
test('390 uses opposed finite bored pawls with a seat normal that drives and seats',()=>{
  assert.ok(Math.abs(b.crossedPawl.userData.mountPhase-b.openPawl.userData.mountPhase-Math.PI)<1e-14);
  assert.ok(d.length>10*d.pinRadius);
  const contact=toe390Contact(d.seatAngle,dualBandSeatPhase);
  assert.ok(contact.gap>0&&contact.gap<.00005);
  assert.ok(contact.u>.2&&contact.u<.8,'working contact is on a finite flank, not a tip');
  assert.ok(contact.seatingMoment>.020,'positive moment presses against the inward stop');
  assert.ok(contact.outputMoment>.28,'reaction drives the output in its intended direction');
  const reverse=toe390Contact(d.seatAngle,dualBandSeatPhase-.001);
  assert.ok(reverse.gap<0,'opposed reverse motion is blocked by the actual tooth flank');
});
test('390 finite pawl, journal and stop surfaces remain clear through drive and return',()=>{
  const pairs=[];
  for(const[c,w]of[[b.openCarrier,b.openRatchet],[b.crossedCarrier,b.crossedRatchet]])for(const[name,a,target,minimum]of[
    ['pawl/ratchet',c.userData.pawlBody,w,.00003],
    ['pawl/stop',c.userData.pawlBody,c.userData.pawlStop,.00005],
    ['pin/bored eye',c.userData.pawlPin,c.userData.pawlBody,.0009],
    ['pawl/carrier face',c.userData.pawlBody,c.userData.pulley,.037],
  ])pairs.push({name,a,target,minimum,points:surfacePoints(a.geometry),field:solidSurface(target.geometry),gap:Infinity});
  for(let i=0;i<=512;i++){
    model.update(i/64);model.root.updateMatrixWorld(true);
    for(const p of pairs){const tr=p.target.matrixWorld.clone().invert().multiply(p.a.matrixWorld);for(const point of p.points){const q=point.clone().applyMatrix4(tr);if(p.field.box.distanceToPoint(q)>p.gap)continue;p.gap=Math.min(p.gap,p.field.signedDistance(q));}}
  }
  for(const p of pairs)assert.ok(p.gap>p.minimum,`${p.name}: ${p.gap}`);
});
test('390 baked return is continuous across crests, handoffs and cycle boundaries',()=>{
  let previous=data.stateAtTime(0),maxSpeed=0;
  const n=32768,dt=8/n;
  for(let i=1;i<=n;i++){
    const s=data.stateAtTime(i*dt);
    for(const key of['openPawl','crossedPawl'])maxSpeed=Math.max(maxSpeed,Math.abs(s[key].liftAngle-previous[key].liftAngle)/dt);
    previous=s;
  }
  assert.ok(maxSpeed<40,`bounded pawl angular speed ${maxSpeed}`);
  for(const q of[0,dualBandToothPitch,d.dropEnd]){
    const a=pawl390Angle(q-1e-8,{overrunning:true,advance:3});
    const c=pawl390Angle(q+1e-8,{overrunning:true,advance:3});
    assert.ok(Math.abs(a-c)<1e-5,'no crest wrap teleport');
  }
});
test('390 every driving phase retains the same finite working contact and drop completes before pickup',()=>{
  for(let i=0;i<1024;i++){
    const s=data.stateAtTime(i/128);
    for(const key of['openPawl','crossedPawl']){
      const p=s[key];
      if(p.active){const contact=toe390Contact(d.seatAngle+p.liftAngle,dualBandSeatPhase+p.relativeAngle);assert.ok(contact.gap>0&&contact.gap<.00005);assert.ok(contact.outputMoment>.28);}
      if(p.takingUp)assert.ok(Math.abs(p.liftAngle)<1e-9,'pawl has already dropped before take-up');
    }
  }
});
test('390 state sampling and playback retain finite component geometry identities',()=>{
  const initial=[];model.root.traverse(o=>initial.push([o,o.geometry]));
  for(let i=0;i<64;i++){data.stateAtTime(i*.13);model.update(i*.13);}
  const after=[];model.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,initial);
});
