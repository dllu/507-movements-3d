import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readLargeRowStudyReport} from './lib/large-row-study-reader.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';
import {makePumpCatchRopeDisplacement} from './lib/pump-catch-rope-displacement.mjs';

const fineFile=process.env.PROBE_FINE??'artifacts/review/086-ranked-hybrid-fine.json.gz',
  otherFile=process.env.PROBE_OTHER??'artifacts/review/086-first-hybrid-compressed-motion.json',
  prefix=process.env.PROBE_PREFIX??'artifacts/review/086-continuous-compression-rope-agreement',
  thresholdPixels=Number(process.env.PROBE_PIXELS??.025),
  read=file=>file.endsWith('.gz')?readLargeRowStudyReport(file):readStudyReport(file),fine=read(fineFile),other=read(otherFile);
assert(fine.passed&&other.passed&&thresholdPixels>0);
assert.equal(fine.angularSpeed,other.angularSpeed);assert.deepEqual(fine.parameters,other.parameters);
verifyStudySources(fine.sources);verifyStudySources(other.sources);
const sources=freezeStudySources([fineFile,otherFile,'scripts/check-pump-catch-continuous-rope-agreement.mjs',
  'scripts/lib/pump-catch-rope-displacement.mjs','scripts/lib/large-row-study-reader.mjs','scripts/lib/study-report-io.mjs',
  'scripts/lib/pump-catch-rope-mesh.mjs','scripts/lib/pump-catch-rope.mjs'],prefix),
  bound=makePumpCatchRopeDisplacement({R:fine.parameters.radius}),trace=[],failures=[],
  stats={unionIntervals:0,certified:0,subdivisions:0,maximumDepth:0,quiet:0,maximumPixels:0};
let worst=null,indexA=1,indexB=1,time=0;
const qAt=(rows,i,t)=>{const a=rows[i-1],b=rows[i],f=(t-a.time)/(b.time-a.time);return a.q.map((v,k)=>v+f*(b.q[k]-v));},
  mid=(a,b)=>a.map((v,k)=>(v+b[k])/2),end=fine.rows.at(-1).time;
assert.equal(end,other.rows.at(-1).time);assert.equal(fine.rows[0].time,0);assert.equal(other.rows[0].time,0);
function certify(lo,hi,a0,a1,b0,b1,depth=0){
  stats.maximumDepth=Math.max(stats.maximumDepth,depth);const result=bound.interval(a0,a1,b0,b1),pixels=240*result.displacement;
  if(pixels>=thresholdPixels){
    if(depth>=24||hi-lo<1e-12){failures.push({lo,hi,a0,a1,b0,b1,pixels,result});return false;}
    stats.subdivisions++;const t=(lo+hi)/2,am=mid(a0,a1),bm=mid(b0,b1);
    return certify(lo,t,a0,am,b0,bm,depth+1)&&certify(t,hi,am,a1,bm,b1,depth+1);
  }
  stats.certified++;if(result.a.quiet&&result.b.quiet)stats.quiet++;
  if(pixels>stats.maximumPixels){stats.maximumPixels=pixels;worst={lo,hi,pixels,result};}
  trace.push({lo,hi,pixels,depth});return true;
}
while(time<end){
  while(indexA<fine.rows.length-1&&fine.rows[indexA].time<=time)indexA++;
  while(indexB<other.rows.length-1&&other.rows[indexB].time<=time)indexB++;
  const next=Math.min(fine.rows[indexA].time,other.rows[indexB].time);assert(next>time);stats.unionIntervals++;
  if(!certify(time,next,qAt(fine.rows,indexA,time),qAt(fine.rows,indexA,next),qAt(other.rows,indexB,time),qAt(other.rows,indexB,next)))break;
  time=next;if(stats.unionIntervals%64000===0)console.log({time,...stats});
}
verifyStudySources(sources);
const report={movement:86,status:'continuous-polygonal-rope-displacement-bound',passed:!failures.length&&time===end,
  fineFile,otherFile,thresholdPixels,end,verifiedThrough:time,stats,worst,failures,parameters:bound.parameters,argument:bound.argument,sources,
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  qualification:'Bounds cover every common linear pose interval and all tube triangle interiors, including section-count changes and Float32 rounding. They compare two supplied numerical/display profiles; they do not establish exact continuum dynamics. Each accepted subinterval is retained in the compressed trace.'};
const packed=await writeGzipStudyReport(prefix+'-trace.json.gz',{...report,rows:trace});
fs.writeFileSync(prefix+'.json',JSON.stringify({...report,trace:{file:prefix+'-trace.json.gz',...packed}},null,2)+'\n',{flag:'wx'});
console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
