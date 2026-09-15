import fs from 'node:fs';
import {createHash} from 'node:crypto';
import load from '@mujoco/mujoco';
import {makeWaveCamPhysics} from '../src/simulation/mujoco-wave-cam/physics.js';
const runs=[],trajectories={};
for(const [name,options,duration] of [
 ['native-multi',{collision:'native-multi'},1],
 ['native-single',{collision:'native-single'},18],
 ['baseline',{},18],
 ['half-step',{timestep:.00025},18],
 ['refined-mesh',{segments:480},18],
 ['no-contact',{contact:false},18],
]){
 const mujoco=await load(),p=makeWaveCamPhysics(mujoco,options),rows=[];let penetration=0,closure=0,camError=0,min=Infinity,max=-Infinity;
 try{
  const count=Math.round(duration/p.timestep),stride=Math.round(.01/p.timestep);
  for(let i=0;i<count;i++){
   p.step();const s=p.state();penetration=Math.max(penetration,s.penetration);closure=Math.max(closure,s.closure);camError=Math.max(camError,Math.abs(s.cam-s.time*Math.PI/9));min=Math.min(min,s.outputY);max=Math.max(max,s.outputY);
   if((i+1)%stride===0)rows.push(s);
  }
  trajectories[name]=rows;
  const result={name,description:p.description,duration,steps:count,maximumPenetration:penetration,maximumClosureError:closure,maximumCamTrackingError:camError,outputRange:[min,max],final:p.state()};runs.push(result);console.log(JSON.stringify(result));
 }finally{p.dispose();}
}
const baseline=trajectories.baseline;
const comparisons=['half-step','refined-mesh','no-contact'].map(name=>({name,maximumOutputDifference:Math.max(...trajectories[name].map((s,i)=>Math.abs(s.outputY-baseline[i].outputY)))}));
const sources=['scripts/probe-wave-cam-physics.mjs','src/simulation/mujoco-wave-cam/physics.js','src/simulation/mujoco-wave-cam/contact-mesh.js','src/simulation/mujoco-wave-cam/profile.js','src/simulation/mujoco/simulation.js','package-lock.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={movement:165,status:'unregistered-native-contact-study',method:'Full input revolution at 18 seconds. All-tick MuJoCo penetration and output-pin closure checks; 10 ms trajectory comparisons. Only cam actuated. No rendered-solid audit or settled playback qualification yet.',runs,comparisons,sources};
fs.writeFileSync('/dev/shm/165-native-trajectories.json',JSON.stringify(trajectories));fs.writeFileSync('docs/validation/165-native-study.json',JSON.stringify(report,null,2)+'\n');console.log(comparisons);
