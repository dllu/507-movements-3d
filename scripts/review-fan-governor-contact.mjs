import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createAuthoredGovernorMovement} from '../src/simulation/authored-governors.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const model=createAuthoredGovernorMovement({id:147});
try{
 const {geometry:g,blocks:b,rampRecords}=model.root.userData;
 const ramps=rampRecords.map(r=>solidSurface(r.mesh.geometry));
 const points=b.rollerAssemblies.map(r=>surfacePoints(r.body.geometry));
 const poses=[];
 for(let i=0;i<=64;i++){
  model.update(g.cyclePeriod*i/64);model.root.updateMatrixWorld(true);
  let penetrations=0,maximumDepth=0;
  for(let j=0;j<2;j++)for(let k=0;k<2;k++){
   const transform=rampRecords[k].mesh.matrixWorld.clone().invert().multiply(b.rollerAssemblies[j].body.matrixWorld);
   for(const p of points[j]){
    const q=p.clone().applyMatrix4(transform);if(!ramps[k].inside(q))continue;
    const depth=ramps[k].distance(q);if(depth<1e-6)continue;
    penetrations++;maximumDepth=Math.max(maximumDepth,depth);
   }
  }
  poses.push({time:g.cyclePeriod*i/64,penetrations,maximumDepth});
 }
 const report={movement:147,status:'legacy-contact-failure',
  method:'Actual cylinder vertices, edge midpoints and face centers tested against both oriented ramp meshes. Decorations excluded. Prescribed center height equals ramp height plus roller radius; this does not offset a roller along the ramp normal.',
  summary:{poses:poses.length,failingPoses:poses.filter(p=>p.penetrations>0).length,maximumDepth:Math.max(...poses.map(p=>p.maximumDepth))},poses,
  sources:['scripts/review-fan-governor-contact.mjs','src/simulation/authored-governors.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/147-legacy-contact.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{disposeObject3D(model.root);}
