import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {gunzipSync} from 'node:zlib';
import {sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {waterGovernorState} from '../src/simulation/mujoco-water-governor/kinematics.js';
import {makeWaterGovernorSolids} from '../src/simulation/mujoco-water-governor/solids.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/162.json.gz')));
const v=makeWaterGovernorSolids(),cache=new Map(),intersections={};let queries=0;
const times=[...Array.from({length:129},(_,i)=>bundle.loopEnd*(i+.371)/129),bundle.loopStart,bundle.loopEnd-1e-8,bundle.loopEnd,bundle.loopEnd+1e-8];
try{
 const parts=Object.entries(v.root.userData.parts).map(([name,mesh])=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return{name,mesh,family:v.root.userData.families[name],...cache.get(mesh.geometry)};});
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));
 for(const time of times){
  {
   v.update(waterGovernorState(sampleBakedMotion(bundle,time),bundle.geometry));for(const part of parts){part.box=new THREE.Box3().setFromObject(part.mesh);part.inverse=part.mesh.matrixWorld.clone().invert();}
   for(const [a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
    for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
     for(const sample of from.points){const point=sample.clone().applyMatrix4(transform);queries++;if(!to.surface.inside(point))continue;const depth=to.surface.distance(point);if(depth<1e-6)continue;const key=a.name+'/'+b.name,entry=intersections[key]??{maximumDepth:0,firstTime:time,samples:0};entry.maximumDepth=Math.max(entry.maximumDepth,depth);entry.samples++;intersections[key]=entry;}
    }
   }
  }
 }
 const expectedContact=key=>{
  const [a,b]=key.split('/');
  if([a,b].includes('selectorPin')&&[a,b].some(n=>/^(upper|lower)(Stud|LooseBody|LooseTooth\d+)$/.test(n)))return true;
  return ['left','right'].some(side=>[a,b].includes(side+'Ball')&&[a,b].includes(side+'LowerLink'));
 };
 const unexpected=Object.fromEntries(Object.entries(intersections).filter(([key,e])=>!expectedContact(key)||e.maximumDepth>.002));
 const report={movement:162,status:'baked-solid-clearance',parameters:bundle.parameters,poses:times.length,meshes:parts.length,pairs:pairs.length,queries,intersections,unexpected,method:'Bidirectional visible vertices, edge midpoints and triangle centers at 129 off-key interpolated times and four seam poses, using the original visible solids and baked joint motion. Same rigid-family joins excluded. Includes soft-contact penetration and native gear-constraint errors; only named native contact pairs may overlap, by at most .002 world units.',sources:['scripts/review-water-governor-baked-solids.mjs','src/simulation/baked/assets/162.json.gz','src/simulation/baked/playback.js','src/simulation/mujoco-water-governor/kinematics.js','src/simulation/mujoco-water-governor/solids.js','src/simulation/mujoco-water-governor/update-solids.js','src/simulation/mujoco-water-governor/physics.js','src/simulation/mujoco-water-governor/backing-contact.js','src/simulation/mujoco-water-governor/bevel-train.js','src/simulation/bevel-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/162-baked-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(unexpected).length,0,'Unexpected visible-solid intersections');
}finally{v.dispose();}
