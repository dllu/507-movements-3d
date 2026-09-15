import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeFanGovernorPhysics} from '../src/simulation/mujoco-fan-governor/physics.js';
const mujoco=await loadMujoco(),runs=[];
for(const options of [{drag:0},{drag:1.5,speed:1.5},{drag:1.5},{drag:1.5,timestep:.0005},{drag:1.5,segments:320}]){
 const p=makeFanGovernorPhysics(mujoco,options);
 try{
  const samples=[];
  const steps=Math.round(6/p.timestep),stride=Math.round(.1/p.timestep);
  for(let i=0;i<=steps;i++){if(i%stride===0)samples.push(p.state());if(i<steps)p.step();}
  runs.push({options:p.description.options,samples});console.log({options,final:p.state()});
 }finally{p.dispose();}
}
fs.writeFileSync('/dev/shm/147-physics-probe.json',JSON.stringify(runs,null,2)+'\n');
const report={movement:147,status:'passive-contact-prototype-only',
 assumptions:'Quadratic track rise, spherical crowned-roller contact, assumed inertias, quadratic air torque. No force is applied to lift and no crosshead coordinate is prescribed. Visible geometry is not yet matched to these surfaces.',
 runs:runs.map(r=>({options:r.options,final:r.samples.at(-1),lateHeightRange:[Math.min(...r.samples.filter(s=>s.time>4).map(s=>s.lift)),Math.max(...r.samples.filter(s=>s.time>4).map(s=>s.lift))]})),
 sources:['scripts/probe-fan-governor-physics.mjs','src/simulation/mujoco-fan-governor/physics.js','src/simulation/mujoco-fan-governor/source.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/147-passive-prototype.json',JSON.stringify(report,null,2)+'\n');
