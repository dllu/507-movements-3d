import fs from 'node:fs';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {makePumpCatchNormalContact} from './lib/pump-catch-normal-contact.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-return-penetration-guard',input='artifacts/review/086-finite-rope-dynamics.json.gz',data=readStudyReport(input),
  overlap=readStudyReport('artifacts/review/086-finite-rope-triangle-overlap.json'),model=makePumpCatchCandidate(),contact=makePumpCatchNormalContact(model);
// Historical rejected coordinates are deliberate negative controls. Their
// archived sources are verified without pretending they are the current solver.
for(const source of data.sources)if(hashStudyFile(source.archive??source.file)!==source.sha256)throw Error('Changed historical evidence: '+source.file);
const sources=freezeStudySources([input,'artifacts/review/086-finite-rope-triangle-overlap.json','scripts/check-pump-catch-contact-guard.mjs',...data.sources.map(s=>s.file)],prefix);
const controls=[{name:'clear-source',q:[0,0,0],time:0},...overlap.pairs.filter(p=>p.failed).map(p=>({name:'rejected-'+p.name,...p.worst}))];
let poses=0,penetrating=0,falseClear=0,maximumTangentialSeparation=0;
for(const row of [...controls,...data.rows.filter((_,i)=>i%16===0)]){
  const angle=data.angularSpeed*row.time,raw=contact.minimumRawGap(row.q,angle),all=contact.query(row.q,angle),minimum=Math.min(0,...all.map(c=>c.gap));poses++;
  if(raw< -2e-8){penetrating++;if(minimum>=-2e-8)falseClear++;}
  for(const c of all){const d=c.point.map((v,k)=>v-c.feature.otherPoint[k]),tangential=Math.abs(d[0]*c.normal[1]-d[1]*c.normal[0]);maximumTangentialSeparation=Math.max(maximumTangentialSeparation,tangential);}
  if(row.name){row.rawGap=raw;row.minimumConstraint=minimum;}
}
const passed=controls[0].rawGap>=-1e-12&&controls.slice(1).every(c=>c.rawGap<-.008&&c.minimumConstraint<-.008)&&penetrating>0&&!falseClear&&maximumTangentialSeparation<1e-9;
verifyStudySources(sources);const report={movement:86,status:'rejected-return-pose-guard-controls',passed,mechanicsPassed:false,candidateIntegrated:false,
  poses,penetrating,falseClear,maximumTangentialSeparation,controls,sources,
  qualification:'The known rejected return pose and sampled historical coordinates exercise the current raw-gap and trial-escape guards. A passing guard rejects those penetrations; it does not prove a feasible return path or detect every possible edge crossing.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!passed)process.exitCode=1;
