import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoRackPinion} from '../src/simulation/mujoco-rack-pinion/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {rackPinionStudySources} from './lib/rack-pinion-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/113-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??12),sources=freezeStudySources(rackPinionStudySources('scripts/probe-rack-pinion-dynamics.mjs'),prefix);
const mujoco=await loadMujoco(),start=performance.now(),v=makeMujocoRackPinion(mujoco,options),compileMilliseconds=performance.now()-start,p=v.physics,f=v.root.userData.profile,rows=[];let penetration=0,inputError=0,meshError=0,lift=0,witness,stepCost=0;
try{
 fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});
 for(let i=0;i<=Math.round(duration/p.timestep);i++){
  if(i){const t=performance.now();p.step();stepCost+=performance.now()-t;}const d=p.data;
  if(![...d.qpos,...d.qvel].every(Number.isFinite))throw Error('Nonfinite native state');
  inputError=Math.max(inputError,Math.abs(d.qpos[1]-p.description.input(d.time).position));meshError=Math.max(meshError,Math.abs(d.qpos[1]+f.pitchRadius*d.qpos[0]));lift=Math.max(lift,Math.abs(d.qpos[2]));
  const contacts=d.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{if(-c.dist>penetration){penetration=-c.dist;witness={time:d.time,geoms:Array.from(c.geom),dist:c.dist};}}finally{c.delete();}}}finally{contacts.delete();}
  if(i%Math.round(.1/p.timestep)===0)rows.push({time:d.time,qpos:Array.from(d.qpos),qvel:Array.from(d.qvel),contacts:d.ncon});
 }
 const report={sources,options,duration,compileMilliseconds,millisecondsPerStep:stepCost/(duration/p.timestep),rows,maximumPenetrationPixels:100*penetration,witness,maximumInputErrorPixels:100*inputError,maximumMeshErrorPixels:100*meshError,maximumLiftPixels:100*lift,qualification:'Native positions and contact distances only; source fit and independent actual surface clearance require separate checks.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,rows:rows.filter((r,i)=>i%15===0)});
}finally{v.dispose();}
