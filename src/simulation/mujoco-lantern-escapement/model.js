import { lanternContact297 as c, armState297 } from '../lantern-pallet-contact.js';
export function lanternXml297({ timestep = .0000625, contact = true } = {}) {
  const pallets = c.bars.map(b => `<geom name="pallet-${b.name}" type="box" pos="${b.center.join(' ')} 0" size="${b.length / 2} ${b.width / 2} .14" euler="0 0 ${b.angle}" contype="${contact ? 2 : 0}" conaffinity="${contact ? 1 : 0}"/>`).join('');
  const pins = Array.from({ length: 8 }, (_, i) => `<geom name="pin-${i}" type="sphere" pos="${c.orbit * Math.cos(i * c.pitch)} ${c.orbit * Math.sin(i * c.pitch)} 0" size="${c.pinRadius}" contype="${contact ? 1 : 0}" conaffinity="${contact ? 2 : 0}"/>`).join('');
  return `<mujoco><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast"/><default><geom friction="0 0 0" condim="1" margin="0" solimp=".999 .999 .001" solref=".0015 1"/></default><worldbody><body name="prescribed-arm" pos="${c.pivot.join(' ')} 0"><joint name="arm" axis="0 0 1"/><inertial pos="0 0 0" mass="1000000" diaginertia="1000000 1000000 1000000"/>${pallets}</body><body name="driven-wheel"><joint name="wheel" axis="0 0 1" damping=".01"/><inertial pos="0 0 0" mass="1" diaginertia=".1 .1 .2"/>${pins}</body></worldbody></mujoco>`;
}
export function initializeLantern297({ data }) { data.qpos[0] = -c.amplitude; data.qpos[1] = 38 * Math.PI / 180; }
export function driveLantern297({ data, time }) {
  const arm = armState297(time);
  // An imposed oscillator, not a solved clock regulator: the large arm inertia
  // prevents wheel impacts from changing its prescribed phase within a step.
  data.qpos[0] = arm.angle; data.qvel[0] = arm.speed; data.qfrc_applied[1] = 1;
}
