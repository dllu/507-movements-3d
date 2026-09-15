import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeElbowPawlGeometry} from '../src/simulation/mujoco-elbow-pawl/geometry.js';
import {syncElbowPawl} from '../src/simulation/mujoco-elbow-pawl/sync.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const results=[];
for(const side of ['right','left']){
 const file=`/dev/shm/155-supported-${side}-fine-samples.json`,rows=JSON.parse(fs.readFileSync(file)),v=makeElbowPawlGeometry({side});
 try{
  const u=v.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
  const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family||a.family!=='fixed').map(b=>[a,b]));
  const failures={},workingContacts={};let checks=0;
  for(let pose=0;pose<=128;pose++){
   syncElbowPawl(v,rows[pose<=64?Math.round(440*pose/64):3080+Math.round(440*(pose-64)/64)]);
   for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
   for(const [a,b]of pairs){if(pose&&a.family===b.family||!a.box.intersectsBox(b.box))continue;
    const name=a.name+'/'+b.name,target=[a.name,b.name].includes('cog')&&[a.name,b.name].includes('click')?workingContacts:failures;
    for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;const e=target[name]??{firstPose:pose,maximumDepth:0,points:0};e.maximumDepth=Math.max(e.maximumDepth,depth);e.points++;target[name]=e;}}
   }
  }
  results.push({side,parts:parts.length,pairs:pairs.length,poses:129,checks,failures,workingContacts,sampleFile:file});
 }finally{v.dispose();}
}
const sourceFiles=['scripts/review-elbow-pawl-assembly.mjs','src/simulation/mujoco-elbow-pawl/geometry.js','src/simulation/mujoco-elbow-pawl/sync.js','tests/helpers/solid-surface.mjs',...results.map(r=>r.sampleFile)];
const report={movement:155,method:'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Cross-body pairs at 65 startup-cycle and 64 eighth-cycle poses in both installations; same-moving-body pairs once because relative transforms are fixed. Fixed-frame unions excluded. Pawl/tooth soft working contact reported separately. Finite sampling, not a continuous collision proof.',results,sources:sourceFiles.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/155-supported-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(results);assert.equal(results.reduce((s,r)=>s+Object.keys(r.failures).length,0),0);
