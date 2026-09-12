import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchInertia} from './lib/weighted-clutch-inertia.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-flight-check',
 prefixes=['087-first-flight','087-half-step-flight','087-quarter-step-flight','087-eighth-step-flight','087-sixteenth-step-flight'].map(p=>'artifacts/review/'+p),
 reports=prefixes.map(p=>readStudyReport(p+'.json')),model=makeWeightedClutchLostMotionCandidate(),
 inertia=makeWeightedClutchInertia(model),native=makeWeightedClutchNativeStud(model),
 sources=freezeStudySources([...reports[0].sources.map(s=>s.file),'scripts/check-weighted-clutch-flight.mjs',
  ...prefixes.flatMap(p=>[p+'.json',p+'-CCW.json.gz',p+'-CW.json.gz'])],prefix),branches=[];
for(const r of reports)verifyStudySources(r.sources);

function at(rows,time){
 let low=0,high=rows.length-1;
 if(time>rows.at(-1).time+1e-12)throw Error('Time outside trajectory');
 while(high-low>1){const middle=(low+high)>>1;if(rows[middle].time<=time)low=middle;else high=middle;}
 const a=rows[low],b=rows[high],t=(time-a.time)/(b.time-a.time);
 return {q:a.q+(b.q-a.q)*t,v:a.v+(b.v-a.v)*t,e:a.e+(b.e-a.e)*t};
}
function rk4(q,v,h){
 const f=([q,v])=>[v,inertia.freeAcceleration(q,v)],a=f([q,v]),b=f([q+h*a[0]/2,v+h*a[1]/2]),
  c=f([q+h*b[0]/2,v+h*b[1]/2]),d=f([q+h*c[0],v+h*c[1]]);
 return [q+h*(a[0]+2*b[0]+2*c[0]+d[0])/6,v+h*(a[1]+2*b[1]+2*c[1]+d[1])/6];
}
for(const direction of ['CCW','CW']){
 const inputs=prefixes.map(p=>readStudyReport(p+'-'+direction+'.json.gz')),fine=inputs.at(-1),rows=fine.rows,
  comparisons=[];
 for(let level=1;level<inputs.length;level++){
  const a=inputs[level-1],b=inputs[level];let maximumAngleError=0,maximumVelocityError=0,maximumWeightError=0;
  // Compare every finer knot on the common physical clock. A sphere's center
  // displacement is an independent visible-position measure, not a bound on
  // every part or an exact continuum error estimate.
  const radius=Math.hypot(...inertia.parameters.weight.centroid.slice(0,2));
  for(const r of b.rows){
   if(r.time>a.end.time)break;const old=at(a.rows,r.time),error=Math.abs(old.q-r.q);
   maximumAngleError=Math.max(maximumAngleError,error);maximumVelocityError=Math.max(maximumVelocityError,Math.abs(old.v-r.v));
   maximumWeightError=Math.max(maximumWeightError,2*radius*Math.sin(error/2)*300);
  }
  comparisons.push({coarseStep:a.h,fineStep:b.h,maximumAngleError,maximumVelocityError,maximumWeightErrorPixels:maximumWeightError,
   endpointTimeError:Math.abs(a.end.time-b.end.time),endpointVelocityError:Math.abs(a.end.v-b.end.v),
   signedDefectRatio:b.relativeDefect/a.relativeDefect,absoluteDefectRatio:b.relativeAbsoluteDefect/a.relativeAbsoluteDefect,
   coarseEvents:a.events.length,fineEvents:b.events.length});
 }
 let minimumGap=Infinity,maximumGapError=0,minimumCutDistance=Infinity,minimumImpulse=Infinity,
  maximumMomentumResidual=0,maximumClosingVelocity=0,maximumComplementarity=0;
 const indices=new Set(Array.from({length:1025},(_,i)=>Math.round((rows.length-1)*i/1024)));
 for(let i=0;i<rows.length;i++){
  const r=rows[i],before=rows[Math.max(0,i-1)],m=inertia.linkage(before.q),free=i===0?0:
   before.v-r.h*(.5*m.inertiaDerivative*before.v**2+m.potentialDerivative)/m.inertia,
   impulse=r.active.reduce((s,c)=>s+c.impulse*c.gradient,0);
  maximumMomentumResidual=Math.max(maximumMomentumResidual,Math.abs(m.inertia*(r.v-free)-impulse));
  for(const c of r.active){
   minimumImpulse=Math.min(minimumImpulse,c.impulse);
   const rate=c.gradient*r.v+c.inputGradient*fine.parameters.omega;
   maximumClosingVelocity=Math.max(maximumClosingVelocity,-rate);
   maximumComplementarity=Math.max(maximumComplementarity,Math.abs(c.impulse*rate));
  }
  if(i>0&&!!r.active.length!==!!before.active.length)indices.add(i);
 }
 for(const i of indices){
  const r=rows[i],c=native.evaluate(r.q,r.e);
  minimumGap=Math.min(minimumGap,c.gap);maximumGapError=Math.max(maximumGapError,Math.abs(c.gap-r.gap));
  if(r.active.some(c=>c.kind==='stud'))minimumCutDistance=Math.min(minimumCutDistance,c.contactForwardCoordinate-native.parameters.cut);
 }
 // Independently integrate the final unforced flight with classical RK4.
 // This starts at the solver's last contact and checks its free trajectory;
 // it does not independently establish the preceding release event.
 let lastContact=rows.length-1;while(lastContact>0&&!rows[lastContact].active.length)lastContact--;
 const release=rows[lastContact];let q=release.q,v=release.v,time=release.time,maximumFreeAngleError=0,maximumFreeVelocityError=0;
 for(let i=lastContact+1;i<rows.length;i++){
  const r=rows[i];[q,v]=rk4(q,v,r.time-time);time=r.time;
  maximumFreeAngleError=Math.max(maximumFreeAngleError,Math.abs(q-r.q));maximumFreeVelocityError=Math.max(maximumFreeVelocityError,Math.abs(v-r.v));
 }
 const energy=(q,v)=>{const k=inertia.linkage(q);return k.potential+.5*k.inertia*v*v;},
  freeEnergyDrift=Math.abs(energy(q,v)-energy(release.q,release.v)),
  result={direction,states:rows.length,comparisons,nativeSamples:indices.size,minimumGap,maximumGapError,minimumCutDistance,
   minimumImpulse,maximumMomentumResidual,maximumClosingVelocity,maximumComplementarity,lastContact,
   lastContactTime:release.time,maximumFreeAngleError,maximumFreeVelocityError,freeEnergyDrift,
   endpointTime:fine.end.time,endpointVelocity:fine.end.v,relativeDefect:fine.relativeDefect,relativeAbsoluteDefect:fine.relativeAbsoluteDefect};
 branches.push(result);console.log(result);
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
 sources,branches,qualification:'Five-step common-clock convergence, unilateral momentum/impulse checks at all finest states, independent exhaustive native polygon checks at sampled states and contact transitions, and independent RK4 integration of each final free flight. No exact continuum error, full surrounding clearance or clutch reversal qualification.'},null,2)+'\n',{flag:'wx'});
for(const b of branches){
 assert(b.minimumGap> -2e-9&&b.maximumGapError<1e-12&&b.minimumCutDistance>.2&&b.minimumImpulse>=0);
 assert(b.maximumMomentumResidual<1e-10&&b.maximumClosingVelocity<1e-10&&b.maximumComplementarity<1e-10);
 assert(b.relativeAbsoluteDefect<.001&&b.freeEnergyDrift<1e-9);
 assert(b.comparisons.at(-1).maximumWeightErrorPixels<.25&&b.comparisons.at(-1).endpointVelocityError<.001);
 assert(b.maximumFreeAngleError<.001&&b.maximumFreeVelocityError<.002);
 for(const c of b.comparisons)assert(c.absoluteDefectRatio<.65);
}
