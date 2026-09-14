import fs from 'node:fs';
import crypto from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeThreeWiperGeometry} from '../src/simulation/mujoco-three-wiper/geometry.js';
import {makeThreeWiperPhysics} from '../src/simulation/mujoco-three-wiper/physics.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const visual=makeThreeWiperGeometry(),physics=makeThreeWiperPhysics(await loadMujoco(),visual,JSON.parse(process.env.SIM_OPTIONS??'{}'));
const files=['src/simulation/mujoco-three-wiper/geometry.js','src/simulation/mujoco-three-wiper/physics.js','src/simulation/mujoco/simulation.js','src/simulation/primitives.js','package-lock.json'];
const sources=files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const inside=(p,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
try{
 const rows=[],duration=Number(process.env.DURATION??18);let min=Infinity,max=-Infinity,penetration=0,resets=0,wallContacts=0;
 for(let i=0;i<duration/physics.timestep;i++){
  physics.step();if(Math.abs(physics.data.time-(i+1)*physics.timestep)>1e-7)resets++;
  const x=physics.data.qpos[1];min=Math.min(min,x);max=Math.max(max,x);
  const contacts=physics.data.contact;
  try{for(let c=0;c<contacts.size();c++){const contact=contacts.get(c);try{
   penetration=Math.max(penetration,-contact.dist);
   // Probe just inside the frame side of the contact to classify the original
   // cam regions. A small neighbourhood tolerates triangulation/soft contact.
   const pos=[contact.pos[0]-x,contact.pos[1]];
   const atGate=visual.root.userData.gates.some(g=>[-.01,0,.01].some(dx=>[-.01,0,.01].some(dy=>inside([pos[0]+dx,pos[1]+dy],g))));
   if(contact.dist<0&&!atGate)wallContacts++;
  }finally{contact.delete();}}}finally{contacts.delete();}
  if(i%Number(process.env.SAMPLE_EVERY??20)===0)rows.push({time:physics.data.time,qpos:Array.from(physics.data.qpos),qvel:Array.from(physics.data.qvel)});
 }
 const report={sources,options:physics.description.options,cells:visual.root.userData.cells.length,min,max,penetration,resets,wallContacts,rows};
 fs.writeFileSync(process.env.PROBE_REPORT??'/dev/shm/128-dynamics-a.json',JSON.stringify(report,null,2));console.log({...report,rows:rows.length});
}finally{physics.dispose();disposeObject3D(visual.root);}
