// Movement 080 MuJoCo model, used offline by scripts/bake-crossed-rack-mujoco.mjs
// (the browser only interpolates the baked table in crossed-rack-motion.js).
//
// The lever is prescribed. The rack slides on an ideal vertical prismatic joint
// under gravity; each pawl hangs on its lever pin with a light torsional spring
// (and light damping) turning its hook toward the rack. Contacts act between
// convex prisms: the rendered hook webs split into convex cells, and each rack
// tooth as a convex quadrilateral prism running a little into the rack body.
import {convexPlateCells} from './mujoco/convex-plate.js';
import {rigidFamilyInertia} from './mujoco/mass.js';
import {createMujocoSimulation} from './mujoco/simulation.js';
import {makeCrossedRackGeometry} from './crossed-rack-geometry.js';

export const crossedRackPhysicsDefaults = {
 timestep: .0005, gravity: 9.81, density: 1,
 // Lever input: q = -amplitude cos(omega tau); tau = 0 at the lever's clockwise extreme.
 amplitude: .16, period: 8,
 // Spring preload at the source pose as a fraction of the pawl's own gravity
 // torque there, and its stiffness as preload per radian of free turn.
 // Damping ratio of each pawl's pendulum-and-spring mode: overdamped, so a
 // hook dropping off a tooth swings in over about 0.15 s of display time.
 springFraction: .25, springTurn: .3, dampingRatio: 3,
 friction: .15, margin: .0015, solref: [.004, 1], solimp: [.95, .99, .001],
 rackDamping: .02, cellDepth: .04,
};

const vec = values => values.map(v => Number(v.toPrecision(12))).join(' ');
const prism = (cell, depth) => cell.flatMap(([x, y]) => [x, y, -depth / 2, x, y, depth / 2]);

export function crossedRackContactCells(u, depth) {
 const hooks = Object.fromEntries(['left', 'right'].map(key => [key, convexPlateCells(u.parts[key + 'HookWeb'].geometry).cells]));
 const teeth = [];
 for (const [edge, out] of [['right', 1], ['left', -1]]) {
  const list = u.geometry.rackTeeth[edge];
  for (let i = 1; i < list.length; i++) {
   const a = list[i - 1], b = list[i], inset = .06 * out;
   teeth.push([[a.root - inset, a.y], [a.root, a.y], [b.tip, b.y], [b.root - inset, b.y]]);
  }
 }
 return {hooks, teeth, depth};
}

export function makeCrossedRackPhysics(mujoco, options = {}) {
 const o = {...crossedRackPhysicsDefaults, ...options};
 const visual = makeCrossedRackGeometry(), u = visual.root.userData, p = u.geometry;
 const inertia = Object.fromEntries(['rack', 'left', 'right'].map(k => [k, rigidFamilyInertia(u.parts, u.families, k)]));
 visual.root.traverse(x => {x.geometry?.dispose(); x.material?.dispose();});
 const inertial = k => {const m = inertia[k]; return `<inertial pos="${vec(m.centroid)}" mass="${m.volume * o.density}" fullinertia="${vec(m.inertia.map(v => v * o.density))}"/>`;};
 const cells = crossedRackContactCells(u, o.cellDepth), assets = [], geoms = {left: [], right: [], rack: []};
 for (const key of ['left', 'right']) cells.hooks[key].forEach((cell, i) => {
  assets.push(`<mesh name="${key}${i}" vertex="${vec(prism(cell, o.cellDepth))}"/>`);
  geoms[key].push(`<geom name="${key}${i}" type="mesh" mesh="${key}${i}" contype="1" conaffinity="2" margin="${o.margin}"/>`);
 });
 cells.teeth.forEach((cell, i) => {
  assets.push(`<mesh name="tooth${i}" vertex="${vec(prism(cell, o.cellDepth))}"/>`);
  geoms.rack.push(`<geom name="tooth${i}" type="mesh" mesh="tooth${i}" contype="2" conaffinity="1"/>`);
 });
 // Each pawl's gravity torque about its pin at the source pose (positive CCW).
 const g = o.gravity, springs = {};
 for (const [key, inward] of [['left', -1], ['right', 1]]) {
  const m = inertia[key], mass = m.volume * o.density, gravityTorque = Math.abs(-mass * g * m.centroid[0]);
  const preload = o.springFraction * gravityTorque, stiffness = preload / o.springTurn,
   pivotInertia = m.inertia[2] * o.density + mass * (m.centroid[0] ** 2 + m.centroid[1] ** 2),
   // Pendulum stiffness about the pin plus the spring's.
   rate = Math.sqrt((mass * g * Math.hypot(m.centroid[0], m.centroid[1]) + stiffness) / pivotInertia);
  springs[key] = {inward, mass, gravityTorque, preload, stiffness, springref: inward * o.springTurn, pivotInertia,
   damping: 2 * o.dampingRatio * pivotInertia * rate};
 }
 const rackMass = inertia.rack.volume * o.density;
 const pawl = key => `<body name="${key}" pos="${vec([...p.anchors[key], 0])}">
  <joint name="${key}" type="hinge" axis="0 0 1" stiffness="${springs[key].stiffness}" springref="${springs[key].springref}" damping="${springs[key].damping}"/>
  ${inertial(key)}${geoms[key].join('')}</body>`;
 const xml = `<mujoco model="080 crossed hooked pawls and slotted rack"><compiler angle="radian" inertiafromgeom="false"/>
 <option timestep="${o.timestep}" gravity="0 ${-g} 0" integrator="implicitfast" iterations="100" ls_iterations="50" tolerance="1e-10" cone="elliptic"/>
 <default><geom condim="3" friction="${o.friction} .001 .0001" solref="${o.solref.join(' ')}" solimp="${o.solimp.join(' ')}"/></default>
 <asset>${assets.join('')}</asset>
 <worldbody>
  <body name="lever"><joint name="lever" type="hinge" axis="0 0 1" armature="1e6"/><inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/>${pawl('left')}${pawl('right')}</body>
  <body name="rack"><joint name="rack" type="slide" axis="0 1 0" damping="${o.rackDamping}"/>${inertial('rack')}${geoms.rack.join('')}</body>
 </worldbody></mujoco>`;
 const omega = 2 * Math.PI / o.period, lever = tau => ({q: -o.amplitude * Math.cos(omega * tau),
  v: o.amplitude * omega * Math.sin(omega * tau), a: o.amplitude * omega * omega * Math.cos(omega * tau)});
 // External actions, used only by the demonstration reset: a rack support
 // force and pawl-clearing torques, each returning generalized forces.
 let external = () => null, clock = 0;
 const physics = createMujocoSimulation(mujoco, {xml, beforeStep: ({data}) => {
  const tau = clock + data.time, input = lever(tau);
  data.qpos[0] = input.q; data.qvel[0] = input.v;
  data.qfrc_applied[0] = 1e6 * input.a;
  const forces = external(tau, data) ?? {};
  data.qfrc_applied[1] = forces.left ?? 0; data.qfrc_applied[2] = forces.right ?? 0; data.qfrc_applied[3] = forces.rack ?? 0;
 }});
 // qpos: lever, left hinge (relative to lever), right hinge, rack height.
 const state = () => {
  const d = physics.data, q = d.qpos[0];
  return {tau: clock + d.time, q, rackY: d.qpos[3], leftAngle: q + d.qpos[1], rightAngle: q + d.qpos[2],
   qpos: Array.from(d.qpos), qvel: Array.from(d.qvel)};
 };
 const setState = ({tau, qpos, qvel}) => {
  const d = physics.data; clock = tau - d.time;
  d.qpos.set(qpos); d.qvel.set(qvel); physics.mujoco.mj_forward(physics.model, d);
 };
 const contacts = () => {
  const d = physics.data, out = [], list = d.contact;
  try {for (let i = 0; i < d.ncon; i++) {const c = list.get(i); try {out.push({dist: c.dist, geom: [c.geom1, c.geom2]});} finally {c.delete();}}}
  finally {list.delete();}
  return out;
 };
 return Object.assign(physics, {options: o, springs, rackMass, inertia, cells, xml, lever, state, setState, contacts,
  setExternal: f => {external = f;}, get clock() {return clock;}});
}
