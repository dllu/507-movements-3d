import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
import {makeOpposedArmPrimaryBounds} from './lib/opposed-arm-primary-bounds.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/079-playback-finer-prototype-candidate.json',prefix=process.env.PROBE_PREFIX??'079-contact-compressed-finer',
 profile=JSON.parse(await readFile(input,'utf8')),epsilon=Number(process.env.PROBE_EPSILON??1e-6),model=makeOpposedArmCandidate(profile.geometry),
 force=makeOpposedArmForceStudy(model,profile.physics),contact=makeOpposedArmContactStudy(model),bounds=makeOpposedArmPrimaryBounds(model,force,contact),
 projectIntervals=process.env.PROBE_PROJECT_INTERVALS==='1',projectionLimit=1e-4,
 sources=[],failures=[],proofs=[],projections=[],errors=[0,0,0],counts={attempts:0,angleSplits:0,contactSplits:0,certifiedPairs:0,subdivisions:0},minimum={lowerBound:Infinity};
if(!profile.passed||!(epsilon>0&&epsilon<=1e-6))throw Error('Unsupported input or compression tolerance');
for(const table of [profile.first,profile.steady])if(table.length<2||table[0][0]!==0||table.at(-1)[0]!==profile.physicsPeriod)throw Error('Incomplete playback cycle');
if(profile.sourceSlider.some((v,i)=>v!==model.root.userData.geometry.sourceSlider[i]))throw Error('Playback uses another prescribed linkage');
for(let k=1;k<4;k++){
 if(profile.first.at(-1)[k]!==profile.steady[0][k])throw Error('Initial playback seam is not closed');
 if(Math.abs(profile.steady.at(-1)[k]-profile.steady[0][k]+(k===1?profile.teethPerCycle*profile.pitch:0))>1e-14)throw Error('Periodic playback seam is not closed');
}
for(const file of ['scripts/compress-opposed-arm-contact-playback.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs',
 'scripts/lib/opposed-arm-contact-study.mjs','scripts/lib/opposed-arm-primary-bounds.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-profile-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const compress=(table,label,offset)=>{
 const output=[table[0]],save=(a,b,result)=>{
  output.push(b);proofs.push({label,start:a[0],end:b[0],...result.stats});
  counts.certifiedPairs+=result.stats.certifiedPairs;counts.subdivisions+=result.stats.subdivisions;
  minimum.lowerBound=Math.min(minimum.lowerBound,result.stats.minimumLowerBound);
 },interpolate=(a,b,time)=>[time,...a.slice(1).map((v,k)=>v+(b[k+1]-v)*(time-a[0])/(b[0]-a[0]))],
 refine=(a,b,originalA,originalB,depth=0)=>{
  if(failures.length)return;
  counts.attempts++;const result=bounds.interval({time:a[0]+offset,x:a.slice(1)},{time:b[0]+offset,x:b.slice(1)});
  if(result.passed){save(a,b,result);return;}
  if(depth>=14){failures.push({label,start:a[0],end:b[0],reason:'dense-output-depth',result});return;}
  const time=result.failures[0].middle-offset;
  if(!(time>a[0]&&time<b[0]))throw Error('Invalid interior correction time');
  const row=interpolate(a,b,time),base=interpolate(originalA,originalB,time),before=row.slice(),k=force.input(time+offset);
  let minimumGap=-Infinity,iterations=0;
  // Constraint projection is restricted to the two pawl angles. The wheel,
  // driver and all retained dynamics knots remain unchanged. Each accepted
  // piece is subsequently certified over its complete continuous interval.
  for(;iterations<30;iterations++){
   const rows=contact.constraints(row.slice(1),k).rows;
   minimumGap=Math.min(...rows.map(r=>r.gap));if(minimumGap>=-1e-9)break;
   for(const key of ['upper','lower']){
    const worst=rows.filter(r=>r.key===key&&r.gap< -1e-9).sort((a,b)=>a.gap-b.gap)[0];if(!worst)continue;
    const j=key==='upper'?1:2;if(Math.abs(worst.J[j])<1e-9)break;
    row[j+1]-=worst.gap/worst.J[j];
   }
   if(row.slice(1).some((v,j)=>!Number.isFinite(v)||Math.abs(v-base[j+1])>projectionLimit))break;
  }
  const deviation=row.slice(1).map((v,j)=>v-base[j+1]);
  if(minimumGap< -1e-9||deviation.some(v=>Math.abs(v)>projectionLimit)||row[1]!==base[1]){
   failures.push({label,time,reason:'dense-output-projection',iterations,minimumGap,before,row,base,deviation});return;
  }
  projections.push({label,time,depth,iterations,minimumGap,before,row,base,deviation});
  refine(a,row,originalA,originalB,depth+1);refine(row,b,originalA,originalB,depth+1);
 },interval=(lo,hi)=>{
  if(failures.length)return;
  const a=table[lo],b=table[hi],dt=b[0]-a[0],deviation=[0,0,0];let split=-1,maximum=-Infinity;
  for(let i=lo+1;i<hi;i++)for(let k=0;k<3;k++){
   const e=Math.abs(table[i][k+1]-a[k+1]-(b[k+1]-a[k+1])*(table[i][0]-a[0])/dt);deviation[k]=Math.max(deviation[k],e);
   if(e>maximum){maximum=e;split=i;}
  }
  if(maximum>epsilon){counts.angleSplits++;interval(lo,split);interval(split,hi);return;}
  counts.attempts++;const result=bounds.interval({time:a[0]+offset,x:a.slice(1)},{time:b[0]+offset,x:b.slice(1)});
  if(result.passed){
   save(a,b,result);
   for(let k=0;k<3;k++)errors[k]=Math.max(errors[k],deviation[k]);
  }else if(hi-lo>1){counts.contactSplits++;const middle=(lo+hi)>>1;interval(lo,middle);interval(middle,hi);}
  else if(projectIntervals)refine(a,b,a,b);
  else failures.push({label,lo,hi,start:a[0],end:b[0],result});
  if(counts.attempts%250===0)console.log({label,time:b[0],knots:output.length,...counts,minimum:minimum.lowerBound,failures:failures.length});
 };
 interval(0,table.length-1);
 if(!failures.length){
  // Independent union-of-knots comparison bounds the actual output, including
  // inserted contact projections, against the entire input interpolant.
  for(const [left,right]of [[table,output],[output,table]]){
   let segment=0;
   for(const row of left){while(segment+1<right.length-1&&right[segment+1][0]<row[0])segment++;
    const other=interpolate(right[segment],right[segment+1],row[0]);
    for(let k=0;k<3;k++)errors[k]=Math.max(errors[k],Math.abs(row[k+1]-other[k+1]));
   }
  }
  if(errors.some(e=>e>(projectIntervals?projectionLimit:epsilon)+1e-12))throw Error('Playback deviation bound failed');
 }
 return output;
};
const first=compress(profile.first,'initial',0),steady=failures.length?[]:compress(profile.steady,'steady',profile.physicsPeriod),passed=failures.length===0,outputs=[];
if(passed){
 const artifact={...profile,status:'isolated-contact-preserving-playback',epsilon,priorInterpolationEpsilon:profile.epsilon,maximumAngleErrors:errors,
  denseOutputProjection:{enabled:projectIntervals,limit:projectionLimit,insertedKnots:projections.length,wheelChanged:false},first,steady,sources,
  qualification:'Numerical playback is simplified within the stated measured angle errors. Optional interior pawl-angle projection resolves interpolation overlap while retaining all endpoint states and wheel motion. Every replacement segment passes finite 3D contact clearance at the unchanged 1e-6 tolerance for all 33 wheel orientations. Dynamics, final reaction checks, hardware and integration require separate evidence.'},
  file=`artifacts/review/${prefix}-candidate.json`;
 await writeFile(file,JSON.stringify(artifact)+'\n',{flag:'wx'});outputs.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 const table=[...first,...steady.slice(1).map(row=>[row[0]+profile.physicsPeriod,...row.slice(1)])],trajectory=`artifacts/review/${prefix}-trajectory.json`;
 await writeFile(trajectory,JSON.stringify({movement:79,status:'bounded-playback-trajectory',productionChanged:false,mechanicsPassed:false,geometry:profile.geometry,parameters:profile.physics,dt:null,
  duration:2*profile.physicsPeriod,rows:table.map(row=>({time:row[0],x:row.slice(1)})),failures:[],playback:outputs[0]})+'\n',{flag:'wx'});
 outputs.push({file:trajectory,sha256:createHash('sha256').update(await readFile(trajectory)).digest('hex')});
}
const report={movement:79,status:'contact-preserving-compression-study',productionChanged:false,mechanicsPassed:false,passed,input,epsilon,priorInterpolationEpsilon:profile.epsilon,
 tolerance:1e-6,rawKnots:profile.first.length+profile.steady.length,firstKnots:first.length,steadyKnots:steady.length,maximumAngleErrors:errors,counts,minimum,parameters:bounds.parameters,
 projectIntervals,projectionLimit,projections,proofs,failures,sources,outputs,qualification:bounds.qualification+' Comparison at the union of input/output knots bounds deviations throughout every affine interpolation interval. Interior pawl-angle projection is interpolation repair, not a replacement dynamics integration.'};
await writeFile(`artifacts/review/${prefix}-bounds.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,firstKnots:first.length,steadyKnots:steady.length,counts,minimum,errors,failures:failures.slice(0,1)});if(!passed)process.exitCode=1;
