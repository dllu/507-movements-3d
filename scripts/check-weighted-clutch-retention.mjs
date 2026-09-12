import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchLoadedSeating} from './lib/weighted-clutch-loaded-seating.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-refined-retention-check',
 inputs=['CCW','CW'].map(d=>'artifacts/review/087-refined-next-lift-'+d+'.json.gz'),reports=inputs.map(readStudyReport),
 holdFile='artifacts/review/087-refined-seated-hold.json',hold=readStudyReport(holdFile),
 impactFile='artifacts/review/087-refined-next-stud-impact.json',impacts=readStudyReport(impactFile),
 profiles=readStudyReport('artifacts/review/087-refined-seating-cusps.json'),
 firstImpacts=readStudyReport('artifacts/review/087-first-gravity-jaw-impact.json'),
 sources=freezeStudySources([...reports[0].sources.map(s=>s.file),...inputs,holdFile,impactFile,
  'scripts/check-weighted-clutch-retention.mjs'],prefix),model=makeWeightedClutchIndependentCandidate(),
 jaws=makeWeightedClutchNativeJaws(model),branches=[],dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
for(const r of [...reports,hold,impacts])verifyStudySources(r.sources);
for(const report of reports){
 const h=hold.branches.find(b=>b.direction===report.direction),impact=impacts.rows.find(r=>r.direction===report.direction),
  profile=profiles.profiles.find(p=>p.direction===report.direction),
  d=makeWeightedClutchLoadedSeating(model,firstImpacts.rows.find(r=>r.direction===report.direction),profile);
 assert(!h.firstLoss&&h.minimumReaction>1&&h.maximumAcceleration<1e-9&&h.maximumPowerResidual<1e-9);
 assert(impact.axialWithdrawalSpeed>.02&&Math.abs(impact.outputSpeedDeparture)>.05);
 assert(Math.max(...impact.momentumResidual.map(Math.abs))<1e-9&&Math.abs(impact.energyResidual)<1e-9);
 let maximumMomentumResidual=0,minimumGap=Infinity,minimumImpulse=Infinity,maximumClosingRate=0,absoluteContactWorkDefect=0;
 for(let i=1;i<report.rows.length;i++){
  const a=report.rows[i-1],b=report.rows[i],m=d.mass(a.q),c=d.query(b.q,b.time),
   residual=b.v.map((v,k)=>m[k]*(v-b.freeVelocity[k])-b.active.reduce((s,c)=>s+c.impulse*c.gradient[k],0)),
   contactLoss=b.active.reduce((s,c)=>s+c.impulse*(c.target-.5*dot(c.gradient,a.v.map((v,k)=>v+b.v[k]))),0);
  maximumMomentumResidual=Math.max(maximumMomentumResidual,...residual.map(Math.abs));
  minimumGap=Math.min(minimumGap,...c.map(c=>c.gap));minimumImpulse=Math.min(minimumImpulse,...b.active.map(c=>c.impulse));
  maximumClosingRate=Math.max(maximumClosingRate,...b.active.map(c=>-dot(c.gradient,b.v)-c.inputGradient*d.parameters.omegaInput));
  absoluteContactWorkDefect+=Math.abs(b.energy-a.energy-(b.work-a.work)+contactLoss);
 }
 const native=[];
 for(let i=0;i<=32;i++){
  const row=report.rows[Math.min(report.rows.length-1,Math.floor((report.rows.length-1)*(i===32?32:i+.271)/32))],
   queries=['left','right'].map(side=>jaws.evaluate(side,row.q[3]+(side==='left'?-1:1)*model.root.userData.geometry.mainRatio*row.phase.input,row.q[2]));
  native.push({time:row.time,q:row.q,phase:row.phase,jaws:queries});
 }
 const result={direction:report.direction,states:report.rows.length,maximumMomentumResidual,minimumGap,minimumImpulse,maximumClosingRate,
  absoluteContactWorkDefect,minimumNativeGap:Math.min(...native.flatMap(n=>n.jaws.map(j=>j.gap))),native,
  holdingSamples:h.rows.length,holdingMinimumReaction:h.minimumReaction,
  impactWithdrawalSpeed:impact.axialWithdrawalSpeed,impactOutputSpeed:impact.velocityAfter[3],
  maximumWithdrawal:report.maximumWithdrawal,maximumOutputSpeedDeparture:report.maximumOutputSpeedDeparture,
  end:{time:report.end.time,q:report.end.q,v:report.end.v}};
 branches.push(result);console.log({...result,native:native.length});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,branches,
 qualification:'Both refined seated configurations support gravity until the next stud contact, but both lose engagement when that contact starts lifting F. Momentum, compressive contact rates and full-native jaw samples check the outgoing half-time-unit trajectories. This is a counterexample to the current frictionless triangular-jaw/lost-motion interpretation, not acceptance of a full reversing mechanism.'})+'\n',{flag:'wx'});
for(const r of branches)assert(r.maximumMomentumResidual<1e-9&&r.minimumGap> -2e-9&&r.minimumImpulse>=0&&r.maximumClosingRate<1e-8&&r.minimumNativeGap> -1e-6&&r.maximumWithdrawal>.005);
