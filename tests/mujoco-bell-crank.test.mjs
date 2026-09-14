import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeBellCrankGeometry} from '../src/simulation/mujoco-bell-crank/geometry.js';
import {makeMujocoBellCrank} from '../src/simulation/mujoco-bell-crank/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const mujoco=await loadMujoco();

test('126 retains measured pins and constructs closed curved lever and pulley hardware',()=>{
 const v=makeBellCrankGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,15);assert(u.hideGround);
  for(const name of ['input','output']){
   const p=u.profile[name+'Pin'],s=u.source.circles[name+'Pin'].center;
   assert(Math.hypot(p[0]-(s[0]-u.source.axis[0])/100,p[1]-(u.source.axis[1]-s[1])/100)<1e-12);
  }
  for(const[n,m]of Object.entries(u.parts)){const r=inspectWeightedClutchSolid(m.geometry);assert(r.volume>0,n);assert.equal(r.components,1,n);assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,n);}
  assert(Math.abs(u.source.arms.input.length/u.source.arms.output.length-1.189)<.001);
  u.setSectionView(true);assert(!u.parts.frontFlange.visible&&u.parts.drum.visible&&u.parts.inputCord.visible);
 }finally{disposeObject3D(v.root);}
});

test('126 initializes both finite cords at their actual visible endpoints with one input actuator',()=>{
 const v=makeMujocoBellCrank(mujoco),p=v.physics,u=v.root.userData;
 try{
  assert.equal(p.model.nu,1);assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','drive'));
  for(const name of ['input','output']){
   const expected=name==='input'?u.profile.inputPath.points:u.profile.outputPoints,actual=p.getCordPoints(name);
   assert.equal(actual.length,expected.length);
   for(let i=0;i<actual.length;i++)assert(Math.hypot(...actual[i].map((v,k)=>v-expected[i][k]))<1e-10);
  }
  for(const[a,b]of p.connections)assert(Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k]))<1e-10);
  assert.equal(p.model.nv,4+6*(u.profile.cordSegments+u.profile.outputSegments));
  assert.equal(p.model.neq,u.profile.cordSegments+u.profile.outputSegments+2);
 }finally{v.dispose();}
});

test('126 cord force redirects through the passive lever and pulley torque requires friction',t=>{
 const observed=[];
 for(const friction of [.8,0]){
  const v=makeMujocoBellCrank(mujoco,{friction}),p=v.physics;
  try{
   let maximumConnection=0;
   for(let i=0;i<1.25/p.timestep;i++){
    p.step();assert([...p.data.qpos,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-9);
    for(const[n,j]of Object.entries(p.joints))if(n!=='drive')assert.equal(p.data.qfrc_actuator[j.v],0);
    for(const[a,b]of p.connections)maximumConnection=Math.max(maximumConnection,100*Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k])));
   }
   const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qpos[j.q]]));
   assert(q.drive>.4);assert(q.bell<-.2);assert(q.output<-.25);
   if(friction)assert(q.spin>.5);else assert(Math.abs(q.spin)<.02);
   assert(maximumConnection<.2);observed.push({friction,q,maximumConnectionPixels:maximumConnection});
  }finally{v.dispose();}
 }
 t.diagnostic(JSON.stringify(observed));
});

test('126 playback reset and seeking retain the complete cord state and release allocations',()=>{
 const v=makeMujocoBellCrank(mujoco),p=v.physics;
 try{v.update(.3);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=18;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.1);v.update(.3);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}
 finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});
