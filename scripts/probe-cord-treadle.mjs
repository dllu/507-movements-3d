import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {cordTreadleParameters,cordTreadleSource,cordTreadleState} from '../src/simulation/cord-treadle-motion.js';
import loadMujoco from '@mujoco/mujoco';
import {makeCordTreadlePhysics} from '../src/simulation/mujoco-cord-treadle/physics.js';
const mujoco=await loadMujoco(),p=makeCordTreadlePhysics(mujoco,{timestep:Number(process.env.DT??.0005),cord:process.env.CORD!=='0',period:Number(process.env.PERIOD??4)});
try{
 const rows=[],cycles=4,ticks=Math.round(cycles*p.description.period/p.timestep),stride=Math.round(.005/p.timestep);
 for(let i=0;i<=ticks;i++){if(i%stride===0){mujoco.mj_forward(p.model,p.data);rows.push(p.state());}if(i<ticks)p.step();}
 const settled=rows.filter(s=>s.time>=3*p.description.period-1e-7),range=(states,fn)=>[Math.min(...states.map(fn)),Math.max(...states.map(fn))];
 const g=cordTreadleParameters({...cordTreadleSource,period:p.description.period});
 const summary={maximumTautAngleDifference:p.description.cord?Math.max(...rows.map(s=>Math.abs(s.qpos[1]-cordTreadleState(s.qpos[0]*g.period/(2*Math.PI),g).treadleAngle))):null,treadleRange:range(settled,s=>s.qpos[1]),constraintTorqueRange:range(settled,s=>s.passiveConstraintTorque),actuatorTorqueRange:range(rows,s=>s.actuatorTorque),cordErrorRange:p.description.cord?range(rows,s=>s.cordLength-p.description.cordLength):null,cycleEnds:rows.filter(s=>Math.abs(s.time/p.description.period-Math.round(s.time/p.description.period))<1e-7)};
 const report={movement:159,description:p.description,summary,sources:['scripts/probe-cord-treadle.mjs','src/simulation/mujoco-cord-treadle/physics.js','src/simulation/cord-treadle-motion.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync(process.env.REPORT??'docs/validation/159-passive-prototype.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(process.env.SAMPLES??'/dev/shm/159-passive-samples.json',JSON.stringify(rows));console.log(report);
}finally{p.dispose();}
