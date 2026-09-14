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
 let penetration=0,penetrationWitness,inputError=0,minimum=Infinity,maximum=-Infinity,contacts=0,maximumStep=0,previous=p.data.qpos[1];const start=performance.now();
 for(let i=0;i<=steps;i++) {
  if(i)p.step();const d=p.data,q=Array.from(d.qpos);
  if(![...q,...d.qvel].every(Number.isFinite))throw new Error('Nonfinite state');
  inputError=Math.max(inputError,Math.abs(q[0]-d.time*p.description.omega));minimum=Math.min(minimum,q[1]);maximum=Math.max(maximum,q[1]);contacts+=d.ncon;
  maximumStep=Math.max(maximumStep,Math.abs(q[1]-previous));previous=q[1];
  const cs=d.contact;try{for(let j=0;j<cs.size();j++){const c=cs.get(j);try{if(-c.dist>penetration){penetration=-c.dist;penetrationWitness={time:d.time,qpos:q,geoms:Array.from(c.geom),position:Array.from(c.pos)};}}finally{c.delete();}}}finally{cs.delete();}
  if(i%Math.round(.1/p.timestep)===0)rows.push({time:d.time,qpos:q,qvel:Array.from(d.qvel),contacts:d.ncon,target:p.control.target});
  if(i%Math.round(1/p.timestep)===0)console.log({time:d.time,qpos:q,contacts:d.ncon});
 }
 const millisecondsPerStep=(performance.now()-start)/steps,speedErrors=[],strokeOffsets=new Map();
 for(let i=1;i<rows.length;i++) {
  const a=rows[i-1],b=rows[i],selections=p.control.transitions.filter(t=>t.time<=b.time),last=selections.at(-1),since=a.time-(last?.time??0);
  // Allow the selector's 0.45 s move and 0.30 s settling. Keep the complete
  // remaining stroke, including its approach to the next selection.
  if(since<p.description.options.switchTime+.30)continue;
  const sign=Math.sign(last?.target??-f.selectorAngle),speed=sign*f.pitch*p.description.omega/(2*Math.PI);
  speedErrors.push(Math.abs(((b.qpos[1]-a.qpos[1])/(b.time-a.time))/speed-1)*100);
  if(!strokeOffsets.has(selections.length))strokeOffsets.set(selections.length,[]);
  strokeOffsets.get(selections.length).push(b.qpos[1]-sign*f.pitch*b.qpos[0]/(2*Math.PI));
 }
 speedErrors.sort((a,b)=>a-b);
 const uniformStrokeErrors=[...strokeOffsets].map(([stroke,values])=>{
  values.sort((a,b)=>a-b);const offset=values[Math.floor(values.length/2)];
  return {stroke,samples:values.length,maximumDeviationPixels:100*Math.max(...values.map(x=>Math.abs(x-offset)))};
 });
 const result={sources,options,duration,compileMilliseconds,millisecondsPerStep,rows,transitions:p.control.transitions,
  inputErrorRadians:inputError,maximumPenetrationPixels:100*penetration,penetrationWitness,travelPixels:[100*minimum,100*maximum],contactRecords:contacts,
  maximumStepPixels:100*maximumStep,workingStroke:{speedIntervalSeconds:.1,excludedAfterSelectionSeconds:p.description.options.switchTime+.30,samples:speedErrors.length,p95SpeedErrorPercent:speedErrors[Math.floor(.95*(speedErrors.length-1))],maximumSpeedErrorPercent:speedErrors.at(-1),uniformStrokeErrors},
  qualification:'Candidate native thread contact and automatic selection. Finite hardware clearances, source overlay and switching robustness remain unqualified.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log({...result,sources:undefined,rows:rows.length});
}finally{v.dispose();}
