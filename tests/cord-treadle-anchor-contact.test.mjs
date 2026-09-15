import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeFiniteCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/rope-physics.js';
import {cordTreadleRigidProperties} from '../src/simulation/mujoco-cord-treadle/inertia.js';
import {cordTreadleParameters} from '../src/simulation/cord-treadle-motion.js';
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const distance=(p,a,b)=>{const d=b.map((v,i)=>v-a[i]),u=p.map((v,i)=>v-a[i]);const t=Math.max(0,Math.min(1,u.reduce((s,v,i)=>s+v*d[i],0)/d.reduce((s,v)=>s+v*v,0)));return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));};
test('slack cord outside the secured region cannot fold through its anchor',async()=>{
 const mujoco=await loadMujoco(),g=cordTreadleParameters();
 const p=makeFiniteCordTreadlePhysics(mujoco,{rigidProperties:cordTreadleRigidProperties(),initialBow:.02,bendingRigidity:.0002,bendingRelaxation:.4});
 let minimum=Infinity;
 try{for(let tick=0;tick<=4000;tick++){
  assert.ok(Math.abs(p.data.time-tick*p.timestep)<1e-8,'Unexpected native reset');
  if(tick%20===0){mujoco.mj_forward(p.model,p.data);const s=p.state(),points=s.points,lengths=points.slice(1).map((q,i)=>Math.hypot(...q.map((v,j)=>v-points[i][j]))),total=lengths.reduce((a,b)=>a+b,0);
   const heads=[[g.pin[0]*Math.cos(s.disk)-g.pin[1]*Math.sin(s.disk),g.pin[0]*Math.sin(s.disk)+g.pin[1]*Math.cos(s.disk),.64],[g.pivot[0]-g.armLength*Math.cos(s.treadle),g.pivot[1]-g.armLength*Math.sin(s.treadle),.64]];
   let material=0;
   lengths.forEach((length,i)=>{heads.forEach((head,h)=>{
    const low=h===0?Math.max(0,.15-material):0,high=h===1?Math.min(length,total-.15-material):length;
    if(high>low)minimum=Math.min(minimum,distance(head,lerp(points[i],points[i+1],low/length),lerp(points[i],points[i+1],high/length))-.12);
   });material+=length;});
  }
  if(tick<4000)p.step();
 }
 assert.ok(minimum>-.001,`Anchor penetration ${-minimum} exceeds 0.001 display units`);
 }finally{p.dispose();}
});
