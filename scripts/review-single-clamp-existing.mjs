import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredClampMovement} from '../src/simulation/authored-clamps.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const model=createAuthoredClampMovement({id:180}),u=model.root.userData,b=u.blocks,g=u.geometry,parts=[];
model.root.traverse(mesh=>{
 if(!mesh.isMesh||!mesh.visible)return;
 let family='fixed';for(let p=mesh;p;p=p.parent){if(p===b.workpiece)family='board';if(p===b.pivotedJaw)family='jaw';}
 parts.push({mesh,name:(mesh.userData.role||'mesh')+'#'+parts.length,family,surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
});
const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family).map(b=>[a,b]));
const intersections={},samples=[];let queries=0,movingWithoutNominalContact=0;
try{
 for(let i=0;i<=128;i++){
  const time=g.cyclePeriod*i/128;model.update(time);model.root.updateMatrixWorld(true);const s=u.kinematics;
  if(Math.abs(s.jawAngularVelocity)>1e-5&&s.minimumJawProfileGap>1e-3)movingWithoutNominalContact++;
  if(i%16===0)samples.push({time,jawAngle:s.jawAngle,boardY:s.workpieceTranslationY,gap:s.minimumJawProfileGap});
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const[a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
   for(const[from,to]of[[a,b],[b,a]]){const matrix=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){queries++;const q=sample.clone().applyMatrix4(matrix);if(!to.surface.inside(q))continue;const depth=to.surface.distance(q);if(depth>1e-6){const key=a.name+'/'+b.name;intersections[key]=Math.max(intersections[key]??0,depth);}}
   }
  }
 }
 const report={movement:180,status:'baseline-contact-reconstruction-open',poses:129,meshes:parts.length,pairs:pairs.length,queries,intersections,movingWithoutNominalContact,samples,
 method:'All visible meshes across distinct rigid families, including decorative outlines and contact markers. Bidirectional vertices, edge midpoints and triangle centers. Nominal contact gap is from the old model; it checks profile vertices only, not complete edges or bevels.',
 sources:['scripts/review-single-clamp-existing.mjs','src/simulation/authored-clamps.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/180-existing-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(model.root);}
