import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeSelectableCamValve} from '../src/simulation/selectable-cam-valve.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeSelectableCamValve();
try{
 const u=v.root.userData,b=u.blocks,groups=new Map([[b.fixedFrame,'fixed'],[b.camRotor,'shaft'],[b.slidingCarrier,'carrier'],[b.lever,'lever'],[b.followerRoller.rotor,'roller'],[u.valveBodies.rod,'rod'],[u.valveBodies.slider,'slider']]);
 const parts=[];v.root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.opacity===0)return;
  let parent=mesh,family;while(parent&&!family){family=groups.get(parent);parent=parent.parent;}
  if(!family)throw Error('Unclassified mesh');
  parts.push({name:(mesh.name||mesh.userData.role||'part')+'-'+parts.length,mesh,family,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 });
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>b.family!==a.family).map(b=>[a,b]));let checks=0;const failures={};
 for(let pose=0;pose<=64;pose++){
  v.update(u.geometry.demonstrationPeriod*pose/64);v.root.updateMatrixWorld(true);
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b] of pairs){if(!a.box.intersectsBox(b.box))continue;const name=a.name+'/'+b.name;
   for(const [from,to] of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;
     const e=failures[name]??{firstPose:pose,points:0,maximumDepth:0};e.points++;e.maximumDepth=Math.max(e.maximumDepth,depth);failures[name]=e;
    }
   }
  }
 }
 const report={movement:150,method:'All visible mesh pairs belonging to different rigid bodies, bidirectional vertices/edge midpoints/face centers, 65 poses spanning all selections. Same-body mating interfaces excluded. No continuous collision proof.',summary:{parts:parts.length,pairs:pairs.length,poses:65,checks,failingPairs:Object.keys(failures).length},failures,sources:['scripts/review-selectable-cam-valve.mjs','src/simulation/selectable-cam-valve.js','src/simulation/authored-selectable-cams.js','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/150-pinned-valve-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary,failures);assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
