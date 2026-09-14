import fs from 'node:fs';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoRollerYoke} from '../src/simulation/mujoco-roller-yoke/visual.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {rollerYokeStudySources} from './lib/roller-yoke-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/117-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/117-source-b.json',sources=freezeStudySources([...rollerYokeStudySources('scripts/compare-roller-yoke-source.mjs'),'tests/helpers/solid-surface.mjs',input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeMujocoRollerYoke(await loadMujoco()),u=v.root.userData;
const stats=residuals=>({count:residuals.length,rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/residuals.length),maximum:Math.max(...residuals.map(Math.abs)),residuals});
try{
 const edges=name=>{const mesh=u.parts[name],segments=[];for(const t of surfaceTriangles(mesh.geometry)){if(Math.abs(t.getNormal(new THREE.Vector3()).z)>.999)continue;for(const [a,b]of [[t.a,t.b],[t.b,t.c],[t.c,t.a]])if(Math.abs(a.z-b.z)<1e-8&&a.distanceTo(b)>1e-8)segments.push([a,b].map(p=>{const q=p.clone().applyMatrix4(mesh.matrixWorld);return[u.source.axis[0]+100*q.x,u.source.axis[1]-100*q.y];}));}return segments.filter(([a,b])=>Math.hypot(a[0]-b[0],a[1]-b[1])>1e-8);};
 const distance=(p,segments)=>Math.min(...segments.map(([a,b])=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}));
 const groups={cam:stats(s.cam.map(p=>distance(p.point,edges('cam'))))};
 for(const n of ['shaft','upperRoller','lowerRoller','upperPin','lowerPin'])groups[n]=stats(s.circles[n].points.map(p=>distance(p,edges(n))));
 const mapping={leftRailLeft:'leftRail',leftRailRight:'leftRail',rightRailLeft:'rightRail',rightRailRight:'rightRail',topCrossbarTop:'upperBar',topCrossbarBottom:'upperBar',bottomCrossbarTop:'lowerBar',bottomCrossbarBottom:'lowerBar',leftCheekLeft:'leftCheek',leftCheekRight:'leftCheek',rightCheekLeft:'rightCheek',rightCheekRight:'rightCheek',lowerGuideTop:'guide',lowerGuideBottom:'guide'};
 for(const [name,part]of Object.entries(mapping))groups[name]=stats(s.lines[name].points.map(p=>distance(p,edges(part))));
 const report={sources,groups,qualification:'Distances to actual transformed rendered edges at the initial native pose. Equal roller radii and coaxial roller centers regularize the drawing. The cam pitch curve contains only odd harmonics so both roller centers remain conjugate. Source contours hidden by rails are excluded. Depth, fork construction and lower stem continuation are inferred.'};verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{count:v.count,rms:v.rms,maximum:v.maximum}])));
}finally{v.dispose();}
