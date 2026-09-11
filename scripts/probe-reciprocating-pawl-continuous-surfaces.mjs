import fs from 'node:fs';
import * as THREE from 'three';
import {makeReciprocatingPawlRatchet} from '../src/simulation/reciprocating-pawl.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const model=makeReciprocatingPawlRatchet(),u=model.root.userData,
 parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)})),
 times=[...Array.from({length:121},(_,i)=>4*i/120),...Array.from({length:41},(_,i)=>1+i*.01),...Array.from({length:41},(_,i)=>2.2+i*.01)],failures=[];
let checks=0,maxDepth=0;
for(const time of times){
 model.update(time);model.root.updateMatrixWorld(true);
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  if(u.families[parts[i].name]===u.families[parts[j].name])continue;
  for(const [a,b] of [[parts[i],parts[j]],[parts[j],parts[i]]]){
   const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
   if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
   for(const sample of a.points){const point=sample.clone().applyMatrix4(matrix);checks++;
    if(!b.solid.inside(point))continue;const depth=b.solid.distance(point);maxDepth=Math.max(maxDepth,depth);
    if(depth>1e-6){failures.push({time,a:a.name,b:b.name,depth,point:point.toArray()});break;}
   }
  }
 }
}
const report={passed:failures.length===0,poses:times.length,checks,maxDepth,failures,
 method:'Actual rendered solid vertices, edge midpoints and triangle centers, tested in both directions for every pair of independent families. Extra samples cover both pawl drops.'};
fs.writeFileSync('artifacts/review/075-continuous-surfaces.json',JSON.stringify(report,null,2)+'\n');console.log(report);if(failures.length)process.exitCode=1;
