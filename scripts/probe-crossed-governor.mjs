import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeCrossedGovernorPhysics} from '../src/simulation/mujoco-crossed-governor/physics.js';

const mujoco = await loadMujoco(), runs = [];
for (const options of [{}, {timestep: .0005}, {speedAmplitude: 0}, {spindleDrive: false}, {outputMass: .2}, {speedAmplitude: .03, damping: 1}, {speedAmplitude: .03, damping: 1, timestep: .0005}, {speedAmplitude: .03, damping: 1, outputMass: .2}]) {
  const p = makeCrossedGovernorPhysics(mujoco, options), samples = [];
  let maximumClosure = 0, minimumSpread = Infinity, maximumSpread = -Infinity, minimumOutput = Infinity, maximumOutput = -Infinity;
  try {
    for (let i = 0; i <= Math.round(16 / p.timestep); i++) {
      const s = p.state();
      maximumClosure = Math.max(maximumClosure, ...s.closureErrors);
      minimumSpread = Math.min(minimumSpread, s.leftSpread, s.rightSpread);
      maximumSpread = Math.max(maximumSpread, s.leftSpread, s.rightSpread);
      minimumOutput = Math.min(minimumOutput, s.outputY); maximumOutput = Math.max(maximumOutput, s.outputY);
      if (i % Math.round(.02 / p.timestep) === 0) samples.push(s);
      if (i < Math.round(16 / p.timestep)) p.step();
    }
    runs.push({parameters: p.parameters, maximumClosure, minimumSpread, maximumSpread, minimumOutput, maximumOutput, final: samples.at(-1), samples});
  } finally { p.dispose(); }
}
fs.writeFileSync('/dev/shm/170-native-runs.json', JSON.stringify(runs));
const sources = ['scripts/probe-crossed-governor.mjs', 'src/simulation/mujoco-crossed-governor/physics.js', 'src/simulation/mujoco/simulation.js']
  .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const timestepComparisons = [[0, 1], [5, 6]].map(([coarse, fine]) => {
  let maximumSpreadDifference = 0, maximumOutputDifference = 0;
  runs[coarse].samples.forEach((s, i) => {
    maximumSpreadDifference = Math.max(maximumSpreadDifference, Math.abs(s.leftSpread - runs[fine].samples[i].leftSpread));
    maximumOutputDifference = Math.max(maximumOutputDifference, Math.abs(s.outputY - runs[fine].samples[i].outputY));
  });
  return {coarseRun: coarse, fineRun: fine, maximumSpreadDifference, maximumOutputDifference};
});
const report = {timestepComparisons, movement: 170, status: 'unregistered-passive-dynamics-study', duration: 16,
  assumptions: 'Inferred masses/damping and ideal hinge/connect/slide constraints. Passive arms, links and axial output. Finite collision geometry, bevel gear contact, nonrotating output bearing and steam feedback are not modeled.',
  runs: runs.map(({samples, ...run}) => run), sources};
fs.writeFileSync('docs/validation/170-native-study.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
