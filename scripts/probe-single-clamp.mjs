import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeSingleClampPhysics} from '../src/simulation/mujoco-single-clamp/physics.js';
const m=await loadMujoco(),runs=[];
for(const options of [{},{timestep:.0000625},{friction:0},{friction:.5},{contacts:false}]){
 const p=makeSingleClampPhysics(m,options),samples=[];let minimumGap=0,failure=null;
 try{
  for(let i=0;i<=Math.round(4/p.timestep);i++){
   if(i%Math.round(.02/p.timestep)===0)samples.push(p.state());
   const cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{minimumGap=Math.min(minimumGap,c.dist);}finally{c.delete();}}}finally{cs.delete();}
   if(i<Math.round(4/p.timestep)){const time=p.data.time;p.step();if(p.data.time<=time||!Array.from(p.data.qvel).every(v=>Number.isFinite(v)&&Math.abs(v)<100)){failure=p.state();break;}}
  }
  runs.push({parameters:p.parameters,minimumGap,failure,final:p.state(),samples});
 }finally{p.dispose();}
}
fs.writeFileSync('/dev/shm/180-native-probe.json',JSON.stringify(runs));
const timestepDifference=runs[0].samples.length===runs[1].samples.length?Object.fromEntries(['jaw','boardX','boardY'].map(k=>[k,Math.max(...runs[0].samples.map((s,i)=>Math.abs(s[k]-runs[1].samples[i][k])))])):null;
const qualified=runs.every(r=>!r.failure&&r.minimumGap>=-1e-6&&(r.parameters.contacts
 ?Math.abs(r.final.jaw)<.01&&r.final.boardY>0&&r.final.boardY<.04&&r.final.appliedForce>9.9
 :Math.abs(r.final.jaw-r.parameters.opening)<1e-12&&Math.abs(r.final.boardY-.1)<1e-8));
const report={movement:180,status:qualified?'native-push-controls-checked':'native-push-open',scope:'Board-only push against a passive jaw and fixed side. Smooth source profile without display bevels, ideal hinges and held board orientation. Friction is an inferred model parameter. Frictionless and higher-friction controls also clamp; the separately qualified settled cycle is used for playback.',timestepDifference,runs:runs.map(({samples,...r})=>r),sources:['scripts/probe-single-clamp.mjs','src/simulation/mujoco-single-clamp/physics.js','src/simulation/mujoco-single-clamp/profile.js','src/simulation/authored-clamps.js','src/simulation/mujoco-bench-clamp/profile.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/180-native-study.json',JSON.stringify(report,null,2)+'\n');console.log(report);
assert.ok(qualified,'contact clamps the board while disabled contact leaves the jaw still');
