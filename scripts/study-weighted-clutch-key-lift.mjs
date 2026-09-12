import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyDynamics} from './lib/weighted-clutch-key-dynamics.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-lift',
 impactFile='artifacts/review/087-first-key-impact.json',impact=readStudyReport(impactFile),
 h=Number(process.env.PROBE_DT??.00025),duration=Number(process.env.PROBE_DURATION??.5),
 coefficients=(process.env.PROBE_COEFFICIENTS??'0,0.78').split(',').map(Number),
 sources=freezeStudySources([...impact.sources.map(s=>s.file),impactFile,'scripts/study-weighted-clutch-key-lift.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),summaries=[];
verifyStudySources(impact.sources);
assert(h>0&&duration>0&&Number.isFinite(h+duration));
for(const first of impact.rows.filter(r=>coefficients.includes(r.staticCoefficient))){
 const d=makeWeightedClutchKeyDynamics(model,first.profile,first),
  initial=d.initial(first.q,first.impact.v,first.impact.active),rows=[initial];
 let state=initial,error=null;
 try{while(state.time<duration-1e-12){state=d.step(state,Math.min(h,duration-state.time));rows.push(state);}}
 catch(e){error={message:e.message,stack:e.stack};}
 const summary={direction:first.direction,staticCoefficient:first.staticCoefficient,kineticCoefficient:first.kineticCoefficient,
  h,duration,states:rows.length,parameters:d.parameters,start:initial,end:state,error,
  maximumWithdrawal:Math.max(...rows.map(r=>(r.q[2]-initial.q[2])*(first.side==='left'?1:-1))),
  maximumOutputSpeedDeparture:Math.max(...rows.map(r=>Math.abs(r.v[3]-d.parameters.omegaOutput))),
  minimumGap:Math.min(...rows.map(r=>r.minimumGap)),
  modes:[...new Set(rows.map(r=>r.mode).filter(Boolean))],
  maximumSelectedPriorityVelocitySpread:Math.max(...rows.map(r=>r.selectedPriorityVelocitySpread??0)),
  maximumTransportPriorityVelocitySpread:Math.max(...rows.map(r=>r.transportPriorityVelocitySpread??0)),
  maximumAllModesVelocitySpread:Math.max(...rows.map(r=>r.allModesVelocitySpread??0)),
  maximumImpulseEnergyResidual:Math.max(...rows.map(r=>Math.abs(r.impulseEnergyResidual??0)))};
 verifyStudySources(sources);const file=prefix+'-'+first.direction+'-mu'+first.staticCoefficient+'.json.gz';
 await writeGzipStudyReport(file,{movement:87,productionChanged:false,mechanicsPassed:false,sources,...summary,rows});
 summaries.push({...summary,file});console.log({...summary,start:undefined,end:{time:state.time,q:state.q,v:state.v},parameters:undefined});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,
 sources,summaries,qualification:'Bounded next-stud lifting study with genuine shaft/D angular clearance. Key-only dry friction is an explicit illustrative hypothesis; no force is applied when the key is unloaded. The static/sliding selector is documented in the projector. Normal-contact discretization, friction-mode choices, native solids and full-cycle release still require independent verification.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error));
