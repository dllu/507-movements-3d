import assert from 'node:assert/strict';
import test from 'node:test';
import loadMujoco from '@mujoco/mujoco';
import {makeDualBandContactStudy} from '../src/simulation/mujoco-dual-band/physics.js';
const mujoco=await loadMujoco();
test('390 native candidate actuates only the carriers, leaving wheel and pawls passive',()=>{
  const p=makeDualBandContactStudy(mujoco);
  try{
    assert.equal(p.model.njnt,5);assert.equal(p.model.nu,2);
    const driven=[0,1].map(i=>mujoco.mj_id2name(p.model,mujoco.mjtObj.mjOBJ_JOINT.value,p.model.actuator_trnid[i*2]));
    assert.deepEqual(driven,['open-carrier','crossed-carrier']);
    assert.ok(p.state().v.every(v=>Math.abs(v)<1e-12),'start at a true reversal, without a velocity discontinuity');
    assert.ok(Math.abs(p.state().q[0]+p.state().q[2])<1e-12);
    assert.ok(p.state().q[1]<0&&p.state().q[3]<0,'seating pegs begin outside the virtual contact preload');
  }finally{p.dispose();}
  assert.equal(p.disposed,true);
});
test('390 native candidate begins without penetrating contact proxies',()=>{
  const p=makeDualBandContactStudy(mujoco),contacts=p.data.contact;
  try{
    for(let i=0;i<p.data.ncon;i++){const c=contacts.get(i);try{assert.ok(c.dist>=0,`initial overlap ${c.dist}`);}finally{c.delete();}}
    assert.ok(p.data.qpos.every(Number.isFinite));assert.ok(p.data.qvel.every(Number.isFinite));
  }finally{contacts.delete();p.dispose();}
});
test('390 contact-disabled control removes the wheel transmission and retains pawl stops',()=>{
  const p=makeDualBandContactStudy(mujoco,{contact:false});
  try{
    let wheels=0,stops=0;
    for(let i=0;i<p.model.ngeom;i++){
      const name=mujoco.mj_id2name(p.model,mujoco.mjtObj.mjOBJ_GEOM.value,i);
      if(name.startsWith('wheel-')){assert.equal(p.model.geom_contype[i],0);assert.equal(p.model.geom_conaffinity[i],0);wheels++;}
      if(name.endsWith('-stop')){assert.equal(p.model.geom_contype[i],4);assert.equal(p.model.geom_conaffinity[i],2);stops++;}
    }
    assert.equal(wheels,48);assert.equal(stops,2);
  }finally{p.dispose();}
});
