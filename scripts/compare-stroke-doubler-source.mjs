import fs from 'node:fs';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoStrokeDoubler} from '../src/simulation/mujoco-stroke-doubler/visual.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {strokeDoublerStudySources} from './lib/stroke-doubler-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/118-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/118-source-a.json';
const sources=freezeStudySources([...strokeDoublerStudySources('scripts/compare-stroke-doubler-source.mjs'),'tests/helpers/solid-surface.mjs',input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeMujocoStrokeDoubler(await loadMujoco()),u=v.root.userData;
const stats=residuals=>({count:residuals.length,rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/residuals.length),maximum:Math.max(...residuals.map(Math.abs)),residuals});
try{
 const edges=name=>{const mesh=u.parts[name],segments=[];for(const t of surfaceTriangles(mesh.geometry)){if(Math.abs(t.getNormal(new THREE.Vector3()).z)>.999)continue;for(const [a,b]of [[t.a,t.b],[t.b,t.c],[t.c,t.a]])if(Math.abs(a.z-b.z)<1e-8&&a.distanceTo(b)>1e-8)segments.push([a,b].map(p=>{const q=p.clone().applyMatrix4(mesh.matrixWorld);return[u.source.axis[0]+100*q.x,u.source.axis[1]-100*q.y];}));}return segments.filter(([a,b])=>Math.hypot(a[0]-b[0],a[1]-b[1])>1e-8);};
 const distance=(p,segments)=>Math.min(...segments.map(([a,b])=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}));
 const groups={pinion:stats(s.gear.map(p=>distance(p.point,edges('pinion')))),eye:stats(s.circles.eye.points.map(p=>distance(p,edges('eye')))),pin:stats(s.circles.pin.points.map(p=>distance(p,edges('spindle'))))};
 for(const [name,part]of Object.entries({upperTop:'upperRack',upperRoot:'upperRack',lowerUnderside:'lowerRack',baseTop:'bed',baseBottom:'bed',rodTop:'pitman',rodBottom:'pitman'}))groups[name]=stats(s.lines[name].points.map(p=>distance(p,edges(part))));
 const local=([x,y])=>[(Math.cos(u.source.tilt)*(x-s.axis[0])+Math.sin(u.source.tilt)*(s.axis[1]-y))/100,(-Math.sin(u.source.tilt)*(x-s.axis[0])+Math.cos(u.source.tilt)*(s.axis[1]-y))/100];
 for(const side of ['upper','lower'])groups[side+'ToothCenters']=stats(s.teeth.filter(p=>p.side===side).map(p=>100*(u.source.origins[side]+p.index*u.profile.pitch-local([p.center,p.y])[0])));
 const report={sources,groups,qualification:'Distances to transformed rendered edges in the initial native pose, plus signed rack tooth-center corrections. Fourteen pinion teeth preserve the visible count; common involute pitch regularizes uneven source spacing. Hidden guides, depth, motion amplitude and the static interpretation of the three support webs are inferred.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{count:v.count,rms:v.rms,maximum:v.maximum}])));
}finally{v.dispose();}
