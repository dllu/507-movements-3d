// Movement 072: seat the striker in the workpiece's dip.
//
// Brown draws the dip in the bloom (the yellow workpiece) as wide as the
// hammer's striker: it is the striker's seat. The traced dip was narrower
// than the striker's swing, so the hammer came to rest on the dip's left
// step with the striker hanging over an empty hollow. This script replaces
// the dip with the striker's own seat:
//   - walls: arcs concentric with the hammer pivot, just outside the
//     striker's nearest and farthest radii (the striker swings on those arcs);
//   - floor: the striker's lower outline at the landing angle qLand;
//   - the old hollow below that floor, between the left step and the lip,
//     is solid bloom.
// The hammer then falls until the striker lands flat on the floor. The
// gravity fall is continued (same RK4, step and mass as the audited study)
// to the new rest angle; the entry event is re-solved on the cam flank.
//
// Re-runnable: the unseated workpiece and fall length are kept in
// profile.seat, and the script always starts from them.
//
//   node scripts/seat-tilt-hammer-striker.mjs
import fs from 'node:fs';
import polygonClipping from 'polygon-clipping';
import {makeTiltHammerMotion} from '../src/simulation/tilt-hammer-motion.js';

const file = 'src/data/tilt-hammer-profile.js';
const qLand = .08, wallClearance = .004, radii = 40;
const {default: loaded} = await import('../' + file + '?' + Date.now());
const profile = structuredClone(loaded);
const workpiece = profile.parts.find(part => part.name === 'workpiece');
if (!profile.seat) {
  // Brown ends the bloom's tail in a jagged break line; drop those
  // vertices for a plain cut end (formerly done at load time).
  const [outer] = workpiece.shape.polygons[0];
  const lower = outer.findIndex((q, i) => i > 0 && q[0] > -2.46 && q[1] < 1.345);
  profile.seat = {baseWorkpiece: [outer[0], ...outer.slice(lower)], baseFallKnots: profile.fall.length,
    baseRestQ: profile.parameters.restQ};
}
const {baseWorkpiece, baseFallKnots} = profile.seat, p = profile.parameters, pivot = p.pivot;
profile.fall = profile.fall.slice(0, baseFallKnots);

const rotate = (point, q) => [pivot[0] + point[0] * Math.cos(q) - point[1] * Math.sin(q),
  pivot[1] + point[0] * Math.sin(q) + point[1] * Math.cos(q)];
const fromPolar = (r, a) => [pivot[0] + r * Math.cos(a), pivot[1] + r * Math.sin(a)];
const closed = ring => {
  const out = ring.filter((v, i) => i === 0 || Math.hypot(v[0] - ring[i - 1][0], v[1] - ring[i - 1][1]) > 1e-9);
  if (Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) > 1e-9) out.push(out[0]);
  return out;
};
const area = multi => multi.reduce((sum, polygon) => sum + polygon.reduce((s, ring, k) => {
  let a = 0; for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return s + (k ? -1 : 1) * Math.abs(a / 2);
}, 0), 0);

// Striker outline in the hammer frame (relative to the pivot).
const striker = profile.parts.find(part => part.name === 'striker').shape.polygons[0][0];
const radius = v => Math.hypot(v[0], v[1]);
const rMin = Math.min(...striker.map(radius)), rMax = Math.max(...striker.map(radius));
// Largest polar angle (lowest point, the hammer head being left of and above
// the pivot) of the striker outline on the circle of radius r.
const lowestAngle = r => {
  let best = -Infinity;
  for (let i = 0; i < striker.length; i++) {
    const a = striker[i], b = striker[(i + 1) % striker.length], d = [b[0] - a[0], b[1] - a[1]];
    const A = d[0] ** 2 + d[1] ** 2, B = 2 * (a[0] * d[0] + a[1] * d[1]), C = a[0] ** 2 + a[1] ** 2 - r * r, disc = B * B - 4 * A * C;
    if (A < 1e-18 || disc < 0) continue;
    for (const sign of [-1, 1]) {
      const t = (-B + sign * Math.sqrt(disc)) / (2 * A);
      if (t < -1e-12 || t > 1 + 1e-12) continue;
      let angle = Math.atan2(a[1] + d[1] * t, a[0] + d[0] * t); if (angle < 0) angle += 2 * Math.PI;
      best = Math.max(best, angle);
    }
  }
  return best;
};
// Sample at every striker vertex radius (so each floor chord is one of the
// striker's own edges) plus evenly between them.
const floorRadii = [...new Set([...striker.map(radius), ...Array.from({length: radii + 1}, (_, i) => rMin + (rMax - rMin) * i / radii)]
  .map(r => Math.min(rMax - 1e-9, Math.max(rMin + 1e-9, r))))].sort((a, b) => a - b);
const floor = floorRadii.map(r => [r, lowestAngle(r) + qLand]);
const top = Math.min(...striker.map(v => { let a = Math.atan2(v[1], v[0]); if (a < 0) a += 2 * Math.PI; return a; })) - .15;
const seatCut = [closed([fromPolar(rMin - wallClearance, top), fromPolar(rMin - wallClearance, floor[0][1]),
  ...floor.map(([r, a]) => fromPolar(r, a)), fromPolar(rMax + wallClearance, floor.at(-1)[1]),
  fromPolar(rMax + wallClearance, top)])];

// Solid bloom below the rim line from the left step's top to the lip's top.
const nearest = target => baseWorkpiece.reduce((best, v) =>
  Math.hypot(v[0] - target[0], v[1] - target[1]) < Math.hypot(best[0] - target[0], best[1] - target[1]) ? v : best);
const stepTop = nearest([-1.7061, 1.2134]), lipTop = nearest([-1.0490, 1.1362]);
const floorY = Math.min(...baseWorkpiece.filter(v => v[0] > stepTop[0] && v[0] < lipTop[0]).map(v => v[1])) - .02;
const hull = points => {
  const s = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const v of s) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), v) <= 0) lower.pop(); lower.push(v); }
  for (const v of s.reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), v) <= 0) upper.pop(); upper.push(v); }
  return closed([...lower.slice(0, -1), ...upper.slice(0, -1)]);
};
const fill = polygonClipping.intersection([closed([stepTop, lipTop, [lipTop[0], floorY], [stepTop[0], floorY]])], [hull(baseWorkpiece)]);
const seated = polygonClipping.difference(polygonClipping.union([closed(baseWorkpiece)], fill), seatCut);
if (seated.length !== 1 || seated[0].length !== 1) throw new Error('Seated workpiece is not one simple outline');
const outline = seated[0][0].slice(0, -1);
workpiece.shape.polygons = [[outline]];

// New rest: the first hammer angle at which any hammer plate meets the bloom.
const hammerPlates = profile.parts.filter(part => part.family === 'hammer' && part.shape.kind === 'plate')
  .flatMap(part => part.shape.polygons.map(polygon => polygon.map(closed)));
const overlap = q => hammerPlates.reduce((sum, polygon) =>
  sum + area(polygonClipping.intersection(polygon.map(ring => ring.map(v => rotate(v, q))), seated)), 0);
let low = profile.seat.baseRestQ - .01, high = qLand + .01;
if (overlap(low) > 0 || !(overlap(high) > 0)) throw new Error('Rest bracket failed');
for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (overlap(mid) > 1e-12) high = mid; else low = mid; }
const restQ = low;
if (qLand - restQ > .002) throw new Error(`Hammer lands ${qLand - restQ} rad before the striker reaches its floor`);
p.restQ = restQ;

// Continue the audited gravity fall to the new rest angle.
const {mass} = profile, acceleration = q => -p.gravity * (mass.centroid[0] * Math.cos(q) - mass.centroid[1] * Math.sin(q)) / mass.inertiaPerMass;
const rk4 = ([q, v], h) => {
  const f = ([x, y]) => [y, acceleration(x)], add = (s, k, a) => s.map((value, i) => value + k[i] * a);
  const a = f([q, v]), b = f(add([q, v], a, h / 2)), c = f(add([q, v], b, h / 2)), d = f(add([q, v], c, h));
  return [q, v].map((value, i) => value + h * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
};
const bisect = (fn, a, b) => { const first = fn(a); for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (fn(m) * first > 0) a = m; else b = m; } return (a + b) / 2; };
while (profile.fall.at(-1)[1] < restQ) {
  const [time, q, v] = profile.fall.at(-1); let h = p.fallStep, next = rk4([q, v], h);
  if (next[0] >= restQ) { h = bisect(dt => rk4([q, v], dt)[0] - restQ, 0, h); next = rk4([q, v], h); next[0] = restQ; }
  profile.fall.push([time + h, next[0], next[1]]);
}
const [landingTime, , landingVelocity] = profile.fall.at(-1);
const motion = makeTiltHammerMotion(profile);
const entryAngle = bisect(angle => motion.contactAtAngle(angle).q - restQ, profile.events.flankEnd.angle, p.inputStart);
const entry = motion.contactAtAngle(entryAngle);
profile.events.entry = {time: (p.inputStart - entryAngle) / p.omega, angle: entryAngle, ...entry};
profile.events.landing = {time: landingTime, q: restQ, velocity: landingVelocity};
if (!(profile.events.entry.time < profile.events.flankEnd.time && entry.reaction > 0)) throw new Error('Entry is not on the loaded flank');
if (!(landingTime < p.period + profile.events.entry.time)) throw new Error('Next lobe arrives before landing');
Object.assign(profile.seat, {qLand, wallClearance, restQ, fallKnots: profile.fall.length});

fs.writeFileSync(file, '// Generated by scripts/export-tilt-hammer-runtime.mjs from the audited 072 candidate,\n'
  + '// then seated by scripts/seat-tilt-hammer-striker.mjs (striker seat in the bloom, extended fall).\n'
  + 'export default ' + JSON.stringify(profile) + ';\n');
console.log({restQ, entry: profile.events.entry.time, landing: landingTime, landingVelocity, outline: outline.length, fall: profile.fall.length});
