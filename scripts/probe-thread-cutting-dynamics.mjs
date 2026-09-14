import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoThreadCutting} from '../src/simulation/mujoco-thread-cutting/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {threadCuttingStudySources} from './lib/thread-cutting-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/109-dynamics',sources=freezeStudySources(threadCuttingStudySources('scripts/probe-thread-cutting-dynamics.mjs'),prefix);
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),mujoco=await loadMujoco(),v=makeMujocoThreadCutting(mujoco,options),p=v.physics,f=v.root.userData.profile;
try {
 const duration=Number(process.env.DURATION??p.description.options.period*10),n=Math.round(duration/p.timestep),rows=[],speedWindows=[];
 let inputError=0,feedError=0,gearError=0,travelError=0,previous;const window=Math.round(.1/p.timestep),start=performance.now();
 for(let i=0;i<=n;i++) {
  if(i)p.step();const data=p.data,target=p.description.input(data.time),q=Array.from(data.qpos);
  inputError=Math.max(inputError,Math.abs(q[0]-target.angle));feedError=Math.max(feedError,Math.abs(q[2]+f.lead*q[0]));gearError=Math.max(gearError,Math.abs(q[1]-f.ratio*q[0]));travelError=Math.max(travelError,Math.abs(q[2]-target.carriage));
  if(i%window===0){const ideal=-f.lead*target.velocity,onFlank=Math.abs(Math.abs(ideal)-(f.upper-f.lower)/(p.description.options.period*.475))<1e-9;
   if(onFlank&&previous?.ideal===ideal)speedWindows.push({start:previous.time,end:data.time,error:Math.abs((q[2]-previous.q)/.1-ideal)/Math.abs(ideal)});
   previous=onFlank?{time:data.time,q:q[2],ideal}:undefined;
  }
  if(i%Math.round(.5/p.timestep)===0)rows.push({time:data.time,qpos:q,qvel:Array.from(data.qvel),maximumWorkAngle:p.progress.maximumWorkAngle});
  if(![...q,...data.qvel].every(Number.isFinite))throw new Error('Nonfinite state');
 }
 const result={sources,options,duration,rows,speedWindows,inputErrorRadians:inputError,gearErrorRadians:gearError,feedErrorPixels:100*feedError,travelErrorPixels:100*travelError,millisecondsPerStep:(performance.now()-start)/n,
  qualification:'Ideal native screw and gear constraints, with geometric material removal and fixed initial workpiece inertia. No cutting forces or thread/tooth contact is simulated.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log({...result,sources:undefined,rows:rows.length,speedWindows:undefined,maximumSpeedErrorPercent:100*Math.max(...speedWindows.map(w=>w.error))});
}finally{v.dispose();}
