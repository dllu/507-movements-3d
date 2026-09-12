import fs from 'node:fs';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {makePumpCatchNormalContact} from './lib/pump-catch-normal-contact.mjs';
import {makePumpCatchSlackDynamics,pumpCatchImpactStep} from './lib/pump-catch-impact-dynamics.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-corner-seed-controls',input='artifacts/review/086-exact-face-half-ms-impact.json.gz',data=readStudyReport(input);
for(const s of data.sources)if(hashStudyFile(s.archive??s.file)!==s.sha256)throw Error('Changed historical input: '+s.file);
const sources=freezeStudySources([input,'scripts/check-pump-catch-corner-seed.mjs',...data.sources.map(s=>s.file)],prefix),model=makePumpCatchCandidate(),contact=makePumpCatchNormalContact(model),dynamics=makePumpCatchSlackDynamics(model,data.parameters);
const selected=data.rows.map((r,i)=>({r,i})).filter(({r,i})=>i&&i<data.rows.length-1&&(i%71===0||r.cornerClosure&&data.rows[i+1].iterations!==25)).slice(0,140),
  errors={q:0,v:0,transport:0,savedQ:0,savedV:0},timing={seeded:0,ordinary:0},counts={poses:0,seeded:0,fallbacksAvoided:0},issues=[];
for(const{r:before,i}of selected){
  const saved=data.rows[i+1],h=saved.time-before.time;let start=performance.now(),ordinary=pumpCatchImpactStep(dynamics,contact,before,saved.time,h,data.angularSpeed,{seedCorner:false});timing.ordinary+=performance.now()-start;
  start=performance.now();const seeded=pumpCatchImpactStep(dynamics,contact,before,saved.time,h,data.angularSpeed);timing.seeded+=performance.now()-start;counts.poses++;
  if(before.cornerClosure)counts.seeded++;if(ordinary.iterations===25&&seeded.iterations<25)counts.fallbacksAvoided++;
  if(ordinary.failed||seeded.failed){issues.push({time:saved.time,ordinary:ordinary.failed,seeded:seeded.failed});continue;}
  for(let k=0;k<3;k++){
    errors.q=Math.max(errors.q,Math.abs(seeded.q[k]-ordinary.q[k]));errors.v=Math.max(errors.v,Math.abs(seeded.v[k]-ordinary.v[k]));
    errors.transport=Math.max(errors.transport,Math.abs(seeded.transportVelocity[k]-ordinary.transportVelocity[k]));
    errors.savedQ=Math.max(errors.savedQ,Math.abs(ordinary.q[k]-saved.q[k]));errors.savedV=Math.max(errors.savedV,Math.abs(ordinary.v[k]-saved.v[k]));
  }
}
verifyStudySources(sources);const passed=!issues.length&&counts.seeded>0&&counts.fallbacksAvoided>0&&Object.values(errors).every(e=>e<1e-7),report={movement:86,status:'retained-corner-initial-guess-regression',passed,mechanicsPassed:false,candidateIntegrated:false,
  counts,errors,timing,observedSpeedup:timing.ordinary/timing.seeded,issues,sources,
  qualification:'The retained corner changes the position solver initial guess only. Both paths must satisfy the same unilateral projection and finite-gap checks. Ordinary stepping is checked against saved pre-optimization states, including engagement, release and free motion. One-step numerical agreement is not a full trajectory or continuum-error qualification.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!passed)process.exitCode=1;
