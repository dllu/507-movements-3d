import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeStudReverserPhysics} from '../src/simulation/mujoco-stud-reverser/physics.js';
import {FLAT_INPUT_ARM} from '../src/simulation/mujoco-stud-reverser/geometry.js';
const mujoco=await loadMujoco(),p=makeStudReverserPhysics(mujoco,{timestep:Number(process.env.DT??.00025),barFriction:Number(process.env.FRICTION??.5),outputLengthScale:Number(process.env.OUTPUT_SCALE??1),inputContactMinimum:Number(process.env.INPUT_MIN??0),...(process.env.FLAT?FLAT_INPUT_ARM:{})});
try{
 const rows=[],ticks=Math.round(6*p.description.period/p.timestep),stride=Math.round(.01/p.timestep);
 for(let i=0;i<=ticks;i++){if(i%stride===0)rows.push(p.state());if(i<ticks)p.step();}
 const final=rows.filter(s=>s.time>=5*p.description.period-1e-6),range=k=>[Math.min(...final.map(s=>s.qpos[k])),Math.max(...final.map(s=>s.qpos[k]))];
 const cycle=rows.filter(s=>Math.abs(s.time/p.description.period-Math.round(s.time/p.description.period))<1e-7);
 const report={movement:153,description:p.description,summary:{barRange:range(1),leverRange:range(2),cycleEnds:cycle.map(s=>({time:s.time,bar:s.qpos[1],lever:s.qpos[2],velocities:s.qvel.slice(1)}))},sources:['scripts/probe-stud-reverser.mjs','src/simulation/mujoco-stud-reverser/physics.js','src/simulation/mujoco-stud-reverser/geometry.js','src/simulation/authored-stud-drives.js','src/simulation/mujoco/mass.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.env.REPORT??'docs/validation/153-passive-prototype.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync('/dev/shm/153-passive-samples.json',JSON.stringify(rows));console.log(report.summary);
}finally{p.dispose();}
