import {readLargeRowStudyReport} from './lib/large-row-study-reader.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pumpCatchRopeCenterline} from './lib/pump-catch-rope-mesh.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {verifyPumpCatchStudySources} from './lib/pump-catch-study-sources.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-rope-agreement',coarseFile=process.env.PROBE_SKIP_STEP==='1'?null:(process.env.PROBE_COARSE??'artifacts/review/086-complete-eighth-ms.json.gz'),
  fineFile=process.env.PROBE_FINE??'artifacts/review/086-complete-sixteenth-ms.json.gz',compressedFile=process.env.PROBE_SKIP_COMPRESSION==='1'?null:(process.env.PROBE_COMPRESSED??'artifacts/review/086-first-compressed-motion.json'),
  coarse=coarseFile?readLargeRowStudyReport(coarseFile):null,fine=readLargeRowStudyReport(fineFile),compressed=compressedFile?readStudyReport(compressedFile):null,
  R=fine.parameters.radius,r=.0625,L=fine.parameters.ropeLength,weights=Array.from({length:257},(_,i)=>(i===0||i===256?1:i%2?4:2)/768),
  sin=weights.map((_,i)=>Math.sin(2*Math.PI*i/256)),thetaMax=.178,minimumLeadSpeed=.25*Math.cos(thetaMax),
  leadCoefficient=R+1/12+r*(3*R*Math.sin(thetaMax)+.25)/minimumLeadSpeed;
if(coarse)verifyPumpCatchStudySources(coarse.sources);verifyStudySources(fine.sources);if(compressed)verifyStudySources(compressed.sources);
// Independent scalar evaluation of the same positive-weight quadratures.
// The reference mesh routine below checks this evaluator at selected poses.
function fields(q){
  const theta=q[0],D=3.7-q[2],s=Math.sin(theta),c=Math.cos(theta);let lead=.25;
  if(theta>1e-7){
    lead=0;for(let i=0;i<=256;i++){
      const t=i/256,v=1-t,x=v*v*.25*s+2*v*t*(3*R*(c-1)-s/4),y=-v*v*.25*c+2*v*t*(-.5+c/4)-t*t*.25;
      lead+=weights[i]*Math.hypot(x,y);
    }
  }
  const vertical=L-q[2]-.25-(theta>0?R*s:0),arc=theta<0?-R*theta:0,target=L-arc-lead;
  let A=0;
  if(target-vertical>=1e-12){
    const length=a=>{let value=vertical-D;for(let i=0;i<=256;i++)value+=weights[i]*Math.hypot(D,a*Math.PI*sin[i]);return value;};
    let lo=0,hi=.25;while(length(hi)<target)hi*=2;
    for(let k=0;k<42;k++){const mid=(lo+hi)/2;if(length(mid)>target)hi=mid;else lo=mid;}A=(lo+hi)/2;
  }
  return{A,D,lead};
}
const reference=[];
for(let i=0;i<fine.rows.length;i+=2048){
  const row=fine.rows[i],f=fields(row.q),m=pumpCatchRopeCenterline(row.q,{radius:R,ropeLength:L}),error=Math.abs(f.A-m.amplitude);
  assert(error<2e-7,'Independent quadrature amplitude agreement');reference.push({time:row.time,amplitudeError:error,leadError:Math.abs(f.lead-m.leadLength)});
}
const comparisons=[...(coarse?[{name:'time-step',data:coarse,maximumPixels:0,worst:null,maximumFrontPixels:0,frontWorst:null}]:[]),
  ...(compressed?[{name:'compression',data:compressed,maximumPixels:0,worst:null,maximumFrontPixels:0,frontWorst:null}]:[])];
assert(comparisons.length,'At least one comparison is required');
for(const comparison of comparisons){
  const rows=comparison.data.rows;let index=1;
  for(let i=0;i<fine.rows.length;i++){
    const row=fine.rows[i];while(index<rows.length-1&&rows[index].time<row.time)index++;
    const a=rows[index-1],b=rows[index],fraction=(row.time-a.time)/(b.time-a.time),q=a.q.map((v,k)=>v+fraction*(b.q[k]-v)),
      f=fields(row.q),g=fields(q),dy=Math.abs(q[2]-row.q[2]),dtheta=Math.abs(q[0]-row.q[0]),
      section=r*Math.PI*Math.abs(f.A/f.D-g.A/g.D),bow=Math.hypot(dy,f.A-g.A)+section,upper=leadCoefficient*dtheta,pixels=240*Math.max(bow,upper,dy),
      frontPixels=240*Math.max(dy+section,upper);
    if(pixels>comparison.maximumPixels){comparison.maximumPixels=pixels;comparison.worst={time:row.time,bow,upper,dy,fine:f,other:g,q,fineQ:row.q};}
    if(frontPixels>comparison.maximumFrontPixels){comparison.maximumFrontPixels=frontPixels;comparison.frontWorst={time:row.time,section,upper,dy};}
    if(i%64000===0)console.log({comparison:comparison.name,states:i,maximumPixels:comparison.maximumPixels});
  }
  delete comparison.data;
}
const sources=freezeStudySources([...(coarseFile?[coarseFile]:[]),fineFile,'scripts/lib/large-row-study-reader.mjs',...(compressedFile?[compressedFile]:[]),'scripts/study-pump-catch-rope-agreement.mjs',
  'scripts/lib/pump-catch-rope-mesh.mjs','scripts/lib/pump-catch-rope.mjs','scripts/lib/pump-catch-study-sources.mjs','scripts/lib/study-report-io.mjs'],prefix);
verifyStudySources(sources);const report={movement:86,passed:comparisons.every(c=>c.maximumPixels<.25),comparisons,reference,sources,leadCoefficient,
  qualification:'Diagnostic surface-displacement bounds at every finest trajectory knot. The pass flag retains the full 3D 0.25-pixel target; projected front-view errors are reported separately. Bow centers use height/amplitude differences and circular-section rotation uses the atan slope Lipschitz bound. Upper lead uses Bernstein control-point and tangent bounds. This does not yet bound nonlinear display differences between time knots, Float32 rounding or changes in arc tessellation.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,reference:reference.length,sources:undefined});if(!report.passed)process.exitCode=1;
