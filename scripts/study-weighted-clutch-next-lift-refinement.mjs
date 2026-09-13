import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport, freezeStudySources, verifyStudySources, writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/087-next-left-lift-refinement';
const input = 'artifacts/review/087-connected-key-lift-CW-check-CW-replay.json.gz';
const previous = readStudyReport(input);
const coarseFile = 'artifacts/review/087-first-connected-key-lift-CW.json.gz';
const coarse = readStudyReport(coarseFile);
const impacts = readStudyReport('artifacts/review/087-first-key-jaw-impact.json');
const profiles = readStudyReport('artifacts/review/087-first-key-seating-profiles.json');
const first = impacts.rows.find(r => r.direction === 'CW');
const profile = profiles.profiles.find(r => r.direction === 'CW');
const model = makeWeightedClutchKeyCandidate();
const d = makeWeightedClutchKeyEngagementEvents(model, profile, first.friction, [first.originalProfile]);
const jaws = makeWeightedClutchNativeJaws(model);
const sources = freezeStudySources([...previous.sources.map(s => s.file), input, coarseFile,
  'scripts/study-weighted-clutch-next-lift-refinement.mjs'], prefix);
verifyStudySources(previous.sources);
assert.deepEqual(previous.start, coarse.rows.find(r => r.time === previous.start.time));
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const levels = [];
let comparison = previous;

function at(rows, time) {
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].time <= time) lo = mid; else hi = mid;
  }
  const a = rows[lo], b = rows[hi], f = (time - a.time) / (b.time - a.time);
  return a.q.map((v, k) => v + f * (b.q[k] - v));
}

for (const h of [0.000125, 0.0000625]) {
  const rows = [previous.start], native = [];
  const metrics = {maximumMomentumResidual: 0, maximumFreeVelocityError: 0,
    maximumContactRateResidual: 0, maximumComplementarity: 0, minimumGap: Infinity,
    minimumImpulse: Infinity, maximumFrictionConeExcess: 0, maximumSlidingLawError: 0,
    maximumFrictionPower: 0, maximumImpulseEnergyResidual: 0,
    absolutePhysicalContactWorkDefect: 0, maximumWithdrawal: 0};
  let state = previous.start, nextStud = null, error = null;
  try {
    while (state.time < coarse.end.time - 1e-12) {
      const before = state;
      state = d.advance(before, Math.min(h, coarse.end.time - before.time));
      rows.push(state);
      const mass = d.mass(before.q), force = d.forces(before.q, before.v);
      const contacts = d.query(state.q, state.time);
      const momentum = state.v.map((v, k) => mass[k] * (v - state.freeVelocity[k]) -
        state.active.reduce((s, c) => s + c.impulse * c.gradient[k] + c.tangentImpulse * (c.tangent?.[k] ?? 0), 0));
      const average = before.v.map((v, k) => (v + state.v[k]) / 2);
      const work = state.active.reduce((s, c) => s + c.impulse * dot(c.gradient, average) +
        c.tangentImpulse * (c.tangent ? dot(c.tangent, average) : 0), 0);
      metrics.maximumMomentumResidual = Math.max(metrics.maximumMomentumResidual, ...momentum.map(Math.abs));
      metrics.maximumFreeVelocityError = Math.max(metrics.maximumFreeVelocityError,
        ...state.freeVelocity.map((v, k) => Math.abs(v - before.v[k] - state.h * force[k] / mass[k])));
      metrics.maximumContactRateResidual = Math.max(metrics.maximumContactRateResidual,
        ...state.active.map(c => Math.abs(dot(c.gradient, state.v) - c.target)));
      metrics.maximumComplementarity = Math.max(metrics.maximumComplementarity,
        ...state.active.map(c => Math.abs(c.impulse * c.gap)));
      metrics.minimumGap = Math.min(metrics.minimumGap, ...contacts.map(c => c.gap));
      metrics.minimumImpulse = Math.min(metrics.minimumImpulse, ...state.active.map(c => c.impulse));
      metrics.maximumImpulseEnergyResidual = Math.max(metrics.maximumImpulseEnergyResidual, Math.abs(state.impulseEnergyResidual));
      metrics.absolutePhysicalContactWorkDefect += Math.abs(state.energy - before.energy - work);
      metrics.maximumWithdrawal = Math.max(metrics.maximumWithdrawal, state.q[2] - rows[0].q[2]);
      for (const c of state.active.filter(c => c.friction === 'axial-key')) {
        const sliding = state.mode.startsWith('slide'), slip = dot(c.tangent, state.v);
        const mu = sliding ? first.friction.kineticCoefficient : first.friction.staticCoefficient;
        metrics.maximumFrictionConeExcess = Math.max(metrics.maximumFrictionConeExcess, Math.abs(c.tangentImpulse) - mu * c.impulse);
        if (sliding) metrics.maximumSlidingLawError = Math.max(metrics.maximumSlidingLawError,
          Math.abs(c.tangentImpulse + mu * c.impulse * Math.sign(slip)));
        metrics.maximumFrictionPower = Math.max(metrics.maximumFrictionPower, c.tangentImpulse * slip);
      }
      if (!nextStud && state.active.some(c => c.kind === 'stud' && c.impulse > 1e-12)) nextStud = state;
    }
  } catch (e) { error = {message: e.message, stack: e.stack}; }
  const maxCoordinateDifference = [0, 0, 0, 0, 0];
  for (let i = 0; i <= 512; i++) {
    const time = rows[0].time + (Math.min(state.time, comparison.end.time) - rows[0].time) * i / 512;
    const a = at(rows, time), b = at(comparison.rows, time);
    for (let k = 0; k < 5; k++) maxCoordinateDifference[k] = Math.max(maxCoordinateDifference[k], Math.abs(a[k] - b[k]));
  }
  for (let i = 0; i <= 32; i++) {
    const time = rows[0].time + (state.time - rows[0].time) * (i === 32 ? 32 : i + 0.271) / 32;
    const q = at(rows, time), phase = d.phase(q, time);
    native.push({time, q, jaws: ['left', 'right'].map(side => jaws.evaluate(side, phase.relativeJaws[side], q[2])),
      other: d.query(q, time).filter(c => !c.kind.startsWith('jaw-')).map(c => ({kind: c.kind, gap: c.gap}))});
  }
  const file = prefix + '-' + String(h).replace('.', '_') + '.json.gz';
  const summary = {direction: 'CW', side: 'left', h, states: rows.length, start: rows[0], end: state, nextStud, error,
    ...metrics, comparedH: comparison.h ?? 0.00025, maxCoordinateDifference,
    nextStudTimeDifference: nextStud ? Math.abs(nextStud.time - comparison.nextStud.time) : null,
    minimumNativeJawGap: Math.min(...native.flatMap(r => r.jaws.map(j => j.gap))),
    minimumNativeOtherGap: Math.min(...native.flatMap(r => r.other.map(c => c.gap))), native};
  verifyStudySources(sources);
  await writeGzipStudyReport(file, {movement: 87, productionChanged: false, mechanicsPassed: false, sources, ...summary, rows});
  levels.push({...summary, file});
  comparison = {...summary, rows};
  console.log({h, states: rows.length, error, maxCoordinateDifference, nextStud: nextStud?.time,
    absolutePhysicalContactWorkDefect: metrics.absolutePhysicalContactWorkDefect, end: {q: state.q, v: state.v}});
}
const resolved = levels.every(r => !r.error) && Math.max(...levels.at(-1).maxCoordinateDifference) < 0.001;
verifyStudySources(sources);
fs.writeFileSync(prefix + '.json', JSON.stringify({movement: 87, productionChanged: false, mechanicsPassed: false,
  sources, input, coarseFile, exactSeedContinuity: true, levels, resolved,
  qualification: 'Local refinement of the following left-jaw lift after the coarse/fine lever discrepancy. All levels start at the same recorded held state, retaining its clock, work and key clearance. Resolution requires successive coordinate differences below 0.001; an unresolved result is retained. This does not refine the preceding long held interval or qualify source proportions or complete repeating cycles.'}) + '\n', {flag: 'wx'});
for (const r of levels) {
  assert(!r.error && r.nextStud && r.end.time === coarse.end.time);
  assert(r.maximumMomentumResidual < 1e-9 && r.maximumFreeVelocityError < 1e-9 && r.maximumContactRateResidual < 1e-8);
  assert(r.maximumComplementarity < 1e-8 && r.minimumGap > -2e-9 && r.minimumImpulse > -1e-12);
  assert(r.maximumFrictionConeExcess < 1e-10 && r.maximumSlidingLawError < 1e-10 && r.maximumFrictionPower < 1e-10);
  assert(r.maximumImpulseEnergyResidual < 1e-9 && r.maximumWithdrawal < 1e-8);
  assert(r.minimumNativeJawGap > -1e-6 && r.minimumNativeOtherGap > -1e-6);
}
console.log({resolved});
