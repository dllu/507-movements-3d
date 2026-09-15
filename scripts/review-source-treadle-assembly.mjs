import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeSourceTreadle} from '../src/simulation/source-treadle.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeSourceTreadle(),u=v.root.userData;
try{
 const parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,family:u.families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family||a.family!=='fixed').map(b=>[a,b]));
 const failures={};let checks=0;
 for(let pose=0;pose<=128;pose++){
  v.update(u.geometry.period*pose/128);
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b]of pairs){if(pose&&a.family===b.family||!a.box.intersectsBox(b.box))continue;
   const name=a.name+'/'+b.name;
   for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);for(const point of from.points){const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;const e=failures[name]??{firstPose:pose,maximumDepth:0,points:0};e.maximumDepth=Math.max(e.maximumDepth,depth);e.points++;failures[name]=e;}}
  }
 }
 const sourceFiles=['scripts/review-source-treadle-assembly.mjs','src/simulation/source-treadle.js','src/simulation/source-treadle-motion.js','tests/helpers/solid-surface.mjs'];
 const report={movement:158,method:'Bidirectional visible mesh vertices, edge midpoints and triangle centers. Cross-body pairs at 129 full-cycle poses; same-moving-body pairs once because relative transforms are fixed. Fixed-frame unions excluded. Finite sampling, not a continuous collision proof.',parts:parts.length,pairs:pairs.length,poses:129,checks,failures,sources:sourceFiles.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/158-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
