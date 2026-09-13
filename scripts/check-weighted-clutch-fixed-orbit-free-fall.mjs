import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchInertia} from './lib/weighted-clutch-inertia.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-free-fall',
  files=['artifacts/review/087-fixed-orbit-transfer-coarse.json','artifacts/review/087-fixed-orbit-transfer-fine.json'],
  parents=files.map(readStudyReport),sources=freezeStudySources([...parents[1].sources.map(s=>s.file),...files,
    ...parents.flatMap(r=>r.summaries.map(s=>s.file)),'scripts/check-weighted-clutch-fixed-orbit-free-fall.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(parents[1].options),inertia=makeWeightedClutchInertia(model),branches=[];
for(const p of parents)verifyStudySources(p.sources);
const acceleration=(q,v)=>{const p=inertia.linkage(q);return(-p.potentialDerivative-.5*p.inertiaDerivative*v*v)/p.inertia;},
  energy=(q,v)=>{const p=inertia.linkage(q);return p.potential+.5*p.inertia*v*v;};
for(const parent of parents)for(const summary of parent.summaries){
  const report=readStudyReport(summary.file),intervals=[];let current=null;
  for(let i=1;i<report.rows.length;i++){
    const row=report.rows[i],free=!row.active.some(c=>Math.abs(c.gradient[0]*c.impulse)>1e-12);
    if(free){if(!current)current={first:i,last:i};else current.last=i;}
    else if(current){intervals.push(current);current=null;}
  }
  if(current)intervals.push(current);
  const checks=[];
  for(const interval of intervals.filter(p=>p.last-p.first>=10)){
    const start=report.rows[interval.first],end=report.rows[interval.last];
    if(end.time-start.time<.005)continue;
    let q=start.q[0],v=start.v[0],time=start.time,maximumAngleError=0,maximumSpeedError=0,maximumEnergyError=0,steps=0;
    const initialEnergy=energy(q,v),samples=[];
    for(let i=interval.first+1;i<=interval.last;i++){
      const target=report.rows[i];
      while(time<target.time-1e-12){
        const h=Math.min(.000125,target.time-time),a1=acceleration(q,v),q2=q+h*v/2,v2=v+h*a1/2,a2=acceleration(q2,v2),
          q3=q+h*v2/2,v3=v+h*a2/2,a3=acceleration(q3,v3),q4=q+h*v3,v4=v+h*a3,a4=acceleration(q4,v4);
        q+=h*(v+2*v2+2*v3+v4)/6;v+=h*(a1+2*a2+2*a3+a4)/6;time+=h;steps++;
      }
      const angleError=Math.abs(q-target.q[0]),speedError=Math.abs(v-target.v[0]),energyError=Math.abs(energy(q,v)-initialEnergy);
      maximumAngleError=Math.max(maximumAngleError,angleError);maximumSpeedError=Math.max(maximumSpeedError,speedError);
      maximumEnergyError=Math.max(maximumEnergyError,energyError);
      if((i-interval.first)%100===0||i===interval.last)samples.push({time,q,v,angleError,speedError,energyError});
    }
    checks.push({startTime:start.time,endTime:end.time,states:interval.last-interval.first+1,steps,
      maximumAngleError,maximumSpeedError,maximumEnergyError,samples});
  }
  const result={direction:summary.direction,h:summary.h,checks};branches.push(result);
  console.log({direction:summary.direction,h:summary.h,intervals:checks.map(({samples,...c})=>c)});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,branches,qualification:'Independent fourth-order Runge-Kutta integration of the F/G/rod generalized coordinate on intervals with no contact impulse on F. Only the separately checked native linkage inertia and gravity enter this solver; jaw, key, stud and shifter motion are not prescribed. Energy conservation and full stored-time position/velocity comparisons check the unconstrained fall between stud release and the far slot. This does not establish the contact transitions or a full cycle.'},null,2)+'\n',{flag:'wx'});
for(const r of branches){
  assert(r.checks.length>0);
  assert(r.checks.every(c=>c.maximumAngleError<.003&&c.maximumSpeedError<.003&&c.maximumEnergyError<1e-8));
}
