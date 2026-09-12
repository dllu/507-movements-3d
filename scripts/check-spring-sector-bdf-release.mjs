import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorBdfIntegrator} from './lib/spring-sector-bdf-integrator.mjs';
import {advanceSpringSectorBdfStep} from './lib/spring-sector-bdf-step.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-bdf-release-limit';
const floor = {parameters: {inertia: [1], damping: [0], coulomb: 0}, forces: () => [-9.81],
  constraints: x => ({rows: [{id: 'floor', J: [1], gap: x[0], inputNormalVelocity: 0}], gaps: {floor: x[0]}})};
// Deliberately feed an impact velocity into the smooth-branch stepper. This
// is the inadmissible history that the integrator's reset must exclude.
const unsafe = advanceSpringSectorBdfStep(floor, {time: .02, x: [0], v: [0], active: ['floor']},
  {time: .01, x: [0], v: [-1], active: ['floor']}, .01);
assert(unsafe.okay && unsafe.state.v[0] > .2 && unsafe.state.x[0] > .001);
// The floor accelerates downward faster than gravity, so the exact body
// immediately releases: x=-9.81*t^2/2, v=-9.81*t, with zero contact force.
const release = {...floor, constraints: (x, t) => ({rows: [{id: 'floor', J: [1], gap: x[0] + 5 * t * t,
  inputNormalVelocity: 10 * t}], gaps: {floor: x[0] + 5 * t * t}})};
const runs = [];
for (const dt of [.01, .005, .0025]) {
  const integration = makeSpringSectorBdfIntegrator(release, {time: 0, x: [0], v: [0], active: ['floor']},
    {eventStep: 1e-6, minimumStep: 1e-8});
  for (let i = 0; i < Math.round(.5 / dt); i++) assert(integration.advance(dt));
  const last = integration.rows.at(-1), contactRows = integration.rows.slice(1).filter(row => row.contacts.length);
  runs.push({dt, positionError: Math.abs(last.x[0] + 4.905 * last.time ** 2),
    velocityError: Math.abs(last.v[0] + 9.81 * last.time), contactSteps: contactRows.length,
    firstReleaseTime: integration.rows.find(row => row.active.length === 0)?.time,
    initialContact: contactRows[0], firstStates: integration.rows.slice(0, 5)});
}
const files = ['scripts/check-spring-sector-bdf-release.mjs', 'scripts/lib/spring-sector-bdf-integrator.mjs',
  'scripts/lib/spring-sector-bdf-step.mjs', 'scripts/lib/spring-sector-dynamics.mjs',
  'scripts/lib/alternating-peg-dynamics-study.mjs', 'scripts/lib/jointed-tappet-dynamics-study.mjs'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 83, status: 'bdf-immediate-release-control', passed: runs.every(run => run.contactSteps === 0),
  productionChanged: false, mechanicsPassed: false, runs, unsafeHistoryNegativeControl: unsafe.state, sources,
  qualification: 'This control intentionally exposes the first backward-Euler interval retaining a contact that should immediately release. Its startup velocity error is first order. The actual 083 start is separately solved static equilibrium, but no general second-order startup or nonsmooth guarantee follows from the passing smooth controls.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined, runs: runs.map(({initialContact, firstStates, ...run}) => run)});
if (!report.passed) process.exitCode = 1;
