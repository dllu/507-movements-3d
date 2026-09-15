import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';
import {createAuthoredEngineReverserMovement} from '../src/simulation/authored-engine-reversers.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const visual=createAuthoredEngineReverserMovement({id:179}),u=visual.root.userData,g=u.geometry,lug=u.blocks.shaftLug;
const m=await loadMujoco(),results=[],traces=[];
try{
 for(const[timestep,enabled,frictionloss]of [[.0002,true,.02],[.0001,true,.02],[.0002,true,.05],[.0002,false,.02]]){
  const cells=64,assets=[],geoms=[];
  for(let i=0;i<cells;i++){
   const a=Math.PI/2+g.stopEndRelief+(Math.PI-2*g.stopEndRelief)*i/cells;
   const b=Math.PI/2+g.stopEndRelief+(Math.PI-2*g.stopEndRelief)*(i+1)/cells;
   const vertices=[];for(const z of [-g.stopDepth/2,g.stopDepth/2])for(const angle of [a,b])for(const r of [g.stopInnerRadius,g.stopOuterRadius])vertices.push(r*Math.cos(angle),r*Math.sin(angle),z);
   assets.push(`<mesh name="s${i}" vertex="${vertices.join(' ')}"/>`);
   geoms.push(`<geom type="mesh" mesh="s${i}" pos="0 0 ${g.stopPlaneZ}" contype="${enabled?1:0}" conaffinity="${enabled?2:0}"/>`);
  }
  const p=lug.geometry.parameters;
  // Newton diverges at first contact for this study in the installed WASM build.
  // PGS remains stable with the same finite collision geometry and inertia.
  const xml=`<mujoco><compiler angle="radian"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" solver="PGS" iterations="100" tolerance="1e-10"><flag nativeccd="disable" multiccd="disable"/></option>
   <default><geom condim="1" margin="0" solref=".01 1" solimp=".9 .95 .001"/></default><asset>${assets.join('')}</asset><worldbody>
   <body><joint name="shaft" axis="0 0 1"/><inertial mass="1" pos="0 0 0" diaginertia=".03 .03 .03"/>
    <geom type="box" pos="${lug.position.toArray().join(' ')}" size="${p.width/2} ${p.height/2} ${p.depth/2}" contype="2" conaffinity="1"/></body>
   <body><joint name="eccentric" axis="0 0 1" frictionloss="${frictionloss}" damping=".05"/><inertial mass=".1" pos="0 0 0" diaginertia=".01 .01 .01"/>${geoms.join('')}</body>
   </worldbody><actuator><position joint="shaft" kp="1000" kv="10"/></actuator></mujoco>`;
  const sim=createMujocoSimulation(m,{xml,initialize:({data})=>{data.qpos[0]=g.sourceShaftAngle;data.qpos[1]=g.sourceEccentricAngle;},
   beforeStep:({data,time})=>{const q=u.sequenceAtCyclePhase(Math.min(time,24-1e-10)/24);data.ctrl[0]=q.shaftAngle+.01*q.shaftFirst/24;}});
  let maximumError=0,maximumPenetration=0,maxMotion=0,failure=null;const samples=[];
  try{
   for(let i=0;i<Math.round(24/timestep);i++){
    const previousTime=sim.data.time;sim.step();
    if(!(sim.data.time>previousTime)||!Array.from(sim.data.qvel).every(v=>Number.isFinite(v)&&Math.abs(v)<100)){
     failure={reason:'native state reset or excessive angular speed',previousTime,time:sim.data.time,qpos:Array.from(sim.data.qpos),qvel:Array.from(sim.data.qvel)};break;
    }
    const q=u.sequenceAtCyclePhase(Math.min(sim.data.time,24-1e-10)/24);
    maximumError=Math.max(maximumError,Math.abs(sim.data.qpos[1]-q.eccentricAngle));
    maxMotion=Math.max(maxMotion,Math.abs(sim.data.qpos[1]-g.sourceEccentricAngle));
    for(let j=0;j<sim.data.ncon;j++)maximumPenetration=Math.max(maximumPenetration,-sim.data.contact.get(j).dist);
    if((i+1)%Math.round(.02/timestep)===0)samples.push([sim.data.time,sim.data.qpos[0],sim.data.qpos[1],q.eccentricAngle]);
   }
   results.push({timestep,enabled,frictionloss,failure,maximumError,maximumPenetration,maxMotion,finalEccentric:sim.data.qpos[1]});
   traces.push(samples);
   fs.writeFileSync(`/dev/shm/179-native-stop-${timestep}-${enabled}-${frictionloss}.json`,JSON.stringify(samples));
  }finally{sim.dispose();}
 }
 const sources=['scripts/review-engine-reverser-native-stop.mjs','src/simulation/authored-engine-reversers.js','src/simulation/mujoco/simulation.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const maximumTimestepDifference=traces[0].length===1200&&traces[1].length===1200
  ?Math.max(...traces[0].map((sample,i)=>Math.abs(sample[2]-traces[1][i][2]))):null;
 const qualified=results.every(r=>!r.failure&&(r.enabled?r.maximumError<.003&&r.maximumPenetration<.001:r.maxMotion<1e-10))
  &&maximumTimestepDifference!==null&&maximumTimestepDifference<.0005;
 const report={movement:179,status:qualified?'native-contact-checked':'failed-native-study',scope:'Native shaft/stop contact only; neither manual valve motion nor lifted-rod dynamics is simulated. Only the shaft is actuated. Inertia, bearing resistance and the ideal fixed-axis bearings are reconstruction assumptions.',solver:'PGS',durationSeconds:24,cells:64,maximumTimestepDifference,results,sources};
 fs.writeFileSync('docs/validation/179-native-stop.json',JSON.stringify(report,null,2)+'\n');console.log(report);
 assert.ok(qualified,'full-cycle native contact, resistance sensitivity and timestep checks must pass');
}finally{disposeObject3D(visual.root);}
