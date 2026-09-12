import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchNativeCouplings} from './lib/weighted-clutch-native-couplings.mjs';
import {makeWeightedClutchInertia} from './lib/weighted-clutch-inertia.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {weightedClutchJawBounds} from './lib/weighted-clutch-jaw-bound.mjs';
import {makeWeightedClutchOutputGravity} from './lib/weighted-clutch-output-gravity.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-gravity-shift-check',
 prefixes=['first','quarter-step','sixteenth-step'].map(p=>'artifacts/review/087-'+p+'-gravity-shift'),reports=prefixes.map(p=>readStudyReport(p+'.json')),
 sources=freezeStudySources([...reports[0].sources.map(s=>s.file),'scripts/check-weighted-clutch-gravity-shift.mjs',
  ...prefixes.flatMap(p=>[p+'.json',p+'-CCW.json.gz',p+'-CW.json.gz'])],prefix),
 model=makeWeightedClutchIndependentCandidate(),inertia=makeWeightedClutchInertia(model),coupling=makeWeightedClutchNativeCouplings(model),
 jaws=makeWeightedClutchNativeJaws(model),bounds=weightedClutchJawBounds(model),outputGravity=makeWeightedClutchOutputGravity(model,inertia),branches=[],jawSamples=[];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),at=(rows,time)=>{
 let low=0,high=rows.length-1;while(high-low>1){const m=(low+high)>>1;if(rows[m].time<=time)low=m;else high=m;}
 const a=rows[low],b=rows[high],t=(time-a.time)/(b.time-a.time);return a.q.map((v,i)=>v+t*(b.q[i]-v));
};
for(const direction of ['CCW','CW']){
 const inputs=prefixes.map(p=>readStudyReport(p+'-'+direction+'.json.gz')),fine=inputs.at(-1),comparisons=[];
 for(const r of inputs)verifyStudySources(r.sources);
 for(let level=1;level<inputs.length;level++){
  const a=inputs[level-1],b=inputs[level],maximumPositionError=[0,0,0,0];
  for(const r of b.rows){if(r.time>a.end.time)break;const old=at(a.rows,r.time);for(let i=0;i<4;i++)maximumPositionError[i]=Math.max(maximumPositionError[i],Math.abs(r.q[i]-old[i]));}
  comparisons.push({coarseStep:a.h,fineStep:b.h,maximumPositionError,endpointTimeDifference:Math.abs(a.end.time-b.end.time),
   endpointVelocityDifference:Math.max(...b.end.v.map((v,i)=>Math.abs(v-a.end.v[i]))),
   absoluteEnergyDefectRatio:b.relativeAbsoluteDefect/a.relativeAbsoluteDefect});
 }
 let maximumMomentumResidual=0,maximumClosingRate=0,maximumComplementarity=0,minimumGap=Infinity,minimumImpulse=Infinity;
 for(let i=1;i<fine.rows.length;i++){
  const r=fine.rows[i],before=fine.rows[i-1],m=[inertia.linkage(before.q[0]).inertia,inertia.parameters.bodies.shifter.inertia,inertia.parameters.bodies.D.mass,fine.parameters.outputInertia],
   free=[before.v[0]+r.h*inertia.freeAcceleration(before.q[0],before.v[0]),before.v[1]-r.h*inertia.shifter(before.q[1]).potentialDerivative/m[1],before.v[2],
    before.v[3]-r.h*outputGravity.at(before.q[3]).derivative/m[3]];
  for(let k=0;k<4;k++)maximumMomentumResidual=Math.max(maximumMomentumResidual,Math.abs(m[k]*(r.v[k]-free[k])-r.active.reduce((s,c)=>s+c.impulse*c.gradient[k],0)));
  for(const c of r.active){const rate=dot(c.gradient,r.v)+c.inputGradient*fine.parameters.omegaE;minimumImpulse=Math.min(minimumImpulse,c.impulse);
   maximumClosingRate=Math.max(maximumClosingRate,-rate);maximumComplementarity=Math.max(maximumComplementarity,Math.abs(c.impulse*rate));}
  minimumGap=Math.min(minimumGap,...coupling.query(r.q).map(c=>c.gap));
  if(r.jaw.exact)assert(r.jaw.gap>=r.jaw.lowerBound-1e-10);else assert(r.jaw.lowerBound>0);
 }
 branches.push({direction,states:fine.rows.length,comparisons,maximumMomentumResidual,maximumClosingRate,maximumComplementarity,minimumGap,minimumImpulse,
  relativeDefect:fine.relativeDefect,relativeAbsoluteDefect:fine.relativeAbsoluteDefect,endpoint:fine.end,retarget:fine.parameters.retarget});
}
let seed=87093;
for(const side of ['left','right'])for(let i=0;i<16;i++){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const delta=2*Math.PI*(seed/2**32-.5),r=jaws.evaluate(side,delta),ideal=bounds.ideal(side,delta),error=r.gap-ideal;
 jawSamples.push({side,delta,gap:r.gap,ideal,error,bound:bounds.error(side)});assert(Math.abs(error)<=bounds.error(side));
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,branches,jawSamples,jawBounds:bounds.fronts,
   qualification:'Three-step four-coordinate gravity-shift convergence, all finest-state impulse/momentum and native slot/fork checks, plus off-grid full-angle native jaw comparisons against the analytic separation bound. Includes eccentric output gravity. Stops at first opposite-jaw contact; it does not qualify subsequent loaded seating or complete reversal.'},null,2)+'\n',{flag:'wx'});
for(const b of branches){
 console.log({direction:b.direction,states:b.states,comparisons:b.comparisons,maximumMomentumResidual:b.maximumMomentumResidual,minimumGap:b.minimumGap,relativeAbsoluteDefect:b.relativeAbsoluteDefect});
 assert(b.maximumMomentumResidual<1e-9&&b.maximumClosingRate<1e-9&&b.maximumComplementarity<1e-9&&b.minimumGap> -2e-9&&b.minimumImpulse>=0);
 assert(b.relativeAbsoluteDefect<.0001&&b.comparisons.at(-1).endpointTimeDifference<2e-5&&b.comparisons.at(-1).endpointVelocityDifference<1e-4);
 assert(b.comparisons.every(c=>c.absoluteEnergyDefectRatio<.4));
}
