import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyDynamics} from './lib/weighted-clutch-key-dynamics.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-lift',
  impactFile=process.env.PROBE_INPUT??'artifacts/review/087-fixed-orbit-impact-v2.json',impact=readStudyReport(impactFile),
  h=Number(process.env.PROBE_DT??.00025),duration=Number(process.env.PROBE_DURATION??.5),
  coefficients=(process.env.PROBE_COEFFICIENTS??'0,0.78').split(',').map(Number),
  sources=freezeStudySources([...impact.sources.map(s=>s.file),impactFile,'scripts/study-weighted-clutch-fixed-orbit-lift.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(impact.options),summaries=[];
verifyStudySources(impact.sources);
assert(h>0&&duration>0&&Number.isFinite(h+duration));
for(const first of impact.rows.filter(r=>coefficients.includes(r.staticCoefficient))){
  const d=makeWeightedClutchKeyDynamics(model,first.profile,first),initial=d.initial(first.q,first.impact.v,first.impact.active),rows=[initial];
  let state=initial,error=null;
  try{while(state.time<duration-1e-12){state=d.step(state,Math.min(h,duration-state.time));rows.push(state);}}
  catch(e){error={message:e.message,stack:e.stack};}
  const max=fn=>rows.reduce((m,r)=>Math.max(m,fn(r)),-Infinity),
    summary={direction:first.direction,side:first.side,staticCoefficient:first.staticCoefficient,kineticCoefficient:first.kineticCoefficient,
      h,duration,states:rows.length,parameters:d.parameters,start:initial,end:state,error,
      maximumWithdrawal:max(r=>(r.q[2]-initial.q[2])*(first.side==='left'?1:-1)),
      maximumOutputSpeedDeparture:max(r=>Math.abs(r.v[3]-d.parameters.omegaOutput)),
      minimumGap:-max(r=>-r.minimumGap),modes:[...new Set(rows.map(r=>r.mode).filter(Boolean))],
      maximumSelectedPriorityVelocitySpread:max(r=>r.selectedPriorityVelocitySpread??0),
      maximumTransportPriorityVelocitySpread:max(r=>r.transportPriorityVelocitySpread??0),
      maximumAllModesVelocitySpread:max(r=>r.allModesVelocitySpread??0),
      maximumImpulseEnergyResidual:max(r=>Math.abs(r.impulseEnergyResidual??0))};
  verifyStudySources(sources);const file=prefix+'-'+first.direction+'-mu'+first.staticCoefficient+'.json.gz';
  await writeGzipStudyReport(file,{movement:87,productionChanged:false,mechanicsPassed:false,sources,options:impact.options,profile:first.profile,...summary,rows});
  summaries.push({...summary,file});console.log({...summary,start:undefined,end:{time:state.time,q:state.q,v:state.v},parameters:undefined});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:impact.options,summaries,qualification:'Bounded lifts from independent freshly initialized next-stud states of the fixed-orbit fit. Five physical coordinates, native contact geometry and updated mass/gravity are used. Friction is a material hypothesis. These branches are not connected cycles. Step refinement and native full-solid clearance are separate requirements.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error));
