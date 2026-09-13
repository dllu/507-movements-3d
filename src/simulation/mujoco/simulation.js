/** Compile a mechanism and own its WASM allocations and fixed physics step. */
export function createMujocoSimulation(mujoco, {xml, initialize = () => {}, beforeStep = () => {}}) {
  const model = mujoco.MjModel.from_xml_string(xml);
  let data;
  try {
    data = new mujoco.MjData(model);
    const timestep = model.opt.timestep;
    if (!(Number.isFinite(timestep) && timestep > 0)) throw new RangeError('Invalid physics timestep');
    let disposed = false;
    const assertAlive = () => { if (disposed) throw new Error('Simulation has been disposed'); };
    const id = (type, name) => {
      assertAlive();
      const value = mujoco.mj_name2id(model, mujoco.mjtObj[type].value, name);
      if (value < 0) throw new RangeError(`Unknown MuJoCo ${type}: ${name}`);
      return value;
    };
    const reset = () => {
      assertAlive();
      mujoco.mj_resetData(model, data);
      initialize({model, data, id});
      mujoco.mj_forward(model, data);
    };
    const step = () => {
      assertAlive();
      beforeStep({model, data, time: data.time + timestep});
      mujoco.mj_step(model, data);
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      data.delete();
      model.delete();
    };
    reset();
    return {mujoco, model, data, timestep, id, reset, step, dispose, get disposed() { return disposed; }};
  } catch (error) {
    data?.delete();
    model.delete();
    throw error;
  }
}

/** Adapt a fixed-step mechanism to the application's absolute playback clock. */
export function createPhysicsPlayback(physics, sync) {
  let requestedTime = 0, steps = 0;
  const reset = () => {
    physics.reset();
    requestedTime = 0;
    steps = 0;
    sync();
  };
  const update = time => {
    if (!Number.isFinite(time) || time < 0) throw new RangeError('Invalid simulation time');
    if (time < requestedTime - 1e-10) reset();
    // Count integer ticks instead of comparing against accumulated mjData.time.
    // Frame partitioning must not skip a tick at an exact step boundary.
    const targetSteps = Math.floor(time / physics.timestep + 1e-7);
    const count = Math.max(0, targetSteps - steps);
    for (; steps < targetSteps; steps++) physics.step();
    requestedTime = time;
    sync();
    return count;
  };
  const advance = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid duration');
    return update(requestedTime + seconds);
  };
  return {update, advance, reset};
}
