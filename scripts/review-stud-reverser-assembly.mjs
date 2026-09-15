import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeRelievedStudReverser} from '../src/simulation/mujoco-stud-reverser/geometry.js';
import {syncStudReverser} from '../src/simulation/mujoco-stud-reverser/sync.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const samples=JSON.parse(fs.readFileSync('/dev/shm/153-supported-fine-samples.json'));
const v=makeRelievedStudReverser();
try{
 const u=v.root.userData,b=u.blocks,groups=new Map([[b.fixedFrame,'fixed'],[b.diskRotor,'disk'],[b.slidingBar,'bar'],[b.lever,'lever'],...b.guideRollers.map((g,i)=>[g.userData.rotor,'guide'+i])]);
 const annotations=new Set([b.directContactMarker,b.returnInputContactMarker,b.returnOutputContactMarker]);
 const workingPairs=b.pinAssemblies.flatMap(a=>[[a.userData.blocks.pin,b.undersideLug],[a.userData.blocks.pin,b.inputArm.userData.blocks.working]]).concat(b.outputArm.children.map(m=>[m,b.barFrontStud]),[[b.inputArm.userData.blocks.raised,b.leverStop]]);
 const isWorking=(a,b)=>workingPairs.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x));
 const softContacts={};
 const parts=[];v.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.opacity===0||annotations.has(mesh))return;
  let parent=mesh,family;while(parent&&!family){family=groups.get(parent);parent=parent.parent;}
  if(!family)throw Error('Unclassified mesh');
  parts.push({name:(mesh.name||mesh.userData.role||'part')+'-'+parts.length,mesh,family,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 });
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));let checks=0;const failures={};
 for(let pose=0;pose<=64;pose++){
  syncStudReverser(v,samples[6000+Math.round(1200*pose/64)]);
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b] of pairs){if(!a.box.intersectsBox(b.box))continue;const name=a.name+'/'+b.name;
   for(const [from,to] of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;
     const target=isWorking(a.mesh,b.mesh)?softContacts:failures;const e=target[name]??{firstPose:pose,points:0,maximumDepth:0};e.points++;e.maximumDepth=Math.max(e.maximumDepth,depth);target[name]=e;
    }
   }
  }
 }
 const report={movement:153,method:'All visible mesh pairs belonging to different rigid bodies, bidirectional vertices/edge midpoints/face centers, 65 native poses from the sixth full disk cycle. Contact markers are excluded; intended soft working contacts are reported separately. Same-body mating interfaces excluded. No continuous collision proof.',summary:{parts:parts.length,pairs:pairs.length,poses:65,checks,failingPairs:Object.keys(failures).length},failures,softContacts,sources:['scripts/review-stud-reverser-assembly.mjs','src/simulation/mujoco-stud-reverser/geometry.js','src/simulation/mujoco-stud-reverser/sync.js','src/simulation/authored-stud-drives.js','/dev/shm/153-supported-fine-samples.json','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/153-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary,failures);assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
