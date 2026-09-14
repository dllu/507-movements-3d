import fs from 'node:fs';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoBellCrank} from '../src/simulation/mujoco-bell-crank/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {bellCrankStudySources} from './lib/bell-crank-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/126-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??8);
assert(Number.isFinite(duration)&&duration>0);
const sources=freezeStudySources(bellCrankStudySources('scripts/probe-bell-crank-dynamics.mjs'),prefix),v=makeMujocoBellCrank(await loadMujoco(),options),p=v.physics;
try{
 const rows=[],ranges=Object.fromEntries(Object.keys(p.joints).map(n=>[n,[Infinity,-Infinity]]));
 let maximumPenetrationPixels=0,maximumConnectionErrorPixels=0,maximumPassiveActuation=0,timeResets=0,previous=0,failure=null,contactSteps=0;
 const start=Date.now();
 for(let i=0;i<Math.ceil(duration/p.timestep);i++){
  p.step();
  if(p.data.time<previous){timeResets++;failure='Native time reset';break;}previous=p.data.time;
  if(![...p.data.qpos,...p.data.qvel].every(Number.isFinite)){failure='Nonfinite native state';break;}
  const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qpos[j.q]]));
  for(const[n,x]of Object.entries(q)){ranges[n][0]=Math.min(ranges[n][0],x);ranges[n][1]=Math.max(ranges[n][1],x);}
  for(const[n,j]of Object.entries(p.joints))if(n!=='drive')maximumPassiveActuation=Math.max(maximumPassiveActuation,Math.abs(p.data.qfrc_actuator[j.v]));
  for(const[a,b]of p.connections)maximumConnectionErrorPixels=Math.max(maximumConnectionErrorPixels,100*Math.hypot(...[0,1,2].map(k=>p.data.site_xpos[3*a+k]-p.data.site_xpos[3*b+k])));
  const contacts=p.data.contact;if(p.data.ncon)contactSteps++;
  try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{maximumPenetrationPixels=Math.max(maximumPenetrationPixels,-100*c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  if(i%Math.round(.02/p.timestep)===0)rows.push({time:p.data.time,qpos:q,qvel:Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,p.data.qvel[j.v]])),cords:Object.fromEntries(['input','output'].map(n=>[n,p.getCordPoints(n)])),contacts:p.data.ncon,inputForce:p.data.qfrc_actuator[p.joints.drive.v]});
  if(i%1000===0)console.log({time:p.data.time,wallSeconds:(Date.now()-start)/1000,q,maximumPenetrationPixels,maximumConnectionErrorPixels});
 }
 const report={sources,options,duration,completedTime:p.data.time,lastGoodTime:previous,failure,ranges,maximumPenetrationPixels,maximumConnectionErrorPixels,maximumPassiveActuation,timeResets,contactSteps,rows,qualification:'Native finite-cord prototype with ideal bearings, endpoint guides and pin clamps. Source fit, surface clearance, step/mesh/load sensitivity and browser performance require separate qualification.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:sources.length,rows:rows.length});assert.equal(failure,null);
}finally{v.dispose();}
