import fs from 'node:fs';
import crypto from 'node:crypto';
import polygonClipping from 'polygon-clipping';
import {Vector3} from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const model=createAuthoredGearMovement({id:139}),{blocks:b,geometry:g}=model.root.userData;
const contour=o=>{const s=o.geometry.parameters.shapes,point=p=>{const v=new Vector3(p.x,p.y,0).applyMatrix4(o.matrixWorld);return[v.x,v.y];};return[s.getPoints(48).map(point),...s.holes.map(h=>h.getPoints(48).map(point))];};
const area=polygons=>polygons.reduce((sum,p)=>sum+p.reduce((sum,r,i)=>{let a=0;for(let j=0;j<r.length;j++){const q=r[(j+1)%r.length];a+=r[j][0]*q[1]-q[0]*r[j][1];}return sum+(i===0?1:-1)*Math.abs(a)/2;},0),0);
try{
 let worst={area:0},interferingPoses=0;const samples=[];
 for(let i=0;i<360;i++){
  const t=i*g.cyclePeriod/360;model.update(t);model.root.updateMatrixWorld(true);
  const pinion=contour(b.pinionBody);let overlap=0;
  for(const tooth of b.rackTeeth)overlap+=area(polygonClipping.intersection(pinion,contour(tooth)));
  overlap+=area(polygonClipping.intersection(pinion,contour(b.rackBody)));
  const state=model.root.userData.stateAtTime(t),row={time:t,stage:state.stage,overlapArea:overlap};
  if(overlap>1e-7)interferingPoses++;
  if(overlap>worst.area)worst={area:overlap,...row};
  samples.push(row);
 }
 const sources=['src/simulation/authored-gears.js','scripts/review-internal-rack-carriage.mjs','package-lock.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const result={sources,method:'Planar intersection of un-beveled nominal pinion/rack contours, with rendered object transforms; working depths overlap. This underestimates bevel interference.',poses:samples.length,interferingPoses,worst,dimensions:{pinionTeeth:g.pinionTeeth,pinionPitchRadius:g.pinionPitchRadius,pinionOuterRadius:g.pinionOuterRadius,rackStraightSpan:g.rackStraightSpan,rackPitchRadius:g.rackPitchRadius,frameOuterHalfWidth:g.frameOuterHalfWidth,frameOuterHalfHeight:g.frameOuterHalfHeight},samples};
 fs.writeFileSync('docs/validation/139-tooth-review.json',JSON.stringify(result,null,2)+'\n');console.log({...result,sources:undefined,samples:undefined});
}finally{disposeObject3D(model.root);}
