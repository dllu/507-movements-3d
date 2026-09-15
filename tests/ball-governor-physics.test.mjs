import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeBallGovernorPhysics} from '../src/simulation/mujoco-ball-governor/physics.js';
const m=await loadMujoco();
test('161 centrifugal linkage raises its passive sleeve with only spindle actuation',()=>{
 const p=makeBallGovernorPhysics(m);try{const initial=p.state();let largest=initial.sleeveY;for(let i=0;i<16000;i++){p.step();if(i%20===0){const s=p.state();assert.ok(Math.max(...s.connectionErrors)<1e-5);assert.ok(Math.abs(s.leftSpread-s.rightSpread)<1e-10);largest=Math.max(largest,s.sleeveY);}}assert.equal(p.model.nu,1);assert.ok(largest-initial.sleeveY>.3);}finally{p.dispose();}
});
test('161 without spindle drive gravity lowers the arms instead of retaining scripted spread',()=>{
 const p=makeBallGovernorPhysics(m,{spindleDrive:false});try{const initial=p.state();for(let i=0;i<1000;i++)p.step();assert.equal(p.model.nu,0);assert.ok(p.state().leftSpread<initial.leftSpread-.05);assert.ok(p.state().sleeveY<initial.sleeveY);}finally{p.dispose();}
});
