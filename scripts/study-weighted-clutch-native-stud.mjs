import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {weightedClutchStudContacts} from './lib/weighted-clutch-stud-contact.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-native-stud',steps=Number(process.env.PROBE_STEPS??128),
 baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 parent=readStudyReport('artifacts/review/087-lost-motion-checkpoint.json'),
 files=parent.sources.map(s=>s.file).filter(f=>!f.endsWith('.md')),
 sources=freezeStudySources([...files,'scripts/study-weighted-clutch-native-stud.mjs','scripts/lib/weighted-clutch-native-stud.mjs'],prefix);
assert(Number.isInteger(steps)&&steps>=2);verify();
const model=makeWeightedClutchLostMotionCandidate(),u=model.root.userData,native=makeWeightedClutchNativeStud(model),
 initial=native.evaluate(0,0),rows=[];
let minimumForward=Infinity,minimumReturn=Infinity,maximumResidual=0,maximumAngleCorrection=0,minimumCutDistance=Infinity;
for(const direction of ['CCW','CW'])for(let i=0;i<=steps;i++){
 const q=direction==='CCW'?u.linkage.parameters.overCenterAngle*i/steps:
  u.lostMotion.parameters.leverLeft-(u.lostMotion.parameters.leverLeft-u.linkage.parameters.overCenterAngle)*i/steps,
  analytic=weightedClutchStudContacts(u.linkage,q).contacts.filter(c=>c['approach'+direction]);
 assert.equal(analytic.length,1);const r=native.root(q,analytic[0].theta,direction),sign=direction==='CCW'?1:-1,
  before=native.evaluate(q,r.wheelAngle-sign*1e-5),after=native.evaluate(q,r.wheelAngle+sign*1e-5),usefulMoment=-sign*r.torqueG;
 assert(before.gap>0&&after.gap<0);assert(sign*r.derivativeE<0);assert(usefulMoment>0);
 if(direction==='CCW')minimumForward=Math.min(minimumForward,usefulMoment);else minimumReturn=Math.min(minimumReturn,usefulMoment);
 maximumResidual=Math.max(maximumResidual,Math.abs(r.gap));maximumAngleCorrection=Math.max(maximumAngleCorrection,Math.abs(r.angleCorrection));
 minimumCutDistance=Math.min(minimumCutDistance,r.contactForwardCoordinate-native.parameters.cut);
 rows.push({...r,usefulMoment,beforeGap:before.gap,afterGap:after.gap});
}
verify();verifyStudySources(sources);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,steps,
 parameters:native.parameters,initial,minimumForward,minimumReturn,maximumResidual,maximumAngleCorrection,minimumCutDistance,rows,
 qualification:'Native convex polygon stud contact on both sampled lifting branches of the 75-pixel candidate. Separating-axis roots include the stud polygon rotating with E. Entry direction and useful unit-force moment are checked; no force/inertia/gravity integration or complete driven-hardware clearance is claimed. The earlier all-pair surface samples can miss contact between long edges.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,initialGap:initial.gap,minimumForward,minimumReturn,maximumResidual,maximumAngleCorrection,minimumCutDistance});
assert(maximumResidual<1e-11&&minimumCutDistance>.2);
