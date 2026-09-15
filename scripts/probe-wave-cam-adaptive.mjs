import fs from 'node:fs';
import {createHash} from 'node:crypto';
import load from '@mujoco/mujoco';
import {makeWaveCamPhysics} from '../src/simulation/mujoco-wave-cam/physics.js';
import {waveCamSampledGap} from '../src/simulation/mujoco-wave-cam/clearance.js';
import {waveCamProfileAngles} from '../src/simulation/mujoco-wave-cam/adaptive-profile.js';
import {waveCamHeight} from '../src/simulation/mujoco-wave-cam/profile.js';
const runs=[],trajectories={};
for(const [name,options] of [['baseline',{}],['half-step',{timestep:.00025}],['refined-profile',{profileTolerance:.0005}]]){
 const settings={segments:90,profileTolerance:.001,...options},m=await load(),p=makeWaveCamPhysics(m,settings),rows=[],angles=waveCamProfileAngles({segments:90,tolerance:settings.profileTolerance});
 let penetration=0,closure=0,camError=0,minimumGap=Infinity,maximumGap=-Infinity,profileError=0;
 for(let i=1;i<angles.length;i++)for(let j=0;j<=64;j++){
  const u=j/64,a=angles[i-1],b=angles[i];profileError=Math.max(profileError,Math.abs(waveCamHeight(a+(b-a)*u)-((1-u)*waveCamHeight(a)+u*waveCamHeight(b))));
 }
 try{
  for(let i=0;i<Math.round(18/p.timestep);i++){
   p.step();const s=p.state();penetration=Math.max(penetration,s.penetration);closure=Math.max(closure,s.closure);camError=Math.max(camError,Math.abs(s.cam-s.time*Math.PI/9));
   if((i+1)%Math.round(.01/p.timestep)===0){rows.push(s);const {gap}=waveCamSampledGap(s,{samples:256});minimumGap=Math.min(minimumGap,gap);maximumGap=Math.max(maximumGap,gap);}
  }
  const result={name,description:p.description,angularCells:angles.length-1,maximumSampledProfileInterpolationError:profileError,maximumReportedPenetration:penetration,maximumClosureError:closure,maximumCamTrackingError:camError,minimumSampledContinuousFaceGap:minimumGap,maximumSampledContinuousFaceGap:maximumGap,final:p.state()};runs.push(result);trajectories[name]=rows;console.log(JSON.stringify(result));
 }finally{p.dispose();}
}
const comparisons=['half-step','refined-profile'].map(name=>({name,maximumOutputDifference:Math.max(...trajectories[name].map((s,i)=>Math.abs(s.outputY-trajectories.baseline[i].outputY)))}));
const sources=['scripts/probe-wave-cam-adaptive.mjs','src/simulation/mujoco-wave-cam/physics.js','src/simulation/mujoco-wave-cam/contact-mesh.js','src/simulation/mujoco-wave-cam/adaptive-profile.js','src/simulation/mujoco-wave-cam/profile.js','src/simulation/mujoco-wave-cam/clearance.js','src/simulation/mujoco/simulation.js','package-lock.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync('/dev/shm/165-adaptive-trajectories.json',JSON.stringify(trajectories));fs.writeFileSync('docs/validation/165-adaptive-study.json',JSON.stringify({movement:165,status:'unregistered-adaptive-contact-study',method:'18 second revolution. Contact/closure every tick; independent continuous-face samples and output comparisons every 10 ms. Profile chord error sampled at 65 positions per adaptive cell. Reported gaps are sampled evidence, not complete rendered-solid clearance.',runs,comparisons,sources},null,2)+'\n');console.log(comparisons);
