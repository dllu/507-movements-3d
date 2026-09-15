import fs from 'node:fs';import {createHash} from 'node:crypto';import loadMujoco from '@mujoco/mujoco';
import {makeBenchClampPhysics} from '../src/simulation/mujoco-bench-clamp/physics.js';
const mujoco=await loadMujoco(),runs=[];
for(const options of [{},{timestep:.00025},{friction:0},{contacts:false}]){
 const p=makeBenchClampPhysics(mujoco,options),samples=[];let minimumGap=0;
 try{for(let i=0;i<=Math.round(4/p.timestep);i++){
  if(i%Math.round(.02/p.timestep)===0)samples.push(p.state());
  const cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{minimumGap=Math.min(minimumGap,c.dist);}finally{c.delete();}}}finally{cs.delete();}
  if(i<Math.round(4/p.timestep))p.step();
 }const finalContacts=[];const cs=p.data.contact;try{for(let j=0;j<p.data.ncon;j++){const c=cs.get(j);try{finalContacts.push({geoms:[c.geom1,c.geom2].map(id=>mujoco.mj_id2name(p.model,mujoco.mjtObj.mjOBJ_GEOM.value,id)),position:[...c.pos],gap:c.dist});}finally{c.delete();}}}finally{cs.delete();}
 runs.push({parameters:p.parameters,minimumGap,final:p.state(),finalContacts,samples});}finally{p.dispose();}
}
fs.writeFileSync('/dev/shm/174-native-probe.json',JSON.stringify(runs));
const timestepDifference=Object.fromEntries(['upper','lower','board','boardY'].map(key=>[key,Math.max(...runs[0].samples.map((s,i)=>Math.abs(s[key]-runs[1].samples[i][key])))]));
const report={timestepDifference,movement:174,status:'unregistered-passive-jaw-study',duration:4,
 scope:'Source-traced convex-prism jaw colliders and a board free to translate in X and Y with its orientation held. Only the board is actuated; jaw angles are passive. Hidden hardware, bench contact, exact lower-jaw asymmetry, release motion and finite display geometry are not qualified.',
 runs:runs.map(({samples,...r})=>r),sources:['scripts/probe-bench-clamp.mjs','src/simulation/mujoco-bench-clamp/physics.js','src/simulation/mujoco-bench-clamp/profile.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/174-native-study.json',JSON.stringify(report,null,2)+'\n');console.log(report);
