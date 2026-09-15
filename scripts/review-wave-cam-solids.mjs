import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeWaveCamSolids} from '../src/simulation/mujoco-wave-cam/solids.js';
const states=JSON.parse(fs.readFileSync('/dev/shm/165-projected-settling.json')); 
import {waveCamSampledGap} from '../src/simulation/mujoco-wave-cam/clearance.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeWaveCamSolids(),cache=new Map(),intersections={};let queries=0;
try{
 const parts=Object.entries(v.root.userData.parts).map(([name,mesh])=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return{name,mesh,family:v.root.userData.families[name],...cache.get(mesh.geometry)};});
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));
 const indices=new Set(Array.from({length:129},(_,i)=>Math.round((states.length-1)*i/128)));
 for(let i=0;i<states.length;i++)if(waveCamSampledGap(states[i],{profileType:'projected'}).gap<-.005)indices.add(i);
 for(const index of [...indices].sort((a,b)=>a-b)){
  {
   v.sync(states[index]);for(const part of parts){part.box=new THREE.Box3().setFromObject(part.mesh);part.inverse=part.mesh.matrixWorld.clone().invert();}
   for(const [a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
    for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
     for(const sample of from.points){const point=sample.clone().applyMatrix4(transform);queries++;if(!to.surface.inside(point))continue;const depth=to.surface.distance(point);if(depth<1e-6)continue;const key=a.name+'/'+b.name,entry=intersections[key]??{maximumDepth:0,firstTime:v.root.userData.state.time,samples:0};entry.maximumDepth=Math.max(entry.maximumDepth,depth);entry.samples++;intersections[key]=entry;}
    }
   }
  }
 }
 const unexpected=intersections;
 const report={movement:165,status:'unregistered-solid-diagnostic',parameters:v.root.userData.geometry,poses:indices.size,meshes:parts.length,pairs:pairs.length,queries,intersections,unexpected,method:'Uniform 129 poses augmented with every 10 ms pose whose independent sampled continuous gap is below -0.005. Bidirectional visible vertices, edge midpoints and triangle centers over the third native input revolution at 18 seconds per revolution, using adaptive contact cells and a -0.006 collision-face offset. Same rigid-family joins excluded. No cross-family overlap above 1e-6 world units is permitted.',sources:['scripts/review-wave-cam-solids.mjs','src/simulation/mujoco-wave-cam/solids.js','src/simulation/mujoco-wave-cam/profile.js','src/simulation/mujoco-wave-cam/adaptive-profile.js','src/simulation/mujoco-wave-cam/projected-profile.js','docs/validation/165-projected-physics.json','src/simulation/mujoco-wave-cam/clearance.js','src/simulation/mujoco-wave-cam/physics.js','src/simulation/mujoco-wave-cam/contact-mesh.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/165-solid-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(unexpected).length,0,'Unexpected visible-solid intersections');
}finally{v.dispose();}
