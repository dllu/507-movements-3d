import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoEccentricYoke} from '../src/simulation/mujoco-eccentric-yoke/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/090-mujoco';
const seconds = Number(process.env.PROBE_SECONDS ?? 40), options = JSON.parse(process.env.PROBE_OPTIONS ?? '{}');
const paths = ['src/simulation/mujoco-eccentric-yoke','src/simulation/mujoco']
  .flatMap(dir => fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n));
paths.push('src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/cubic-polyline.js','src/simulation/primitives.js','src/simulation/dispose-model.js',
  'scripts/probe-mujoco-eccentric-yoke.mjs','scripts/lib/study-report-io.mjs','package-lock.json');
const sources = freezeStudySources(paths,prefix), mujoco = await loadMujoco();
const v = makeMujocoEccentricYoke(mujoco,options), p = v.physics, g = v.root.userData.geometry;
const rows = [], started = performance.now();
let maxError = 0, minGap = 0, maxStep = 0, activeSteps = 0, previous = p.data.qpos[1];
try {
  for (let i=1;i<=Math.round(seconds/p.timestep);i++) {
    p.step();
    const [angle,x] = p.data.qpos;
    assert.ok(Array.from(p.data.qpos).every(Number.isFinite) && Array.from(p.data.qvel).every(Number.isFinite));
    maxError = Math.max(maxError,Math.abs(x-g.offset[0]*Math.cos(angle)+g.offset[1]*Math.sin(angle)));
    maxStep = Math.max(maxStep,Math.abs(x-previous)); previous = x;
    if (p.data.ncon) {
      activeSteps++;
      const contacts = p.data.contact;
      for (let k=0;k<contacts.size();k++) {const c=contacts.get(k);minGap=Math.min(minGap,c.dist);c.delete();}
      contacts.delete();
    }
    if (i%Math.round(.01/p.timestep)===0) rows.push({time:p.data.time,qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel)});
  }
  verifyStudySources(sources);
  const report = {sources,options:p.description.options,seconds:p.data.time,wallSeconds:(performance.now()-started)/1000,
    maxCosineDifferencePixels:100*maxError,maximumPenetrationPixels:-100*minGap,maximumSliderStep:maxStep,
    activeSteps,rows};
  fs.writeFileSync(prefix+'.json',JSON.stringify(report)+'\n',{flag:'wx'});
  console.log({...report,sources:sources.length,rows:rows.length});
} finally {v.dispose();}
