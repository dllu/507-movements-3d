import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoEqualRacks} from '../src/simulation/mujoco-equal-racks/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {equalRacksStudySources} from './lib/equal-racks-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/115-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??12),sources=freezeStudySources(equalRacksStudySources('scripts/probe-equal-racks-dynamics.mjs'),prefix),start=performance.now(),v=makeMujocoEqualRacks(await loadMujoco(),options),compileMilliseconds=performance.now()-start,p=v.physics,f=v.root.userData.profile,rows=[],pairs={};let penetration=0,meshError=0,inputError=0,gearError=0,stepCost=0,witness,range=[0,0],timeResets=0,previousTime=-Infinity;
try{
 fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});
 for(let i=0;i<=Math.round(duration/p.timestep);i++){
  if(i){const t=performance.now();p.step();stepCost+=performance.now()-t;}const d=p.data;if(![...d.qpos,...d.qvel].every(Number.isFinite))throw Error('Nonfinite state');if(d.time<previousTime)timeResets++;previousTime=d.time;
  meshError=Math.max(meshError,Math.abs(d.qpos[2]+f.pitchRadius*d.qpos[0]),Math.abs(d.qpos[2]-f.pitchRadius*d.qpos[1]));gearError=Math.max(gearError,Math.abs(f.workingRadius*(d.qpos[0]+d.qpos[1])));inputError=Math.max(inputError,Math.abs(d.qpos[2]-p.description.input(d.time).position));range=[Math.min(range[0],d.qpos[2]),Math.max(range[1],d.qpos[2])];
  const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{const ids=Array.from(c.geom),key=ids.map(id=>p.model.geom_bodyid[id]).sort().join('/');pairs[key]=(pairs[key]??0)+1;if(-c.dist>penetration){penetration=-c.dist;witness={time:d.time,geoms:ids,dist:c.dist,pos:Array.from(c.pos)};}}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.02/p.timestep)===0)rows.push({time:d.time,qpos:Array.from(d.qpos),qvel:Array.from(d.qvel),contacts:d.ncon});
 }
 const report={sources,options,duration,timeResets,finalNativeTime:p.data.time,compileMilliseconds,millisecondsPerStep:stepCost/(duration/p.timestep),rows,maximumPenetrationPixels:100*penetration,witness,maximumMeshErrorPixels:100*meshError,maximumGearErrorPixels:100*gearError,maximumInputErrorPixels:100*inputError,range,contactPairs:pairs,qualification:'Native state/contact trial. Pair contact counts show participation, not equal load sharing. Finite surfaces, source fit and playback require independent review.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,rows:rows.filter((_,i)=>i%75===0)});if(timeResets)throw Error('Native instability caused automatic resets');
}finally{v.dispose();}
