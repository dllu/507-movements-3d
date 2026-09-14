import fs from 'node:fs';import crypto from 'node:crypto';import loadMujoco from '@mujoco/mujoco';
import {makePlateShearsGeometry} from '../src/simulation/mujoco-plate-shears/geometry.js';
import {makePlateShearsPhysics} from '../src/simulation/mujoco-plate-shears/physics.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const v=makePlateShearsGeometry(),p=makePlateShearsPhysics(await loadMujoco(),v,JSON.parse(process.env.SIM_OPTIONS??'{}'));
const sources=['src/simulation/mujoco-plate-shears/geometry.js','src/simulation/mujoco-plate-shears/physics.js','src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js','src/simulation/primitives.js','package-lock.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
try{const rows=[];let min=Infinity,max=-Infinity,penetration=0,resets=0;for(let i=0;i<16/p.timestep;i++){
 p.step();if(Math.abs(p.data.time-(i+1)*p.timestep)>1e-7)resets++;min=Math.min(min,p.data.qpos[1]);max=Math.max(max,p.data.qpos[1]);
 const contacts=p.data.contact;try{for(let k=0;k<contacts.size();k++){const c=contacts.get(k);try{penetration=Math.max(penetration,-c.dist);}finally{c.delete();}}}finally{contacts.delete();}
 if(i%Math.round(.001/p.timestep)===0)rows.push([p.data.time,...p.data.qpos]);
 }const result={sources,options:p.description.options,mass:p.description.mass,min,max,penetration,resets,rows};fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/130-recording.json',JSON.stringify(result));console.log({...result,sources:sources.length,rows:rows.length});
}finally{p.dispose();disposeObject3D(v.root);}
