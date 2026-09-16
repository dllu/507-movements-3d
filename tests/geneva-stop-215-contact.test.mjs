import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredIntermittentMovement as make} from '../src/simulation/authored-intermittent.js';
import {solidSurface} from './helpers/solid-surface.mjs';
const m=make({id:215}),d=m.root.userData,g=d.geometry,b=d.blocks,step=Math.PI/3,tau=2*Math.PI;
const wheel=solidSurface(b.stopWheelBody.geometry),pin=solidSurface(b.facePin.geometry),outline=g.workingStopWheelRegions[0][0];
function pose(u){const s=d.stateAtInputTravel(u);b.driver.userData.rotor.rotation.z=s.driverAngle;b.stopWheel.userData.rotor.rotation.z=s.stopWheelAngle;m.root.updateMatrixWorld(true);return s;}
function nearest(s){const p=s.engagement.pinInStopWheelLocal,edges=[];let distance=Infinity;for(let i=1;i<outline.length;i++){const a=outline[i-1],z=outline[i],dx=z[0]-a[0],dy=z[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/len)):0,q=new T.Vector2(a[0]+t*dx,a[1]+t*dy),r=q.distanceTo(p);distance=Math.min(distance,r);edges.push({q,r,torque:(q.x*(q.y-p.y)-q.y*(q.x-p.x))/r});}const candidates=edges.filter(e=>e.r<distance+1e-6);return{gap:distance-g.pinRadius,loaded:candidates.sort((a,b)=>b.torque-a.torque)[0]};}

test('215 each reconstructed mouth keeps a real compressive pin face with positive output torque',t=>{
 let minGap=Infinity,maxGap=-Infinity,minTorque=Infinity,maxMeshGap=0;
 for(let k=-2;k<=2;k++)for(const[start,end]of[[.004,.025],[step-.025,step+.014]])for(let i=0;i<=40;i++){
  const u=k*tau+start+(end-start)*i/40;if(u<g.reverseInputLimit||u>g.forwardInputLimit)continue;const s=pose(u),n=nearest(s);minGap=Math.min(minGap,n.gap);maxGap=Math.max(maxGap,n.gap);minTorque=Math.min(minTorque,n.loaded.torque);
  assert.ok(n.gap>-1e-6&&n.gap<1e-6,`pin/mouth gap at ${s.inputTravel}: ${n.gap}`);
  assert.ok(n.loaded.torque>2.3,`compressive pin must drive positive output: ${n.loaded.torque}`);
  const q=new T.Vector3(n.loaded.q.x,n.loaded.q.y,0),world=b.stopWheelBody.localToWorld(q.clone()),pinLocal=b.facePin.worldToLocal(world);
  maxMeshGap=Math.max(maxMeshGap,pin.distance(pinLocal));
  assert.ok(wheel.distance(q)<3e-7,'contact remains on actual extruded load surface');
  assert.ok(pin.distance(pinLocal)<1.4e-5,'actual 256-sided pin reaches the load surface');
 }
 t.diagnostic(JSON.stringify({minGap,maxGap,minTorque,maxMeshGap}));
});

test('215 actual crescent and wheel stay within chord tolerance through pickup and final lock capture',t=>{
 let minCam=Infinity,maxUnsupported=0;
 for(let k=-2;k<=2;k++)for(const[start,end]of[[-.008,.025],[step-.025,step+.035]])for(let i=0;i<=24;i++){
  const u=k*tau+start+(end-start)*i/24;if(u<g.reverseInputLimit||u>g.forwardInputLimit)continue;const s=pose(u),n=nearest(s);let cam=Infinity;
  for(const point of g.lockingCamOutline){const p=point.clone().rotateAround({x:0,y:0},s.driverAngle).add(g.driverCenter).sub(g.stopWheelCenter).rotateAround({x:0,y:0},-s.stopWheelAngle);cam=Math.min(cam,wheel.signedDistance(new T.Vector3(p.x,p.y,0),.2));}
  minCam=Math.min(minCam,cam);maxUnsupported=Math.max(maxUnsupported,Math.min(Math.abs(cam),Math.abs(n.gap)));
  assert.ok(cam>-2.2e-5,`finite crescent/wheel overlap ${cam}`);
  assert.ok(n.gap>-1e-6,`pin must remain outside mouth ${n.gap}`);
  assert.ok(Math.min(Math.abs(cam),Math.abs(n.gap))<2.2e-5,'pin or crescent must retain a load face throughout handoff');
 }
 t.diagnostic(JSON.stringify({minCam,maxUnsupported}));
});

test('215 corrected public law, velocity and contact flags agree through repeated forward and reverse playback',()=>{
 let previous=-Infinity;
 for(let i=0;i<=8192;i++){
  const u=g.reverseInputLimit+(g.forwardInputLimit-g.reverseInputLimit)*i/8192,s=d.stateAtInputTravel(u,.7,.12);
  assert.ok(s.stopWheelAngle>=previous-1e-12);previous=s.stopWheelAngle;
  assert.equal(s.stopWheelAngle,d.stopWheelAngleAtInputTravel(s.inputTravel));
  assert.equal(s.engagement.instantaneousRatio,d.engagementAtInputTravel(u).instantaneousRatio);
  assert.equal(s.engagement.active,s.engagement.instantaneousRatio>1e-12);
  assert.equal(s.stopWheelAngularSpeed,s.engagement.instantaneousRatio*s.inputAngularSpeed);
  assert.ok(Number.isFinite(s.stopWheelAngularAcceleration));
  if(i>0&&i<8192&&i%16===0){const h=1e-7,ratio=(d.stopWheelAngleAtInputTravel(u+h)-d.stopWheelAngleAtInputTravel(u-h))/(2*h);assert.ok(Math.abs(ratio-s.engagement.instantaneousRatio)<2e-7);}
 }
 for(let k=-1;k<=2;k++)for(const a of[0,d.contactBranch.entryEnd,d.contactBranch.exitStart,d.contactBranch.exitEnd,tau]){
  const u=k*tau+a,h=1e-8,left=d.stateAtInputTravel(u-h),right=d.stateAtInputTravel(u+h);
  assert.ok(Math.abs(left.stopWheelAngle-right.stopWheelAngle)<3e-8);
  assert.ok(Math.abs(left.engagement.instantaneousRatio-right.engagement.instantaneousRatio)<2e-5,'C1 law at baked/analytic joins');
 }
 for(let i=0;i<=256;i++){m.update(d.timeline.demonstrationPeriod*i/256);const s=d.kinematics;assert.equal(b.stopWheel.userData.rotor.rotation.z,s.stopWheelAngle);assert.equal(b.stopWheel.userData.angularSpeed,s.stopWheelAngularSpeed);assert.equal(d.contacts.facePinSlot?.active??false,s.engagement.active);assert.equal(d.contacts.crescentLockingPocket?.active??false,s.lock.active);}
});

test('215 keeps source oracle, terminal limits and buffers while disclosing the selected reverse bias',()=>{
 assert.equal(d.sourceAnimation.available,true);assert.equal(d.sourceAnimation.runtimeReconstructsFiniteMouthHandoffs,true);
 assert.ok(Math.abs(d.sourceKinematics.stopWheelAngleAtInputTravel(.005)-d.stopWheelAngleAtInputTravel(.005))>.001);
 for(const u of[g.reverseInputLimit,g.forwardInputLimit])assert.equal(d.stopWheelAngleAtInputTravel(u),d.sourceKinematics.stopWheelAngleAtInputTravel(u));
 assert.equal(d.contactBranch.forceSolved,false);assert.match(d.reconstructionNote,/reverse playback requires assisting preload/);
 const before=[];m.root.traverse(o=>before.push([o,o.geometry]));for(let i=0;i<128;i++)m.update(d.timeline.demonstrationPeriod*i/127);const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(before,after);
 for(const [time,marker,contact]of[[d.canonicalTimes.forwardStopMidHold,b.forwardContactMarker,g.forwardStopContact],[d.canonicalTimes.reverseStopMidHold,b.reverseContactMarker,g.reverseStopContact]]){m.update(time);assert.equal(marker.visible,true);assert.ok(marker.position.distanceTo(new T.Vector3(contact.contactPoint.x,contact.contactPoint.y,g.stopWheelDepth/2+.12))<1e-10);}
});
