import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {makeWeightedClutchLoadedSeating} from './lib/weighted-clutch-loaded-seating.mjs';
import {projectClutchSeatingVelocity} from './lib/weighted-clutch-seating-contact.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-loaded-seating-check',
 base=process.env.PROBE_FINE??'artifacts/review/087-quarter-step-seating',
 coarseBase=process.env.PROBE_COARSE??'artifacts/review/087-first-step-seating',
 profileFile=process.env.PROBE_PROFILE??'artifacts/review/087-loaded-seating-profiles.json',profiles=readStudyReport(profileFile),
 inputs=['CCW','CW'].flatMap(d=>[base+'-'+d+'.json.gz',coarseBase+'-'+d+'.json.gz']),reports=inputs.map(readStudyReport),
 impactFile='artifacts/review/087-first-gravity-jaw-impact.json',impacts=readStudyReport(impactFile),
 sources=freezeStudySources([...reports[0].sources.map(s=>s.file),...inputs,impactFile,
  'scripts/check-weighted-clutch-loaded-seating.mjs'],prefix),model=makeWeightedClutchIndependentCandidate(),
 jaws=makeWeightedClutchNativeJaws(model),branches=[];
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
for(const r of reports)verifyStudySources(r.sources);
// A known four-contact physical equilibrium, independently assembled from
// compressive slot, fork and opposing jaw forces, exercises the added rank.
const mass=[2,3,5,7],J=[[-1,1,0,0],[0,-2,-1,0],[0,0,1,-.3],[0,0,1,.3]],lambda=[4,2,1,1],
 target=[0,0,.036,-.036],want=[0,0,0,-.12],free=want.map((v,k)=>v-J.reduce((s,r,i)=>s+r[k]*lambda[i]/mass[k],0)),
 known=projectClutchSeatingVelocity(free,mass,J.map((gradient,i)=>({gradient,target:target[i]})));
assert.equal(known.active.length,4);assert(known.v.every((v,k)=>Math.abs(v-want[k])<1e-12));
function interpolate(report,time){
 let lo=0,hi=report.rows.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(report.rows[m].time<time)lo=m;else hi=m;}
 const a=report.rows[lo],b=report.rows[hi],f=(time-a.time)/(b.time-a.time);
 return a.q.map((v,k)=>v+f*(b.q[k]-v));
}
for(const direction of ['CCW','CW']){
 const fine=reports.find((r,i)=>r.direction===direction&&inputs[i].startsWith(base+'-')),
  coarse=reports.find((r,i)=>r.direction===direction&&inputs[i].startsWith(coarseBase+'-')),
  profile=profiles.profiles.find(p=>p.direction===direction),impact=impacts.rows.find(r=>r.direction===direction),
  d=makeWeightedClutchLoadedSeating(model,impact,profile),nativeSamples=[],commonClock=[];
 assert(!fine.error&&fine.seat&&!coarse.error&&coarse.seat);
 let maximumMomentumResidual=0,maximumClosingRate=0,maximumComplementarity=0,minimumImpulse=Infinity,minimumGap=Infinity,
  maximumWorkResidual=0,maximumEnergyLedgerResidual=0,contactLoss=0,negativeContactLoss=0,
  contactWorkDefect=0,absoluteContactWorkDefect=0;
 for(let i=1;i<fine.rows.length;i++){
  const r=fine.rows[i],before=fine.rows[i-1],m=d.mass(before.q),contacts=d.query(r.q,r.time),
   momentum=r.v.map((v,k)=>m[k]*(v-r.freeVelocity[k])-r.active.reduce((s,c)=>s+c.impulse*c.gradient[k],0)),
   work=r.active.reduce((s,c)=>s-c.impulse*c.inputGradient*d.parameters.omegaInput,0),
   // Trapezoidal physical-velocity contact work distinguishes actual contact
   // dissipation from the O(h^2) removal of each constrained gravity kick.
   dissipation=r.active.reduce((s,c)=>s+c.impulse*(c.target-.5*dot(c.gradient,before.v.map((v,k)=>v+r.v[k]))),0),
   residual=r.energy-before.energy-work+dissipation;
  contactLoss+=dissipation;negativeContactLoss+=Math.min(0,dissipation);
  contactWorkDefect+=residual;absoluteContactWorkDefect+=Math.abs(residual);
  maximumMomentumResidual=Math.max(maximumMomentumResidual,...momentum.map(Math.abs));
  maximumWorkResidual=Math.max(maximumWorkResidual,Math.abs(r.work-before.work-work));
  maximumEnergyLedgerResidual=Math.max(maximumEnergyLedgerResidual,
   Math.abs(r.energy-fine.start.energy-r.work+r.loss-r.defect));
  minimumGap=Math.min(minimumGap,...contacts.map(c=>c.gap));
  for(const c of r.active){
   minimumImpulse=Math.min(minimumImpulse,c.impulse);
   const rate=dot(c.gradient,r.v)+c.inputGradient*d.parameters.omegaInput;
   maximumClosingRate=Math.max(maximumClosingRate,-rate);maximumComplementarity=Math.max(maximumComplementarity,Math.abs(c.impulse*rate));
  }
 }
 // These are full native projected-triangle intersections at off-step
 // interpolated trajectory times, independently of the seating table.
 for(let i=0;i<=128;i++){
  const time=fine.end.time*(i===128?128:i+.381)/128,q=interpolate(fine,time),phase=d.phase(q,time),
   actual=['left','right'].map(side=>jaws.evaluate(side,q[3]+(side==='left'?-1:1)*model.root.userData.geometry.mainRatio*phase.input,q[2])),
   approx=d.jaw.evaluate(phase.relative,q[2]);
  nativeSamples.push({time,q,phase,jaws:actual,approximateGap:Math.min(...approx.map(c=>c.gap)),
   error:actual.find(j=>j.side===profile.side).gap-Math.min(...approx.map(c=>c.gap))});
  if(i%32===0)console.log({direction,nativeSamples:i+1});
 }
 for(let i=0;i<=1024;i++){
  const time=Math.min(fine.end.time,coarse.end.time)*i/1024,a=interpolate(fine,time),b=interpolate(coarse,time);
  commonClock.push({time,error:a.map((v,k)=>v-b[k])});
 }
 const result={direction,states:fine.rows.length,h:fine.h,coarseH:coarse.h,maximumMomentumResidual,maximumClosingRate,
  maximumComplementarity,minimumImpulse,minimumGap,maximumWorkResidual,maximumEnergyLedgerResidual,
  contactLoss,negativeContactLoss,contactWorkDefect,absoluteContactWorkDefect,
  relativeAbsoluteDefect:fine.relativeAbsoluteDefect,absoluteDefectRatio:fine.end.absoluteDefect/coarse.end.absoluteDefect,
  seatTimeDifference:Math.abs(fine.seat.time-coarse.seat.time),
  settlingTimeResolvedToFiveMilliseconds:Math.abs(fine.seat.time-coarse.seat.time)<.005,
  maximumCommonClockError:[0,1,2,3].map(k=>Math.max(...commonClock.map(r=>Math.abs(r.error[k])))),
  minimumNativeGap:Math.min(...nativeSamples.flatMap(s=>s.jaws.map(j=>j.gap))),
  maximumProfileError:Math.max(...nativeSamples.map(s=>Math.abs(s.error))),nativeSamples,commonClock,
  seat:{time:fine.seat.time,q:fine.seat.q,v:fine.seat.v},end:{time:fine.end.time,q:fine.end.q,v:fine.end.v}};
 branches.push(result);console.log({...result,nativeSamples:result.nativeSamples.length,commonClock:result.commonClock.length});
}
verifyStudySources(sources);const baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json');
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,known,branches,
 qualification:'All fine-step momentum, compressive impulses, motor work and energy-ledger checks; common-clock comparisons; complete native jaw-front intersection checks at 129 off-step times per direction. Projection cost includes removal of constrained gravity kicks and is not solely physical impact loss. The separate trapezoidal contact-work ledger retains its signed discretization residual. Final settling time is explicitly not resolved when the five-millisecond comparison fails. Jaw interpolation and time discretization remain sampled numerical evidence. No full reversal or production acceptance.'})+'\n',{flag:'wx'});
for(const b of branches){
 assert(b.maximumMomentumResidual<1e-9&&b.maximumClosingRate<1e-8&&b.maximumComplementarity<1e-8&&b.minimumImpulse>=0&&b.minimumGap> -2e-9);
 assert(b.maximumWorkResidual<1e-9&&b.maximumEnergyLedgerResidual<1e-8);
 assert(b.minimumNativeGap> -1e-6&&b.maximumProfileError<1e-6);
 assert(b.absoluteDefectRatio<.6);
}
