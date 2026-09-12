import fs from 'node:fs';
import assert from 'node:assert/strict';
import {hashStudyFile} from './study-report-io.mjs';

// The bounded-summary fix happened after the completed 0.25 ms study. Allow
// that reporting-only change while still requiring identical simulation code
// and unchanged geometry/physics inputs for a time-step comparison.
export function verifyPumpCatchStudySources(sources){
  const reportingChanges=[];
  for(const s of sources){
    if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,'Retained source: '+s.file);
    const currentSha256=hashStudyFile(s.file);if(currentSha256===s.sha256)continue;
    assert(s.file==='scripts/study-pump-catch-bounded.mjs'&&s.archive,'Changed physical study input: '+s.file);
    const normalized=file=>{
      return fs.readFileSync(file,'utf8')
        .replace("import {summarizePumpCatchRows} from './lib/pump-catch-summary.mjs';\n",'')
        .replace("'scripts/lib/pump-catch-summary.mjs',",'')
        .replace('states:rows.length,actualEnd:rows.at(-1).time,range:[0,1,2].map(k=>[Math.min(...rows.map(r=>r.q[k])),Math.max(...rows.map(r=>r.q[k]))]),\n  maximumSlack:Math.max(...rows.map(r=>r.slack)),',
          '...summarizePumpCatchRows(rows),\n  ');
    };
    assert.equal(normalized(s.archive),normalized(s.file),'Only the known summary replacement may differ');
    reportingChanges.push({file:s.file,archive:s.archive,oldSha256:s.sha256,currentSha256,qualification:'Only the known bounded summary replacement differs; all other code is identical.'});
  }
  return reportingChanges;
}
