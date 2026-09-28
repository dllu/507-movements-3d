// Bakes movement 080's motion with MuJoCo (src/data/crossed-rack-profile.js).
//
//   node scripts/bake-crossed-rack-mujoco.mjs [--loops N] [--dry-run]
//
// One 24-second physical loop: the prescribed lever swings three times
// (q = -0.16 cos(2 pi tau / 8)). For two swings the pawls lift the rack by
// ratchet action; then a demonstration reset (a rack support force and
// pawl-clearing torques, both ramped smoothly) raises the rack off the hooks,
// swings both hooks clear, lets the rack down four pitches, releases the
// hooks, and sets the rack back onto the right hook near the top of its swing.
// The last 2.6 seconds run free again, so the loop ends in ordinary operation.
// The loop is simulated repeatedly without restarting until its end state
// repeats its start state; the last loop is recorded and simplified.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeCrossedRackPhysics} from '../src/simulation/crossed-rack-physics.js';

const argument = (name, fallback) => {const i = process.argv.indexOf(name); return i < 0 ? fallback : Number(process.argv[i + 1]);};
const loops = argument('--loops', 4), dryRun = process.argv.includes('--dry-run');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const smooth = x => {const s = Math.max(0, Math.min(1, x)); return s * s * s * (10 - 15 * s + 6 * s * s);};
const smoothRate = x => {const s = Math.max(0, Math.min(1, x)); return 30 * s * s * (1 - s) * (1 - s);};
const ramp = (x, [a, b]) => smooth((x - a) / (b - a));
const rampRate = (x, [a, b]) => smoothRate((x - a) / (b - a)) / (b - a);

const mujoco = await loadMujoco();
const ph = makeCrossedRackPhysics(mujoco), o = ph.options, loop = 3 * o.period, liftEnd = 2 * o.period;

// Reset plan, in seconds after the lift ends (the lever is then at q = -A).
const plan = {raise: [0, .8], raiseBy: .14, support: [0, .6], clear: [.4, 1.2], lower: [1.4, 3.6], release: [3.3, 4.3],
 settle: [4.3, 5.1], unsupport: [4.5, 5.4], clearAngle: .15, holdAbove: .1, settleBelow: .04, supportHz: 4, clearHz: 2};

// Seat height: the right hook's top face at the lever's top of swing (q = +A,
// pawl at its source angle) touching tooth 7's underside, less the margin.
const geometry = (await import('../src/simulation/crossed-rack-geometry.js')).makeCrossedRackGeometry().root.userData.geometry;
const anchor = geometry.anchors.right, A = o.amplitude,
 seat = anchor[0] * Math.sin(A) + anchor[1] * Math.cos(A) - anchor[1] - geometry.hook.clearance + o.margin - 2 * geometry.pitch,
 pitchLength = geometry.pitch, hold = seat + plan.holdAbove;

let reset = null;
const rackOmega = 2 * Math.PI * plan.supportHz, pawlOmega = 2 * Math.PI * plan.clearHz;
ph.setExternal((tau, data) => {
 const t = tau - Math.floor(tau / loop + 1e-12) * loop - liftEnd;
 if (t < 0) {reset = null; return null;}
 if (!reset) reset = {start: data.qpos[3]};
 const M = ph.rackMass, g = o.gravity,
  lowered = ramp(t, plan.lower), settled = ramp(t, plan.settle),
  target = (reset.start + plan.raiseBy * ramp(t, plan.raise)) * (1 - lowered) + hold * lowered - (plan.holdAbove + plan.settleBelow) * settled,
  rate = plan.raiseBy * rampRate(t, plan.raise) * (1 - lowered) + (hold - reset.start - plan.raiseBy * ramp(t, plan.raise)) * rampRate(t, plan.lower)
   - (plan.holdAbove + plan.settleBelow) * rampRate(t, plan.settle),
  support = ramp(t, plan.support) * (1 - ramp(t, plan.unsupport)),
  rack = support * (M * g + M * rackOmega ** 2 * (target - data.qpos[3]) + 2 * M * rackOmega * (rate - data.qvel[3])),
  clear = ramp(t, plan.clear) * (1 - ramp(t, plan.release)), out = {};
 for (const [key, index, sign] of [['left', 1, 1], ['right', 2, -1]]) {
  const I = ph.springs[key].pivotInertia, angle = data.qpos[0] + data.qpos[index], speed = data.qvel[0] + data.qvel[index];
  out[key] = clear * (I * pawlOmega ** 2 * (sign * plan.clearAngle - angle) - 2 * I * pawlOmega * speed);
 }
 return {rack, ...out};
});

// Start inside a reset, hooks held clear and the rack supported above them.
const startT = plan.lower[0], tau0 = liftEnd + startT, lever0 = ph.lever(tau0);
reset = {start: seat + 4 * pitchLength};
ph.setState({tau: tau0, qpos: [lever0.q, plan.clearAngle - lever0.q, -plan.clearAngle - lever0.q, reset.start + plan.raiseBy],
 qvel: [lever0.v, -lever0.v, -lever0.v, 0]});
const stepsPerLoop = Math.round(loop / o.timestep), stride = 4, started = Date.now();
for (let i = Math.round((loop - tau0) / o.timestep); i > 0; i--) ph.step();
let record = null, closure = null, minimumGap = Infinity;
const residuals = [];
for (let n = 0; n < loops; n++) {
 const first = ph.state(), rows = [];
 minimumGap = Infinity;
 for (let i = 0; i < stepsPerLoop; i++) {
  if (i % stride === 0) {const s = ph.state(); rows.push([i * o.timestep, s.rackY, s.leftAngle, s.rightAngle]);}
  ph.step();
  for (const c of ph.contacts()) minimumGap = Math.min(minimumGap, c.dist);
 }
 const last = ph.state();
 rows.push([loop, last.rackY, last.leftAngle, last.rightAngle]);
 const residual = {position: Math.max(...last.qpos.map((v, i) => Math.abs(v - first.qpos[i]))),
  velocity: Math.max(...last.qvel.map((v, i) => Math.abs(v - first.qvel[i])))};
 residuals.push(residual); record = rows; closure = rows.at(-1).map((v, i) => i ? v - rows[0][i] : 0);
 console.log({loop: n, residual, minimumGap, seconds: (Date.now() - started) / 1000});
}
ph.dispose();

// Close the recorded loop exactly: remove the (micro-scale) residual of the
// periodic solution over its last second.
const closed = record.map(r => r.map((v, i) => i ? v - closure[i] * ramp(r[0], [loop - 1, loop]) : v));
closed[closed.length - 1] = [loop, ...closed[0].slice(1)];

// Greedy piecewise-linear simplification: every dropped sample stays within
// the tolerance of the line between retained keys.
const tolerance = [0, 1e-5, 4e-6, 4e-6], keys = [closed[0]];
for (let start = 0, end = 2; end < closed.length; end++) {
 const a = closed[start], b = closed[end];
 let ok = true;
 for (let i = start + 1; i < end && ok; i++) {const t = (closed[i][0] - a[0]) / (b[0] - a[0]);
  for (let j = 1; j < 4; j++) if (Math.abs(a[j] + t * (b[j] - a[j]) - closed[i][j]) > tolerance[j]) {ok = false; break;}}
 if (!ok) {keys.push(closed[end - 1]); start = end - 1;}
}
keys.push(closed.at(-1));
const round = v => Number(v.toPrecision(10)), rows = keys.map(r => r.map(round));

// Validate what the browser will interpolate: rendered hook/rack outline overlap
// every 1 ms of physical time (0.5 ms of display time), and speeds.
const {makeCrossedRackGeometry} = await import('../src/simulation/crossed-rack-geometry.js');
const {makeCrossedRackOverlap} = await import('./lib/crossed-rack-overlap.mjs');
const THREE = await import('three');
const view = makeCrossedRackGeometry(), u = view.root.userData, overlap = makeCrossedRackOverlap(u);
const at = tau => {
 let low = 0, high = rows.length - 1;
 while (high - low > 1) {const m = (low + high) >> 1; if (rows[m][0] <= tau) low = m; else high = m;}
 const a = rows[low], b = rows[high], f = Math.max(0, Math.min(1, (tau - a[0]) / (b[0] - a[0])));
 return {q: ph.lever(tau).q, rackY: a[1] + f * (b[1] - a[1]), leftAngle: a[2] + f * (b[2] - a[2]), rightAngle: a[3] + f * (b[3] - a[3])};
};
let worst = {depth: 0, tau: null}, speeds = {rack: 0, left: 0, right: 0}, previous = at(0);
const crop = source => (u.geometry.center[1] - source) / u.geometry.scale, bounds = new THREE.Box3(), part = new THREE.Box3();
for (let i = 0; i <= loop * 1000; i++) {
 const tau = i / 1000, state = at(tau), depth = overlap(state);
 if (depth > worst.depth) worst = {depth, tau};
 // Display speeds (the display runs at twice physical speed), per second.
 for (const [key, name] of [['rack', 'rackY'], ['left', 'leftAngle'], ['right', 'rightAngle']])
  speeds[key] = Math.max(speeds[key], Math.abs(state[name] - previous[name]) * 2000);
 previous = state;
 if (i % 50 === 0) {
  u.setState(state);
  for (const [name, mesh] of Object.entries(u.parts)) {
   part.setFromObject(mesh, true);
   // Frame Brown's crop: the rack's stem runs on below its broken end.
   if (name === 'slottedRack') part.min.y = Math.max(part.min.y, crop(1100));
   bounds.union(part);
  }
 }
}
bounds.expandByScalar(.06);
view.root.traverse(x => {x.geometry?.dispose(); x.material?.dispose();});
const lock = JSON.parse(fs.readFileSync('package-lock.json'))['packages']['node_modules/@mujoco/mujoco'];
const sources = ['scripts/bake-crossed-rack-mujoco.mjs', 'scripts/lib/crossed-rack-overlap.mjs', 'src/simulation/crossed-rack-physics.js',
 'src/simulation/crossed-rack-geometry.js', 'src/data/crossed-rack-source.js', 'src/simulation/finite-plate-geometry.js',
 'src/simulation/mujoco/convex-plate.js', 'src/simulation/mujoco/mass.js', 'src/simulation/mujoco/simulation.js'].map(file => ({file, sha256: hash(file)}));
const provenance = {mujoco: {version: lock.version, integrity: lock.integrity}, sources,
 options: {...o, loops, recordStride: stride}, springs: ph.springs, rackMass: ph.rackMass, plan, seat, hold,
 contactCells: {left: ph.cells.hooks.left.length, right: ph.cells.hooks.right.length, teeth: ph.cells.teeth.length},
 periodicResiduals: residuals, closure: closure.slice(1), minimumContactGap: minimumGap,
 samples: closed.length, keys: rows.length, tolerance: tolerance.slice(1),
 renderedOverlap: {maximum: worst.depth, at: worst.tau, spacing: .001}, displaySpeeds: speeds};
console.log({keys: rows.length, worst, speeds, bounds});
if (!dryRun) fs.writeFileSync('src/data/crossed-rack-profile.js', '// Generated by scripts/bake-crossed-rack-mujoco.mjs from MuJoCo. Do not edit.\n'
 + '// Rows: physical time in the loop, rack height, left-pivot pawl angle, right-pivot pawl angle.\n'
 + 'export default ' + JSON.stringify({movement: 80, physicsPeriod: o.period, playbackPeriod: o.period / 2, loopPeriod: loop,
  displayOffset: o.period / 4, amplitude: o.amplitude, liftEnd, motionBounds: {min: bounds.min.toArray().map(round), max: bounds.max.toArray().map(round)},
  provenance, rows}) + ';\n');
