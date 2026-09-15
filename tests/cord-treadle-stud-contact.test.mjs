import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeFiniteCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/rope-physics.js';
import {cordTreadleRigidProperties} from '../src/simulation/mujoco-cord-treadle/inertia.js';
test('visible crank stud generates native contact at the recorded treadle intersection',async()=>{
 const mujoco=await loadMujoco(),p=makeFiniteCordTreadlePhysics(mujoco,{segments:32,rigidProperties:cordTreadleRigidProperties()});
 try{
  // Recorded 3.76 s collision in the pre-contact 96-link diagnostic.
  for(const [name,q] of [['disk',5.926238549523808],['treadle',-.10926190642819827]]){
   const j=p.id('mjOBJ_JOINT',name);p.data.qpos[p.model.jnt_qposadr[j]]=q;
  }
  mujoco.mj_forward(p.model,p.data);
  const shaft=p.id('mjOBJ_GEOM','crank-stud-shaft'),beam=p.id('mjOBJ_GEOM','treadle');let penetration=0;
  const contacts=p.data.contact;
  try{for(let i=0;i<contacts.size();i++){const c=contacts.get(i);try{const ids=Array.from(c.geom);if(ids.includes(shaft)&&ids.includes(beam))penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  assert.ok(penetration>.01,'Missing physical stud/beam contact at visibly intersecting pose');
  p.reset();mujoco.mj_forward(p.model,p.data);
  const initial=p.data.contact;
  try{for(let i=0;i<initial.size();i++){const c=initial.get(i);try{const ids=Array.from(c.geom);assert.ok(!ids.includes(shaft)||!ids.includes(beam)||c.dist>=0,'Unexpected initial stud interference');}finally{c.delete();}}}finally{initial.delete();}
 }finally{p.dispose();}
});
