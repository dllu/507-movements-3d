import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeWeightedBellCrankPhysics} from '../src/simulation/mujoco-weighted-bell-crank/physics.js';
const mujoco=await loadMujoco(),p=makeWeightedBellCrankPhysics(mujoco,{timestep:Number(process.env.DT??.00025),restLimit:process.env.REST_LIMIT==='1',supported:process.env.SUPPORTED==='1'});
try {
 const rows=[],ticks=Math.round(6*p.description.period/p.timestep),stride=Math.round(.01/p.timestep);
 for(let i=0;i<=ticks;i++){if(i%stride===0){mujoco.mj_forward(p.model,p.data);rows.push(p.state());}if(i<ticks)p.step();}
 const final=rows.filter(s=>s.time>=5*p.description.period-1e-6),range=k=>[Math.min(...final.map(s=>s.qpos[k])),Math.max(...final.map(s=>s.qpos[k]))];
 const cycle=rows.filter(s=>Math.abs(s.time/p.description.period-Math.round(s.time/p.description.period))<1e-7);
 const report={movement:154,description:p.description,summary:{leverRange:range(1),weightLiftRange:range(2),cordErrorRange:[Math.min(...rows.map(s=>s.cordLength-p.description.cordLength)),Math.max(...rows.map(s=>s.cordLength-p.description.cordLength))],cycleEnds:cycle},sources:['scripts/probe-weighted-bell-crank.mjs','src/simulation/mujoco-weighted-bell-crank/physics.js','src/simulation/mujoco-weighted-bell-crank/geometry.js','src/simulation/authored-stud-drives.js','src/simulation/mujoco/mass.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.env.REPORT??'docs/validation/154-passive-prototype.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync('/dev/shm/154-passive-samples.json',JSON.stringify(rows));console.log(report.summary);
} finally {p.dispose();}
