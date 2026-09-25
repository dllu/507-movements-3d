import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoCrankSlider} from '../src/simulation/mujoco-crank-slider/visual.js';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';

const mujoco=await loadMujoco();

test('092 uses passive joints and wrist closure with deterministic playback',()=>{
  const v=makeMujocoCrankSlider(mujoco),p=v.physics;
  try {
    assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,1);
    assert.equal(p.model.actuator_trnid[0],p.id('mjOBJ_JOINT','input'));
    v.update(2);const expected=[...p.data.qpos,...p.data.qvel];v.reset();
    for(let i=1;i<=120;i++)v.update(i/60);
    assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.update(.5);v.update(2);assert.deepEqual([...p.data.qpos,...p.data.qvel],expected);
    v.reset();p.model.opt.disableflags|=mujoco.mjtDisableBit.mjDSBL_EQUALITY.value;
    p.data.qvel[2]=0;const initial=p.data.qpos[2];v.update(.5);
    assert.ok(Math.abs(p.data.qpos[2]-initial)<1e-12,'disconnected passive slider must remain at rest');
    assert.ok(Math.abs(p.data.qpos[2]-v.root.userData.atAngle(p.data.qpos[0]).slider)>.2);
  } finally {v.dispose();v.dispose();}
  assert.ok(p.model.isDeleted()&&p.data.isDeleted());
});

test('092 ten turns preserve measured offset, ordinary pins and finite hardware clearance',t=>{
  const v=makeMujocoCrankSlider(mujoco),p=v.physics,u=v.root.userData,g=u.geometry;
  let positionError=0,pinError=0,checks=0,poses=0;
  try {
    // Exact dead-center extrema for an offset slider crank. The whole guide
    // shoe remains inside the straight rails, including between sampled poses.
    const limits=[g.length-g.r,g.length+g.r].map(x=>Math.sqrt(x*x-g.offset*g.offset));
    assert.ok(limits[0]-.17>g.innerLeft+.01);assert.ok(limits[1]+.17<g.right-.01);
    assert.ok(g.left-g.outerRadius>.019);
    for(let i=0;i<=40000;i++) {
      if(i)p.step();assert.ok([...p.data.qpos,...p.data.qvel].every(Number.isFinite));
      const [theta,,x]=p.data.qpos;
      // Independent finite-rod closure, rather than a replay of solver controls.
      const dy=g.offset-g.r*Math.sin(theta),expected=g.r*Math.cos(theta)+Math.sqrt(g.length*g.length-dy*dy);
      positionError=Math.max(positionError,Math.abs(x-expected));
      mujoco.mj_forward(p.model,p.data);const sites=p.data.site_xpos;
      pinError=Math.max(pinError,Math.hypot(sites[0]-sites[3],sites[1]-sites[4],sites[2]-sites[5]));
      if(i<=4000&&i%125===0) {
        v.sync();const a=auditClutchSourceSolids(v);checks+=a.checks;poses++;
        assert.deepEqual(a.topologyIssues,[]);assert.deepEqual(a.issues,[]);
        for(const mesh of Object.values(u.parts)) {
          const pos=mesh.geometry.attributes.position;
          for(let j=0;j<pos.count;j++){
            const point=new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld);
            // The guide runs on past Brown's break line to its closed end.
            if(mesh.name==='guide'&&point.x>g.right)continue;
            assert.ok(u.cameraFitBounds.containsPoint(point),mesh.name);
          }
        }
      }
    }
    assert.ok(positionError*100<.01);assert.ok(pinError*100<.01);
    t.diagnostic(JSON.stringify({maximumPositionErrorPixels:positionError*100,maximumWristClosurePixels:pinError*100,poses,surfaceChecks:checks}));
  } finally {v.dispose();}
});

test('092 ten-turn timestep refinement agrees within a tenth source pixel',t=>{
  const coarse=makeMujocoCrankSlider(mujoco),fine=makeMujocoCrankSlider(mujoco,{timestep:.0005}),finer=makeMujocoCrankSlider(mujoco,{timestep:.00025});
  let difference=0,refined=0;
  try {
    for(let i=0;i<40000;i++) {
      coarse.physics.step();for(let j=0;j<2;j++)fine.physics.step();for(let j=0;j<4;j++)finer.physics.step();
      difference=Math.max(difference,Math.abs(coarse.physics.data.qpos[2]-fine.physics.data.qpos[2]));
      refined=Math.max(refined,Math.abs(fine.physics.data.qpos[2]-finer.physics.data.qpos[2]));
    }
    assert.ok(difference*100<.1);assert.ok(refined<difference);
    t.diagnostic(JSON.stringify({maximumTimestepDifferencePixels:difference*100,maximumRefinedDifferencePixels:refined*100}));
  } finally {coarse.dispose();fine.dispose();finer.dispose();}
});
