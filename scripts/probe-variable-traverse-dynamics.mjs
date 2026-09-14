import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoVariableTraverse} from '../src/simulation/mujoco-variable-traverse/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {variableTraverseStudySources} from './lib/variable-traverse-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/122-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??8.25);
const sources=freezeStudySources(variableTraverseStudySources('scripts/probe-variable-traverse-dynamics.mjs'),prefix),v=makeMujocoVariableTraverse(await loadMujoco(),options),p=v.physics,f=v.root.userData.profile;
try{
 const rows=[],ranges=Object.fromEntries(Object.keys(p.joints).map(n=>[n,[Infinity,-Infinity]])),sites=[['upperRodEnd','topPin'],['lowerRodEnd','bottomPin']].map(pair=>pair.map(n=>p.id('mjOBJ_SITE',n)));
 let maximumPenetrationPixels=0,maximumLinkageErrorPixels=0,maximumRollingErrorPixels=0,timeResets=0,previous=0,contactSteps=0;
 for(let i=0;i<Math.ceil(duration/p.timestep);i++){
  p.step();if(![...p.data.qpos,...p.data.qvel].every(Number.isFinite))throw Error('Nonfinite native state');if(p.data.time<previous)timeResets++;previous=p.data.time;
  const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qpos[j.q]]));
  for(const[n,x]of Object.entries(q)){ranges[n][0]=Math.min(ranges[n][0],x);ranges[n][1]=Math.max(ranges[n][1],x);}
  maximumRollingErrorPixels=Math.max(maximumRollingErrorPixels,100*Math.abs(f.module/2*(f.upperTeeth*q.upper+f.lowerTeeth*q.lower)));
  for(const[a,b]of sites)maximumLinkageErrorPixels=Math.max(maximumLinkageErrorPixels,100*Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k])));
  if(p.data.ncon)contactSteps++;const cs=p.data.contact;try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{maximumPenetrationPixels=Math.max(maximumPenetrationPixels,-100*c.dist);}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.01/p.timestep)===0)rows.push({time:p.data.time,qpos:q,qvel:Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qvel[j.v]])),contacts:p.data.ncon,inputTorque:p.data.qfrc_actuator[p.joints.lower.v]});
 }
 const report={sources,options,duration,ranges,maximumPenetrationPixels,maximumLinkageErrorPixels,maximumRollingErrorPixels,timeResets,contactSteps,rows,qualification:'Native contact-driven geared double crank with ideal pins and guide. Sampled motion, complete-pattern closure, source fit and all visible hardware require separate qualification.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length});
}finally{v.dispose();}
