import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeWaterGovernorPhysics} from '../src/simulation/mujoco-water-governor/physics.js';
const m=await loadMujoco(),runs=[];
for(const options of [{},{timestep:.00025},{contact:false},{studPhase:1},{speedAmplitude:0}]){
 const p=makeWaterGovernorPhysics(m,options);try{
  let firstForward=null,firstReverse=null,maxDepth=0,maxConnection=0,maxGearError=0,minSpeed=0,maxSpeed=0;const samples=[];
  for(let tick=0;tick<=Math.round(8/p.timestep);tick++){
   const s=p.state();
   if(firstForward===null&&s.outputSpeed>.1)firstForward=s.time;
   if(firstReverse===null&&s.outputSpeed<-.1)firstReverse=s.time;
   minSpeed=Math.min(minSpeed,s.outputSpeed);maxSpeed=Math.max(maxSpeed,s.outputSpeed);
   maxDepth=Math.max(maxDepth,...s.contacts.map(c=>-c.distance));maxConnection=Math.max(maxConnection,...s.connectionErrors);
   maxGearError=Math.max(maxGearError,Math.abs(s.upper-s.output),Math.abs(s.lower+s.output));
   if(tick%Math.round(.01/p.timestep)===0)samples.push(s);
   if(tick<Math.round(8/p.timestep))p.step();
  }
  const summary={options,firstForward,firstReverse,maxDepth,maxConnection,maxGearError,minSpeed,maxSpeed,finalOutput:samples.at(-1).output,actuators:p.model.nu};
  runs.push({...summary,samples});console.log(summary);
 }finally{p.dispose();}
}
const a=runs[0].samples,b=runs[1].samples,refinement={maximumSpindleDifference:Math.max(...a.map((s,i)=>Math.abs(s.spindle-b[i].spindle))),maximumSpreadDifference:Math.max(...a.map((s,i)=>Math.abs(s.leftSpread-b[i].leftSpread))),maximumOutputDifference:Math.max(...a.map((s,i)=>Math.abs(s.output-b[i].output)))};
const sources=['scripts/probe-water-governor.mjs','src/simulation/mujoco-water-governor/physics.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync('/dev/shm/162-native-runs.json',JSON.stringify(runs));fs.writeFileSync('docs/validation/162-native-selector.json',JSON.stringify({movement:162,status:'native-diagnostic-not-registered',runs:runs.map(({samples,...r})=>r),refinement,sources},null,2)+'\n');console.log(refinement);
