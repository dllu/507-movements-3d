// Generates movement 080's demonstration return (src/data/crossed-rack-return.js).
//
// The recorded dynamics lift the rack for 18 physical seconds. To loop, the
// lever keeps swinging for three quarters of a cycle back to its starting pose
// and speed while the rack is eased off the loaded hook, both hooks are swung
// clear, the rack is let down below its start, the hooks return beneath their
// teeth and the rack settles onto them. Each hook's angle is the planned
// outward swing or, where the swinging lever would press a hook into the rack,
// the smallest larger outward angle that clears the rack solid (bisection on
// the rendered solids), smoothed with a running maximum.
//   node scripts/generate-crossed-rack-return.mjs
import fs from 'node:fs';
import * as THREE from 'three';
import profile from '../src/data/crossed-rack-profile.js';
import {makeCrossedRackDrive} from '../src/simulation/crossed-rack.js';
import {solidSurface, surfacePoints} from '../tests/helpers/solid-surface.mjs';

const plan = {lift: .03, dip: .05, raise: [0, .1], out: [.1, .3], lower: [.3, .65], back: [.65, .85], settle: [.85, 1],
  clearAngle: {left: .32, right: -.32}};
if (process.argv[2]?.startsWith('{')) Object.assign(plan, JSON.parse(process.argv[2]));
const dryRun = process.argv.includes('--dry-run');
const samples = 480, start = profile.physics.stopAt, duration = .75 * profile.physics.period;
const smooth = x => {const s = Math.max(0, Math.min(1, x)); return s * s * s * (10 - 15 * s + 6 * s * s);};
const ramp = (x, [a, b]) => smooth((x - a) / (b - a));
const rows = profile.rows;
const recorded = time => {
  let low = 0, high = rows.length - 1;
  while (high - low > 1) {const middle = (low + high) >> 1; if (rows[middle][0] <= time) low = middle; else high = middle;}
  const a = rows[low], b = rows[high], f = Math.max(0, Math.min(1, (time - a[0]) / (b[0] - a[0])));
  return a.slice(1).map((v, i) => v + f * (b[i + 1] - v));
};
const end = recorded(start), p = profile.physics;
const planned = s => {
  const out = ramp(s, plan.out) * (1 - ramp(s, plan.back)), settle = smooth(s);
  return {
    q: p.amplitude * Math.sin(p.omega * (start + s * duration)),
    rackY: (end[0] + plan.lift * ramp(s, plan.raise)) * (1 - ramp(s, plan.lower)) - plan.dip * ramp(s, plan.lower) * (1 - ramp(s, plan.settle)),
    base: {left: end[1] * (1 - settle), right: end[2] * (1 - settle)},
    out: {left: plan.clearAngle.left * out, right: plan.clearAngle.right * out},
  };
};

const model = makeCrossedRackDrive(), u = model.root.userData;
const body = name => ({name, mesh: u.parts[name], solid: solidSurface(u.parts[name].geometry), points: surfacePoints(u.parts[name].geometry)});
const rack = body('slottedRack');
const hooks = {left: ['leftPawl', 'leftHookWeb'].map(body), right: ['rightPawl', 'rightHookWeb'].map(body)};
const penetration = (a, b) => {
  let worst = 0;
  for (const [from, to] of [[a, b], [b, a]]) {
    const matrix = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    for (const v of from.points) {
      const point = v.clone().applyMatrix4(matrix);
      if (to.solid.box.containsPoint(point) && to.solid.inside(point)) worst = Math.max(worst, to.solid.distance(point));
    }
  }
  return worst;
};
const clash = (state, key, angle) => {
  u.setState({q: state.q, rackY: state.rackY, leftAngle: key === 'left' ? angle : 0, rightAngle: key === 'right' ? angle : 0});
  return Math.max(...hooks[key].map(hook => penetration(hook, rack))) > 1e-6;
};

const table = [];
for (let i = 0; i <= samples; i += 1) {
  const s = i / samples, state = planned(s), row = [s];
  for (const key of ['left', 'right']) {
    const sign = Math.sign(plan.clearAngle[key]), target = state.base[key] + state.out[key];
    let angle = target;
    // Smallest outward swing (scanning outward, so a hook resting on a
    // tooth flank drops into the gap only once it can) that clears the rack.
    for (let extra = 0; extra < 1 && clash(state, key, angle); extra += .002) angle = target + sign * (extra + .002);
    row.push(angle - state.base[key]);
  }
  table.push(row);
}
// A light smoothing where it stays clear; elsewhere the scanned angle.
const smoothed = table.map((row, i) => {
  const state = planned(row[0]), result = [row[0]];
  [1, 2].forEach((c, k) => {
    const key = k ? 'right' : 'left';
    if (i === 0 || i === samples) {result.push(row[c]); return;}
    let sum = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(samples, i + 2); j += 1) {sum += table[j][c]; n += 1;}
    const mean = sum / n;
    result.push(!clash(state, key, state.base[key] + mean) ? mean : row[c]);
  });
  return result;
});
// Verify the final table clears.
let worst = 0, worstAt = null;
for (const row of smoothed) {
  const state = planned(row[0]);
  u.setState({q: state.q, rackY: state.rackY, leftAngle: state.base.left + row[1], rightAngle: state.base.right + row[2]});
  for (const key of ['left', 'right']) for (const hook of hooks[key]) {
    const depth = penetration(hook, rack);
    if (depth > worst) {worst = depth; worstAt = [row[0], hook.name];}
  }
}
const text = `// Generated by scripts/generate-crossed-rack-return.mjs: movement 080's
// demonstration return after the recorded lift. Rows: fraction of the return,
// left and right hook outward swing (radians) added to the settling angles.
// Largest sampled hook/rack penetration: ${worst.toExponential(2)}.
export default ${JSON.stringify({start, duration, plan, rows: smoothed.map(r => r.map(v => +v.toFixed(6)))})};
`;
if (!dryRun) fs.writeFileSync('src/data/crossed-rack-return.js', text);
console.log({worst, worstAt, maxLeft: Math.max(...smoothed.map(r => r[1])), minRight: Math.min(...smoothed.map(r => r[2]))});
