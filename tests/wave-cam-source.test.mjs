import test from 'node:test';
import assert from 'node:assert/strict';
import load from '@mujoco/mujoco';
import {waveCamGeometry,waveCamHeight,waveCamTrace,waveCamTraceY} from '../src/simulation/mujoco-wave-cam/profile.js';
import {waveCamProfileAngles} from '../src/simulation/mujoco-wave-cam/adaptive-profile.js';
import {makeWaveCamPhysics} from '../src/simulation/mujoco-wave-cam/physics.js';

test('165 source silhouette interpolates its measurements without overshoot',()=>{
 for(let i=0;i<waveCamTrace.length-1;i++){
  const [x,y]=waveCamTrace[i],[nextX,nextY]=waveCamTrace[i+1];
  assert.ok(Math.abs(waveCamTraceY(x)-y)<1e-10);
  for(let j=0;j<=32;j++){
   const v=waveCamTraceY(x+(nextX-x)*j/32);
   assert.ok(v>=Math.min(y,nextY)-1e-10&&v<=Math.max(y,nextY)+1e-10);
  }
 }
});

test('165 relieved cam clears the finite source roller and repeats continuously',()=>{
 const g=waveCamGeometry();let minimum=Infinity;
 for(let i=0;i<=512;i++)for(let j=0;j<=32;j++){
  const dx=g.rollerRadius*Math.sin(-Math.PI/2+Math.PI*i/512),x=g.rollerX+dx,z=g.rollerZ-g.rollerDepth/2+g.rollerDepth*j/32;
  if(Math.hypot(x,z)>g.outerRadius)continue;
  const top=g.rollerY+Math.sqrt(Math.max(0,g.rollerRadius**2-dx**2));
  minimum=Math.min(minimum,waveCamHeight(Math.atan2(x,z),g)-top);
 }
 assert.ok(minimum>=-1e-12&&minimum<1e-5);
 for(let i=0;i<200;i++){
  const a=i*Math.PI/100;
  assert.ok(Math.abs(waveCamHeight(a)-waveCamHeight(a+Math.PI))<1e-12);
 }
 assert.ok(Math.abs(waveCamHeight(Math.PI/2-1e-7)-waveCamHeight(Math.PI/2+1e-7))<1e-8);
});

test('165 passive follower moves by contact without a jammed input',async()=>{
 const m=await load(),states=[];
 for(const contact of [true,false]){
  const p=makeWaveCamPhysics(m,{contact,segments:90,profileTolerance:.001});
  try{
   assert.equal(p.model.nu,1);
   let maximumPenetration=0;
   for(let i=0;i<36000;i++){p.step();maximumPenetration=Math.max(maximumPenetration,p.state().penetration);}
   const s=p.state();assert.ok(Math.abs(s.cam-2*Math.PI)<.015);states.push(s);
   if(contact){assert.ok(s.closure<1e-5);assert.ok(maximumPenetration<.005,'study contact error remains below 0.28 source pixel throughout the revolution');assert.ok(s.outputY>.67&&s.outputY<.71);}
  }finally{p.dispose();}
 }
 assert.ok(Math.abs(states[0].outputY-states[1].outputY)>.5);
});

test('165 adaptive cells resolve the narrow relief edge within the profile tolerance',()=>{
 for(const tolerance of [.001,.0005]){
  const angles=waveCamProfileAngles({tolerance});
  assert.equal(angles[0],0);assert.equal(angles.at(-1),2*Math.PI);
  assert.ok(angles.length<700,'target the sharp transitions without a uniformly huge mesh');
  for(let i=1;i<angles.length;i++){
   const a=angles[i-1],b=angles[i];assert.ok(b>a);
   for(let j=0;j<=128;j++){
    const u=j/128,chord=(1-u)*waveCamHeight(a)+u*waveCamHeight(b);
    assert.ok(Math.abs(waveCamHeight(a+(b-a)*u)-chord)<tolerance);
   }
  }
 }
});
