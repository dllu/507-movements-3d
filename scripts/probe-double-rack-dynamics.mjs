import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoDoubleRack} from '../src/simulation/mujoco-double-rack/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {doubleRackStudySources} from './lib/double-rack-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/114-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??16),sources=freezeStudySources(doubleRackStudySources('scripts/probe-double-rack-dynamics.mjs'),prefix),mujoco=await loadMujoco(),start=performance.now(),v=makeMujocoDoubleRack(mujoco,options),compileMilliseconds=performance.now()-start,p=v.physics,rows=[];let penetration=0,inputError=0,stepCost=0,witness,frameRange=[Infinity,-Infinity],reversals=[];
try{
 fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});
 for(let i=0;i<=Math.round(duration/p.timestep);i++){
  if(i){const t=performance.now();p.step();stepCost+=performance.now()-t;}const d=p.data;if(![...d.qpos,...d.qvel].every(Number.isFinite))throw Error('Nonfinite native state');
  inputError=Math.max(inputError,Math.abs(d.qpos[0]-p.description.input(d.time).angle));frameRange=[Math.min(frameRange[0],d.qpos[1]),Math.max(frameRange[1],d.qpos[1])];
  const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{if(-c.dist>penetration){penetration=-c.dist;witness={time:d.time,geoms:Array.from(c.geom),dist:c.dist};}}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.02/p.timestep)===0){const row={time:d.time,qpos:Array.from(d.qpos),qvel:Array.from(d.qvel),contacts:d.ncon};if(rows.length&&Math.sign(row.qvel[1])!==Math.sign(rows.at(-1).qvel[1])&&Math.abs(row.qvel[1])>.01)reversals.push(row);rows.push(row);}
 }
 const report={sources,options,duration,compileMilliseconds,millisecondsPerStep:stepCost/(duration/p.timestep),rows,maximumPenetrationPixels:100*penetration,witness,maximumInputErrorRadians:inputError,frameRange,reversals,qualification:'Native state/contact trial only. Reversals must be checked for retained engagement and enclosure collisions; input progress alone is not successful reciprocation.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,rows:rows.filter((r,i)=>i%100===0),reversals:reversals.length});
}finally{v.dispose();}
