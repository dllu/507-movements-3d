import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetDynamics} from './lib/treadle-ratchet-dynamics.mjs';
import {rotate} from '../src/simulation/finite-plate-geometry.js';
import {planarContactSurface, forceInNormalCone} from './lib/planar-contact-surface.mjs';
const input = process.env.PROBE_INPUT ?? 'artifacts/review/082-preloaded-dynamics.json';
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-first-force-check.json';
const data = JSON.parse(fs.readFileSync(input)), candidate = makeTreadleRatchetCandidate(data.geometry);
const physics = makeTreadleRatchetDynamics(candidate, data.parameters), {mass, preload} = physics.parameters;
const errors = {force: 0, jacobian: 0, input: 0, contactGap: 0};
const counts = {forces: 0, jacobians: 0, input: 0, switches: 0, reactions: 0, boundaries: 0, cones: 0};
const issues = [], totals = Object.fromEntries(['lower', 'upper'].map(key => [key,
  {impulse: 0, wheelImpulse: 0, drivingImpulse: 0, opposingImpulse: 0, drivingContacts: 0}]));
const record = issue => {if (issues.length < 40) issues.push(issue);};
const energy = (x, v, time) => {
  const k = physics.input(time);
  let kinetic = .5 * mass[0].I * v[0] ** 2, potential = mass[0].m * 9.81 * rotate(mass[0].c, x[0])[1];
  for (let i = 0; i < 2; i++) {
    const m = mass[i + 1], r = rotate(m.c, x[i + 1]), P = k.pawls[i].pivot, V = k.pawls[i].velocity, w = v[i + 1];
    kinetic += .5 * m.m * (V[0] ** 2 + V[1] ** 2) + m.m * w * (-V[0] * r[1] + V[1] * r[0]) + .5 * m.I * w * w;
    potential += m.m * 9.81 * (P[1] + r[1]);
  }
  return {kinetic, potential};
};
const derivative = (fn, x, i, h = 1e-4) => {
  const a = [...x], b = [...x]; a[i] -= h; b[i] += h;
  return (fn(b) - fn(a)) / (2 * h);
};
for (let sample = 0; sample < 48; sample++) {
  const row = data.rows[Math.round((sample + .37) * (data.rows.length - 1) / 48)], time = row.time;
  const x = row.x.map((v, i) => v + .0007 * Math.sin(sample + i));
  const v = [.12 * Math.cos(sample), .21 * Math.sin(sample + .3), -.17 * Math.cos(sample * .7)];
  const expected = physics.forces(x, time), h = 1e-4;
  for (let i = 0; i < 3; i++) {
    const Ta = derivative(a => energy(a, v, time).kinetic, x, i), Ua = derivative(a => energy(a, v, time).potential, x, i);
    const momentum = (t, position) => derivative(velocity => energy(position, velocity, t).kinetic, v, i);
    const before = x.map((a, j) => a - h * v[j]), after = x.map((a, j) => a + h * v[j]);
    const actual = Ta - Ua - (momentum(time + h, after) - momentum(time - h, before)) / (2 * h) + (i ? preload[i - 1] : 0);
    const error = Math.abs(actual - expected[i]); errors.force = Math.max(errors.force, error); counts.forces++;
    if (error > 2e-5) record({kind: 'force', sample, i, error});
  }
  const baseRows = physics.constraints(x, time, .01).rows, epsilon = 1e-7;
  for (let i = 0; i < 4; i++) {
    const a = [...x], b = [...x]; let ta = time, tb = time;
    if (i === 3) {ta -= epsilon; tb += epsilon;} else {a[i] -= epsilon; b[i] += epsilon;}
    const earlierRows = new Map(physics.constraints(a, ta, .01).rows.map(r => [r.id, r]));
    const laterRows = new Map(physics.constraints(b, tb, .01).rows.map(r => [r.id, r]));
    for (const r of baseRows) {
      if (Math.abs(r.gap) < 1e-8) continue;
      const before = earlierRows.get(r.id), after = laterRows.get(r.id);
      if (!before || !after) {counts.switches++; continue;}
      const error = Math.abs((after.gap - before.gap) / (2 * epsilon) - (i === 3 ? r.inputNormalVelocity : r.J[i]));
      const key = i === 3 ? 'input' : 'jacobian'; errors[key] = Math.max(errors[key], error);
      counts[i === 3 ? 'input' : 'jacobians']++;
      if (error > 2e-6) record({kind: key, sample, id: r.id, i, error});
    }
  }
}
const surfaces = Object.fromEntries(Object.entries(physics.contact.profiles).map(([key, p]) =>
  [key, planarContactSurface(p.points, {gapTolerance: 1e-7})]));
let failedBoundaries = 0, failedCones = 0;
for (const state of data.rows.slice(1)) {
  if (!state.contacts.length) continue;
  const rows = new Map(physics.constraints(state.x, state.time).rows.map(r => [r.id, r]));
  for (const reaction of state.contacts) {
    counts.reactions++;
    const r = rows.get(reaction.id);
    if (!r) {failedBoundaries++; record({kind: 'missing-contact', time: state.time, id: reaction.id}); continue;}
    const i = r.key === 'lower' ? 0 : 1, P = physics.input(state.time).pawls[i].pivot;
    const samples = [{key: 'wheel', point: rotate(r.wheelPoint, -state.x[0]), force: rotate(r.normal, -state.x[0])},
      {key: r.key, point: rotate(r.pawlPoint.map((v, j) => v - P[j]), -state.x[i + 1]), force: rotate(r.normal.map(v => -v), -state.x[i + 1])}];
    for (const s of samples) {
      counts.boundaries++; counts.cones++; let boundary = false, cone = false;
      surfaces[s.key].near(s.point, f => {boundary = true; if (forceInNormalCone(s.force, f.normals, 1e-5)) cone = true;});
      if (!boundary) {failedBoundaries++; record({kind: 'boundary', time: state.time, id: r.id, body: s.key});}
      if (!cone) {failedCones++; record({kind: 'normal-cone', time: state.time, id: r.id, body: s.key});}
    }
    errors.contactGap = Math.max(errors.contactGap, Math.abs(r.gap));
    const angular = r.J[0] * reaction.impulse;
    totals[r.key].impulse += reaction.impulse; totals[r.key].wheelImpulse += angular;
    if (angular > 0) {totals[r.key].drivingImpulse += angular; totals[r.key].drivingContacts++;}
    else totals[r.key].opposingImpulse += angular;
  }
}
if (counts.jacobians < 100 || counts.input < 30 || counts.reactions < 100) record({kind: 'insufficient-checks'});
const files = [input, 'scripts/check-treadle-ratchet-forces.mjs', 'scripts/lib/treadle-ratchet-dynamics.mjs',
  'scripts/lib/treadle-ratchet-contact.mjs', 'scripts/lib/treadle-ratchet-input.mjs', 'scripts/lib/planar-contact-surface.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt';
  fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 82, status: 'force-contact-derivatives-and-reactions', productionChanged: false, mechanicsPassed: false,
  passed: issues.length === 0 && failedBoundaries === 0 && failedCones === 0, counts, errors, failedBoundaries, failedCones, totals, issues, sources,
  qualification: 'Independent central differences of inertial-frame energy and stable-feature contact gaps; independent boundary and normal-cone checks for every recorded positive impulse. This does not establish complete collision freedom or time-step convergence.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined});
if (!report.passed) process.exitCode = 1;
