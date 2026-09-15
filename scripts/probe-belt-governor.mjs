import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {beltGovernorGeometry,beltGovernorLinkage} from '../src/simulation/mujoco-belt-governor/geometry.js';
import {makeBeltGovernorPhysics} from '../src/simulation/mujoco-belt-governor/physics.js';
const m=await loadMujoco(),runs=[];
for(const options of [{},{timestep:.00025},{speedAmplitude:0},{spindleDrive:false},{linkage:false},{loadScale:4},{speedAmplitude:.25},{speedAmplitude:.4},{speedAmplitude:.4,ballContact:false}]){
 const p=makeBeltGovernorPhysics(m,options),samples=[];let maximumClosure=0,maximumCollarError=0,minimumFork=Infinity,maximumFork=-Infinity,maximumFollower=0,maximumSpreadDrift=0;
 try{
  const ticks=Math.round(20/p.timestep),stride=Math.round(.01/p.timestep);
  for(let tick=0;tick<=ticks;tick++){
   const s=p.state();maximumClosure=Math.max(maximumClosure,...s.connectionErrors);maximumCollarError=Math.max(maximumCollarError,Math.abs(s.collarError??0));maximumSpreadDrift=Math.max(maximumSpreadDrift,Math.abs(s.leftSpread-p.geometry.initialSpread));
   if(s.forkY!==undefined){minimumFork=Math.min(minimumFork,s.forkY);maximumFork=Math.max(maximumFork,s.forkY);maximumFollower=Math.max(maximumFollower,Math.abs(s.followerX));}
   if(tick%stride===0)samples.push(s);
   if(tick<ticks)p.step();
  }
  runs.push({parameters:p.description,maximumClosure,maximumCollarError,minimumFork,maximumFork,maximumFollower,maximumSpreadDrift,finalState:samples.at(-1),samples});
 }finally{p.dispose();}
}
const g=beltGovernorGeometry(),minimumSleeveY=g.topY-g.elbowArm-Math.sqrt(g.lowerLink**2-(g.pivotRadius-g.sleeveRadius)**2);
const report={zeroSpreadReach:{minimumSleeveY,...beltGovernorLinkage(minimumSleeveY,g),upperPulleyY:g.upperPulleyY},movement:163,status:'unregistered-native-linkage-study',duration:20,geometry:beltGovernorGeometry(),runs:runs.map(({samples,...r})=>r),sources:['scripts/probe-belt-governor.mjs','src/simulation/mujoco-belt-governor/geometry.js','src/simulation/mujoco-belt-governor/physics.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('/dev/shm/163-native-runs.json',JSON.stringify(runs));fs.writeFileSync('docs/validation/163-native-linkage.json',JSON.stringify(report,null,2)+'\n');console.log(report.runs.map(({finalState,...r})=>r));
