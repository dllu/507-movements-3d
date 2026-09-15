import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeTwinCamPhysics} from '../src/simulation/mujoco-twin-cam/physics.js';
import {twinCamContours} from '../src/simulation/mujoco-twin-cam/source.js';
const mujoco=await loadMujoco();
test('149 traced cam controls produce convex outlines',()=>{
 for(const p of twinCamContours()){
  let sign=0;
  for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length],cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
   if(Math.abs(cross)<1e-12)continue;
   if(!sign)sign=Math.sign(cross);assert.equal(Math.sign(cross),sign);
  }
  assert.notEqual(sign,0);
 }
});
test('149 traced cams drive free gravity-return levers through repeated turns',()=>{
 const p=makeTwinCamPhysics(mujoco);let low=[Infinity,Infinity],high=[-Infinity,-Infinity];
 try{
  assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);
  for(let i=0;i<36000;i++){
   p.step();assert.equal(p.data.qfrc_applied[1],0);assert.equal(p.data.qfrc_applied[3],0);
   if(i>=24000)for(const [k,j] of [1,3].entries()){low[k]=Math.min(low[k],p.data.qpos[j]);high[k]=Math.max(high[k],p.data.qpos[j]);}
  }
  assert.ok(p.data.qpos[0]>6*Math.PI-.01);
  assert.ok(high[0]-low[0]>.25&&high[1]-low[1]>.18);
 }finally{p.dispose();}
});
test('149 lever coordinates are not prescribed when contact and gravity are removed',()=>{
 const p=makeTwinCamPhysics(mujoco,{gravity:0});
 try{
  p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);const initial=Array.from(p.data.qpos);
  for(let i=0;i<12000;i++)p.step();
  assert.ok(p.data.qpos[0]>6);
  for(const j of [1,2,3,4])assert.equal(p.data.qpos[j],initial[j]);
 }finally{p.dispose();}
});
