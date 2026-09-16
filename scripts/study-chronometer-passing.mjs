import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeChronometerPassingStudy} from '../src/simulation/mujoco-chronometer-passing/physics.js';
const path=process.argv[2]??'/dev/shm/313-passing-study.json',options=JSON.parse(process.argv[3]??'{}'),duration=options.duration??12;delete options.duration;
const mujoco=await loadMujoco(),p=makeChronometerPassingStudy(mujoco,options),samples=[];let minGap=Infinity;
try{const n=Math.round(duration/p.description.options.timestep),stride=Math.round(.002/p.description.options.timestep);for(let i=0;i<=n;i++){
  if(i%stride===0){samples.push(p.state());const contacts=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=contacts.get(j);minGap=Math.min(minGap,c.dist);c.delete();}}finally{contacts.delete();}}
  if(i<n)p.step();
}const last=samples.filter(s=>s.time>duration-4-1e-7),summary={...p.description.options,minGap,detentRange:[Math.min(...last.map(s=>s.q[0])),Math.max(...last.map(s=>s.q[0]))],leafRange:[Math.min(...last.map(s=>s.q[1])),Math.max(...last.map(s=>s.q[1]))],returnDetentMax:Math.max(...last.filter(s=>(s.time%4)>2).map(s=>s.q[0]))};fs.writeFileSync(path,JSON.stringify({summary,samples})+'\n');console.log(summary);}finally{p.dispose();}
