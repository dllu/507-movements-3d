import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSectorHandoff} from '../src/simulation/mujoco-sector-handoff/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {sectorHandoffStudySources} from './lib/sector-handoff-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/123-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??12.25),disableCam=process.env.DISABLE_CAM==='1';
const sources=freezeStudySources(sectorHandoffStudySources('scripts/probe-sector-handoff-dynamics.mjs'),prefix),v=makeMujocoSectorHandoff(await loadMujoco(),options),p=v.physics,f=v.root.userData.profile;
try{
 if(disableCam)for(const[id,n]of Object.entries(p.geomGroups))if(n==='transferCam')p.model.geom_contype[id]=p.model.geom_conaffinity[id]=0;
 const rows=[],ranges=Object.fromEntries(Object.keys(p.joints).map(n=>[n,[Infinity,-Infinity]])),pairs={};let maximumPenetrationPixels=0,maximumRackErrorPixels=0,maximumSpurRollingErrorPixels=0,timeResets=0,previous=0,retreat=0,peak=0;
 for(let i=0;i<Math.ceil(duration/p.timestep);i++){
  p.step();if(![...p.data.qpos,...p.data.qvel].every(Number.isFinite))throw Error('Nonfinite state');if(p.data.time<previous)timeResets++;previous=p.data.time;
  const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qpos[j.q]]));for(const[n,x]of Object.entries(q)){ranges[n][0]=Math.min(ranges[n][0],x);ranges[n][1]=Math.max(ranges[n][1],x);}
  peak=Math.max(peak,q.center);retreat=Math.max(retreat,peak-q.center);maximumRackErrorPixels=Math.max(maximumRackErrorPixels,100*Math.abs(q.rack-p.description.input(p.data.time).position));for(const n of ['left','right'])maximumSpurRollingErrorPixels=Math.max(maximumSpurRollingErrorPixels,100*f.D/2*Math.abs(q[n]+q.center));
  const cs=p.data.contact;try{for(let k=0;k<cs.size();k++){const c=cs.get(k);try{maximumPenetrationPixels=Math.max(maximumPenetrationPixels,-100*c.dist);const pair=[p.geomGroups[c.geom1],p.geomGroups[c.geom2]].sort().join('/');pairs[pair]=(pairs[pair]??0)+1;}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.01/p.timestep)===0)rows.push({time:p.data.time,qpos:q,qvel:Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qvel[j.v]])),contacts:p.data.ncon,inputForce:p.data.qfrc_actuator[p.joints.rack.v]});
 }
 const report={sources,options,disableCam,duration,ranges,maximumPenetrationPixels,maximumRackErrorPixels,maximumSpurRollingErrorPixels,maximumRetreatRadians:retreat,timeResets,pairs,rows,qualification:'Native rack input with passive rotors. These recorded trajectories and contacts qualify only the specified timestep, geometry, speed and load. Source fit, unintended hardware interference and physical playback require separate validation.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length});
}finally{v.dispose();}
