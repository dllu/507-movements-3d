import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSegmentClamp} from '../src/simulation/mujoco-segment-clamp/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {segmentClampStudySources} from './lib/segment-clamp-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??5),sources=freezeStudySources(segmentClampStudySources('scripts/probe-segment-clamp-dynamics.mjs'),prefix),mujoco=await loadMujoco(),v=makeMujocoSegmentClamp(mujoco,options),p=v.physics,f=v.root.userData.profile;
try{const rows=[],ranges=Array.from({length:3},()=>[Infinity,-Infinity]),pairs={};let maximumPenetrationPixels=0,maximumRollingErrorPixels=0,timeResets=0,previous=0;
 for(let i=0;i<Math.ceil(duration/p.timestep);i++){
  p.step();if(![...p.data.qpos,...p.data.qvel].every(Number.isFinite))throw Error('Nonfinite state');
  if(p.data.time<previous)timeResets++;previous=p.data.time;for(let j=0;j<3;j++){ranges[j][0]=Math.min(ranges[j][0],p.data.qpos[j]);ranges[j][1]=Math.max(ranges[j][1],p.data.qpos[j]);}
  maximumRollingErrorPixels=Math.max(maximumRollingErrorPixels,100*Math.abs(p.data.qpos[1]+f.externalRatio*p.data.qpos[0])*f.externalTeeth*f.externalModule/2,100*Math.abs(p.data.qpos[2]-f.internalRatio*p.data.qpos[0])*f.internalTeeth*f.internalModule/2);
  const contacts=p.data.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{maximumPenetrationPixels=Math.max(maximumPenetrationPixels,-100*c.dist);const key=[p.geomGroups[c.geom1],p.geomGroups[c.geom2]].sort().join('/');pairs[key]=(pairs[key]??0)+1;}finally{c.delete();}}}finally{contacts.delete();}
  if(i%Math.round(.02/p.timestep)===0)rows.push({time:p.data.time,qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel),contacts:p.data.ncon,torque:p.data.qfrc_actuator[0]});
 }
 const report={sources,options,duration,cells:Object.fromEntries(Object.entries(v.root.userData.cells).map(([n,c])=>[n,c.length])),ranges,maximumPenetrationPixels,maximumRollingErrorPixels,timeResets,pairs,rows,qualification:'Diagnostic candidate. All jaw coordinates are passive. Native contacts include teeth and inferred widened jaws; source fidelity, continuous clearance and force convergence remain unqualified.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length});
}finally{v.dispose();}
