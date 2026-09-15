import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredVariableCrankMovement} from '../src/simulation/authored-variable-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=createAuthoredVariableCrankMovement({id:168}),b=v.root.userData.blocks,names=['mainSlotPin','slotFrame','slotRecess','auxiliaryCrankPin','auxiliaryEnd'],parts=Object.fromEntries(names.map(name=>[name,{mesh:b[name],surface:solidSurface(b[name].geometry),points:surfacePoints(b[name].geometry)}]));
const pairs=[['mainSlotPin','slotFrame'],['mainSlotPin','slotRecess'],['auxiliaryCrankPin','auxiliaryEnd']],intersections={};let queries=0;
try{
 for(let i=0;i<=96;i++){
  const time=2*Math.PI/.62*i/96;v.update(time);v.root.updateMatrixWorld(true);
  for(const [a,b]of pairs)for(const [from,to]of [[a,b],[b,a]]){
   const p=parts[from],q=parts[to],matrix=q.mesh.matrixWorld.clone().invert().multiply(p.mesh.matrixWorld);
   if(!new THREE.Box3().setFromObject(p.mesh).intersectsBox(new THREE.Box3().setFromObject(q.mesh)))continue;
   for(const sample of p.points){const point=sample.clone().applyMatrix4(matrix);queries++;if(!q.surface.inside(point))continue;const depth=q.surface.distance(point);if(depth<=1e-6)continue;const key=a+'/'+b,entry=intersections[key]??{firstTime:time,maximumDepth:0,samples:0};entry.maximumDepth=Math.max(entry.maximumDepth,depth);entry.samples++;intersections[key]=entry;}
  }
 }
 const g=v.root.userData.geometry;const sources=['scripts/review-variable-crank-existing.mjs','src/simulation/authored-variable-cranks.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:168,status:'legacy-contact-diagnostic',poses:97,pairs,queries,intersections,geometry:g,method:'Bidirectional actual visible vertices, edge midpoints and triangle centers. Selected moving pin/rod interfaces, not a whole-assembly qualification.',sources};fs.writeFileSync('docs/validation/168-existing-contact.json',JSON.stringify(report,null,2)+'\n');console.log({queries,intersections});
}finally{disposeObject3D(v.root);}
