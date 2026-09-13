import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementTightStud} from './lib/weighted-clutch-key-engagement-tight-stud.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const direction=process.env.PROBE_DIRECTION??'CW',segment=Number(process.env.PROBE_SEGMENT??1),
  input='artifacts/review/087-sequence-'+direction+'-fine-segment-'+segment+'.json.gz',report=readStudyReport(input),
  prefix='artifacts/review/087-sequence-'+direction+'-segment-'+segment+'-free-shaft',
  sources=freezeStudySources([...report.sources.map(s=>s.file),input,'scripts/check-weighted-clutch-sequence-free-shaft.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(report.options),
  dynamics=makeWeightedClutchKeyEngagementTightStud(model,report.profile,report.friction,report.otherProfiles),
  inertia=dynamics.parameters.shaftInertia,intervals=[],checks=[];
verifyStudySources(report.sources);assert(report.settled&&!report.error);
let interval=null;
for(let i=1;i<report.rows.length;i++){
  const row=report.rows[i],impulse=row.active.reduce((n,c)=>n+Math.abs(c.impulse*c.gradient[3])+Math.abs(c.tangentImpulse*(c.tangent?.[3]??0)),0);
  // This tests the actual shaft coordinate, regardless of which jaw is seated.
  // The other rotating body's gravity has no derivative in this coordinate.
  if(impulse<1e-12){if(!interval)interval={first:i,last:i,maximumImpulse:impulse};else{interval.last=i;interval.maximumImpulse=Math.max(interval.maximumImpulse,impulse);}}
  else if(interval){intervals.push(interval);interval=null;}
}
if(interval)intervals.push(interval);
const acceleration=phi=>-dynamics.gravity.at(phi,0).gradient[3]/inertia,
  energy=(phi,v)=>.5*inertia*v*v+dynamics.gravity.at(phi,0).potential;
for(const interval of intervals.filter(p=>report.rows[p.last].time-report.rows[p.first].time>.02)){
  const start=report.rows[interval.first],end=report.rows[interval.last];
  let phi=start.q[3],v=start.v[3],time=start.time,maximumAngleError=0,maximumSpeedError=0,maximumEnergyError=0;
  const initialEnergy=energy(phi,v);
  for(let i=interval.first+1;i<=interval.last;i++){
    const target=report.rows[i];
    while(time<target.time-1e-12){
      const h=Math.min(.000125,target.time-time),a1=acceleration(phi),q2=phi+h*v/2,v2=v+h*a1/2,a2=acceleration(q2),
        q3=phi+h*v2/2,v3=v+h*a2/2,a3=acceleration(q3),q4=phi+h*v3,v4=v+h*a3,a4=acceleration(q4);
      phi+=h*(v+2*v2+2*v3+v4)/6;v+=h*(a1+2*a2+2*a3+a4)/6;time+=h;
    }
    maximumAngleError=Math.max(maximumAngleError,Math.abs(phi-target.q[3]));maximumSpeedError=Math.max(maximumSpeedError,Math.abs(v-target.v[3]));
    maximumEnergyError=Math.max(maximumEnergyError,Math.abs(energy(phi,v)-initialEnergy));
  }
  checks.push({...interval,startTime:start.time,endTime:end.time,states:interval.last-interval.first+1,
    maximumAngleError,maximumSpeedError,maximumEnergyError});
}
verifyStudySources(sources);
const passed=checks.length>0&&checks.every(c=>c.maximumAngleError<.001&&c.maximumSpeedError<.001&&c.maximumEnergyError<1e-8);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,direction,segment,passed,checks,
  qualification:'Independent RK4 integration of shaft gravity during every stored interval longer than 0.02 with negligible shaft contact impulse. Selection uses the actual coordinate impulse, not the primary profile output direction. This supplements the per-segment contact and step-size checks.'},null,2)+'\n',{flag:'wx'});
console.log({direction,segment,passed,checks});assert(passed);
