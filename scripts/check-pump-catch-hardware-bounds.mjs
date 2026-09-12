import fs from 'node:fs';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {pumpCatchHardwareBounds} from './lib/pump-catch-hardware-bounds.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {verifyPumpCatchStudySources} from './lib/pump-catch-study-sources.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-complete-eighth-ms.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-hardware-bounds',data=readStudyReport(input),
  nonmechanicalChanges=verifyPumpCatchStudySources(data.sources),sources=freezeStudySources([input,'scripts/check-pump-catch-hardware-bounds.mjs','scripts/lib/pump-catch-hardware-bounds.mjs',
    'scripts/lib/pump-catch-study-sources.mjs',...pumpCatchCompleteSources,'tests/helpers/solid-surface.mjs'],prefix),range=Array.from({length:3},()=>[Infinity,-Infinity]);
for(const r of data.rows)for(let k=0;k<3;k++){range[k][0]=Math.min(range[k][0],r.q[k]);range[k][1]=Math.max(range[k][1],r.q[k]);}
const model=makePumpCatchCompleteCandidate(),bounds=pumpCatchHardwareBounds(model,{range,camRange:[data.angularSpeed*data.actualEnd,0]});verifyStudySources(sources);
const report={movement:86,status:'whole-motion-rigid-hardware-bounds',passed:!bounds.unresolved.length,input,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,
  ...bounds,nonmechanicalChanges,sources};fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,pairs:report.pairs.reduce((s,p)=>(s[p.method??'unresolved']=(s[p.method??'unresolved']??0)+1,s),{}),bodies:undefined,sources:undefined});if(!report.passed)process.exitCode=1;
