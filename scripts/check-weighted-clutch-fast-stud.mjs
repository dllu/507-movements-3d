import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchFastStud} from './lib/weighted-clutch-fast-stud.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-fast-stud',parent=readStudyReport('artifacts/review/087-native-contact-checkpoint.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')),
  'scripts/check-weighted-clutch-fast-stud.mjs','scripts/lib/weighted-clutch-fast-stud.mjs'],prefix),
 model=makeWeightedClutchLostMotionCandidate(),fast=makeWeightedClutchFastStud(model),end=model.root.userData.lostMotion.parameters.leverLeft,rows=[];
let seed=87341,maximumGapError=0,maximumGradientError=0,ambiguous=0;
const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<1024;i++){
 const q=end*random(),e=2*Math.PI*(random()*4-2),a=fast.evaluate(q,e),b=fast.slow.evaluate(q,e),gapError=Math.abs(a.gap-b.gap),h=1e-6;
 const jq=(fast.slow.evaluate(q+h,e).gap-fast.slow.evaluate(q-h,e).gap)/(2*h),
  je=(fast.slow.evaluate(q,e+h).gap-fast.slow.evaluate(q,e-h).gap)/(2*h),gradientError=Math.max(Math.abs(jq-a.gradientLever),Math.abs(je-a.gradientWheel));
 maximumGapError=Math.max(maximumGapError,gapError);maximumGradientError=Math.max(maximumGradientError,gradientError);if(a.ambiguous)ambiguous++;
 rows.push({q,e,gap:a.gap,referenceGap:b.gap,gapError,gradientError});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,sources,rows,maximumGapError,maximumGradientError,ambiguous,mechanicsPassed:false,
 qualification:'Seeded full-angle comparison of the rotating-caliper query with the independent exhaustive native separating-axis query, including finite-difference gradients away from contact. This qualifies the query on these cases, not a physical trajectory.'},null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,maximumGapError,maximumGradientError,ambiguous});
assert(maximumGapError<1e-12&&maximumGradientError<1e-6&&!ambiguous);
