import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredQuadrantCatchMovement} from '../src/simulation/authored-quadrant-catches.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model=createAuthoredQuadrantCatchMovement({id:183}),u=model.root.userData,b=u.blocks;
const groups=new Map(['upperHandle','lowerHandle','pistonGroup','upperWeightAssembly','lowerWeightAssembly'].map(name=>[b[name],name]));
const excluded=new Set([b.tappetContactMarker,b.bottomLatchMarker,b.topLatchMarker]);
const parts=[];
model.root.traverse(mesh=>{
 if(!mesh.isMesh||excluded.has(mesh))return;
 let parent=mesh;while(parent&&!groups.has(parent))parent=parent.parent;
 parts.push({name:(mesh.userData.role??'part')+'#'+parts.length,mesh,family:groups.get(parent)??'fixed',surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
});
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family).map(b=>[a,b]));
const intersections={};let queries=0;
try{
 for(let i=0;i<=64;i++){
  const time=u.geometry.cyclePeriod*i/64;model.update(time);model.root.updateMatrixWorld(true);
  for(const p of parts){assert.ok(p.mesh.matrixWorld.elements.every(Number.isFinite));p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const[a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
   for(const[from,to]of[[a,b],[b,a]]){const matrix=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){queries++;const q=sample.clone().applyMatrix4(matrix);if(!to.surface.inside(q))continue;const depth=to.surface.distance(q);
     if(depth>1e-6){const key=a.name+'/'+b.name;if(depth>(intersections[key]?.depth??0))intersections[key]={depth,time,families:[a.family,b.family]};}
    }
   }
  }
 }
 const sources=['scripts/review-quadrant-catch-solids.mjs','src/simulation/authored-quadrant-catches.js','tests/helpers/solid-surface.mjs'];
 const report={movements:[183,184],status:Object.keys(intersections).length?'finite-solids-intersect':'sampled-solids-clear',poses:65,meshes:parts.length,pairs:pairs.length,queries,intersections,
  scope:'Baseline prescribed-motion assembly. Both variants share the full cycle. All cross-family mesh pairs except the three floating contact markers; painted indices remain attached to their mechanical body. Same-body joins and source fit are not qualified.',
  method:'Bidirectional triangle vertices, edge midpoints and face centers, with bounding-box rejection and independent surface containment. Sampled evidence, not continuous proof.',
  sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/183-current-solids.json',JSON.stringify(report,null,2)+'\n');
 console.log({meshes:parts.length,pairs:pairs.length,queries,intersections});
 assert.ok(queries>0);if(Object.keys(intersections).length)process.exitCode=1;
}finally{disposeObject3D(model.root);}
