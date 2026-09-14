import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeMicrometerGeometry} from '../src/simulation/mujoco-micrometer/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {micrometerStudySources} from './lib/micrometer-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/111-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/111-source-a.json';
const sources=freezeStudySources([...micrometerStudySources('scripts/compare-micrometer-source.mjs'),input],prefix),measured=JSON.parse(fs.readFileSync(input)),v=makeMicrometerGeometry(),u=v.root.userData,f=u.profile;
const stats=a=>({count:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),maximum:Math.max(...a.map(Math.abs))});
try {
 const boxes=Object.fromEntries(Object.entries(u.parts).map(([n,m])=>[n,new THREE.Box3().setFromObject(m,true)]));
 const mapping={outerCoreLeft:['sleeve','min','x'],outerCoreRight:['sleeve','max','x'],outerTop:['head','max','y'],outerBottom:['sleeve','min','y'],innerCoreLeft:['innerCore','min','x'],innerCoreRight:['innerCore','max','x'],innerBottom:['tip','min','y'],outerCrestLeft:['outerThread','min','x'],outerCrestRight:['outerThread','max','x'],innerCrestLeft:['innerThread','min','x'],innerCrestRight:['innerThread','max','x']},edges={};
 for(const [name,r]of Object.entries(measured.edges)) {
  const [part,side,axis]=mapping[name],world=boxes[part][side][axis],actual=axis==='x'?f.axis[0]+100*world:f.axis[1]-100*world,residuals=r.points.map(p=>actual-p[r.axis]);edges[name]={actual,residuals,...stats(residuals)};
 }
 const threads={};
 for(const name of ['outer','inner']) {
  const g=u.parts[name+'Thread'].geometry,p=g.attributes.position,n=g.attributes.normal,t=f[name],pitch=t.lead*2*Math.PI,segments=[];
  for(let i=0;i<p.count;i+=3) {
   if(Math.abs(n.getZ(i))<.5)continue;const side=n.getZ(i)>0?0:1;
   const points=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)]).filter(q=>Math.abs(Math.hypot(q[0],q[1])-t.outer)<1e-7&&q[1]<1e-8);
   if(points.length!==2||Math.abs(points[0][0]-points[1][0])<1e-10)continue;
   const a=points[0],b=points[1],angle=q=>{const z=Math.atan2(q[1],q[0]);return z>1e-8?z-2*Math.PI:z;},mid=(angle(a)+angle(b))/2;
   const turn=Math.round((t.phase+t.lead*mid+(side===0?1:-1)*t.width/2-(a[2]+b[2])/2)/pitch);
   segments.push({side,turn,a:[f.axis[0]+a[0]*100,f.axis[1]-a[2]*100],b:[f.axis[0]+b[0]*100,f.axis[1]-b[2]*100]});
  }
  const residuals=[];
  for(const p of measured.threads[name].points) {
   const hits=segments.filter(s=>s.side===p.side&&s.turn===p.turn&&p.x>=Math.min(s.a[0],s.b[0])-1e-8&&p.x<=Math.max(s.a[0],s.b[0])+1e-8).map(s=>s.a[1]+(p.x-s.a[0])*(s.b[1]-s.a[1])/(s.b[0]-s.a[0]));
   assert(hits.length,'Missing rendered flank for '+JSON.stringify({name,...p}));residuals.push(hits.reduce((a,b)=>Math.abs(a-p.y)<Math.abs(b-p.y)?a:b)-p.y);
  }
  threads[name]={residuals,...stats(residuals)};
 }
 const report={sources,edges,allEdges:stats(Object.values(edges).flatMap(r=>r.residuals)),threads,qualification:'Actual transformed mesh extents and front crest/flank triangle edges compared with assigned ink readings. The inner thread hand is deliberately corrected; its source discrepancy is reported, not hidden by a nearest-turn match.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({allEdges:report.allEdges,threads:Object.fromEntries(Object.entries(threads).map(([n,r])=>[n,{count:r.count,rms:r.rms,maximum:r.maximum}]))});
}finally{disposeObject3D(v.root);}
