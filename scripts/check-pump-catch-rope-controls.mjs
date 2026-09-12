import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-rope-controls',script='scripts/check-pump-catch-rope-bounds.mjs',
  cases=[[null,null],['solid-plinth','basePlinth'],['blocked-crossbar','pumpGuideCrossbar'],['closed-ferrule','ropeLoadFerrule']],results=[];
for(const[fixture,part]of cases){
  const runPrefix=prefix+'-'+(fixture??'baseline'),log=runPrefix+'.log',fd=fs.openSync(log,'wx');let result;
  try{result=spawnSync(process.execPath,[script],{env:{...process.env,PROBE_PREFIX:runPrefix,PROBE_FIXTURE:fixture??''},stdio:['ignore',fd,fd],timeout:120000});}
  finally{fs.closeSync(fd);}
  assert(!result.error&&result.signal===null,'Control process must finish normally');
  assert.equal(result.status,fixture?1:0,'Expected terminal exit for '+fixture);
  const file=runPrefix+'.json',data=readStudyReport(file);verifyStudySources(data.sources);
  assert.equal(data.passed,!fixture);assert.equal(data.fixture,fixture??null);
  if(fixture)assert(data.failures.some(f=>f.name===part),'Filled opening must fail its actual rope clearance');
  results.push({fixture,part,exitStatus:result.status,passed:data.passed,expectedResultObserved:true,
    file,sha256:hashStudyFile(file),log,logSha256:hashStudyFile(log),failures:data.failures.length});
}
const sources=freezeStudySources([script,'scripts/check-pump-catch-rope-controls.mjs',...results.map(r=>r.file)],prefix);verifyStudySources(sources);
const report={movement:86,passed:true,results,sources,
  qualification:'The complete unmodified baseline passes. Isolated boxes fill the plinth passage, upper crossbar slot and load ferrule bore while retaining each original outer envelope; every altered part fails its rope clearance. No candidate or production source geometry is changed.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
