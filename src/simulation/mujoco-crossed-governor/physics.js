import {createMujocoSimulation} from '../mujoco/simulation.js';

export function crossedGovernorGeometry() {
  const scale = .017, radius = 89.5 * scale, drop = 159 * scale;
  const spread = Math.atan2(radius, drop), armLength = Math.hypot(radius, drop);
  const extension = Math.hypot(31, 52) * scale;
  const wristRadius = extension * Math.sin(spread), wristY = extension * Math.cos(spread);
  const outputY = 96 * scale;
  return {scale, spread, armLength, extension, radius, drop, wristRadius, wristY,
    outputY, linkLength: Math.hypot(wristRadius, outputY - wristY), ballRadius: 40 * scale,
    layer: .105, nominalSpeed: Math.sqrt(9.81 / drop)};
}

// Unregistered dynamics study. One driven spindle; arms, links and axial output
// respond passively. Ideal bearings only: no finite-solid contact qualification.
export function makeCrossedGovernorPhysics(mujoco, {timestep = .001, speedAmplitude = .08,
  period = 8, outputMass = .02, armMass = .02, damping = .12, spindleDrive = true, linkLayer = .105} = {}) {
  const g = crossedGovernorGeometry();
  const arms = [-1, 1].map((sign, i) => {
    const x = -sign * g.wristRadius, z = sign * g.layer;
    return `<body name="arm${i}"><joint name="spread${i}" axis="0 0 ${sign}" damping="${damping}"/>
      <geom type="capsule" fromto="${sign * g.radius} ${-g.drop} ${z} ${x} ${g.wristY} ${z}" size=".06" mass="${armMass}"/>
      <geom type="sphere" pos="${sign * g.radius} ${-g.drop} ${z}" size="${g.ballRadius}" mass="1"/>
      <body pos="${x} ${g.wristY} ${sign * linkLayer}"><joint name="link${i}" axis="0 0 1" damping=".005"/>
        <geom type="capsule" fromto="0 0 0 ${-x} ${g.outputY - g.wristY} 0" size=".05" mass=".01"/>
        <site name="linkEnd${i}" pos="${-x} ${g.outputY - g.wristY} 0"/>
      </body></body>`;
  }).join('');
  const constraints = [0, 1].map(i => `<connect site1="linkEnd${i}" site2="output${i}"/>`).join('');
  const xml = `<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="100" tolerance="1e-10"/>
    <default><geom contype="0" conaffinity="0"/><site size=".01"/><equality solref=".002 1" solimp=".9999 .9999 .001"/></default>
    <worldbody><body><joint name="spindle" axis="0 1 0"/><inertial pos="0 0 0" mass=".2" diaginertia=".05 .05 .05"/>
    ${arms}<body pos="0 ${g.outputY} 0"><joint name="output" type="slide" axis="0 1 0" damping=".05"/>
    <inertial pos="0 0 0" mass="${outputMass}" diaginertia=".001 .001 .001"/>
    <site name="output0" pos="0 0 ${-linkLayer}"/><site name="output1" pos="0 0 ${linkLayer}"/>
    </body></body></worldbody><equality>${constraints}</equality>
    ${spindleDrive ? '<actuator><position joint="spindle" kp="10000" kv="100"/></actuator>' : ''}</mujoco>`;
  const frequency = 2 * Math.PI / period;
  const drive = t => ({angle: g.nominalSpeed * (t + speedAmplitude * (t - Math.sin(frequency * t) / frequency)),
    speed: g.nominalSpeed * (1 + speedAmplitude * (1 - Math.cos(frequency * t)))});
  let q;
  const p = createMujocoSimulation(mujoco, {xml,
    initialize: ({model, data, id}) => {
      q = Object.fromEntries(['spindle', 'spread0', 'spread1', 'output'].map(name => [name, model.jnt_qposadr[id('mjOBJ_JOINT', name)]]));
      if (spindleDrive) data.qvel[q.spindle] = g.nominalSpeed;
    },
    beforeStep: ({data, time}) => { if (spindleDrive) { const d = drive(time - timestep); data.ctrl[0] = d.angle + .01 * d.speed; } },
  });
  const pairs = [0, 1].map(i => [p.id('mjOBJ_SITE', 'linkEnd' + i), p.id('mjOBJ_SITE', 'output' + i)]);
  return Object.assign(p, {geometry: {...g, linkLayer}, parameters: {timestep, speedAmplitude, period, outputMass, armMass, damping, spindleDrive, linkLayer},
    state: () => {
      mujoco.mj_kinematics(p.model, p.data);
      const position = id => Array.from(p.data.site_xpos.slice(id * 3, id * 3 + 3));
      return {time: p.data.time, spindle: p.data.qpos[q.spindle], speed: p.data.qvel[q.spindle],
        leftSpread: g.spread + p.data.qpos[q.spread0], rightSpread: g.spread + p.data.qpos[q.spread1],
        outputY: g.outputY + p.data.qpos[q.output],
        closureErrors: pairs.map(([a, b]) => Math.hypot(...position(a).map((x, i) => x - position(b)[i])))};
    }});
}
