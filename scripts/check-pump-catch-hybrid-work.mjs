import {readLargeRowStudyReport} from './lib/large-row-study-reader.mjs';
import fs from 'node:fs';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-quarter-ms-hybrid.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-quarter-ms-hybrid-work',
  data=readLargeRowStudyReport(input),model=makePumpCatchCompleteCandidate(),dynamics=makePumpCatchSlackDynamics(model,data.parameters),
  dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),mul=(M,v)=>M.map(r=>dot(r,v)),p=data.parameters,
  initial=dynamics.at(data.rows[0].q,data.rows[0].v).energy,totals={driverWork:0,dragWork:0,projectionLoss:0,contactDriftWork:0,
    absoluteDriverWork:0,absoluteDriftWork:0,integrationResidual:0,absoluteIntegrationResidual:0},counts={smooth:0,impact:0},worst={value:0};
verifyStudySources(data.sources);let final=initial;
for(let i=1;i<data.rows.length;i++){
  const before=data.rows[i-1],row=data.rows[i],h=row.time-before.time,mass=dynamics.at(before.q,before.v),after=dynamics.at(row.q,row.v);
  let driverWork=0,dragWork=0,projectionLoss=0,contactDriftWork=0;
  if(row.integration){
    counts.smooth++;
    for(const s of row.stages){
      const dt=h*s.weight,v=s.v;driverWork-=dt*p.hubDrag*(v[0]-p.inputAngularSpeed)*p.inputAngularSpeed;
      dragWork-=dt*(p.drag*(v[0]**2+v[1]**2)+p.hubDrag*(v[0]-p.inputAngularSpeed)**2
        +p.hingeDrag*(v[1]-v[0])**2+p.pumpDrag*v[2]**2);
      for(const c of s.reactions)contactDriftWork+=dt*c.force*dot(c.gradient,v);
    }
  }else{
    counts.impact++;driverWork=-h*p.hubDrag*(before.v[0]-p.inputAngularSpeed)*p.inputAngularSpeed;
    const free=before.v.map((v,k)=>v+h*mass.acceleration[k]),d=row.v.map((v,k)=>v-free[k]);projectionLoss=.5*dot(d,mul(mass.M,d));
    for(const c of row.active){const inputVelocity=c.inputGradient*data.angularSpeed;driverWork-=c.impulse*inputVelocity;
      contactDriftWork+=c.impulse*(dot(c.gradient,row.v)+inputVelocity);}
    dragWork=-h*(p.drag*(before.v[0]*row.v[0]+before.v[1]*row.v[1])
      +p.hubDrag*(before.v[0]-p.inputAngularSpeed)*(row.v[0]-p.inputAngularSpeed)
      +p.hingeDrag*(before.v[1]-before.v[0])*(row.v[1]-row.v[0])+p.pumpDrag*before.v[2]*row.v[2]);
  }
  const integrationResidual=after.energy-mass.energy-driverWork-dragWork+projectionLoss-contactDriftWork;
  for(const[key,value]of Object.entries({driverWork,dragWork,projectionLoss,contactDriftWork,integrationResidual}))totals[key]+=value;
  totals.absoluteDriverWork+=Math.abs(driverWork);totals.absoluteDriftWork+=Math.abs(contactDriftWork);totals.absoluteIntegrationResidual+=Math.abs(integrationResidual);
  if(Math.abs(integrationResidual)>Math.abs(worst.value))Object.assign(worst,{time:row.time,value:integrationResidual,integration:row.integration??'impact'});final=after.energy;
}
const scale=Math.max(1,Math.abs(final-initial),totals.absoluteDriverWork+totals.projectionLoss+Math.abs(totals.dragWork)),
  relativeResidual=Math.abs(totals.integrationResidual)/scale,relativeAbsoluteResidual=totals.absoluteIntegrationResidual/scale,relativeDrift=totals.absoluteDriftWork/scale,
  sources=freezeStudySources([input,'scripts/lib/large-row-study-reader.mjs','scripts/check-pump-catch-hybrid-work.mjs',...data.sources.map(s=>s.file)],prefix);verifyStudySources(sources);
const report={movement:86,passed:relativeResidual<.005&&relativeAbsoluteResidual<.01&&relativeDrift<.005,input,counts,initialEnergy:initial,finalEnergy:final,
  totals,scale,relativeResidual,relativeAbsoluteResidual,relativeDrift,worst,sources,
  qualification:'Smooth intervals integrate driver power, viscous losses and constraint work at the saved RK quadrature stages. Impact intervals retain the original mass-metric loss and work accounting. Mechanical energy is evaluated independently from the actual mesh masses at both endpoints. The existing 0.5% signed/drift and 1% absolute diagnostic thresholds are unchanged.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
