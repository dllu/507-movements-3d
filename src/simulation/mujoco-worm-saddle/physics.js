import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec = values => values.map(x => Math.abs(x) < 1e-12 ? 0 : Number(x.toPrecision(12))).join(' ');

/** Ideal worm transmission: x + lead*wormAngle - pitchRadius*wheelAngle = 0.
 * MuJoCo solves the passive coordinate and reaction forces. Tooth backlash,
 * friction and impacts are omitted; the visible mating surfaces are hobbed.
 */
export function makeWormSaddlePhysics(mujoco, visual, {timestep = .002, period = 8, mode = 'worm'} = {}) {
  if (!['worm', 'wheel'].includes(mode)) throw new RangeError('Unknown 104 input');
  const u = visual.root.userData, f = u.profile;
  const mass = Object.fromEntries(['worm', 'wheel', 'carriage'].map(name =>
    [name, rigidFamilyInertia(u.parts, u.families, name)]));
  const density = 1 / mass.worm.volume;
  const inertia = name => {
    const m = mass[name];
    return `<inertial pos="${vec(m.centroid)}" mass="${m.volume * density}" fullinertia="${vec(m.inertia.map(x => x * density))}"/>`;
  };
  const xml = `<mujoco model="104 ideal worm transmission on a sliding saddle">
    <compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="40" tolerance="1e-10"/>
    <default><equality solref=".004 1" solimp=".9999 .99999 .0001"/></default>
    <worldbody>
      <body name="worm" pos="0 ${f.distance} 0"><joint name="worm" axis="1 0 0" damping=".02"/>${inertia('worm')}</body>
      <body name="carriage"><joint name="carriage" type="slide" axis="1 0 0" damping=".02" frictionloss=".05"/>${inertia('carriage')}
        <body name="wheel"><joint name="wheel" axis="0 0 1" damping=".002"/>${inertia('wheel')}</body>
      </body>
    </worldbody>
    <tendon><fixed name="transmission">
      <joint joint="worm" coef="${f.lead}"/><joint joint="carriage" coef="1"/><joint joint="wheel" coef="${-f.pitchRadius}"/>
    </fixed></tendon>
    <equality>
      <joint name="hold_slide" joint1="carriage" polycoef="0 0 0 0 0"/>
      <joint name="hold_worm" joint1="worm" polycoef="0 0 0 0 0"/>
      <tendon name="gear_coupling" tendon1="transmission" polycoef="0 0 0 0 0"/>
    </equality>
    <actuator><position joint="worm" kp="3000" kv="60"/><position joint="wheel" kp="600" kv="20"/></actuator>
  </mujoco>`;
  const input = time => {
    const a = 2 * Math.PI * time / period, scale = mode === 'worm' ? 3 * Math.PI : 2 * Math.PI / f.teeth;
    return {angle: scale * (1 - Math.cos(a)), velocity: scale * 2 * Math.PI / period * Math.sin(a)};
  };
  const physics = createMujocoSimulation(mujoco, {xml, initialize: ({model, data}) => {
    const wormMode = mode === 'worm';
    // The 3.13 WASM binding cannot expose bool memory views directly.
    mujoco.mj_setState(model, data, [+wormMode, +!wormMode, 1], mujoco.mjtState.mjSTATE_EQ_ACTIVE.value);
    for (const [i, kp, kv] of [[0, wormMode ? 3000 : 0, wormMode ? 60 : 0], [1, wormMode ? 0 : 600, wormMode ? 0 : 20]]) {
      model.actuator_gainprm[i * 10] = kp;
      model.actuator_biasprm[i * 10 + 1] = -kp;
      model.actuator_biasprm[i * 10 + 2] = -kv;
    }
  }, beforeStep: ({data, time}) => {
    const s = input(time), i = mode === 'worm' ? 0 : 1;
    data.ctrl[i] = s.angle + (i === 0 ? .02 : 1 / 30) * s.velocity;
  }});
  const setMode = value => {
    if (!['worm', 'wheel'].includes(value)) throw new RangeError('Unknown 104 input');
    mode = value;
    physics.reset();
  };
  return Object.assign(physics, {setMode,
    bodies: Object.fromEntries(['worm', 'carriage', 'wheel'].map(name => [name, physics.id('mjOBJ_BODY', name)])),
    description: {xml, mass, density, input, coupling: 'ideal gear constraint', options: {timestep, period}}});
}
