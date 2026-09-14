import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeReverseThreadGeometry} from '../src/simulation/mujoco-reverse-thread/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/108-outlines';
const measurementFile=process.env.SOURCE_REPORT??'/dev/shm/108-source-b.json';
const measured=JSON.parse(fs.readFileSync(measurementFile));
assert.equal(hashStudyFile(measured.file),measured.sha256);
const paths=[...['src/simulation/mujoco-reverse-thread','src/simulation/mujoco'].flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n)),
 'scripts/compare-reverse-thread-outlines.mjs','scripts/lib/study-report-io.mjs',
 'tests/helpers/solid-surface.mjs','src/simulation/finite-plate-geometry.js',
 'src/simulation/clutch-section-geometry.js','src/simulation/coaxial-gear-geometry.js',
 'src/simulation/primitives.js','src/simulation/dispose-model.js','package-lock.json',measured.file,measurementFile];
const sources=freezeStudySources(paths,prefix),options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const v=makeReverseThreadGeometry(options),f=v.root.userData.profile,edges=new Map();
try {
 // Extract the actual outer shoulders from the final Float32 triangles. A
 // shoulder joins two outer-radius vertices on a non-cylindrical face.
 for(const triangle of surfaceTriangles(v.root.userData.parts.lands.geometry)) {
  const points=[triangle.a,triangle.b,triangle.c],outer=points.filter(p=>Math.abs(Math.hypot(p.x,p.z)-f.radius)<1e-7);
  if(outer.length!==2||points.every(p=>Math.abs(p.y-f.bottom)<1e-7)||points.every(p=>Math.abs(p.y-f.ceiling)<1e-7))continue;
  let [a,b]=outer.map(p=>p.clone());if(a.z<0&&b.z<0)continue;
  if(a.z<0)a.lerp(b,-a.z/(b.z-a.z));else if(b.z<0)b.lerp(a,-b.z/(a.z-b.z));
  const key=[a,b].map(p=>p.toArray().map(v=>v.toFixed(9)).join(',')).sort().join('/');
  edges.set(key,[a,b].map(p=>[f.axis[0]+100*p.x,f.axis[1]-100*p.y]));
 }
 const outline=[...edges.values()];assert.ok(outline.length);
 const closest=(point,edge)=>{
  const [a,b]=edge,dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
  const projected=[a[0]+t*dx,a[1]+t*dy];return{point:projected,distance:Math.hypot(point[0]-projected[0],point[1]-projected[1])};
 };
 const rows=measured.groove.flatMap(g=>['low','high'].map(side=>{
  const point=g.seed.map((v,k)=>v+g[side]*g.normal[k]);let best;
  outline.forEach((edge,i)=>{const hit=closest(point,edge);if(!best||hit.distance<best.distance)best={...hit,edge:i};});
  return{index:g.index,hand:g.hand,side,source:point,closest:best};
 }));
 const distances=rows.map(r=>r.closest.distance),result={sources,options,
  qualification:'Nearest visible outer-shoulder projection to paired ink-outline centers. This does not establish hidden geometry, groove correspondence or dynamics.',
  count:rows.length,rmsPixels:Math.sqrt(distances.reduce((s,d)=>s+d*d,0)/distances.length),maximumPixels:Math.max(...distances),outline,rows};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log({...result,sources:undefined,outline:undefined,rows:undefined});
}finally{disposeObject3D(v.root);}
