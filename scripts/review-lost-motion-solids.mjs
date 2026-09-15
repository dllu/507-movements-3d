import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeLostMotionBrickPress} from '../src/simulation/lost-motion-brick-press.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeLostMotionBrickPress(),cache=new Map(),intersections={};let queries=0;
try{
 const parts=Object.entries(v.root.userData.parts).map(([name,mesh])=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return{name,mesh,family:v.root.userData.families[name],...cache.get(mesh.geometry)};});
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));
 for(let tick=0;tick<=128;tick++){
  {
   v.update(4*tick/128);for(const part of parts){part.box=new THREE.Box3().setFromObject(part.mesh);part.inverse=part.mesh.matrixWorld.clone().invert();}
   for(const [a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
    for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
     for(const sample of from.points){const point=sample.clone().applyMatrix4(transform);queries++;if(!to.surface.inside(point))continue;const depth=to.surface.distance(point);if(depth<1e-6)continue;const key=a.name+'/'+b.name,entry=intersections[key]??{maximumDepth:0,firstTime:4*tick/128,samples:0};entry.maximumDepth=Math.max(entry.maximumDepth,depth);entry.samples++;intersections[key]=entry;}
    }
   }
  }
 }
 const unexpected=intersections;
 const report={movement:166,status:'registered-solid-diagnostic',parameters:v.root.userData.geometry,poses:129,meshes:parts.length,pairs:pairs.length,queries,intersections,unexpected,method:'Bidirectional visible vertices, edge midpoints and triangle centers over the four-second analytic cycle. Same rigid-family joins excluded. No cross-family overlap above 1e-6 world units is permitted.',sources:['scripts/review-lost-motion-solids.mjs','src/simulation/lost-motion-brick-press.js','src/simulation/lost-motion-brick-press-motion.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/166-solid-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(unexpected).length,0,'Unexpected visible-solid intersections');
}finally{v.dispose();}
