import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredDiagonalCatchMovement} from '../src/simulation/authored-diagonal-catches.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const model=createAuthoredDiagonalCatchMovement({id:181}),u=model.root.userData,b=u.blocks;
const groups=['upperHandle','lowerHandle','catchGroup','pistonGroup','upperWeightAssembly','lowerWeightAssembly','catchWeightAssembly'],parts=[];
model.root.traverse(mesh=>{
 if(!mesh.isMesh)return;
 let family='fixed';for(let p=mesh;p;p=p.parent)for(const name of groups)if(p===b[name])family=name;
 parts.push({mesh,name:(mesh.userData.role||'mesh')+'#'+parts.length,family,surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
});
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family).map(b=>[a,b]));
const intersections={},samples=[];let queries=0;
try{
 for(let i=0;i<=128;i++){
  const time=u.geometry.cyclePeriod*i/128;model.update(time);model.root.updateMatrixWorld(true);const s=u.kinematics;
  if(i%16===0)samples.push({time,stage:s.stage,upper:s.upperHandleAngle,lower:s.lowerHandleAngle,catch:s.catchAngle,upperGap:s.upperLatchGap,lowerGap:s.lowerLatchGap});
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const[a,b]of pairs){if(!a.mesh.visible||!b.mesh.visible||!a.box.intersectsBox(b.box))continue;
   for(const[from,to]of[[a,b],[b,a]]){const matrix=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){queries++;const q=sample.clone().applyMatrix4(matrix);if(!to.surface.inside(q))continue;const depth=to.surface.distance(q);if(depth>1e-6){const key=a.name+'/'+b.name;intersections[key]=Math.max(intersections[key]??0,depth);}}
   }
  }
 }
 const report={movement:181,poses:129,meshes:parts.length,pairs:pairs.length,queries,intersections,samples,
 method:'Visible finite meshes across different moving/fixed families, including decorative outlines and markers when visible. Bidirectional vertices, edge midpoints and triangle centers. Sampled evidence, not continuous proof.',
 sources:['scripts/review-diagonal-catch-solids.mjs','src/simulation/authored-diagonal-catches.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 const baseline=process.argv.includes('--baseline');
 fs.writeFileSync(`docs/validation/181-${baseline?'existing':'current'}-solids.json`,JSON.stringify(report,null,2)+'\n');console.log(report);
 if(!baseline)assert.equal(Object.keys(intersections).length,0);
}finally{disposeObject3D(model.root);}
