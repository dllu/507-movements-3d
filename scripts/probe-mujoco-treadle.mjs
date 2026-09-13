import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {makeTreadleRatchetCandidate} from '../src/simulation/mujoco-treadle/geometry.js';
import {makeTreadlePhysics} from '../src/simulation/mujoco-treadle/physics.js';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/082-mujoco-first';
const visual=makeTreadleRatchetCandidate({shortFaceFraction:.06}),mujoco=await loadMujoco(),start=performance.now();
const physics=makeTreadlePhysics(mujoco,visual,{timestep:Number(process.env.PROBE_DT??.0005),lowerSpring:Number(process.env.PROBE_SPRING??4)});
console.log({compileMs:performance.now()-start,pieces:Object.fromEntries(Object.entries(physics.description.collision).map(([k,v])=>[k,{pieces:v.cells.length,error:v.maximumBoundaryError}])),equalizer:physics.description.equalizer,nq:physics.model.nq});
fs.writeFileSync(prefix+'.xml',physics.description.xml);
const rows=[physics.state()],duration=Number(process.env.PROBE_DURATION??12),begin=performance.now();let minimumGap=0,maxContacts=0;
try{
 while(physics.data.time<duration){physics.step();if(!Number.isFinite(physics.data.qpos[0]))throw Error('Nonfinite simulation');
  if(Math.round(physics.data.time/physics.timestep)%20===0){rows.push(physics.state());const contacts=physics.data.contact;for(let i=0;i<contacts.size();i++){const c=contacts.get(i);minimumGap=Math.min(minimumGap,c.dist);c.delete();}contacts.delete();}
  maxContacts=Math.max(maxContacts,physics.data.ncon);
 }
 const summary={seconds:duration,wallSeconds:(performance.now()-begin)/1000,initial:rows[0],final:rows.at(-1),minimumGap,maxContacts};
 fs.writeFileSync(prefix+'.json',JSON.stringify({summary,rows})+'\n');console.log(summary);
}finally{physics.dispose();visual.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
