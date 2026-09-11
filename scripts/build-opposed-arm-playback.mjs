import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/079-load6-finest.json',prefix=process.env.PROBE_PREFIX??'079-playback-finest',
 run=JSON.parse(await readFile(input,'utf8')),epsilon=Number(process.env.PROBE_EPSILON??1e-8),period=run.parameters.period,pitch=2*Math.PI/33,
 rows=run.rows.map(r=>[r.time,...r.x]),sources=[];
if(run.failures.length||Math.abs(rows[0][0])>1e-9||Math.abs(rows.at(-1)[0]-2*period)>1e-8)throw Error('Playback requires two complete initial cycles');
if(!(epsilon>0&&epsilon<=1e-7))throw Error('Unsupported compression tolerance');
const split=rows.findIndex(row=>Math.abs(row[0]-period)<1e-8);if(split<1)throw Error('Missing cycle seam');
const firstRaw=rows.slice(0,split+1).map(r=>[...r]),steadyRaw=rows.slice(split).map(r=>[r[0]-period,...r.slice(1)]),
 corrections={initialTime:period-firstRaw.at(-1)[0],steadyStartTime:-steadyRaw[0][0],steadyEndTime:period-steadyRaw.at(-1)[0],angles:[]};
firstRaw.at(-1)[0]=period;steadyRaw[0][0]=0;steadyRaw.at(-1)[0]=period;
for(let k=1;k<4;k++){
 const target=steadyRaw[0][k]-(k===1?4*pitch:0),change=target-steadyRaw.at(-1)[k];
 if(Math.abs(change)>1e-7)throw Error('Cycle has not settled closely enough for numerical seam closure: '+JSON.stringify({coordinate:k,change}));
 corrections.angles.push(change);steadyRaw.at(-1)[k]=target;
}
const errors=[0,0,0];
// A feasible range of slopes from the last retained knot bounds each omitted
// source knot. Affine differences attain their extrema at the knot union,
// so this also bounds every point on the original linear interpolant.
const compress=table=>{
 const output=[table[0]];let start=0,index=1,low=[-Infinity,-Infinity,-Infinity],high=[Infinity,Infinity,Infinity];
 while(index<table.length){
  const a=table[start],b=table[index],dt=b[0]-a[0],slope=b.slice(1).map((v,k)=>(v-a[k+1])/dt),valid=slope.every((v,k)=>v>=low[k]&&v<=high[k]);
  if(!valid){if(index-1===start)throw Error('Adjacent knots cannot be compressed');start=index-1;output.push(table[start]);low=[-Infinity,-Infinity,-Infinity];high=[Infinity,Infinity,Infinity];continue;}
  for(let k=0;k<3;k++){low[k]=Math.max(low[k],slope[k]-epsilon/dt);high[k]=Math.min(high[k],slope[k]+epsilon/dt);}index++;
 }
 if(output.at(-1)!==table.at(-1))output.push(table.at(-1));
 let segment=0;
 for(const row of table){while(segment+1<output.length-1&&output[segment+1][0]<row[0])segment++;
  const a=output[segment],b=output[segment+1],s=(row[0]-a[0])/(b[0]-a[0]);
  for(let k=0;k<3;k++)errors[k]=Math.max(errors[k],Math.abs(a[k+1]+s*(b[k+1]-a[k+1])-row[k+1]));
 }
 return output;
};
const first=compress(firstRaw),steady=compress(steadyRaw),failures=[];
if(errors.some(e=>e>epsilon+1e-13))failures.push({reason:'compression-error',errors});
for(const file of ['scripts/build-opposed-arm-playback.mjs','scripts/lib/opposed-arm-candidate.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-profile-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const artifact={movement:79,status:'isolated-compressed-playback',productionChanged:false,mechanicsPassed:false,passed:failures.length===0,geometry:run.geometry,physics:run.parameters,
 physicsPeriod:period,playbackPeriod:4,pitch,teethPerCycle:4,sourceSlider:makeOpposedArmCandidate(run.geometry).root.userData.geometry.sourceSlider,epsilon,first,steady,corrections,sources,
 qualification:'Compressed numerically integrated startup and second cycle. Only sub-1e-7-radian endpoint corrections close the four-tooth periodic seam. Continuous clearance and final physical reaction checks remain outstanding.'},
 output=`artifacts/review/${prefix}-candidate.json`;
await writeFile(output,JSON.stringify(artifact)+'\n',{flag:'wx'});
// Existing numerical bound runners consume absolute-time rows. This adapter
// preserves the exact compressed playback across startup and one steady cycle.
const combined=[...first,...steady.slice(1).map(row=>[row[0]+period,...row.slice(1)])],boundFile=`artifacts/review/${prefix}-trajectory.json`;
await writeFile(boundFile,JSON.stringify({movement:79,status:'playback-interpolation-for-bounds',productionChanged:false,mechanicsPassed:false,geometry:run.geometry,parameters:run.parameters,dt:null,
 duration:2*period,rows:combined.map(row=>({time:row[0],x:row.slice(1)})),failures:[],playback:{file:output,sha256:createHash('sha256').update(await readFile(output)).digest('hex')},
 qualification:'Variable-step linear angle interpolation identical to the compressed first and steady playback tables. The driver retains its exact prescribed sinusoidal linkage motion; no new dynamics is implied.'})+'\n',{flag:'wx'});
const report={movement:79,status:'playback-compression-study',productionChanged:false,mechanicsPassed:false,passed:failures.length===0,input,rawStates:rows.length,firstKnots:first.length,steadyKnots:steady.length,
 epsilon,maximumAngleErrors:errors,corrections,failures,sources,outputs:await Promise.all([output,boundFile].map(async file=>({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')})))};
await writeFile(`artifacts/review/${prefix}-compression.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,firstKnots:first.length,steadyKnots:steady.length,maximumAngleErrors:errors,corrections,outputs:report.outputs});if(!report.passed)process.exitCode=1;
