import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredEngineReverserMovement} from '../src/simulation/authored-engine-reversers.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const model=createAuthoredEngineReverserMovement({id:179}),b=model.root.userData.blocks;
const groups=['looseEccentric','shaftRotor','strap','valveSpindle','manualLever','reversingLink'];
const parts=[];
model.root.traverse(mesh=>{
 if(!mesh.isMesh||mesh===b.cameraEnvelope||mesh.material.colorWrite===false)return;
 let family='fixed';for(let p=mesh;p;p=p.parent)for(const name of groups)if(p===b[name])family=name;
 parts.push({mesh,name:(mesh.userData.role||mesh.name||'mesh')+'#'+parts.length,family,surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
});
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family).map(b=>[a,b]));
const intersections={};let queries=0;
try{
 for(let i=0;i<=128;i++){
  model.update(model.root.userData.geometry.cyclePeriod*i/128);model.root.updateMatrixWorld(true);
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const[a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
   for(const[from,to]of[[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){queries++;const p=sample.clone().applyMatrix4(transform);if(!to.surface.inside(p))continue;const depth=to.surface.distance(p);if(depth<=1e-6)continue;
     const key=a.name+'/'+b.name;intersections[key]=Math.max(intersections[key]??0,depth);
    }
   }
  }
 }
 const sources=['scripts/review-engine-reverser-solids.mjs','src/simulation/authored-engine-reversers.js','src/simulation/primitives.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={movement:179,poses:129,meshes:parts.length,pairs:pairs.length,queries,intersections,sources,method:'Bidirectional visible vertices, edge midpoints and triangle centers; same rigid families excluded. Sampled evidence, not continuous proof.'};
 fs.writeFileSync(`docs/validation/179-${process.argv.includes('--baseline')?'existing':'current'}-solids.json`,JSON.stringify(report,null,2)+'\n');console.log(report);
 if(!process.argv.includes('--baseline'))assert.equal(Object.keys(intersections).length,0);
}finally{disposeObject3D(model.root);}
