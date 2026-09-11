import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';import{makeJointedTappetDynamics}from'./lib/jointed-tappet-dynamics-study.mjs';
const input='artifacts/review/076-refined-dense-first-count.json',raw=JSON.parse(await readFile(input,'utf8')),candidate=makeJointedTappetCandidate(),u=candidate.root.userData,p=u.geometry,physics=makeJointedTappetDynamics(candidate,raw.parameters),
  rows=raw.states,epsilon=5e-8,selected=[0],errors=[0,0,0,0];
for(const source of raw.sources)if(source.file!=='scripts/check-jointed-tappet-refined-convergence.mjs'&&createHash('sha256').update(await readFile(source.file)).digest('hex')!==source.sha256)throw new Error('Raw trajectory source changed');
let start=0,index=1,lo=[-Infinity,-Infinity,-Infinity,-Infinity],hi=[Infinity,Infinity,Infinity,Infinity];
while(index<rows.length){
 const duration=rows[index][0]-rows[start][0],slope=[0,1,2,3].map(k=>(rows[index][k+1]-rows[start][k+1])/duration);
 if(slope.some((v,k)=>v<lo[k]||v>hi[k])){
  if(index-1===start)throw new Error('Cannot compress adjacent raw states');selected.push(index-1);start=index-1;lo.fill(-Infinity);hi.fill(Infinity);continue;
 }
 for(let k=0;k<4;k++){lo[k]=Math.max(lo[k],slope[k]-epsilon/duration);hi[k]=Math.min(hi[k],slope[k]+epsilon/duration);}index++;
}
if(selected.at(-1)!==rows.length-1)selected.push(rows.length-1);
let segment=0;for(let i=0;i<rows.length;i++){
 while(segment+1<selected.length-1&&i>selected[segment+1])segment++;const a=rows[selected[segment]],b=rows[selected[segment+1]],f=(rows[i][0]-a[0])/(b[0]-a[0]);
 for(let k=0;k<4;k++)errors[k]=Math.max(errors[k],Math.abs(rows[i][k+1]-(a[k+1]+f*(b[k+1]-a[k+1]))));
}
const first=selected.map(i=>rows[i].slice(0,5)),settled=rows.find(r=>r[0]>.1&&Math.abs(r[1]-.3)<1e-10&&r.slice(5).every(v=>Math.abs(v)<1e-8)&&Math.abs(r[3]-p.wheelStart)<1e-6);
if(!settled)throw new Error('No initial settled interval');
// Constrain the tiny Float32 seat offsets continuously to the ideal periodic
// seat during the late dwell. This correction is separately contact-checked.
const rest=[.3,0,p.wheelStart+p.pitch,0];first.push([8,...rest],[24,...rest]);
const steady=[[0,.3,0,p.wheelStart,0],[settled[0],.3,0,p.wheelStart,0],...first.filter(r=>r[0]>settled[0])];
const sample=(table,t)=>{let lo=0,hi=table.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(table[m][0]<=t)lo=m;else hi=m;}const a=table[lo],b=table[hi],f=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));return a.slice(1).map((v,k)=>v+f*(b[k+1]-v));};
const checks={samples:0,minimumGap:Infinity,byKind:{},worst:null},failures=[];
for(const[label,table]of [['first',first],['steady',steady]])for(let i=0;i<table.length-1;i++)for(const fraction of [0,.25,.5,.75,1]){
 const t=table[i][0]+fraction*(table[i+1][0]-table[i][0]),x=sample(table,t),contact=physics.constraints(x,t);
 checks.samples++;for(const[kind,gap]of Object.entries(contact.gaps)){checks.byKind[kind]=Math.min(checks.byKind[kind]??Infinity,gap);if(gap<checks.minimumGap){checks.minimumGap=gap;checks.worst={label,segment:i,fraction,time:t,kind,gap,x};}}
}
if(errors.some(v=>v>epsilon*1.0001))failures.push({reason:'raw-compression-error',errors});if(checks.minimumGap< -1e-6)failures.push({reason:'interpolated-contact-penetration',worst:checks.worst});
const sources=[];for(const file of ['scripts/build-jointed-tappet-playback-study.mjs','scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs',input])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const artifact={movement:76,status:'piecewise-linear-playback-candidate',productionChanged:false,mechanicsPassed:false,passed:failures.length===0,physics:raw.parameters,geometry:p,physicsPeriod:24,provisionalPlaybackPeriod:8,epsilon,initialSettleTime:settled[0],first,steady,sources,qualification:'Compressed finest-step states with an initial gravity transient and a proposed periodic rest prefix. Late dwell reconciles tiny Float32 seated offsets. Contact samples are checked, but all-twenty-tooth orientation tests, independent surface validation, repeated dynamics parity and default playback inspection remain.'};
await writeFile('artifacts/review/076-playback-candidate.json',JSON.stringify(artifact)+'\n',{flag:'wx'});
const report={movement:76,status:'playback-compression-and-contact-screen',productionChanged:false,mechanicsPassed:false,passed:artifact.passed,rawStates:rows.length,firstKnots:first.length,steadyKnots:steady.length,initialSettleTime:settled[0],epsilon,maximumAngleErrors:errors,checks,failures,sources,
 artifact:{file:'artifacts/review/076-playback-candidate.json',sha256:createHash('sha256').update(await readFile('artifacts/review/076-playback-candidate.json')).digest('hex')},qualification:artifact.qualification};
await writeFile('artifacts/review/076-playback-compression-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});process.exitCode=report.passed?0:1;
