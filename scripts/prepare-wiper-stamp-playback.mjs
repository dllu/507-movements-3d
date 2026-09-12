import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {makeWiperStampPlayback} from './lib/wiper-stamp-playback.mjs';
import {readStudyReport,verifyStudySources,freezeStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/085-nine-second-eighth-ms.json.gz';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/085-first-playback';
const data=readStudyReport(input);verifyStudySources(data.sources);
const model=makeWiperStampCandidate(),u=model.root.userData,scale=u.source.scale,loopStart=1,end=5,period=4,tolerance=.0001/scale;
assert(data.duration>=9);const rows=data.rows.filter(r=>r.time<=end),loopIndex=rows.findIndex(r=>r.time===loopStart);
assert(loopIndex>0);const keep=new Set([0,loopIndex,rows.length-1]),stack=[[0,loopIndex],[loopIndex,rows.length-1]];
while(stack.length) {
  const[a,b]=stack.pop(),first=rows[a],last=rows[b];let worst=-1,error=0;
  for(let i=a+1;i<b;i++){const r=rows[i],f=(r.time-first.time)/(last.time-first.time),e=Math.abs(r.stampY-first.stampY-f*(last.stampY-first.stampY));if(e>error){error=e;worst=i;}}
  if(error>tolerance){keep.add(worst);stack.push([a,worst],[worst,b]);}
}
const first=rows[loopIndex],last=rows.at(-1);assert.equal(first.stampY,last.stampY);assert.equal(first.velocity,0);assert.equal(last.velocity,0);
const playback={movement:85,period,loopStart,end,angularSpeed:data.angularSpeed,camGuard:2e-7,compressionPixels:.0001,projectionLimitPixels:.002,
  scale,range:[u.geometry.minimumStampY,.12],knots:[...keep].sort((a,b)=>a-b).map(i=>[rows[i].time,rows[i].stampY]),
  qualification:'Retains the physical startup, followed by a four-second cycle whose endpoints rest on the striking bed. A bounded upward contact projection prevents interpolation from moving B into the cam. Continuous correction and hardware bounds are separate certificates.'};
const motion=makeWiperStampPlayback(model,playback),maximum={compression:0,projection:0,combined:0,recurrencePosition:0,recurrenceVelocity:0};
let checked=0,recurrenceStates=0;const failures=[];
for(let i=0;i<rows.length;i++)for(const f of i===rows.length-1?[0]:[0,.5]) {
  const r=rows[i],time=r.time+f*data.step,expected=r.stampY+f*((rows[i+1]?.stampY??r.stampY)-r.stampY),s=motion.sample(time);checked++;
  maximum.compression=Math.max(maximum.compression,Math.abs(s.interpolated-expected)*scale);
  maximum.projection=Math.max(maximum.projection,s.projection*scale);maximum.combined=Math.max(maximum.combined,Math.abs(s.stampY-expected)*scale);
  if(s.stampY<playback.range[0]-1e-12||s.stampY>playback.range[1]||s.projection*scale>.002)failures.push({kind:'sample',time,s});
}
for(const r of rows)if(r.time>=loopStart){const next=data.rows[Math.round((r.time+period)/data.step)];recurrenceStates++;
  maximum.recurrencePosition=Math.max(maximum.recurrencePosition,Math.abs(next.stampY-r.stampY)*scale);
  maximum.recurrenceVelocity=Math.max(maximum.recurrenceVelocity,Math.abs(next.velocity-r.velocity));}
if(maximum.compression>playback.compressionPixels+1e-10||maximum.recurrencePosition>.001)failures.push({kind:'bounds',maximum});
const output=prefix+'-data.json';fs.writeFileSync(output,JSON.stringify(playback)+'\n',{flag:'wx'});
const sources=freezeStudySources([input,'scripts/prepare-wiper-stamp-playback.mjs','scripts/lib/wiper-stamp-playback.mjs',...data.sources.map(s=>s.file)],prefix);
const report={movement:85,status:'compressed-startup-and-complete-repeat-study',passed:!failures.length,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,
  input,sourceStates:rows.length,knots:playback.knots.length,screenedPoses:checked,recurrenceStates,maximum,period,loopStart,end,
  seam:{position:first.stampY,velocity:first.velocity,bedDwellAtBothEnds:true,camAngleDifference:data.angularSpeed*period},
  output:{file:output,sha256:hashStudyFile(output)},sources,failures,
  qualification:'Scalar linear compression is bounded at all original knots. Knot/midpoint samples screen exact contact projection; a continuous bound is still required. Both complete four-second sampled cycles agree after startup, and the selected seam lies in bed dwell with zero velocity. The physical continuum and guide reactions are not independently solved.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,failures:failures.slice(0,4)});
if(!report.passed)process.exitCode=1;
