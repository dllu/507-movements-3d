import fs from 'node:fs';
import assert from 'node:assert/strict';
import {summarizePumpCatchRows} from './lib/pump-catch-summary.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-bounded-summary-controls',rows=Array.from({length:300001},(_,i)=>({time:i*.000125,q:[i-150000,0,i%17-8],slack:i%1000/1000}));
let oldFailed=false;try{Math.max(...rows.map(r=>r.slack));}catch(error){assert(error instanceof RangeError);oldFailed=true;}
assert(oldFailed,'Control must exceed the spread-call argument limit');
const actual=summarizePumpCatchRows(rows),expected={states:300001,actualEnd:37.5,range:[[-150000,150000],[0,0],[-8,8]],maximumSlack:.999};
assert.deepEqual(actual,expected);assert.throws(()=>summarizePumpCatchRows([]),/empty/);
const sources=freezeStudySources(['scripts/check-pump-catch-summary.mjs','scripts/lib/pump-catch-summary.mjs','scripts/lib/study-report-io.mjs'],prefix);verifyStudySources(sources);
const report={movement:86,status:'bounded-long-trajectory-summary-control',passed:true,oldFailed,actual,sources,
  qualification:'A 300,001-state fixture with independently known extrema reproduces the old argument-limit failure and passes the bounded summary. This checks report construction, not simulation mechanics.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
