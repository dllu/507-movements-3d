import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeSpringTreadlePhysics} from '../src/simulation/mujoco-spring-return-treadle/coupled-physics.js';
const m=await loadMujoco();
test('160 gravity and inferred prestress balance in the source pose with no foot pressure',()=>{
 const p=makeSpringTreadlePhysics(m,{footLoad:0});try{
  for(let i=0;i<4000;i++)p.step();const s=p.state();
  assert.ok(Math.max(...s.qpos.map(Math.abs))<1e-10);assert.ok(s.tension>35&&s.tension<37);assert.equal(p.model.nu,0);assert.equal(p.model.opt.gravity[1],-98.1);
 }finally{p.dispose();}
});
test('160 removing the band releases the treadle under gravity',()=>{
 const p=makeSpringTreadlePhysics(m,{footLoad:0,band:false});try{for(let i=0;i<1600;i++)p.step();assert.ok(p.state().treadle<-.08);assert.equal(p.state().tension,0);}finally{p.dispose();}
});
test('160 foot pressure drives a repeating spring return with bounded band compliance',()=>{
 const p=makeSpringTreadlePhysics(m);try{
  let low=0,maxExtension=0,minTension=Infinity,firstEnd;
  for(let tick=0;tick<=64000;tick++){
   if(tick%80===0){const s=p.state();low=Math.min(low,s.treadle);maxExtension=Math.max(maxExtension,s.bandExtension);if(tick>0)minTension=Math.min(minTension,s.tension);if(tick===32000)firstEnd=s;}
   if(tick<64000)p.step();
  }
  const last=p.state();assert.ok(low<-.08);assert.ok(maxExtension<.0025);assert.ok(minTension>25);
  assert.ok(Math.abs(last.treadle)<.0001);assert.ok(Math.max(...last.qpos.map((x,i)=>Math.abs(x-firstEnd.qpos[i])))<1e-7);
 }finally{p.dispose();}
});
