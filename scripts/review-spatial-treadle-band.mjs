import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AxiallySeparatedBand} from '../src/simulation/axially-separated-band.js';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const v=createAuthoredCrankMovement({id:160}),u=v.root.userData,g=u.geometry;
try{
 const poses=129,segments=1024,startZ=.24,endZ=.72;let minimumClearance=Infinity,contactMinZ=Infinity,contactMaxZ=-Infinity,worstPose=0;
 for(let i=0;i<poses;i++){
  const s=u.stateAtTime(4*i/(poses-1)),band=new AxiallySeparatedBand(s.bandCurve,{startZ,endZ}),step=band.getLength()/segments;
  const points=Array.from({length:segments+1},(_,j)=>band.getPoint(j/segments));
  // Every point on the curve lies within one sample spacing of a sampled
  // endpoint. Subtract twice that spacing to bound between-sample clearance.
  // Include neighboring sample pairs around the nonlocal material threshold.
  const gap=Math.max(1,Math.floor(4*g.bandRadius/step)-1);let nearestSquared=Infinity;
  for(let a=0;a<points.length;a++)for(let b=a+gap;b<points.length;b++){
   const dx=points[a].x-points[b].x,dy=points[a].y-points[b].y,dz=points[a].z-points[b].z;
   nearestSquared=Math.min(nearestSquared,dx*dx+dy*dy+dz*dz);
  }
  const clearance=Math.sqrt(nearestSquared)-2*step-2*g.bandRadius;
  if(clearance<minimumClearance){minimumClearance=clearance;worstPose=i;}
  for(const distance of s.bandTransitionDistances){const p=band.getPoint(distance/g.nominalBandLength);contactMinZ=Math.min(contactMinZ,p.z-g.bandRadius);contactMaxZ=Math.max(contactMaxZ,p.z+g.bandRadius);}
 }
 const report={movement:160,status:'candidate-not-registered',poses,segments,startZ,endZ,minimumNonlocalClearanceLowerBound:minimumClearance,minimumNonlocalClearancePixels:minimumClearance/g.sourceUnitsPerPixel,worstPose,contactAxialSurfaceRange:[contactMinZ,contactMaxZ],method:'Spatial lift preserves every XY point and fixes each material point depth. Nonlocal points separated by at least four cord radii: sampled pair distances minus two arclength sample spacings and two radii conservatively bound the intervening curve at each reviewed pose. No claim of continuous-time or hardware clearance.',sources:['scripts/review-spatial-treadle-band.mjs','src/simulation/axially-separated-band.js','src/simulation/authored-cranks.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 assert.ok(minimumClearance>0);fs.writeFileSync('docs/validation/160-spatial-band.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(v.root);}
