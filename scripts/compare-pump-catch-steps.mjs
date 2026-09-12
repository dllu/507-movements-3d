import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makePumpCatchWeightedCandidate} from './lib/pump-catch-weighted-candidate.mjs';
import {readStudyReport,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const coarseFile=process.env.PROBE_COARSE??'artifacts/review/086-finite-rope-dynamics.json.gz',fineFile=process.env.PROBE_FINE??'artifacts/review/086-finite-rope-half-ms-dynamics.json.gz',
  prefix=process.env.PROBE_PREFIX??'artifacts/review/086-finite-rope-step-agreement',coarse=readStudyReport(coarseFile),fine=readStudyReport(fineFile);
verifyStudySources(coarse.sources);verifyStudySources(fine.sources);
assert.equal(coarse.angularSpeed,fine.angularSpeed,'Step comparison requires the same input speed');
assert.deepEqual(coarse.parameters,fine.parameters,'Step comparison requires the same geometry and physical parameters');
const model=makePumpCatchWeightedCandidate(coarse.parameters.candidateOptions),u=model.root.userData,P=u.geometry.pivot,radii={wheel:0,hook:0,pivot:Math.hypot(...P)},p=new THREE.Vector3();
for(const[name,mesh]of Object.entries(u.parts))if(['wheel','catch'].includes(u.families[name])){
  const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++){
    p.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
    const family=u.families[name]==='wheel'?'wheel':'hook',radius=family==='wheel'?Math.hypot(p.x,p.y):Math.hypot(p.x-P[0],p.y-P[1]);radii[family]=Math.max(radii[family],radius);
  }
}
const commonEnd=Math.min(coarse.actualEnd,fine.actualEnd),windows=[...new Set([.6,1.5,3,8,commonEnd])].filter(end=>end<=commonEnd).sort((a,b)=>a-b)
  .map(end=>({end,maximumPixels:0,maximumCoordinates:[0,0,0],worst:null,samples:0}));let index=1;
for(const row of fine.rows){
  if(row.time>coarse.actualEnd+1e-12)break;while(index<coarse.rows.length-1&&coarse.rows[index].time<row.time)index++;
  const a=coarse.rows[index-1],b=coarse.rows[index],f=(row.time-a.time)/(b.time-a.time),q=a.q.map((v,k)=>v+f*(b.q[k]-v)),delta=q.map((v,k)=>Math.abs(v-row.q[k])),
    wheel=2*radii.wheel*Math.abs(Math.sin(delta[0]/2)),hook=2*radii.pivot*Math.abs(Math.sin(delta[0]/2))+2*radii.hook*Math.abs(Math.sin(delta[1]/2)),pump=delta[2],pixels=240*Math.max(wheel,hook,pump);
  for(const w of windows)if(row.time<=w.end){w.samples++;for(let k=0;k<3;k++)w.maximumCoordinates[k]=Math.max(w.maximumCoordinates[k],delta[k]);
    if(pixels>w.maximumPixels){w.maximumPixels=pixels;w.worst={time:row.time,coarse:q,fine:row.q,wheel,hook,pump};}}
}
const sources=freezeStudySources([coarseFile,fineFile,'scripts/compare-pump-catch-steps.mjs',...coarse.sources.map(s=>s.file),...fine.sources.map(s=>s.file)],prefix);
const report={movement:86,status:'finite-rope-observed-step-agreement',passed:coarse.passed&&fine.passed&&Math.abs(coarse.actualEnd-fine.actualEnd)<1e-12&&windows.every(w=>w.maximumPixels<.25),
  mechanicsPassed:false,candidateIntegrated:false,coarseFile,fineFile,coarseStep:coarse.step,fineStep:fine.step,radii,windows,sources,
  qualification:'Fine knots compared with linearly interpolated coarse coordinates. Complete mesh radii bound rigid-body displacement; pump translation is included. Threshold is 0.25 engraving pixels. This is observed agreement between two discretizations, not a continuum-error guarantee or clearance proof.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
