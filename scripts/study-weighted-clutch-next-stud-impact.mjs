import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchLoadedSeating} from './lib/weighted-clutch-loaded-seating.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {projectClutchSeatingVelocity} from './lib/weighted-clutch-seating-contact.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-forward-next-stud-impact',
 holdFile=process.env.PROBE_HOLD??'artifacts/review/087-forward-seated-hold.json',hold=readStudyReport(holdFile),
 profileFile=process.env.PROBE_PROFILE??'artifacts/review/087-reused-forward-seating-profile.json',profiles=readStudyReport(profileFile),
 impactFile='artifacts/review/087-first-gravity-jaw-impact.json',impacts=readStudyReport(impactFile),
 sources=freezeStudySources([...hold.sources.map(s=>s.file),holdFile,profileFile,
  'scripts/study-weighted-clutch-next-stud-impact.mjs'],prefix),model=makeWeightedClutchIndependentCandidate(),
 jaws=makeWeightedClutchNativeJaws(model),rows=[],dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
verifyStudySources(hold.sources);
for(const branch of hold.branches){
 assert(!branch.firstLoss);const profile=profiles.profiles.find(p=>p.direction===branch.direction),
  impact=impacts.rows.find(r=>r.direction===branch.direction),d=makeWeightedClutchLoadedSeating(model,impact,profile),
  end=branch.end,q=end.q,v=end.v,m=d.mass(q),constraints=d.query(q,end.time).filter(c=>c.gap<2e-8).map(c=>({...c,target:-c.inputGradient*d.parameters.omegaInput})),
  projected=projectClutchSeatingVelocity(v,m,constraints),work=projected.active.reduce((s,c)=>s+c.impulse*c.target,0),loss=.5*projected.cost,
  kineticBefore=.5*dot(m,v.map(x=>x*x)),kineticAfter=.5*dot(m,projected.v.map(x=>x*x)),
  momentum=projected.v.map((x,k)=>m[k]*(x-v[k])-projected.active.reduce((s,c)=>s+c.impulse*c.gradient[k],0)),
  nativeStart=jaws.evaluate(profile.side,end.phase.relative,q[2]),directions=[];
 for(const eps of [1e-4,2e-5,4e-6]){
  const futureQ=q.map((x,k)=>x+eps*projected.v[k]),phase=d.phase(futureQ,end.time+eps),
   native=jaws.evaluate(profile.side,phase.relative,futureQ[2]);
  directions.push({eps,q:futureQ,phase,nativeGap:native.gap,
   couplingGaps:d.coupling.query(futureQ).map(c=>({kind:c.kind,gap:c.gap})),
   studGap:d.stud.evaluate(futureQ[0],phase.e).gap});
 }
 const row={direction:branch.direction,time:end.time,q,phase:end.phase,velocityBefore:v,velocityAfter:projected.v,
  constraints,active:projected.active,kineticBefore,kineticAfter,motorImpulseWork:work,plasticLoss:loss,
  momentumResidual:momentum,energyResidual:kineticAfter-kineticBefore-work+loss,nativeStart,directionalChecks:directions,
  axialWithdrawalSpeed:projected.v[2]*(profile.side==='left'?1:-1),
  outputSpeedDeparture:projected.v[3]-d.parameters.omegaOutput};
 rows.push(row);console.log({direction:row.direction,velocityBefore:v,velocityAfter:row.velocityAfter,
  active:row.active.map(c=>c.kind),axialWithdrawalSpeed:row.axialWithdrawalSpeed,outputSpeedDeparture:row.outputSpeedDeparture,
  nativeGap:directions.at(-1).nativeGap,energyResidual:row.energyResidual});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,rows,
 qualification:'First impact of the returning native E stud against G after loaded seating and held rotation. All four coordinates remain independent; neither clutch engagement nor output speed is imposed at impact. A positive axial withdrawal speed means this triangular-jaw/frictionless-shifter hypothesis cams out when the next lifting stroke begins. The seated cusp uses the measured linear jaw profile; native directional checks independently screen the outgoing direction.'})+'\n',{flag:'wx'});
for(const r of rows){
 assert(Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.energyResidual)<1e-9);
 assert(r.active.every(c=>c.impulse>=0)&&r.directionalChecks.at(-1).nativeGap> -1e-6);
}
