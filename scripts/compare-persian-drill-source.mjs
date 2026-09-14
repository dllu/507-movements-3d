import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePersianDrillGeometry} from '../src/simulation/mujoco-persian-drill/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {persianDrillStudySources} from './lib/persian-drill-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/112-comparison',input=process.env.SOURCE_REPORT??'/dev/shm/112-source-c.json',options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const sources=freezeStudySources([...persianDrillStudySources('scripts/compare-persian-drill-source.mjs'),'tests/helpers/solid-surface.mjs',input],prefix),measured=JSON.parse(fs.readFileSync(input)),v=makePersianDrillGeometry(options),u=v.root.userData,f=u.profile;
const stats=a=>({count:a.length,rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),maximum:Math.max(...a.map(Math.abs))});
try {
 const boxes=Object.fromEntries(Object.entries(u.parts).map(([n,m])=>[n,new THREE.Box3().setFromObject(m,true)])),stock=new THREE.Box3();for(let i=0;i<6;i++)stock.union(boxes['stockThread'+i]);boxes.stock=stock;
 const mapping={stockLeft:['stock','min','x'],stockRight:['stock','max','x'],stockTop:['stock','max','y'],stockBottom:['stock','min','y'],headTop:['head','max','y'],headBottom:['head','min','y'],gripTop:['grip','max','y'],gripBottom:['grip','min','y'],chuckTop:['chuck','max','y'],chuckBottom:['chuck','min','y'],bitLeft:['bit','min','x'],bitRight:['bit','max','x']},edges={};
 for(const [name,r]of Object.entries(measured.edges)) {
  const [part,side,axis]=mapping[name],world=boxes[part][side][axis],actual=axis==='x'?f.axis[0]+100*world:f.axis[1]-100*world,residuals=r.points.map(p=>actual-p[r.axis]);edges[name]={actual,residuals,...stats(residuals)};
 }
 const profiles={};
 for(const [name,rows]of Object.entries(measured.profiles)) {
  const m=u.parts[name],triangles=surfaceTriangles(m.geometry).map(t=>[t.a,t.b,t.c].map(p=>p.applyMatrix4(m.matrixWorld))),readings=[],residuals=[];
  for(const row of rows) {
   const yy=f.y(row.y),xs=[];
   for(const t of triangles)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3];if((a.y<=yy&&b.y>=yy)||(b.y<=yy&&a.y>=yy)){if(Math.abs(a.y-b.y)>1e-10)xs.push(a.x+(b.x-a.x)*(yy-a.y)/(b.y-a.y));}}
   assert(xs.length,name+' has no surface at source row '+row.y);const actual=[f.axis[0]+100*Math.min(...xs),f.axis[0]+100*Math.max(...xs)];
   residuals.push(actual[0]-row.left,actual[1]-row.right);readings.push({y:row.y,actual,source:[row.left,row.right]});
  }profiles[name]={readings,residuals,...stats(residuals)};
 }
 const segments=[];
 for(let start=0;start<f.external.length;start++) {
  const g=u.parts['stockThread'+start].geometry,p=g.attributes.position,n=g.attributes.normal;
  for(let i=0;i<p.count;i+=3) {
   if(n.getZ(i)>-.5)continue;
   const points=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)-f.groove/2]).filter(q=>Math.abs(Math.hypot(q[0],q[1])-f.crest)<1e-7&&q[1]<1e-8);
   if(points.length!==2||Math.abs(points[0][0]-points[1][0])<1e-10)continue;
   const [a,b]=points,angle=q=>{const z=Math.atan2(q[1],q[0]);return z>1e-8?z-2*Math.PI:z;},mid=(angle(a)+angle(b))/2;
   const turn=Math.round((f.groovePhase+f.lead*mid-(a[2]+b[2])/2)/f.pitch);
   segments.push({turn,a:[f.axis[0]+100*a[0],f.axis[1]-100*a[2]],b:[f.axis[0]+100*b[0],f.axis[1]-100*b[2]]});
  }
 }
 const residuals=[];
 for(const p of measured.thread.points) {
  const hits=segments.filter(s=>s.turn===p.turn&&p.x>=Math.min(s.a[0],s.b[0])-1e-8&&p.x<=Math.max(s.a[0],s.b[0])+1e-8).map(s=>s.a[1]+(p.x-s.a[0])*(s.b[1]-s.a[1])/(s.b[0]-s.a[0]));
  assert(hits.length,'Missing rendered groove for '+JSON.stringify(p));residuals.push(hits.reduce((a,b)=>Math.abs(a-p.y)<Math.abs(b-p.y)?a:b)-p.y);
 }
 const report={sources,options,edges,allEdges:stats(Object.values(edges).flatMap(r=>r.residuals)),profiles,allProfiles:stats(Object.values(profiles).flatMap(r=>r.residuals)),thread:{residuals,...stats(residuals)},qualification:'Actual transformed mesh extents and horizontal surface intersections; assigned groove bands measured from rendered crest/flank edges shifted by the inferred half groove width. Source asymmetry is corrected by coaxial turned solids and a centered flat bit.'};
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({allEdges:report.allEdges,allProfiles:report.allProfiles,profiles:Object.fromEntries(Object.entries(profiles).map(([n,r])=>[n,{count:r.count,rms:r.rms,maximum:r.maximum}])),thread:report.thread});
}finally{disposeObject3D(v.root);}
