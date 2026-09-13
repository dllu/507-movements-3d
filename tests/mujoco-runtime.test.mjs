import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {createMujocoSimulation, createPhysicsPlayback} from '../src/simulation/mujoco/simulation.js';

const mujoco = await loadMujoco();
const xml = `<mujoco><option timestep=".001" gravity="0 -9.81 0"/>
  <worldbody><body><joint name="pivot" type="hinge" axis="0 0 1"/>
    <geom type="capsule" fromto="0 0 0 1 0 0" size=".05"/>
  </body></worldbody></mujoco>`;

test('fixed-step playback is independent of render frames and deterministic after seeking', () => {
  const physics = createMujocoSimulation(mujoco, {xml});
  let synchronized = 0;
  const playback = createPhysicsPlayback(physics, () => synchronized++);
  try {
    assert.equal(playback.update(1), 1000);
    const expected = [...physics.data.qpos, ...physics.data.qvel];
    assert.ok(Math.abs(expected[0]) > .1, 'the pendulum responds to gravity');
    assert.equal(playback.update(1), 0);
    playback.reset();
    for (let frame = 0; frame < 60; frame++) playback.advance(1 / 60);
    assert.deepEqual([...physics.data.qpos, ...physics.data.qvel], expected);
    playback.update(.2);
    playback.update(1);
    assert.deepEqual([...physics.data.qpos, ...physics.data.qvel], expected);
    assert.ok(synchronized > 60);
    for (const time of [-1, NaN, Infinity]) assert.throws(() => playback.update(time));
    assert.throws(() => playback.advance(-1));
  } finally { physics.dispose(); }
});

test('MuJoCo instances own separate state and release both allocations exactly once', () => {
  const first = createMujocoSimulation(mujoco, {xml});
  const second = createMujocoSimulation(mujoco, {xml});
  try {
    for (let i = 0; i < 500; i++) first.step();
    assert.equal(second.data.time, 0);
    assert.equal(second.data.qpos[0], 0);
    assert.throws(() => first.id('mjOBJ_JOINT', 'missing'), /Unknown MuJoCo/);
    first.dispose();
    first.dispose();
    assert.ok(first.data.isDeleted() && first.model.isDeleted());
    assert.throws(() => first.step(), /disposed/);
    second.step();
    assert.ok(second.data.time > 0, 'disposing a model preserves the shared runtime');
  } finally { first.dispose(); second.dispose(); }
});

test('failed initialization releases the partially constructed simulation', () => {
  let allocations;
  assert.throws(() => createMujocoSimulation(mujoco, {
    xml,
    initialize: handles => { allocations = handles; throw new Error('invalid initial pose'); },
  }), /invalid initial pose/);
  assert.ok(allocations.model.isDeleted() && allocations.data.isDeleted());
});
