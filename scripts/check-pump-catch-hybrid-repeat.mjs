import {readLargeRowStudyReport} from './lib/large-row-study-reader.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-ranked-hybrid-fine.json.gz',
  prefix=process.env.PROBE_PREFIX??'artifacts/review/086-ranked-hybrid-repeat',data=readLargeRowStudyReport(input),
  start=.5,period=8,maximum={q:0,v:0},worst={},seam={q:0,v:0},
  matchedMaximum={q:0,v:0},matchedWorst={},matching={snapped:0,interpolated:0,maximumTimeSnap:0};
verifyStudySources(data.sources);assert(data.passed&&data.actualEnd>=start+period);
const first=data.rows.find(r=>Math.abs(r.time-start)<1e-12),last=data.rows.find(r=>Math.abs(r.time-start-period)<1e-12);
assert(first&&last);
for(const key of ['q','v'])seam[key]=Math.max(...first[key].map((v,k)=>Math.abs(v-last[key][k])));
let index=1,samples=0;
for(const row of data.rows){
  const target=row.time+period;if(row.time<start||target>data.actualEnd)continue;
  while(index<data.rows.length-1&&data.rows[index].time<target)index++;
  const a=data.rows[index-1],b=data.rows[index],f=(target-a.time)/(b.time-a.time),
    nearest=Math.abs(a.time-target)<Math.abs(b.time-target)?a:b,
    timeError=Math.abs(nearest.time-target),snap=timeError<=8*Number.EPSILON*Math.max(1,target);
  matching[snap?'snapped':'interpolated']++;if(snap)matching.maximumTimeSnap=Math.max(matching.maximumTimeSnap,timeError);samples++;
  for(const key of ['q','v'])for(let k=0;k<3;k++){
    const interpolated=a[key][k]+f*(b[key][k]-a[key][k]),error=Math.abs(row[key][k]-interpolated);
    if(error>maximum[key]){maximum[key]=error;worst[key]={time:row.time,target,coordinate:k,first:row[key][k],interpolated,bracket:[a.time,b.time]};}
    const matched=snap?nearest[key][k]:interpolated,matchedError=Math.abs(row[key][k]-matched);
    if(matchedError>matchedMaximum[key]){matchedMaximum[key]=matchedError;matchedWorst[key]={time:row.time,target,coordinate:k,first:row[key][k],matched,snap,timeError};}
  }
}
const sources=freezeStudySources([input,'scripts/lib/large-row-study-reader.mjs','scripts/check-pump-catch-hybrid-repeat.mjs',...data.sources.map(s=>s.file)],prefix);
verifyStudySources(sources);
const report={movement:86,input,start,period,samples,seam,maximum,worst,matchedMaximum,matchedWorst,matching,sources,
  passed:matchedMaximum.q<1e-8&&matchedMaximum.v<1e-8,productionChanged:false,mechanicsPassed:false,
  qualification:'The original raw interpolated repeat differences remain reported. A timestamp within eight scaled machine epsilons of a stored knot is additionally matched directly, avoiding interpolation across an impact caused only by floating-point addition of the period. All other times retain linear interpolation. The 1e-8 coordinate and velocity thresholds are unchanged; this is not a continuous-clearance proof.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
