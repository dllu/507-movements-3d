// Offline diagnostic only. This does not replace movement 351's playback.
import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {createAuthoredStampMovement} from '../src/simulation/authored-stamps.js';
import {convexPlateCells} from '../src/simulation/mujoco/convex-plate.js';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';

const output = process.argv[2] ?? '/dev/shm/351-sector-study.json';
const options = {
  timestep: .00005, period: 4, duration: 12, gravity: 9.81,
  rest: -.1, lead: .5, solref: .00015, sampleStep: .0002,
  gearContact: true, ...JSON.parse(process.argv[3] ?? '{}'),
};
for (const key of ['timestep', 'period', 'duration', 'gravity', 'solref', 'sampleStep']) {
  if (!(Number.isFinite(options[key]) && options[key] > 0)) throw Error(`Invalid ${key}`);
}
for (const key of ['rest', 'lead']) if (!Number.isFinite(options[key])) throw Error(`Invalid ${key}`);
if (typeof options.gearContact !== 'boolean') throw Error('gearContact must be boolean');
const visual = createAuthoredStampMovement({id: 351});
const d = visual.root.userData, b = d.blocks;
visual.update(-d.geometry.initialCyclePhase * d.geometry.cyclePeriod);
visual.root.updateMatrixWorld(true);
const vector = a => a.flat().map(v => +v.toFixed(10)).join(' ');
const assets = [];
let cellCount = 0;
function plateGeoms(parts, mask) {
  let geoms = '';
  for (const part of parts) {
    const plate = convexPlateCells(part.geometry);
    for (const cell of plate.cells) {
      const vertices = [plate.low, plate.high].flatMap(z => cell.map(p =>
        new THREE.Vector3(...p, z).applyMatrix4(part.matrix).toArray()));
      const name = `mesh${cellCount++}`;
      assets.push(`<mesh name="${name}" vertex="${vector(vertices)}"/>`);
      geoms += `<geom name="${name}" type="mesh" mesh="${name}" contype="${mask}" conaffinity="${mask === 1 ? 2 : mask === 2 ? 5 : 0}"/>`;
    }
  }
  return geoms;
}
const gearMask = options.gearContact ? 1 : 0;
const teeth = plateGeoms(b.gearTeeth, gearMask);
const rack = plateGeoms(b.rackTeeth, 2);
// The broad strike proxies set rack q=0 at impact. Their absolute plane is
// offset .02 below the visible die face; this is not a complete hardware audit.
const xml = `<mujoco>
  <compiler angle="radian" inertiafromgeom="false"/>
  <option timestep="${options.timestep}" gravity="0 -${options.gravity} 0" integrator="implicitfast" iterations="100" tolerance="1e-10"/>
  <default><geom condim="1" friction="0 0 0" solref="${options.solref} 1" solimp=".99 .9999 .001"/></default>
  <asset>${assets.join('')}</asset>
  <worldbody>
    <body name="gear" pos="${vector(b.pinion.position.toArray())}">
      <joint name="angle" type="hinge" axis="0 0 1"/>
      <inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>
      ${teeth}
      <geom type="cylinder" size="${d.stampTripParts.mesh.rootRadius} .21" contype="${gearMask}" conaffinity="${options.gearContact ? 2 : 0}"/>
    </body>
    <body name="rack" pos="0 ${options.rest} .23">
      <joint name="height" type="slide" axis="0 1 0" damping=".01"/>
      <inertial pos="0 -3 0" mass="1.8" diaginertia="10 10 1"/>
      ${rack}
      <geom type="box" pos="0 -7.02 0" size=".38 .02 .37" contype="2" conaffinity="4"/>
    </body>
    <geom type="box" pos="0 ${-7.09 + options.rest} .23" size=".8 .05 .5" contype="4" conaffinity="2"/>
  </worldbody>
  <actuator><position joint="angle" kp="100000" kv="1000"/></actuator>
</mujoco>`;
const base = b.pinion.rotation.z + options.lead;
const omega = -2 * Math.PI / options.period;
const mujoco = await loadMujoco();
const simulation = createMujocoSimulation(mujoco, {
  xml,
  initialize: ({data}) => {
    data.qpos[0] = base;
    data.qpos[1] = .005;
    data.qvel[0] = omega;
    data.ctrl[0] = base + .01 * omega;
  },
  beforeStep: ({data, time}) => { data.ctrl[0] = base + omega * time + .01 * omega; },
});
const steps = Math.round(options.duration / options.timestep);
const stride = Math.max(1, Math.round(options.sampleStep / options.timestep));
const samples = [], cycles = [];
const freshStats = () => ({penetration: 0, driverError: 0, minimumHeight: Infinity, maximumHeight: -Infinity});
const summary = {...freshStats(), resets: 0};
try {
  for (let i = 0; i < steps; i++) {
    simulation.step();
    const data = simulation.data, time = data.time;
    if (Math.abs(time - (i + 1) * options.timestep) > 1e-7) summary.resets++;
    const cycle = Math.floor(i * options.timestep / options.period);
    const stats = cycles[cycle] ??= freshStats();
    for (const target of [summary, stats]) {
      target.driverError = Math.max(target.driverError, Math.abs(data.qpos[0] - base - omega * time));
      target.minimumHeight = Math.min(target.minimumHeight, data.qpos[1]);
      target.maximumHeight = Math.max(target.maximumHeight, data.qpos[1]);
    }
    if (i % stride === 0) {
      const contacts = data.contact;
      try {
        for (let j = 0; j < data.ncon; j++) {
          const contact = contacts.get(j);
          try {
            summary.penetration = Math.max(summary.penetration, -contact.dist);
            stats.penetration = Math.max(stats.penetration, -contact.dist);
          } finally { contact.delete(); }
        }
      } finally { contacts.delete(); }
      samples.push([time, ...data.qpos, ...data.qvel]);
    }
  }
  const result = {
    options, cellCount, summary, cycles,
    columns: ['time', 'gearAngle', 'rackHeightAboveStop', 'gearAngularVelocity', 'rackVelocity'],
    contactSamplingSeconds: stride * options.timestep,
    limitations: 'Experimental ideal hinge/guide and frictionless tooth contact; inferred mass, damping, drive and stop. Not a validated playback bake or full rendered-hardware clearance audit.',
    samples,
  };
  fs.writeFileSync(output, JSON.stringify(result) + '\n');
  fs.writeFileSync(`${output}.xml`, xml);
  console.log(JSON.stringify({...result, samples: samples.length}, null, 2));
} finally {
  simulation.dispose();
  const geometry = new Set(), materials = new Set();
  visual.root.traverse(o => {
    if (o.geometry) geometry.add(o.geometry);
    for (const material of [].concat(o.material ?? [])) materials.add(material);
  });
  for (const item of [...geometry, ...materials]) item.dispose();
}
