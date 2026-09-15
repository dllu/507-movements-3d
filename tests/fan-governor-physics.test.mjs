import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeFanGovernorPhysics} from '../src/simulation/mujoco-fan-governor/physics.js';
const mujoco=await loadMujoco();
const run=options=>{
 const p=makeFanGovernorPhysics(mujoco,options);
 try{
  assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.nq,5);
  for(let i=0;i<Math.round(6/p.timestep);i++)p.step();
  assert.equal(p.data.qfrc_applied[1],0);
  const state=p.state();assert.ok(Object.values(state).every(Number.isFinite));return state;
 }finally{p.dispose();}
};
test('147 passive prototype rises from air drag and increasing shaft speed',()=>{
 const noDrag=run({drag:0}),slow=run({speed:1.5}),fast=run({});
 assert.ok(slow.lift>noDrag.lift+.03);
 assert.ok(fast.lift>slow.lift+.5);
 assert.ok(fast.lag>slow.lag+.5&&fast.lag<1.3);
 assert.ok(Math.abs(fast.speed-3)<.01);
});
test('147 prototype steady response converges with timestep and track resolution',()=>{
 const base=run({}),fineTime=run({timestep:.0005}),fineTrack=run({segments:320});
 assert.ok(Math.abs(base.lift-fineTime.lift)<1e-5);
 assert.ok(Math.abs(base.lift-fineTrack.lift)<.001);
 assert.ok(Math.abs(base.lag-fineTrack.lag)<.001);
});
test('147 crosshead stays free when contact and gravity are removed',()=>{
 const p=makeFanGovernorPhysics(mujoco,{gravity:0,drag:0});
 try{
  p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);
  const initial=Array.from(p.data.qpos);
  for(let i=0;i<3000;i++)p.step();
  assert.ok(p.data.qpos[0]>initial[0]+1);
  for(let i=1;i<5;i++)assert.equal(p.data.qpos[i],initial[i]);
 }finally{p.dispose();p.dispose();}
});
