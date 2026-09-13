import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-reused-left-key-seating',input='artifacts/review/087-first-key-jaw-impact.json',
 impacts=readStudyReport(input),oldFile='artifacts/review/087-refined-seating-cusps.json',old=readStudyReport(oldFile),
 sources=freezeStudySources([...impacts.sources.map(s=>s.file),...old.sources.map(s=>s.file),input,oldFile,
  'scripts/prepare-weighted-clutch-left-key-seating.mjs'],prefix),impact=impacts.rows.find(r=>r.side==='left'),
 previous=old.profiles.find(p=>p.side==='left'),center=Math.round(impact.relativeAngle/(Math.PI/6))*Math.PI/6,
 offset=Math.round((center-previous.peak.angle)/(2*Math.PI))*2*Math.PI,model=makeWeightedClutchKeyCandidate(),
 jaws=makeWeightedClutchNativeJaws(model),periodChecks=[],samples=[];
const sample=angle=>{const q=jaws.evaluate('left',angle),r={angle,gap:q.gap,triangles:[q.witness.looseTriangle,q.witness.slidingTriangle]};samples.push(r);return r;},
 shifted=previous.knots.map(k=>({...k,angle:k.angle+offset})),exact=[-1e-6,0,1e-6].map(d=>sample(impact.relativeAngle+d));
for(let i=0;i<=32;i++){
 const knot=previous.knots[Math.floor((previous.knots.length-1)*i/32)],query=sample(knot.angle+offset);
 periodChecks.push({angle:query.angle,error:Math.abs(query.gap-knot.gap)});
}
const profile={...previous,direction:impact.direction,start:impact.relativeAngle,center,input0:impact.originalProfile.input0,
 omegaInput:impact.originalProfile.omegaInput,impactTime:impact.time,queries:samples.length,
 knots:[...shifted.filter(k=>k.angle<exact[0].angle||k.angle>exact[2].angle),...exact].sort((a,b)=>a.angle-b.angle),
 peak:{...previous.peak,angle:previous.peak.angle+offset},low:shifted[0].angle,high:shifted.at(-1).angle,
 fullRotationReuse:{offset,periodChecks}};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,
 sources,profiles:[profile],samples,qualification:'Independent preparation of the left jaw while the unrelated right tooth is measured. Reuses the native profile by two complete rigid rotations and inserts the exact reached impact angle and local derivative samples. No tooth-pitch symmetry is assumed.'})+'\n',{flag:'wx'});
assert(periodChecks.every(c=>c.error<1e-12)&&impact.relativeAngle>profile.low&&impact.relativeAngle<profile.high);
console.log({side:profile.side,offset,knots:profile.knots.length,maxPeriodError:Math.max(...periodChecks.map(c=>c.error))});
