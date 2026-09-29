// Movement 072 (p101): round the four wiper tips of cam B.
//
// Each tip becomes a fillet of radius TIP_FRACTION x the cam's tip radius,
// tangent to the circular flank and the radial drop face (see
// tiltHammerTipFillet in src/simulation/tilt-hammer-motion.js). The flank,
// the entry on it, the hammer's rest and the striker seat are unchanged; the
// arc/tip handoff (flankEnd), the crest, the force-determined release and
// the gravity fall (same RK4 and step as the audited study and the seat
// script) are re-solved from the rounded tip, and the landing re-found.
// Re-runnable: it always re-solves from the stored parameters.
//
//   node scripts/round-tilt-hammer-wiper-tips.mjs
import fs from 'node:fs';
import {makeTiltHammerMotion} from '../src/simulation/tilt-hammer-motion.js';

const file = 'src/data/tilt-hammer-profile.js', TIP_FRACTION = .06;
const {default: loaded} = await import('../' + file + '?' + Date.now());
const profile = structuredClone(loaded), p = profile.parameters, {mass} = profile;
p.tipRadius = TIP_FRACTION * p.high;
// The sharp tip's highest lift (its crest), which the rounded tip keeps.
const sharpCrestQ = loaded.parameters.sharpCrestQ ?? loaded.events.crest.q;
const time = angle => (p.inputStart - angle) / p.omega;
const bisect = (fn, a, b) => { const first = fn(a); for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (fn(m) * first > 0) a = m; else b = m; } return (a + b) / 2; };

let motion;
const solveEvents = turn => {
  p.tipFaceTurn = turn;
  // Arc/tip handoff: the arc contact's normal reaches the fillet's flank
  // tangent direction (evaluated on the arc branch with flankEnd set low).
  profile.events.flankEnd = {angle: -10};
  motion = makeTiltHammerMotion(profile);
  const tip = motion.tip, tangentDirection = Math.atan2(tip.flankPoint[1] - p.flankCenter[1], tip.flankPoint[0] - p.flankCenter[0]);
  const handoff = angle => {
    const state = motion.contactAtAngle(angle), local = Math.atan2(state.normal[1], state.normal[0]) - angle;
    return Math.atan2(Math.sin(local - tangentDirection), Math.cos(local - tangentDirection));
  };
  const flankEndAngle = bisect(handoff, profile.events.entry.angle, -.03);
  profile.events.flankEnd = {angle: flankEndAngle};
  motion = makeTiltHammerMotion(profile);
  const eventAt = angle => ({time: time(angle), angle, ...motion.contactAtAngle(angle)});
  profile.events.flankEnd = eventAt(flankEndAngle);
  const arc = motion.contactAtAngle(flankEndAngle + 1e-9), rounded = motion.contactAtAngle(flankEndAngle - 1e-9);
  if (Math.abs(arc.q - rounded.q) > 1e-7 || Math.abs(arc.velocity - rounded.velocity) > 1e-6) throw new Error('Tip fillet is not tangent to the flank');
  // Last angle with a compressive branch bounds the searches.
  let last = flankEndAngle; while (last > -1) { try { motion.contactAtAngle(last - .001); last -= .001; } catch { break; } }
  const crestAngle = bisect(angle => motion.contactAtAngle(angle).inputMoment, flankEndAngle - 1e-9, last);
  profile.events.crest = eventAt(crestAngle);
  const releaseAngle = bisect(angle => motion.contactAtAngle(angle).reaction, crestAngle, last);
  profile.events.release = eventAt(releaseAngle);
  return profile.events.crest.q;
};
const turn = bisect(t => solveEvents(t) - sharpCrestQ, 0, .3);
solveEvents(turn);
p.sharpCrestQ = sharpCrestQ;
// The release must lie on the rounded tip, before the drop face.
{
  const n = profile.events.release.normal, local = Math.atan2(n[1], n[0]) - profile.events.release.angle;
  const along = Math.atan2(Math.sin(local - Math.PI - turn), Math.cos(local - Math.PI - turn));
  if (!(along < 0)) throw new Error('Release reaches the radial drop face');
  profile.events.release.tipArcRemaining = -along;
}

// Gravity fall from the release to the unchanged rest angle.
const acceleration = q => -p.gravity * (mass.centroid[0] * Math.cos(q) - mass.centroid[1] * Math.sin(q)) / mass.inertiaPerMass;
const rk4 = ([q, v], h) => {
  const f = ([x, y]) => [y, acceleration(x)], add = (s, k, a) => s.map((value, i) => value + k[i] * a);
  const a = f([q, v]), b = f(add([q, v], a, h / 2)), c = f(add([q, v], b, h / 2)), d = f(add([q, v], c, h));
  return [q, v].map((value, i) => value + h * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
};
const release = profile.events.release, fall = [[release.time, release.q, release.velocity]];
while (fall.at(-1)[1] < p.restQ) {
  const [t, q, v] = fall.at(-1); let h = p.fallStep, next = rk4([q, v], h);
  if (next[0] >= p.restQ) { h = bisect(dt => rk4([q, v], dt)[0] - p.restQ, 0, h); next = rk4([q, v], h); next[0] = p.restQ; }
  fall.push([t + h, next[0], next[1]]);
}
profile.fall = fall;
profile.events.landing = {time: fall.at(-1)[0], q: p.restQ, velocity: fall.at(-1)[2]};
if (profile.seat) profile.seat.fallKnots = fall.length;
const e = profile.events;
if (!(e.entry.time < e.flankEnd.time && e.flankEnd.time < e.crest.time && e.crest.time < e.release.time
  && e.release.time < e.landing.time && e.landing.time < p.period + e.entry.time)) throw new Error('Event order');

fs.writeFileSync(file, '// Generated by scripts/export-tilt-hammer-runtime.mjs from the audited 072 candidate,\n'
  + '// then seated by scripts/seat-tilt-hammer-striker.mjs (striker seat in the bloom, extended fall),\n'
  + '// then tip-rounded by scripts/round-tilt-hammer-wiper-tips.mjs (p101).\n'
  + 'export default ' + JSON.stringify(profile) + ';\n');
console.log({tipRadius: p.tipRadius, tipFaceTurn: p.tipFaceTurn, crestQ: e.crest.q, sharpCrestQ, flankEnd: e.flankEnd.time, crest: e.crest.time, release: e.release.time,
  tipArcRemaining: e.release.tipArcRemaining, landing: e.landing.time, landingVelocity: e.landing.velocity, fall: fall.length});
