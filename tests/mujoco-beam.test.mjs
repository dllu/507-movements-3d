import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {beamBendingStiffness} from '../src/simulation/mujoco/beam.js';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';

const mujoco = await loadMujoco();

test('a clamped beam converges to the Euler–Bernoulli tip-load deflection', t => {
  const EI = 1, span = 1, force = .001;
  const expectedDeflection = force * span ** 3 / (3 * EI);
  const expectedAngle = force * span ** 2 / (2 * EI);
  const solve = (count, fixedFirstCell = false) => {
    const length = span / count, mass = .001 * length, bendingInertia = mass * (length ** 2 + 1e-6) / 12;
    let bodies = '';
    for (let i = 0; i < count; i++) {
      const stiffness = beamBendingStiffness(EI,length,i ? length : null);
      bodies += `<body pos="${i ? length : 0} 0 0">
        ${i || !fixedFirstCell ? `<joint axis="0 0 1" stiffness="${stiffness}" damping="${stiffness * .04}"/>` : ''}
        <inertial pos="${length / 2} 0 0" mass="${mass}" diaginertia="${mass * 1e-6 / 6} ${bendingInertia} ${bendingInertia}"/>`;
    }
    bodies += `<body name="tip" pos="${length} 0 0"><inertial pos="0 0 0" mass=".000001" diaginertia="1e-10 1e-10 1e-10"/></body>` + '</body>'.repeat(count);
    const simulation = createMujocoSimulation(mujoco, {
      xml: `<mujoco><compiler angle="radian"/><option timestep=".00025" gravity="0 0 0" integrator="implicitfast"/>
        <worldbody>${bodies}</worldbody></mujoco>`,
      initialize: ({data,id}) => { data.xfrc_applied[6 * id('mjOBJ_BODY','tip') + 1] = force; },
    });
    try {
      for (let i = 0; i < 6000; i++) simulation.step();
      mujoco.mj_forward(simulation.model,simulation.data);
      const id = simulation.id('mjOBJ_BODY','tip'), {data} = simulation;
      assert.ok(Math.max(...Array.from(data.qvel,Math.abs)) < 1e-8,'beam must reach static equilibrium');
      return {count,deflection:data.xpos[3*id+1],angle:2*Math.atan2(data.xquat[4*id+3],data.xquat[4*id])};
    } finally { simulation.dispose(); }
  };
  const rows = [8,16,32].map(count => {
    const result = solve(count);
    return {...result,relativeError:Math.abs(result.deflection / expectedDeflection - 1)};
  });
  const old = solve(8,true), oldError = Math.abs(old.deflection / expectedDeflection - 1);
  t.diagnostic(JSON.stringify({expectedDeflection,expectedAngle,rows,old,oldError}));
  assert.ok(rows[0].relativeError < .009);
  assert.ok(rows[2].relativeError < .0007);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].relativeError < .3 * rows[i-1].relativeError);
  for (const row of rows) assert.ok(Math.abs(row.angle / expectedAngle - 1) < 1e-5);
  assert.ok(oldError > .15 && oldError > 15 * rows[0].relativeError,
    'fixing the whole first cell must expose the former clamp-length bias');
});
