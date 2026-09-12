import fs from 'node:fs';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchPrimaryBounds} from './lib/pump-catch-primary-bounds.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {verifyPumpCatchStudySources} from './lib/pump-catch-study-sources.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-first-complete-dynamics.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-primary-bounds',data=readStudyReport(input),
  nonmechanicalChanges=verifyPumpCatchStudySources(data.sources),model=makePumpCatchCompleteCandidate(),bounds=makePumpCatchPrimaryBounds(model),
  sources=freezeStudySources([input,'scripts/check-pump-catch-primary-bounds.mjs','scripts/lib/pump-catch-primary-bounds.mjs',
    'scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/pump-catch-study-sources.mjs',...pumpCatchCompleteSources],prefix),
  totals={certifiedPairs:0,boxExcludedPairs:0,subdivisions:0,maximumDepth:0,minimumLowerBound:Infinity},failures=[];
let intervals=0;
for(let i=1;i<data.rows.length;i++){
  const r=bounds.interval(data.rows[i-1],data.rows[i],data.angularSpeed);intervals++;
  for(const k of ['certifiedPairs','boxExcludedPairs','subdivisions'])totals[k]+=r.stats[k];
  totals.maximumDepth=Math.max(totals.maximumDepth,r.stats.maximumDepth);totals.minimumLowerBound=Math.min(totals.minimumLowerBound,r.stats.minimumLowerBound);
  if(!r.passed){failures.push({interval:i-1,...r.failures[0]});break;}
  if(i%2000===0)console.log({intervals,time:data.rows[i].time,...totals});
}
verifyStudySources(sources);const report={movement:86,passed:!failures.length&&intervals===data.rows.length-1,status:'continuous-primary-prism-triangle-bounds',
  input,tolerance:1e-6,intervals,totalIntervals:data.rows.length-1,totals,failures,parameters:bounds.parameters,nonmechanicalChanges,sources,
  productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,qualification:bounds.qualification};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
