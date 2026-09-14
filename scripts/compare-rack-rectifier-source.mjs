import fs from 'node:fs';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoRackRectifier} from '../src/simulation/mujoco-rack-rectifier/visual.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {rackRectifierStudySources} from './lib/rack-rectifier-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/116-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/116-source-b.json',sources=freezeStudySources([...rackRectifierStudySources('scripts/compare-rack-rectifier-source.mjs'),'tests/helpers/solid-surface.mjs',input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeMujocoRackRectifier(await loadMujoco()),u=v.root.userData;
const stats=residuals=>({count:residuals.length,rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/residuals.length),maximum:Math.max(...residuals.map(Math.abs)),residuals});
try{
 const edges=name=>{const mesh=u.parts[name],triangles=surfaceTriangles(mesh.geometry),segments=[];for(const t of triangles){const n=t.getNormal(new THREE.Vector3());if(Math.abs(n.z)>.999)continue;for(const [a,b]of [[t.a,t.b],[t.b,t.c],[t.c,t.a]])if(Math.abs(a.z-b.z)<1e-8){segments.push([a,b].map(p=>{const q=p.clone().applyMatrix4(mesh.matrixWorld);return[s.axis[0]+100*q.x,s.axis[1]-100*q.y];}));}}return segments;};
 const distance=(point,segments)=>Math.min(...segments.map(([a,b])=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*x+(point[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(point[0]-a[0]-t*x,point[1]-a[1]-t*y);}));
 const frame=['middleFrame','upperRack','lowerRack','leftStub','rightStub'].flatMap(edges),groups={};
 for(const [name,line]of Object.entries(s.frame))groups[name]=stats(line.points.map(p=>distance(p,frame)));
 for(const [name,curve]of Object.entries(s.curves))groups[name]=stats(curve.points.map(p=>distance(p,frame)));
 groups.pinion=stats(s.gear.map(p=>distance(p.point,edges('lower'))));
 groups.ratchet=stats(s.ratchet.map(p=>distance(p.point,edges('lowerRatchet'))));
 groups.shaft=stats(s.shaft.points.map(p=>distance(p,edges('shaft'))));
 groups.rackToothCenters=stats(s.teeth.map(p=>{const f=u.profile,x=f.origins[p.side]+p.index*f.pitch,y=((s.axis[1]-p.y)/100-x*Math.sin((f.tilt??0)))/Math.cos((f.tilt??0));return s.axis[0]+100*(x*Math.cos((f.tilt??0))-y*Math.sin((f.tilt??0)))-p.center;}));
 const report={sources,groups,qualification:'Distances to actual transformed rendered side edges at the initial native pose. Tooth centers assess spacing, not full silhouettes. Thirteen shifted pinion teeth, six asymmetric ratchet teeth and twelve teeth per rack replace the irregular drawn profiles. Rear parts superimpose at the initial pose; depth and pawl contact geometry are inferred.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{count:v.count,rms:v.rms,maximum:v.maximum}])));
}finally{v.dispose();}
