import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/078-amplitude-038-finer.json',prefix=process.env.OUTPUT_PREFIX??'078-playback';
const raw=JSON.parse(fs.readFileSync(input)),candidate=makePullPawlCandidate(raw.geometry);
const p=candidate.root.userData.geometry,period=raw.parameters.period,epsilon=1e-7;
const count=Math.round(period/raw.dt),failures=[],errors=[0,0,0,0];
if(raw.failures.length||raw.rows.length!==2*count+1)throw Error('Need two complete finest-step cycles');
for(const source of raw.sources)if(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex')!==source.sha256)throw Error('Trajectory source changed: '+source.file);
const original=raw.rows.map((r,i)=>[i*raw.dt,r.q,...r.x]);
const firstRaw=original.slice(0,count+1),steadyRaw=original.slice(count).map(r=>[r[0]-period,...r.slice(1)]);
const closure=steadyRaw.at(-1).slice(1).map((v,k)=>v-steadyRaw[0][k+1]+(k===1?p.pitch:0));
const endpointCorrections=[];
// Normalize accumulated floating-point time drift and close the repeat seam.
// No interior coordinates or wheel reversals are changed.
for(const [label,table]of [['first',firstRaw],['steady',steadyRaw]])for(const index of [0,table.length-1]){
 const target=index===0?(label==='first'?[0,...raw.rows[0].x]:[0,...raw.rows[count].x]):label==='first'?[0,...raw.rows[count].x]:[0,raw.rows[count].x[0]-p.pitch,...raw.rows[count].x.slice(1)];
 endpointCorrections.push({label,index,delta:target.map((v,k)=>v-table[index][k+1])});
 table[index]=[index===0?0:period,...target];
}
if(Math.max(...endpointCorrections.flatMap(c=>c.delta.map(Math.abs)))>epsilon)failures.push({reason:'repeat-seam-too-large',closure});
function compress(rows){
 const selected=[0];let start=0,index=1,lo=Array(4).fill(-Infinity),hi=Array(4).fill(Infinity);
 while(index<rows.length){
  const dt=rows[index][0]-rows[start][0],slope=rows[index].slice(1).map((v,k)=>(v-rows[start][k+1])/dt);
  if(slope.some((v,k)=>v<lo[k]||v>hi[k])){
   if(index-1===start)throw Error('Cannot compress adjacent states');
   selected.push(index-1);start=index-1;lo.fill(-Infinity);hi.fill(Infinity);continue;
  }
  for(let k=0;k<4;k++){lo[k]=Math.max(lo[k],slope[k]-epsilon/dt);hi[k]=Math.min(hi[k],slope[k]+epsilon/dt);}index++;
 }
 if(selected.at(-1)!==rows.length-1)selected.push(rows.length-1);
 let segment=0;
 for(let i=0;i<rows.length;i++){
  while(segment+1<selected.length-1&&i>selected[segment+1])segment++;
  const a=rows[selected[segment]],b=rows[selected[segment+1]],f=(rows[i][0]-a[0])/(b[0]-a[0]);
  for(let k=0;k<4;k++)errors[k]=Math.max(errors[k],Math.abs(rows[i][k+1]-a[k+1]-f*(b[k+1]-a[k+1])));
 }
 return selected.map(i=>rows[i]);
}
const first=compress(firstRaw),steady=compress(steadyRaw);
if(errors.some(v=>v>epsilon*1.000001))failures.push({reason:'compression-error',errors});
const sources=[input,'scripts/build-pull-pawl-playback-study.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-contact-study.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const artifact={movement:78,status:'piecewise-linear-playback-candidate',productionChanged:false,mechanicsPassed:false,passed:!failures.length,geometry:raw.geometry,pitch:-p.pitch,physics:raw.parameters,physicsPeriod:period,playbackPeriod:4,epsilon,first,steady,sources,
 qualification:'Compressed finest-step dynamics. Row order is time, lever angle, wheel angle, left pawl angle, right pawl angle. Initial cycle is followed by the second cycle repeated with one additional clockwise tooth pitch. Only endpoint corrections below the 1e-7-radian compression tolerance close floating-point seams. Tiny physical wheel reversals are retained. Continuous contact bounds and integration checks remain outstanding.'};
const output='artifacts/review/'+prefix+'-candidate.json';fs.writeFileSync(output,JSON.stringify(artifact)+'\n',{flag:'wx'});
const report={movement:78,status:'playback-compression-study',productionChanged:false,mechanicsPassed:false,passed:artifact.passed,rawStates:raw.rows.length,firstKnots:first.length,steadyKnots:steady.length,epsilon,maximumAngleErrors:errors,closure,endpointCorrections,failures,sources,artifact:{file:output,sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')}};
fs.writeFileSync('artifacts/review/'+prefix+'-compression-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,endpointCorrections:undefined});process.exitCode=report.passed?0:1;
