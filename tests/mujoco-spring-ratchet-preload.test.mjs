import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSpringRatchet} from '../scripts/lib/mujoco-spring-ratchet-candidate.mjs';

test('spring assembly releases its wheel fixture before playback and after reset', async () => {
  const mujoco = await loadMujoco();
  const v = makeMujocoSpringRatchet(mujoco,{segments:8,timestep:.00025,settlingTime:.05,
    catchStiffness:4,strongStiffness:27,flatStopEnd:true,flatCatchEnd:true,
    strongPlane:.21,leafPlane:.02,catchRootPlane:.02,stopEndSourceY:465,
    initialWheelAngle:0,elasticClamp:true,continuousLeaves:true,rigidWheel:true,preloadWheel:true});
  const flags = new mujoco.DoubleBuffer(1), {model,data} = v.physics;
  const spec = mujoco.mjtState.mjSTATE_EQ_ACTIVE.value;
  try {
    assert.equal(model.neq,1);assert.equal(model.nu,1);
    assert.equal(model.actuator_trnid[0],v.physics.id('mjOBJ_JOINT','driver'));
    const initial = Array.from(data.qpos);
    for (let attempt = 0; attempt < 2; attempt++) {
      mujoco.mj_getState(model,data,flags.GetView(),spec);
      assert.equal(flags.GetView()[0],0,'no assembly fixture may remain in playback');
      assert.deepEqual(Array.from(data.qpos),initial);
      assert.ok(Math.abs(data.qpos[0])<.001,'assembly preserves the source wheel phase');
      data.qfrc_applied[v.physics.joints.wheel.v] = -.5;
      for (let i = 0; i < 40; i++) v.physics.step();
      assert.ok(Math.abs(data.qpos[0]-initial[0])>1e-5,'released wheel responds to applied torque');
      mujoco.mj_setState(model,data,[1],spec);
      v.reset();
    }
  } finally {flags.delete();v.dispose();}
});
