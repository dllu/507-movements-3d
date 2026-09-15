import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeWaveCamContactSolver} from '../src/simulation/mujoco-wave-cam/quasistatic.js';
import {makeWaveCamSolids} from '../src/simulation/mujoco-wave-cam/solids.js';
const solver=makeWaveCamContactSolver({samples:256}),cache=new Map(),keep=new Set([0]),period=12,tolerance=2e-6;
const state=a=>{if(!cache.has(a))cache.set(a,solver.solve(a));return cache.get(a);};
let maximumAcceptedProbeError=0;
function refine(a,b,depth=0){
 const qa=state(a).rocker,qb=state(b).rocker,error=Math.max(...[.25,.5,.75].map(u=>Math.abs(state(a+(b-a)*u).rocker-(qa+(qb-qa)*u))));
 if(error>tolerance){assert.ok(depth<18,JSON.stringify({message:'unresolved contact transition',a,b,error,qa,qb}));const mid=(a+b)/2;refine(a,mid,depth+1);refine(mid,b,depth+1);}else{maximumAcceptedProbeError=Math.max(maximumAcceptedProbeError,error);keep.add(b);}
}
for(let i=0;i<256;i++)refine(2*Math.PI*i/256,2*Math.PI*(i+1)/256);
const states=[...keep].sort((a,b)=>a-b).map(state);let spin=0;
for(let i=0;i<states.length;i++){
 const s=states[i];if(i){const p=states[i-1],radius=solver.geometry.rollerRadius;
  const normal=v=>{const nx=(v.contactPoint[0]-v.rollerCenter[0])/radius;return[nx,Math.sqrt(Math.max(0,1-nx*nx))];};
  const na=normal(p),nb=normal(s),nx=(na[0]+nb[0])/2,ny=(na[1]+nb[1])/2,dx=s.rollerCenter[0]-p.rollerCenter[0],dy=s.rollerCenter[1]-p.rollerCenter[1],travel=(s.cam-p.cam)*(s.contactPoint[2]+p.contactPoint[2])/2;
  spin+=(-(travel-dx)*ny-dy*nx)/radius;
 }
 s.rollerAngle=spin-s.rocker;s.time=period*s.cam/(2*Math.PI);
}
const v=makeWaveCamSolids();try{
 const g=v.root.userData.geometry,bounds=new THREE.Box3();for(let i=0;i<states.length;i+=Math.max(1,Math.floor(states.length/256))){v.sync(states[i]);bounds.union(new THREE.Box3().setFromObject(v.root,true));}bounds.expandByScalar(.04);v.sync(states[0]);v.root.traverse(o=>{o.userData={};});
 const sources=['scripts/bake-wave-cam.mjs','src/simulation/mujoco-wave-cam/quasistatic.js','src/simulation/mujoco-wave-cam/solids.js','src/simulation/mujoco-wave-cam/adaptive-profile.js','src/simulation/mujoco-wave-cam/update-solids.js','src/simulation/mujoco-wave-cam/projected-profile.js','src/simulation/mujoco-wave-cam/profile.js','src/simulation/finite-plate-geometry.js','src/simulation/primitives.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const bundle={version:1,movement:165,object:v.root.toJSON(),geometry:g,motion:states.map(s=>[s.time,s.cam,s.rocker,s.rollerAngle+s.rocker]),names:['cam','rocker','rollerAbsoluteAngle'],turns:[2*Math.PI,0,spin],period,loopStart:0,loopEnd:period,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.01,.01,15],maximumAcceptedProbeError,solverStates:cache.size,assumptions:'Quasistatic finite-surface cam contact; ideal pins and vertical guide; 0.006 world-unit contact clearance. Illustrative tangential rolling with axial slip, not a friction/inertia simulation. Display speed is illustrative.',sources};
 const bytes=gzipSync(JSON.stringify(bundle),{level:9});fs.writeFileSync('src/simulation/baked/assets/165.json.gz',bytes);fs.writeFileSync('src/simulation/baked/assets/165.provenance.json',JSON.stringify({...bundle,object:undefined,motion:undefined,samples:states.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');fs.writeFileSync('/dev/shm/165-baked-states.json',JSON.stringify(states));console.log({keys:states.length,solverStates:cache.size,bytes:bytes.length,maximumAcceptedProbeError,spin});
}finally{v.dispose();}
