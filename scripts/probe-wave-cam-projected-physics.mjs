import fs from 'node:fs';
import {createHash} from 'node:crypto';
import load from '@mujoco/mujoco';
import {makeWaveCamPhysics} from '../src/simulation/mujoco-wave-cam/physics.js';
import {waveCamSampledGap} from '../src/simulation/mujoco-wave-cam/clearance.js';
const settings={segments:180,profileTolerance:.001,clearance:-.006,profileType:'projected'},m=await load(),p=makeWaveCamPhysics(m,settings),cycles=[],rows=[];
let minimumGap=Infinity,maximumGap=-Infinity,maximumPenetration=0,maximumClosure=0;
try{
 for(let cycle=0;cycle<3;cycle++){
  for(let i=0;i<36000;i++){
   p.step();if(cycle===2){const s=p.state();maximumPenetration=Math.max(maximumPenetration,s.penetration);maximumClosure=Math.max(maximumClosure,s.closure);if(i%20===0){rows.push(s);const {gap}=waveCamSampledGap(s,{profileType:'projected'});minimumGap=Math.min(minimumGap,gap);maximumGap=Math.max(maximumGap,gap);}}
  }
  cycles.push(p.state());
 }
 const sources=['scripts/probe-wave-cam-projected-physics.mjs','src/simulation/mujoco-wave-cam/physics.js','src/simulation/mujoco-wave-cam/contact-mesh.js','src/simulation/mujoco-wave-cam/profile.js','src/simulation/mujoco-wave-cam/projected-profile.js','src/simulation/mujoco-wave-cam/adaptive-profile.js','src/simulation/mujoco-wave-cam/clearance.js','src/simulation/mujoco/simulation.js','package-lock.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:165,status:'unregistered-projected-profile-native-study',description:p.description,cycles,outputEndpointDifference:cycles[2].outputY-cycles[1].outputY,maximumReportedPenetration:maximumPenetration,maximumClosureError:maximumClosure,minimumSampledContinuousGap:minimumGap,maximumSampledContinuousGap:maximumGap,method:'Three native revolutions at 18 seconds each. Last revolution: all-tick penetration/closure checks, continuous-face samples and trajectory capture at 10 ms. Endpoint proximity alone does not establish repeatable roller spin or qualify a baked seam.',sources};
 fs.writeFileSync('/dev/shm/165-projected-settling.json',JSON.stringify(rows));fs.writeFileSync('docs/validation/165-projected-physics.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{p.dispose();}
