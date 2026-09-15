import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeTwinCamGeometry} from '../src/simulation/mujoco-twin-cam/geometry.js';
import {makeTwinCamPhysics} from '../src/simulation/mujoco-twin-cam/physics.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const v=makeTwinCamGeometry(),p=makeTwinCamPhysics(await loadMujoco()),failures={},workingContacts={};
try{
 const parts=Object.entries(v.root.userData.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 let checks=0,poses=0;
 for(let tick=0;tick<=36000;tick++){
  if(tick>=24000&&(tick-24000)%200===0){
   v.sync(p.state());poses++;
   for(const part of parts){part.box=new THREE.Box3().setFromObject(part.mesh);part.inverse=part.mesh.matrixWorld.clone().invert();}
   for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    const a=parts[i],b=parts[j];if(!a.box.intersectsBox(b.box))continue;
    const name=a.name+'/'+b.name,isWorking=[0,1].some(k=>a.name==='cam'+k&&b.name==='roller'+k);
    for(const [from,to] of [[a,b],[b,a]]){
     const transform=to.inverse.clone().multiply(from.mesh.matrixWorld);
     for(const point of from.points){
      const q=point.clone().applyMatrix4(transform);checks++;if(!to.solid.inside(q))continue;
      const depth=to.solid.distance(q);if(depth<=1e-6)continue;
      const entries=isWorking?workingContacts:failures,entry=entries[name]??{firstTime:p.data.time,points:0,maximumDepth:0};
      entry.points++;entry.maximumDepth=Math.max(entry.maximumDepth,depth);entries[name]=entry;
     }
    }
   }
  }
  if(tick<36000)p.step();
 }
 const report={movement:149,status:'pinned-output-rod-candidate',method:'All pairs of visible meshes, bidirectional vertices, edge midpoints and triangle centers, at 61 simulated poses from 12 to 18 seconds. Cam/roller soft contact reported separately. Fixed support structure not yet modeled. No continuous collision proof.',summary:{poses,parts:parts.length,checks,failingPairs:Object.keys(failures).length},failures,workingContacts,
 sources:['scripts/review-twin-cam-candidate.mjs','src/simulation/mujoco-twin-cam/geometry.js','src/simulation/mujoco-twin-cam/physics.js','src/simulation/mujoco-twin-cam/source.js','src/simulation/mujoco/mass.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/149-pinned-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary,failures,workingContacts);
 if(Object.keys(failures).length)process.exitCode=1;
}finally{v.dispose();p.dispose();}
