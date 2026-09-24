import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeTwinCamPhysics} from '../src/simulation/mujoco-twin-cam/physics.js';
import {twinCamContours} from '../src/simulation/mujoco-twin-cam/source.js';
import {twinCamSource,twinCamLevers} from '../src/simulation/mujoco-twin-cam/source.js';
import {makeTwinCamGeometry} from '../src/simulation/mujoco-twin-cam/geometry.js';
import * as THREE from 'three';
const mujoco=await loadMujoco();
test('149 output rods reach engraved endpoints with ordinary coaxial pins',()=>{
 const v=makeTwinCamGeometry();
 try{
  for(let i=0;i<2;i++){
   const rod=v.root.userData.parts['rod'+i],box=new THREE.Box3().setFromObject(rod);
   assert.ok(Math.abs(twinCamSource.pivot[1]-box.min.y/twinCamSource.scale-[414,430][i])<.001);
   const rodPin=rod.parent.localToWorld(new THREE.Vector3(0,0,.05));
   const leverPin=v.root.userData.blocks.levers[i].localToWorld(new THREE.Vector3(twinCamLevers[i].attachment,0,twinCamLevers[i].rodZ+.05));
   assert.ok(rodPin.distanceTo(leverPin)<1e-12);
  }
 }finally{v.dispose();}
});
test('149 compiled moving bodies use common-density visible mesh masses',()=>{
 const p=makeTwinCamPhysics(mujoco);
 try{
  assert.equal(p.model.nq,9);
  for(const [name,m] of Object.entries(p.description.mass)){
   const id=p.id('mjOBJ_BODY',name);
   assert.ok(Math.abs(p.model.body_mass[id]-m.volume*p.description.density)<1e-12);
   for(let k=0;k<3;k++)assert.ok(Math.abs(p.model.body_ipos[id*3+k]-m.centroid[k])<1e-12);
  }
 }finally{p.dispose();}
});
test('149 both cams are the same smooth convex outline',()=>{
 const [a,b]=twinCamContours(),radii=c=>c.map(p=>Math.hypot(...p)).sort((x,y)=>x-y);
 radii(a).forEach((r,i)=>assert.ok(Math.abs(r-radii(b)[i])<1e-12));
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
  const pins=[0,1].map(i=>['rod-tip','slider-tip'].map(name=>p.id('mjOBJ_SITE',name+i)));
  assert.equal(p.model.nu,1);assert.equal(p.model.neq,2);
  for(let i=0;i<36000;i++){
   p.step();assert.equal(p.data.qfrc_applied[1],0);assert.equal(p.data.qfrc_applied[4],0);
   if(i>=24000)for(const [k,j] of [1,4].entries()){low[k]=Math.min(low[k],p.data.qpos[j]);high[k]=Math.max(high[k],p.data.qpos[j]);}
   if(i>=24000&&i%200===0){
    mujoco.mj_forward(p.model,p.data);
    for(const [k,[a,b]] of pins.entries()){
     assert.ok(Math.hypot(...[0,1,2].map(axis=>p.data.site_xpos[3*a+axis]-p.data.site_xpos[3*b+axis]))<1e-5);
     assert.ok(Math.abs(p.data.site_xpos[3*b]-twinCamLevers[k].guideX)<1e-12);
    }
   }
  }
  assert.ok(p.data.qpos[0]>6*Math.PI-.01);
  // Both cams share one profile, so both levers swing through the same angle.
  assert.ok(high[0]-low[0]>.21&&high[1]-low[1]>.21);assert.ok(Math.abs((high[0]-low[0])-(high[1]-low[1]))<.002);
 }finally{p.dispose();}
});
test('149 lever coordinates are not prescribed when contact and gravity are removed',()=>{
 const p=makeTwinCamPhysics(mujoco,{gravity:0,guided:false});
 try{
  p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);const initial=Array.from(p.data.qpos);
  for(let i=0;i<12000;i++)p.step();
  assert.ok(p.data.qpos[0]>6);
  for(const j of [1,2,3,4,5,6])assert.equal(p.data.qpos[j],initial[j]);
 }finally{p.dispose();}
});
