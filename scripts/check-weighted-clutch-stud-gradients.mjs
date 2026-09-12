import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-stud-gradients',
 input='artifacts/review/087-first-native-stud.json',report=readStudyReport(input),
 sources=freezeStudySources([...report.sources.map(s=>s.file),'scripts/check-weighted-clutch-stud-gradients.mjs',input],prefix),
 model=makeWeightedClutchLostMotionCandidate(),native=makeWeightedClutchNativeStud(model),L=model.root.userData.linkage.parameters,
 cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((v,i)=>v-b[i]),rows=[];
let maximumWheelError=0,maximumLeverError=0,minimumUsefulLeverMoment=Infinity;
for(const row of report.rows){
 const {leverAngle:q,wheelAngle:e}=row,state=model.root.userData.linkage.atAngle(q),rod=sub(state.B,state.A),
  derivativeG=cross(sub(state.A,L.F),rod)/cross(sub(state.B,L.G),rod),expectedLever=row.torqueG*derivativeG,h=1e-7,
  numericWheel=(native.evaluate(q,e+h).gap-native.evaluate(q,e-h).gap)/(2*h),
  numericLever=(native.evaluate(q+h,e).gap-native.evaluate(q-h,e).gap)/(2*h),
  wheelError=Math.abs(numericWheel-row.derivativeE),leverError=Math.abs(numericLever-expectedLever),
  usefulLeverMoment=(row.direction==='CCW'?1:-1)*expectedLever;
 maximumWheelError=Math.max(maximumWheelError,wheelError);maximumLeverError=Math.max(maximumLeverError,leverError);
 minimumUsefulLeverMoment=Math.min(minimumUsefulLeverMoment,usefulLeverMoment);
 rows.push({direction:row.direction,q,e,derivativeG,expectedWheel:row.derivativeE,numericWheel,wheelError,
  expectedLever,numericLever,leverError,usefulLeverMoment});
}
verifyStudySources(sources);
const result={movement:87,input:{file:input,sha256:hashStudyFile(input)},sources,rows,maximumWheelError,maximumLeverError,minimumUsefulLeverMoment,
 mechanicsPassed:false,qualification:'Independent central differences of native separating-axis gaps against virtual-work moments and the differentiated fixed-rod constraint. This checks local force transmission signs; it is not a dynamics solution.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,maximumWheelError,maximumLeverError,minimumUsefulLeverMoment});
assert(maximumWheelError<1e-5&&maximumLeverError<1e-5&&minimumUsefulLeverMoment>0);
