import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchPrimaryBounds} from './lib/pump-catch-primary-bounds.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {verifyPumpCatchStudySources} from './lib/pump-catch-study-sources.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-complete-sixteenth-ms.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-compressed-motion',data=readStudyReport(input),
  nonmechanicalChanges=verifyPumpCatchStudySources(data.sources),pixelTolerance=Number(process.env.PROBE_PIXELS??.002),model=makePumpCatchCompleteCandidate(),u=model.root.userData,
  bounds=makePumpCatchPrimaryBounds(model),radii={wheel:0,catch:0,pivot:Math.hypot(...u.geometry.pivot)},sources=freezeStudySources([input,'scripts/compress-pump-catch-motion.mjs',
    'scripts/lib/pump-catch-primary-bounds.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/pump-catch-study-sources.mjs',...pumpCatchCompleteSources],prefix);
assert(data.passed&&pixelTolerance>0&&pixelTolerance<.1);
for(const[name,mesh]of Object.entries(u.parts))if(['wheel','catch'].includes(u.families[name])){
  const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){
    const x=p.getX(i)+mesh.position.x,y=p.getY(i)+mesh.position.y;radii[u.families[name]]=Math.max(radii[u.families[name]],Math.hypot(x,y));
  }
}
const error=(a,b)=>{const d=a.map((v,k)=>Math.abs(v-b[k]));return u.source.scale*Math.max(radii.wheel*d[0],radii.pivot*d[0]+radii.catch*d[1],d[2]);},
  kept=new Set([0,data.rows.length-1]),stack=[],failures=[],certified=[],stats={geometrySplits:0,errorSplits:0,testedIntervals:0,maximumDepth:0},mandatory=[.5,8.5];
for(const time of mandatory){const i=data.rows.findIndex(r=>Math.abs(r.time-time)<1e-12);assert(i>=0);kept.add(i);}
const seeds=[...kept].sort((a,b)=>a-b);for(let i=1;i<seeds.length;i++)stack.push([seeds[i-1],seeds[i],0]);
while(stack.length){
  const [lo,hi,depth]=stack.pop(),a=data.rows[lo],b=data.rows[hi],dt=b.time-a.time;let maximum=0,worst=-1;stats.maximumDepth=Math.max(stats.maximumDepth,depth);
  for(let i=lo+1;i<hi;i++){
    const row=data.rows[i],f=(row.time-a.time)/dt,q=a.q.map((v,k)=>v+f*(b.q[k]-v)),e=error(row.q,q);
    if(e>maximum){maximum=e;worst=i;}
  }
  if(maximum>pixelTolerance){stats.errorSplits++;kept.add(worst);stack.push([lo,worst,depth+1],[worst,hi,depth+1]);continue;}
  stats.testedIntervals++;const result=bounds.interval(a,b,data.angularSpeed);
  if(!result.passed){
    if(hi===lo+1){failures.push({lo,hi,...result.failures[0]});break;}
    const middle=Math.floor((lo+hi)/2);kept.add(middle);stats.geometrySplits++;stack.push([lo,middle,depth+1],[middle,hi,depth+1]);continue;
  }
  certified.push({lo,hi,maximumErrorPixels:maximum,stats:result.stats});
  if(certified.length%500===0)console.log({certified:certified.length,pending:stack.length,kept:kept.size,...stats});
}
const indices=[...kept].sort((a,b)=>a-b),rows=indices.map(i=>({time:data.rows[i].time,q:data.rows[i].q})),repeat={start:.5,period:8,coordinateError:0,velocityError:0};
const offset=Math.round(repeat.period/data.step);for(let i=Math.round(repeat.start/data.step);i+offset<data.rows.length;i++)for(let k=0;k<3;k++){
  repeat.coordinateError=Math.max(repeat.coordinateError,Math.abs(data.rows[i].q[k]-data.rows[i+offset].q[k]));
  repeat.velocityError=Math.max(repeat.velocityError,Math.abs(data.rows[i].v[k]-data.rows[i+offset].v[k]));
}
assert(repeat.coordinateError<1e-8&&repeat.velocityError<1e-8,'Repeat requires observed matching states and velocities');
verifyStudySources(sources);const report={movement:86,status:'compressed-motion-with-continuous-prism-bounds',passed:!failures.length&&certified.length===rows.length-1,
  input,pixelTolerance,radii,maximumErrorPixels:certified.reduce((s,c)=>Math.max(s,c.maximumErrorPixels),0),originalStates:data.rows.length,states:rows.length,
  duration:data.duration,actualEnd:data.actualEnd,angularSpeed:data.angularSpeed,parameters:data.parameters,repeat,rows,indices,stats,certified,failures,nonmechanicalChanges,sources,
  mechanicsPassed:false,productionChanged:false,candidateIntegrated:false,
  qualification:'Each proposed linear playback span is bounded against every retained numerical knot using a weighted absolute-angle displacement bound. Convexity extends that error bound between source knots. Seven actual prism pairs additionally pass continuous triangle separation bounds on each accepted span. Failing spans split at an existing numerical knot. Startup is retained; observed matching states/velocities support repeating 0.5–8.5 seconds. Deforming rope and remaining hardware require their own clearance bounds.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,indices:undefined,certified:certified.length,sources:undefined});if(!report.passed)process.exitCode=1;
