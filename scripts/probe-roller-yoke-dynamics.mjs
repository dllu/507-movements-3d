import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoRollerYoke} from '../src/simulation/mujoco-roller-yoke/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {rollerYokeStudySources} from './lib/roller-yoke-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/117-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??10),sources=freezeStudySources(rollerYokeStudySources('scripts/probe-roller-yoke-dynamics.mjs'),prefix),v=makeMujocoRollerYoke(await loadMujoco(),options),p=v.physics,u=v.root.userData,rows=[],pairs={},ranges=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,[p.data.qpos[j.q],p.data.qpos[j.q]]]));let penetration=0,motionError=0,inputError=0,timeResets=0,last=-1,witness,cost=0;
try{
 fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});
 for(let i=0;i<=Math.round(duration/p.timestep);i++){
  if(i){const t=performance.now();p.step();cost+=performance.now()-t;}const d=p.data;if(![...d.qpos,...d.qvel].every(Number.isFinite))throw Error('Nonfinite state');if(d.time<last)timeResets++;last=d.time;
  const q=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,d.qpos[j.q]])),velocity=Object.fromEntries(Object.entries(p.joints).map(([n,j])=>[n,d.qvel[j.v]])),expected=u.profile.at(Math.PI/2-q.input).radius-u.source.meanPitchRadius;
  motionError=Math.max(motionError,Math.abs(q.yoke-expected));inputError=Math.max(inputError,Math.abs(q.input-p.description.input(d.time).angle));for(const [n,x]of Object.entries(q))ranges[n]=[Math.min(ranges[n][0],x),Math.max(ranges[n][1],x)];
  const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{const ids=Array.from(c.geom),key=ids.map(id=>Object.keys(p.bodies).find(n=>p.bodies[n]===p.model.geom_bodyid[id])).sort().join('/');pairs[key]=(pairs[key]??0)+1;if(-c.dist>penetration){penetration=-c.dist;witness={time:d.time,geoms:ids,dist:c.dist,pos:Array.from(c.pos)};}}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.02/p.timestep)===0)rows.push({time:d.time,q,velocity,expected,contacts:d.ncon,constraintForce:Array.from(d.qfrc_constraint)});
 }
 const report={sources,options,duration,rows,ranges,contactPairs:pairs,timeResets,maximumPenetrationPixels:100*penetration,witness,maximumMotionErrorPixels:100*motionError,maximumInputErrorRadians:inputError,millisecondsPerStep:cost/(duration/p.timestep),qualification:'Native trial of the cam, yoke and independent rollers. Contacts and motion errors are diagnostic; actual-surface audit, contact negative controls, source comparison and browser inspection remain necessary.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,rows:rows.filter((_,i)=>i%50===0)});if(timeResets)throw Error('Native automatic resets');
}finally{v.dispose();}
