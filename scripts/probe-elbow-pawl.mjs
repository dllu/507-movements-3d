import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeElbowPawlGeometry} from '../src/simulation/mujoco-elbow-pawl/geometry.js';
import {makeElbowPawlPhysics} from '../src/simulation/mujoco-elbow-pawl/physics.js';
const visual=makeElbowPawlGeometry({side:process.env.SIDE??'right'}),mujoco=await loadMujoco(),physics=makeElbowPawlPhysics(mujoco,visual,{stroke:Number(process.env.STROKE??.78),outputFriction:Number(process.env.FRICTION??3),timestep:Number(process.env.DT??.0005)});
try{
 let maximumPenetration=0,maximumLinkClosure=0;
 const initialContacts=physics.data.ncon;
 const rows=[],period=physics.description.options.period,ticks=Math.round(8*period/physics.timestep),stride=Math.round(.01/physics.timestep);
 for(let i=0;i<=ticks;i++){if(i%stride===0){mujoco.mj_forward(physics.model,physics.data);rows.push({time:physics.data.time,qpos:Array.from(physics.data.qpos),qvel:Array.from(physics.data.qvel)});
  const contacts=physics.data.contact;for(let j=0;j<physics.data.ncon;j++){const c=contacts.get(j);maximumPenetration=Math.max(maximumPenetration,-c.dist);c.delete();}contacts.delete();
  const a=physics.id('mjOBJ_SITE','rodEnd')*3,b=physics.id('mjOBJ_SITE','sliderPin')*3,pos=physics.data.site_xpos;maximumLinkClosure=Math.max(maximumLinkClosure,Math.hypot(...[0,1,2].map(k=>pos[a+k]-pos[b+k])));
 }if(i<ticks)physics.step();}
 const ends=rows.filter(r=>Math.abs(r.time/period-Math.round(r.time/period))<1e-7).map(s=>({time:s.time,qpos:s.qpos,outputTeeth:s.qpos[3]/visual.root.userData.profile.pitch}));
 const {xml,input,...description}=physics.description;
 const report={movement:155,side:visual.root.userData.profile.side,description,contactApproximation:visual.root.userData.contactApproximation,summary:{initialContacts,maximumPenetration,maximumLinkClosure,settledToothSteps:ends.slice(2).map((s,i)=>s.outputTeeth-ends[i+1].outputTeeth)},cycleEnds:ends,sources:['scripts/probe-elbow-pawl.mjs','src/simulation/mujoco-elbow-pawl/geometry.js','src/simulation/mujoco-elbow-pawl/physics.js','src/simulation/mujoco/mass.js','src/simulation/mujoco/simulation.js','src/simulation/mujoco-segment-clamp/contact.js','src/simulation/mujoco/convex-plate.js','src/simulation/finite-plate-geometry.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync(process.env.REPORT??'docs/validation/155-native-prototype.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync('/dev/shm/155-native-samples.json',JSON.stringify(rows));console.log(report.summary);
}finally{physics.dispose();visual.dispose();}
