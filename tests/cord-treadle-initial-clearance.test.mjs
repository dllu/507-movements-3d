import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeFiniteCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/rope-physics.js';
import {cordTreadleRigidProperties} from '../src/simulation/mujoco-cord-treadle/inertia.js';
import {cordTreadleParameters} from '../src/simulation/cord-treadle-motion.js';
const pointSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
test('initial finite rope clears the pulley without moving secured endpoints',async()=>{
 const mujoco=await loadMujoco(),g=cordTreadleParameters(),rigidProperties=cordTreadleRigidProperties();
 for(const segments of [64,96]){
  const before=makeFiniteCordTreadlePhysics(mujoco,{segments,rigidProperties,initialBow:.02,clearInitialPulley:false});
  const after=makeFiniteCordTreadlePhysics(mujoco,{segments,rigidProperties,initialBow:.02});
  try{
   const a=before.state().points,b=after.state().points;
   const minimum=points=>Math.min(...points.slice(1).map((q,i)=>pointSegment(g.guide,points[i],q)-g.guideRadius));
   assert.ok(minimum(a)<-.001,'Fixture must capture the inscribed-polygon collision');
   assert.ok(minimum(b)>0,'Prepared capsules intersect the guide');
   for(const i of [0,segments])assert.ok(Math.hypot(...a[i].map((v,j)=>v-b[i][j]))<1e-12);
   assert.ok(after.description.maximumInitialLift<.006,'Initial source displacement exceeds 0.34 px');
   assert.ok(after.state().attachmentError<1e-12);
   const pulley=after.id('mjOBJ_GEOM','pulley'),contacts=after.data.contact;
   try{for(let i=0;i<contacts.size();i++){const c=contacts.get(i);try{assert.ok(!Array.from(c.geom).includes(pulley)||c.dist>=0,'Native pulley starts penetrated');}finally{c.delete();}}}finally{contacts.delete();}
  }finally{before.dispose();after.dispose();}
 }
});
