import fs from 'node:fs';
import crypto from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeVariableCamPhysics} from '../src/simulation/mujoco-variable-cam/physics.js';
const p=makeVariableCamPhysics(await loadMujoco(),JSON.parse(process.env.SIM_OPTIONS??'{}'));
try{
 const duration=Number(process.env.PROBE_SECONDS??24),rows=[[0,...p.data.qpos]];let penetration=0,resets=0;
 for(let i=0;i<duration/p.timestep;i++){
  p.step();if(Math.abs(p.data.time-(i+1)*p.timestep)>1e-7)resets++;
  const contacts=p.data.contact;
  try{for(let j=0;j<contacts.size();j++){const c=contacts.get(j);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
  if((i+1)%Math.round(.002/p.timestep)===0)rows.push([p.data.time,...p.data.qpos]);
 }
 const sources=['src/simulation/authored-cams.js','src/simulation/mujoco-variable-cam/profile.js','src/simulation/mujoco-variable-cam/physics.js','src/simulation/mujoco/simulation.js','scripts/probe-variable-cam.mjs','package-lock.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const result={sources,options:p.description.options,penetration,resets,rows};
 fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/138-coarse.json',JSON.stringify(result));console.log({options:result.options,penetration,resets,rows:rows.length});
}finally{p.dispose();}
