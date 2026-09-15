import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {cordTreadleParameters,cordTreadleState,cordTreadleMetrics} from '../src/simulation/cord-treadle-motion.js';
import {makeCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/physics.js';
test('159 taut path closes with tangent spans and records the floor conflict',()=>{
 const g=cordTreadleParameters();let lowest=Infinity;
 for(let i=0;i<=1024;i++){
  const s=cordTreadleState(g.period*i/1024,g);assert.ok(Math.abs(s.length-g.cordLength)<1e-12);lowest=Math.min(lowest,s.foot[1]);
  for(const [end,tangent]of [[s.pin,s.entry],[s.eye,s.exit]]){const radius=[tangent[0]-g.guide[0],tangent[1]-g.guide[1]],span=[end[0]-tangent[0],end[1]-tangent[1]];assert.ok(Math.abs(Math.hypot(...radius)-g.guideRadius)<1e-12);assert.ok(Math.abs(radius[0]*span[0]+radius[1]*span[1])<1e-12);}
 }
 assert.ok(g.groundY-lowest>2);assert.ok(Math.abs(cordTreadleState(0,g).treadleAngle-g.initialTreadle)<1e-12);
});
test('159 MuJoCo cord pulls a passive treadle and matches independent tangent length',async()=>{
 const mujoco=await loadMujoco(),p=makeCordTreadlePhysics(mujoco),g=cordTreadleParameters();let maxTautError=0,minTorque=0;
 try{
  assert.equal(p.model.nq,2);assert.equal(p.model.nu,1);
  for(let i=0;i<=8000;i++){
   if(i%40===0){mujoco.mj_forward(p.model,p.data);const s=p.state(),m=cordTreadleMetrics(s.qpos[0],s.qpos[1],g);assert.ok(Math.abs(m.length-s.cordLength)<1e-10);assert.equal(s.actuatorTorque,0);assert.ok(s.passiveConstraintTorque<=1e-9);minTorque=Math.min(minTorque,s.passiveConstraintTorque);maxTautError=Math.max(maxTautError,Math.abs(s.qpos[1]-cordTreadleState(s.qpos[0]*g.period/(2*Math.PI),g).treadleAngle));}
   if(i<8000)p.step();
  }
  assert.ok(minTorque<-1);assert.ok(maxTautError<.0001);
 }finally{p.dispose();}
});
test('159 removing the cord releases the treadle instead of retaining scripted motion',async()=>{
 const mujoco=await loadMujoco(),p=makeCordTreadlePhysics(mujoco,{cord:false});
 try{for(let i=0;i<2000;i++)p.step();mujoco.mj_forward(p.model,p.data);const s=p.state();assert.equal(s.passiveConstraintTorque,0);assert.equal(s.actuatorTorque,0);assert.ok(s.qpos[1]>1);assert.equal(p.model.ntendon,0);}finally{p.dispose();}
});
test('159 floor contact stops the treadle while the cord goes slack and picks up again',async()=>{
 const mujoco=await loadMujoco(),p=makeCordTreadlePhysics(mujoco,{floor:true,timestep:.00025});let slack=0,contacts=0,taut=0,clearance=Infinity;
 try{
  for(let i=0;i<=32000;i++){
   if(i%40===0){mujoco.mj_forward(p.model,p.data);const s=p.state();slack=Math.max(slack,p.description.cordLength-s.cordLength);contacts+=s.floorContacts>0;taut+=Math.abs(s.cordLength-p.description.cordLength)<.0001;clearance=Math.min(clearance,s.footBottom-p.description.groundY);assert.equal(s.actuatorTorque,0);}
   if(i<32000)p.step();
  }
  assert.ok(slack>1);assert.ok(contacts>100);assert.ok(taut>100);assert.ok(clearance>-.003);
 }finally{p.dispose();}
});
