import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorPhysics} from '../src/simulation/mujoco-water-governor/physics.js';
const m=await loadMujoco(),runs=[];
for(const timestep of [.0005,.00025,.000125,.0000625]){
 const p=makeWaterGovernorPhysics(m,{timestep}),samples=[];let maxDepth=0,firstForward=null,firstReverse=null;
 try{
  const ticks=Math.round(8/timestep),stride=Math.round(.002/timestep);
  for(let tick=0;tick<=ticks;tick++){
   const s=p.state();maxDepth=Math.max(maxDepth,...s.contacts.map(c=>-c.distance));
   if(firstForward===null&&s.outputSpeed>.1)firstForward=s.time;
   if(firstReverse===null&&s.outputSpeed<-.1)firstReverse=s.time;
   if(tick%stride===0)samples.push(s);
   if(tick<ticks)p.step();
  }
  runs.push({timestep,maxDepth,firstForward,firstReverse,finalOutput:samples.at(-1).output,samples});
 }finally{p.dispose();}
}
const differences=runs.slice(1).map((b,i)=>{
 const a=runs[i];return{coarse:a.timestep,fine:b.timestep,...Object.fromEntries(['spindle','leftSpread','sleeveY','output'].map(key=>[key,Math.max(...a.samples.map((s,j)=>Math.abs(s[key]-b.samples[j][key])))]))};
});
const report={movement:162,status:'native-contact-refinement',duration:8,samplingInterval:.002,runs:runs.map(({samples,...r})=>r),differences,sources:['scripts/refine-water-governor.mjs','src/simulation/mujoco-water-governor/physics.js','src/simulation/mujoco-water-governor/backing-contact.js','src/simulation/mujoco-water-governor/bevel-train.js','src/simulation/bevel-geometry.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('/dev/shm/162-refined-runs.json',JSON.stringify(runs));fs.writeFileSync('docs/validation/162-contact-refinement.json',JSON.stringify(report,null,2)+'\n');console.log(report);
