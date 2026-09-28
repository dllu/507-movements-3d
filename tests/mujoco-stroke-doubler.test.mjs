import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeStrokeDoublerGeometry} from '../src/simulation/mujoco-stroke-doubler/geometry.js';
import {makeMujocoStrokeDoubler} from '../src/simulation/mujoco-stroke-doubler/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();

test('118 visible hardware is closed and retains the source pinion, rack and pitman topology',()=>{
 const v=makeStrokeDoublerGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,8);
  // p60 support policy: Brown draws no stands, guides or back bars here.
  assert.deepEqual(Object.keys(u.parts).filter(n=>/Guide|Pillar|Foot|Bearing|BackBar|Post|Clip|Strap|TieBar/.test(n)),[]);assert.equal(u.source.teeth,14);assert.equal(u.families.crankPin,'carrier');
  assert.equal(u.families.pinion,'pinion');assert.equal(u.families.pitman,'carrier');assert.equal(u.families.spindle,'carrier');assert.equal(u.families.upperRack,'rack');assert.equal(u.families.lowerRack,'fixed');
  for(const [n,m]of Object.entries(u.parts)){const a=inspectWeightedClutchSolid(m.geometry);assert(a.volume>0,n);assert.equal(a.components,1,n);assert.equal(a.unmatchedEdges+a.degenerate+a.nonfinite+a.wrongNormals,0,n);}
  assert.equal(u.parts.pinion.geometry.userData.toothProfile,'rounded-rack-generated-involute-with-root-transition');assert(u.hideGround);
  // p96: both upper corners of the fixed rack's web are the same round: the
  // highest body point over each end is equally far below the root line.
  {const pos=u.parts.lowerRack.geometry.attributes.position,b=new THREE.Box3().setFromBufferAttribute(pos),top=[-Infinity,-Infinity],w=.02;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);if(x<b.min.x+w)top[0]=Math.max(top[0],y);if(x>b.max.x-w)top[1]=Math.max(top[1],y);}
   assert(Math.abs(top[0]-top[1])<.01,'matching rounded ends '+top);assert(b.max.y-top[0]>.1,'rounded left end');}
 }finally{disposeObject3D(v.root);}
});

test('118 has one input actuator and matching compiled pinion and rack surfaces',t=>{
 const v=makeMujocoStrokeDoubler(mujoco),p=v.physics,u=v.root.userData;let error=0,count=0;
 try{
  assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,0);assert.equal(p.model.ntendon,0);
  for(const [name,cells]of Object.entries(u.cells))for(const [i,cell]of cells.entries()){
   const id=p.id('mjOBJ_GEOM',name+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   const vertices=cell.map(q=>new THREE.Vector3(...q));
   for(let j=0;j<n;j++){const q=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...vertices.map(v=>q.distanceTo(v))));count++;}
  }
  assert(error<2e-6);t.diagnostic(JSON.stringify({vertices:count,errorPixels:error*100,cells:Object.fromEntries(Object.entries(u.cells).map(([n,c])=>[n,c.length]))}));
 }finally{v.dispose();}
});

test('118 passive tooth contact doubles both directions of the pitman stroke over two cycles',t=>{
 const v=makeMujocoStrokeDoubler(mujoco),p=v.physics,u=v.root.userData;let error=0,rolling=0,penetration=0,lo=Infinity,hi=-Infinity;
 try{
  for(let i=0;i<10/p.timestep;i++){
   p.step();const q=p.data.qpos;assert([...q,...p.data.qvel].every(Number.isFinite));assert(Math.abs(p.data.time-(i+1)*p.timestep)<1e-8);error=Math.max(error,Math.abs(q[2]-2*q[0]));rolling=Math.max(rolling,Math.abs(q[0]+u.profile.pitchRadius*q[1]));lo=Math.min(lo,q[2]);hi=Math.max(hi,q[2]);
   assert.equal(p.data.qfrc_actuator[1],0);assert.equal(p.data.qfrc_actuator[2],0);
   const cs=p.data.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{cs.delete();}
  }
  assert(error<.002);assert(rolling<.001);assert(penetration<.0003);assert(lo<-2*u.profile.amplitude+.01&&hi>2*u.profile.amplitude-.01);t.diagnostic(JSON.stringify({motionErrorPixels:error*100,rollingErrorPixels:rolling*100,penetrationPixels:penetration*100,range:[lo,hi]}));
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});

test('118 disconnected contacts leave the passive parts stationary while the carrier moves',()=>{
 const v=makeMujocoStrokeDoubler(mujoco),p=v.physics,a=v.root.userData.profile.amplitude;
 try{p.model.geom_contype.fill(0);p.model.geom_conaffinity.fill(0);v.update(1.25);assert(p.data.qpos[0]>a-.01);assert(Math.abs(p.data.qpos[1])<1e-10);assert(Math.abs(p.data.qpos[2])<1e-10);}
 finally{v.dispose();}
});

test('118 each rack contact is necessary for the doubled output stroke',t=>{
 for(const disabled of ['upperRack','lowerRack']){
  const v=makeMujocoStrokeDoubler(mujoco),p=v.physics,u=v.root.userData;
  try{
   for(let i=0;i<u.cells[disabled].length;i++){const id=p.id('mjOBJ_GEOM',disabled+i);p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;}
   v.update(1.25);const q=Array.from(p.data.qpos);assert(q[0]>u.profile.amplitude-.01);assert(Math.abs(q[2]-2*q[0])>.5*u.profile.amplitude/.9);
   if(disabled==='upperRack'){assert(Math.abs(q[2])<1e-10);assert(Math.abs(q[0]+u.profile.pitchRadius*q[1])<.001);}
   t.diagnostic(JSON.stringify({disabled,q}));
  }finally{v.dispose();}
 }
});

test('118 restart, backward seeking and frame partitioning reproduce complete native state',()=>{
 const v=makeMujocoStrokeDoubler(mujoco),p=v.physics;
 try{v.update(2);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}
 finally{v.dispose();}
});
