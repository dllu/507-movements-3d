import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeBallGovernorSolids} from '../src/simulation/mujoco-ball-governor/solids.js';
import {governorGeometry,governorEquilibrium} from '../src/simulation/mujoco-ball-governor/equilibrium.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeBallGovernorSolids(),g=governorGeometry(),parts=[],cache=new Map(),failures={};let queries=0;
try{
 v.root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const family=v.root.userData.families[mesh.name]??(mesh.name.startsWith('input')?'inputGear':'outputGear');
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  parts.push({mesh,name:mesh.name,family,...cache.get(mesh.geometry)});
 });
 const pairs=parts.flatMap((a,i)=>parts.slice(i+1).filter(b=>a.family!==b.family&&!(a.family.endsWith('Gear')&&b.family.endsWith('Gear'))).map(b=>[a,b]));
 const initial=governorEquilibrium(g.initialSpread,g).lowerAngle;
 for(let pose=0;pose<=64;pose++){
  const theta=.3598+(.6084-.3598)*pose/64,e=governorEquilibrium(theta,g),offset=e.lowerAngle-initial-theta+g.initialSpread;
  v.update({spindle:4*Math.PI*pose/64,leftSpread:theta,rightSpread:theta,sleeveY:e.sleeveY,qpos:[0,theta-g.initialSpread,offset,theta-g.initialSpread,offset,0]});
  for(const p of parts){p.box=new THREE.Box3().setFromObject(p.mesh);p.inverse=p.mesh.matrixWorld.clone().invert();}
  for(const [a,b] of pairs){
   if(!a.box.intersectsBox(b.box))continue;
   for(const [from,to]of [[a,b],[b,a]]){
    const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
    for(const sample of from.points){
     const point=sample.clone().applyMatrix4(transform);queries++;
     if(!to.surface.inside(point))continue;
     const depth=to.surface.distance(point);if(depth<1e-6)continue;
     const key=a.name+'/'+b.name,entry=failures[key]??{maximumDepth:0,firstPose:pose,samples:0};
     entry.maximumDepth=Math.max(entry.maximumDepth,depth);entry.samples++;failures[key]=entry;
    }
   }
  }
 }
 const report={movement:161,status:'unregistered-solids-candidate',poses:65,meshes:parts.length,pairs:pairs.length,queries,failures,
  method:'Bidirectional mesh vertices, edge midpoints and triangle centers. Spread sweeps 0.3598–0.6084 radians while spindle turns twice. Same rigid-family joins excluded; bevel-to-bevel pairs have their separate report. Finite sampling, not continuous collision proof.',
  sources:['scripts/review-governor-solids.mjs','src/simulation/mujoco-ball-governor/solids.js','src/simulation/mujoco-ball-governor/update-solids.js','src/simulation/mujoco-ball-governor/bevel-pair.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/161-solid-clearance.json',JSON.stringify(report,null,2)+'\n');console.log(report);
 assert.equal(Object.keys(failures).length,0,'Unexpected cross-family intersections');
}finally{v.dispose();}
