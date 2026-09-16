import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makePartialLantern199Study} from '../src/simulation/mujoco-partial-lantern/physics.js';
const path=process.argv[2]??'/dev/shm/199-native44.json',options=JSON.parse(process.argv[3]??'{}'),duration=options.duration??16,sampleStep=options.sampleStep??.005;
delete options.duration;delete options.sampleStep;
const mujoco=await loadMujoco(),p=makePartialLantern199Study(mujoco,options),samples=[];let minGap=Infinity,maxInputError=0,maxContactCount=0;
try{
 for(let i=0,steps=Math.round(duration/p.timestep),stride=Math.max(1,Math.round(sampleStep/p.timestep));i<=steps;i++){
  maxContactCount=Math.max(maxContactCount,p.data.ncon);
  if(i%stride===0){const s={...p.state(),contacts:p.data.ncon};samples.push(s);maxInputError=Math.max(maxInputError,Math.abs(s.input-p.description.options.speed*s.time));const contacts=p.data.contact;try{for(let k=0;k<p.data.ncon;k++){const c=contacts.get(k);try{minGap=Math.min(minGap,c.dist);}finally{c.delete();}}}finally{contacts.delete();}}
  if(i<steps)p.step();
 }
 const last=samples.filter(s=>s.time>duration-2*Math.PI/p.description.options.speed),summary={options:p.description.options,cells:p.description.cells,duration,minGap,maxInputError,maxContactCount,minX:Math.min(...last.map(s=>s.x)),maxX:Math.max(...last.map(s=>s.x)),final:samples.at(-1)};
 fs.writeFileSync(path,JSON.stringify({summary,samples})+'\n');fs.writeFileSync(path.replace(/\.json$/,'.xml'),p.description.xml);console.log(summary);
}finally{p.dispose();}
