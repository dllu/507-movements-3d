import fs from 'node:fs';
import * as THREE from 'three';
import {makeDoubleRackGeometry} from '../src/simulation/mujoco-double-rack/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {doubleRackStudySources} from './lib/double-rack-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/114-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/114-source-b.json',sources=freezeStudySources([...doubleRackStudySources('scripts/compare-double-rack-source.mjs'),'tests/helpers/solid-surface.mjs',input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeDoubleRackGeometry(),u=v.root.userData;
const stats=residuals=>({count:residuals.length,rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/residuals.length),maximum:Math.max(...residuals.map(Math.abs)),residuals});
try{
 const edges=name=>{const mesh=u.parts[name],triangles=surfaceTriangles(mesh.geometry),segments=[];for(const t of triangles){const n=t.getNormal(new THREE.Vector3());if(Math.abs(n.z)>.999)continue;for(const [a,b]of [[t.a,t.b],[t.b,t.c],[t.c,t.a]])if(Math.abs(a.z-b.z)<1e-8){segments.push([a,b].map(p=>{const q=p.clone().applyMatrix4(mesh.matrixWorld);return[s.axis[0]+100*q.x,s.axis[1]-100*q.y];}));}}return segments;};
 const distance=(point,segments)=>Math.min(...segments.map(([a,b])=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*x+(point[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(point[0]-a[0]-t*x,point[1]-a[1]-t*y);}));
 const frame=edges('frame'),gear=edges('pinion'),groups={};
 for(const [name,line]of Object.entries(s.frame))groups[name]=stats(line.points.map(p=>distance(p,frame)));
 for(const [name,curve]of Object.entries(s.curves))groups[name]=stats(curve.points.map(p=>distance(p,frame)));
 groups.pinion=stats(s.gear.map(p=>distance(p.point,gear)));
 for(const [name,c]of Object.entries(s.circles)){const segments=edges(name==='root'?'pinion':name);groups[name]=stats(c.points.map(p=>distance(p,segments)));}
 groups.rackToothCenters=stats(s.teeth.map(p=>s.axis[0]+100*(u.profile.rackOrigin+p.index*u.profile.pitch+(p.side==='upper'?u.profile.upperOffset:0))-p.center));
 const report={sources,groups,qualification:'Distances to actual transformed rendered side edges at the initial native pose. Tooth centers assess spacing, not full silhouettes. The pinion sector phase is corrected for a viable full stroke; generated involutes and relieved end teeth differ from the engraved square irregular teeth.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{count:v.count,rms:v.rms,maximum:v.maximum}])));
}finally{disposeObject3D(v.root);}
