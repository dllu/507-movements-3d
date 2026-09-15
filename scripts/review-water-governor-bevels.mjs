import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeWaterGovernorBevels} from '../src/simulation/mujoco-water-governor/bevel-train.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeWaterGovernorBevels(),cache=new Map(),failures={};let queries=0;
try{
 const parts=Object.entries(v.root.userData.parts).map(([name,mesh])=>{if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});return{name,mesh,family:v.root.userData.families[name],...cache.get(mesh.geometry)};});
 const combinations=[['upperInput','spindleDrive'],['gateOutput','upperLoose'],['gateOutput','lowerLoose'],['upperLoose','lowerLoose']];
 const pairs=combinations.flatMap(([a,b])=>parts.filter(p=>p.family===a).flatMap(p=>parts.filter(q=>q.family===b).map(q=>[p,q])));
 for(let pose=0;pose<=64;pose++){
  const angle=2*Math.PI/30*pose/64;v.update({spindle:angle,output:angle,upper:angle,lower:-angle});
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b]of pairs){if(!a.box.intersectsBox(b.box))continue;
   for(const [from,to]of [[a,b],[b,a]]){const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){const point=sample.clone().applyMatrix4(transform);queries++;if(!to.surface.inside(point))continue;const depth=to.surface.distance(point);if(depth<1e-6)continue;const key=a.name+'/'+b.name,e=failures[key]??{maximumDepth:0,firstPose:pose,samples:0};e.maximumDepth=Math.max(e.maximumDepth,depth);e.samples++;failures[key]=e;}
   }
  }
 }
 const report={movement:162,status:'unregistered-bevel-candidate',parameters:v.root.userData.parameters,poses:65,pairs:pairs.length,queries,failures,method:'Bidirectional vertices, edge midpoints and triangle centers over one tooth pitch at exact ideal ratios. Tooth/body solids, including opposed loose gears. Finite sampled clearance; native soft gear-constraint errors and pin/body contacts not yet included.',sources:['scripts/review-water-governor-bevels.mjs','src/simulation/mujoco-water-governor/bevel-train.js','src/simulation/bevel-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/162-bevel-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.equal(Object.keys(failures).length,0);
}finally{v.dispose();}
