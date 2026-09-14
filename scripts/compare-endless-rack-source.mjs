import fs from 'node:fs';
import * as THREE from 'three';
import {makeEndlessRackGeometry} from '../src/simulation/mujoco-endless-rack/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {endlessRackStudySources} from './lib/endless-rack-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/119-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/119-source-b.json',sources=freezeStudySources([...endlessRackStudySources('scripts/compare-endless-rack-source.mjs'),input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeEndlessRackGeometry(),u=v.root.userData;
function slice(mesh,z){const g=mesh.geometry,p=g.attributes.position,ix=g.index,segments=[];
 for(let i=0;i<(ix?.count??p.count);i+=3){const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)),crossings=[];
  for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3];if((a.z-z)*(b.z-z)<0){const t=(z-a.z)/(b.z-a.z);crossings.push([a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)]);}}
  if(crossings.length===2)segments.push(crossings);
 }return segments;
}
const cache=new Map();function measure(part,points,z){const key=part+'/'+z;if(!cache.has(key))cache.set(key,slice(u.parts[part],z));const segments=cache.get(key),residuals=points.map(p=>{const x=(p[0]-u.source.axis[0])/100,y=(u.source.axis[1]-p[1])/100;let best=Infinity;for(const [a,b]of segments){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;if(!den)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den));best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return best*100;});return{part,count:points.length,rms:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/residuals.length),maximum:Math.max(...residuals),residuals};}
try{const groups={};for(const [n,c]of Object.entries(s.contours))groups[n]=measure(n==='pinion'?'pinion':'rack',c.points,0);
 for(const [n,c]of Object.entries(s.circles))groups[n]=measure(n==='hub'?'hub':'rack',c.points,n==='hub'?.14:0);
 for(const [n,c]of Object.entries(s.lines))groups[n]=measure(n.startsWith('topBeam')?'topBeam':n.startsWith('bottomBeam')?'bottomBeam':'rod',c.points,n.includes('Rod')?-.24:.3);
 for(const [n,c]of Object.entries(s.verticals))groups[n]=measure('guide',c.points,.3);
 for(const g of Object.values(groups))if(!g.residuals.every(Number.isFinite))throw Error(g.part+' has no sliced edge');
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,groups,qualification:'Independent source ink points compared with actual rendered triangle intersections in a transverse plane. These are source-pose edge distances, not native contact or physical-guide qualification.'},null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(groups).map(([n,g])=>[n,{count:g.count,rms:g.rms,maximum:g.maximum}])));
}finally{disposeObject3D(v.root);}
