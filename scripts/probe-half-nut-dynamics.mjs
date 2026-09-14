import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoHalfNut} from '../src/simulation/mujoco-half-nut/visual.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {halfNutStudySources} from './lib/half-nut-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/110-dynamics',options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const sources=freezeStudySources(halfNutStudySources('scripts/probe-half-nut-dynamics.mjs'),prefix);
const mujoco=await loadMujoco();
const compile=mujoco.MjModel.from_xml_string;
mujoco.MjModel.from_xml_string=xml=>{fs.writeFileSync(prefix+'.xml',xml,{flag:'wx'});console.log('Compiling native model');mujoco.MjModel.from_xml_string=compile;return mujoco.MjModel.from_xml_string(xml);};
const start=performance.now(),v=makeMujocoHalfNut(mujoco,options),compileMilliseconds=performance.now()-start,p=v.physics,f=v.root.userData.profile;
console.log({compiled:true,compileMilliseconds,ngeom:p.model.ngeom});
try {
 const duration=Number(process.env.DURATION??20),steps=Math.round(duration/p.timestep),rows=[];
 let penetration=0,penetrationWitness,inputError=0,minimum=Infinity,maximum=-Infinity,contacts=0;const start=performance.now();
 for(let i=0;i<=steps;i++) {
  if(i)p.step();const d=p.data,q=Array.from(d.qpos);
  if(![...q,...d.qvel].every(Number.isFinite))throw new Error('Nonfinite state');
  inputError=Math.max(inputError,Math.abs(q[0]-d.time*p.description.omega));minimum=Math.min(minimum,q[1]);maximum=Math.max(maximum,q[1]);contacts+=d.ncon;
  const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{if(-c.dist>penetration){penetration=-c.dist;penetrationWitness={time:d.time,qpos:q,geoms:Array.from(c.geom),position:Array.from(c.pos)};}}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.1/p.timestep)===0)rows.push({time:d.time,qpos:q,qvel:Array.from(d.qvel),contacts:d.ncon,target:p.control.target});
  if(i%Math.round(1/p.timestep)===0)console.log({time:d.time,qpos:q,contacts:d.ncon});
 }
 const result={sources,options,duration,compileMilliseconds,millisecondsPerStep:(performance.now()-start)/steps,rows,transitions:p.control.transitions,
  inputErrorRadians:inputError,maximumPenetrationPixels:100*penetration,penetrationWitness,travelPixels:[100*minimum,100*maximum],contactRecords:contacts,
  qualification:'Candidate native thread contact and automatic selection. Finite hardware clearances, source overlay and switching robustness remain unqualified.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log({...result,sources:undefined,rows:rows.length});
}finally{v.dispose();}
