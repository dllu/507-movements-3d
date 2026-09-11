import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackPlayback} from './lib/spring-rack-playback-study.mjs';
const input='artifacts/review/081-interval-finer-dynamics.json',data=JSON.parse(fs.readFileSync(input)),
 candidate=makeSpringRackCandidate(data.geometry),u=candidate.root.userData,scale=u.geometry.source.scale,
 rows=data.rows.filter(r=>r.time<=4),tolerance=.0005/scale,loopIndex=rows.findIndex(r=>r.time===2),
 keep=new Set([0,loopIndex,rows.length-1]),stack=[[0,loopIndex],[loopIndex,rows.length-1]];
while(stack.length){
 const [a,b]=stack.pop(),first=rows[a],last=rows[b];let worst=-1,error=0;
 for(let i=a+1;i<b;i++){
  const r=rows[i],f=(r.time-first.time)/(last.time-first.time),e=Math.abs(r.x[0]-first.x[0]-f*(last.x[0]-first.x[0]));
  if(e>error){error=e;worst=i;}
 }
 if(error>tolerance){keep.add(worst);stack.push([a,worst],[worst,b]);}
}
const selected=[...keep].sort((a,b)=>a-b),playback={movement:81,status:'isolated-compressed-spring-rack-playback',geometry:data.geometry,
 parameters:data.parameters,range:[Math.min(...rows.map(r=>r.x[0])),Math.max(...rows.map(r=>r.x[0]))],loopStart:2,end:4,
 displayPeriod:4,knots:selected.map(i=>[rows[i].time,rows[i].x[0]]),sourcePixelCompressionTolerance:tolerance*scale},
 motion=makeSpringRackPlayback(candidate,playback),checks=[],maximum={compressionPixels:0,projectionPixels:0,combinedPixels:0},issues=[];
let minimumGap=Infinity,maximumSeamDifference=0;
// Union knots certify scalar linear interpolation compression. Interior
// samples screen the exact-clearance projection and its correction size.
for(let i=0;i<rows.length;i++)for(const fraction of i===rows.length-1?[0]:[0,.5]){
 const time=rows[i].time+fraction*data.dt,expected=rows[i].x[0]+fraction*((rows[i+1]?.x[0]??rows[i].x[0])-rows[i].x[0]),r=motion.sample(2*time),
  gap=motion.contact.pair(r.q,r.rackY,0).minimumGap,compression=Math.abs(r.interpolated-expected)*scale,combined=Math.abs(r.rackY-expected)*scale;
 minimumGap=Math.min(minimumGap,gap);maximum.compressionPixels=Math.max(maximum.compressionPixels,compression);
 maximum.projectionPixels=Math.max(maximum.projectionPixels,r.projection*scale);maximum.combinedPixels=Math.max(maximum.combinedPixels,combined);
 if(gap< -1e-6||combined>.001)issues.push({time,gap,combined,r});
 if(i%1600===0&&fraction===0)checks.push({time,...r,gap});
}
for(let i=0;i<=100;i++){
 const t=4+i*.04,a=motion.sample(t),b=motion.sample(t+4);maximumSeamDifference=Math.max(maximumSeamDifference,Math.abs(a.rackY-b.rackY));
}
if(maximumSeamDifference>1e-10)issues.push({kind:'settled-loop-seam',maximumSeamDifference});
const prefix=process.env.PROBE_PREFIX??'artifacts/review/081-seamed-playback',hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 output=prefix+'-data.json';fs.writeFileSync(output,JSON.stringify(playback)+'\n',{flag:'wx'});
const sources=['scripts/prepare-spring-rack-playback.mjs','scripts/lib/spring-rack-playback-study.mjs','scripts/lib/spring-rack-contact-study.mjs',
 'scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-coil.mjs','scripts/lib/spring-rack-source.mjs',input].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
});
const report={movement:81,status:'isolated-projected-playback-screen',productionChanged:false,mechanicsPassed:false,passed:issues.length===0,
 sourceStates:rows.length,knots:playback.knots.length,displayPeriod:4,screenedPoses:2*rows.length-1,maximum,minimumGap,maximumSeamDifference,
 checks,issues,output:{file:output,sha256:hash(output)},sources,
 qualification:'Compression error is bounded at all original knots; exact vertical obstacle projection with a 2e-7 guard enforces finite gear/rack clearance at every evaluation. Original knots plus interval midpoints screen correction size. A complete independent fan-to-rendered-mesh correspondence and full continuous correction bound remain pending. Physical startup is retained; after eight display seconds the settled four-second cycle repeats. Spring vertex displacement and browser performance are separate checks.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,sourceStates:rows.length,knots:playback.knots.length,maximum,minimumGap,maximumSeamDifference,issues:issues.slice(0,5)});
if(!report.passed)process.exitCode=1;
