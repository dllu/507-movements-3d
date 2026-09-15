import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeFanGovernorGeometry} from '../src/simulation/mujoco-fan-governor/geometry.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';

// Generate these samples with the refined speed-cycle probe before running.
const sampleFile='/dev/shm/147-cycle-samples.json',samples=JSON.parse(fs.readFileSync(sampleFile)).samples;
const visual=makeFanGovernorGeometry({segments:320});
try{
 const {parts:meshes,families}=visual.root.userData;
 const parts=Object.entries(meshes).map(([name,mesh])=>({name,mesh,family:families[name],solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
 const pairs=[];
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push([parts[i],parts[j]]);
 const failures={},poses=65;let checks=0,maximumWorkingPenetration=0;
 for(let pose=0;pose<poses;pose++){
  visual.sync(samples[Math.round((samples.length-1)*pose/(poses-1))]);
  for(const p of parts)p.box=p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld);
  for(const [a,b] of pairs){
   if(!a.box.intersectsBox(b.box))continue;
   const working=(a.name.startsWith('track_')&&b.name.startsWith('crowned-roller-'))||(b.name.startsWith('track_')&&a.name.startsWith('crowned-roller-'));
   for(const [from,to] of [[a,b],[b,a]]){
    const transform=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
    for(const p of from.points){
     const q=p.clone().applyMatrix4(transform);checks++;
     if(!to.solid.inside(q))continue;
     const depth=to.solid.distance(q);
     if(working)maximumWorkingPenetration=Math.max(maximumWorkingPenetration,depth);
     if(depth<(working?.0002:1e-6))continue;
     const key=a.name+' / '+b.name,entry=failures[key]??{firstPose:pose,points:0,maximumDepth:0};
     entry.points++;entry.maximumDepth=Math.max(entry.maximumDepth,depth);failures[key]=entry;
    }
   }
  }
 }
 const sources=['scripts/review-fan-governor-assembly.mjs','src/simulation/mujoco-fan-governor/geometry.js','src/simulation/mujoco-fan-governor/source.js','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs','docs/validation/147-speed-cycle-fine.json'];
 const report={movement:147,status:'candidate-assembly',method:'Bidirectional vertices, edge midpoints and face centers against actual visible mesh solids. Excludes only same rigid family joins. Crown/track contacts allow 0.0002 penetration for solver compliance and crown discretization; other pairs allow 0.000001. Sampled check, not a continuous swept-volume proof.',
  sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),sampleHash:createHash('sha256').update(fs.readFileSync(sampleFile)).digest('hex'),
  summary:{poses,parts:parts.length,pairs:pairs.length,checks,maximumWorkingPenetration,failingPairs:Object.keys(failures).length},failures};
 fs.writeFileSync('docs/validation/147-candidate-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
 assert.equal(Object.keys(failures).length,0);
}finally{visual.dispose();}
