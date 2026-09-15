import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeFiniteCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/rope-physics.js';
test('159 rope bending has a straight rest shape and scales with material length',async()=>{
 const mujoco=await loadMujoco();
 for(const segments of [32,64]){
  const p=makeFiniteCordTreadlePhysics(mujoco,{segments,bendingRigidity:.0002,bendingRelaxation:.04});
  try{
   const initial=p.state().points,lengths=initial.slice(1).map((v,i)=>Math.hypot(...v.map((x,k)=>x-initial[i][k])));
   const root=p.id('mjOBJ_JOINT','rope0');assert.equal(p.model.jnt_stiffness[root],0);
   for(let i=1;i<segments;i++){const j=p.id('mjOBJ_JOINT','rope'+i),q=p.model.jnt_qposadr[j];assert.ok(Math.abs(p.model.jnt_stiffness[j]*(lengths[i-1]+lengths[i])/2-.0002)<1e-12);p.data.qpos[q]=p.model.qpos_spring[q];}
   p.data.qvel.fill(0);mujoco.mj_forward(p.model,p.data);const points=p.state().points,dx=points[1][0]-points[0][0],dy=points[1][1]-points[0][1];
   for(const point of points)assert.ok(Math.abs(dx*(point[1]-points[0][1])-dy*(point[0]-points[0][0]))<1e-10);
   for(let i=0;i<segments;i++){const j=p.id('mjOBJ_JOINT','rope'+i);assert.ok(Math.abs(p.data.qfrc_passive[p.model.jnt_dofadr[j]])<1e-12);p.data.qvel[p.model.jnt_dofadr[j]]=Math.sin(i+.5);}
   mujoco.mj_forward(p.model,p.data);let power=0;for(let i=0;i<segments;i++){const j=p.id('mjOBJ_JOINT','rope'+i),d=p.model.jnt_dofadr[j];power+=p.data.qfrc_passive[d]*p.data.qvel[d];}assert.ok(power<0,'Internal damping must dissipate energy');
  }finally{p.dispose();}
 }
});
