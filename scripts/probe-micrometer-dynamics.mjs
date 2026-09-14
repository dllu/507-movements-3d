import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoMicrometer} from '../src/simulation/mujoco-micrometer/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {micrometerStudySources} from './lib/micrometer-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/111-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const sources=freezeStudySources(micrometerStudySources('scripts/probe-micrometer-dynamics.mjs'),prefix),mj=await loadMujoco(),began=performance.now(),v=makeMujocoMicrometer(mj,options),compileMilliseconds=performance.now()-began,p=v.physics,f=v.root.userData.profile;
fs.writeFileSync(prefix+'.xml',p.description.xml,{flag:'wx'});console.log({compileMilliseconds,geoms:p.model.ngeom});
try {
 const duration=Number(process.env.DURATION??32),steps=Math.round(duration/p.timestep),rows=[],sampleSteps=Math.max(1,Math.round(.1/p.timestep));
 let penetration=0,witness,outerError=0,innerError=0,inputError=0,stepJump=0,previous=p.coordinates().output,minimum=Infinity,maximum=-Infinity;const started=performance.now();
 for(let i=0;i<=steps;i++) {
  if(i)p.step();const d=p.data,q=Array.from(d.qpos),pose=p.coordinates();if(![...q,...d.qvel].every(Number.isFinite))throw Error('Nonfinite state');
  inputError=Math.max(inputError,Math.abs(pose.angle-p.description.input(d.time).angle));outerError=Math.max(outerError,Math.abs(pose.sleeve-f.leadOuter*pose.angle));innerError=Math.max(innerError,Math.abs(pose.output-f.difference*pose.angle));stepJump=Math.max(stepJump,Math.abs(pose.output-previous));previous=pose.output;minimum=Math.min(minimum,pose.output);maximum=Math.max(maximum,pose.output);
  const contacts=d.contact;try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{if(-c.dist>penetration){penetration=-c.dist;witness={time:d.time,qpos:q,geoms:Array.from(c.geom)};}}finally{c.delete();}}}finally{contacts.delete();}
  if(i%sampleSteps===0)rows.push({time:d.time,qpos:q,qvel:Array.from(d.qvel),pose,contacts:d.ncon});
  if(i%Math.round(1/p.timestep)===0)console.log({time:d.time,qpos:q,contacts:d.ncon});
 }
 const report={sources,options,duration,compileMilliseconds,millisecondsPerStep:(performance.now()-started)/steps,rows,maximumPenetrationPixels:100*penetration,witness,maximumInputErrorRadians:inputError,maximumOuterConstraintErrorPixels:100*outerError,maximumDifferentialErrorPixels:100*innerError,maximumStepPixels:100*stepJump,travelPixels:[minimum*100,maximum*100],expectedTravelPixels:100*(f.pitchOuter-f.pitchInner)*f.turns,qualification:p.description.assumptions};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,rows:rows.length});
}finally{v.dispose();}
