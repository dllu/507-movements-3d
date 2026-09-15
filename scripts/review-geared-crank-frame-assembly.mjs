import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeGearedCrankFrame} from '../src/simulation/geared-crank-frame.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeGearedCrankFrame();
try{
 const {parts:meshes,families}=v.root.userData;
 const parts=Object.entries(meshes).map(([name,mesh])=>({name,mesh,family:families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 const pairs=[];
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push([parts[i],parts[j]]);
 const failures={};let checks=0;
 for(let pose=0;pose<=64;pose++){
  v.update(8*pose/64);
  for(const p of parts)p.box=p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld);
  for(const [a,b] of pairs){
   if(!a.box.intersectsBox(b.box))continue;
   for(const [from,to] of [[a,b],[b,a]]){
    const transform=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    for(const point of from.points){
     const q=point.clone().applyMatrix4(transform);checks++;
     if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<1e-6)continue;
     const key=a.name+' / '+b.name,entry=failures[key]??{firstPose:pose,points:0,maximumDepth:0};
     entry.points++;entry.maximumDepth=Math.max(entry.maximumDepth,depth);failures[key]=entry;
    }
   }
  }
 }
 const report={movement:148,status:'candidate-frame-assembly',method:'Bidirectional mesh vertices, edge midpoints and face centers against actual solids. Includes the traced rocker, short crank, eccentric mounting arm, pins and rear-supported stub shaft. Excludes same rigid family joins. Does not include either complete gear, their bearings or the fixed frame. Sampled check, not swept-volume proof.',
  summary:{poses:65,parts:parts.length,pairs:pairs.length,checks,failingPairs:Object.keys(failures).length},failures,
  sources:['scripts/review-geared-crank-frame-assembly.mjs','src/simulation/geared-crank-frame.js','src/simulation/geared-crank-source.js','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/148-frame-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
 assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
