import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readLargeRowStudyReport} from './lib/large-row-study-reader.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';
import {makePumpCatchRopeDisplacement} from './lib/pump-catch-rope-displacement.mjs';

const fineFile='artifacts/review/086-ranked-hybrid-fine.json.gz',coarseFile='artifacts/review/086-geometric-hybrid-coarse.json.gz',
  displayFile='artifacts/review/086-tighter-hybrid-compressed-motion.json',
  prefix=process.env.PROBE_PREFIX??'artifacts/review/086-combined-continuous-rope-agreement',
  fine=readLargeRowStudyReport(fineFile),coarse=readLargeRowStudyReport(coarseFile),display=readStudyReport(displayFile),
  profiles=[fine,coarse,display],thresholdPixels=.25;
for(const p of profiles){assert(p.passed);assert.equal(p.angularSpeed,fine.angularSpeed);assert.deepEqual(p.parameters,fine.parameters);verifyStudySources(p.sources);}
const sources=freezeStudySources([fineFile,coarseFile,displayFile,'scripts/check-pump-catch-combined-rope-agreement.mjs',
  'scripts/lib/pump-catch-rope-displacement.mjs','scripts/lib/large-row-study-reader.mjs','scripts/lib/study-report-io.mjs',
  'scripts/lib/pump-catch-rope-mesh.mjs','scripts/lib/pump-catch-rope.mjs'],prefix),
  bound=makePumpCatchRopeDisplacement({R:fine.parameters.radius}),trace=[],failures=[],
  stats={unionIntervals:0,certified:0,subdivisions:0,maximumDepth:0,maximumPixels:0,maximumStepPixels:0,maximumCompressionPixels:0},
  indices=[1,1,1],end=fine.rows.at(-1).time;
for(const p of profiles){assert.equal(p.rows.at(-1).time,end);assert.equal(p.rows[0].time,0);}
let time=0,worst=null;
const qAt=(rows,i,t)=>{const a=rows[i-1],b=rows[i],f=(t-a.time)/(b.time-a.time);return a.q.map((v,k)=>v+f*(b.q[k]-v));},
  mid=(a,b)=>a.map((v,k)=>(v+b[k])/2);
function certify(lo,hi,starts,ends,depth=0){
  stats.maximumDepth=Math.max(stats.maximumDepth,depth);
  const step=bound.interval(starts[0],ends[0],starts[1],ends[1]),compression=bound.interval(starts[0],ends[0],starts[2],ends[2]),
    stepPixels=240*step.displacement,compressionPixels=240*compression.displacement,pixels=stepPixels+compressionPixels;
  if(pixels>=thresholdPixels){
    if(depth>=24||hi-lo<1e-12){failures.push({lo,hi,starts,ends,pixels,stepPixels,compressionPixels,step,compression});return false;}
    stats.subdivisions++;const t=(lo+hi)/2,middle=starts.map((q,k)=>mid(q,ends[k]));
    return certify(lo,t,starts,middle,depth+1)&&certify(t,hi,middle,ends,depth+1);
  }
  stats.certified++;stats.maximumStepPixels=Math.max(stats.maximumStepPixels,stepPixels);
  stats.maximumCompressionPixels=Math.max(stats.maximumCompressionPixels,compressionPixels);
  if(pixels>stats.maximumPixels){stats.maximumPixels=pixels;worst={lo,hi,pixels,stepPixels,compressionPixels,step,compression};}
  trace.push({lo,hi,pixels,stepPixels,compressionPixels,depth});return true;
}
while(time<end){
  for(let k=0;k<3;k++)while(indices[k]<profiles[k].rows.length-1&&profiles[k].rows[indices[k]].time<=time)indices[k]++;
  const next=Math.min(...profiles.map((p,k)=>p.rows[indices[k]].time));assert(next>time);stats.unionIntervals++;
  const starts=profiles.map((p,k)=>qAt(p.rows,indices[k],time)),ends=profiles.map((p,k)=>qAt(p.rows,indices[k],next));
  if(!certify(time,next,starts,ends))break;
  time=next;if(stats.unionIntervals%64000===0)console.log({time,...stats});
}
verifyStudySources(sources);
const report={movement:86,status:'combined-continuous-step-and-compression-rope-bound',passed:!failures.length&&time===end,
  fineFile,coarseFile,displayFile,thresholdPixels,end,verifiedThrough:time,stats,worst,failures,parameters:bound.parameters,argument:bound.argument,sources,
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  qualification:'For every common interval, sum the full polygonal-tube step-agreement and compression displacement bounds before applying the unchanged 0.25-pixel target. The triangle inequality supplies the combined bound at every instant, including mesh interpolation and Float32 allowances for both comparisons. Global maxima at different instants are not substituted for this local sum. This compares supplied numerical/display profiles, not exact continuum dynamics.'};
const packed=await writeGzipStudyReport(prefix+'-trace.json.gz',{...report,rows:trace});
fs.writeFileSync(prefix+'.json',JSON.stringify({...report,trace:{file:prefix+'-trace.json.gz',...packed}},null,2)+'\n',{flag:'wx'});
console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
