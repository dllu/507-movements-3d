import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSupportedWeightedBellCrank} from '../src/simulation/mujoco-weighted-bell-crank/geometry.js';
import {syncWeightedBellCrank} from '../src/simulation/mujoco-weighted-bell-crank/sync.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const samples=JSON.parse(fs.readFileSync('/dev/shm/154-supported-fine-samples.json'));
const v=makeSupportedWeightedBellCrank();
try{
 const u=v.root.userData,b=u.blocks,groups=new Map([[b.fixedFrame,'fixed'],[b.diskRotor,'disk'],[b.lever,'lever'],[b.weight,'weight'],[b.pulleyRotor,'pulley'],[b.cord,'cord']]);
 const annotations=new Set([b.contactMarker]);
 const workingPairs=b.pinAssemblies.map(a=>[a.userData.blocks.pin,b.inputArm.userData.blocks.body]).concat([[b.inputArm.userData.blocks.body,b.leverStop],[b.cord,b.outputEye],[b.cord,b.weightEye]]);
 const isWorking=(a,b)=>workingPairs.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x));
 const softContacts={},attachmentJoins={};
 const parts=[];v.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.opacity===0||annotations.has(mesh))return;
  let parent=mesh,family;while(parent&&!family){family=groups.get(parent);parent=parent.parent;}
  if(!family)throw Error('Unclassified mesh');
  parts.push({name:(mesh.name||mesh.userData.role||'part')+'-'+parts.length,mesh,family,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 });
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));let checks=0;const failures={};
 for(let pose=0;pose<=64;pose++){
  syncWeightedBellCrank(v,samples[6000+Math.round(1200*pose/64)]);
  for(const p of parts){if(p.mesh===b.cord){p.solid=solidSurface(p.mesh.geometry);p.points=surfacePoints(p.mesh.geometry);}p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b] of pairs){if(!a.box.intersectsBox(b.box))continue;const name=a.name+'/'+b.name;
   for(const [from,to] of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;
     const target=isWorking(a.mesh,b.mesh)?(a.mesh.userData.isCord||b.mesh.userData.isCord?attachmentJoins:softContacts):failures;const e=target[name]??{firstPose:pose,points:0,maximumDepth:0};e.points++;e.maximumDepth=Math.max(e.maximumDepth,depth);target[name]=e;
    }
   }
  }
 }
 const report={movement:154,method:'All visible mesh pairs belonging to different rigid bodies, bidirectional vertices/edge midpoints/face centers, 65 native poses from the sixth full disk cycle. Contact markers are excluded; intended soft working contacts and rope attachment joins are reported separately. Same-body mating interfaces excluded. No continuous collision proof.',summary:{parts:parts.length,pairs:pairs.length,poses:65,checks,failingPairs:Object.keys(failures).length},failures,softContacts,attachmentJoins,sources:['scripts/review-weighted-bell-crank-assembly.mjs','src/simulation/mujoco-weighted-bell-crank/geometry.js','src/simulation/mujoco-weighted-bell-crank/sync.js','src/simulation/authored-stud-drives.js','/dev/shm/154-supported-fine-samples.json','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/154-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary,failures);assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
