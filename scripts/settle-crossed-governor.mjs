import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {crossedGovernorGeometry, makeCrossedGovernorPhysics} from '../src/simulation/mujoco-crossed-governor/physics.js';

const mujoco = await loadMujoco(), g = {...crossedGovernorGeometry(), linkLayer: .275};
const amplitude = .03, turns = 3, period = turns * 2 * Math.PI / (g.nominalSpeed * (1 + amplitude));
const runs = [];
for (const steps of [9600, 19200]) {
  const p = makeCrossedGovernorPhysics(mujoco, {period, timestep: period / steps, speedAmplitude: amplitude, damping: 1, linkLayer: g.linkLayer});
  const cycles = 40, stride = steps / 960, samples = [];
  try {
    for (let tick = 0; tick <= cycles * steps; tick++) {
      if (tick >= (cycles - 2) * steps && tick % stride === 0) {
        samples.push({...p.state(), qpos: Array.from(p.data.qpos), qvel: Array.from(p.data.qvel)});
      }
      if (tick < cycles * steps) p.step();
    }
    const n = 960, rows = [];
    for (let i = 0; i <= n; i++) {
      const a = samples[i], b = samples[i + n];
      rows.push({index: i, maximumPositionError: Math.max(...a.qpos.map((x, j) => Math.abs(b.qpos[j] - x - (j === 0 ? turns * 2 * Math.PI : 0)))),
        maximumVelocityError: Math.max(...a.qvel.map((x, j) => Math.abs(b.qvel[j] - x))),
        sourceSpreadError: Math.max(Math.abs(a.leftSpread - g.spread), Math.abs(a.rightSpread - g.spread))});
    }
    const best = [...rows].sort((a, b) => a.sourceSpreadError - b.sourceSpreadError)[0];
    runs.push({steps, cycles, parameters: p.parameters, best,
      maximumCyclePositionError: Math.max(...rows.map(r => r.maximumPositionError)),
      maximumCycleVelocityError: Math.max(...rows.map(r => r.maximumVelocityError)),
      maximumClosureError: Math.max(...samples.flatMap(s => s.closureErrors)),
      spreadRange: [Math.min(...samples.map(s => s.leftSpread)), Math.max(...samples.map(s => s.leftSpread))],
      outputRange: [Math.min(...samples.map(s => s.outputY)), Math.max(...samples.map(s => s.outputY))], samples});
  } finally { p.dispose(); }
}
const reference = runs[0].samples[0].spindle, fineReference = runs[1].samples[0].spindle;
let maximumSpreadDifference = 0, maximumOutputDifference = 0, maximumSpindleDifference = 0;
runs[0].samples.forEach((a, i) => {
  const b = runs[1].samples[i];
  maximumSpreadDifference = Math.max(maximumSpreadDifference, Math.abs(a.leftSpread - b.leftSpread), Math.abs(a.rightSpread - b.rightSpread));
  maximumOutputDifference = Math.max(maximumOutputDifference, Math.abs(a.outputY - b.outputY));
  maximumSpindleDifference = Math.max(maximumSpindleDifference, Math.abs((a.spindle - reference) - (b.spindle - fineReference)));
});
const sources = ['scripts/settle-crossed-governor.mjs', 'src/simulation/mujoco-crossed-governor/physics.js', 'src/simulation/mujoco/simulation.js']
  .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const qualified = runs.every(r => r.maximumCyclePositionError < 1e-5 && r.maximumCycleVelocityError < 1e-4 && r.maximumClosureError < 1e-5)
  && maximumSpreadDifference < 1e-3 && maximumOutputDifference < 1e-3;
const report = {movement: 170, status: qualified ? 'unregistered-native-cycle-qualified' : 'native-cycle-unqualified',
  period, turns, maximumSpreadDifference, maximumOutputDifference, maximumSpindleDifference,
  method: 'Corresponding states throughout the final two of forty driven cycles, with three complete spindle turns per cycle. Compare all generalized positions and velocities, then halve timestep. No mesh-clearance or bearing-contact qualification.',
  runs: runs.map(({samples, ...r}) => r), sources};
fs.writeFileSync('/dev/shm/170-settled-cycles.json', JSON.stringify({report, geometry: g, runs}));
fs.writeFileSync('docs/validation/170-native-cycle.json', JSON.stringify(report, null, 2) + '\n');
console.log(report); assert.ok(qualified, 'Native cycle did not meet repeatability and timestep gates');
