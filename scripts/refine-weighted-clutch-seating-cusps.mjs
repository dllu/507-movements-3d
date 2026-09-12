import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-refined-seating-cusps',
 inputs=['087-reused-forward-seating-profile','087-wide-return-seating-profile'].map(n=>'artifacts/review/'+n+'.json'),
 parents=inputs.map(readStudyReport),sources=freezeStudySources([...parents.flatMap(r=>r.sources.map(s=>s.file)),...inputs,
  'scripts/refine-weighted-clutch-seating-cusps.mjs'],prefix),model=makeWeightedClutchIndependentCandidate(),
 jaws=makeWeightedClutchNativeJaws(model),profiles=[],rows=[];
for(const parent of parents){
 verifyStudySources(parent.sources);const profile=parent.profiles[0],cache=new Map(),sample=angle=>{
  if(cache.has(angle))return cache.get(angle);
  const q=jaws.evaluate(profile.side,angle),r={angle,gap:q.gap,triangles:[q.witness.looseTriangle,q.witness.slidingTriangle]};
  cache.set(angle,r);return r;
 };
 let lo=profile.peak.angle-2e-5,hi=profile.peak.angle+2e-5;
 const ratio=(Math.sqrt(5)-1)/2;
 let a=hi-ratio*(hi-lo),b=lo+ratio*(hi-lo),ga=sample(a),gb=sample(b);
 for(let i=0;i<52;i++){
  if(ga.gap<gb.gap){lo=a;a=b;ga=gb;b=lo+ratio*(hi-lo);gb=sample(b);}
  else{hi=b;b=a;gb=ga;a=hi-ratio*(hi-lo);ga=sample(a);}
 }
 sample((lo+hi)/2);const peak=[...cache.values()].reduce((a,b)=>a.gap>b.gap?a:b),
  left=sample(peak.angle-1e-6),right=sample(peak.angle+1e-6),
  slopes={left:(peak.gap-left.gap)/1e-6,right:(right.gap-peak.gap)/1e-6},checks=[];
 for(const h of [1e-7,1e-8])checks.push({h,left:(peak.gap-sample(peak.angle-h).gap)/h,
  right:(sample(peak.angle+h).gap-peak.gap)/h});
 assert(slopes.left>0&&slopes.right<0);assert(checks.every(c=>Math.abs(c.left-slopes.left)<1e-4&&Math.abs(c.right-slopes.right)<1e-4));
 const knots=[...profile.knots.filter(k=>k.angle<left.angle||k.angle>right.angle),left,peak,right].sort((a,b)=>a.angle-b.angle),
  result={...profile,knots,peak,cuspRefined:true,cuspSlopes:slopes,cuspBracket:[lo,hi]};
 profiles.push(result);rows.push({direction:profile.direction,previousPeak:profile.peak,peak,
  phaseCorrection:peak.angle-profile.peak.angle,gapCorrection:peak.gap-profile.peak.gap,slopes,checks,queries:[...cache.values()]});
 console.log(rows.at(-1));
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,profiles,rows,
 qualification:'Native maximization near each seated cusp, with one-sided derivatives checked at three scales. Replaces the former chord spanning the sharp maximum; a sub-microunit gap approximation was insufficient to qualify its contact-normal cone. Other profile intervals retain their original sampled error qualification.'})+'\n',{flag:'wx'});
