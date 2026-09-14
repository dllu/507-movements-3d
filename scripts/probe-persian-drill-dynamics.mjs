import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoPersianDrill} from '../src/simulation/mujoco-persian-drill/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {persianDrillStudySources} from './lib/persian-drill-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/112-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),duration=Number(process.env.DURATION??12);
const sources=freezeStudySources(persianDrillStudySources('scripts/probe-persian-drill-dynamics.mjs'),prefix),mj=await loadMujoco(),began=performance.now(),v=makeMujocoPersianDrill(mj,options),compileMilliseconds=performance.now()-began,p=v.physics,f=v.root.userData.profile;
fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});console.log({compileMilliseconds,geoms:p.model.ngeom});
try {
 const steps=Math.round(duration/p.timestep),rows=[],sampleSteps=Math.max(1,Math.round(.1/p.timestep));
 let penetration=0,witness,inputError=0,screwError=0,stepJump=0,previous=0,minimum=Infinity,maximum=-Infinity;const started=performance.now();
 for(let i=0;i<=steps;i++) {
  if(i)p.step();const d=p.data,q=Array.from(d.qpos);if(![...q,...d.qvel].every(Number.isFinite))throw Error('Nonfinite state');
  inputError=Math.max(inputError,Math.abs(q[1]-p.description.input(d.time).position));screwError=Math.max(screwError,Math.abs(q[1]+f.lead*q[0]));stepJump=Math.max(stepJump,Math.abs(q[0]-previous));previous=q[0];minimum=Math.min(minimum,q[0]);maximum=Math.max(maximum,q[0]);
  const contacts=d.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{if(-c.dist>penetration){penetration=-c.dist;witness={time:d.time,qpos:q,geoms:Array.from(c.geom)};}}finally{c.delete();}}}finally{contacts.delete();}
  if(i%sampleSteps===0||i===steps)rows.push({time:d.time,qpos:q,qvel:Array.from(d.qvel),contacts:d.ncon});
  if(i%Math.round(1/p.timestep)===0)console.log({time:d.time,qpos:q,contacts:d.ncon});
 }
 const report={sources,options,duration,compileMilliseconds,millisecondsPerStep:(performance.now()-started)/steps,rows,maximumPenetrationPixels:100*penetration,witness,maximumInputErrorPixels:inputError*100,maximumScrewErrorPixels:screwError*100,maximumAngularStep:stepJump,angleRange:[minimum,maximum],expectedAngleRange:[-f.amplitude/f.lead,f.amplitude/f.lead],qualification:p.description.assumptions};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,rows:rows.length});
}finally{v.dispose();}
