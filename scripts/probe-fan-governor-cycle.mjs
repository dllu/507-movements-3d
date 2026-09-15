import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeFanGovernorPhysics} from '../src/simulation/mujoco-fan-governor/physics.js';
import {makeFanGovernorGeometry} from '../src/simulation/mujoco-fan-governor/geometry.js';
import {fanGovernorCycle as cycle,fanGovernorCycleDrive} from '../src/simulation/mujoco-fan-governor/cycle.js';
import {fanGovernorTrack as track} from '../src/simulation/mujoco-fan-governor/source.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
const segments=Number(process.env.TRACK_SEGMENTS??160),ticks=Number(process.env.CYCLE_TICKS??24000),warmupCycles=6;
assert.ok(Number.isInteger(ticks)&&ticks>=600&&ticks%600===0);
const mujoco=await loadMujoco(),visual=makeFanGovernorGeometry({segments});
const p=makeFanGovernorPhysics(mujoco,{segments,timestep:cycle.period/ticks,massProperties:visual.root.userData.mass,drive:fanGovernorCycleDrive});
try{
 const trackSolids=Object.entries(visual.root.userData.parts).filter(([name])=>name.startsWith('track_')).map(([,mesh])=>solidSurface(mesh.geometry));
 const samples=[];let first,last,minimumContactAngle=Infinity,maximumContactAngle=-Infinity,maximumPenetration=0,minimumContactCount=Infinity,maximumSeparation=0,samplesWithoutContact=0;
 for(let step=0;step<=(warmupCycles+1)*ticks;step++){
  if(step>=warmupCycles*ticks&&step%(ticks/600)===0){
   mujoco.mj_forward(p.model,p.data);const state=p.state();samples.push(state);
   if(step===warmupCycles*ticks)first={qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel)};
   if(step===(warmupCycles+1)*ticks)last={qpos:Array.from(p.data.qpos),qvel:Array.from(p.data.qvel)};
   minimumContactCount=Math.min(minimumContactCount,p.data.ncon);
   if(p.data.ncon===0)samplesWithoutContact++;
   for(const side of [-1,1]){
    const center=new THREE.Vector3(side*track.radius*Math.cos(state.lag),state.lift,side*track.radius*Math.sin(state.lag));
    maximumSeparation=Math.max(maximumSeparation,Math.min(...trackSolids.map(s=>s.distance(center)))-track.rollerRadius);
   }
   const contacts=p.data.contact;
   try{for(let i=0;i<contacts.size();i++){
    const c=contacts.get(i);
    try{
     const x=c.pos[0],z=c.pos[2];
     let a=Math.atan2(-z,x)-state.shaft;
     a=((a+Math.PI/2)%Math.PI+Math.PI)%Math.PI-Math.PI/2;
     minimumContactAngle=Math.min(minimumContactAngle,a);maximumContactAngle=Math.max(maximumContactAngle,a);
     maximumPenetration=Math.max(maximumPenetration,-c.dist);
    }finally{c.delete();}
   }}finally{contacts.delete();}
  }
  if(step<(warmupCycles+1)*ticks)p.step();
 }
 const closure={position:last.qpos.map((v,i)=>v-first.qpos[i]-(i===0||i===2?12*Math.PI:0)),velocity:last.qvel.map((v,i)=>v-first.qvel[i])};
 const minimumTrackEndMargin=Math.min(minimumContactAngle-track.startAngle,track.endAngle-maximumContactAngle);
 assert.equal(samples.length,601);
 assert.ok(minimumTrackEndMargin>.2&&maximumPenetration<.00015&&maximumSeparation<.0001);
 const report={movement:147,status:'candidate-speed-cycle-not-baked',cycle,sampling:{warmupCycles,ticksPerCycle:ticks,segments,samples:samples.length},
  summary:{minimumLift:Math.min(...samples.map(s=>s.lift)),maximumLift:Math.max(...samples.map(s=>s.lift)),minimumLag:Math.min(...samples.map(s=>s.lag)),maximumLag:Math.max(...samples.map(s=>s.lag)),minimumContactAngle,maximumContactAngle,minimumTrackEndMargin,minimumContactCount,samplesWithoutContact,maximumSeparation,maximumPenetration,closure},
  sources:['scripts/probe-fan-governor-cycle.mjs','src/simulation/mujoco-fan-governor/cycle.js','src/simulation/mujoco-fan-governor/physics.js','src/simulation/mujoco-fan-governor/geometry.js','src/simulation/mujoco-fan-governor/source.js','src/simulation/mujoco/simulation.js','src/simulation/mujoco/mass.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('/dev/shm/147-cycle-samples.json',JSON.stringify({first,last,samples}));
 fs.writeFileSync(process.env.CYCLE_REPORT??'docs/validation/147-speed-cycle.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{p.dispose();visual.dispose();}
