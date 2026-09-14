import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeRackRectifierGeometry} from '../src/simulation/mujoco-rack-rectifier/geometry.js';
import {makeMujocoRackRectifier} from '../src/simulation/mujoco-rack-rectifier/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();
const disable=(p,names)=>{for(let i=0;i<p.model.ngeom;i++)if(names.includes(Object.keys(p.bodies).find(n=>p.bodies[n]===p.model.geom_bodyid[i])))p.model.geom_contype[i]=p.model.geom_conaffinity[i]=0;};

test('116 uses closed source-proportioned hardware with separate pinions and six-tooth ratchets',()=>{
 const v=makeRackRectifierGeometry(),u=v.root.userData;
 try{
  assert.equal(Object.keys(u.parts).length,14);
  for(const [name,mesh]of Object.entries(u.parts)){const a=inspectWeightedClutchSolid(mesh.geometry);assert(a.volume>0,name);assert.equal(a.components,1,name);assert.equal(a.unmatchedEdges+a.degenerate+a.nonfinite+a.wrongNormals,0,name);}
  for(const n of ['upper','lower']){assert.equal(u.parts[n].geometry.userData.teeth,13);assert(Math.abs(u.parts[n].geometry.userData.profileShift-1)<1e-12);}
  assert.equal(u.profile.source.ratchet.teeth,6);assert.deepEqual(u.profile.counts,{upper:12,lower:12});assert(u.hideGround);
 }finally{disposeObject3D(v.root);}
});

test('116 compiled collision vertices match rendered solids in their initial native transforms',t=>{
 const v=makeMujocoRackRectifier(mujoco),p=v.physics,u=v.root.userData;let error=0,count=0;
 try{
  assert.equal(p.model.nq,6);assert.equal(p.model.neq,0);assert.equal(p.model.nu,1);assert.equal(p.model.ntendon,0);
  for(const [name,c]of Object.entries(u.cells))for(const [i,cell]of c.vertices.entries()){
   const id=p.id('mjOBJ_GEOM',name+i),mesh=p.model.geom_dataid[id],first=p.model.mesh_vertadr[mesh],n=p.model.mesh_vertnum[mesh];
   const transform=new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat,id*9).transpose());transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos,id*3));
   transform.premultiply(u.blocks[c.family].matrixWorld.clone().invert());
   for(let j=0;j<n;j++){const point=new THREE.Vector3().fromArray(p.model.mesh_vert,(first+j)*3).applyMatrix4(transform);error=Math.max(error,Math.min(...cell.map(q=>point.distanceTo(new THREE.Vector3(...q)))));count++;}
  }
  assert(error<2e-6);const cs=p.data.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{assert(c.dist>=-1e-7,'initial overlap');}finally{c.delete();}}}finally{cs.delete();}
  t.diagnostic(JSON.stringify({vertices:count,errorPixels:100*error,geoms:p.model.ngeom}));
 }finally{v.dispose();}
});

test('116 native pawls alternate driving a nearly uniform clockwise shaft for two cycles',t=>{
 const v=makeMujocoRackRectifier(mujoco),p=v.physics,f=v.root.userData.profile;let mesh=0,pen=0,reverse=0,vmin=Infinity,vmax=-Infinity,previous=p.data.qpos[p.joints.output.q];
 try{
  for(let i=0;i<12/p.timestep;i++){
   p.step();const d=p.data,q=n=>d.qpos[p.joints[n].q],speed=d.qvel[p.joints.output.v];assert([...d.qpos,...d.qvel].every(Number.isFinite));assert(Math.abs(d.time-(i+1)*p.timestep)<1e-8);
   mesh=Math.max(mesh,Math.abs(q('frame')+f.pitchRadius*q('upper')),Math.abs(q('frame')-f.pitchRadius*q('lower')));reverse=Math.max(reverse,q('output')-previous);previous=q('output');
   if(d.time>2){vmin=Math.min(vmin,speed);vmax=Math.max(vmax,speed);assert(speed<0);assert(Math.abs(speed+2*Math.PI/6)<.04);}
   for(const n of ['upper','lower','upperPawl','lowerPawl','output'])assert.equal(d.qfrc_actuator[p.joints[n].v],0,n+' actuator');
   const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{pen=Math.max(pen,-c.dist);}finally{c.delete();}}}finally{cs.delete();}
  }
  assert(previous<-12.3&&previous>-12.5);assert(mesh<.0015);assert(pen<.002);assert(reverse<3e-6);
  t.diagnostic(JSON.stringify({output:previous,meshPixels:100*mesh,penetrationPixels:100*pen,reverseStep:reverse,speed:[vmin,vmax]}));
 }finally{v.dispose();v.dispose();}assert(p.model.isDeleted()&&p.data.isDeleted());
});

test('116 removing clutch contacts disconnects the output while the rack still turns its pinions',()=>{
 const v=makeMujocoRackRectifier(mujoco),p=v.physics;
 try{disable(p,['output']);v.update(1.5);assert(Math.abs(p.data.qpos[p.joints.output.q]+.005)<1e-8);assert(p.data.qpos[p.joints.upper.q]>1.4);assert(p.data.qpos[p.joints.lower.q]<-1.4);}
 finally{v.dispose();}
});

test('116 each pawl transmits its own clockwise driving stroke',t=>{
 for(const disabled of ['upperPawl','lowerPawl']){
  const v=makeMujocoRackRectifier(mujoco),p=v.physics;let impulse=0,reverseImpulse=0;
  try{
   disable(p,[disabled]);const enabled=disabled==='upperPawl'?'lower':'upper';
   for(let i=0;i<6/p.timestep;i++){p.step();const time=p.data.time;if(time>0){const torque=p.data.qfrc_constraint[p.joints.output.v],speed=p.data.qvel[p.joints[enabled].v];if(speed<-.9)impulse+=Math.max(0,-torque)*p.timestep;else if(speed>.9)reverseImpulse+=Math.max(0,-torque)*p.timestep;}}
   t.diagnostic(JSON.stringify({disabled,output:p.data.qpos[p.joints.output.q],drivingImpulse:impulse,returnImpulse:reverseImpulse}));assert(p.data.qpos[p.joints.output.q]<-3);assert(impulse>.0001);assert(reverseImpulse<impulse*.15);
  }finally{v.dispose();}
 }
});

test('116 restart, seeking and frame partitioning reproduce native state',()=>{
 const v=makeMujocoRackRectifier(mujoco),p=v.physics;
 try{v.update(2);const state=[...p.data.qpos,...p.data.qvel];v.reset();for(let i=1;i<=120;i++)v.update(i/60);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],state);}
 finally{v.dispose();}
});
