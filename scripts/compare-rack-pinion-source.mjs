import fs from 'node:fs';
import * as THREE from 'three';
import {makeRackPinionGeometry} from '../src/simulation/mujoco-rack-pinion/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {rackPinionStudySources} from './lib/rack-pinion-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/113-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/113-source-c.json',sources=freezeStudySources([...rackPinionStudySources('scripts/compare-rack-pinion-source.mjs'),'tests/helpers/solid-surface.mjs',input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeRackPinionGeometry(),u=v.root.userData;
const stats=residuals=>({count:residuals.length,rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/residuals.length),maximum:Math.max(...residuals.map(Math.abs)),residuals});
try{
 const edges=name=>{const mesh=u.parts[name],triangles=surfaceTriangles(mesh.geometry),segments=[];for(const t of triangles){const n=t.getNormal(new THREE.Vector3());if(Math.abs(n.z)>.999)continue;for(const [a,b]of [[t.a,t.b],[t.b,t.c],[t.c,t.a]])if(Math.abs(a.z-b.z)<1e-8){segments.push([a,b].map(p=>{const q=p.clone().applyMatrix4(mesh.matrixWorld);return[s.axis[0]+100*q.x,s.axis[1]-100*q.y];}));}}return segments;};
 const distance=(point,segments)=>Math.min(...segments.map(([a,b])=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*x+(point[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(point[0]-a[0]-t*x,point[1]-a[1]-t*y);}));
 const rail=edges('rail'),gear=edges('pinion'),groups={};
 for(const [name,line]of Object.entries(s.lines))groups[name]=stats(line.points.map(p=>distance(p,rail)));
 groups.pinion=stats(s.gear.map(p=>distance(p.point,gear)));
 for(const [name,c]of Object.entries(s.circles)){const part=name==='shaft'?'shaft':name==='hub'?'hub':name.startsWith('left')?'leftRoller':'rightRoller',segments=edges(part);groups[name]=stats(c.points.map(p=>distance(p,segments)));}
 const toothCenters=s.teeth.map(p=>{const f=u.profile,localX=f.source.rackOrigin+p.index*f.pitch,localY=(s.axis[1]-p.y)/100,world=new THREE.Vector3(localX,(localY-localX*Math.sin(f.source.tilt))/Math.cos(f.source.tilt),0).applyMatrix4(v.root.matrixWorld);return s.axis[0]+100*world.x-p.center;});groups.rackToothCenters=stats(toothCenters);
 const report={sources,groups,qualification:'Distances to actual transformed side edges of rendered meshes. Concentric ring groups select the closest rendered edge; tooth centers measure the uniformly spaced pattern, not a tooth silhouette. Rack walls and tips differ from the square source teeth to mesh with generated shallow involutes.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{count:v.count,rms:v.rms,maximum:v.maximum}])));
}finally{disposeObject3D(v.root);}
