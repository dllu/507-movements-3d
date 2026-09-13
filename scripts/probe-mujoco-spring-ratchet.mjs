import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSpringRatchet} from './lib/mujoco-spring-ratchet-candidate.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/073-mujoco-first';
const options = JSON.parse(process.env.PROBE_OPTIONS ?? '{}'), seconds = Number(process.env.PROBE_SECONDS ?? 18);
const started = performance.now(), v = makeMujocoSpringRatchet(await loadMujoco(),options), {model,data,joints} = v.physics;
const initial = v.sync(), rows = [], counts = {'B-A':0,'C-A':0,'B-C':0};
const sourceHashes = Object.fromEntries(['scripts/lib/mujoco-spring-ratchet-candidate.mjs',
  'scripts/lib/spring-pressed-ratchet-source.mjs','scripts/lib/spring-pressed-ratchet-elastic.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/mujoco-treadle/collision.js',
  'src/simulation/mujoco/simulation.js','scripts/probe-mujoco-spring-ratchet.mjs','package-lock.json']
  .map(path=>[path,createHash('sha256').update(fs.readFileSync(path)).digest('hex')]));
let minimumGap = 0, maximumStep = 0, previous = Array.from(data.qpos), maximumContacts = 0;
try {
  for (let i = 1; i <= Math.round(seconds / v.physics.timestep); i++) {
    v.physics.step(); const q = Array.from(data.qpos);
    assert(q.every(Number.isFinite) && Array.from(data.qvel).every(Number.isFinite));
    maximumStep = Math.max(maximumStep,...q.map((x,k)=>Math.abs(x-previous[k]))); previous=q;
    maximumContacts = Math.max(maximumContacts,data.ncon);
    if (i % Math.round(.025 / v.physics.timestep)) continue;
    const state = v.sync(), contacts = data.contact, active = [];
    for (let j = 0; j < contacts.size(); j++) {
      const c = contacts.get(j), names = [c.geom1,c.geom2].map(id=>mujocoName(id)); minimumGap = Math.min(minimumGap,c.dist);
      const has = p => names.some(n=>n.startsWith(p));
      const kind = has('toothCell') ? (has('B') ? 'B-A' : 'C-A') : 'B-C';
      counts[kind]++;active.push({kind,names,gap:c.dist});c.delete();
    }
    contacts.delete();rows.push({...state,contacts:active});
  }
  const final=v.sync();
  const report={sourceHashes,parameters:v.root.userData.p,seconds:data.time,wallSeconds:(performance.now()-started)/1000,
    initial,final,advanceTeeth:(initial.wheelAngle-final.wheelAngle)/v.root.userData.ratchet.pitch,
    minimumGapPixels:minimumGap*v.root.userData.source.scale,maximumStep,maximumContacts,counts,rows};
  fs.writeFileSync(prefix+'.json',JSON.stringify(report)+'\n',{flag:'wx'});
  const {rows:_,...summary}=report;console.log({...summary,initial:{wheelAngle:initial.wheelAngle},final:{wheelAngle:final.wheelAngle},rows:rows.length});
} finally {v.dispose();}

function mujocoName(id) {return v.physics.mujoco.mj_id2name(model,v.physics.mujoco.mjtObj.mjOBJ_GEOM.value,id);}
