import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {readLargeRowStudyReport} from './lib/large-row-study-reader.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/086-combined-continuous-rigid-agreement',files=['artifacts/review/086-ranked-hybrid-fine.json.gz',
  'artifacts/review/086-geometric-hybrid-coarse.json.gz','artifacts/review/086-tighter-hybrid-compressed-motion.json'],
  profiles=files.map(f=>f.endsWith('.gz')?readLargeRowStudyReport(f):readStudyReport(f)),fine=profiles[0],
  model=makePumpCatchCompleteCandidate(),u=model.root.userData,P=u.geometry.pivot,
  radii={wheel:0,catch:0,pivot:Math.hypot(...P)},point=new THREE.Vector3();
for(const profile of profiles){assert(profile.passed);verifyStudySources(profile.sources);
  assert.deepEqual(profile.parameters,fine.parameters);assert.equal(profile.angularSpeed,fine.angularSpeed);}
for(const[name,mesh]of Object.entries(u.parts))if(['wheel','catch'].includes(u.families[name])){
  const family=u.families[name],p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
    radii[family]=Math.max(radii[family],family==='wheel'?Math.hypot(point.x,point.y):Math.hypot(point.x-P[0],point.y-P[1]));
  }
}
const thresholdPixels=.25,end=fine.rows.at(-1).time,indices=[1,1,1],maximum={combined:0,step:0,compression:0},worst={};
for(const profile of profiles){assert.equal(profile.rows[0].time,0);assert.equal(profile.rows.at(-1).time,end);}
const qAt=(rows,i,t)=>{const a=rows[i-1],b=rows[i],f=(t-a.time)/(b.time-a.time);return a.q.map((v,k)=>v+f*(b.q[k]-v));},
  error=(a,b)=>{const d=a.map((v,k)=>Math.abs(v-b[k]));return 240*Math.max(radii.wheel*d[0],radii.pivot*d[0]+radii.catch*d[1],d[2]);};
let time=0,intervals=0;
while(time<end){
  for(let k=0;k<3;k++)while(indices[k]<profiles[k].rows.length-1&&profiles[k].rows[indices[k]].time<=time)indices[k]++;
  const next=Math.min(...profiles.map((p,k)=>p.rows[indices[k]].time));assert(next>time);
  for(const t of [time,next]){
    const q=profiles.map((p,k)=>qAt(p.rows,indices[k],t)),step=error(q[0],q[1]),compression=error(q[0],q[2]),combined=step+compression;
    for(const[key,value]of Object.entries({step,compression,combined}))if(value>maximum[key]){maximum[key]=value;worst[key]={time:t,step,compression,combined,q};}
  }
  time=next;intervals++;
}
const sources=freezeStudySources([...files,'scripts/check-pump-catch-combined-rigid-agreement.mjs','scripts/lib/large-row-study-reader.mjs',...pumpCatchCompleteSources],prefix);
verifyStudySources(sources);
const report={movement:86,passed:maximum.combined<thresholdPixels,thresholdPixels,end,intervals,radii,maximum,worst,sources,
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  qualification:'The union of all three knot sets makes every pose coordinate linear on each interval. Weighted absolute-angle/translation error bounds are convex, so endpoint maxima cover every instant. The local sum of fine/coarse and fine/display bounds stays below the unchanged 0.25-pixel target. Actual wheel and catch mesh radii supply displacement coefficients; identical input motion and fixed parts contribute zero. Rope deformation is covered separately. This is agreement between numerical/display profiles, not exact continuum error.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
