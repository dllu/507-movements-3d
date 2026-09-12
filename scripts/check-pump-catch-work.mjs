import fs from 'node:fs';
import {makePumpCatchWeightedCandidate} from './lib/pump-catch-weighted-candidate.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {readStudyReport,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-guarded-finite-rope-dynamics.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-guarded-work',data=readStudyReport(input);
verifyStudySources(data.sources);const sources=freezeStudySources([input,'scripts/check-pump-catch-work.mjs','scripts/lib/pump-catch-weighted-candidate.mjs',...data.sources.map(s=>s.file)],prefix),model=makePumpCatchWeightedCandidate(data.parameters.candidateOptions),dynamics=makePumpCatchSlackDynamics(model,data.parameters);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),mul=(M,v)=>M.map(r=>dot(r,v)),initial=dynamics.at(data.rows[0].q,data.rows[0].v).energy;
const totals={driverWork:0,dragWork:0,projectionLoss:0,contactDriftWork:0,absoluteDriftWork:0,integrationResidual:0,absoluteIntegrationResidual:0,absoluteDriverWork:0},windows=[],worst={integrationResidual:{value:0},contactDriftWork:{value:0},normalVelocity:{value:0}};
let final=initial;
for(let i=1;i<data.rows.length;i++){
  const before=data.rows[i-1],row=data.rows[i],h=row.time-before.time,mass=dynamics.at(before.q,before.v),after=dynamics.at(row.q,row.v),free=before.v.map((v,k)=>v+h*mass.acceleration[k]),d=row.v.map((v,k)=>v-free[k]);
  const{hubDrag=0,hingeDrag=0,pumpDrag=0,inputAngularSpeed=0}=data.parameters;
  let driverWork=-h*hubDrag*(before.v[0]-inputAngularSpeed)*inputAngularSpeed,contactDriftWork=0,normalVelocity=0;
  for(const c of row.active){const inputVelocity=c.inputGradient*data.angularSpeed,relative=dot(c.gradient,row.v)+inputVelocity;
    driverWork-=c.impulse*inputVelocity;contactDriftWork+=c.impulse*relative;normalVelocity=Math.max(normalVelocity,Math.abs(relative));}
  const projectionLoss=.5*dot(d,mul(mass.M,d)),dragWork=-h*(data.parameters.drag*(before.v[0]*row.v[0]+before.v[1]*row.v[1])
    +hubDrag*(before.v[0]-inputAngularSpeed)*(row.v[0]-inputAngularSpeed)+hingeDrag*(before.v[1]-before.v[0])*(row.v[1]-row.v[0])+pumpDrag*before.v[2]*row.v[2]),
    integrationResidual=after.energy-mass.energy-driverWork-dragWork+projectionLoss-contactDriftWork;
  for(const[key,value]of Object.entries({driverWork,dragWork,projectionLoss,contactDriftWork,integrationResidual}))totals[key]+=value;
  totals.absoluteDriverWork+=Math.abs(driverWork);totals.absoluteDriftWork+=Math.abs(contactDriftWork);totals.absoluteIntegrationResidual+=Math.abs(integrationResidual);
  for(const[key,value]of Object.entries({integrationResidual,contactDriftWork,normalVelocity}))if(Math.abs(value)>Math.abs(worst[key].value))worst[key]={value,time:row.time,h,q:row.q,v:row.v,contacts:row.active.map(c=>c.kind)};
  final=after.energy;
  if(i===data.rows.length-1||Math.floor(row.time)>Math.floor(before.time))windows.push({time:row.time,energy:final,...totals});
}
const scale=Math.max(1,Math.abs(final-initial),totals.absoluteDriverWork+totals.projectionLoss+Math.abs(totals.dragWork)),relativeResidual=Math.abs(totals.integrationResidual)/scale,
  relativeAbsoluteResidual=totals.absoluteIntegrationResidual/scale,relativeDrift=totals.absoluteDriftWork/scale;
verifyStudySources(sources);const report={movement:86,status:'finite-rope-work-and-impact-diagnostic',passed:relativeResidual<.005&&relativeAbsoluteResidual<.01&&relativeDrift<.005,
  mechanicsPassed:false,candidateIntegrated:false,productionChanged:false,input,step:data.step,states:data.rows.length,initialEnergy:initial,finalEnergy:final,totals,scale,relativeResidual,relativeAbsoluteResidual,relativeDrift,worst,windows,sources,
  qualification:'Mesh-verified mass/energy formulas account for cam work, input-shaft work through hub drag, relative hub/hinge and vertical pump losses, and mass-metric projection loss. Nonzero final relative normal velocity is retained as contact drift work. The remaining energy change is the integration defect, reported both signed and absolute. These are diagnostic 0.5% signed/drift and 1% absolute thresholds, not material stress or continuum-error bounds.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,windows:undefined});if(!report.passed)process.exitCode=1;
