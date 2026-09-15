import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBallGovernorPhysics} from '../src/simulation/mujoco-ball-governor/physics.js';
import {makeBallGovernorSolids} from '../src/simulation/mujoco-ball-governor/solids.js';
import {ballGovernorState} from '../src/simulation/mujoco-ball-governor/kinematics.js';
const p=makeBallGovernorPhysics(await loadMujoco()),v=makeBallGovernorSolids();
try{
 const motion=[],bounds=new THREE.Box3();let first,last;
 const firstTick=Math.round(1592/p.timestep),lastTick=Math.round(1600/p.timestep);
 for(let tick=0;tick<=lastTick;tick++){
  if(tick>=firstTick&&tick%8===0){
   const s=p.state();if(!first)first=s;last=s;
   const q=s.qpos.map((x,i)=>x-(i===0?first.spindle:0));
   motion.push([(tick-firstTick)*p.timestep,...q]);v.update(ballGovernorState(q));
   bounds.union(new THREE.Box3().setFromObject(v.root,true));
  }
  if(tick<lastTick)p.step();
 }
 const closure=Math.max(...last.qpos.slice(1).map((x,i)=>Math.abs(x-first.qpos[i+1]))),velocityClosure=Math.max(...last.qvel.map((x,i)=>Math.abs(x-first.qvel[i]))),increment=last.spindle-first.spindle;
 assert.ok(closure<1e-8&&velocityClosure<1e-7);assert.ok(Math.abs(last.time-1600)<1e-6);
 motion.at(-1).splice(2,5,...motion[0].slice(2));bounds.expandByScalar(.04);
 v.update(ballGovernorState(motion[0].slice(1)));v.root.traverse(o=>{o.userData={};});
 const files=['scripts/bake-ball-governor.mjs','src/simulation/mujoco-ball-governor/physics.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco-ball-governor/kinematics.js','src/simulation/mujoco-ball-governor/solids.js','src/simulation/mujoco-ball-governor/update-solids.js','src/simulation/mujoco-ball-governor/bevel-pair.js','src/simulation/bevel-geometry.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/mujoco/simulation.js'];
 const sources=files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const bundle={version:1,movement:161,object:v.root.toJSON(),motion,names:['spindle','leftSpread','leftLower','rightSpread','rightLower','sleeve'],turns:[increment,0,0,0,0,0],period:8,loopStart:0,loopEnd:8,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.01,.01,15],sources,parameters:p.description,sourceTime:1592,closure,velocityClosure};
 const bytes=gzipSync(JSON.stringify(bundle),{level:9});fs.writeFileSync('src/simulation/baked/assets/161.json.gz',bytes);fs.writeFileSync('src/simulation/baked/assets/161.provenance.json',JSON.stringify({...bundle,object:undefined,motion:undefined,samples:motion.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');console.log({bytes:bytes.length,samples:motion.length,closure,velocityClosure,increment});
}finally{v.dispose();p.dispose();}
