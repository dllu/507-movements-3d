import { readFile, writeFile } from 'node:fs/promises';
import { makeElasticRatchetStudy } from './lib/spring-pressed-ratchet-elastic.mjs';

const file='artifacts/review/073-front-leaves-12-elastic-study.json';
const report=JSON.parse(await readFile(file,'utf8')),poses=[report.snapshots[0],report.snapshots.at(-1)],rows=[];
for(const pose of poses){
  const study=makeElasticRatchetStudy({...report.parameters,wheelFeatureMode:'all'});
  const initial=study.evaluate(pose.x,pose.input);
  for(const gap of initial.gaps)if(gap.gap<.002)study.multipliers.set(gap.key,.15+.03*Math.sin(gap.key.length));
  const state=study.evaluate(pose.x,pose.input,{details:true});
  let maximumError=0,maximumRelativeError=0,worst;
  for(let i=0;i<pose.x.length;i++){
    const a=[...pose.x],b=[...pose.x],h=1e-7;a[i]-=h;b[i]+=h;
    const numerical=(study.evaluate(b,pose.input).energy-study.evaluate(a,pose.input).energy)/(2*h);
    const error=Math.abs(numerical-state.gradient[i]),relative=error/Math.max(1,Math.abs(numerical),Math.abs(state.gradient[i]));
    if(error>maximumError){maximumError=error;worst={i,numerical,analytic:state.gradient[i]};}maximumRelativeError=Math.max(maximumRelativeError,relative);
  }
  const wheelTorque=state.contacts.filter(r=>r.kind==='B-A'||r.kind==='C-A')
    .reduce((sum,r)=>sum-r.force*(r.point[0]*r.normal[1]-r.point[1]*r.normal[0]),0);
  rows.push({input:pose.input,maximumError,maximumRelativeError,worst,wheelTorque,
    torqueGradientResidual:state.gradient[study.qIndex]+wheelTorque+study.parameters.load,
    active:state.contacts.map(r=>({kind:r.kind,feature:r.feature,tooth:r.tooth,force:r.force}))});
}
await writeFile('artifacts/review/073-multiple-feature-gradients.json',JSON.stringify({movement:73,sourcePoses:file,rows,
  qualification:'Independent central finite differences of the complete contact-plus-bending potential, with positive reactions placed on each close feature. Both sides of a tooth seat are active in the second case. This validates the force gradients, not the driven mechanism.'},null,2)+'\n',{flag:'wx'});
console.log(rows);if(rows.some(r=>r.maximumRelativeError>1e-5||Math.abs(r.torqueGradientResidual)>1e-10))process.exitCode=1;
