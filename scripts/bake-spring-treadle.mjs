import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeSpringTreadlePhysics} from '../src/simulation/mujoco-spring-return-treadle/coupled-physics.js';
import {sourceLeaf} from '../src/simulation/mujoco-spring-return-treadle/source.js';
import {makeSpringTreadleSolids} from '../src/simulation/mujoco-spring-return-treadle/solids.js';
import {springTreadleState} from '../src/simulation/mujoco-spring-return-treadle/kinematics.js';
const parameters={segments:64,tailSegments:12,bandStiffness:40000,timestep:.0000625},p=makeSpringTreadlePhysics(await loadMujoco(),parameters),v=makeSpringTreadleSolids(parameters),source=sourceLeaf(parameters),points=source.points.map(p=>p.toArray()),lengths=source.points.slice(1).map((x,i)=>x.distanceTo(source.points[i])),angles=source.points.slice(1).map((x,i)=>Math.atan2(x.y-points[i][1],x.x-points[i][0])),eye=source.eyeIndex-1,d=source.tie.clone().sub(source.points[eye]),c=Math.cos(angles[eye]),s=Math.sin(angles[eye]),rest={points,lengths,angles,eyeIndex:source.eyeIndex,tieLocal:[c*d.x+s*d.y,-s*d.x+c*d.y]};
try{
 const motion=[],bounds=new THREE.Box3();let first,last,maxFKError=0;
 for(let tick=0;tick<=256000;tick++){
  assert.ok(Math.abs(p.data.time-tick*p.timestep)<1e-7);
  if(tick>=192000&&tick%32===0){
   const native=p.state(),q=native.qpos.map(x=>Math.round(x*1e8)/1e8),state=springTreadleState(q,rest);if(!first)first=native;last=native;
   for(const name of ['upper','lower','foot'])maxFKError=Math.max(maxFKError,Math.hypot(...native[name].map((x,i)=>x-state[name][i])));
   motion.push([(tick-192000)*p.timestep,...q]);v.update(state);bounds.union(new THREE.Box3().setFromObject(v.root,true));
  }
  if(tick<256000)p.step();
 }
 const closure=Math.max(...last.qpos.map((x,i)=>Math.abs(x-first.qpos[i]))),velocityClosure=Math.max(...last.qvel.map((x,i)=>Math.abs(x-first.qvel[i])));assert.ok(closure<1e-8&&velocityClosure<1e-7);assert.ok(maxFKError<1e-5);
 motion.at(-1).splice(1,motion[0].length-1,...motion[0].slice(1));bounds.expandByScalar(.06);
 const leafWidths=v.root.userData.leafWidths;v.update(springTreadleState(motion[0].slice(1),rest));v.root.traverse(o=>{o.userData={};});
 const files=['scripts/bake-spring-treadle.mjs','src/simulation/mujoco-spring-return-treadle/coupled-physics.js','src/simulation/mujoco-spring-return-treadle/leaf-assembly.js','src/simulation/mujoco-spring-return-treadle/source.js','src/simulation/mujoco-spring-return-treadle/band-route.js','src/simulation/mujoco-spring-return-treadle/solids.js','src/simulation/mujoco-spring-return-treadle/update-solids.js','src/simulation/mujoco-spring-return-treadle/kinematics.js','src/simulation/curve-tube-buffer.js','src/simulation/axially-separated-band.js','src/simulation/mujoco/simulation.js'];
 const sources=files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const bundle={version:1,movement:160,object:v.root.toJSON(),motion,names:motion[0].slice(1).map((_,i)=>'q'+i),turns:motion[0].slice(1).map(()=>0),period:4,loopStart:0,loopEnd:4,rest,leafWidths,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.01,.01,15],sources,parameters,closure,velocityClosure,maxFKError};
 const bytes=gzipSync(JSON.stringify(bundle),{level:9});fs.writeFileSync('src/simulation/baked/assets/160.json.gz',bytes);const provenance={...bundle,object:undefined,motion:undefined,rest:undefined,leafWidths:undefined,samples:motion.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};fs.writeFileSync('src/simulation/baked/assets/160.provenance.json',JSON.stringify(provenance,null,2)+'\n');console.log({bytes:bytes.length,samples:motion.length,closure,velocityClosure,maxFKError});
}finally{v.dispose();p.dispose();}
