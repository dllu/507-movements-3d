import fs from 'node:fs';
import * as THREE from 'three';
import {makeBellCrankGeometry} from '../src/simulation/mujoco-bell-crank/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {bellCrankStudySources} from './lib/bell-crank-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/126-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/126-source-a.json',options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const edgeInput=process.env.EDGE_REPORT??'/dev/shm/126-edges-a.json',edges=JSON.parse(fs.readFileSync(edgeInput));
const sources=freezeStudySources([...bellCrankStudySources('scripts/compare-bell-crank-source.mjs'),input,edgeInput],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeBellCrankGeometry(options),u=v.root.userData;
function slice(mesh,z){const g=mesh.geometry,p=g.attributes.position,ix=g.index,segments=[];for(let i=0;i<(ix?.count??p.count);i+=3){const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld)),cross=[];for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3];if((a.z-z)*(b.z-z)<0){const t=(z-a.z)/(b.z-a.z);cross.push([a.x+t*(b.x-a.x),a.y+t*(b.y-a.y)]);}}if(cross.length===2)segments.push(cross);}return segments;}
const cache=new Map();
function measure(part,points,z){const key=part+'/'+z;if(!cache.has(key))cache.set(key,slice(u.parts[part],z));const segments=cache.get(key),residuals=points.map(p=>{const x=(p[0]-u.source.axis[0])/100,y=(u.source.axis[1]-p[1])/100;let best=Infinity;for(const[a,b]of segments){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;if(!den)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den));best=Math.min(best,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return 100*best;});return{part,count:points.length,rms:Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/residuals.length),maximum:Math.max(...residuals),residuals};}
try{
 const groups={},mapping={pulleyRim:['frontFlange',.13],pulleyInset:['frontFlange',.13],pulleyHub:['pulleyHub',.16],pulleyShaft:['pulleyShaft',.18],pivotEye:['pivotBoss',.325],pivotInset:['pivotBoss',.325],pivotPin:['pivotPin',.36],inputEye:['inputEye',.325],inputPin:['inputPin',.36],outputEye:['outputEye',.325],outputPin:['outputPin',.55]};
 for(const[n,c]of Object.entries(s.circles)){const[part,z]=mapping[n];groups[n]=measure(part,c.points,z);}
 for(const[n,a]of Object.entries(edges.arms))for(const side of ['left','right'])groups[n+'Arm'+side]=measure('lever',a[side],.24);
 for(const[n,c]of Object.entries(edges.cords))groups[n+'Cord']=measure('inputCord',c.stations.flatMap(r=>[[r.left,r.y],[r.right,r.y]]),.000001);
 for(const g of Object.values(groups))if(!g.residuals.every(Number.isFinite))throw Error('Missing rendered slice');
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,options,groups,qualification:'Independent ink points compared with actual rendered triangle slices. A coaxial pulley, cubic arm contours and a constant-diameter cord are reconstructed. These source-pose distances do not establish native contact or continuous clearance.'},null,2)+'\n',{flag:'wx'});
 console.log(Object.fromEntries(Object.entries(groups).map(([n,g])=>[n,{count:g.count,rms:g.rms,maximum:g.maximum}])));
}finally{disposeObject3D(v.root);}
