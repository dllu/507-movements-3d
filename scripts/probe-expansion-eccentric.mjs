import fs from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import { makeExpansionEccentricPhysics } from '../src/simulation/mujoco-expansion-eccentric/physics.js';
const p=makeExpansionEccentricPhysics(await loadMujoco(),JSON.parse(process.env.SIM_OPTIONS??'{}'));
try {
  const duration=Number(process.env.PROBE_SECONDS??20),rows=[];
  let penetration=0,min=Infinity,max=-Infinity,resets=0;
  for(let i=0;i<duration/p.timestep;i++){
    p.step();if(Math.abs(p.data.time-(i+1)*p.timestep)>1e-7)resets++;
    min=Math.min(min,p.data.qpos[1]);max=Math.max(max,p.data.qpos[1]);
    const contacts=p.data.contact;
    try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
    if(i%Math.round(.002/p.timestep)===0)rows.push([p.data.time,...p.data.qpos]);
  }
  const result={options:p.description.options,penetration,min,max,resets,rows};
  fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/137-probe.json',JSON.stringify(result));
  console.log({...result,rows:rows.length});
} finally {p.dispose();}
