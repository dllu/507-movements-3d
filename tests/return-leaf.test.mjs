import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {Vector3} from 'three';
import {sourceLeaf,springReturnSource as source} from '../src/simulation/mujoco-spring-return-treadle/source.js';
import {makeReturnLeafPhysics} from '../src/simulation/mujoco-spring-return-treadle/leaf-physics.js';
const mujoco=await loadMujoco();
test('160 rest leaf follows traced ink centerline and its measured attachment',()=>{
 const s=sourceLeaf({segments:64,tailSegments:12});let maximum=0;
 for(const [x,y] of source.centerline){
  const target=new Vector3((x-source.origin[0])*source.scale,(source.origin[1]-y)*source.scale,0);let distance=Infinity;
  for(let j=1;j<s.points.length;j++){const a=s.points[j-1],d=s.points[j].clone().sub(a),t=Math.max(0,Math.min(1,target.clone().sub(a).dot(d)/d.lengthSq()));distance=Math.min(distance,target.distanceTo(a.clone().addScaledVector(d,t)));}
  maximum=Math.max(maximum,distance/source.scale);
 }
 console.log({maximumTraceDistancePixels:maximum});assert.ok(maximum<.25);
 const p=makeReturnLeafPhysics(mujoco,{load:0});try{
  const initial=p.state();assert.ok(Math.hypot(...initial.tie.map((x,i)=>x-s.tie.toArray()[i]))<1e-12);
  for(let i=0;i<1000;i++)p.step();assert.ok(p.data.qpos.every(x=>Math.abs(x)<1e-12));assert.equal(p.model.nu,0);
 }finally{p.dispose();}
});
test('160 force application agrees with independent virtual work at the tie',()=>{
 const p=makeReturnLeafPhysics(mujoco);try{
  for(let i=0;i<2400;i++)p.step();
  const q=Array.from(p.data.qpos);mujoco.mj_forward(p.model,p.data);p.step();const force=Array.from(p.data.qfrc_applied),tieId=p.id('mjOBJ_SITE','tie'),h=1e-7;
  for(let j=0;j<q.length;j++){
   p.data.qpos.set(q);p.data.qpos[j]+=h;mujoco.mj_forward(p.model,p.data);const plus=p.data.site_xpos[3*tieId+1];
   p.data.qpos.set(q);p.data.qpos[j]-=h;mujoco.mj_forward(p.model,p.data);const minus=p.data.site_xpos[3*tieId+1];
   assert.ok(Math.abs(force[j]-(-10*(plus-minus)/(2*h)))<1e-6,`joint ${j}`);
  }
 }finally{p.dispose();}
});
test('160 loaded leaf preserves material lengths and returns after release without an actuator',()=>{
 const p=makeReturnLeafPhysics(mujoco,{release:2}),initial=p.state(),lengths=initial.points.slice(1).map((x,i)=>Math.hypot(...x.map((v,k)=>v-initial.points[i][k])));
 try{
  let depressed;
  for(let tick=0;tick<=8000;tick++){
   if(tick%100===0){const s=p.state();s.points.slice(1).forEach((x,i)=>assert.ok(Math.abs(Math.hypot(...x.map((v,k)=>v-s.points[i][k]))-lengths[i])<1e-12));if(tick===3900)depressed=s.tie[1];}
   if(tick<8000)p.step();
  }
  assert.ok(depressed<initial.tie[1]-.3);assert.ok(Math.hypot(...p.state().tie.map((x,i)=>x-initial.tie[i]))<1e-7);assert.equal(p.model.nu,0);
 }finally{p.dispose();}
});
