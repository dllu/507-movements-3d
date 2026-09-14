import fs from 'node:fs';
import * as THREE from 'three';
import {makeSegmentClampGeometry} from '../src/simulation/mujoco-segment-clamp/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {segmentClampStudySources} from './lib/segment-clamp-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/120-source-c.json',sources=freezeStudySources([...segmentClampStudySources('scripts/compare-segment-clamp-source.mjs'),input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeSegmentClampGeometry(),u=v.root.userData;
function slice(mesh,z){const g=mesh.geometry,p=g.attributes.position,ix=g.index,segments=[];
 for(let i=0;i<(ix?.count??p.count);i+=3){const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)),crossings=[];
  for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3];if((a.z-z)*(b.z-z)<0){const t=(z-a.z)/(b.z-a.z);crossings.push([a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)]);}}
  if(crossings.length===2)segments.push(crossings);
 }return segments;
}
const cache=new Map();function measure(part,points,z){const key=part+'/'+z;if(!cache.has(key))cache.set(key,slice(u.parts[part],z));const segments=cache.get(key),residuals=points.map(p=>{const x=(p[0]-u.source.axis[0])/100,y=(u.source.axis[1]-p[1])/100;let best=Infinity;for(const [a,b]of segments){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;if(!den)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den));best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return best*100;});return{part,count:points.length,rms:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/residuals.length),maximum:Math.max(...residuals),residuals};}
try{const groups={};
 const contourParts={small:['smallPinion',.19],large:['largePinion',-.05],external:['externalFrame',.19],internal:['internalToothBand',-.05],outerRim:['internalFrame',-.3]};
 for(const[n,c]of Object.entries(s.contours)){const[part,z]=contourParts[n];groups[n]=measure(part,c.points,z);}
 const circleParts={pivotPin:['pivotShaft',.38],pivotHub:['pivotWasher',.32],pivotEye:['externalFrame',.19],inputShaft:['inputShaft',.33]};
 for(const[n,c]of Object.entries(s.circles)){const[part,z]=circleParts[n];groups[n]=measure(part,c.points,z);}
 for(const g of Object.values(groups))if(!g.residuals.every(Number.isFinite))throw Error(g.part+' has no sliced edge');
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,groups,qualification:'Independent source ink points compared with actual rendered triangle intersections in a transverse plane. These are source-pose edge distances, not native contact or physical-guide qualification.'},null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(groups).map(([n,g])=>[n,{count:g.count,rms:g.rms,maximum:g.maximum}])));
}finally{disposeObject3D(v.root);}
