import fs from 'node:fs';
import * as THREE from 'three';
import {makeCascadedTraverseGeometry} from '../src/simulation/mujoco-cascaded-traverse/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {cascadedTraverseStudySources} from './lib/cascaded-traverse-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/125-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/125-source-c.json',options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const sources=freezeStudySources([...cascadedTraverseStudySources('scripts/compare-cascaded-traverse-source.mjs'),input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeCascadedTraverseGeometry(options),u=v.root.userData;
function slice(mesh,z){const g=mesh.geometry,p=g.attributes.position,ix=g.index,segments=[];for(let i=0;i<(ix?.count??p.count);i+=3){const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)),cross=[];for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3];if((a.z-z)*(b.z-z)<0){const t=(z-a.z)/(b.z-a.z);cross.push([a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)]);}}if(cross.length===2)segments.push(cross);}return segments;}
const cache=new Map();
function measure(part,points,z){const key=part+'/'+z;if(!cache.has(key))cache.set(key,slice(u.parts[part],z));const segments=cache.get(key),residuals=points.map(p=>{const x=(p[0]-u.source.axis[0])/100,y=(u.source.axis[1]-p[1])/100;let best=Infinity;for(const[a,b]of segments){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;if(!den)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den));best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return 100*best;});return{part,count:points.length,rms:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/residuals.length),maximum:Math.max(...residuals),residuals};}
try{
 const groups={};for(const[n,g]of Object.entries(s.gears))groups[n+'Gear']=measure(n+'Gear',g.points,-.09);
 const mapping={};
 for(const n of ['left','middle','right']){mapping[n+'Hub']=[n+'Hub',.025];mapping[n+'Shaft']=[n+'Shaft',.06];mapping[n+'Crank']=[n+'CrankPin',n==='left'?.59:.26];mapping[n+'Eye']=[n+'RodEye',n==='left'?.56:.20];}
 for(const n of ['lower','upper'])for(const p of ['LeftPin','RightPin','CenterPin'])mapping[n+p]=[n+p,(n==='lower'?.24:.64)+(p==='CenterPin'?.35:.15)];
 mapping.lowerCenterEye=['transferRodEye',.56];mapping.upperCenterEye=['outputEye',.96];
 for(const[n,c]of Object.entries(s.circles)){const[part,z]=mapping[n];groups[n]=measure(part,c.points,z);}
 for(const[n,r]of Object.entries(s.rods))for(const side of ['left','right'])groups[n+side]=measure(n,r[side],n==='leftRod'||n==='transferRod'?.49:.13);
 for(const[n,r]of Object.entries(s.links))for(const side of ['left','right'])groups[n+side]=measure(n,r[side],n==='lowerLink'?.29:.69);
 for(const g of Object.values(groups))if(!g.residuals.every(Number.isFinite))throw Error('Missing rendered slice');
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,options,groups,qualification:'Independent ink points compared with actual rendered triangle slices. Regularized gear axes, compatible involute teeth and any crank correction are explicit. Source-pose distances do not establish native contact, complete-pattern reach or continuous clearance.'},null,2)+'\n',{flag:'wx'});
 console.log(Object.fromEntries(Object.entries(groups).map(([n,g])=>[n,{count:g.count,rms:g.rms,maximum:g.maximum}])));
}finally{disposeObject3D(v.root);}
