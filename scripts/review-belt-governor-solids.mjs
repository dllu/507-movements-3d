import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBeltGovernorPhysics} from '../src/simulation/mujoco-belt-governor/physics.js';
import {makeBeltGovernorSolids} from '../src/simulation/mujoco-belt-governor/solids.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeBeltGovernorSolids(),p=makeBeltGovernorPhysics(await loadMujoco(),{speedAmplitude:.25}),cache=new Map(),intersections={};let queries=0;
try{
 const parts=Object.entries(v.root.userData.parts).map(([name,mesh])=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return{name,mesh,family:v.root.userData.families[name],...cache.get(mesh.geometry)};});
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));
 for(let tick=0;tick<=40000;tick++){
  if(tick%625===0){
   v.update(p.state());for(const part of parts){part.box=new THREE.Box3().setFromObject(part.mesh);part.inverse=part.mesh.matrixWorld.clone().invert();}
   for(const [a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
    for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
     for(const sample of from.points){const point=sample.clone().applyMatrix4(transform);queries++;if(!to.surface.inside(point))continue;const depth=to.surface.distance(point);if(depth<1e-6)continue;const key=a.name+'/'+b.name,entry=intersections[key]??{maximumDepth:0,firstTime:p.data.time,samples:0};entry.maximumDepth=Math.max(entry.maximumDepth,depth);entry.samples++;intersections[key]=entry;}
    }
   }
  }
  if(tick<40000)p.step();
 }
 const expectedContact=key=>{
  const [a,b]=key.split('/');
  return ['left','right'].some(side=>[a,b].includes(side+'Ball')&&[a,b].includes(side+'LowerLink'));
 };
 const unexpected=Object.fromEntries(Object.entries(intersections).filter(([key,e])=>!expectedContact(key)||e.maximumDepth>.002));
 const report={movement:163,status:'unregistered-solid-diagnostic',parameters:p.description,poses:65,meshes:parts.length,pairs:pairs.length,queries,intersections,unexpected,method:'Bidirectional visible vertices, edge midpoints and triangle centers during twenty native seconds with 0.25 rad/s speed variation. Same rigid-family joins excluded. Includes soft-contact penetration and native joint-constraint errors; only named native contact pairs may overlap, by at most .002 world units.',sources:['scripts/review-belt-governor-solids.mjs','src/simulation/mujoco-belt-governor/solids.js','src/simulation/mujoco-belt-governor/update-solids.js','src/simulation/mujoco-belt-governor/geometry.js','src/simulation/mujoco-belt-governor/belt-contact.js','src/simulation/mujoco-belt-governor/physics.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','src/simulation/mujoco-ball-governor/equilibrium.js','src/simulation/mujoco/simulation.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/163-solid-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(unexpected).length,0,'Unexpected visible-solid intersections');
}finally{v.dispose();p.dispose();}
