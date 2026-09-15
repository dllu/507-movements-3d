import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeCordTreadleSolids} from '../src/simulation/mujoco-cord-treadle/solids.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const samples=JSON.parse(fs.readFileSync('/dev/shm/159-settle-coarse.json'));
const v=makeCordTreadleSolids(),u=v.root.userData;
try{
 const parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family||a.family!=='fixed').map(b=>[a,b]));
 const failures={},workingContacts={};let checks=0;
 for(let pose=0;pose<=128;pose++){
  v.update(samples[Math.round((samples.length-1)*pose/128)]);
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b]of pairs){if(pose&&a.family===b.family||!a.box.intersectsBox(b.box))continue;
   const name=a.name+'/'+b.name,target=[a.name,b.name].includes('treadle')&&[a.name,b.name].includes('floor')?workingContacts:failures;
   for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;const e=target[name]??{firstPose:pose,maximumDepth:0,points:0};e.maximumDepth=Math.max(e.maximumDepth,depth);e.points++;target[name]=e;}}
  }
 }
 const sourceFiles=['scripts/review-cord-treadle-core.mjs','src/simulation/mujoco-cord-treadle/solids.js','src/simulation/cord-treadle-motion.js','/dev/shm/159-settle-coarse.json','tests/helpers/solid-surface.mjs'];
 const report={movement:159,method:'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Cross-body pairs at 129 poses across four native cycles; rigid core only, no cord or terminations; same-moving-body pairs once because relative transforms are fixed. Fixed-frame unions excluded. Finite sampling, not a continuous collision proof.',parts:parts.length,pairs:pairs.length,poses:129,checks,failures,workingContacts,sources:sourceFiles.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/159-rigid-core.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
