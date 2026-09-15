import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeGovernorBevelPair} from '../src/simulation/mujoco-ball-governor/bevel-pair.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeGovernorBevelPair(),cache=new Map();let queries=0;const intersections={},phaseGaps=[];
try{
 const parts=Object.entries(v.root.userData.parts).map(([name,mesh])=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return{name,mesh,...cache.get(mesh.geometry)};});
 const pairs=parts.filter(p=>p.name.startsWith('input')).flatMap(a=>parts.filter(p=>p.name.startsWith('output')).map(b=>[a,b]));
 for(let pose=0;pose<=64;pose++){
  let nearest=.02;v.update(2*Math.PI/30*pose/64);for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;for(const [from,to]of [[a,b],[b,a]]){
   const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);for(const point of from.points){const p=point.clone().applyMatrix4(transform);queries++;if(from.name.includes("Tooth")&&to.name.includes("Tooth"))nearest=Math.min(nearest,to.surface.distance(p,nearest));if(!to.surface.inside(p))continue;const depth=to.surface.distance(p);if(depth<1e-6)continue;const key=a.name+'/'+b.name,e=intersections[key]??{maximumDepth:0,firstPose:pose,points:0};e.maximumDepth=Math.max(e.maximumDepth,depth);e.points++;intersections[key]=e;}
  }}
  phaseGaps.push(nearest);
 }
 const p=v.root.userData.parameters,maxDepth=Math.max(0,...Object.values(intersections).map(x=>x.maximumDepth));
 const report={movement:161,status:'bevel-candidate-not-registered',parameters:p,poses:65,pairs:pairs.length,queries,maximumSampledPenetration:maxDepth,nearestFlankDistanceRange:[Math.min(...phaseGaps),Math.max(...phaseGaps)],maximumSampledPenetrationPixels:maxDepth/.018,intersections,method:'Bidirectional visible vertices, edge midpoints and triangle centers across one tooth pitch. Cross-gear bodies/teeth only. Finite sampling, not exact contact or continuous collision proof.',sources:['scripts/review-governor-bevels.mjs','src/simulation/mujoco-ball-governor/bevel-pair.js','src/simulation/bevel-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/161-bevel-clearance.json',JSON.stringify(report,null,2)+'\n');console.log({nearestFlankDistanceRange:report.nearestFlankDistanceRange,maxDepth,pixels:maxDepth/.018,queries,pairs:pairs.length,parameters:p});
}finally{v.dispose();}
