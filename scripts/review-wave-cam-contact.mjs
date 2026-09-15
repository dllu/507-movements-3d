import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createAuthoredWaveCamMovement} from '../src/simulation/authored-wave-cams.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const model=createAuthoredWaveCamMovement({id:165}),u=model.root.userData,g=u.geometry,wheel=u.blocks.followerWheel,cam=u.blocks.wavedSkirt,surface=solidSurface(wheel.geometry),points=surfacePoints(cam.geometry),samples=[];let maximumPenetration=0,queries=0;
try{
 for(let i=0;i<=96;i++){
  const time=g.outputCyclePeriod*i/96;model.update(time);model.root.updateMatrixWorld(true);const transform=wheel.matrixWorld.clone().invert().multiply(cam.matrixWorld);let depth=0,insideSamples=0;
  for(const p of points){const q=p.clone().applyMatrix4(transform);queries++;if(surface.inside(q)){insideSamples++;depth=Math.max(depth,surface.distance(q));}}
  maximumPenetration=Math.max(maximumPenetration,depth);samples.push({phase:i/96,reportedGap:u.contacts.camRoller.gap,penetration:depth,penetrationPixels:depth/g.sourceUnitsPerPixel,insideSamples});
 }
 const report={movement:165,status:'existing-model-contact-defect',maximumPenetration,maximumPenetrationPixels:maximumPenetration/g.sourceUnitsPerPixel,queries,method:'Transform actual waved-skirt vertices, edge midpoints and triangle centers into the actual closed 64-sided roller mesh. Test inclusion and distance to its surface. The cam skirt need not be closed for these surface points to prove intersection with the roller.',geometry:{camOuterRadius:g.camOuterRadius,innerRadius:g.camSkirtInnerRadius,waves:g.camWaveCount,rollerRadius:g.followerRadius,rollerDepth:g.followerDepth,sourceScale:g.sourceUnitsPerPixel},samples,sources:['scripts/review-wave-cam-contact.mjs','src/simulation/authored-wave-cams.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/165-existing-contact.json',JSON.stringify(report,null,2)+'\n');console.log({maximumPenetration,pixels:report.maximumPenetrationPixels,first:samples[0]});
}finally{disposeObject3D(model.root);}
